import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attemptId,
  candidateId,
  examId,
  orgId,
  questionId,
  verifyChain,
  type Exam,
  type ExamEvent,
} from "@parikshaa/core";
import { AppendRefused, LedgerStore, candidateScope, staffScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/**
 * These run against a real Postgres (PGlite, in-process). That is the point:
 * the schema's constraints are the product, and a mock would only assert that
 * the SQL we wrote is the SQL we wrote.
 */

const A = attemptId("attempt-1");
const B = attemptId("attempt-2");
const E = examId("exam-1");
const C = candidateId("cand-1");
const ORG = orgId("default");
const S = staffScope(ORG);

const exam: Exam = {
  id: E,
  title: "Test",
  questions: [],
  policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
};

let db: PGlite;
let sql: SqlExecutor;
let store: LedgerStore;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  store = new LedgerStore(sql, { clock: (() => { let t = 1_700_000_000_000; return () => (t += 1000); })() });

  await store.createExam(S, exam);
  await store.createAttempt(S, A, E, C);
  await store.createAttempt(S, B, E, candidateId("cand-2"));
});

afterEach(async () => {
  await db.close();
});

const started: ExamEvent = { type: "attempt_started", attemptId: A, examId: E, candidateId: C };
const answered = (answer: string): ExamEvent => ({
  type: "answer_submitted",
  attemptId: A,
  response: { questionId: questionId("q1"), answer, submittedAt: 1 },
});

describe("LedgerStore", () => {
  it("builds a verifying chain across appends", async () => {
    await store.append(S, A, started);
    await store.append(S, A, answered("42"));
    await store.append(S, A, { type: "attempt_submitted", attemptId: A });

    const entries = await store.load(S, A);

    expect(entries.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(verifyChain(entries)).toEqual({ ok: true });
    expect(await store.head(S, A)).toBe(entries[2]?.hash);
  });

  it("keeps each attempt's chain independent", async () => {
    await store.append(S, A, started);
    await store.append(S, B, { type: "attempt_started", attemptId: B, examId: E, candidateId: candidateId("cand-2") });

    expect((await store.load(S, A)).length).toBe(1);
    expect((await store.load(S, B)).length).toBe(1);
    expect(await store.head(S, A)).not.toBe(await store.head(S, B));
  });

  it("rejects an append to an attempt that does not exist", async () => {
    await expect(store.append(S, attemptId("ghost"), started)).rejects.toThrow(/No such attempt/);
  });

  it("refuses an UPDATE to a ledger row", async () => {
    await store.append(S, A, started);

    await expect(
      sql.query(`UPDATE exam_ledger SET event = '{}'::jsonb WHERE attempt_id = $1`, [A]),
    ).rejects.toThrow(/append-only/);
  });

  it("refuses a DELETE of a ledger row", async () => {
    await store.append(S, A, started);

    await expect(sql.query(`DELETE FROM exam_ledger WHERE attempt_id = $1`, [A])).rejects.toThrow(
      /append-only/,
    );
    expect((await store.load(S, A)).length).toBe(1);
  });

  it("refuses a second row at the same position", async () => {
    const entry = await store.append(S, A, started);

    await expect(
      sql.query(
        // Every column valid, so the only thing that can refuse this row is
        // the (attempt_id, seq) key the test is about.
        `INSERT INTO exam_ledger (org_id, attempt_id, seq, ts, event_type, event, preimage, prev_hash, hash)
         VALUES ($1, $2, $3, 1, 'attempt_submitted', '{}'::jsonb, '{}', $4, repeat('a', 64))`,
        [ORG, A, entry.seq, entry.prevHash],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("serializes concurrent appends instead of forking the chain", async () => {
    await store.append(S, A, started);

    await Promise.all([
      store.append(S, A, answered("a")),
      store.append(S, A, answered("b")),
      store.append(S, A, answered("c")),
    ]);

    const entries = await store.load(S, A);
    expect(entries.map((e) => e.seq)).toEqual([0, 1, 2, 3]);
    expect(verifyChain(entries)).toEqual({ ok: true });
  });

  it("rebuilds entries from the preimage, not the jsonb column", async () => {
    await store.append(S, A, answered("9.80"));

    const [row] = await sql.query<{ preimage: string; event: { response: { answer: string } } }>(
      `SELECT preimage, event FROM exam_ledger WHERE attempt_id = $1`,
      [A],
    );
    expect(row?.preimage).toContain('"answer":"9.80"');

    const [entry] = await store.load(S, A);
    expect(entry?.event.type).toBe("answer_submitted");
    expect(verifyChain(await store.load(S, A))).toEqual({ ok: true });
  });

  describe("append guards", () => {
    it("appends when the guard is satisfied", async () => {
      await store.append(S, A, started);

      await store.append(S, A, answered("42"), { guard: () => null });

      expect((await store.load(S, A)).length).toBe(2);
    });

    it("refuses, and writes nothing, when the guard declines", async () => {
      await store.append(S, A, started);

      await expect(
        store.append(S, A, answered("42"), { guard: () => "already done" }),
      ).rejects.toBeInstanceOf(AppendRefused);

      expect((await store.load(S, A)).length).toBe(1);
    });

    it("shows the guard the events already in the chain", async () => {
      await store.append(S, A, started);
      await store.append(S, A, answered("first"));

      let seen: string[] = [];
      await store.append(S, A, answered("second"), {
        guard: (events) => {
          seen = events.map((e) => e.type);
          return null;
        },
      });

      expect(seen).toEqual(["attempt_started", "answer_submitted"]);
    });

    it("decides against the chain as it is at append time, not as it was read", async () => {
      await store.append(S, A, started);

      // What the guard exists for: a decision taken before a slow call must be
      // re-checked once the attempt's row lock is actually held.
      const slow = (async () => {
        await new Promise((r) => setTimeout(r, 30));
        return store.append(S, A, answered("late"), {
          guard: (events) =>
            events.some((e) => e.type === "answer_submitted") ? "someone got there first" : null,
        });
      })();
      await store.append(S, A, answered("early"));

      await expect(slow).rejects.toThrow(/got there first/);
      expect((await store.load(S, A)).length).toBe(2);
    });
  });

  describe("verifyStored", () => {
    it("passes for rows written normally", async () => {
      await store.append(S, A, started);
      await store.append(S, A, answered("42"));

      expect(await store.verifyStored(S, A)).toEqual({ ok: true, length: 2 });
    });

    it("reports jsonb drift when the copy no longer matches the preimage", async () => {
      await store.append(S, A, started);
      // Simulated directly, because the append-only trigger correctly prevents
      // doing it the way a drifting database would.
      await db.exec(`ALTER TABLE exam_ledger DISABLE TRIGGER exam_ledger_append_only`);
      await sql.query(`UPDATE exam_ledger SET event = jsonb_set(event, '{type}', '"attempt_voided"')`);

      expect(await store.verifyStored(S, A)).toEqual({ ok: false, seq: 0, reason: "jsonb_drift" });
    });

    it("reports a hash that does not cover its own preimage", async () => {
      await store.append(S, A, started);
      await db.exec(`ALTER TABLE exam_ledger DISABLE TRIGGER exam_ledger_append_only`);
      await sql.query(`UPDATE exam_ledger SET hash = repeat('b', 64)`);

      expect(await store.verifyStored(S, A)).toEqual({ ok: false, seq: 0, reason: "hash_mismatch" });
    });
  });

  describe("row-level security", () => {
    it("shows a candidate only their own attempt", async () => {
      await store.append(S, A, started);
      await store.append(S, B, { type: "attempt_started", attemptId: B, examId: E, candidateId: candidateId("cand-2") });

      await db.exec(`SET ROLE parikshaa_app`);
      await sql.query(
        `SELECT set_config('parikshaa.org_id', $1, false), set_config('parikshaa.attempt_id', $2, false)`,
        [ORG, A],
      );

      const visible = await sql.query<{ attempt_id: string }>(`SELECT attempt_id FROM exam_ledger`);

      expect(visible.map((r) => r.attempt_id)).toEqual([A]);
    });

    it("denies the runtime role any way to rewrite the record", async () => {
      await store.append(S, A, started);
      await db.exec(`SET ROLE parikshaa_app`);
      await sql.query(
        `SELECT set_config('parikshaa.org_id', $1, false), set_config('parikshaa.attempt_id', $2, false)`,
        [ORG, A],
      );

      await expect(sql.query(`UPDATE exam_ledger SET hash = repeat('c', 64)`)).rejects.toThrow();
      await expect(sql.query(`DELETE FROM exam_ledger`)).rejects.toThrow();
    });
  });

  /**
   * Two organisations, run as the runtime role, so row-level security is live.
   *
   * Every store query names its organisation; these check the second lock —
   * that the database itself refuses other organisations' rows, which is what
   * holds if a query here ever forgets its filter.
   */
  describe("tenancy under the runtime role", () => {
    const OTHER = orgId("other");
    const O = staffScope(OTHER);

    beforeEach(async () => {
      await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'Other')`, [OTHER]);
      await store.append(S, A, started);
      // The same exam id in the other organisation, with different content.
      await store.createExam(O, { ...exam, title: "Other's exam" });
      await store.createAttempt(O, attemptId("attempt-o"), E, candidateId("cand-o"));
      await store.append(O, attemptId("attempt-o"), {
        type: "attempt_started",
        attemptId: attemptId("attempt-o"),
        examId: E,
        candidateId: candidateId("cand-o"),
      });
      await store.appendAudit(O, { actorKind: "system", actorId: null, action: "test.other" });
      await db.exec(`SET ROLE parikshaa_app`);
    });

    it("keeps each organisation's exams apart, even under the same id", async () => {
      expect((await store.loadExam(S, E))?.title).toBe("Test");
      expect((await store.loadExam(O, E))?.title).toBe("Other's exam");
      expect((await store.listAttempts(O, E)).map((a) => a.id)).toEqual(["attempt-o"]);
    });

    it("works end to end as the runtime role", async () => {
      await store.append(S, A, answered("x"));
      expect(verifyChain(await store.load(S, A))).toEqual({ ok: true });
      expect(await store.verifyStored(S, A)).toMatchObject({ ok: true, length: 2 });
    });

    it("refuses another organisation's rows to a query that forgets its filter", async () => {
      const unfiltered = await sql.transaction(async (tx) => {
        await tx.query(`SELECT set_config('parikshaa.org_id', $1, true), set_config('parikshaa.actor', 'staff', true)`, [ORG]);
        return {
          exams: await tx.query<{ title: string }>(`SELECT title FROM exams`),
          attempts: await tx.query<{ id: string }>(`SELECT id FROM attempts ORDER BY id`),
          ledger: await tx.query<{ attempt_id: string }>(`SELECT DISTINCT attempt_id FROM exam_ledger`),
          audit: await tx.query<{ action: string }>(`SELECT action FROM audit_log`),
        };
      });

      expect(unfiltered.exams.map((r) => r.title)).toEqual(["Test"]);
      expect(unfiltered.attempts.map((r) => r.id)).toEqual([A, B]);
      expect(unfiltered.ledger.map((r) => r.attempt_id)).toEqual([A]);
      expect(unfiltered.audit).toEqual([]);
    });

    it("shows nothing at all when no organisation is set", async () => {
      // Fail closed: a code path that never set a scope sees an empty database
      // rather than every tenant's.
      expect(await sql.query(`SELECT id FROM exams`)).toEqual([]);
      expect(await sql.query(`SELECT id FROM attempts`)).toEqual([]);
      expect(await sql.query(`SELECT seq FROM exam_ledger`)).toEqual([]);
    });

    it("refuses a write into another organisation", async () => {
      await expect(
        sql.transaction(async (tx) => {
          await tx.query(`SELECT set_config('parikshaa.org_id', $1, true)`, [ORG]);
          await tx.query(`INSERT INTO exams (org_id, id, title, definition) VALUES ($1, 'x', 'x', '{}')`, [OTHER]);
        }),
      ).rejects.toThrow();
    });

    it("does not let one organisation append to another's attempt", async () => {
      await expect(store.append(S, attemptId("attempt-o"), answered("x"))).rejects.toThrow(/No such attempt/);
    });

    it("keeps a candidate to their own attempt within the organisation", async () => {
      await store.append(S, B, { type: "attempt_started", attemptId: B, examId: E, candidateId: candidateId("cand-2") });

      expect(await store.load(candidateScope(ORG, A), B)).toEqual([]);
      expect(await store.load(candidateScope(ORG, A), A)).toHaveLength(1);
      // Right attempt id, wrong organisation.
      expect(await store.load(candidateScope(OTHER, A), A)).toEqual([]);
    });

    it("keeps the audit log append-only for the runtime role", async () => {
      await store.appendAudit(S, { actorKind: "system", actorId: null, action: "test.mine" });

      await expect(sql.query(`UPDATE audit_log SET action = 'rewritten'`)).rejects.toThrow();
      await expect(sql.query(`DELETE FROM audit_log`)).rejects.toThrow();
      expect((await store.listAudit(S)).map((e) => e.action)).toEqual(["test.mine"]);
    });

    it("reports model spend per organisation", async () => {
      const usage = {
        attemptId: A,
        route: "probe" as const,
        model: "claude-opus-5",
        speed: "standard" as const,
        inputTokens: 1000,
        outputTokens: 100,
        cacheReadTokens: 0,
        cacheWrite5mTokens: 0,
        cacheWrite1hTokens: 0,
        costMicroUsd: 7500,
        inferenceGeo: "global",
      };
      await store.recordUsage(S, usage);
      await store.recordUsage(O, { ...usage, attemptId: attemptId("attempt-o"), costMicroUsd: 1 });

      const since = new Date(0);
      expect(await store.spendSince(S, since)).toBe(7500);
      const report = await store.usageReport(S, since);
      expect(report.routes).toEqual([expect.objectContaining({ route: "probe", calls: 1, costMicroUsd: 7500 })]);
      expect(report.perAttempt).toMatchObject({ attempts: 1, p50MicroUsd: 7500, maxMicroUsd: 7500 });
      expect(report.inferenceGeos).toEqual([{ geo: "global", calls: 1 }]);
    });
  });
});
