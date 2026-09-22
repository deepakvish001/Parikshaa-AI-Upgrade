/**
 * Parikshaa core domain model.
 *
 * The vocabulary is deliberately small: an {@link Exam} is a fixed set of
 * {@link Question}s, a candidate works through one {@link Attempt} at it, and
 * every observable step is recorded as an {@link ExamEvent}. Scoring, proctoring
 * and the micro-viva engine all read from that event stream rather than mutating
 * attempt state in place, so an attempt can always be replayed from its ledger.
 */

/** Opaque id types, so a CandidateId can never be passed where an ExamId belongs. */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type OrgId = Brand<string, "OrgId">;
export type CandidateId = Brand<string, "CandidateId">;
export type ExamId = Brand<string, "ExamId">;
export type AttemptId = Brand<string, "AttemptId">;
export type QuestionId = Brand<string, "QuestionId">;
export type VivaId = Brand<string, "VivaId">;

export const orgId = (v: string): OrgId => v as OrgId;
export const candidateId = (v: string): CandidateId => v as CandidateId;
export const examId = (v: string): ExamId => v as ExamId;
export const attemptId = (v: string): AttemptId => v as AttemptId;
export const questionId = (v: string): QuestionId => v as QuestionId;
export const vivaId = (v: string): VivaId => v as VivaId;

/** Milliseconds since the Unix epoch. */
export type Timestamp = number;

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

export type QuestionKind = "mcq" | "short" | "numeric" | "code";

export interface RubricCriterion {
  readonly id: string;
  readonly description: string;
  readonly weight: number;
}

interface QuestionBase {
  readonly id: QuestionId;
  readonly kind: QuestionKind;
  readonly stem: string;
  readonly maxScore: number;
  /** Criteria a grader (human or model) must justify itself against. */
  readonly rubric: readonly RubricCriterion[];
}

export interface McqQuestion extends QuestionBase {
  readonly kind: "mcq";
  readonly options: readonly string[];
  readonly correctIndex: number;
}

export interface ShortQuestion extends QuestionBase {
  readonly kind: "short";
  readonly expectedPoints: readonly string[];
}

export interface NumericQuestion extends QuestionBase {
  readonly kind: "numeric";
  readonly expected: number;
  readonly tolerance: number;
}

export interface CodeQuestion extends QuestionBase {
  readonly kind: "code";
  readonly language: string;
  readonly starter?: string;
}

export type Question = McqQuestion | ShortQuestion | NumericQuestion | CodeQuestion;

// ---------------------------------------------------------------------------
// Exams and attempts
// ---------------------------------------------------------------------------

export interface ExamPolicy {
  /** Wall-clock budget for the whole attempt. */
  readonly durationMs: number;
  /** Whether a submitted answer may be revised before the attempt is submitted. */
  readonly allowRevision: boolean;
  /**
   * Score below which a micro-viva is *not* worth running (the answer is already
   * clearly wrong) and above which it is (the answer is strong enough that its
   * provenance matters). Expressed as a fraction of the question's maxScore.
   */
  readonly vivaTriggerRatio: number;
}

export interface Exam {
  readonly id: ExamId;
  readonly title: string;
  readonly questions: readonly Question[];
  readonly policy: ExamPolicy;
}

export type AttemptState = "created" | "in_progress" | "submitted" | "graded" | "void";

export interface Response {
  readonly questionId: QuestionId;
  readonly answer: string;
  readonly submittedAt: Timestamp;
}

export interface Attempt {
  readonly id: AttemptId;
  readonly examId: ExamId;
  readonly candidateId: CandidateId;
  readonly state: AttemptState;
  readonly startedAt: Timestamp;
  readonly responses: readonly Response[];
}

// ---------------------------------------------------------------------------
// Micro-viva
// ---------------------------------------------------------------------------

/**
 * A micro-viva is a short follow-up exchange about an answer the candidate has
 * already given. It asks the candidate to defend or extend their own reasoning,
 * which is cheap for someone who understood the answer and expensive for someone
 * who obtained it. A verdict is evidence about *provenance*, never a second grade.
 */
export type VivaVerdict = "consistent" | "shallow" | "inconsistent" | "inconclusive";

export interface VivaProbe {
  readonly id: VivaId;
  readonly questionId: QuestionId;
  /** The follow-up put to the candidate. */
  readonly prompt: string;
  /** Why this probe was asked — kept for audit and appeal. */
  readonly rationale: string;
  readonly askedAt: Timestamp;
}

export interface VivaExchange {
  readonly probeId: VivaId;
  readonly reply: string;
  readonly repliedAt: Timestamp;
  /** Seconds between probe and reply; unusually fast replies are themselves a signal. */
  readonly latencyMs: number;
}

export interface VivaAssessment {
  readonly probeId: VivaId;
  readonly verdict: VivaVerdict;
  readonly confidence: number;
  readonly reasoning: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Everything that can happen to an attempt. These are the payloads the ledger
 * chains together; each one is append-only and never edited after the fact.
 */
export type ExamEvent =
  | { readonly type: "attempt_started"; readonly attemptId: AttemptId; readonly examId: ExamId; readonly candidateId: CandidateId }
  | { readonly type: "answer_submitted"; readonly attemptId: AttemptId; readonly response: Response }
  | { readonly type: "attempt_submitted"; readonly attemptId: AttemptId }
  | { readonly type: "viva_probed"; readonly attemptId: AttemptId; readonly probe: VivaProbe }
  | { readonly type: "viva_replied"; readonly attemptId: AttemptId; readonly exchange: VivaExchange }
  | { readonly type: "viva_assessed"; readonly attemptId: AttemptId; readonly assessment: VivaAssessment }
  | { readonly type: "question_scored"; readonly attemptId: AttemptId; readonly questionId: QuestionId; readonly score: number }
  | { readonly type: "attempt_graded"; readonly attemptId: AttemptId; readonly total: number }
  | {
      readonly type: "attempt_voided";
      readonly attemptId: AttemptId;
      readonly reason: string;
      /**
       * The person who decided, as they were named at the time.
       *
       * Hashed into the chain with everything else, so the decision is
       * attributable and the attribution is tamper-evident. Absent on ledgers
       * written before staff had individual accounts, when a shared token made
       * any name an unverified claim.
       */
      readonly decidedBy?: StaffAttribution;
    }
  | {
      /**
       * More time, granted by a person, with a reason — for a technical failure
       * or an accommodation.
       *
       * In the chain because the deadline is part of what the candidate is held
       * to: an answer accepted after the original window is only defensible if
       * the record shows who allowed it and why.
       */
      readonly type: "time_extended";
      readonly attemptId: AttemptId;
      readonly extraMs: number;
      readonly reason: string;
      readonly decidedBy: StaffAttribution;
    };

export type ExamEventType = ExamEvent["type"];

/** A staff member, as recorded against a decision they made. */
export interface StaffAttribution {
  readonly userId: string;
  readonly name: string;
}
