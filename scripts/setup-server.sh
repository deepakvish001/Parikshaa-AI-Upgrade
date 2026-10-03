#!/usr/bin/env bash
# One machine, set up for a pilot (docs/PILOT.md, section 2): a fresh Ubuntu
# 22.04 or 24.04 server with a domain pointing at it.
#
#   git clone https://github.com/deepakvish001/Parikshaa-AI-Upgrade.git parikshaa
#   cd parikshaa && sudo ./scripts/setup-server.sh
#
# It asks for what only you know (the domain, your email, the API key, the
# email sender, the price) or reads them from the environment, and does the
# rest: Docker, gVisor for the code runner, the settings file with fresh
# secrets, the service, HTTPS through Caddy, a firewall, a nightly backup, and
# finally the server check (npm run smoke).
#
# Run it again at any time: it keeps the settings file and never makes new
# secrets once there are some (a new PARIKSHAA_DATA_KEY would make every
# sealed answer unreadable), rebuilds and restarts the service, and checks it.
#
#   --config-only   write the settings file and the Caddyfile, and stop
#
# Without questions (every value from the environment):
#
#   sudo DOMAIN=exam.college.in ADMIN_EMAIL=you@… ANTHROPIC_API_KEY=… \
#        SMTP_URL='smtps://…' EMAIL_FROM='Parikshaa <no-reply@…>' \
#        SIGNUP_PRICE_RUPEES=49 ./scripts/setup-server.sh
#
# SMS, WhatsApp and Razorpay are never asked for: set MSG91_AUTH_KEY/
# MSG91_TEMPLATE_ID, WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID, or RAZORPAY_* and
# PARIKSHAA_SUPPLIER_* in the environment or the settings file, and run it again.
#
# Staging and production (docs/STAGING.md): the database on Supabase and the
# pages on Vercel. Give DATABASE_URL (the parikshaa_app role, through the
# Supabase pooler) and this machine serves the API alone: no database here, no
# local backups (Supabase keeps them), migrations from the Migrate workflow.
# Give APP_DOMAIN too (where Vercel serves the pages) and DOMAIN becomes the
# API's own address, answering only requests that come through Vercel.
#
#   sudo DOMAIN=api.staging.example.in APP_DOMAIN=staging.example.in \
#        DATABASE_URL='postgresql://parikshaa_app.<ref>:…@aws-0-ap-south-1.pooler.supabase.com:6543/postgres' \
#        SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_… ./scripts/setup-server.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-/etc/parikshaa.env}"
CADDYFILE="${CADDYFILE:-/etc/caddy/Caddyfile}"
CONFIG_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --config-only) CONFIG_ONLY=true ;;
    -h | --help) sed -n '2,44p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

if [[ "$CONFIG_ONLY" == false ]]; then
  [[ $EUID -eq 0 ]] || die "Run as root: sudo $0"
  # shellcheck disable=SC1091
  . /etc/os-release
  [[ "${ID:-}" == ubuntu ]] || die "This script sets up Ubuntu 22.04 or 24.04; this is ${PRETTY_NAME:-unknown}."
fi

# --- settings ----------------------------------------------------------------

# What is already in the settings file wins over nothing, and the environment
# wins over the file: a re-run keeps everything unless told otherwise.
existing() {
  if [[ -r "$ENV_FILE" ]]; then sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed "s/^'\(.*\)'\$/\1/"; fi
}
value() {
  local name="$1" current
  current="${!name:-}"
  [[ -n "$current" ]] || current="$(existing "$name")"
  printf '%s' "$current"
}
ask() {
  local name="$1" prompt="$2" default="${3:-}" secret="${4:-}" current
  current="$(value "$name")"
  [[ -n "$current" ]] || current="$default"
  if [[ -z "$current" || "${ASK_AGAIN:-}" == "$name" ]]; then
    [[ -t 0 ]] || die "$name is needed: set it in the environment (or in $ENV_FILE)."
    local shown=""
    [[ -n "$default" ]] && shown=" [$default]"
    if [[ "$secret" == secret ]]; then read -r -s -p "$prompt$shown: " current; echo; else read -r -p "$prompt$shown: " current; fi
    [[ -n "$current" ]] || current="$default"
    [[ -n "$current" ]] || die "$name is needed."
  fi
  [[ "$current" != *"'"* && "$current" != *$'\n'* ]] || die "$name cannot contain a single quote or a line break."
  printf -v "$name" '%s' "$current"
}
secret() {
  local name="$1" bytes="$2" current
  current="$(existing "$name")"
  [[ -n "$current" ]] || current="$(openssl rand -base64 "$bytes" | tr -d '\n')"
  printf -v "$name" '%s' "$current"
}

say "Settings"
bare() { local d="${1#https://}"; printf '%s' "${d%%/*}"; }
ask DOMAIN "The address candidates will open, e.g. exam.college.in (no https://)"
DOMAIN="$(bare "$DOMAIN")"
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "DOMAIN should be a name like exam.college.in, not $DOMAIN."
# Supabase and Vercel (docs/STAGING.md): both optional, both kept on re-runs.
DATABASE_URL="$(value DATABASE_URL)"
[[ -z "$DATABASE_URL" || "$DATABASE_URL" =~ ^postgres(ql)?:// ]] || die "DATABASE_URL should start with postgresql://"
[[ "$DATABASE_URL" != *"'"* && "$DATABASE_URL" != *$'\n'* ]] || die "DATABASE_URL cannot contain a single quote or a line break."
APP_DOMAIN="$(bare "$(value APP_DOMAIN)")"
[[ -z "$APP_DOMAIN" || "$APP_DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "APP_DOMAIN should be a name like staging.example.in, not $APP_DOMAIN."
[[ "$APP_DOMAIN" != "$DOMAIN" ]] || die "APP_DOMAIN (the pages, on Vercel) and DOMAIN (this machine, the API) must differ."
ask ADMIN_EMAIL "Your email: for new sign-ups, the pilot report each morning, and HTTPS certificate notices"
ask ANTHROPIC_API_KEY "Anthropic API key (grading and follow-up questions)" "" secret
ask SMTP_URL "SMTP URL for sending email, e.g. smtps://USER:PASS@email-smtp.ap-south-1.amazonaws.com" "" secret
ask EMAIL_FROM "Email sender, e.g. Parikshaa <no-reply@college.in>" "Parikshaa <no-reply@$DOMAIN>"
ask SELF_SIGNUP "Let institutions sign themselves up (on/off)" "on"
if [[ "$SELF_SIGNUP" == on ]]; then
  ask SIGNUP_PRICE_RUPEES "Price per attempt in rupees, before GST, once the free attempts are used" "49"
  ask SIGNUP_TRIAL_CREDITS "Free attempts for each new institution" "25"
fi
BACKUP_UPLOAD="$(value BACKUP_UPLOAD)"
# Optional, and never asked: SMS through MSG91, WhatsApp, and selling credits
# through Razorpay with GST invoices, from the environment or kept from the
# settings file (docs/PILOT.md, "SMS and WhatsApp"; docs/OPERATIONS.md, "Selling credits").
OPTIONAL=(MSG91_AUTH_KEY MSG91_TEMPLATE_ID WHATSAPP_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_LANGUAGE WHATSAPP_API_URL
  RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET RAZORPAY_WEBHOOK_SECRET
  PARIKSHAA_SUPPLIER_NAME PARIKSHAA_SUPPLIER_GSTIN PARIKSHAA_SUPPLIER_ADDRESS PARIKSHAA_SUPPLIER_SAC PARIKSHAA_BANK_ACCOUNT_NAME PARIKSHAA_BANK_ACCOUNT PARIKSHAA_BANK_IFSC PARIKSHAA_BANK_NAME LEVER_API_URL
  SUPABASE_URL SUPABASE_SECRET_KEY MEDIA_BUCKET)
for name in "${OPTIONAL[@]}"; do
  printf -v "$name" '%s' "$(value "$name")"
  [[ "${!name}" != *"'"* && "${!name}" != *$'\n'* ]] || die "$name cannot contain a single quote or a line break."
done

secret POSTGRES_PASSWORD 24
secret PARIKSHAA_APP_PASSWORD 24
secret ATTEMPT_TOKEN_SECRET 36
secret PARIKSHAA_DATA_KEY 32
secret RUNNER_TOKEN 36
# What Vercel adds to every request it passes on, so this machine can tell
# them from anyone calling it directly (docs/STAGING.md). Hex: it goes in a header.
PARIKSHAA_EDGE_SECRET="$(existing PARIKSHAA_EDGE_SECRET)"
[[ -n "$PARIKSHAA_EDGE_SECRET" || -z "$APP_DOMAIN" ]] || PARIKSHAA_EDGE_SECRET="$(openssl rand -hex 32)"
PUBLIC_HOST="${APP_DOMAIN:-$DOMAIN}"

say "Writing $ENV_FILE"
fresh=true
[[ -e "$ENV_FILE" ]] && fresh=false
mkdir -p "$(dirname "$ENV_FILE")"
umask 077
{
  echo "# Parikshaa's settings, written by scripts/setup-server.sh on $(date -u +%Y-%m-%d)."
  echo "# Keep a copy somewhere else: losing PARIKSHAA_DATA_KEY loses every sealed answer."
  echo
  echo "# Database: on this machine, or DATABASE_URL (Supabase, as parikshaa_app) when set"
  echo "POSTGRES_PASSWORD='$POSTGRES_PASSWORD'"
  echo "PARIKSHAA_APP_PASSWORD='$PARIKSHAA_APP_PASSWORD'"
  echo "DATABASE_URL='$DATABASE_URL'"
  echo
  echo "# The service's own secrets: made once, never again"
  echo "ATTEMPT_TOKEN_SECRET='$ATTEMPT_TOKEN_SECRET'"
  echo "PARIKSHAA_DATA_KEY='$PARIKSHAA_DATA_KEY'"
  echo "RUNNER_TOKEN='$RUNNER_TOKEN'"
  echo
  echo "# The model"
  echo "ANTHROPIC_API_KEY='$ANTHROPIC_API_KEY'"
  echo
  echo "# Where candidates go, and email"
  echo "PUBLIC_URL='https://$PUBLIC_HOST'"
  echo "SMTP_URL='$SMTP_URL'"
  echo "EMAIL_FROM='$EMAIL_FROM'"
  echo
  echo "# Optional: SMS (MSG91), WhatsApp (Cloud API), Razorpay and the GST supplier; empty means not set up"
  for name in "${OPTIONAL[@]}"; do echo "$name='${!name}'"; done
  echo
  echo "# The pilot"
  echo "SELF_SIGNUP='$SELF_SIGNUP'"
  if [[ "$SELF_SIGNUP" == on ]]; then
    echo "SIGNUP_PRICE_RUPEES='$SIGNUP_PRICE_RUPEES'"
    echo "SIGNUP_TRIAL_CREDITS='$SIGNUP_TRIAL_CREDITS'"
  fi
  echo "SIGNUP_NOTIFY_EMAIL='$ADMIN_EMAIL'"
  echo
  echo "# Behind Caddy on this machine: the API listens on localhost only, and trusts Caddy's forwarded address"
  echo "API_ADDRESS='127.0.0.1:3000'"
  echo "TRUST_PROXY='true'"
  echo
  echo "# Setup's own: the domain and your address, for re-runs; BACKUP_UPLOAD copies each backup off the machine ({} is the file)"
  echo "DOMAIN='$DOMAIN'"
  echo "APP_DOMAIN='$APP_DOMAIN'"
  echo "PARIKSHAA_EDGE_SECRET='$PARIKSHAA_EDGE_SECRET'"
  echo "ADMIN_EMAIL='$ADMIN_EMAIL'"
  echo "BACKUP_UPLOAD='$BACKUP_UPLOAD'"
} >"$ENV_FILE.new"
mv "$ENV_FILE.new" "$ENV_FILE"
chmod 600 "$ENV_FILE"
umask 022
if [[ "$fresh" == true ]]; then echo "New secrets made. Copy $ENV_FILE somewhere safe now."; else echo "Kept the existing secrets."; fi

say "Writing $CADDYFILE"
mkdir -p "$(dirname "$CADDYFILE")"
if [[ -z "$APP_DOMAIN" ]]; then
  cat >"$CADDYFILE" <<EOF
# Written by scripts/setup-server.sh. HTTPS for $DOMAIN, certificates renewed by Caddy.
{
	email $ADMIN_EMAIL
}

$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3000
}
EOF
else
  # The pages are on Vercel, which passes /api on to this machine with the
  # client's address in X-Forwarded-For (Vercel sets it; no client can) and
  # the edge secret in X-Parikshaa-Edge. Only such requests reach the API, so
  # the address it forwards can be trusted; anything else is turned away.
  umask 027
  cat >"$CADDYFILE" <<EOF
# Written by scripts/setup-server.sh. HTTPS for $DOMAIN: the API, behind Vercel ($APP_DOMAIN).
# Holds the edge secret: readable by root and Caddy only.
{
	email $ADMIN_EMAIL
	servers {
		trusted_proxies static 0.0.0.0/0 ::/0
	}
}

$DOMAIN {
	encode zstd gzip
	@edge header X-Parikshaa-Edge "$PARIKSHAA_EDGE_SECRET"
	handle @edge {
		request_header -X-Parikshaa-Edge
		reverse_proxy 127.0.0.1:3000
	}
	respond "Open https://$APP_DOMAIN" 403
}
EOF
  umask 022
fi

if [[ "$CONFIG_ONLY" == true ]]; then
  say "Settings written; nothing installed or started (--config-only)."
  exit 0
fi

# --- the machine -------------------------------------------------------------

export DEBIAN_FRONTEND=noninteractive
arch="$(dpkg --print-architecture)"

say "Installing Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  apt-get update -q
  apt-get install -y -q ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$arch signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

say "Installing gVisor, the code runner's sandbox"
if ! command -v runsc >/dev/null; then
  curl -fsSL https://gvisor.dev/archive.key | gpg --dearmor --yes -o /usr/share/keyrings/gvisor-archive-keyring.gpg
  echo "deb [arch=$arch signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" >/etc/apt/sources.list.d/gvisor.list
  apt-get update -q
  apt-get install -y -q runsc
fi
if ! docker info --format '{{json .Runtimes}}' | grep -q runsc; then
  runsc install
  systemctl restart docker
fi

say "Installing Caddy, for HTTPS"
if ! command -v caddy >/dev/null; then
  apt-get install -y -q debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt >/etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q
  apt-get install -y -q caddy
fi
[[ -z "$APP_DOMAIN" ]] || { chgrp caddy "$CADDYFILE"; chmod 640 "$CADDYFILE"; }

say "Firewall: SSH, HTTP and HTTPS in; nothing else"
apt-get install -y -q ufw >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
# Docker's published ports go around ufw; the API is therefore published on
# 127.0.0.1 only (API_ADDRESS), and reached from outside through Caddy alone.

# --- the service -------------------------------------------------------------

say "Building and starting Parikshaa (the first build takes a few minutes)"
compose=(docker compose --project-directory "$REPO" --env-file "$ENV_FILE")
if [[ -z "$DATABASE_URL" ]]; then
  "${compose[@]}" up -d --build
else
  # The database is Supabase's: only the API and the runner run here.
  compose+=(-f "$REPO/docker-compose.yml" -f "$REPO/deploy/vm/external-db.yml")
  "${compose[@]}" up -d --build api runner
fi

say "Waiting for it to answer"
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then break; fi
  sleep 5
done
curl -fsS http://127.0.0.1:3000/api/health >/dev/null || die "The API did not answer on 127.0.0.1:3000. See: docker compose --env-file $ENV_FILE logs api"
echo "The API answers."

systemctl enable --now caddy >/dev/null
systemctl reload caddy

if [[ -n "$DATABASE_URL" ]]; then
  say "Backups"
  echo "The database is Supabase's, which keeps the backups (and point-in-time recovery on Pro): nothing to do here."
else
  say "Nightly backups, at 2:30 am IST"
  cat >/etc/cron.d/parikshaa-backup <<EOF
# Written by scripts/setup-server.sh: a database dump every night at 02:30 IST (21:00 UTC), kept 14 days.
0 21 * * * root $REPO/scripts/backup.sh >>/var/log/parikshaa-backup.log 2>&1
EOF
  chmod 644 /etc/cron.d/parikshaa-backup
  "$REPO/scripts/backup.sh" || die "The first backup failed; see above."
  [[ -n "$BACKUP_UPLOAD" ]] || echo "Backups are on this machine only. Set BACKUP_UPLOAD in $ENV_FILE to copy each one elsewhere."
fi

say "The server check"
here="$(curl -fsS -4 https://api.ipify.org 2>/dev/null || true)"
there="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1 {print $1}' || true)"
if [[ -n "$here" && "$there" != "$here" ]]; then
  echo "$DOMAIN points at ${there:-nothing} and this machine is $here: point its DNS here, wait a few minutes, and run"
  echo "  docker run --rm -v $REPO/scripts:/s:ro node:22-alpine node /s/smoke.mjs https://$DOMAIN"
else
  sleep 10 # Caddy fetching its first certificate
  docker run --rm -v "$REPO/scripts:/s:ro" node:22-alpine node /s/smoke.mjs "https://$PUBLIC_HOST" || true
fi

say "Done."
cat <<EOF
  Console:    https://$PUBLIC_HOST/console/
  Settings:   $ENV_FILE  (copy it somewhere safe: it holds the data key)
  Backups:    /var/backups/parikshaa, nightly; log in /var/log/parikshaa-backup.log
  Logs:       docker compose --project-directory $REPO --env-file $ENV_FILE logs -f api

Next (docs/PILOT.md, step 3): make yourself a test organisation (not billed,
so the check spends no one's credits), then run the full server check as its owner:

  ${compose[*]} exec -e PARIKSHAA_OWNER_PASSWORD='a long password' api \\
    node packages/api/dist/admin-cli.js --org server-check --org-name "Server check" --email check@$DOMAIN --name "Server check"
  docker run --rm -e SMOKE_EMAIL=check@$DOMAIN -e SMOKE_PASSWORD='a long password' \\
    -v $REPO/scripts:/s:ro node:22-alpine node /s/smoke.mjs https://$DOMAIN
EOF
