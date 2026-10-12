#!/usr/bin/env bash
# deploy/judge0/setup-judge0.sh against fake docker, curl and update-grub, in a
# temporary directory: the cgroup v1 switch, the secrets file, the purge, the check.
# Each check is a condition in single quotes, evaluated by `check`.
# shellcheck disable=SC2016,SC2034
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

# Fakes: docker records what it is asked; curl answers /languages from $LANGUAGES.
mkdir -p "$work/bin" "$work/cgroup" "$work/cron"
cat >"$work/bin/docker" <<'FAKE'
#!/usr/bin/env bash
echo "docker $*" >>"$WORK/calls"
FAKE
cat >"$work/bin/curl" <<'FAKE'
#!/usr/bin/env bash
echo "curl $*" >>"$WORK/calls"
printf '%s' "$LANGUAGES"
FAKE
cat >"$work/bin/update-grub" <<'FAKE'
#!/usr/bin/env bash
echo "update-grub" >>"$WORK/calls"
FAKE
chmod +x "$work/bin/"*
printf 'GRUB_DEFAULT=0\nGRUB_CMDLINE_LINUX="quiet"\n' >"$work/grub"

token="$(printf 'a%.0s' {1..40})"
ours='[{"id":1001,"name":"Python (3.12.7)"},{"id":1002,"name":"JavaScript (Node.js 20.18.0)"},{"id":1003,"name":"C (GCC 13.3.0)"},{"id":1004,"name":"C++ (GCC 13.3.0)"},{"id":1005,"name":"Java (JDK 21.0.5)"}]'
setup() {
  env -i PATH="$work/bin:$PATH" WORK="$work" JUDGE0_ETC="$work/etc" JUDGE0_DIR="$work/opt" CGROUP_ROOT="$work/cgroup" \
    GRUB_FILE="$work/grub" CRON_DIR="$work/cron" JUDGE0_BIND=10.0.2.15 JUDGE0_WAIT=0 LANGUAGES="$ours" "$@" \
    "$HERE/setup-judge0.sh" >"$work/log" 2>&1
}

# --- refused without a proper token ---------------------------------------------
if setup; then fail "no token is refused"; else check "no token is refused" 'grep -q "set JUDGE0_TOKEN" "$work/log"'; fi
if setup JUDGE0_TOKEN=short; then fail "a short token is refused"; else check "a short token is refused" 'grep -q "too short" "$work/log"'; fi

# --- cgroup v2: v1 is set for the next boot, and nothing else is done -------------------
touch "$work/cgroup/cgroup.controllers"
status=0; setup JUDGE0_TOKEN="$token" || status=$?
check "cgroup v2: asks for a reboot (exit 3)" '[[ $status == 3 ]] && grep -q reboot "$work/log"'
check "cgroup v2: the boot flag is added once, beside what was there" 'grep -q "^GRUB_CMDLINE_LINUX=\"quiet systemd.unified_cgroup_hierarchy=0\"$" "$work/grub"'
check "cgroup v2: grub is updated, Judge0 not started" 'grep -q update-grub "$work/calls" && ! grep -q "docker compose" "$work/calls"'
status=0; setup JUDGE0_TOKEN="$token" || status=$?
check "cgroup v2 again: the flag is not added twice" '[[ $status == 3 && $(grep -o unified_cgroup "$work/grub" | wc -l) == 1 ]]'

# --- cgroup v1: Judge0 starts ----------------------------------------------------------
rm "$work/cgroup/cgroup.controllers"; : >"$work/calls"
setup JUDGE0_TOKEN="$token"
secrets="$work/etc/judge0.secrets.conf"
get() { sed -n "s/^$1=//p" "$secrets"; }
check "the secrets file is root's alone, with the token" '[[ "$(stat -c %a "$secrets")" == 600 && "$(get AUTHN_TOKEN)" == "$token" ]]'
check "database and queue passwords are made, 32 bytes of hex" '[[ "$(get POSTGRES_PASSWORD)" =~ ^[0-9a-f]{64}$ && "$(get REDIS_PASSWORD)" =~ ^[0-9a-f]{64}$ ]]'
check "Judge0 binds the private address, with Parikshaa's image" 'grep -q "^JUDGE0_BIND=10.0.2.15$" "$work/opt/.env" && grep -q "^JUDGE0_IMAGE=ghcr.io/deepakvish001/parikshaa-judge0:latest$" "$work/opt/.env"'
check "the hardened settings go with it" 'grep -q "^ENABLE_NETWORK=false$" "$work/opt/judge0.conf" && grep -q "^ENABLE_CALLBACKS=false$" "$work/opt/judge0.conf"'
check "it is pulled and started" 'grep -q "compose --project-directory $work/opt pull" "$work/calls" && grep -q "compose --project-directory $work/opt up -d" "$work/calls"'
check "the check sends the token to /languages" 'grep -q "X-Auth-Token: $token http://10.0.2.15:2358/languages" "$work/calls"'
check "the hourly purge deletes finished submissions" '[[ -x "$work/cron/judge0-purge" ]] && grep -q "DELETE FROM submissions" "$work/cron/judge0-purge"'
check "it says what to set on the API" 'grep -q "RUNNER_BACKEND=judge0 JUDGE0_URL=http://10.0.2.15:2358" "$work/log"'

# A re-run keeps the passwords and takes a new token.
pg="$(get POSTGRES_PASSWORD)"
setup JUDGE0_TOKEN="$(printf 'b%.0s' {1..40})" JUDGE0_IMAGE=ghcr.io/deepakvish001/parikshaa-judge0:v2
check "re-run: passwords stay, the token and image change" '[[ "$(get POSTGRES_PASSWORD)" == "$pg" && "$(get AUTHN_TOKEN)" == b* ]] && grep -q ":v2$" "$work/opt/.env"'

# Judge0 CE's image, without our languages, is caught.
if setup JUDGE0_TOKEN="$token" LANGUAGES='[{"id":71,"name":"Python (3.8.1)"}]'; then fail "an image without our languages is caught"; else
  check "an image without our languages is caught" 'grep -q "has no JavaScript (Node.js" "$work/log"'
fi

[[ $failures == 0 ]] || { printf '%s failed\n' "$failures"; exit 1; }
