#!/usr/bin/env bash
# A nightly backup of a Docker Compose deployment (docs/PILOT.md, "Backups").
#
#   sudo ./scripts/backup.sh            # run by cron; setup-server.sh installs it
#
# Dumps the database with pg_dump (custom format, what restore-drill.sh reads)
# into BACKUP_DIR, keeps KEEP_DAYS of them, and, if BACKUP_UPLOAD is set, runs
# it with the new file's path to copy it off the machine — a backup on the same
# disk as the database does not survive the disk. For example:
#
#   BACKUP_UPLOAD='aws s3 cp {} s3://my-bucket/parikshaa/'
#
# The data key (PARIKSHAA_DATA_KEY) is deliberately not in the dump: keep it
# somewhere else. A dump without it restores the ledger, the scores and the
# people, but not the sealed answers.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-/etc/parikshaa.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/parikshaa}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# The upload command can come from the settings file, as setup-server.sh writes it.
if [[ -z "${BACKUP_UPLOAD:-}" && -r "$ENV_FILE" ]]; then
  BACKUP_UPLOAD="$(sed -n 's/^BACKUP_UPLOAD=//p' "$ENV_FILE" | tail -n 1)"
  BACKUP_UPLOAD="${BACKUP_UPLOAD#\'}"
  BACKUP_UPLOAD="${BACKUP_UPLOAD%\'}"
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
stamp="$(date -u +%Y-%m-%dT%H%MZ)"
file="$BACKUP_DIR/parikshaa-$stamp.dump"

# Inside the database container, as its superuser over the local socket: a
# superuser is not held back by the ledger's forced row-level security, which
# is what makes a dump as the schema owner fail on managed Postgres.
docker compose --project-directory "$REPO" --env-file "$ENV_FILE" exec -T db \
  pg_dump -U parikshaa_owner -d parikshaa --format=custom --no-owner >"$file.partial"
mv "$file.partial" "$file"
chmod 600 "$file"
echo "backup: $file ($(du -h "$file" | cut -f1))"

if [[ -n "${BACKUP_UPLOAD:-}" ]]; then
  eval "${BACKUP_UPLOAD//\{\}/\"$file\"}"
  echo "backup: copied off the machine"
fi

find "$BACKUP_DIR" -name 'parikshaa-*.dump' -mtime +"$KEEP_DAYS" -delete
