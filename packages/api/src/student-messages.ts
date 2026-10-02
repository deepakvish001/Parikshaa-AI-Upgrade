import { orgId as toOrgId, type OrgId } from "@parikshaa/core";
import { eligible, type Drive, type IdentityStore, type OutboxDraft, type OutboxItem, type PlacementStore } from "@parikshaa/store";
import type { Mailer, WhatsAppSender } from "./delivery.js";

/**
 * Messages to students on the student list (docs/PREP-TRACKER.md, CO42 and
 * CL67): an offer, with the link to answer it, and a drive the student is
 * eligible for, with the link to apply. They go to the email and phone the
 * college holds — sealed at rest — so the outbox carries only the drive, the
 * roll number and the channel, and the message is written when it is sent:
 * an offer replaced or answered by then, or a drive closed, is not sent.
 */

export type StudentChannel = "email" | "whatsapp";

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const date = (day: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(`${day}T00:00:00+05:30`));

export class StudentMessages {
  readonly #placement: PlacementStore;
  readonly #identity: IdentityStore;
  readonly #mailer: Mailer | null;
  readonly #whatsapp: WhatsAppSender | null;
  readonly #enqueue: (orgId: OrgId, drafts: readonly OutboxDraft[]) => Promise<readonly string[]>;
  readonly #offerLink: (orgId: string, code: string) => string;
  readonly #applyLink: (orgId: string, code: string) => string;
  readonly #now: () => number;

  constructor(options: {
    readonly placement: PlacementStore;
    readonly identity: IdentityStore;
    readonly mailer: Mailer | null;
    readonly whatsapp: WhatsAppSender | null;
    readonly enqueue: (orgId: OrgId, drafts: readonly OutboxDraft[]) => Promise<readonly string[]>;
    readonly offerLink: (orgId: string, code: string) => string;
    readonly applyLink: (orgId: string, code: string) => string;
    readonly now?: () => number;
  }) {
    this.#placement = options.placement;
    this.#identity = options.identity;
    this.#mailer = options.mailer;
    this.#whatsapp = options.whatsapp;
    this.#enqueue = options.enqueue;
    this.#offerLink = options.offerLink;
    this.#applyLink = options.applyLink;
    this.#now = options.now ?? (() => Date.now());
  }

  /** The ways this server can reach a student. */
  channels(): readonly StudentChannel[] {
    return [...(this.#mailer === null ? [] : (["email"] as const)), ...(this.#whatsapp === null ? [] : (["whatsapp"] as const))];
  }

  #draft(purpose: "offer" | "drive_alert", id: string, subject: Record<string, unknown>): OutboxDraft {
    return { kind: "student", purpose, id, subject, sendAfter: new Date(this.#now()) };
  }

  /** An offer, by every channel the student can be reached on. Returns the channels queued. */
  async queueOffer(orgId: OrgId, driveId: string, student: { readonly ref: string; readonly email: string | null; readonly phone: string | null }, code: string): Promise<readonly StudentChannel[]> {
    const channels = this.channels().filter((c) => (c === "email" ? student.email !== null : student.phone !== null));
    await this.#enqueue(
      orgId,
      channels.map((channel) => this.#draft("offer", `offer:${code}:${channel}`, { driveId, ref: student.ref, code, channel })),
    );
    return channels;
  }

  /**
   * A drive, to every eligible student not in it yet who can be reached.
   * Each student hears of a drive once, however often this is asked.
   */
  async queueDriveAlert(orgId: OrgId, drive: Drive): Promise<{ readonly queued: number; readonly already: number; readonly unreachable: number }> {
    const [students, applications] = await Promise.all([this.#placement.students(orgId), this.#placement.applications(orgId, drive.id)]);
    const inDrive = new Set(applications.map((a) => a.ref));
    const channels = this.channels();
    let unreachable = 0;
    const drafts: OutboxDraft[] = [];
    const reached: string[][] = [];
    for (const s of students) {
      if (inDrive.has(s.ref) || !eligible(s, drive.eligibility)) continue;
      const ways = channels.filter((c) => (c === "email" ? s.email !== null : s.phone !== null));
      if (ways.length === 0) {
        unreachable++;
        continue;
      }
      const ids = ways.map((channel) => `drive:${drive.id}:${s.ref}:${channel}`);
      ways.forEach((channel, i) => drafts.push(this.#draft("drive_alert", ids[i]!, { driveId: drive.id, ref: s.ref, channel })));
      reached.push(ids);
    }
    const written = new Set(drafts.length === 0 ? [] : await this.#enqueue(orgId, drafts));
    const queued = reached.filter((ids) => ids.some((id) => written.has(id))).length;
    return { queued, already: reached.length - queued, unreachable };
  }

  /** The outbox handler for `student` items: writes and sends the message, or says why not. */
  async deliver(item: OutboxItem): Promise<"sent" | { readonly skip: string }> {
    const orgId = toOrgId(item.orgId);
    const driveId = String(item.subject["driveId"] ?? "");
    const ref = String(item.subject["ref"] ?? "");
    const channel = item.subject["channel"] === "whatsapp" ? "whatsapp" : "email";
    const drive = await this.#placement.drive(orgId, driveId);
    if (drive === null) return { skip: "The drive was removed" };
    const institution = (await this.#identity.getOrganisation(orgId))?.name ?? "";

    if (item.purpose === "offer") {
      const application = (await this.#placement.applications(orgId, driveId)).find((a) => a.ref === ref);
      const offer = application?.offer;
      if (application === undefined || offer === undefined || offer.code !== item.subject["code"]) return { skip: "The offer was replaced" };
      if (application.stage !== "offered" || offer.response !== null) return { skip: "The offer was answered or withdrawn" };
      const link = this.#offerLink(orgId, offer.code);
      const name = application.name.trim() === "" ? "there" : application.name.trim();
      const pay = application.offerLpa === null ? "" : `₹${application.offerLpa} lakh a year`;
      if (channel === "whatsapp") {
        if (this.#whatsapp === null || application.phone === null) return { skip: "No WhatsApp for this student" };
        await this.#whatsapp.send({ to: application.phone, template: "offer", parameters: [name, drive.company, drive.role, pay === "" ? "-" : pay, link] });
        return "sent";
      }
      if (this.#mailer === null || application.email === null) return { skip: "No email for this student" };
      const lines = [
        `Hello ${name},`,
        `${drive.company} has made you an offer for the role of ${drive.role}${pay === "" ? "" : `, at ${pay}`}.`,
        ...(offer.joiningDate === null ? [] : [`Joining: ${date(offer.joiningDate)}.`]),
        ...(offer.note === "" ? [] : [offer.note]),
        `See it, and accept or decline it, here (you can answer once): ${link}`,
        institution === "" ? "" : `Sent through ${institution}.`,
      ].filter((l) => l !== "");
      await this.#mailer.send({
        to: application.email,
        subject: `Your offer from ${drive.company}: ${drive.role}`,
        text: lines.join("\n\n"),
        html: lines.map((l) => `<p>${escape(l).replace(escape(link), `<a href="${escape(link)}">${escape(link)}</a>`)}</p>`).join(""),
      });
      return "sent";
    }

    if (item.purpose === "drive_alert") {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(this.#now()));
      if (drive.status === "closed" || (drive.applyBy !== null && drive.applyBy < today)) return { skip: "The drive has closed" };
      if (drive.applyCode === null) return { skip: "The drive's link to apply was closed" };
      if ((await this.#placement.applications(orgId, driveId)).some((a) => a.ref === ref)) return { skip: "Already in the drive" };
      const student = (await this.#placement.students(orgId)).find((s) => s.ref === ref);
      if (student === undefined) return { skip: "No longer on the student list" };
      const link = this.#applyLink(orgId, drive.applyCode);
      const name = student.name.trim() === "" ? "there" : student.name.trim();
      const by = drive.applyBy === null ? "soon" : date(drive.applyBy);
      if (channel === "whatsapp") {
        if (this.#whatsapp === null || student.phone === null) return { skip: "No WhatsApp for this student" };
        await this.#whatsapp.send({ to: student.phone, template: "drive", parameters: [name, drive.company, drive.role, institution === "" ? "-" : institution, by, link] });
        return "sent";
      }
      if (this.#mailer === null || student.email === null) return { skip: "No email for this student" };
      const lines = [
        `Hello ${name},`,
        `${drive.company} is hiring for ${drive.role}${drive.ctcLpa === null ? "" : ` (₹${drive.ctcLpa} lakh a year)`}${drive.location === "" ? "" : `, ${drive.location}`}, and you meet its criteria.`,
        `Apply by ${by} with your roll number and the email the college has: ${link}`,
        institution === "" ? "" : `From the placement cell, ${institution}.`,
      ].filter((l) => l !== "");
      await this.#mailer.send({
        to: student.email,
        subject: `New drive: ${drive.company} — ${drive.role}`,
        text: lines.join("\n\n"),
        html: lines.map((l) => `<p>${escape(l).replace(escape(link), `<a href="${escape(link)}">${escape(link)}</a>`)}</p>`).join(""),
      });
      return "sent";
    }
    return { skip: `Unknown purpose ${item.purpose}` };
  }
}
