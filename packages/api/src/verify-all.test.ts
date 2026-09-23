import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { attemptId, candidateId, examId, orgId } from "@parikshaa/core";
import { IdentityStore, LedgerStore, pgliteExecutor, staffScope } from "@parikshaa/store";
import { freshDatabase } from "./testing/harness.js";
import { verifyAll } from "./verify-all.js";

/** ROADMAP §10: the check a restore drill ends with. */

let db: PGlite;
let store: LedgerStore;
let identity: IdentityStore;

beforeEach(async () => {
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  store = new LedgerStore(sql);
  identity = new IdentityStore(sql);
  for (const org of ["org-a", "org-b"]) {
    await identity.createOrganisation(orgId(org), org);
    const scope = staffScope(orgId(org));
    await store.createExam(scope, { id: examId("e"), title: "E", questions: [], policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 1 } });
    for (const a of ["a1", "a2"]) {
      const id = attemptId(`${org}-${a}`);
      await store.createAttempt(scope, id, examId("e"), candidateId("c"));
      await store.append(scope, id, { type: "attempt_started", attemptId: id, examId: examId("e"), candidateId: candidateId("c") });
      await store.append(scope, id, { type: "attempt_submitted", attemptId: id });
    }
  }
  await db.exec(`SET ROLE parikshaa_app`);
});

afterEach(async () => {
  await db.close();
});

describe("verifying every chain", () => {
  it("walks every organisation's attempts, as the runtime role", async () => {
    const report = await verifyAll(store, identity);
    // The seeded `default` organisation has none.
    expect(report).toEqual({ organisations: 3, attempts: 4, entries: 8, failures: [] });
  });

  it("names the attempt and entry where a chain breaks", async () => {
    await db.exec(`RESET ROLE`);
    await db.exec(`ALTER TABLE exam_ledger DISABLE TRIGGER USER`);
    await db.exec(`UPDATE exam_ledger SET hash = repeat('0', 64) WHERE attempt_id = 'org-b-a2' AND seq = 1`);
    await db.exec(`SET ROLE parikshaa_app`);

    const report = await verifyAll(store, identity);
    expect(report.failures).toEqual([{ orgId: "org-b", attemptId: "org-b-a2", seq: 1, reason: "hash_mismatch" }]);
  });
});
