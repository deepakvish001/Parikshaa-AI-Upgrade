import type Anthropic from "@anthropic-ai/sdk";
import {
  candidateView,
  foldAttempt,
  validateExam,
  scoreDeterministic,
  selectProbeTargets,
  totalScore,
  needsRubricGrading,
  type AttemptId,
  type AttemptProjection,
  type CandidateExam,
  type CandidateId,
  type Exam,
  type ExamId,
  type LedgerEntry,
  type ProbeTarget,
  type QuestionId,
  type QuestionScore,
  type Timestamp,
  type VivaAssessment,
  type VivaExchange,
  type VivaId,
  type VivaProbe,
} from "@parikshaa/core";
import type { AttemptSummary, ExamSummary } from "@parikshaa/store";
import { AppendRefused, LedgerStore } from "@parikshaa/store";
import { assessReply, generateProbe, gradeWithRubric } from "@parikshaa/viva";

/**
 * The orchestration layer: everything the HTTP routes do, minus HTTP.
 *
 * Every state change is an append to the attempt's ledger. Nothing here keeps
 * attempt state of its own — it reads the chain, folds it, decides, and appends.
 */

export class AttemptError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "invalid_state"
      | "unknown_question"
      | "unknown_probe"
      | "already_replied"
      | "expired"
      | "reason_required",
    message: string,
  ) {
    super(message);
    this.name = "AttemptError";
  }
}

export interface ServiceOptions {
  readonly store: LedgerStore;
  readonly client: Anthropic;
  readonly model?: string;
  readonly fastProbes?: boolean;
  readonly now?: () => Timestamp;
  readonly newId?: () => string;
}

export class ExamService {
  readonly #store: LedgerStore;
  readonly #engine: { client: Anthropic; model?: string; fastProbes?: boolean };
  readonly #now: () => Timestamp;
  readonly #newId: () => string;

  constructor(options: ServiceOptions) {
    this.#store = options.store;
    this.#engine = {
      client: options.client,
      ...(options.model === undefined ? {} : { model: options.model }),
      ...(options.fastProbes === undefined ? {} : { fastProbes: options.fastProbes }),
    };
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- reading ------------------------------------------------------------

  /**
   * Everything the candidate's own client may see while the attempt is open.
   *
   * The exam arrives as a {@link candidateView}, which has nowhere for an answer
   * key to live. An open probe is reported by prompt alone: its `rationale`
   * records the score that triggered it, and SPEC §4 forbids telling a candidate
   * mid-exam whether an answer was right.
   */
  async candidateState(id: AttemptId): Promise<CandidateState> {
    const projection = await this.projection(id);
    const exam = await this.#examFor(await this.#store.load(id));
    const open = projection.vivas.find((v) => v.exchange === null);

    return {
      attemptId: id,
      exam: candidateView(exam),
      state: projection.attempt.state,
      startedAt: projection.attempt.startedAt,
      answers: projection.attempt.responses.map((r) => ({
        questionId: r.questionId,
        answer: r.answer,
        submittedAt: r.submittedAt,
      })),
      expiresAt: deadlineOf(projection, exam),
      // A candidate set aside without being told why is the situation SPEC §6.2
      // objects to, so the reason travels with the state.
      voidReason: projection.voidReason,
      openProbe: open === undefined ? null : { id: open.probe.id, prompt: open.probe.prompt },
      answeredProbeCount: projection.vivas.filter((v) => v.exchange !== null).length,
    };
  }

  /**
   * The candidate's view of their own ledger (SPEC §6.2).
   *
   * While the attempt is open, only the head hash is released. That is enough
   * for the guarantee that matters — the candidate pins the head now and
   * verifies the whole chain once the attempt closes — without disclosing the
   * probe rationales and viva verdicts the chain also contains, which would
   * reveal scores mid-exam and turn the assessment into a feedback loop for
   * defeating it.
   */
  async candidateLedger(id: AttemptId): Promise<CandidateLedger> {
    const entries = await this.#store.load(id);
    if (entries.length === 0) throw new AttemptError("not_found", `No ledger for attempt ${id}`);

    const projection = await this.projection(id);
    const sealed = projection.attempt.state !== "in_progress";
    const head = entries.at(-1)?.hash ?? null;

    if (!sealed) {
      return { head, length: entries.length, sealed: false, entries: null };
    }
    return { head, length: entries.length, sealed: true, entries };
  }

  /**
   * Store an exam, rejecting one that is misconfigured.
   *
   * An exam is written once and sat by a whole cohort, and most of these
   * mistakes only surface at grading — by which time the sitting is over.
   */
  async createExam(exam: Exam): Promise<void> {
    const validation = validateExam(exam);
    if (!validation.ok) {
      throw new ExamInvalidError(validation.problems);
    }
    await this.#store.createExam(exam);
  }

  listExams(): Promise<readonly ExamSummary[]> {
    return this.#store.listExams();
  }

  async loadExam(id: ExamId): Promise<Exam> {
    const exam = await this.#store.loadExam(id);
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${id}`);
    return exam;
  }

  listAttempts(examId: ExamId): Promise<readonly AttemptSummary[]> {
    return this.#store.listAttempts(examId);
  }

  async ledger(id: AttemptId): Promise<readonly LedgerEntry[]> {
    return this.#store.load(id);
  }

  /** Fold the attempt, or fail loudly if its chain does not make sense. */
  async projection(id: AttemptId): Promise<AttemptProjection> {
    const entries = await this.#store.load(id);
    if (entries.length === 0) {
      throw new AttemptError("not_found", `No ledger for attempt ${id}`);
    }
    const exam = await this.#examFor(entries);
    const result = foldAttempt(entries, { exam });
    if (!result.ok) {
      throw new AttemptError(
        "invalid_state",
        `Attempt ${id} does not fold: ${result.reason} at seq ${result.seq}`,
      );
    }
    return result.projection;
  }

  async #examFor(entries: readonly LedgerEntry[]): Promise<Exam> {
    const first = entries[0];
    if (first === undefined || first.event.type !== "attempt_started") {
      throw new AttemptError("invalid_state", "Ledger does not open with attempt_started");
    }
    const exam = await this.#store.loadExam(first.event.examId);
    if (exam === null) {
      throw new AttemptError("not_found", `No such exam: ${first.event.examId}`);
    }
    return exam;
  }

  /**
   * The scores currently known for an attempt.
   *
   * Scores recorded in the ledger win, because a rubric grade is a considered
   * judgement that was written down. Anything not yet graded falls back to
   * deterministic scoring, which is what makes mid-exam probing possible for
   * mcq and numeric questions without waiting for submission.
   */
  scoresFor(projection: AttemptProjection, exam: Exam): readonly QuestionScore[] {
    const questions = new Map(exam.questions.map((q) => [q.id, q]));
    const scores: QuestionScore[] = [];

    for (const response of projection.attempt.responses) {
      const question = questions.get(response.questionId);
      if (question === undefined) continue;

      const recorded = projection.scores.get(response.questionId);
      if (recorded !== undefined) {
        scores.push({
          questionId: question.id,
          score: recorded,
          maxScore: question.maxScore,
          method: needsRubricGrading(question) ? "rubric" : "deterministic",
          reasoning: null,
        });
        continue;
      }

      const deterministic = scoreDeterministic(question, response.answer);
      if (deterministic !== null) scores.push(deterministic);
    }
    return scores;
  }

  /**
   * Close an attempt whose time is up, then refuse the write that found it.
   *
   * `durationMs` was policy that nothing enforced: an attempt stayed open
   * indefinitely, so its receipt never sealed and a candidate could keep
   * answering long after the window. Closing on the next write keeps that
   * deterministic without a scheduler — reads never write, so looking at an
   * attempt cannot end it.
   */
  async #refuseIfExpired(id: AttemptId, projection: AttemptProjection, exam: Exam): Promise<void> {
    if (projection.attempt.state !== "in_progress") return;
    if (this.#now() <= deadlineOf(projection, exam)) return;

    await this.#store.append(id, { type: "attempt_submitted", attemptId: id });
    throw new AttemptError("expired", `Attempt ${id} is past its ${exam.policy.durationMs}ms window`);
  }

  // --- writing ------------------------------------------------------------

  async startAttempt(examId: ExamId, candidateId: CandidateId): Promise<AttemptId> {
    const exam = await this.#store.loadExam(examId);
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${examId}`);

    const id = this.#newId() as AttemptId;
    await this.#store.createAttempt(id, examId, candidateId);
    await this.#store.append(id, { type: "attempt_started", attemptId: id, examId, candidateId });
    return id;
  }

  async submitAnswer(id: AttemptId, questionId: QuestionId, answer: string): Promise<void> {
    const projection = await this.projection(id);
    if (projection.attempt.state !== "in_progress") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${projection.attempt.state}`);
    }
    const exam = await this.#store.loadExam(projection.attempt.examId);
    if (exam === null || !exam.questions.some((q) => q.id === questionId)) {
      throw new AttemptError("unknown_question", `Question ${questionId} is not on this exam`);
    }
    await this.#refuseIfExpired(id, projection, exam);

    await this.#store.append(id, {
      type: "answer_submitted",
      attemptId: id,
      response: { questionId, answer, submittedAt: this.#now() },
    });
  }

  async submitAttempt(id: AttemptId): Promise<void> {
    const projection = await this.projection(id);
    if (projection.attempt.state !== "in_progress") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${projection.attempt.state}`);
    }
    await this.#store.append(id, { type: "attempt_submitted", attemptId: id });
  }

  // --- micro-viva ---------------------------------------------------------

  /**
   * Raise the next probe for an attempt, if one is due.
   *
   * Returns null when nothing qualifies — no answer has cleared the trigger
   * ratio, or everything that has is already probed. Not probing is the normal
   * case and is not an error.
   */
  async raiseProbe(
    id: AttemptId,
    options: { readonly onToken?: (token: string) => void } = {},
  ): Promise<VivaProbe | null> {
    const projection = await this.projection(id);
    const exam = await this.#examFor(await this.#store.load(id));
    await this.#refuseIfExpired(id, projection, exam);

    const targets = selectProbeTargets(projection, exam, this.scoresFor(projection, exam));
    const target = targets[0];
    if (target === undefined) return null;

    const probe = await generateProbe(target, {
      ...this.#engine,
      now: this.#now,
      newVivaId: () => this.#newId() as VivaId,
      ...(options.onToken === undefined ? {} : { onToken: options.onToken }),
    });

    try {
      await this.#store.append(
        id,
        { type: "viva_probed", attemptId: id, probe },
        {
          // Re-checked under the attempt's row lock. The selection above
          // happened before a model call that takes a second or two, and a
          // second request arriving in that window would otherwise raise a
          // duplicate probe about the same answer — an interrogation, which
          // SPEC §4 rules out.
          guard: (events) =>
            events.some((e) => e.type === "viva_probed" && e.probe.questionId === target.question.id)
              ? `A probe for ${target.question.id} was raised concurrently`
              : null,
        },
      );
    } catch (error) {
      // The other request won. Nothing is due from this one; its probe is
      // discarded rather than shown alongside the one already asked.
      if (error instanceof AppendRefused) return null;
      throw error;
    }
    return probe;
  }

  /**
   * Record a candidate's reply to a probe.
   *
   * Latency is computed here, from the probe's recorded `askedAt` to the moment
   * this call arrives. It is never taken from the request body: latency is an
   * integrity signal (SPEC §4), and a client that reports its own would defeat
   * it in one line.
   */
  async recordReply(id: AttemptId, probeId: VivaId, reply: string): Promise<VivaExchange> {
    const projection = await this.projection(id);
    const viva = projection.vivas.find((v) => v.probe.id === probeId);
    if (viva === undefined) throw new AttemptError("unknown_probe", `No probe ${probeId}`);
    if (viva.exchange !== null) {
      throw new AttemptError("already_replied", `Probe ${probeId} already has a reply`);
    }
    await this.#refuseIfExpired(id, projection, await this.#examFor(await this.#store.load(id)));

    const repliedAt = this.#now();
    const exchange: VivaExchange = {
      probeId,
      reply,
      repliedAt,
      latencyMs: Math.max(0, repliedAt - viva.probe.askedAt),
    };

    await this.#store.append(id, { type: "viva_replied", attemptId: id, exchange });
    return exchange;
  }

  /** Assess a reply and record the verdict. Never changes a score (SPEC §6.1). */
  async assess(id: AttemptId, probeId: VivaId): Promise<VivaAssessment> {
    const projection = await this.projection(id);
    const exam = await this.#examFor(await this.#store.load(id));

    const viva = projection.vivas.find((v) => v.probe.id === probeId);
    if (viva === undefined) throw new AttemptError("unknown_probe", `No probe ${probeId}`);
    if (viva.exchange === null) {
      throw new AttemptError("invalid_state", `Probe ${probeId} has no reply to assess`);
    }

    const target = this.#targetFor(projection, exam, viva.probe.questionId);
    const assessment = await assessReply(target, viva.probe, viva.exchange, this.#engine);
    await this.#store.append(id, { type: "viva_assessed", attemptId: id, assessment });
    return assessment;
  }

  #targetFor(projection: AttemptProjection, exam: Exam, questionId: QuestionId): ProbeTarget {
    const question = exam.questions.find((q) => q.id === questionId);
    const response = projection.attempt.responses.find((r) => r.questionId === questionId);
    if (question === undefined || response === undefined) {
      throw new AttemptError("unknown_question", `No answered question ${questionId}`);
    }
    const score = this.scoresFor(projection, exam).find((s) => s.questionId === questionId) ?? {
      questionId,
      score: 0,
      maxScore: question.maxScore,
      method: "rubric" as const,
      reasoning: null,
    };
    return { question, response, score };
  }

  /**
   * Set an attempt aside, with a reason.
   *
   * This is the act SPEC §6.1 reserves for a person. Nothing in the system
   * reaches it on its own: no verdict, no confidence score and no combination
   * of them produces a void. Someone reads the evidence and decides, and what
   * lands in the ledger is their reason, not a model's.
   *
   * A reason is required and must say something. It is written into a
   * tamper-evident record, it is shown to the candidate, and it is what an
   * appeal will be argued against — "x" is not a decision anyone can defend.
   *
   * What is *not* recorded is who decided. Staff authenticate with a shared
   * institution token, so any name attached here would be an unverified claim,
   * and writing unverified claims into a record whose value is that it can be
   * trusted would undermine the record itself. Attribution needs the identity
   * integration SPEC §2 keeps out of scope.
   */
  async voidAttempt(id: AttemptId, reason: string): Promise<void> {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_VOID_REASON) {
      throw new AttemptError(
        "reason_required",
        `Voiding an attempt needs a reason of at least ${MIN_VOID_REASON} characters; it is recorded and shown to the candidate`,
      );
    }

    const projection = await this.projection(id);
    if (projection.attempt.state === "void") {
      throw new AttemptError("invalid_state", `Attempt ${id} is already void`);
    }

    await this.#store.append(id, { type: "attempt_voided", attemptId: id, reason: trimmed });
  }

  // --- grading ------------------------------------------------------------

  /**
   * Score every answered question and record the total.
   *
   * Viva verdicts are deliberately not consulted: a verdict is evidence about
   * provenance for a human to act on, never an adjustment to a mark (SPEC §6.1).
   */
  async grade(id: AttemptId): Promise<number> {
    const projection = await this.projection(id);
    if (projection.attempt.state !== "submitted") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${projection.attempt.state}`);
    }
    const exam = await this.#examFor(await this.#store.load(id));
    const questions = new Map(exam.questions.map((q) => [q.id, q]));

    const scores: QuestionScore[] = [];
    for (const response of projection.attempt.responses) {
      const question = questions.get(response.questionId);
      if (question === undefined) continue;

      const score =
        scoreDeterministic(question, response.answer) ??
        (await gradeWithRubric({ question, response }, this.#engine));

      scores.push(score);
      await this.#store.append(id, {
        type: "question_scored",
        attemptId: id,
        questionId: question.id,
        score: score.score,
      });
    }

    const total = totalScore(scores);
    await this.#store.append(id, { type: "attempt_graded", attemptId: id, total });
    return total;
  }
}

/** Raised when an exam fails validation; carries every problem, not the first. */
export class ExamInvalidError extends Error {
  constructor(readonly problems: readonly { path: string; message: string }[]) {
    super(`Exam is not valid (${problems.length} problem(s))`);
    this.name = "ExamInvalidError";
  }
}

export interface CandidateState {
  readonly attemptId: AttemptId;
  readonly exam: CandidateExam;
  readonly state: AttemptProjection["attempt"]["state"];
  readonly voidReason: string | null;
  readonly startedAt: Timestamp;
  /** When this attempt's window closes. Exam time, not a probe timer (SPEC §8). */
  readonly expiresAt: Timestamp;
  readonly answers: readonly { questionId: QuestionId; answer: string; submittedAt: Timestamp }[];
  /** A probe awaiting a reply, by prompt alone. */
  readonly openProbe: { readonly id: VivaId; readonly prompt: string } | null;
  readonly answeredProbeCount: number;
}

export interface CandidateLedger {
  readonly head: string | null;
  readonly length: number;
  /** False while the attempt is open, when only the head hash is released. */
  readonly sealed: boolean;
  readonly entries: readonly LedgerEntry[] | null;
}

/** Shortest reason that can stand as a decision on the record. */
export const MIN_VOID_REASON = 10;

/** When an attempt's window closes, from its own start and its exam's policy. */
export function deadlineOf(projection: AttemptProjection, exam: Exam): Timestamp {
  return projection.attempt.startedAt + exam.policy.durationMs;
}
