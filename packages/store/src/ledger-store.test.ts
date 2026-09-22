import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attemptId,
  candidateId,
  examId,
  questionId,
  verifyChain,
  type ExamEvent,
} from "@parikshaa/core";
import { AppendRefused, LedgerStore } from "./ledger-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/**
 * These run against a real Postgres (PGlite, in-process). That is the point:
 * the schema's constraints are the product, and a mock would only assert that
 * the SQL we wrote is the SQL we wrote.
 */

const migration = (name: string) =>
  readFile(fileURLToPath(new URL(`../migrations/${name}`, import.meta.url)), "utf8");

const A = attemptId("attempt-1");
const B = attemptId("attempt-2");
const E = examId("exam-1");
const C = candidateId("cand-1");

let db: PGlite;
let sql: SqlExecutor;
let store: LedgerStore;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(await migration("0001_init.sql"));
  sql = pgliteExecutor(db);
  store = new LedgerStore(sql, { clock: (() => { let t = 1_700_000_000_000; return () => (t += 1000); })() });

  await sql.query(`INSERT INTO exams (id, title, definition) VALUES ($1, $2, $3)`, [
    E,
    "Test",
    JSON.stringify({ id: E, title: "Test", questions: [], policy: {} }),
  ]);
  await store.createAttempt(A, E, C);
  await store.createAttempt(B, E, candidateId("cand-2"));
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
    await store.append(A, started);
    await store.append(A, answered("42"));
    await store.append(A, { type: "attempt_submitted", attemptId: A });

    const entries = await store.load(A);

    expect(entries.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(verifyChain(entries)).toEqual({ ok: true });
    expect(await store.head(A)).toBe(entries[2]?.hash);
  });

  it("keeps each attempt's chain independent", async () => {
    await store.append(A, started);
    await store.append(B, { type: "attempt_started", attemptId: B, examId: E, candidateId: candidateId("cand-2") });

    expect((await store.load(A)).length).toBe(1);
    expect((await store.load(B)).length).toBe(1);
    expect(await store.head(A)).not.toBe(await store.head(B));
  });

  it("rejects an append to an attempt that does not exist", async () => {
    await expect(store.append(attemptId("ghost"), started)).rejects.toThrow(/No such attempt/);
  });

  it("refuses an UPDATE to a ledger row", async () => {
    await store.append(A, started);

    await expect(
      sql.query(`UPDATE exam_ledger SET event = '{}'::jsonb WHERE attempt_id = $1`, [A]),
    ).rejects.toThrow(/append-only/);
  });

  it("refuses a DELETE of a ledger row", async () => {
    await store.append(A, started);

    await expect(sql.query(`DELETE FROM exam_ledger WHERE attempt_id = $1`, [A])).rejects.toThrow(
      /append-only/,
    );
    expect((await store.load(A)).length).toBe(1);
  });

  it("refuses a second row at the same position", async () => {
    const entry = await store.append(A, started);

    await expect(
      sql.query(
        `INSERT INTO exam_ledger (attempt_id, seq, ts, event_type, event, preimage, prev_hash, hash)
         VALUES ($1, $2, 1, 'attempt_submitted', '{}'::jsonb, '{}', $3, repeat('a', 64))`,
        [A, entry.seq, entry.prevHash],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it("serializes concurrent appends instead of forking the chain", async () => {
    await store.append(A, started);

    await Promise.all([
      store.append(A, answered("a")),
      store.append(A, answered("b")),
      store.append(A, answered("c")),
    ]);

    const entries = await store.load(A);
    expect(entries.map((e) => e.seq)).toEqual([0, 1, 2, 3]);
    expect(verifyChain(entries)).toEqual({ ok: true });
  });

  it("rebuilds entries from the preimage, not the jsonb column", async () => {
    await store.append(A, answered("9.80"));

    const [row] = await sql.query<{ preimage: string; event: { response: { answer: string } } }>(
      `SELECT preimage, event FROM exam_ledger WHERE attempt_id = $1`,
      [A],
    );
    expect(row?.preimage).toContain('"answer":"9.80"');

    const [entry] = await store.load(A);
    expect(entry?.event.type).toBe("answer_submitted");
    expect(verifyChain(await store.load(A))).toEqual({ ok: true });
  });

  describe("append guards", () => {
    it("appends when the guard is satisfied", async () => {
      await store.append(A, started);

      await store.append(A, answered("42"), { guard: () => null });

      expect((await store.load(A)).length).toBe(2);
    });

    it("refuses, and writes nothing, when the guard declines", async () => {
      await store.append(A, started);

      await expect(
        store.append(A, answered("42"), { guard: () => "already done" }),
      ).rejects.toBeInstanceOf(AppendRefused);

      expect((await store.load(A)).length).toBe(1);
    });

    it("shows the guard the events already in the chain", async () => {
      await store.append(A, started);
      await store.append(A, answered("first"));

      let seen: string[] = [];
      await store.append(A, answered("second"), {
        guard: (events) => {
          seen = events.map((e) => e.type);
          return null;
        },
      });

      expect(seen).toEqual(["attempt_started", "answer_submitted"]);
    });

    it("decides against the chain as it is at append time, not as it was read", async () => {
      await store.append(A, started);

      // What the guard exists for: a decision taken before a slow call must be
      // re-checked once the attempt's row lock is actually held.
      const slow = (async () => {
        await new Promise((r) => setTimeout(r, 30));
        return store.append(A, answered("late"), {
          guard: (events) =>
            events.some((e) => e.type === "answer_submitted") ? "someone got there first" : null,
        });
      })();
      await store.append(A, answered("early"));

      await expect(slow).rejects.toThrow(/got there first/);
      expect((await store.load(A)).length).toBe(2);
    });
  });

  describe("verifyStored", () => {
    it("passes for rows written normally", async () => {
      await store.append(A, started);
      await store.append(A, answered("42"));

      expect(await store.verifyStored(A)).toEqual({ ok: true, length: 2 });
    });

    it("reports jsonb drift when the copy no longer matches the preimage", async () => {
      await store.append(A, started);
      // Simulated directly, because the append-only trigger correctly prevents
      // doing it the way a drifting database would.
      await db.exec(`ALTER TABLE exam_ledger DISABLE TRIGGER exam_ledger_append_only`);
      await sql.query(`UPDATE exam_ledger SET event = jsonb_set(event, '{type}', '"attempt_voided"')`);

      expect(await store.verifyStored(A)).toEqual({ ok: false, seq: 0, reason: "jsonb_drift" });
    });

    it("reports a hash that does not cover its own preimage", async () => {
      await store.append(A, started);
      await db.exec(`ALTER TABLE exam_ledger DISABLE TRIGGER exam_ledger_append_only`);
      await sql.query(`UPDATE exam_ledger SET hash = repeat('b', 64)`);

      expect(await store.verifyStored(A)).toEqual({ ok: false, seq: 0, reason: "hash_mismatch" });
    });
  });

  describe("row-level security", () => {
    it("shows a candidate only their own attempt", async () => {
      await store.append(A, started);
      await store.append(B, { type: "attempt_started", attemptId: B, examId: E, candidateId: candidateId("cand-2") });

      await db.exec(await migration("0002_roles.sql"));
      await db.exec(`SET ROLE parikshaa_app`);
      await sql.query(`SELECT set_config('parikshaa.attempt_id', $1, false)`, [A]);

      const visible = await sql.query<{ attempt_id: string }>(`SELECT attempt_id FROM exam_ledger`);

      expect(visible.map((r) => r.attempt_id)).toEqual([A]);
    });

    it("denies the runtime role any way to rewrite the record", async () => {
      await store.append(A, started);
      await db.exec(await migration("0002_roles.sql"));
      await db.exec(`SET ROLE parikshaa_app`);
      await sql.query(`SELECT set_config('parikshaa.attempt_id', $1, false)`, [A]);

      await expect(sql.query(`UPDATE exam_ledger SET hash = repeat('c', 64)`)).rejects.toThrow();
      await expect(sql.query(`DELETE FROM exam_ledger`)).rejects.toThrow();
    });
  });
});
