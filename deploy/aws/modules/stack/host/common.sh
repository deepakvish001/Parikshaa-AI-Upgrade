# Shared by the parikshaa-* commands on every machine of a stack. Sourced, not
# run. /etc/parikshaa/stack.env (written at first boot from Terraform) says
# which machine this is and where everything lives; none of it is secret.
# shellcheck shell=bash
# shellcheck disable=SC1091
. /etc/parikshaa/stack.env

aws() { /snap/bin/aws --region "$REGION" "$@"; }

die() { printf 'parikshaa: %s\n' "$*" >&2; exit 1; }

released_tag() {
  aws ssm get-parameter --name "$IMAGE_TAG_PARAMETER" --query Parameter.Value --output text
}

secret_json() {
  aws secretsmanager get-secret-value --secret-id "$1" --query SecretString --output text
}

# This machine's id, for its log stream (IMDSv2, from the host only).
instance_id() {
  local token
  token="$(curl -fsS -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
  curl -fsS -H "X-aws-ec2-metadata-token: $token" http://169.254.169.254/latest/meta-data/instance-id
}

# Pulls repository:tag from ECR and prints the image's full name.
pull() {
  local image="$1:$2"
  aws ecr get-login-password | docker login --username AWS --password-stdin "${1%%/*}" >/dev/null
  docker pull -q "$image" >/dev/null
  printf '%s' "$image"
}

# A Postgres URL both libpq (pg_restore) and node-postgres read: verify-full
# against the RDS certificate bundle, mounted into containers at /certs/rds.pem.
db_url() {
  local user password
  user="$(jq -rn --arg v "$1" '$v|@uri')"
  password="$(jq -rn --arg v "$2" '$v|@uri')"
  printf 'postgres://%s:%s@%s:5432/parikshaa?sslmode=verify-full&sslrootcert=/certs/rds.pem' "$user" "$password" "$DB_HOST"
}

owner_url() {
  local master
  master="$(secret_json "$MASTER_SECRET_ARN")"
  db_url "$(jq -r .username <<<"$master")" "$(jq -r .password <<<"$master")"
}

app_password() {
  local password
  password="$(secret_json "$SECRET_ID" | jq -r '.PARIKSHAA_APP_PASSWORD // empty')"
  [[ -n "$password" ]] || die "PARIKSHAA_APP_PASSWORD is not in $SECRET_ID yet: run deploy/aws/scripts/put-secrets.sh first."
  printf '%s' "$password"
}

# Writes NAME=value lines for `docker run --env-file` (taken literally, one per
# line) to a file only root can read, and prints its path.
env_file() {
  local file
  file="$(mktemp /run/parikshaa/env.XXXXXX)"
  chmod 600 "$file"
  printf '%s\n' "$@" >"$file"
  printf '%s' "$file"
}

mkdir -p /run/parikshaa
chmod 700 /run/parikshaa
