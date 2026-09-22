import { describe, expect, it } from "vitest";
import { candidateQuestion } from "./candidate-view.js";
import { decodeCodeAnswer, encodeCodeAnswer, scoreTests } from "./code.js";
import { questionId, type CodeQuestion } from "./domain.js";
import { validateExam } from "./validate.js";

const question: CodeQuestion = {
  id: questionId("q1"),
  kind: "code",
  stem: "Sum two numbers.",
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python", "cpp"],
  tests: [
    { id: "sample", input: "1 2", expected: "3", hidden: false, weight: 1 },
    { id: "big", input: "1000000000 1000000000", expected: "2000000000", hidden: true, weight: 2 },
    { id: "negative", input: "-5 3", expected: "-2", hidden: true, weight: 1 },
  ],
};

describe("code answers", () => {
  it("round-trip with their language", () => {
    const answer = encodeCodeAnswer({ language: "cpp", source: "int main(){}" });
    expect(decodeCodeAnswer(answer, question)).toEqual({ language: "cpp", source: "int main(){}" });
  });

  it("read plain source, from before languages could be chosen, in the default language", () => {
    expect(decodeCodeAnswer("print(1)", question)).toEqual({ language: "python", source: "print(1)" });
    expect(decodeCodeAnswer('{"not":"an answer"}', question).language).toBe("python");
  });

  it("score by the weight of the tests passed", () => {
    expect(scoreTests(question, new Set(["sample", "big", "negative"]))).toBe(10);
    expect(scoreTests(question, new Set(["big"]))).toBe(5);
    expect(scoreTests(question, new Set(["sample"]))).toBe(2.5);
    expect(scoreTests(question, new Set())).toBe(0);
  });
});

describe("what a candidate sees of a code question", () => {
  it("shows the visible tests as examples, and nothing of the hidden ones", () => {
    const view = candidateQuestion(question);
    expect(view).toMatchObject({ languages: ["python", "cpp"], samples: [{ input: "1 2", output: "3" }] });

    const json = JSON.stringify(view);
    for (const leak of ["1000000000", "2000000000", "-5 3", "hidden", "weight", "tests"]) {
      expect(json).not.toContain(leak);
    }
  });
});

describe("validating code questions", () => {
  const paths = (q: CodeQuestion) => {
    const result = validateExam({
      id: "e" as never,
      title: "T",
      questions: [q],
      policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
    });
    return result.ok ? [] : result.problems.map((p) => p.path);
  };

  it("accepts a question scored by tests, with no rubric", () => {
    expect(paths(question)).toEqual([]);
  });

  it("refuses a language the runner cannot build", () => {
    expect(paths({ ...question, languages: ["python", "cobol"] })).toContain("questions.0.language");
  });

  it("refuses tests that are all visible, since those answers can simply be printed", () => {
    expect(paths({ ...question, tests: question.tests!.map((t) => ({ ...t, hidden: false })) })).toContain("questions.0.tests");
  });

  it("refuses limits beyond what the runner allows", () => {
    expect(paths({ ...question, limits: { timeMs: 60_000 } })).toContain("questions.0.limits.timeMs");
    expect(paths({ ...question, limits: { memoryMb: 4096 } })).toContain("questions.0.limits.memoryMb");
  });
});
