## Exists today

**Tables** (all RLS: a RESTRICTIVE `tenant_isolation` policy on `org_id` plus a staff-only policy, `parikshaa.actor='staff'`)
- `packages/store/migrations/0029_students_drives.sql`
  - `students`: PK (org_id, ref). `ref` is the roll number. Also name, email, phone, branch, batch, cgpa, backlogs.
  - `drives`: org_id, id, company (free text), role, ctc_lpa, location, description (the JD, up to 20k chars), eligibility jsonb `{minCgpa,maxBacklogs,branches[],batches[]}`, apply_by, exam_id (**one** exam), status open/closed.
  - `drive_applications`: PK (org_id, drive_id, student_ref). `stage` is a CHECK enum: applied, test, interview, offered, joined, rejected, withdrawn. Also offer_lpa and updated_by.
- `0034_drive_apply.sql`: adds `drives.apply_code`, `drives.open_to_new` (off-campus) and `students.self_registered`.
- `0038_drive_colleges.sql`: `drive_colleges` (name, code `^[A-Z0-9]{2,12}$`, apply_code) and `students.college`.
- `0039_offers.sql`: offer fields live on `drive_applications`: offer_code, offer_sent_at, offer_response accepted/declined, offer_responded_at, joining_date, offer_note.
- `0048_seal_records.sql`: `students.email` and `students.phone` are stored **sealed**, so the size checks are loosened.
- `0049_student_messages.sql`: outbox kind `student`.
- Related tables:
  - `0036_interviews.sql`: `interviews.drive_id` (a nullable link that nothing uses).
  - `0052_interview_panel.sql`: panel and `interview_scores`.
  - `0032_shortlists.sql`: shortlists are per **exam_id**, not per drive.
  - `0063_organisation_kind.sql`: `organisations.kind` is institution or company.

**Store**: `packages/store/src/placement-store.ts`
- Types: `Student`, `Eligibility`, `DriveDraft`, `STAGES` (l.55), `Drive`, `DriveCollege`, `Application`, `Offer`. `eligible()` is at l.191.
- `PlacementStore` methods:
  - Students and drives: `students` (full scan, unseals every row), `refs`, `upsert`, `remove`, `drives`, `drive`, `saveDrive`.
  - Apply links and colleges: `setApply`, `driveByCode`, `addCollege`, `colleges`, `removeCollege`, `driveByCollegeCode`.
  - Offers: `sendOffer`, `offerByCode`, `respondToOffer`.
  - Applications: `register`, `applications`, `addApplications`, `setStage`.
- Every method goes through `withScope(sql, staffScope(orgId))`. Email and phone are sealed with AAD `students/{org}/{ref}/{field}` (l.114).

**Service**: `packages/api/src/placement.ts` (`PlacementService`, l.102)
- All staff methods require the `attempt:review` permission (l.149).
- Students: `importStudents` (dry run, then all-or-nothing, via `packages/api/src/student-import.ts`, which maps CSV column aliases).
- Drives: `createDrive`/`updateDrive` (`#check`). `drive()` (l.253) joins applications, exam results (`ResultsService`), colleges, offer figures and the funnel.
- Moving students: `addStudents` (named refs or all eligible), `setStage` (bulk). `sendTest` (l.448) calls `InvitationService.inviteMany(examId, …, {drive:id})` and moves those at applied to test.
- Offers: `sendOffer` (l.326) stores a random 12-byte code and queues the email/WhatsApp. `alertEligible` messages eligible students who are not in the drive yet.
- Public side:
  - `publicDrive`/`apply` (l.613/643): the code is `orgId.code`, or `c_…` for a partner college.
  - `status` (l.681): an HMAC-signed link, nothing stored.
  - `offerView`/`respondToOffer`: the candidate can answer once.
- Reports: `readiness`, `placementReport`/CSV, `exportCsv`. Every mutation calls `this.#exams.recordAudit(actor, "drive.*", …)`.
- `packages/api/src/funnel.ts`: `funnelOf()` ranks the stages; rejected/withdrawn count as dropped.
- `packages/api/src/student-messages.ts`:
  - `queueOffer` and `queueDriveAlert` queue drafts of `kind:'student'` whose subject holds only driveId/ref/code/channel.
  - `deliver()` writes the message only when it is sent, and skips it if the offer was replaced or the drive closed.
  - It is wired in `packages/api/src/assemble.ts:146,166,309,354`.

**Routes**: `packages/api/src/placement-routes.ts`, registered at `server.ts:1341`

Staff routes (bearer token, `staff(request, reply, "attempt:review")`):

| Method | Path | Line |
|---|---|---|
| GET | `/students` | l.94 |
| POST | `/students/import` | l.112 |
| DELETE | `/students/:ref` | l.141 |
| GET | `/placement/readiness` | l.161 |
| GET | `/placement/report` | l.189 |
| GET | `/placement/report.csv` | l.225 |
| GET, POST | `/drives` | l.235, l.245 |
| PUT, GET | `/drives/:driveId` | l.264, l.274 |
| POST | `/drives/:id/students` | l.315 |
| POST | `/drives/:id/stage` | l.336 |
| POST | `/drives/:id/send-test` | l.357 |
| POST | `/drives/:id/apply-link` | l.378 |
| POST | `/drives/:id/colleges` | l.398 |
| DELETE | `/drives/:id/colleges/:collegeId` | l.418 |
| POST | `/drives/:id/offers` | l.438 |
| POST | `/drives/:id/alert` | l.463 |
| GET | `/placement/funnel` | l.483 |
| GET | `/drives/:id/students.csv` | l.664 |

Public routes (no auth; the code in the link is the proof; each one checks `throttle.blocked(ip, "status"|"offer"|"apply")`):

| Method | Path | Line |
|---|---|---|
| GET | `/status/:code` | l.501 |
| GET | `/offers/:code` | l.536 |
| POST | `/offers/:code/response` | l.573 |
| GET | `/apply/:code` | l.610 |
| POST | `/apply/:code` | l.632 |

**Console**
- `packages/console/src/components/Placement.tsx`:
  - `PlacementPanel` (l.57) has tabs Drives, Students, Funnel, Readiness, Year-wise report.
  - Drive pieces: `DriveForm` (l.386), `DriveView` (l.538) with bulk stage moves and a copy-status-link button, `SendTest` (l.771), `ApplyLink` (l.925).
- `packages/console/src/components/DriveNetwork.tsx`: `Colleges` (l.21), `Offers` (l.103), `FunnelCard` (l.242), `FunnelTable` (l.282).
- Mounted lazily in `packages/console/src/App.tsx:64,927`. The nav entry is "Placement", in the assess group, behind `attempt:review` (l.439).
- `packages/console/src/components/Home.tsx:716` `HirePath` (shown when kind=company) has four steps: role → invite → results → shortlist. **It does not mention drives.**
- `packages/console/src/components/JobTest.tsx`: a JD or role becomes an exam built from the bank (`packages/api/src/job-test.ts`; the model never writes questions).
- Client methods: `packages/console/src/api.ts:1844-1950`.

**Web** (query-string routing in `packages/web/src/App.tsx:127-168`: `?apply=`, `?offer=`, `?status=`; each page is lazy-loaded from `packages/web/src/components/PublicPages.tsx`)
- `ApplyPage` (l.417): roll number and email. With openToNew it also asks name, phone, branch, batch, CGPA and backlogs.
- `OfferPage` (l.704) and `StatusPage` (l.831). The pages are English only.

**Data flow**
1. Staff creates a drive, imports or adds students (eligibility is filtered in JS), and opens the apply link.
2. The public `/apply` upserts a self-registered student and adds an application at stage applied. It returns the status link.
3. `send-test` sends exam invitations through the normal invitation outbox. The graded results come back into `drive()` through `ResultsService` (`test.percent`).
4. Manual `setStage` moves people forward. `sendOffer` queues the offer by email/WhatsApp; the candidate answers on `/offers/:code`. The funnel and offer figures are computed when read.

## How it maps to the target flow

1. **Post a job.** Partial. A drive has company, role, CTC (LPA), location, JD, apply_by and status. It has **no** skills, experience range, openings or screening questions. Eligibility is college-shaped (CGPA, backlogs, branch, batch). `company` is free text because the model assumes a college org hosting a visiting company. There is no careers page that lists an org's open jobs, and the company-kind home page never leads to drives.
2. **Candidates apply and track.** Partial. A public per-drive link exists, and off-campus is supported (`open_to_new`). The form collects only roll number, email, name, phone, branch, batch, CGPA and backlogs. There is **no resume upload, no screening answers, no profile, and no candidate account**: identity is a per-org roll number (`ref`), which an off-campus applicant does not have. Tracking is one signed link per application. There is no single place where a candidate sees all their applications.
3. **AI screening.** Missing. There is no resume text to score and no score column on `drive_applications`. The only filtering is the deterministic `eligible()`. The "AI suggests, human decides" pieces live elsewhere: `job-test.ts` and the AI assist flow.
4. **OA link by email.** Mostly works. `sendTest` invites through the existing invitation outbox (email/SMS/WhatsApp) on the exam's window. The test comes from `JobTestDrawer`, built from the org's own bank. Gaps:
   - A drive has a single `exam_id`.
   - There is no "fresh variant per drive".
   - There is no AI drafting of new questions inside the job flow; `job-test.ts` deliberately never writes questions.
5. **Proctoring and detection.** Exists at the exam level (proctoring, `packages/api/src/proxy.ts`, `/exams/:id/proxy-report`). Integrity signals are **not** surfaced in `DriveDetail`; only percent and outcome are.
6. **Integrity-aware shortlist.** Missing in drives. Shortlists (`packages/api/src/shortlists.ts`) are per exam with a hiring-manager link, separate from drive stages; a decision there does not move a drive stage. There is no combined score (test, proxy flags, screening, eligibility).
7. **Rounds to the offer.** Partial:
   - The stages are a fixed 7-value enum with one generic "interview" bucket. There is no rounds table, so you cannot define N rounds per job.
   - `interviews.drive_id` exists, but the console Interviews UI never sets it, and completing an interview does not advance the stage. AI interviews have no drive link.
   - Offers are solid: link, accept/decline once, joining date, not-joined count, and email/WhatsApp delivery. There is no offer letter document, no expiry, and no revision history; resending erases the earlier answer.
   - Tracking on both sides: the company has DriveView and the funnel; the candidate has StatusPage, which shows the stage only (no round names, no test or interview schedule).
8. **Admin.** Org staff only, with every action gated on `attempt:review`. There is no platform-admin view across companies, no per-job recruiter or hiring-manager role, and no job-level team.

## Extension points and conventions

- **New table.** Copy `0038_drive_colleges.sql`: composite PK `(org_id, id)`, a RESTRICTIVE `tenant_isolation` policy plus a `<table>_staff` policy, and `GRANT … TO parikshaa_app`. Numbering is at 0065. Two migrations sharing a number already exist, so pick 0066+. A new outbox kind needs the CHECK constraint dropped and re-added (see `0049_student_messages.sql`, `0052_interview_panel.sql`).
- **Store.** Copy `placement-store.ts`: a class over `SqlExecutor`, every query inside `withScope(this.#sql, staffScope(orgId), tx => …)`, and an explicit `org_id = $1` in each query. For PII, take `RecordSeal` (`keys.records("<name>")` in `assemble.ts:146`) and seal/open with an AAD string.
- **Service.** Copy `PlacementService`: inject `now`/`newId`, have a `#require(actor)` permission gate, throw `AttemptError("not_found"|"invalid_state")`, and call `this.#exams.recordAudit(actor, "<noun>.<verb>", target, detail)`. Add a readable audit label in `Home.tsx:87-108`.
- **Routes.** Copy `placement-routes.ts`:
  - Use `registerXRoutes(routes, deps)` with Zod schemas, `tags`, `security: SECURED`, and the `refusals` map.
  - Public routes copy the `/apply/:code` pattern: throttle `blocked`/`failed` and a code shaped `orgId.secret`.
  - Register the module in `server.ts` (~l.1341), wire it in `assemble.ts`, and add a stub in `packages/api/src/openapi.ts:109`.
- **Email and WhatsApp.** Copy `student-messages.ts`: queue `OutboxDraft`s with ids only and write the message at `deliver()`. Register the handler in the `assemble.ts:354` map.
- **Signed links with nothing stored.** Copy `statusLink`/`#statusMac` in `placement.ts:670-706`.
- **AI.** Copy `job-test.ts`, which uses `zodOutputFormat` from the Anthropic SDK. Tests use `fakeModel` (`packages/api/src/fake-model.ts`). A 402 means the spend cap was reached (`JobTest.tsx:17`).
- **Tests.** Copy `packages/api/src/placement.test.ts`: PGlite `freshDatabase()`, `wire(...)` with `fakeModel`, `SET ROLE parikshaa_app`, two orgs to prove isolation, and `app.inject`. Console tests sit beside the component (`Placement.test.tsx`, `DriveNetwork.test.tsx`). Screenshots: `packages/e2e/screenshots/hire-campus.shots.ts`.
- **Web public page.** Add an export in `PublicPages.tsx`, lazy-import it, and route on a query param in `web/src/App.tsx:127-170`. i18n: candidate pages use `packages/web/src/i18n.tsx` and `locales/`, but the PublicPages are English by design.
- **Process (from CLAUDE.md).** Update `docs/PREP-TRACKER.md` (plan entry, status rows, build log). Run `npm run check`, `npm run build:clients`, `npm run budget`, and `npm run openapi` to regenerate `docs/openapi.json`.

## Risks / gotchas

- **The data model is college-first.** The tenant is the college, `company` is a text column, and the candidate key is the roll number. A company Hire flow needs a candidate identity keyed by email or a generated id, not `ref`. A new `jobs` / `job_applications` / `candidates` model is cleaner than stretching `drives`. Otherwise the TPO features (eligibility, readiness, year-wise report, colleges) get tangled with Hire.
- **Sealed email and phone.** You cannot query or index by email. `apply()` loads and unseals **every** student in the org on every apply (`placement.ts:650`), as do `sendOffer` and `deliver`. This is O(n) per request. Any lookup by email needs a separate keyed hash column.
- **RLS is staff-only.** Public routes run under `staffScope(orgId)` with the orgId parsed from the URL code. Any new public or candidate route must validate its code before touching the store; RLS will not stop a forged org prefix.
- **Permissions are too wide.** Every placement action, including send offer and stage moves, needs only `attempt:review`, which the **viewer** role has (`packages/api/src/staff-auth.ts:106`). Hire needs distinct permissions such as job:write and offer:send.
- **Stages are a DB CHECK enum** (`0029`) mirrored in `STAGES`, `funnel.ts` RANK, console `DRIVE_STAGES` and Zod. Adding rounds means changing all five, or moving to a rounds table.
- **Offers.** Resending wipes `offer_response`. `setStage` nulls `offer_lpa` on any non-offer stage. `respondToOffer` is final; changes go through staff.
- **Status links.** They are HMAC of `secret` (`placement.ts:135`): rotating `o.secret` breaks every status link, and links cannot be revoked one by one.
- **Throttle.** It reuses `LoginThrottle` keyed (ip, "apply"/"offer"/"status") and counts failures only.
- **Invitations.** `sendTest` needs `attempt:start` too. It fails if the exam's window has closed, and it skips anyone already invited to that exam (so you cannot reuse an exam across jobs for the same person).
- **Bundle budget** (`bundle-budget.json`): console `Placement-*.js` is limited to 11 KB gzip and web `PublicPages-*.js` to 7 KB. New Hire screens should be their own lazy chunks with their own budget entries.
- **OpenAPI.** `packages/api/src/openapi.ts` builds services against an `unusable` executor, so every new service needs a stub there or `npm run openapi` breaks.
- **Outbox kinds.** These are a CHECK constraint; each new kind needs a migration.
- **Not built per the tracker:** CO11 take-home, CO24 side-by-side comparison, CO16 talent pool, voice viva for proxy detection (CO19 is 🟡), and "AI-drafted questions" (decided against: the model never writes questions). A design using AI-drafted questions would go against a recorded decision in `docs/PREP-TRACKER.md` ("Faisle", l.304) and needs the owner's sign-off.