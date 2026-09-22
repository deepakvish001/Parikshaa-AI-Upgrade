# Tech stack

Decisions and the reasoning behind them. If a choice here looks arbitrary later,
the "why" column is the part worth re-reading before changing it.

## The constraint everything else follows from

The ledger's hash must come out **byte-identical wherever it is verified** — on
the server, in the candidate's browser, in an appeals tool, and in an
institution's own auditor script. A second implementation of `canonicalize()` in
another language is how you eventually get a hash mismatch that *looks like
tampering* but is actually a float-formatting difference.

So: one language, one `@parikshaa/core`, imported everywhere. That is the reason
the stack is TypeScript end to end, and it is not a preference.

## Choices

| Layer | Choice | Why this one |
|---|---|---|
| Language / runtime | TypeScript, Node 22 | See above. Also keeps domain types shared between API and client. |
| HTTP | Fastify + Zod (`fastify-type-provider-zod`) | Schemas validate requests, generate the OpenAPI document institutions integrate against, and validate responses. Institutions need a spec, not a client library. |
| Database | PostgreSQL 16+ | The ledger's integrity properties are enforceable in the schema (below). |
| Migrations / queries | Plain SQL over a thin executor | Drizzle was the original choice; building it showed the ORM had nothing to add. The schema's value is in constraints, triggers and row-level security, which are reviewed as SQL either way, and a two-method executor interface lets the same store run against a pool in production and an in-process Postgres in tests. |
| Background jobs | pg-boss | Postgres-backed, so no Redis to run. Move to BullMQ only if throughput demands it. |
| Realtime | SSE | One-way is all probe delivery needs. Survives proxies; simpler than WebSockets. |
| LLM | Anthropic SDK, `claude-opus-5` | Two paths, different settings — see below. |
| Auth (staff) | Individual accounts: argon2id passwords, server-side sessions, scoped API keys | A shared token could not say who did anything, so the ledger could not record who set an attempt aside. Session and key secrets are stored only as SHA-256 digests. OIDC against an institution's IdP is next (ROADMAP §1). |
| Auth (candidate) | Short-lived exam-scoped JWT (`jose`) | A token that grants one attempt and expires. No candidate user records. |
| Frontend | Vite + React + TanStack Query | A focused SPA. SSR buys nothing for an exam client, and the API has to stand alone anyway. No analytics, no third-party scripts, no runtime font fetches — the page cannot observe the candidate any more than it says it does. |
| Observability | pino + OpenTelemetry + Sentry | pino is Fastify-native. |
| Deploy | One Docker image, stateless API, PgBouncer | The API serves both client bundles, so there is no second origin, no CORS configuration and no cross-origin token handling to get wrong. Exam load is bursty — 500 candidates start at 10:00 sharp — so autoscale the API tier and pool connections. Migrations run as their own task, never on boot: several instances starting at once would race. |

## Load-bearing details

### 0. These are tested against a real Postgres, not a mock

`@parikshaa/store` runs its suite against PGlite — Postgres compiled to WASM, in
process. That matters because everything in §1 *is* the product: a mocked
database would only assert that the SQL we wrote is the SQL we wrote. The
append-only trigger, the composite primary key, the row-level security policy
and jsonb drift detection each have a test that exercises the real engine.

### 0a. Organisations are isolated twice

Every tenant table carries `org_id`, and every store method takes a `Scope`
naming the organisation, so each query filters on it explicitly. That is the
first lock. The second is row-level security: each store call runs in a
transaction that sets `parikshaa.org_id` (and, for a candidate,
`parikshaa.attempt_id`), and a restrictive policy on every tenant table refuses
rows from any other organisation — so a query that forgot its filter still
cannot leak. With no organisation set, the runtime role sees nothing at all.

RLS binds only a role that does not own the tables, so the API connects as
`parikshaa_app`; docker-compose migrates as `parikshaa_owner` and then lets
`parikshaa_app` log in. The API tests run as `parikshaa_app` for the same
reason, and a mutation test (dropping a query's filter) confirmed the
isolation tests fail without RLS and pass with it.

Account tables (organisations, staff, sessions, API keys) sit outside RLS on
purpose: they are how a request finds its organisation in the first place.
Every query on them names the organisation explicitly.

### 0b. Candidate code never runs next to anything worth stealing

Code questions are executed by `@parikshaa/runner`, a separate service in a
separate container on an `internal` network: the API can reach it, and it can
reach nothing — not the database, not the model API, not the internet. It holds
one secret, the token the API uses to call it, and candidate processes cannot
read it (clean environment, different uid, `/proc/1` unreadable).

The kernel boundary is gVisor (`runtime: runsc`); the runner checks for it at
start and refuses to serve otherwise. Inside it, every run gets fresh
namespaces, its own slot uid, `prlimit` limits and a wall-clock kill, and after
every run the runner stops and kills everything that uid owns until it owns
nothing — which is what contains a fork bomb that escapes its process group.

### 1. Ledger integrity is enforced in the database, not only in app code

- `UNIQUE (attempt_id, seq)`. Two concurrent appends then fail loudly instead of
  writing two different entries at the same position and silently forking the
  chain. This is the single most important constraint in the schema.
- The application's database role holds `INSERT` and `SELECT` on the ledger
  table and nothing else. `UPDATE` and `DELETE` are revoked; migrations run as a
  separate owner role.
- Row-level security implements "the candidate can read their own ledger"
  (SPEC §6.2) in the database rather than in a handler somebody can forget.

### 2. Never recompute a hash from `jsonb`

`jsonb` stores numbers as `numeric`, so a round-trip can change how a value is
rendered (`1.0`, `1e3`). Recomputing `entryHash` from a `jsonb` read would then
report tampering that never happened. Store the event twice:

```sql
event    jsonb  -- for querying and reporting
preimage text   -- the exact canonicalize() output that was hashed
```

Verification reads `preimage`. `jsonb` is for queries only, and `LedgerStore.load`
rebuilds each entry by parsing the preimage rather than the jsonb column.
`verifyStored` compares the two and reports `jsonb_drift` when they diverge —
nothing has been tampered with at that point, but any code recomputing a hash
from jsonb would claim it had.

### 3. Reply latency is measured server-side, always

`VivaExchange.latencyMs` is an integrity signal (SPEC §4). A client that reports
its own latency can defeat that signal in one line. The timestamps are the
server's: probe-sent to reply-received.

### 4. Two LLM paths with different shapes

| | Probe generation | Verdict assessment |
|---|---|---|
| When | Candidate is waiting, mid-exam | After submission |
| Call | Fast mode (`speed: "fast"`, beta `fast-mode-2026-02-01`) + streaming | Batch API — 50% cost, no latency pressure |
| Output | Streamed text | `output_config.format` (structured) |

Two things matter here:

- **Prompt caching is a large win.** The exam, question and rubric are identical
  across every candidate taking that exam, so they go in the cached prefix with
  `ttl: "1h"`; the candidate's answer goes last, after the breakpoint. Five
  hundred candidates on one exam means one cache write and 499 cheap reads.
  Check `usage.cache_read_input_tokens` — a zero there means something is
  silently invalidating the prefix.
- **Parse verdicts with structured outputs**, not a regex over prose.
  `VivaVerdict` is a closed union; let the schema enforce it.

Both paths use `claude-opus-5`. Probe quality is where this product lives — a
probe that can be answered from the question alone is worthless — so the cheaper
models are a deliberate cost decision to take later, with measurement, not a
default.

### 4a. SSE is read with `fetch`, not `EventSource`

`EventSource` cannot send an `Authorization` header, and the alternative — the
attempt token in a query string — would leak it into proxy logs and browser
history. The client reads the event stream from `fetch`'s response body and
reassembles frames itself, which is about thirty lines and keeps the token in a
header where it belongs.

### 5. Pseudonymize before the model call

A probe needs the question, the rubric and the answer text. It never needs the
candidate's name or roll number. This costs nothing and removes most of the data
-residency problem from the LLM leg.

Related, and still open: candidate assessment records are personal data under
India's DPDP Act 2023. If Indian institutions are the market, the database
belongs in an India region (`ap-south-1`). Whether an India inference region is
available for the model calls is **unverified** — check before relying on it.
Pseudonymization holds either way.

### 5a. Response schemas are a second lock on the answer key

The candidate-facing routes declare Zod response schemas, and serialization
drops keys a schema does not name. `candidateView` already makes an answer key
impossible to express in the type system; this catches the same mistake at
runtime, on the wire, if a future change ever slips past the types. A response
that does not match its schema fails with a 500 rather than shipping an
unchecked body — the louder failure is the safer one here.

`docs/openapi.json` is generated from those same schemas and committed. A test
regenerates it and fails if the two diverge, so a route cannot change without
the published contract changing with it. `npm run openapi` regenerates it.

### 6. `@parikshaa/core` has two entry points

`.` carries everything, including `ExamLedger`, which appends and hashes with
`node:crypto`. `./browser` carries the vocabulary, the candidate projection,
exam validation, deterministic scoring — and the chain itself, which is
platform-independent.

The split is a boundary, not a packaging workaround: a client has no business
*appending*, so it has no business holding the code that does. It does have
business *checking*, so `chain.ts` walks the chain parameterized by a digest,
and both the server's `node:crypto` and a browser's WebCrypto bind to the same
walk. One implementation, two primitives, and a conformance test pinning them to
identical output — because two chain implementations would eventually disagree,
and the disagreement would look like tampering.

## Deliberately not in the stack yet

Redis, Kafka, Kubernetes, microservices, a vector database, a separate auth
service. One Postgres and one Node service until something measurably hurts.
`pg-boss` was chosen specifically so that Redis is not needed on day one.
