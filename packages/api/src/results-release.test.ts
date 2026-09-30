import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, examId, orgId } from "@parikshaa/core";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** Results released to candidates: each graded one told their marks once, and nobody twice. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let clock: number;
let mail: OutboxLog;
let worker: DeliveryWorker;
let invitationOf: Map<string, string>;

const call = (method: "GET" | "POST" | "PUT", token: string, url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const release = (payload: object = {}) => call("POST", owner, "/exams/drive/results/release", payload);
const emails = () => mail.sent.filter((m): m is EmailMessage => "subject" in m && m.subject.startsWith("Your result"));

beforeEach(async () => {
  clock = OPENS - 2 * HOUR;
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  mail = new OutboxLog();
  const wiring = await wire(sql, { client: {} as unknown as Anthropic, mailer: mail, now: () => clock });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await addStaff(wiring.identity, org, "watch@acme.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");

  await call("POST", owner, "/exams", {
    id: "drive",
    title: "Campus drive",
    questions: [{ id: "q1", kind: "mcq", stem: "Which sort is stable?", maxScore: 4, rubric: [], options: ["Merge sort", "Heap sort"], correctIndex: 0 }],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99, cutoff: { percent: 50 } },
  });
  await call("PUT", owner, "/exams/drive/window", { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
  const imported = await call("POST", owner, "/exams/drive/invitations/import", {
    csv: [
      "ref,name,email,phone",
      "CS001,Ananya Iyer,ananya@college.test,",
      "CS002,Rohan Das,rohan@college.test,",
      "CS003,Meera Pillai,meera@college.test,",
      "CS004,Kabir Singh,,9876543210",
    ].join("\n"),
    dryRun: false,
    channels: ["email"],
  });
  expect(imported.statusCode, imported.payload).toBe(201);
  invitationOf = new Map(
    ((await call("GET", owner, "/exams/drive/invitations")).json().invitations as { id: string; candidateRef: string }[]).map((i) => [i.candidateRef, i.id]),
  );

  const codes = new InviteCodes(TOKEN_SECRET);
  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: (org, id) => `${PUBLIC_URL}/?invite=${encodeURIComponent(codes.issue(org, id))}`,
    mailer: mail,
    sms: null,
    result: (org, invitation) => wiring.results.candidateResult(orgId(org), attemptId(invitation.attemptId!), examId(invitation.examId)),
    now: () => clock,
  });

  // Everyone sits it; three are graded, one is left to grade.
  clock = OPENS + 60_000;
  for (const [ref, answer, grade] of [
    ["CS001", "0", true],
    ["CS002", "1", true],
    ["CS003", "0", false],
    ["CS004", "0", true],
  ] as const) {
    const opened = await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", invitationOf.get(ref)!) } });
    const { token, attemptId: id } = opened.json();
    await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer });
    await call("POST", token, "/attempts/me/submit");
    if (grade) expect((await call("POST", owner, `/attempts/${id}/grade`)).statusCode).toBe(200);
  }
  await worker.tick();
  mail.sent.length = 0;
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("releasing results to candidates", () => {
  it("tells each graded candidate their marks and whether they qualified, and says who was left out", async () => {
    const res = await release();
    expect(res.statusCode, res.payload).toBe(202);
    expect(res.json()).toEqual({ sent: 2, alreadySent: 0, notGraded: 1, unreachable: 1, channels: ["email"] });

    await worker.tick();
    const sent = emails();
    expect(sent.map((e) => e.to).sort()).toEqual(["ananya@college.test", "rohan@college.test"]);
    const ananya = sent.find((e) => e.to === "ananya@college.test")!;
    expect(ananya.subject).toBe("Your result: Campus drive — Acme Engineering");
    expect(ananya.text).toContain("Acme Engineering has released the results of the Campus drive test.");
    expect(ananya.text).toContain("Your marks: 4 out of 4 (100%).");
    expect(ananya.text).toContain("You reached the qualifying mark.");
    expect(ananya.text).toMatch(/https:\/\/exam\.test\/\?invite=/);
    const rohan = sent.find((e) => e.to === "rohan@college.test")!;
    expect(rohan.text).toContain("Your marks: 0 out of 4 (0%).");
    expect(rohan.text).toContain("You did not reach the qualifying mark this time.");
  });

  it("sends nobody a second, and reaches those graded since", async () => {
    await release();
    await worker.tick();
    // The one left to grade is graded now.
    const results = (await call("GET", owner, "/exams/drive/results")).json();
    const meera = results.rows.find((r: { ref: string }) => r.ref === "CS003");
    await call("POST", owner, `/attempts/${meera.attemptId}/grade`);

    expect((await release()).json()).toEqual({ sent: 1, alreadySent: 2, notGraded: 0, unreachable: 1, channels: ["email"] });
    await worker.tick();
    expect(emails().map((e) => e.to).sort()).toEqual(["ananya@college.test", "meera@college.test", "rohan@college.test"]);
  });

  it("can leave out whether they qualified", async () => {
    await release({ outcome: false });
    await worker.tick();
    const [one] = emails();
    expect(one!.text).toContain("Your marks:");
    expect(one!.text).not.toMatch(/qualifying mark/);
  });

  it("does not send a result set aside before the message went", async () => {
    await release();
    const results = (await call("GET", owner, "/exams/drive/results")).json();
    const rohan = results.rows.find((r: { ref: string }) => r.ref === "CS002");
    expect((await call("POST", owner, `/attempts/${rohan.attemptId}/void`, { reason: "Seen using a phone" })).statusCode).toBe(200);
    await worker.tick();
    expect(emails().map((e) => e.to)).toEqual(["ananya@college.test"]);
  });

  it("is for those who read results, and is recorded", async () => {
    const invigilator = await signIn(app, "watch@acme.test");
    expect((await call("POST", invigilator, "/exams/drive/results/release", {})).statusCode).toBe(403);
    await release();
    const audit = (await call("GET", owner, "/audit")).json();
    expect(JSON.stringify(audit)).toContain("results.released");
  });
});
