#!/usr/bin/env bash
# Moves a pilot's database into a new, empty managed Postgres (docs/DEPLOY-AWS.md,
# "Pilot se RDS"), as RDS allows it: as the schema's owner, not a superuser.
#
#   OWNER_URL=postgres://parikshaa_owner:…@host/parikshaa?sslmode=verify-full \
#     ./deploy/aws/scripts/import-dump.sh pilot.dump
#
# The dump is scripts/backup.sh's (pg_dump --format=custom). A restore as the
# owner works because the dump enables row-level security only after the
# data is in: FORCE comes before the data but means nothing until ENABLE. CI
# runs this against a real Postgres as a non-superuser owner, then verifies
# every chain (.github/workflows/ci.yml, "Import as RDS would").
#
# Refuses a database that already has Parikshaa's tables, so it can never
# overwrite a live one. Afterwards run the migrations as usual
# (parikshaa-migrate): they skip what the pilot had, apply anything newer, and
# give parikshaa_app its new password. Needs pg_restore and psql, version 16
# or newer.
set -euo pipefail

dump="${1:?usage: OWNER_URL=… $0 <dump>}"
: "${OWNER_URL:?set OWNER_URL to the new database, as its owner}"
[[ -r "$dump" ]] || { echo "cannot read $dump" >&2; exit 1; }

query() { psql -v ON_ERROR_STOP=1 -qAt -c "$1" "$OWNER_URL"; }

existing="$(query "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
if [[ "$existing" != 0 ]]; then
  echo "The database already has $existing tables: import only into a new, empty one." >&2
  exit 1
fi

# The dump grants to the runtime role; on a new server it does not exist yet.
# RDS's master user may create roles (CREATEROLE); it starts without a login,
# and the migrations give it one.
query "DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parikshaa_app') THEN
    CREATE ROLE parikshaa_app NOLOGIN;
  END IF;
END \$\$"

started=$(date +%s)
pg_restore --exit-on-error --no-owner --dbname="$OWNER_URL" "$dump"
echo "import: restored in $(($(date +%s) - started))s"

tables="$(query "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")"
applied="$(query "SELECT count(*) FROM schema_migrations")"
echo "import: $tables tables, $applied migrations recorded"
