# Hire v2: kaam kahan tak pahuncha (handoff)

**Ye file kyun hai:** owner (12 Oct 2026): Claude ki limit khatam ho to doosre account ka Claude GitHub se judkar
**yahin se** kaam aage badhaye, poore context ke saath, aur koi kaam dobara na ho. Har account ka Claude isi file se
shuru karta hai aur isi ko update karta hai, isliye sab accounts sync me rehte hain. Owner hamesha ek hi prompt paste
karta hai ([RESUME-PROMPT.md](RESUME-PROMPT.md)). Wo [HANDOFF.md](HANDOFF.md) ke raaste yahan pahunchata hai.
Branch ya PR badle to pehle HANDOFF.md ki table update karo.

## 1. Naya session (kisi bhi account se): pehle ye, isi kram me

1. **Branch:** canonical branch aur PR [HANDOFF.md](HANDOFF.md) me likhe hain (abhi `claude/festive-maxwell-pb4k5v`,
   PR [#66](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/66); #65 merge ho chuka). Owner ne permission di hai ki har session
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
| T3 | Build Hire slices with tests | 🟡 | H1, H2a, H2b ✅; H2c W5 me chal raha | §6 ke slices, build order H1 → H2 → H3 → H4 → H5 → H7 → H8 → H9 → H6 |
| T2b | Resume flow ki jaanch + fixes (W4) | ✅ | Zaroori fixes ho gaye; chhote baaki §5 me |
| T4 | Review, e2e, tracker, PR | ⬜ | H10 + poora review + PR #65 ko ready |

## 4. Workflows (multi-agent kaam): sthiti aur dobara chalane ke niyam

| # | Workflow | Script | Status | Output |
|---|---|---|---|---|
| W1 | Maujooda code ka naksha (6 agents) | [hire/workflows/w1-understand.js](hire/workflows/w1-understand.js) | ✅ | `docs/hire/code-map/*.md` |
| W2 | Design critique (security, product, fit) | [hire/workflows/w2-design-critique.js](hire/workflows/w2-design-critique.js) | ✅ security, product; fit → W3 (W2 dobara mat chalao) | `docs/hire/critique-*.md` |
| W3 | Sirf "fit" critique (W2 ka bacha hissa) | [hire/workflows/w3-fit-critique.js](hire/workflows/w3-fit-critique.js) | ✅ session 2 (Agent tool se; limit par ek baar ruka, wahin se poora). Dobara mat chalao | `docs/hire/critique-fit.md` + HIRE-V2.md §10 "Fit (F#)" |
| W4 | Resume flow ki jaanch (naya account ban kar, autosave test, kamiyan) | [hire/workflows/w4-handoff-verify.js](hire/workflows/w4-handoff-verify.js) | ✅ chal chuka (dobara mat chalao) | `docs/hire/handoff-verify.md`; zaroori fixes ho gaye, baaki §5 me |
| W5 | Autosave overwrite fix + H2c (pipeline) build, review, check | [hire/workflows/w5-h2c-pipeline.js](hire/workflows/w5-h2c-pipeline.js) | 🟡 chal raha (session 3). Ruke to wahi script dobara chalao: har agent §5 ki H2c checklist se aage badhta hai | H2c code + `docs/hire/h2c-review.md` |

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
2. ✅ **(session 2)** F# faisle neeche H1a/H1b checklist me jud gaye. **H1a poora ✅**.
3. ✅ **(session 2)** H1b (resume).
4. ✅ **(session 2)** H2a (Jobs), neeche ki checklist.
5. ✅ **(session 2)** H2b (Apply + portal), neeche ki checklist. HIRE-V2 §10 me B6–B11.
6. **AB AGLA: H2c** (Pipeline): critique-fit.md "Splits" ki H2c row se checklist likho, phir banao. H2c me: pipeline
   table, move/reject/restore (override ke niyam ke saath; B9: Restore mana jab usi job par naya live application ho),
   notes, events, bulk (ginti ke saath), `reject_reason`, P14 message thread + note to candidates + rejection mail 24 h
   baad (Restore par cancel), reply-to/sender (F23: `EmailMessage.replyTo`, `fromName`), S21/S22 (viewer ko contact nahi).
   H2b me: `/hire/public/*` (F7), apply (account, consent S8, snapshot, ref F5, hashes, `candidate_links` S2,
   limits S17), suspension ka asar (F2), `hire-messages.ts` + outbox `{later}`, portal projection (S4), withdraw.
W2 aur W4 **dobara mat chalao** (unke nateeje `docs/hire/critique-*.md` aur `docs/hire/handoff-verify.md` me hain).
W4 ke baaki sudhaar jo abhi nahi hue (`handoff-verify.md` me): redaction, workflow journals snapshot me, bootstrap PR
to main. Ye chhote hain, kabhi bhi kar lena. (Session-wise autosave ref aur stale guard 13 Oct ko ho gaye, §7.)

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

- [x] 1. Migration `0070_candidate_accounts.sql`: candidate_accounts (+ `warned_at`, resume `bytea` ya `resume_key`),
  candidate_sessions (`kept`), candidate_codes (S5: `email_hash`, `code_hash`, `ip_hash`, purpose sign_in/step_up),
  candidate_links (S2: applicant read/add; staff ke liye `candidate_unlink()` SECURITY DEFINER, kyunki bina SELECT
  policy ke DELETE kuch nahi hataata). Saath me 9 "kisi bhi actor" wali tables par RESTRICTIVE `not_applicant` (test ne
  pakda: applicant scope + org_id se `exams` dikh rahe the). `migrate.test.ts` list
- [x] 2. S24: `sql.ts` me nested transaction doosra scope maange to `ScopeConflict` (`pooler.test.ts`);
  `DataKeys.blind(purpose)` → `BlindIndex.of(scope, value)` (S20, F26; `sealing.test.ts`)
- [x] 3. `store/src/candidate-store.ts`: `HireScope` + `hireScoped()` (F24), codes (`spendAttempt` ek UPDATE me, S5),
  accounts (`signIn` upsert), sealed profile, sessions, links, `erase`, `sweep`/`unused`/`warnedUnused` (F4) +
  `candidate-store.test.ts` (15 tests)
- [x] 4. `api/src/candidates.ts` (`Candidates`): code mail seedha mailer se, 10 s timeout, mailer na ho to 503
  `email_not_configured` (F22); verify (dono haalat me ek jaisa jawab), sessions (12 h / kept 14 din sliding),
  profile, export, step-up code se delete, `sweep()` (3 saal unused → mail → 30 din baad erase; mail na jaaye to
  erase nahi) + `candidates.test.ts` (13 tests)
- [x] 5. `api/src/candidate-routes.ts`: `/candidate/code`, `verify`, `me`, `signout`, `signout-everywhere`,
  `profile` (GET/PUT, links sirf http/https), `export`, `step-up`, `DELETE /candidate/me`; `candidateAuth`, tag
  `Applicant` (F25); wiring `server.ts`, `assemble.ts`, `testing/harness.ts`, `openapi.ts`, `main.ts` (hourly sweep);
  `openapi.test.ts` (open list + Applicant sirf `/candidate/*`); `npm run openapi` + `candidate-routes.test.ts` (9)
- [x] 6. S6 = forged-XFF test (`candidate-routes.test.ts`); `TRUST_PROXY` boolean; staging jaanch tracker ke "Ruka hua
  kaam" me
- [x] 7. `npm run check` EXIT 0 (API 756 tests); tracker row 111 🟡; §6 table + §10 Log; push

**H1b checklist (Resume)** ✅ session 2:

- [x] `api/src/resume.ts` + `resume-worker.ts`: bytes se type, worker (256 MB, 10 s par kill), PDF `unpdf@1.8.1` (pehle
  10 pages, encrypted mana), DOCX stream me asli bytes gin kar; `resume.test.ts` (12: zip bomb, jhooth bolta header,
  5 000 page PDF, password PDF, `.docm`, `.exe`, timeout, scan)
- [x] Store: `saveResume`/`resumeFile`/`resumeText`/`deleteResume`, `BlobStore` ho to wahan (sealed), purani file
  delete; erase par bhi (HIRE-V2 §10 B5)
- [x] Routes: `PUT/GET/DELETE /candidate/resume` (bodyLimit 3 MB, 413 `resume_too_large`, 422 baaki); tests
- [x] `npm run check`; tracker row 111; push

**H2a checklist (Jobs)** (critique-fit.md "Splits" H2a; har kadam: code + tests → `WIP(H2a)` commit → push → `[x]`):

- [x] 1. Migration `0071_hire.sql` (F29: baad ke slices ke saare status ek saath): `organisations.verified_at/
  verified_by/verification` (F3); roles `recruiter`, `hiring_manager` ke CHECK (P3); `hire_jobs`, `hire_rounds`,
  `hire_applications` (status + `invited`, `not_claimed`, `joined`, `did_not_join`; `candidate_id` NULL + `email_hash`
  S2; `reject_reason` P20), `hire_round_results` (+ `expired`, `abandoned`; `invitation_id` F9), `hire_screenings`,
  `hire_integrity`, `hire_events` (append-only, `candidate_visible` CHECK S4), `hire_offers`; outbox kind `hire`;
  model route `screen` (F28); policies: tenant + staff, applicant SELECT sirf applications/events(visible)/offers (S4);
  `migrate.test.ts`
- [x] 2. `staff-auth.ts`: `hire:manage|review|decide|offer`; roles (owner/author sab; reviewer review+decide; viewer
  review; recruiter P3; hiring_manager sirf review+decide F6); S7 (decide/offer sirf insaan; manage/offer
  `UNTIL_VERIFIED`); `StaffRole` store + console labels; tests (role matrix, API key)
- [x] 3. `store/src/hire-store.ts` (`HireScope` candidate-store se): jobs CRUD, rounds config, publish/pause/close,
  duplicate (P20), list + counts; store tests (do org alag)
- [x] 4. `api/src/hire.ts`: validation (≤10 screening questions; S23 protected-topic knockout mana), S18 (unverified:
  ≤2 open jobs, fee/deposit wala JD operator ke liye hold, auto-screen band), P1 (`max_applicants`, `screen_daily_max`),
  pehli publish par `public_code`, managers (staff ids) + tests
- [x] 5. `api/src/hire-routes.ts` staff `/hire/jobs*` (F7: `/jobs` nahi), tag `Hiring`, wiring + openapi, audit ACTIONS
  ke shabd + route tests
- [x] 6. `npm run check` EXIT 0 (API 791), `build:clients` + `budget` theek; tracker row 112 🟡; push

**H2b checklist (Apply + portal)** (critique-fit.md "Splits" H2b; har kadam: code + tests → `WIP(H2b)` commit → push → `[x]`):

- [x] 1. Migration `0072_hire_apply.sql` (0071 `main` par hai, use mat badlo): ek job par ek insaan ki ek hi *chalti*
  application (rejected/withdrawn/did_not_join ke baad dobara apply ho sake, `reapply_after_days` service jaanche).
  Outbox: `OutboxItem.kind` me `hire`; handler ka teesra nateeja `{ later: Date }` + `OutboxStore.defer` (F2: attempts
  nahi gine jaate). `migrate.test.ts`, `outbox-store` aur `delivery` tests
- [x] 2. `hire-store.ts` + naya `hire-application-store.ts`: public job/careers padhna (draft/held kabhi nahi), application likhna (sealed snapshot "hire"
  key, AAD `hire/{org}/{app}/{field}`; hashes S20; ref F5; pehle round ka result; `applied` event; outbox ek hi
  transaction me), ginti (job ki, candidate ki 24 h), duplicate/reapply padhna, candidate ki apni application, withdraw.
  Tests: applicant RLS (sirf apni), do org alag
- [x] 3. `api/src/hire-apply.ts` (`HireApplications`): public job + careers (suspended org/draft/held → 404, F2),
  S8 notice (English + Hindi, `notice_hash`, retention `privacy ?? 180` (F4), do grievance contacts), apply (job open,
  `apply_by` 23:59 IST, `max_applicants` + unverified 100, S17 20/din, duplicate, reapply, sawaalon ki jaanch,
  knockout → rejected), `candidate_links` (S2), portal projection (S4: round ki haalat, koi score nahi; suspended →
  "paused"), withdraw. `hire-messages.ts`: applied / withdrawn mail, "never pay" line (S18), suspended org → `{later}`.
  Tests
- [x] 4. Routes: `/hire/public/jobs/{company}/{code}`, `/hire/public/careers/{company}` (tag `Jobs`, open list F25),
  `/candidate/applications` (GET, POST), `/candidate/applications/{id}` (GET), `/candidate/applications/{id}/withdraw`;
  wiring (server, assemble handler `hire`, harness, openapi); `npm run openapi`; route tests (suspended 404, apply_by
  ke baad mana, limits, duplicate)
- [x] 5. `npm run check` EXIT 0 (API 816 tests); tracker row 112; §6, §10; push

Agle slice (H2…) ki checklist usi slice ko shuru karte waqt yahan likho, isi shakal me:
migration → store + tests → service + tests → routes + wiring + openapi → UI + budget (agar ho) → check → tracker + handoff → push.

## 6. Slices (design: HIRE-V2.md §9 + §10; tracker rows 111–120)

| Slice | Kya | Status | Commit / note |
|---|---|---|---|
| H0 | Design, code map, critique, tracker rows 110–120 (pehle 100–110; main merge par badle), ye file, autosave | ✅ | `e387e4f` critique; §10 decisions; `4af00dd` autosave |
| H1 | Candidate accounts (email code sign-in S5, sessions S19, profile, resume PDF/DOCX → text worker me S1), blind index S20, `withScope` guard S24, trustProxy S6, `/candidate/*` | ✅ | H1a + H1b ✅ session 2 (H1 ka baaki: delete par company ki copy H2d me, web pages H9 me). W3 ke baad: H2a–d, H4a–c, H5a/b, H8a/b, H9a/b (critique-fit.md "Splits") |
| H2 | 🟡 H2a ✅ (jobs, rounds, publish, roles, 0071), H2b ✅ (apply, job/careers page, portal, withdraw, 0072). Baaki H2c–d. Jobs + rounds config + publish + job/careers page + apply (consent S8, limits S17, unverified S18) + import/claim P11 + pipeline core + timeline + mails P14 + roles recruiter/hiring_manager P3 + erasure S3 + retention S9 | ⬜ | |
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
bhi** branch `autosave/<branch>--<session id ke pehle 8 akshar>` par push karta hai (har session ki apni ref, taaki do
session ek doosre ka snapshot na mitaayein), ek snapshot commit ke roop me jiska parent us waqt ka HEAD hai.
Asli branch aur history ko ye nahi chhoota. `.env*`, `*.pem`, `*.key` aur 5 MB se badi files bahar rehti hain.
Snapshot me `.claude/live/state.md` bhi hota hai (sirf snapshot me, git-ignored): us session ki task list, owner ka
aakhri sandesh, aur Claude ke aakhri 4 sandesh. Padhne ke liye neeche restore ke commands.

**Stale guard (13 Oct 2026):** push se pehle script `origin/<branch>` fetch karta hai (15 s ki seema). HEAD usse peeche
ho (purana container, jo doosre session ke push ke baad jaaga), to kuch push nahi hota. Aakhri koshish ka nateeja
`.git/autosave-status` me: `ok <epoch> <commit>`, `fail <epoch>` ya `stale <epoch>`. `stale` ya `fail` dikhe to
pehle `git pull --rebase origin <branch>` (ya remote theek karo); tab tak autosave tumhara kaam nahi bacha raha. Test:
`scripts/test/autosave.test.sh` (local bare remote par; asli origin ko nahi chhoota; CI me bhi). Purani shared ref
`autosave/<branch>` (bina `--`) ab koi nahi likhta: restore me use mat lo.

**Limit watch:** `scripts/limit-watch.sh` (PostToolUse hook) transcript me rate-limit ki entry dekhta hai. Status
"allowed" ke alawa kuch ho, ya 85% se zyada use ho chuka ho (aur reset ka samay abhi aage ho), to wo turant autosave
karta hai aur Claude ko kehta hai ki naya kaam rok kar handoff likhe, push kare, aur owner ko bataye. Ye best effort hai:
transcript me pehle se chetavni aaye tabhi kaam karta hai. Na aaye to bhi har 30 s ka autosave aur turn ke aakhir ka
save chalta rehta hai (limit par turn tootne se `StopFailure` hook bhi save karta hai).

Restore (har naye session ki shuruaat me; tested in W4):

```bash
B=<HANDOFF.md wali canonical branch>
git fetch origin '+refs/heads/autosave/*:refs/remotes/origin/autosave/*'
snaps() { git for-each-ref --sort=-committerdate --format='%(refname:short)' "refs/remotes/origin/autosave/$B--*"; }
git for-each-ref --sort=-committerdate --format='%(committerdate:iso) %(objectname:short) %(refname:short)' \
  "refs/remotes/origin/autosave/$B--*"                    # sirf canonical branch ke, naya upar; autosave/worktree-* kabhi nahi
A=$(for r in $(snaps); do [ "$(git rev-parse "$r^")" = "$(git rev-parse HEAD)" ] && { echo "$r"; break; }; done)
echo "A=$A"                                               # sabse naya snapshot jiska parent == HEAD; khaali = koi nahi
for r in $(snaps); do echo "== $r"; git show "$r":.claude/live/state.md; done           # sab: tasks + aakhri sandesh, sirf padho
[ -n "$A" ] && git diff --stat HEAD "$A" -- . ':(exclude).claude/live'   # khaali = sab commit ho chuka, kuch mat karo
```

- `A` mila (parent == HEAD): `git cherry-pick --no-commit "$A" && git reset -q`.
  `git reset -q` zaroori hai, warna `.claude/live/state.md` agle commit me chala jaata. Baaki snapshots se sirf unka
  `state.md` padho (kaunsa session kya kar raha tha), unka code mat lagao.
- `A` khaali (har snapshot ka parent HEAD ke peeche, branch aage badh chuki): cherry-pick MAT karo. Sabse naye
  snapshot `S` ke liye `git diff --stat "$S^" "$S" -- . ':(exclude).claude/live'` dekho, aur sirf wo files haath se
  lao jo baad ke kisi commit ne nahi chhui (`git diff --name-only "$S^" HEAD` me na hon).
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
| 2 | 12 Oct 2026 | account 2 (jisne PR #47 G0–G4a banaya), `session_018vRviyFgDfdAVh2GzLcBn3` | Shuru 14:40 UTC: autosave restore (kuch adhoora nahi tha). §5 kadam 0 ✅ (`5536252`, check EXIT 0). W3 shuru (Agent tool) | Khatam (aakhri commit 22:21 UTC `12970ab` H2b; uska aakhri autosave `d58667d` me koi adhoora code nahi tha) |
| 3 | 13 Oct 2026 | account 1 (session 1 dobara, hafte ki limit reset ke baad), `session_01B56n3byNkp5ns8fAHpGtC6` | Shuru 04:21 UTC. Purane container ke HEAD (`63f9919`) se autosave hook ne session 2 ka snapshot overwrite kiya (reflog se `d58667d` mila; usme kuch adhoora nahi tha). W5 shuru: autosave fix, phir H2c | Chal raha |

## 10. Log (naya upar)

- 13 Oct 2026 (13, session 3): Autosave ka data-loss bug theek (W5 ka pehla hissa). 13 Oct ko purane container (HEAD
  bahut peeche) ke pehle tool call par hook ne `autosave/<branch>` force-push karke session 2 ka naya snapshot mita
  diya tha (sirf reflog se bacha). Ab: har session ki apni ref `autosave/<branch>--<session id ke 8 akshar>`
  (failure-modes #9), STALE_GUARD (HEAD `origin/<branch>` se peeche ho to push nahi, `stale`), aur
  `.git/autosave-status` (`ok`/`fail`/`stale`). §7 ke restore commands naye: saare `autosave/*` fetch, `$B--*` date se,
  parent == HEAD wala sabse naya lagao, baaki ka sirf `state.md` padho. Test `scripts/test/autosave.test.sh` (20 jaanch,
  local bare remote; purani script par 14 fail) CI me bhi.

- 12 Oct 2026 (12, session 2): CI ke saare jobs GitHub billing ki wajah se shuru hi nahi hue (PR #66 aur `main` dono);
  PR par comment aur tracker "Ruka hua kaam" me. H2b poora: 0072 (ek job par ek insaan ki ek live application),
  outbox `{later}` + `defer` (F2), `hire-application-store.ts` (sealed copy, blind index, job lock ke saath apply),
  `hire-apply.ts` (public job/careers, S8 notice English+Hindi, apply ki saari jaanch, portal projection, withdraw),
  `hire-messages.ts`, routes `/hire/public/*` + `/candidate/applications*`. Faisle B6–B11 HIRE-V2 §10 me. Naya env:
  `HIRE_GRIEVANCE_NAME`, `HIRE_GRIEVANCE_EMAIL` (owner se, tracker "Ruka hua kaam").

- 12 Oct 2026 (11, session 2): Owner ne PR #65 `main` me merge kiya (`a861b2b`), usse pehle GitHub par `main` ko is
  branch me merge kiya (`9cef709`); us merge ne `package-lock.json` ko kharab JSON bana diya, isliye `main` par `npm ci`
  fail hota tha. Is branch me `main` merge kiya (history nahi badli) aur lockfile npm se dobara banaya
  (`349949b` ka sahi lockfile + `npm install --package-lock-only`). H2a (`bbd86f8`) #65 ke baad ka hai: owner ki haan se PR #66 khuli.
  Dependabot ke jsdom 30.1.2 se console ka editor test toot gaya (click ke baad focus question box me nahi jaata, test
  galat field me type karta hai; browser par asar nahi): jsdom 30.1.1 par pin (console, web, root devDependency +
  `overrides`), aur `.github/dependabot.yml` me 30.1.2 ignore. Agla jsdom release aaye to dobara aazmao.
- 12 Oct 2026 (10, session 2): H2a: migration 0071 (saari Hire tables + statuses F29, `organisations.verified_*` F3,
  roles recruiter/hiring_manager P3/F6), `hire-store.ts`, `hire.ts` (S18 limits, S23 knockouts, fee wali JD hold),
  `/hire/jobs*` (409/422 me `problems`). Test ne pakda: ek transaction me fail hua INSERT poora transaction rollback
  karta hai (test theek kiya).
- 12 Oct 2026 (9, session 2): H1b poora (resume): `resume.ts` + `resume-worker.ts` (unpdf 1.8.1, fflate stream),
  store me file sealed (bucket ho to wahan), `PUT/GET/DELETE /candidate/resume`. HIRE-V2 §10 me "Build decisions"
  B1–B5. `npm run check` EXIT 0 (API 771). H2a ki checklist likhi.
- 12 Oct 2026 (8, session 2): H1a poora. Migration 0070 (accounts, sessions, codes, links + 9 tables par
  `not_applicant`), `candidate-store.ts`, `candidates.ts`, `candidate-routes.ts` (`/candidate/*`), S24 scope guard,
  S20 blind index, S6 forged-XFF test. Do kamiyan test se pakdi aur theek ki: applicant scope + org_id se `exams`
  dikhna; profile link me `javascript:` URL. Staging par XFF jaanch tracker "Ruka hua kaam" me.
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
