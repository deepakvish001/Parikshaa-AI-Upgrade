import { describe, expect, it } from "vitest";
import { examId, questionId, type Exam, type Question } from "./domain.js";
import { validateExam } from "./validate.js";

const mcq: Question = {
  id: questionId("q1"),
  kind: "mcq",
  stem: "Which sort is stable?",
  maxScore: 4,
  rubric: [],
  options: ["quicksort", "mergesort"],
  correctIndex: 1,
};

const short: Question = {
  id: questionId("q2"),
  kind: "short",
  stem: "Why does it terminate?",
  maxScore: 10,
  rubric: [{ id: "c1", description: "Identifies the measure", weight: 1 }],
  expectedPoints: [],
};

const exam = (overrides: Partial<Exam> = {}): Exam => ({
  id: examId("exam-1"),
  title: "Algorithms",
  questions: [mcq, short],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
  ...overrides,
});

const problemsOf = (e: Exam) => {
  const result = validateExam(e);
  return result.ok ? [] : result.problems.map((p) => p.path);
};

describe("validateExam", () => {
  it("accepts a well-formed exam", () => {
    expect(validateExam(exam())).toEqual({ ok: true });
  });

  it("requires a title and at least one question", () => {
    expect(problemsOf(exam({ title: "  " }))).toContain("title");
    expect(problemsOf(exam({ questions: [] }))).toContain("questions");
  });

  it("rejects duplicate question ids", () => {
    expect(problemsOf(exam({ questions: [mcq, mcq] }))).toContain("questions");
  });

  it("requires marks greater than zero", () => {
    // A question worth nothing is never probed (shouldProbe guards on it) and
    // contributes nothing to a total — almost always a mistake.
    expect(problemsOf(exam({ questions: [{ ...mcq, maxScore: 0 }] }))).toContain("questions.0.maxScore");
  });

  it("keeps the viva trigger ratio a fraction", () => {
    expect(problemsOf(exam({ policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 1.5 } })))
      .toContain("policy.vivaTriggerRatio");
    expect(problemsOf(exam({ policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: -0.1 } })))
      .toContain("policy.vivaTriggerRatio");
    expect(problemsOf(exam({ policy: { durationMs: 0, allowRevision: true, vivaTriggerRatio: 0.5 } })))
      .toContain("policy.durationMs");
  });

  it("checks that an mcq's correct answer is one of its options", () => {
    expect(problemsOf(exam({ questions: [{ ...mcq, correctIndex: 5 }] }))).toContain("questions.0.correctIndex");
    expect(problemsOf(exam({ questions: [{ ...mcq, correctIndex: -1 }] }))).toContain("questions.0.correctIndex");
    expect(problemsOf(exam({ questions: [{ ...mcq, options: ["only one"], correctIndex: 0 }] })))
      .toContain("questions.0.options");
  });

  it("checks several right options, partial credit and negative marks", () => {
    const m = mcq as Extract<Question, { kind: "mcq" }>;
    const three = { ...m, options: ["a", "b", "c"] };
    expect(problemsOf(exam({ questions: [{ ...three, correctIndex: 0, correctIndices: [0, 2] }] }))).toEqual([]);
    expect(problemsOf(exam({ questions: [{ ...three, correctIndex: 0, correctIndices: [0, 7] }] }))).toContain("questions.0.correctIndices");
    expect(problemsOf(exam({ questions: [{ ...three, correctIndex: 0, correctIndices: [0, 0] }] }))).toContain("questions.0.correctIndices");
    expect(problemsOf(exam({ questions: [{ ...three, correctIndex: 1, correctIndices: [0, 2] }] }))).toContain("questions.0.correctIndex");
    expect(problemsOf(exam({ questions: [{ ...m, partialCredit: true }] }))).toContain("questions.0.partialCredit");
    expect(problemsOf(exam({ questions: [{ ...m, negativeMarks: 1 }] }))).toEqual([]);
    expect(problemsOf(exam({ questions: [{ ...m, negativeMarks: -1 }] }))).toContain("questions.0.negativeMarks");
    expect(problemsOf(exam({ questions: [{ ...m, negativeMarks: 5 }] }))).toContain("questions.0.negativeMarks");
  });

  it("checks pictures and passages", () => {
    const hash = "0".repeat(64);
    expect(problemsOf(exam({ questions: [{ ...mcq, images: [{ media: hash, alt: "A bar chart of sales" }] }] }))).toEqual([]);
    expect(problemsOf(exam({ questions: [{ ...mcq, images: [{ media: "nope", alt: "x" }] }] }))).toContain("questions.0.images.0.media");
    expect(problemsOf(exam({ questions: [{ ...mcq, images: [{ media: hash, alt: " " }] }] }))).toContain("questions.0.images.0.alt");
    expect(problemsOf(exam({ questions: [{ ...mcq, passage: { id: "p", text: "" } }] }))).toContain("questions.0.passage.text");
  });

  it("checks numeric expectations and tolerance", () => {
    const bad = { ...mcq, kind: "numeric", expected: Number.NaN, tolerance: -1 } as unknown as Question;
    expect(problemsOf(exam({ questions: [bad] }))).toEqual(
      expect.arrayContaining(["questions.0.expected", "questions.0.tolerance"]),
    );
  });

  it("requires a rubric for anything graded by rubric", () => {
    expect(problemsOf(exam({ questions: [{ ...short, rubric: [] }] }))).toContain("questions.0.rubric");

    const code = { ...short, kind: "code", language: "python", rubric: [] } as unknown as Question;
    expect(problemsOf(exam({ questions: [code] }))).toContain("questions.0.rubric");
  });

  it("rejects rubric criteria with bad weights or duplicate ids", () => {
    const zeroWeight = { ...short, rubric: [{ id: "c1", description: "x", weight: 0 }] };
    expect(problemsOf(exam({ questions: [zeroWeight] }))).toContain("questions.0.rubric");

    const duplicate = {
      ...short,
      rubric: [
        { id: "c1", description: "x", weight: 1 },
        { id: "c1", description: "y", weight: 1 },
      ],
    };
    expect(problemsOf(exam({ questions: [duplicate] }))).toContain("questions.0.rubric");
  });

  it("reports every problem at once rather than the first", () => {
    const result = validateExam(exam({ title: "", questions: [{ ...mcq, maxScore: 0, correctIndex: 9 }] }));

    // An author fixing one field at a time through three round trips is worse
    // than being told everything that is wrong.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.length).toBeGreaterThanOrEqual(3);
  });

  describe("translations", () => {
    const problems = (q: Question) => {
      const r = validateExam(exam({ questions: [q] }));
      return r.ok ? [] : r.problems.map((p) => p.path);
    };

    it("accepts a question in Hindi, options in the same order", () => {
      expect(problems({ ...mcq, translations: { hi: { stem: "कौन सा सॉर्ट स्थिर है?", options: ["क्विकसॉर्ट", "मर्जसॉर्ट"] } } })).toEqual([]);
      expect(problems({ ...short, translations: { hi: { stem: "यह क्यों रुकता है?" } } })).toEqual([]);
    });

    it("refuses an mcq translated without every option, since the answer is recorded by position", () => {
      expect(problems({ ...mcq, translations: { hi: { stem: "कौन?", options: ["क्विकसॉर्ट"] } } })).toEqual(["questions.0.translations.hi.options"]);
      expect(problems({ ...mcq, translations: { hi: { stem: "कौन?" } } })).toEqual(["questions.0.translations.hi.options"]);
    });

    it("refuses an empty stem, options on a question without them, and a language it does not know", () => {
      expect(problems({ ...short, translations: { hi: { stem: " " } } })).toEqual(["questions.0.translations.hi.stem"]);
      expect(problems({ ...short, translations: { hi: { stem: "क्यों?", options: ["a"] } } })).toEqual(["questions.0.translations.hi.options"]);
      expect(problems({ ...short, translations: { xx: { stem: "?" } } as never })).toEqual(["questions.0.translations.xx"]);
    });
  });
});
