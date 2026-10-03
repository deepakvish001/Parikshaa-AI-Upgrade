import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** Plan row 88: a take-home, answered with a link and notes, marked by a person and never by a model. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;

const call = (method: "GET" | "POST", token: string, url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

const exam = {
  id: "take-home",
  title: "Backend take-home",
  questions: [
    {
      id: "th",
      kind: "short",
      stem: "Build a URL shortener with an API and tests. Share the repository.",
      maxScore: 20,
      rubric: [{ id: "r1", description: "Works end to end, with tests", weight: 1 }],
      expectedPoints: [],
      takeHome: true,
    },
    { id: "mcq", kind: "mcq", stem: "2 + 2?", maxScore: 1, rubric: [], options: ["3", "4"], correctIndex: 1 },
  ],
  policy: { durationMs: 7 * 24 * 3_600_000, allowRevision: true, vivaTriggerRatio: 1 },
};

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client });
  const org = await addOrganisation(wiring.identity, "org-a", "Acme");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  app = wiring.app;
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  const saved = await call("POST", owner, "/exams", exam);
  expect(saved.statusCode, saved.payload).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const work = (link: string, notes = "Run `make test`.") => JSON.stringify({ link, notes });

describe("a take-home", () => {
  it("is answered with an https link and notes, and anything else is turned back", async () => {
    const { token } = (await call("POST", owner, "/exams/take-home/attempts", { candidateId: "cand-1" })).json();
    expect((await call("GET", token, "/attempts/me")).json().exam.questions[0]).toMatchObject({ kind: "short", takeHome: true });
    for (const bad of ["just some text", work("http://github.com/a/b"), work("ftp://x.com/y"), JSON.stringify({ link: "https://github.com/a/b", notes: "x".repeat(5001) })]) {
      expect((await call("POST", token, "/attempts/me/answers", { questionId: "th", answer: bad })).statusCode, bad.slice(0, 40)).toBe(409);
    }
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "th", answer: work("https://github.com/ananya/shortener") })).statusCode).toBe(202);
  });

  it("is never graded by a model: it scores 0 until a person marks it in the marking queue", async () => {
    const { token, attemptId } = (await call("POST", owner, "/exams/take-home/attempts", { candidateId: "cand-1" })).json();
    await call("POST", token, "/attempts/me/answers", { questionId: "th", answer: work("https://github.com/ananya/shortener") });
    await call("POST", token, "/attempts/me/answers", { questionId: "mcq", answer: "1" });
    await call("POST", token, "/attempts/me/submit");
    const graded = await call("POST", owner, `/attempts/${attemptId}/grade`);
    expect(graded.statusCode, graded.payload).toBe(200);
    expect(graded.json().total).toBe(1);

    await db.exec("RESET ROLE");
    const usage = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM model_usage WHERE route = 'grade'`);
    expect(usage.rows[0]!.n).toBe(0);
    await db.exec("SET ROLE parikshaa_app");

    const queue = (await call("GET", owner, "/exams/take-home/marking")).json();
    expect(queue.questions).toEqual([expect.objectContaining({ id: "th", takeHome: true, answers: 1, reviewed: 0 })]);
    expect(JSON.parse(queue.items[0].answer)).toMatchObject({ link: "https://github.com/ananya/shortener" });

    const marked = await call("POST", owner, "/exams/take-home/marking", { attemptId, questionId: "th", score: 16 });
    expect(marked.json()).toEqual({ score: 16, changed: true });
    const report = (await call("GET", owner, `/attempts/${attemptId}/report`)).json();
    expect(report.questions.find((q: { id: string }) => q.id === "th").score).toBe(16);
  });
});
