import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** CL65: internal marks (CIA) across exams, scaled, best of, rounded, in the university's shape. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
let db: PGlite;
let app: FastifyInstance;
let owner: string;

const call = (method: "GET" | "PUT" | "POST", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

/** An exam of four 2-mark questions; each student gets so many right. */
async function sit(id: string, title: string, right: Record<string, number>) {
  const mcq = (q: string) => ({ id: q, kind: "mcq", stem: `Question ${q}`, maxScore: 2, rubric: [], options: ["a", "b"], correctIndex: 0 });
  await call("POST", "/exams", owner, { id, title, questions: ["q1", "q2", "q3", "q4"].map(mcq), policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 } });
  await call("PUT", `/exams/${id}/window`, owner, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
  await call("POST", `/exams/${id}/invitations/import`, owner, { csv: ["ref,name", ...Object.keys(right).map((r) => `${r},Student ${r}`)].join("\n"), dryRun: false, channels: [] });
  const codes = new InviteCodes(TOKEN_SECRET);
  for (const inv of (await call("GET", `/exams/${id}/invitations`, owner)).json().invitations as { id: string; candidateRef: string }[]) {
    const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", inv.id) } })).json();
    for (const [n, q] of ["q1", "q2", "q3", "q4"].entries()) await call("POST", "/attempts/me/answers", opened.token, { questionId: q, answer: n < right[inv.candidateRef]! ? "0" : "1" });
    await call("POST", "/attempts/me/submit", opened.token);
    await call("POST", `/attempts/${opened.attemptId}/grade`, owner);
  }
}

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => OPENS + 60_000 });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering College");
  await addStaff(wiring.identity, org, "hod@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hod@acme.test");
  // Out of 8 each. CS2 missed the second mid-term.
  await sit("mid1", "Mid-term 1", { CS1: 4, CS2: 3, CS10: 1 });
  await sit("mid2", "Mid-term 2", { CS1: 2, CS10: 4 });
  await sit("quiz", "Quiz", { CS1: 3, CS2: 4, CS10: 0 });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("internal marks", () => {
  it("scales each exam to its marks, rounds up, and writes the university's sheet", async () => {
    const res = await call("POST", "/reports/internal-marks", owner, { components: [{ examId: "mid1", marks: 10 }, { examId: "mid2", marks: 10 }, { examId: "quiz", label: "Quiz 1", marks: 5 }] });
    expect(res.statusCode).toBe(200);
    const sheet = res.json();
    expect(sheet.outOf).toBe(25);
    // CS1: 10 + 5 + 3.75 = 18.75 → 19. CS2: 7.5 + AB + 5 = 12.5 → 13. CS10: 2.5 + 10 + 0 = 12.5 → 13. In roll-number order.
    expect(sheet.rows).toEqual([
      { ref: "CS1", name: "Student CS1", marks: [10, 5, 3.75], total: 19 },
      { ref: "CS2", name: "Student CS2", marks: [7.5, null, 5], total: 13 },
      { ref: "CS10", name: "Student CS10", marks: [2.5, 10, 0], total: 13 },
    ]);
    const lines = sheet.csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe('"Roll No","Name","Mid-term 1 (10)","Mid-term 2 (10)","Quiz 1 (5)","Total (25)"');
    expect(lines[2]).toBe('"CS2","Student CS2",7.5,AB,5,13');
  });

  it("counts the best two of the mid-terms and quiz when each is worth the same", async () => {
    const sheet = (await call("POST", "/reports/internal-marks", owner, { components: [{ examId: "mid1", marks: 10 }, { examId: "mid2", marks: 10 }, { examId: "quiz", marks: 10 }], best: 2, rounding: "nearest" })).json();
    expect(sheet.outOf).toBe(20);
    // CS1: 10, 5, 7.5 → 17.5 → 18. CS2: 7.5, AB, 10 → 17.5 → 18. CS10: 2.5, 10, 0 → 12.5 → 13.
    expect(sheet.rows.map((r: { total: number }) => r.total)).toEqual([18, 18, 13]);
    expect(sheet.csv).toContain('"Total, best 2 (20)"');
  });

  it("refuses a best-of over components of different marks, and the same exam twice", async () => {
    expect((await call("POST", "/reports/internal-marks", owner, { components: [{ examId: "mid1", marks: 10 }, { examId: "quiz", marks: 5 }], best: 1 })).statusCode).toBe(409);
    expect((await call("POST", "/reports/internal-marks", owner, { components: [{ examId: "mid1", marks: 10 }, { examId: "mid1", marks: 10 }] })).statusCode).toBe(409);
  });
});
