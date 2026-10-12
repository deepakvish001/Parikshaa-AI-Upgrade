# Working in this repository

## Work in progress: Hire v2 (read this first)

The owner's current priority (12 Oct 2026) is Hire v2: the company hiring portal, from job post to offer. It is built across sessions and accounts. Before doing anything on it, read `docs/HIRE-HANDOFF.md`. That file gives the branch and PR, the order to read things in, the slice status and the next step. Push after every slice, and update that file each time, so a new session can pick the work up from GitHub. Uncommitted work is also pushed on its own by the autosave hooks (`.claude/settings.json` → `scripts/autosave.sh`) to the branch `autosave/<branch>`. At the start of a session, check that branch as the handoff describes, and restore from it rather than rebuilding.

## Keep the prep tracker true

`docs/PREP-TRACKER.md` tracks the Parikshaa Prep Blueprint: what is built, what is half built, what is left, and what is planned next. The owner relies on it to know where things stand, so every change that builds or plans something updates it:

1. **Before building**, add an entry under "Plan: aage kya banega": what will be built, why, the blueprint section, and when it counts as done.
2. **In the same PR as the code**, change the status of each row the work touches (✅ built with tests, 🟡 partly, ⬜ not yet, ❌ decided against, with the reason), put the code path in "Kahan", and update the counts in "Ek nazar me".
3. **After the PR exists**, add a line to "Build log" (newest first): date, PR link, what was built.
4. A decision that differs from the blueprint goes under "Faisle".

When the owner asks what is pending, start with the "Ruka hua kaam" section: work that is ready but waits on the owner (a key, an approval). Add to it whenever work stops for that reason, and remove the row when it is done.

Mark something ✅ only when it works and has tests; say plainly in the note what is still missing. Write the tracker in the same Hinglish as the rest of it.

## Checks

Run `npm run check` (typecheck and every test) before pushing. For web or console changes also run `npm run build:clients` and `npm run budget`. After changing an API route or schema, run `npm run openapi` to regenerate `docs/openapi.json`.
