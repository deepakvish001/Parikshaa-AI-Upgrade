import { describe, expect, it } from "vitest";
import { foldAttempt } from "./attempt.js";
import {
  attemptId,
  candidateId,
  examId,
  questionId,
  vivaId,
  type Exam,
  type ExamEvent,
  type McqQuestion,
  type NumericQuestion,
  type Question,
  type ShortQuestion,
} from "./domain.js";
import { ExamLedger } from "./ledger.js";
import {
  needsRubricGrading,
  scoreDeterministic,
  selectProbeTargets,
  shouldProbe,
  totalScore,
  type QuestionScore,
} from "./scoring.js";

const A = attemptId("attempt-1");
const E = examId("exam-1");
const C = candidateId("cand-1");
const Q1 = questionId("q1");
const Q2 = questionId("q2");

const mcq: McqQuestion = {
  id: Q1,
  kind: "mcq",
  stem: "Pick one",
  maxScore: 4,
  rubric: [],
  options: ["a", "b", "c"],
  correctIndex: 1,
};

const numeric: NumericQuestion = {
  id: Q2,
  kind: "numeric",
  stem: "Compute it",
  maxScore: 5,
  rubric: [],
  expected: 9.8,
  tolerance: 0.1,
};

const short: ShortQuestion = {
  id: Q1,
  kind: "short",
  stem: "Explain",
  maxScore: 10,
  rubric: [],
  expectedPoints: ["a point"],
};

const scoreOf = (q: Question, answer: string): QuestionScore => {
  const score = scoreDeterministic(q, answer);
  if (score === null) throw new Error("expected a deterministic score");
  return score;
};

describe("scoreDeterministic", () => {
  it("awards an mcq only for the correct index", () => {
    expect(scoreOf(mcq, "1").score).toBe(4);
    expect(scoreOf(mcq, " 1 ").score).toBe(4);
    expect(scoreOf(mcq, "2").score).toBe(0);
  });

  it("treats an unparseable mcq answer as wrong, not as a crash", () => {
    expect(scoreOf(mcq, "").score).toBe(0);
    expect(scoreOf(mcq, "b").score).toBe(0);
  });

  it("awards a numeric answer within tolerance", () => {
    expect(scoreOf(numeric, "9.8").score).toBe(5);
    expect(scoreOf(numeric, "9.75").score).toBe(5);
    expect(scoreOf(numeric, "9.6").score).toBe(0);
    expect(scoreOf(numeric, "NaN").score).toBe(0);
  });

  it("returns null for questions that need a rubric grader", () => {
    expect(scoreDeterministic(short, "anything")).toBeNull();
    expect(needsRubricGrading(short)).toBe(true);
    expect(needsRubricGrading(mcq)).toBe(false);
  });

  it("sums a set of scores", () => {
    expect(totalScore([scoreOf(mcq, "1"), scoreOf(numeric, "9.8")])).toBe(9);
  });
});

describe("shouldProbe", () => {
  const policy = { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 };

  it("probes at or above the trigger ratio and not below", () => {
    expect(shouldProbe(scoreOf(mcq, "1"), policy)).toBe(true); // 4/4
    expect(shouldProbe(scoreOf(mcq, "0"), policy)).toBe(false); // 0/4
    expect(shouldProbe({ ...scoreOf(mcq, "1"), score: 2 }, policy)).toBe(true); // exactly 0.5
    expect(shouldProbe({ ...scoreOf(mcq, "1"), score: 1 }, policy)).toBe(false);
  });

  it("never probes a question worth no marks", () => {
    expect(shouldProbe({ ...scoreOf(mcq, "1"), score: 0, maxScore: 0 }, policy)).toBe(false);
  });
});

describe("selectProbeTargets", () => {
  const exam: Exam = {
    id: E,
    title: "Test",
    questions: [mcq, numeric],
    policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
  };

  const projectionFor = (...extra: readonly ExamEvent[]) => {
    const ledger = new ExamLedger({ clock: () => 1 });
    ledger.append({ type: "attempt_started", attemptId: A, examId: E, candidateId: C });
    ledger.append({
      type: "answer_submitted",
      attemptId: A,
      response: { questionId: Q1, answer: "1", submittedAt: 1 },
    });
    ledger.append({
      type: "answer_submitted",
      attemptId: A,
      response: { questionId: Q2, answer: "0", submittedAt: 1 },
    });
    for (const event of extra) ledger.append(event);
    const result = foldAttempt(ledger.entries());
    if (!result.ok) throw new Error("fold failed");
    return result.projection;
  };

  const scores = [scoreOf(mcq, "1"), scoreOf(numeric, "0")]; // 4/4 and 0/5

  it("selects only answers that cleared the trigger ratio", () => {
    const targets = selectProbeTargets(projectionFor(), exam, scores);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.question.id).toBe(Q1);
    expect(targets[0]?.response.answer).toBe("1");
  });

  it("does not re-probe a question that already has a probe", () => {
    const probed = projectionFor({
      type: "viva_probed",
      attemptId: A,
      probe: {
        id: vivaId("probe-1"),
        questionId: Q1,
        prompt: "Why?",
        rationale: "Scored above the ratio.",
        askedAt: 1,
      },
    });

    expect(selectProbeTargets(probed, exam, scores)).toEqual([]);
  });

  it("skips a score with no matching question or response", () => {
    const orphan: QuestionScore = {
      questionId: questionId("ghost"),
      score: 10,
      maxScore: 10,
      method: "rubric",
      reasoning: "n/a",
    };

    expect(selectProbeTargets(projectionFor(), exam, [orphan])).toEqual([]);
  });
});
