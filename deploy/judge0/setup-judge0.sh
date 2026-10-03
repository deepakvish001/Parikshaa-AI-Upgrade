#!/usr/bin/env bash
# Set up Judge0 on its own VM (docs/F1-GO-LIVE-PLAN.md §5.2, deploy/judge0/README.md).
#
#   sudo JUDGE0_TOKEN=… ./setup-judge0.sh
#
# Ubuntu 22.04 or later. Judge0's sandbox (isolate) needs cgroup v1: on a
# machine still on v2, this turns v1 on at boot and asks for a reboot (exit 3);
# run it again after. Then it writes the secrets file (0600, never in the
# repository), starts Judge0 on the machine's private address only, installs
# the hourly purge of finished submissions, and checks /languages.
#
# Run again to upgrade (JUDGE0_IMAGE=…:<tag>): passwords are kept, the token
# is replaced by the one given.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETC="${JUDGE0_ETC:-/etc/parikshaa}"
DIR="${JUDGE0_DIR:-/opt/judge0}"
CGROUP="${CGROUP_ROOT:-/sys/fs/cgroup}"
GRUB="${GRUB_FILE:-/etc/default/grub}"
CRON="${CRON_DIR:-/etc/cron.hourly}"
IMAGE="${JUDGE0_IMAGE:-ghcr.io/deepakvish001/parikshaa-judge0:latest}"
FLAG="systemd.unified_cgroup_hierarchy=0"

die() { printf 'setup-judge0: %s\n' "$1" >&2; exit "${2:-1}"; }

[[ -n "${JUDGE0_TOKEN:-}" ]] || die "set JUDGE0_TOKEN: the token the API sends (JUDGE0_TOKEN in the API's settings too)" 2
[[ ${#JUDGE0_TOKEN} -ge 32 ]] || die "JUDGE0_TOKEN is too short: use at least 32 characters (openssl rand -hex 32)" 2

# --- cgroup v1 ------------------------------------------------------------------
if [[ -e "$CGROUP/cgroup.controllers" ]]; then
  if ! grep -q "$FLAG" "$GRUB"; then
    sed -i "s/^GRUB_CMDLINE_LINUX=\"\(.*\)\"/GRUB_CMDLINE_LINUX=\"\1 $FLAG\"/" "$GRUB"
    grep -q "$FLAG" "$GRUB" || die "could not add $FLAG to $GRUB"
    update-grub
  fi
  die "cgroup v1 is set for the next boot: reboot, then run this again" 3
fi

# --- Docker -------------------------------------------------------------------------
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  apt-get update
  apt-get install -y docker.io docker-compose-v2
fi

# --- secrets: passwords made once and kept, the token as given ---------------------------
install -d -m 0700 "$ETC"
secrets="$ETC/judge0.secrets.conf"
keep() { if [[ -f "$secrets" ]]; then sed -n "s/^$1=//p" "$secrets" | head -n1; fi; }
fresh() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }
postgres="$(keep POSTGRES_PASSWORD)"; postgres="${postgres:-$(fresh)}"
redis="$(keep REDIS_PASSWORD)"; redis="${redis:-$(fresh)}"
authz="$(keep AUTHZ_TOKEN)"; authz="${authz:-$(fresh)}"
umask 077
cat >"$secrets.new" <<CONF
AUTHN_TOKEN=$JUDGE0_TOKEN
AUTHZ_TOKEN=$authz
POSTGRES_PASSWORD=$postgres
REDIS_PASSWORD=$redis
CONF
chmod 0600 "$secrets.new"
mv "$secrets.new" "$secrets"
umask 022

# --- Judge0, on the private address only -------------------------------------------------
bind="${JUDGE0_BIND:-$(hostname -I | awk '{print $1}')}"
[[ -n "$bind" ]] || die "could not find this machine's private address; set JUDGE0_BIND"
install -d -m 0755 "$DIR"
install -m 0644 "$HERE/docker-compose.yml" "$HERE/judge0.conf" "$DIR/"
printf 'JUDGE0_IMAGE=%s\nJUDGE0_BIND=%s\n' "$IMAGE" "$bind" >"$DIR/.env"
docker compose --project-directory "$DIR" pull
docker compose --project-directory "$DIR" up -d --remove-orphans

# --- the purge: candidates' code does not stay here ------------------------------------------
cat >"$CRON/judge0-purge" <<PURGE
#!/bin/sh
# Judge0 keeps every submission; Parikshaa has its own copy of the result.
docker compose --project-directory "$DIR" exec -T db psql -U judge0 -d judge0 -qc "DELETE FROM submissions WHERE created_at < now() - interval '1 hour'"
PURGE
chmod 0755 "$CRON/judge0-purge"

# --- check -------------------------------------------------------------------------------
for _ in $(seq 1 30); do
  if languages="$(curl -fsS -H "X-Auth-Token: $JUDGE0_TOKEN" "http://$bind:2358/languages")"; then
    for name in "Python (3." "JavaScript (Node.js" "C (GCC" "C++ (GCC" "Java ("; do
      grep -qF "\"$name" <<<"$languages" || die "Judge0 is up but has no $name: is JUDGE0_IMAGE Parikshaa's image?"
    done
    printf 'Judge0 is up at http://%s:2358 with Parikshaa'"'"'s languages.\n' "$bind"
    printf 'On the API: RUNNER_BACKEND=judge0 JUDGE0_URL=http://%s:2358 JUDGE0_TOKEN=(the same token)\n' "$bind"
    exit 0
  fi
  sleep "${JUDGE0_WAIT:-5}"
done
die "Judge0 did not answer on http://$bind:2358 (docker compose --project-directory $DIR logs server)"
