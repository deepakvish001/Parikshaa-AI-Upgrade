## Exists today

**Tables (migrations in `packages/store/migrations/`)**
- `bank_questions` (`0005_question_bank.sql:9`): PK `(org_id, id)`. Columns: `question jsonb` (answer key included), `topic`, `difficulty` (easy/medium/hard), `tags text[]`, `archived_at`. RLS has a RESTRICTIVE `tenant_isolation` on `org_id` plus a staff-only policy (`:27-34`). There is no `status`, `source`, `author` or usage column.
- `question_media` (`0012`): pictures keyed by `(org_id, sha256)`. They are served through a SECURITY DEFINER function `question_media_by_hash` that works across orgs.
- `exams` (`0001_init.sql:7`, tenancy added in `0003_tenancy.sql:161-164`): `definition jsonb` holds the whole `Exam` with answer keys. The RLS is org-restrictive plus a permissive `USING (true)`, so any scope in the org, candidate included, can read the row. Answer keys are hidden only in the API layer (`core/src/candidate-view.ts:173`).
- `exam_windows` and `invitations` (`0006_invitations.sql:5,22`): an invitation carries `candidate_ref`, `name`, `email`, `phone`, `opens_at`, `closes_at`, `hard_close`, `attempt_id`, `source jsonb` and `revoked_at`. There is a UNIQUE on `(org_id, exam_id, candidate_ref)`. The invitations RLS is staff-only.
- `outbox` (`0006:76`): holds no personal data and sits outside tenant RLS. Its `kind` CHECK has been widened several times; the latest is `0052_interview_panel.sql:31`, which allows email, sms, whatsapp, webhook, greenhouse, staff_email, learner_email, ats, lti, student and interview.
- `drives.exam_id` (`0029_students_drives.sql:35`) is the only existing "job to exam" link, and it belongs to the college/TPO side.

**Exam model (`packages/core/src/domain.ts`)**
- `Question` is a union (`:222`) of four kinds:
  - `McqQuestion` (`:103`): `correctIndices`, `partialCredit`, `negativeMarks`.
  - `ShortQuestion` (`:123`): `expectedPoints`, and `takeHome` at `:131`.
  - `NumericQuestion` (`:134`).
  - `CodeQuestion` (`:178`): `tests` (hidden or visible), `checker`, `signature`, `languages`, `limits`, and `aiAssist` at `:208`.
- `ExamPolicy` (`:228`) covers duration, `allowRevision`, `vivaTriggerRatio`, `proctoring`, `testFeedback`, `codeCompletion`, `calculator` and `cutoff` (overall and per-section %).
- `ProctoringPolicy` (`:286`) covers identity, snapshots, browserEvents, screenShare and audio.
- `ExamSection` (`:315`) has `pick`, `pool` (copied questions) and an optional `durationMs` for sequential sections.
- `Exam` (`:328`).

**Per-candidate paper**
- This is **not** in `assemble.ts`. `api/src/assemble.ts` is the dependency wiring for the server and the delivery worker.
- The draw is `core/src/paper.ts:23` `resolvePaper`: a partial Fisher-Yates shuffle seeded by `attemptId + sectionId`. It is deterministic and recorded in the first ledger entry. `paperOf` (`:48`) narrows the exam to that paper.

**Question bank**
- Store: `packages/store/src/question-bank.ts`. `add` (`:75`) is all-or-nothing. Also `update` (`:93`), `archive` (`:107`, soft), `list` (`:118`, with **`LIMIT 1000` at `:130`**, ordered by topic) and `topics` (`:145`). Every query runs through `withScope`, which sets `parikshaa.org_id` and `parikshaa.actor` (`ledger-store.ts:48`).
- Routes: `api/src/bank-routes.ts`, all staff:
  - `GET /bank` (`:57`, needs `exam:read_key`)
  - `POST /bank` (`:86`), `PUT /bank/:questionId` (`:111`), `DELETE /bank/:questionId` (`:138`, archives) — all `exam:write`
  - `POST /bank/import` (`:161`): CSV with kinds mcq, numeric and short only, **no code**
  - `POST /bank/import/docx` (`:186`): has a dry run
  - `POST /media` (`:217`)
  - `GET /media/:sha256` (`:244`): **public**, no session
  - Every write validates with `validateQuestion` and writes an audit entry (`bank.added`, `edited`, `archived`, `imported`). Registered at `server.ts:1316`.
- Parsing lives in `bank-import.ts` (`importQuestions` `:97`, `draftFrom` `:169`, max 2000 rows) and `docx-import.ts`.
- Seeding the exam bank: `onboarding.ts:279` `loadStarter` adds `STARTER_QUESTIONS` (`:297`): 80 CS MCQs and 40 DSA coding questions, tagged so the role keywords match. Route: `POST /onboarding/starter` (`onboarding-routes.ts:158`). `loadSample` is at `:243`.
- `starter-packs.ts` (`PACKS :26`, `StarterPacks :148`) seeds the **practice/Learn** site, not the exam bank.
- Console: `components/Bank.tsx` (853 lines). The ExamEditor has "Add from bank" (`ExamEditor.tsx:395,533`), and questions are copied in, never referenced.

**Job test (JD to test draft)**
- `api/src/job-test.ts`:
  - `draft()` (`:97`): with a JD, the model reads it via `ExamService.authoring` (`service.ts:284`, subject to the spend cap, recorded under the "author" usage route). The Zod `JobReading` schema (`:47`) returns roleId, title, seniority and up to 8 skills. Without a JD, the recruiter picks a role and no model is called.
  - It then filters the **org's own bank** (`:142`) by whole-word keyword match on topic and tags (`:70-77`). It keeps only the commonest `maxScore`, sorts by `DIFFICULTY_ORDER[seniority]`, caps the pool at `count×3`, and writes `notes` where the bank is short (`:158-160`).
  - Skills that no role section covers become an extra "Skills from the job" section (`:140`, mcq and numeric, 6 questions).
  - `create()` (`:189`) copies the questions into an `Exam` with sections and pools, a duration and a cutoff. It sets **no proctoring and no section timers**; `allowRevision` is true.
- Routes in `job-test-routes.ts` (staff, `exam:write`): `GET /job-tests/roles` (`:36`), `POST /job-tests/draft` (`:71`), `POST /job-tests` (`:116`). Registered at `server.ts:1342`, where the service is built inline.
- `roles.ts`: 60 roles in 7 `FAMILIES` (`:26`). Each `RoleSection` has keywords, kinds and a count. Also `MINUTES` per kind, `DIFFICULTY_ORDER` and `roleById`.
- Console: `JobTest.tsx`. `JobTestDrawer` (`:24`) offers role search or a JD textarea plus an Experience selector. `DraftReview` (`:142`) shows pools and notes, then saves and opens the editor (`App.tsx:65, 971`). It is opened from `ExamList.tsx:87` ("From a job").

**Invitations and delivery**
- `invitation-service.ts`:
  - `setWindow` (`:159`) moves pending candidates and can notify them.
  - `importCandidates` (`:229`) takes a CSV with a dry run.
  - `inviteOne` (`:262`) is used by ATS, Greenhouse and LTI.
  - `inviteMany` (`:285`) is used by placement drives at `placement.ts:455`.
  - Also `resend` (`:316`), `revoke` (`:327`), `link` (`:334`) and `links` (`:342`, audited CSV export).
  - Each invite enqueues "invite" now, plus `reminder_day` and `reminder` (`:203-222`), in the **same transaction** (`invitation-store.ts:207`).
- Links: `?invite=org.invitation.mac` (`invite-codes.ts`, HMAC, never stored).
- Routes (`invitation-routes.ts`), staff:
  - `PUT` and `GET /exams/:examId/window`
  - `POST /exams/:examId/invitations/import`
  - `GET /exams/:examId/invitations`
  - `GET /candidates/search`
  - `GET /exams/:examId/invitations/links.csv`
  - `POST /invitations/:id/resend`
  - `POST /invitations/:id/revoke`
- Routes (`invitation-routes.ts`), public and throttled per IP:
  - `POST /invitations/briefing` (`:294`): instructions, notice and camera needs, nothing claimed.
  - `POST /invitations/redeem` (`:353`):
    - Returns 403 before the window opens, 410 after it closes, 428 when consent or the camera is missing, and 402 when credits run out.
    - The first redeem claims the attempt and calls `startInvited`, which consumes credit.
    - It returns an attempt token and records the origin IP and user-agent for the proxy check (`invitation-service.ts:424`).
- `outbox-store.ts`: `enqueue` (`:35`), `claimDue` (`:61`, SKIP LOCKED), plus `sent`, `skipped` and `failed`.
- `delivery.ts`:
  - `DeliveryWorker.tick` (`:260`) retries with exponential backoff up to 8 attempts.
  - For email, sms and whatsapp, `#deliver` (`:281`) loads the invitation and builds the message at send time: email via `#email` (`:384`), SMS via `Msg91Sender`, WhatsApp via `CloudWhatsApp` templates (`:41`).
  - Other kinds go to `handlers`, wired at `assemble.ts:345-354` (interview, student, staff_email and others).
- Web: `App.tsx:178` takes `invite` from the URL; `InviteGate.tsx:66` calls `redeemInvitation` (`web/api.ts:117`) after `briefInvitation` (`:165`) and `Instructions.tsx`. Console: `Candidates.tsx` (CSV import with channels `:319-331`, resend `:109`, links `:123`, window `:246`).

**Take-home and AI-assist**
- Take-home is a `ShortQuestion.takeHome`. The `{link, notes}` answer is checked on commit (`service.ts:847`, `core/takehome.ts`), scores 0 until a person marks it (`marking.ts:25,100`), and is never graded by the model. UI: `web/components/TakeHome.tsx`, console `QuestionFields.tsx:266`.
- AI-assist is `CodeQuestion.aiAssist`. Route: `POST /attempts/me/assist` (`server.ts:1134`, candidate attempt token) calls `askAssistant` (`service.ts:1249`). It allows up to 20 asks per question, writes a sealed `ai_assisted` ledger event (`sealing.ts:35`), and returns 503 when the spend cap is reached. UI: `web/components/AiAssist.tsx`; reviewers see it in `AttemptReview.tsx`.

**AI writing new questions?** No.
- `job-test.ts:13-16` says "the model never writes a question", and the tracker decision (`PREP-TRACKER.md:304, 317`) confirms it.
- The only model calls are: JD reading, grading, viva, AI-assist, the proxy identity photo check (`proxy.ts:142`), the AI interviewer (`ai-interview.ts:381,396`, which writes questions live in chat but stores them only in the interview transcript, not the bank) and Sahayak.

**How private is a bank?**
- Per org. Postgres RLS restricts rows to the org and to the staff actor, reading needs `exam:read_key`, and there is no shared or global bank: starter questions are copied into each org's bank.
- Leaks are possible in two places:
  1. Once a question is copied into an exam, its key sits in `exams.definition`, and that table's RLS admits candidate scope. Protection is in the API only.
  2. `GET /media/:sha256` is public across orgs.

## How it maps to the target flow

1. **Job post.** Missing. There is no job or requisition entity. The JD is parsed only transiently in `POST /job-tests/draft`, and nothing is saved: no skills, seniority, CTC, openings, deadline or screening questions. No exam links to a job (the only precedent is `drives.exam_id`).
2. **Apply.** Not in this subsystem. Invitations are keyed by a free-text `candidate_ref`, which could hold an application id.
3. **AI screening.** Missing here. The JD reading (`JobReading`) could be reused to extract skills for matching.
4. **OA link and test generation.**
   - Works: draft from a role or JD, private-bank pools, random paper per candidate, signed link, email/SMS/WhatsApp with reminders, briefing, resend and revoke.
   - Partial:
     - Questions come only from the existing bank, the draft is deterministic (same bank gives the same pools), and nothing tracks how often a question has been used or exposed.
     - The draft sets no proctoring, section timers or negative marking.
     - Invite copy says "institution", which reads as college wording.
   - Missing:
     - AI-drafted new questions into the bank. This needs a draft/approved status, source and author columns, and a review queue so a human approves them.
     - CSV import of code questions.
     - "Invite the shortlisted applicants of job X": use `inviteMany` (`invitation-service.ts:285`) as `placement.ts:455` does.
5. **Monitoring.** Partial. The policy fields exist, redeem enforces the camera, and the origin IP and user-agent are recorded for the proxy check. Detection itself is the proctoring and proxy subsystems' job.
6. **Integrity-aware shortlist.** Partial. `ExamPolicy.cutoff` exists and is set from the role's `cutoffPercent`. Combining it with integrity signals is not done here.
7. **Further rounds.** Partial.
   - Exists: the AI interviewer as a separate link (`?ai-interview=`), take-home questions with human marking, and AI-fluency code questions.
   - Missing: a round or pipeline entity that ties OA, interviews and offer to one job and candidate.
8. **Admin.** Partial. The org-level bank admin is complete (CRUD, CSV/DOCX import, media, archive, audit). There is no platform-admin view of banks and no shared or curated library apart from the copied starter set.

## Extension points and conventions

- **Routes:** copy `job-test-routes.ts`. It shows the `Routes` type, Zod schemas with `TAGS`/`SECURED`/`refusals`, and `staff(request, reply, perm)`. Register in `server.ts` around `:1342`. For public candidate routes copy `invitation-routes.ts:353`, which uses `throttle.blocked`/`failed`. For attempt-token routes copy `server.ts:1134` (`requireAttempt`).
- **Services:** check `can(actor, perm)` and throw `Forbidden`; audit with `exams.recordAudit(actor, "x.y", target, detail)` (see `bank-routes.ts:106`); wire everything in `assemble.ts`.
- **Model calls:** use `ExamService.authoring` (`service.ts:284`) for staff calls and `modelCall` (`:302`) for org calls with no staff member behind them. Return `{result, usage}`, use `zodOutputFormat` with a cached system prompt, and wrap untrusted text in tags (`job-test.ts:61-65,107-116`).
- **Store:** copy `question-bank.ts`: a class over `SqlExecutor` where every method uses `withScope(sql, scope, tx => …)` and gets `staffScope(orgId)`. For sealed personal data use the `keys.records("…")` stores (`assemble.ts:145,157`).
- **Migration:** copy `0005_question_bank.sql`: org-keyed PK, a RESTRICTIVE `tenant_isolation` policy, an actor policy, and `GRANT … TO parikshaa_app`. A new outbox kind must drop and re-add `outbox_kind_check` (as `0052` does) **and** get a handler in `assemble.ts:345-354`.
- **Messaging:** queue `OutboxDraft`s in the same transaction (`invitationStore.enqueue`) and build the message at send time (`delivery.ts:281`, `ai-interview.ts` `deliver`).
- **Tests:** copy `job-test.test.ts`: `freshDatabase`, `wire(pgliteExecutor(db), {client: fakeModel().client})`, `addOrganisation`/`addStaff`/`signIn`, then `SET ROLE parikshaa_app` and `app.inject`. `fake-model.ts` routes `messages.parse` by a substring of the system prompt (`:81-93`), so a new prompt needs a new branch and a script field.
- **i18n:** web strings live in `web/src/i18n.tsx` plus `locales/*.ts` (10 languages); console has `hindi.ts`.
- **Process:** update `docs/PREP-TRACKER.md` (CLAUDE.md requires it).

## Risks / gotchas

- **`QuestionBank.list` LIMIT 1000** (`question-bank.ts:130`). `JobTestService.draft` and `create` read the whole bank through it, so in a bank with more than 1000 questions, topics late in alphabetical order are silently left out of drafts, and `create` will 404 on their ids (`job-test.ts:198-203`).
- **Answer keys:** `exams` RLS admits candidate scope (`0003:164`). Never return `exam` to candidates without `candidateView`. New AI-generated questions must also never reach the bank or an exam unreviewed (the repo rule is that AI suggests and a human decides).
- **Exams are frozen copies.** Editing the bank does not change existing exams, and a sat exam cannot be edited, so the test for a job must be finalised before invites go out.
- **Same pools for the same role:** the paper draw is seeded and recomputable by staff, and there is no exposure or leak tracking. "Fresh questions per candidate" needs larger pools or a new mechanism.
- **Invitations:** UNIQUE `(org, exam, candidate_ref)`. Without an exam window, a candidate gets 7 days, and `hardClose` defaults to true.
- **Credits:** redeem consumes a credit, so test runs need the billing setup (402).
- **Spend cap:** `authoring` throws `SpendCapReached`, which blocks JD drafting.
- **Outbox:** no personal data in `subject`, a kind needs both the CHECK update and a handler, otherwise it is silently skipped ("No handler for X").
- **Media:** images are fetchable without auth by anyone who knows the hash.
- **Releases:** after any route or schema change run `npm run openapi` (`openapi.test.ts:54` compares against the committed `docs/openapi.json`); run `npm run check`, plus `npm run build:clients` and `npm run budget` for client changes. `JobTest` is lazy-loaded to stay within the bundle budget.