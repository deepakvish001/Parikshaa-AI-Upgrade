import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** A placement cell's view: each candidate across the organisation's tests. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const START = Date.parse("2026-09-01T04:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let clock: number;
const codes = new InviteCodes(TOKEN_SECRET);

const call = (method: "GET" | "POST" | "PUT", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

/** A one-question test on day `day`, sat by these candidates with these answers (0 right, 1 wrong). */
async function sitting(id: string, day: number, answers: Record<string, string>) {
  clock = START + day * DAY;
  await call("POST", "/exams", owner, {
    id,
    title: `Drive ${id}`,
    questions: [
      { id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 },
      { id: "q2", kind: "mcq", stem: "Pick again", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 },
    ],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99, cutoff: { percent: 50 } },
  });
  await call("PUT", `/exams/${id}/window`, owner, { opensAt: new Date(clock).toISOString(), closesAt: new Date(clock + 3 * HOUR).toISOString() });
  const csv = ["ref,name", ...Object.keys(answers).map((ref) => `${ref},Student ${ref}`)].join("\n");
  await call("POST", `/exams/${id}/invitations/import`, owner, { csv, dryRun: false, channels: [] });
  clock += 60_000;
  for (const inv of (await call("GET", `/exams/${id}/invitations`, owner)).json().invitations as { id: string; candidateRef: string }[]) {
    const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", inv.id) } })).json();
    const [a, b] = answers[inv.candidateRef]!.split("");
    await call("POST", "/attempts/me/answers", opened.token, { questionId: "q1", answer: a });
    await call("POST", "/attempts/me/answers", opened.token, { questionId: "q2", answer: b });
    await call("POST", "/attempts/me/submit", opened.token);
    await call("POST", `/attempts/${opened.attemptId}/grade`, owner);
  }
}

beforeEach(async () => {
  clock = START;
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => clock });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await addStaff(wiring.identity, org, "watch@acme.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  await sitting("first", 0, { CS001: "11", CS002: "00", EC001: "01" });
  await sitting("second", 7, { CS001: "00", CS002: "01" });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("candidates across tests", () => {
  it("lines each candidate up across the tests they sat, oldest test first, with how each test went", async () => {
    const progress = (await call("GET", "/progress", owner)).json();
    expect(progress.exams.map((e: { id: string; graded: number; meanPercent: number; qualified: number }) => [e.id, e.graded, e.meanPercent, e.qualified])).toEqual([
      ["first", 3, 50, 2],
      ["second", 2, 75, 2],
    ]);
    const cs001 = progress.candidates.find((c: { ref: string }) => c.ref === "CS001");
    expect(cs001).toMatchObject({ name: "Student CS001", average: 50, change: 100 });
    expect(cs001.results.first).toEqual({ percent: 0, outcome: "failed" });
    expect(progress.candidates.find((c: { ref: string }) => c.ref === "EC001")).toMatchObject({ change: null, average: 50 });
  });

  it("narrows to a branch by roll number, and to chosen tests", async () => {
    const cs = (await call("GET", "/progress?search=cs", owner)).json();
    expect(cs.candidates.map((c: { ref: string }) => c.ref)).toEqual(["CS001", "CS002"]);
    const one = (await call("GET", "/progress?exams=second", owner)).json();
    expect(one.exams.map((e: { id: string }) => e.id)).toEqual(["second"]);
    expect(one.available.map((e: { id: string }) => e.id)).toEqual(["first", "second"]);
  });

  it("flags questions worth a second look once enough papers are graded, and says nothing before", async () => {
    expect((await call("GET", "/question-quality", owner)).json()).toEqual({ flags: [], questions: 0, exams: 0 });
    // Eight more: everyone gets the first question, and the second separates nobody.
    const answers: Record<string, string> = {};
    for (let i = 1; i <= 10; i++) answers[`ME${String(i).padStart(3, "0")}`] = i % 2 === 0 ? "00" : "01";
    await sitting("third", 14, answers);
    const quality = (await call("GET", "/question-quality", owner)).json();
    expect(quality.exams).toBe(1);
    expect(quality.flags.map((f: { examId: string; number: number; reason: string }) => [f.examId, f.number, f.reason])).toEqual([["third", 1, "too_easy"]]);
  });

  it("is for those who read results", async () => {
    const invigilator = await signIn(app, "watch@acme.test");
    expect((await call("GET", "/progress", invigilator)).statusCode).toBe(403);
  });
});
