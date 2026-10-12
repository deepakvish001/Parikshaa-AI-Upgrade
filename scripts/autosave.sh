#!/usr/bin/env bash
# Autosave for Claude Code sessions (hooks in .claude/settings.json).
#
# A session can stop at any moment (a usage limit), and another session,
# perhaps on another account, picks the work up from GitHub. So the working
# tree is pushed as it is, finished or not: a snapshot commit (parent = HEAD)
# holding every tracked and untracked, not-ignored file, force-pushed to
# refs/heads/autosave/<branch>. The branch itself, the real index and the
# history are never touched. docs/HIRE-HANDOFF.md says how to restore it.
#
# Usage: autosave.sh edit   (after a tool call: at most once every 30 s)
#        autosave.sh stop   (end of a turn or session: always)
# Never fails the hook: every error exits 0.

set -u
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0
branch=$(git symbolic-ref --short -q HEAD) || exit 0
case "$branch" in main | master) exit 0 ;; esac
gitdir=$(git rev-parse --git-dir) || exit 0
mode=${1:-edit}
now=$(date +%s)

stamp="$gitdir/autosave-at"
if [ "$mode" = edit ] && [ -f "$stamp" ] && [ $((now - $(cat "$stamp" 2>/dev/null || echo 0))) -lt 30 ]; then exit 0; fi

index=$(mktemp) || exit 0
trap 'rm -f "$index"' EXIT
cp "$gitdir/index" "$index" 2>/dev/null || true

# Never push secrets or big files blindly: env files, keys, and untracked files over 5 MB stay out.
exclude=(':(exclude).env' ':(exclude).env.*' ':(exclude)**/.env' ':(exclude)**/.env.*' ':(exclude)*.pem' ':(exclude)*.key' ':(exclude)*.p12')
while IFS= read -r f; do
  [ -f "$f" ] && [ "$(wc -c <"$f")" -gt 5242880 ] && exclude+=(":(exclude,literal)$f")
done < <(git ls-files --others --exclude-standard)

GIT_INDEX_FILE="$index" git add -A -- . "${exclude[@]}" >/dev/null 2>&1 || exit 0
tree=$(GIT_INDEX_FILE="$index" git write-tree 2>/dev/null) || exit 0
head=$(git rev-parse HEAD 2>/dev/null) || exit 0

# Nothing beyond the last commit, or nothing new since the last autosave: nothing to send.
last="$gitdir/autosave-tree"
if [ "$tree" = "$(git rev-parse "HEAD^{tree}")" ] || [ "$tree $head" = "$(cat "$last" 2>/dev/null)" ]; then
  echo "$now" >"$stamp"
  exit 0
fi

files=$(GIT_INDEX_FILE="$index" git diff --cached --name-status HEAD 2>/dev/null | head -100)
message=$(printf 'autosave %s %s\n\nUncommitted work on top of %s (restore: docs/HIRE-HANDOFF.md):\n%s\n' \
  "$branch" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$head" "$files")
commit=$(printf '%s' "$message" | git commit-tree "$tree" -p "$head" 2>/dev/null) || exit 0
timeout 30 git push -q -f origin "$commit:refs/heads/autosave/$branch" >/dev/null 2>&1 || exit 0
echo "$tree $head" >"$last"
echo "$now" >"$stamp"
exit 0
