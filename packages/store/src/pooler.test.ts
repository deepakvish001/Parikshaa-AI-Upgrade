import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { examId, orgId } from "@parikshaa/core";
import { LedgerStore, staffScope, withScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/**
 * Safe behind Supabase's transaction pooler (docs/F1-GO-LIVE-PLAN.md §2.3).
 * The pooler hands one server connection to many clients in turn, a
 * transaction at a time; anything a client sets for the session would be seen
 * by the next. Every tenant setting here is transaction-local, so nothing of
 * one organisation's scope outlives its transaction. One PGlite connection
 * stands in for the shared server connection.
 */

const A = orgId("org-a");
const B = orgId("org-b");
const POLICY = { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 };

let db: PGlite;
let sql: SqlExecutor;

const setting = async (name: string) =>
  (await sql.query<{ v: string | null }>(`SELECT current_setting($1, true) AS v`, [name]))[0]!.v ?? "";

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  const ledger = new LedgerStore(sql);
  await ledger.createExam(staffScope(A), { id: examId("a-exam"), title: "A's", questions: [], policy: POLICY });
  await ledger.createExam(staffScope(B), { id: examId("b-exam"), title: "B's", questions: [], policy: POLICY });
  await db.exec(`SET ROLE parikshaa_app`);
});

afterEach(async () => {
  await db.close();
});

describe("on a shared connection", () => {
  it("an organisation's scope ends with its transaction", async () => {
    const inside = await withScope(sql, staffScope(A), async (tx) => (await tx.query<{ id: string }>(`SELECT id FROM exams`)).map((r) => r.id));
    expect(inside).toEqual(["a-exam"]);
    expect(await setting("parikshaa.org_id")).toBe("");
    expect(await setting("parikshaa.actor")).toBe("");
    // The next client on the connection, with no scope of its own, sees no one's rows.
    expect(await sql.query(`SELECT id FROM exams`)).toEqual([]);
  });

  it("one after another, each sees its own rows only", async () => {
    for (const [org, exam] of [[A, "a-exam"], [B, "b-exam"], [A, "a-exam"]] as const) {
      const seen = await withScope(sql, staffScope(org), async (tx) => (await tx.query<{ id: string }>(`SELECT id FROM exams`)).map((r) => r.id));
      expect(seen).toEqual([exam]);
    }
  });

  it("a transaction that fails leaves nothing set either", async () => {
    await expect(
      withScope(sql, staffScope(A), async (tx) => {
        await tx.query(`SELECT 1`);
        throw new Error("gave up");
      }),
    ).rejects.toThrow("gave up");
    expect(await setting("parikshaa.org_id")).toBe("");
    expect(await sql.query(`SELECT id FROM exams`)).toEqual([]);
  });
});
