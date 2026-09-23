import { languagesOf } from "./code.js";
import type { ContentLocale, Exam, ExamId, ProctoringPolicy, Question, QuestionId, QuestionKind, QuestionTranslation } from "./domain.js";

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
  /** The question in other languages: stems and options only, like the original. */
  readonly translations: Readonly<Partial<Record<ContentLocale, QuestionTranslation>>>;
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
  readonly languages: readonly string[];
  readonly starter: string | null;
  /**
   * The visible tests, as worked examples. Hidden tests have no field here and
   * so cannot reach a candidate by any route.
   */
  readonly samples: readonly { readonly input: string; readonly output: string }[];
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
  /** What the camera and browser are asked for: the candidate is told before they start. Null: nothing. */
  readonly proctoring: ProctoringPolicy | null;
}

export function candidateQuestion(question: Question): CandidateQuestion {
  // Copied field by field, so nothing a translation might one day grow can ride along.
  const translations: Partial<Record<ContentLocale, QuestionTranslation>> = {};
  for (const [locale, t] of Object.entries(question.translations ?? {}) as [ContentLocale, QuestionTranslation][]) {
    translations[locale] = question.kind === "mcq" && t.options !== undefined ? { stem: t.stem, options: t.options } : { stem: t.stem };
  }
  const base = { id: question.id, stem: question.stem, maxScore: question.maxScore, translations } as const;

  switch (question.kind) {
    case "mcq":
      return { ...base, kind: "mcq", options: question.options };
    case "short":
      return { ...base, kind: "short" };
    case "numeric":
      return { ...base, kind: "numeric" };
    case "code":
      return {
        ...base,
        kind: "code",
        language: question.language,
        languages: languagesOf(question),
        starter: question.starter ?? null,
        samples: (question.tests ?? [])
          .filter((t) => !t.hidden)
          // `output`, not `expected`: `expected` is the numeric answer key's
          // name, and the contract test forbids it anywhere a candidate sees.
          .map((t) => ({ input: t.input, output: t.expected })),
      };
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
    proctoring: exam.policy.proctoring ?? null,
  };
}
