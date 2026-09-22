import type { AttemptProjection } from "./attempt.js";
import type { Exam, ExamPolicy, Question, QuestionId, Response } from "./domain.js";

/**
 * Scoring, and the decision of which answers are worth a micro-viva.
 *
 * Two kinds of question can be scored with no model at all: an mcq has a
 * correct index and a numeric question has an expected value and a tolerance.
 * Short and code answers need a rubric grader, which lives in `@parikshaa/viva`
 * because it calls a model. Keeping the deterministic half here means the
 * majority of scoring stays cheap, offline and exactly reproducible.
 */

export type ScoreMethod = "deterministic" | "rubric" | "tests";

export interface QuestionScore {
  readonly questionId: QuestionId;
  readonly score: number;
  readonly maxScore: number;
  readonly method: ScoreMethod;
  /** Present for rubric grading, which must justify itself; null for deterministic. */
  readonly reasoning: string | null;
}

/** Whether this question can only be scored by a rubric grader. A code question with tests is scored by running them. */
export function needsRubricGrading(question: Question): boolean {
  return question.kind === "short" || (question.kind === "code" && (question.tests ?? []).length === 0);
}

/**
 * Score a question that needs no model.
 *
 * Returns null for questions that require a rubric grader — the caller is
 * expected to route those to `@parikshaa/viva`, not to treat null as zero.
 */
export function scoreDeterministic(question: Question, answer: string): QuestionScore | null {
  const award = (correct: boolean): QuestionScore => ({
    questionId: question.id,
    score: correct ? question.maxScore : 0,
    maxScore: question.maxScore,
    method: "deterministic",
    reasoning: null,
  });

  switch (question.kind) {
    case "mcq": {
      const chosen = Number.parseInt(answer.trim(), 10);
      return award(Number.isInteger(chosen) && chosen === question.correctIndex);
    }
    case "numeric": {
      const value = Number.parseFloat(answer.trim());
      return award(Number.isFinite(value) && Math.abs(value - question.expected) <= question.tolerance);
    }
    case "short":
    case "code":
      return null;
  }
}

export function totalScore(scores: Iterable<QuestionScore>): number {
  let total = 0;
  for (const score of scores) total += score.score;
  return total;
}

/**
 * Whether an answer scored well enough that its provenance is worth one question.
 *
 * This is the `vivaTriggerRatio` rule from SPEC §4: below the threshold the
 * answer is already clearly wrong, so where it came from does not matter. A
 * question worth no marks is never probed — there is nothing to be wrong about.
 */
export function shouldProbe(score: QuestionScore, policy: ExamPolicy): boolean {
  if (score.maxScore <= 0) return false;
  return score.score / score.maxScore >= policy.vivaTriggerRatio;
}

export interface ProbeTarget {
  readonly question: Question;
  readonly response: Response;
  readonly score: QuestionScore;
}

/**
 * Pick the answers that should be probed next.
 *
 * An answer qualifies when it cleared the trigger ratio and does not already
 * have a probe on this attempt. Re-probing the same answer would turn a single
 * follow-up into an interrogation, which SPEC §4 rules out explicitly.
 */
export function selectProbeTargets(
  projection: AttemptProjection,
  exam: Exam,
  scores: Iterable<QuestionScore>,
): readonly ProbeTarget[] {
  const alreadyProbed = new Set(projection.vivas.map((v) => v.probe.questionId));
  const responses = new Map(projection.attempt.responses.map((r) => [r.questionId, r]));
  const questions = new Map(exam.questions.map((q) => [q.id, q]));

  const targets: ProbeTarget[] = [];
  for (const score of scores) {
    if (alreadyProbed.has(score.questionId)) continue;
    if (!shouldProbe(score, exam.policy)) continue;

    const question = questions.get(score.questionId);
    const response = responses.get(score.questionId);
    if (question === undefined || response === undefined) continue;

    targets.push({ question, response, score });
  }
  return targets;
}
