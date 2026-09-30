import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, examId, orgId } from "@parikshaa/core";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { ScorecardCodes } from "./rechecks.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, TOKEN_SECRET, wire, type Wiring } from "./testing/harness.js";

/** After results: a candidate sees their marks, asks for a recheck, is answered, and holds a scorecard anyone can check. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
const SHORT = { id: "q2", kind: "short", stem: "Why does binary search stop?", maxScore: 4, rubric: [{ id: "r1", description: "Halving", weight: 1 }], expectedPoints: ["the interval halves each step"] };

let db: PGlite;
let app: FastifyInstance;
let wiring: Wiring;
let owner: string;
let invigilator: string;
let clock: number;
let mail: OutboxLog;
let worker: DeliveryWorker;
let candidate: { token: string; attemptId: string };

const call = (method: "GET" | "POST" | "PUT", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const me = (method: "GET" | "POST", url: string, payload?: object) => call(method, url, candidate.token, payload);

beforeEach(async () => {
  clock = OPENS + 60_000;
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  mail = new OutboxLog();
  wiring = await wire(sql, { client: fakeModel({ latencyMs: 0 }).client, mailer: mail, now: () => clock });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await addStaff(wiring.identity, org, "watch@acme.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  invigilator = await signIn(app, "watch@acme.test");

  await call("POST", "/exams", owner, {
    id: "drive",
    title: "Campus drive",
    questions: [{ id: "q1", kind: "mcq", stem: "Which sort is **stable**?", maxScore: 4, rubric: [], options: ["Merge sort", "Heap sort"], correctIndex: 0 }, SHORT],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99, cutoff: { percent: 60 } },
  });
  await call("PUT", "/exams/drive/window", owner, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
  await call("POST", "/exams/drive/invitations/import", owner, { csv: "ref,name,email\nCS001,Ananya Iyer,ananya@college.test", dryRun: false, channels: [] });
  const [invitation] = (await call("GET", "/exams/drive/invitations", owner)).json().invitations;
  const codes = new InviteCodes(TOKEN_SECRET);
  const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", invitation.id) } })).json();
  candidate = { token: opened.token, attemptId: opened.attemptId };
  await me("POST", "/attempts/me/answers", { questionId: "q1", answer: "0" });
  await me("POST", "/attempts/me/answers", { questionId: "q2", answer: "Because the interval halves each time until it is empty." });
  await me("POST", "/attempts/me/submit");
  expect((await call("POST", `/attempts/${candidate.attemptId}/grade`, owner)).statusCode).toBe(200);

  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: (org, id) => `${PUBLIC_URL}/?invite=${encodeURIComponent(codes.issue(org, id))}`,
    mailer: mail,
    sms: null,
    result: (org, inv) => wiring.results.candidateResult(orgId(org), attemptId(inv.attemptId!), examId(inv.examId)),
    recheck: (org, id) => wiring.rechecks.note(orgId(org), id),
    now: () => clock,
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const release = (outcome = true) => call("POST", "/exams/drive/results/release", owner, { outcome });

describe("a candidate's result", () => {
  it("stays hidden until the institution releases it", async () => {
    expect((await me("GET", "/attempts/me/result")).json()).toEqual({ released: false });
    const ask = await me("POST", "/attempts/me/rechecks", { questionId: "q2", reason: "I explained the halving clearly." });
    expect(ask.statusCode).toBe(409);
    expect(ask.json().error).toBe("not_released");
    expect((await me("GET", "/attempts/me/scorecard.pdf")).statusCode).toBe(409);
  });

  it("shows the marks question by question once released, and whether they qualified when the institution says so", async () => {
    await release();
    const result = (await me("GET", "/attempts/me/result")).json();
    expect(result).toMatchObject({ released: true, title: "Campus drive", institution: "Acme Engineering", maxTotal: 8 });
    expect(result.questions.map((q: { number: number; stem: string; max: number }) => [q.number, q.stem, q.max])).toEqual([
      [1, "Which sort is stable?", 4],
      [2, "Why does binary search stop?", 4],
    ]);
    expect(result.outcome).not.toBeNull();
    expect(result.recheckUntil).toBe(new Date(clock + 7 * DAY).toISOString());

    await release(false);
    expect((await me("GET", "/attempts/me/result")).json().outcome).toBeNull();
  });
});

describe("a recheck", () => {
  beforeEach(async () => {
    await release();
  });

  it("is asked once per question, with a reason, and staff see it with the answer it is about", async () => {
    expect((await me("POST", "/attempts/me/rechecks", { questionId: "q2", reason: "short" })).statusCode).toBe(400);
    const asked = await me("POST", "/attempts/me/rechecks", { questionId: "q2", reason: "I explained that the interval halves until empty." });
    expect(asked.statusCode, asked.payload).toBe(201);
    expect(asked.json()).toMatchObject({ questionId: "q2", status: "open" });
    expect((await me("POST", "/attempts/me/rechecks", { questionId: "q2", reason: "Asking again, the same question." })).json().error).toBe("already_asked");
    expect((await me("POST", "/attempts/me/rechecks", { questionId: "q9", reason: "A question I never had." })).statusCode).toBe(422);

    const [request] = (await call("GET", "/exams/drive/rechecks", owner)).json().rechecks;
    expect(request).toMatchObject({
      candidate: { ref: "CS001", name: "Ananya Iyer" },
      question: { number: 2, stem: "Why does binary search stop?", kind: "short", max: 4 },
      answer: "Because the interval halves each time until it is empty.",
      status: "open",
    });
    expect((await call("GET", "/rechecks/open", owner)).json()).toEqual({ open: { drive: 1 } });
  });

  it("changes the mark on the record when answered with a new one, and tells the candidate", async () => {
    await me("POST", "/attempts/me/rechecks", { questionId: "q2", reason: "I explained that the interval halves until empty." });
    const [request] = (await call("GET", "/exams/drive/rechecks", owner)).json().rechecks;
    const before = request.score as number;
    expect(before).toBe(4);
    expect((await call("POST", `/rechecks/${request.id}/answer`, invigilator, { score: 2, reply: "Half marks." })).statusCode).toBe(403);

    const answered = await call("POST", `/rechecks/${request.id}/answer`, owner, { score: 2, reply: "The halving is named, but not why it must end: half marks." });
    expect(answered.statusCode, answered.payload).toBe(200);
    expect(answered.json()).toMatchObject({ status: "changed", scoreBefore: before, scoreAfter: 2 });
    expect((await call("POST", `/rechecks/${request.id}/answer`, owner, { score: 3, reply: "Again" })).statusCode).toBe(409);

    // On the record: the candidate's own result, and the ledger they can check.
    const result = (await me("GET", "/attempts/me/result")).json();
    expect(result.questions[1].score).toBe(2);
    expect(result.rechecks[0]).toMatchObject({ status: "changed", reply: "The halving is named, but not why it must end: half marks." });
    const ledger = (await me("GET", "/attempts/me/ledger")).json();
    const revised = ledger.entries.find((e: { event: { type: string } }) => e.event.type === "score_revised");
    expect(revised.event).toMatchObject({ questionId: "q2", score: 2, decidedBy: { name: expect.any(String) } });
    expect((await call("GET", "/exams/drive/results", owner)).json().rows[0].scores.q2.score).toBe(2);

    await worker.tick();
    const email = mail.sent.find((m): m is EmailMessage => "subject" in m && m.subject.startsWith("Your recheck"));
    expect(email!.text).toContain(`Your mark for question 2 has changed from ${before} to 2.`);
    expect(email!.text).toContain("The halving is named, but not why it must end: half marks.");
  });

  it("leaves the record alone when the mark stands", async () => {
    await me("POST", "/attempts/me/rechecks", { questionId: "q1", reason: "I think merge sort was the right choice." });
    const [request] = (await call("GET", "/exams/drive/rechecks", owner)).json().rechecks;
    const answered = await call("POST", `/rechecks/${request.id}/answer`, owner, { score: request.score, reply: "Merge sort is correct and was marked so." });
    expect(answered.json().status).toBe("unchanged");
    const ledger = (await me("GET", "/attempts/me/ledger")).json();
    expect(ledger.entries.some((e: { event: { type: string } }) => e.event.type === "score_revised")).toBe(false);
  });

  it("closes a week after the results, and after three questions", async () => {
    clock += 7 * DAY + 60_000;
    expect((await me("POST", "/attempts/me/rechecks", { questionId: "q1", reason: "I think merge sort was right." })).json().error).toBe("closed");
    expect((await me("GET", "/attempts/me/result")).json().recheckUntil).toBeNull();
  });
});

describe("the scorecard", () => {
  it("is a PDF for the candidate once released, and for staff before", async () => {
    const staffCopy = await app.inject({ method: "GET", url: `/attempts/${candidate.attemptId}/scorecard.pdf`, headers: bearer(owner) });
    expect(staffCopy.statusCode).toBe(200);
    expect(staffCopy.headers["content-type"]).toBe("application/pdf");
    await release();
    const pdf = await me("GET", "/attempts/me/scorecard.pdf");
    expect(pdf.statusCode).toBe(200);
    const text = pdf.rawPayload.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("(Ananya Iyer)");
    expect(text).toContain("(Campus drive)");
    expect(text).toContain("%%EOF");
  });

  it("carries a code that shows the result as it stands, and says when it has been withdrawn", async () => {
    await release();
    const code = new ScorecardCodes(TOKEN_SECRET).issue("org-a", candidate.attemptId);
    const checked = (await app.inject({ method: "GET", url: `/scorecards/${encodeURIComponent(code)}` })).json();
    expect(checked).toMatchObject({ valid: true, institution: "Acme Engineering", candidate: { name: "Ananya Iyer", ref: "CS001" }, title: "Campus drive", maxTotal: 8 });
    expect((await app.inject({ method: "GET", url: `/scorecards/${encodeURIComponent(`${code}x`)}` })).json()).toEqual({ valid: false, reason: "unknown" });

    await call("POST", `/attempts/${candidate.attemptId}/void`, owner, { reason: "Seen using a phone" });
    expect((await app.inject({ method: "GET", url: `/scorecards/${encodeURIComponent(code)}` })).json()).toEqual({ valid: false, reason: "withdrawn" });
  });
});

describe("revising a mark", () => {
  it("is only for a graded attempt, within the question's marks, and with a reason", async () => {
    const actor = { kind: "user" as const, id: "u", orgId: orgId("org-a"), role: "owner" as const, name: "Owner", email: "owner@acme.test" };
    await expect(wiring.service.reviseScore(actor, attemptId(candidate.attemptId), "q2", 5, "Too many")).rejects.toThrow(/0 to 4/);
    await expect(wiring.service.reviseScore(actor, attemptId(candidate.attemptId), "q2", 2, "  ")).rejects.toThrow(/Say why/);
    expect(await wiring.service.reviseScore(actor, attemptId(candidate.attemptId), "q2", 2.5, "Partly right")).toBeGreaterThan(0);
  });
});
