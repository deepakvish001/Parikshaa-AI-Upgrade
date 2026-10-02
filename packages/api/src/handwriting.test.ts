import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** Handwritten copies: scanned in, read by the model, checked by an examiner, moderated by a second. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let first: string;
let second: string;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 7)]).toString("base64");
const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const page = (token: string, ref: string, name = "") => call("POST", "/exams/bio/scripts/pages", token, { ref, name, image: PNG });
const marks = (q1: number, q2: number) => ({ marks: { q1: { score: q1, comment: "" }, q2: { score: q2, comment: "" } } });

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => Date.parse("2026-10-05T05:00:00Z") });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme College");
  await addStaff(wiring.identity, org, "hod@acme.test", "owner");
  await addStaff(wiring.identity, org, "first@acme.test", "reviewer");
  await addStaff(wiring.identity, org, "second@acme.test", "reviewer");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hod@acme.test");
  first = await signIn(app, "first@acme.test");
  second = await signIn(app, "second@acme.test");
  const made = await call("POST", "/exams", owner, {
    id: "bio",
    title: "Biology — mid semester",
    questions: [
      { id: "q1", kind: "short", stem: "Explain photosynthesis.", maxScore: 5, rubric: [{ id: "c1", description: "Inputs, pigment and product", weight: 1 }], expectedPoints: ["light", "chlorophyll", "glucose"] },
      { id: "q2", kind: "short", stem: "What is osmosis?", maxScore: 5, rubric: [{ id: "c1", description: "Names the membrane", weight: 1 }], expectedPoints: ["semi-permeable membrane"] },
    ],
    policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  expect(made.statusCode, made.body).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a handwritten copy", () => {
  it("is scanned in page by page, read by the model, and checked by an examiner whose marks count", async () => {
    expect((await page(first, "R1", "Ananya")).statusCode).toBe(201);
    const second_ = (await page(first, "R1")).json();
    expect(second_).toMatchObject({ page: 2, script: { candidateRef: "R1", candidateName: "Ananya", status: "uploaded" } });
    const id = second_.script.id;
    const image = await call("GET", `/scripts/${id}/pages/2`, first);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.rawPayload.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const suggested = (await call("POST", `/scripts/${id}/suggest`, first)).json();
    // Rounded to half marks and kept within each question's marks.
    expect(suggested.suggestion.questions).toEqual([
      expect.objectContaining({ questionId: "q1", score: 3.5, transcript: expect.stringContaining("glucose") }),
      expect.objectContaining({ questionId: "q2", score: 0 }),
    ]);
    expect(suggested.marks).toBeNull();

    expect((await call("PUT", `/scripts/${id}/marks`, first, marks(6, 1))).statusCode).toBe(409);
    expect((await call("PUT", `/scripts/${id}/marks`, first, marks(4.25, 1))).statusCode).toBe(409);
    expect((await call("PUT", `/scripts/${id}/marks`, first, { marks: { q1: { score: 4, comment: "" } } })).statusCode).toBe(409);
    const checked = (await call("PUT", `/scripts/${id}/marks`, first, marks(4, 1.5))).json();
    expect(checked).toMatchObject({ status: "checked", finalTotal: 5.5, checkedBy: expect.any(String) });
    expect((await page(first, "R1")).statusCode).toBe(409);

    const csv = (await call("GET", "/exams/bio/scripts.csv", first)).body;
    expect(csv).toContain("roll_number,name,Q1 (5),Q2 (5),total");
    expect(csv).toContain("R1,Ananya,4,1.5,5.5,checked");
    const audit = JSON.stringify((await call("GET", "/audit", owner)).json());
    expect(audit).toContain("script.suggested");
    expect(audit).toContain("script.checked");
  });

  it("is moderated by a second examiner: within tolerance the first marks stand, beyond it a head examiner settles it", async () => {
    const a = (await page(first, "R1")).json().script.id;
    const b = (await page(first, "R2")).json().script.id;
    await call("PUT", `/scripts/${a}/marks`, first, marks(4, 4));
    await call("PUT", `/scripts/${b}/marks`, first, marks(5, 5));

    expect((await call("POST", "/exams/bio/scripts/sample", owner, { percent: 50 })).json().scripts).toHaveLength(1);
    expect((await call("POST", `/scripts/${a}/moderation`, first, marks(4, 3))).json().message).toMatch(/second examiner/);

    // A gap of 1 in 10 is within the 10% tolerance.
    expect((await call("POST", `/scripts/${a}/moderation`, second, marks(4, 3))).json()).toMatchObject({ status: "moderated", finalTotal: 8, moderation: { gap: 1 } });
    // A gap of 4 is not.
    const disputed = (await call("POST", `/scripts/${b}/moderation`, second, marks(3, 3))).json();
    expect(disputed).toMatchObject({ status: "disputed", moderation: { gap: 4 } });
    expect((await call("PUT", `/scripts/${b}/marks`, first, marks(5, 5))).statusCode).toBe(409);
    expect((await call("POST", `/scripts/${b}/resolution`, second, marks(4, 4))).statusCode).toBe(403);
    expect((await call("POST", `/scripts/${b}/resolution`, owner, marks(4, 4))).json()).toMatchObject({ status: "moderated", finalTotal: 8, moderation: { resolvedBy: expect.any(String) } });
    expect((await call("GET", "/exams/bio/scripts", owner)).json()).toMatchObject({ total: 10, tolerancePercent: 10, scripts: [{ candidateRef: "R1" }, { candidateRef: "R2" }] });
  });

  it("puts checked copies into the exam's results and its course-outcome attainment, and leaves out disputed ones", async () => {
    const a = (await page(first, "R1", "Ananya")).json().script.id;
    const b = (await page(first, "R2", "Rohan")).json().script.id;
    await page(first, "R3");
    await call("PUT", `/scripts/${a}/marks`, first, marks(5, 3.5));
    await call("PUT", `/scripts/${b}/marks`, first, marks(1, 1));
    const results = (await call("GET", "/exams/bio/results", owner)).json();
    // R3's copy is not checked yet: it has no result.
    expect(results.rows.map((r: { ref: string; total: number; percent: number; paper: boolean }) => [r.ref, r.total, r.percent, r.paper])).toEqual([
      ["R1", 8.5, 85, true],
      ["R2", 2, 20, true],
    ]);
    expect(results.analytics.graded).toBe(2);

    await call("PUT", "/exams/bio/outcomes", owner, { mapping: { q1: ["CO1"], q2: ["CO2"] }, matrix: {}, threshold: 60 });
    const attainment = (await call("GET", "/exams/bio/attainment", owner)).json();
    expect(attainment.courseOutcomes).toEqual([expect.objectContaining({ co: "CO1", candidates: 2, attained: 1 }), expect.objectContaining({ co: "CO2", candidates: 2, attained: 1 })]);

    // Disputed: out of the results until a head examiner settles it.
    await call("POST", `/scripts/${a}/moderation`, second, marks(1, 1));
    expect((await call("GET", "/exams/bio/results", owner)).json().rows.map((r: { ref: string }) => r.ref)).toEqual(["R2"]);
  });

  it("refuses what is not a picture, and stops reading at the spend cap", async () => {
    expect((await call("POST", "/exams/bio/scripts/pages", first, { ref: "R1", image: Buffer.from("%PDF-1.4").toString("base64") })).statusCode).toBe(409);
    const id = (await page(first, "R1")).json().script.id;
    await call("PUT", "/org/spend-cap", owner, { monthlyCapMicroUsd: 1 });
    await call("POST", `/scripts/${id}/suggest`, first);
    expect((await call("POST", `/scripts/${id}/suggest`, first)).statusCode).toBe(402);
    expect((await call("DELETE", `/scripts/${id}`, first)).statusCode).toBe(200);
    expect((await call("GET", `/scripts/${id}`, first)).statusCode).toBe(404);
  });
});
