import type { Signature } from "./signature.js";

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

/**
 * Languages a question can be translated into (ROADMAP §9): Hindi, then the
 * scheduled languages a hiring drive most often needs. English is the
 * original, `stem` and `options` themselves.
 */
export const CONTENT_LOCALES = ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "or"] as const;
export type ContentLocale = (typeof CONTENT_LOCALES)[number];

/**
 * A question in another language. Only what a candidate reads: an mcq's
 * options in the same order as the original, since the answer is recorded as
 * the option's position and so means the same in every language.
 */
export interface QuestionTranslation {
  readonly stem: string;
  readonly options?: readonly string[];
}

/**
 * A picture shown with a question or passage: a diagram, a figure series, a
 * chart to read from. Stored once by the SHA-256 of its bytes and served at
 * `/api/media/<sha256>`, so an exam carries only the hash.
 */
export interface QuestionImage {
  /** SHA-256 of the image's bytes, hex. */
  readonly media: string;
  /** What the picture shows, for a screen reader and for anyone it fails to load for. */
  readonly alt: string;
}

/**
 * A passage several questions are about: reading comprehension, a data set,
 * a case. Carried on each of its questions, so a question drawn on its own
 * still has it; questions next to each other with the same passage `id` are
 * shown under one copy of it.
 */
export interface Passage {
  readonly id: string;
  readonly title?: string;
  readonly text: string;
  readonly images?: readonly QuestionImage[];
}

interface QuestionBase {
  readonly id: QuestionId;
  readonly kind: QuestionKind;
  readonly stem: string;
  readonly maxScore: number;
  /** Pictures shown with the stem. */
  readonly images?: readonly QuestionImage[];
  readonly passage?: Passage;
  /** Criteria a grader (human or model) must justify itself against. */
  readonly rubric: readonly RubricCriterion[];
  /** The question in other languages, by locale. The grader always reads the original. */
  readonly translations?: Readonly<Partial<Record<ContentLocale, QuestionTranslation>>>;
}

export interface McqQuestion extends QuestionBase {
  readonly kind: "mcq";
  readonly options: readonly string[];
  /** The right option; with `correctIndices`, the first of them. */
  readonly correctIndex: number;
  /**
   * More than one right option: the candidate chooses every one of them. The
   * answer is then the chosen positions, comma-separated ("0,2").
   */
  readonly correctIndices?: readonly number[];
  /**
   * With several right options: a share of the marks for each right option
   * chosen, provided no wrong one is — as JEE Advanced scores them. Without
   * it, all of them or nothing.
   */
  readonly partialCredit?: boolean;
  /** Marks taken away for a wrong answer. Leaving it unanswered costs nothing. */
  readonly negativeMarks?: number;
}

export interface ShortQuestion extends QuestionBase {
  readonly kind: "short";
  readonly expectedPoints: readonly string[];
  /**
   * A take-home (plan row 88): the candidate submits a link to work done on
   * their own time, with notes, instead of writing an answer here. A person
   * marks it against the rubric; it is never graded by a model.
   */
  readonly takeHome?: boolean;
}

export interface NumericQuestion extends QuestionBase {
  readonly kind: "numeric";
  readonly expected: number;
  readonly tolerance: number;
  /** Marks taken away for a wrong answer. Leaving it unanswered costs nothing. */
  readonly negativeMarks?: number;
}

/**
 * One test of a code answer: what goes to standard input, and what standard
 * output must be.
 *
 * Visible tests are shown to the candidate as worked examples and run when they
 * press Run. Hidden tests are never sent to the candidate's client in any form;
 * they decide the score.
 */
export interface CodeTest {
  readonly id: string;
  /** Standard input; for a function question, one JSON value per parameter, a line each. */
  readonly input: string;
  /** Standard output; for a function question, the JSON value the function returns. */
  readonly expected: string;
  readonly hidden: boolean;
  /** Share of the question's marks, relative to the other tests' weights. */
  readonly weight: number;
  /** Why the output is what it is, shown under a visible test as a worked example. Markdown. */
  readonly explanation?: string;
}

/**
 * How a program's output is judged, when not exactly. A function question is
 * judged by value (see `Signature`) unless it brings its own checker.
 */
export type CodeChecker =
  | { readonly kind: "exact" }
  /** The same words in the same order, however they are spaced. */
  | { readonly kind: "tokens" }
  /** Word by word, numbers equal within `tolerance`, absolute or relative. */
  | { readonly kind: "numbers"; readonly tolerance: number }
  /** The same lines in any order. */
  | { readonly kind: "unordered" }
  /** A Python 3 program, run as `checker.py input expected output`: exit 0 accepts, 1 rejects. For problems with many right answers. */
  | { readonly kind: "custom"; readonly source: string };

export interface CodeQuestion extends QuestionBase {
  readonly kind: "code";
  /** The default language, and the only one unless `languages` says otherwise. */
  readonly language: string;
  /** Languages the candidate may choose between. */
  readonly languages?: readonly string[];
  /** Starter code for every language, unless `starters` has one for it. */
  readonly starter?: string;
  /** Starter code by language. A function question's starters are written from its signature instead. */
  readonly starters?: Readonly<Record<string, string>>;
  /**
   * Present for a function question, LeetCode's kind: the candidate writes this
   * function and Parikshaa calls it. Absent, the candidate writes a whole
   * program that reads standard input.
   */
  readonly signature?: Signature;
  /** How output is judged; exactly, when absent. */
  readonly checker?: CodeChecker;
  /** The statement's further sections, in Markdown: the input's shape, the output's, and the limits on both. */
  readonly inputFormat?: string;
  readonly outputFormat?: string;
  readonly constraints?: string;
  /** When present, the answer is scored by running these, not by a rubric grader. */
  readonly tests?: readonly CodeTest[];
  readonly limits?: { readonly timeMs?: number; readonly memoryMb?: number };
  /**
   * An AI-fluency question (plan row 87): the candidate may ask an AI
   * assistant while answering, as they would at work. Every prompt and reply
   * goes in the ledger (`ai_assisted`), so the reviewer sees how it was used.
   */
  readonly aiAssist?: boolean;
}

/** One question to the AI assistant on an AI-fluency question, and its answer. */
export interface AiAssistExchange {
  readonly questionId: QuestionId;
  /** What the candidate asked. */
  readonly prompt: string;
  /** The assistant's answer, as shown to the candidate. */
  readonly reply: string;
  /** The candidate's code when they asked, sent with the question; null if the editor was empty. */
  readonly code: string | null;
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
  /** Camera proctoring (ROADMAP §14). Absent: none — the default, and Parikshaa's own position. */
  readonly proctoring?: ProctoringPolicy;
  /**
   * What Submit tells a candidate about their code: every test's verdict,
   * hidden tests without their content ("all", the default, as on LeetCode and
   * HackerRank), or only the visible tests' ("visible"), leaving the hidden
   * ones to be found out after the attempt.
   */
  readonly testFeedback?: "all" | "visible";
  /** Offer completion in the code editor. Off by default: most hiring tests are taken without it. */
  readonly codeCompletion?: boolean;
  /**
   * An on-screen scientific calculator in the exam bar, as JEE Main offers.
   * Off by default: most aptitude rounds test the arithmetic too.
   */
  readonly calculator?: boolean;
  /**
   * The mark a candidate must reach to qualify. Absent: results carry no
   * verdict, only marks. It decides nothing by itself; it sorts the list a
   * person reads.
   */
  readonly cutoff?: ExamCutoff;
}

/**
 * Qualifying marks, as a campus drive or an entrance test sets them: a share
 * of the whole paper, and optionally a share of each section, all of which a
 * candidate must reach.
 */
export interface ExamCutoff {
  /** Percent of the candidate's own paper, 0–100. */
  readonly percent: number;
  /**
   * Percent of the marks a section put on the candidate's paper, by section id.
   * "" is the exam's fixed questions, which come before any section.
   */
  readonly sections?: Readonly<Record<string, number>>;
}

/**
 * What a proctored exam asks of the candidate's camera and browser.
 *
 * Every piece is an observation for a person to weigh, never a verdict: a
 * photo does not fail anyone, and a switched tab is a reason to look, not a
 * finding. Everything captured is personal data, sealed under the attempt's
 * key and erased with the rest of it.
 */
export interface ProctoringPolicy {
  /** A photo of the candidate and of their photo ID before they begin, for an invigilator to check. */
  readonly identity: boolean;
  /** A webcam photo every this many seconds while the attempt is open; null for none. */
  readonly snapshotEverySeconds: number | null;
  /** Record leaving the tab, leaving full screen, and copying or pasting. */
  readonly browserEvents: boolean;
  /**
   * Secure mode (docs/LAUNCH-PLAN.md, F1 Hire): the candidate shares their
   * whole screen for the whole sitting, and a second screen connected is
   * recorded. Nothing of the screen is captured or kept: only that sharing
   * stopped or started, and when.
   */
  readonly screenShare?: boolean;
  /**
   * Listen for sustained speech or noise near the candidate. The microphone's
   * loudness is measured in the browser; no sound is recorded or sent, only
   * that it was heard, and when.
   */
  readonly audio?: boolean;
}

/**
 * A pool of interchangeable questions, of which each candidate gets `pick`.
 *
 * The pool is part of the exam, copied in when the exam is written — from the
 * question bank or by hand — and frozen with it once anyone has sat it. Editing
 * a bank question later changes no exam already built from it.
 */
export interface ExamSection {
  readonly id: string;
  readonly title: string;
  readonly pick: number;
  readonly pool: readonly Question[];
  /**
   * The section's own clock (ROADMAP §3). When any section has one, the exam
   * is taken in order: its fixed questions first, then each section, each
   * locked once left or once its time is up.
   */
  readonly durationMs?: number;
}

export interface Exam {
  readonly id: ExamId;
  readonly title: string;
  /** Questions every candidate gets. */
  readonly questions: readonly Question[];
  /** Questions drawn per candidate, so no two neighbours sit the same paper. */
  readonly sections?: readonly ExamSection[];
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
  | {
      readonly type: "attempt_started";
      readonly attemptId: AttemptId;
      readonly examId: ExamId;
      readonly candidateId: CandidateId;
      /**
       * The candidate's paper: which questions they were given, in order.
       * Hashed into the chain, so the receipt proves which paper was sat. Absent
       * on ledgers from before exams could draw questions per candidate.
       */
      readonly questionIds?: readonly QuestionId[];
      /**
       * When the scheduled window this attempt was started in closes, if it
       * closes hard: the attempt ends then even if its duration has not run
       * out. On the record, so the deadline a candidate was held to can be
       * checked like everything else.
       */
      readonly closesAt?: Timestamp;
    }
  | { readonly type: "answer_submitted"; readonly attemptId: AttemptId; readonly response: Response }
  | { readonly type: "attempt_submitted"; readonly attemptId: AttemptId }
  | { readonly type: "viva_probed"; readonly attemptId: AttemptId; readonly probe: VivaProbe }
  | { readonly type: "viva_replied"; readonly attemptId: AttemptId; readonly exchange: VivaExchange }
  | { readonly type: "viva_assessed"; readonly attemptId: AttemptId; readonly assessment: VivaAssessment }
  | {
      /**
       * The candidate asked the AI assistant on an AI-fluency question, and
       * this is what it said. Only while the attempt is open; the prompt, the
       * reply and the code are sealed like answers.
       */
      readonly type: "ai_assisted";
      readonly attemptId: AttemptId;
      readonly exchange: AiAssistExchange;
    }
  | { readonly type: "question_scored"; readonly attemptId: AttemptId; readonly questionId: QuestionId; readonly score: number }
  | { readonly type: "attempt_graded"; readonly attemptId: AttemptId; readonly total: number }
  | {
      /**
       * A mark changed by a person after grading: a recheck the candidate
       * asked for, or a marker correcting the model. The only change a graded
       * attempt takes besides being set aside, and never silent: who, why, and
       * the new mark are in the chain, and the total follows from it.
       */
      readonly type: "score_revised";
      readonly attemptId: AttemptId;
      readonly questionId: QuestionId;
      readonly score: number;
      readonly reason: string;
      readonly decidedBy: StaffAttribution;
    }
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
       * A code answer run against every one of its question's tests.
       *
       * Recorded when the answer is committed, so a strong solution can be
       * followed up while the candidate still remembers writing it, and so the
       * score that grading uses is on the record. Only counts, never test
       * contents: the chain is shown to the candidate once the attempt closes,
       * and hidden tests stay hidden from everyone who might sit them next.
       */
      readonly type: "code_tested";
      readonly attemptId: AttemptId;
      readonly questionId: QuestionId;
      readonly passed: number;
      readonly total: number;
      readonly score: number;
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
    }
  | {
      /**
       * A submitted attempt opened again by a person, with a reason and more
       * time: the machine crashed and submitted, the candidate pressed submit
       * by mistake, the power went. Never once graded or set aside.
       *
       * `extraMs` is added to the deadline like an extension, and is enough to
       * cover the time since the attempt closed plus what was granted, so the
       * record shows exactly how long the candidate was given.
       */
      readonly type: "attempt_reopened";
      readonly attemptId: AttemptId;
      readonly extraMs: number;
      readonly reason: string;
      readonly decidedBy: StaffAttribution;
    }
  | {
      /** The candidate entered a section of a sectioned exam: its clock starts now. */
      readonly type: "section_started";
      readonly attemptId: AttemptId;
      readonly sectionId: string;
    }
  | {
      /** The candidate left a section, or its time ran out: it is locked from here on. */
      readonly type: "section_closed";
      readonly attemptId: AttemptId;
      readonly sectionId: string;
      readonly reason: "left" | "time_up";
    }
  | {
      /**
       * The candidate's photo and their photo ID's, taken before they began
       * (ROADMAP §14). The images themselves are sealed outside the ledger;
       * the chain commits to their SHA-256, so neither can be swapped later.
       */
      readonly type: "identity_captured";
      readonly attemptId: AttemptId;
      readonly selfieSha256: string;
      readonly idSha256: string;
    }
  | {
      /** A person compared the photos and decided, with a reason on the record. */
      readonly type: "identity_reviewed";
      readonly attemptId: AttemptId;
      readonly outcome: "verified" | "rejected";
      readonly reason: string;
      readonly decidedBy: StaffAttribution;
    }
  | {
      /**
       * The candidate read the organisation's privacy notice and agreed to it
       * before their clock started (DPDP Act, s.6). `noticeHash` is the SHA-256
       * of the notice exactly as shown, so what they agreed to can be proved
       * later even after the notice has changed.
       */
      readonly type: "consent_given";
      readonly attemptId: AttemptId;
      readonly noticeVersion: number;
      readonly noticeHash: string;
    }
  | {
      /**
       * The attempt's personal data was erased: its data key destroyed, so the
       * sealed answers, replies and identity in this chain can no longer be
       * read. The chain itself — and the scores — stay, and still verify.
       * `request` is the candidate asking; `retention` is the organisation's
       * retention period running out.
       */
      readonly type: "data_erased";
      readonly attemptId: AttemptId;
      readonly reason: "request" | "retention";
      readonly decidedBy?: StaffAttribution;
    };

export type ExamEventType = ExamEvent["type"];

/** A staff member, as recorded against a decision they made. */
export interface StaffAttribution {
  readonly userId: string;
  readonly name: string;
}
