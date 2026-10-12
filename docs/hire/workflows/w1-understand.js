// Ran 12 Oct 2026 (session 1), finished. Outputs: docs/hire/code-map/*.md. Re-run only if the code changed a lot.
export const meta = {
  name: 'hire-understand',
  description: 'Map every existing Hire subsystem (jobs/drives, tests, proctoring, interviews, platform, candidate identity) against the target job-to-offer flow',
  phases: [{ title: 'Map', detail: 'one reader per subsystem' }],
}

const TARGET = `TARGET FLOW the owner wants built end to end (company hiring portal, "Hire"):
1. Company (recruiter / hiring manager) posts a JOB (title, JD, skills, experience, location, CTC, openings, deadline, screening questions).
2. Candidates APPLY from a public job page / careers page (profile + resume + screening answers). Candidate has a portal where they track all their applications.
3. AI SCREENS applicants against the JD (resume + answers) and ranks/filters them to a level; recruiter confirms the shortlist (AI suggests, human decides — repo rule).
4. The shortlisted get an OA (online assessment) / interview LINK by email. The test is generated for the job: format, sections, fresh questions picked from the company's PRIVATE question bank (and new AI-drafted questions), set up by the hiring manager.
5. Candidate attempts the test; it is MONITORED (proctoring) and cheating/proxy is DETECTED.
6. Integrity-aware shortlist: only genuine, good candidates move ahead (many factors combined).
7. Further ROUNDS (AI interview, live interview, panel, take-home...) are created on the portal; company and candidate both TRACK progress on the same portal until FINAL OFFER (offer accept/decline, joined).
8. Admin pages to manage it all (company admin, and platform admin over companies).`

const COMMON = `You are mapping an existing TypeScript monorepo at /home/user/Parikshaa-AI-Upgrade (packages: api = HTTP server, store = Postgres + migrations, core = shared types, console = staff React app, web = candidate/learner React app, e2e = Playwright). Read the actual code — do not guess. ${TARGET}

Return a markdown report (max ~1800 words) with exactly these sections:
## Exists today
Concrete inventory: tables (migration file + key columns), store classes/methods, API routes (METHOD path, auth: staff/candidate-token/public), console/web pages and components, with file:line refs. Include how data flows between them.
## How it maps to the target flow
For each target step (1-8) that your subsystem touches: what already works, what is partial, what is missing. Be specific.
## Extension points and conventions
Where/how new code should plug in (patterns to copy: route registration, store pattern, RLS, audit log, outbox email, tests with fake model, i18n). Name the exact file to copy from.
## Risks / gotchas
Anything that would bite a builder (tenancy, RLS, sealed fields, ledger, rate limits, bundle budget, OpenAPI regen).`

const AREAS = [
  { key: 'drives', prompt: `SUBSYSTEM: placement drives / jobs / apply / rounds / offers / candidate status page / funnel. Start with packages/api/src/placement.ts, placement-routes.ts, packages/store/src/placement-store.ts, the migrations that create drive/student/offer tables (grep migrations for "drive"), funnel.ts, student-messages.ts, student-import.ts, console components Placement.tsx and DriveNetwork.tsx, and the web pages for apply / offer / status (grep packages/web/src for "apply", "OfferPage", "StatusPage"). Explain the drive data model in detail (is it college-only? does it support off-campus/company job posts? what does the public apply form collect? resume? rounds model? offer model?).` },
  { key: 'tests', prompt: `SUBSYSTEM: tests/exams creation and delivery for hiring: job-test.ts + job-test-routes.ts (JD -> test draft), roles.ts (60 role templates), question bank (packages/store/src/question-bank.ts, api bank-routes.ts, bank-import.ts, starter-packs.ts), exam model in packages/core (find exam/question/section/pool types), assemble.ts (random paper), invitations (invitation-service.ts, invitation-routes.ts, invitation-store.ts, outbox-store.ts, delivery.ts — how invite emails/SMS/WhatsApp are sent and how a candidate opens a test link), take-home and AI-assist questions. Also: is there any AI generation of NEW questions into the bank today? How private is a bank to an organisation?` },
  { key: 'integrity', prompt: `SUBSYSTEM: monitoring and cheating detection during a test, and how integrity reaches a shortlist decision: proctoring.ts + proctoring-routes.ts, packages/store/src/proctor-store.ts, migration 0059_proctoring_v2.sql, proxy.ts (+ proxy-store), code similarity (grep "similarity"), micro-viva (packages/viva and grep "viva" in api), ledger/sealing (ledger-store.ts, sealing.ts, packages/verify), results.ts, candidate-report.ts, marking.ts, web proctoring.ts/screen.ts/voice.ts/camera.ts, console AttemptReview.tsx, Proctoring.tsx, ProxyCheck.tsx, Results.tsx. List every integrity signal that exists per attempt, where it is stored, and whether any composite/aggregate "trust" or "integrity" score exists. Describe how Results lets a recruiter filter/sort/shortlist.` },
  { key: 'rounds', prompt: `SUBSYSTEM: later rounds and decisions: interviews.ts + interview-routes.ts + interview-store.ts + migration 0052_interview_panel.sql (live interview room, panel, scorecards, .ics), ai-interview.ts + ai-interview-routes.ts + ai-interview-store.ts + migrations 0060/0061 (AI interviewer), shortlists.ts + shortlist-routes.ts + shortlist-store.ts (hiring manager shortlist link), candidate-report.ts (report v2 PDF/share link), and the console pages Interviews.tsx, AiInterviews.tsx, Shortlists.tsx, and web pages for the candidate side of interviews/AI interview. Explain: are these linked to a drive/job/candidate pipeline or standalone? How would a "round" in a job pipeline reference them?` },
  { key: 'platform', prompt: `SUBSYSTEM: platform plumbing a new feature must use: server.ts and index.ts (how routes are registered, auth middleware, staff roles and permissions, rate-limit.ts), staff-auth.ts, auth.ts, tenancy (organisations table, organisations.kind from migration 0063, RLS pattern and the parikshaa_app role, tenancy.test.ts), audit log, billing/credits for companies (billing.ts — how a company pays per attempt), onboarding.ts/self-serve (company signup, HirePath card in console Home.tsx), console App.tsx navigation/routing and api.ts client pattern, console Admin.tsx (is it org admin or a platform super-admin over all organisations? is there any operator/super-admin surface or admin-cli.ts?), openapi generation (openapi.ts, schemas.ts), test conventions (how an API test spins up Postgres + fake model: look at packages/api/src/testing and a recent test like shortlists.test.ts), i18n in console (language.ts, hindi.ts), bundle-budget.json. Also list the last migration number and the migration conventions.` },
  { key: 'identity', prompt: `SUBSYSTEM: candidate identity and the candidate-facing app. Does a job candidate have an account today, or only per-test invite links/tokens? Look at practice-identity.ts / practice-identity-routes.ts (learner accounts on practice sites: email verify, Google), identity-store.ts, invite-codes.ts, web App.tsx routing (list every top-level route/page the web app serves and which are candidate vs learner vs public), web api.ts, InviteGate, AiInterview page, TakeHome, OfferPage, StatusPage, Receipt. How is resume/personal data stored and sealed (ai-interview resume in migration 0061, sealing.ts, privacy.ts retention/erasure)? Could one "candidate portal" (my applications, my tests, my interviews, my offers) be built on existing learner accounts, and what would that take? Note DPDP/consent handling that exists.` },
]

phase('Map')
const reports = await parallel(AREAS.map(a => () =>
  agent(`${COMMON}\n\n${a.prompt}`, { label: `map:${a.key}`, phase: 'Map', agentType: 'Explore' })
    .then(r => ({ key: a.key, report: r }))))
return reports.filter(Boolean)
