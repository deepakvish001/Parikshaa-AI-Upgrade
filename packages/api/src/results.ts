import {
  allQuestions,
  cohortAnalytics,
  decodeCodeAnswer,
  foldAttempt,
  paperOf,
  resultOf,
  type AttemptId,
  type AttemptResult,
  type CohortAnalytics,
  type ExamId,
} from "@parikshaa/core";
import { staffScope, type Invitation, type InvitationStore, type LedgerStore } from "@parikshaa/store";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";
import type { Cell } from "./xlsx.js";

/**
 * Results, exports and reports (ROADMAP §6).
 *
 * All of it is read from the ledgers, through `resultOf` and `cohortAnalytics`
 * in the core, so a number in a spreadsheet can be traced to the entries that
 * produced it. Reading results needs `attempt:review`, since they carry the
 * provenance evidence; exporting them is audited, since they leave the system.
 */

export interface ResultRow extends AttemptResult {
  readonly ref: string;
  readonly name: string;
  readonly email: string | null;
}

export interface Results {
  readonly exam: { readonly id: string; readonly title: string };
  readonly rows: readonly ResultRow[];
  readonly analytics: CohortAnalytics;
}

export interface CandidateReport {
  readonly exam: { readonly id: string; readonly title: string };
  readonly candidate: { readonly ref: string; readonly name: string; readonly email: string | null };
  readonly result: AttemptResult;
  readonly questions: readonly {
    readonly id: string;
    readonly stem: string;
    readonly kind: string;
    readonly maxScore: number;
    readonly score: number | null;
    readonly answer: string | null;
    readonly language: string | null;
  }[];
  readonly vivas: readonly {
    readonly questionId: string;
    readonly prompt: string;
    readonly reply: string | null;
    readonly latencyMs: number | null;
    readonly verdict: string | null;
    readonly confidence: number | null;
    readonly reasoning: string | null;
  }[];
  readonly voidReason: string | null;
  readonly voidedBy: string | null;
  readonly ledger: { readonly head: string; readonly length: number };
}

/** "2026-10-01 10:05" in India Standard Time: what a spreadsheet column should say. */
export function istStamp(ms: number): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return `${parts["year"]}-${parts["month"]}-${parts["day"]} ${parts["hour"]}:${parts["minute"]}`;
}

export class ResultsService {
  readonly #store: LedgerStore;
  readonly #invitations: InvitationStore;
  readonly #exams: ExamService;

  constructor(options: { readonly store: LedgerStore; readonly invitations: InvitationStore; readonly exams: ExamService }) {
    this.#store = options.store;
    this.#invitations = options.invitations;
    this.#exams = options.exams;
  }

  async results(actor: Actor, examId: ExamId): Promise<Results> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const scope = staffScope(actor.orgId);
    const definition = await this.#store.loadExam(scope, examId);
    if (definition === null) throw new AttemptError("not_found", `No such exam: ${examId}`);

    const [chains, invited] = await Promise.all([
      this.#store.loadExamLedgers(scope, examId),
      this.#invitations.list(scope, examId),
    ]);
    const byAttempt = new Map<string, Invitation>(invited.filter((i) => i.attemptId !== null).map((i) => [i.attemptId!, i]));

    const rows: ResultRow[] = [];
    for (const entries of chains.values()) {
      const result = resultOf(entries, definition);
      if (result === null) continue;
      const invitation = byAttempt.get(result.attemptId);
      rows.push({
        ...result,
        ref: invitation?.candidateRef ?? result.candidateId,
        name: invitation?.name ?? "",
        email: invitation?.email ?? null,
      });
    }
    return { exam: { id: definition.id, title: definition.title }, rows, analytics: cohortAnalytics(rows, definition) };
  }

  /** The results as a table: one row per candidate, one column per question the exam could set. */
  async table(actor: Actor, examId: ExamId): Promise<{ title: string; rows: Cell[][] }> {
    const { exam, rows } = await this.results(actor, examId);
    const definition = (await this.#store.loadExam(staffScope(actor.orgId), examId))!;
    const questions = allQuestions(definition);
    const header: Cell[] = [
      "Ref",
      "Name",
      "Email",
      "State",
      "Total",
      "Out of",
      "Percent",
      "Started (IST)",
      "Submitted (IST)",
      "Minutes",
      ...questions.map((q, i) => `Q${i + 1} ${q.stem.slice(0, 40)}`),
      "Follow-ups asked",
      "Follow-up readings",
      "Set aside because",
    ];
    const body = rows.map((r): Cell[] => [
      r.ref,
      r.name,
      r.email,
      r.state,
      r.total,
      r.maxTotal,
      r.percent,
      istStamp(r.startedAt),
      r.submittedAt === null ? null : istStamp(r.submittedAt),
      r.durationMs === null ? null : Math.round(r.durationMs / 6000) / 10,
      ...questions.map((q) => r.scores[q.id]?.score ?? null),
      r.probes.asked,
      Object.entries(r.probes.verdicts)
        .map(([v, n]) => `${v} ${n}`)
        .join("; "),
      r.voidReason,
    ]);
    await this.#exams.recordAudit(actor, "results.exported", exam.id, { candidates: rows.length });
    return { title: exam.title, rows: [header, ...body] };
  }

  /** One candidate's report: grade, answers, and — separately — the follow-ups. */
  async report(actor: Actor, attemptId: AttemptId): Promise<CandidateReport> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const scope = staffScope(actor.orgId);
    const entries = await this.#store.load(scope, attemptId);
    const first = entries[0];
    if (first === undefined || first.event.type !== "attempt_started") throw new AttemptError("not_found", `No attempt ${attemptId}`);
    const definition = await this.#store.loadExam(scope, first.event.examId);
    if (definition === null) throw new AttemptError("not_found", "The attempt's exam is missing");

    const paper = paperOf(definition, first.event.questionIds);
    const folded = foldAttempt(entries, { exam: paper });
    const result = resultOf(entries, definition);
    if (!folded.ok || result === null) throw new AttemptError("invalid_state", `Attempt ${attemptId} does not fold`);
    const { projection } = folded;
    const invitation = await this.#invitations.byAttempt(scope, attemptId);
    const answers = new Map(projection.attempt.responses.map((r) => [r.questionId as string, r.answer]));

    return {
      exam: { id: definition.id, title: definition.title },
      candidate: {
        ref: invitation?.candidateRef ?? projection.attempt.candidateId,
        name: invitation?.name ?? "",
        email: invitation?.email ?? null,
      },
      result,
      questions: paper.questions.map((q) => {
        const raw = answers.get(q.id) ?? null;
        const code = q.kind === "code" && raw !== null ? decodeCodeAnswer(raw, q) : null;
        return {
          id: q.id,
          stem: q.stem,
          kind: q.kind,
          maxScore: q.maxScore,
          score: result.scores[q.id]?.score ?? null,
          answer: code === null ? (q.kind === "mcq" && raw !== null ? (q.options[Number(raw)] ?? raw) : raw) : code.source,
          language: code?.language ?? null,
        };
      }),
      vivas: projection.vivas.map((v) => ({
        questionId: v.probe.questionId,
        prompt: v.probe.prompt,
        reply: v.exchange?.reply ?? null,
        latencyMs: v.exchange?.latencyMs ?? null,
        verdict: v.assessment?.verdict ?? null,
        confidence: v.assessment?.confidence ?? null,
        reasoning: v.assessment?.reasoning ?? null,
      })),
      voidReason: projection.voidReason,
      voidedBy: projection.voidedBy?.name ?? null,
      ledger: { head: entries.at(-1)!.hash, length: entries.length },
    };
  }
}
