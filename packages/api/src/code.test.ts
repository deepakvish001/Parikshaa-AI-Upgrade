import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CODE_LANGUAGES, type Exam } from "@parikshaa/core";
import { LANGUAGES, RunnerUnavailable, execute, type CodeRunner } from "@parikshaa/runner";
import { pgliteExecutor } from "@parikshaa/store";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * ROADMAP §4: coding questions, run for real.
 *
 * The runner here is the real one, in process — real interpreters and
 * compilers, inside the sandbox when the suite has root. Runs as
 * `parikshaa_app`, so row-level security is live.
 */

const isRoot = process.getuid?.() === 0;
let workRoot: string;
const realRunner: CodeRunner = {
  run: (request) => execute(request, { workRoot, slot: isRoot ? { uid: 61050, gid: 61050 } : null }),
};
let runnerDown = false;
const runner: CodeRunner = {
  run: (request) => (runnerDown ? Promise.reject(new RunnerUnavailable("down")) : realRunner.run(request)),
};

/** What the probe engine was shown, to check it is the candidate's own code. */
let probedWith = "";
const fakeClient = {
  beta: {
    messages: {
      stream(params: { messages: { content: unknown }[] }) {
        probedWith = JSON.stringify(params.messages);
        const text = "Why did you check for overflow before adding?";
        return {
          on(_event: string, cb: (delta: string) => void) {
            cb(text);
          },
          async finalMessage() {
            return {
              content: [{ type: "text", text }],
              stop_reason: "end_turn",
              stop_details: null,
              usage: { input_tokens: 1, output_tokens: 1 },
            };
          },
        };
      },
    },
  },
} as unknown as Anthropic;

const exam: Exam = {
  id: "coding-round" as never,
  title: "Coding round",
  questions: [
    {
      id: "sum" as never,
      kind: "code",
      stem: "Read two integers and print their sum.",
      maxScore: 10,
      rubric: [],
      language: "python",
      languages: ["python", "cpp"],
      tests: [
        { id: "sample", input: "2 3\n", expected: "5\n", hidden: false, weight: 1 },
        { id: "big", input: "4000000000 4000000000\n", expected: "8000000000\n", hidden: true, weight: 2 },
        { id: "negative", input: "-7 2\n", expected: "-5\n", hidden: true, weight: 1 },
      ],
      limits: { timeMs: 3000 },
    },
    { id: "mcq" as never, kind: "mcq", stem: "Pick one", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 },
  ],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.8 },
};

const PYTHON_SUM = "a, b = map(int, input().split())\nprint(a + b)\n";
/** Right on the example, wrong on anything else: the classic hard-coded answer. */
const HARDCODED = "print(5)\n";

let db: PGlite;
let app: FastifyInstance;
let owner: string;

beforeEach(async () => {
  runnerDown = false;
  probedWith = "";
  workRoot = await mkdtemp(join(tmpdir(), "api-code-"));
  db = await freshDatabase();
  let identity;
  ({ app, identity } = await wire(pgliteExecutor(db), { client: fakeClient, runner }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  const saved = await app.inject({ method: "POST", url: "/exams", headers: bearer(owner), payload: exam });
  expect(saved.statusCode, saved.payload).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST", token: string, url: string, payload?: object) =>
  payload === undefined
    ? app.inject({ method, url, headers: bearer(token) })
    : app.inject({ method, url, headers: bearer(token), payload });

async function start() {
  const res = await call("POST", owner, "/exams/coding-round/attempts", { candidateId: "cand-1" });
  return res.json() as { attemptId: string; token: string };
}

const code = (language: string, source: string) => JSON.stringify({ language, source });

describe("what a candidate is shown", () => {
  it("the examples, and nothing of the hidden tests", async () => {
    const { token } = await start();
    const res = await call("GET", token, "/attempts/me");
    const question = res.json().exam.questions[0];

    expect(question).toMatchObject({ languages: ["python", "cpp"], samples: [{ input: "2 3\n", output: "5\n" }] });
    for (const leak of ["4000000000", "8000000000", "-7 2", "hidden", "weight"]) {
      expect(res.payload).not.toContain(leak);
    }
  });
});

describe("running code", () => {
  it("runs against the examples and reports each", async () => {
    const { token } = await start();
    const res = await call("POST", token, "/attempts/me/run", { questionId: "sum", language: "python", source: HARDCODED });

    expect(res.json()).toEqual({
      compiled: true,
      results: [expect.objectContaining({ input: "2 3\n", expectedOutput: "5\n", status: "passed", stdout: "5\n" })],
    });
  });

  it("runs on the candidate's own input, with nothing to compare against", async () => {
    const { token } = await start();
    const res = await call("POST", token, "/attempts/me/run", {
      questionId: "sum",
      language: "python",
      source: PYTHON_SUM,
      input: "40 2\n",
    });

    expect(res.json().results).toEqual([expect.objectContaining({ expectedOutput: null, status: "ran", stdout: "42\n" })]);
  });

  it("reports a compile error in C++", async () => {
    const { token } = await start();
    const res = await call("POST", token, "/attempts/me/run", { questionId: "sum", language: "cpp", source: "int main( {" });

    expect(res.json()).toMatchObject({ compiled: false, compileOutput: expect.stringMatching(/error/) });
  }, 30_000);

  it("refuses a language the question does not offer, and a question that is not code", async () => {
    const { token } = await start();
    expect((await call("POST", token, "/attempts/me/run", { questionId: "sum", language: "java", source: "x" })).statusCode).toBe(409);
    expect((await call("POST", token, "/attempts/me/run", { questionId: "mcq", language: "python", source: "x" })).statusCode).toBe(409);
  });

  it("answers 503 when the runner is down, rather than pretending", async () => {
    const { token } = await start();
    runnerDown = true;
    const res = await call("POST", token, "/attempts/me/run", { questionId: "sum", language: "python", source: PYTHON_SUM });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("runner_unavailable");
  });
});

describe("committing and grading code", () => {
  it("tests a committed answer in full, and grades by the hidden tests", async () => {
    const { attemptId, token } = await start();

    await call("POST", token, "/attempts/me/answers", { questionId: "sum", answer: code("python", HARDCODED) });
    await call("POST", token, "/attempts/me/submit");
    const graded = await call("POST", owner, `/attempts/${attemptId}/grade`);

    // Passes the example (weight 1 of 4) and nothing hidden: 2.5 of 10.
    expect(graded.json()).toEqual({ total: 2.5 });
    const ledger = (await call("GET", token, "/attempts/me/ledger")).json();
    expect(ledger.entries.find((e: { type: string }) => e.type === "code_tested").event).toMatchObject({
      questionId: "sum",
      passed: 1,
      total: 3,
      score: 2.5,
    });
    // The receipt names the counts, never the tests.
    expect(JSON.stringify(ledger)).not.toContain("8000000000");

    // So does the candidate's report, for the examiner.
    const report = (await call("GET", owner, `/attempts/${attemptId}/report`)).json();
    expect(report.questions.find((q: { id: string }) => q.id === "sum")).toMatchObject({ language: "python", tests: { passed: 1, total: 3 } });
    expect(report.questions.find((q: { id: string }) => q.id === "mcq").tests).toBeNull();
  });

  it("follows up a strong solution about the candidate's own code", async () => {
    const { token } = await start();
    await call("POST", token, "/attempts/me/answers", { questionId: "sum", answer: code("python", PYTHON_SUM) });

    const probe = await call("GET", token, "/attempts/me/probe");

    expect(probe.payload).toContain("event: probe");
    // The engine was shown the source, labelled, not the JSON it is stored in.
    expect(probedWith).toContain("(python)");
    expect(probedWith).toContain("map(int, input().split())");
    expect(probedWith).not.toContain('\\"source\\"');
  });

  it("does not follow up code that fails its tests", async () => {
    const { token } = await start();
    await call("POST", token, "/attempts/me/answers", { questionId: "sum", answer: code("python", HARDCODED) });

    expect((await call("GET", token, "/attempts/me/probe")).payload).toContain("event: none");
  });

  it("accepts an answer while the runner is down, and tests it at grading", async () => {
    const { attemptId, token } = await start();
    runnerDown = true;
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "sum", answer: code("python", PYTHON_SUM) })).statusCode).toBe(202);
    await call("POST", token, "/attempts/me/submit");

    expect((await call("POST", owner, `/attempts/${attemptId}/grade`)).statusCode).toBe(503);
    runnerDown = false;
    expect((await call("POST", owner, `/attempts/${attemptId}/grade`)).json()).toEqual({ total: 10 });
  });

  it("scores a C++ answer the same way", async () => {
    const { attemptId, token } = await start();
    const cpp = "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b<<\"\\n\";}\n";
    await call("POST", token, "/attempts/me/answers", { questionId: "sum", answer: code("cpp", cpp) });
    await call("POST", token, "/attempts/me/submit");

    expect((await call("POST", owner, `/attempts/${attemptId}/grade`)).json()).toEqual({ total: 10 });
  }, 30_000);
});

describe("the two language lists", () => {
  it("agree, so no exam offers a language the runner cannot build", () => {
    expect([...CODE_LANGUAGES].sort()).toEqual([...LANGUAGES].sort());
  });
});
