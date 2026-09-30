import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { InviteCodes } from "./invite-codes.js";
import { istStamp } from "./results.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/**
 * ROADMAP §6: what a recruiter takes away — the cohort's results, the
 * spreadsheet, and one candidate's report. Runs as `parikshaa_app`.
 */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
const CLOSES = Date.parse("2026-10-01T07:30:00Z");

const exam = {
  id: "drive",
  title: "Campus drive",
  questions: [
    { id: "q1", kind: "mcq", stem: "Which sort is stable?", maxScore: 2, rubric: [], options: ["Merge sort", "Heap sort"], correctIndex: 0 },
    { id: "q2", kind: "mcq", stem: "Pick b", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 1 },
  ],
  policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
};

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let clock: number;
let owner: string;

beforeEach(async () => {
  clock = OPENS - 24 * HOUR;
  db = await freshDatabase();
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  expect((await call("POST", owner, "/exams", exam)).statusCode).toBe(201);
  await call("PUT", owner, "/exams/drive/window", { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(CLOSES).toISOString() });
  const imported = await call("POST", owner, "/exams/drive/invitations/import", {
    csv: ["ref,name,email", "007,Ananya Iyer,ananya@college.test", '008,"=HYPERLINK(""http://evil.test"")",x@college.test', "009,Not Started,n@college.test"].join("\n"),
    dryRun: false,
    channels: [],
  });
  expect(imported.statusCode, imported.payload).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({
    method,
    url,
    ...(token === null ? {} : { headers: bearer(token) }),
    ...(payload === undefined ? {} : { payload }),
  });

/** Sit the exam as the invited candidate `ref`, answering as given, and have it graded unless told not to. */
async function sit(ref: string, answers: Record<string, string>, minutes: number, grade = true): Promise<string> {
  const invitations = (await call("GET", owner, "/exams/drive/invitations")).json().invitations as { id: string; candidateRef: string }[];
  const invitation = invitations.find((i) => i.candidateRef === ref)!;
  clock = OPENS + 60_000;
  const opened = await call("POST", null, "/invitations/redeem", { code: new InviteCodes(TOKEN_SECRET).issue("org-a", invitation.id) });
  expect(opened.statusCode, opened.payload).toBe(200);
  const { token, attemptId } = opened.json();
  for (const [questionId, answer] of Object.entries(answers)) {
    expect((await call("POST", token, "/attempts/me/answers", { questionId, answer })).statusCode).toBe(202);
  }
  clock += minutes * 60_000;
  expect((await call("POST", token, "/attempts/me/submit")).statusCode).toBe(200);
  if (grade) expect((await call("POST", owner, `/attempts/${attemptId}/grade`)).statusCode).toBe(200);
  return attemptId;
}

describe("grading every submitted attempt at once", () => {
  it("grades each as it would be graded by hand, and says when none are left", async () => {
    await sit("007", { q1: "0", q2: "1" }, 30, false);
    await sit("008", { q1: "1" }, 50, false);

    const first = await call("POST", owner, "/exams/drive/grade-submitted");
    expect(first.statusCode, first.payload).toBe(200);
    expect(first.json()).toEqual({ graded: 2, failed: [], remaining: 0 });

    const rows = (await call("GET", owner, "/exams/drive/results")).json().rows as { ref: string; state: string; total: number }[];
    expect(rows.filter((r) => r.state === "graded").map((r) => [r.ref, r.total]).sort()).toEqual([
      ["007", 3],
      ["008", 0],
    ]);
    // Asked again, there is nothing to do; nor for a candidate who never started.
    expect((await call("POST", owner, "/exams/drive/grade-submitted")).json()).toEqual({ graded: 0, failed: [], remaining: 0 });
    const audit = (await call("GET", owner, "/audit")).json().entries.filter((e: { action: string }) => e.action === "attempt.graded");
    expect(audit).toHaveLength(2);
  });

  it("is for those who may grade", async () => {
    const org = (await identity.findUserByEmail("owner@acme.test"))!.orgId;
    await addStaff(identity, org, "watch@acme.test", "invigilator");
    const invigilator = await signIn(app, "watch@acme.test");
    expect((await call("POST", invigilator, "/exams/drive/grade-submitted")).statusCode).toBe(403);
  });
});

describe("the cohort's results", () => {
  it("lists each candidate by their own reference, with the cohort's figures", async () => {
    await sit("007", { q1: "0", q2: "1" }, 30);
    await sit("008", { q1: "1" }, 50);

    const res = await call("GET", owner, "/exams/drive/results");

    expect(res.statusCode, res.payload).toBe(200);
    const { rows, analytics } = res.json();
    const byRef = Object.fromEntries(rows.map((r: { ref: string }) => [r.ref, r]));
    expect(byRef["007"]).toMatchObject({ name: "Ananya Iyer", state: "graded", total: 3, maxTotal: 3, percent: 100, durationMs: 30 * 60_000 });
    expect(byRef["007"].scores).toEqual({ q1: { score: 2, max: 2 }, q2: { score: 1, max: 1 } });
    expect(byRef["008"]).toMatchObject({ total: 0, percent: 0 });
    // Not started is not a result.
    expect(byRef["009"]).toBeUndefined();

    expect(analytics).toMatchObject({ candidates: 2, graded: 2, meanPercent: 50, medianPercent: 50, time: { medianMinutes: 40 } });
    expect(analytics.distribution[0]).toBe(1);
    expect(analytics.distribution[9]).toBe(1);
    expect(analytics.questions.map((q: { questionId: string; facility: number }) => [q.questionId, q.facility])).toEqual([
      ["q1", 0.5],
      ["q2", 0.5],
    ]);
  });

  it("says who qualified against the exam's cut-off, and where a candidate stands", async () => {
    const saved = await call("POST", owner, "/exams", { ...exam, policy: { ...exam.policy, cutoff: { percent: 60 } } });
    expect(saved.statusCode, saved.payload).toBe(201);
    const top = await sit("007", { q1: "0", q2: "1" }, 30);
    await sit("008", { q1: "1", q2: "1" }, 50);

    const { rows, analytics } = (await call("GET", owner, "/exams/drive/results")).json();
    const byRef = Object.fromEntries(rows.map((r: { ref: string }) => [r.ref, r]));
    expect(byRef["007"].outcome).toBe("qualified");
    expect(byRef["008"].outcome).toBe("failed"); // 33.3%
    expect(analytics).toMatchObject({ qualified: 1, failed: 1 });

    const report = (await call("GET", owner, `/attempts/${top}/report`)).json();
    expect(report.standing).toEqual({ percentile: 100, rank: 1, graded: 2, meanPercent: 66.7 });
    expect(report.questions[0]).toMatchObject({ saves: 1, firstSavedMs: 0 });

    const csv = (await call("GET", owner, "/exams/drive/results.csv")).payload;
    expect(csv.split("\n")[0]).toContain('"Outcome"');
    // The glossary's words, not the stored values.
    expect(csv).toContain('"Not qualified"');
    expect(csv).not.toContain('"failed"');
  });

  it("includes a candidate started from the console, under their candidate id", async () => {
    clock = OPENS;
    const started = (await call("POST", owner, "/exams/drive/attempts", { candidateId: "walk-in-1" })).json();

    const { rows } = (await call("GET", owner, "/exams/drive/results")).json();

    expect(rows).toEqual([expect.objectContaining({ attemptId: started.attemptId, ref: "walk-in-1", name: "", state: "in_progress", total: null })]);
  });

  it("is refused to an invigilator, who sees the room but not the evidence", async () => {
    await addStaff(identity, "org-a" as never, "inv@acme.test", "invigilator");
    const invigilator = await signIn(app, "inv@acme.test");
    for (const path of ["/exams/drive/results", "/exams/drive/results.csv", "/exams/drive/results.xlsx"]) {
      expect((await call("GET", invigilator, path)).statusCode, path).toBe(403);
    }
  });

  it("is open to a viewer", async () => {
    await addStaff(identity, "org-a" as never, "viewer@acme.test", "viewer");
    const viewer = await signIn(app, "viewer@acme.test");
    expect((await call("GET", viewer, "/exams/drive/results")).statusCode).toBe(200);
  });

  it("is not found for another organisation's exam", async () => {
    const other = await addOrganisation(identity, "org-b", "Other");
    await addStaff(identity, other, "owner@other.test", "owner");
    const outsider = await signIn(app, "owner@other.test");
    expect((await call("GET", outsider, "/exams/drive/results")).statusCode).toBe(404);
  });
});

describe("the spreadsheet", () => {
  it("as CSV: IST times, text kept as text, and nothing a spreadsheet would run", async () => {
    await sit("007", { q1: "0", q2: "1" }, 30);
    await sit("008", { q1: "1" }, 50);

    const res = await call("GET", owner, "/exams/drive/results.csv");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/csv/);
    expect(res.headers["content-disposition"]).toBe('attachment; filename="drive-results.csv"');
    expect(res.payload.startsWith("﻿")).toBe(true);
    const lines = res.payload.slice(1).trim().split("\r\n");
    expect(lines[0]).toContain('"Q1 Which sort is stable?"');
    expect(lines[0]!.startsWith('"Roll no."')).toBe(true);
    const ananya = lines.find((l) => l.startsWith('"007"'))!;
    expect(ananya).toContain(`"${istStamp(OPENS + 60_000)}"`);
    expect(ananya).toContain('"2026-10-01 10:01"');
    expect(ananya).toMatch(/,3,3,100,/);
    expect(ananya).toContain('"Graded"');
    const hostile = lines.find((l) => l.startsWith('"008"'))!;
    expect(hostile).toContain(`"'=HYPERLINK(""http://evil.test"")"`);
  });

  it("as an Excel workbook, with the roll number still 007", async () => {
    await sit("007", { q1: "0", q2: "1" }, 30);

    const res = await call("GET", owner, "/exams/drive/results.xlsx");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const files = unzipSync(new Uint8Array(res.rawPayload));
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">007</t></is></c>');
    expect(sheet).toContain('<c r="E2"><v>3</v></c>');
    expect(strFromU8(files["xl/workbook.xml"]!)).toContain('name="Campus drive"');
  });

  it("is audited when it leaves the system", async () => {
    await call("GET", owner, "/exams/drive/results.csv");
    await call("GET", owner, "/exams/drive/results.xlsx");
    const actions = (await call("GET", owner, "/audit")).json().entries.map((e: { action: string }) => e.action);
    expect(actions.filter((a: string) => a === "results.exported")).toHaveLength(2);
  });
});

describe("one candidate's report", () => {
  it("shows the grade, each answer as the candidate chose it, and the record behind it", async () => {
    const attemptId = await sit("007", { q1: "0", q2: "1" }, 30);

    const res = await call("GET", owner, `/attempts/${attemptId}/report`);

    expect(res.statusCode, res.payload).toBe(200);
    const report = res.json();
    expect(report.candidate).toEqual({ ref: "007", name: "Ananya Iyer", email: "ananya@college.test" });
    expect(report.result).toMatchObject({ total: 3, percent: 100 });
    expect(report.questions[0]).toMatchObject({ id: "q1", answer: "Merge sort", score: 2, maxScore: 2 });
    expect(report.vivas).toEqual([]);
    // Started, two answers, submitted, two questions scored, graded: the head a receipt is checked against.
    expect(report.ledger).toEqual({ head: expect.stringMatching(/^[0-9a-f]{64}$/), length: 7 });
  });

  it("says who set an attempt aside, and why", async () => {
    const attemptId = await sit("007", { q1: "0" }, 10);
    const voided = await call("POST", owner, `/attempts/${attemptId}/void`, { reason: "Sat by someone else, by their own admission" });
    expect(voided.statusCode, voided.payload).toBe(200);

    const report = (await call("GET", owner, `/attempts/${attemptId}/report`)).json();

    expect(report).toMatchObject({ voidReason: "Sat by someone else, by their own admission", voidedBy: "owner" });
    const { analytics } = (await call("GET", owner, "/exams/drive/results")).json();
    expect(analytics).toMatchObject({ candidates: 1, graded: 0, setAside: 1 });
  });

  it("is not found for an attempt that does not exist", async () => {
    expect((await call("GET", owner, "/attempts/nope/report")).statusCode).toBe(404);
  });
});
