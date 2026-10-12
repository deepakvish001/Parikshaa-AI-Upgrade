1. **blocker — Resume parsing runs inside the API process, so one crafted PDF can stall every live exam**
   - **Why:** H1 extracts PDF text with `unpdf` (pdf.js) and DOCX text with "existing docx helpers", inside the request. pdf.js parsing is synchronous CPU work. A PDF with many pages, deep object nesting or Flate bombs blocks the Node event loop of an API instance. That same instance serves candidates in live exams: heartbeats, saves and the per-attempt limiter (`server.ts:473-501`). pdf.js also had code execution through font compilation when `isEvalSupported` is true (CVE-2024-4367). The only zip-bomb guard today is sized for 14.5 MB question papers: inflated XML up to 30 MB, see `docx-import.ts:81,121-126` and `bank-routes.ts:189`. The design names no limits, no magic-byte check and no transport (Fastify's default body limit is 1 MiB).
   - **Change:** add an "Extraction" rule to H1:
     - Run extraction in a `worker_threads` worker with `resourceLimits` (about 256 MB heap) and a 10 s wall clock, killed on timeout. Use `isEvalSupported:false` and pin pdf.js at 4.2.67 or later.
     - Read at most 10 pages and 60 000 characters (`ai_interviews.resume` allows ≤60000, per `0061`). Refuse encrypted PDFs.
     - Sniff the type from bytes: `%PDF-`, or `PK\3\4` with a `[Content_Types].xml` declaring `wordprocessingml.document`. Refuse `macroEnabled` (.docm).
     - Reuse `docx-import`'s guarded `unzipSync` with resume-sized caps: `document.xml` ≤ 5 MB inflated, ≤ 200 entries, whole archive ≤ 20 MB inflated.
     - Give the upload route its own `bodyLimit` (about 3 MB, as `bank-routes.ts:220` does) and accept it only with a candidate session.
     - Tests: a zip bomb, a 5 000-page PDF and a renamed .exe are all refused, and the event loop is never blocked for more than 50 ms.

2. **blocker — `candidate_links` RLS cannot be built as written, and staff INSERT lets any org push applications into a stranger's portal**
   - **Why:**
     - The design gives `candidate_links` an applicant policy and "staff may INSERT/DELETE". The house rule puts the RESTRICTIVE `tenant_isolation` on every org table (`0060_ai_interviews.sql` loop). With that policy, the cross-org "my applications everywhere" read is impossible. Without it, the staff policy has no org fence unless it is written in.
     - Staff INSERT plus `source manual|import` lets org X create `hire_applications(candidate_id = victim)` and a link. A fake application or offer then appears inside Parikshaa's own portal, a strong phishing channel.
     - Resolving email → `candidate_id` for manual/import is also a cross-org oracle: it tells any org whether an address has a Parikshaa account.
   - **Change:**
     - `candidate_links` gets no tenant policy. Give it exactly two policies:
       - `FOR SELECT USING (actor='applicant' AND candidate_id = nullif(current_setting('parikshaa.candidate_id',true),''))`
       - staff `FOR DELETE USING (actor='staff' AND org_id = nullif(current_setting('parikshaa.org_id',true),''))`
     - Give it **no staff INSERT and no staff SELECT**. Rows are inserted only by apply or claim, in applicant scope, with `WITH CHECK candidate_id = setting`.
     - Manual/import applications are stored with `candidate_id NULL` and `email_hash`. They appear in a portal only after the signed-in candidate clicks "Add to my applications", which records consent at that moment.
     - Tests:
       - org B staff cannot read, insert or delete org A's links;
       - an applicant cannot see another candidate's links;
       - manual import never reveals whether an account exists.

3. **blocker — Account deletion promises erasure "in every org's copy" that the schema cannot deliver**
   - **Why:**
     - `hire_events` is "GRANT SELECT, INSERT only", so the free text in note, override and mail details can never be blanked.
     - `hire_screenings.result` holds verbatim resume quotes and the summary, unsealed.
     - Today's erase covers attempts only (`ledger-store.ts:535-585`). It refuses open attempts (`privacy.ts:340-349` `closedOnly`). It needs a human `org:manage` actor (`privacy.ts:256-258`).
     - Unredeemed invitations keep plain email and phone; they are blanked only through `attempt_id` (`ledger-store.ts:579-583`).
     - `interviews` and `ai_interviews` have only age sweeps, no per-record erase (`interview-store.ts:188`, `ai-interview-store.ts:286`).
     - Audit details already carry candidate names (`interviews.ts:217`), and `audit_log` is append-only.
   - **Change:** add one `HireErasure.eraseApplication(orgId, appId, reason)`, used by account delete, operator erase and retention. It does the following:
     - Null the PII columns of `hire_applications`.
     - Set `hire_screenings.result` to NULL and keep the score and recommendation.
     - Reduce `hire_integrity.reasons` to codes only.
     - Blank `hire_events.detail` for note, mail and override events, through a column grant `GRANT UPDATE (detail)` or a SECURITY DEFINER `hire_erase_events()`.
     - Set `hire_offers.note` to NULL.
     - Blank invitations by `candidate_ref = ref` where `attempt_id IS NULL`.
     - Call `LedgerStore.erase` for each closed attempt through a new system path (`decidedBy: {kind:'candidate'}`). Queue open attempts as `erase_on_close`.
     - Add new `erase(orgId,id)` methods on the interview and AI interview stores.
     - Delete the `candidate_links` rows and set `hire_job_reports.candidate_id` to NULL.
     - Each org gets its own `withScope`, never nested.
     - Rule: hire audit `detail` holds ids and counts only, never names, emails or reasons. Free text goes in `hire_events`.
     - Test: after erasure, a full-database text search for the candidate's email, phone and name finds nothing.

4. **important — The applicant policies refer to a `candidate_id` that three tables lack, and grant more than the portal may show**
   - **Why:**
     - `hire_round_results`, `hire_events` and `hire_offers` have no `candidate_id` column, so "SELECT where candidate_id matches" cannot be written.
     - A SELECT on `hire_round_results` exposes `score`, `detail` (ratings) and `decided_by`, which contradicts "never shows AI scores".
     - An applicant UPDATE on `hire_offers` with no column limit would let a code bug change `ctc_lpa`.
     - Adding `applicant` to ledger-store's `Scope` (`ledger-store.ts:32-34`) makes applicant scopes type-check for every exam and ledger method. That throws away the compile-time fence practice deliberately kept (`practice-store.ts:10-13,19-34`).
   - **Change:**
     - Define `HireScope` in `hire-store.ts`, as `PracticeScope` is defined, and leave ledger `Scope` unchanged.
     - Denormalise `candidate_id` onto `hire_events` and `hire_offers`.
     - Give **no** applicant policy on `hire_round_results`, `hire_screenings` or `hire_integrity`. The portal reads round state through the service, which projects `(round kind, waiting/your turn/done/not moving forward)` only.
     - Offer response goes through a SECURITY DEFINER `hire_offer_respond(org, offer, candidate, answer)` that allows only `sent→accepted|declined`.
     - Add a CHECK that `candidate_visible` is false for `note`, `override`, `integrity_reviewed` and `screened`.
     - Every applicant policy also checks `actor='applicant'` and uses `nullif(...,'')`.
     - Test: in applicant scope, those three tables return zero rows.

5. **important — The email-code sign-in can be brute-forced and abused, and the spec contradicts itself**
   - **Why:**
     - The code is both "HMAC(secret,id) mod 10^6, nothing stored" and a stored `code_hash`.
     - The `attempts int` counter is read and then compared, so parallel verify requests bypass the limit of 5.
     - 5 codes/hour × 5 tries is 600 guesses per day per email, with no daily cap.
     - `candidate_codes.email` is plain, and is stored even for people who never finish signing in.
     - Sending a code to any address at 5 per hour per email makes Parikshaa's mailer a spam cannon. A complaint-driven suspension of the sender would also stop exam invitations.
     - `LoginThrottle` is in memory and per process (`staff-auth.ts:300-311`), and the API runs in an autoscaling group (`compute.tf:253`).
   - **Change:**
     - Store `email_hash` only, plus `code_hash = HMAC(k, id‖code)`.
     - Issuing a code invalidates earlier ones. Verify takes `(email, code)` and checks only the newest live row through `UPDATE … SET attempts=attempts+1 WHERE id=$1 AND attempts<5 AND used_at IS NULL AND expires_at>now() RETURNING`. Compare in constant time. A match sets `used_at` in the same statement.
     - Count limits durably in the database: 5 codes/hour and 10/day per email, and 3 failed codes/day lock that email for 24 h.
     - Add a global cap on code mails per hour as a circuit breaker.
     - Create `candidate_accounts` only after a successful verify. Give an identical response whether or not an account exists.
     - Purge code rows after 24 h. The mail contains no user-supplied text.

6. **important — Per-IP limits are spoofable in the AWS deployment**
   - **Why:**
     - `TRUST_PROXY=true` (`compute.tf:55`) maps to Fastify `trustProxy: true` (`server.ts:281`), which trusts every hop. `request.ip` is then the leftmost `X-Forwarded-For` entry.
     - The ALB (`edge.tf:42-56`) sets no `xff_header_processing_mode`, so it keeps the client's own XFF and appends to it. A client can therefore choose its own IP.
     - Every new public limit (20 codes/hour/IP, apply, report job) depends on `request.ip`.
   - **Change:**
     - Set `trustProxy` to a hop count (`1`) or the VPC CIDR. Alternatively set the ALB's `xff_header_processing_mode="remove"` or `"preserve"` with matching config.
     - Add a test that a forged XFF does not change `request.ip`.
     - State in the design that the email-keyed limits in issue 5 are the primary control and IP limits are secondary.

7. **important — API keys and unverified owners can drive hiring decisions**
   - **Why:**
     - `can()` keeps only `attempt:void` and `attempt:extend` from API keys (`staff-auth.ts:117-122`). The new `hire:decide` and `hire:offer` would be grantable to an `author` or `reviewer` key. An integration could then read screening recommendations and move or reject candidates with no person involved, breaking "AI suggests, a person decides".
     - `UNTIL_VERIFIED` (`staff-auth.ts:129`) does not include publishing a job or mailing candidates. A self-signed-up org with an unverified owner (`onboarding.ts:126-160`) could publish and collect PII at once.
   - **Change:**
     - In `can()`: `hire:decide` and `hire:offer` return false for `actor.kind !== "user"`.
     - Add `hire:manage` (publish) and `hire:offer` to `UNTIL_VERIFIED`.
     - Tests in `tenancy.test.ts`.

8. **important — Consent and notice at apply are not specified to the standard of the DPDP Act**
   - **Why:**
     - Only `consent_version` is named. The existing notice for tests lists what is collected, the rights and a Hindi copy, and is hashed (`privacy.ts:29-60`; ledger `consent_given`).
     - Apply-time processing is new: a resume, AI screening, sharing with a named employer, and a transfer to a model provider outside India (s.16).
     - s.6(1) requires consent that is "unconditional", yet applying is conditioned on AI screening.
     - There is no age gate, although internships can attract under-18s (s.9 requires verifiable parental consent).
     - Withdrawing must be as easy as consenting, and must lead to erasure (s.6(4), s.8(7)).
   - **Change:**
     - Define `HIRE_COLLECTED` and `HIRE_RIGHTS`, in English and Hindi. Name the org as the one deciding, AI screening ("not used to train"), the provider and that data leaves India, the org's retention days, and two grievance officers: the org's from `privacy_settings`, and Parikshaa's for the account.
     - Store `notice_hash` on the application.
     - Add a checkbox "Have a person read my application without AI" (`hire_applications.ai_opt_out`), which makes screening `skipped`.
     - Account creation requires "I am 18 or older"; refuse otherwise.
     - Withdrawing an application means withdrawing consent for that org, and erasure is scheduled within 30 days.
     - Add a separate platform notice for the account itself.

9. **important — Retention is global, tied only to job closure, and misses several tables**
   - **Why:**
     - `HIRE_KEEP_DAYS` is one environment value, but each org already states `retentionDays` in its notice, used by `privacy.ts:280-292`.
     - Jobs left `open` or `paused` are never closed, so rejected applicants are kept forever.
     - Nothing expires `candidate_accounts`, the resume on file, `candidate_codes` or `candidate_sessions`.
   - **Change:**
     - Store `hire_keep_days` per org, defaulting to the org's `retentionDays`, and print it in the notice (part of the hash).
     - Erase rejected and withdrawn applications `hire_keep_days` after the **rejection or withdrawal date**, whatever the job's state.
     - Close jobs automatically at `apply_by` plus 90 days.
     - Accounts inactive for 3 years get a mail and are then erased.
     - Purge code rows after 24 h and sessions 7 days after expiry.
     - Register all of this as `RetainedRecords` in `assemble.ts:183`.

10. **important — `hire_job_reports` can be read by the org being reported**
    - **Why:** the table has `org_id`. Under the house template it gets `tenant_isolation` plus a staff policy, so the reported org (possibly a scammer) reads the reporter's `candidate_id` and note, and can retaliate.
    - **Change:**
      - Give the table no staff policy at all. Add an `operator`-actor policy only, or keep it outside tenant RLS with no `parikshaa_app` SELECT except through the operator store.
      - Show the org only the outcome ("A job was taken down: reason").
      - Test: staff scope reads zero rows.

11. **important — Operator surface: cross-tenant reach, TOTP and audit are underspecified**
    - **Why:**
      - Org stats today mean iterating orgs under `staffScope` (`report-store.ts:54`). Any operator route that reuses staff services therefore has full read access to every tenant.
      - `operators` has no `totp_last_step`, while staff have replay protection (`identity-store.ts:383-384`).
      - There is no sign-in throttle, no network restriction and no append-only guarantee on `operator_audit`.
    - **Change:**
      - Add an `actor='operator'` scope whose policies allow only `organisations`, `hire_jobs` (for reports), `hire_job_reports` and SECURITY DEFINER count functions. There is no policy on applications, attempts or resumes.
      - Test: operator scope reads zero applicant rows.
      - Add `operators.totp_last_step`, a `LoginThrottle` on sign-in, `OPERATOR_ALLOW_CIDRS`, and the token in sessionStorage.
      - Make `operator_audit` append-only with a trigger, as `audit_log` is. Record reads too: candidate lookup by email, org detail.
      - The `actorKind` CHECK in the org audit gains `operator`.

12. **important — Suspension refuses only sign-in**
    - **Why:** `staff()` resolves any live session or API key (`server.ts:443-471`). A suspended scam org keeps its 12 h sessions and its keys, and its queued `hire` mails still go out.
    - **Change:**
      - `auth.resolve` refuses sessions and keys of orgs with `suspended_at`.
      - `DeliveryWorker` skips (and holds) that org's `hire` and `interview` mails.
      - The apply, offer and portal actions for that org return 404 or 410.
      - Ask the operator whether to tell that org's applicants that the job was taken down.

13. **important — The offer link can be answered by whoever holds the email**
    - **Why:**
      - "Accepts/declines once (portal or link)". Mail scanners such as Safe Links prefetch GETs, forwarded mails leak the link, and the letter PDF with the salary is behind the same link.
      - The existing offer code is even stored in clear (`0039_offers.sql`, noted in map-identity).
    - **Change:**
      - The mailed link is a deep link into `/my` and requires a candidate session.
      - Accept and decline are POST only, with confirmation, and the letter PDF is served only to that session.
      - The code is a lookup hint; never act on it alone.
      - Test: a GET on the link changes nothing.

14. **important — Signals from heuristics and models reach "high", which blocks a person's move and is unfair**
    - **Why:**
      - `high` requires an override reason to advance.
      - The design makes `high` out of:
        - a regex for resume injection, which matches an ML engineer whose resume mentions "You are an AI";
        - "same network + device", where device is a hash of the user-agent (`proxy.ts:77-78`), so a whole college on hostel Wi-Fi with stock Chrome matches;
        - the model's face check, whose accuracy varies across skin tones.
      - `proxy.ts:10-20` itself calls these "a reason for a person to look, never a finding".
    - **Change:** only these may reach `high`:
      - deterministic matches: an identical photo hash, or the same phone or resume hash in this job;
      - a human's `identity_reviewed: rejected`;
      - a viva `inconsistent` confirmed by a person.

      Everything model-derived or heuristic is capped at `warn`, shows the matched text or evidence, and lists its source as "AI" or "pattern".

15. **important — Screening fairness: redaction gaps, an evidence check against the wrong text, and proxies for gaps**
    - **Why:**
      - `redactResume` (`ai-interview.ts:39-53`) covers email, links, phone and name only.
      - The design sends free-text `answers` and profile strings unredacted.
      - The quote check compares quotes with "the resume text", but the model saw the **redacted** text, so quotes containing `[name]` fail.
      - The `gap` flag and the "experience below = 0.3" weighting are known proxies for maternity and disability.
      - Bulk "Reject" filtered by `recommendation=reject` is a rubber stamp on model output.
    - **Change:**
      - Redact answers and profile text with the same function, plus pincodes, date of birth or age, and a gendered-word list.
      - Verify quotes against the exact redacted string that was sent.
      - Remove `gap` from the flag kinds.
      - Rename `reject` to `low_match`.
      - A bulk reject whose filter includes the AI recommendation requires a typed reason; the audit records the filter and the count.
      - Before launch, run an offline counterfactual eval script: paired resumes differing only in gender, religion or caste markers must give the same levels. Record the result in the tracker.

16. **important — Prompt-injection hardening is too thin**
    - **Why:**
      - Untrusted text is wrapped as `<resume>\n${…}\n</resume>` without escaping (`ai-interview.ts:358`). A resume containing `</resume><job>…` steps out of its frame.
      - `summary` and `flags.detail` are unverified model prose shown to the decider ("Strong hire, advance now").
      - Keyword stuffing in hidden text yields verbatim "evidence" that passes the quote check.
    - **Change:**
      - Escape `<` and `>` in all untrusted text, or use per-call random-nonce tag names.
      - Cap `summary` at 600 characters and label it "AI summary — may be wrong".
      - A skill counts as `strong` only if its quotes come from at least 2 distinct places.
      - A skill term making up more than 3% of tokens raises a `warn` flag for stuffing.
      - Apply the same escaping when the application's resume is passed to `AiInterviewService.create`.

17. **important — Spam and cost amplification on public apply**
    - **Why:**
      - Each apply queues a model call on the company's spend cap. Disposable or plus-addressed accounts can burn a tenant's cap, after which real applicants get `skipped`.
      - Each apply also stores up to 2 MB, sealed, per application.
      - The existing apply throttle counts failures only, under one shared key (`placement-routes.ts:621-627`).
    - **Change:**
      - At most 20 applications per candidate per day, and no more than 5 accounts verified per /24 network per day.
      - Auto-screen at most `max(50, 10×openings)` per job per day; the rest wait for "Screen again".
      - Store the resume once per application per org and refuse a resubmitted duplicate SHA.
      - Keep a list of disposable-mail domains.
      - Use a `email_canonical_hash` (plus-tag stripped, Gmail dots removed) for the per-job UNIQUE and the duplicate signal.

18. **important — Unverified employers can harvest PII and run fee scams through Parikshaa's mailer**
    - **Why:** self-signup creates a company instantly with trial credits (`onboarding.ts:148-152`). The design lets unverified orgs publish, and offer, reject and move mails carry staff free text.
    - **Change:** until `verified_at` is set:
      - at most 2 open jobs and 300 applications per job;
      - no resume download or contact export;
      - job pages `noindex`;
      - no staff free text in candidate mails.

      Every `hire` mail and the offer page carry a fixed footer: "Parikshaa and real employers never ask you to pay. Report this". Document the verification steps (GSTIN or CIN check), and audit each verification.

19. **important — The 30-day bearer token in localStorage on shared machines**
    - **Why:** many job seekers use cyber cafés. The console and exams chose sessionStorage for exactly that reason (`console/App.tsx:96-104`; attempt tokens, per map-identity). The portal holds the phone number, the resume and the offer, and can delete the account.
    - **Change:**
      - sessionStorage by default, plus a "Keep me signed in on this device" option that uses localStorage with a 14-day sliding expiry.
      - "Sign out everywhere" revokes all sessions.
      - Deleting the account, and accepting or declining an offer, need a fresh email code (step-up).
      - Revoke sessions on erasure.

20. **nice — Blind indexes need a spec, and integrity reason 8 needs one the design lacks**
    - **Why:**
      - The duplicate check (reason 8) needs `phone_hash`, but the phone is sealed with no index.
      - A plain `resume_sha256` and a global `email_hash` correlate one person across orgs, and anyone holding a resume file can confirm it is in the database.
    - **Change:**
      - Use `blind = HMAC(HKDF(kek,"parikshaa-blind","hire"), orgId‖value)` for `email_hash`, `phone_hash` and `resume_hash`.
      - Store the application email sealed, beside its hash.
      - `ref = "A"+base32(HMAC(k, orgId‖candidateId))[0..8]`, never derived from the email.

21. **nice — Candidate-supplied content rendered in the console and on the job page**
    - **Why:** the profile `links`, `resume_name` and the Markdown-lite JD are user-controlled. CSP blocks inline script (`server.ts:394-412`), but a `javascript:` or phishing link and header injection through the filename are still possible.
    - **Change:**
      - Accept https URLs only, checked server-side by zod with a protocol check. Render with `rel="noopener noreferrer nofollow ugc"`.
      - Serve resumes with `Content-Disposition: attachment; filename*=UTF-8''<sanitised>` and the sniffed content type.
      - Show the extracted text by default.
      - Audit `hire.resume_downloaded`.

22. **nice — Data minimisation inside the org**
    - **Why:** a `viewer` (and any reviewer) gets `hire:review`, which means every job's resumes and phone numbers. `managers[]` exists but is not enforced.
    - **Change:**
      - Phone, email and resume download require `hire:decide`, or membership of the job's `managers`, or the panel for that interview.
      - A viewer sees names, round state and scores only.

23. **nice — Knockout questions can encode discrimination at scale**
    - **Why:** the builder accepts any yes/no, number or choice knockout ("Age under 30?", "Married?"). That conflicts with the RPwD Act 2016 and the Transgender Persons Act 2019 in employment, and Parikshaa would be the one filtering.
    - **Change:**
      - The server refuses knockouts whose text matches a list of protected topics (age, gender, marital status, pregnancy, religion, caste, disability).
      - The editor explains why.
      - Knockouts are shown to the candidate before applying.

24. **nice — A nested `withScope` leaks its scope into the outer transaction**
    - **Why:** a nested transaction is a savepoint that runs `set_config(..., true)` (`sql.ts`, `pgTransactionExecutor.transaction`, around lines 190-205). `RELEASE SAVEPOINT` keeps those settings. A staff or other-org call nested inside an applicant transaction leaves the rest of the outer transaction running under the inner scope. The new flows mix scopes (withdraw under staff scope after a candidate check; the cross-org erasure loop).
    - **Change:**
      - `withScope` on a transaction executor throws when the requested scope differs from the current one; otherwise it restores the outer values after RELEASE.
      - Add a test.
      - Each org in the erasure cascade gets its own top-level transaction.