import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** Course outcome attainment, as NBA asks for it. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
let db: PGlite;
let app: FastifyInstance;
let owner: string;

const call = (method: "GET" | "PUT" | "POST", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => OPENS + 60_000 });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering College");
  await addStaff(wiring.identity, org, "hod@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hod@acme.test");
  const mcq = (id: string, correct: number) => ({ id, kind: "mcq", stem: `Question ${id}`, maxScore: 2, rubric: [], options: ["a", "b"], correctIndex: correct });
  await call("POST", "/exams", owner, { id: "dsa", title: "Data structures — mid-sem", questions: [mcq("q1", 0), mcq("q2", 0), mcq("q3", 0), mcq("q4", 0)], policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 } });
  await call("PUT", "/exams/dsa/window", owner, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
  const refs = ["A", "B", "C", "D", "E"];
  await call("POST", "/exams/dsa/invitations/import", owner, { csv: ["ref", ...refs].join("\n"), dryRun: false, channels: [] });
  const codes = new InviteCodes(TOKEN_SECRET);
  const invitations = (await call("GET", "/exams/dsa/invitations", owner)).json().invitations as { id: string; candidateRef: string }[];
  // q1, q2 (CO1): everyone but E right. q3 (CO2): A and B only. q4 (CO2): nobody.
  const right: Record<string, string[]> = { A: ["q1", "q2", "q3"], B: ["q1", "q2", "q3"], C: ["q1", "q2"], D: ["q1", "q2"], E: [] };
  for (const inv of invitations) {
    const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", inv.id) } })).json();
    for (const q of ["q1", "q2", "q3", "q4"]) await call("POST", "/attempts/me/answers", opened.token, { questionId: q, answer: right[inv.candidateRef]!.includes(q) ? "0" : "1" });
    await call("POST", "/attempts/me/submit", opened.token);
    await call("POST", `/attempts/${opened.attemptId}/grade`, owner);
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("course outcomes", () => {
  it("computes each CO's attainment level and each PO's weighted level", async () => {
    const saved = await call("PUT", "/exams/dsa/outcomes", owner, {
      mapping: { q1: ["co1"], q2: ["CO1"], q3: ["CO2"], q4: ["CO2"] },
      matrix: { CO1: { PO1: 3, PO2: 1 }, CO2: { PO2: 3, PSO1: 2 } },
      threshold: 50,
    });
    expect(saved.statusCode).toBe(200);
    const map = (await call("GET", "/exams/dsa/outcomes", owner)).json();
    expect(map.mapping).toEqual({ q1: ["CO1"], q2: ["CO1"], q3: ["CO2"], q4: ["CO2"] });
    expect(map.questions).toHaveLength(4);

    const attainment = (await call("GET", "/exams/dsa/attainment", owner)).json();
    // CO1: 4 of 5 earn at least half its marks (80%: level 3). CO2: A and B earn exactly half (40%: level 0).
    expect(attainment.courseOutcomes).toEqual([
      { co: "CO1", questions: 2, candidates: 5, attained: 4, percent: 80, level: 3 },
      { co: "CO2", questions: 2, candidates: 5, attained: 2, percent: 40, level: 0 },
    ]);
    // PO1 = 3; PO2 = (1×3 + 3×0) / 4 = 0.75; PSO1 = 0.
    expect(attainment.programmeOutcomes).toEqual([
      { po: "PO1", level: 3 },
      { po: "PO2", level: 0.75 },
      { po: "PSO1", level: 0 },
    ]);
  });

  it("refuses codes that are not outcomes, strengths outside 1–3, and questions not in the exam", async () => {
    const put = (body: object) => call("PUT", "/exams/dsa/outcomes", owner, { mapping: {}, matrix: {}, threshold: 60, ...body });
    expect((await put({ mapping: { q1: ["Unit 1"] } })).statusCode).toBe(409);
    expect((await put({ matrix: { CO1: { PO1: 4 } } })).statusCode).toBe(409);
    expect((await put({ matrix: { CO1: { XYZ: 2 } } })).statusCode).toBe(409);
    expect((await put({ mapping: { q9: ["CO1"] } })).statusCode).toBe(404);
  });
});
