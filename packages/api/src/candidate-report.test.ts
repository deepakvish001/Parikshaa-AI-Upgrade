import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { pgliteExecutor } from "@parikshaa/store";
import { drawReport, ReportLinks, type SharedReport } from "./candidate-report.js";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** The candidate report v2 (plan row 90): AI use on the report, its PDF, and a link for a hiring manager. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const OPENS = Date.parse("2026-10-03T04:30:00Z");
const SUM = "a, b = map(int, input().split())\nprint(a + b)\n";

let workRoot: string;
const runner: CodeRunner = { run: (request) => execute(request, { workRoot, slot: null }) };
let db: PGlite;
let app: FastifyInstance;
let owner: string;
let invigilator: string;
let clock = OPENS;
let graded: string;
let ungraded: string;

const call = (method: "GET" | "POST", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const open = (url: string) => app.inject({ method: "GET", url });
const codeOf = (link: string) => encodeURIComponent(new URL(link).searchParams.get("report")!);

beforeAll(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "report-"));
});

beforeEach(async () => {
  clock = OPENS + 60_000;
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, runner, now: () => clock });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Kiranshala Labs");
  await addStaff(wiring.identity, org, "hr@kiran.test", "owner");
  await addStaff(wiring.identity, org, "watch@kiran.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hr@kiran.test");
  invigilator = await signIn(app, "watch@kiran.test");
  await call("POST", "/exams", owner, {
    id: "backend",
    title: "Backend intern test",
    questions: [
      { id: "q1", kind: "mcq", stem: "Which is **O(1)** on average?", maxScore: 2, rubric: [], options: ["Hash lookup", "Linear scan"], correctIndex: 0 },
      {
        id: "q2",
        kind: "code",
        stem: "Add two numbers.",
        maxScore: 10,
        rubric: [],
        language: "python",
        aiAssist: true,
        tests: [
          { id: "t1", input: "2 3\n", expected: "5\n", hidden: false, weight: 1 },
          { id: "t2", input: "40 2\n", expected: "42\n", hidden: true, weight: 1 },
        ],
      },
    ],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99, cutoff: { percent: 50 } },
  });
  await app.inject({ method: "PUT", url: "/exams/backend/window", headers: bearer(owner), payload: { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() } });
  await call("POST", "/exams/backend/invitations/import", owner, { csv: "ref,name,email\nK1,Arjun,arjun@x.test\nK2,Divya,divya@x.test", dryRun: false, channels: [] });
  const codes = new InviteCodes(TOKEN_SECRET);
  const invitations = (await call("GET", "/exams/backend/invitations", owner)).json().invitations as { id: string; candidateRef: string }[];
  for (const inv of invitations) {
    const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", inv.id) } })).json();
    if (inv.candidateRef === "K1") {
      expect((await call("POST", "/attempts/me/assist", opened.token, { questionId: "q2", prompt: "How do I read two numbers?" })).statusCode).toBe(200);
      await call("POST", "/attempts/me/answers", opened.token, { questionId: "q1", answer: "0" });
      await call("POST", "/attempts/me/answers", opened.token, { questionId: "q2", answer: JSON.stringify({ language: "python", source: SUM }) });
      await call("POST", "/attempts/me/submit", opened.token);
      expect((await call("POST", `/attempts/${opened.attemptId}/grade`, owner)).statusCode).toBe(200);
      graded = opened.attemptId;
    } else {
      ungraded = opened.attemptId;
    }
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("the report", () => {
  it("says on which questions the AI assistant was asked, and how often", async () => {
    const report = (await call("GET", `/attempts/${graded}/report`, owner)).json();
    expect(report.aiUse).toEqual([{ questionId: "q2", prompts: 1 }]);
    expect(report.result).toMatchObject({ state: "graded", total: 12, percent: 100, outcome: "qualified" });
  });

  it("comes as a PDF for staff, graded attempts only", async () => {
    const res = await call("GET", `/attempts/${graded}/report.pdf`, owner);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    expect(res.rawPayload.toString("latin1")).toContain("Candidate report");
    expect((await call("GET", `/attempts/${ungraded}/report.pdf`, owner)).statusCode).toBe(409);
    expect((await call("GET", `/attempts/${graded}/report.pdf`, invigilator)).statusCode).toBe(403);
  });
});

describe("a link for a hiring manager", () => {
  it("shows the report without contact details, with the program, and is audited", async () => {
    const made = await call("POST", `/attempts/${graded}/report-link`, owner, { days: 3 });
    expect(made.statusCode, made.payload).toBe(201);
    expect(made.json().expiresAt).toBe(new Date(clock + 3 * DAY).toISOString());
    const code = codeOf(made.json().link);

    const view = (await open(`/reports/${code}`)).json();
    expect(view).toMatchObject({
      valid: true,
      institution: "Kiranshala Labs",
      exam: { title: "Backend intern test" },
      candidate: { name: "Arjun", ref: "K1" },
      total: 12,
      maxTotal: 12,
      percent: 100,
      outcome: "qualified",
      standing: { rank: 1, graded: 1 },
      integrity: null,
    });
    expect(view.questions).toEqual([
      expect.objectContaining({ number: 1, stem: "Which is O(1) on average?", score: 2, max: 2, tests: null, code: null, aiPrompts: 0 }),
      expect.objectContaining({ number: 2, score: 10, max: 10, tests: { passed: 2, total: 2 }, code: { language: "python", source: SUM }, aiPrompts: 1 }),
    ]);
    expect(JSON.stringify(view)).not.toContain("arjun@x.test");

    const pdf = await open(`/reports/${code}/report.pdf`);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.rawPayload.subarray(0, 5).toString()).toBe("%PDF-");
    expect(JSON.stringify((await call("GET", "/audit", owner)).json())).toContain("report.shared");
  });

  it("stops working when it expires, and a forged or altered link finds nothing", async () => {
    const code = codeOf((await call("POST", `/attempts/${graded}/report-link`, owner, { days: 1 })).json().link);
    clock += DAY + 1;
    expect((await open(`/reports/${code}`)).json()).toEqual({ valid: false, reason: "expired" });
    expect((await open(`/reports/${code}/report.pdf`)).statusCode).toBe(404);
    clock -= DAY + 1;

    const forged = new ReportLinks("not the server's secret").issue("org-a", graded, clock + DAY);
    expect((await open(`/reports/${encodeURIComponent(forged)}`)).json()).toEqual({ valid: false, reason: "unknown" });
    // Moving the expiry breaks the seal.
    const [org, attempt, , mac] = decodeURIComponent(code).split(".");
    const stretched = `${org}.${attempt}.${Math.floor((clock + 300 * DAY) / 1000).toString(36)}.${mac}`;
    expect((await open(`/reports/${encodeURIComponent(stretched)}`)).json()).toEqual({ valid: false, reason: "unknown" });
  });

  it("reads as withdrawn once the result is set aside", async () => {
    const code = codeOf((await call("POST", `/attempts/${graded}/report-link`, owner, {})).json().link);
    expect((await call("POST", `/attempts/${graded}/void`, owner, { reason: "Impersonation found" })).statusCode).toBeLessThan(300);
    expect((await open(`/reports/${code}`)).json()).toEqual({ valid: false, reason: "withdrawn" });
  });

  it("is made only for a graded attempt, by someone who may review", async () => {
    expect((await call("POST", `/attempts/${ungraded}/report-link`, owner, {})).statusCode).toBe(409);
    expect((await call("POST", `/attempts/${graded}/report-link`, invigilator, {})).statusCode).toBe(403);
    expect((await call("POST", `/attempts/${graded}/report-link`, owner, { days: 31 })).statusCode).toBe(400);
  });
});

describe("the PDF", () => {
  const report: SharedReport = {
    institution: "Kiranshala Labs",
    exam: { title: "Backend intern test" },
    candidate: { name: "Arjun", ref: "K1" },
    sat: "2026-10-03T04:31:00.000Z",
    durationMs: 1_200_000,
    total: 12,
    maxTotal: 12,
    percent: 100,
    outcome: "qualified",
    standing: { percentile: null, rank: 1, graded: 1, meanPercent: 100 },
    sections: [{ title: "Coding", score: 10, max: 10 }],
    questions: Array.from({ length: 40 }, (_, i) => ({
      number: i + 1,
      stem: `Question ${i + 1}`,
      kind: i === 0 ? "code" : "mcq",
      score: 1,
      max: 1,
      tests: i === 0 ? { passed: 2, total: 2 } : null,
      code: i === 0 ? { language: "python", source: Array.from({ length: 80 }, (_, l) => `print(${l})`).join("\n") } : null,
      aiPrompts: i === 0 ? 3 : 0,
    })),
    followUps: [{ number: 1, prompt: "Why read with split()?", reply: "Two numbers on one line", verdict: "consistent" }],
    integrity: { identity: "verified", snapshots: 4, events: [{ kind: "tab_hidden", label: "Left the tab", count: 2 }] },
    record: { head: "a".repeat(64), length: 12 },
    expiresAt: "",
  };

  it("runs on to more pages for a long paper and a long program, saying what it left out", () => {
    const text = Buffer.from(drawReport(report, Date.parse("2026-10-03T06:00:00Z"))).toString("latin1");
    expect(text).toContain("/Count 3");
    for (const words of ["What the proctoring saw", "Left the tab: 2", "Follow-up questions", "Q1: 3 prompts", "20 more lines in the institution's record", "1 of 3"]) {
      expect(text, words).toContain(words);
    }
  });
});
