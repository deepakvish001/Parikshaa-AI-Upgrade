# Hire v2: kaam kahan tak pahuncha (handoff)

**Ye file kyun hai:** owner ne 12 Oct 2026 ko kaha ki Claude ki limit khatam ho jaaye to doosre account ka Claude
GitHub se judkar **yahin se** kaam aage badhaye, poore context ke saath. Isliye saara context GitHub par hai, aur har
kadam ke baad ye file update hoke push hoti hai.

## Naya session (kisi bhi account se): ye kram follow karo

1. Branch `claude/festive-maxwell-pb4k5v` checkout karo (`git fetch origin claude/festive-maxwell-pb4k5v && git checkout
   claude/festive-maxwell-pb4k5v`). Session ko koi doosri branch mili ho to pehle is branch ko usme merge karo, aur
   wahi PR [#65](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/65) aage badhao (ya nayi PR jo #65 ka
   link de). `main` par seedha push nahi.
2. Ye padho, isi kram me:
   - `CLAUDE.md` (repo ke niyam: tracker, checks)
   - **ye file** (status, agla kadam, log)
   - [HIRE-V2.md](HIRE-V2.md): poora design; **§10 "binding" hai**, §1–§9 se takraaye to §10 maana jaayega
   - [hire/critique-security.md](hire/critique-security.md), [hire/critique-product.md](hire/critique-product.md):
     §10 ke har item (S1–S24, P1–P22) ki poori detail
   - [hire/code-map/](hire/code-map/): maujooda code ka naksha (file:line, patterns, gotchas). Jis slice par kaam ho,
     uske code-map padho
3. `npm ci`. Tests PGlite par chalte hain (alag Postgres nahi chahiye).
4. Neeche "Slices" table me pehla adhoora slice uthao (build order: H1 → H2 → H3 → H4 → H5 → H7 → H8 → H9 → H6 → H10).
5. **Slice ke har kadam ke baad (zaroori, taaki limit beech me khatam ho to kuch na khoye):** kadam ke tests →
   `WIP(Hx): …` commit → push → "Abhi chal raha" ki checklist me `[x]` → push. Slice poora hone par: poora check →
   neeche table aur "Log" + tracker ki row → push. Neeche "Session beech me ruk jaaye to" padho.

## Owner ne kya maanga (12 Oct 2026)

Pehle sirf **Hire** poora banana aur launch karna: company job post kare → log apply karein → AI resume screen karke
ek level tak shortlist kare → shortlisted ko OA/interview ka link email par (test job ke hisaab se, company ke private
question bank se, naye sawaal bhi) → candidate test de, monitoring ho, cheating pakdi jaaye → sirf genuine aur achhe
candidate aage → aage ke rounds portal par → company aur candidate dono ek hi portal par final offer tak track karein.
Teen hisse: **candidate (user) ke pages, company ke pages, platform admin**. "Har level itna proper manage karo, itne
saare factor lagao ki final bachcha achha hi ho." Learn (user platform), college TPO aur scholarship **iske baad**.

## Checks

- Har slice: us package ke tests (`npx vitest run src/<file>.test.ts`, package folder se) + typecheck.
- Push se pehle poora `npm run check` (~12 min). Web/console badle to `npm run build:clients` aur `npm run budget`.
  Route/schema badle to `npm run openapi` (`docs/openapi.json` dobara banta hai; `openapi.test.ts` isse milata hai).
- Commit ke aakhir me repo ki attribution lines (pichhle commits dekho).

## Session beech me ruk jaaye to pata kaise chalega

Do tareeke hain, aur dono saath chalte hain:

**1. Har slice ki checklist, har kadam ke baad tick + push.** Jo slice chal raha hai, uski checklist "Abhi chal raha"
me hoti hai. Har kadam poora hote hi: `[x]` lagao, us kadam ka code commit karo (message `WIP(H1): <kya hua>`), aur
push karo. Isliye limit achanak khatam ho, to zyada se zyada ek kadam ka kaam jaata hai. Jo kadam aadha chhoota ho,
uske aage likho kya aadha hai (`[~]` aur ek line: kaunsi file, kya baaki).

**2. Autosave (apne aap, owner ki manzoori se, 12 Oct 2026).** `.claude/settings.json` ke hooks har edit/command ke
baad (30 s me ek baar) aur har turn/session ke aakhir me `scripts/autosave.sh` chalate hain. Ye **commit na hua kaam bhi**
GitHub ki alag branch `autosave/<branch>` par push karta hai. Ye ek snapshot commit hota hai jiska parent us waqt ka
HEAD hai. Asli branch aur uski history ko ye nahi chhoota. `.env*`, `*.pem`, `*.key` aur 5 MB se badi files bahar
rehti hain. Naya session **shuru me** ye dekhe:

```bash
git fetch origin 'refs/heads/autosave/*:refs/remotes/origin/autosave/*'
git for-each-ref --sort=-committerdate --format='%(committerdate:iso) %(refname:short)' refs/remotes/origin/autosave
git log -1 --format='%P%n%B' origin/autosave/claude/festive-maxwell-pb4k5v   # parent + badli files ki list
```

- Agar autosave ka parent branch ka HEAD hai, ya HEAD ke peeche ka commit hai, aur usme aisi files hain jo branch me
  nahi: wo adhoora kaam hai. Lagao: `git cherry-pick --no-commit origin/autosave/<branch>`. Isme deletions bhi aate hain.
  Conflict ho to `git checkout origin/autosave/<branch> -- <file>` file-by-file karo.
- Phir `git status` / `git diff` dekho, slice ki checklist se milao, tests chalao, aur `WIP(Hx): autosave se wapas`
  commit karke push karo. Kaam shuru se dobara mat banao.
- Agar autosave ka tree branch ke HEAD jaisa hi hai (sab commit ho chuka), to ise chhod do.

**3. Handoff purana lage to git se khud pata lagao** (jaise session ne checklist update karne se pehle hi ruk gaya ho):

1. `git log --oneline origin/claude/festive-maxwell-pb4k5v -20`. Neeche "Log" ki aakhri entry ke baad ke commits,
   khaaskar `WIP(Hx):` wale, batate hain ki aakhri session ne kya kiya.
2. `git show --stat <commit>`: har naye commit me kaunsi files bani ya badli.
3. Slice ki checklist ke har kadam ke liye dekho ki file maujood hai ya nahi (jaise migration `packages/store/migrations/0066_*`,
   `packages/api/src/candidates.ts`), aur uske tests chalao. Jo test pass ho, wo kadam `[x]`. Jo file ho par test fail
   ho ya na ho, wo `[~]`.
4. Ye nateeja checklist me likho, commit + push karo, phir pehle `[~]` ya `[ ]` kadam se kaam shuru karo.

Jo push nahi hua (purane container me reh gaya), wo doosra account nahi dekh sakta. Isliye niyam: **kadam poora → turant push**.

## Abhi chal raha (adhoora kaam)

- Design ✅ poora (§10 ke saath). Build abhi shuru nahi hua. Agla kaam: **H1**, neeche wali checklist se.

**H1 checklist** (har kadam: code + uske tests → `WIP(H1)` commit → push → yahan `[x]`):

- [ ] 1. Migration `0066_candidate_accounts.sql`: candidate_accounts, candidate_sessions, candidate_codes,
  candidate_links (policies S2), outbox/model_usage CHECKs jo zaroori hon; `store/src/migrate.test.ts` ki list
- [ ] 2. `withScope` nested guard (S24) + test; blind index helper (S20) + test
- [ ] 3. `store/src/candidate-store.ts` (accounts, sessions, codes: atomic verify S5, limits, links) + store tests
- [ ] 4. `api/src/resume.ts`: type sniffing, worker_threads me PDF (`unpdf`, exact version pin) aur DOCX (caps),
  10 pages / 60 000 chars (S1) + tests (zip bomb, bahut bada PDF, rename ki hui .exe)
- [ ] 5. `api/src/candidates.ts` service: code bhejna (mailer, seedha), verify, sessions (session/keep me signed in,
  sign out everywhere S19), profile, resume upload, data export, account delete (step-up code) + tests
- [ ] 6. Routes `/candidate/*` + `candidateAuth` security scheme; wiring `server.ts`, `assemble.ts`,
  `testing/harness.ts`, `openapi.ts`; `npm run openapi`
- [ ] 7. trustProxy hop count / CIDR (S6) + forged XFF test; `deploy/aws` me ALB/env ka badlaav
- [ ] 8. Poora `npm run check` green; tracker row 101 (status, Kahan); is file ka table + Log; push

Agle slices (H2…) ki checklist usi slice ko shuru karte waqt yahan likho, isi shakal me:
migration → store + tests → service + tests → routes + wiring + openapi → UI + budget (agar ho) → check → tracker + handoff → push.
- Design ka teesra critique ("fit": design asli code se milta hai ya nahi, services ke signature, slice ka kram) session
  limit ki wajah se poora nahi hua. H1 shuru karte waqt ise saath me chala lo: prompt
  [hire/critique-fit-prompt.md](hire/critique-fit-prompt.md) me hai. Nateeje `docs/hire/critique-fit.md` me rakho,
  aur zaroori badlaav HIRE-V2.md §10 me jodo.

## Slices (design: HIRE-V2.md §9 + §10; tracker rows 101–110)

| Slice | Kya | Status | Commit / note |
|---|---|---|---|
| H0 | Design, code map, critique, tracker rows 100–110, ye file | ✅ | `e387e4f` critique; §10 decisions |
| H1 | Candidate accounts (email code sign-in S5, sessions S19, profile, resume PDF/DOCX → text worker me S1), blind index S20, `withScope` guard S24, trustProxy S6, `/candidate/*` | ⬜ | |
| H2 | Jobs + rounds config + publish + job/careers page + apply (consent S8, limits S17, unverified S18) + import/claim P11 + pipeline core + timeline + mails P14 + roles recruiter/hiring_manager P3 + erasure S3 + retention S9 | ⬜ | |
| H3 | AI screening (evidence quotes server par jaanche, score server ka, knockouts, fairness S15, injection S16, eval script P16) | ⬜ | |
| H4 | Rounds: test (credits P4, reuse/retake P5, reminders P6), settle event-driven P15, AI interview, live interview (slots/reschedule P10), review, digest P13; offers S13, joined P17 | ⬜ | |
| H5 | Integrity: reasons + `not_checked`/coverage P2, auto face check P7, AI interview signals P8, duplicates P9, high sirf S14 wale; overall score, compare, job report | ⬜ | |
| H6 | AI se naye sawaal: sirf MCQ/numeric v1 me (P21), draft → insaan manzoor kare, exposure count, pool depth warning | ⬜ | Build order me H9 ke baad |
| H7 | Platform operator (admin): login + TOTP, operator scope S11, companies, verify (P18), suspend S12, job reports S10, candidate erase + console | ⬜ | |
| H8 | Console "Hiring" UI (jobs, editor, pipeline table, candidate drawer, compare, report, identity queue, HirePath) | ⬜ | |
| H9 | Web: job page (device needs P12, SSR meta P19), careers, apply, candidate portal `/my` | ⬜ | |
| H10 | e2e = acceptance demo (critique-product item 22), screenshots, SECURITY.md/SPEC.md, tracker | ⬜ | |

## Log (naya upar)

- 12 Oct 2026 (2): Critique (security 24 items, product 22) aur unke faisle HIRE-V2.md §10 me. Pehla session limit
  par ruka; aage ka kaam doosre account se is file ke hisaab se.
- 12 Oct 2026 (1): H0. Design (`docs/HIRE-V2.md`), code map (`docs/hire/code-map/`), tracker rows 100–110, PR #65.
  Saath me ek purani "time bomb" theek ki: daily reminder ka email asli ghadi par queue hota tha, isliye 5 Oct ke baad
  4 tests (prep-engage, pwa) har baar fail hote (commit `dfe59fa`).
