import type Anthropic from "@anthropic-ai/sdk";
import {
  foldAttempt,
  scoreDeterministic,
  selectProbeTargets,
  totalScore,
  needsRubricGrading,
  type AttemptId,
  type AttemptProjection,
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
import { LedgerStore } from "@parikshaa/store";
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
      | "already_replied",
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

  async createExam(exam: Exam): Promise<void> {
    await this.#store.createExam(exam);
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

    const targets = selectProbeTargets(projection, exam, this.scoresFor(projection, exam));
    const target = targets[0];
    if (target === undefined) return null;

    const probe = await generateProbe(target, {
      ...this.#engine,
      now: this.#now,
      newVivaId: () => this.#newId() as VivaId,
      ...(options.onToken === undefined ? {} : { onToken: options.onToken }),
    });

    await this.#store.append(id, { type: "viva_probed", attemptId: id, probe });
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
