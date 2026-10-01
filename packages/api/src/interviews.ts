import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { orgId as toOrgId } from "@parikshaa/core";
import type { Interview, InterviewStore, Scorecard } from "@parikshaa/store";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * The interview room (docs/PREP-TRACKER.md, V2-12: CO26, CO27, CO28). Staff
 * schedule an interview; the candidate joins by a link, opens the video call
 * (any provider's link, or a Jitsi room made for it) and writes code in the
 * room, which the interviewer watches as it is typed. The interviewer keeps
 * notes and fills a scorecard — criteria on 1–5 and a recommendation — that
 * the hiring team reads. The video itself is the provider's: nothing of it
 * passes through here.
 */

export const LANGUAGES = ["python", "javascript", "java", "cpp", "c", "sql", "text"] as const;

export class InterviewGone extends Error {
  constructor() {
    super("This interview link is not valid, or the interview was cancelled");
    this.name = "InterviewGone";
  }
}

export interface RoomView {
  readonly title: string;
  readonly candidateName: string;
  readonly interviewer: string;
  readonly scheduledAt: string;
  readonly minutes: number;
  readonly meetingUrl: string;
  readonly problem: string;
  readonly language: string;
  readonly code: string;
  readonly status: Interview["status"];
}

export class InterviewService {
  readonly #store: InterviewStore;
  readonly #exams: ExamService;
  readonly #key: Buffer;
  readonly #publicUrl: string;
  readonly #now: () => number;
  readonly #newId: () => string;

  constructor(options: { readonly store: InterviewStore; readonly exams: ExamService; readonly secret: string; readonly publicUrl: string; readonly now?: () => number; readonly newId?: () => string }) {
    this.#store = options.store;
    this.#exams = options.exams;
    this.#key = createHmac("sha256", options.secret).update("parikshaa-interviews").digest();
    this.#publicUrl = options.publicUrl.replace(/\/$/, "");
    this.#now = options.now ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  #mac(orgId: string, id: string) {
    return createHmac("sha256", this.#key).update(`${orgId}.${id}`).digest("base64url").slice(0, 22);
  }

  link(orgId: string, id: string): string {
    return `${this.#publicUrl}/?interview=${encodeURIComponent(`${orgId}.${id}.${this.#mac(orgId, id)}`)}`;
  }

  #require(actor: Actor) {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
  }

  async schedule(
    actor: Actor,
    request: {
      readonly title: string;
      readonly candidateName: string;
      readonly candidateRef: string;
      readonly candidateEmail: string | null;
      readonly scheduledAt: string;
      readonly minutes: number;
      readonly meetingUrl: string | null;
      readonly problem: string;
      readonly language: string;
      readonly driveId: string | null;
    },
  ): Promise<Interview & { readonly link: string }> {
    this.#require(actor);
    const at = Date.parse(request.scheduledAt);
    if (Number.isNaN(at)) throw new AttemptError("invalid_state", "Not a date and time");
    const meeting = request.meetingUrl?.trim() ?? "";
    if (meeting !== "" && !/^https:\/\/[^\s]+$/.test(meeting)) throw new AttemptError("invalid_state", "The video call link must start with https://");
    const id = this.#newId();
    const interview = await this.#store.create(actor.orgId, {
      id,
      title: request.title.trim(),
      candidateRef: request.candidateRef.trim(),
      candidateName: request.candidateName.trim(),
      candidateEmail: request.candidateEmail?.trim().toLowerCase() || null,
      interviewer: actor.name,
      scheduledAt: new Date(at).toISOString(),
      minutes: request.minutes,
      // Without a link of their own, a Jitsi room no one can guess.
      meetingUrl: meeting === "" ? `https://meet.jit.si/parikshaa-${randomBytes(9).toString("base64url")}` : meeting,
      problem: request.problem,
      language: request.language,
      driveId: request.driveId,
      createdAt: new Date(this.#now()).toISOString(),
    });
    await this.#exams.recordAudit(actor, "interview.scheduled", id, { candidate: interview.candidateRef || interview.candidateName, at: interview.scheduledAt });
    return { ...interview, link: this.link(actor.orgId, id) };
  }

  async list(actor: Actor) {
    this.#require(actor);
    return (await this.#store.list(actor.orgId)).map((i) => ({ ...i, link: this.link(actor.orgId, i.id) }));
  }

  async get(actor: Actor, id: string) {
    this.#require(actor);
    const i = await this.#store.get(actor.orgId, id);
    if (i === null) throw new AttemptError("not_found", "No such interview");
    return { ...i, link: this.link(actor.orgId, id) };
  }

  /** The interviewer changes the problem the candidate sees, or their own notes. */
  async edit(actor: Actor, id: string, patch: { readonly problem?: string | undefined; readonly notes?: string | undefined; readonly cancel?: boolean | undefined }) {
    this.#require(actor);
    const updated = await this.#store.update(actor.orgId, id, {
      ...(patch.problem === undefined ? {} : { problem: patch.problem }),
      ...(patch.notes === undefined ? {} : { notes: patch.notes }),
      ...(patch.cancel === true ? { status: "cancelled" as const } : {}),
    });
    if (updated === null) throw new AttemptError("not_found", "No such interview");
    if (patch.cancel === true) await this.#exams.recordAudit(actor, "interview.cancelled", id);
    return { ...updated, link: this.link(actor.orgId, id) };
  }

  /** The scorecard closes the interview. Each criterion 1 to 5. */
  async score(actor: Actor, id: string, card: Scorecard) {
    this.#require(actor);
    if (card.criteria.length === 0) throw new AttemptError("invalid_state", "Score at least one criterion");
    if (card.criteria.some((c) => !Number.isInteger(c.score) || c.score < 1 || c.score > 5 || c.name.trim() === "")) throw new AttemptError("invalid_state", "Each criterion has a name and a score from 1 to 5");
    const updated = await this.#store.update(actor.orgId, id, { scorecard: { ...card, summary: card.summary.trim().slice(0, 5000) }, status: "done" });
    if (updated === null) throw new AttemptError("not_found", "No such interview");
    await this.#exams.recordAudit(actor, "interview.scored", id, { recommendation: card.recommendation });
    return { ...updated, link: this.link(actor.orgId, id) };
  }

  async #open(code: string): Promise<{ orgId: ReturnType<typeof toOrgId>; interview: Interview }> {
    const [org, id, mac, ...rest] = code.trim().split(".");
    if (org === undefined || id === undefined || mac === undefined || rest.length > 0) throw new InterviewGone();
    const expected = Buffer.from(this.#mac(org, id));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new InterviewGone();
    const orgId = toOrgId(org);
    const interview = await this.#store.get(orgId, id);
    if (interview === null || interview.status === "cancelled") throw new InterviewGone();
    return { orgId, interview };
  }

  /** The room, as the candidate's link shows it: never the notes or the scorecard. */
  async room(code: string): Promise<RoomView> {
    const { interview: i } = await this.#open(code);
    return { title: i.title, candidateName: i.candidateName, interviewer: i.interviewer, scheduledAt: i.scheduledAt, minutes: i.minutes, meetingUrl: i.meetingUrl, problem: i.problem, language: i.language, code: i.code, status: i.status };
  }

  /** The candidate's code, saved as they type; closed once the interview is scored. */
  async writeCode(code: string, source: string, language: string): Promise<{ readonly savedAt: string }> {
    const { orgId, interview } = await this.#open(code);
    if (interview.status !== "scheduled") throw new AttemptError("invalid_state", "This interview has finished");
    const at = new Date(this.#now());
    await this.#store.update(orgId, interview.id, { code: source, language, codeAt: at });
    return { savedAt: at.toISOString() };
  }
}
