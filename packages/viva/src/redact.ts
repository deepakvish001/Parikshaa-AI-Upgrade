import type { Question, QuestionKind, Response, RubricCriterion } from "@parikshaa/core";

/**
 * The pseudonymization boundary (SPEC §6.4, STACK §5).
 *
 * A probe needs the question, its rubric and the answer text. It never needs to
 * know who wrote the answer. Rather than relying on a rule that callers must
 * remember, this is enforced by the type: {@link RedactedAnswer} has no field a
 * candidate id, name or attempt id could travel in, and every prompt builder in
 * this package takes one of these rather than a `Response` plus an `Attempt`.
 *
 * That removes most of the data-residency question from the model call, and it
 * costs nothing.
 */
export interface RedactedAnswer {
  readonly questionKind: QuestionKind;
  readonly stem: string;
  readonly rubric: readonly RubricCriterion[];
  readonly maxScore: number;
  readonly answer: string;
}

export function redact(question: Question, response: Response): RedactedAnswer {
  return {
    questionKind: question.kind,
    stem: question.stem,
    rubric: question.rubric,
    maxScore: question.maxScore,
    answer: response.answer,
  };
}
