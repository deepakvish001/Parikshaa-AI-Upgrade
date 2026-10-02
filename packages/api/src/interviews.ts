import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { orgId as toOrgId, type OrgId } from "@parikshaa/core";
import type { Interview, InterviewStore, OutboxDraft, OutboxItem, PanelScore, Recommendation, Scorecard } from "@parikshaa/store";
import type { Mailer } from "./delivery.js";
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
 *
 * A panel (CO41): up to eight staff, each with a scorecard of their own; the
 * interview's scorecard is the panel's average, and it closes once every
 * member has scored. A calendar invite (CO27) goes by email to the panel and
 * the candidate, and a second one if the interview is cancelled.
 */

export interface PanelMember {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly disabled: boolean;
}

const LEANING: Record<Recommendation, number> = { strong_yes: 2, yes: 1, no: -1, strong_no: -2 };

/** The panel's scorecards as one: each criterion's average, and the recommendation the panel leans to. */
export function combine(scores: readonly PanelScore[]): Scorecard | null {
  if (scores.length === 0) return null;
  if (scores.length === 1) return scores[0]!.scorecard;
  const names: string[] = [];
  const totals = new Map<string, { sum: number; n: number }>();
  for (const s of scores)
    for (const c of s.scorecard.criteria) {
      const t = totals.get(c.name) ?? (names.push(c.name), { sum: 0, n: 0 });
      totals.set(c.name, { sum: t.sum + c.score, n: t.n + 1 });
    }
  const lean = scores.reduce((sum, s) => sum + LEANING[s.scorecard.recommendation], 0) / scores.length;
  const recommendation: Recommendation = lean >= 1.5 ? "strong_yes" : lean > 0 ? "yes" : lean <= -1.5 ? "strong_no" : "no";
  return {
    criteria: names.map((name) => ({ name, score: Math.round((totals.get(name)!.sum / totals.get(name)!.n) * 10) / 10 })),
    recommendation,
    summary: scores
      .filter((s) => s.scorecard.summary.trim() !== "")
      .map((s) => `${s.name}: ${s.scorecard.summary.trim()}`)
      .join("\n\n")
      .slice(0, 5000),
  };
}

const icsText = (text: string) => text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Lines longer than 75 characters are folded, as RFC 5545 asks. */
const fold = (line: string) => line.match(/.{1,73}/gu)?.join("\r\n ") ?? "";

/** The interview as a calendar file (RFC 5545): the same UID each time, so a cancellation replaces the invite. */
export function calendar(interview: Interview, options: { readonly now: number; readonly join: string; readonly forCandidate: boolean }): string {
  const end = new Date(Date.parse(interview.scheduledAt) + interview.minutes * 60_000).toISOString();
  const cancelled = interview.status === "cancelled";
  const description = [
    options.forCandidate ? `Your interview with ${interview.interviewer}.` : `Interview with ${interview.candidateName}.`,
    `Video call: ${interview.meetingUrl}`,
    options.forCandidate ? `Interview room (code editor): ${options.join}` : `Candidate's room: ${options.join}`,
  ].join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Parikshaa//Interviews//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:interview-${interview.id}@parikshaa`,
    `SEQUENCE:${cancelled ? 1 : 0}`,
    `DTSTAMP:${icsTime(new Date(options.now).toISOString())}`,
    `DTSTART:${icsTime(interview.scheduledAt)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(cancelled ? `Cancelled: ${interview.title}` : interview.title)}`,
    `DESCRIPTION:${icsText(description)}`,
    `LOCATION:${icsText(interview.meetingUrl)}`,
    `URL:${options.forCandidate ? options.join : interview.meetingUrl}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(interview.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const when = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "full", timeStyle: "short" }).format(new Date(iso));

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
  readonly #staff: (orgId: OrgId) => Promise<readonly PanelMember[]>;
  readonly #mailer: Mailer | null;
  readonly #enqueue: ((orgId: OrgId, drafts: readonly OutboxDraft[]) => Promise<readonly string[]>) | null;

  constructor(options: {
    readonly store: InterviewStore;
    readonly exams: ExamService;
    readonly secret: string;
    readonly publicUrl: string;
    readonly now?: () => number;
    readonly newId?: () => string;
    /** The organisation's staff, to name a panel and send its invites. */
    readonly staff?: (orgId: OrgId) => Promise<readonly PanelMember[]>;
    readonly mailer?: Mailer | null;
    readonly enqueue?: (orgId: OrgId, drafts: readonly OutboxDraft[]) => Promise<readonly string[]>;
  }) {
    this.#staff = options.staff ?? (async () => []);
    this.#mailer = options.mailer ?? null;
    this.#enqueue = options.enqueue ?? null;
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
      /** Other staff on the panel, by id. */
      readonly panel?: readonly string[] | undefined;
    },
  ) {
    this.#require(actor);
    const at = Date.parse(request.scheduledAt);
    if (Number.isNaN(at)) throw new AttemptError("invalid_state", "Not a date and time");
    const meeting = request.meetingUrl?.trim() ?? "";
    if (meeting !== "" && !/^https:\/\/[^\s]+$/.test(meeting)) throw new AttemptError("invalid_state", "The video call link must start with https://");
    const others = [...new Set(request.panel ?? [])].filter((p) => p !== actor.id);
    if (others.length > 7) throw new AttemptError("invalid_state", "A panel has at most eight people");
    if (others.length > 0) {
      const active = new Set((await this.#staff(actor.orgId)).filter((u) => !u.disabled).map((u) => u.id));
      if (others.some((p) => !active.has(p))) throw new AttemptError("invalid_state", "Someone on the panel is not on your staff");
    }
    const id = this.#newId();
    const interview = await this.#store.create(actor.orgId, {
      panel: [...(actor.kind === "user" ? [actor.id] : []), ...others],
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
    await this.#exams.recordAudit(actor, "interview.scheduled", id, { candidate: interview.candidateRef || interview.candidateName, at: interview.scheduledAt, panel: interview.panel.length });
    await this.#queueInvites(actor.orgId, interview, "invite");
    return (await this.#view(actor.orgId, [interview]))[0]!;
  }

  /** A calendar invite to each person on the panel and the candidate, if this server sends email. */
  async #queueInvites(orgId: OrgId, interview: Interview, purpose: "invite" | "cancel") {
    if (this.#enqueue === null || this.#mailer === null) return;
    const to = [...interview.panel, ...(interview.candidateEmail === null ? [] : ["candidate"])];
    if (to.length === 0) return;
    await this.#enqueue(
      orgId,
      to.map((who) => ({ kind: "interview" as const, purpose, id: `interview:${interview.id}:${who}:${purpose}`, subject: { interviewId: interview.id, to: who }, sendAfter: new Date(this.#now()) })),
    );
  }

  /** With the candidate's link, and the panel by name with who has scored. */
  async #view(orgId: OrgId, interviews: readonly Interview[]) {
    const [scores, staff] = await Promise.all([this.#store.scores(orgId, interviews.map((i) => i.id)), interviews.some((i) => i.panel.length > 0) ? this.#staff(orgId) : Promise.resolve([])]);
    const names = new Map(staff.map((u) => [u.id, u.name]));
    return interviews.map((i) => {
      const cards = [...(scores.get(i.id) ?? [])].sort((a, b) => i.panel.indexOf(a.userId) - i.panel.indexOf(b.userId));
      return {
        ...i,
        link: this.link(orgId, i.id),
        panel: i.panel.map((userId) => ({ userId, name: names.get(userId) ?? cards.find((c) => c.userId === userId)?.name ?? "Former staff", scored: cards.some((c) => c.userId === userId) })),
        scores: cards,
      };
    });
  }

  async list(actor: Actor) {
    this.#require(actor);
    return this.#view(actor.orgId, await this.#store.list(actor.orgId));
  }

  async get(actor: Actor, id: string) {
    this.#require(actor);
    const i = await this.#store.get(actor.orgId, id);
    if (i === null) throw new AttemptError("not_found", "No such interview");
    return (await this.#view(actor.orgId, [i]))[0]!;
  }

  /** The calendar file for staff to add it themselves. */
  async calendarFile(actor: Actor, id: string): Promise<string> {
    this.#require(actor);
    const i = await this.#store.get(actor.orgId, id);
    if (i === null) throw new AttemptError("not_found", "No such interview");
    return calendar(i, { now: this.#now(), join: this.link(actor.orgId, id), forCandidate: false });
  }

  /** The outbox handler for `interview` items: the invite or its cancellation, written when it is sent. */
  async deliver(item: OutboxItem): Promise<"sent" | { readonly skip: string }> {
    const orgId = toOrgId(item.orgId);
    const interview = await this.#store.get(orgId, String(item.subject["interviewId"] ?? ""));
    if (interview === null) return { skip: "The interview was removed" };
    if (item.purpose === "invite" && interview.status === "cancelled") return { skip: "The interview was cancelled" };
    if (item.purpose === "invite" && Date.parse(interview.scheduledAt) < this.#now()) return { skip: "The interview has passed" };
    if (this.#mailer === null) return { skip: "This server does not send email" };
    const who = String(item.subject["to"] ?? "");
    const forCandidate = who === "candidate";
    const member = forCandidate ? null : ((await this.#staff(orgId)).find((u) => u.id === who) ?? null);
    const email = forCandidate ? interview.candidateEmail : member !== null && !member.disabled ? member.email : null;
    if (email === null) return { skip: "No email for this person" };
    const join = this.link(orgId, interview.id);
    const cancelled = item.purpose === "cancel";
    const name = forCandidate ? interview.candidateName : (member?.name ?? "");
    const lines = cancelled
      ? [`Hello ${name},`, "", `${interview.title} on ${when(interview.scheduledAt)} has been cancelled.`]
      : [
          `Hello ${name},`,
          "",
          forCandidate ? `Your interview, ${interview.title}, is on ${when(interview.scheduledAt)} (${interview.minutes} minutes).` : `You are on the panel for ${interview.title} with ${interview.candidateName}, on ${when(interview.scheduledAt)} (${interview.minutes} minutes).`,
          "",
          `Video call: ${interview.meetingUrl}`,
          forCandidate ? `Interview room, where you will write code: ${join}` : "Score it in the console under Interviews when it is done.",
          "",
          "The calendar file attached adds it to your calendar.",
        ];
    await this.#mailer.send({
      to: email,
      subject: cancelled ? `Cancelled: ${interview.title}` : `Interview: ${interview.title} — ${when(interview.scheduledAt)}`,
      text: lines.join("\n"),
      html: lines.map((l) => (l === "" ? "" : `<p>${escape(l)}</p>`)).join(""),
      attachments: [{ filename: "interview.ics", content: new TextEncoder().encode(calendar({ ...interview, status: cancelled ? "cancelled" : interview.status }, { now: this.#now(), join, forCandidate })), contentType: `text/calendar; charset=utf-8; method=${cancelled ? "CANCEL" : "PUBLISH"}` }],
    });
    return "sent";
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
    if (patch.cancel === true) {
      await this.#exams.recordAudit(actor, "interview.cancelled", id);
      await this.#queueInvites(actor.orgId, updated, "cancel");
    }
    return (await this.#view(actor.orgId, [updated]))[0]!;
  }

  /**
   * A scorecard, each criterion 1 to 5. On a panel, each member scores for
   * themselves (a second card replaces their first); the interview's card is
   * the average, and it closes once everyone on the panel has scored.
   */
  async score(actor: Actor, id: string, card: Scorecard) {
    this.#require(actor);
    if (card.criteria.length === 0) throw new AttemptError("invalid_state", "Score at least one criterion");
    if (card.criteria.some((c) => !Number.isInteger(c.score) || c.score < 1 || c.score > 5 || c.name.trim() === "")) throw new AttemptError("invalid_state", "Each criterion has a name and a score from 1 to 5");
    const interview = await this.#store.get(actor.orgId, id);
    if (interview === null) throw new AttemptError("not_found", "No such interview");
    if (interview.status === "cancelled") throw new AttemptError("invalid_state", "This interview was cancelled");
    if (interview.panel.length > 0 && !interview.panel.includes(actor.id)) throw new AttemptError("invalid_state", "Only the interview's panel scores it");
    const mine = { ...card, summary: card.summary.trim().slice(0, 5000) };
    await this.#store.putScore(actor.orgId, id, { userId: actor.id, name: actor.name, scorecard: mine, scoredAt: new Date(this.#now()).toISOString() });
    const order = (userId: string) => interview.panel.indexOf(userId);
    const cards = [...((await this.#store.scores(actor.orgId, [id])).get(id) ?? [])].sort((a, b) => order(a.userId) - order(b.userId));
    const everyone = interview.panel.every((p) => cards.some((c) => c.userId === p));
    const combined = interview.panel.length === 0 ? mine : combine(cards)!;
    const updated = await this.#store.update(actor.orgId, id, { scorecard: combined, ...(everyone ? { status: "done" as const } : {}) });
    await this.#exams.recordAudit(actor, "interview.scored", id, { recommendation: card.recommendation, ...(interview.panel.length > 1 ? { panel: `${cards.length} of ${interview.panel.length}` } : {}) });
    return (await this.#view(actor.orgId, [updated!]))[0]!;
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
