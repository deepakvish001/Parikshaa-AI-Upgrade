import { describe, expect, it } from "vitest";
import { candidateView } from "./candidate-view.js";
import { examId, questionId, type Exam } from "./domain.js";

const exam: Exam = {
  id: examId("exam-1"),
  title: "Algorithms",
  questions: [
    {
      id: questionId("q-mcq"),
      kind: "mcq",
      stem: "Which sort is stable?",
      maxScore: 4,
      rubric: [{ id: "c1", description: "secret criterion", weight: 1 }],
      options: ["quicksort", "mergesort"],
      correctIndex: 1,
    },
    {
      id: questionId("q-num"),
      kind: "numeric",
      stem: "Value of g?",
      maxScore: 5,
      rubric: [],
      expected: 9.8,
      tolerance: 0.1,
    },
    {
      id: questionId("q-short"),
      kind: "short",
      stem: "Why does it terminate?",
      maxScore: 10,
      rubric: [],
      expectedPoints: ["the measure decreases"],
    },
    {
      id: questionId("q-code"),
      kind: "code",
      stem: "Implement it",
      maxScore: 20,
      rubric: [],
      language: "python",
      starter: "def solve():",
    },
  ],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
};

describe("candidateView", () => {
  it("keeps what the candidate needs to answer", () => {
    const view = candidateView(exam);

    expect(view.title).toBe("Algorithms");
    expect(view.durationMs).toBe(3_600_000);
    expect(view.questions.map((q) => q.kind)).toEqual(["mcq", "numeric", "short", "code"]);
    expect(view.questions[0]).toEqual({
      id: questionId("q-mcq"),
      kind: "mcq",
      stem: "Which sort is stable?",
      maxScore: 4,
      options: ["quicksort", "mergesort"],
    });
    expect(view.questions[3]).toMatchObject({ language: "python", starter: "def solve():" });
  });

  it("carries no answer key anywhere in the payload", () => {
    const serialized = JSON.stringify(candidateView(exam));

    // The mcq's correct index, the numeric's expected value and tolerance, the
    // short answer's expected points, and every rubric criterion.
    for (const leak of ["correctIndex", "expected", "tolerance", "expectedPoints", "rubric", "secret criterion", "9.8", "the measure decreases"]) {
      expect(serialized).not.toContain(leak);
    }
  });

  it("does not disclose the viva trigger ratio", () => {
    // Knowing the threshold tells a candidate which answers scored well.
    expect(JSON.stringify(candidateView(exam))).not.toContain("vivaTriggerRatio");
    expect(candidateView(exam)).not.toHaveProperty("policy");
  });

  it("reports a missing code starter as null rather than dropping the field", () => {
    const withoutStarter: Exam = {
      ...exam,
      questions: [{ id: questionId("q"), kind: "code", stem: "s", maxScore: 1, rubric: [], language: "ts" }],
    };

    expect(candidateView(withoutStarter).questions[0]).toMatchObject({ starter: null });
  });
});
