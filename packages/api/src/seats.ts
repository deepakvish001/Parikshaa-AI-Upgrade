import { createHmac, timingSafeEqual } from "node:crypto";
import qrcode from "qrcode-generator";
import { examId as toExamId, orgId as toOrgId, type OrgId } from "@parikshaa/core";
import { staffScope, type IdentityStore, type InvitationStore, type LedgerStore, type Seat, type SeatStore } from "@parikshaa/store";
import type { InviteCodes } from "./invite-codes.js";
import { A4, fit, Page, pdf, wrap, type Rgb } from "./pdf.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Exam day in rooms (docs/PREP-TRACKER.md, V2-12: CL24, CL25, CL32, CL33).
 * Staff list the rooms and how many seats each has; invited candidates are
 * seated in roll-number order, and each gets an admit card with their seat
 * and a code an invigilator scans at the door. The card is the candidate's
 * own to download from their link, too. Attendance is kept apart from the
 * ledger: being in the room is not an answer.
 */

export interface RoomPlan {
  readonly centre: string;
  readonly room: string;
  readonly seats: number;
}

export interface SeatRow extends Seat {
  readonly name: string;
  readonly present: boolean;
  readonly attemptState: string;
}

const BRAND: Rgb = [0.16, 0.2, 0.55];
const MUTED: Rgb = [0.42, 0.45, 0.5];
const SOFT: Rgb = [0.95, 0.96, 0.99];

/** The code on an admit card: which candidate of which exam, signed so it cannot be made up. */
export class AdmitCodes {
  readonly #key: Buffer;

  constructor(secret: string) {
    this.#key = createHmac("sha256", secret).update("parikshaa-admit-cards").digest();
  }

  #mac(orgId: string, examId: string, ref: string): string {
    return createHmac("sha256", this.#key).update(`${orgId}\n${examId}\n${ref}`).digest("base64url").slice(0, 12);
  }

  issue(orgId: string, examId: string, ref: string): string {
    return `ADM1.${Buffer.from(JSON.stringify([orgId, examId, ref])).toString("base64url")}.${this.#mac(orgId, examId, ref)}`;
  }

  verify(code: string): { orgId: string; examId: string; ref: string } | null {
    const [tag, body, mac] = code.trim().split(".");
    if (tag !== "ADM1" || body === undefined || mac === undefined) return null;
    let parts: unknown;
    try {
      parts = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    } catch {
      return null;
    }
    if (!Array.isArray(parts) || parts.length !== 3 || !parts.every((p) => typeof p === "string")) return null;
    const [orgId, examId, ref] = parts as [string, string, string];
    const expected = Buffer.from(this.#mac(orgId, examId, ref));
    const given = Buffer.from(mac);
    return given.length === expected.length && timingSafeEqual(given, expected) ? { orgId, examId, ref } : null;
  }
}

const IST = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
const byRoll = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export class SeatService {
  readonly #seats: SeatStore;
  readonly #invitations: InvitationStore;
  readonly #store: LedgerStore;
  readonly #identity: IdentityStore;
  readonly #exams: ExamService;
  readonly #codes: InviteCodes;
  readonly #admit: AdmitCodes;
  readonly #now: () => number;

  constructor(options: {
    readonly seats: SeatStore;
    readonly invitations: InvitationStore;
    readonly store: LedgerStore;
    readonly identity: IdentityStore;
    readonly exams: ExamService;
    readonly codes: InviteCodes;
    readonly secret: string;
    readonly now?: () => number;
  }) {
    this.#seats = options.seats;
    this.#invitations = options.invitations;
    this.#store = options.store;
    this.#identity = options.identity;
    this.#exams = options.exams;
    this.#codes = options.codes;
    this.#admit = new AdmitCodes(options.secret);
    this.#now = options.now ?? (() => Date.now());
  }

  async #exam(orgId: OrgId, examId: string) {
    const exam = await this.#store.loadExam(staffScope(orgId), toExamId(examId));
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${examId}`);
    return exam;
  }

  async #invited(orgId: OrgId, examId: string) {
    return (await this.#invitations.list(staffScope(orgId), examId, new Date(this.#now()))).filter((i) => !i.revoked);
  }

  /** Every invited candidate with their seat, if they have one, and whether they have been seen in the room. */
  async seats(actor: Actor, examId: string): Promise<readonly SeatRow[]> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    await this.#exam(actor.orgId, examId);
    const [invited, seats, present] = await Promise.all([this.#invited(actor.orgId, examId), this.#seats.seats(actor.orgId, examId), this.#seats.attendance(actor.orgId, examId)]);
    const seatOf = new Map(seats.map((s) => [s.ref, s]));
    const here = new Set(present.map((p) => p.ref));
    return invited
      .map((i) => {
        const s = seatOf.get(i.candidateRef);
        return { ref: i.candidateRef, name: i.name, centre: s?.centre ?? "", room: s?.room ?? "", seat: s?.seat ?? "", present: here.has(i.candidateRef), attemptState: i.attemptState };
      })
      .sort((a, b) => byRoll(a.ref, b.ref));
  }

  /**
   * Seat every invited candidate, in roll-number order, room after room.
   * Replaces any earlier seating. Refused when the rooms hold fewer seats
   * than there are candidates.
   */
  async allocate(actor: Actor, examId: string, rooms: readonly RoomPlan[]): Promise<{ readonly seated: number; readonly spare: number }> {
    if (!can(actor, "attempt:start")) throw new Forbidden("attempt:start");
    await this.#exam(actor.orgId, examId);
    const plans = rooms.map((r) => ({ centre: r.centre.trim(), room: r.room.trim(), seats: Math.floor(r.seats) })).filter((r) => r.room !== "" && r.seats > 0);
    if (plans.length === 0) throw new AttemptError("invalid_state", "Add at least one room with seats");
    const names = new Set(plans.map((r) => `${r.centre}\n${r.room}`));
    if (names.size !== plans.length) throw new AttemptError("invalid_state", "Each room is listed once per centre");
    const refs = (await this.#invited(actor.orgId, examId)).map((i) => i.candidateRef).sort(byRoll);
    const capacity = plans.reduce((n, r) => n + r.seats, 0);
    if (refs.length === 0) throw new AttemptError("invalid_state", "Invite candidates first: there is no one to seat");
    if (capacity < refs.length) throw new AttemptError("invalid_state", `The rooms hold ${capacity} but ${refs.length} candidates are invited: add ${refs.length - capacity} more seats`);
    const seats: Seat[] = [];
    let next = 0;
    for (const r of plans) {
      const width = String(r.seats).length;
      for (let n = 1; n <= r.seats && next < refs.length; n++) seats.push({ ref: refs[next++]!, centre: r.centre, room: r.room, seat: String(n).padStart(Math.max(2, width), "0") });
    }
    await this.#seats.replace(actor.orgId, examId, seats);
    await this.#exams.recordAudit(actor, "exam.seats_allocated", examId, { seated: seats.length, rooms: plans.length });
    return { seated: seats.length, spare: capacity - seats.length };
  }

  /** Admit cards for staff to print: every seated candidate's, one a page, or one candidate's. */
  async admitCards(actor: Actor, examId: string, ref: string | null): Promise<Uint8Array> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    const rows = (await this.seats(actor, examId)).filter((r) => r.room !== "" && (ref === null || r.ref === ref));
    if (rows.length === 0) throw new AttemptError(ref === null ? "invalid_state" : "not_found", ref === null ? "Seat the candidates first" : `No seat for ${ref}`);
    return this.#draw(actor.orgId, examId, rows);
  }

  /** A candidate's own admit card, from their invitation link. Null when they have no seat. */
  async admitCardFor(code: string): Promise<Uint8Array | null> {
    const named = this.#codes.verify(code);
    if (named === null) throw new AttemptError("not_found", "That link is not valid");
    const orgId = toOrgId(named.orgId);
    const invitation = await this.#invitations.get(staffScope(orgId), named.invitationId);
    if (invitation === null || invitation.revoked) throw new AttemptError("not_found", "That link is not valid");
    const seat = (await this.#seats.seats(orgId, invitation.examId)).find((s) => s.ref === invitation.candidateRef);
    if (seat === undefined) return null;
    return this.#draw(orgId, invitation.examId, [{ ...seat, name: invitation.name, present: false, attemptState: "" }]);
  }

  /** Where a candidate sits, for their invitation page; null without a seat. */
  async seatFor(orgId: OrgId, examId: string, ref: string): Promise<Seat | null> {
    return (await this.#seats.seats(orgId, examId)).find((s) => s.ref === ref) ?? null;
  }

  /**
   * Mark a candidate present, from the admit card's code or a roll number
   * typed in. Says who they are and where they should sit, and whether they
   * were marked already — a card shown twice is worth a second look.
   */
  async markPresent(actor: Actor, examId: string, scanned: string): Promise<{ readonly ref: string; readonly name: string; readonly room: string; readonly seat: string; readonly already: { readonly by: string; readonly at: string } | null }> {
    if (!can(actor, "attempt:read")) throw new Forbidden("attempt:read");
    const text = scanned.trim();
    let ref = text;
    if (text.startsWith("ADM1.")) {
      const card = this.#admit.verify(text);
      if (card === null || card.orgId !== actor.orgId) throw new AttemptError("not_found", "This admit card's code is not one of ours");
      if (card.examId !== examId) throw new AttemptError("invalid_state", "This admit card is for a different exam");
      ref = card.ref;
    }
    const row = (await this.seats(actor, examId)).find((r) => r.ref.toLowerCase() === ref.toLowerCase());
    if (row === undefined) throw new AttemptError("not_found", `${ref} is not invited to this exam`);
    const before = await this.#seats.mark(actor.orgId, examId, row.ref, actor.name, new Date(this.#now()));
    if (before === null) await this.#exams.recordAudit(actor, "exam.attendance_marked", examId, { ref: row.ref });
    return { ref: row.ref, name: row.name, room: row.room, seat: row.seat, already: before === null ? null : { by: before.markedBy, at: before.markedAt } };
  }

  async #draw(orgId: OrgId, examId: string, rows: readonly SeatRow[]): Promise<Uint8Array> {
    const [exam, org, window] = await Promise.all([this.#exam(orgId, examId), this.#identity.getOrganisation(orgId), this.#invitations.getWindow(staffScope(orgId), examId)]);
    const margin = 56;
    const right = A4.width - margin;
    const pages = rows.map((r) => {
      const page = new Page();
      page.box(0, 0, A4.width, 92, BRAND);
      page.text(margin, 28, fit(org?.name ?? "", right - margin - 110, 18, true), { size: 18, bold: true, color: [1, 1, 1] });
      page.text(margin, 54, "Admit card", { size: 11, color: [0.85, 0.88, 1] });
      page.text(right, 32, "Parikshaa", { size: 12, bold: true, color: [1, 1, 1], align: "right" });
      page.text(margin, 120, fit(exam.title, right - margin, 15, true), { size: 15, bold: true });
      let y = 154;
      const facts: [string, string][] = [
        ["Candidate", r.name || "—"],
        ["Roll number", r.ref],
        ["Opens", window === null ? "As your invitation says" : IST(window.opensAt)],
        ["Duration", `${Math.round(exam.policy.durationMs / 60_000)} minutes`],
      ];
      for (const [label, value] of facts) {
        page.text(margin, y, label, { size: 9, color: MUTED });
        page.text(margin + 100, y, fit(value, 250, 12, true), { size: 12, bold: true });
        y += 22;
      }
      // Where to sit, large enough to read across a corridor.
      page.box(margin, y + 8, right - margin, 76, SOFT);
      const cells: [string, string][] = [
        ["Centre", r.centre || "—"],
        ["Room", r.room],
        ["Seat", r.seat],
      ];
      cells.forEach(([label, value], i) => {
        const x = margin + 18 + i * 160;
        page.text(x, y + 22, label, { size: 9, color: MUTED });
        page.text(x, y + 40, fit(value, 140, 20, true), { size: 20, bold: true });
      });
      const qr = qrcode(0, "M");
      qr.addData(this.#admit.issue(orgId, examId, r.ref));
      qr.make();
      page.modules(right - 120, 140, 120, qr.getModuleCount(), (row, column) => qr.isDark(row, column));
      page.text(right - 60, 266, "Shown at the door", { size: 8, color: MUTED, align: "center" });

      y += 112;
      page.text(margin, y, "Please read", { size: 11, bold: true });
      y += 20;
      const rules = [
        "Reach the centre 30 minutes before the test opens, with this card and a photo identity card.",
        "Sit only at the seat printed above. The invigilator scans this card at the door.",
        "Phones, smart watches and notes stay outside the room unless the invigilator says otherwise.",
        "Your answers save as you go. If your computer stops, raise your hand: you lose nothing typed.",
      ];
      for (const rule of rules) {
        for (const [k, line] of wrap(rule, right - margin - 14, 10).entries()) {
          page.text(margin + (k === 0 ? 0 : 14), y, k === 0 ? `•  ${line}` : line, { size: 10 });
          y += 15;
        }
        y += 4;
      }
      page.line(margin, A4.height - 120, margin + 180, A4.height - 120, [0.5, 0.5, 0.5]);
      page.text(margin, A4.height - 112, "Candidate's signature", { size: 9, color: MUTED });
      page.line(right - 180, A4.height - 120, right, A4.height - 120, [0.5, 0.5, 0.5]);
      page.text(right - 180, A4.height - 112, "Invigilator's signature", { size: 9, color: MUTED });
      return page;
    });
    return pdf(pages, `Admit cards — ${exam.title}`);
  }
}
