import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** Marking by hand: every written answer, without names, kept or re-marked, on the record. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let invigilator: string;

const call = (method: "GET" | "POST" | "PUT", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

beforeEach(async () => {
  const clock = OPENS + 60_000;
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => clock });
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
    questions: [
      { id: "q1", kind: "mcq", stem: "Which sort is stable?", maxScore: 2, rubric: [], options: ["Merge sort", "Heap sort"], correctIndex: 0 },
      { id: "q2", kind: "short", stem: "Why does binary search stop?", maxScore: 4, rubric: [{ id: "r1", description: "Names the halving", weight: 1 }], expectedPoints: ["the interval halves"] },
    ],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  await call("PUT", "/exams/drive/window", owner, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
  await call("POST", "/exams/drive/invitations/import", owner, { csv: "ref,name\nCS001,Ananya\nCS002,Rohan\nCS003,Meera", dryRun: false, channels: [] });
  const codes = new InviteCodes(TOKEN_SECRET);
  const invitations = (await call("GET", "/exams/drive/invitations", owner)).json().invitations as { id: string; candidateRef: string }[];
  for (const [i, inv] of invitations.entries()) {
    const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", inv.id) } })).json();
    await call("POST", "/attempts/me/answers", opened.token, { questionId: "q1", answer: "0" });
    if (i < 2) await call("POST", "/attempts/me/answers", opened.token, { questionId: "q2", answer: `Answer ${i + 1}: the interval halves.` });
    await call("POST", "/attempts/me/submit", opened.token);
    if (i < 2) await call("POST", `/attempts/${opened.attemptId}/grade`, owner);
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("marking by hand", () => {
  it("queues every graded written answer, without names, with what the rubric looks for", async () => {
    const queue = (await call("GET", "/exams/drive/marking", owner)).json();
    expect(queue.questions).toEqual([
      expect.objectContaining({ id: "q2", number: 2, kind: "short", max: 4, rubric: ["Names the halving"], expectedPoints: ["the interval halves"], answers: 2, reviewed: 0 }),
    ]);
    expect(queue.items).toHaveLength(2);
    expect(JSON.stringify(queue)).not.toMatch(/Ananya|Rohan|CS00/);
    expect((await call("GET", "/exams/drive/marking", invigilator)).statusCode).toBe(403);
  });

  it("keeps a mark, or changes it on the record, and moves read answers to the back", async () => {
    const [first, second] = (await call("GET", "/exams/drive/marking", owner)).json().items;
    expect((await call("POST", "/exams/drive/marking", owner, { attemptId: first.attemptId, questionId: "q2", score: first.score })).json()).toEqual({ score: first.score, changed: false });
    const lower = Math.max(0, second.score - 1);
    expect((await call("POST", "/exams/drive/marking", owner, { attemptId: second.attemptId, questionId: "q2", score: lower })).json()).toEqual({ score: lower, changed: true });

    const queue = (await call("GET", "/exams/drive/marking", owner)).json();
    expect(queue.questions[0].reviewed).toBe(2);
    expect(queue.items.every((i: { reviewed: boolean }) => i.reviewed)).toBe(true);
    const report = (await call("GET", `/attempts/${second.attemptId}/report`, owner)).json();
    expect(report.questions.find((q: { id: string }) => q.id === "q2").score).toBe(lower);
    const audit = JSON.stringify((await call("GET", "/audit", owner)).json());
    expect(audit).toContain("attempt.score_revised");
  });

  it("refuses an answer that is not in the queue", async () => {
    expect((await call("POST", "/exams/drive/marking", owner, { attemptId: "nope", questionId: "q2", score: 1 })).statusCode).toBe(404);
  });
});
