#!/usr/bin/env bash
# Fills an environment's secrets in Secrets Manager (docs/DEPLOY-AWS.md,
# "Secrets"). Terraform makes them empty, so no value ever sits in its state.
#
#   deploy/aws/scripts/put-secrets.sh staging ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
#       SMTP_URL="smtps://$SES_SMTP_USER:$SES_SMTP_PASSWORD@email-smtp.ap-south-1.amazonaws.com:465" \
#       EMAIL_FROM='Parikshaa <no-reply@parikshaa.in>'
#   deploy/aws/scripts/put-secrets.sh production --from-pilot
#   deploy/aws/scripts/put-secrets.sh production --from-env-file pilot.env
#
# Run it again at any time: it keeps every value already there and changes
# only the names given. The service's own secrets (ATTEMPT_TOKEN_SECRET,
# PARIKSHAA_DATA_KEY, RUNNER_TOKEN, PARIKSHAA_APP_PASSWORD) are made once and
# never replaced: a new PARIKSHAA_DATA_KEY would make every sealed answer
# unreadable, so a different one is refused, not written.
#
# --from-pilot reads the pilot's settings (parikshaa/pilot/settings, written
# by parikshaa-save-settings) and --from-env-file a copy of /etc/parikshaa.env:
# the pilot's data key and token secret come across, so the answers sealed
# on the pilot open on the managed stack. What only the pilot machine uses
# (its Postgres password, its domain, its backup command) stays behind.
#
# The machines read the secrets as they start; to apply a change to running
# ones, run release.sh with --tag of the current release.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
die() { printf 'put-secrets: %s\n' "$*" >&2; exit 1; }

env="${1:-}"
[[ "$env" == staging || "$env" == production ]] || die "usage: $0 <staging|production> [--from-pilot | --from-env-file FILE] [NAME=value …]"
shift

# Where the secrets are: terraform's outputs, or (for tests, or without a
# Terraform checkout) APP_SECRET, RUNNER_SECRET and AWS_REGION.
if [[ -n "${APP_SECRET:-}" ]]; then
  app_secret="$APP_SECRET"
  runner_secret="${RUNNER_SECRET:?set RUNNER_SECRET with APP_SECRET}"
  region="${AWS_REGION:?set AWS_REGION with APP_SECRET}"
else
  stack="$(terraform -chdir="$here/../envs/$env" output -json stack)"
  app_secret="$(jq -r .app_secret <<<"$stack")"
  runner_secret="$(jq -r .runner_secret <<<"$stack")"
  region="$(jq -r .region <<<"$stack")"
fi

aws_() { aws --region "$region" "$@"; }

# The secret's JSON, or {} when it has no value yet.
current() {
  local out
  if out="$(aws_ secretsmanager get-secret-value --secret-id "$1" --query SecretString --output text 2>&1)"; then
    printf '%s' "$out"
  elif [[ "$out" == *"can't find the specified secret value"* || "$out" == *ResourceNotFoundException* ]]; then
    printf '{}'
  else
    die "reading $1: $out"
  fi
}

# NAME=value lines from a pilot settings file (setup-server.sh writes NAME='value').
from_env_text() {
  local line name value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^([A-Z][A-Z0-9_]*)=(.*)$ ]] || continue
    name="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    [[ "$value" == \'*\' ]] && value="${value:1:${#value}-2}"
    case "$name" in
      # The pilot machine's own: Postgres on the machine, Caddy, its backup, its address.
      POSTGRES_PASSWORD | PARIKSHAA_APP_PASSWORD | API_ADDRESS | TRUST_PROXY | PUBLIC_URL | DOMAIN | ADMIN_EMAIL | BACKUP_UPLOAD | AWS_DEFAULT_REGION) continue ;;
    esac
    [[ -n "$value" ]] && printf '%s=%s\n' "$name" "$value"
  done
}

# Written for macOS's bash 3.2 too: no mapfile, and an empty array is never
# expanded bare under set -u.
incoming=()
take() {
  local line
  while IFS= read -r line; do [[ -n "$line" ]] && incoming+=("$line"); done
  return 0
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-pilot)
      text="$(aws_ secretsmanager get-secret-value --secret-id parikshaa/pilot/settings --query SecretString --output text)" ||
        die "no pilot settings in Secrets Manager: run sudo parikshaa-save-settings on the pilot first"
      take < <(from_env_text <<<"$text")
      ;;
    --from-env-file)
      [[ -r "${2:-}" ]] || die "cannot read ${2:-the file after --from-env-file}"
      take < <(from_env_text <"$2")
      shift
      ;;
    *=*) incoming+=("$1") ;;
    *) die "not NAME=value: $1" ;;
  esac
  shift
done

app="$(current "$app_secret")"
before="$app"

for pair in ${incoming[@]+"${incoming[@]}"}; do
  name="${pair%%=*}"
  value="${pair#*=}"
  [[ "$name" =~ ^[A-Z][A-Z0-9_]*$ ]] || die "$name is not a setting's name (CAPITALS_AND_UNDERSCORES)"
  [[ "$value" != *$'\n'* ]] || die "$name has a line break"
  case "$name" in
    DATABASE_URL | PUBLIC_URL | RUNNER_URL | TRUST_PROXY | PORT | DATABASE_POOL_MAX)
      die "$name is the stack's to set (Terraform writes it on every machine), not a secret" ;;
    PARIKSHAA_DATA_KEY | ATTEMPT_TOKEN_SECRET)
      existing="$(jq -r --arg n "$name" '.[$n] // empty' <<<"$app")"
      if [[ -n "$existing" && "$existing" != "$value" ]]; then
        die "$name is already set and differs from the one given. Changing it would make every sealed answer (or every candidate's link) stop working, so it is never replaced."
      fi ;;
  esac
  app="$(jq --arg n "$name" --arg v "$value" '.[$n] = $v' <<<"$app")"
done

# Made once, kept for ever.
made=""
generate() {
  if [[ -z "$(jq -r --arg n "$1" '.[$n] // empty' <<<"$app")" ]]; then
    app="$(jq --arg n "$1" --arg v "$2" '.[$n] = $v' <<<"$app")"
    made="$made $1"
  fi
}
generate ATTEMPT_TOKEN_SECRET "$(openssl rand -base64 36 | tr -d '\n')"
generate PARIKSHAA_DATA_KEY "$(openssl rand -base64 32 | tr -d '\n')"
generate RUNNER_TOKEN "$(openssl rand -base64 36 | tr -d '\n')"
generate PARIKSHAA_APP_PASSWORD "$(openssl rand -hex 24)"

# What the API refuses to start without, checked here rather than on a
# machine that would then be replaced over and over (packages/api/src/main.ts).
needs() {
  local when="$1"
  shift
  [[ -n "$(jq -r --arg n "$when" '.[$n] // empty' <<<"$app")" ]] || return 0
  local name
  for name in "$@"; do
    [[ -n "$(jq -r --arg n "$name" '.[$n] // empty' <<<"$app")" ]] || die "$when is set, so $name is needed too"
  done
}
needs SMTP_URL EMAIL_FROM
needs MSG91_AUTH_KEY MSG91_TEMPLATE_ID
needs WHATSAPP_TOKEN WHATSAPP_PHONE_NUMBER_ID
needs RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET
needs VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT

umask 077
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

if [[ "$app" != "$before" ]]; then
  printf '%s' "$app" >"$tmp"
  aws_ secretsmanager put-secret-value --secret-id "$app_secret" --secret-string "file://$tmp" >/dev/null
fi
token="$(jq -r .RUNNER_TOKEN <<<"$app")"
if [[ "$(current "$runner_secret" | jq -r '.RUNNER_TOKEN // empty')" != "$token" ]]; then
  jq -n --arg t "$token" '{RUNNER_TOKEN: $t}' >"$tmp"
  aws_ secretsmanager put-secret-value --secret-id "$runner_secret" --secret-string "file://$tmp" >/dev/null
fi

echo "$env: $(jq -r 'keys | join(", ")' <<<"$app")"
if [[ -n "$made" ]]; then
  echo "Made:$made."
fi
if [[ "$made " == *" PARIKSHAA_DATA_KEY "* ]]; then
  echo "Keep a copy of PARIKSHAA_DATA_KEY somewhere other than AWS (a password manager): without it no sealed answer can be read again."
fi
[[ -n "$(jq -r '.ANTHROPIC_API_KEY // empty' <<<"$app")" ]] ||
  echo "ANTHROPIC_API_KEY is not set: grading and follow-up questions will not work until it is."
