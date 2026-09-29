import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { examId, validateExam, type Question } from "@parikshaa/core";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { pgliteExecutor } from "@parikshaa/store";
import { CS_FUNDAMENTALS } from "./content/cs-fundamentals.js";
import { SQL_STARTER } from "./content/sql-starter.js";
import { csLessons, sqlQuestion } from "./starter-packs.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * Starter packs (ROADMAP §16): the content is checked as content — every
 * question valid, every SQL reference passing its own tests on the real
 * runner — and then taken in through the API, and solved.
 */

let workRoot: string;
beforeAll(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "content-"));
});
const runner: CodeRunner = { run: (request) => execute(request, { workRoot, slot: null }) };
const paper = (questions: readonly Question[]) => validateExam({ id: examId("pack"), title: "Pack", questions, policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 } });

describe("the SQL starter", () => {
  it("is valid, and each reference query passes every one of its tests", async () => {
    expect(paper(SQL_STARTER.problems.map(sqlQuestion))).toEqual({ ok: true });
    for (const p of SQL_STARTER.problems) {
      const question = sqlQuestion(p);
      if (question.kind !== "code") throw new Error("expected a code question");
      const result = await runner.run({ language: "sql", source: p.reference, tests: question.tests!, ...(question.checker === undefined ? {} : { checker: question.checker }) });
      expect(result.compiled, p.slug).toBe(true);
      if (result.compiled) expect(result.tests.map((t) => t.status), p.slug).toEqual(question.tests!.map(() => "passed"));
    }
  }, 60_000);

  it("names its approaches, so an editorial shows them as tabs", () => {
    for (const p of SQL_STARTER.problems) expect(p.editorial, p.slug).toMatch(/^## (Brute force|Optimal)/m);
  });
});

describe("CS fundamentals", () => {
  it("is Parikshaa-New's question bank, every question a valid MCQ and every topic a lesson", () => {
    expect(CS_FUNDAMENTALS.source).toMatch(/^deepakvish001\/Parikshaa-New@/);
    const lessons = csLessons(CS_FUNDAMENTALS);
    expect(lessons.length).toBeGreaterThan(30);
    for (const l of lessons) {
      expect(l.slug).toMatch(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/);
      expect(l.body.length).toBeLessThan(200_000);
    }
    const questions: Question[] = CS_FUNDAMENTALS.subjects.flatMap((s, i) =>
      s.topics.flatMap((t, j) =>
        t.questions.map((q, k) => ({ id: `q${i}-${j}-${k}` as Question["id"], kind: "mcq" as const, stem: q.title, maxScore: 1, rubric: [], options: q.options, correctIndex: q.correct })),
      ),
    );
    expect(questions.length).toBe(80);
    expect(paper(questions)).toEqual({ ok: true });
  });
});

describe("taking a pack in", () => {
  let db: PGlite;
  let app: FastifyInstance;
  let owner: string;
  let viewer: string;
  const call = (method: "GET" | "POST", token: string | null, url: string, payload?: object) =>
    app.inject({ method, url, headers: token === null ? {} : bearer(token), ...(payload === undefined ? {} : { payload }) });

  beforeEach(async () => {
    db = await freshDatabase();
    let identity;
    ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, runner }));
    const org = await addOrganisation(identity, "org-a", "NIT Trichy");
    await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
    await addStaff(identity, org, "viewer@nit.test", "viewer");
    await db.exec(`SET ROLE parikshaa_app`);
    owner = await signIn(app, "owner@nit.test");
    viewer = await signIn(app, "viewer@nit.test");
    expect((await call("PUT" as "POST", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true })).statusCode).toBe(200);
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it("adds the SQL track once, and a learner's query is judged on SQLite", async () => {
    const before = (await call("GET", owner, "/practice-admin/starter-packs")).json().packs;
    expect(before.map((p: { name: string; imported: boolean }) => [p.name, p.imported])).toEqual([
      ["cs-fundamentals", false],
      ["sql-starter", false],
    ]);
    expect((await call("POST", viewer, "/practice-admin/starter-packs/sql-starter")).statusCode).toBe(403);
    const added = await call("POST", owner, "/practice-admin/starter-packs/sql-starter");
    expect(added.statusCode, added.payload).toBe(201);
    expect(added.json()).toEqual({ track: "sql-starter", lessons: 0, problems: 8 });
    expect((await call("POST", owner, "/practice-admin/starter-packs/sql-starter")).statusCode).toBe(409);

    const track = (await call("GET", null, "/practice/nit-practice/tracks/sql-starter")).json();
    expect(track.modules.map((m: { title: string; items: unknown[] }) => [m.title, m.items.length])).toEqual([
      ["Filtering", 2],
      ["Joins and grouping", 3],
      ["Subqueries and window functions", 3],
    ]);

    const token = (await call("POST", null, "/practice/nit-practice/signup", { name: "Asha", email: "asha@example.com", password: "a long enough password" })).json().token as string;
    const answer = (source: string) => ({ answer: source, language: "sql" });
    const wrong = await call("POST", token, "/practice/nit-practice/problems/second-highest-salary/submit", answer("SELECT max(salary) AS SecondHighestSalary FROM Employee;"));
    expect(wrong.statusCode, wrong.payload).toBe(200);
    expect(wrong.json().status).not.toBe("passed");
    const right = await call(
      "POST",
      token,
      "/practice/nit-practice/problems/second-highest-salary/submit",
      answer("SELECT max(salary) AS SecondHighestSalary FROM Employee WHERE salary < (SELECT max(salary) FROM Employee);"),
    );
    expect(right.json().status).toBe("passed");
  }, 60_000);

  it("adds CS fundamentals as lessons, questions and a track by subject", async () => {
    const added = await call("POST", owner, "/practice-admin/starter-packs/cs-fundamentals");
    expect(added.statusCode, added.payload).toBe(201);
    expect(added.json()).toMatchObject({ track: "cs-fundamentals", problems: 80 });
    const track = (await call("GET", null, "/practice/nit-practice/tracks/cs-fundamentals")).json();
    expect(track.modules.map((m: { title: string }) => m.title)).toEqual(CS_FUNDAMENTALS.subjects.map((s) => s.name));
    const first = track.modules[0].items[0];
    expect(first.kind).toBe("lesson");
    const lesson = (await call("GET", null, `/practice/nit-practice/lessons/${first.slug}`)).json();
    expect(lesson.body).toContain("## What is a process in operating systems?");
    const problem = track.modules[0].items[1];
    const view = (await call("GET", null, `/practice/nit-practice/problems/${problem.slug}`)).json();
    expect(view.question.kind).toBe("mcq");
    expect(view.question.options).toHaveLength(4);
  }, 60_000);
});
