# Security evidence pack

What an institution's security or procurement review asks, answered from the
code, with the file that shows it. It is the evidence ROADMAP §11 promises;
it is **not** a certificate. A penetration test, an ISO 27001 or SOC 2 audit
and a signed DPA need an auditor, money and calendar time, and none has been
done yet (see the end).

To report a vulnerability, see [`.github/SECURITY.md`](../.github/SECURITY.md).

## 1. What the system holds

| Data | Whose | Where | Protection |
|---|---|---|---|
| Answers, follow-up questions and replies, a candidate's reference | Candidate | `exam_ledger` (hash-chained) and its queryable copy | AES-256-GCM under a per-attempt data key, wrapped by `PARIKSHAA_DATA_KEY` held outside the database; erasure destroys the key (`packages/store/src/sealing.ts`) |
| Name, email, phone on an invitation | Candidate | `invitations` | Cleared on erasure; row-level security limits reads to staff |
| Identity and webcam photos (only if an exam turns camera proctoring on) | Candidate | `proctor_media` | Sealed under the attempt's data key; never cached; destroyed with it |
| Drafts being typed | Candidate | `answer_drafts` | Deleted on erasure; never enter the ledger unless committed |
| Staff accounts | Staff | `staff_users` | Passwords argon2id (19 MiB, 2 passes); TOTP secrets sealed under a server-derived key |
| Sessions, API keys | Staff | `staff_sessions`, `api_keys` | Stored only as SHA-256 of the bearer value |
| Practice learners | Learners | `learners`, `practice_*` | Passwords argon2id; account deletion removes name and email |
| Payments, invoices | Organisation | `payments`, `invoices`, `credit_ledger` | No card data ever reaches Parikshaa: Razorpay Checkout collects it |

Secrets that are **derived, not stored** — invitation codes, webhook signing
secrets, the Greenhouse key, password-reset links: each is an HMAC under a
key derived from `ATTEMPT_TOKEN_SECRET`. A copy of the database signs nothing
and authenticates as no one (`invite-codes.ts`, `integration-secrets.ts`,
`staff-secrets.ts`).

## 2. Isolation between institutions

Every tenant table carries `org_id`; every store call names the organisation
**and** runs in a transaction that sets it for row-level security, with a
restrictive policy on every table. The API connects as `parikshaa_app`, which
does not own the tables, so RLS binds it; with no organisation set it sees
nothing. A mutation test (dropping a query's filter) showed the isolation
tests fail without RLS and pass with it. See STACK.md §0a and
`packages/api/src/tenancy.test.ts`.

## 3. Authentication and authorisation

- **Staff:** password (argon2id, 12+ characters), with a per-address,
  per-account throttle and constant-time answers for unknown addresses;
  optional two-step sign-in (TOTP, one-use codes, recovery codes), which an
  organisation can require of its owners; single sign-on through the
  organisation's own OpenID Connect provider with PKCE (`staff-auth.ts`,
  `staff-security.ts`, `oidc.ts`). Sessions last 12 hours and end on a
  password change, a reset, or the account being disabled.
- **Roles:** owner, author, invigilator, reviewer, viewer. An invigilator never
  receives an answer key or evidence. Permissions are checked at the route and
  again in the service.
- **API keys:** scoped to a role below owner, revocable, last use recorded.
  Setting an attempt aside and granting time are refused to keys: they are a
  person's decisions, recorded under that person's name.
- **Candidates:** no accounts. A signed, short-lived token scoped to one
  attempt; candidate routes address the attempt as `me`, so there is no id in
  the path to tamper with.

## 4. The web front ends

- Every HTML page is sent with a Content-Security-Policy allowing scripts from
  its own origin only (the console additionally Razorpay Checkout), no framing
  (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), `no-referrer` so codes
  in an address never leak to another site, `nosniff`, and HSTS when served
  over HTTPS (`server.ts`, tested in `static.test.ts`).
- No analytics, no third-party scripts, no fonts fetched at runtime on the
  candidate's page.
- Tokens are kept in `sessionStorage` (the console) — they end with the tab —
  and sent as `Authorization` headers, never cookies, so there is no CSRF
  surface. The probe stream is read with `fetch`, not `EventSource`, to keep
  the token out of URLs.
- The answer key cannot reach a candidate: `candidateView` has nowhere to put
  it in the type system, and the response schemas drop any key they do not
  name at runtime (STACK.md §5a, `openapi.test.ts`).

## 5. Outbound requests

Webhooks, Greenhouse, and OpenID Connect providers are URLs a customer typed.
All go through one guard (`safe-http.ts`): HTTPS only, no credentials in the
URL, every resolved address public (checked in the socket's own DNS lookup,
so DNS rebinding fails), no redirects, 64 KiB replies at most.

## 6. Untrusted code

Candidates' code runs in a separate service (`packages/runner`) under gVisor,
on a network with no route out, as a per-run unprivileged uid in fresh
namespaces, with CPU, memory, process, file, output and wall-clock limits. The
runner refuses to start outside gVisor. Its test suite attacks it for real:
fork bombs, memory exhaustion, output floods, network access, reading the
runner's own files (STACK.md §0b).

## 7. The AI model

Model calls carry the question, rubric and the candidate's answer — never
their name, roll number or contact details (`packages/viva/src/redact.ts`).
The model never grades on its own authority in a way a person cannot see:
verdicts are evidence beside the grade, and nothing sets an attempt aside
without a person's written reason. Every call's tokens and cost are recorded;
a per-organisation monthly cap stops spend.

## 8. Integrity of the record

Each attempt is a SHA-256 hash chain, append-only in the database (the
runtime role has no `UPDATE` or `DELETE` on it, and a trigger refuses both),
and the candidate can verify it offline without the institution
(`packages/verify`). `verify-all` checks every chain in a database; the
restore drill runs it against a restored backup.

## 9. Logging

One JSON line per request: route pattern, status, duration, organisation —
never a body, query string, header or error message. A test runs a whole
sitting and fails if an answer, a follow-up, a reply, a credential or a
contact detail reaches the log (`observability.test.ts`). Staff actions go to
an append-only audit log (`GET /audit`).

## 10. Data protection (DPDP Act 2023)

Consent before the clock starts, recorded in the ledger with the notice's
version and hash; a stated retention period with an hourly sweep; erasure by
destroying the attempt's key; a candidate's download of everything held about
them. See ROADMAP §11 and OPERATIONS.md.

**Where data lives.** The database and backups belong in an Indian region;
OPERATIONS.md names the managed services. Model calls go to Anthropic; whether
an Indian inference region is available must be confirmed with Anthropic
before a residency promise covers them. Pseudonymisation (§7) holds either
way.

**Sub-processors**, each optional except the model: Anthropic (follow-up
questions and rubric grading), your SMTP provider (email), MSG91 (SMS),
Razorpay (payments), and any ATS or webhook endpoint the institution itself
configures.

## 11. Development and supply chain

- Every change: typecheck and ~800 unit and integration tests against a real
  Postgres (PGlite), the runner's isolation suite as root, and Playwright in
  Chrome, Firefox and WebKit with axe accessibility checks, a chaos run and a
  load run against real Postgres (`.github/workflows/ci.yml`).
- **Secret scanning** of the whole git history with gitleaks, pinned by
  checksum; the repository holds no credentials, test ones included.
- **Dependency audit:** `npm audit --omit=dev --audit-level=high` fails the
  build for anything that ships; pull requests also run GitHub's dependency
  review. Dependabot proposes updates weekly.
- **Static analysis:** CodeQL's `security-extended` queries on every change
  and weekly (`.github/workflows/codeql.yml`).
- Migrations are reviewed SQL, run as a separate owner role, never on boot.

## 12. Availability and recovery

Stateless API instances behind a load balancer; a 1,000-candidate load run on
one 4-core machine completed with every chain intact. Managed Postgres with
point-in-time recovery; a restore drill that runs in CI. See OPERATIONS.md.

## Not done — and not software

| Item | Status |
|---|---|
| Independent penetration test | Not yet commissioned |
| ISO 27001 / SOC 2 | Not started; this pack is the starting evidence |
| Signed DPA with each institution | Needs legal review of a template |
| India inference region for model calls | To be confirmed with Anthropic |
| Lever, Zoho Recruit, Darwinbox connectors, MSG91 and Greenhouse sandboxes | Built or specified against published docs; not yet exercised against the live services |
