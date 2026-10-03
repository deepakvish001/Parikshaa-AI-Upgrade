import { createHmac, timingSafeEqual } from "node:crypto";
import { attemptId as toAttemptId, orgId as toOrgId, type AttemptId, type OrgId } from "@parikshaa/core";
import type { IdentityStore } from "@parikshaa/store";
import { A4, fit, Page, pdf, wrap, type Rgb } from "./pdf.js";
import { BAD, BRAND, GOOD, MUTED, SOFT } from "./rechecks.js";
import type { CandidateReport, ResultsService } from "./results.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * The candidate report v2 (plan row 90): one page a hiring manager decides
 * from — the marks and sections, each question with its tests, the code, the
 * follow-up questions, what the proctoring saw and how the AI assistant was
 * used — as a PDF, and as a link that can be sent to someone with no account.
 *
 * The link is `org.attempt.expiry.mac`, stored nowhere, like a scorecard's code.
 * It never shows the candidate's contact details, and it reads the record
 * when opened: a result set aside or erased since reads as withdrawn.
 */

const DAY = 86_400_000;
/** The longest a link may last. */
export const MAX_REPORT_DAYS = 30;

export class ReportLinks {
  readonly #key: Buffer;

  constructor(secret: string) {
    this.#key = createHmac("sha256", secret).update("parikshaa-candidate-reports").digest();
  }

  #mac(payload: string): string {
    return createHmac("sha256", this.#key).update(payload).digest("base64url").slice(0, 22);
  }

  issue(orgId: string, attemptId: string, expiresAt: number): string {
    const payload = `${orgId}.${attemptId}.${Math.floor(expiresAt / 1000).toString(36)}`;
    return `${payload}.${this.#mac(payload)}`;
  }

  verify(code: string): { orgId: string; attemptId: string; expiresAt: number } | null {
    const parts = code.trim().split(".");
    if (parts.length !== 4) return null;
    const [orgId, attemptId, expiry, mac] = parts as [string, string, string, string];
    const expected = Buffer.from(this.#mac(`${orgId}.${attemptId}.${expiry}`));
    const given = Buffer.from(mac);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const seconds = Number.parseInt(expiry, 36);
    if (!Number.isFinite(seconds)) return null;
    return { orgId, attemptId, expiresAt: seconds * 1000 };
  }
}

/** The report as a hiring manager sees it through a link: no contact details, numbered questions. */
export interface SharedReport {
  readonly institution: string;
  readonly exam: { readonly title: string };
  readonly candidate: { readonly name: string; readonly ref: string };
  readonly sat: string;
  readonly durationMs: number | null;
  readonly total: number;
  readonly maxTotal: number;
  readonly percent: number;
  readonly outcome: "qualified" | "failed" | null;
  readonly standing: CandidateReport["standing"];
  readonly sections: readonly { readonly title: string; readonly score: number; readonly max: number }[];
  readonly questions: readonly {
    readonly number: number;
    readonly stem: string;
    readonly kind: string;
    readonly score: number;
    readonly max: number;
    readonly tests: { readonly passed: number; readonly total: number } | null;
    /** The program a code question was answered with; other answers stay with the institution. */
    readonly code: { readonly language: string; readonly source: string } | null;
    readonly aiPrompts: number;
  }[];
  readonly followUps: readonly { readonly number: number; readonly prompt: string; readonly reply: string | null; readonly verdict: string | null }[];
  readonly integrity: {
    readonly identity: "not_taken" | "pending" | "verified" | "rejected";
    readonly snapshots: number;
    readonly events: readonly { readonly kind: string; readonly label: string; readonly count: number }[];
  } | null;
  readonly record: { readonly head: string; readonly length: number };
  readonly expiresAt: string;
}

export type ReportCheck = ({ readonly valid: true } & SharedReport) | { readonly valid: false; readonly reason: "unknown" | "expired" | "withdrawn" };

/** What the browser told the proctoring, in words; observations, never findings. */
export const EVENT_LABELS: Readonly<Record<string, string>> = {
  tab_hidden: "Left the tab",
  fullscreen_exit: "Left full screen",
  copy: "Copied",
  paste: "Pasted",
  camera_off: "Camera stopped",
  camera_on: "Camera back",
  screen_share_off: "Stopped sharing the screen",
  screen_share_on: "Shared the screen again",
  second_screen: "Second screen connected",
  voice: "Talking or noise heard",
};

const round = (n: number) => Math.round(n * 100) / 100;
const plain = (stem: string) => stem.replace(/[#*_`>|]/g, "").replace(/\s+/g, " ").trim();

export class CandidateReports {
  readonly #results: ResultsService;
  readonly #identity: IdentityStore;
  readonly #exams: ExamService;
  readonly #links: ReportLinks;
  readonly #publicUrl: string;
  readonly #now: () => number;

  constructor(options: {
    readonly results: ResultsService;
    readonly identity: IdentityStore;
    readonly exams: ExamService;
    readonly secret: string;
    readonly publicUrl: string;
    readonly now?: () => number;
  }) {
    this.#results = options.results;
    this.#identity = options.identity;
    this.#exams = options.exams;
    this.#links = new ReportLinks(options.secret);
    this.#publicUrl = options.publicUrl.replace(/\/$/, "");
    this.#now = options.now ?? (() => Date.now());
  }

  /** A link to a graded attempt's report, for `days` days. Audited: who sent which candidate's report, and until when. */
  async share(actor: Actor, attemptId: AttemptId, days: number): Promise<{ readonly link: string; readonly expiresAt: string }> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const report = await this.#results.reportFor(actor.orgId, attemptId);
    if (report.result.state !== "graded") throw new AttemptError("invalid_state", "Only a graded attempt's report can be shared");
    const expiresAt = this.#now() + Math.min(MAX_REPORT_DAYS, Math.max(1, Math.round(days))) * DAY;
    const code = this.#links.issue(actor.orgId, attemptId, expiresAt);
    await this.#exams.recordAudit(actor, "report.shared", attemptId, { expiresAt: new Date(expiresAt).toISOString() });
    return { link: `${this.#publicUrl}/?report=${encodeURIComponent(code)}`, expiresAt: new Date(expiresAt).toISOString() };
  }

  /** What a link shows, read from the record now. */
  async view(code: string): Promise<ReportCheck> {
    const named = this.#links.verify(code);
    if (named === null) return { valid: false, reason: "unknown" };
    if (named.expiresAt <= this.#now()) return { valid: false, reason: "expired" };
    const orgId = toOrgId(named.orgId);
    let report: CandidateReport;
    try {
      report = await this.#results.reportFor(orgId, toAttemptId(named.attemptId));
    } catch (error) {
      if (error instanceof AttemptError) return { valid: false, reason: "withdrawn" };
      throw error;
    }
    if (report.result.state !== "graded") return { valid: false, reason: "withdrawn" };
    return { valid: true, ...(await this.#shared(orgId, report, named.expiresAt)) };
  }

  /** The PDF a link offers. Null when the link shows nothing. */
  async viewPdf(code: string): Promise<Uint8Array | null> {
    const seen = await this.view(code);
    return seen.valid ? drawReport(seen, this.#now()) : null;
  }

  /** The PDF for staff, from the console. */
  async pdfForStaff(actor: Actor, attemptId: AttemptId): Promise<Uint8Array> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const report = await this.#results.reportFor(actor.orgId, attemptId);
    if (report.result.state !== "graded") throw new AttemptError("invalid_state", "Only a graded attempt has a report");
    return drawReport(await this.#shared(actor.orgId, report, null), this.#now());
  }

  async #shared(orgId: OrgId, report: CandidateReport, expiresAt: number | null): Promise<SharedReport> {
    const org = await this.#identity.getOrganisation(orgId);
    const { result } = report;
    const number = new Map(report.questions.map((q, i) => [q.id, i + 1]));
    const prompts = new Map(report.aiUse.map((a) => [a.questionId, a.prompts]));
    return {
      institution: org?.name ?? "",
      exam: { title: report.exam.title },
      candidate: { name: report.candidate.name, ref: report.candidate.ref },
      sat: new Date(result.startedAt).toISOString(),
      durationMs: result.durationMs,
      total: round(result.total ?? 0),
      maxTotal: round(result.maxTotal),
      percent: result.percent ?? 0,
      outcome: result.outcome,
      standing: report.standing,
      sections: result.sections.map((s) => ({ title: s.title, score: round(s.score ?? 0), max: round(s.max) })),
      questions: report.questions.map((q, i) => ({
        number: i + 1,
        stem: plain(q.stem).slice(0, 300),
        kind: q.kind,
        score: round(q.score ?? 0),
        max: q.maxScore,
        tests: q.tests,
        code: q.kind === "code" && q.answer !== null ? { language: q.language ?? "", source: q.answer } : null,
        aiPrompts: prompts.get(q.id) ?? 0,
      })),
      followUps: report.vivas.map((v) => ({ number: number.get(v.questionId) ?? 0, prompt: v.prompt, reply: v.reply, verdict: v.verdict })),
      integrity:
        report.proctoring === null
          ? null
          : {
              identity: report.proctoring.identity,
              snapshots: report.proctoring.snapshots,
              events: Object.entries(report.proctoring.events).map(([kind, count]) => ({ kind, label: EVENT_LABELS[kind] ?? kind, count })),
            },
      record: report.ledger,
      expiresAt: expiresAt === null ? "" : new Date(expiresAt).toISOString(),
    };
  }
}

const IST = (ms: number, style: "date" | "full" = "date") =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", ...(style === "full" ? { timeStyle: "short" } : {}) }).format(new Date(ms));
const minutes = (ms: number | null) => (ms === null ? "—" : `${Math.round(ms / 60_000)} min`);
const IDENTITY: Record<string, string> = { not_taken: "No photo taken", pending: "Not decided yet", verified: "Matched", rejected: "Did not match" };
const VERDICT: Record<string, string> = {
  consistent: "Consistent with having produced the answer",
  shallow: "Engaged the answer only superficially",
  inconsistent: "Contradicts or misreads their own answer",
  inconclusive: "Not enough to judge either way",
};
/** Lines of a program the PDF shows before saying how many more there are. */
const CODE_LINES = 60;

/**
 * The report on A4: the first page is the decision — marks, standing, sections,
 * each question, integrity, follow-ups and AI use — and the code follows.
 */
export function drawReport(report: SharedReport, issued: number): Uint8Array {
  const margin = 44;
  const right = A4.width - margin;
  const bottom = A4.height - 60;
  const pages: Page[] = [];
  let page = new Page();
  pages.push(page);
  let y = 0;
  const room = (needed: number) => {
    if (y + needed <= bottom) return;
    page = new Page();
    pages.push(page);
    y = margin;
  };
  const heading = (text: string) => {
    room(40);
    page.text(margin, y, text, { size: 11, bold: true });
    y += 20;
  };

  page.box(0, 0, A4.width, 84, BRAND);
  page.text(margin, 24, fit(report.institution, right - margin - 120, 16, true), { size: 16, bold: true, color: [1, 1, 1] });
  page.text(margin, 48, "Candidate report", { size: 10.5, color: [0.85, 0.88, 1] });
  page.text(right, 28, "Parikshaa", { size: 12, bold: true, color: [1, 1, 1], align: "right" });
  y = 104;
  page.text(margin, y, fit(report.exam.title, right - margin, 14, true), { size: 14, bold: true });
  y += 24;
  const facts: [string, string][] = [
    ["Candidate", report.candidate.name === "" ? "—" : `${report.candidate.name} · ${report.candidate.ref}`],
    ["Sat on", `${IST(Date.parse(report.sat), "full")} IST · ${minutes(report.durationMs)}`],
  ];
  for (const [label, value] of facts) {
    page.text(margin, y, label, { size: 9, color: MUTED });
    page.text(margin + 80, y, fit(value, right - margin - 80, 10.5, true), { size: 10.5, bold: true });
    y += 16;
  }

  y += 8;
  page.box(margin, y, right - margin, 58, SOFT);
  const cell = (x: number, label: string, value: string, color?: Rgb) => {
    page.text(x, y + 12, label, { size: 8.5, color: MUTED });
    page.text(x, y + 26, value, { size: 16, bold: true, ...(color === undefined ? {} : { color }) });
  };
  cell(margin + 14, "Marks", `${report.total} / ${report.maxTotal}`);
  cell(margin + 150, "Percent", `${report.percent}%`);
  const s = report.standing;
  cell(margin + 250, "Standing", s.rank === null ? "—" : `${s.rank} of ${s.graded}`);
  if (report.outcome !== null) {
    cell(margin + 370, "Qualifying mark", report.outcome === "qualified" ? "Reached" : "Not reached", report.outcome === "qualified" ? GOOD : BAD);
  }
  y += 74;

  if (report.sections.length > 0) {
    heading("By section");
    for (const sec of report.sections) {
      room(16);
      page.text(margin, y, fit(sec.title, 330, 10), { size: 10 });
      const share = sec.max > 0 ? sec.score / sec.max : 0;
      page.box(right - 170, y + 2, 100, 7, SOFT);
      page.box(right - 170, y + 2, Math.max(0, Math.min(1, share)) * 100, 7, BRAND);
      page.text(right, y, `${sec.score} / ${sec.max}`, { size: 10, bold: true, align: "right" });
      y += 16;
    }
    y += 8;
  }

  heading("Question by question");
  page.text(margin, y, "Q", { size: 8.5, color: MUTED });
  page.text(margin + 24, y, "Question", { size: 8.5, color: MUTED });
  page.text(right - 120, y, "Tests", { size: 8.5, color: MUTED });
  page.text(right - 64, y, "AI", { size: 8.5, color: MUTED });
  page.text(right, y, "Marks", { size: 8.5, color: MUTED, align: "right" });
  page.line(margin, y + 13, right, y + 13);
  y += 20;
  for (const q of report.questions) {
    room(16);
    page.text(margin, y, String(q.number), { size: 9.5, color: MUTED });
    page.text(margin + 24, y, fit(q.stem, right - margin - 170, 9.5), { size: 9.5 });
    page.text(right - 120, y, q.tests === null ? "—" : `${q.tests.passed}/${q.tests.total}`, { size: 9.5 });
    page.text(right - 64, y, q.aiPrompts === 0 ? "—" : String(q.aiPrompts), { size: 9.5 });
    page.text(right, y, `${q.score} / ${q.max}`, { size: 9.5, bold: true, align: "right" });
    y += 15;
  }
  y += 10;

  if (report.integrity !== null) {
    heading("What the proctoring saw");
    const lines = [
      `Photo ID: ${IDENTITY[report.integrity.identity] ?? report.integrity.identity} · ${report.integrity.snapshots} webcam photos`,
      report.integrity.events.length === 0 ? "Nothing reported by the browser." : report.integrity.events.map((e) => `${e.label}: ${e.count}`).join(" · "),
      "These are observations for a person to weigh, never a finding.",
    ];
    for (const line of lines.flatMap((l) => wrap(l, right - margin, 9.5))) {
      room(14);
      page.text(margin, y, line, { size: 9.5 });
      y += 14;
    }
    y += 8;
  }

  if (report.followUps.length > 0) {
    heading("Follow-up questions");
    for (const f of report.followUps) {
      const text = [`Q${f.number}: ${f.prompt}`, `Reply: ${f.reply ?? "No reply"}`, `Assessed: ${f.verdict === null ? "Not assessed" : (VERDICT[f.verdict] ?? f.verdict)}`];
      for (const line of text.flatMap((l) => wrap(l, right - margin, 9.5))) {
        room(14);
        page.text(margin, y, line, { size: 9.5 });
        y += 14;
      }
      y += 4;
    }
    y += 6;
  }

  const assisted = report.questions.filter((q) => q.aiPrompts > 0);
  heading("Use of the AI assistant");
  room(14);
  page.text(
    margin,
    y,
    assisted.length === 0 ? "None: no question allowed it, or the candidate did not ask." : assisted.map((q) => `Q${q.number}: ${q.aiPrompts} ${q.aiPrompts === 1 ? "prompt" : "prompts"}`).join(" · "),
    { size: 9.5 },
  );
  y += 24;

  for (const q of report.questions) {
    if (q.code === null) continue;
    heading(`Q${q.number} · the program (${q.code.language})`);
    const lines = q.code.source.replace(/\t/g, "  ").split("\n");
    for (const line of lines.slice(0, CODE_LINES)) {
      room(11);
      page.text(margin, y, fit(line === "" ? " " : line, right - margin, 8), { size: 8 });
      y += 11;
    }
    if (lines.length > CODE_LINES) {
      room(12);
      page.text(margin, y, `… ${lines.length - CODE_LINES} more lines in the institution's record.`, { size: 8, color: MUTED });
      y += 12;
    }
    y += 10;
  }

  room(30);
  page.line(margin, y, right, y);
  page.text(margin, y + 8, `Record fingerprint ${report.record.head.slice(0, 16)}… (${report.record.length} entries) · Issued ${IST(issued, "full")} IST`, { size: 7.5, color: MUTED });
  pages.forEach((p, i) => p.text(A4.width / 2, A4.height - 28, `${i + 1} of ${pages.length}`, { size: 8, color: MUTED, align: "center" }));
  return pdf(pages, `Candidate report — ${report.exam.title}`);
}
