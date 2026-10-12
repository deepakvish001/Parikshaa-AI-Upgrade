#!/usr/bin/env bash
# Early warning for usage limits (PostToolUse hook, synchronous and quick).
#
# Claude Code records rate-limit information in the session transcript. When
# a new entry says the limit is near or reached (any status other than
# "allowed", or utilization of 85% or more), this saves everything at once
# (scripts/autosave.sh stop) and tells Claude, through the hook's
# additionalContext, to write the handoff and push now. Best effort: if the
# transcript carries no warning, nothing happens, and the autosave hooks still
# save the work every 30 seconds and at the end of every turn.
# Never fails the hook: every error exits 0.

set -u
input=$(cat 2>/dev/null || true)
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
gitdir=$(git -C "$root" rev-parse --git-dir 2>/dev/null) || exit 0
command -v python3 >/dev/null 2>&1 || exit 0
seen="$gitdir/limit-watch-seen"

found=$(HOOK_INPUT="$input" SEEN="$seen" python3 - 2>/dev/null <<'PY' || true
import json, os, hashlib, time
try:
    path = json.loads(os.environ.get("HOOK_INPUT") or "{}").get("transcript_path") or ""
    lines = open(path, encoding="utf-8").read().splitlines()[-400:]
except Exception:
    raise SystemExit
def infos(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ("rate_limit_info", "rateLimitInfo") and isinstance(v, dict):
                yield v
            else:
                yield from infos(v)
    elif isinstance(o, list):
        for x in o:
            yield from infos(x)
try:
    seen = set(open(os.environ["SEEN"]).read().split())
except Exception:
    seen = set()
for line in lines:
    if "ate_limit" not in line and "ateLimit" not in line:
        continue
    try:
        e = json.loads(line)
    except Exception:
        continue
    for info in infos(e):
        util = info.get("utilization")
        near = info.get("status") not in (None, "allowed") or (isinstance(util, (int, float)) and util >= 0.85)
        resets = info.get("resetsAt")
        if isinstance(resets, (int, float)) and resets < time.time():
            near = False  # an old entry: that limit has already reset
        key = hashlib.sha1(line.encode()).hexdigest()[:16]
        if near and key not in seen:
            with open(os.environ["SEEN"], "a") as f:
                f.write(key + "\n")
            print(f"{info.get('rateLimitType', 'usage')} limit: {info.get('status', '?')}"
                  + (f", {round(util * 100)}% used" if isinstance(util, (int, float)) else "")
                  + (f", resets at epoch {info.get('resetsAt')}" if info.get("resetsAt") else ""))
            raise SystemExit
PY
)
[ -n "$found" ] || exit 0
printf '%s' "$input" | bash "$root/scripts/autosave.sh" stop >/dev/null 2>&1 &
python3 - "$found" <<'PY'
import json, sys
note = sys.argv[1]
print(json.dumps({
    "systemMessage": f"Usage limit is near ({note}). Everything is being saved to GitHub now.",
    "hookSpecificOutput": {
        "hookEventName": "PostToolUse",
        "additionalContext": (
            f"USAGE LIMIT NEAR ({note}). Stop starting new work. Right now: commit and push what is done, "
            "update docs/HIRE-HANDOFF.md (checklist [x]/[~], tasks, workflows, your Sessions row: where you stopped "
            "and the exact next step), push, then tell the owner in Hinglish: 'sab kuch save kar diya hai, "
            "doosre account se docs/RESUME-PROMPT.md wala prompt chala kar shuru karo'."),
    },
}))
PY
exit 0
