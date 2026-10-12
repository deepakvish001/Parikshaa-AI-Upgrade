# F1 go-live: kaam kahan tak pahuncha (handoff)

**Ye file kyun hai:** owner ne 12 Oct 2026 ko kaha ki Claude ki limit khatam ho jaaye to doosre account ka Claude
GitHub se judkar **yahin se** kaam aage badhaye. Naya session: pehle ye file padho, phir
[F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) (poora plan, G0–G9), phir [PREP-TRACKER.md](PREP-TRACKER.md) ki plan rows
100–109 aur "Ruka hua kaam".

Repo me abhi **do** lines of work hain. Kaunsi pehle karni hai, ye owner ka faisla hai:

| Kaam | Branch | Kahan likha hai | Haalat |
|---|---|---|---|
| **F1 go-live** (G0–G9: staging, Company ID, Library, Judge0, IDE, proctoring, live video, third eye, SEB, launch) | `claude/elegant-ramanujan-hmolxs` | ye file | G0–G4a **main me merge** (PR [#47](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/47), 12 Oct). G4b–G9 ruke hue |
| **Hire v2** (job post se offer tak) | `claude/festive-maxwell-pb4k5v` | [HIRE-HANDOFF.md](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/blob/claude/festive-maxwell-pb4k5v/docs/HIRE-HANDOFF.md) (us branch par) | Draft PR [#65](https://github.com/deepakvish001/Parikshaa-AI-Upgrade/pull/65): sirf design + code map, code abhi nahi |

Owner ne 12 Oct 2026 ko kaha: **pehle Hire poora banao aur launch karo**; Learn, TPO aur scholarship baad me. Isliye
F1 ke G4b–G9 tab tak ruke hain jab tak owner na kahe.

## Hire v2 (PR #65) par kaam karne wale ke liye: pehle ye theek karo

PR #65 ki branch **purane main** se bani hai (PR #46 ke merge `fd6f455` par), PR #47 merge hone se pehle. Isliye uska
design aaj ke main se takrata hai. Hire ka koi bhi code likhne se pehle:

1. **Main ko us branch me merge karo** (`git merge origin/main`; rebase nahi, kyunki branch push ho chuki hai).
2. **Tracker rows:** main me plan rows **100–109 pehle se F1 go-live ki hain** (G0–G9). Hire ki rows 100–110 ko naye
   numbers do (jaise **111–121**), aur HIRE-V2.md, HIRE-HANDOFF.md aur Faisle me "plan 100…110" wale saare hawale bhi
   badlo.
3. **Migration numbers:** main me `0066_media_storage`, `0067_company_ids`, `0068_library`, `0069_code_timeline` pehle
   se hain. Hire ki migrations **0070** se shuru hon (design `0066_hire`/`0067`/`0068` kehta hai: wo badlo).
   `packages/store/src/migrate.test.ts` me list bhi.
4. **Operator panel pehle se hai (G1, row 101):** `packages/api/src/operator.ts`, `operator-routes.ts`,
   `console/src/components/Operator.tsx`. Operator = `PARIKSHAA_OPERATORS` me jinka email hai, apne staff account se,
   second factor (TOTP) zaroori. Company ID (`organisations.public_id`, `PKC-XXXXXX`), `suspended_at`/`suspended_reason`
   (migration 0067), company/college kholna, pause/resume, credits, invite dobara: ye sab hai. H7 me **alag `operators`
   table, `pko_` tokens aur doosra login mat banao**; isi ko badhao: verify/unverify, job ki shikayatein, candidate
   dhoondhna, hafte ke figures.
5. **H6 (naye sawaal) ke liye jo pehle se hai:**
   - Parikshaa Library (G2, row 102): global `library_*` tables, versions, bank me copy (`library:<id>` tag), exposure
     ginti (`store/src/library-store.ts`, `api/src/library.ts`).
   - Reference program runner par chalana: `POST /questions/code/check`, `ExamService.checkReference`
     (`api/src/service.ts`). Code drafts ke expected output isi se banao, naya runner wrapper mat likho.
6. **H5 (genuineness) ke liye jo pehle se hai:**
   - Code playback (G4a): editor ke edits sealed (`code_timeline`, migration 0069),
     `ProctorService.playback`.
   - 200+ characters ka paste `LARGE_PASTE` (`core/src/timeline.ts`) se "large paste" sanket banta hai: ise ek integrity
     reason banao.
   - Submissions history `ExamService.codeSubmissions`.
7. **Judge0 (G3):** code `RUNNER_BACKEND=gvisor|judge0` ke peeche chalta hai (`runner/src/backend.ts`). Hire ka test
   wahi `CodeRunner` use kare.
8. **Reminder fix:** main par 4 tests (`prep-engage`, `pwa`) 5 Oct ke baad fail hote hain. Fix PR #65 ke commit
   `dfe59fa` me hai, aur F1 branch par bhi cherry-pick hua hai. Jo pehle main me jaaye, doosra merge par no-op ho jaayega.

## F1: kya ban chuka (main me, PR #47)

| G | Kya | Kahan | Baaki |
|---|---|---|---|
| G0 | Staging: proctoring photos Supabase Storage me, Vercel par web + console, VM par API, deploy workflows | `api/src/storage.ts`, `store/src/blobs.ts`, `api/src/vercel-output.ts`, `scripts/setup-server.sh`, [STAGING.md](STAGING.md) | Asli staging owner ke accounts ke baad |
| G1 | Company ID + operator panel | upar dekho | Company profile, hiring manager scope |
| G2 | Parikshaa Library, 165 sawaal | upar dekho | Aptitude + frontend content |
| G3 | Judge0 backend, fallback, parity suite, `deploy/judge0` | `runner/src/judge0.ts`, `backend.ts`, `api/src/parity.ts`, [deploy/judge0/README.md](../deploy/judge0/README.md) | Image build (`PYTHON_SHA256`), Judge0 VM, staging par parity |
| G4a | IDE: submissions history, code playback + large paste, author ka reference program | `web/src/components/CodeAnswer.tsx`, `web/src/code-timeline.ts`, `console/src/components/Playback.tsx`, `ReferenceRun.tsx` | G4b neeche |

## F1: aage kya (owner ki haan ke baad)

1. **G4b** (row 104): test groups (subtask), nayi bhashayein (Go, Kotlin, C#, Rust, TS) dono runner me
   (`runner/src/languages.ts` + `deploy/judge0/compilers` + `core/src/signature.ts` starters), editor keymaps
   (vim/emacs), report/PDF me runtime + playback link, practice site par history/playback.
2. **G5** strict proctoring (row 105), **G6** live video, LiveKit (106), **G7** third eye, phone camera (107),
   **G8** Safe Exam Browser (108), **G9** launch (109): har ek ka design [F1-GO-LIVE-PLAN.md](F1-GO-LIVE-PLAN.md) §6–§9 me.
3. Owner ki taraf se jo ruka hai (tracker "Ruka hua kaam"):
   - GitHub Actions billing: CI 3 Oct se chal hi nahi raha.
   - Staging ke accounts ([STAGING.md](STAGING.md) §1) aur `PARIKSHAA_OPERATORS`.
   - Judge0 ka image aur VM.

## Har kaam ke niyam (repo ke [CLAUDE.md](../CLAUDE.md) ke saath)

- Branch: F1 ke liye `claude/elegant-ramanujan-hmolxs` (main se dobara shuru ki hui). Merged PR ko dobara mat
  chhedo: naya kaam naye PR me.
- Kaam shuru karne se pehle tracker me plan entry; usi PR me row ka status, "Kahan", "Ek nazar me" ki ginti; PR ke baad
  Build log; alag faisla ho to Faisle. Tracker Hinglish me.
- Push se pehle `npm run check` (~12 min, EXIT 0 dekh kar hi push).
- Web/console badle to:
  - `npm run build:clients`, `npm run budget`, `npm run lint:css`;
  - naya lazy chunk ho to `bundle-budget.json` me entry.
- Route/schema badle to:
  - `npm run openapi`;
  - public route ho to `openapi.test.ts` me.
- Har naye audit action ke shabd `console/src/components/Home.tsx` ke `ACTIONS` me. `actions.test.ts` sirf `audit(` ke
  4 line ke andar likhe string literal pakadta hai.
- Naye web strings: `web/src/i18n.tsx` (en + hi) aur `web/src/locales/*.ts` (9 bhasha). Coverage 90% se kam hua to test
  fail.
- Visual tests:

  ```bash
  pg_ctlcluster 16 main start
  sudo -u postgres psql -qc "DROP DATABASE IF EXISTS parikshaa_e2e WITH (FORCE)" -c "CREATE DATABASE parikshaa_e2e OWNER parikshaa_owner"
  npm run build -w @parikshaa/e2e
  cd packages/e2e && E2E_PORT=4791 npx playwright test -c playwright.visual.config.ts
  ```

  Database har baar naya ho, warna Company ID ke pixels badal jaate hain.
- Kabhi nahi:
  - secrets repo ya chat me;
  - test skip;
  - empty commit;
  - `playwright install`;
  - Prettier.
- Commit ke aakhir me repo ki attribution lines (pichhle commits dekho).

## Log (naya upar)

- 12 Oct 2026: PR #47 (G0–G4a) main me merge. F1 branch main se dobara shuru; reminder fix (`dfe59fa`) cherry-pick;
  ye handoff file. PR #65 ki takkar (rows, migrations, operator) upar likhi. Owner ne Hire ko pehle rakha, isliye F1
  ke G4b–G9 ruke.
- 4 Oct 2026: G4a (submissions history, code playback, reference program).
- 3 Oct 2026: G0, G1, G2, G3.
