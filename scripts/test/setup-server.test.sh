#!/usr/bin/env bash
# scripts/setup-server.sh --config-only, in its two shapes (docs/STAGING.md):
# everything on one machine, and the API alone with the database on Supabase
# and the pages on Vercel. Writes into a temporary directory; installs nothing.
# Each check is a condition in single quotes, evaluated by `check`: the
# variables it names are read there, not where it is written.
# shellcheck disable=SC2016,SC2034,SC1091
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

setup() {
  # Every value from the environment: no questions.
  env -i PATH="$PATH" HOME="$work" ENV_FILE="$work/$1.env" CADDYFILE="$work/$1.Caddyfile" \
    ADMIN_EMAIL=ops@example.in ANTHROPIC_API_KEY=sk-test SMTP_URL=smtps://u:p@smtp.example.in EMAIL_FROM='Parikshaa <no-reply@example.in>' \
    SELF_SIGNUP=off "${@:2}" "$REPO/scripts/setup-server.sh" --config-only >"$work/$1.log" 2>&1
}
get() { sed -n "s/^$2='\(.*\)'\$/\1/p" "$work/$1.env"; }

# --- one machine, as for a college's own server -------------------------------
setup one DOMAIN=exam.college.in
check "one machine: links go to its own address" '[[ "$(get one PUBLIC_URL)" == https://exam.college.in ]]'
check "one machine: no database elsewhere, no edge secret" '[[ -z "$(get one DATABASE_URL)" && -z "$(get one PARIKSHAA_EDGE_SECRET)" ]]'
check "one machine: Caddy passes everything to the API" 'grep -q "reverse_proxy 127.0.0.1:3000" "$work/one.Caddyfile" && ! grep -q X-Parikshaa-Edge "$work/one.Caddyfile"'

# --- the API alone: Supabase and Vercel ---------------------------------------
db='postgresql://parikshaa_app.ref:secret@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
setup split DOMAIN=https://api.staging.example.in/ APP_DOMAIN=staging.example.in DATABASE_URL="$db" \
  SUPABASE_URL=https://ref.supabase.co SUPABASE_SECRET_KEY=sb_secret_test
edge="$(get split PARIKSHAA_EDGE_SECRET)"
check "split: links go to the pages on Vercel" '[[ "$(get split PUBLIC_URL)" == https://staging.example.in ]]'
check "split: the API is reached at its own name" '[[ "$(get split DOMAIN)" == api.staging.example.in ]]'
check "split: the database is Supabase's" '[[ "$(get split DATABASE_URL)" == "$db" ]]'
check "split: storage settings are kept" '[[ "$(get split SUPABASE_URL)" == https://ref.supabase.co && "$(get split SUPABASE_SECRET_KEY)" == sb_secret_test ]]'
check "split: an edge secret is made, 32 bytes of hex" '[[ "$edge" =~ ^[0-9a-f]{64}$ ]]'
check "split: Caddy answers only requests carrying it, and strips it" \
  'grep -q "@edge header X-Parikshaa-Edge \"$edge\"" "$work/split.Caddyfile" && grep -q "request_header -X-Parikshaa-Edge" "$work/split.Caddyfile" && grep -q " 403$" "$work/split.Caddyfile"'
check "split: the forwarded address is kept" 'grep -q "trusted_proxies static 0.0.0.0/0 ::/0" "$work/split.Caddyfile"'
check "split: the Caddyfile is not world-readable" '[[ "$(stat -c %a "$work/split.Caddyfile")" == 640 ]]'
check "split: the settings file is the owner's alone" '[[ "$(stat -c %a "$work/split.env")" == 600 ]]'

# A re-run keeps every secret, the edge secret too.
key="$(get split PARIKSHAA_DATA_KEY)"
setup split DOMAIN=api.staging.example.in
check "re-run: the edge secret and the data key stay" '[[ "$(get split PARIKSHAA_EDGE_SECRET)" == "$edge" && "$(get split PARIKSHAA_DATA_KEY)" == "$key" ]]'
check "re-run: Supabase and Vercel are remembered" '[[ "$(get split DATABASE_URL)" == "$db" && "$(get split APP_DOMAIN)" == staging.example.in ]]'

# --- refused ----------------------------------------------------------------
if setup same DOMAIN=exam.example.in APP_DOMAIN=exam.example.in; then fail "the pages and the API on one name are refused"; else
  check "the pages and the API on one name are refused" 'grep -q "must differ" "$work/same.log"'
fi
if setup bad DOMAIN=api.example.in DATABASE_URL=mysql://x; then fail "a database URL that is not Postgres is refused"; else pass "a database URL that is not Postgres is refused"; fi

# --- compose: the API alone does not wait for a local database ----------------
if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then
  set -a
  # shellcheck disable=SC1090
  . "$work/split.env"
  set +a
  out="$(docker compose --project-directory "$REPO" -f "$REPO/docker-compose.yml" -f "$REPO/deploy/vm/external-db.yml" config api)"
  check "compose: the API uses Supabase's database" 'grep -q "DATABASE_URL: $db" <<<"$out"'
  check "compose: and starts without the local one" '! grep -q "service_healthy\|service_completed_successfully" <<<"$out"'
fi

if ((failures > 0)); then
  printf '\n%d failed\n' "$failures"
  exit 1
fi
printf '\nall passed\n'
