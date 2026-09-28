import { describe, expect, it } from "vitest";
import { cohortAnalytics, outcomeOf, percentileOf, resultOf, type AttemptResult } from "./analytics.js";
import { attemptId, candidateId, examId, questionId, vivaId, type Exam, type ExamEvent } from "./domain.js";
import { ExamLedger } from "./ledger.js";

const mcq = (id: string) => ({
  id: questionId(id),
  kind: "mcq" as const,
  stem: `Question ${id}`,
  maxScore: 10,
  rubric: [],
  options: ["a", "b"],
  correctIndex: 0,
});

const exam: Exam = {
  id: examId("e1"),
  title: "E",
  questions: [mcq("good"), mcq("trick")],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
};

/** A graded attempt scoring `good` and `trick` as given, with an optional follow-up reading. */
function attempt(n: number, good: number, trick: number, verdict?: "consistent" | "shallow" | "inconsistent", on: Exam = exam): AttemptResult {
  const id = attemptId(`a${n}`);
  let clock = 1_000_000;
  const ledger = new ExamLedger({ clock: () => (clock += 60_000) });
  const events: ExamEvent[] = [
    { type: "attempt_started", attemptId: id, examId: exam.id, candidateId: candidateId(`c${n}`), questionIds: [questionId("good"), questionId("trick")] },
    { type: "answer_submitted", attemptId: id, response: { questionId: questionId("good"), answer: "0", submittedAt: 1 } },
    ...(verdict === undefined
      ? []
      : ([
          { type: "viva_probed", attemptId: id, probe: { id: vivaId("p"), questionId: questionId("good"), prompt: "?", rationale: "r", askedAt: 1 } },
          { type: "viva_replied", attemptId: id, exchange: { probeId: vivaId("p"), reply: "x", repliedAt: 2, latencyMs: 1 } },
          { type: "viva_assessed", attemptId: id, assessment: { probeId: vivaId("p"), verdict, confidence: 1, reasoning: "r" } },
        ] as ExamEvent[])),
    { type: "attempt_submitted", attemptId: id },
    { type: "question_scored", attemptId: id, questionId: questionId("good"), score: good },
    { type: "question_scored", attemptId: id, questionId: questionId("trick"), score: trick },
    { type: "attempt_graded", attemptId: id, total: good + trick },
  ];
  for (const e of events) ledger.append(e);
  return resultOf(ledger.entries(), on)!;
}

describe("resultOf", () => {
  it("reads a graded attempt from its chain", () => {
    const result = attempt(1, 10, 5, "consistent");

    expect(result).toMatchObject({
      candidateId: "c1",
      state: "graded",
      total: 15,
      maxTotal: 20,
      percent: 75,
      scores: { good: { score: 10, max: 10 }, trick: { score: 5, max: 10 } },
      probes: { asked: 1, replied: 1, verdicts: { consistent: 1 } },
    });
    expect(result.durationMs).toBeGreaterThan(0);
  });
});

describe("cohortAnalytics", () => {
  // Strong candidates get "good" right and "trick" wrong; weak ones the reverse.
  const cohort = [
    ...Array.from({ length: 10 }, (_, i) => attempt(i, 10, 0, i % 2 === 0 ? "consistent" : undefined)),
    ...Array.from({ length: 10 }, (_, i) => attempt(10 + i, 0, 3, i === 0 ? "inconsistent" : undefined)),
  ];
  const analytics = cohortAnalytics(cohort, exam);

  it("describes the spread of totals", () => {
    expect(analytics.graded).toBe(20);
    expect(analytics.distribution[5]).toBe(10); // 50%
    expect(analytics.distribution[1]).toBe(10); // 15%
    expect(analytics.meanPercent).toBe(32.5);
  });

  it("finds the question that separates strong from weak, and the one that works backwards", () => {
    const [good, trick] = analytics.questions;
    expect(good).toMatchObject({ questionId: "good", facility: 0.5, discrimination: 1 });
    expect(trick!.discrimination).toBeLessThan(0);
  });

  it("tallies follow-ups as evidence for the cohort, attached to no one", () => {
    expect(analytics.integrity).toEqual({
      candidatesProbed: 6,
      asked: 6,
      replied: 6,
      read: 6,
      verdicts: { consistent: 5, shallow: 0, inconsistent: 1, inconclusive: 0 },
    });
    expect(JSON.stringify(analytics.integrity)).not.toMatch(/c\d+|a\d+/);
  });

  it("says nothing it cannot support", () => {
    const small = cohortAnalytics([attempt(1, 10, 0)], exam);
    expect(small.questions[0]!.discrimination).toBeNull();
    expect(cohortAnalytics([], exam)).toMatchObject({ meanPercent: null, medianPercent: null, time: { medianMinutes: null } });
  });
});

describe("cut-off", () => {
  const sectioned: Exam = {
    ...exam,
    questions: [mcq("good")],
    sections: [{ id: "apt", title: "Aptitude", pick: 1, pool: [mcq("trick")] }],
    policy: { ...exam.policy, cutoff: { percent: 50, sections: { apt: 40 } } },
  };

  it("scores each part of a sectioned paper", () => {
    const result = attempt(1, 10, 3, undefined, sectioned);
    expect(result.sections).toEqual([
      { id: "", title: "General", score: 10, max: 10, percent: 100 },
      { id: "apt", title: "Aptitude", score: 3, max: 10, percent: 30 },
    ]);
  });

  it("qualifies only when the whole paper and every section with a minimum reach it", () => {
    expect(attempt(1, 10, 3, undefined, sectioned).outcome).toBe("failed"); // 65% overall, 30% in aptitude
    expect(attempt(2, 10, 4, undefined, sectioned).outcome).toBe("qualified");
    expect(attempt(3, 0, 10, undefined, sectioned).outcome).toBe("qualified"); // exactly 50%
    expect(attempt(4, 0, 4, undefined, sectioned).outcome).toBe("failed");
  });

  it("says nothing without a cut-off", () => {
    expect(attempt(1, 10, 10).outcome).toBeNull();
    expect(attempt(1, 10, 10).sections).toEqual([]);
    expect(cohortAnalytics([attempt(1, 10, 10)], exam).qualified).toBeNull();
  });

  it("counts the cohort either side of it", () => {
    const cohort = [attempt(1, 10, 3, undefined, sectioned), attempt(2, 10, 4, undefined, sectioned), attempt(3, 10, 10, undefined, sectioned)];
    const analytics = cohortAnalytics(cohort, sectioned);
    expect([analytics.qualified, analytics.failed]).toEqual([2, 1]);
  });

  it("lets a section worth nothing on this paper hold no one back", () => {
    expect(outcomeOf({ percent: 10, sections: { x: 90 } }, 20, [{ id: "x", title: "X", score: 0, max: 0, percent: null }])).toBe("qualified");
  });
});

describe("percentileOf", () => {
  it("counts those behind, and half of those level", () => {
    expect(percentileOf(50, [10, 50, 50, 90])).toBe(50);
    expect(percentileOf(100, [10, 20])).toBe(100);
    expect(percentileOf(5, [])).toBeNull();
  });
});
