import {
  allQuestions,
  cohortAnalytics,
  decodeCodeAnswer,
  foldAttempt,
  paperOf,
  resultOf,
  similarPairs,
  type AttemptId,
  type CodeSubmission,
  type AttemptProjection,
  type AttemptResult,
  type Exam,
  type CohortAnalytics,
  type ExamId,
} from "@parikshaa/core";
import { staffScope, type Invitation, type InvitationStore, type LedgerStore, type ProctorStore, type Scope } from "@parikshaa/store";
import { identityState } from "./proctoring.js";
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
    /** A code answer's tests, as counted on the record; null when none ran. */
    readonly tests: { readonly passed: number; readonly total: number } | null;
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
  /** For a proctored exam (ROADMAP §14): the identity decision and what the camera and browser sent. Observations. */
  readonly proctoring: {
    readonly identity: "not_taken" | "pending" | "verified" | "rejected";
    readonly identityReason: string | null;
    readonly identityDecidedBy: string | null;
    readonly snapshots: number;
    readonly events: Readonly<Record<string, number>>;
  } | null;
}

const testsOf = (run: { readonly passed: number; readonly total: number } | undefined) => (run === undefined ? null : { passed: run.passed, total: run.total });

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
  readonly #proctor: ProctorStore | null;

  constructor(options: {
    readonly store: LedgerStore;
    readonly invitations: InvitationStore;
    readonly exams: ExamService;
    readonly proctor?: ProctorStore | null;
  }) {
    this.#proctor = options.proctor ?? null;
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

  /**
   * Code answers to the same question that are alike enough to be worth a
   * look (ROADMAP §4): evidence for a person, never a finding, and never a
   * change to anyone's marks.
   */
  async similarity(actor: Actor, examId: ExamId): Promise<SimilarityReport> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const scope = staffScope(actor.orgId);
    const definition = await this.#store.loadExam(scope, examId);
    if (definition === null) throw new AttemptError("not_found", `No such exam: ${examId}`);
    const [chains, invited] = await Promise.all([this.#store.loadExamLedgers(scope, examId), this.#invitations.list(scope, examId)]);
    const byAttempt = new Map<string, Invitation>(invited.filter((i) => i.attemptId !== null).map((i) => [i.attemptId!, i]));

    const code = allQuestions(definition).filter((q) => q.kind === "code");
    // Per code question: every candidate's answer, as they last committed it.
    const answers = new Map<string, Map<string, { language: string; source: string; ref: string; name: string }>>();
    for (const [attemptId, entries] of chains) {
      const first = entries[0];
      if (first === undefined || first.event.type !== "attempt_started") continue;
      const folded = foldAttempt(entries, { exam: paperOf(definition, first.event.questionIds) });
      if (!folded.ok) continue;
      const invitation = byAttempt.get(attemptId);
      for (const response of folded.projection.attempt.responses) {
        const question = code.find((q) => q.id === response.questionId);
        if (question === undefined || question.kind !== "code") continue;
        const decoded = decodeCodeAnswer(response.answer, question);
        const forQuestion = answers.get(question.id) ?? new Map();
        forQuestion.set(attemptId, {
          ...decoded,
          ref: invitation?.candidateRef ?? folded.projection.attempt.candidateId,
          name: invitation?.name ?? "",
        });
        answers.set(question.id, forQuestion);
      }
    }

    return {
      exam: { id: definition.id, title: definition.title },
      questions: code.map((question) => {
        const given = answers.get(question.id) ?? new Map();
        const submissions: CodeSubmission[] = [...given].map(([key, a]) => ({ key, language: a.language, source: a.source }));
        const side = (attemptId: string) => ({ attemptId, ...given.get(attemptId)! });
        return {
          id: question.id,
          stem: question.stem,
          answered: submissions.length,
          pairs: similarPairs(submissions, question.kind === "code" ? (question.starter ?? null) : null).map((p) => ({
            a: side(p.a),
            b: side(p.b),
            similarity: p.similarity,
            shared: p.shared,
          })),
        };
      }),
    };
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
          answer: code === null ? (q.kind === "mcq" && raw !== null ? optionsChosen(q.options, raw) : raw) : code.source,
          language: code?.language ?? null,
          tests: testsOf(projection.codeScores.get(q.id)),
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
      proctoring: await this.#proctoring(scope, attemptId, definition, projection),
    };
  }

  async #proctoring(scope: Scope, attemptId: AttemptId, exam: Exam, projection: AttemptProjection): Promise<CandidateReport["proctoring"]> {
    if (exam.policy.proctoring === undefined || this.#proctor === null) return null;
    const [photos, events] = await Promise.all([this.#proctor.media(scope, attemptId, "snapshot"), this.#proctor.events(scope, attemptId)]);
    const counts: Record<string, number> = {};
    for (const e of events) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    const review = projection.identity?.review ?? null;
    return {
      identity: identityState(projection.identity),
      identityReason: review?.reason ?? null,
      identityDecidedBy: review?.decidedBy.name ?? null,
      snapshots: photos.length,
      events: counts,
    };
  }
}

/** An mcq answer as the options' own words: "Merge sort", or "2; 5" for several. */
function optionsChosen(options: readonly string[], raw: string): string {
  const positions = raw.split(",").map((p) => p.trim());
  if (positions.some((p) => !/^\d+$/.test(p))) return raw;
  return positions.map((p) => options[Number(p)] ?? p).join("; ");
}

export interface SimilarityReport {
  readonly exam: { readonly id: string; readonly title: string };
  readonly questions: readonly {
    readonly id: string;
    readonly stem: string;
    readonly answered: number;
    readonly pairs: readonly {
      readonly a: SimilaritySide;
      readonly b: SimilaritySide;
      readonly similarity: number;
      readonly shared: number;
    }[];
  }[];
}

interface SimilaritySide {
  readonly attemptId: string;
  readonly ref: string;
  readonly name: string;
  readonly language: string;
  readonly source: string;
}
