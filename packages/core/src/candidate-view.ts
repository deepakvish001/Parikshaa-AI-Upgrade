import type { Exam, ExamId, Question, QuestionId, QuestionKind } from "./domain.js";

/**
 * What a candidate is allowed to see while sitting an exam.
 *
 * An {@link Exam} carries its own answer key: `correctIndex` on an mcq,
 * `expected` and `tolerance` on a numeric, `expectedPoints` on a short answer.
 * Handing that to the client would end the exam. The rubric goes too — criteria
 * read as hints while the paper is open.
 *
 * This is a projection rather than a filter on the way out: the candidate-facing
 * types simply have nowhere for an answer key to live, so a field added to
 * `Question` later cannot leak by being forgotten here. It will fail to compile
 * instead.
 */

interface CandidateQuestionBase {
  readonly id: QuestionId;
  readonly kind: QuestionKind;
  readonly stem: string;
  readonly maxScore: number;
}

export interface CandidateMcqQuestion extends CandidateQuestionBase {
  readonly kind: "mcq";
  readonly options: readonly string[];
}

export interface CandidateShortQuestion extends CandidateQuestionBase {
  readonly kind: "short";
}

export interface CandidateNumericQuestion extends CandidateQuestionBase {
  readonly kind: "numeric";
}

export interface CandidateCodeQuestion extends CandidateQuestionBase {
  readonly kind: "code";
  readonly language: string;
  readonly starter: string | null;
}

export type CandidateQuestion =
  | CandidateMcqQuestion
  | CandidateShortQuestion
  | CandidateNumericQuestion
  | CandidateCodeQuestion;

export interface CandidateExam {
  readonly id: ExamId;
  readonly title: string;
  readonly durationMs: number;
  readonly allowRevision: boolean;
  readonly questions: readonly CandidateQuestion[];
}

export function candidateQuestion(question: Question): CandidateQuestion {
  const base = { id: question.id, stem: question.stem, maxScore: question.maxScore } as const;

  switch (question.kind) {
    case "mcq":
      return { ...base, kind: "mcq", options: question.options };
    case "short":
      return { ...base, kind: "short" };
    case "numeric":
      return { ...base, kind: "numeric" };
    case "code":
      return { ...base, kind: "code", language: question.language, starter: question.starter ?? null };
  }
}

/**
 * The exam as the candidate sees it.
 *
 * `vivaTriggerRatio` is deliberately absent: knowing the threshold tells a
 * candidate which of their answers is about to be probed, which is a score
 * disclosure by another route.
 */
export function candidateView(exam: Exam): CandidateExam {
  return {
    id: exam.id,
    title: exam.title,
    durationMs: exam.policy.durationMs,
    allowRevision: exam.policy.allowRevision,
    questions: exam.questions.map(candidateQuestion),
  };
}
