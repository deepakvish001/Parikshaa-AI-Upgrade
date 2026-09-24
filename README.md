# Parikshaa

> परीक्षा — *parīkṣā*, "examination"

An assessment engine that checks whether a candidate can **account for their own
answer**, instead of watching them through a webcam.

Proctoring asks "was the candidate alone?" — a question a second device has made
unanswerable. Parikshaa asks whether the candidate can defend a step, extend the
result, or say where their approach breaks. That is cheap for someone who
understood the problem and expensive for someone who obtained the answer.

Two pieces make that work:

- **Micro-viva engine** — a short follow-up exchange generated from the
  candidate's *own answer*. It produces evidence about provenance, never a
  second grade.
- **Integrity ledger** — a hash chain over every event in an attempt, so the
  candidate, the institution and an appeals board can each verify that the
  record they are shown is the one that was written.

By default: no webcam, no screen capture, no keystroke biometrics. A buyer who
needs them can turn on camera proctoring for an exam — an identity check
reviewed by a person, webcam photos, browser events — disclosed to the
candidate before they start and never an input to the grade. See
[`docs/SPEC.md`](docs/SPEC.md) for the design and its commitments, and
[`docs/STACK.md`](docs/STACK.md) for the stack and the reasoning behind it.

| The candidate's side | The institution's console |
| --- | --- |
| ![Answering, with a follow-up question](docs/screenshots/candidate-08-follow-up.png) | ![Results for a campus drive](docs/screenshots/console-06-results.png) |
| ![The coding workspace, full screen, after Submit](docs/screenshots/candidate-16-workspace.png) | ![Code similarity: two answers side by side](docs/screenshots/console-22-code-similarity.png) |

It sets the papers campus hiring and entrance tests use: coding questions in
Python, JavaScript, C, C++ and Java, LeetCode-style functions or whole programs,
run in a sandbox and graded by hidden tests; mcq with one or several right options and negative marking; numeric,
short-answer and comprehension questions; charts and figures; sections with
their own time; and a question palette with mark for review.

Every page is in [`docs/screenshots`](docs/screenshots/); the design system
behind them is in [`docs/DESIGN.md`](docs/DESIGN.md).

## Layout

```
packages/core/    domain model, integrity ledger, attempt fold, deterministic scoring
packages/viva/    micro-viva engine: probe generation, verdict assessment, rubric grading
packages/store/   PostgreSQL persistence and the schema's integrity constraints
packages/api/     HTTP API: attempts, micro-viva delivery, ledger access
packages/web/     candidate interface: sitting an exam, answering a probe, taking a receipt
packages/console/ institution console: authoring exams, issuing access codes, reviewing evidence
packages/brand/   design system: tokens, base components, the mark, the bundled typefaces
packages/verify/  offline receipt verification — no server, no database, no network
docs/SPEC.md      specification
docs/STACK.md     tech stack
docs/openapi.json the HTTP contract, generated from the route schemas
docs/ROADMAP.md   what stands between the engine and a sellable product
docs/DESIGN.md    the design system, and screenshots of every page
```

## How an attempt runs

```
POST /exams/:examId/attempts     institution starts an attempt, gets a scoped token
GET  /attempts/me                the exam, stripped of its answer key
POST /attempts/me/answers        candidate answers
GET  /attempts/me/probe          SSE: a probe is generated from their answer and streamed
POST /attempts/me/probes/:id/reply   the reply; latency is measured server-side
POST /attempts/me/submit
GET  /attempts/me/ledger         head hash during the attempt, full chain once closed
GET  /openapi.json               the full contract, generated from the same schemas
POST /attempts/:id/assess/:probeId   institution records a verdict
POST /attempts/:id/grade         institution grades
POST /attempts/:id/void          a person sets the attempt aside, with a recorded reason
GET  /attempts/:id/review        verdicts reported beside the grade, never folded into it
```

Candidate routes address the attempt as `me`, taken from the bearer token rather
than the path — there is no attempt id for a candidate to change.

The candidate sees a follow-up question, not an accusation: no warning colour, no
countdown, and no mention of integrity or verification anywhere in the interface.
See SPEC §8 for why that is a correctness requirement and not a courtesy.

Nothing in the system sets an attempt aside on its own — no verdict, no
confidence score, no combination of them. A person does that, in two steps, with
a written reason that is recorded and shown to the candidate.

## Development

Requires Node 20+.

```bash
npm install
npm test          # 748 tests; store and api run against a real Postgres (PGlite, in-process)
npm run typecheck # tsc across all packages, test files included
npm run build     # engine
npm run build:clients
npm run openapi   # regenerate docs/openapi.json; a test fails if it has drifted

npm run dev -w @parikshaa/web       # candidate interface  :5173
npm run dev -w @parikshaa/console   # institution console  :5174
# both proxy /api to the server on :3000
npm run check     # typecheck + test
```

## Running it

With Docker — one image serves the API and both clients:

```bash
export POSTGRES_PASSWORD=... ANTHROPIC_API_KEY=... \
       ATTEMPT_TOKEN_SECRET=...   # at least 32 characters
export PARIKSHAA_DATA_KEY=$(openssl rand -base64 32)  # seals answers; keep it apart from backups
export PARIKSHAA_APP_PASSWORD=... # the API's database role; RLS binds it
export RUNNER_TOKEN=...           # 32+ characters; the API's key to the code runner
export PUBLIC_URL=https://exam.example.ac.in   # where candidates open their links
# Optional delivery: SMTP_URL=smtps://user:pass@email-smtp.ap-south-1.amazonaws.com
#   EMAIL_FROM="Acme Hiring <hiring@acme.in>"  MSG91_AUTH_KEY=...  MSG91_TEMPLATE_ID=...
docker compose up --build         # needs gVisor on the host for the runner: https://gvisor.dev

# Once, per organisation: its first owner. Everyone after is added from the console.
docker compose run --rm -e PARIKSHAA_OWNER_PASSWORD=... \
  -e DATABASE_URL=postgres://parikshaa_owner:$POSTGRES_PASSWORD@db:5432/parikshaa \
  api node packages/api/dist/admin-cli.js \
  --org acme --org-name "Acme Engineering" --email hr@acme.in --name "Asha Rao"
```

The candidate interface is then at `/` and the console at `/console`, where
staff sign in with their own accounts.

Without Docker:

```bash
export DATABASE_URL=...            # Postgres 16+
export ANTHROPIC_API_KEY=...       # or an `ant auth login` profile
export ATTEMPT_TOKEN_SECRET=...
export PARIKSHAA_DATA_KEY=...       # 32 bytes, base64: seals candidates' answers
npm run build && npm run build:clients
npm run migrate                    # as the schema owner
PARIKSHAA_OWNER_PASSWORD=... npm run admin -w @parikshaa/api -- \
  --org acme --org-name "Acme Engineering" --email hr@acme.in --name "Asha Rao"
npm start                          # with DATABASE_URL as parikshaa_app
```

Code questions need the runner (`packages/runner`), which runs candidate code
and must run under gVisor; it refuses to start otherwise. Point the API at it
with `RUNNER_URL` and `RUNNER_TOKEN`. For local development only, a runner can
be started without isolation — `RUNNER_ISOLATION=unsafe-none RUNNER_TOKEN=...
npm start -w @parikshaa/runner` — and never with real candidates. Without a
runner, code questions can still be answered; they are tested when grading
finds one configured.

Webhooks and the Greenhouse connector are set up by an owner from the console's
Integrations page. Their signing secrets and keys are derived from
`ATTEMPT_TOKEN_SECRET` rather than stored, so rotating that secret also rotates
every webhook secret and Greenhouse key: warn integrators first.

Behind a load balancer or reverse proxy, set `TRUST_PROXY=true` so the login
throttle sees each client's own address rather than the proxy's.

Migrations are a separate step and never run on boot: several instances
starting at once would race, and a schema change should be deliberate.

Sizing, logs, rate limits, backups and the restore drill are in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md), with the browser, chaos and load
suites in `packages/e2e` that run against a real Postgres.

## Checking a record

A record that can only be checked by the institution holding it is not evidence.
After an attempt closes the candidate gets their head hash and the full chain,
and can check it two ways — in the browser on the receipt screen, or offline:

```bash
npx parikshaa-verify receipt.json --head <hash you noted during the exam>
```

```
VERIFIED — 8 entries, unbroken.
head ab9685e35d379583d6ea506eec9f269a40a22addad055bcb0dc13ada41327b50
The head you pinned appears in this record at its own position.

What the record says:
    0  2025-09-20T20:27:27.000Z  Attempt started
    1  2025-09-20T20:28:14.000Z  Answered q1
    2  2025-09-20T20:29:01.000Z  Follow-up asked about q1
    3  2025-09-20T20:29:48.000Z  Replied to the follow-up after 23s
    ...
```

`--head` is the check that matters. A receipt verifying on its own proves less
than it looks like: any internally consistent chain verifies, including one
written from scratch. The hash noted *during* the exam is a commitment made
before anything could be reconsidered.

## Status

Complete, tested end to end, and deployable: an institution can author an exam,
issue access codes and review; a candidate can sit it, answer a micro-viva and
leave with a verifiable receipt; and the resulting chain verifies.

Many institutions can share one deployment: each is an organisation, isolated
by row-level security as well as by every query, with its own staff accounts,
roles, API keys, audit log and model-spend cap.

Candidates still have no accounts — an institution issues access codes and
already knows who its candidates are. See `docs/SPEC.md` §7 for component
status and [`docs/ROADMAP.md`](docs/ROADMAP.md) for what comes before selling it.
