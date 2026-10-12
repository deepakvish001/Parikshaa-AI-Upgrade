import { createHash } from "node:crypto";
import { LARGE_PASTE, foldAttempt, type AttemptId, type ExamEvent, type ProctoringPolicy, type TimelineOp } from "@parikshaa/core";
import {
  AppendRefused,
  NoDataKey,
  staffScope,
  candidateScope,
  type LedgerStore,
  type MediaRecord,
  type ProctorEvent,
  type ProctorEventKind,
  type ProctorStore,
} from "@parikshaa/store";
import { AttemptError, Forbidden, type CandidateAccess, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Camera proctoring (ROADMAP §14), for an exam whose author turns it on.
 *
 * Each optional per exam: an identity check (a photo of the candidate and of
 * their photo ID before they begin, which a person compares and decides on,
 * on the record), a webcam photo every so often while they answer, what the
 * browser reports (the tab hidden, full screen left, a copy or a paste, the
 * camera stopping), and, in secure mode, the whole screen shared throughout
 * (sharing stopping or a second screen connecting is recorded) and speech or
 * noise heard. Neither the screen nor any sound is ever captured: only that
 * something happened, and when.
 *
 * None of it decides anything. A photo, a switched tab, a camera that went
 * dark are reasons for a person to look; they never fail anyone by
 * themselves, and they never reach the grade. Everything is personal data:
 * sealed under the attempt's key, and erased with the rest of the attempt.
 */

/** JPEG or PNG, and no bigger than a webcam frame needs to be. */
const MAX_IDENTITY_BYTES = 600_000;
const MAX_SNAPSHOT_BYTES = 250_000;
/** Which policy setting lets the page report each kind of event. The camera's own come with any camera use. */
const EVENT_NEEDS: Readonly<Record<ProctorEventKind, (p: ProctoringPolicy) => boolean>> = {
  tab_hidden: (p) => p.browserEvents,
  fullscreen_exit: (p) => p.browserEvents,
  copy: (p) => p.browserEvents,
  paste: (p) => p.browserEvents,
  camera_off: () => true,
  camera_on: () => true,
  screen_share_off: (p) => p.screenShare === true,
  screen_share_on: (p) => p.screenShare === true,
  second_screen: (p) => p.screenShare === true,
  voice: (p) => p.audio === true,
};

/**
 * Whether the candidate must get a device working before the clock starts:
 * the camera for photos, the screen to share, or the microphone to listen.
 */
export const needsCamera = (policy: ProctoringPolicy | undefined | null): boolean =>
  policy !== undefined &&
  policy !== null &&
  (policy.identity || policy.snapshotEverySeconds !== null || policy.screenShare === true || policy.audio === true);

/** A photo that is not an image, or too large to be one from a webcam. */
function decodeImage(base64: string, max: number): Buffer {
  const image = Buffer.from(base64.replace(/^data:image\/(jpeg|png);base64,/, ""), "base64");
  const jpeg = image.length > 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff;
  const png = image.length > 8 && image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!jpeg && !png) throw new AttemptError("invalid_proctoring", "That is not a JPEG or PNG photo");
  if (image.length > max) throw new AttemptError("invalid_proctoring", `A photo may be at most ${Math.round(max / 1000)} KB`);
  return image;
}

/** What an invigilator reviewing one attempt sees. */
export interface ProctoringView {
  readonly examId: string;
  readonly policy: ProctoringPolicy | null;
  readonly identity: {
    readonly selfie: MediaRecord | null;
    readonly id: MediaRecord | null;
    readonly capturedAt: number | null;
    readonly review: { readonly outcome: "verified" | "rejected"; readonly reason: string; readonly decidedBy: string; readonly at: number } | null;
    /** The photos stored are the ones the ledger committed to. */
    readonly matchesLedger: boolean;
  };
  readonly snapshots: readonly MediaRecord[];
  readonly events: readonly ProctorEvent[];
}

/** How one code answer was written, for a reviewer to play back. */
export interface CodePlayback {
  readonly questionId: string;
  readonly ops: readonly TimelineOp[];
  /** Every paste, by when and how long. */
  readonly pastes: readonly { readonly t: number; readonly chars: number }[];
  /** Pastes of {@link LARGE_PASTE} characters or more: a signal to look, never a finding. */
  readonly largePastes: number;
}

/** Most an attempt may send of editor changes, all its code questions together. */
export const MAX_TIMELINE_BYTES = 4 * 1024 * 1024;

/** One row of the live view, for a proctored exam. */
export interface LiveProctoring {
  readonly identity: "not_taken" | "pending" | "verified" | "rejected";
  readonly snapshots: number;
  readonly lastSnapshotAt: number | null;
  readonly events: Readonly<Partial<Record<ProctorEventKind, number>>>;
}

export class ProctorService {
  readonly #o: {
    readonly store: LedgerStore;
    readonly proctor: ProctorStore;
    readonly exams: ExamService;
    readonly now: () => number;
  };

  constructor(options: { store: LedgerStore; proctor: ProctorStore; exams: ExamService; now?: () => number }) {
    this.#o = { ...options, now: options.now ?? (() => Date.now()) };
  }

  /** The exam's policy and where the attempt stands, for a candidate writing to it. */
  async #open(access: CandidateAccess) {
    const state = await this.#o.exams.candidateState(access);
    if (state.state !== "in_progress") throw new AttemptError("invalid_state", "The attempt has closed");
    if (this.#o.now() > state.expiresAt) throw new AttemptError("expired", "The attempt is past its window");
    const policy = state.exam.proctoring;
    if (policy === null) throw new AttemptError("invalid_state", "This exam is not proctored");
    return { policy, state };
  }

  // --- the candidate's side --------------------------------------------------

  /**
   * The photos of the candidate and their ID, before they begin. Once: the
   * ledger commits to both photos' SHA-256, so neither can be swapped later.
   */
  async captureIdentity(access: CandidateAccess, selfieBase64: string, idBase64: string): Promise<void> {
    const { policy, state } = await this.#open(access);
    if (!policy.identity) throw new AttemptError("invalid_state", "This exam does not check identity");
    // Checked before anything is stored; the ledger's guard is the backstop for a race.
    if (state.identityCaptured) throw new AttemptError("invalid_state", "The identity photos have already been taken");
    const selfie = decodeImage(selfieBase64, MAX_IDENTITY_BYTES);
    const id = decodeImage(idBase64, MAX_IDENTITY_BYTES);
    const scope = candidateScope(access.orgId, access.attemptId);
    const now = new Date(this.#o.now());
    try {
      const [s, i] = [await this.#o.proctor.addMedia(scope, access.attemptId, "selfie", selfie, now), await this.#o.proctor.addMedia(scope, access.attemptId, "id", id, now)];
      await this.#o.store.append(
        scope,
        access.attemptId,
        { type: "identity_captured", attemptId: access.attemptId, selfieSha256: s.sha256, idSha256: i.sha256 },
        { guard: identityGuard },
      );
    } catch (error) {
      if (error instanceof AppendRefused) throw new AttemptError("invalid_state", error.message);
      if (error instanceof NoDataKey) throw new AttemptError("invalid_state", error.message);
      throw error;
    }
  }

  /**
   * A webcam photo, while the attempt is open. Capped at twice as many as the
   * exam's interval allows, so a page cannot fill the store.
   */
  async snapshot(access: CandidateAccess, imageBase64: string): Promise<void> {
    const { policy, state } = await this.#open(access);
    if (policy.snapshotEverySeconds === null) throw new AttemptError("invalid_state", "This exam takes no webcam photos");
    const image = decodeImage(imageBase64, MAX_SNAPSHOT_BYTES);
    const scope = candidateScope(access.orgId, access.attemptId);
    const allowed = Math.ceil((state.expiresAt - state.startedAt) / (policy.snapshotEverySeconds * 1000)) * 2 + 10;
    if ((await this.#o.proctor.countMedia(scope, access.attemptId, "snapshot")) >= allowed) {
      throw new AttemptError("too_many_runs", "More webcam photos than this exam takes");
    }
    try {
      await this.#o.proctor.addMedia(scope, access.attemptId, "snapshot", image, new Date(this.#o.now()));
    } catch (error) {
      if (error instanceof NoDataKey) throw new AttemptError("invalid_state", error.message);
      throw error;
    }
  }

  /** What the browser reported. Timed by the server, which the candidate's clock cannot move. */
  async events(access: CandidateAccess, kinds: readonly string[]): Promise<void> {
    const { policy } = await this.#open(access);
    for (const kind of kinds) {
      if (!Object.hasOwn(EVENT_NEEDS, kind)) throw new AttemptError("invalid_proctoring", `Not an event: ${kind}`);
      if (!EVENT_NEEDS[kind as ProctorEventKind](policy)) throw new AttemptError("invalid_state", `This exam does not record ${kind.replaceAll("_", " ")}`);
    }
    const scope = candidateScope(access.orgId, access.attemptId);
    const at = new Date(this.#o.now());
    for (const kind of kinds) await this.#o.proctor.addEvent(scope, access.attemptId, kind as ProctorEventKind, at);
  }

  /**
   * A batch of a code question's editor changes (G4), for playback. Any exam
   * with code, proctored or not; only while the attempt is open; capped per
   * attempt so a client cannot fill the database.
   */
  async codeTimeline(access: CandidateAccess, questionId: string, ops: readonly TimelineOp[]): Promise<void> {
    const state = await this.#o.exams.candidateState(access);
    if (state.state !== "in_progress") throw new AttemptError("invalid_state", "The attempt has closed");
    if (this.#o.now() > state.expiresAt) throw new AttemptError("expired", "The attempt is past its window");
    const question = state.exam.questions.find((q) => q.id === questionId);
    if (question === undefined || question.kind !== "code") throw new AttemptError("not_code", `Question ${questionId} is not a code question on this paper`);
    const scope = candidateScope(access.orgId, access.attemptId);
    const batch = JSON.stringify(ops);
    if ((await this.#o.proctor.timelineBytes(scope, access.attemptId)) + Buffer.byteLength(batch, "utf8") > MAX_TIMELINE_BYTES) {
      throw new AttemptError("too_many_runs", "This attempt has sent as much of its typing as is kept");
    }
    try {
      await this.#o.proctor.addTimeline(scope, access.attemptId, questionId, batch, new Date(this.#o.now()));
    } catch (error) {
      if (error instanceof NoDataKey) throw new AttemptError("invalid_state", error.message);
      throw error;
    }
  }

  // --- the invigilator's side -------------------------------------------------

  async view(actor: Actor, attemptId: AttemptId): Promise<ProctoringView> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    const scope = staffScope(actor.orgId);
    const { opened } = await this.#o.store.loadBoth(scope, attemptId);
    const first = opened[0]?.event;
    if (first === undefined || first.type !== "attempt_started") throw new AttemptError("not_found", "No such attempt");
    const exam = await this.#o.store.loadExam(scope, first.examId);
    const folded = foldAttempt(opened);
    const identity = folded.ok ? folded.projection.identity : null;
    const [selfies, ids, snapshots, events] = await Promise.all([
      this.#o.proctor.media(scope, attemptId, "selfie", 1),
      this.#o.proctor.media(scope, attemptId, "id", 1),
      this.#o.proctor.media(scope, attemptId, "snapshot", 500),
      this.#o.proctor.events(scope, attemptId),
    ]);
    const selfie = selfies[0] ?? null;
    const id = ids[0] ?? null;
    return {
      examId: first.examId,
      policy: exam?.policy.proctoring ?? null,
      identity: {
        selfie,
        id,
        capturedAt: identity?.capturedAt ?? null,
        review:
          identity?.review === null || identity?.review === undefined
            ? null
            : { outcome: identity.review.outcome, reason: identity.review.reason, decidedBy: identity.review.decidedBy.name, at: identity.review.at },
        matchesLedger: identity === null || (selfie?.sha256 === identity.selfieSha256 && id?.sha256 === identity.idSha256),
      },
      snapshots,
      events,
    };
  }

  /** How each code answer of an attempt was written, for playback (G4). */
  async playback(actor: Actor, attemptId: AttemptId): Promise<readonly CodePlayback[]> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    let batches;
    try {
      batches = await this.#o.proctor.timeline(staffScope(actor.orgId), attemptId);
    } catch (error) {
      if (error instanceof NoDataKey) throw new AttemptError("not_found", "This attempt's typing has been erased");
      throw error;
    }
    const byQuestion = new Map<string, TimelineOp[]>();
    for (const { questionId, batch } of batches) {
      const ops = byQuestion.get(questionId) ?? [];
      ops.push(...(JSON.parse(batch) as TimelineOp[]));
      byQuestion.set(questionId, ops);
    }
    return [...byQuestion].map(([questionId, ops]) => {
      const pastes = ops.filter((o) => o.paste === true).map((o) => ({ t: o.t, chars: o.ins.length }));
      return { questionId, ops, pastes, largePastes: pastes.filter((p) => p.chars >= LARGE_PASTE).length };
    });
  }

  /** One photo, opened, with its hash checked against what was stored. */
  async photo(actor: Actor, attemptId: AttemptId, mediaId: string): Promise<{ image: Buffer; type: string }> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    let opened;
    try {
      opened = await this.#o.proctor.open(staffScope(actor.orgId), attemptId, mediaId);
    } catch (error) {
      if (error instanceof NoDataKey) throw new AttemptError("not_found", "This attempt's photos have been erased");
      throw error;
    }
    if (opened === null) throw new AttemptError("not_found", "No such photo");
    if (createHash("sha256").update(opened.image).digest("hex") !== opened.record.sha256) {
      throw new AttemptError("invalid_state", "This photo does not match the hash it was stored with");
    }
    const png = opened.image[0] === 0x89;
    return { image: opened.image, type: png ? "image/png" : "image/jpeg" };
  }

  /** A person's decision on the identity photos, with their name and reason in the ledger. */
  async reviewIdentity(actor: Actor, attemptId: AttemptId, outcome: "verified" | "rejected", reason: string): Promise<void> {
    if (!can(actor, "attempt:extend")) throw new Forbidden("attempt:extend");
    const trimmed = reason.trim();
    if (trimmed.length < 5) throw new AttemptError("reason_required", "Say what you compared, in a few words");
    const scope = staffScope(actor.orgId);
    try {
      await this.#o.store.append(
        scope,
        attemptId,
        { type: "identity_reviewed", attemptId, outcome, reason: trimmed, decidedBy: { userId: actor.id, name: actor.name } },
        { guard: reviewGuard },
      );
    } catch (error) {
      if (error instanceof AppendRefused) throw new AttemptError("invalid_state", error.message);
      if (error instanceof Error && error.message.startsWith("No such attempt")) throw new AttemptError("not_found", error.message);
      throw error;
    }
    await this.#o.exams.recordAudit(actor, `identity.${outcome}`, attemptId, { reason: trimmed });
  }
}

/** Photos are taken once, while the attempt is open. */
function identityGuard(events: readonly ExamEvent[]): string | null {
  if (events.some((e) => e.type === "identity_captured")) return "The identity photos have already been taken";
  let open = true;
  for (const e of events) {
    if (e.type === "attempt_submitted" || e.type === "attempt_graded" || e.type === "attempt_voided") open = false;
    else if (e.type === "attempt_reopened") open = true;
  }
  return open ? null : "The attempt has closed";
}

/** A review needs photos to review, and comes before grading. */
function reviewGuard(events: readonly ExamEvent[]): string | null {
  if (!events.some((e) => e.type === "identity_captured")) return "No identity photos have been taken";
  if (events.some((e) => e.type === "attempt_graded" || e.type === "attempt_voided" || e.type === "data_erased")) {
    return "The attempt is graded, set aside or erased";
  }
  return null;
}

/** The identity check's state, from a projection's `identity`. */
export function identityState(identity: { readonly review: { readonly outcome: "verified" | "rejected" } | null } | null): LiveProctoring["identity"] {
  if (identity === null) return "not_taken";
  return identity.review === null ? "pending" : identity.review.outcome;
}
