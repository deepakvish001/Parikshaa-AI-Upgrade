import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, candidateId, examId, orgId, questionId, verifyChain, type ExamEvent } from "@parikshaa/core";
import { InvitationStore } from "./invitation-store.js";
import { AppendRefused, LedgerStore, candidateScope, staffScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { OutboxStore } from "./outbox-store.js";
import { PrivacyStore } from "./privacy-store.js";
import { DataKeys, ERASED, openEvent, sealEvent } from "./sealing.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** ROADMAP §11: sealed personal fields, erasure by destroying the key, retention. Runs as `parikshaa_app`. */

const ORG = orgId("org-a");
const S = staffScope(ORG);
const A = attemptId("attempt-1");
const B = attemptId("attempt-2");
const E = examId("e1");
const DAY = 86_400_000;
const KEK = Buffer.alloc(32, 7).toString("base64");

let db: PGlite;
let sql: SqlExecutor;
let store: LedgerStore;
let now: number;

const started = (id = A): ExamEvent => ({ type: "attempt_started", attemptId: id, examId: E, candidateId: candidateId("ROLL-2231") });
const answered = (answer: string): ExamEvent => ({
  type: "answer_submitted",
  attemptId: A,
  response: { questionId: questionId("q1"), answer, submittedAt: 1 },
});

beforeEach(async () => {
  now = Date.parse("2026-10-01T05:00:00Z");
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A')`, [ORG]);
  store = new LedgerStore(sql, { clock: () => (now += 1000), keys: new DataKeys(KEK) });
  await store.createExam(S, { id: E, title: "E", questions: [], policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 } });
  await db.exec(`SET ROLE parikshaa_app`);
  await store.createAttempt(S, A, E, candidateId("ROLL-2231"));
  await store.append(S, A, started());
});

afterEach(async () => {
  await db.close();
});

/** Read a table as its owner, past row-level security: what someone with the database itself would see. */
async function asOwner<T>(query: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`RESET ROLE`);
  try {
    return (await db.query<T>(query, params)).rows;
  } finally {
    await db.exec(`SET ROLE parikshaa_app`);
  }
}

const raw = async () =>
  (await asOwner<{ event: unknown; preimage: string }>(`SELECT event, preimage FROM exam_ledger`)).map((r) => JSON.stringify(r.event) + r.preimage).join("\n");

describe("sealing", () => {
  it("stores what a candidate wrote only as ciphertext, and reads it back", async () => {
    await store.append(candidateScope(ORG, A), A, answered("My secret answer"));

    const stored = await raw();
    expect(stored).not.toContain("My secret answer");
    expect(stored).not.toContain("ROLL-2231");
    expect(stored).toContain("enc:v1:");

    const { opened, record } = await store.loadBoth(S, A);
    expect(opened[1]!.event).toMatchObject({ response: { answer: "My secret answer" } });
    expect(opened[0]!.event).toMatchObject({ candidateId: "ROLL-2231" });
    // The chain commits to the ciphertext, so the record — not the opened copy — is what verifies.
    expect(verifyChain(record)).toEqual({ ok: true });
    expect(record[1]!.hash).toBe(opened[1]!.hash);
  });

  it("binds each value to its attempt and field: moved elsewhere, it will not open", () => {
    const key = Buffer.alloc(32, 1);
    const sealed = sealEvent(answered("x"), key) as Extract<ExamEvent, { type: "answer_submitted" }>;
    const moved = { ...sealed, attemptId: B };
    expect(() => openEvent(moved, key)).toThrow();
    expect(openEvent(sealed, key)).toMatchObject({ response: { answer: "x" } });
  });

  it("binds each wrapped key to its attempt", () => {
    const keys = new DataKeys(KEK);
    const wrapped = keys.newWrapped(ORG, A);
    expect(() => keys.unwrap(ORG, B, wrapped)).toThrow();
    expect(keys.unwrap(ORG, A, wrapped)).toHaveLength(32);
  });

  it("refuses to read a sealed ledger without the key-encryption key", async () => {
    await expect(new LedgerStore(sql).load(S, A)).rejects.toThrow(/PARIKSHAA_DATA_KEY/);
  });

  it("can be verified by someone without the key-encryption key, who cannot read it", async () => {
    await store.append(S, A, answered("My secret answer"));
    const keyless = new LedgerStore(sql);
    const record = await keyless.loadRecord(S, A);
    expect(verifyChain(record)).toEqual({ ok: true });
    expect(await keyless.verifyStored(S, A)).toMatchObject({ ok: true });
    expect(JSON.stringify(record)).not.toContain("My secret answer");
  });

  it("reads a ledger from before sealing as it was written", async () => {
    const plain = new LedgerStore(sql, { keys: new DataKeys(KEK) });
    await db.exec(`RESET ROLE`);
    await sql.query(`INSERT INTO attempts (org_id, id, exam_id, candidate_id) VALUES ($1, $2, $3, 'old')`, [ORG, B, E]);
    await db.exec(`SET ROLE parikshaa_app`);
    await plain.append(S, B, started(B));
    expect((await plain.load(S, B))[0]!.event).toMatchObject({ candidateId: "ROLL-2231" });
  });
});

describe("erasure", () => {
  beforeEach(async () => {
    const invitations = new InvitationStore(sql);
    const [inv] = await invitations.invite(
      S,
      "e1",
      [{ candidateRef: "ROLL-2231", name: "Ananya Rao", email: "ananya@c.test", phone: "919876543210", opensAt: "2026-10-01T04:30:00Z", closesAt: "2026-10-01T07:30:00Z", hardClose: true }],
      (id) => [{ kind: "email", subject: { invitationId: id }, purpose: "reminder" }],
    );
    await invitations.claimAttempt(S, inv!.id, A);
    await store.append(S, A, answered("My secret answer"));
    await store.saveDraft(S, A, questionId("q2"), "half a thought", now);
    await store.append(S, A, { type: "attempt_submitted", attemptId: A });
  });

  it("destroys the key, and leaves a chain that still verifies but says nothing personal", async () => {
    expect(await store.erase(S, A, "request", { decidedBy: { userId: "u1", name: "Meera" } })).toBe(true);

    const { opened, record } = await store.loadBoth(S, A);
    expect(verifyChain(record)).toEqual({ ok: true });
    expect(opened.at(-1)!.event).toEqual({ type: "data_erased", attemptId: A, reason: "request", decidedBy: { userId: "u1", name: "Meera" } });
    expect(opened[1]!.event).toMatchObject({ response: { answer: ERASED, questionId: "q1" } });
    expect(opened[0]!.event).toMatchObject({ candidateId: ERASED });

    const [key] = await asOwner<{ wrapped_key: string | null; erased_at: unknown }>(`SELECT wrapped_key, erased_at FROM attempt_keys`);
    expect(key).toMatchObject({ wrapped_key: null });
    expect(key!.erased_at).not.toBeNull();
  });

  it("clears the invitation, the drafts, the attempt's candidate id and anything still to be sent", async () => {
    await store.erase(S, A, "request");

    const [inv] = await asOwner<Record<string, unknown>>(`SELECT name, email, phone, candidate_ref FROM invitations`);
    expect(inv).toMatchObject({ name: "", email: null, phone: null });
    expect(String(inv!["candidate_ref"])).toMatch(/^erased-/);
    expect(await store.loadDrafts(S, A)).toEqual([]);
    expect((await asOwner(`SELECT candidate_id, erasure_reason FROM attempts WHERE id = $1`, [A]))[0]).toEqual({
      candidate_id: "erased",
      erasure_reason: "request",
    });
    const due = await new OutboxStore(sql).claimDue(new Date(now + DAY), 10);
    expect(due.filter((d) => d.kind === "email" || d.kind === "sms")).toEqual([]);
    expect(await raw()).not.toContain("ROLL-2231");
  });

  it("happens once, and nothing personal can be written after it", async () => {
    await store.erase(S, A, "request");
    expect(await store.erase(S, A, "request")).toBe(false);
    await expect(store.append(S, A, answered("again"))).rejects.toBeInstanceOf(AppendRefused);
  });

  it("is undone by nothing: a rollback leaves the key where it was", async () => {
    await expect(store.erase(S, A, "request", { guard: () => "not now" })).rejects.toBeInstanceOf(AppendRefused);
    expect((await store.load(S, A))[1]!.event).toMatchObject({ response: { answer: "My secret answer" } });
  });
});

describe("retention", () => {
  it("finds closed attempts past the organisation's retention period, and only once it has one", async () => {
    await store.append(S, A, { type: "attempt_submitted", attemptId: A });
    const privacy = new PrivacyStore(sql);
    expect(await store.dueForErasure(S, now + 400 * DAY)).toEqual([]);

    await privacy.put(S, { controllerName: "Acme", grievanceName: "DPO", grievanceEmail: "dpo@acme.test", purpose: "Hiring", retentionDays: 30 }, new Date(now));
    expect(await store.dueForErasure(S, now + 29 * DAY)).toEqual([]);
    expect(await store.dueForErasure(S, now + 31 * DAY)).toEqual([{ attemptId: A, open: false }]);

    await store.erase(S, A, "retention");
    expect(await store.dueForErasure(S, now + 31 * DAY)).toEqual([]);
  });

  it("finds an attempt abandoned without being submitted, and says it is still open", async () => {
    await new PrivacyStore(sql).put(S, { controllerName: "Acme", grievanceName: "DPO", grievanceEmail: "dpo@acme.test", purpose: "Hiring", retentionDays: 7 }, new Date(now));
    expect(await store.dueForErasure(S, now + 6 * DAY)).toEqual([]);
    expect(await store.dueForErasure(S, now + 8 * DAY)).toEqual([{ attemptId: A, open: true }]);
  });
});

describe("privacy settings", () => {
  const settings = { controllerName: "Acme", grievanceName: "DPO", grievanceEmail: "dpo@acme.test", purpose: "Hiring", retentionDays: 180 };

  it("moves the notice version on only when its wording changes", async () => {
    const privacy = new PrivacyStore(sql);
    expect((await privacy.put(S, settings, new Date(now))).noticeVersion).toBe(1);
    expect((await privacy.put(S, settings, new Date(now))).noticeVersion).toBe(1);
    expect((await privacy.put(S, { ...settings, purpose: "Hiring and internships" }, new Date(now))).noticeVersion).toBe(2);
    expect(await privacy.get(S)).toMatchObject({ purpose: "Hiring and internships", noticeVersion: 2 });
  });

  it("are not a candidate's to read or change", async () => {
    const privacy = new PrivacyStore(sql);
    await privacy.put(S, settings, new Date(now));
    expect(await privacy.get(candidateScope(ORG, A))).toBeNull();
    await expect(privacy.put(candidateScope(ORG, A), settings, new Date(now))).rejects.toThrow();
  });
});
