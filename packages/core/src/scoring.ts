import type { AttemptProjection } from "./attempt.js";
import type { Exam, ExamPolicy, McqQuestion, Question, QuestionId, Response } from "./domain.js";

/**
 * Scoring, and the decision of which answers are worth a micro-viva.
 *
 * Two kinds of question can be scored with no model at all: an mcq has its
 * right option (or options) and a numeric question has an expected value and a
 * tolerance. Either may take marks away for a wrong answer — never for none.
 * Short and code answers need a rubric grader, which lives in `@parikshaa/viva`
 * because it calls a model. Keeping the deterministic half here means the
 * majority of scoring stays cheap, offline and exactly reproducible.
 */

/** `person`: a take-home, scored 0 at grading until a person marks it (a `score_revised` entry). */
export type ScoreMethod = "deterministic" | "rubric" | "tests" | "person";

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
  return (question.kind === "short" && question.takeHome !== true) || (question.kind === "code" && (question.tests ?? []).length === 0);
}

/**
 * Score a question that needs no model.
 *
 * Returns null for questions that require a rubric grader — the caller is
 * expected to route those to `@parikshaa/viva`, not to treat null as zero.
 */
export function scoreDeterministic(question: Question, answer: string): QuestionScore | null {
  const scored = (score: number): QuestionScore => ({
    questionId: question.id,
    score,
    maxScore: question.maxScore,
    method: "deterministic",
    reasoning: null,
  });
  // A blank answer is no answer: it neither earns nor loses anything.
  const blank = answer.trim() === "";
  const penalty = (negativeMarks: number | undefined) => (blank || !negativeMarks ? 0 : -negativeMarks);

  switch (question.kind) {
    case "mcq": {
      const correct = correctOptions(question);
      const chosen = chosenOptions(answer);
      if (chosen === null) return scored(penalty(question.negativeMarks));
      if (sameSet(chosen, correct)) return scored(question.maxScore);
      const anyWrong = [...chosen].some((i) => !correct.has(i));
      if (question.partialCredit === true && correct.size > 1 && chosen.size > 0 && !anyWrong) {
        return scored((question.maxScore * chosen.size) / correct.size);
      }
      return scored(chosen.size === 0 ? 0 : penalty(question.negativeMarks));
    }
    case "numeric": {
      const value = Number.parseFloat(answer.trim());
      return Number.isFinite(value) && Math.abs(value - question.expected) <= question.tolerance
        ? scored(question.maxScore)
        : scored(penalty(question.negativeMarks));
    }
    case "short":
      // A take-home's work is behind its link, where no model can look: a person marks it.
      return question.takeHome === true
        ? { questionId: question.id, score: 0, maxScore: question.maxScore, method: "person", reasoning: "A take-home: a person opens the link and marks it." }
        : null;
    case "code":
      return null;
  }
}

/** The positions of an mcq's right options. */
export function correctOptions(question: McqQuestion): ReadonlySet<number> {
  return new Set(question.correctIndices !== undefined && question.correctIndices.length > 0 ? question.correctIndices : [question.correctIndex]);
}

/** Whether a candidate chooses several options for this question, rather than one. */
export const choosesSeveral = (question: McqQuestion): boolean => (question.correctIndices?.length ?? 0) > 0;

/** The options an answer chooses ("2", or "0,2" for several); null when it is not a list of positions. */
export function chosenOptions(answer: string): ReadonlySet<number> | null {
  const text = answer.trim();
  if (text === "") return new Set();
  const parts = text.split(",").map((p) => p.trim());
  if (parts.some((p) => !/^\d+$/.test(p))) return null;
  return new Set(parts.map(Number));
}

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) => a.size === b.size && [...a].every((x) => b.has(x));

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
