# Operations

Running Parikshaa for real: sizing, logs, limits, backups, and the tests that
say it holds up (ROADMAP §10, §13).

## Sizing

Measured on one 4-core machine running the load generator, the API and
Postgres 16 together, with a scripted model that takes 2 s per call
(`npm run load -w @parikshaa/e2e`). One machine playing every part makes
these a floor, not a ceiling.

Two runs, each ending with every chain verified intact:

**A realistic drive** — 1,000 candidates opening their links over ten
seconds, a draft saved every ~8 s each, a heartbeat every 30 s, follow-ups,
submissions spread over the last stretch (`1000 3 2000 8 10`):

| Route | Requests | Errors | p50 | p95 | p99 |
|---|---:|---:|---:|---:|---:|
| Save a draft | 17,534 | 0 | 3 ms | 5 ms | 9 ms |
| Heartbeat | 3,920 | 0 | 2 ms | 4 ms | 7 ms |
| Load the attempt | 1,947 | 0 | 2 ms | 5 ms | 8 ms |
| Commit an answer | 1,947 | 0 | 4 ms | 7 ms | 10 ms |
| Open the link | 1,000 | 0 | 7 ms | 14 ms | 22 ms |
| Submit | 1,000 | 0 | 5 ms | 8 ms | 11 ms |
| Follow-up (model: 2 s) | 947 | 0 | 2,004 ms | 2,006 ms | 2,009 ms |

28,850 requests in 189 s, no errors.

**A stress case** — all 1,000 opening their links within *two* seconds, and
saving a draft every ~2 s each (`1000 2 2000 2 2`): 54,409 requests in
122 s, 446 a second on average, **no errors**. Writes stayed fast (drafts p99
18 ms); opening the link slowed to p95 1.0 s, and the first page load to p95
0.55 s, while everyone arrived at once. The cost there is CPU shared by the
generator, the API and Postgres on four cores; a pool larger than 20 made it
slower, not faster.

Grading the 1,000, twenty at a time against a model taking 2 s, took 102 s:
grading throughput is set by the model and the concurrency you give it.

What that means for a sitting:

- **One API instance comfortably serves a 1,000-candidate drive.** Run two,
  behind a load balancer, for the sake of a machine failing — not for
  capacity.
- **Follow-ups and grading are bound by the model, not by this service.** A
  follow-up takes as long as the model does; grading a cohort takes
  (candidates × model latency ÷ concurrency). The real limit is the model
  provider's rate limit for your account — check it before a large drive.
- **Read replicas are not needed at this scale.** Every request is a short
  indexed read or a single-row append; the database was never the
  bottleneck in these runs.

### The database pool

`DATABASE_POOL_MAX` (default 20) is per API instance. Keep
`instances × DATABASE_POOL_MAX` under Postgres's `max_connections`, leaving
room for migrations, backups and a person with psql. For managed Postgres
with a low connection ceiling, put PgBouncer in transaction mode in front:
every query runs inside a transaction that sets its own settings
(`set_config(..., true)`), which transaction pooling supports.

## Logs

`LOG_LEVEL` (default `info`; `silent` turns them off). One JSON line per
request on stdout:

```json
{"level":30,"reqId":"…","method":"POST","route":"/attempts/me/answers","status":202,"ms":6,"org":"acme","msg":"request"}
```

The route is the *pattern*, never the URL. Bodies, query strings, headers and
error messages are never logged, because each can carry an answer, a token, a
password or someone's email address. A server fault is logged by its error
type, code and stack only. `observability.test.ts` runs a whole sitting and
fails if any answer, follow-up, reply, credential or contact detail appears in
the log.

Every response carries `x-request-id`, the `reqId` in its log line, so a
support request can be matched to its log without anyone quoting what a
candidate wrote.

A database connection that drops is logged as `database connection lost`
and replaced on the next query; it never stops the process.

## Rate limits

Per API instance, token buckets:

| Who | Rate | Burst |
|---|---|---|
| An organisation (staff sessions and API keys together) | 100/s | 400 |
| One candidate's attempt | 10/s | 60 |

Over the limit is `429` with `Retry-After`. Sign-in, invitation links and
Greenhouse's key are throttled separately, by failed attempts. Behind N
instances an organisation gets up to N times the rate: the limits are for
fairness, not billing.

## Backups and point-in-time recovery

**Use managed Postgres in an Indian region** — Amazon RDS in Mumbai
(ap-south-1) or Hyderabad (ap-south-2), Cloud SQL in Mumbai (asia-south1) or
Delhi (asia-south2), Azure in Central India — with automated backups and
point-in-time recovery on, retained at least 14 days. A drive's results are
settled within a week; two weeks covers the discovery of a problem after that.

**Self-hosting**, archive WAL continuously to object storage with pgBackRest
or WAL-G, and take a base backup nightly. A nightly `pg_dump` alone is not
point-in-time recovery: it loses everything since the dump.

The ledger makes one thing about a restore checkable that usually is not:
whether the data came back *intact*, not merely whether it came back.

**Back up as a role that bypasses row-level security.** The ledger forces
row-level security even on the schema owner, so `pg_dump` as the owner fails
(`query would be affected by row-level security policy`) — a nightly logical
backup set up the obvious way would fail every night. Create a backup role
once, as a superuser:

```sql
CREATE ROLE parikshaa_backup LOGIN PASSWORD '…' BYPASSRLS;
GRANT pg_read_all_data TO parikshaa_backup;
```

Physical backups and managed snapshots are not affected.

### The restore drill

Monthly, and after any change to how backups are taken:

```bash
npm run build
SOURCE_URL=postgres://parikshaa_backup:…@db/parikshaa \
ADMIN_URL=postgres://postgres:…@db/postgres \
DUMP=/backups/latest.dump \
./scripts/restore-drill.sh
```

It restores the dump into a scratch database, verifies every ledger chain in
it (`verify-all`), compares row counts when it took the dump itself from a
quiet source, drops the scratch database, and prints how long the restore
took — your recovery time at today's data size. Point `DUMP` at the file your
real backup job wrote: a drill of a backup nobody takes proves nothing.

For point-in-time recovery, restore to a new instance at a chosen time with
your provider's tools, then run `verify-all` against it:

```bash
DATABASE_URL=postgres://parikshaa_owner:…@restored/parikshaa npm run verify-all -w @parikshaa/api
```

Last run here, after the 1,000-candidate load run: a 1.7 MB dump restored in
under a second, 1,000 chains and 10,196 entries verified in 0.9 s, every
table's row count matching. The first attempt at it is also how the backup-
role requirement above was found.

## The hardening suites

`packages/e2e` holds three runs against a real Postgres, each also in CI
(the `e2e` job):

- **Browsers** — `npm run e2e -w @parikshaa/e2e`: a whole sitting with a
  follow-up and a receipt checked by the standalone verifier; answers typed
  offline; a follow-up whose connection drops mid-stream; resuming on
  another device; a recruiter's results, spreadsheet and report. Chrome,
  Firefox and WebKit in CI.
- **Chaos** — `npm run chaos -w @parikshaa/e2e -- 60 3`: the server
  SIGKILLed mid-write, then every database connection terminated under a
  running server. After each, every chain must verify and every candidate
  must be able to reopen their link and carry on.
- **Load** — `npm run load -w @parikshaa/e2e -- 1000 3 2000 8 10`
  (candidates, minutes, model ms, seconds between drafts, seconds over which
  everyone starts).

They need a throwaway Postgres 16 — `trust` authentication on localhost, as
CI uses, or passwords supplied through `PGPASSWORD` or `~/.pgpass` — with
three login roles and a database:

```sql
CREATE ROLE parikshaa_owner LOGIN;
CREATE ROLE parikshaa_app LOGIN;
GRANT pg_signal_backend TO parikshaa_owner;  -- the chaos run terminates connections on purpose
CREATE ROLE parikshaa_backup LOGIN BYPASSRLS;  -- for the restore drill
GRANT pg_read_all_data TO parikshaa_backup;
CREATE DATABASE parikshaa_e2e OWNER parikshaa_owner;
```

and `npm run build && npm run build:clients && npm run build -w @parikshaa/e2e`.
`E2E_OWNER_URL` and `E2E_APP_URL` override the connection strings. Each run
starts from an empty database.

### What they found

The first run against a real Postgres found three faults the in-process test
database could not, and the first restore drill a fourth (the backup role,
above):

1. The previous driver, postgres.js, serialized every `jsonb` parameter a
   second time, so every exam was stored as a JSON *string* and none could be
   loaded. Nothing had worked end to end on a real Postgres.
2. With that driver, terminating the database's connections under a running
   server threw from inside the driver's socket handling and killed the
   process (3.4.9, the latest release). A database failover would have taken
   every API instance down at once.
3. An invitation recorded its attempt id before the attempt existed, so a
   failure between the two locked that candidate out for good.

The driver is now node-postgres, and a redemption now finishes any start an
earlier one left unfinished. Each is covered by a test.
