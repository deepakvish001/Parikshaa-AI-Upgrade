# Working in this repository

## Keep the prep tracker true

`docs/PREP-TRACKER.md` tracks the Parikshaa Prep Blueprint: what is built, what is half built, what is left, and what is planned next. The owner relies on it to know where things stand, so every change that builds or plans something updates it:

1. **Before building**, add an entry under "Plan: aage kya banega": what will be built, why, the blueprint section, and when it counts as done.
2. **In the same PR as the code**, change the status of each row the work touches (✅ built with tests, 🟡 partly, ⬜ not yet, ❌ decided against, with the reason), put the code path in "Kahan", and update the counts in "Ek nazar me".
3. **After the PR exists**, add a line to "Build log" (newest first): date, PR link, what was built.
4. A decision that differs from the blueprint goes under "Faisle".

Mark something ✅ only when it works and has tests; say plainly in the note what is still missing. Write the tracker in the same Hinglish as the rest of it.

## Checks

Run `npm run check` (typecheck and every test) before pushing. For web or console changes also run `npm run build:clients` and `npm run budget`. After changing an API route or schema, run `npm run openapi` to regenerate `docs/openapi.json`.
