import { createHmac, timingSafeEqual } from "node:crypto";
import qrcode from "qrcode-generator";
import {
  attemptId as toAttemptId,
  decodeCodeAnswer,
  examId as toExamId,
  foldAttempt,
  paperOf,
  resultOf,
  type AttemptId,
  type Exam,
  type OrgId,
} from "@parikshaa/core";
import { staffScope, type IdentityStore, type InvitationStore, type LedgerStore, type Recheck, type RecheckStore } from "@parikshaa/store";
import { A4, fit, Page, pdf, textWidth, type Rgb } from "./pdf.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * After results (docs/PILOT.md, "After"): what a candidate sees of their own
 * result once their institution releases it, the recheck they may ask for,
 * the person who answers it, and the scorecard — a PDF anyone can check
 * through the code printed on it.
 *
 * A changed mark is a `score_revised` entry in the attempt's ledger, written
 * by {@link ExamService.reviseScore}: the receipt the candidate holds shows it,
 * and every total and export follows from it. The request and its answer are
 * kept beside the ledger, not in it: they are a conversation, not the record.
 */

/** Days after results are released in which a candidate may ask for a recheck. */
export const RECHECK_DAYS = 7;
/** Questions one candidate may ask about. */
export const RECHECK_LIMIT = 3;

export class RecheckError extends Error {
  constructor(
    readonly code: "not_released" | "not_graded" | "closed" | "already_asked" | "too_many" | "not_on_paper",
    message: string,
  ) {
    super(message);
    this.name = "RecheckError";
  }
}

export interface CandidateResultView {
  readonly released: true;
  readonly title: string;
  readonly institution: string;
  readonly total: number;
  readonly maxTotal: number;
  readonly percent: number;
  /** Whether they reached the qualifying mark, when the institution chose to say. */
  readonly outcome: "qualified" | "failed" | null;
  readonly questions: readonly { readonly id: string; readonly number: number; readonly stem: string; readonly score: number; readonly max: number }[];
  readonly rechecks: readonly {
    readonly id: string;
    readonly questionId: string;
    readonly reason: string;
    readonly status: Recheck["status"];
    readonly scoreBefore: number | null;
    readonly scoreAfter: number | null;
    readonly reply: string | null;
    readonly decidedAt: string | null;
  }[];
  /** Until when a recheck may be asked for; null once the time or the limit is used up. */
  readonly recheckUntil: string | null;
}

/** A request as staff see it: whose, about what, and what they wrote. */
export interface RecheckForStaff extends Recheck {
  readonly candidate: { readonly ref: string; readonly name: string };
  readonly question: { readonly number: number; readonly stem: string; readonly kind: string; readonly max: number };
  readonly answer: string | null;
  /** The mark as it stands now. */
  readonly score: number;
}

/** What a scorecard's code proves, as the verification page shows it. */
export type ScorecardCheck =
  | {
      readonly valid: true;
      readonly institution: string;
      readonly candidate: { readonly name: string; readonly ref: string };
      readonly title: string;
      readonly total: number;
      readonly maxTotal: number;
      readonly percent: number;
      readonly outcome: "qualified" | "failed" | null;
      readonly sittingDate: string;
      readonly record: string;
    }
  | { readonly valid: false; readonly reason: "unknown" | "withdrawn" };

/**
 * Scorecard codes: `org.attempt.mac`, stored nowhere, like invitation codes.
 * The MAC proves Parikshaa issued it; what it shows is read when it is checked,
 * so a result set aside since reads as withdrawn.
 */
export class ScorecardCodes {
  readonly #key: Buffer;

  constructor(secret: string) {
    this.#key = createHmac("sha256", secret).update("parikshaa-scorecards").digest();
  }

  #mac(orgId: string, attemptId: string): string {
    return createHmac("sha256", this.#key).update(`${orgId}.${attemptId}`).digest("base64url").slice(0, 16);
  }

  issue(orgId: string, attemptId: string): string {
    return `${orgId}.${attemptId}.${this.#mac(orgId, attemptId)}`;
  }

  verify(code: string): { orgId: string; attemptId: string } | null {
    const parts = code.trim().split(".");
    if (parts.length !== 3) return null;
    const [orgId, attemptId, mac] = parts as [string, string, string];
    const expected = Buffer.from(this.#mac(orgId, attemptId));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    return { orgId, attemptId };
  }
}

const IST = (ms: number, style: "date" | "full" = "date") =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", ...(style === "full" ? { timeStyle: "short" } : {}) }).format(new Date(ms));
const round = (n: number) => Math.round(n * 100) / 100;
const plain = (stem: string) => stem.replace(/[#*_`>|]/g, "").replace(/\s+/g, " ").trim();

interface Graded {
  readonly exam: Exam;
  readonly paper: Exam;
  readonly result: NonNullable<ReturnType<typeof resultOf>>;
  readonly entries: Awaited<ReturnType<LedgerStore["load"]>>;
}

export class RecheckService {
  readonly #store: LedgerStore;
  readonly #rechecks: RecheckStore;
  readonly #invitations: InvitationStore;
  readonly #identity: IdentityStore;
  readonly #exams: ExamService;
  readonly #codes: ScorecardCodes;
  readonly #publicUrl: string;
  readonly #now: () => number;

  constructor(options: {
    readonly store: LedgerStore;
    readonly rechecks: RecheckStore;
    readonly invitations: InvitationStore;
    readonly identity: IdentityStore;
    readonly exams: ExamService;
    readonly secret: string;
    readonly publicUrl: string;
    readonly now?: () => number;
  }) {
    this.#store = options.store;
    this.#rechecks = options.rechecks;
    this.#invitations = options.invitations;
    this.#identity = options.identity;
    this.#exams = options.exams;
    this.#codes = new ScorecardCodes(options.secret);
    this.#publicUrl = options.publicUrl.replace(/\/+$/, "");
    this.#now = options.now ?? (() => Date.now());
  }

  async #graded(orgId: OrgId, attemptId: AttemptId, examId: string): Promise<Graded | null> {
    const scope = staffScope(orgId);
    const exam = await this.#store.loadExam(scope, toExamId(examId));
    if (exam === null) return null;
    const entries = await this.#store.load(scope, attemptId);
    const result = resultOf(entries, exam);
    if (result === null || result.state !== "graded" || result.total === null || result.percent === null) return null;
    const first = entries[0]!.event;
    const paper = paperOf(exam, first.type === "attempt_started" ? first.questionIds : undefined);
    return { exam, paper, result, entries };
  }

  // --- the candidate's side ---------------------------------------------------

  /** A candidate's own result, once released; `{ released: false }` until then. */
  async mine(orgId: OrgId, attemptId: AttemptId, examId: string): Promise<CandidateResultView | { readonly released: false }> {
    const release = await this.#rechecks.released(orgId, examId, attemptId);
    if (release === null) return { released: false };
    const graded = await this.#graded(orgId, attemptId, examId);
    if (graded === null) return { released: false };
    const { paper, result } = graded;
    const [org, asked] = await Promise.all([this.#identity.getOrganisation(orgId), this.#rechecks.mine(orgId, attemptId)]);
    const until = Date.parse(release.releasedAt) + RECHECK_DAYS * 86_400_000;
    const open = this.#now() < until && asked.length < RECHECK_LIMIT;
    return {
      released: true,
      title: graded.exam.title,
      institution: org?.name ?? "",
      total: round(result.total!),
      maxTotal: round(result.maxTotal),
      percent: result.percent!,
      outcome: release.outcome ? result.outcome : null,
      questions: paper.questions.map((q, i) => ({ id: q.id, number: i + 1, stem: plain(q.stem).slice(0, 160), score: round(result.scores[q.id]?.score ?? 0), max: q.maxScore })),
      rechecks: asked.map((r) => ({
        id: r.id,
        questionId: r.questionId,
        reason: r.reason,
        status: r.status,
        scoreBefore: r.scoreBefore,
        scoreAfter: r.scoreAfter,
        reply: r.reply,
        decidedAt: r.decidedAt,
      })),
      recheckUntil: open ? new Date(until).toISOString() : null,
    };
  }

  /** Ask for one question to be looked at again, saying why. */
  async ask(orgId: OrgId, attemptId: AttemptId, examId: string, questionId: string, reason: string): Promise<Recheck> {
    const release = await this.#rechecks.released(orgId, examId, attemptId);
    if (release === null) throw new RecheckError("not_released", "Results for this test are not released yet");
    const graded = await this.#graded(orgId, attemptId, examId);
    if (graded === null) throw new RecheckError("not_graded", "This attempt has no result to recheck");
    if (this.#now() >= Date.parse(release.releasedAt) + RECHECK_DAYS * 86_400_000) {
      throw new RecheckError("closed", `Rechecks could be asked for within ${RECHECK_DAYS} days of the results`);
    }
    if (!graded.paper.questions.some((q) => q.id === questionId)) throw new RecheckError("not_on_paper", "That question was not on your paper");
    const asked = await this.#rechecks.ask(orgId, attemptId, examId, questionId, reason.trim(), new Date(this.#now()), RECHECK_LIMIT);
    if (!asked.ok) {
      throw asked.reason === "already_asked"
        ? new RecheckError("already_asked", "You have already asked about this question")
        : new RecheckError("too_many", `You can ask about up to ${RECHECK_LIMIT} questions`);
    }
    return asked.recheck;
  }

  // --- the institution's side ---------------------------------------------------

  /** An exam's requests, with the answer each is about. */
  async forExam(actor: Actor, examId: string): Promise<readonly RecheckForStaff[]> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const scope = staffScope(actor.orgId);
    const exam = await this.#store.loadExam(scope, toExamId(examId));
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${examId}`);
    const requests = await this.#rechecks.forExam(actor.orgId, examId);
    const invited = new Map((await this.#invitations.list(scope, examId)).filter((i) => i.attemptId !== null).map((i) => [i.attemptId!, i]));
    const ledgers = new Map<string, Awaited<ReturnType<LedgerStore["load"]>>>();
    const out: RecheckForStaff[] = [];
    for (const r of requests) {
      if (!ledgers.has(r.attemptId)) ledgers.set(r.attemptId, await this.#store.load(scope, toAttemptId(r.attemptId)));
      const entries = ledgers.get(r.attemptId)!;
      const first = entries[0]?.event;
      const paper = paperOf(exam, first?.type === "attempt_started" ? first.questionIds : undefined);
      const index = paper.questions.findIndex((q) => q.id === r.questionId);
      const question = paper.questions[index];
      const folded = foldAttempt(entries, { exam: paper });
      const projection = folded.ok ? folded.projection : null;
      const raw = projection?.attempt.responses.find((x) => x.questionId === r.questionId)?.answer ?? null;
      const code = raw === null || question?.kind !== "code" ? null : decodeCodeAnswer(raw, question);
      const invitation = invited.get(r.attemptId);
      out.push({
        ...r,
        candidate: { ref: invitation?.candidateRef ?? "", name: invitation?.name ?? "" },
        question: { number: index + 1, stem: question === undefined ? "" : plain(question.stem), kind: question?.kind ?? "", max: question?.maxScore ?? 0 },
        answer: code === null ? raw : code.source,
        score: projection?.scores.get(r.questionId as never) ?? 0,
      });
    }
    return out;
  }

  /**
   * Answer a request: with a new mark, which the ledger records, or the same
   * one; either way with a reply the candidate reads.
   */
  async answer(actor: Actor, id: string, answer: { readonly score: number; readonly reply: string }): Promise<Recheck> {
    if (!can(actor, "attempt:grade")) throw new Forbidden("attempt:grade");
    const reply = answer.reply.trim();
    if (reply === "") throw new AttemptError("invalid_state", "Write the candidate a reply: what was looked at, and why the mark stands or changes");
    const request = await this.#rechecks.get(actor.orgId, id);
    if (request === null) throw new AttemptError("not_found", "No such request");
    if (request.status !== "open") throw new AttemptError("invalid_state", "This request has been answered");
    const attempt = toAttemptId(request.attemptId);
    const graded = await this.#graded(actor.orgId, attempt, request.examId);
    if (graded === null) throw new AttemptError("invalid_state", "This attempt is no longer graded");
    const before = graded.result.scores[request.questionId]?.score ?? 0;
    const changed = answer.score !== before;
    if (changed) await this.#exams.reviseScore(actor, attempt, request.questionId, answer.score, `Recheck: ${reply}`);
    const saved = await this.#rechecks.answer(
      actor.orgId,
      id,
      { status: changed ? "changed" : "unchanged", scoreBefore: before, scoreAfter: answer.score, reply, decidedBy: actor.name },
      new Date(this.#now()),
    );
    if (saved === null) throw new AttemptError("invalid_state", "This request was answered meanwhile");
    await this.#exams.recordAudit(actor, "recheck.answered", request.attemptId, { questionId: request.questionId, from: before, to: answer.score });
    const invitation = await this.#invitations.byAttempt(staffScope(actor.orgId), request.attemptId);
    if (invitation?.email != null) {
      await this.#invitations.enqueue(staffScope(actor.orgId), [
        { kind: "email", purpose: "recheck", subject: { invitationId: invitation.id, recheckId: id }, id: `recheck:${id}`, sendAfter: new Date(this.#now()) },
      ]);
    }
    return saved;
  }

  /** What the message about an answered request says, read when it is sent. */
  async note(orgId: OrgId, recheckId: string): Promise<{ readonly number: number; readonly status: "changed" | "unchanged"; readonly before: number; readonly after: number; readonly reply: string } | null> {
    const r = await this.#rechecks.get(orgId, recheckId);
    if (r === null || r.status === "open") return null;
    const exam = await this.#store.loadExam(staffScope(orgId), toExamId(r.examId));
    if (exam === null) return null;
    const first = (await this.#store.load(staffScope(orgId), toAttemptId(r.attemptId)))[0]?.event;
    const paper = paperOf(exam, first?.type === "attempt_started" ? first.questionIds : undefined);
    return { number: paper.questions.findIndex((q) => q.id === r.questionId) + 1, status: r.status, before: r.scoreBefore ?? 0, after: r.scoreAfter ?? 0, reply: r.reply ?? "" };
  }

  /** Open requests per exam, for the console. */
  openCounts(actor: Actor): Promise<Readonly<Record<string, number>>> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    return this.#rechecks.openCounts(actor.orgId);
  }

  // --- the scorecard --------------------------------------------------------

  /** The scorecard PDF of a graded, released attempt, for the candidate. */
  async scorecard(orgId: OrgId, attemptId: AttemptId, examId: string): Promise<Uint8Array | null> {
    const release = await this.#rechecks.released(orgId, examId, attemptId);
    if (release === null) return null;
    return this.#scorecard(orgId, attemptId, examId, release.outcome);
  }

  /** The same PDF for staff, released or not. */
  async scorecardForStaff(actor: Actor, attemptId: AttemptId): Promise<Uint8Array> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const examId = await this.#examOf(actor.orgId, attemptId);
    if (examId === null) throw new AttemptError("not_found", "No such attempt");
    const release = await this.#rechecks.released(actor.orgId, examId);
    const made = await this.#scorecard(actor.orgId, attemptId, examId, release?.outcome ?? true);
    if (made === null) throw new AttemptError("invalid_state", "Only a graded attempt has a scorecard");
    return made;
  }

  /** The exam an attempt was sat for, from its first entry. */
  async #examOf(orgId: OrgId, attemptId: AttemptId): Promise<string | null> {
    const first = (await this.#store.load(staffScope(orgId), attemptId))[0]?.event;
    return first?.type === "attempt_started" ? first.examId : null;
  }

  async #scorecard(orgId: OrgId, attemptId: AttemptId, examId: string, showOutcome: boolean): Promise<Uint8Array | null> {
    const graded = await this.#graded(orgId, attemptId, examId);
    if (graded === null) return null;
    const { exam, paper, result, entries } = graded;
    const [org, invitation] = await Promise.all([this.#identity.getOrganisation(orgId), this.#invitations.byAttempt(staffScope(orgId), attemptId)]);
    const head = entries.at(-1)?.hash ?? "";
    const verifyUrl = `${this.#publicUrl}/?scorecard=${encodeURIComponent(this.#codes.issue(orgId, attemptId))}`;
    const revised = entries.some((e) => e.event.type === "score_revised");
    return drawScorecard({
      institution: org?.name ?? "",
      name: invitation?.name ?? "",
      ref: invitation?.candidateRef ?? result.candidateId,
      title: exam.title,
      sat: result.startedAt,
      total: round(result.total!),
      maxTotal: round(result.maxTotal),
      percent: result.percent!,
      outcome: showOutcome ? result.outcome : null,
      sections: result.sections.map((s) => ({ title: s.title, score: s.score ?? 0, max: s.max })),
      questions: paper.questions.map((q, i) => ({ number: i + 1, stem: plain(q.stem), score: round(result.scores[q.id]?.score ?? 0), max: q.maxScore })),
      revised,
      head,
      verifyUrl,
      issued: this.#now(),
    });
  }

  /** What a scorecard's code proves, checked now. */
  async check(code: string): Promise<ScorecardCheck> {
    const named = this.#codes.verify(code);
    if (named === null) return { valid: false, reason: "unknown" };
    const orgId = named.orgId as OrgId;
    const attemptId = toAttemptId(named.attemptId);
    const examId = await this.#examOf(orgId, attemptId);
    if (examId === null) return { valid: false, reason: "unknown" };
    const invitation = await this.#invitations.byAttempt(staffScope(orgId), attemptId);
    const graded = await this.#graded(orgId, attemptId, examId);
    // Set aside, erased or regraded away since: the scorecard no longer stands.
    if (graded === null) return { valid: false, reason: "withdrawn" };
    const release = await this.#rechecks.released(orgId, examId);
    const org = await this.#identity.getOrganisation(orgId);
    return {
      valid: true,
      institution: org?.name ?? "",
      candidate: { name: invitation?.name ?? "", ref: invitation?.candidateRef ?? graded.result.candidateId },
      title: graded.exam.title,
      total: round(graded.result.total!),
      maxTotal: round(graded.result.maxTotal),
      percent: graded.result.percent!,
      outcome: release === null || release.outcome ? graded.result.outcome : null,
      sittingDate: new Date(graded.result.startedAt).toISOString(),
      record: graded.entries.at(-1)?.hash ?? "",
    };
  }
}

export const MUTED: Rgb = [0.38, 0.42, 0.5];
export const BRAND: Rgb = [0.2, 0.25, 0.68];
export const SOFT: Rgb = [0.95, 0.96, 0.99];
export const GOOD: Rgb = [0.05, 0.45, 0.3];
export const BAD: Rgb = [0.7, 0.2, 0.15];

/** The scorecard itself: one A4 page for most papers, more for a long one. */
export function drawScorecard(card: {
  readonly institution: string;
  readonly name: string;
  readonly ref: string;
  readonly title: string;
  readonly sat: number;
  readonly total: number;
  readonly maxTotal: number;
  readonly percent: number;
  readonly outcome: "qualified" | "failed" | null;
  readonly sections: readonly { readonly title: string; readonly score: number; readonly max: number }[];
  readonly questions: readonly { readonly number: number; readonly stem: string; readonly score: number; readonly max: number }[];
  readonly revised: boolean;
  readonly head: string;
  readonly verifyUrl: string;
  readonly issued: number;
}): Uint8Array {
  const margin = 48;
  const right = A4.width - margin;
  const pages: Page[] = [];
  let page = new Page();
  pages.push(page);

  // The heading band.
  page.box(0, 0, A4.width, 96, BRAND);
  page.text(margin, 30, fit(card.institution, right - margin - 120, 18, true), { size: 18, bold: true, color: [1, 1, 1] });
  page.text(margin, 56, "Scorecard", { size: 11, color: [0.85, 0.88, 1] });
  page.text(right, 34, "Parikshaa", { size: 12, bold: true, color: [1, 1, 1], align: "right" });

  let y = 124;
  page.text(margin, y, fit(card.title, right - margin, 15, true), { size: 15, bold: true });
  y += 30;
  const facts: [string, string][] = [
    ["Candidate", card.name === "" ? "—" : card.name],
    ["Roll number", card.ref],
    ["Sat on", IST(card.sat)],
  ];
  for (const [label, value] of facts) {
    page.text(margin, y, label, { size: 9, color: MUTED });
    page.text(margin + 90, y, fit(value, right - margin - 90, 11, true), { size: 11, bold: true });
    y += 18;
  }

  // The result.
  y += 10;
  page.box(margin, y, right - margin, 70, SOFT);
  page.text(margin + 18, y + 14, "Marks", { size: 9, color: MUTED });
  page.text(margin + 18, y + 30, `${card.total} out of ${card.maxTotal}`, { size: 20, bold: true });
  page.text(margin + 250, y + 14, "Percent", { size: 9, color: MUTED });
  page.text(margin + 250, y + 30, `${card.percent}%`, { size: 20, bold: true });
  if (card.outcome !== null) {
    page.text(right - 18, y + 14, "Qualifying mark", { size: 9, color: MUTED, align: "right" });
    page.text(right - 18, y + 32, card.outcome === "qualified" ? "Reached" : "Not reached", { size: 14, bold: true, color: card.outcome === "qualified" ? GOOD : BAD, align: "right" });
  }
  y += 90;

  if (card.sections.length > 0) {
    page.text(margin, y, "By section", { size: 11, bold: true });
    y += 18;
    for (const s of card.sections) {
      page.text(margin, y, fit(s.title, 360, 10), { size: 10 });
      page.text(right, y, `${s.score} / ${s.max}`, { size: 10, bold: true, align: "right" });
      y += 16;
    }
    y += 10;
  }

  // Question by question, continuing on a new page when this one fills.
  const header = (p: Page, top: number) => {
    p.text(margin, top, "Q", { size: 9, color: MUTED });
    p.text(margin + 30, top, "Question", { size: 9, color: MUTED });
    p.text(right, top, "Marks", { size: 9, color: MUTED, align: "right" });
    p.line(margin, top + 14, right, top + 14);
    return top + 22;
  };
  page.text(margin, y, "Question by question", { size: 11, bold: true });
  y = header(page, y + 20);
  const bottom = A4.height - 150;
  for (const q of card.questions) {
    if (y > bottom) {
      page = new Page();
      pages.push(page);
      y = header(page, margin);
    }
    page.text(margin, y, String(q.number), { size: 10, color: MUTED });
    page.text(margin + 30, y, fit(q.stem, right - margin - 110, 10), { size: 10 });
    page.text(right, y, `${q.score} / ${q.max}`, { size: 10, bold: true, align: "right" });
    y += 17;
  }

  // Checking it: the QR and the link on the last page, with the record's fingerprint.
  const qr = qrcode(0, "M");
  qr.addData(card.verifyUrl);
  qr.make();
  const size = 92;
  const top = A4.height - 128;
  page.line(margin, top - 12, right, top - 12);
  page.modules(right - size, top, size, qr.getModuleCount(), (r, c) => qr.isDark(r, c));
  const note = [
    "Check this scorecard: scan the code, or open the link below. It shows the result as it stands in",
    "the institution's record now, and says so if the result has been withdrawn.",
  ];
  note.forEach((line, i) => page.text(margin, top + i * 13, line, { size: 8.5, color: MUTED }));
  // The link in pieces that each fit the line, never with a space inserted: it is typed as printed.
  const link: string[] = [];
  let rest = card.verifyUrl;
  while (rest.length > 0) {
    let take = rest.length;
    while (take > 1 && textWidth(rest.slice(0, take), 8) > right - margin - size - 20) take--;
    link.push(rest.slice(0, take));
    rest = rest.slice(take);
  }
  link.forEach((line, i) => page.text(margin, top + 34 + i * 11, line, { size: 8, color: BRAND }));
  page.text(margin, top + 72, `Record fingerprint ${card.head.slice(0, 16)}…  ·  Issued ${IST(card.issued, "full")} IST`, { size: 7.5, color: MUTED });
  if (card.revised) page.text(margin, top + 84, "A mark on this paper was changed on recheck; the record shows who changed it and why.", { size: 7.5, color: MUTED });
  pages.forEach((p, i) => p.text(A4.width / 2, A4.height - 28, `${i + 1} of ${pages.length}`, { size: 8, color: MUTED, align: "center" }));
  return pdf(pages, `Scorecard — ${card.title}`);
}
