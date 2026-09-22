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
  type OrgId,
  type ProbeTarget,
  type QuestionId,
  type QuestionScore,
  type Timestamp,
  type VivaAssessment,
  type VivaExchange,
  type VivaId,
  type VivaProbe,
} from "@parikshaa/core";
import type {
  AttemptSummary,
  AuditRecord,
  ExamSummary,
  IdentityStore,
  Scope,
  UsageReport,
} from "@parikshaa/store";
import { AppendRefused, LedgerStore, candidateScope, staffScope } from "@parikshaa/store";
import { assessReply, generateProbe, gradeWithRubric, type EngineOptions } from "@parikshaa/viva";
import { can, type Actor, type Permission } from "./staff-auth.js";

/**
 * The orchestration layer: everything the HTTP routes do, minus HTTP.
 *
 * Every state change is an append to the attempt's ledger. Nothing here keeps
 * attempt state of its own — it reads the chain, folds it, decides, and appends.
 *
 * Every method is scoped. Staff methods take the authenticated {@link Actor},
 * check its permission here as well as at the route, and act within the
 * actor's organisation. Candidate methods take the {@link CandidateAccess} their
 * token carries. There is no method that reaches an attempt without saying
 * whose it is.
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

/** The actor's role does not grant this. */
export class Forbidden extends Error {
  constructor(readonly permission: Permission) {
    super(`This account does not have ${permission}`);
    this.name = "Forbidden";
  }
}

/**
 * The organisation's monthly model budget is used up.
 *
 * Raised only for work staff asked for — grading and assessment. A probe that
 * would exceed the budget is simply not asked; the candidate is not the one
 * who should find out about a billing limit.
 */
export class SpendCapReached extends Error {
  constructor() {
    super("This organisation's monthly model spend cap has been reached");
    this.name = "SpendCapReached";
  }
}

/** What a candidate's token grants: one attempt, in one organisation. */
export interface CandidateAccess {
  readonly orgId: OrgId;
  readonly attemptId: AttemptId;
}

export interface ServiceOptions {
  readonly store: LedgerStore;
  readonly identity: IdentityStore;
  readonly client: Anthropic;
  readonly model?: string;
  readonly fastProbes?: boolean;
  readonly now?: () => Timestamp;
  readonly newId?: () => string;
}

interface AttemptContext {
  readonly entries: readonly LedgerEntry[];
  readonly exam: Exam;
  readonly projection: AttemptProjection;
}

export class ExamService {
  readonly #store: LedgerStore;
  readonly #identity: IdentityStore;
  readonly #engine: { client: Anthropic; model?: string; fastProbes?: boolean };
  readonly #now: () => Timestamp;
  readonly #newId: () => string;

  constructor(options: ServiceOptions) {
    this.#store = options.store;
    this.#identity = options.identity;
    this.#engine = {
      client: options.client,
      ...(options.model === undefined ? {} : { model: options.model }),
      ...(options.fastProbes === undefined ? {} : { fastProbes: options.fastProbes }),
    };
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- scoping --------------------------------------------------------------

  /**
   * Refuse unless the actor may do this, and return the scope to do it in.
   *
   * The routes check too. Checking again here means a route added without its
   * check still cannot reach anything its caller is not allowed to.
   */
  #require(actor: Actor, permission: Permission): Scope {
    if (!can(actor, permission)) throw new Forbidden(permission);
    return staffScope(actor.orgId);
  }

  async #audit(
    actor: Actor,
    action: string,
    target: string,
    detail: Record<string, unknown> = {},
  ): Promise<void> {
    await this.#store.appendAudit(staffScope(actor.orgId), {
      actorKind: actor.kind,
      actorId: actor.id,
      action,
      target,
      detail,
    });
  }

  /** Model options for one call, reporting its cost against the attempt. */
  #engineFor(scope: Scope, attemptId: AttemptId): EngineOptions {
    return {
      ...this.#engine,
      onUsage: (usage) => this.#store.recordUsage(scope, { ...usage, attemptId }),
    };
  }

  /**
   * Whether the organisation's model spend this month is under its cap.
   *
   * The cap is a soft ceiling: calls already in flight when it is crossed still
   * complete and are still counted, so a month can overshoot by a few calls.
   * Months are calendar months in UTC.
   */
  async #withinBudget(scope: Scope): Promise<boolean> {
    const org = await this.#identity.getOrganisation(scope.orgId);
    const cap = org?.monthlySpendCapMicroUsd ?? null;
    if (cap === null) return true;
    return (await this.#store.spendSince(scope, monthStart(this.#now()))) < cap;
  }

  // --- candidate: reading ---------------------------------------------------

  /**
   * Everything the candidate's own client may see while the attempt is open.
   *
   * The exam arrives as a {@link candidateView}, which has nowhere for an answer
   * key to live. An open probe is reported by prompt alone: its `rationale`
   * records the score that triggered it, and SPEC §4 forbids telling a candidate
   * mid-exam whether an answer was right.
   */
  async candidateState(access: CandidateAccess): Promise<CandidateState> {
    const { projection, exam } = await this.#context(candidateOf(access), access.attemptId);
    const open = projection.vivas.find((v) => v.exchange === null);

    return {
      attemptId: access.attemptId,
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
  async candidateLedger(access: CandidateAccess): Promise<CandidateLedger> {
    const { entries, projection } = await this.#context(candidateOf(access), access.attemptId);
    const sealed = projection.attempt.state !== "in_progress";
    const head = entries.at(-1)?.hash ?? null;

    if (!sealed) {
      return { head, length: entries.length, sealed: false, entries: null };
    }
    return { head, length: entries.length, sealed: true, entries };
  }

  // --- staff: exams ---------------------------------------------------------

  /**
   * Store an exam, rejecting one that is misconfigured.
   *
   * An exam is written once and sat by a whole cohort, and most of these
   * mistakes only surface at grading — by which time the sitting is over.
   */
  async createExam(actor: Actor, exam: Exam): Promise<void> {
    const scope = this.#require(actor, "exam:write");
    const validation = validateExam(exam);
    if (!validation.ok) {
      throw new ExamInvalidError(validation.problems);
    }
    await this.#store.createExam(scope, exam);
    await this.#audit(actor, "exam.saved", exam.id, { title: exam.title, questions: exam.questions.length });
  }

  listExams(actor: Actor): Promise<readonly ExamSummary[]> {
    return this.#store.listExams(this.#require(actor, "exam:read"));
  }

  /** The exam in full, answer key included. */
  async loadExam(actor: Actor, id: ExamId): Promise<Exam> {
    const exam = await this.#store.loadExam(this.#require(actor, "exam:read_key"), id);
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${id}`);
    return exam;
  }

  listAttempts(actor: Actor, examId: ExamId): Promise<readonly AttemptSummary[]> {
    return this.#store.listAttempts(this.#require(actor, "attempt:read"), examId);
  }

  // --- staff: attempts ------------------------------------------------------

  async ledger(actor: Actor, id: AttemptId): Promise<readonly LedgerEntry[]> {
    return (await this.#context(this.#require(actor, "attempt:review"), id)).entries;
  }

  /** Fold the attempt for review. */
  async projection(actor: Actor, id: AttemptId): Promise<AttemptProjection> {
    return (await this.#context(this.#require(actor, "attempt:review"), id)).projection;
  }

  /** Load, find the exam, and fold — or fail loudly if the chain does not make sense. */
  async #context(scope: Scope, id: AttemptId): Promise<AttemptContext> {
    const entries = await this.#store.load(scope, id);
    if (entries.length === 0) {
      throw new AttemptError("not_found", `No ledger for attempt ${id}`);
    }

    const first = entries[0];
    if (first === undefined || first.event.type !== "attempt_started") {
      throw new AttemptError("invalid_state", "Ledger does not open with attempt_started");
    }
    const exam = await this.#store.loadExam(scope, first.event.examId);
    if (exam === null) {
      throw new AttemptError("not_found", `No such exam: ${first.event.examId}`);
    }

    const result = foldAttempt(entries, { exam });
    if (!result.ok) {
      throw new AttemptError(
        "invalid_state",
        `Attempt ${id} does not fold: ${result.reason} at seq ${result.seq}`,
      );
    }
    return { entries, exam, projection: result.projection };
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
  async #refuseIfExpired(scope: Scope, id: AttemptId, context: AttemptContext): Promise<void> {
    const { projection, exam } = context;
    if (projection.attempt.state !== "in_progress") return;
    if (this.#now() <= deadlineOf(projection, exam)) return;

    await this.#store.append(scope, id, { type: "attempt_submitted", attemptId: id });
    throw new AttemptError("expired", `Attempt ${id} is past its ${exam.policy.durationMs}ms window`);
  }

  async startAttempt(actor: Actor, examId: ExamId, candidateId: CandidateId): Promise<AttemptId> {
    const scope = this.#require(actor, "attempt:start");
    const exam = await this.#store.loadExam(scope, examId);
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${examId}`);

    const id = this.#newId() as AttemptId;
    await this.#store.createAttempt(scope, id, examId, candidateId);
    await this.#store.append(scope, id, { type: "attempt_started", attemptId: id, examId, candidateId });
    await this.#audit(actor, "attempt.started", id, { examId, candidateId });
    return id;
  }

  // --- candidate: writing ---------------------------------------------------

  async submitAnswer(access: CandidateAccess, questionId: QuestionId, answer: string): Promise<void> {
    const scope = candidateOf(access);
    const id = access.attemptId;
    const context = await this.#context(scope, id);
    if (context.projection.attempt.state !== "in_progress") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${context.projection.attempt.state}`);
    }
    if (!context.exam.questions.some((q) => q.id === questionId)) {
      throw new AttemptError("unknown_question", `Question ${questionId} is not on this exam`);
    }
    await this.#refuseIfExpired(scope, id, context);

    await this.#store.append(scope, id, {
      type: "answer_submitted",
      attemptId: id,
      response: { questionId, answer, submittedAt: this.#now() },
    });
  }

  async submitAttempt(access: CandidateAccess): Promise<void> {
    const scope = candidateOf(access);
    const id = access.attemptId;
    const { projection } = await this.#context(scope, id);
    if (projection.attempt.state !== "in_progress") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${projection.attempt.state}`);
    }
    await this.#store.append(scope, id, { type: "attempt_submitted", attemptId: id });
  }

  // --- micro-viva -----------------------------------------------------------

  /**
   * Raise the next probe for an attempt, if one is due.
   *
   * Returns null when nothing qualifies — no answer has cleared the trigger
   * ratio, or everything that has is already probed — and when the
   * organisation's model budget is spent. Not probing is the normal case and is
   * not an error.
   */
  async raiseProbe(
    access: CandidateAccess,
    options: { readonly onToken?: (token: string) => void } = {},
  ): Promise<VivaProbe | null> {
    const scope = candidateOf(access);
    const id = access.attemptId;
    const context = await this.#context(scope, id);
    const { projection, exam } = context;
    await this.#refuseIfExpired(scope, id, context);

    const targets = selectProbeTargets(projection, exam, this.scoresFor(projection, exam));
    const target = targets[0];
    if (target === undefined) return null;
    if (!(await this.#withinBudget(scope))) return null;

    const probe = await generateProbe(target, {
      ...this.#engineFor(scope, id),
      now: this.#now,
      newVivaId: () => this.#newId() as VivaId,
      ...(options.onToken === undefined ? {} : { onToken: options.onToken }),
    });

    try {
      await this.#store.append(
        scope,
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
  async recordReply(access: CandidateAccess, probeId: VivaId, reply: string): Promise<VivaExchange> {
    const scope = candidateOf(access);
    const id = access.attemptId;
    const context = await this.#context(scope, id);
    const viva = context.projection.vivas.find((v) => v.probe.id === probeId);
    if (viva === undefined) throw new AttemptError("unknown_probe", `No probe ${probeId}`);
    if (viva.exchange !== null) {
      throw new AttemptError("already_replied", `Probe ${probeId} already has a reply`);
    }
    await this.#refuseIfExpired(scope, id, context);

    const repliedAt = this.#now();
    const exchange: VivaExchange = {
      probeId,
      reply,
      repliedAt,
      latencyMs: Math.max(0, repliedAt - viva.probe.askedAt),
    };

    await this.#store.append(scope, id, { type: "viva_replied", attemptId: id, exchange });
    return exchange;
  }

  /** Assess a reply and record the verdict. Never changes a score (SPEC §6.1). */
  async assess(actor: Actor, id: AttemptId, probeId: VivaId): Promise<VivaAssessment> {
    const scope = this.#require(actor, "attempt:assess");
    const { projection, exam } = await this.#context(scope, id);

    const viva = projection.vivas.find((v) => v.probe.id === probeId);
    if (viva === undefined) throw new AttemptError("unknown_probe", `No probe ${probeId}`);
    if (viva.exchange === null) {
      throw new AttemptError("invalid_state", `Probe ${probeId} has no reply to assess`);
    }
    if (!(await this.#withinBudget(scope))) throw new SpendCapReached();

    const target = this.#targetFor(projection, exam, viva.probe.questionId);
    const assessment = await assessReply(target, viva.probe, viva.exchange, this.#engineFor(scope, id));
    await this.#store.append(scope, id, { type: "viva_assessed", attemptId: id, assessment });
    await this.#audit(actor, "attempt.assessed", id, { probeId, verdict: assessment.verdict });
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
   * of them produces a void — and no API key, whatever its role, because an
   * integration is not a person. Someone reads the evidence and decides.
   *
   * A reason is required and must say something. It is written into a
   * tamper-evident record, it is shown to the candidate, and it is what an
   * appeal will be argued against — "x" is not a decision anyone can defend.
   *
   * Who decided is recorded too. With a shared institution token that would
   * have been an unverified claim; with individual accounts it is the
   * authenticated user, and an appeal needs to know whose decision it is
   * contesting.
   */
  async voidAttempt(actor: Actor, id: AttemptId, reason: string): Promise<void> {
    const scope = this.#require(actor, "attempt:void");
    if (actor.kind !== "user") throw new Forbidden("attempt:void");

    const trimmed = reason.trim();
    if (trimmed.length < MIN_VOID_REASON) {
      throw new AttemptError(
        "reason_required",
        `Voiding an attempt needs a reason of at least ${MIN_VOID_REASON} characters; it is recorded and shown to the candidate`,
      );
    }

    const { projection } = await this.#context(scope, id);
    if (projection.attempt.state === "void") {
      throw new AttemptError("invalid_state", `Attempt ${id} is already void`);
    }

    await this.#store.append(scope, id, {
      type: "attempt_voided",
      attemptId: id,
      reason: trimmed,
      decidedBy: { userId: actor.id, name: actor.name },
    });
    await this.#audit(actor, "attempt.voided", id, { reason: trimmed });
  }

  // --- grading --------------------------------------------------------------

  /**
   * Score every answered question and record the total.
   *
   * Viva verdicts are deliberately not consulted: a verdict is evidence about
   * provenance for a human to act on, never an adjustment to a mark (SPEC §6.1).
   *
   * Every score is worked out before any is written. A model call failing on
   * the fourth question used to leave three scores in the ledger and no total;
   * now a failure writes nothing and the attempt can simply be graded again.
   */
  async grade(actor: Actor, id: AttemptId): Promise<number> {
    const scope = this.#require(actor, "attempt:grade");
    const { projection, exam } = await this.#context(scope, id);
    if (projection.attempt.state !== "submitted") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${projection.attempt.state}`);
    }
    const questions = new Map(exam.questions.map((q) => [q.id, q]));

    const answered = projection.attempt.responses.flatMap((response) => {
      const question = questions.get(response.questionId);
      return question === undefined ? [] : [{ question, response }];
    });

    const needsModel = answered.some(
      ({ question, response }) => scoreDeterministic(question, response.answer) === null,
    );
    if (needsModel && !(await this.#withinBudget(scope))) throw new SpendCapReached();

    const scores: QuestionScore[] = [];
    for (const { question, response } of answered) {
      scores.push(
        scoreDeterministic(question, response.answer) ??
          (await gradeWithRubric({ question, response }, this.#engineFor(scope, id))),
      );
    }

    for (const score of scores) {
      await this.#store.append(scope, id, {
        type: "question_scored",
        attemptId: id,
        questionId: score.questionId,
        score: score.score,
      });
    }

    const total = totalScore(scores);
    await this.#store.append(scope, id, { type: "attempt_graded", attemptId: id, total });
    await this.#audit(actor, "attempt.graded", id, { total });
    return total;
  }

  // --- the organisation -----------------------------------------------------

  /**
   * Model spend since a moment (the start of this month by default), with the
   * cap it is measured against.
   */
  async usage(actor: Actor, since?: Date): Promise<UsageSummary> {
    const scope = this.#require(actor, "usage:read");
    const monthStarted = monthStart(this.#now());
    const [report, spentThisMonth, org] = await Promise.all([
      this.#store.usageReport(scope, since ?? monthStarted),
      this.#store.spendSince(scope, monthStarted),
      this.#identity.getOrganisation(actor.orgId),
    ]);
    return {
      ...report,
      monthStartedAt: monthStarted.toISOString(),
      spentThisMonthMicroUsd: spentThisMonth,
      monthlyCapMicroUsd: org?.monthlySpendCapMicroUsd ?? null,
    };
  }

  audit(actor: Actor, limit?: number): Promise<readonly AuditRecord[]> {
    return this.#store.listAudit(this.#require(actor, "audit:read"), limit);
  }

  /** Record an action taken outside the exam service, such as managing accounts. */
  recordAudit(actor: Actor, action: string, target: string, detail?: Record<string, unknown>): Promise<void> {
    return this.#audit(actor, action, target, detail);
  }
}

const candidateOf = (access: CandidateAccess): Scope => candidateScope(access.orgId, access.attemptId);

/** The first instant of the calendar month (UTC) containing `now`. */
export function monthStart(now: Timestamp): Date {
  const date = new Date(now);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Raised when an exam fails validation; carries every problem, not the first. */
export class ExamInvalidError extends Error {
  constructor(readonly problems: readonly { path: string; message: string }[]) {
    super(`Exam is not valid (${problems.length} problem(s))`);
    this.name = "ExamInvalidError";
  }
}

export interface UsageSummary extends UsageReport {
  readonly monthStartedAt: string;
  readonly spentThisMonthMicroUsd: number;
  readonly monthlyCapMicroUsd: number | null;
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
