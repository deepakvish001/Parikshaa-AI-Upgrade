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

/** A LeetCode-style round: one function question, judged by value. */
const functionQuestion = {
  id: "two-sum",
  kind: "code",
  stem: "Given `nums` and `target`, return the indices of the two numbers that add up to `target`.",
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python", "java", "cpp"],
  signature: {
    name: "twoSum",
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returns: "int[]",
    anyOrder: "top",
  },
  constraints: "- `2 <= nums.length <= 10^4`\n- Exactly one answer exists.",
  tests: [
    { id: "s1", input: "[2,7,11,15]\n9", expected: "[0,1]", hidden: false, weight: 1, explanation: "`nums[0] + nums[1] == 9`" },
    { id: "h1", input: "[3,2,4]\n6", expected: "[1,2]", hidden: true, weight: 1 },
    { id: "h2", input: "[31337,5,31336]\n62673", expected: "[0,2]", hidden: true, weight: 2 },
  ],
} as const;

const functionExam = (id: string, policy: object) => ({
  id,
  title: "LeetCode round",
  questions: [functionQuestion],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 1, ...policy },
});

const TWO_SUM = [
  "class Solution:",
  "    def twoSum(self, nums: List[int], target: int) -> List[int]:",
  "        print('looking at', nums)",
  "        seen = {}",
  "        for i, n in enumerate(nums):",
  "            if target - n in seen:",
  "                return [i, seen[target - n]]",
  "            seen[n] = i",
].join("\n");

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
  for (const payload of [exam, functionExam("leetcode-round", {}), functionExam("visible-only", { testFeedback: "visible" })]) {
    const saved = await app.inject({ method: "POST", url: "/exams", headers: bearer(owner), payload });
    expect(saved.statusCode, saved.payload).toBe(201);
  }
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

describe("function questions, as on LeetCode", () => {
  async function startIn(examId: string) {
    const res = await call("POST", owner, `/exams/${examId}/attempts`, { candidateId: "cand-1" });
    return res.json() as { attemptId: string; token: string };
  }

  it("shows the function to write, a starter per language, the statement and its examples", async () => {
    const { token } = await startIn("leetcode-round");
    const res = await call("GET", token, "/attempts/me");
    const question = res.json().exam.questions[0];
    expect(question.function).toEqual({ name: "twoSum", params: functionQuestion.signature.params, returns: "int[]" });
    expect(question.starters.java).toContain("public int[] twoSum(int[] nums, int target)");
    expect(question.starters.cpp).toContain("vector<int> twoSum(vector<int>& nums, int target)");
    expect(question.constraints).toContain("Exactly one answer exists.");
    expect(question.samples).toEqual([{ input: "[2,7,11,15]\n9", output: "[0,1]", explanation: "`nums[0] + nums[1] == 9`" }]);
    expect(res.json().exam).toMatchObject({ testFeedback: "all", codeCompletion: false });
    for (const leak of ["31337", "[3,2,4]", "anyOrder", "pk_"]) expect(res.payload).not.toContain(leak);
  });

  it("runs the function on the examples, showing what it returned apart from what it printed", async () => {
    const { token } = await startIn("leetcode-round");
    const res = await call("POST", token, "/attempts/me/run", { questionId: "two-sum", language: "python", source: TWO_SUM });
    expect(res.statusCode, res.payload).toBe(200);
    const [result] = res.json().results;
    // [1,0] is accepted: the question allows any order.
    expect(result).toMatchObject({ status: "passed", result: "[1,0]", stdout: "looking at [2, 7, 11, 15]\n" });
    expect(result.memoryKb).toBeGreaterThan(0);
  });

  it("runs on the candidate's own arguments, one per line", async () => {
    const { token } = await startIn("leetcode-round");
    const res = await call("POST", token, "/attempts/me/run", { questionId: "two-sum", language: "python", source: TWO_SUM, input: "[1,4]\n5\n" });
    expect(res.json().results[0]).toMatchObject({ status: "ran", result: "[1,0]", expectedOutput: null });
  });

  it("submits: commits the answer, runs every test, and reports hidden tests without their content", async () => {
    const { token } = await startIn("leetcode-round");
    // Prints its input on every test, which must not publish the hidden ones.
    const res = await call("POST", token, "/attempts/me/code/submit", { questionId: "two-sum", language: "python", source: TWO_SUM });
    expect(res.statusCode, res.payload).toBe(200);
    const verdict = res.json();
    expect(verdict).toMatchObject({ tested: true, compiled: true, passed: 3, total: 3 });
    expect(verdict.cases.map((t: { visible: boolean; status: string }) => [t.visible, t.status])).toEqual([
      [true, "passed"],
      [false, "passed"],
      [false, "passed"],
    ]);
    expect(verdict.cases[0]).toMatchObject({ input: "[2,7,11,15]\n9", expectedOutput: "[0,1]", result: "[1,0]" });
    expect(verdict.cases[1]).toMatchObject({ input: null, expectedOutput: null, stdout: null, result: null, stderr: null });
    expect(res.payload).not.toContain("31337");

    // The receipt opens once the attempt closes.
    await call("POST", token, "/attempts/me/submit");
    const ledger = (await call("GET", token, "/attempts/me/ledger")).json();
    const types = ledger.entries.map((e: { type: string }) => e.type);
    expect(types).toContain("answer_submitted");
    expect(ledger.entries.find((e: { type: string }) => e.type === "code_tested").event).toMatchObject({ passed: 3, total: 3, score: 10 });
  });

  it("reports only the visible tests when the exam says so", async () => {
    const { token } = await startIn("visible-only");
    const wrong = TWO_SUM.replace("return [i, seen[target - n]]", "return [0, 1]");
    const verdict = (await call("POST", token, "/attempts/me/code/submit", { questionId: "two-sum", language: "python", source: wrong })).json();
    expect(verdict).toMatchObject({ tested: true, compiled: true, passed: null, total: null });
    expect(verdict.cases).toHaveLength(1);
    expect(verdict.cases[0]).toMatchObject({ visible: true, status: "passed" });
  });

  it("scores a Java solution by the same tests", async () => {
    const { attemptId, token } = await startIn("leetcode-round");
    const java = [
      "class Solution {",
      "    public int[] twoSum(int[] nums, int target) {",
      "        for (int i = 0; i < nums.length; i++)",
      "            for (int j = i + 1; j < nums.length; j++)",
      "                if (nums[i] + nums[j] == target) return new int[] {i, j};",
      "        return new int[0];",
      "    }",
      "}",
    ].join("\n");
    const verdict = (await call("POST", token, "/attempts/me/code/submit", { questionId: "two-sum", language: "java", source: java })).json();
    expect(verdict).toMatchObject({ passed: 3, total: 3 });
    await call("POST", token, "/attempts/me/submit");
    expect((await call("POST", owner, `/attempts/${attemptId}/grade`)).json()).toEqual({ total: 10 });
  }, 30_000);

  it("commits the answer even when the runner is down, and says it was not tested", async () => {
    const { token } = await startIn("leetcode-round");
    runnerDown = true;
    const res = await call("POST", token, "/attempts/me/code/submit", { questionId: "two-sum", language: "python", source: TWO_SUM });
    expect(res.json()).toEqual({ tested: false, reason: "runner_unavailable" });
    const state = (await call("GET", token, "/attempts/me")).json();
    expect(state.answers.map((a: { questionId: string }) => a.questionId)).toEqual(["two-sum"]);
  });

  it("refuses a language the question does not offer, before committing anything", async () => {
    const { token } = await startIn("leetcode-round");
    const res = await call("POST", token, "/attempts/me/code/submit", { questionId: "two-sum", language: "c", source: "int x;" });
    expect(res.statusCode).toBe(409);
    expect((await call("GET", token, "/attempts/me")).json().answers).toEqual([]);
  });
});

describe("the two language lists", () => {
  it("agree, so no exam offers a language the runner cannot build", () => {
    expect([...CODE_LANGUAGES].sort()).toEqual([...LANGUAGES].sort());
  });
});
