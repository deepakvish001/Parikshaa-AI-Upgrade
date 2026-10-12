#!/usr/bin/env bash
# Status line (settings.json "statusLine"). Claude Code passes the subscription usage here as rate_limits
# (five_hour / seven_day: used_percentage, resets_at); the transcript only records a limit once it is hit.
# This prints the usage and writes it to .git/limit-state.json for scripts/limit-watch.sh.
input=$(cat 2>/dev/null || true)
gitdir=$(git rev-parse --absolute-git-dir 2>/dev/null) || gitdir=""
printf '%s' "$input" | GITDIR="$gitdir" python3 -c '
import json, os, sys
try:
    rl = json.load(sys.stdin).get("rate_limits") or {}
except Exception:
    rl = {}
g = os.environ.get("GITDIR")
if g and rl:
    tmp = os.path.join(g, "limit-state.json.tmp")
    with open(tmp, "w") as f:
        json.dump(rl, f)
    os.replace(tmp, os.path.join(g, "limit-state.json"))
print("  ".join("%s: %d%%" % (k, round(v.get("used_percentage", 0))) for k, v in rl.items() if isinstance(v, dict)))
' 2>/dev/null
exit 0
