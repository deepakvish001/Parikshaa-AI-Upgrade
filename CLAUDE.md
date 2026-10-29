# Working in this repository

## Work in progress: Learn v2, then Hire v2 (read this first)

The owner's current priority (19 Oct 2026) is Learn v2: the whole learner platform and its content (`docs/LEARN-V2.md`). Hire v2, the company hiring portal from job post to offer, is paused until the owner says otherwise. Both are built across sessions and accounts. Before doing anything on either, read `docs/HANDOFF.md`. It names the work, its branch and PR, and its handoff file (`docs/LEARN-HANDOFF.md` for Learn, `docs/HIRE-HANDOFF.md` for Hire). Then follow section 1 of that handoff file, in order. That file is the only shared record across accounts: the branch and PR, the task list, interrupted workflows, the session log and the next step. Push after every slice, and update that file each time, so a new session can pick the work up from GitHub. Uncommitted work is also pushed on its own by the autosave hooks (`.claude/settings.json` → `scripts/autosave.sh`) to the branch `autosave/<branch>`. At the start of a session, check that branch as the handoff describes, and restore from it rather than rebuilding.

## Keep the prep tracker true

`docs/PREP-TRACKER.md` tracks the Parikshaa Prep Blueprint: what is built, what is half built, what is left, and what is planned next. The owner relies on it to know where things stand, so every change that builds or plans something updates it:

1. **Before building**, add an entry under "Plan: aage kya banega": what will be built, why, the blueprint section, and when it counts as done.
2. **In the same PR as the code**, change the status of each row the work touches (✅ built with tests, 🟡 partly, ⬜ not yet, ❌ decided against, with the reason), put the code path in "Kahan", and update the counts in "Ek nazar me".
3. **After the PR exists**, add a line to "Build log" (newest first): date, PR link, what was built.
4. A decision that differs from the blueprint goes under "Faisle".

When the owner asks what is pending, start with the "Ruka hua kaam" section: work that is ready but waits on the owner (a key, an approval). Add to it whenever work stops for that reason, and remove the row when it is done.

Mark something ✅ only when it works and has tests; say plainly in the note what is still missing. Write the tracker in the same Hinglish as the rest of it.

## 21st.dev skills

`.claude/skills/21st-*` (see `.claude/skills/README.md`) let Claude search 21st.dev for UI references and components. In this repo:

1. `docs/learn/DESIGN-SYSTEM.md` is the design source of truth. If `21st init --design-context` writes `.21st/design.json`, it must match that file; where they differ, DESIGN-SYSTEM.md wins.
2. Our packages do not use Tailwind or shadcn. Do not run `21st add` into `packages/*`. Read a component with `21st get`, check its licence, and rebuild it with our tokens and kit.
3. Never publish anything to 21st.dev (`publish`, `publish-theme`, `publish-template`, `21st-design-sync`, profile) without the owner's explicit yes. Those pages are public and carry our brand.
4. Hosted 21st AI (`generate`, `iterate`) spends paid credits: only with the owner's yes.
5. The key lives only in the environment variable `TWENTYFIRST_TOKEN`, set in the environment settings. Never ask for it in chat or write it to the repo.

## Checks

Run `npm run check` (typecheck and every test) before pushing. For web or console changes also run `npm run build:clients` and `npm run budget`. After changing an API route or schema, run `npm run openapi` to regenerate `docs/openapi.json`.
