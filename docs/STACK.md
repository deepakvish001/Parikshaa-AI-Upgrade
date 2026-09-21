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
| HTTP | Fastify + Zod (`fastify-type-provider-zod`) | Schemas generate the OpenAPI spec. Institutions integrate against this; they need a spec, not a client library. |
| Database | PostgreSQL 16+ | The ledger's integrity properties are enforceable in the schema (below). |
| Migrations / queries | Plain SQL over a thin executor | Drizzle was the original choice; building it showed the ORM had nothing to add. The schema's value is in constraints, triggers and row-level security, which are reviewed as SQL either way, and a two-method executor interface lets the same store run against a pool in production and an in-process Postgres in tests. |
| Background jobs | pg-boss | Postgres-backed, so no Redis to run. Move to BullMQ only if throughput demands it. |
| Realtime | SSE | One-way is all probe delivery needs. Survives proxies; simpler than WebSockets. |
| LLM | Anthropic SDK, `claude-opus-5` | Two paths, different settings — see below. |
| Auth (staff) | OIDC against the institution's IdP | Identity is out of scope (SPEC §2). Don't build accounts. |
| Auth (candidate) | Short-lived exam-scoped JWT (`jose`) | A token that grants one attempt and expires. No candidate user records. |
| Frontend | Vite + React + TanStack Query | A focused SPA. SSR buys nothing for an exam client, and the API has to stand alone anyway. |
| Observability | pino + OpenTelemetry + Sentry | pino is Fastify-native. |
| Deploy | Docker, stateless API, PgBouncer | Exam load is bursty — 500 candidates start at 10:00 sharp. Autoscale the API tier; pool connections. |

## Load-bearing details

### 0. These are tested against a real Postgres, not a mock

`@parikshaa/store` runs its suite against PGlite — Postgres compiled to WASM, in
process. That matters because everything in §1 *is* the product: a mocked
database would only assert that the SQL we wrote is the SQL we wrote. The
append-only trigger, the composite primary key, the row-level security policy
and jsonb drift detection each have a test that exercises the real engine.

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

### 5. Pseudonymize before the model call

A probe needs the question, the rubric and the answer text. It never needs the
candidate's name or roll number. This costs nothing and removes most of the data
-residency problem from the LLM leg.

Related, and still open: candidate assessment records are personal data under
India's DPDP Act 2023. If Indian institutions are the market, the database
belongs in an India region (`ap-south-1`). Whether an India inference region is
available for the model calls is **unverified** — check before relying on it.
Pseudonymization holds either way.

## Deliberately not in the stack yet

Redis, Kafka, Kubernetes, microservices, a vector database, a separate auth
service. One Postgres and one Node service until something measurably hurts.
`pg-boss` was chosen specifically so that Redis is not needed on day one.
