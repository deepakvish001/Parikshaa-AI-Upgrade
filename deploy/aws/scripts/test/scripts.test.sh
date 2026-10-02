#!/usr/bin/env bash
# The deploy scripts against a fake AWS (fake/aws, fake/docker, fake/node):
# put-secrets.sh never loses or replaces the data key, and release.sh does its
# steps in order and puts the tag back when replacing machines fails.
#
#   deploy/aws/scripts/test/scripts.test.sh
#
# CI runs it in the terraform job. Needs bash, jq, openssl and git.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scripts="$(cd "$here/.." && pwd)"
export PATH="$here/fake:$PATH"
passed=0
failed=0

fresh() {
  FAKE_AWS="$(mktemp -d)"
  export FAKE_AWS
  mkdir -p "$FAKE_AWS/secrets" "$FAKE_AWS/images" "$FAKE_AWS/params"
  : >"$FAKE_AWS/calls"
}
secret() { cat "$FAKE_AWS/secrets/$1"; }
field() { secret "$1" | jq -r --arg n "$2" '.[$n] // empty'; }
check() {
  local name="$1"
  shift
  if "$@"; then
    passed=$((passed + 1))
  else
    failed=$((failed + 1))
    printf 'FAIL  %s\n' "$name" >&2
  fi
}
fails() { ! "$@" >/dev/null 2>&1; }
# Every secret here is made up as the test runs: none is ever written down.
fake() { openssl rand -hex 8; }

# --- put-secrets.sh -------------------------------------------------------------

export APP_SECRET=parikshaa/staging/app RUNNER_SECRET=parikshaa/staging/runner AWS_REGION=ap-south-1
put() { "$scripts/put-secrets.sh" staging "$@" >/dev/null; }

fresh
model_key="$(fake)"
put ANTHROPIC_API_KEY="$model_key"
check "makes the service's own secrets once" test "$(secret parikshaa_staging_app | jq -r 'keys | join(",")')" == "ANTHROPIC_API_KEY,ATTEMPT_TOKEN_SECRET,PARIKSHAA_APP_PASSWORD,PARIKSHAA_DATA_KEY,RUNNER_TOKEN"
check "the data key is 32 random bytes" test "$(field parikshaa_staging_app PARIKSHAA_DATA_KEY | base64 -d | wc -c)" == 32
check "the runner gets the same token and nothing else" test "$(secret parikshaa_staging_runner | jq -c .)" == "$(jq -cn --arg t "$(field parikshaa_staging_app RUNNER_TOKEN)" '{RUNNER_TOKEN: $t}')"
key="$(field parikshaa_staging_app PARIKSHAA_DATA_KEY)"
token="$(field parikshaa_staging_app ATTEMPT_TOKEN_SECRET)"

smtp="smtps://$(fake) and a space@email-smtp.ap-south-1.amazonaws.com:465"
put SMTP_URL="$smtp" EMAIL_FROM='Parikshaa <no-reply@example.in>'
check "a second run keeps the data key" test "$(field parikshaa_staging_app PARIKSHAA_DATA_KEY)" == "$key"
check "a second run keeps the token secret" test "$(field parikshaa_staging_app ATTEMPT_TOKEN_SECRET)" == "$token"
check "a second run keeps what was set before" test "$(field parikshaa_staging_app ANTHROPIC_API_KEY)" == "$model_key"
check "values are kept exactly, spaces and all" test "$(field parikshaa_staging_app SMTP_URL)" == "$smtp"

writes="$(grep -c 'put-secret-value' "$FAKE_AWS/calls")"
put
check "nothing changed, nothing written" test "$(grep -c 'put-secret-value' "$FAKE_AWS/calls")" == "$writes"

check "a different data key is refused" fails put PARIKSHAA_DATA_KEY="$(openssl rand -base64 32)"
check "and the stored one is untouched" test "$(field parikshaa_staging_app PARIKSHAA_DATA_KEY)" == "$key"
check "a different token secret is refused" fails put ATTEMPT_TOKEN_SECRET="$(fake)"
check "the same data key again is fine" put PARIKSHAA_DATA_KEY="$key"
check "SMTP without a sender is refused" fails put EMAIL_FROM=
check "Razorpay needs all three" fails put RAZORPAY_KEY_ID=rzp_live_x
check "the stack's own settings are refused" fails put PUBLIC_URL=https://elsewhere.example
check "a name must be CAPITALS" fails put smtp_url=x
check "a bare word is refused" fails put SMTP_URL

fresh
pilot_db="$(fake)"
pilot_app="$(fake)"
pilot_token="$(fake)"
pilot_key="$(openssl rand -base64 32)"
cat >"$FAKE_AWS/pilot.env" <<EOF
# Parikshaa's settings, written by scripts/setup-server.sh on 2026-09-01.
POSTGRES_PASSWORD='$pilot_db'
PARIKSHAA_APP_PASSWORD='$pilot_app'
ATTEMPT_TOKEN_SECRET='$pilot_token'
PARIKSHAA_DATA_KEY='$pilot_key'
RUNNER_TOKEN='$(fake)'
ANTHROPIC_API_KEY='$(fake)'
PUBLIC_URL='https://exam.college.in'
SMTP_URL='smtps://$(fake)@email-smtp.ap-south-1.amazonaws.com:465'
EMAIL_FROM='Parikshaa <no-reply@college.in>'
MSG91_AUTH_KEY=''
SELF_SIGNUP='on'
API_ADDRESS='127.0.0.1:3000'
TRUST_PROXY='true'
DOMAIN='exam.college.in'
BACKUP_UPLOAD='/snap/bin/aws s3 cp {} s3://b/pilot/'
EOF
put --from-env-file "$FAKE_AWS/pilot.env"
check "the pilot's data key comes across" test "$(field parikshaa_staging_app PARIKSHAA_DATA_KEY)" == "$pilot_key"
check "the pilot's token secret comes across, so candidates' links keep working" test "$(field parikshaa_staging_app ATTEMPT_TOKEN_SECRET)" == "$pilot_token"
check "the pilot's settings come across" test "$(field parikshaa_staging_app SELF_SIGNUP)/$(field parikshaa_staging_app EMAIL_FROM)" == 'on/Parikshaa <no-reply@college.in>'
check "what only the pilot machine used stays behind" test "$(secret parikshaa_staging_app | jq -r '[.POSTGRES_PASSWORD, .PUBLIC_URL, .API_ADDRESS, .TRUST_PROXY, .DOMAIN, .BACKUP_UPLOAD, .MSG91_AUTH_KEY] | map(select(. != null)) | length')" == 0
check "the database gets a new app password" test "$(field parikshaa_staging_app PARIKSHAA_APP_PASSWORD)" != "$pilot_app"

printf '%s' "$(cat "$FAKE_AWS/pilot.env")" >"$FAKE_AWS/secrets/parikshaa_pilot_settings"
check "--from-pilot reads the pilot's saved settings" put --from-pilot
other_key="$(openssl rand -base64 32)"
sed -i "s|^PARIKSHAA_DATA_KEY=.*|PARIKSHAA_DATA_KEY='$other_key'|" "$FAKE_AWS/pilot.env"
check "another pilot's data key is refused once one is set" fails put --from-env-file "$FAKE_AWS/pilot.env"

# --- release.sh -----------------------------------------------------------------

export RELEASE_POLL_SECONDS=0 CONFIRM=production
STACK_JSON="$(jq -cn '{
  region: "ap-south-1", domain: "staging.example.in",
  api_repository: "123456789012.dkr.ecr.ap-south-1.amazonaws.com/parikshaa/api",
  runner_repository: "123456789012.dkr.ecr.ap-south-1.amazonaws.com/parikshaa/runner",
  image_tag_parameter: "/parikshaa/staging/image-tag",
  api_group: "parikshaa-staging-api", runner_group: "parikshaa-staging-runner"
}')"
export STACK_JSON
release() { "$scripts/release.sh" "$@" >/dev/null 2>&1; }
head="$(git -C "$scripts" rev-parse HEAD)"
tag="${head:0:12}"
steps() { grep -oE '^(docker buildx|aws ssm send-command|aws ssm put-parameter|aws autoscaling start-instance-refresh --auto-scaling-group-name [a-z-]+|node)' "$FAKE_AWS/calls" | tr '\n' ';'; }

fresh
check "a release succeeds" release staging
check "builds both images, migrates, moves the tag, replaces runners then API, then checks the server" test "$(steps)" == "docker buildx;docker buildx;aws ssm send-command;aws ssm put-parameter;aws autoscaling start-instance-refresh --auto-scaling-group-name parikshaa-staging-runner;aws autoscaling start-instance-refresh --auto-scaling-group-name parikshaa-staging-api;node;"
check "the tag is the commit" test "$(cat "$FAKE_AWS/params/tag")" == "$tag"
check "the images are built for linux/amd64 from the committed tree" grep -q -- "docker buildx build --platform linux/amd64 --file Dockerfile.runner --tag 123456789012.dkr.ecr.ap-south-1.amazonaws.com/parikshaa/runner:$tag --push -" "$FAKE_AWS/calls"
check "the migration runs that tag on an API machine" test "$(jq -r '.commands[0]' "$FAKE_AWS/ssm-parameters")" == "/usr/local/bin/parikshaa-migrate $tag"
check "the server check runs against the site" grep -q "node .*/scripts/smoke.mjs https://staging.example.in" "$FAKE_AWS/calls"

: >"$FAKE_AWS/calls"
check "releasing the same commit again builds nothing" release staging --skip-smoke
check "(no build)" test "$(grep -c 'docker buildx' "$FAKE_AWS/calls")" == 0

fresh
check "--images-only pushes the images" release production --images-only
check "and does nothing else, not even ask" test "$(steps)" == "docker buildx;docker buildx;"
check "--tag releases an image already pushed" release production --tag "$tag" --skip-smoke
check "--tag of an image never pushed is refused" fails release production --tag 000000000000 --skip-smoke

fresh
echo "previous0001" >"$FAKE_AWS/params/tag"
export FAKE_MIGRATE_STATUS=Failed
check "a failed migration stops the release" fails release staging
unset FAKE_MIGRATE_STATUS
check "and leaves the tag and the machines alone" test "$(cat "$FAKE_AWS/params/tag")/$(grep -c start-instance-refresh "$FAKE_AWS/calls")" == "previous0001/0"

fresh
echo "previous0001" >"$FAKE_AWS/params/tag"
export FAKE_REFRESH_FAIL=parikshaa-staging-api
check "a failed replacement fails the release" fails release staging
unset FAKE_REFRESH_FAIL
check "and puts the tag back" test "$(cat "$FAKE_AWS/params/tag")" == previous0001
check "and skips the server check" test "$(grep -c '^node' "$FAKE_AWS/calls")" == 0

check "production asks first" fails env CONFIRM= "$scripts/release.sh" production --tag "$tag" </dev/null
check "an unknown environment is refused" fails release prod

printf '%s passed, %s failed\n' "$passed" "$failed"
[[ "$failed" == 0 ]]
