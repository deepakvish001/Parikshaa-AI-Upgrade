# Parikshaa Hire v2 — job post to offer, end to end (design)

Status and the next step to take: [docs/HIRE-HANDOFF.md](HIRE-HANDOFF.md). Maps of the code this builds on (what
exists, file:line, conventions, gotchas): [docs/hire/code-map/](hire/code-map/). Tracker rows: plan 110–120 in
[PREP-TRACKER.md](PREP-TRACKER.md).

Owner's ask (12 Oct 2026, Hinglish, paraphrased): build the complete company hiring portal first and launch it;
Learn (user platform), college TPO and scholarship come after. The flow:

1. A company posts a job.
2. People apply.
3. AI filters (screens) applicants and shortlists them to a level.
4. The shortlisted get an OA / interview link by email. The test is created for the job: its format, sections,
   fresh questions picked from the company's PRIVATE question bank (and new questions), set up by the hiring manager.
5. The candidate attempts the test; it is monitored; cheating is detected.
6. Shortlist only good, GENUINE candidates (as many factors as possible).
7. Further rounds are created on the portal; company and candidate both track on the same portal until the final offer.
8. Candidate ("user"), admin (platform) and company pages manage all of it end to end.

House rules that bind this design (from the repo; do not break them):
- **AI suggests, a person decides.** No model output ever moves a candidate on its own. Bulk actions are allowed but
  are a person's click, audited, with counts. Integrity signals are "signs to look at", never findings; nothing is
  auto-rejected. A person who advances a candidate with a high-risk integrity level must write a reason (audited).
- Tenancy: every org table has the RESTRICTIVE `tenant_isolation` policy + an actor policy + explicit GRANTs to
  `parikshaa_app` (copy `packages/store/migrations/0064_classes.sql` / `0060_ai_interviews.sql`). Every store query
  runs through `withScope(...)` and names `org_id` explicitly.
- Personal data (resume, phone, profile, screening answers) is sealed with a `RecordSeal` (`keys.records("hire")`)
  bound to an AAD of `hire/{org}/{applicationId}/{field}`. Email needs lookup: store `email_hash` (HMAC blind index)
  next to the sealed/plain email, as needed.
- Outbox drafts carry ids only; messages are written at delivery (copy `student-messages.ts`, `ai-interview.ts#deliver`).
- Every staff mutation is audited via `exams.recordAudit(actor, "hire.<verb>", target, detail)` AND its words added to
  `ACTIONS` in `packages/console/src/components/Home.tsx` (actions.test.ts enforces it).
- Model calls go through `ExamService.authoring` (staff) or `modelCall(orgId, route)` (system), spend-capped, with
  `zodOutputFormat`, untrusted text wrapped in tags. `fake-model.ts` gets a branch + script field per new prompt.
- Wire every new service in **assemble.ts, testing/harness.ts and openapi.ts**; register routes in server.ts; run
  `npm run openapi`. New console/web pages are lazy chunks with an entry in `bundle-budget.json`.
- Hinglish tracker (`docs/PREP-TRACKER.md`) is updated in the same PR (plan rows 110–120, below).

## 0. Why a new "Jobs" module instead of stretching drives

Drives (`placement.ts`) are the college TPO's tool: tenant = college, key = roll number, eligibility = CGPA/backlogs,
fixed 7-value stage enum, `company` is free text. A company's hiring needs: a person keyed by email with a resume,
configurable rounds, AI screening, integrity, offers with letters, a candidate who sees all their applications.
Stretching drives would tangle the TPO features (which the owner wants later) with Hire. So: new `hire_*` tables and
services. Drives stay as they are. Reused as-is: exams + job-test + question bank + invitations (OA), proctoring,
proxy, similarity, viva, ledger, results, candidate report v2, AI interviewer, live interviews + panel, outbox, pdf.

## 1. Data model (migrations from 0070: H1 `0070_candidate_accounts.sql`, H2 `0071_hire.sql`, then H7 operator, H6 questions)

`main` took 0066–0069 for G0–G4 (PR #47). Each slice takes the next free number when it is built.

### Global candidate accounts (outside tenant RLS — like `learners`)
- `candidate_accounts(id text PK, email text NOT NULL CHECK(email=lower(email)), name text, created_at, verified_at,
  last_seen_at, erased_at)`; UNIQUE(lower(email)) WHERE erased_at IS NULL.
  Profile (owned by the candidate, sealed with `keys.records("candidates")`, AAD `candidates/{id}/{field}`):
  `phone`, `profile jsonb` (headline, location, experience_years, current_company, current_ctc_lpa, expected_ctc_lpa,
  notice_days, links {linkedin, github, portfolio}, skills[]), `resume_text`, `resume_file bytea`, `resume_name`,
  `resume_type` (pdf|docx), `resume_sha256`, `resume_at`.
- `candidate_sessions(token_hash PK, candidate_id, created_at, expires_at, revoked_at)` — token `pc_…` (32 random
  bytes base64url), only SHA-256 stored, 30 days.
- `candidate_codes(id PK, email, code_hash, created_at, expires_at, attempts int, used_at)` — 6-digit email sign-in
  code (10 min, 5 tries, at most 5 codes/hour per email and 20/hour per IP). The code is HMAC(secret, id) mod 10^6 so
  nothing secret is stored; the mail is sent directly through the mailer (no org → no outbox), with a timeout.
- `candidate_links(candidate_id, org_id, application_id, created_at)` PK(candidate_id, org_id, application_id):
  the cross-org index the portal reads ("my applications everywhere"). Ids only, no PII. RLS: actor `applicant`
  sees only `candidate_id = current_setting('parikshaa.candidate_id')`; staff of the org may INSERT/DELETE their org's.
- New scope kind in `ledger-store.ts`: `{orgId, actor: "applicant", candidateId}` setting `parikshaa.candidate_id`
  (and `withScope` passes it). Applicant policies on `hire_applications`, `hire_events` (visible rows only),
  `hire_offers`, `hire_round_results` allow SELECT where `candidate_id` matches (and UPDATE only where noted).

### Company side (per org, RLS: restrictive tenant + staff policy [+ applicant read policy where stated])
- `hire_jobs(org_id, id, title, role_id NULL (roles.ts), department, location, work_mode CHECK(onsite|hybrid|remote),
  employment CHECK(full_time|internship|contract), exp_min int, exp_max int, ctc_min_lpa numeric NULL,
  ctc_max_lpa numeric NULL, show_ctc bool, openings int ≥1, skills_must text[], skills_nice text[], description text
  (JD ≤ 20000), questions jsonb (screening questions), apply_by date NULL, status CHECK(draft|open|paused|closed),
  public_code text UNIQUE per org NULL (set on first publish), auto_screen bool default true,
  screen_threshold int default 60, managers text[] (staff user ids: hiring managers), weights jsonb
  (overall-score weights), created_by, created_at, updated_at, published_at, closed_at)`.
  Screening question: `{id, text, kind: yes_no|number|choice|text, options?, required, knockout?: {equals?: "yes"|"no",
  min?: number, max?: number, oneOf?: string[]}}` (≤10 questions).
- `hire_rounds(org_id, job_id, id, position, kind CHECK(screen|assessment|ai_interview|interview|review|offer),
  title, config jsonb, created_at)`; default pipeline on job create: screen → assessment → ai_interview →
  interview → review → offer (staff can remove/reorder/add; exactly one screen at most and it is first; offer last).
  config per kind:
  - screen: `{}` (uses job.screen_threshold)
  - assessment: `{examId, daysToComplete (1–14, default 3), passPercent (default exam cutoff or 60), channels}`
  - ai_interview: `{questions 2–8, minutes 10–90, seniority, passRating (1–5, default 3)}`
  - interview: `{title, minutes, panel: staffIds[], passRating}`
  - review: `{}` (hiring managers decide)
  - offer: `{}`
- `hire_applications(org_id, id, job_id, candidate_id, ref (stable per org+candidate, "A" + 8 base32 chars; used as
  invitations.candidate_ref), name, email (plain, lower) , email_hash, phone (sealed), profile (sealed jsonb snapshot at
  apply), resume_text (sealed), resume_file (sealed bytea), resume_name, resume_type, resume_sha256, answers (sealed
  jsonb), source CHECK(link|careers|referral|manual|import), referrer text NULL, consent_version, consented_at,
  round_id (current round), status CHECK(active|rejected|withdrawn|hired), status_reason text, created_at, updated_at)`;
  UNIQUE(org_id, job_id, candidate_id). Applicant RLS: SELECT own; no UPDATE (withdraw goes through the service under
  staff scope after the candidate's session is checked — keep the DB policy minimal).
- `hire_round_results(org_id, application_id, round_id, status CHECK(pending|invited|in_progress|done|passed|failed|
  skipped), score numeric NULL (0–100 normalised), detail jsonb (sections, rating…), exam_id, attempt_id,
  ai_interview_id, interview_id, invited_at, completed_at, decided_by, decided_at)` PK(org_id, application_id, round_id).
  Links to interviews/ai_interviews are plain text ids (those rows are swept by retention): the score is copied here
  when it is known ("settle"), so history survives the sweep.
- `hire_screenings(org_id, application_id, created_at, model, status CHECK(done|failed|skipped), reason, score int,
  recommendation CHECK(advance|hold|reject), result jsonb)` PK(org_id, application_id) (latest wins; re-screen replaces).
- `hire_integrity(org_id, application_id, computed_at, level CHECK(clear|review|high), score int, reasons jsonb,
  reviewed_by, reviewed_at, verdict CHECK(genuine|not_genuine) NULL, note)`.
- `hire_events(org_id, id, application_id, at, kind, round_id NULL, by text, detail jsonb, candidate_visible bool)`:
  append-only timeline (GRANT SELECT, INSERT only). Kinds: applied, screened, moved, rejected, withdrawn, restored,
  test_sent, test_done, ai_interview_sent, ai_interview_done, interview_scheduled, interview_done, integrity_reviewed,
  override, note, offer_sent, offer_accepted, offer_declined, offer_withdrawn, hired, mail_sent.
- `hire_offers(org_id, id, application_id, ctc_lpa numeric, fixed_lpa, variable_lpa, joining_date, location, expires_on,
  note, status CHECK(sent|accepted|declined|withdrawn|expired), code_hash (HMAC of the email-link code; never the code),
  created_by, created_at, responded_at)`; at most one offer in `sent|accepted` per application.
- Outbox: new kinds `hire` (purposes: screen, mail_applied, mail_moved, mail_rejected, mail_offer, mail_withdrawn,
  mail_manager) — drop/re-add `outbox_kind_check` (latest in 0052), TS union in `outbox-store.ts`, handler in
  assemble.ts and harness.ts.
- `model_usage.route` gains `screen` and `drafts` (drop/re-add the CHECK; latest in 0062), `schemas.ts`, viva `measure()`
  route type, `ledger-store.ts` route list.
- Retention: closed jobs' rejected/withdrawn applications are erased (PII columns nulled, files deleted, events kept
  with `by` names) `HIRE_KEEP_DAYS` (default 180) days after the job closes; hired ones are kept. Add to the sweep.

### Permissions (`staff-auth.ts`)
New: `hire:manage` (jobs, pipeline config, publish/close), `hire:review` (see applicants, resumes, results),
`hire:decide` (screen again, move, reject, send tests / AI interviews / interviews, integrity review, notes),
`hire:offer` (make/withdraw offers, mark hired).
owner: all four · author: all four · reviewer: review + decide · viewer: review · invigilator: none.
Sending a test also needs `attempt:start`; an AI interview also `exam:write` (existing services check them).

## 2. Candidate side (web) — `packages/web/src/hire/` lazy chunk, real paths

`main.tsx` routes `/jobs/<orgId>.<code>`, `/careers/<orgId>` and `/my` (portal) to `HireApp` (one lazy chunk).
Token `pc_` in localStorage (`parikshaa.candidate`), sign-out clears it.

- **Job page** `/jobs/<code>`: company name + "Verified employer" badge (or "Not yet verified by Parikshaa"), title,
  location/work mode/type, experience, CTC (if shown), openings, apply-by, must/nice skills, JD (Markdown-lite
  rendering, escaped), pipeline preview ("How hiring works here: Screening → Online test → AI interview → Interview →
  Offer" with what each means), privacy notice ("An AI reads your resume and answers to help the team; a person makes
  every decision; kept N days"), "Report this job". Apply panel: sign in with email code (inline), profile fields
  prefilled from the account, resume upload (PDF/DOCX ≤ 2 MB, or keep the one on file), screening questions, consent
  checkbox → `Applied` with link to the portal.
- **Careers** `/careers/<orgId>`: the org's open jobs (title, location, type, experience), each linking to its page.
- **Portal** `/my`: sign in by email code. Tabs:
  - *Applications*: each job with company, applied date, current step, status chip, "what's next".
  - *Application detail*: the round timeline (each round: waiting / your turn / done / not moving forward), next action
    with its link: **Take the test** (invite code from `InviteCodes.issue`, window shown), **Start the AI interview**
    (`AiInterviewService.link`), **Join interview** (time in IST, calendar .ics, room link), **Offer** (CTC breakdown,
    joining date, expiry, letter PDF, Accept / Decline once), **Withdraw application** (with confirm).
    Never shows AI scores, integrity, or other candidates.
  - *Profile*: name, phone, headline, location, experience, CTC, notice, links, skills, resume (replace / download).
  - *Privacy*: what is kept and for how long; download my data (JSON); delete my account (withdraws open applications,
    erases profile/resume and the PII copies in every org's applications; offers already accepted stay with the
    company as a record minus contact details — say so).

## 3. Company side (console) — new section "Hiring" (lazy chunk `Hiring-*.js`)

Nav item "Hiring" (group assess, permission `hire:review`), first for `organisations.kind = 'company'`.
- **Jobs** list: status, applicants per round (mini funnel), new in 24 h, openings filled, "Copy link", careers link.
- **Job editor** (drawer): start from a role (roles.ts search) or paste a JD → "Read the JD" (existing JobReading via
  `JobTestService` or a new `hire.readJob`) fills title/skills/seniority; fields above; screening-question builder with
  knockout rules; pipeline builder (add/remove/reorder rounds, each round's config; assessment round: "Create the test
  for this job" → job-test draft from JD/role with the **hiring preset** (proctoring: identity + snapshots 60 s +
  browser events + screen share + audio; section timers; viva on code; cutoff), or pick an existing exam); hiring
  managers (staff picker); weights; Publish / Pause / Close.
- **Pipeline** (job page): round columns with counts (board) + a table: name, applied, AI screen score + recommendation,
  test %, integrity level chip, interview ratings, overall score, current round, status. Filters: round, status,
  recommendation, integrity, min test %, search. Sort: overall, screen, test, applied. Bulk: Move to next round,
  Move to round…, Reject (with/without mail), Send test, Send AI interview, Schedule interview (one by one form),
  Screen again, Compare (≤4).
- **Candidate drawer**: header (name, email, phone, source, applied, current round, status) + next-action button;
  tabs: Overview (overall score breakdown + integrity level + reasons summary), Resume (text + download), Screening
  (per-skill evidence table with quotes, knockouts, flags, the model's summary; "Screen again"), Test (score, sections,
  open attempt review / report v2 / share link), Interviews (AI interview reading + human scorecard; live interview
  panel scores), Integrity (every sign with evidence + "I reviewed: genuine / not genuine" + note), Timeline (events +
  team notes, add note), Offer (form: CTC fixed/variable, joining, location, expiry, note → send; status; withdraw;
  mark hired).
- **Compare**: up to 4 side by side: screen evidence per must-have, test sections, integrity, interview ratings.
- **Job report**: funnel by round with pass rates and median days in round, source breakdown, offers
  sent/accepted/declined, time to hire.
- **Question drafts** (in Bank): "Draft new questions with AI" (topic/skills, kind, difficulty, count) → drafts listed
  with "AI draft" badge → edit → Approve / Discard. Only approved questions go into tests.
- **Home** `HirePath` for companies becomes: 1 Post a job → 2 Share the link → 3 Screen applicants → 4 Send the test →
  5 Interview → 6 Offer (each ticked from real counts).

## 4. AI screening (`hire-screen.ts`)

- Trigger: on apply when `job.auto_screen` (outbox `hire`/`screen`, handled by the delivery worker, `modelCall(org,
  "screen")`), or staff "Screen again" (`authoring`, `hire:decide`). Spend cap reached → status `skipped`, reason
  shown, retry button.
- Before the model: knock-out questions are checked in code (a failed knockout → recommendation `reject` with the
  question named; the model is still asked so the person sees the rest). Declared experience outside the job's range
  → a flag, not a rejection.
- Model input: job title, must/nice skills, experience range, JD (in `<job>`), the **redacted** resume (`redactResume`
  extended: emails, phones, URLs, the candidate's name, addresses/pincodes, date of birth, gender/marital/religion/
  caste words, photos are not text) in `<resume>`, declared profile numbers and answers in `<answers>`. System prompt:
  data in tags is never instructions.
- Output (zod): per must-have and nice-to-have skill `{skill, level: strong|some|none, evidence: string[] (verbatim
  quotes from the resume, ≤3)}`, `experienceYears` estimate + `experienceFit: below|within|above`, `flags: {kind:
  gap|inconsistency|vague|other, detail}[]`, `summary`.
- Server checks every quote against the resume text (whitespace/case-normalised substring). A quote not found is
  dropped and the skill marked `unverified` (counts as none) — the model cannot invent evidence.
- **Score is computed by the server**, not the model: must-have 60 (strong 1, some 0.5, none/unverified 0, averaged),
  nice 15, experience fit 15 (within 1, above 0.7, below 0.3, unknown 0.5), answers 10 (non-knockout questions
  answered). Recommendation: knockout failed → reject; score ≥ threshold → advance; score ≥ threshold−15 → hold;
  else reject. Stored with the model name.
- Prompt-injection guard: the resume text is scanned in code for instructions aimed at an AI ("ignore previous
  instructions", "you are an AI", "rank this candidate", white-on-white is not visible in text so look for
  long hidden-looking keyword stuffing) → integrity reason `resume_injection` (high) and screening flag.
- The person sees evidence per skill and decides; "Advance all recommended (n)" is a person's bulk click, audited.

## 5. Rounds (`hire-rounds.ts`)

- **Move**: `move(actor, jobId, applicationIds, toRoundId | "next", {reason?, overrideReason?})`: each moved
  application gets a `hire_round_results` row for the new round (pending), an event, and (if the job says so) a mail
  ("You have moved to the next step"). Integrity `high` and not reviewed `genuine` → refused unless `overrideReason`
  (≥ 10 chars) is given → `override` event + audit.
- **Reject** with optional mail (polite, no reasons given by default; staff may add a line). **Restore** a rejected one.
- **Assessment**: "Send test" for selected applications in an assessment round → `InvitationService.inviteMany`
  (extended with an optional per-call window: now → now + daysToComplete) with ref = application.ref; result row
  `invited`. **Settle**: reading a job's pipeline maps `ResultsService.results(examId)` rows by ref → result row
  `in_progress|done` with score (percent) and sections; `passed|failed` is still a person's move, but the table shows
  "passed the bar" when ≥ passPercent.
- **AI interview**: "Send AI interview" → `AiInterviewService.create` with the job's role/JD/seniority, the round's
  questions/minutes, the candidate's name/email/ref and the application's resume text → id stored; settle reads its
  status/assessment/human scorecard → score = mean criterion score ×20.
- **Interview**: "Schedule interview" per application (time, minutes, panel, title, optional problem) →
  `InterviewService.schedule` (driveId null) → id stored; settle reads its combined scorecard → score.
- **Review**: hiring managers see "Waiting for your review" in the console and decide move/reject (normal move).
- **Offer** (`hire-offers.ts`): make offer (hire:offer) → `hire_offers` row, mail with a signed link (code =
  random, only its HMAC stored) and the portal; letter PDF (`pdf.ts`); candidate accepts/declines once (portal or link);
  expiry passes → `expired` on read; withdraw; "Mark hired" after acceptance → application `hired`, job's filled count;
  when filled = openings the console offers "Close the job and tell the rest" (bulk reject with mail).

## 6. Integrity — "Genuineness" (`hire-integrity.ts`)

Per application, computed from its assessment attempt(s) and the application itself; stored in `hire_integrity`;
recomputed by "Refresh" or when the pipeline is read and the attempt changed. Each reason `{code, severity
(info|warn|high), title, detail, round}`; level = high if any high, review if any warn, else clear; score = 100 −
Σ(high 30, warn 10), floor 0. Reasons (thresholds are constants in one place, tested):
1. identity photo not captured / human review rejected (high) / model face check flagged (high)
2. same selfie or ID photo used in another attempt in the org (high)
3. same network + device as another applicant of this job during the test (high; network only → warn)
4. tab switches > 5 (warn) > 15 (high); paste events > 3 (warn); full-screen exits > 3 (warn); screen share stopped
   (warn), second screen (high); camera off (warn); sustained voice (warn)
5. code similarity ≥ 0.7 with another applicant (high)
6. viva: any `inconsistent` (high), `shallow` (warn), unanswered probe (warn)
7. too fast: finished in < 30% of the median time with ≥ 80% marks (warn)
8. duplicate person: same phone or same resume file hash under another application in this job (high)
9. resume injection (high, from screening)
10. claims vs shown: screening said `strong` for a must-have skill whose test section scored < 30% (warn)
11. AI interview concerns (each concern → warn)
12. email verified (info, positive) — accounts are email-verified by construction
A person records "Reviewed: genuine / not genuine" with a note → event + audit. Never auto-reject.

**Overall score** (computed on read): weighted mean over rounds that have a score: screen, assessment, AI interview,
interview (default weights 20/40/20/20, job-editable). Integrity is shown beside it, not mixed into it.

## 7. Fresh questions (`question-drafts.ts`, H6 migration)

Reuse what G2 and G4 built on `main` (PR #47): the Parikshaa Library (`api/src/library.ts`, `library-routes.ts`, migration
0068: operators file questions, companies copy them into their bank) and the reference run (`ExamService.checkReference`,
`POST /questions/code/check`), which checks a code draft's reference solution against its tests. Do not build either again.

- `bank_questions` gains `status CHECK(approved|draft) default approved`, `source CHECK(manual|import|starter|ai)`,
  `created_by`, `approved_by`, `approved_at`, `used_count int default 0`, `last_used_at`.
- `POST /bank/drafts` (exam:write): {topic, skills[], kind mcq|numeric|code, difficulty, count ≤ 10} → the model writes
  questions (zod); MCQ/numeric: stem, options, correct, explanation; code: statement, function signature (python),
  reference solution, 8–15 test inputs → the server runs the reference on the runner (as `content-dsa`/editorial
  check do) to compute expected outputs; a draft whose reference fails or times out is dropped and counted.
  Near-duplicates (normalised stem hash vs the bank) dropped. Saved as `draft`, `source ai`.
- Drafts are excluded from job-test drafting and "Add from bank" until a person approves (approve/edit/discard,
  audited). Job-test drafting prefers the least-used approved questions; creating an exam from the bank bumps
  `used_count` for the copied questions.
- Fix: `QuestionBank.list` LIMIT 1000 silently cuts job-test drafts → page through or raise with explicit filter.
- Recorded decision change (Faisle): owner asked for new questions; the model now drafts, a person approves.

## 8. Platform operator — "Admin" (H7: extends G1, `operator.ts`)

**G1 built the operator on `main` (PR #47); H7 extends it, it does not make a second one.** Already there:
an operator is a staff member whose address is in `PARIKSHAA_OPERATORS` and who must have a second factor
(`api/src/operator.ts`, `operator-routes.ts`, console `components/Operator.tsx`); `/operator/companies` lists, shows,
creates, suspends/resumes (staff sign-in and API keys refused), grants credits and re-invites; organisations have
`public_id`, `suspended_at`, `suspended_reason` (migration 0067); every action is audited in the organisation and in the
operator's own. So the `operators` / `operator_sessions` tables, `pko_` tokens and `admin-cli operator add` below are
**dropped**. H7 adds only what Hire needs: `verified_at`/`verified_by`, `hire_job_reports` and its queue, candidate lookup
and erase, and suspension's effects on Hire (job and careers pages 404, apply refused, hire mails held). S11 is
re-checked against G1 in the fit critique (W3).

Original design (kept for reference; struck where G1 already covers it):

- ~~`operators(…)`, `operator_sessions(…)`, `pko_` tokens, `admin-cli operator add`~~ (G1: staff + `PARIKSHAA_OPERATORS` + 2FA).
- `organisations` gains `verified_at`, `verified_by` (`suspended_at`, `suspended_reason` already exist from G1).
- `hire_job_reports(org_id, id, job_id, candidate_id NULL, reason CHECK(fake|scam_fee|misleading|offensive|other),
  note, created_at, resolved_by, resolved_at, outcome CHECK(kept|taken_down))`.
- Routes `/operator/*` (operatorAuth): orgs list with stats (kind, created, owner verified, staff, open jobs,
  applications 30 d, attempts 30 d, credits, model spend this month, verified/suspended); org detail; verify /
  unverify; suspend (reason) / restore; grant credits (reuses billing); job reports queue → keep / take down (job →
  closed + public page 404); candidate lookup by email (applications count, account state) → erase on request;
  platform figures per week (signups, jobs, applications, tests, offers, hires). Every action in `operator_audit` and
  in the org's audit log as "Parikshaa operator <name>".
- Effects: suspended org → staff sign-in refused ("This organisation is suspended: write to support"), job/careers
  pages 404, apply refused. Unverified employer → job page says so (jobs still publish).
- Console: `/console/?operator` → operator sign-in → `Operator` lazy chunk (Companies, Reports, Candidates, Figures).

## 9. Slices (each one: code + tests + wiring; commit per slice)

- H1 Candidate accounts + resume: 0070 (candidate tables), scope `applicant`, `candidates.ts` (code sign-in, sessions,
  profile, resume upload + text extraction: PDF via `unpdf` (new dependency, pin exact), DOCX via existing docx
  helpers), erase, data export; routes `/candidate/*` (candidateAuth); tests.
- H2 Jobs + apply + pipeline core: 0071 (hire tables); `hire.ts` (jobs CRUD, rounds config, publish/pause/close, public job
  page, careers, apply (account required, consent, snapshot, ref, link, event, mail_applied, screen queued), pipeline
  read, move/reject/restore/withdraw, notes, events, candidate portal views), permissions, `hire-messages.ts`
  (outbox `hire` delivery), routes `hire-routes.ts` + `hire-public-routes.ts`; tests (two orgs isolation, applicant
  RLS, knockouts, duplicates).
- H3 AI screening (`hire-screen.ts`, fake model branch "You screen job applications"); tests (evidence check,
  server score, injection, spend cap, knockout).
- H4 Rounds + offers (`hire-rounds.ts`, `hire-offers.ts`): send test with window, settle, AI interview, interview,
  review, offers + letter PDF + link + portal response + expiry + hired + close-and-tell; tests.
- H5 Integrity + overall + compare + job report (`hire-integrity.ts`); tests per reason.
- H6 Question drafts + exposure (next free migration, `question-drafts.ts`, on the G2 Library and reference run, fake model branch "You draft assessment questions");
  tests (runner-checked code drafts, approval gate, job-test excludes drafts).
- H7 Operator: extend G1 (next free migration for verify + job reports; `operator.ts`, `operator-routes.ts`, verify and
  suspend effects on Hire) + extend the console `Operator.tsx`; tests.
- H8 Console Hiring UI (Jobs, editor, pipeline, drawer, compare, report, drafts in Bank, HirePath) + tests + budget.
- H9 Web candidate side (job page, careers, apply, portal) + tests + budget.
- H10 e2e (whole flow in Playwright), screenshots, docs (SECURITY.md, SPEC.md: candidate + operator accounts), tracker.

## 10. Changes after the critique (BINDING — where this section and §1–§9 disagree, this section wins)

The full critiques are in [hire/critique-security.md](hire/critique-security.md) and
[hire/critique-product.md](hire/critique-product.md). Every numbered item there is ADOPTED unless listed under
"Not adopted / changed" below. Builders: read both files for the detail (file:line evidence, exact rules); this section
records the decisions and resolves the conflicts between them.

### Security (S#) — all adopted
- S1 Resume extraction in a `worker_threads` worker (≈256 MB heap, 10 s wall clock, killed on timeout), pdf.js with
  `isEvalSupported:false`, ≤10 pages, ≤60 000 chars, encrypted PDFs refused; type sniffed from bytes (`%PDF-` or a DOCX
  whose `[Content_Types].xml` declares wordprocessingml; .docm refused); docx unzip caps (document.xml ≤5 MB inflated,
  ≤200 entries, ≤20 MB total); upload route `bodyLimit` ≈3 MB, candidate session only. Tests: zip bomb, 5 000-page PDF,
  renamed .exe refused.
- S2 `candidate_links`: no tenant policy; applicant SELECT/INSERT only for its own `candidate_id`; staff DELETE only
  for its own org; no staff SELECT/INSERT. Manual/import applications have `candidate_id NULL` + blind `email_hash`;
  they join a portal only when the signed-in candidate claims them (consent recorded then). No email→account oracle.
- S3 One `HireErasure.eraseApplication(orgId, appId, reason)` used by account delete, operator erase and retention
  (null PII columns, screening `result` NULL, integrity reasons → codes, `hire_events.detail` blanked via a column grant
  or SECURITY DEFINER function, offer note NULL, unredeemed invitations by ref blanked, closed attempts erased through a
  system path, open ones queued, interview/AI-interview per-record erase, links deleted, report candidate NULL; each org
  its own top-level transaction). Hire audit `detail` = ids and counts only. Test: full-DB text search finds nothing.
- S4 `HireScope` lives in `hire-store.ts` (ledger `Scope` unchanged). `candidate_id` denormalised onto `hire_events`
  and `hire_offers`. NO applicant policy on `hire_round_results`, `hire_screenings`, `hire_integrity` (the portal gets a
  service projection: round kind + waiting / your turn / done / not moving forward). Candidate writes (withdraw, offer
  answer) go through the service with explicit ownership checks; offer answer only `sent→accepted|declined`. CHECK:
  `candidate_visible` false for note/override/integrity_reviewed/screened.
- S5 Sign-in code: random 6 digits, stored only as `code_hash = HMAC(k, id‖code)` with `email_hash`; a new code
  invalidates earlier ones; verify = one atomic `UPDATE … attempts=attempts+1 WHERE … attempts<5 … RETURNING`,
  constant-time compare; DB-durable limits 5/hour and 10/day per email, 3 failed codes/day → 24 h lock, global
  codes/hour circuit breaker; account row created only after verify; identical responses either way; rows purged 24 h.
- S6 `trustProxy` becomes a hop count / CIDR (env), ALB XFF handling fixed in `deploy/aws`; test that a forged XFF does
  not change `request.ip`. Email-keyed limits are primary, IP limits secondary.
- S7 `hire:decide` and `hire:offer` are human-only in `can()` (API keys refused); `hire:manage` (publish) and
  `hire:offer` join `UNTIL_VERIFIED`.
- S8 Apply notice (English + Hindi): what is collected, the org decides, AI screening (not used for training), the model
  provider and that data leaves India, the org's retention days, two grievance contacts; `notice_hash` stored;
  checkbox "Have a person read my application without AI" (`ai_opt_out` → screening skipped); account creation needs
  "I am 18 or older"; withdrawing = withdrawing consent → erasure within 30 days; separate platform notice for accounts.
- S9 Retention per org (`hire_keep_days`, default the org's `retentionDays`, printed in the notice): rejected/withdrawn
  erased that many days after the decision; jobs auto-close at `apply_by` + 90 days; accounts inactive 3 years erased
  (mail first); codes purged 24 h, sessions 7 days after expiry; all registered as `RetainedRecords`.
- S10 `hire_job_reports` has no staff policy (operator only); the org sees only the outcome.
- S11 Operator: own `actor='operator'` scope whose policies allow only organisations, jobs, job reports and SECURITY
  DEFINER count functions (zero applicant rows); `totp_last_step`, sign-in throttle, `OPERATOR_ALLOW_CIDRS`, token in
  sessionStorage, `operator_audit` append-only (trigger) and records reads too.
- S12 Suspension refuses sessions and API keys, holds the org's hire/interview mails, and 404s its public pages.
- S13 The offer mail links into `/my` (session required); accept/decline are POST with confirmation; the letter PDF is
  served only to that session; a GET never changes anything.
- S14 **Only deterministic or human signals may be `high`**: identical photo hash; same phone / resume / canonical email
  hash in the org; a person's identity review "rejected"; a person-confirmed viva `inconsistent`; an interviewer saying
  "not the same person". Everything model-derived or heuristic (face check, injection pattern, network/device,
  similarity, paste/tab counts, AI-interview signals) is capped at `warn`, shows its evidence and is labelled "AI" or
  "pattern". (This overrides the `high` levels in §6 and in product items P8/P9.)
- S15 Screening fairness: redact answers and profile text too (+ pincodes, DOB/age, gendered words); verify quotes
  against the exact redacted text sent; no `gap` flag; recommendation `reject` is renamed `low_match`; a bulk reject
  filtered on the AI recommendation needs a typed reason (audit records filter + count); an offline counterfactual eval
  script (paired resumes differing only in gender/religion/caste markers) — its run waits on the API key.
- S16 Escape `<`/`>` in all untrusted text sent to a model (also the resume passed to the AI interviewer); summary ≤600
  chars labelled "AI summary — may be wrong"; `strong` needs quotes from ≥2 distinct places; a skill term >3% of tokens
  → `warn` (keyword stuffing).
- S17 ≤20 applications per candidate per day; ≤5 accounts verified per /24 per day; auto-screen ≤ `screen_daily_max`
  per job per day; disposable-mail domain list; `email_canonical_hash` (plus-tag and Gmail dots removed) for the
  per-job UNIQUE and duplicate signal.
- S18 + P18 Unverified employer: ≤2 open jobs, ≤100 applications per job, no auto-screen, no resume download/export,
  pages `noindex`, no staff free text in mails; a JD with fee/deposit wording is held for the operator; every job page
  and hire mail carries "Parikshaa and real employers never ask you to pay — report this". Operator verification stores
  `verification jsonb` (work-email domain vs website, GSTIN or CIN, LinkedIn, checked_by), audited.
- S19 Portal token in sessionStorage by default; "Keep me signed in on this device" → localStorage, 14-day sliding;
  "Sign out everywhere"; fresh email code (step-up) for account delete and offer accept/decline; sessions revoked on erasure.
- S20 Blind indexes: `HMAC(HKDF(kek,"parikshaa-blind","hire"), orgId‖value)` for email/phone/resume hashes; application
  email stored sealed beside its hash; `ref = "A"+base32(HMAC(k, orgId‖candidateId))[0..8]`.
- S21 Links https only (zod), rendered `rel="noopener noreferrer nofollow ugc"`; resumes served as attachments with a
  sanitised filename and the sniffed type; extracted text shown by default; `hire.resume_downloaded` audited.
- S22 Phone, email and resume download need `hire:decide`, job-manager membership or the interview panel; a viewer sees
  names, round state and scores only.
- S23 Knockout questions on protected topics (age, gender, marital status, pregnancy, religion, caste, disability) are
  refused by the server; knockouts are shown to the candidate before applying.
- S24 `withScope` inside a transaction throws when the requested scope differs from the current one; test it.

### Product (P#) — all adopted, with these decisions
- P1 Company signups get a default monthly model spend cap (`SIGNUP_SPEND_CAP_USD`); `max_applicants`,
  `screen_daily_max` (default 200); `auto_screen` off until verified AND until the screening eval passes (P16) —
  labelled "AI screening (beta)"; apply refused after `apply_by` 23:59 IST or at `max_applicants`; Jobs page shows
  AI usage this month. Ruka hua kaam: owner sets prices per screened applicant and per AI interview.
- P2 Integrity level gains `not_checked`; `coverage jsonb` per check (passed / flagged / not_run); `clear` only with a
  proctored attempt (identity + snapshots + browser events) plus a face check or a person's identity review; editor warns
  on an exam below the hiring preset ("unproctored"); drawer/compare/report show a "Checks passed" list.
- P3 New staff roles `recruiter` (all hire:*, exam:read/write, attempt:start/read/review/extend) and `hiring_manager`
  (hire:review + hire:decide + attempt:read/review, only for jobs whose `managers` include them). Role CHECKs (0003),
  `StaffRole`, `GRANTS`, tenancy tests change.
- P4 "Send test" checks credits (credits − unstarted live invites) first; owner mails at 80% / 100%; a candidate blocked
  by `out_of_credits` → `test_blocked` event + pipeline banner; after buying, "Extend these n windows".
- P5 Same exam across jobs: per-application outcome "Took this test on <date> for <job>" → Reuse the result / Choose
  another test. Retake: `candidate_ref = ref + "~" + n`, reason ≥10 chars, audited `hire.retake`, info reason.
- P6 Invitation purpose `reminder_closing` (24 h and 3 h before close, skipped if started); round statuses `expired`,
  `abandoned`; filter "Not started", bulk Nudge (resend) and "Extend window by n days".
- P7 On submit of a hire-linked attempt with identity on: queue an automatic face check (`checkAsSystem`, spend-capped);
  per-job Identity queue (selfie, ID, 3 snapshots, Verify/Reject); interviewer scorecard "Same person as the test photo?"
- P8 AI interview room records pastes, pasted chars and hidden ms per answer (`ai_interview_signals`, outside the hash
  chain); server computes typing speed; reasons `ai_paste`, `ai_away`, `ai_fast` (all `warn`, per S14).
- P9 Duplicates org-wide over 180 days (`phone_hash`, resume hash, reused photo, canonical email); `reapply_after_days`
  (default 90); drawer "Other applications at this company"; disposable domains → warn.
- P10 `InterviewService.reschedule` (same UID, SEQUENCE+1); staff offer 2–5 slots, candidate picks in the portal
  (reminder after 48 h); "Ask for another time"; status `no_show`; interview round `criteria[]` shared by the panel.
- P11 Import (CSV, dry run) and "Add one" → applications `invited` with `candidate_id NULL`, mail "Complete your
  application"; claim on sign-in with the same email (consent + resume, then screening); `not_claimed` after 14 days.
- P12 Job page "What you'll need" (laptop with Chrome/Edge, webcam, mic, minutes); apply asks "Laptop with webcam
  available for the test?" (not a knockout); portal on a phone shows "Open on a computer", "Email me the link", "Check
  my computer"; round config `allowPhone`; acceptance includes Android Chrome at 360 px.
- P13 Daily 09:00 IST digest to managers and the job creator; `review_sla_days` (default 2); instant mail on offer
  accepted/declined; pipeline "In this step n days", "Past SLA" filter, "Needs you: n"; per-user unsubscribe.
- P14 `EmailMessage.replyTo`, job `contact_email`, sender "<Company> via Parikshaa"; "Message candidate" thread (sealed,
  visible in the portal); per-job "Note to candidates"; rejection mails sent 24 h later (cancelled on Restore).
- P15 Settling is event-driven: a Hire listener on `attempt.started/submitted/graded/voided` (the webhooks path) updates
  `hire_round_results` and recomputes that application's integrity; similarity per job is a queued job;
  `AiInterviewService` finish/decide and `InterviewService.score` call an injected `onSettled`. Reading the pipeline is
  a plain table read: 1 000 applications in under 1 s.
- P16 H3 counts as done only with a recorded eval (≥30 consented anonymised resumes × 3 JDs, two human labels; ship
  auto-screen on only if ≥95% quotes verify, ≥80% agreement, name/college swap moves the score ≤5). Waits on the key.
- P17 Status `joined` and `did_not_join` (reason) after the joining date; staff reminder on joining date +1; candidate
  mail 7 days before joining; `did_not_join` frees the opening and shows backup candidates; report shows offer→join rate.
- P19 `?src=` source tag, link variants (LinkedIn, Naukri, WhatsApp, Referral), `?ref=` referrer; server-rendered
  `<title>`, `og:*` and `JobPosting` JSON-LD for verified orgs' job/careers pages.
- P20 Duplicate a job; round `sendOnMove`; `reject_reason` enum (skills, experience, ctc, notice, location, integrity,
  no_show, candidate_declined, filled, other); "Consider for another job".
- P21 Scope cuts: question drafts (H6) move to after the UI and are MCQ/numeric only in v1 (code drafts later); the
  hiring preset warns when a section's pool is under 2× its pick; overall-score weights fixed (20/40/20/20) in v1;
  operator keeps companies, verify, suspend, reports and erase (figures/credits stay in the CLIs); pipeline ships as a
  table with round counts (no drag-and-drop board).
- P22 The acceptance demo in critique-product.md item 22 is the "done" test for plan row 110, and the script for H10.

### Not adopted / changed
- None of the items are rejected. Conflicts resolved: integrity `high` follows S14 (not P8/P9); unverified employers get
  ≤100 applications per job (P18, stricter than S18's 300).
- The third critique ("fit": does the design match the real code, service signatures, slice order) did not finish
  (session limit). Re-run it before or alongside H1 — see docs/HIRE-HANDOFF.md.

### Build order (slice ids stay tied to tracker rows 111–120)
H1 → H2 → H3 → H4 → H5 → H7 (operator) → H8 (console) → H9 (web) → H6 (question drafts) → H10 (e2e + docs).
Where an item above belongs: S1, S5, S6, S19, S20, S24 → H1. S2–S4, S7–S10, S15-knockouts, S17, S18, S21–S23, P1, P3,
P9-hashes, P11, P14, P19, P20 → H2. S15, S16, P16 → H3. P4–P6, P10, P13, P15, P17, S13 → H4. S14, P2, P7, P8, P9 → H5.
S11, S12, S18-verification → H7. P12 and S19 UI → H8/H9.
