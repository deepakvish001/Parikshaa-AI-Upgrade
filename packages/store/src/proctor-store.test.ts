import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, candidateId, examId, orgId } from "@parikshaa/core";
import { LedgerStore, candidateScope, staffScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { NoDataKey, ProctorStore } from "./proctor-store.js";
import { DataKeys } from "./sealing.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** ROADMAP §14: proctoring photos sealed under the attempt's key, erased with it. Runs as `parikshaa_app`. */

const ORG = orgId("org-a");
const S = staffScope(ORG);
const A = attemptId("attempt-1");
const B = attemptId("attempt-2");
const E = examId("e1");
const KEK = Buffer.alloc(32, 3).toString("base64");
const PHOTO = Buffer.from("\xff\xd8\xff\xe0 a jpeg, as far as anyone storing it cares", "binary");

let db: PGlite;
let sql: SqlExecutor;
let ledger: LedgerStore;
let proctor: ProctorStore;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A')`, [ORG]);
  const keys = new DataKeys(KEK);
  ledger = new LedgerStore(sql, { keys });
  proctor = new ProctorStore(sql, keys);
  await ledger.createExam(S, { id: E, title: "E", questions: [], policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 } });
  await db.exec(`SET ROLE parikshaa_app`);
  for (const id of [A, B]) {
    await ledger.createAttempt(S, id, E, candidateId("c"));
    await ledger.append(S, id, { type: "attempt_started", attemptId: id, examId: E, candidateId: candidateId("c") });
  }
});

afterEach(async () => {
  await db.close();
});

describe("proctoring photos", () => {
  it("are taken by the candidate, stored sealed, and opened only by staff", async () => {
    const taken = await proctor.addMedia(candidateScope(ORG, A), A, "selfie", PHOTO, new Date("2026-10-01T05:00:00Z"));
    expect(taken.sha256).toMatch(/^[0-9a-f]{64}$/);

    await db.exec(`RESET ROLE`);
    const stored = (await db.query<{ sealed: Uint8Array }>(`SELECT sealed FROM proctor_media`)).rows[0]!.sealed;
    await db.exec(`SET ROLE parikshaa_app`);
    expect(Buffer.from(stored).includes(Buffer.from("a jpeg"))).toBe(false);

    const opened = await proctor.open(S, A, taken.id);
    expect(opened?.image.equals(PHOTO)).toBe(true);
    expect(await proctor.media(candidateScope(ORG, A), A)).toEqual([]);
    expect(await proctor.media(S, A)).toEqual([expect.objectContaining({ id: taken.id, kind: "selfie" })]);
  });

  it("cannot be read as another attempt's", async () => {
    const taken = await proctor.addMedia(S, A, "snapshot", PHOTO, new Date());
    expect(await proctor.open(S, B, taken.id)).toBeNull();
    await expect(proctor.addMedia(candidateScope(ORG, A), B, "snapshot", PHOTO, new Date())).rejects.toThrow();
  });

  it("go with the attempt's personal data: unreadable, and gone", async () => {
    const taken = await proctor.addMedia(S, A, "id", PHOTO, new Date());
    await proctor.addEvent(S, A, "tab_hidden", new Date());
    await ledger.append(S, A, { type: "attempt_submitted", attemptId: A });
    await ledger.erase(S, A, "request");
    expect(await proctor.open(S, A, taken.id)).toBeNull();
    expect(await proctor.events(S, A)).toEqual([]);
    await expect(proctor.addMedia(S, A, "snapshot", PHOTO, new Date())).rejects.toBeInstanceOf(NoDataKey);
  });

  it("are summarised for the live view with the browser's events", async () => {
    const at = new Date("2026-10-01T05:00:00Z");
    await proctor.addMedia(candidateScope(ORG, A), A, "snapshot", PHOTO, at);
    await proctor.addMedia(candidateScope(ORG, A), A, "snapshot", PHOTO, new Date(at.getTime() + 60_000));
    await proctor.addEvent(candidateScope(ORG, A), A, "tab_hidden", at);
    await proctor.addEvent(candidateScope(ORG, A), A, "tab_hidden", at);
    await proctor.addEvent(candidateScope(ORG, B), B, "paste", at);
    const summary = await proctor.summary(S, E);
    expect(summary.get(A)).toEqual({ snapshots: 2, lastSnapshotAt: at.getTime() + 60_000, events: { tab_hidden: 2 } });
    expect(summary.get(B)).toEqual({ snapshots: 0, lastSnapshotAt: null, events: { paste: 1 } });
    expect(await proctor.countMedia(S, A, "snapshot")).toBe(2);
  });
});
