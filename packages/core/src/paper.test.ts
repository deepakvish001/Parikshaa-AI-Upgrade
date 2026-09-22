import { describe, expect, it } from "vitest";
import { attemptId, examId, questionId, type Exam, type Question } from "./domain.js";
import { allQuestions, paperOf, resolvePaper } from "./paper.js";
import { validateExam } from "./validate.js";

const mcq = (id: string, maxScore = 2): Question => ({
  id: questionId(id),
  kind: "mcq",
  stem: `Question ${id}`,
  maxScore,
  rubric: [],
  options: ["a", "b"],
  correctIndex: 0,
});

const exam: Exam = {
  id: examId("e1"),
  title: "Aptitude",
  questions: [mcq("fixed-1")],
  sections: [
    { id: "quant", title: "Quantitative", pick: 3, pool: ["q1", "q2", "q3", "q4", "q5", "q6"].map((id) => mcq(id)) },
    { id: "verbal", title: "Verbal", pick: 1, pool: ["v1", "v2"].map((id) => mcq(id, 3)) },
  ],
  policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
};

describe("resolvePaper", () => {
  it("gives everyone the fixed questions and draws the rest per section", () => {
    const paper = resolvePaper(exam, attemptId("a1"));

    expect(paper[0]).toBe("fixed-1");
    expect(paper).toHaveLength(1 + 3 + 1);
    expect(paper.slice(1, 4).every((id) => id.startsWith("q"))).toBe(true);
    expect(paper[4]?.startsWith("v")).toBe(true);
    expect(new Set(paper).size).toBe(paper.length);
  });

  it("is the same paper every time for the same attempt, so it can be recomputed", () => {
    expect(resolvePaper(exam, attemptId("a1"))).toEqual(resolvePaper(exam, attemptId("a1")));
  });

  it("gives neighbours different papers", () => {
    const papers = new Set(
      Array.from({ length: 40 }, (_, i) => resolvePaper(exam, attemptId(`attempt-${i}`)).join(",")),
    );
    // 6-choose-3 in order is 120 draws for the quant section alone.
    expect(papers.size).toBeGreaterThan(30);
  });

  it("draws every pool question roughly as often as the others", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      for (const id of resolvePaper(exam, attemptId(`a-${i}`)).slice(1, 4)) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // Each of six questions should appear in about half of 3000 papers.
    for (const count of counts.values()) expect(count).toBeGreaterThan(1300);
    for (const count of counts.values()) expect(count).toBeLessThan(1700);
  });
});

describe("paperOf", () => {
  it("is the exam as one attempt sits it, and nothing it did not draw", () => {
    const ids = resolvePaper(exam, attemptId("a1"));
    const paper = paperOf(exam, ids);

    expect(paper.questions.map((q) => q.id)).toEqual(ids);
    expect(paper.sections).toBeUndefined();
    expect(paper.questions.some((q) => !ids.includes(q.id))).toBe(false);
  });

  it("falls back to the fixed questions for a ledger from before sections", () => {
    expect(paperOf(exam, undefined).questions.map((q) => q.id)).toEqual(["fixed-1"]);
  });

  it("lists every question the exam could set", () => {
    expect(allQuestions(exam)).toHaveLength(1 + 6 + 2);
  });
});

describe("validating sections", () => {
  const withSection = (section: Partial<NonNullable<Exam["sections"]>[number]>): Exam => ({
    ...exam,
    sections: [{ id: "s", title: "S", pick: 1, pool: [mcq("p1"), mcq("p2")], ...section }],
  });
  const paths = (e: Exam) => {
    const result = validateExam(e);
    return result.ok ? [] : result.problems.map((p) => p.path);
  };

  it("accepts a well-formed exam with sections, even with no fixed questions", () => {
    expect(validateExam({ ...exam, questions: [] })).toEqual({ ok: true });
  });

  it("refuses to draw more than the pool holds, or nothing", () => {
    expect(paths(withSection({ pick: 3 }))).toContain("sections.0.pick");
    expect(paths(withSection({ pick: 0 }))).toContain("sections.0.pick");
  });

  it("refuses a pool whose questions carry different marks", () => {
    expect(paths(withSection({ pool: [mcq("p1", 2), mcq("p2", 5)] }))).toContain("sections.0.pool");
  });

  it("refuses a question id used twice anywhere in the exam", () => {
    expect(paths(withSection({ pool: [mcq("fixed-1"), mcq("p2")] }))).toContain("questions");
  });

  it("validates the questions inside a pool", () => {
    expect(paths(withSection({ pool: [{ ...mcq("p1"), stem: "" } as Question, mcq("p2")] }))).toContain(
      "sections.0.pool.0.stem",
    );
  });
});
