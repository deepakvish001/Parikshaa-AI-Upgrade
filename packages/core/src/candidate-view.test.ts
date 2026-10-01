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
  it("offers a microphone only on a question answered by speaking, and never the expected points", () => {
    const spoken = { id: "s1", kind: "short", stem: "Introduce yourself", maxScore: 5, rubric: [], expectedPoints: ["name"], spoken: true } as const;
    const plain = { id: "s2", kind: "short", stem: "Why?", maxScore: 5, rubric: [], expectedPoints: [] } as const;
    const view = candidateView({ id: examId("e"), title: "T", questions: [spoken, plain], policy: { durationMs: 60_000, allowRevision: true, vivaTriggerRatio: 0.5 } });
    expect(view.questions[0]).toMatchObject({ kind: "short", spoken: true });
    expect(view.questions[1]).not.toHaveProperty("spoken");
    expect(JSON.stringify(view)).not.toContain("expectedPoints");
  });

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
      multiple: false,
      negativeMarks: 0,
      translations: {},
      images: [],
      passage: null,
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

  it("says an mcq wants several options and what a wrong answer costs, but never which options are right", () => {
    const several = {
      ...exam,
      questions: [
        {
          id: "m",
          kind: "mcq",
          stem: "Which are primes?",
          maxScore: 4,
          rubric: [],
          options: ["2", "4", "5", "9"],
          correctIndex: 0,
          correctIndices: [0, 2],
          partialCredit: true,
          negativeMarks: 1,
          images: [{ media: "a".repeat(64), alt: "A number line" }],
          passage: { id: "p1", title: "Primes", text: "A prime has exactly two divisors." },
        },
      ],
    } as unknown as typeof exam;
    const view = candidateView(several);
    expect(view.questions[0]).toMatchObject({
      multiple: true,
      negativeMarks: 1,
      images: [{ media: "a".repeat(64), alt: "A number line" }],
      passage: { id: "p1", title: "Primes", text: "A prime has exactly two divisors.", images: [] },
    });
    const serialized = JSON.stringify(view);
    for (const leak of ["correctIndices", "correctIndex", "partialCredit"]) expect(serialized).not.toContain(leak);
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

  it("carries a question's translations — stems and options, and nothing else", () => {
    const translated: Exam = {
      ...exam,
      questions: [
        {
          ...(exam.questions[0] as Extract<Exam["questions"][number], { kind: "mcq" }>),
          translations: { hi: { stem: "कौन सा सॉर्ट स्थिर है?", options: ["क्विकसॉर्ट", "मर्जसॉर्ट"], note: "correctIndex 1" } as never },
        },
        { ...exam.questions[1]!, translations: { hi: { stem: "g का मान?" } } },
      ],
    };
    const view = candidateView(translated);
    expect(view.questions[0]!.translations).toEqual({ hi: { stem: "कौन सा सॉर्ट स्थिर है?", options: ["क्विकसॉर्ट", "मर्जसॉर्ट"] } });
    expect(view.questions[1]!.translations).toEqual({ hi: { stem: "g का मान?" } });
    expect(JSON.stringify(view)).not.toContain("correctIndex");
  });
});
