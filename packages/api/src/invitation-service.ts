import { candidateId, examId as toExamId, orgId as toOrgId, type AttemptId, type ExamId, type OrgId } from "@parikshaa/core";
import {
  staffScope,
  type CandidateHit,
  type ExamWindow,
  type Invitation,
  type InvitationDraft,
  type InvitationStatus,
  type InvitationStore,
  type LedgerStore,
  type OutboxDraft,
} from "@parikshaa/store";
import type { AttemptTokens } from "./auth.js";
import { importCandidates, type CandidateProblem } from "./candidate-import.js";
import type { InviteCodes } from "./invite-codes.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor, type Permission } from "./staff-auth.js";
import { ConsentRequired, type Notice } from "./privacy.js";
import { needsCamera } from "./proctoring.js";
import type { LabService } from "./lab.js";
import type { Exam, ProctoringPolicy } from "@parikshaa/core";

/**
 * A proctored exam starts only once the candidate's page has its camera
 * working: the clock should not run while they find the permission prompt.
 */
export class CameraRequired extends Error {
  constructor(readonly proctoring: ProctoringPolicy) {
    super("This test uses the camera: allow it, then open the test");
    this.name = "CameraRequired";
  }
}

/**
 * Inviting a cohort, scheduling it, and letting each candidate in (ROADMAP §5).
 *
 * Nobody clicks "Start" two thousand times. An institution uploads its list,
 * sets a window, and each candidate receives a link. The link does not start
 * anything: the attempt, and its clock, start when the candidate opens it
 * inside their window. The same link resumes the attempt from any device until
 * the window closes.
 */

export type Channel = "email" | "sms" | "whatsapp";

/** The first reminder goes out this long before the candidate's window opens. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** The invitation's code was not issued by this server, or has been revoked. */
export class InvalidInvitation extends Error {
  constructor() {
    super("This link is not valid. Ask whoever sent it for a new one.");
    this.name = "InvalidInvitation";
  }
}

/** Opened before or after the candidate's window. */
export class OutsideWindow extends Error {
  constructor(
    readonly when: "early" | "late",
    readonly opensAt: string,
    readonly closesAt: string,
  ) {
    super(when === "early" ? `This test opens at ${opensAt}` : `This test closed at ${closesAt}`);
    this.name = "OutsideWindow";
  }
}

/** A candidate list with problems; nothing was imported. */
export class ImportRejected extends Error {
  constructor(readonly problems: readonly CandidateProblem[]) {
    super(`The file has ${problems.length} problem(s); nothing was imported`);
    this.name = "ImportRejected";
  }
}

export interface InvitationServiceOptions {
  readonly exams: ExamService;
  readonly store: LedgerStore;
  readonly invitations: InvitationStore;
  readonly codes: InviteCodes;
  readonly tokens: AttemptTokens;
  /** Where candidates open their link, e.g. https://exam.institution.ac.in */
  readonly publicUrl: string;
  /** How long before a window opens the last reminder goes out; the first goes a day before. */
  readonly reminderLeadMs?: number;
  readonly now?: () => number;
  readonly newId?: () => string;
  /**
   * The privacy notice an organisation's candidates must agree to before
   * their attempt starts (ROADMAP §11), or null if it has not set one.
   */
  readonly notice?: (orgId: OrgId) => Promise<Notice | null>;
  /** Lab mode: where an exam may be taken from, and whether it waits for its invigilator. */
  readonly lab?: LabService;
  /** Where a candidate sits on exam day, when the exam is held in rooms. */
  readonly seat?: (orgId: OrgId, examId: string, ref: string) => Promise<{ readonly centre: string; readonly room: string; readonly seat: string } | null>;
  /** Where an attempt was opened from, for spotting a proxy. Never stops a candidate. */
  readonly origin?: (orgId: OrgId, examId: string, attemptId: string, ref: string, ip: string, userAgent: string) => Promise<void>;
}

export interface ImportPreview {
  readonly dryRun: true;
  readonly candidates: number;
  readonly problems: readonly CandidateProblem[];
  readonly warnings: readonly CandidateProblem[];
  readonly preview: readonly InvitationDraft[];
}

export class InvitationService {
  readonly #o: Required<Omit<InvitationServiceOptions, "reminderLeadMs" | "now" | "newId" | "notice" | "lab" | "seat" | "origin">>;
  readonly #seat: NonNullable<InvitationServiceOptions["seat"]>;
  readonly #notice: (orgId: OrgId) => Promise<Notice | null>;
  readonly #lab: LabService | null;
  readonly #origin: NonNullable<InvitationServiceOptions["origin"]> | null;
  readonly #lead: number;
  readonly #now: () => number;
  readonly #newId: () => string;

  constructor(options: InvitationServiceOptions) {
    this.#o = options;
    this.#lead = options.reminderLeadMs ?? 60 * 60 * 1000;
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.#notice = options.notice ?? (async () => null);
    this.#lab = options.lab ?? null;
    this.#origin = options.origin ?? null;
    this.#seat = options.seat ?? (async () => null);
  }

  #require(actor: Actor, permission: Permission) {
    if (!can(actor, permission)) throw new Forbidden(permission);
    return staffScope(actor.orgId);
  }

  async #audit(actor: Actor, action: string, target: string, detail: Record<string, unknown> = {}) {
    await this.#o.exams.recordAudit(actor, action, target, detail);
  }

  async #examExists(orgId: OrgId, examId: string): Promise<void> {
    if ((await this.#o.store.loadExam(staffScope(orgId), toExamId(examId))) === null) {
      throw new AttemptError("not_found", `No such exam: ${examId}`);
    }
  }

  // --- the window -----------------------------------------------------------

  /**
   * Schedule an exam, or move it. Moving it takes along every invited
   * candidate who was on the exam's window and has not begun: their link
   * opens at the new time, their reminders are for the new time, and, with
   * `notify`, each is told the new time by the channels their invitation
   * went by. A candidate given a window of their own keeps it. Returns how
   * many candidates moved.
   */
  async setWindow(
    actor: Actor,
    examId: string,
    window: ExamWindow,
    options: { readonly notify?: boolean } = {},
  ): Promise<{ readonly moved: number }> {
    const scope = this.#require(actor, "exam:write");
    await this.#examExists(actor.orgId, examId);
    if (new Date(window.closesAt) <= new Date(window.opensAt)) {
      throw new AttemptError("invalid_state", "The window closes before it opens");
    }
    const previous = await this.#o.invitations.getWindow(scope, examId);
    if (previous === null) {
      await this.#o.invitations.setWindow(scope, examId, window);
      await this.#audit(actor, "exam.window_set", examId, { ...window });
      return { moved: 0 };
    }
    const retime = previous.opensAt !== window.opensAt || previous.closesAt !== window.closesAt;
    const notify = options.notify ?? true;
    const moved = await this.#o.invitations.moveWindow(scope, examId, previous, window, {
      retime,
      messages: (invitationId, channels) => [
        ...(notify ? channels.map((kind) => ({ kind, subject: { invitationId }, purpose: "rescheduled", sendAfter: new Date(this.#now()) })) : []),
        ...this.#reminders(invitationId, window.opensAt, channels),
      ],
    });
    const change = retime ? { from: { opensAt: previous.opensAt, closesAt: previous.closesAt }, moved, notified: notify } : {};
    await this.#audit(actor, "exam.window_set", examId, { ...window, ...change });
    // The same times with only hard close changed: candidates follow it, but nobody moved.
    return { moved: retime ? moved : 0 };
  }

  getWindow(actor: Actor, examId: string): Promise<ExamWindow | null> {
    return this.#o.invitations.getWindow(this.#require(actor, "attempt:read"), examId);
  }

  // --- inviting -------------------------------------------------------------

  /**
   * The messages an invitation sends: now, a reminder the day before the
   * window opens, and another shortly before. A reminder that would fall due
   * within a few minutes of the invitation itself is left out: the invitation
   * says the same thing.
   */
  #messages(draft: InvitationDraft, channels: readonly Channel[]) {
    return (invitationId: string): OutboxDraft[] => {
      const reachable = channels.filter((c) => (c === "email" ? draft.email !== null : draft.phone !== null));
      return [
        ...reachable.map((kind) => ({ kind, subject: { invitationId }, purpose: "invite", sendAfter: new Date(this.#now()) })),
        ...this.#reminders(invitationId, draft.opensAt, reachable),
      ];
    };
  }

  /** The reminders for a window opening at `opensAt`: a day before, and shortly before, each only if still to come. */
  #reminders(invitationId: string, opensAt: string, channels: readonly Channel[]): OutboxDraft[] {
    const opens = new Date(opensAt).getTime();
    const worthIt = (at: number) => at > this.#now() + 5 * 60 * 1000;
    const due = [
      { purpose: "reminder_day", at: opens - DAY_MS },
      { purpose: "reminder", at: opens - this.#lead },
    ].filter((r) => worthIt(r.at));
    return channels.flatMap((kind) => due.map((r) => ({ kind, subject: { invitationId }, purpose: r.purpose, sendAfter: new Date(r.at) })));
  }

  /**
   * Check a candidate list, or import it. A dry run changes nothing; a real
   * import is all or nothing, and queues each candidate's messages in the
   * same transaction.
   */
  async importCandidates(
    actor: Actor,
    examId: string,
    csv: string,
    options: { readonly dryRun: boolean; readonly channels: readonly Channel[] },
  ): Promise<ImportPreview | { readonly dryRun: false; readonly invited: number; readonly warnings: readonly CandidateProblem[] }> {
    const scope = this.#require(actor, "attempt:start");
    await this.#examExists(actor.orgId, examId);
    const [window, existing] = await Promise.all([
      this.#o.invitations.getWindow(scope, examId),
      this.#o.invitations.existingRefs(scope, examId),
    ]);
    const result = importCandidates(csv, window, existing);

    if (options.dryRun) {
      return {
        dryRun: true,
        candidates: result.drafts.length,
        problems: result.problems,
        warnings: result.warnings,
        preview: result.drafts.slice(0, 20),
      };
    }
    if (result.problems.length > 0) throw new ImportRejected(result.problems);

    const invited = await this.#o.invitations.invite(scope, examId, result.drafts, (id, draft) =>
      this.#messages(draft, options.channels)(id),
    );
    await this.#audit(actor, "invitations.imported", examId, { candidates: invited.length, channels: options.channels });
    return { dryRun: false, invited: invited.length, warnings: result.warnings };
  }

  /** Invite one candidate, as an integration does. */
  async inviteOne(
    actor: Actor,
    examId: string,
    draft: Omit<InvitationDraft, "opensAt" | "closesAt" | "hardClose"> & Partial<Pick<InvitationDraft, "opensAt" | "closesAt">>,
    channels: readonly Channel[],
  ): Promise<Invitation> {
    const scope = this.#require(actor, "attempt:start");
    await this.#examExists(actor.orgId, examId);
    const window = await this.#o.invitations.getWindow(scope, examId);
    // Without a scheduled window an invited candidate has a week.
    const opensAt = draft.opensAt ?? window?.opensAt ?? new Date(this.#now()).toISOString();
    const closesAt = draft.closesAt ?? window?.closesAt ?? new Date(this.#now() + 7 * 24 * 3600 * 1000).toISOString();
    const full: InvitationDraft = { ...draft, opensAt, closesAt, hardClose: window?.hardClose ?? true };
    const [invitation] = await this.#o.invitations.invite(scope, examId, [full], (id) => this.#messages(full, channels)(id));
    await this.#audit(actor, "invitations.created", invitation!.id, { examId });
    return invitation!;
  }

  /**
   * Invite several people at once, on the exam's window (or a week from now
   * without one), as a placement drive does. Anyone already invited to the
   * exam keeps their invitation and is counted as skipped.
   */
  async inviteMany(
    actor: Actor,
    examId: string,
    people: readonly { readonly ref: string; readonly name: string; readonly email: string | null; readonly phone: string | null }[],
    channels: readonly Channel[],
    detail: Record<string, unknown> = {},
  ): Promise<{ readonly invited: number; readonly skipped: number }> {
    const scope = this.#require(actor, "attempt:start");
    await this.#examExists(actor.orgId, examId);
    const [window, existing] = await Promise.all([this.#o.invitations.getWindow(scope, examId), this.#o.invitations.existingRefs(scope, examId)]);
    const opensAt = window?.opensAt ?? new Date(this.#now()).toISOString();
    const closesAt = window?.closesAt ?? new Date(this.#now() + 7 * DAY_MS).toISOString();
    if (window !== null && Date.parse(window.closesAt) <= this.#now()) throw new AttemptError("invalid_state", "The exam's window has closed: set a new one first");
    const drafts: InvitationDraft[] = people
      .filter((p) => !existing.has(p.ref))
      .map((p) => ({ candidateRef: p.ref, name: p.name, email: p.email, phone: p.phone, opensAt, closesAt, hardClose: window?.hardClose ?? true }));
    const invited = drafts.length === 0 ? [] : await this.#o.invitations.invite(scope, examId, drafts, (id, draft) => this.#messages(draft, channels)(id));
    if (invited.length > 0) await this.#audit(actor, "invitations.imported", examId, { candidates: invited.length, channels, ...detail });
    return { invited: invited.length, skipped: people.length - invited.length };
  }

  list(actor: Actor, examId: string): Promise<readonly InvitationStatus[]> {
    return this.#o.invitations.list(this.#require(actor, "attempt:read"), examId, new Date(this.#now()));
  }

  /** Candidates across the organisation's exams matching `text`, for the console's search. */
  search(actor: Actor, text: string): Promise<readonly CandidateHit[]> {
    const scope = this.#require(actor, "attempt:read");
    return text.trim().length < 2 ? Promise.resolve([]) : this.#o.invitations.search(scope, text.trim());
  }

  async resend(actor: Actor, invitationId: string, channels: readonly Channel[]): Promise<void> {
    const scope = this.#require(actor, "attempt:start");
    const invitation = await this.#o.invitations.get(scope, invitationId);
    if (invitation === null || invitation.revoked) throw new AttemptError("not_found", "No such invitation");
    const drafts: OutboxDraft[] = channels
      .filter((c) => (c === "email" ? invitation.email !== null : invitation.phone !== null))
      .map((kind) => ({ kind, subject: { invitationId }, purpose: "invite", sendAfter: new Date(this.#now()) }));
    await this.#o.invitations.enqueue(scope, drafts);
    await this.#audit(actor, "invitations.resent", invitationId, { channels });
  }

  async revoke(actor: Actor, invitationId: string): Promise<void> {
    const scope = this.#require(actor, "attempt:start");
    if (!(await this.#o.invitations.revoke(scope, invitationId))) throw new AttemptError("not_found", "No such invitation");
    await this.#audit(actor, "invitations.revoked", invitationId);
  }

  /** A candidate's link. Regenerated from the invitation each time; never stored. */
  link(orgId: string, invitationId: string): string {
    return `${this.#o.publicUrl.replace(/\/$/, "")}/?invite=${encodeURIComponent(this.#o.codes.issue(orgId, invitationId))}`;
  }

  /**
   * Every candidate's link, for an institution that hands them out itself.
   * These are credentials, so the export is audited.
   */
  async links(actor: Actor, examId: string): Promise<readonly (InvitationStatus & { readonly link: string })[]> {
    const scope = this.#require(actor, "attempt:start");
    const all = await this.#o.invitations.list(scope, examId);
    await this.#audit(actor, "invitations.links_exported", examId, { candidates: all.length });
    return all.filter((i) => !i.revoked).map((i) => ({ ...i, link: this.link(actor.orgId, i.id) }));
  }

  // --- the candidate's side -------------------------------------------------

  /**
   * Open an invitation: start its attempt, or resume the one it started.
   *
   * The first opening inside the window starts the attempt, and with it the
   * clock. Every later opening — another device, a reload after a crash —
   * returns a fresh token for the same attempt, until the window closes.
   *
   * Where the organisation has a privacy notice, the first opening must carry
   * agreement to its current version; without it, {@link ConsentRequired}
   * hands back the notice to show. Consent comes before the clock, so reading
   * the notice costs the candidate none of their time.
   */
  async redeem(
    code: string,
    consent?: { readonly noticeVersion: number },
    /** The candidate's page has the camera working, for a proctored exam. */
    camera?: boolean,
    /** Where the request came from, for an exam limited to a lab's network. */
    ip?: string,
    /** The browser's description of itself: with the address, a sign of one person sitting for several. */
    userAgent?: string,
  ): Promise<{ token: string; attemptId: string; resumed: boolean }> {
    const named = this.#o.codes.verify(code);
    if (named === null) throw new InvalidInvitation();
    const orgId = toOrgId(named.orgId);
    const scope = staffScope(orgId);

    const invitation = await this.#o.invitations.get(scope, named.invitationId);
    if (invitation === null || invitation.revoked) throw new InvalidInvitation();

    const now = this.#now();
    const opens = Date.parse(invitation.opensAt);
    const closes = Date.parse(invitation.closesAt);
    if (now < opens) throw new OutsideWindow("early", invitation.opensAt, invitation.closesAt);
    if (invitation.attemptId === null && now >= closes) throw new OutsideWindow("late", invitation.opensAt, invitation.closesAt);

    const exam = await this.#o.store.loadExam(scope, toExamId(invitation.examId));
    if (exam === null) throw new InvalidInvitation();

    const starting = invitation.attemptId === null || !(await this.#o.store.hasStarted(scope, invitation.attemptId as AttemptId));
    const notice = starting ? await this.#notice(orgId) : null;
    if (notice !== null && consent?.noticeVersion !== notice.version) throw new ConsentRequired(notice);
    const proctoring = exam.policy.proctoring;
    if (starting && proctoring !== undefined && needsCamera(proctoring) && camera !== true) throw new CameraRequired(proctoring);

    // Last, so a candidate waiting for the invigilator has done everything else first.
    if (this.#lab !== null) await this.#lab.check(orgId, exam.id, ip ?? "", { starting });

    const claim = await this.#o.invitations.claimAttempt(scope, invitation.id, this.#newId());
    // Not only the first redemption starts the attempt: if the first died
    // between claiming the id and starting it, a later one finishes the job
    // instead of leaving the candidate locked out. Starting is idempotent.
    if (claim.claimed || !(await this.#o.store.hasStarted(scope, claim.attemptId as AttemptId))) {
      await this.#o.exams.startInvited(
        orgId,
        invitation.id,
        exam.id as ExamId,
        candidateId(invitation.candidateRef),
        claim.attemptId as AttemptId,
        invitation.hardClose ? closes : null,
        exam,
        notice === null ? undefined : { noticeVersion: notice.version, noticeHash: notice.hash },
      );
    }

    // Long enough for the attempt, however late it started; the link issues
    // another whenever this one runs out.
    const ttlSeconds = Math.ceil((Math.max(closes - now, 0) + exam.policy.durationMs) / 1000) + 3600;
    const token = await this.#o.tokens.issue(
      { orgId, attemptId: claim.attemptId as AttemptId, examId: exam.id, candidateId: candidateId(invitation.candidateRef) },
      ttlSeconds,
    );
    if (this.#origin !== null && ip !== undefined) {
      await this.#origin(orgId, exam.id, claim.attemptId, invitation.candidateRef, ip, userAgent ?? "").catch(() => undefined);
    }
    return { token, attemptId: claim.attemptId, resumed: !claim.claimed };
  }

  /**
   * What the candidate should know before they begin, read without beginning.
   *
   * A computer-based test shows its instructions before the clock: the paper's
   * shape, its marking, what the palette's colours mean, and a "ready to
   * begin". Reading them here starts nothing and claims nothing, so a
   * candidate can take as long as they need. Opening the link is still
   * {@link redeem}; this only says what it will open.
   */
  async briefing(code: string): Promise<Briefing> {
    const named = this.#o.codes.verify(code);
    if (named === null) throw new InvalidInvitation();
    const scope = staffScope(toOrgId(named.orgId));
    const invitation = await this.#o.invitations.get(scope, named.invitationId);
    if (invitation === null || invitation.revoked) throw new InvalidInvitation();
    const exam = await this.#o.store.loadExam(scope, toExamId(invitation.examId));
    if (exam === null) throw new InvalidInvitation();
    const started = invitation.attemptId !== null && (await this.#o.store.hasStarted(scope, invitation.attemptId as AttemptId));
    // What opening will ask for, so the page can ask it first: the same notice and camera redeem would refuse without.
    const notice = started ? null : await this.#notice(toOrgId(named.orgId));
    const seat = await this.#seat(toOrgId(named.orgId), invitation.examId, invitation.candidateRef);
    return { ...briefingOf(exam, invitation, started), notice, seat };
  }
}

/** The paper as its instructions describe it, before anything starts. */
export interface Briefing {
  readonly title: string;
  readonly candidate: { readonly name: string; readonly ref: string };
  /** Already begun: the link resumes it, and the instructions are skipped. */
  readonly started: boolean;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly durationMs: number;
  readonly questionCount: number;
  /** Marks on the paper; a section counts its draw at its first question's marks. */
  readonly totalMarks: number;
  readonly sections: readonly { readonly title: string; readonly questionCount: number; readonly durationMs: number | null }[];
  readonly kinds: readonly ("mcq" | "multiple" | "numeric" | "short" | "code")[];
  /** The largest mark taken away for a wrong answer; zero when nothing is. */
  readonly negativeMarks: number;
  readonly allowRevision: boolean;
  readonly calculator: boolean;
  readonly proctored: boolean;
  /** What a proctored test's camera will do, told before it is asked for; null when it has no camera. */
  readonly proctoring: ProctoringPolicy | null;
  /**
   * The privacy notice to agree to before opening, or null when there is none
   * or the attempt has begun. Redeem still insists on it; this lets the page
   * show it first, in its place among the steps, instead of on refusal.
   */
  readonly notice: Notice | null;
  /** Where to sit, when the exam is held in rooms; the admit card says the same. */
  readonly seat: { readonly centre: string; readonly room: string; readonly seat: string } | null;
}

export function briefingOf(
  exam: Exam,
  invitation: Pick<Invitation, "name" | "candidateRef" | "opensAt" | "closesAt">,
  started: boolean,
): Omit<Briefing, "notice" | "seat"> {
  const sections = exam.sections ?? [];
  const every = [...exam.questions, ...sections.flatMap((s) => s.pool)];
  const kinds = new Set<Briefing["kinds"][number]>();
  for (const q of every) {
    if (q.kind === "mcq") kinds.add(q.correctIndices !== undefined && q.correctIndices.length > 1 ? "multiple" : "mcq");
    else kinds.add(q.kind);
  }
  const negativeOf = (q: (typeof every)[number]) => (q.kind === "mcq" || q.kind === "numeric" ? (q.negativeMarks ?? 0) : 0);
  return {
    title: exam.title,
    candidate: { name: invitation.name, ref: invitation.candidateRef },
    started,
    opensAt: invitation.opensAt,
    closesAt: invitation.closesAt,
    durationMs: exam.policy.durationMs,
    questionCount: exam.questions.length + sections.reduce((n, s) => n + s.pick, 0),
    totalMarks:
      exam.questions.reduce((n, q) => n + q.maxScore, 0) + sections.reduce((n, s) => n + s.pick * (s.pool[0]?.maxScore ?? 0), 0),
    sections: [
      ...(sections.length > 0 && exam.questions.length > 0 ? [{ title: "General", questionCount: exam.questions.length, durationMs: null }] : []),
      ...sections.map((s) => ({ title: s.title, questionCount: s.pick, durationMs: s.durationMs ?? null })),
    ],
    kinds: (["mcq", "multiple", "numeric", "short", "code"] as const).filter((k) => kinds.has(k)),
    negativeMarks: Math.max(0, ...every.map(negativeOf)),
    allowRevision: exam.policy.allowRevision,
    calculator: exam.policy.calculator ?? false,
    proctored: exam.policy.proctoring !== undefined && needsCamera(exam.policy.proctoring),
    proctoring: exam.policy.proctoring !== undefined && needsCamera(exam.policy.proctoring) ? exam.policy.proctoring : null,
  };
}
