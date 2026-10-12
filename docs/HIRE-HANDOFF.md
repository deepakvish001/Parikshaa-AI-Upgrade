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
5. **Har slice ke baad (zaroori, taaki limit beech me khatam ho to kuch na khoye):** tests + typecheck → commit → push
   → is file ka table aur "Log" + tracker ki row update → commit → push. Bada slice ho to beech me bhi chhote commits
   push karo, aur "Abhi chal raha" me likho ki kya aadha hai.

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

## Abhi chal raha (adhoora kaam)

- Kuch adhoora nahi. Design poora hai (§10 ke saath). Agla kaam: **H1**.
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
