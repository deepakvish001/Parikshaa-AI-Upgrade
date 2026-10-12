1. **blocker: public apply triggers model spend with no limit.**
   - Why: `auto_screen` defaults to true (design l.70), so every apply queues a model call (l.180). A null cap means no limit (`service.ts:274`), and `signUp` never sets a cap (`onboarding.ts:149-152`). Anyone with an email address can apply, so spam applications to a self-signed-up company cost Parikshaa money with no limit. Nothing says what a company pays for screening or the AI interview. Only tests use credits.
   - Change:
     - (a) Company signups get a default monthly cap (`SIGNUP_SPEND_CAP_USD` env, set in `signUp`).
     - (b) Add `hire_jobs.max_applicants int NULL` and `screen_daily_max int DEFAULT 200`. Past the limit the screening is `skipped`, with the reason "Daily screening limit" and a "Screen these now" button (a person's click).
     - (c) `auto_screen` defaults to false until the org is verified.
     - (d) Apply is refused after `apply_by` 23:59 IST, or once `max_applicants` is reached.
     - (e) The Jobs page shows "AI screening this month: n candidates, ₹x of cap".
     - (f) Add a "Ruka hua kaam" row: the owner sets the price per screened applicant and per AI interview.

2. **blocker: Integrity shows "clear" when nothing was checked, and lists only negatives.**
   - Why: level is "high if any high, review if any warn, else clear" (l.233). A candidate who has not taken a test, a job with no assessment round, or "pick an existing exam" (l.157) with proctoring off all show a green "clear". That is the opposite of the promise "only genuine candidates reach the shortlist". Reason 12 is the only positive sign.
   - Change:
     - `hire_integrity.level` CHECK gains `not_checked`.
     - Add a `coverage jsonb` column with `{identity, face_check, identity_review, browser, screen, audio, viva, similarity, ai_interview, interview_face}`, each `passed|flagged|not_run`.
     - `clear` only when a proctored attempt exists with identity, snapshots and browser events, plus a face check or a person's identity review. Otherwise `not_checked`.
     - Picking an exam below the hiring-preset minimum shows a warning in the editor, and the round is marked "unproctored".
     - The drawer, compare view and report v2 show a "Checks passed" list: email verified, ID verified by <name>, same face in test and interview, viva consistent, no shared device or duplicate. This list is what convinces a company.

3. **important: only the owner can run a job end to end; the design's role mapping contradicts the services it calls.**
   - Why: the design gives author all four `hire:*` permissions and reviewer review+decide (l.117-121). But the services it calls check other permissions:
     - send test needs `attempt:start` (`invitation-service.ts:291`);
     - AI interview needs `exam:write` (`ai-interview.ts:177`);
     - schedule interview needs `attempt:review` (`interviews.ts:168`);
     - identity review needs `attempt:extend` (`proctoring.ts:237`);
     - results need `attempt:review` (`results.ts:176`).
   - In `GRANTS` (`staff-auth.ts:93-107`), author lacks `attempt:review` and `attempt:extend`. Reviewer lacks `attempt:start`, `exam:write` and `attempt:extend`. So a company's HR person must be made owner, which also hands over billing and staff management.
   - Change:
     - Add role `recruiter`: all `hire:*`, `exam:read/write`, `attempt:start/read/review/extend`.
     - Add role `hiring_manager`: `hire:review` and `hire:decide`, limited to jobs whose `managers` include the user; plus `attempt:read/review` for those jobs' candidates and interview scoring.
     - Change the role CHECKs in 0003 (staff_users, api_keys), `StaffRole`, `GRANTS` and the tenancy role tests.
     - Add `hire:offer` and the integrity verdict to the human-only list in `can()` (`staff-auth.ts:119`).

4. **important: when credits run out, the candidate finds out first.**
   - Why: a credit is taken when the invite is redeemed (`service.ts:778`). With none left, the candidate sees "unavailable" (`InviteGate.tsx:70`) and staff are not told. A self-signup company starts with 25 credits (`onboarding.ts:152`), and "Send test" to 40 people succeeds.
   - Change:
     - "Send test" computes credits minus unstarted, unexpired invites, and refuses to send more ("You can send 12 more · Buy credits").
     - The owner gets a mail at 80% and at 100% of credits used.
     - When a candidate is blocked by `out_of_credits`, record a `test_blocked` event and show a pipeline banner. The portal says "The company has been told". Buying credits offers "Extend these n windows".

5. **important: the same exam cannot be used for two jobs, and a re-test is impossible.**
   - Why: `invitations` is UNIQUE on `(org_id, exam_id, candidate_ref)` (`0006:40`), revoked rows included. `inviteMany` skips existing refs (`invitation-service.ts:294-303`). The design makes `ref` stable per org and candidate (l.85-86), allows "pick an existing exam" (l.157), and marks the row `invited` (l.212). Result:
     - A candidate in two jobs that share an exam silently gets no invite, and settle shows the old attempt.
     - A genuine power or internet failure cannot be re-tested.
   - Change:
     - "Send test" returns an outcome per application. For a ref already on that exam it shows "Took this test on <date> for <job>" with two choices, "Reuse the result" or "Choose another test". Reuse copies the score with `detail.reusedFrom`.
     - Retake uses `candidate_ref = ref + "~" + n`. All refs go in `hire_round_results.detail.refs[]` and settle maps all of them.
     - A retake needs a reason of at least 10 characters, is audited as `hire.retake`, and shows as an info integrity reason.

6. **important: Hire tests get no reminders and have no "never started" state.**
   - Why: reminders are only queued before `opensAt` (`invitation-service.ts:213-221`). Hire windows open now (l.211), so no reminder is ever sent. Round statuses (l.92-93) have no expired or abandoned state, so the funnel cannot show who never took the test.
   - Change:
     - New invitation outbox purpose `reminder_closing`, at 24 h and 3 h before `closesAt`, skipped at delivery if the attempt has started. All exams benefit.
     - Round statuses gain `expired` (never started) and `abandoned` (started, not submitted).
     - Pipeline filter "Not started", with bulk "Nudge" (the existing `resend`) and "Extend window by n days" (per invitation, audited).
     - Portal line: "Your test closes in 20 h".

7. **important: catching a proxy depends on clicks nobody makes.**
   - Why: the face check runs only from the staff routes (`proxy-routes.ts:77,97`) through `authoring(actor)` (`proxy.ts:139`). Identity review is reachable only from Live (map). Reason 1 depends on both, so at volume only "photo not captured" ever fires, even though impersonation is the main fraud in remote hiring.
   - Change:
     - (a) On `attempt.submitted` for a hire-linked attempt with identity on, queue outbox `hire`/`face_check`. It runs a new `ProxyService.checkAsSystem(orgId, attemptId)` through `modelCall`, spend-capped, and is skipped with a reason when the cap is reached.
     - (b) Add a per-job "Identity" queue: selfie, ID and 3 snapshots side by side, with Verify/Reject buttons that call `reviewIdentity`.
     - (c) The live interview page shows the test selfie, and the scorecard gains "Same person as the test photo? yes / no / couldn't see". "no" adds reason `interview_face_mismatch` (high); "yes" adds a passed check.

8. **important: the AI interview round is an unmonitored chat.**
   - Why: `AiInterview.tsx` has no paste or visibility handling. The only signal is the model's free-text `concerns` (`ai-interview.ts:75`). This is the easiest round to answer with ChatGPT open in another tab. Turns already carry server times (`ai-interview.ts:336`).
   - Change:
     - The room counts pastes, pasted characters and hidden milliseconds for each answer, and sends them with `answer`.
     - Store them in a new `ai_interview_signals(org_id, interview_id, turn_seq, pastes, pasted_chars, hidden_ms)` table, outside the hash chain.
     - The server computes typing speed (characters per second) from the question turn to the answer turn.
     - New reasons:
       - `ai_paste`: warn if over 100 pasted characters; high if over 50% of the answer was pasted.
       - `ai_away`: warn if the page was hidden more than 30 s during an answer.
       - `ai_fast`: warn if typing is above 15 characters a second on 3 or more answers.

9. **important: duplicates and re-applications are checked within one job only.**
   - Why: reason 8 is "under another application in this job" (l.242). Phone is sealed with no hash (l.87). A second email means a new account, a new ref and therefore a fresh test (l.85-86). So the classic "fail, then re-apply with a new email and retake" is never seen.
   - Change:
     - Add `hire_applications.phone_hash` (HMAC of `91XXXXXXXXXX`) with an index, nulled on erase.
     - Run reason 8 across the whole org over 180 days. Same `phone_hash`, `resume_sha256`, reused photo (already org-wide), or device+network at apply under a different account gives high: "Same person as application X".
     - New org setting `reapply_after_days` (default 90). Rejected at or after the assessment round within that window gives warn plus a link to the old application.
     - Drawer panel "Other applications at this company".
     - Disposable-email domains give warn.

10. **important: the interview round has no slot choice, no reschedule, no no-show and no shared criteria.**
    - Why: `edit` cannot change the time (`interviews.ts:306-319`), and the tracker says "reschedule nahi" (`PREP-TRACKER.md:871`). Staff pick a time for each person (l.219). Round statuses have no `no_show`, and panelists score free-named criteria.
    - Change:
      - `InterviewService.reschedule(actor, id, {scheduledAt, minutes})` resends the `.ics` with the same UID and SEQUENCE+1.
      - Hire "Offer times": staff propose 2 to 5 slots and the candidate picks one in the portal. No pick in 48 h sends a reminder, then shows "No reply".
      - Portal "Ask for another time" (a note plus up to 3 times) records `reschedule_requested` and mails the panel.
      - Round status `no_show`.
      - Interview round config gains `criteria[]`, passed into the scorecard so every panelist scores the same things.

11. **important: the `manual` and `import` sources have no flow, so a company's existing applicants can't enter.**
    - Why: the source CHECK lists `manual|import` (l.88), but apply requires an account (l.290) and no route adds applicants. A first company already has candidates on Naukri or LinkedIn (`CO4` ⬜, `PREP-TRACKER.md:823`). A CSV parser already exists (`candidate-import.ts`).
    - Change:
      - Add `POST /hire/jobs/:id/applicants/import` (CSV: name, email, phone, source_tag; dry run first, then all-or-nothing) and "Add one".
      - Creates applications with `candidate_id NULL` and status `invited` (the CHECK gains `invited`), and mails "Complete your application" with a signed link.
      - Signing in with the same email claims the application: links it, takes consent and resume, then queues screening. No AI screening or test before the claim, for DPDP.
      - Unclaimed after 14 days becomes `not_claimed`.
    - If this is not built for v1, drop `manual|import` from the CHECK and record that under "Faisle".

12. **important: phone users can't take the test and learn this only at the gate.**
    - Why: the hiring preset needs screen share (l.155). Start stays disabled until the screen is shared (`CameraCheck.tsx:93`), and phones throw `unsupported` (`screen.ts:30`, `i18n.tsx:651` "Use Chrome or Edge on a computer"). Most applicants apply from phones, and the job page, apply form and portal (l.128-145) never mention the device needed.
    - Change:
      - Job page "What you'll need", derived from the rounds: laptop with Chrome or Edge, webcam, mic, minutes.
      - Apply asks "Laptop with webcam available for the test?" (not a knockout; staff see the answer).
      - Portal "Take the test" on a phone shows "Open on a computer", "Email me the link" and a "Check my computer" device check that doesn't start the attempt.
      - Round config `allowPhone` turns screen share off for non-coding rounds.
      - H9 acceptance includes Android Chrome at 360 px.

13. **important: hiring managers aren't nudged, and nothing shows how long candidates have waited.**
    - Why: the `mail_manager` purpose (l.109) has no trigger. The review round depends on managers opening the console (l.221). The report has median days in a round (l.171), but the pipeline doesn't show it.
    - Change:
      - Daily 09:00 IST digest to each manager and the job's creator: new applicants, recommended and awaiting a decision, tests done, reviews waiting longer than `review_sla_days` (new job field, default 2), interviews today, scorecards missing 4 h after the slot.
      - Instant mail when an offer is accepted or declined.
      - Pipeline column "In this step n days", a "Past SLA" filter, and "Needs you: n" on the Jobs list.
      - Unsubscribe per user.

14. **important: communication leaves the portal.**
    - Why: `EmailMessage` has no reply-to (`delivery.ts:24-31`), so candidate replies go to a no-reply address. The mails have fixed wording (l.108-109). There is no way to write to one candidate, which breaks "track on the same portal".
    - Change:
      - Add `EmailMessage.replyTo?` and job field `contact_email`; sender "<Company> via Parikshaa".
      - Drawer "Message candidate" (at most 2000 characters, sealed in `hire_events.detail`, `candidate_visible`, outbox carries ids only), shown as a thread in the portal.
      - Per-job "Note to candidates" added to test and interview mails.
      - Rejection mails default to `sendAfter` +24 h (cancelled on Restore), with one editable rejection line per job.

15. **important: settling results and integrity when the page is read will not hold up at volume.**
    - Why: the design settles and recomputes integrity whenever the pipeline is read (l.213, l.229). `results()` replays every attempt's ledger on each call, and similarity is O(n²) per question (map-integrity). Listeners already exist: `webhooks.ts:32,162` passes `attempt.started/submitted/graded/voided` to them (Greenhouse uses this, `ats.ts:526`).
    - Change:
      - Register a Hire listener that updates `hire_round_results` and recomputes `hire_integrity` for that one application. Job similarity runs as a queued job.
      - `AiInterviewService#finish/decide` and `InterviewService.score` call an injected `onSettled`.
      - Reading the pipeline becomes a plain table read. Acceptance: 1,000 applications with 400 attempts reads in under 1 s.

16. **important: AI screening is on by default but has never run on a real model.**
    - Why: every AI feature is tested with the fake model. The real-model test (F6, row 82) waits on the API key, and JD reading has not run on a real model either (`PREP-TRACKER.md:830`). The design still defaults `auto_screen` to true (l.70).
    - Change: H3 counts as done only with a recorded eval.
      - At least 30 consented, anonymised resumes × 3 JDs, labelled advance/hold/reject by two people.
      - Ship `auto_screen` on by default only if at least 95% of quotes verify, advance-vs-reject agreement is at least 80%, and swapping the name or college moves the score by no more than 5.
      - Until then the default is off, labelled "AI screening (beta)".
      - Add a "Ruka hua kaam" row for the key.

17. **important: the offer flow stops at "hired"; joining is the real outcome.**
    - Why: the design ends at "Mark hired" (l.224-225). Drives already track joined and "join nahi kiya" (`PREP-TRACKER.md:879`), so Hire would be a step backwards, and offers not taken up are common in India.
    - Change:
      - Application status gains `joined` and `did_not_join` (with a reason) after `joining_date`, plus a reminder to staff on the joining date +1.
      - `did_not_join` frees the opening and shows "Backup candidates" (review or offer round, not rejected).
      - A candidate mail 7 days before joining: "Still joining on <date>?" with Yes or "Need to talk", recorded as an event.
      - Job report shows offer → join rate.

18. **important: employer verification has no rule, and unverified employers get full reach.**
    - Why: `verified_at` exists but nothing says what is checked, and "jobs still publish" (l.271, l.281). Fake jobs that ask candidates for fees are common in India.
    - Change:
      - Operator verification stores `verification jsonb`: work-email domain matches the website, GSTIN or CIN, LinkedIn page, `checked_by`.
      - Unverified org: at most 2 open jobs, at most 100 applications per job, no auto-screen, job and careers pages `noindex`.
      - Every job page says "Parikshaa and this employer never ask you for money".
      - A JD containing fee or deposit wording is held for the operator before it publishes.

19. **nice: sourcing basics are missing.**
    - Why: the source CHECK (l.88) cannot tell LinkedIn from Naukri or WhatsApp, yet the report promises a source breakdown (l.171). Every path is served as a bare `index.html` (`server.ts:1388-1393`), so job links shared on WhatsApp or LinkedIn get no preview.
    - Change:
      - `source_tag` taken from `?src=` (at most 32 characters, `[a-z0-9-]`).
      - "Copy link" offers LinkedIn, Naukri, WhatsApp and Referral variants; `?ref=` fills `referrer`.
      - Server-rendered `/jobs/:code` and `/careers/:org` with an escaped `<title>`, `og:*` tags and `JobPosting` JSON-LD, for verified orgs only.

20. **nice: small daily-work gaps.**
    - Change:
      - `POST /hire/jobs/:id/duplicate` copies fields, screening questions and rounds.
      - Round config `sendOnMove` sends the test or AI interview invite in the same audited move click.
      - `reject_reason` CHECK: skills, experience, ctc, notice, location, integrity, no_show, candidate_declined, filled, other.
      - "Consider for another job" copies an application and tells the candidate.

21. **nice: some of v1 is over-built; change the order.**
    - H6's code drafts with tests generated on the runner are the heaviest slice, and they go against a recorded decision (`PREP-TRACKER.md:304`). The flow works without them.
      - Move H6 after H1–H5, H8 and H9, and limit v1 to MCQ and numeric drafts.
      - Aim it at pool depth: each candidate already draws a different paper (`core/paper.ts:23`), and `job-test.ts:159-160` already notes when every candidate gets the same questions. The hiring preset should warn when a section's pool is under 2× its pick.
    - Job-editable weights (l.72, l.248): use fixed weights in v1.
    - Operator "figures" and "grant credits" pages: `pilot-report-cli` and `billing-cli` already do this; keep verify, suspend, reports and erase in the UI.
    - Pipeline board: ship the table with round counts first.

22. **important: the acceptance demo the owner should see before launch.** This replaces the "done" text in row 100. Run it on staging with real email (SES) and the real model key. Three staff users (owner, recruiter, hiring manager/interviewer) plus the operator. Nine personas, two of them on Android phones.
    1. The company signs up, the operator verifies it (checklist), and the job page shows the badge.
    2. The recruiter (not the owner) pastes a JD: "Backend Java, 2–5 yrs, 2 openings". Knockout: notice ≤ 60 days. Pipeline: screen → test (hiring preset, pool ≥ 2×) → AI interview → panel → manager review → offer. Publish, share with `?src=linkedin`, and the WhatsApp preview shows the title.
    3. Personas apply, and 5 more come in from a Naukri CSV and claim their applications:
       - A and B: genuine, strong;
       - C: fails the knockout;
       - D: resume with hidden instructions to the AI;
       - E: a proxy takes the test;
       - F: C's second email, same phone;
       - G: copies H's code;
       - I: never starts the test.
    4. Screening: only verbatim quotes, C gets "reject" with the question named, D is flagged high. "Advance recommended (n)" is audited with the count.
    5. Tests: the credit check is shown before sending. The phone persona sees "Open on a computer". I gets the closing reminder, goes `expired`, the window is extended, and I takes the test.
    6. With no manual refresh, the pipeline shows E high (automatic face check), F high (same phone), G and H high (similarity). The manager marks H genuine with a note and G not genuine. Advancing E is refused without a written reason; with one it is audited.
    7. AI interview: B pastes an answer and gets `ai_paste`.
    8. Panel: the candidate picks one of 3 offered slots, one candidate asks for a reschedule, one is a no-show. The interviewer answers "same person as the test photo", and 2 panelists use the same criteria.
    9. The manager gets the digest ("2 waiting"), then A gets an offer with the letter PDF and accepts in the portal. H declines. "Close and tell the rest" queues the rejection mails 24 h later. A is marked joined.
    10. Portal: each persona sees the right timeline and never a score or integrity sign. A downloads their data. C deletes their account, and the company's copy loses C's personal data while the events stay.
    11. Operator: takes down a reported fake job, and a suspended org's job page returns 404.
    - Pass when:
      - every cheat persona is flagged with a named reason;
      - no genuine persona is high, and none shows "clear" without the coverage list;
      - the audit log shows a person behind every move;
      - every mail is delivered;
      - the pipeline loads in under 1 s with 1,000 synthetic applicants;
      - the screening eval from issue 16 is recorded.