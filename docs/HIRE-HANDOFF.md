# Hire v2: kaam kahan tak pahuncha (handoff)

**Ye file kyun hai:** owner ne 12 Oct 2026 ko kaha ki Claude ki limit khatam ho jaaye to doosre account ka Claude
GitHub se judkar **yahin se** kaam aage badhaye. Isliye har slice ke baad ye file aur
[PREP-TRACKER.md](PREP-TRACKER.md) update hoke push hote hain. Naya session: pehle ye file padho, phir
[HIRE-V2.md](HIRE-V2.md) (poora design), phir [hire/code-map/](hire/code-map/) (maujooda code ka naksha, file:line ke saath).

## Owner ne kya maanga (12 Oct 2026)

Pehle sirf **Hire** poora banana aur launch karna: company job post kare → log apply karein → AI resume screen karke
ek level tak shortlist kare → shortlisted ko OA/interview ka link email par (test job ke hisaab se, company ke private
question bank se, naye sawaal bhi) → candidate test de, monitoring ho, cheating pakdi jaaye → sirf genuine aur achhe
candidate aage → aage ke rounds portal par → company aur candidate dono ek hi portal par final offer tak track karein.
Teen hisse: **candidate (user) ke pages, company ke pages, platform admin**. Learn (user platform), college TPO aur
scholarship **iske baad**.

## Branch, PR, checks

- Branch: `claude/festive-maxwell-pb4k5v` (yahi push karo). PR: draft, isi branch ka (link neeche "Log" me).
- Setup: `npm ci`. Tests PGlite par chalte hain (alag Postgres nahi chahiye).
- Har slice ke baad: us package ke tests (`npx vitest run src/<file>.test.ts` package folder se) + typecheck;
  push se pehle poora `npm run check` (~12 min). Web/console badle to `npm run build:clients` aur `npm run budget`.
  Route/schema badle to `npm run openapi` (`docs/openapi.json` dobara banta hai; `openapi.test.ts` isse milata hai).
- Commit ke aakhir me repo ki attribution lines (pichhle commits dekho).

## Slices (design: HIRE-V2.md §9)

| Slice | Kya | Status | Commit / note |
|---|---|---|---|
| H0 | Design, code map, tracker rows 100–110, ye file | ✅ | Design ka critique (security, product, code fit) chal raha tha; uske badlaav HIRE-V2.md §10 me jayenge |
| H1 | Candidate accounts (email code sign-in, sessions, profile, resume PDF/DOCX → text), `applicant` scope, `/candidate/*` | ⬜ | |
| H2 | Jobs + rounds config + publish + public job page + careers + apply + pipeline core + timeline + `hire` outbox mails + permissions | ⬜ | |
| H3 | AI screening (evidence quotes server par jaanche, score server ka, knockouts, resume injection) | ⬜ | |
| H4 | Rounds: test bhejna (window), settle, AI interview, live interview, review; offers (letter PDF, link, portal, expiry, hired, close-and-tell) | ⬜ | |
| H5 | Integrity ("Genuineness") 12 reasons + overall score + compare + job report | ⬜ | |
| H6 | AI se naye sawaal (draft → insaan manzoor kare), code drafts runner par jaanche, exposure count | ⬜ | |
| H7 | Platform operator (admin): login + TOTP, companies, verify/suspend, job reports, candidate lookup, figures + console | ⬜ | |
| H8 | Console "Hiring" UI (jobs, editor, pipeline, candidate drawer, compare, report, drafts, HirePath) | ⬜ | |
| H9 | Web: job page, careers, apply, candidate portal `/my` | ⬜ | |
| H10 | e2e poora flow, screenshots, SECURITY.md/SPEC.md (candidate + operator accounts), tracker | ⬜ | |

**Agla kadam:** pehla ⬜ slice uthao, HIRE-V2.md me uska hissa padho, code-map me jo file:line likhe hain wahan se pattern
copy karo, tests ke saath banao, check chalao, commit + push, phir is table aur tracker ki row update karke push.

## Log (naya upar)

- 12 Oct 2026: H0. Design (`docs/HIRE-V2.md`), code map (`docs/hire/code-map/`), tracker rows 100–110. Saath me ek
  purani "time bomb" theek ki: daily reminder ka email asli ghadi par queue hota tha, isliye 5 Oct ke baad 4 tests
  (prep-engage, pwa) har baar fail hote (commit `dfe59fa`).
