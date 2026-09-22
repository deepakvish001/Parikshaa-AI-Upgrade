import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, orgId } from "@parikshaa/core";
import { LedgerStore, candidateScope, staffScope } from "./ledger-store.js";
import { InvitationStore, type InvitationDraft } from "./invitation-store.js";
import { migrate } from "./migrate.js";
import { OutboxStore } from "./outbox-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

const ORG = orgId("default");
const OTHER = orgId("other");
const S = staffScope(ORG);

const draft = (ref: string): InvitationDraft => ({
  candidateRef: ref,
  name: `Candidate ${ref}`,
  email: `${ref}@college.test`,
  phone: "919876543210",
  opensAt: "2026-10-01T04:30:00.000Z",
  closesAt: "2026-10-01T07:30:00.000Z",
  hardClose: true,
});

let db: PGlite;
let sql: SqlExecutor;
let store: InvitationStore;
let outbox: OutboxStore;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'Other')`, [OTHER]);
  await new LedgerStore(sql).createExam(S, {
    id: "e1" as never,
    title: "E",
    questions: [],
    policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
  });
  await db.exec(`SET ROLE parikshaa_app`);
  store = new InvitationStore(sql);
  outbox = new OutboxStore(sql);
});

afterEach(async () => {
  await db.close();
});

const invite = (refs: string[]) =>
  store.invite(S, "e1", refs.map(draft), (id) => [
    { kind: "email", subject: { invitationId: id }, purpose: "invite" },
    { kind: "sms", subject: { invitationId: id }, purpose: "invite" },
  ]);

describe("invitations", () => {
  it("invites and queues the messages about them together", async () => {
    const [a] = await invite(["r1"]);

    const due = await outbox.claimDue(new Date(), 10);
    expect(due.map((d) => [d.kind, d.subject["invitationId"]]).sort()).toEqual([
      ["email", a!.id],
      ["sms", a!.id],
    ]);
  });

  it("invites all of a batch or none, and queues nothing for a batch that failed", async () => {
    await invite(["r1"]);
    await expect(invite(["r2", "r1"])).rejects.toThrow();

    expect((await store.list(S, "e1")).map((i) => i.candidateRef)).toEqual(["r1"]);
    expect(await outbox.claimDue(new Date(), 10)).toHaveLength(2);
  });

  it("lets only one caller start an invitation's attempt", async () => {
    const [a] = await invite(["r1"]);

    const first = await store.claimAttempt(S, a!.id, "attempt-1");
    const second = await store.claimAttempt(S, a!.id, "attempt-2");

    expect(first).toEqual({ attemptId: "attempt-1", claimed: true });
    expect(second).toEqual({ attemptId: "attempt-1", claimed: false });
  });

  it("shows where each candidate has got to and what was sent", async () => {
    const [a] = await invite(["r1"]);
    const [item] = await outbox.claimDue(new Date(), 1);
    await outbox.sent(item!.id, new Date());

    const [status] = await store.list(S, "e1");
    expect(status).toMatchObject({ id: a!.id, attemptState: "not_started", delivery: { email: { status: "sent", purpose: "invite" } } });
  });

  it("is invisible to candidates and to other organisations", async () => {
    await invite(["r1"]);
    expect(await store.list(candidateScope(ORG, attemptId("x")), "e1")).toEqual([]);
    expect(await store.list(staffScope(OTHER), "e1")).toEqual([]);
  });
});

describe("the outbox", () => {
  it("hands each item to one worker at a time", async () => {
    await invite(["r1", "r2"]);

    const [first, second] = await Promise.all([outbox.claimDue(new Date(), 3), outbox.claimDue(new Date(), 3)]);
    const ids = [...first, ...second].map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
  });

  it("takes back an item whose worker died, once its lease runs out", async () => {
    await invite(["r1"]);
    const now = new Date();
    await outbox.claimDue(now, 10);

    expect(await outbox.claimDue(now, 10)).toEqual([]);
    const later = new Date(now.getTime() + 5 * 60_000);
    expect(await outbox.claimDue(later, 10)).toHaveLength(2);
  });

  it("retries a failure later, and gives up when told to", async () => {
    await invite(["r1"]);
    const now = new Date();
    const [item] = await outbox.claimDue(now, 1);

    await outbox.failed(item!.id, "smtp 451", new Date(now.getTime() + 60_000));
    expect((await outbox.claimDue(now, 10)).map((i) => i.id)).not.toContain(item!.id);
    const retried = await outbox.claimDue(new Date(now.getTime() + 61_000), 10);
    expect(retried.find((i) => i.id === item!.id)?.attempts).toBe(2);

    await outbox.failed(item!.id, "mailbox does not exist", null);
    expect((await outbox.recent("default")).find((r) => r.id === item!.id)).toMatchObject({ status: "failed", error: "mailbox does not exist" });
  });
});
