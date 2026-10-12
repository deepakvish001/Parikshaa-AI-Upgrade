# Hire v2: kaam kahan tak pahuncha (handoff)

**Ye file kyun hai:** owner (12 Oct 2026): Claude ki limit khatam ho to doosre account ka Claude GitHub se judkar
**yahin se** kaam aage badhaye, poore context ke saath, aur koi kaam dobara na ho. Har account ka Claude isi file se
shuru karta hai aur isi ko update karta hai, isliye sab accounts sync me rehte hain. Owner jo prompt paste karta hai,
wo [RESUME-PROMPT.md](RESUME-PROMPT.md) me hai.

## 1. Naya session (kisi bhi account se): pehle ye, isi kram me

1. **Branch:** canonical branch `claude/festive-maxwell-pb4k5v` hai, PR
   [#65](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/65). Owner ne permission di hai ki har session isi
   branch par kaam aur push kare, chahe session ko koi aur branch mili ho.
   ```bash
   git fetch origin claude/festive-maxwell-pb4k5v && git checkout -B claude/festive-maxwell-pb4k5v origin/claude/festive-maxwell-pb4k5v
   ```
   Force-push kabhi nahi. Push se pehle `git pull --rebase origin claude/festive-maxwell-pb4k5v`.
2. **Doosra session to nahi chal raha?** Neeche §9 "Sessions" ki aakhri row dekho. Agar wo "chal raha" hai, aur branch
   ya `autosave/*` par 30 minute ke andar ka commit hai, to owner se poochho ki purana session band hai ya nahi. Ek
   waqt me ek hi session kaam kare.
3. **Adhoora kaam wapas lao:** §7 ka autosave restore chalao. Commit na hua kaam wahan hota hai.
4. **Apni entry:** §9 me nayi row jodo (tareekh, "chal raha"), commit + push.
5. **Padho:** `CLAUDE.md`, phir ye poori file, phir [HIRE-V2.md](HIRE-V2.md). HIRE-V2.md me **§10 "binding"** hai.
   Phir [hire/critique-security.md](hire/critique-security.md) aur [hire/critique-product.md](hire/critique-product.md)
   (S1–S24, P1–P22 ki detail). Jis slice par kaam ho, uske [hire/code-map/](hire/code-map/) bhi padho.
6. **Task list banao:** §3 ki tasks ko apne TaskCreate/todo me isi naam aur status se banao. Session ki task list
   GitHub par nahi jaati, isliye sach yahi table hai.
7. **Workflows:** §4 me koi workflow 🟡 ya ⬜ ho aur agla kaam usi par ruka ho, to use wahi se chalao (§4 ke niyam).
8. `npm ci`, phir §5 "Abhi chal raha" ka pehla `[~]` ya `[ ]` kadam uthao.
9. **Kaam karte waqt:** har kadam ke baad tests → `WIP(Hx): …` commit → push → §3, §4, §5 me status → push. Session
   khatam ho rahi lage (ya bada kaam poora ho), to §9 ki apni row me "kahan ruka" likho.

## 2. Owner ne kya maanga (12 Oct 2026)

Pehle sirf **Hire** poora banana aur launch karna:
- company job post kare, log apply karein;
- AI resume screen karke ek level tak shortlist kare;
- shortlisted ko OA/interview ka link email par jaaye. Test job ke hisaab se bane, company ke private question bank se,
  naye sawaal bhi;
- candidate test de, monitoring ho, cheating pakdi jaaye;
- sirf genuine aur achhe candidate aage badhein;
- aage ke rounds portal par hon, aur company aur candidate dono ek hi portal par final offer tak track karein.

Teen hisse: **candidate (user) ke pages, company ke pages, platform admin**. "Har level itna proper manage karo, itne
saare factor lagao ki final bachcha achha hi ho." Learn (user platform), college TPO aur scholarship **iske baad**.

## 3. Tasks (har session apni task list yahi se banaye)

| # | Task | Status | Note |
|---|---|---|---|
| T1 | Map existing Hire code against job→offer flow | ✅ | Workflow W1; output `docs/hire/code-map/` |
| T2 | Design the Hire pipeline (jobs, apply, AI screen, OA, integrity, rounds, offer, portals, admin) | ✅ | `docs/HIRE-V2.md` + §10 (critique ke faisle) |
| T2a | Design ka "fit" critique (design asli code se mel khata hai ya nahi) | ⬜ | Workflow W3; W2 me ye hissa limit par ruka tha. H1 ke saath chalao |
| T3 | Build Hire slices with tests | ⬜ | §6 ke slices, build order H1 → H2 → H3 → H4 → H5 → H7 → H8 → H9 → H6 |
| T4 | Review, e2e, tracker, PR | ⬜ | H10 + poora review + PR #65 ko ready |

## 4. Workflows (multi-agent kaam): sthiti aur dobara chalane ke niyam

| # | Workflow | Script | Status | Output |
|---|---|---|---|---|
| W1 | Maujooda code ka naksha (6 agents) | [hire/workflows/w1-understand.js](hire/workflows/w1-understand.js) | ✅ | `docs/hire/code-map/*.md` |
| W2 | Design critique (security, product, fit) | [hire/workflows/w2-design-critique.js](hire/workflows/w2-design-critique.js) | 🟡 security ✅, product ✅, fit ❌ (limit) | `docs/hire/critique-*.md` |
| W3 | Sirf "fit" critique (W2 ka bacha hissa) | [hire/workflows/w3-fit-critique.js](hire/workflows/w3-fit-critique.js) | ⬜ | `docs/hire/critique-fit.md` + HIRE-V2.md §10 "Fit (F#)" |

**Niyam (sab sessions ke liye):**
- **Chalane se pehle:** workflow ki script `docs/hire/workflows/wN-<naam>.js` me save karo, upar table me row jodo
  (⬜), aur push karo.
- **Agents apna output khud repo ki file me likhein**, aur chalte-chalte likhein, aakhir me ek saath nahi. Kaam poora
  hone par file ke aakhir me `<!-- complete -->` likhein. Isse autosave beech ka kaam bhi bacha leta hai.
- **Script resumable ho:** har agent shuru me dekhe ki uski output file `<!-- complete -->` ke saath maujood hai ya
  nahi. Hai to wo kuch na kare. Isliye ruka hua workflow wahi script dobara chalane se wahi se aage badhta hai
  (W3 ko dekho).
- **Workflow ruk gaya to:** naya session wahi script dobara chalaye. Jo hisse poore hain wo apne aap chhoot jaate hain.
  Table me status 🟡 aur kaunsa hissa bacha, ye likho.
- **Workflow tool na ho, ya owner token bachana chahe:** script ke har agent ka prompt khud ek-ek karke chalao. Output
  wahi files me jaana chahiye.
- **Khatam hone par:** status ✅, output ka link, aur §3 me task ka status update karke push karo.

## 5. Abhi chal raha (adhoora kaam)

- Design ✅ poora (§10 ke saath). Build abhi shuru nahi hua. Agla kaam: **W3 (fit critique) + H1**.

**H1 checklist** (har kadam: code + uske tests → `WIP(H1)` commit → push → yahan `[x]`; aadha ho to `[~]` + ek line
ki kya baaki):

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
- [ ] 8. Poora `npm run check` green; tracker row 101 (status, Kahan); §6 table + §10 Log; push

Agle slice (H2…) ki checklist usi slice ko shuru karte waqt yahan likho, isi shakal me:
migration → store + tests → service + tests → routes + wiring + openapi → UI + budget (agar ho) → check → tracker + handoff → push.

## 6. Slices (design: HIRE-V2.md §9 + §10; tracker rows 101–110)

| Slice | Kya | Status | Commit / note |
|---|---|---|---|
| H0 | Design, code map, critique, tracker rows 100–110, ye file, autosave | ✅ | `e387e4f` critique; §10 decisions; `4af00dd` autosave |
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

## 7. Session beech me ruk jaaye: kuch na khoye

**a. Har kadam ke baad push.** §5 ki checklist me `[x]`, aur aadha kadam `[~]` + ek line. Commit `WIP(Hx): …`.

**b. Autosave (apne aap, owner ki manzoori se, 12 Oct 2026).** `.claude/settings.json` ke hooks `scripts/autosave.sh`
chalate hain: har edit/command ke baad (30 s me ek baar), aur har turn ya session ke aakhir me. Ye **commit na hua kaam
bhi** branch `autosave/<branch>` par push karta hai, ek snapshot commit ke roop me jiska parent us waqt ka HEAD hai.
Asli branch aur history ko ye nahi chhoota. `.env*`, `*.pem`, `*.key` aur 5 MB se badi files bahar rehti hain.

Restore (har naye session ki shuruaat me):

```bash
git fetch origin 'refs/heads/autosave/*:refs/remotes/origin/autosave/*'
git for-each-ref --sort=-committerdate --format='%(committerdate:iso) %(refname:short)' refs/remotes/origin/autosave
git log -1 --format='%P%n%B' origin/autosave/claude/festive-maxwell-pb4k5v   # parent + badli files ki list
```

- Sabse naya autosave dekho (kisi bhi branch naam ka ho sakta hai, agar kisi session ne doosri branch par kaam kiya).
  Agar uska parent canonical branch ka HEAD hai, ya HEAD ke peeche ka commit hai, aur usme aisi files hain jo branch me
  nahi, to wo adhoora kaam hai. Lagao: `git cherry-pick --no-commit origin/autosave/<branch>`. Isme deletions bhi aate
  hain. Conflict ho to `git checkout origin/autosave/<branch> -- <file>` file-by-file karo.
- Phir `git status` / `git diff` dekho, §5 ki checklist se milao, tests chalao, `WIP(Hx): autosave se wapas` commit
  karke push karo. **Kaam shuru se dobara mat banao.**
- Agar autosave ka tree branch ke HEAD jaisa hi hai (sab commit ho chuka), to ise chhod do.

**c. Handoff purana lage to git se khud pata lagao:**

1. `git log --oneline origin/claude/festive-maxwell-pb4k5v -20`. §10 Log ki aakhri entry ke baad ke commits, khaaskar
   `WIP(Hx):` wale, batate hain ki aakhri session ne kya kiya.
2. `git show --stat <commit>`: har naye commit me kaunsi files bani ya badli.
3. Checklist ke har kadam ke liye dekho ki file maujood hai ya nahi, aur uske tests chalao. Jo test pass ho, wo `[x]`.
   Jo file ho par test fail ho ya na ho, wo `[~]`.
4. Ye nateeja §5 me likho, commit + push karo, phir pehle `[~]` ya `[ ]` kadam se shuru karo.

## 8. Checks

- Har kadam: us package ke tests (`npx vitest run src/<file>.test.ts`, package folder se) + typecheck.
- Slice poora hone par poora `npm run check` (~12 min). Web/console badle to `npm run build:clients` aur `npm run budget`.
  Route/schema badle to `npm run openapi` (`docs/openapi.json` dobara banta hai; `openapi.test.ts` isse milata hai).
- Commit ke aakhir me repo ki attribution lines (pichhle commits dekho).

## 9. Sessions (har session shuru me ek row jode, aur jaate waqt "kahan ruka" bhare)

| # | Tareekh | Session | Kya kiya | Status / kahan ruka |
|---|---|---|---|---|
| 1 | 12 Oct 2026 | account 1, `session_01B56n3byNkp5ns8fAHpGtC6` | W1, design (HIRE-V2.md + §10), W2 (fit chhoota), tracker rows 100–110, handoff, autosave, reminder tests ki time bomb | Khatam (limit). Agla: W3 + H1 |

## 10. Log (naya upar)

- 12 Oct 2026 (3): Sync ka dhaancha: tasks (§3), workflows ki sthiti aur scripts (§4, `docs/hire/workflows/`),
  sessions (§9), [RESUME-PROMPT.md](RESUME-PROMPT.md), autosave hooks (`4af00dd`).
- 12 Oct 2026 (2): Critique (security 24 items, product 22) aur unke faisle HIRE-V2.md §10 me.
- 12 Oct 2026 (1): H0. Design (`docs/HIRE-V2.md`), code map (`docs/hire/code-map/`), tracker rows 100–110, PR #65.
  Saath me ek purani "time bomb" theek ki: daily reminder ka email asli ghadi par queue hota tha, isliye 5 Oct ke baad
  4 tests (prep-engage, pwa) har baar fail hote (commit `dfe59fa`).
