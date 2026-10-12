## Exists today

**Live interview room (interview + panel + .ics)**
- **Tables:**
  - `interviews` (`packages/store/migrations/0036_interviews.sql:7`). Columns: `org_id, id, title, candidate_ref` (free text, at most 100 characters, no FK), `candidate_name, candidate_email, interviewer, scheduled_at, minutes, meeting_url, problem, language, code, notes, scorecard jsonb, status` (scheduled/done/cancelled), and `drive_id text` (`:25`, nullable, **no FK**).
  - 0052 adds `panel text[]` (at most 8) (`0052_interview_panel.sql:8`) and the table `interview_scores(org_id, interview_id, user_id, name, scorecard, scored_at)` (`:10`). It also extends the `outbox_kind_check` list with `'interview'` (`:30-32`).
  - RLS: tenant isolation is RESTRICTIVE, plus a staff-only policy.
- **Store** `packages/store/src/interview-store.ts`: `create` :110, `get` :121, `list` :128 (LIMIT 500), `update` :134, `scores` :159, `putScore` :177, `sweep` :188. Email, code and notes are sealed with AAD `interviews/{org}/{id}/{field}` (:93).
- **Service** `packages/api/src/interviews.ts`:
  - `combine` (panel average) :33. `calendar` (RFC 5545, same UID, CANCEL on cancel) :62.
  - `link` → `/?interview=org.id.mac` :163.
  - `schedule` :171: accepts `driveId` without checking it (:214), makes a Jitsi room when no call link is given, audits, then queues invites.
  - `#queueInvites` → outbox `kind:"interview"` :223. `deliver` :269 (email with .ics attached).
  - `edit`/cancel :307. `score` :327: once every panel member has scored, status becomes `done` (:339-341).
  - `room` :359 and `writeCode` :365 (candidate side).
- **Routes** `packages/api/src/interview-routes.ts`:

| Method and path | Line | Auth |
|---|---|---|
| POST `/interviews` | :76 | staff `attempt:review` |
| GET `/interviews` | :107 | staff |
| GET `/interviews/:id` | :117 | staff |
| GET `/interviews/:id/calendar` | :127 | staff |
| PUT `/interviews/:id` | :147 | staff |
| POST `/interviews/:id/scorecard` | :166 | staff |
| GET `/interviews/room/:code` | :178 | public HMAC link, throttle bucket `interview` |
| PUT `/interviews/room/:code/code` | :206 | public HMAC link |

**AI interviewer**
- **Tables** (`0060_ai_interviews.sql`):
  - `ai_interviews` :8. Columns: `role_id` (static role library), `job` text, `seniority, questions (2–8), minutes, candidate_ref` (free text), `candidate_name/email`, `status` (invited/in_progress/done/cancelled), `assessment jsonb` (the model's reading), `scorecard jsonb` (the human's), `decided_by/at`.
  - `ai_interview_turns` :34: a hash chain (`prev_hash`, `hash`). The app gets no UPDATE grant on turns (:67).
  - `model_usage` route `'interview'` (:69-70).
  - 0061 adds `resume` (sealed).
- **Store** `packages/store/src/ai-interview-store.ts`: `turnHash` :76, `chainHolds` :84, `TurnTaken` :94, `create` :164, `get` :178, `list` :185, `update` :192 (optimistic `from` status guard), `turns` :235, `append` :256 (a 23505 unique-key error becomes `TurnTaken`), `sweep` :286.
- **Service** `packages/api/src/ai-interview.ts`:
  - `CRITERIA` :27. `redactResume` :39. `link` → `/?ai-interview=` :143.
  - `create` :162 needs `exam:write`. Mail purposes are `ai_invite`/`ai_cancel` (:231, `deliver` :237).
  - `decide` (human scorecard, only once done) :267. `reassess` :279.
  - Candidate side: `start` :302, `answer` :318, `#next` :343.
  - `#ask` uses `exams.modelCall(org,"interview")` :375 and falls back to a canned question (:390). `#assess` :394. `#finish` :428. `#closeIfLate` :445.
- **Routes** `ai-interview-routes.ts`:

| Method and path | Line | Auth |
|---|---|---|
| POST `/ai-interviews` | :112 | staff `exam:write` |
| GET `/ai-interviews` | :143 | staff `attempt:review` |
| GET `/ai-interviews/:id` | :153 | staff `attempt:review` |
| POST `/ai-interviews/:id/scorecard` | :163 | staff `attempt:review` |
| POST `/ai-interviews/:id/assess` | :175 | staff `attempt:review` |
| POST `/ai-interviews/:id/cancel` | :185 | staff `exam:write` |
| GET `/ai-interviews/room/:code` | :195 | public HMAC link, throttle `ai-interview` |
| POST `/ai-interviews/room/:code/start` | :201 | public HMAC link |
| POST `/ai-interviews/room/:code/answer` | :207 | public HMAC link |

**Hiring-manager shortlist**
- **Tables** (`0032_shortlists.sql`): `shortlists(org_id, id, exam_id, title, refs text[], created_by, expires_at, revoked)` :7 and `shortlist_decisions(shortlist_id, candidate_ref, decision shortlist|hold|reject, comment, decided_by free text)` :20.
- **Store** `shortlist-store.ts`: `create` :49, `get` :64, `forExam` :71, `revoke` :77, `decisions` :81, `decide` :92 (upsert).
- **Service** `shortlists.ts`:
  - `create` :93 defaults to every *qualified graded* ref from `ResultsService.results(examId)`.
  - `view` :164 reads results as a fake `viewer` actor (:88).
  - `decide` :193 has **no audit**.
  - Links expire after at most 30 days.
- **Routes** `shortlist-routes.ts`:

| Method and path | Line | Auth |
|---|---|---|
| POST `/exams/:examId/shortlists` | :57 | staff |
| GET `/exams/:examId/shortlists` | :77 | staff |
| POST `/shortlists/:id/withdraw` | :102 | staff |
| GET `/shortlists/view/:code` | :113 | public |
| POST `/shortlists/view/:code/decisions` | :149 | public |

  Public errors return 404 or 410.

**Candidate report v2**
- `candidate-report.ts`:
  - `ReportLinks` :25. The code is `org.attempt.expiry.mac`; nothing is stored.
  - `SharedReport` :55 includes `integrity` (identity status, snapshots, proctor events) at :79. `EVENT_LABELS` :90.
  - `CandidateReports.share` :132 (audited `report.shared`), `view` :143, `viewPdf` :160, `pdfForStaff` :166, `drawReport` :232.
  - Everything is keyed by **attemptId**.
- **Routes** `candidate-report-routes.ts`:

| Method and path | Line | Auth |
|---|---|---|
| GET `/attempts/:attemptId/report.pdf` | :78 | staff |
| POST `/attempts/:attemptId/report-link` | :97 | staff |
| GET `/reports/:code` | :117 | public, throttle `report` |
| GET `/reports/:code/report.pdf` | :136 | public |

**Wiring**
- `packages/api/src/assemble.ts`:
  - `InterviewService` :148: staff list comes from `identity.listUsers`; enqueue goes through `invitationStore.enqueue`.
  - Sealed stores: `keys.records("interviews")` :145 and `keys.records("ai-interviews")` :157.
  - Retention sweeps :184-185. Reports and shortlists :307-308.
  - Outbox dispatch :354: purpose `ai_*` goes to the AI interviewer, everything else to `InterviewService`.
- Routes are registered in `server.ts:1347-1351` and services are stubbed in `openapi.ts:103-108`.

**Console**
- `packages/console/src/App.tsx`: lazy imports :62-63, nav :440-441 (group "assess", needs `attempt:review`), render :932-939.
- `components/Interviews.tsx`:
  - `InterviewsPanel` :41.
  - The schedule form :111-135 **never sends driveId** and hard-codes `+05:30`.
  - The detail view :202 polls every 2 seconds and handles panel, scorecard and .ics download.
- `components/AiInterviews.tsx`: list :35, create form (role/JD/resume) :105, detail with transcript, `transcriptIntact`, the model's reading and the human decision :206.
- `components/Shortlists.tsx:16` lives inside `Results.tsx:180` (per exam). Report share is at `Results.tsx:534`.
- Client methods are in `console/src/api.ts:1746-1800` and `:1991-2000`.

**Web (candidate and manager)**
- `packages/web/src/App.tsx:131-160` routes on query parameters: `?shortlist`, `?report`, `?apply`, `?ai-interview`, `?interview`, `?offer`, `?status`.
- `components/PublicPages.tsx` (English only, :9): `ReportPage` :96, `ShortlistPage` :267, `InterviewPage` :578 (polls the problem, autosaves code), `OfferPage` :704, `StatusPage` :831.
- `components/AiInterview.tsx:43`: chat room with start, answer and timer.

**Data flow**
- Live interview: staff POST → row (sealed) → outbox `interview` items → email with .ics to the panel and candidate → candidate opens the HMAC link → room/code endpoints → staff poll → each panel member scores → average → `done`.
- AI interview: staff POST → outbox `ai_invite` → candidate start/answer → model asks questions → turns appended to the hash chain → finish → model assessment → human `decide`.
- Shortlist: exam results → shortlist link → manager decides with no account.
- Report: graded attempt → PDF or link.

## How it maps to the target flow

**Are these linked to a drive, job or candidate pipeline? Essentially no, they are standalone.**
- `interviews.drive_id` is a free-text column with no FK. It is accepted by the API, never validated, never sent by the console, and never read by `placement.ts`, `funnel.ts` or `status()`.
- `ai_interviews` has no drive or job column at all. `role_id` points to the static `roles.ts` library, and `job` is pasted text.
- `candidate_ref` in both tables is free text, with no FK to `students(ref)` and no link to an attempt.
- Shortlists hang off `exam_id` plus result refs. Reports hang off `attemptId`.
- The only pipeline is placement drives:
  - `drives` and `drive_applications.stage` (applied/test/interview/offered/joined/rejected/withdrawn) in `0029_students_drives.sql:24-54`, with offer columns added in `0039`.
  - Stages are moved by hand: `placement.ts:434 setStage`, `:448 sendTest`, `:326 sendOffer`.
  - Candidate view: `/status/:code` (`placement-routes.ts:502`, `placement.ts:681`). It shows the stage and offer only, with no interview links.
  - "interview" is a single stage there, not multiple rounds.

**Step by step**
- **Step 3 (AI suggests, human decides):** the pattern exists in the AI interviewer (`assessment` versus `scorecard` with `decided_by`). The shortlist link is a human decision on exam marks only. No resume-against-JD screening exists here.
- **Step 4 (OA invite):** not in this subsystem. The AI interview invite email shows the pattern to copy (`ai-interview.ts:231-264`).
- **Step 5 (monitoring):**
  - Report v2 already shows exam proctoring (`integrity`).
  - The AI interview and live rooms have **no proctoring**: no tab, paste, camera or identity checks. The only signal is the model's free-text `concerns` (pasted-looking answers).
- **Step 6 (integrity-aware shortlist):**
  - Partial: `ShortlistService.create` filters on `outcome === "qualified"` only.
  - The integrity, AI-interview score and panel score are not combined anywhere.
- **Step 7 (rounds):**
  - AI interview, live interview and panel work as single units.
  - Missing: take-home, a round sequence, automatic stage moves after a scorecard, and the candidate seeing their rounds.
  - Offer accept/decline and joined exist only on drives.
- **Step 8 (admin):**
  - No hiring-manager role.
  - Platform-level admin over companies is not in this subsystem.

**How a round should reference them**
- Add `hire_rounds(org_id, job_id, seq, kind ∈ {ai_interview, live_interview, panel, oa, take_home, hm_review}, config jsonb)`.
- Add `application_rounds(org_id, application_id, round_id, status, outcome, decided_by, decided_at)` with **typed nullable link columns**: `interview_id`, `ai_interview_id`, `attempt_id`, `shortlist_id`. Each gets a composite FK `(org_id, x_id)`; polymorphic FKs are not possible.
- Alternatively, add `application_id`/`round_id` to `interviews` and `ai_interviews` in migration 0066+.
- Create the artifact through the existing services (`InterviewService.schedule` with the extra id, `AiInterviewService.create` with `job` = the JD and `resume` = the applicant's resume).
- Add an injected callback, the same way `enqueue` is injected, fired from `InterviewService.score` (on `done`) and `AiInterviewService.decide`, to advance the round.
- For the candidate portal, show `InterviewService.link()` / `AiInterviewService.link()` (both public methods) on a status page.

## Extension points and conventions

- **Routes:**
  - Copy `ai-interview-routes.ts`: a `register*Routes(routes, deps)` function with Zod schemas, `TAGS`, `SECURED`, a `refusals` map, `staff(request, reply, permission)`, and a `guard` that does throttle plus a "Gone" error mapped to 404.
  - Register it in `server.ts:~1347` behind `options.x !== undefined`.
  - Add a stub in `openapi.ts:103`.
- **Store:**
  - Copy `ai-interview-store.ts`: a class over `SqlExecutor` where every query runs in `withScope(this.#sql, staffScope(orgId), tx => ...)`, using a `RecordSeal` (`keys.records("purpose")`) for PII.
  - Export it from `store/src/index.ts` (:33/:38).
- **Migration:**
  - Copy `0060_ai_interviews.sql`: the DO-loop RLS block (RESTRICTIVE `tenant_isolation` plus `<table>_staff`), then GRANTs to `parikshaa_app`.
  - Add the file and table names to `store/src/migrate.test.ts:129-196`.
  - Next free number is 0066.
- **Audit:** `exams.recordAudit(actor, "thing.verb", id, {...})`, for example `interviews.ts:217`.
- **Outbox email:**
  - Inject `enqueue` and `mailer` (`assemble.ts:148-165`). Draft shape: `{kind, purpose, id (idempotent), subject, sendAfter}`. Add a `deliver(item)` that returns `"sent" | {skip}`.
  - A new kind needs a migration on the outbox constraint (`0052:30-32`), the union in `outbox-store.ts:14/22`, and dispatch in `assemble.ts:354` and `testing/harness.ts:478`.
- **Public candidate link:** HMAC of `org.id` with a key derived from secret plus purpose, compared with `timingSafeEqual` (`ai-interview.ts:139-158`).
- **Model calls:**
  - `exams.modelCall(orgId, route, (client, model) => client.messages.parse({... zodOutputFormat ...}))` (`ai-interview.ts:375-404`).
  - A new route means editing the `model_usage` constraint, `ledger-store.ts:1146` and `schemas.ts:753`.
- **Tests:**
  - API: `ai-interview.test.ts` uses `fakeModel` (`api/src/fake-model.js`) with `wire(pgliteExecutor(db), {client, now})` from `testing/harness.ts:153`.
  - Also see `interviews.test.ts`, `interview-panel.test.ts` and `records-sealing.test.ts:64`.
  - UI: `console/src/components/AiInterviews.test.tsx`, `web/src/AiInterview.test.tsx`.
- **Console pages:** lazy import plus a nav entry with a permission (`App.tsx:62, 440, 932, 1031, 1074, 1123`).

## Risks / gotchas

- **RLS is staff-only.** Every table here only allows `parikshaa.actor='staff'`. Candidate and manager links work because the service runs `staffScope(orgId)` after checking the HMAC. A candidate-token portal needs either the same server-side pattern or new policies.
- **Sealed fields.**
  - Live interviews seal `candidate_email`, `code` and `notes`. AI interviews seal `candidate_email`, `resume`, and turn `body`/`code`.
  - SQL cannot filter, join or dedupe on email. List endpoints decrypt every row; AI interview list returns the resume to all `attempt:review` staff.
- **Retention sweep deletes rows.** `interviews` and `ai_interviews` that are done or cancelled get deleted (`assemble.ts:184-185`). A pipeline FK needs `ON DELETE SET NULL` and a copied outcome or score, or history is lost.
- **Hash chain.** `ai_interview_turns` cannot be updated; edits break `transcriptIntact`.
- **Permissions are odd.**
  - The `viewer` role has `attempt:review` (`staff-auth.ts:106`), so it can schedule, cancel and score live interviews.
  - AI interview create and cancel need `exam:write`, but `author` lacks `attempt:review`, so an author cannot list what they created.
  - There is no hiring-manager or recruiter role.
- **Links.**
  - Interview and AI-interview links never expire; they only stop working on cancel. Shortlist and report links last at most 30 days.
  - Rotating `o.secret` invalidates every link.
  - Shortlist decisions take an unverified `by` name and are not audited.
- **Throttles.** Per-IP buckets `interview`, `ai-interview`, `shortlist` and `report` count only bad codes. Campus NAT could still trip them.
- **Spend cap.** When the cap is hit, AI questions fall back to canned text and the assessment stays null until `/assess` is called again (the route documents 402).
- **IST is hard-coded.** The console sends `+05:30` and emails format in `Asia/Kolkata`.
- **OpenAPI and budgets.**
  - `docs/openapi.json` is checked by `openapi.test.ts:54`; run `npm run openapi` after route changes.
  - `bundle-budget.json` has per-chunk limits (Interviews 4 KB, AiInterviews 5 KB, AiInterview 3 KB, PublicPages 7 KB, Shortlists 3 KB). New lazy chunks need entries, and a pattern matching no file fails.
- **Public pages are English-only** with no i18n hook.
- **Duplicate migration numbers** already exist (0033–0038 have two files each); keep ordering unambiguous.
- **CLAUDE.md** requires a `docs/PREP-TRACKER.md` update in the same PR, plus `npm run check`, `build:clients` and `budget`.