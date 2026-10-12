#!/usr/bin/env bash
# Early warning for usage limits (PostToolUse hook, synchronous and quick).
#
# Source 1 (reliable): .git/limit-state.json, written by scripts/statusline.sh from the status line's
# rate_limits (used_percentage, resets_at). Source 2 (fallback): rate_limit_info in the last 1 MB of
# the transcript; Claude Code writes it there mostly when a limit is already hit ("rejected"), and a
# "rejected" entry is skipped: that turn already ended (StopFailure saved it), and a session that goes on
# after it has switched account or uses extra usage. Fires once per window and threshold (85%, 95%).
# Never fails the hook: every error exits 0.

set -u
input=$(cat 2>/dev/null || true)
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
gitdir=$(git -C "$root" rev-parse --absolute-git-dir 2>/dev/null) || exit 0
command -v python3 >/dev/null 2>&1 || exit 0
seen="$gitdir/limit-watch-seen"

found=$(HOOK_INPUT="$input" SEEN="$seen" STATE="$gitdir/limit-state.json" python3 - 2>/dev/null <<'PY' || true
import json, os, time
now = time.time()
cands = []  # (kind, used 0..1, status, resets_at)
try:
    for kind, w in json.load(open(os.environ["STATE"])).items():
        if isinstance(w, dict) and isinstance(w.get("used_percentage"), (int, float)):
            cands.append((kind, w["used_percentage"] / 100, None, w.get("resets_at")))
except Exception:
    pass
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
    path = json.loads(os.environ.get("HOOK_INPUT") or "{}").get("transcript_path") or ""
    with open(path, "rb") as f:
        start = max(0, os.path.getsize(path) - 1_000_000)
        f.seek(start)
        lines = f.read().decode("utf-8", "replace").splitlines()[1 if start else 0:]
except Exception:
    lines = []
for line in lines:
    if "ate_limit" not in line and "ateLimit" not in line:
        continue
    try:
        e = json.loads(line)
    except Exception:
        continue
    for i in infos(e):
        if i.get("status") == "rejected":
            continue
        cands.append((i.get("rateLimitType", "usage"), i.get("utilization"), i.get("status"), i.get("resetsAt")))
try:
    seen = set(open(os.environ["SEEN"]).read().split())
except Exception:
    seen = set()
for kind, util, status, resets in cands:
    if isinstance(resets, (int, float)) and resets < now:
        continue  # that window has already reset
    u = util if isinstance(util, (int, float)) else None
    level = 95 if u is not None and u >= 0.95 else 85 if (u is not None and u >= 0.85) or status not in (None, "allowed") else 0
    key = f"{kind}:{resets}:{level}"
    if level and key not in seen:
        with open(os.environ["SEEN"], "a") as f:
            f.write(key + "\n")
        print(f"{kind} limit: " + (f"{round(u * 100)}% used" if u is not None else str(status))
              + (f", resets at epoch {resets}" if resets else ""))
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
