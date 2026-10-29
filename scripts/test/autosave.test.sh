#!/usr/bin/env bash
# scripts/autosave.sh against a scratch remote: a bare repository and clones in
# a temporary directory, with their own HOME and git identity. Nothing here
# touches the real origin: every run first checks that the clone's origin is
# inside the temporary directory.
# Each check is a condition in single quotes, evaluated by `check`: the
# variables it names are read there, not where it is written.
# shellcheck disable=SC2016,SC2034
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
pass() { printf 'ok   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; failures=$((failures + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

mkdir -p "$work/home"
bare="$work/origin.git"
clean() {
  env -i PATH="$PATH" HOME="$work/home" GIT_CONFIG_NOSYSTEM=1 \
    GIT_AUTHOR_NAME=Test GIT_AUTHOR_EMAIL=test@example.in GIT_COMMITTER_NAME=Test GIT_COMMITTER_EMAIL=test@example.in "$@"
}
g() { clean git "$@"; }
# save <clone> <edit|stop> <hook input>
save() {
  local url
  url="$(g -C "$1" remote get-url origin)"
  case "$url" in "$work"/*) ;; *) echo "refusing: $1 pushes to $url, not to the scratch remote" >&2; exit 1 ;; esac
  (cd "$1" && printf '%s' "$3" | clean bash "$REPO/scripts/autosave.sh" "$2")
}
remote() { g --git-dir="$bare" rev-parse -q --verify "refs/heads/$1" 2>/dev/null || true; }
snap() { remote "autosave/feat/x--$1"; }
status() { cut -d ' ' -f 1 "$1/.git/autosave-status" 2>/dev/null || true; }
clone() { g clone -q -b feat/x "$bare" "$work/$1"; }
input() { printf '{"session_id":"%s","transcript_path":"","hook_event_name":"Stop"}' "$1"; }

# --- a remote with branch feat/x ----------------------------------------------
g init -q --bare -b main "$bare"
g init -q -b main "$work/seed"
echo one >"$work/seed/a.txt"
g -C "$work/seed" add a.txt
g -C "$work/seed" commit -q -m one
g -C "$work/seed" remote add origin "$bare"
g -C "$work/seed" push -q origin main main:feat/x
first="$(remote feat/x)"

# --- one session: its own ref --------------------------------------------------
clone a
clone old  # checked out now, resumed later (below): its HEAD stays at "one"
echo work-a >"$work/a/new.txt"
save "$work/a" stop "$(input aaaaaaaa-1111-2222-3333-444444444444)"
snap_a="$(snap aaaaaaaa)"
check "a session's snapshot goes to autosave/<branch>--<8 chars of its id>" '[[ -n "$snap_a" ]]'
check "the snapshot's parent is HEAD and it holds the uncommitted file" \
  '[[ "$(g --git-dir="$bare" rev-parse "$snap_a^")" == "$first" && "$(g --git-dir="$bare" show "$snap_a:new.txt")" == work-a ]]'
check "the shared ref autosave/<branch> is no longer written" '[[ -z "$(remote autosave/feat/x)" && -z "$(snap nosession)" ]]'
check "status: ok <epoch> <commit>" '[[ "$(cat "$work/a/.git/autosave-status")" =~ ^ok\ [0-9]+\ $snap_a$ ]]'
check "the snapshot's state.md is not on the branch or in the real index" \
  '[[ -z "$(g -C "$work/a" ls-files .claude)" && "$(remote feat/x)" == "$first" ]]'

echo more >>"$work/a/new.txt"
save "$work/a" edit "$(input aaaaaaaa-1111-2222-3333-444444444444)"
check "edit within 30 s of a save pushes nothing (throttle kept)" '[[ "$(snap aaaaaaaa)" == "$snap_a" ]]'

# --- two sessions on one branch: two refs ---------------------------------------
clone b
echo work-b >"$work/b/new.txt"
save "$work/b" stop "$(input bbbbbbbb-5555-6666-7777-888888888888)"
snap_b="$(snap bbbbbbbb)"
check "a second session gets its own ref" '[[ -n "$snap_b" && "$(g --git-dir="$bare" show "$snap_b:new.txt")" == work-b ]]'
check "and the first session's snapshot is untouched" '[[ "$(snap aaaaaaaa)" == "$snap_a" ]]'

# --- STALE_GUARD: an old checkout, behind origin, pushes nothing -----------------
echo two >"$work/a/a.txt"
g -C "$work/a" commit -q -am two
g -C "$work/a" push -q origin feat/x
echo still-work >>"$work/a/new.txt"
save "$work/a" stop "$(input aaaaaaaa-1111-2222-3333-444444444444)"
snap_a2="$(snap aaaaaaaa)"
check "the newer session saves on top of its new commit" '[[ "$(g --git-dir="$bare" rev-parse "$snap_a2^")" == "$(remote feat/x)" ]]'
echo old-work >"$work/old/new.txt"
check "the old checkout does not know yet that origin moved" '[[ "$(g -C "$work/old" rev-parse origin/feat/x)" == "$first" ]]'
save "$work/old" stop "$(input aaaaaaaa-1111-2222-3333-444444444444)"
check "behind origin, with the same session id: the newer snapshot is not replaced" '[[ "$(snap aaaaaaaa)" == "$snap_a2" ]]'
check "status: stale <epoch>" '[[ "$(cat "$work/old/.git/autosave-status")" =~ ^stale\ [0-9]+$ ]]'
check "the guard fetched origin/<branch>, and only that ref" \
  '[[ "$(g -C "$work/old" rev-parse origin/feat/x)" == "$(remote feat/x)" && ! -e "$work/old/.git/FETCH_HEAD" ]]'
g -C "$work/old" merge -q --ff-only origin/feat/x
save "$work/old" stop "$(input aaaaaaaa-1111-2222-3333-444444444444)"
check "once caught up, it saves again" \
  '[[ "$(status "$work/old")" == ok && "$(g --git-dir="$bare" show "$(snap aaaaaaaa):new.txt")" == old-work ]]'

# --- ahead of origin (a commit not pushed yet): still saved ----------------------
clone c
echo three >"$work/c/a.txt"
g -C "$work/c" commit -q -am three
save "$work/c" stop "$(input cccccccc-9999)"
snap_c="$(snap cccccccc)"
check "ahead of origin: saved, the unpushed commit with it" \
  '[[ -n "$snap_c" && "$(g --git-dir="$bare" show "$snap_c^:a.txt")" == three ]]'

# --- the session id -----------------------------------------------------------
clone d
echo d >"$work/d/new.txt"
save "$work/d" stop ""
check "no hook input: autosave/<branch>--nosession" '[[ -n "$(snap nosession)" ]]'
echo d2 >"$work/d/new.txt"
save "$work/d" stop '{"tool_response":{"stdout":"{\"session_id\": \"zzzzzzzz\"}"},"session_id":"dddddddd-0000","tool_name":"Bash"}'
check "a session_id quoted inside a tool's output is not taken for the session's" \
  '[[ -n "$(snap dddddddd)" && -z "$(snap zzzzzzzz)" ]]'
echo d3 >"$work/d/new.txt"
save "$work/d" stop '{"session_id":"../../x y"}'
check "only [A-Za-z0-9_-] of the id reaches the ref name" '[[ -n "$(snap xy)" ]]'

# --- an unreachable remote ------------------------------------------------------
clone e
g -C "$work/e" remote set-url origin "$work/missing.git"
echo e >"$work/e/new.txt"
save "$work/e" stop "$(input eeeeeeee)"
check "status: fail <epoch> when the push fails" '[[ "$(cat "$work/e/.git/autosave-status")" =~ ^fail\ [0-9]+$ ]]'

# --- never on main --------------------------------------------------------------
g clone -q -b main "$bare" "$work/m"
echo m >"$work/m/new.txt"
save "$work/m" stop "$(input ffffffff)"
check "main is never autosaved" '[[ -z "$(g --git-dir="$bare" for-each-ref "refs/heads/autosave/main*")" ]]'

if ((failures)); then
  printf '%d check(s) failed\n' "$failures"
  exit 1
fi
echo "all checks passed"
