# Hire v2: kaam kahan tak pahuncha (handoff)

**Ye file kyun hai:** owner (12 Oct 2026): Claude ki limit khatam ho to doosre account ka Claude GitHub se judkar
**yahin se** kaam aage badhaye, poore context ke saath, aur koi kaam dobara na ho. Har account ka Claude isi file se
shuru karta hai aur isi ko update karta hai, isliye sab accounts sync me rehte hain. Owner hamesha ek hi prompt paste
karta hai ([RESUME-PROMPT.md](RESUME-PROMPT.md)). Wo [HANDOFF.md](HANDOFF.md) ke raaste yahan pahunchata hai.
Branch ya PR badle to pehle HANDOFF.md ki table update karo.

## 1. Naya session (kisi bhi account se): pehle ye, isi kram me

1. **Branch:** canonical branch aur PR [HANDOFF.md](HANDOFF.md) me likhe hain (abhi `claude/festive-maxwell-pb4k5v`,
   PR [#65](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/65)). Owner ne permission di hai ki har session
   usi branch par kaam aur push kare, chahe session ko koi aur branch mili ho.
   ```bash
   git fetch origin claude/festive-maxwell-pb4k5v && git checkout -B claude/festive-maxwell-pb4k5v origin/claude/festive-maxwell-pb4k5v
   ```
   Force-push kabhi nahi. Push se pehle `git pull --rebase origin claude/festive-maxwell-pb4k5v`.
2. **Doosra session to nahi chal raha?** Neeche §9 "Sessions" ki aakhri row dekho. Agar wo "chal raha" hai, aur branch
   ya `autosave/*` par 30 minute ke andar ka commit hai, to owner se poochho ki purana session band hai ya nahi. Ek
   waqt me ek hi session kaam kare.
3. **Adhoora kaam wapas lao:** §7 ka autosave restore chalao. Commit na hua kaam wahan hota hai. Saath me
   `.claude/live/state.md` padho: pichhle session ki task list, owner ka aakhri sandesh, aur Claude ke aakhri sandesh,
   jo ruke waqt chal rahe the. Uske hisaab se §3, §4, §5 theek karo agar wo purane hon.
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
| T2a | Design ka "fit" critique (design asli code se mel khata hai ya nahi) | ✅ | Workflow W3; W2 me ye hissa limit par ruka tha. H1 ke saath chalao |
| T3 | Build Hire slices with tests | ⬜ | §6 ke slices, build order H1 → H2 → H3 → H4 → H5 → H7 → H8 → H9 → H6 |
| T2b | Resume flow ki jaanch + fixes (W4) | ✅ | Zaroori fixes ho gaye; chhote baaki §5 me |
| T4 | Review, e2e, tracker, PR | ⬜ | H10 + poora review + PR #65 ko ready |

## 4. Workflows (multi-agent kaam): sthiti aur dobara chalane ke niyam

| # | Workflow | Script | Status | Output |
|---|---|---|---|---|
| W1 | Maujooda code ka naksha (6 agents) | [hire/workflows/w1-understand.js](hire/workflows/w1-understand.js) | ✅ | `docs/hire/code-map/*.md` |
| W2 | Design critique (security, product, fit) | [hire/workflows/w2-design-critique.js](hire/workflows/w2-design-critique.js) | ✅ security, product; fit → W3 (W2 dobara mat chalao) | `docs/hire/critique-*.md` |
| W3 | Sirf "fit" critique (W2 ka bacha hissa) | [hire/workflows/w3-fit-critique.js](hire/workflows/w3-fit-critique.js) | ✅ session 2 (Agent tool se; limit par ek baar ruka, wahin se poora). Dobara mat chalao | `docs/hire/critique-fit.md` + HIRE-V2.md §10 "Fit (F#)" |
| W4 | Resume flow ki jaanch (naya account ban kar, autosave test, kamiyan) | [hire/workflows/w4-handoff-verify.js](hire/workflows/w4-handoff-verify.js) | ✅ chal chuka (dobara mat chalao) | `docs/hire/handoff-verify.md`; zaroori fixes ho gaye, baaki §5 me |

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

**AGLA KADAM (isi kram me, sirf ye):**
0. ✅ **(session 2, ho gaya)** **`main` merge karo** (`git merge origin/main`, merge commit; rebase/force nahi). 12 Oct ko `main` par G0–G9 aa gaye
   (PR #47): migrations **0066–0069** aur tracker rows **100–109** le liye, G1 operator panel aur G2 Library bhi bane. Isliye
   Hire ki migrations **0070+** se, tracker rows **110+** se: HIRE-V2.md §1/§9, ye file (§5, §6) aur PREP-TRACKER ki
   numbering badlo. H7 (operator) G1 ko, aur H6 G2 Library ko dobara use kare, naya na banaye. `npm run openapi`,
   `npm run check`, push.
1. ✅ **(session 2)** **W3** (fit critique): `docs/hire/critique-fit.md` (F1–F33, `<!-- complete -->`) aur HIRE-V2.md §10
   "Fit (F#)". Bade slices toot gaye (critique-fit.md "Splits"): H1a/H1b, H2a–d, H4a–c, H5a/b, H8a/b, H9a/b.
2. ✅ **(session 2)** F# faisle neeche H1a/H1b checklist me jud gaye. Ab **H1a**, kadam 2 se (kadam 2 chal raha hai).
W2 aur W4 **dobara mat chalao** (unke nateeje `docs/hire/critique-*.md` aur `docs/hire/handoff-verify.md` me hain).
W4 ke baaki sudhaar jo abhi nahi hue (`handoff-verify.md` me): redaction, session-wise autosave ref, workflow journals
snapshot me, bootstrap PR to main. Ye chhote hain, kabhi bhi kar lena.

**Limit kaise dekhein (pakka tareeka):** har kadam aur har workflow se pehle `get_session` (claude-code-remote) se session
id lo, phir `list_events(session_id, kinds:["rate_limit_event"], limit:100)`. **Session 2 me `list_events` tool tha hi nahi.** Tab
`get_session` (bina session_id) ka `external_metadata.rate_limit_info` dekho: `status` "allowed" ho to chalo; "allowed" ke
alawa kuch bhi (warning/rejected) ho, ya `isUsingOverage: true`, to wahi save-push-batao wala kaam karo. Isme utilization
ka number nahi aata, sirf status aur `resetsAt`. `unifiedWindows.five_hour.utilization` ya
`seven_day.utilization` 0.90 se upar ho, to naya kaam mat shuru karo: commit, push, handoff update, push, owner ko
batao. (Transcript wala `limit-watch.sh` session 1 me kabhi nahi chala. Ab ye statusline se padhta hai, par ye
cloud session me chalta hai ya nahi, pakka nahi.)

**H1a checklist (Accounts)** (har kadam: code + uske tests → `WIP(H1a)` commit → push → yahan `[x]`; aadha ho to `[~]` +
ek line ki kya baaki):

- [ ] 1. Migration `0070_candidate_accounts.sql`: candidate_accounts (+ `warned_at`, F22), candidate_sessions,
  candidate_codes (S5: sirf `email_hash` + `code_hash`, attempts, IP ka hash), candidate_links (S2 policies);
  `store/src/migrate.test.ts` ki list (F29)
- [~] 2. S24: `sql.ts` me nested transaction doosra scope maange to `ScopeConflict` (code likha, tests baaki);
  `DataKeys.blind(purpose)` (S20, F26) + tests
- [ ] 3. `store/src/candidate-store.ts`: `HireScope` = `practice-store.ts` ke `scoped()` ki nakal (F24; ledger-store me
  naya scope kind NAHI); accounts, codes (atomic verify S5, limits), sessions (S19 server side), profile (sealed),
  export, account-only delete, `sweep()` (codes 24 h, sessions, inactive accounts; F4) + store tests
- [ ] 4. `api/src/candidates.ts`: code mail seedha mailer se, 10 s timeout, mailer na ho to 503 `email_not_configured`
  (F22); verify (dono haalat me ek jaisa jawab), sessions, profile, export, delete (step-up code) + tests
- [ ] 5. Routes `/candidate/*`, `candidateAuth`, tag `Applicant` (F25); wiring `server.ts`, `assemble.ts`,
  `testing/harness.ts`, `openapi.ts`; `main.ts` ke hourly loop me sweep (F4); `npm run openapi`
- [ ] 6. S6 = forged-XFF test (F27); `TRUST_PROXY` boolean hi rahega; staging par Vercel → Caddy ki jaanch "Ruka hua
  kaam" me
- [ ] 7. Poora `npm run check` green; tracker row 111 (🟡 H1a, Kahan); §6 table + §10 Log; push

**H1b checklist (Resume)**, H1a ke baad: S1 worker (`unpdf` exact pin, `docxText` sirf `document.xml` caps ke saath F26,
bytes se type pehchaan, 10 pages / 60 000 chars, 10 s par kill); upload/download routes `bodyLimit` ≈3 MB; tests: zip
bomb, 5 000 page PDF, encrypted PDF, `.docm`, naam badli `.exe`. Resume file kahan rahe (DB `bytea` ya G0 ka
`BlobStore`, sealed) ye H1b shuru karte waqt tay karo aur §10 me likho.

Agle slice (H2…) ki checklist usi slice ko shuru karte waqt yahan likho, isi shakal me:
migration → store + tests → service + tests → routes + wiring + openapi → UI + budget (agar ho) → check → tracker + handoff → push.

## 6. Slices (design: HIRE-V2.md §9 + §10; tracker rows 111–120)

| Slice | Kya | Status | Commit / note |
|---|---|---|---|
| H0 | Design, code map, critique, tracker rows 110–120 (pehle 100–110; main merge par badle), ye file, autosave | ✅ | `e387e4f` critique; §10 decisions; `4af00dd` autosave |
| H1 | Candidate accounts (email code sign-in S5, sessions S19, profile, resume PDF/DOCX → text worker me S1), blind index S20, `withScope` guard S24, trustProxy S6, `/candidate/*` | 🟡 | H1a (accounts) chal raha, phir H1b (resume). W3 ke baad: H2a–d, H4a–c, H5a/b, H8a/b, H9a/b (critique-fit.md "Splits") |
| H2 | Jobs + rounds config + publish + job/careers page + apply (consent S8, limits S17, unverified S18) + import/claim P11 + pipeline core + timeline + mails P14 + roles recruiter/hiring_manager P3 + erasure S3 + retention S9 | ⬜ | |
| H3 | AI screening (evidence quotes server par jaanche, score server ka, knockouts, fairness S15, injection S16, eval script P16) | ⬜ | |
| H4 | Rounds: test (credits P4, reuse/retake P5, reminders P6), settle event-driven P15, AI interview, live interview (slots/reschedule P10), review, digest P13; offers S13, joined P17 | ⬜ | |
| H5 | Integrity: reasons + `not_checked`/coverage P2, auto face check P7, AI interview signals P8, duplicates P9, high sirf S14 wale; overall score, compare, job report | ⬜ | |
| H6 | AI se naye sawaal: sirf MCQ/numeric v1 me (P21), draft → insaan manzoor kare, exposure count, pool depth warning. G2 Library (`library.ts`) aur reference run (`checkReference`) dobara use karo | ⬜ | Build order me H9 ke baad |
| H7 | Platform operator (admin): **G1 ko badhao**, naya login nahi (staff + `PARIKSHAA_OPERATORS` + 2FA, `operator.ts`, console `Operator.tsx` pehle se hain). Jodna: verify (P18), suspend ka Hire par asar S12, job reports S10, candidate erase. S11 ko W3 me G1 se milao | ⬜ | |
| H8 | Console "Hiring" UI (jobs, editor, pipeline table, candidate drawer, compare, report, identity queue, HirePath) | ⬜ | |
| H9 | Web: job page (device needs P12, SSR meta P19), careers, apply, candidate portal `/my` | ⬜ | |
| H10 | e2e = acceptance demo (critique-product item 22), screenshots, SECURITY.md/SPEC.md, tracker | ⬜ | |

## 7. Session beech me ruk jaaye: kuch na khoye

**a. Har kadam ke baad push.** §5 ki checklist me `[x]`, aur aadha kadam `[~]` + ek line. Commit `WIP(Hx): …`.

**b. Autosave (apne aap, owner ki manzoori se, 12 Oct 2026).** `.claude/settings.json` ke hooks `scripts/autosave.sh`
chalate hain: har edit/command ke baad (30 s me ek baar), aur har turn ya session ke aakhir me. Ye **commit na hua kaam
bhi** branch `autosave/<branch>` par push karta hai, ek snapshot commit ke roop me jiska parent us waqt ka HEAD hai.
Asli branch aur history ko ye nahi chhoota. `.env*`, `*.pem`, `*.key` aur 5 MB se badi files bahar rehti hain.
Snapshot me `.claude/live/state.md` bhi hota hai (sirf snapshot me, git-ignored): us session ki task list, owner ka
aakhri sandesh, aur Claude ke aakhri 4 sandesh. Padhne ke liye:
`git show origin/autosave/<branch>:.claude/live/state.md`.

**Limit watch:** `scripts/limit-watch.sh` (PostToolUse hook) transcript me rate-limit ki entry dekhta hai. Status
"allowed" ke alawa kuch ho, ya 85% se zyada use ho chuka ho (aur reset ka samay abhi aage ho), to wo turant autosave
karta hai aur Claude ko kehta hai ki naya kaam rok kar handoff likhe, push kare, aur owner ko bataye. Ye best effort hai:
transcript me pehle se chetavni aaye tabhi kaam karta hai. Na aaye to bhi har 30 s ka autosave aur turn ke aakhir ka
save chalta rehta hai (limit par turn tootne se `StopFailure` hook bhi save karta hai).

Restore (har naye session ki shuruaat me; tested in W4):

```bash
B=<HANDOFF.md wali canonical branch>
git fetch origin "+refs/heads/autosave/$B:refs/remotes/origin/autosave/$B"
A=origin/autosave/$B                                      # sirf canonical branch ka; autosave/worktree-* kabhi nahi
git show "$A":.claude/live/state.md                       # tasks + aakhri sandesh: sirf padho, kabhi commit nahi
git diff --stat HEAD "$A" -- . ':(exclude).claude/live'   # khaali = sab commit ho chuka, kuch mat karo
```

- Parent == HEAD (`[ "$(git rev-parse "$A^")" = "$(git rev-parse HEAD)" ]`): `git cherry-pick --no-commit "$A" && git reset -q`.
  `git reset -q` zaroori hai, warna `.claude/live/state.md` agle commit me chala jaata.
- Parent HEAD ke peeche (branch aage badh chuki): cherry-pick MAT karo. `git diff --stat "$A^" "$A" -- . ':(exclude).claude/live'`
  dekho, aur sirf wo files haath se lao jo baad ke kisi commit ne nahi chhui.
- Conflict par `git checkout "$A" -- <file>` MAT karo, commit hua kaam mit jaata hai. Dono hisse milao.
- Snapshot beech-edit ka ho sakta hai. Pehle typecheck + tests chalao; fail ho to state.md se samjho kya adhoora tha aur
  poora karo. Restore se koi kadam `[x]` nahi hota, sirf tests pass hone par hota hai. Sessions row ke liye sirf
  `git add docs/HIRE-HANDOFF.md`; `git add -A` kabhi nahi.

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
| 1 | 12 Oct 2026 | account 1, `session_01B56n3byNkp5ns8fAHpGtC6` | W1, design (HIRE-V2.md + §10), W2 (fit chhoota), tracker rows 100–110, handoff, autosave, reminder tests ki time bomb | Khatam: hafte ki limit 98%. Agla: main merge → W3 → H1 (§5) |
| 2 | 12 Oct 2026 | account 2 (jisne PR #47 G0–G4a banaya), `session_018vRviyFgDfdAVh2GzLcBn3` | Shuru 14:40 UTC: autosave restore (kuch adhoora nahi tha). §5 kadam 0 ✅ (`5536252`, check EXIT 0). W3 shuru (Agent tool) | Chal raha. 14:58 UTC: limit `allowed_warning` (5 ghante wali window 15:20 UTC par reset). Agar yahin ruke: W3 dobara chalao (§4), phir H1 kadam 1 |

## 10. Log (naya upar)

- 12 Oct 2026 (7, session 2): W3 poora: `docs/hire/critique-fit.md` F1–F33, HIRE-V2.md §10 "Fit (F#)". Sabse bada:
  F1, H7 ka alag operator scope nahi, G1 ka staff-operator hi (sirf `hire_job_reports` operator-only). Slices toote
  (H1a/b, H2a–d, H4a–c, H5a/b, H8a/b, H9a/b). H1a shuru.
- 12 Oct 2026 (6, session 2, `5536252`): §5 kadam 0: `main` (G0–G4a, PR #47) is branch me merge (merge commit, force nahi).
  Hire ki migrations ab 0070+ se, tracker rows 110–120 (Faisle me "(plan 110…117)"). HIRE-V2.md §1/§7/§8/§9 me likha
  ki H7 G1 operator ko badhayega (naya login, `operators` table, `pko_` nahi) aur H6 G2 Library + `checkReference`
  dobara use karega. Fit prompt me G1/G2/G4/G5–G8 ka overlap joda. Limit ka tareeka: `list_events` nahi mila, to
  `get_session` ka `rate_limit_info` (§5).
- 12 Oct 2026 (5): W4 ke nateeje: autosave ke tested fixes (macOS timeout, staged secrets, CRLF, owner ka sandesh, worktrees nahi), statusline + limit-watch, sahi restore ka tareeka, `main` aage badh gaya (G0–G9) isliye pehle merge aur renumber. Limit `list_events` se dikhti hai.
- 12 Oct 2026 (4): Prompt ab generic hai (koi branch/PR nahi): [HANDOFF.md](HANDOFF.md) entry point, `git log --all`
  se dhoondha jaata hai. Autosave snapshot me `.claude/live/state.md` (tasks, owner aur Claude ke aakhri sandesh).
  `scripts/limit-watch.sh`: limit paas aaye to turant save aur Claude ko chetavni. Naya kaam ultracode par.
- 12 Oct 2026 (3): Sync ka dhaancha: tasks (§3), workflows ki sthiti aur scripts (§4, `docs/hire/workflows/`),
  sessions (§9), [RESUME-PROMPT.md](RESUME-PROMPT.md), autosave hooks (`4af00dd`).
- 12 Oct 2026 (2): Critique (security 24 items, product 22) aur unke faisle HIRE-V2.md §10 me.
- 12 Oct 2026 (1): H0. Design (`docs/HIRE-V2.md`), code map (`docs/hire/code-map/`), tracker rows 100–110, PR #65.
  Saath me ek purani "time bomb" theek ki: daily reminder ka email asli ghadi par queue hota tha, isliye 5 Oct ke baad
  4 tests (prep-engage, pwa) har baar fail hote (commit `dfe59fa`).
