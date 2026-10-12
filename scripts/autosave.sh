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
# The snapshot also carries .claude/live/state.md: the session's task list,
# the owner's latest message and Claude's latest messages, read from the
# hook's input (session_id, transcript_path). That file exists only in the
# snapshot (and is git-ignored), so the next session knows what was going on
# at the moment this one stopped.
#
# Usage: autosave.sh edit   (after a tool call: at most once every 30 s)
#        autosave.sh stop   (end of a turn or session, or a limit warning: always)
# The hook's JSON arrives on stdin (optional). Never fails the hook: every error exits 0.

set -u
input=""
[ -t 0 ] || input=$(cat 2>/dev/null || true)
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
state=$(mktemp) || exit 0
trap 'rm -f "$index" "$state"' EXIT
cp "$gitdir/index" "$index" 2>/dev/null || true

# Never push secrets or big files blindly: env files, keys, and untracked files over 5 MB stay out.
exclude=(':(exclude).env' ':(exclude).env.*' ':(exclude)**/.env' ':(exclude)**/.env.*' ':(exclude)*.pem' ':(exclude)*.key' ':(exclude)*.p12')
while IFS= read -r f; do
  [ -f "$f" ] && [ "$(wc -c <"$f")" -gt 5242880 ] && exclude+=(":(exclude,literal)$f")
done < <(git ls-files --others --exclude-standard)

GIT_INDEX_FILE="$index" git add -A -- . "${exclude[@]}" >/dev/null 2>&1 || exit 0
head=$(git rev-parse HEAD 2>/dev/null) || exit 0
files=$(GIT_INDEX_FILE="$index" git diff --cached --name-status HEAD 2>/dev/null | head -100)

# The live state: tasks, the owner's last message, Claude's last messages.
if command -v python3 >/dev/null 2>&1; then
  HOOK_INPUT="$input" BRANCH="$branch" HEAD_SHA="$head" CHANGED="$files" python3 - >"$state" 2>/dev/null <<'PY' || true
import json, os, glob
inp = {}
try:
    inp = json.loads(os.environ.get("HOOK_INPUT") or "{}")
except Exception:
    pass
sid = inp.get("session_id") or ""
out = ["# Live state at the last autosave (the time is in the autosave commit)", "",
       f"- Branch: `{os.environ['BRANCH']}`, on top of `{os.environ['HEAD_SHA']}`",
       f"- Session: `{sid}`", "", "## Uncommitted changes", "", "```",
       os.environ.get("CHANGED") or "(none)", "```", "", "## Task list (this session)", ""]
tasks = []
for p in glob.glob(os.path.expanduser(f"~/.claude/tasks/{sid}/*.json")) if sid else []:
    try:
        tasks.append(json.load(open(p)))
    except Exception:
        pass
tasks.sort(key=lambda t: int(t.get("id", "0")) if str(t.get("id", "0")).isdigit() else 0)
out += [f"- [{t.get('status','?')}] {t.get('subject','')}" for t in tasks] or ["(none)"]
users, said = [], []
path = inp.get("transcript_path") or ""
try:
    lines = open(path, encoding="utf-8").read().splitlines()[-1500:]
except Exception:
    lines = []
for line in lines:
    try:
        e = json.loads(line)
    except Exception:
        continue
    msg = e.get("message") or {}
    content = msg.get("content")
    if e.get("type") == "user" and not e.get("isMeta"):
        text = content if isinstance(content, str) else " ".join(c.get("text", "") for c in content or [] if isinstance(c, dict) and c.get("type") == "text")
        if text.strip() and "<system-reminder>" not in text[:40] and "tool_result" not in json.dumps(content)[:200]:
            users.append(text.strip())
    elif e.get("type") == "assistant" and isinstance(content, list):
        for c in content:
            if isinstance(c, dict) and c.get("type") == "text" and c.get("text", "").strip():
                said.append(c["text"].strip())
cut = lambda s, n: s if len(s) <= n else s[:n] + " …"
out += ["", "## Owner's latest message", "", cut(users[-1], 3000) if users else "(none)", "",
        "## Claude's latest messages (newest last)", ""]
for s in said[-4:]:
    out += [cut(s, 2000), "", "---", ""]
print("\n".join(out))
PY
fi
if [ -s "$state" ]; then
  blob=$(git hash-object -w "$state" 2>/dev/null) && GIT_INDEX_FILE="$index" git update-index --add --cacheinfo 100644 "$blob" .claude/live/state.md >/dev/null 2>&1
fi

tree=$(GIT_INDEX_FILE="$index" git write-tree 2>/dev/null) || exit 0
# Nothing new since the last autosave: nothing to send.
last="$gitdir/autosave-tree"
if [ "$tree $head" = "$(cat "$last" 2>/dev/null)" ]; then
  echo "$now" >"$stamp"
  exit 0
fi

message=$(printf 'autosave %s %s\n\nWork on top of %s, with .claude/live/state.md (restore: docs/HIRE-HANDOFF.md):\n%s\n' \
  "$branch" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$head" "$files")
commit=$(printf '%s' "$message" | git commit-tree "$tree" -p "$head" 2>/dev/null) || exit 0
timeout 30 git push -q -f origin "$commit:refs/heads/autosave/$branch" >/dev/null 2>&1 || exit 0
echo "$tree $head" >"$last"
echo "$now" >"$stamp"
exit 0
