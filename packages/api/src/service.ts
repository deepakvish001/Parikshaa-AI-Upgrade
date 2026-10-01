import type Anthropic from "@anthropic-ai/sdk";
import {
  allQuestions,
  candidateView,
  decodeCodeAnswer,
  encodeCodeAnswer,
  runnable,
  foldAttempt,
  languagesOf,
  scoreTests,
  type CodeAnswer,
  type CodeQuestion,
  paperOf,
  partsOf,
  resolvePaper,
  type PaperPart,
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
  type ExamEvent,
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
  Dashboard,
  Draft,
  ExamSummary,
  IdentityStore,
  Scope,
  UsageReport,
} from "@parikshaa/store";
import { AppendRefused, LedgerStore, candidateScope, staffScope } from "@parikshaa/store";
import { RunnerUnavailable, type CodeRunner, type RunResult, type TestResult } from "@parikshaa/runner";
import { assessReply, DEFAULT_MODEL, generateProbe, gradeWithRubric, measure, type EngineOptions, type ReportedUsage } from "@parikshaa/viva";
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
      | "reason_required"
      | "invalid_extension"
      | "invalid_privacy"
      | "invalid_billing"
      | "invalid_proctoring"
      | "invalid_integration"
      | "section_closed"
      | "not_code"
      | "language_not_offered"
      | "too_many_runs",
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
  /** Runs candidate code. Without one, code questions can be answered but not run or tested. */
  readonly runner?: CodeRunner;
  /**
   * Meters attempts as they start (ROADMAP §12): spends a prepaid credit, or
   * refuses the start by throwing. Without one, nothing is metered.
   */
  readonly meter?: Meter;
}

/** What starting an attempt costs. `consume` is idempotent per attempt; `refund` undoes it for a start that failed. */
export interface Meter {
  consume(orgId: OrgId, attemptId: AttemptId): Promise<void>;
  refund(orgId: OrgId, attemptId: AttemptId): Promise<void>;
}

/** Most times a candidate may press Run on one question in one attempt. */
export const MAX_RUNS_PER_QUESTION = 100;
/** Submissions per question per attempt: every one runs every test, and a verdict per hidden test is information. */
export const MAX_SUBMITS_PER_QUESTION = 30;

interface AttemptContext {
  /** Personal fields opened (or `[erased]`): what the application reads. */
  readonly entries: readonly LedgerEntry[];
  /** The chain exactly as hashed: what a receipt carries and a verifier checks. */
  readonly record: readonly LedgerEntry[];
  readonly exam: Exam;
  /** The exam as written, sections and all: `exam` is this attempt's paper. */
  readonly definition: Exam;
  readonly projection: AttemptProjection;
}

/** A sectioned attempt's parts as the candidate sees them (ROADMAP §3). */
export interface CandidatePart {
  readonly sectionId: string | null;
  readonly title: string;
  readonly durationMs: number | null;
  readonly questionIds: readonly QuestionId[];
  readonly state: "done" | "current" | "upcoming";
  /** When the current part's own time is up; null for an untimed part. */
  readonly endsAt: Timestamp | null;
}

export class ExamService {
  readonly #store: LedgerStore;
  readonly #identity: IdentityStore;
  readonly #engine: { client: Anthropic; model?: string; fastProbes?: boolean };
  readonly #now: () => Timestamp;
  readonly #newId: () => string;
  readonly #runner: CodeRunner | null;
  /**
   * Runs so far, per attempt and question. In memory, so per process: it is a
   * brake on a runaway client, not an entitlement, and a restart that resets it
   * costs nothing that matters.
   */
  readonly #runs = new Map<string, number>();
  readonly #submits = new Map<string, number>();

  readonly #meter: Meter | null;

  constructor(options: ServiceOptions) {
    this.#meter = options.meter ?? null;
    this.#runner = options.runner ?? null;
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

  /**
   * A model call staff asked for outside any attempt — drafting a test from a
   * job description, or reading a handwritten copy. Refused once the month's
   * spend cap is reached; its cost is counted with the rest of the
   * organisation's, under the route given ("author" unless said).
   */
  async authoring<T>(
    actor: Actor,
    run: (client: Anthropic, model: string) => Promise<{ readonly result: T; readonly usage: ReportedUsage }>,
    options: { readonly permission?: Permission; readonly route?: "author" | "grade" | "assess" } = {},
  ): Promise<T> {
    const scope = this.#require(actor, options.permission ?? "exam:write");
    if (!(await this.#withinBudget(scope))) throw new SpendCapReached();
    const model = this.#engine.model ?? DEFAULT_MODEL;
    const { result, usage } = await run(this.#engine.client, model);
    await this.#store.recordUsage(scope, { ...measure(options.route ?? "author", model, usage), attemptId: null });
    return result;
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
    const scope = candidateOf(access);
    const context = await this.#context(scope, access.attemptId);
    const { projection, exam } = context;
    const open = projection.vivas.find((v) => v.exchange === null);
    const committed = new Map(projection.attempt.responses.map((r) => [r.questionId, r.answer]));

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
      identityCaptured: projection.identity !== null,
      parts: this.#partsFor(context),
      // Only drafts that say something the ledger does not: resuming on another
      // device restores unsent work, not a stale copy of what was committed.
      drafts:
        projection.attempt.state === "in_progress"
          ? (await this.#store.loadDrafts(scope, access.attemptId)).filter(
              (d) => d.answer !== (committed.get(d.questionId) ?? ""),
            )
          : [],
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
    const { record, projection } = await this.#context(candidateOf(access), access.attemptId);
    const sealed = projection.attempt.state !== "in_progress";
    const head = record.at(-1)?.hash ?? null;

    if (!sealed) {
      return { head, length: record.length, sealed: false, entries: null };
    }
    return { head, length: record.length, sealed: true, entries: record };
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

  /**
   * Copy an exam under a new id.
   *
   * The way to change an exam that has been sat: it is frozen, because its
   * ledgers record answers to its questions as they were. The copy starts with
   * no attempts and can be edited freely.
   */
  async cloneExam(actor: Actor, sourceId: ExamId, id: ExamId, title?: string): Promise<void> {
    const scope = this.#require(actor, "exam:write");
    const source = await this.#store.loadExam(scope, sourceId);
    if (source === null) throw new AttemptError("not_found", `No such exam: ${sourceId}`);
    if ((await this.#store.loadExam(scope, id)) !== null) {
      throw new AttemptError("invalid_state", `An exam with id ${id} already exists`);
    }
    await this.createExam(actor, { ...source, id, title: title ?? `${source.title} (copy)` });
  }

  /**
   * Put an exam away, or bring it back. Nothing but the console's list
   * changes: its window, invitations, attempts and results stay as they were.
   */
  async archiveExam(actor: Actor, id: ExamId, archived: boolean): Promise<void> {
    const scope = this.#require(actor, "exam:write");
    if (!(await this.#store.setExamArchived(scope, id, archived, new Date(this.#now())))) throw new AttemptError("not_found", `No such exam: ${id}`);
    await this.#audit(actor, archived ? "exam.archived" : "exam.restored", id, {});
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
    return (await this.#context(this.#require(actor, "attempt:review"), id)).record;
  }

  /** Fold the attempt for review. */
  async projection(actor: Actor, id: AttemptId): Promise<AttemptProjection> {
    return (await this.#context(this.#require(actor, "attempt:review"), id)).projection;
  }

  /** Load, find the exam, and fold — or fail loudly if the chain does not make sense. */
  async #context(scope: Scope, id: AttemptId): Promise<AttemptContext> {
    const { opened: entries, record } = await this.#store.loadBoth(scope, id);
    if (entries.length === 0) {
      throw new AttemptError("not_found", `No ledger for attempt ${id}`);
    }

    const first = entries[0];
    if (first === undefined || first.event.type !== "attempt_started") {
      throw new AttemptError("invalid_state", "Ledger does not open with attempt_started");
    }
    const definition = await this.#store.loadExam(scope, first.event.examId);
    if (definition === null) {
      throw new AttemptError("not_found", `No such exam: ${first.event.examId}`);
    }
    // From here on "the exam" is this attempt's paper: the questions it was
    // given, as recorded in its first entry, and nothing it did not draw.
    const exam = paperOf(definition, first.event.questionIds);

    const result = foldAttempt(entries, { exam });
    if (!result.ok) {
      throw new AttemptError(
        "invalid_state",
        `Attempt ${id} does not fold: ${result.reason} at seq ${result.seq}`,
      );
    }
    return { entries, record, exam, definition, projection: result.projection };
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
          method:
            question.kind === "code" && (question.tests ?? []).length > 0
              ? "tests"
              : needsRubricGrading(question)
                ? "rubric"
                : "deterministic",
          reasoning: null,
        });
        continue;
      }

      // A code answer tested when it was committed: its result stands in for a
      // score until grading records one, which is what lets a strong solution
      // be followed up mid-exam.
      const tested = projection.codeScores.get(response.questionId);
      if (tested !== undefined) {
        scores.push({
          questionId: question.id,
          score: tested.score,
          maxScore: question.maxScore,
          method: "tests",
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
    const deadline = deadlineOf(projection, exam);
    if (this.#now() <= deadline) return;

    // Whatever the candidate typed before time ran out is theirs; only what
    // arrived after it is not.
    await this.#close(scope, id, context, deadline);
    throw new AttemptError("expired", `Attempt ${id} is past its window`);
  }

  /**
   * Close an attempt whose time has run out and that nothing has written to
   * since — abandoned — committing what was saved in time, as the next write
   * would have. For the retention sweep, which cannot erase an open attempt.
   * Returns whether it is closed now.
   */
  async closeIfExpired(orgId: OrgId, id: AttemptId): Promise<boolean> {
    const scope = staffScope(orgId);
    const context = await this.#context(scope, id);
    if (context.projection.attempt.state !== "in_progress") return true;
    const deadline = deadlineOf(context.projection, context.exam);
    if (this.#now() <= deadline) return false;
    await this.#close(scope, id, context, deadline);
    return true;
  }

  /** Commit the drafts for `questions` that say something new and were saved by `cutoff`. */
  async #commitDrafts(scope: Scope, id: AttemptId, context: AttemptContext, cutoff: Timestamp, questions: ReadonlySet<QuestionId>): Promise<void> {
    const { projection, exam } = context;
    const committed = new Map(projection.attempt.responses.map((r) => [r.questionId, r.answer]));
    for (const draft of await this.#store.loadDrafts(scope, id)) {
      if (!questions.has(draft.questionId) || draft.savedAt > cutoff) continue;
      if (draft.answer.trim() === "" || draft.answer === committed.get(draft.questionId)) continue;
      if (!exam.policy.allowRevision && committed.has(draft.questionId)) continue;
      await this.#store.append(
        scope,
        id,
        {
          type: "answer_submitted",
          attemptId: id,
          response: { questionId: draft.questionId, answer: draft.answer, submittedAt: draft.savedAt },
        },
        { guard: whileOpen },
      );
    }
  }

  // --- sections with their own time (ROADMAP §3) ------------------------------

  /** Where a sectioned attempt stands: its parts, the current one, and when that one's time is up. */
  #position(context: AttemptContext): { parts: readonly PaperPart[]; current: number | null; next: number | null; endsAt: Timestamp | null } | null {
    const parts = partsOf(context.definition, context.exam.questions.map((q) => q.id));
    if (parts === null) return null;
    const entered = context.projection.sections;
    const open = entered.find((s) => s.closedAt === null);
    const sectionIndex = (id: string) => parts.findIndex((p) => p.sectionId === id);
    if (open !== undefined) {
      const current = sectionIndex(open.id);
      const duration = parts[current]?.durationMs ?? null;
      const next = parts.findIndex((p, i) => i > current && p.sectionId !== null);
      return { parts, current, next: next === -1 ? null : next, endsAt: duration === null ? null : open.startedAt + duration };
    }
    // Nothing open: the fixed part, if no section has been entered yet; otherwise between sections.
    const done = new Set(entered.map((s) => s.id));
    const next = parts.findIndex((p) => p.sectionId !== null && !done.has(p.sectionId));
    const current = entered.length === 0 && parts[0]?.sectionId === null ? 0 : null;
    return { parts, current, next: next === -1 ? null : next, endsAt: null };
  }

  #partsFor(context: AttemptContext): readonly CandidatePart[] | null {
    const position = this.#position(context);
    if (position === null) return null;
    const { parts, current, endsAt } = position;
    const doneUpTo = current ?? (position.next ?? parts.length);
    return parts.map((p, i) => ({
      ...p,
      state: i === current ? "current" : i < doneUpTo ? "done" : "upcoming",
      endsAt: i === current ? endsAt : null,
    }));
  }

  /**
   * In a sectioned exam, a question can be answered only while its part is the
   * current one and that part's time is not up. A section whose time ran out
   * is closed here — its drafts saved in time committed — before refusing.
   */
  async #refuseOutsidePart(scope: Scope, id: AttemptId, context: AttemptContext, questionId: QuestionId): Promise<void> {
    const position = this.#position(context);
    if (position === null) return;
    const part = position.current === null ? undefined : position.parts[position.current];
    if (part === undefined || !part.questionIds.includes(questionId)) {
      throw new AttemptError("section_closed", "That question's section is not open: sections are taken in order, and locked once left");
    }
    if (position.endsAt !== null && this.#now() > position.endsAt) {
      await this.#closeSection(scope, id, context, part, "time_up", position.endsAt);
      throw new AttemptError("section_closed", `The time for ${part.title} is up`);
    }
  }

  async #closeSection(scope: Scope, id: AttemptId, context: AttemptContext, part: PaperPart, reason: "left" | "time_up", cutoff: Timestamp): Promise<void> {
    if (part.sectionId === null) return;
    const sectionId = part.sectionId;
    try {
      await this.#commitDrafts(scope, id, context, cutoff, new Set(part.questionIds));
      await this.#store.append(
        scope,
        id,
        { type: "section_closed", attemptId: id, sectionId, reason },
        { guard: (events) => (sectionIsOpen(events, sectionId) ? whileOpen(events) : "already closed") },
      );
    } catch (error) {
      // Closed by another request first: closed is closed.
      if (!(error instanceof AppendRefused)) throw error;
    }
  }

  /**
   * Leave the current part and enter the next section, whose clock starts
   * now. A section left early or late is locked either way; one whose time
   * ran out keeps only the drafts saved in time.
   */
  async nextSection(access: CandidateAccess): Promise<void> {
    const scope = candidateOf(access);
    const id = access.attemptId;
    const context = await this.#context(scope, id);
    if (context.projection.attempt.state !== "in_progress") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${context.projection.attempt.state}`);
    }
    await this.#refuseIfExpired(scope, id, context);
    const position = this.#position(context);
    if (position === null) throw new AttemptError("invalid_state", "This exam is not taken section by section");
    if (position.next === null) throw new AttemptError("invalid_state", "This is the last section: submit the attempt instead");
    const current = position.current === null ? undefined : position.parts[position.current];
    if (current !== undefined) {
      const late = position.endsAt !== null && this.#now() > position.endsAt;
      await this.#closeSection(scope, id, context, current, late ? "time_up" : "left", late ? position.endsAt! : this.#now());
    }
    const sectionId = position.parts[position.next]!.sectionId!;
    try {
      await this.#store.append(
        scope,
        id,
        { type: "section_started", attemptId: id, sectionId },
        { guard: (events) => (events.some((e) => e.type === "section_started" && e.sectionId === sectionId) ? "already started" : whileOpen(events)) },
      );
    } catch (error) {
      // Entered by another request first (a double click): that is where they are.
      if (!(error instanceof AppendRefused)) throw error;
    }
  }

  /**
   * Commit outstanding drafts, then submit.
   *
   * A draft is committed when it says something the ledger does not, was
   * saved by `cutoff`, and the exam's policy allows it — an exam that forbids
   * revision keeps the answer the candidate committed. Each is recorded with
   * the time it was saved, so the chain shows when the words were written, not
   * when the window closed.
   *
   * Every append is guarded against an attempt that has already closed, so two
   * requests that find the window over at once close it once.
   */
  async #close(scope: Scope, id: AttemptId, context: AttemptContext, cutoff: Timestamp): Promise<void> {
    try {
      await this.#commitDrafts(scope, id, context, cutoff, new Set(context.exam.questions.map((q) => q.id)));
      await this.#store.append(scope, id, { type: "attempt_submitted", attemptId: id }, { guard: whileOpen });
    } catch (error) {
      // Another request closed it first. Closed is closed.
      if (!(error instanceof AppendRefused)) throw error;
    }
  }

  async startAttempt(actor: Actor, examId: ExamId, candidateId: CandidateId): Promise<AttemptId> {
    const scope = this.#require(actor, "attempt:start");
    const exam = await this.#store.loadExam(scope, examId);
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${examId}`);

    const id = this.#newId() as AttemptId;
    await this.#meter?.consume(actor.orgId, id);
    try {
      await this.#store.createAttempt(scope, id, examId, candidateId);
      await this.#store.append(scope, id, {
        type: "attempt_started",
        attemptId: id,
        examId,
        candidateId,
        questionIds: resolvePaper(exam, id),
      });
    } catch (error) {
      await this.#meter?.refund(actor.orgId, id);
      throw error;
    }
    await this.#audit(actor, "attempt.started", id, { examId });
    return id;
  }

  /**
   * Start an attempt for a candidate who redeemed an invitation.
   *
   * No person is acting — the candidate opened their link inside their window
   * — so the audit log records the system, naming the invitation. A hard close
   * from the window is written into the first ledger entry, where it governs
   * the deadline and can be checked like everything else.
   */
  async startInvited(
    orgId: OrgId,
    invitationId: string,
    examId: ExamId,
    candidateId: CandidateId,
    attemptId: AttemptId,
    closesAt: Timestamp | null,
    /** The exam, if the caller has already loaded it. */
    loaded?: Exam,
    /** The privacy notice the candidate agreed to before starting, if they were asked. */
    consent?: { readonly noticeVersion: number; readonly noticeHash: string },
  ): Promise<void> {
    const scope = staffScope(orgId);
    const exam = loaded ?? (await this.#store.loadExam(scope, examId));
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${examId}`);

    // Metered first, and idempotently: a start that is finished by a later
    // redemption spends the credit the first one spent, and no more.
    await this.#meter?.consume(orgId, attemptId);
    // Idempotent, so that a redemption can finish a start an earlier one began
    // and did not complete: the invitation already names this attempt.
    await this.#store.ensureAttempt(scope, attemptId, examId, candidateId);
    let started = true;
    try {
      await this.#store.append(
        scope,
        attemptId,
        {
          type: "attempt_started",
          attemptId,
          examId,
          candidateId,
          questionIds: resolvePaper(exam, attemptId),
          ...(closesAt === null ? {} : { closesAt }),
        },
        { guard: (events) => (events.length === 0 ? null : "already started") },
      );
    } catch (error) {
      if (!(error instanceof AppendRefused)) throw error;
      started = false;
    }
    if (consent !== undefined) {
      // Straight after the start, before anything the candidate does; a start
      // that died before this is finished by the next opening, which asks again.
      await this.#store
        .append(scope, attemptId, { type: "consent_given", attemptId, ...consent }, {
          guard: (events) => (events.length === 1 ? null : "consent is recorded first or not at all"),
        })
        .catch((error: unknown) => {
          if (!(error instanceof AppendRefused)) throw error;
        });
    }
    if (!started) return;
    // The audit log is append-only and outlives an erasure, so it names the
    // invitation and the attempt, never the candidate.
    await this.#store.appendAudit(scope, {
      actorKind: "system",
      actorId: null,
      action: "attempt.started",
      target: attemptId,
      detail: { examId, invitationId },
    });
  }

  // --- candidate: writing ---------------------------------------------------

  async submitAnswer(access: CandidateAccess, questionId: QuestionId, answer: string): Promise<void> {
    const { scope, id, context } = await this.#commit(access, questionId, answer);
    const question = context.exam.questions.find((q) => q.id === questionId);
    if (question?.kind === "code") await this.#testOnCommit(scope, id, question, answer);
  }

  /** Record an answer, once every rule about when and where it may be given allows it. */
  async #commit(access: CandidateAccess, questionId: QuestionId, answer: string): Promise<{ scope: Scope; id: AttemptId; context: AttemptContext }> {
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
    await this.#refuseOutsidePart(scope, id, context, questionId);

    const submittedAt = this.#now();
    await this.#appendWhileOpen(scope, id, {
      type: "answer_submitted",
      attemptId: id,
      response: { questionId, answer, submittedAt },
    });
    // The committed text is now also the latest draft, so an older autosave
    // still in flight cannot resurface as "unsent" on another device.
    await this.#store.saveDraft(scope, id, questionId, answer, submittedAt);
    return { scope, id, context };
  }

  // --- code (ROADMAP §4) ----------------------------------------------------

  /**
   * Run a candidate's code against the question's visible tests, or against
   * input of their own. Hidden tests are never run here: a candidate who could
   * run them could search for what passes.
   *
   * Nothing is recorded. Running is working, not answering; the answer is what
   * the candidate commits.
   */
  async runCode(
    access: CandidateAccess,
    questionId: QuestionId,
    answer: CodeAnswer,
    input?: string,
  ): Promise<CandidateRun> {
    const scope = candidateOf(access);
    const id = access.attemptId;
    const context = await this.#context(scope, id);
    if (context.projection.attempt.state !== "in_progress") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${context.projection.attempt.state}`);
    }
    const question = this.#codeQuestion(context.exam, questionId, answer.language);
    await this.#refuseIfExpired(scope, id, context);

    const key = `${id}\u0000${questionId}`;
    const runs = (this.#runs.get(key) ?? 0) + 1;
    if (runs > MAX_RUNS_PER_QUESTION) {
      throw new AttemptError("too_many_runs", `At most ${MAX_RUNS_PER_QUESTION} runs per question`);
    }
    this.#runs.set(key, runs);

    const samples = (question.tests ?? []).filter((t) => !t.hidden);
    const tests =
      input !== undefined
        ? [{ id: "custom", input, expected: "" }]
        : samples.map((t, i) => ({ id: `sample-${i + 1}`, input: t.input, expected: t.expected }));
    // A checker program judges against an expected output; own input has none.
    const result = await this.#run(question, answer, tests, input !== undefined);

    if (!result.compiled) return { compiled: false, compileOutput: result.compileOutput };
    return {
      compiled: true,
      results: result.tests.map((r, i) => ({
        input: tests[i]!.input,
        // Custom input has no expected output, so no verdict either.
        expectedOutput: input !== undefined ? null : tests[i]!.expected,
        status: input !== undefined ? (r.status === "passed" || r.status === "wrong_answer" || r.status === "checker_error" ? "ran" : r.status) : r.status,
        stdout: r.stdout,
        result: r.result ?? null,
        stderr: r.stderr,
        timeMs: r.timeMs,
        memoryKb: r.memoryKb,
        checkerMessage: input !== undefined ? null : (r.checkerMessage ?? null),
      })),
    };
  }

  /**
   * Commit a code answer and test it against every test at once, reporting
   * what was found — the Submit a candidate expects of a coding test.
   *
   * The answer is committed first and stands whatever the tests say, exactly as
   * a committed answer does elsewhere. How much comes back is the exam's
   * choice: every test's verdict, hidden ones reduced to verdict, time and
   * memory, or the visible tests' only. A hidden test's input, output and
   * anything the program printed on it never come back: a program can print
   * its input, and that would publish the test.
   */
  async submitCode(access: CandidateAccess, questionId: QuestionId, answer: CodeAnswer): Promise<CodeVerdict> {
    const scope = candidateOf(access);
    const id = access.attemptId;
    const context = await this.#context(scope, id);
    const question = this.#codeQuestion(context.exam, questionId, answer.language);

    const key = `${id}\u0000${questionId}`;
    const submits = (this.#submits.get(key) ?? 0) + 1;
    if (submits > MAX_SUBMITS_PER_QUESTION) {
      throw new AttemptError("too_many_runs", `At most ${MAX_SUBMITS_PER_QUESTION} submissions per question`);
    }

    const encoded = encodeCodeAnswer(answer);
    await this.#commit(access, questionId, encoded);
    this.#submits.set(key, submits);

    const tests = question.tests ?? [];
    if (tests.length === 0) return { tested: false, reason: "no_tests" };
    if (this.#runner === null) return { tested: false, reason: "runner_unavailable" };
    let result: RunResult;
    try {
      result = await this.#run(question, answer, tests);
    } catch (error) {
      if (error instanceof RunnerUnavailable) return { tested: false, reason: "runner_unavailable" };
      throw error;
    }
    await this.#recordTested(scope, id, question, encoded, this.#summarise(question, result));
    if (!result.compiled) return { tested: true, compiled: false, compileOutput: result.compileOutput };

    const everything = (context.exam.policy.testFeedback ?? "all") === "all";
    const byId = new Map(result.tests.map((r) => [r.id, r]));
    const reported = tests
      .map((test, i) => ({ test, number: i + 1, outcome: byId.get(test.id) }))
      .filter((t) => everything || !t.test.hidden);
    return {
      tested: true,
      compiled: true,
      passed: everything ? result.tests.filter((r) => r.status === "passed").length : null,
      total: everything ? tests.length : null,
      cases: reported.map(({ test, number, outcome }) => ({
        number,
        visible: !test.hidden,
        status: outcome?.status ?? "runtime_error",
        timeMs: outcome?.timeMs ?? 0,
        memoryKb: outcome?.memoryKb ?? null,
        input: test.hidden ? null : test.input,
        expectedOutput: test.hidden ? null : test.expected,
        stdout: test.hidden ? null : (outcome?.stdout ?? ""),
        result: test.hidden ? null : (outcome?.result ?? null),
        stderr: test.hidden ? null : (outcome?.stderr ?? ""),
      })),
    };
  }

  #codeQuestion(exam: Exam, questionId: QuestionId, language: string): CodeQuestion {
    const question = exam.questions.find((q) => q.id === questionId);
    if (question === undefined) throw new AttemptError("unknown_question", `Question ${questionId} is not on this exam`);
    if (question.kind !== "code") throw new AttemptError("not_code", `Question ${questionId} is not a code question`);
    if (!languagesOf(question).includes(language)) {
      throw new AttemptError("language_not_offered", `This question is answered in ${languagesOf(question).join(" or ")}`);
    }
    return question;
  }

  /**
   * Run an answer: a function question's inside the program generated around
   * it, judged by value; any other as it is, judged as the question says.
   * `ownInput`: no expected output to judge against, so no checker program.
   */
  async #run(
    question: CodeQuestion,
    answer: CodeAnswer,
    tests: readonly { id: string; input: string; expected: string }[],
    ownInput = false,
  ): Promise<RunResult> {
    if (this.#runner === null) throw new RunnerUnavailable("No code runner is configured");
    const prepared = runnable(question, answer);
    const checker = ownInput && prepared.checker.kind === "custom" ? { kind: "exact" as const } : prepared.checker;
    return this.#runner.run({
      language: answer.language as never,
      source: prepared.source,
      tests,
      checker,
      ...(prepared.resultMarker === undefined ? {} : { resultMarker: prepared.resultMarker }),
      ...(question.limits === undefined ? {} : { limits: question.limits }),
    });
  }

  #summarise(question: CodeQuestion, result: RunResult): { score: number; passed: number; total: number } {
    const passed = new Set(result.compiled ? result.tests.filter((r) => r.status === "passed").map((r) => r.id) : []);
    return { score: scoreTests(question, passed), passed: passed.size, total: (question.tests ?? []).length };
  }

  /** Every test of a code question, scored. */
  async #runAllTests(question: CodeQuestion, answer: string): Promise<{ score: number; passed: number; total: number }> {
    const result = await this.#run(question, decodeCodeAnswer(answer, question), question.tests ?? []);
    return this.#summarise(question, result);
  }

  /**
   * Test a committed code answer against all its tests and record the result.
   *
   * Best effort: an answer is never refused because the runner is busy or
   * down — grading tests anything that was not tested here. The result is
   * recorded only if the answer is still the latest for its question and the
   * attempt has not closed, both checked under the attempt's lock.
   */
  async #testOnCommit(scope: Scope, id: AttemptId, question: CodeQuestion, answer: string): Promise<void> {
    if (this.#runner === null || (question.tests ?? []).length === 0) return;
    let result: { score: number; passed: number; total: number };
    try {
      result = await this.#runAllTests(question, answer);
    } catch {
      return;
    }
    await this.#recordTested(scope, id, question, answer, result);
  }

  /**
   * Record what testing an answer found, if that answer is still the latest
   * for its question and the attempt has not closed, both checked under the
   * attempt's lock.
   */
  async #recordTested(
    scope: Scope,
    id: AttemptId,
    question: CodeQuestion,
    answer: string,
    result: { score: number; passed: number; total: number },
  ): Promise<void> {
    try {
      await this.#store.append(
        scope,
        id,
        { type: "code_tested", attemptId: id, questionId: question.id, ...result },
        {
          guard: (events) => {
            if (whileOpen(events) !== null) return "closed";
            const latest = events.filter(
              (e): e is Extract<ExamEvent, { type: "answer_submitted" }> =>
                e.type === "answer_submitted" && e.response.questionId === question.id,
            ).at(-1);
            return latest?.response.answer === answer ? null : "superseded";
          },
        },
      );
    } catch (error) {
      if (!(error instanceof AppendRefused)) throw error;
    }
  }

  /**
   * Keep what the candidate has typed so far, without committing it.
   *
   * Autosave calls this every few seconds. It writes nothing to the ledger;
   * see {@link ExamService.#close} for how drafts become answers.
   */
  async saveDraft(access: CandidateAccess, questionId: QuestionId, answer: string): Promise<void> {
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
    await this.#refuseOutsidePart(scope, id, context, questionId);
    await this.#store.saveDraft(scope, id, questionId, answer, this.#now());
  }

  /**
   * The candidate's page checking in.
   *
   * Records that they are here, for an invigilator, and answers with the
   * attempt's state and deadline, so a page learns of an extension — or of
   * being set aside — without reloading. Reads only; it never closes an
   * attempt, for the same reason looking at one never does.
   */
  async heartbeat(
    access: CandidateAccess,
  ): Promise<{ state: AttemptProjection["attempt"]["state"]; expiresAt: Timestamp }> {
    const scope = candidateOf(access);
    const { projection, exam } = await this.#context(scope, access.attemptId);
    await this.#store.touch(scope, access.attemptId, this.#now());
    return { state: projection.attempt.state, expiresAt: deadlineOf(projection, exam) };
  }

  /** Append, unless the attempt closed since it was read. */
  async #appendWhileOpen(scope: Scope, id: AttemptId, event: ExamEvent): Promise<void> {
    try {
      await this.#store.append(scope, id, event, { guard: whileOpen });
    } catch (error) {
      if (error instanceof AppendRefused) {
        throw new AttemptError("invalid_state", `Attempt ${id} closed while this was being recorded`);
      }
      throw error;
    }
  }

  /**
   * Submit, committing anything typed but not yet committed.
   *
   * A candidate who presses submit means everything on their screen; a draft
   * that autosaved but was never committed is part of that. Pressed after the
   * window closed, it still submits — with only what was saved in time.
   */
  async submitAttempt(access: CandidateAccess): Promise<void> {
    const scope = candidateOf(access);
    const id = access.attemptId;
    const context = await this.#context(scope, id);
    if (context.projection.attempt.state !== "in_progress") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${context.projection.attempt.state}`);
    }
    await this.#close(scope, id, context, Math.min(this.#now(), deadlineOf(context.projection, context.exam)));
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

  /**
   * Give an attempt more time, with a reason.
   *
   * For a technical failure or an accommodation. Recorded in the ledger with
   * who granted it, because an answer accepted after the original window is
   * only defensible if the record shows why. Allowed while the attempt is open
   * — including after its window has passed but before anything closed it,
   * which is exactly the laptop-died-at-the-end case.
   */
  async extendTime(actor: Actor, id: AttemptId, minutes: number, reason: string): Promise<Timestamp> {
    const scope = this.#require(actor, "attempt:extend");
    if (actor.kind !== "user") throw new Forbidden("attempt:extend");

    const trimmed = reason.trim();
    if (trimmed.length < MIN_VOID_REASON) {
      throw new AttemptError(
        "reason_required",
        `An extension needs a reason of at least ${MIN_VOID_REASON} characters; it is recorded in the attempt's ledger`,
      );
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_EXTENSION_MINUTES) {
      throw new AttemptError("invalid_extension", `Extend by 1 to ${MAX_EXTENSION_MINUTES} whole minutes`);
    }

    const { projection, exam } = await this.#context(scope, id);
    if (projection.attempt.state !== "in_progress") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${projection.attempt.state}; only an open attempt can be extended`);
    }

    const extraMs = minutes * 60_000;
    await this.#appendWhileOpen(scope, id, {
      type: "time_extended",
      attemptId: id,
      extraMs,
      reason: trimmed,
      decidedBy: { userId: actor.id, name: actor.name },
    });
    await this.#audit(actor, "attempt.extended", id, { minutes, reason: trimmed });
    return deadlineOf(projection, exam) + extraMs;
  }

  /**
   * The same extra time for every attempt still open on an exam: a power cut
   * in the hall, a server hiccup everyone sat through. Each is extended as
   * `extendTime` would, with the same reason in each ledger and the audit;
   * one that closes meanwhile is named, never stopping the rest.
   */
  async extendOpen(
    actor: Actor,
    examId: ExamId,
    minutes: number,
    reason: string,
  ): Promise<{ extended: number; failed: { attemptId: string; message: string }[] }> {
    this.#require(actor, "attempt:extend");
    if (actor.kind !== "user") throw new Forbidden("attempt:extend");
    const open = (await this.listAttempts(actor, examId)).filter((a) => a.state === "in_progress");
    const failed: { attemptId: string; message: string }[] = [];
    let extended = 0;
    for (const attempt of open) {
      try {
        await this.extendTime(actor, attempt.id, minutes, reason);
        extended++;
      } catch (error) {
        // A reason or a length that is refused is refused for every one of them: say so once.
        if (error instanceof AttemptError && (error.code === "reason_required" || error.code === "invalid_extension")) throw error;
        failed.push({ attemptId: attempt.id, message: error instanceof Error ? error.message : String(error) });
      }
    }
    return { extended, failed };
  }

  /**
   * Open a submitted attempt again (ROADMAP §8): the laptop crashed and
   * submitted, the power went, submit was pressed by mistake.
   *
   * A person's decision, with a reason, in the ledger — like voiding and
   * extending, and for the same reason: it is exactly what an appeal asks
   * about. The candidate gets `minutes` from now; the event records the whole
   * addition to the deadline, including the time since it passed. Never after
   * grading or setting aside: a mark or a decision already made is not undone
   * by giving the paper back.
   */
  async reopen(actor: Actor, id: AttemptId, minutes: number, reason: string): Promise<Timestamp> {
    const scope = this.#require(actor, "attempt:extend");
    if (actor.kind !== "user") throw new Forbidden("attempt:extend");
    const trimmed = reason.trim();
    if (trimmed.length < MIN_VOID_REASON) {
      throw new AttemptError("reason_required", `Reopening needs a reason of at least ${MIN_VOID_REASON} characters; it is recorded in the attempt's ledger`);
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_EXTENSION_MINUTES) {
      throw new AttemptError("invalid_extension", `Reopen for 1 to ${MAX_EXTENSION_MINUTES} whole minutes`);
    }

    const { projection, exam } = await this.#context(scope, id);
    if (projection.attempt.state !== "submitted") {
      throw new AttemptError("invalid_state", `Attempt ${id} is ${projection.attempt.state}; only a submitted attempt, not yet graded, can be reopened`);
    }
    if (projection.erasedAt !== null) throw new AttemptError("invalid_state", `Attempt ${id}'s personal data has been erased`);
    const deadline = deadlineOf(projection, exam);
    const until = this.#now() + minutes * 60_000;
    const extraMs = Math.max(0, until - deadline);
    try {
      await this.#store.append(
        scope,
        id,
        { type: "attempt_reopened", attemptId: id, extraMs, reason: trimmed, decidedBy: { userId: actor.id, name: actor.name } },
        { guard: whileSubmitted },
      );
    } catch (error) {
      if (error instanceof AppendRefused) throw new AttemptError("invalid_state", `Attempt ${id} changed while this was being recorded`);
      throw error;
    }
    await this.#audit(actor, "attempt.reopened", id, { minutes, reason: trimmed });
    return deadline + extraMs;
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
    if (projection.erasedAt !== null) {
      throw new AttemptError("invalid_state", `Attempt ${id}'s personal data was erased before grading: it can only be set aside`);
    }
    const questions = new Map(exam.questions.map((q) => [q.id, q]));

    const answered = projection.attempt.responses.flatMap((response) => {
      const question = questions.get(response.questionId);
      return question === undefined ? [] : [{ question, response }];
    });

    const byTests = (q: (typeof answered)[number]["question"]): q is CodeQuestion =>
      q.kind === "code" && (q.tests ?? []).length > 0;

    const needsModel = answered.some(
      ({ question, response }) => !byTests(question) && scoreDeterministic(question, response.answer) === null,
    );
    if (needsModel && !(await this.#withinBudget(scope))) throw new SpendCapReached();

    const scores: QuestionScore[] = [];
    const tested: ExamEvent[] = [];
    for (const { question, response } of answered) {
      if (byTests(question)) {
        // Tested when committed, or now if it was not (the runner was down, or
        // the answer was committed at the close of the window).
        let result = projection.codeScores.get(question.id);
        if (result === undefined) {
          result = await this.#runAllTests(question, response.answer);
          tested.push({ type: "code_tested", attemptId: id, questionId: question.id, ...result });
        }
        scores.push({ questionId: question.id, score: result.score, maxScore: question.maxScore, method: "tests", reasoning: null });
        continue;
      }
      scores.push(
        scoreDeterministic(question, response.answer) ??
          (await gradeWithRubric({ question, response }, this.#engineFor(scope, id))),
      );
    }

    for (const event of tested) await this.#store.append(scope, id, event);
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

  /**
   * Change one mark of a graded attempt, as a person decides it: a recheck
   * the candidate asked for, or a marker correcting the model's reading.
   * Written to the ledger with who and why, so the candidate's receipt shows
   * it and the total follows from it. Returns the new total.
   */
  async reviseScore(actor: Actor, id: AttemptId, questionId: string, score: number, reason: string): Promise<number> {
    const scope = this.#require(actor, "attempt:grade");
    const trimmed = reason.trim();
    if (trimmed === "") throw new AttemptError("invalid_state", "Say why the mark changes");
    const { projection, exam } = await this.#context(scope, id);
    if (projection.attempt.state !== "graded") throw new AttemptError("invalid_state", `Attempt ${id} is ${projection.attempt.state}; only a graded attempt's marks are revised`);
    if (projection.erasedAt !== null) throw new AttemptError("invalid_state", `Attempt ${id}'s personal data has been erased`);
    const question = allQuestions(exam).find((q) => q.id === questionId);
    if (question === undefined) throw new AttemptError("not_found", `No question ${questionId} in this exam`);
    if (!Number.isFinite(score) || score < 0 || score > question.maxScore || Math.round(score * 100) !== score * 100) {
      throw new AttemptError("invalid_state", `A mark from 0 to ${question.maxScore}, in steps of 0.01`);
    }
    const before = projection.scores.get(questionId as QuestionId) ?? 0;
    if (before === score) return projection.total ?? 0;
    try {
      await this.#store.append(
        scope,
        id,
        { type: "score_revised", attemptId: id, questionId: questionId as QuestionId, score, reason: trimmed, decidedBy: { userId: actor.id, name: actor.name } },
        { guard: whileGraded },
      );
    } catch (error) {
      if (error instanceof AppendRefused) throw new AttemptError("invalid_state", `Attempt ${id} changed while this was being recorded`);
      throw error;
    }
    const total = (projection.total ?? 0) + score - before;
    await this.#audit(actor, "attempt.score_revised", id, { questionId, from: before, to: score, reason: trimmed });
    return total;
  }

  /**
   * Grade an exam's submitted attempts, a batch at a time (Results → Grade
   * all). Each is graded exactly as one graded by hand; a few run at once, as
   * the model allows. One that cannot be graded is reported and left as it
   * was, never stopping the rest — except running out of budget, which stops
   * everything. The caller asks again while any remain.
   */
  async gradeSubmitted(
    actor: Actor,
    examId: ExamId,
    options: { readonly limit?: number; readonly concurrency?: number } = {},
  ): Promise<{ graded: number; failed: { attemptId: string; message: string }[]; remaining: number }> {
    this.#require(actor, "attempt:grade");
    const submitted = (await this.listAttempts(actor, examId)).filter((a) => a.state === "submitted");
    const batch = submitted.slice(0, options.limit ?? 20);
    const failed: { attemptId: string; message: string }[] = [];
    let graded = 0;
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < batch.length) {
        const attempt = batch[next++]!;
        try {
          await this.grade(actor, attempt.id);
          graded++;
        } catch (error) {
          if (error instanceof SpendCapReached) throw error;
          failed.push({ attemptId: attempt.id, message: error instanceof Error ? error.message : String(error) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 4, batch.length) }, worker));
    return { graded, failed, remaining: submitted.length - graded };
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

  /** The console's home page. The latest actions only for an account that may read the audit log. */
  dashboard(actor: Actor): Promise<Dashboard> {
    return this.#store.dashboard(this.#require(actor, "exam:read"), new Date(this.#now()), { activity: can(actor, "audit:read") });
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

/** Where the latest event that opened or closed the attempt left it. */
const isOpen = (events: readonly ExamEvent[]): boolean => {
  let open = true;
  for (const e of events) {
    if (e.type === "attempt_submitted" || e.type === "attempt_graded" || e.type === "attempt_voided") open = false;
    else if (e.type === "attempt_reopened") open = true;
  }
  return open;
};

/** An append guard: refuse once the attempt has been submitted or set aside — unless it was reopened since. */
const whileOpen = (events: readonly ExamEvent[]): string | null => (isOpen(events) ? null : "The attempt has closed");

/** An append guard for reopening: only a submitted attempt, not graded, not set aside, not already open. */
/** Graded, and not since set aside or erased: the only state a mark may be revised in. */
const whileGraded = (events: readonly ExamEvent[]): string | null => {
  if (events.some((e) => e.type === "attempt_voided")) return "The attempt is set aside";
  if (events.some((e) => e.type === "data_erased")) return "The attempt's personal data has been erased";
  return events.some((e) => e.type === "attempt_graded") ? null : "The attempt is not graded";
};

const whileSubmitted = (events: readonly ExamEvent[]): string | null => {
  if (events.some((e) => e.type === "attempt_graded" || e.type === "attempt_voided")) return "The attempt is graded or set aside";
  if (events.some((e) => e.type === "data_erased")) return "The attempt's personal data has been erased";
  return isOpen(events) ? "The attempt is already open" : null;
};

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

/** What a candidate sees of a run: their own examples, never a hidden test. */
export type CandidateRun =
  | { readonly compiled: false; readonly compileOutput: string }
  | {
      readonly compiled: true;
      readonly results: readonly {
        readonly input: string;
        /** Null for a run on the candidate's own input, which has nothing to compare with. */
        readonly expectedOutput: string | null;
        readonly status: TestResult["status"] | "ran";
        readonly stdout: string;
        /** A function question's return value, as JSON. */
        readonly result: string | null;
        readonly stderr: string;
        readonly timeMs: number;
        readonly memoryKb: number | null;
        readonly checkerMessage: string | null;
      }[];
    };

/** What Submit reports: the answer is committed either way. */
export type CodeVerdict =
  | { readonly tested: false; readonly reason: "no_tests" | "runner_unavailable" }
  | { readonly tested: true; readonly compiled: false; readonly compileOutput: string }
  | {
      readonly tested: true;
      readonly compiled: true;
      /** Null when the exam reports only the visible tests. */
      readonly passed: number | null;
      readonly total: number | null;
      readonly cases: readonly {
        readonly number: number;
        /** False for a hidden test, reported by its verdict alone. */
        readonly visible: boolean;
        readonly status: TestResult["status"];
        readonly timeMs: number;
        readonly memoryKb: number | null;
        /** Null for a hidden test: its content never reaches the candidate. */
        readonly input: string | null;
        readonly expectedOutput: string | null;
        readonly stdout: string | null;
        readonly result: string | null;
        readonly stderr: string | null;
      }[];
    };

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
  /** Typed but not committed, where that differs from what was committed. */
  readonly drafts: readonly Draft[];
  /** A proctored exam's identity photos have been taken (ROADMAP §14). */
  readonly identityCaptured: boolean;
  /** A sectioned exam's parts, in order, with where the candidate is (ROADMAP §3). Null: not sectioned. */
  readonly parts: readonly CandidatePart[] | null;
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

/** The most one extension may add. More is a different sitting, not an extension. */
export const MAX_EXTENSION_MINUTES = 240;

/**
 * When an attempt's window closes: its own start and its exam's duration — or
 * its scheduled window's hard close, if that comes first — plus any time a
 * person granted it.
 */
export function deadlineOf(projection: AttemptProjection, exam: Exam): Timestamp {
  const byDuration = projection.attempt.startedAt + exam.policy.durationMs;
  // A hard-closing window ends the attempt when it closes, however late it was
  // started. Extra time a person granted still applies on top of either.
  const base = projection.closesAt === null ? byDuration : Math.min(byDuration, projection.closesAt);
  return base + projection.extraTimeMs;
}

/** Whether `sectionId` has been entered and not yet left. */
function sectionIsOpen(events: readonly ExamEvent[], sectionId: string): boolean {
  let open = false;
  for (const e of events) {
    if (e.type === "section_started" && e.sectionId === sectionId) open = true;
    else if (e.type === "section_closed" && e.sectionId === sectionId) open = false;
  }
  return open;
}
