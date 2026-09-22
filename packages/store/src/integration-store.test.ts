import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, candidateId, examId, orgId } from "@parikshaa/core";
import { IntegrationStore } from "./integration-store.js";
import { LedgerStore, candidateScope, staffScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { OutboxStore } from "./outbox-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** ROADMAP §7, the store's part: events announced with the ledger, and webhooks kept per organisation. */

const ORG = orgId("default");
const OTHER = orgId("other");
const S = staffScope(ORG);
const A = attemptId("a1");
const E = examId("e1");

let db: PGlite;
let sql: SqlExecutor;
let ledger: LedgerStore;
let store: IntegrationStore;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'Other')`, [OTHER]);
  ledger = new LedgerStore(sql);
  await ledger.createExam(S, { id: E, title: "E", questions: [], policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 } });
  await ledger.createAttempt(S, A, E, candidateId("c1"));
  await db.exec(`SET ROLE parikshaa_app`);
  store = new IntegrationStore(sql);
});

afterEach(async () => {
  await db.close();
});

describe("announcing events", () => {
  it("queues an announcement with each start, submission and grade, in the same transaction", async () => {
    await ledger.append(S, A, { type: "attempt_started", attemptId: A, examId: E, candidateId: candidateId("c1") });
    // A candidate's own submission announces too, though they cannot read the outbox or webhooks.
    await ledger.append(candidateScope(ORG, A), A, { type: "attempt_submitted", attemptId: A });
    await ledger.append(S, A, { type: "attempt_graded", attemptId: A, total: 0 });

    const due = await new OutboxStore(sql).claimDue(new Date(Date.now() + 1000), 10);

    const announced = [...due].sort((x, y) => Number(x.subject["seq"]) - Number(y.subject["seq"]));
    expect(announced.map((d) => [d.kind, d.purpose, d.subject["event"], d.subject["seq"]])).toEqual([
      ["webhook", "event", "attempt.started", 0],
      ["webhook", "event", "attempt.submitted", 1],
      ["webhook", "event", "attempt.graded", 2],
    ]);
  });

  it("announces nothing for an append that did not happen", async () => {
    await ledger.append(S, A, { type: "attempt_started", attemptId: A, examId: E, candidateId: candidateId("c1") });
    await expect(ledger.append(S, A, { type: "attempt_submitted", attemptId: A }, { guard: () => "closed" })).rejects.toThrow();

    const due = await new OutboxStore(sql).claimDue(new Date(Date.now() + 1000), 10);
    expect(due.map((d) => d.subject["event"])).toEqual(["attempt.started"]);
  });
});

describe("webhooks", () => {
  it("finds the active hooks that want an event", async () => {
    const all = await store.addWebhook(S, { url: "https://a.test/hook", events: [], description: "" });
    const graded = await store.addWebhook(S, { url: "https://b.test/hook", events: ["attempt.graded"], description: "" });
    const gone = await store.addWebhook(S, { url: "https://c.test/hook", events: [], description: "" });
    await store.disableWebhook(S, gone.id);

    expect((await store.subscribers(S, "attempt.graded")).map((h) => h.id)).toEqual([all.id, graded.id]);
    expect((await store.subscribers(S, "attempt.started")).map((h) => h.id)).toEqual([all.id]);
  });

  it("rotates a secret by version, and not for a disabled hook", async () => {
    const hook = await store.addWebhook(S, { url: "https://a.test/hook", events: [], description: "" });
    expect((await store.rotateWebhook(S, hook.id))!.version).toBe(2);
    await store.disableWebhook(S, hook.id);
    expect(await store.rotateWebhook(S, hook.id)).toBeNull();
  });

  it("keeps each organisation's hooks and Greenhouse settings to itself, and from candidates", async () => {
    await store.addWebhook(S, { url: "https://a.test/hook", events: [], description: "" });
    await store.issueGreenhouseKey(S);

    expect(await store.webhooks(staffScope(OTHER))).toEqual([]);
    expect(await store.greenhouse(staffScope(OTHER))).toBeNull();
    expect(await store.webhooks(candidateScope(ORG, A))).toEqual([]);
    expect(await store.greenhouse(candidateScope(ORG, A))).toBeNull();
  });
});

describe("the Greenhouse key", () => {
  it("is issued at version 1, and a reissue moves the version on", async () => {
    expect(await store.issueGreenhouseKey(S)).toEqual({ keyVersion: 1, enabled: true });
    await store.disableGreenhouse(S);
    expect(await store.greenhouse(S)).toEqual({ keyVersion: 1, enabled: false });
    expect(await store.issueGreenhouseKey(S)).toEqual({ keyVersion: 2, enabled: true });
  });
});
