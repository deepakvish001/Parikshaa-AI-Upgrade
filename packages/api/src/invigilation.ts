import { examId as toExamId, foldAttempt, paperOf, type AttemptId, type ExamId } from "@parikshaa/core";
import {
  candidateScope,
  staffScope,
  type Announcement,
  type InvigilationStore,
  type InvitationStore,
  type LedgerStore,
  type ProctorStore,
  type ProctorSummary,
} from "@parikshaa/store";
import { AttemptError, Forbidden, deadlineOf, type CandidateAccess, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";
import { identityState, type LiveProctoring } from "./proctoring.js";

/**
 * Live invigilation (ROADMAP §8): who has started, where they are, who has
 * gone quiet, and what the room has been told.
 *
 * Everything here is read from the ledgers and the heartbeats; nothing an
 * invigilator sees includes an answer. Two flags, kept apart because they mean
 * different things: *away* — the page has stopped checking in, so it is closed
 * or offline — and *idle* — the page is open but nothing has been typed for a
 * while. Neither is an accusation; both are a reason to walk over.
 */

export interface LiveRow {
  readonly invitationId: string | null;
  readonly attemptId: string | null;
  readonly ref: string;
  readonly name: string;
  readonly state: "not_started" | "in_progress" | "submitted" | "graded" | "void";
  readonly answered: number;
  readonly questions: number;
  readonly startedAt: number | null;
  readonly lastSeenAt: number | null;
  readonly lastActivityAt: number | null;
  readonly expiresAt: number | null;
  readonly extraMinutes: number;
  readonly reopened: number;
  readonly awaitingReply: boolean;
  /** For a proctored exam (ROADMAP §14): the identity check, and what the camera and browser sent. */
  readonly proctoring: LiveProctoring | null;
  readonly flags: {
    readonly away: boolean;
    readonly idle: boolean;
    readonly overdue: boolean;
    /** A proctored attempt whose webcam photos have stopped arriving. */
    readonly cameraOff: boolean;
  };
}

export interface LiveView {
  readonly exam: { readonly id: string; readonly title: string };
  readonly at: number;
  readonly counts: Readonly<
    Record<"invited" | "notStarted" | "inProgress" | "away" | "idle" | "cameraOff" | "identityPending" | "submitted" | "graded" | "void", number>
  >;
  readonly rows: readonly LiveRow[];
  readonly announcements: readonly Announcement[];
}

/** A heartbeat every 30 s: three missed, and the page is gone. */
export const AWAY_AFTER_MS = 90_000;
export const DEFAULT_IDLE_MINUTES = 5;
export const MAX_ANNOUNCEMENT = 500;

export class InvigilationService {
  readonly #o: {
    readonly store: LedgerStore;
    readonly invitations: InvitationStore;
    readonly invigilation: InvigilationStore;
    readonly exams: ExamService;
    readonly proctor: ProctorStore | null;
    readonly now: () => number;
  };

  constructor(options: {
    store: LedgerStore;
    invitations: InvitationStore;
    invigilation: InvigilationStore;
    exams: ExamService;
    /** Proctoring photos and events, for a proctored exam's rows. */
    proctor?: ProctorStore | null;
    now?: () => number;
  }) {
    this.#o = { ...options, proctor: options.proctor ?? null, now: options.now ?? (() => Date.now()) };
  }

  async live(actor: Actor, id: string, idleMinutes = DEFAULT_IDLE_MINUTES): Promise<LiveView> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    const scope = staffScope(actor.orgId);
    const examId = toExamId(id);
    const exam = await this.#o.store.loadExam(scope, examId);
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${id}`);
    const now = this.#o.now();

    const policy = exam.policy.proctoring ?? null;
    const [chains, invited, summaries, drafts, announcements, proctored] = await Promise.all([
      this.#o.store.loadExamLedgers(scope, examId),
      this.#o.invitations.list(scope, examId),
      this.#o.store.listAttempts(scope, examId),
      this.#o.invigilation.lastDraftAt(scope, examId),
      this.#o.invigilation.announcements(scope, examId),
      policy === null || this.#o.proctor === null
        ? Promise.resolve(new Map<string, ProctorSummary>())
        : this.#o.proctor.summary(scope, examId),
    ]);
    const lastSeen = new Map(summaries.map((s) => [s.id as string, s.lastSeenAt === null ? null : Date.parse(s.lastSeenAt)]));

    const describe = (attemptId: string | null, ref: string, name: string, invitationId: string | null): LiveRow => {
      const entries = attemptId === null ? undefined : chains.get(attemptId as AttemptId);
      const first = entries?.[0];
      if (entries === undefined || first === undefined || first.event.type !== "attempt_started") {
        return {
          invitationId,
          attemptId,
          ref,
          name,
          state: "not_started",
          answered: 0,
          questions: paperOf(exam, undefined).questions.length,
          startedAt: null,
          lastSeenAt: null,
          lastActivityAt: null,
          expiresAt: null,
          extraMinutes: 0,
          reopened: 0,
          awaitingReply: false,
          proctoring: null,
          flags: { away: false, idle: false, overdue: false, cameraOff: false },
        };
      }
      const paper = paperOf(exam, first.event.questionIds);
      const folded = foldAttempt(entries, { exam: paper });
      if (!folded.ok) throw new Error(`Attempt ${attemptId} does not fold at ${folded.seq}: ${folded.reason}`);
      const { projection } = folded;
      const state = projection.attempt.state === "created" ? "in_progress" : projection.attempt.state;
      const expiresAt = deadlineOf(projection, exam);
      const seen = lastSeen.get(attemptId!) ?? null;
      // Typing, as far as the server can tell: the latest autosave or committed answer.
      const committed = entries.filter((e) => e.event.type === "answer_submitted").at(-1)?.timestamp ?? null;
      const activity = Math.max(projection.attempt.startedAt, committed ?? 0, drafts.get(attemptId!) ?? 0);
      const open = state === "in_progress";
      const sent = proctored.get(attemptId!);
      const proctoring: LiveProctoring | null =
        policy === null
          ? null
          : {
              identity: identityState(projection.identity),
              snapshots: sent?.snapshots ?? 0,
              lastSnapshotAt: sent?.lastSnapshotAt ?? null,
              events: sent?.events ?? {},
            };
      // Three intervals without a photo, a minute's grace at the start.
      const every = policy?.snapshotEverySeconds ?? null;
      const lastPhoto = proctoring?.lastSnapshotAt ?? projection.attempt.startedAt;
      const cameraOff = open && every !== null && now - lastPhoto > every * 3000 + 60_000;
      return {
        invitationId,
        attemptId,
        ref,
        name,
        state,
        answered: projection.attempt.responses.length,
        questions: paper.questions.length,
        startedAt: projection.attempt.startedAt,
        lastSeenAt: seen,
        lastActivityAt: activity,
        expiresAt,
        extraMinutes: Math.round(projection.extraTimeMs / 60_000),
        reopened: entries.filter((e) => e.event.type === "attempt_reopened").length,
        awaitingReply: projection.vivas.some((v) => v.exchange === null),
        proctoring,
        flags: {
          cameraOff,
          away: open && (seen === null ? now - projection.attempt.startedAt > AWAY_AFTER_MS : now - seen > AWAY_AFTER_MS),
          idle: open && now - activity > idleMinutes * 60_000,
          // Time is up but nothing has written since to close it; the next write will.
          overdue: open && now > expiresAt,
        },
      };
    };

    const rows: LiveRow[] = invited.map((i) => describe(i.attemptId, i.candidateRef, i.name, i.id));
    const covered = new Set(invited.map((i) => i.attemptId).filter((a) => a !== null));
    for (const summary of summaries) {
      if (!covered.has(summary.id)) rows.push(describe(summary.id, summary.candidateId, "", null));
    }

    const count = (p: (r: LiveRow) => boolean) => rows.filter(p).length;
    return {
      exam: { id: exam.id, title: exam.title },
      at: now,
      counts: {
        invited: invited.length,
        notStarted: count((r) => r.state === "not_started"),
        inProgress: count((r) => r.state === "in_progress"),
        away: count((r) => r.flags.away),
        idle: count((r) => r.flags.idle),
        cameraOff: count((r) => r.flags.cameraOff),
        identityPending: count((r) => r.proctoring?.identity === "pending"),
        submitted: count((r) => r.state === "submitted"),
        graded: count((r) => r.state === "graded"),
        void: count((r) => r.state === "void"),
      },
      rows,
      announcements,
    };
  }

  /** Tell everyone sitting an exam something at once. A person's act, audited. */
  async announce(actor: Actor, id: string, message: string): Promise<Announcement> {
    if (!can(actor, "attempt:extend") || actor.kind !== "user") throw new Forbidden("attempt:extend");
    const text = message.trim();
    if (text.length === 0 || text.length > MAX_ANNOUNCEMENT) {
      throw new AttemptError("reason_required", `An announcement is 1 to ${MAX_ANNOUNCEMENT} characters`);
    }
    const scope = staffScope(actor.orgId);
    if ((await this.#o.store.loadExam(scope, toExamId(id))) === null) throw new AttemptError("not_found", `No such exam: ${id}`);
    const announcement = await this.#o.invigilation.announce(scope, id, text, actor.name, new Date(this.#o.now()));
    await this.#o.exams.recordAudit(actor, "sitting.announced", id, { announcementId: announcement.id });
    return announcement;
  }

  /** What the candidate's sitting has been told. Their token's scope sees only their own exam's. */
  forCandidate(access: CandidateAccess & { readonly examId: ExamId }): Promise<readonly Announcement[]> {
    return this.#o.invigilation.announcements(candidateScope(access.orgId, access.attemptId), access.examId);
  }
}
