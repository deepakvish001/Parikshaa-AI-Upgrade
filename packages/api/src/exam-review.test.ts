import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** CL60: a paper's setter sends it for review; someone else approves or returns it; approved, it is locked. */

let db: PGlite;
let app: FastifyInstance;
let hod: string;
let setter: string;
let other: string;

const EXAM = {
  id: "maths",
  title: "Maths — internal 1",
  questions: [{ id: "q1", kind: "mcq", stem: "2 + 2?", maxScore: 1, rubric: [], options: ["3", "4"], correctIndex: 1 }],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
};
const call = (token: string, method: "GET" | "POST", url: string, payload?: object) => app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => Date.parse("2026-10-05T05:00:00Z") });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme College");
  await addStaff(wiring.identity, org, "hod@acme.test", "owner", "HoD Maths");
  await addStaff(wiring.identity, org, "setter@acme.test", "author", "Paper Setter");
  await addStaff(wiring.identity, org, "other@acme.test", "author", "Second Author");
  await db.exec(`SET ROLE parikshaa_app`);
  hod = await signIn(app, "hod@acme.test");
  setter = await signIn(app, "setter@acme.test");
  other = await signIn(app, "other@acme.test");
  expect((await call(setter, "POST", "/exams", EXAM)).statusCode).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a paper's review", () => {
  it("locks the paper while it is with the reviewer, takes a comment back, and locks it once approved", async () => {
    expect((await call(setter, "POST", "/exams/maths/review", { note: "Unit 1 only" })).json()).toMatchObject({ status: "in_review", submittedBy: "Paper Setter", note: "Unit 1 only" });
    expect((await call(setter, "POST", "/exams", { ...EXAM, title: "Changed" })).json().message).toMatch(/with its reviewer/);
    // Not by the setter, and a return says why.
    expect((await call(setter, "POST", "/exams/maths/review/decision", { decision: "approve" })).json().message).toMatch(/other than the paper's setter/);
    expect((await call(hod, "POST", "/exams/maths/review/decision", { decision: "return" })).statusCode).toBe(409);
    expect((await call(hod, "POST", "/exams/maths/review/decision", { decision: "return", comment: "Q1 is too easy" })).json()).toMatchObject({ status: "returned", reviewer: "HoD Maths", comment: "Q1 is too easy" });

    // Returned: it can change again, and goes back.
    expect((await call(setter, "POST", "/exams", { ...EXAM, title: "Maths — internal 1 (v2)" })).statusCode).toBe(201);
    await call(setter, "POST", "/exams/maths/review", {});
    expect((await call(other, "POST", "/exams/maths/review/decision", { decision: "approve" })).json()).toMatchObject({ status: "approved", reviewer: "Second Author" });
    expect((await call(setter, "POST", "/exams", EXAM)).json().message).toMatch(/approved by Second Author and is locked/);
    expect((await call(setter, "GET", "/exams/reviews")).json().reviews).toEqual([expect.objectContaining({ examId: "maths", status: "approved" })]);

    // Only an owner reopens it, saying why.
    expect((await call(setter, "POST", "/exams/maths/review/reopen", { reason: "Typo in Q1" })).statusCode).toBe(403);
    expect((await call(hod, "POST", "/exams/maths/review/reopen", { reason: "Typo in Q1" })).json()).toMatchObject({ status: "reopened" });
    expect((await call(setter, "POST", "/exams", EXAM)).statusCode).toBe(201);
    const audit = JSON.stringify((await call(hod, "GET", "/audit")).json());
    for (const action of ["exam.review_requested", "exam.returned", "exam.approved", "exam.reopened_for_change"]) expect(audit).toContain(action);
  });

  it("leaves a paper nobody sent for review as it always was", async () => {
    expect((await call(setter, "GET", "/exams/maths/review")).json()).toEqual({ review: null });
    expect((await call(setter, "POST", "/exams", { ...EXAM, title: "Edited freely" })).statusCode).toBe(201);
  });
});
