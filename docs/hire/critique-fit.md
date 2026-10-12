# Hire v2 — fit critique (does the design match the code?)

Workflow W3 (`docs/hire/workflows/w3-fit-critique.js`), prompt `docs/hire/critique-fit-prompt.md`. Run 12 Oct 2026 on
the Hire v2 branch with `main` (F1 go-live G0–G4a, PR #47) merged in, so the code read is current: the last migration
is `0069_code_timeline.sql`.

Every point below was checked in the code, with file:line evidence. Code maps in `docs/hire/code-map/` were used only
to find things; where they disagree with the code, the code wins. Each issue says what the design says, what the code
does, and the exact change to the design, with the slice it belongs to.

Severity: **blocker** (the slice cannot be built as written), **important** (it can be built, but it would be wrong,
slow or leak), **minor** (a detail a builder needs; easy).

## Issues

### F1 — The operator scope in S10/S11 does not fit the G1 operator (blocker, H7)

- **Design.** §8 and §10 S11: an own `actor='operator'` scope whose policies allow only organisations, jobs, job reports
  and SECURITY DEFINER count functions; `operatorAuth`; `totp_last_step`; sign-in throttle; `OPERATOR_ALLOW_CIDRS`;
  token in sessionStorage; an append-only `operator_audit` table that also records reads. §8: console
  `/console/?operator` → operator sign-in. S10: `hire_job_reports` has no staff policy (operator only).
- **Code (G1).** An operator is an ordinary staff actor whose address is in `PARIKSHAA_OPERATORS` and who has a TOTP
  secret (`api/src/operator.ts:20-34`, `check` at `:103-108`). Routes use the `staffAuth` scheme and answer 404 to
  anyone else (`operator-routes.ts:26`, `:55-67`). Reads go through each organisation's **staff scope**:
  `ReportStore.organisations` runs `withScope(staffScope(id))` per org (`store/src/report-store.ts:54-71`), grants run
  under `staffScope(org.id)` (`operator.ts:154`, `:193`). Audit goes to `audit_log` twice, in the touched org and the
  operator's own (`operator.ts:214-219`); `audit_log` is already append-only. Staff TOTP already has replay protection
  (`totp_last_step`, `migrations/0014_staff_security.sql:15`, `identity-store.ts:438-439`) and staff sign-in is already
  throttled. The console keeps the staff token in sessionStorage (`console/src/App.tsx:134-142`), and the operator's
  page is the view `companies` inside the normal console (`App.tsx:64`, `:552`, `:992`), not a separate sign-in.
- **Why it blocks.** "H7 extends G1" (§8) and "own operator scope" (S11) cannot both hold: an operator scope means
  rewriting every G1 read and the G1 tests. S10's "no staff policy" table cannot be read at all by G1's staff-scoped
  operator.
- **Change (H7).**
  1. Drop the operator scope, `operatorAuth`, the `operator_audit` table and the `?operator` sign-in from §8/S11. Keep
     G1's model: staff actor + `Operators.is` + second factor, `staffAuth`, audit in `audit_log` (org + operator's own).
  2. S11 keeps only what G1 lacks: `OPERATOR_ALLOW_CIDRS` checked in `OperatorService.check` (one more refusal, still
     404); an audit entry for each candidate lookup (`operator.candidate_viewed`, ids and counts only), since that is
     the one read of personal data.
  3. Hire figures in the companies list (open jobs, applications in 30 days) are counts added to the per-org query in
     `ReportStore.#organisation` (same staff scope as G1). No applicant rows reach the operator's pages.
  4. `hire_job_reports` is the one exception, built like `library_questions` (`migrations/0068_library.sql:9-35`): no
     `tenant_isolation`, one policy for `parikshaa.actor = 'operator'`, read through a small `operatorScope()` used
     only by the H7 report store. The public "Report this job" inserts through a SECURITY DEFINER function
     `hire_file_job_report(...)` (with `SET search_path = ''`, see F29). The company sees only the outcome, kept on
     `hire_jobs` (`taken_down_at`, `taken_down_reason`).
  5. Operator console: add "Reports" and "Candidates" sections to `OperatorPanel` (`components/Operator.tsx`), lazy (see
     F30).

### F2 — Suspension: G1 already does most of S12; the mail hold has no place in the worker (important, H2 + H7)

- **Design.** S12: suspension refuses sessions and API keys, holds the org's hire/interview mails, and 404s its public
  pages. §8 puts all suspension effects in H7.
- **Code.** G1 already refuses password sign-in (`staff-auth.ts:206`) and SSO (`staff-security.ts:339`), revokes every
  session on suspend (`identity-store.ts:178-190`), drops suspended orgs from session lookup (`identity-store.ts:324`)
  and from API-key lookup (`identity-store.ts:623`). `organisations.suspended_at` exists (`0067_company_ids.sql:24`)
  and `IdentityStore.getOrganisation` returns it (`identity-store.ts:123-130`). Nothing in delivery looks at it. An
  outbox handler can only return `"sent"` or `{skip}` (`delivery.ts:215`); a thrown error retries with backoff and is
  given up after 8 tries (`delivery.ts:264-276`). So "hold" cannot be expressed: skip loses the mail, throw burns it.
- **Change.**
  1. S12's session and key part is done by G1: nothing to build.
  2. Move the Hire effects to **H2** (they need only `suspended_at`, which exists): public job and careers routes answer
     404, apply is refused, the portal shows "This company's account is paused" with no actions.
  3. Add a third handler outcome `{ later: Date }` and `OutboxStore.defer(id, until)` (status back to `pending`,
     `attempts` not counted). The `hire` handler (H2) and the `interview` handler (H7 change, `interviews.ts` /
     `ai-interview.ts` `deliver`) return `{ later: now + 1 h }` while the org is suspended. Exam invitations keep going
     (0067's rule: candidates already given links are not cut off).

### F3 — H2 needs `organisations.verified_at`, but the column is planned in H7 (important, H2)

- **Design.** S18/P18: unverified employers get ≤2 open jobs, ≤100 applications per job, no auto-screen, no resume
  download, `noindex`. P1: `auto_screen` off until verified. These are H2 items (build order line in §10). But
  `verified_at`, `verified_by` and `verification jsonb` are added in H7's migration (§8, §9 H7).
- **Code.** No such column exists today: `0067_company_ids.sql` adds only `public_id`, `suspended_at` and
  `suspended_reason`; `ORGANISATION_COLUMNS` has no verification field (`identity-store.ts:123`). The only "verified"
  in identity is the owner's email (`email_verified_at`, used by `UNTIL_VERIFIED`, `staff-auth.ts:129`), which is a
  different thing.
- **Change.** Add `verified_at`, `verified_by`, `verification jsonb` to `organisations` in H2's migration (0071), read
  through `getOrganisation`. H2 builds the limits on it; tests set it directly as the owner role. H7 keeps only the
  operator's verify / unverify actions, the checks it records and the UI. An organisation the operator creates through
  G1 (`OperatorService.create`, `operator.ts:137-168`) may be created verified with the same `verification` record,
  since an operator made it.

### F4 — Hire retention would never run for most companies (important, H2; account part H1)

- **Design.** §1 retention via "add to the sweep"; S9: per-org `hire_keep_days` (default the org's `retentionDays`),
  rejected/withdrawn erased that many days after the decision, inactive accounts erased after 3 years (mail first),
  codes purged at 24 h, sessions 7 days after expiry, "all registered as `RetainedRecords`".
- **Code.** `PrivacyService.sweep` runs the `RetainedRecords` only when the org has a privacy-settings row:
  `settings = … await this.#o.privacy.get(scope)` and `if (settings !== null)` (`privacy.ts:284-293`). Neither
  self-signup (`onboarding.ts` `signUp`) nor the G1 operator (`operator.ts:137-168`) writes privacy settings; 180 days
  is only the column default (`0009_privacy.sql:39`). The hook passes `before = now − retentionDays`
  (`privacy.ts:286`), not a Hire setting. `RetainedRecords.sweep(orgId, before)` is per organisation
  (`privacy.ts:99-102`), so global records (accounts, codes, sessions) do not fit it.
- **Change.**
  1. H2: a `HireRetention.sweep()` of its own, called from the hourly retention loop in `main.ts:200-212` (beside
     `sweepTutor` and `sweepMedia`) and from the harness. Per org it uses `hire_keep_days ?? privacy retentionDays ?? 180`
     and erases through `HireErasure` (S3). The apply notice prints the same resolved number.
  2. H1: `CandidateAccounts.sweep()` (global) for codes (24 h), sessions (7 days after expiry) and inactive accounts
     (see F22 for the warning mail). Same loop.
  3. S9's "all registered as `RetainedRecords`" becomes "all run from the retention loop"; `RetainedRecords` stays for
     per-org records whose period is the privacy setting (interviews, AI interviews).

### F5 — The `ref` formula needs a candidate id that imported applications do not have (important, H2)

- **Design.** S20: `ref = "A" + base32(HMAC(k, orgId‖candidateId))[0..8]`, stable per org and person, used as
  `invitations.candidate_ref`. S2/P11: manual and imported applications have `candidate_id NULL` until the person
  signs in and claims them.
- **Code.** Invitations are unique on `(org_id, exam_id, candidate_ref)` (`0006_invitations.sql:40`), and results are
  joined back by ref (`results.ts:304-310`). A NULL candidate id gives no ref, and a ref made later on claim would
  differ from any placeholder used before.
- **Change.** Derive the ref from the canonical email blind index, which every application has from the start:
  `ref = "A" + base32(HMAC(k, orgId‖email_canonical_hash))[0..8]`. It is the same for the same person across the
  org's jobs (needed for P5 and P9), and claiming does not change it. Store it on `hire_applications` (NOT NULL, not
  unique: one person, many jobs). Retakes keep P5's `ref + "~" + n`.

### F6 — `hiring_manager` cannot be limited to its jobs while it holds `attempt:*` (important, H2)

- **Design.** P3: new role `hiring_manager` with hire:review + hire:decide + attempt:read/review, "only for jobs whose
  `managers` include them".
- **Code.** `can()` looks only at the role (`staff-auth.ts:117-122`); grants are org-wide (`GRANTS`,
  `staff-auth.ts:93-107`). With `attempt:review` a person reads every exam's results with names and emails
  (`results.ts:288-312`), every AI interview with its resume (`ai-interview.ts:204-207`, see F13), and with
  `attempt:read` every proctoring view (`proctoring.ts:219-220`). None of these know about jobs.
- **Change.** `hiring_manager` gets `hire:review` and `hire:decide` only, no `attempt:*`. Hire serves what a manager
  needs about a test through its own routes after the job-membership check: the round result (score, sections,
  integrity), and the report v2 PDF through `ResultsService.reportFor(orgId, attemptId)` / `CandidateReports`
  (`results.ts:425`, `candidate-report.ts:166`) called by the Hire service. Role CHECKs on `staff_users` and
  `api_keys` (0003), `StaffRole`, `GRANTS`, `EVERYTHING`, tenancy tests and console labels change as P3 says.

### F7 — Page paths `/jobs`, `/careers`, `/my` collide with API paths (important, H2 + H9)

- **Design.** §2: `main.tsx` routes `/jobs/<orgId>.<code>`, `/careers/<orgId>` and `/my` to `HireApp`. §9 H2:
  `hire-public-routes.ts` (paths not given).
- **Code.** The API strips `/api` from every URL (`server.ts:281-285`), so the client's `/api/jobs/x` and a browser's
  page `/jobs/x` reach the same router. A browser GET is answered by an API route when one matches; that is why
  practice sites need their own hook that serves the shell for HTML GETs under `/practice/` (`server.ts:1419-1426`).
  Unmatched HTML GETs get the web shell (`server.ts:1431-1436`). On Vercel, `/api/*` goes to the VM and every other
  path to `/index.html` (`vercel-output.ts:73-81`). `pagePolicy("/")` already covers these pages on both
  (`page-headers.ts:31-50`, `vercel-output.ts:68`), so the CSP needs no change.
- **Change.** No API route under `/jobs`, `/careers` or `/my`. Public API: `/hire/public/jobs/{code}`,
  `/hire/public/careers/{orgId}`, `/hire/public/jobs/{code}/report`; candidate API: `/candidate/*`; staff API:
  `/hire/*`. Pages stay `/jobs/…`, `/careers/…`, `/my` and fall through to the shell. `main.tsx` adds one path test
  next to `practiceSite` (`main.tsx:11-12`) that lazy-loads `HireApp`.

### F8 — AI screening on the mail worker would run twice and hold up mail (important, H3)

- **Design.** §4: on apply, outbox `hire`/`screen`, "handled by the delivery worker", `modelCall(org, "screen")`.
- **Code.** `DeliveryWorker.tick` claims 25 items and handles them one after another (`delivery.ts:260-264`); each
  instance ticks every 5 s (`main.ts:184-195`). A claim holds an item for 120 s (`outbox-store.ts:48`, `:61-80`);
  after that another instance may claim the same item again. 25 model calls of 5–20 s each pass the lease, so the
  same application is screened twice (twice the spend), and every invite, interview and reset mail of every org
  waits behind the model. A thrown `SpendCapReached` is retried 8 times and then marked failed (`delivery.ts:268-276`),
  not `skipped`.
- **Change.** Screening gets its own loop: `OutboxStore.claimDue(now, limit, { kinds, purposes })` (filter added), the
  mail worker excludes `hire`/`screen`, and a `ScreenWorker` claims at most 2 at a time on its own interval. The
  handler catches `SpendCapReached` and writes the screening as `skipped` with the reason (then `{skip}`), and is
  idempotent per application (the latest screening wins, §1). Tests drive it with `ScreenWorker.tick()`.

### F9 — `inviteMany` has no per-call window and returns no invitation ids (important, H4)

- **Design.** §5: "Send test" → `InvitationService.inviteMany` "extended with an optional per-call window (now → now +
  daysToComplete)" with ref = application.ref; result row `invited`. §2 portal: **Take the test** with a code from
  `InviteCodes.issue`. P5: same exam across jobs → "Took this test on <date> for <job>" → reuse or choose another.
  P4/P6: "Extend these n windows", "Extend window by n days", bulk Nudge.
- **Code.** `inviteMany(actor, examId, people, channels, detail)` needs `attempt:start`
  (`invitation-service.ts:285-292`). The window is the exam's, or now → now + 7 days (`:295-296`); if the exam's
  window has closed it throws, whatever the caller wants (`:297`). Anyone already invited to the exam is filtered out
  and only counted (`:298-305`): it returns `{invited, skipped}` numbers, no ids. The store inserts without
  `ON CONFLICT` (`invitation-store.ts:207-238`), so a ref twice in `people`, or two "Send test" clicks at once, hit
  the UNIQUE `(org_id, exam_id, candidate_ref)` (`0006_invitations.sql:40`) and answer 500. A code needs the
  invitation id (`invite-codes.ts:28`); `InvitationService.link(orgId, invitationId)` builds the URL (`:334-336`).
  The only window change is the exam-wide `moveWindow`, which moves invitations still on the old exam window
  (`invitation-store.ts:145-188`); there is no per-invitation extend. `resend` exists for a nudge (`:316-325`).
- **Change (H4).**
  1. `inviteMany(…, options?: { window?: { opensAt, closesAt }, hardClose? })`: with a window, the exam's window and its
     "closed" check are not used. Refs are de-duplicated first; a unique violation is caught and reported as skipped.
  2. It returns `{ invited: {ref, invitationId}[], skipped: {ref, invitationId, attemptId}[] }` plus the two counts, so
     `placement.ts` keeps working. Hire uses `skipped` for P5's "Took this test on …".
  3. `hire_round_results` gains `invitation_id`; the portal shows `invitations.link(orgId, invitationId)` only while the
     invitation is not revoked and its window is open.
  4. New `InvitationStore.extend(scope, invitationIds, closesAt)` (unstarted only, reminders re-queued as
     `moveWindow` does) and `InvitationService.extend(actor, ids, closesAt)` (`attempt:start`, audited) for P4/P6.

### F10 — A `reminder_closing` would go out as a new invitation, in college words (important, H4)

- **Design.** P6: invitation purpose `reminder_closing` (24 h and 3 h before close, skipped if started). P14: mails
  read as "<Company> via Parikshaa".
- **Code.** `DeliveryWorker` skips an "already started" message only for `reminder`, `reminder_day` and `rescheduled`
  (`delivery.ts:294-295`). Any other purpose falls to the default branch and is sent as the invitation itself
  (`delivery.ts:343-352`, lead text "… has invited you to take the … test", `:391-401`). WhatsApp has only the
  `reminder` template, whose words are about opening (`delivery.ts:41`, `:362-367`). The mail names the org as
  "institution" (`:304`) and says "for your institution to see" (`:411`).
- **Change (H4).** Teach `DeliveryWorker#deliver` the purpose `reminder_closing`: skip when the attempt has started or
  the window has closed; mail lead "Your … test closes at …"; on WhatsApp use the `reminder` template with "closes …"
  wording or skip WhatsApp. `InvitationService` queues it from `closesAt` (24 h, 3 h) when the window was given per
  call. For `organisations.kind = 'company'` the invite and reminder mails say "company" and use the P14 sender name
  (F23).

### F11 — The AI interviewer refuses long JDs and long resumes (important, H4)

- **Design.** §5: "Send AI interview" → `AiInterviewService.create` with the job's role/JD/seniority, the round's
  questions/minutes, the candidate's name/email/ref and the application's resume text. JD ≤ 20 000 chars (§1);
  resume text ≤ 60 000 chars (S1).
- **Code.** `create(actor, {title, roleId?, job?, seniority, questions, minutes, candidateName, candidateRef?,
  candidateEmail?, resume?})` needs `exam:write` (`ai-interview.ts:162-177`). It throws on a resume over 20 000
  chars (`MAX_RESUME`, `:30`, `:183`). `ai_interviews.job` has `CHECK (char_length(job) <= 12000)`
  (`0060_ai_interviews.sql:13`), so a JD of 12 001–20 000 chars fails in the database (a 500). Questions 2–8 and
  minutes 10–90 are CHECKs too (`:15-16`), matching §1. It queues its own `ai_invite` mail at once (`:200`,
  `:231-234`). The resume goes into the prompt unescaped (`:358`); S16 already covers that.
- **Change (H4).** Hire passes `job: description.slice(0, 12000)` and the resume's first 20 000 characters, and the
  round editor says so ("the first 20 000 characters of the resume"). `seniority` comes from the round config (§1),
  defaulting from `exp_min`. The `ai_invite` mail stays (it is the candidate's link); P15's `onSettled` hook is added
  to `#finish` and `decide`. Settle takes the person's scorecard when there is one, else the model's reading, labelled
  "AI" (S14).

### F12 — `InterviewService.schedule` always puts the scheduler on the panel (important, H4)

- **Design.** §1 interview round config `{title, minutes, panel: staffIds[], passRating}`; §5 "Schedule interview" →
  `InterviewService.schedule` (driveId null); settle reads the combined scorecard. §1 permissions: an author has all
  four hire permissions.
- **Code.** `schedule(actor, {title, candidateName, candidateRef, candidateEmail, scheduledAt, minutes, meetingUrl,
  problem, language, driveId, panel?})` adds the calling user to the panel always
  (`panel: [...(actor.kind === "user" ? [actor.id] : []), ...others]`, `interviews.ts:201`). The interview becomes
  `done` only when every panel member has scored (`:338-341`). So a recruiter who books an interview for two
  engineers blocks it until the recruiter also scores. It needs `attempt:review` (`:167-169`), which the `author`
  role lacks (`staff-auth.ts:95`). `interviews.status` allows only scheduled/done/cancelled (`0036_interviews.sql`).
- **Change (H4).** Add `includeScheduler?: boolean` (default true; Hire passes false when the round names a panel).
  §1 permissions: "Scheduling an interview also needs `attempt:review`" (author cannot unless given recruiter, P3).
  P10's `no_show` and reschedule need a migration on the `interviews.status` CHECK: H4 has its own migration (F29).

### F13 — S22 leaks through the existing interview and results pages (important, H4)

- **Design.** S22: phone, email and resume need `hire:decide`, job-manager membership or the panel; a viewer sees
  names, round state and scores only.
- **Code.** The `viewer` role has `attempt:review` (`staff-auth.ts:106`). `GET /ai-interviews` and
  `GET /ai-interviews/:id` need only `attempt:review` (`ai-interview.ts:204-213`) and return `resume` and
  `candidateEmail` (`ai-interview-routes.ts:65-66`). Exam results return each candidate's email (`results.ts:39-43`,
  `:306-310`). Hire puts the applicant's resume into the AI interview (F11) and the email into the invitation.
- **Change (H4).** `AiInterviewService.list` and `view` return `resume: null` unless the actor has `exam:write` (the
  permission that created it), so the resume Hire passes does not reach viewers. S22 gains one line: "On the existing
  exam, results and interview pages a holder of `attempt:review` still sees candidate emails, as today; the Hire pages
  follow S22."

### F14 — There is no system path for the automatic face check (important, H5)

- **Design.** P7: on submit of a hire-linked attempt with identity on, queue an automatic face check
  (`checkAsSystem`, spend-capped).
- **Code.** `ProxyService.check(actor, attemptId)` needs a staff actor with `attempt:read` (`proxy.ts:131-132`), reads
  the photos through `ProctorService.view` / `photo`, which also take an actor (`proctoring.ts:219-220`,
  `:277-278`), pays through `ExamService.authoring(actor, …, {route: "assess"})` (`proxy.ts:139-159`) and
  audits as the actor (`:169`). `modelCall`, the actor-less path, accepts only the route `"interview"`
  (`service.ts:303-306`).
- **Change (H5).** Split `check` into a private `#compare(orgId, attemptId, pay)` that reads photos through the store
  (`ProctorStore.media` / `open` under `staffScope(orgId)`), and two callers: `check(actor, …)` as today, and
  `checkAsSystem(orgId, attemptId)` paying through `modelCall(orgId, "assess", …)` (widen the route type, F28),
  saving `checkedBy: "Parikshaa (automatic)"` and auditing with `appendAudit` and `actorKind: "system"` (the pattern in
  `privacy.ts:291`). The Hire listener (F21) calls it on `attempt.submitted` when the exam has identity on.

### F15 — Integrity cannot be computed per application by calling the existing reports (important, H5)

- **Design.** §6/P15: integrity per application, recomputed when its attempt changes (event-driven); similarity per
  job queued; reading the pipeline is a plain table read.
- **Code.** All the per-exam reports need a staff actor and read the whole exam:
  - `ResultsService.results(actor, examId)` (`attempt:review`) folds every ledger of the exam (`results.ts:288-312`).
    Rows have `attemptId, candidateId, state, total, maxTotal, percent, startedAt, submittedAt, durationMs, scores,
    probes {asked, replied, verdicts}, voidReason, sections, outcome` (`core/src/analytics.ts:19-46`) plus `ref, name,
    email` (`results.ts:39-43`). No identity state, no proctoring counts.
  - `ProxyService.report(actor, examId)` (`attempt:read`) calls `results` again and loops `proctor.view` per row to count
    unchecked attempts (`proxy.ts:82-119`). Its reused photos keep only refs of this exam (`refOf` from this exam's
    rows, `proxy.ts:107-110`), so a photo reused in another job's test is dropped: P9's org-wide check cannot use it.
  - `ResultsService.similarity(actor, examId)` is O(n²) per code question (`results.ts:366-416`).
  - `ResultsService.reportFor(orgId, attemptId)` is actor-less and has identity state and event counts
    (`results.ts:425-492`, `:514-528`), but computes `#standing` over every ledger of the exam (`:494-512`).
  The parts are joinable by ref: origins carry `candidate_ref` (`proxy-store.ts:43-52`), identity checks and
  `ProctorStore.summary` are keyed by attempt id (`proxy-store.ts:77-88`, `proctor-store.ts:272`), similarity sides
  carry ref and attempt id, and `invitations.byAttempt` maps an attempt to its ref.
- **Change (H5).** `hire-integrity.ts` reads stores for one attempt, under `staffScope(orgId)`, never the per-exam
  reports: a new `ResultsService.attemptFacts(orgId, attemptId)` (`resultOf` + identity state and review + event
  counts, without standing); `ProxyStore.origins(org, examId)` filtered to the job's refs; `ProxyStore.reusedPhotos(org)`
  mapped through `invitations.byAttempt` (org-wide, P9); `ProxyStore.checks(org, examId)`; `ProctorStore.timeline` for
  pastes (F19). Similarity runs per job as a queued item (P15) and stores pairs by ref. An application is found from
  a ref by stripping P5's `~n`.

### F16 — Question drafts (H6) must sit on the G2 Library, not beside it (important, H6)

- **Design.** §7: `bank_questions` gains `status`, `source CHECK(manual|import|starter|ai)`, `created_by`,
  `approved_by/at`, `used_count`, `last_used_at`; `POST /bank/drafts`; near-duplicates dropped against the bank;
  job-test drafting prefers least-used approved questions; code drafts run the reference "as `content-dsa`/editorial
  check do". P21: H6 after the UI, MCQ/numeric only in v1.
- **Code (G2, G4).** The Library copies a question into the bank tagged `library:<id>` (`library-store.ts:258-262`) and
  records the version in `library_adoptions` (`0068_library.sql:37-55`); `library_questions.exposure` counts
  organisations (`:24`). `LibraryService.pick(actor, filter, count)` copies a few at random that the org has not taken
  (`library.ts:85-90`). Job-test drafting still reads only the org's bank (`job-test.ts:142`, `:198`), through
  `QuestionBank.list` with `LIMIT 1000` (`question-bank.ts:130`). The reference run exists:
  `ExamService.checkReference(actor, question, answer)` runs a reference on the question's tests and returns each
  output (`service.ts:1034-1058`, route `POST /questions/code/check`, `server.ts:718`).
- **Change (H6).**
  1. `source` gets `library` too; backfill it from the `library:%` tag. Library copies count for `used_count` like any
     bank question.
  2. When job-test drafting finds the bank short, its notes offer "Take n from the Parikshaa Library"
     (`LibraryService.pick` with the role's section and topic) before "Draft new questions with AI".
  3. Near-duplicates are dropped against the bank and against `library_questions` stems.
  4. Code drafts (after v1, P21) get expected outputs from `ExamService.checkReference`; no new runner path.
  5. The LIMIT 1000 fix stays in H6 (or earlier, with H4's job-test use).
  Do not build a second shared bank, a second exposure counter across orgs, or a second reference runner.

### F17 — Server-rendered job-page meta (P19) has no server to render it (important, H9)

- **Design.** P19: server-rendered `<title>`, `og:*` and `JobPosting` JSON-LD for verified orgs' job/careers pages.
  S18: unverified pages `noindex`.
- **Code.** In production the pages are static files on Vercel: everything outside `/api` is a file or
  `/index.html` (`vercel-output.ts:73-81`). The API serves the web build only when the built clients sit beside it
  (`main.ts:60`, `server.ts:1413-1436`), and even then it sends `index.html` as is.
- **Change (H9).** v1: the page sets `document.title` and, for an unverified org, a `<meta name="robots"
  content="noindex">` from script; no `og:*` or JSON-LD. Server-rendered meta becomes a later item (a Vercel route
  `^/jobs/(.*)$` to an API endpoint that returns the shell with escaped tags and the built asset names). `?src=`,
  `?ref=` and link variants stay in H2/H9.

### F18 — No "person-confirmed" viva verdict exists (minor, H5)

- **Design.** S14 lists "a person-confirmed viva `inconsistent`" among the signals that may be `high`.
- **Code.** The only verdict is the model's: `viva_assessed` carries `VivaAssessment {probeId, verdict, confidence,
  reasoning}` (`core/src/domain.ts:385-390`, `:424`). When staff press "assess", the model writes it
  (`service.ts:1369-1383`); no event records a person agreeing.
- **Change (H5).** Viva verdicts are `warn`, labelled "AI". In the Integrity tab a person may **confirm** any reason
  with a note; the confirmation is stored on the reason in `hire_integrity.reasons` (`confirmedBy`, `confirmedAt`),
  audited `hire.reason_confirmed`, and a confirmed reason counts as `high`. No ledger change.

### F19 — G4's large-paste signal is ready for H5 (minor, H5)

- **Code (G4).** The editor's changes are kept per code question, sealed (`0069_code_timeline.sql`), for any exam with
  code, proctored or not (`proctoring.ts:193-215`). `ProctorService.playback` returns, per question, the pastes and
  `largePastes`, counted with `LARGE_PASTE = 200` characters (`proctoring.ts:254-271`, `core/src/timeline.ts:36`).
- **Change (H5).** Add reason `code_large_paste` (`warn`, "pattern"; evidence: question, characters, minute; link to the
  playback in attempt review), using `LARGE_PASTE`, not a second threshold. Read it through `ProctorStore.timeline` in
  the system path (F15). §6 item 4's "paste events > 3" stays for non-code questions. P2's coverage lists it as a check
  that runs even on an unproctored test.

### F20 — Leave room for G5–G8 instead of a Hire-only preset (minor, H4 + H5)

- **Code.** Proctor event kinds are a CHECK (`0059_proctoring_v2.sql:7`) and a TS union (`proctor-store.ts:21-31`).
  `ProctoringPolicy` has `identity`, `snapshotEverySeconds`, `browserEvents`, `screenShare?`, `audio?`
  (`core/src/domain.ts:286-306`); there is no level yet. G5 (strict: full screen, in-browser face events), G6 (live
  video), G7 (phone camera), G8 (Safe Exam Browser) are planned as levels 2–5 (`docs/F1-GO-LIVE-PLAN.md` §6).
- **Change.** H4: the assessment round stores `proctoring: "secure"` (the F1 plan's level 1 = today's identity +
  snapshots + browser events + screen share + audio) and the "hiring preset" is that level, applied through
  `ProctoringPolicy`; the editor warns below "secure" (P2). When G5 lands, "strict" is one more choice, not a second
  preset. H5: event kinds map to reasons through one table (`EVENT_REASONS`: kind → code, threshold, severity);
  unknown kinds show as `info`, so G5's `no_face` / `many_faces` need one row each. When G5's in-browser face events
  exist, P7's model face check runs only when they flagged something or identity review is pending (saves spend).

### F21 — The P15 listener fits the webhook fan-out; three details (minor, H4)

- **Code.** `attempt_started/submitted/graded/voided` always queue a `webhook`/`event` outbox item in the append's
  transaction (`ledger-store.ts:78-83`, `:517-519`). Its handler calls every listener after queuing webhooks
  (`webhooks.ts:148-163`); the listeners are passed in `buildIntegrations` (`integrations.ts:74`), which both
  `assemble.ts:216` and `harness.ts:291` call.
- **Change (H4).** Add the Hire listener to that array (late-bound, since `HireService` is built after
  `buildIntegrations`, as `InvitationService.arrangements` is). It must be idempotent: a listener that throws makes
  the whole fan-out retry. It runs only in the worker, so tests tick the worker before reading the pipeline. There is
  no event for an identity review, a viva assessment or a proctor event: those recompute on "Refresh" and on the next
  attempt event (§6 already has Refresh).

### F22 — Global candidate mail cannot use the outbox; the mailer has no timeout and may be absent (minor, H1)

- **Design.** §1: the sign-in code is mailed directly through the mailer (no org → no outbox), with a timeout. S9:
  accounts inactive 3 years are erased, mail first. S19: fresh email code for account delete and offer answers.
- **Code.** `outbox.org_id` is `NOT NULL REFERENCES organisations` (`0006_invitations.sql:74`), so a mail about an
  account (not an application) cannot be queued. `Mailer` is `send({to, subject, text, html, attachments?})`
  (`delivery.ts:24-31`, `:59-61`); `SmtpMailer` has no timeout of its own (`delivery.ts:75-98`); the mailer is `null`
  when no SMTP URL is set (`main.ts:143`). Direct sends exist already (`onboarding.ts:218`, `:233`).
- **Change (H1).** All account mails (sign-in code, step-up code, account deleted, inactivity warning) are sent
  directly, wrapped in a 10 s timeout. The inactivity warning is sent by the global sweep (F4) and stamped
  `candidate_accounts.warned_at`; erasure happens 30 days after `warned_at`, and a failed send is tried again next
  sweep. With no mailer, candidate sign-in answers 503 `email_not_configured` and the job page says applying is not
  open. Tests pass a capturing mailer to `wire()` (`harness.ts:172`). Mail about an application goes through the
  outbox with that application's org.

### F23 — Reply-to and the "<Company> via Parikshaa" sender need two fields (minor, H2)

- **Design.** P14: `EmailMessage.replyTo`, job `contact_email`, sender "<Company> via Parikshaa".
- **Code.** `EmailMessage` has no `replyTo` or sender name (`delivery.ts:24-31`). `SmtpMailer` sets a fixed `from` and
  spreads the rest of the message into nodemailer (`delivery.ts:84-91`), so a `replyTo` field passes through once the
  type has it.
- **Change (H2).** Add `replyTo?: string` and `fromName?: string` to `EmailMessage`; `SmtpMailer` sends
  `from: { name: fromName, address: <EMAIL_FROM> }` when given. Hire mails set both.

### F24 — `HireScope`: copy the practice store's scope; never hand it to other stores (minor, H1 + H2)

- **Design.** §1 says a new scope kind in `ledger-store.ts`; S4 (binding) says `HireScope` lives in `hire-store.ts`
  and the ledger `Scope` is unchanged.
- **Code.** The template exists: `PracticeScope` and `scoped()` in `practice-store.ts:19-34` set `parikshaa.org_id`,
  `parikshaa.actor`, `parikshaa.attempt_id = ''` and `parikshaa.learner_id` through `sql.transaction(fn, settings)`,
  which applies them with `set_config(…, true)` (`sql.ts:23-36`). Every policy reads settings with
  `current_setting(…, true)`, so a setting that is not there is NULL and matches nothing; an `applicant` actor matches
  no existing actor policy, so tables without an applicant policy return no rows. But some policies are
  `USING (true)` for any actor in the org: `exams`, `attempts`, `audit_log`, `model_usage` (`0003_tenancy.sql:164-179`),
  `exam_windows` (`0006_invitations.sql:53`), `exam_lab` (0026), `result_releases` (0027).
- **Change.** §1's "new scope kind in `ledger-store.ts`" is struck (S4 wins). `HireScope` copies `scoped()` and adds
  `parikshaa.candidate_id`; it is used only by `hire-store.ts` and `candidate-store.ts`, never passed to `LedgerStore`
  or other stores (the `USING (true)` tables would answer it). `candidate_links` reads (no tenant policy, S2) set
  `parikshaa.org_id = ''`. A test shows an applicant scope reads nothing from `hire_screenings`.

### F25 — OpenAPI: new tags, the open-route list and a scheme (minor, H1 + H2)

- **Code.** `openapi.test.ts` lists every route without security by name (`:76-106`); the tag `Candidate` may hold only
  `/attempts/me*` and the invitation routes (`:127`); `Practice` and `Prep` have their own path rules (`:130-136`); the
  answer-key check covers routes tagged Candidate, Practice or Prep (`:141`). Schemes are declared in `server.ts`
  (`:343-356`: `staffAuth`, `attemptToken`, `learnerAuth`, …). Operator routes use `staffAuth`
  (`operator-routes.ts:26`).
- **Change.** H1: add the `candidateAuth` scheme (bearer `pc_…`) and a tag `Applicant` for `/candidate/*`, with a test
  line "every Applicant path starts with `/candidate/`"; add `Applicant` to the answer-key check. H2: tag `Jobs` for
  `/hire/public/*` (path rule likewise) and `Hiring` for staff `/hire/*`; add the public routes (job page, careers,
  report a job, sign-in code request and verify) to the open list with a comment saying what proves each.

### F26 — Resume text: the docx helper is too generous; there is no blind-index helper (minor, H1)

- **Code.** `paragraphsOf(file)` unzips `word/document.xml`, its rels and every image (`docx-import.ts:117-160`), with
  caps of 30 MB per entry and 60 MB in all (`:81`, `:126`), more than S1 allows (5 MB, 200 entries, 20 MB) and work a
  resume does not need. `fflate` is already a dependency (`packages/api/package.json`); `unpdf` is not. `DataKeys` has
  only `records(purpose)` (HKDF to a sealing key, `sealing.ts:79-80`); nothing derives an HMAC key for S20.
- **Change (H1).** Add `docxText(file, caps)` beside `paragraphsOf`, reading only `[Content_Types].xml` (for the sniff)
  and `word/document.xml`, with S1's caps, run in the S1 worker. Add `DataKeys.blind(purpose)`:
  `HKDF(kek, "parikshaa-blind", purpose)` → an HMAC function, used for the email, phone, resume and ref hashes (S20,
  F5).

### F27 — S6 aims at a load balancer the go-live does not use (minor, H1)

- **Design.** S6: `trustProxy` becomes a hop count / CIDR; ALB XFF handling fixed in `deploy/aws`.
- **Code (G0).** Production is Vercel → Caddy → API. Caddy passes only requests that carry the edge secret and trusts
  the forwarded address (`scripts/setup-server.sh:221-235`); Vercel sets `X-Forwarded-For` itself; the API has
  `TRUST_PROXY=true` (`main.ts:162`).
- **Change (H1).** S6 becomes: a test that a client-sent `X-Forwarded-For` does not change `request.ip`, plus a staging
  check through Vercel; `TRUST_PROXY` stays a boolean unless that check fails. Email-keyed limits stay primary.

### F28 — The model route lives in six places, two of them narrow signatures (minor, H2 + H5 + H6)

- **Design.** §1: `model_usage.route` gains `screen` and `drafts` (drop/re-add the CHECK, latest 0062), `schemas.ts`,
  viva `measure()` route type, `ledger-store.ts` route list.
- **Code.** The CHECK is in `0062_ai_assist.sql:5-6`. The union is repeated in `viva/src/usage.ts:19` (`ModelRoute`),
  `store/src/ledger-store.ts:1154`, `api/src/schemas.ts:777` and `console/src/api.ts:142` (already stale: it lacks
  `interview` and `assist`). Two call signatures are narrower still: `ExamService.authoring` accepts only
  `"author" | "grade" | "assess"` (`service.ts:288`) and `modelCall` only `"interview"` (`service.ts:305`).
- **Change.** H2's migration adds `screen` (so H3 needs none); H6's adds `drafts`. Each time: the CHECK, the four
  unions (fix the console one), and both signatures: `authoring` gets `screen` ("Screen again"), `modelCall` gets
  `screen` (auto-screen) and `assess` (F14).

### F29 — Migrations: the test lists every file; put all statuses in 0071 (minor, all slices)

- **Code.** `migrate.test.ts` checks the exact list of applied files (`:85-165`, `toEqual`, ends with
  `0069_code_timeline.sql`), and that every function in `public` sets its `search_path` (`:204-209`, rule from 0057).
  The last migration is 0069.
- **Change.**
  1. Each new file is added to that list in the same commit. Every SECURITY DEFINER function (S3's event blanking, F1's
     report filing, S11's counts if any) has `SET search_path = ''`.
  2. 0071 (H2) carries every status value the later slices need, so they need no ALTER: application status adds
     `invited`, `not_claimed` (P11), `joined`, `did_not_join` (P17); round result status adds `expired`, `abandoned`
     (P6); plus outbox kind `hire`, model route `screen` (F28), `organisations.verified_*` (F3), P3's role CHECKs.
  3. Expected numbers (taken when built, §1): H1 0070, H2 0071, H4 0072 (`interviews.status` adds `no_show`, F12),
     H5 0073 (`ai_interview_signals`, P8), H7 0074 (job reports, F1), H6 0075 (bank columns, route `drafts`).

### F30 — Bundle budget: name chunks with care and add entries with the chunk (minor, H7 + H8 + H9)

- **Code.** Every built file needs a pattern and every pattern must match a file, or the check fails
  (`scripts/bundle-budget.mjs:29-46`). In the web budget `??-*.js` (two lowercase letters: the locale chunks) would
  also claim a chunk named like `my-….js`. `Operator-*.js` is held to 4 KB (`bundle-budget.json`). The console entry is
  at 184 KB, the web entry at 142 KB.
- **Change.** H8 adds `Hiring-*.js` (and `.css`) in the PR that creates the chunk, not before; H9 names its chunk
  `HireApp` (capital letter, never a two-letter name) and adds `HireApp-*.js`. H7 puts Reports/Candidates in their own
  lazy chunk or raises `Operator-*.js` in the same PR. H5's P8 changes `AiInterview-*.js` (3 KB): check it.

### F31 — Console wiring and deep links (minor, H7 + H8)

- **Code.** A page needs a `View` member (`console/src/App.tsx:72-101`), a `tabs` entry with one permission string and
  a group (`:442-464`), and entries in `SECTION_OF` (`:1053`), `pageTitle` (`:1085`) and `PAGE_NOTE` (`:1151`).
  Navigation is state, not URL; the only deep link is `?report=<attempt>` read once at boot (`:240-247`). The
  operator's page is the view `companies` (`:992`).
- **Change.** H8: view `hiring` (tab "Hiring", `hire:review`, group assess, listed first when the org is a company),
  plus `?hire=<jobId>&application=<id>` read at boot the way `?report=` is, for manager mails and the digest (P13).
  H7: sections inside `OperatorPanel`, no new view.

### F32 — Wiring: the harness types its handler map; main.ts needs three loops (minor, H2–H4)

- **Code.** `Wiring.handlers` in the harness spells out each outbox kind (`testing/harness.ts:142`) and the map is built
  at `:496-497` (mirrors `assemble.ts:366-375`). `openapi.ts` builds every service over an unusable executor
  (`openapi.ts:105-120`). `main.ts` runs the delivery loop (`:184-195`) and the hourly retention loop (`:200-212`).
- **Change.** Each slice that adds a service adds it to `ServerOptions`, `assemble.ts`, `wire()` and `openapi.ts` in one
  commit; H2 adds `hire` to `Wiring.handlers`. `main.ts` gains: the screen loop (F8, H3), the Hire and account sweeps
  inside the retention loop (F4, H1/H2), and the 09:00 IST digest check in a 15-minute loop like `reminding`
  (`main.ts:246-254`) (P13, H4).

### F33 — Credits and spend cap: owner-only reads and an unset default (minor, H2 + H4)

- **Code.** `BillingService.summary` is for owners only (`#owner`, `billing.ts:145-146`); the store has
  `billing.account(scope)`. Neither signup nor the G1 operator sets `monthly_spend_cap_micro_usd`
  (`operator.ts:137-168`; column read in `service.ts:272-276`).
- **Change.** P4 (H4) reads credits through `BillingStore.account(staffScope(org))`, not `summary`. P1 (H2) applies
  `SIGNUP_SPEND_CAP_USD` in both `onboarding.signUp` and `OperatorService.create` (the operator may change it later).

## Checked and fits (no change needed)

- `InviteCodes.issue(orgId, invitationId)` (`invite-codes.ts:28-30`) works for portal links once Hire keeps the
  invitation id (F9); `InvitationService.link` (`invitation-service.ts:334`) wraps it into the URL.
- `AiInterviewService.link` and `InterviewService.link` are public methods (`ai-interview.ts:143`, `interviews.ts:163`);
  the `.ics` builder `calendar(interview, {now, join, forCandidate})` is an exported function (`interviews.ts:62`), so
  the portal can offer it after its ownership check.
- Result rows have percent, sections (id, title, score, max, percent), outcome, attempt id, duration and viva counts
  (`core/src/analytics.ts:19-56`): enough for §5 settle and §6 items 6, 7 and 10.
- `ProctorService.reviewIdentity` (`proctoring.ts:295`, `attempt:extend`, people only) serves P7's identity queue.
- `ProctorStore.open` reads photos from the database or from storage (G0, `object_key`, `proctor-store.ts:136-160`),
  so F14's store-level read works after the media move.
- Outbox kinds: CHECK last re-declared in `0052_interview_panel.sql:30-32`; TS unions at `outbox-store.ts:14` and `:22`.
  Model routes: CHECK last in `0062_ai_assist.sql:5-6` (F28 lists the TS places).
- Migration numbering: nothing above `0069_code_timeline.sql`; Hire starts at 0070 (§1 is right).
- G3 (Judge0) sits behind `CodeRunner`, so the reference run (F16) and code questions in Hire tests need nothing new.

## Overlap with the F1 go-live work on `main` (PR #47)

| Piece | Hire reuses | Hire must not build again | Change in HIRE-V2.md |
|---|---|---|---|
| G1 operator (`operator.ts`, `operator-routes.ts`, `Operator.tsx`, 0067) | Operators by env + second factor, `staffAuth`, 404 to others, audit in `audit_log` twice, Company ID, suspend/resume (sign-in, sessions, keys), credits, re-invite, the `companies` view | operator tables, `pko_` tokens, `admin-cli operator add`, an operator scope, `operator_audit`, `operatorAuth`, a separate sign-in, suspension of sessions/keys | F1 (S10/S11/§8), F2 (S12), F3 (verify columns in H2), F31 |
| G2 Library (`library.ts`, `library-routes.ts`, `library-content.ts`, 0068) and the reference run | `LibraryService.take/pick`, the `library:<id>` tag, `exposure`, `ExamService.checkReference`, `POST /questions/code/check` | a shared bank, a cross-org exposure counter, a second reference runner | F16 |
| G4 coding (0069, `core/src/timeline.ts`) | `ProctorService.playback`, `LARGE_PASTE`, the sealed timeline (erased with the attempt key) | a paste detector of its own | F19 |
| G5–G8 (not built) | — | a Hire-only proctoring preset, a second face detector | F20 |
| G0 deploy (Vercel + Caddy + VM, media in storage) | static pages with the shell fallback, the edge-secret proxy chain, store-level photo reads | server-rendered pages on Vercel (for now) | F7, F17, F27 |

## Build order

The order H1 → H2 → H3 → H4 → H5 → H7 → H8 → H9 → H6 → H10 holds: each slice can be built and tested on the API before
the next, with these changes.

1. **H2 must not wait on H7.** Move `organisations.verified_*` into 0071 (F3) and the Hire suspension effects into H2
   (F2). H7 then holds only the operator's actions (verify, reports, candidate lookup and erase) and the mail hold for
   `interview` mails.
2. **H2 queues no screening.** Auto-screen is off by default (P1/P16) and H2 has no screen handler; a queued item
   would be skipped and lost. H3 adds the enqueue together with its worker (F8).
3. **The drafts UI goes with H6.** §9 H8 lists "drafts in Bank", but the drafts API comes in H6, after H9. H6 builds
   its own Bank UI and its budget entry.
4. **Account delete is finished in H2.** H1's delete covers the account, profile, resume and sessions; H2d adds
   `HireErasure` and makes account delete erase the person's applications in every org (S3). H7's candidate erase
   uses the same function.
5. H5 changes the AI interview room in the web client (P8): it runs `build:clients` and `budget` too.

## Splits (one session each)

| Part | Builds | Tests on its own |
|---|---|---|
| H1a Accounts | 0070; `candidate-store.ts` with `HireScope` (F24); sign-in codes (S5), sessions (S19 server side), profile (sealed), export, account-only delete; `/candidate/*`, `candidateAuth`, tag `Applicant` (F25); `DataKeys.blind` (F26); global sweep (F4, F22); S24; S6 test (F27) | code limits and identical answers, session expiry, sealing, export, delete, forged XFF, nested `withScope` throws |
| H1b Resume | S1 worker: `unpdf` (pinned), `docxText` (F26), byte sniffing, caps, timeout kill; upload/download routes with `bodyLimit` | zip bomb, 5 000-page PDF, encrypted PDF, `.docm`, renamed `.exe`, worker killed at 10 s |
| H2a Jobs | 0071 with every status (F29), `verified_*` (F3), roles P3 (F6); `hire-store.ts`; jobs, rounds config, publish/pause/close; S7, S18 limits, S23, P1, P20; staff `/hire/*`; ACTIONS words | two-org isolation, role matrix, API key refused, unverified limits, protected-topic knockout refused |
| H2b Apply + portal | `/hire/public/*` (F7); S8 notice; apply with account, consent, snapshot, ref (F5), hashes, `candidate_links` (S2), S17, P9 hashes; suspension effects (F2); `hire-messages.ts` + `{later}` outcome; portal projection (S4); withdraw | applicant RLS, portal sees only its own, duplicates, limits, suspended org 404, apply after `apply_by` refused |
| H2c Pipeline | pipeline table read; move/reject/restore with the override rule; notes, events, bulk with counts; `reject_reason`; P14 thread, note to candidates, delayed rejection, reply-to/sender (F23); S21/S22 | events per move, override needs a reason, rejection mail cancelled on restore, viewer sees no contact data |
| H2d Privacy + import | `HireErasure` (S3), account delete hook, `HireRetention` (F4); P11 import, "Add one", claim on sign-in, `not_claimed` | full-database text search finds nothing after erase; retention for an org without privacy settings; claim flow |
| H3 Screening | `hire-screen.ts`, fake model branch, screen loop (F8), route `screen` (F28) | evidence check, server score, injection, stuffing, spend cap → `skipped`, no double screening |
| H4a Test round | F9, F10, P4, P5, P6; listener settle (F21); portal "Take the test" | invite → redeem → submit → grade → tick → round result; same exam across two jobs; extend; closing reminder skipped after start; out of credits |
| H4b Interview rounds | F11, F12, F13; 0072 (`no_show`); P10 reschedule and slots; review queue; `onSettled` | AI interview with fake model; two-person panel without the scheduler; reschedule keeps the UID |
| H4c Offers + close | `hire-offers.ts`, letter PDF, S13 with step-up (S19), expiry, hired, close-and-tell, P17, P13 digest and SLA (F32) | answer once, expiry on read, a GET changes nothing, filled → close |
| H5a Integrity engine | `hire-integrity.ts` on stores (F15); reasons with S14 caps; F18, F19, F20 table; P2 coverage; P9 org-wide; review verdict; recompute from the listener | one test per reason; `not_checked` vs `clear`; a model signal never `high` |
| H5b New signals + views | P7 `checkAsSystem` (F14) and identity queue; P8 room signals (0073, web room); overall score; compare; job report; similarity per job | automatic check on submit, spend-capped; P8 reasons `warn` only; compare of 4 |
| H7 Operator | F1, F2 (mail hold), verify actions, job reports, candidate lookup and erase, `OPERATOR_ALLOW_CIDRS` | report filed by the public function, read only by an operator; company sees the outcome only |
| H8a Console: jobs | Jobs list, editor, pipeline table, bulk actions, HirePath, `?hire=` deep link (F31), budget (F30) | component tests with a mock client |
| H8b Console: candidate | drawer and its tabs, compare, job report, identity queue, offer form | component tests |
| H9a Web: job + apply | `HireApp` (F7, F30), job page, careers, apply with code sign-in, title/noindex (F17) | component tests; budget |
| H9b Web: portal | `/my`: applications, detail with next actions, offer answer with step-up, profile, privacy (export, delete), phone notices (P12) | component tests at 360 px |
| H6 Drafts | F16, its Bank UI | approval gate, job test excludes drafts |
| H10 | e2e (P22 script), screenshots, docs, tracker | Playwright |

## Summary

| F# | Severity | Slice | One line |
|---|---|---|---|
| F1 | blocker | H7 | S10/S11's operator scope conflicts with G1; keep G1's staff-scoped operator, add CIDRs and candidate-read audit; job reports via an operator-only table |
| F2 | important | H2, H7 | G1 already does S12's sign-in part; Hire effects move to H2; worker needs a `{later}` outcome to hold mail |
| F3 | important | H2 | `verified_*` columns needed by H2's limits; move to 0071 |
| F4 | important | H1, H2 | retention hook runs only with privacy settings; own Hire and account sweeps |
| F5 | important | H2 | ref from candidate id fails for imports; derive from the canonical email hash |
| F6 | important | H2 | `hiring_manager` with `attempt:*` sees every exam; give it hire permissions only |
| F7 | important | H2, H9 | API paths must not start with `/jobs`, `/careers`, `/my` |
| F8 | important | H3 | screening on the mail worker passes the 120 s lease; own loop |
| F9 | important | H4 | `inviteMany`: per-call window, ids back, de-dupe, per-invitation extend |
| F10 | important | H4 | `reminder_closing` would be sent as an invitation; teach the worker; company wording |
| F11 | important | H4 | AI interview: JD ≤12 000 (DB CHECK), resume ≤20 000 |
| F12 | important | H4 | `schedule` puts the scheduler on the panel; `includeScheduler`; needs `attempt:review` |
| F13 | important | H4 | viewers see resumes via the AI interview list; hide it |
| F14 | important | H5 | no system path for the face check; `checkAsSystem` |
| F15 | important | H5 | per-exam reports are actor-bound and O(n); read stores per attempt |
| F16 | important | H6 | drafts on top of the Library and reference run; `source` gets `library` |
| F17 | important | H9 | no server to render job-page meta on Vercel; defer |
| F18–F33 | minor | various | viva confirmation, large paste, G5–G8 room, listener, direct mail, mail fields, scope, OpenAPI, docx, S6, routes, migrations, budget, console, wiring, credits |

<!-- complete -->
