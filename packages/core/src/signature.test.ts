import { describe, expect, it } from "vitest";
import { candidateView } from "./candidate-view.js";
import { runnable, starterOf } from "./code.js";
import { examId, questionId, type CodeQuestion, type Exam } from "./domain.js";
import {
  argumentLines,
  conforms,
  describeType,
  functionChecker,
  functionTestProblems,
  programFor,
  RESULT_MARKER,
  signatureProblems,
  starterFor,
  type Signature,
} from "./signature.js";
import { validateExam } from "./validate.js";

const twoSum: Signature = {
  name: "twoSum",
  params: [
    { name: "nums", type: "int[]" },
    { name: "target", type: "int" },
  ],
  returns: "int[]",
  anyOrder: "top",
};

const question: CodeQuestion = {
  id: questionId("two-sum"),
  kind: "code",
  stem: "Return the indices of the two numbers that add up to `target`.",
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python", "java", "cpp", "c", "javascript"],
  signature: twoSum,
  constraints: "- `2 <= nums.length <= 10^4`",
  tests: [
    { id: "s1", input: "[2,7,11,15]\n9", expected: "[0,1]", hidden: false, weight: 1, explanation: "Because `nums[0] + nums[1] == 9`." },
    { id: "h1", input: "[3,3]\n6", expected: "[0,1]", hidden: true, weight: 2 },
  ],
};

/** The same question answered with a whole program. */
const { signature: _unused, ...program } = question;

describe("starters", () => {
  it("writes the function each language's candidates expect", () => {
    expect(starterFor(twoSum, "python")).toContain("def twoSum(self, nums: List[int], target: int) -> List[int]:");
    expect(starterFor(twoSum, "java")).toContain("public int[] twoSum(int[] nums, int target)");
    expect(starterFor(twoSum, "cpp")).toContain("vector<int> twoSum(vector<int>& nums, int target)");
    expect(starterFor(twoSum, "javascript")).toContain("var twoSum = function(nums, target)");
    expect(starterFor(twoSum, "javascript")).toContain("@param {number[]} nums");
  });

  it("follows LeetCode's C convention for arrays: sizes passed in, and out through returnSize", () => {
    expect(starterFor(twoSum, "c")).toContain("int* twoSum(int* nums, int numsSize, int target, int* returnSize)");
    const grid: Signature = { name: "transpose", params: [{ name: "grid", type: "int[][]" }], returns: "int[][]" };
    expect(starterFor(grid, "c")).toContain(
      "int** transpose(int** grid, int gridSize, int* gridColSize, int* returnSize, int** returnColumnSizes)",
    );
    const words: Signature = { name: "longest", params: [{ name: "words", type: "string[]" }], returns: "string" };
    expect(starterFor(words, "c")).toContain("char* longest(char** words, int wordsSize)");
  });

  it("uses a question's own starter per language when it has no signature", () => {
    const own: CodeQuestion = { ...program, starter: "# read input", starters: { java: "public class Main {}" } };
    expect(starterOf(own, "java")).toBe("public class Main {}");
    expect(starterOf(own, "python")).toBe("# read input");
  });
});

describe("signatures", () => {
  it("accepts a good one", () => {
    expect(signatureProblems(twoSum)).toEqual([]);
  });

  it("refuses names a language reserves, clashes, and names the generated program uses", () => {
    const bad: Signature = {
      name: "class",
      params: [
        { name: "vector", type: "int" },
        { name: "x", type: "int" },
        { name: "x", type: "int" },
        { name: "pk_a0", type: "int" },
      ],
      returns: "int",
    };
    const problems = signatureProblems(bad).join(" | ");
    expect(problems).toMatch(/"class" cannot be the function's name/);
    expect(problems).toMatch(/"vector" cannot be a parameter's name/);
    expect(problems).toMatch(/Two parameters are called "x"/);
    expect(problems).toMatch(/"pk_a0" cannot be a parameter's name/);
  });

  it("checks each test's lines against the parameters' types, and the expected value against the return type", () => {
    expect(functionTestProblems(twoSum, "[2,7,11,15]\n9\n", "[0,1]")).toEqual([]);
    expect(functionTestProblems(twoSum, "[2,7,11,15]", "[0,1]")[0]).toMatch(/one line per parameter \(nums, target\); it has 1/);
    expect(functionTestProblems(twoSum, "[2,7.5]\n9", "[0,1]")[0]).toMatch(/Line 1 is not a list of whole numbers/);
    expect(functionTestProblems(twoSum, "2,7\n9", "[0,1]")[0]).toMatch(/Line 1 \(nums\) is not JSON: write it as \[1,2,3\]/);
    expect(functionTestProblems(twoSum, "[2,7]\n9", "0 1")[0]).toMatch(/expected output is not JSON/);
  });

  it("knows its types", () => {
    expect(conforms(2 ** 31, "int")).toBe(false);
    expect(conforms(2 ** 31, "long")).toBe(true);
    expect(conforms([[1], []], "int[][]")).toBe(true);
    expect(conforms([["a", 1]], "string[][]")).toBe(false);
    expect(conforms(1.5, "double")).toBe(true);
    expect(describeType("string[][]")).toBe("a list of lists of strings");
    expect(argumentLines("[1]\r\n\r\n9\n")).toEqual(["[1]", "9"]);
  });

  it("judges by value, with a tolerance only when a double comes back", () => {
    expect(functionChecker(twoSum)).toEqual({ kind: "json", tolerance: 0, unordered: "top" });
    expect(functionChecker({ name: "mean", params: [{ name: "xs", type: "int[]" }], returns: "double" }).tolerance).toBe(1e-5);
  });
});

describe("the program around a function", () => {
  it("is what the runner gets, with the marker and the value checker", () => {
    const answer = { language: "python", source: "class Solution:\n    def twoSum(self, nums, target):\n        return [0, 1]\n" };
    const prepared = runnable(question, answer);
    expect(prepared.resultMarker).toBe(RESULT_MARKER);
    expect(prepared.checker).toEqual({ kind: "json", tolerance: 0, unordered: "top" });
    expect(prepared.source).toContain(JSON.stringify(answer.source));
  });

  it("leaves a whole-program question's source alone", () => {
    const numbers: CodeQuestion = { ...program, checker: { kind: "numbers", tolerance: 1e-6 } };
    const prepared = runnable(numbers, { language: "python", source: "print(1)" });
    expect(prepared).toEqual({ source: "print(1)", checker: { kind: "numbers", tolerance: 1e-6 } });
  });

  it("lets Java candidates write public class Solution, as they do on LeetCode", () => {
    const program = programFor(twoSum, "java", "public class Solution {\n}");
    expect(program).not.toMatch(/public class Solution/);
    expect(program).toMatch(/class Solution/);
  });

  it("puts the candidate's code on their own line numbers", () => {
    const source = "class Solution {\npublic:\n};";
    expect(programFor(twoSum, "cpp", source)).toContain(`#line 1 "solution.cpp"\n${source}`);
    // Java's imports share the candidate's first line.
    expect(programFor(twoSum, "java", source).split("\n")[0]).toMatch(/^import java\.util\.\*;.*class Solution \{$/);
  });
});

describe("what a candidate sees of a function question", () => {
  const exam: Exam = {
    id: examId("e"),
    title: "Coding",
    questions: [{ ...question, checker: { kind: "custom", source: "import sys  # the secret: any pair summing to target" } }],
    policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
  };

  it("shows the function, the starters, the statement and the worked examples", () => {
    const view = candidateView(exam).questions[0];
    if (view?.kind !== "code") throw new Error("expected a code question");
    expect(view.function).toEqual({ name: "twoSum", params: twoSum.params, returns: "int[]" });
    expect(Object.keys(view.starters).sort()).toEqual(["c", "cpp", "java", "javascript", "python"]);
    expect(view.constraints).toBe("- `2 <= nums.length <= 10^4`");
    expect(view.inputFormat).toBeNull();
    expect(view.samples).toEqual([{ input: "[2,7,11,15]\n9", output: "[0,1]", explanation: "Because `nums[0] + nums[1] == 9`." }]);
  });

  it("never carries the checker, the hidden tests or the generated program", () => {
    const payload = JSON.stringify(candidateView(exam));
    expect(payload).not.toContain("the secret");
    expect(payload).not.toContain("[3,3]");
    expect(payload).not.toContain("pk_");
    expect(payload).not.toContain("anyOrder");
  });
});

describe("validating function questions", () => {
  const exam = (q: CodeQuestion): Exam => ({
    id: examId("e"),
    title: "Coding",
    questions: [q],
    policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
  });

  it("accepts a good question", () => {
    expect(validateExam(exam(question))).toEqual({ ok: true });
  });

  it("names a test whose lines do not fit the function", () => {
    const bad = { ...question, tests: [...question.tests!, { id: "h2", input: "[1,2]", expected: "[0,1]", hidden: true, weight: 1 }] };
    const result = validateExam(exam(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toMatchObject({ path: "questions.0.tests.2", message: expect.stringMatching(/^Test 3: /) });
  });

  it("refuses an output checker on a function question, other than a program", () => {
    const result = validateExam(exam({ ...question, checker: { kind: "unordered" } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map((p) => p.path)).toEqual(["questions.0.checker"]);
  });

  it("checks a whole-program question's checker and starters", () => {
    const whole: CodeQuestion = {
      ...program,
      tests: [
        { id: "s", input: "1", expected: "1", hidden: false, weight: 1 },
        { id: "h", input: "2", expected: "2", hidden: true, weight: 1 },
      ],
      checker: { kind: "numbers", tolerance: 0 },
      starters: { cobol: "IDENTIFICATION DIVISION." },
    };
    const result = validateExam(exam(whole));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.map((p) => p.path).sort()).toEqual(["questions.0.checker.tolerance", "questions.0.starters.cobol"]);
  });
});
