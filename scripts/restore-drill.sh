#!/usr/bin/env bash
# Restore drill (ROADMAP §10): prove a backup restores, not just that it exists.
#
#   SOURCE_URL=postgres://parikshaa_owner:…@db/parikshaa \
#   ADMIN_URL=postgres://postgres:…@db/postgres \
#   ./scripts/restore-drill.sh
#
# 1. Takes a dump of SOURCE_URL (or restores DUMP=path if given — the file
#    your nightly backup job wrote, which is the one that matters).
# 2. Restores it into a scratch database on ADMIN_URL's server.
# 3. Verifies every ledger chain in the restored copy and, when it took the
#    dump itself from a quiet source, compares row counts table by table
#    (SOURCE_IS_LIVE=1 skips that for a source still being written to).
# 4. Drops the scratch database (KEEP=1 to keep it), and prints how long each
#    step took: the restore time is your recovery time for this data size.
#
# Needs pg_dump, pg_restore, psql and a built checkout (npm run build).
# Exits non-zero if anything does not match.
set -euo pipefail

: "${SOURCE_URL:?set SOURCE_URL to the database to back up, as its owner}"
: "${ADMIN_URL:?set ADMIN_URL to a role that may create databases on the restore server}"
here="$(cd "$(dirname "$0")/.." && pwd)"
scratch="parikshaa_restore_drill_$(date -u +%Y%m%d%H%M%S)"
restore_url="$(printf '%s' "$ADMIN_URL" | sed -E "s#/[^/?]+(\?|$)#/${scratch}\1#")"
started=$(date +%s)
elapsed() { echo "$(( $(date +%s) - started ))s"; }

took_own_dump=0
if [ -z "${DUMP:-}" ]; then
  took_own_dump=1
  DUMP="$(mktemp -d)/parikshaa.dump"
  echo "[$(elapsed)] dumping the source"
  pg_dump --format=custom --file="$DUMP" "$SOURCE_URL"
fi
echo "[$(elapsed)] dump is $(du -h "$DUMP" | cut -f1)"

psql -q "$ADMIN_URL" -c "CREATE DATABASE ${scratch}"
cleanup() {
  if [ "${KEEP:-0}" != "1" ]; then psql -q "$ADMIN_URL" -c "DROP DATABASE IF EXISTS ${scratch} WITH (FORCE)"; fi
}
trap cleanup EXIT

restore_started=$(date +%s)
echo "[$(elapsed)] restoring into ${scratch}"
pg_restore --exit-on-error --no-owner --dbname="$restore_url" "$DUMP"
echo "[$(elapsed)] restored in $(( $(date +%s) - restore_started ))s"

echo "[$(elapsed)] verifying every chain in the restored copy"
DATABASE_URL="$restore_url" node "$here/packages/api/dist/verify-all-cli.js"

echo "[$(elapsed)] comparing row counts"
count_rows() {
  psql -At "$1" -c "SELECT string_agg(format('%s=%s', relname, n), ' ' ORDER BY relname) FROM (
    SELECT c.relname, (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text AS n
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind = 'r') t"
}
restored_counts="$(count_rows "$restore_url")"
# Against a nightly file the source has moved on since, so only a dump taken
# here, of a source nobody is writing to, can be compared row for row.
source_counts="$restored_counts"
[ "$took_own_dump" = "1" ] && [ "${SOURCE_IS_LIVE:-0}" != "1" ] && source_counts="$(count_rows "$SOURCE_URL")"
if [ "$source_counts" != "$restored_counts" ]; then
  echo "row counts differ"
  echo "  source:   $source_counts"
  echo "  restored: $restored_counts"
  exit 1
fi
echo "  every table matches: $restored_counts"
echo "[$(elapsed)] restore drill passed"
