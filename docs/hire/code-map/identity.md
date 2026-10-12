## Exists today

**A job candidate has no account today.** The repo says this in two places: `docs/SECURITY.md:66` ("Candidates: no accounts. A signed, short-lived token scoped to one attempt") and `docs/SPEC.md:34`. Instead, each step gives the candidate its own signed link. Nothing ties those links to one person except `(org_id, candidate_ref / roll number)` and an email address.

**Candidate links (all public, IP-throttled, no account):**
- **Test invite.**
  - Code format is `org.invitation.mac`; nothing is stored (`packages/api/src/invite-codes.ts:13-41`).
  - `POST /api/invitations/redeem` (`invitation-routes.ts:353`) turns it into an attempt JWT (`auth.ts:35-60`, expires with the window).
  - That JWT is then used on `/api/attempts/me/*` (auth: attemptToken, defined at `server.ts:338`): state, answers, drafts, run, submit, identity, snapshots, proctor-events, ledger, data, result, rechecks, feedback, probe.
  - The database scope is actor `candidate` plus `parikshaa.attempt_id` (`packages/store/src/ledger-store.ts:32-55`).
- **Apply.**
  - Code stored in `drives.apply_code` (`migrations/0034_drive_apply.sql`).
  - `GET/POST /api/apply/:code` (`placement-routes.ts:610,632`) runs `PlacementService.apply` (`placement.ts:643-666`). It takes roll number and email; with `open_to_new` it also takes name, phone, branch, batch, CGPA and backlogs (college-centric fields). It then upserts `students` and `drive_applications(stage='applied')` and returns a statusLink.
- **Status.**
  - The code is an HMAC, not stored (`placement.ts:670-705`).
  - `GET /api/status/:code` (`placement-routes.ts:501`) covers one application only. Stages are fixed: `applied|test|interview|offered|joined|rejected|withdrawn` (`store/src/placement-store.ts:55`, `0029_students_drives.sql:46`).
- **Offer.**
  - Code stored in `drive_applications.offer_code`, along with `offer_response`, `joining_date` and `offer_note` (`0039_offers.sql`).
  - `GET /api/offers/:code` and `POST /api/offers/:code/response` (`placement-routes.ts:536,573`). The candidate can answer only once.
- **Live interview room.** HMAC link `?interview=` (`interviews.ts:160-164`); `GET /api/interviews/room/:code` and `PUT …/code` (`interview-routes.ts:178,206`).
- **AI interview room.** HMAC link `?ai-interview=` (`ai-interview.ts:139-144`); `GET /api/ai-interviews/room/:code`, `/start`, `/answer` (`ai-interview-routes.ts:195-208`).

**Learner accounts (practice sites only):**
- **Tables:**
  - `learners(id, org_id, email, name, password_hash, erased_at)`, with a unique index on `(org_id, lower(email))`, and `learner_sessions(token_hash, learner_id, expires_at, revoked_at)` (`0013_practice.sql:35-59`). Both sit outside tenant row-level security (RLS).
  - `learners.email_verified_at` and `practice_sign_in(org_id, require_verified, google_enabled, google_client_id, google_client_secret)` (`0015_practice_identity.sql`).
- **Service (`practice.ts:302-359`):** `signUp`, `signIn` (argon2, decoy hash), `sessionFor`, `learner(site, bearer)`, `signOut`, `deleteAccount`. Tokens look like `pl_…`; only the SHA-256 is stored; they last 30 days (`practice.ts:48-49`).
- **Store (`practice-store.ts:340-460`):** `createLearner`, `learnerByEmail`, `learnerForSession`, `learnerById`, `queueVerification` (outbox kind `learner_email`), `eraseLearner` (blanks name and email, revokes sessions, deletes prep data). Scope is actor `learner` plus `parikshaa.learner_id` (`practice-store.ts:19-31`).
- **`PracticeIdentity` (`practice-identity.ts`):**
  - The verify link is an HMAC over org, id and email, not stored (79-106).
  - Google sign-in uses OIDC with PKCE, a sealed state and a client per org (177-238).
  - An `onVerified` hook is wired to `prepCampus.claim` (`assemble.ts:245`). That hook claims a pending grant by verified email (`0038_campus.sql` `prep_cohort_members(email, learner_id)`).
- **Routes:**
  - Auth learnerAuth or public: `POST /api/practice/:site/signup|signin|signout`, `GET|DELETE /api/practice/:site/me` (`practice-routes.ts:277,298,322,328,336`).
  - Public: `GET /practice/:site/sign-in-options`, `POST …/verify`.
  - learnerAuth: `POST …/verify/resend`.
  - Public: `GET …/auth/google` and `…/callback` (`practice-identity-routes.ts:69-168`).
  - Staff: `GET|PUT /practice-admin/sign-in` (172-200).
- **`identity-store.ts` is for staff only:** organisations (`kind: institution|company`, `0063`), staff users, sessions, TOTP, SSO, API keys. It has no candidate concept.

**Web app routing:**
- `main.tsx:11-39`: the path `/practice/<site>` loads `PracticeApp` (learner). Its routes (`PracticeApp.tsx:85-120`) are problems, contests, plan, companies, profile, signin, signup and so on. There is no jobs or applications page. The learner token is kept in localStorage per site (`practice/client.ts:162-198`).
- Every other path goes to `App.tsx:126-175`, which picks a page from the query string:
  - `?scorecard` → ScorecardCheck (public, verifies a scorecard)
  - `?shortlist` → ShortlistPage (for the **hiring manager**)
  - `?report` → ReportPage (report shared by a recruiter, staff audience)
  - `?apply` → ApplyPage (candidate)
  - `?ai-interview` → AiInterviewPage (candidate)
  - `?interview` → InterviewPage (candidate)
  - `?offer` → OfferPage (candidate)
  - `?status` → StatusPage (candidate)
  - `?demo` → practice test (public)
  - otherwise `Screens` (177-233): `?invite` → InviteGate (privacy notice, then camera check, then instructions; `InviteGate.tsx:18-175`), or `?token` / TokenGate → `Attempt` (the exam, with `useProctoring`). After the attempt closes, `Receipt` shows the ledger plus `myData` (`App.tsx:863`).
- The public pages are in `PublicPages.tsx`: ApplyPage :417, InterviewPage :578, OfferPage :704, StatusPage :831. They call `fetch` directly and their text is hard-coded English, not run through `t()`.
- **TakeHome is not a page.** `TakeHomeAnswer` (link plus notes) is rendered inside `AnswerInput.tsx:107` for a take-home question.
- **`web/src/api.ts`:** `ParikshaaClient(token)` sends the attempt bearer and only calls `/attempts/me/*` (223-400). Besides it there are `briefInvitation` / `redeemInvitation`. There is no candidate-account client.

**Personal data and sealing:**
- **Ledger:** personal fields are sealed under a data key per attempt (`store/src/sealing.ts:29-36,147-162`; `attempt_keys` in `0009_privacy.sql`). Erasing means deleting the wrapped key.
- **Records outside the ledger:** `RecordSeal` derives a key per purpose via HKDF (`sealing.ts:79-119`). It is wired in `assemble.ts:145-157` for `students` (email and phone; aad `students/org/ref/field`, `placement-store.ts:113`), `interviews`, `ai-interviews` and `accommodations`.
- **Resume:** `ai_interviews.resume` (≤60000 characters stored, `0061_ai_interview_resume.sql`) is **pasted by the recruiter**, limited to 20,000 characters (`ai-interview.ts:30`). It is sealed (`ai-interview-store.ts:150-172`) and passed through `redactResume` before the model sees it (`ai-interview.ts:39-50,358`). Candidates cannot upload a file anywhere.
- **Stored unsealed:** `invitations.email/phone` (`0006`; `invitation-store.ts:99`) and `learners.email`.
- **Consent and data rights (`privacy.ts`):**
  - The org's notice (`privacy_settings`, with `notice_version`) must be agreed before an invite is redeemed. Without it the server answers `428 consent_required` (`invitation-routes.ts:395`). The agreement goes into the ledger as a `consent_given` event with the notice hash.
  - A retention sweep (`privacy.ts:280-302`) erases closed attempts plus `interviews` and `ai_interviews` (`assemble.ts:183-186`).
  - Staff erase on request with `POST /attempts/:id/erase`. The candidate reads their own data with `GET /attempts/me/data`.
  - Learners can delete their own account.

**How data flows today (the campus "drive"):** staff create a drive and open its apply link → the candidate applies, creating `students` and `drive_applications` rows and getting a statusLink → staff use `send-test` (`placement.ts:448`), which creates `invitations` (candidate_ref = roll number) and outbox emails → InviteGate → attempt → staff move the stage → `sendOffer` → the candidate answers on OfferPage. Interviews and AI interviews are created separately by staff, with name and email typed in again; they are not linked to the application.

## How it maps to the target flow

1. **Post a job.** Partial. `drives` holds company, role, CTC, location, JD, eligibility, apply-by and exam. There are no skills, experience, openings or screening questions.
2. **Apply and a candidate portal.**
   - Works: ApplyPage and `/apply/:code`.
   - Partial: the form is college-shaped (roll number, CGPA, backlogs). Applying does `students(orgId)` and then a **scan in memory** (`placement.ts:650`). StatusPage covers one application.
   - Missing: resume upload, screening answers, consent at apply, an account, and any "all my applications" view.
3. **AI screening.** No input from the candidate side exists. The only resume in the system is the recruiter-pasted one on an AI interview.
4. **OA link by email.** Works: `send-test` → invitation → outbox email → InviteGate. The invite code is derived, so it can be re-issued at any time.
5. **Monitoring.** Works on the candidate side: InviteGate shows the notice and camera check, `IdentityCapture` runs, `useProctoring` sends photos and events.
6. **Shortlist on integrity.** No candidate-facing part.
7. **Rounds to offer.** Partial. The interview room, AI room and offer page each have their own link. StatusPage's rounds are hard-coded (`PublicPages.tsx:822-828`) and are not linked to interviews or AI interviews. There is no "my interviews" or "my tests" view.
8. **Admin.** For identity, staff only have the per-org Google sign-in settings (`/practice-admin/sign-in`). There is no platform-level candidate administration and no candidate lookup across artifacts.

**Can one candidate portal be built on learner accounts?** Yes, but only per company, and with real work:
- **Per-company portal.** Each company gets an open `practice_sites` row. Its learner becomes the applicant. Signup, verify and Google can be reused unchanged.
- **Portal across companies** ("my applications everywhere"). Learners are tied to one org. This needs a new global `candidate_accounts` table outside RLS (copy `learners` / `learner_sessions`), plus a cross-org index that holds no PII (account_id, org_id, application_id). The restrictive `tenant_isolation` policies block reading across orgs.
- **Required either way:**
  - `drive_applications.account_id`, or a new applications table.
  - A blind index (HMAC of the lowercased email), because `students.email` is sealed and cannot be queried.
  - Claim-on-verified-email, copying the `prepCampus.claim` / `onVerified` pattern.
  - A new RLS actor (e.g. `applicant` plus `parikshaa.candidate_id`).
- **The links already exist.** Every candidate link can be recomputed: `statusLink`, `InviteCodes.issue`, `interviews.link`, `aiInterviews.link`, `offerLink`. So the portal can list tests, interviews and offers by deriving their links. Exam access stays on the invite code and attempt token; the account must not grant it directly.

## Extension points and conventions

- **Routes:** `registerXRoutes(routes, deps)` with zod schemas and a `security` tag.
  - Copy `practice-identity-routes.ts`: it has public, learnerAuth and staff routes in one file.
  - For public endpoints, copy the `throttle.blocked/failed` pattern in `placement-routes.ts:501-662`.
  - Register in `server.ts:1316-1366` as an optional dependency.
  - Add a `candidateAuth` scheme next to `learnerAuth` (`server.ts:338-339`).
  - Wire the service in `assemble.ts`.
- **Store:**
  - Copy the learner methods and the `scoped()` helper in `practice-store.ts`.
  - Seal with `keys.records("<purpose>")` (`assemble.ts:145-157`) and bind the aad to the row (`placement-store.ts:113`).
- **Migrations:**
  - The next number is `0066_…`.
  - Copy the RLS loop in `0060_ai_interviews.sql`.
  - To add an outbox kind, re-declare `outbox_kind_check`. The latest version is in `0052_interview_panel.sql`.
- **Email:**
  - Queue in the same transaction as the change; the outbox row holds no PII.
  - Copy `PracticeIdentity.verificationMail` (`practice-identity.ts:118-134`) and `queueVerification` (`practice-store.ts:397`).
- **Signed links:** copy `invite-codes.ts` or `placement.ts:670-678` (HMAC with a derived key, nothing stored).
- **Consent:** reuse `ConsentRequired`, `noticeOf` and `PrivacyNotice` (`InviteGate.tsx:336`).
- **Retention:** add a `RetainedRecords` entry at `assemble.ts:183`.
- **Audit:** `exams.recordAudit(actor, action, target, detail)`.
- **Tests:**
  - `practice-identity.test.ts`, which stands in a test issuer via the `issuer` option.
  - `placement.test.ts`.
  - `web/src/PublicPages.test.tsx`.
  - `fake-model.ts` for anything that calls the model.
  - `e2e/tests/candidate.spec.ts` and `privacy.spec.ts`.
- **i18n:** add `en` keys in `web/src/i18n.tsx`; `MessageKey` and the lazy locales follow from them.
- **Web pages:** add a lazy page next to `App.tsx:14-20`, or a new path regex in `main.tsx:12`.

## Risks / gotchas

- **The docs forbid candidate accounts today** (`SECURITY.md:66`, `SPEC.md:34`). Building them needs a "Faisle" entry in `docs/PREP-TRACKER.md` and doc updates (the `CLAUDE.md` rule).
- **Tenancy:** learners and RLS are per org. A cross-company portal needs an index outside RLS (`outbox` is the precedent) or one query per org.
- **Sealed emails:** they cannot be searched in SQL. `placement.apply` loads every student per application, which is O(n). That will not scale to a public job with thousands of applicants without a blind index.
- **Inconsistent PII handling:**
  - `invitations.email/phone` and `learners.email` are stored plain.
  - `offer_code` is stored in clear, so a copy of the database could answer offers. All the other candidate codes are HMACs.
- **Gaps in consent and retention under India's data-protection law (DPDP):**
  - No consent at apply, AI interview, live interview or offer.
  - The resume is pasted by the recruiter without the candidate's consent.
  - The retention sweep skips `students`, `drive_applications` and `learners`.
  - Erasing a future account must also erase linked applications and resumes.
- **Ledger:** account IDs must not go into ledger events unsealed (`sealing.ts` PERSONAL map).
- **`candidate_ref`:** `invitations` is UNIQUE on `(org, exam, candidate_ref)`, and a roll number is a college concept. A job applicant needs a stable ref per person.
- **Rate limits:** the resend limiter (`RateLimiter`) is in-memory per instance, and the throttle keys (`apply`, `status`, `offer`) are shared.
- **Google sign-in:** it is configured per org (`practice_sign_in`). A platform-wide candidate login needs a platform client and a redirect URI.
- **Bundle budget:** web `index-*.js` is capped at 142 KB gzipped and `PublicPages-*.js` at 7 KB. A portal must be a lazy chunk with its own entry in `bundle-budget.json`; run `npm run build:clients && npm run budget`.
- **Token storage:** the learner token sits in localStorage, while attempt tokens use sessionStorage (`App.tsx:72-104`). Shared machines are the reason the exam uses sessionStorage, so decide deliberately for the portal.
- **OpenAPI:** after any route change, run `npm run openapi` to regenerate `docs/openapi.json` (`openapi.test.ts` covers it).
- **CSP and routing:** `server.ts:1387` serves the web shell for any non-`/console` HTML GET. But `main.tsx` only recognises `/practice/`, and Razorpay is allowed only on `/practice/` (`server.ts:393`).