import {
  allQuestions,
  cohortAnalytics,
  decodeCodeAnswer,
  examId,
  percentileOf,
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
  type OrgId,
} from "@parikshaa/core";
import { staffScope, type IdentityStore, type Invitation, type InvitationStore, type LedgerStore, type OutboxItem, type ProctorStore, type Scope } from "@parikshaa/store";
import type { Mailer } from "./delivery.js";
import { identityState } from "./proctoring.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";
import { xlsx, type Cell } from "./xlsx.js";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

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

/** The exam, with its qualifying mark for the charts to draw. */
export interface ExamHead {
  readonly id: string;
  readonly title: string;
  readonly cutoff: { readonly percent: number; readonly sections?: Readonly<Record<string, number>> } | null;
}

const examHead = (definition: Exam): ExamHead => ({
  id: definition.id,
  title: definition.title,
  cutoff: definition.policy.cutoff === undefined ? null : { percent: definition.policy.cutoff.percent, ...(definition.policy.cutoff.sections === undefined ? {} : { sections: definition.policy.cutoff.sections }) },
});

export interface Results {
  readonly exam: ExamHead;
  readonly rows: readonly ResultRow[];
  readonly analytics: CohortAnalytics;
}

export interface CandidateReport {
  readonly exam: ExamHead;
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
    /** When an answer was first and last saved, after the start; and how often. The record keeps saves, not where the candidate looked. */
    readonly firstSavedMs: number | null;
    readonly lastSavedMs: number | null;
    readonly saves: number;
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
  /** Among the graded candidates of the same exam. */
  readonly standing: { readonly percentile: number | null; readonly rank: number | null; readonly graded: number; readonly meanPercent: number | null };
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

/** The spreadsheet says what the console says: the glossary's words, never the stored values. */
const STATE_WORDS: Record<string, string> = { not_started: "Not started", in_progress: "In progress", submitted: "To grade", graded: "Graded", void: "Set aside" };
const OUTCOME_WORDS: Record<string, string> = { qualified: "Qualified", failed: "Not qualified" };

export class ResultsService {
  readonly #store: LedgerStore;
  readonly #invitations: InvitationStore;
  readonly #exams: ExamService;
  readonly #proctor: ProctorStore | null;

  readonly #identity: IdentityStore | null;
  readonly #mailer: Mailer | null;
  readonly #whatsapp: boolean;
  readonly #now: () => number;

  constructor(options: {
    readonly store: LedgerStore;
    readonly invitations: InvitationStore;
    readonly exams: ExamService;
    readonly proctor?: ProctorStore | null;
    /** For sending the workbook by email to whoever asks for it. */
    readonly identity?: IdentityStore | null;
    readonly mailer?: Mailer | null;
    /** Whether WhatsApp is set up, so results can go that way too. */
    readonly whatsapp?: boolean;
    readonly now?: () => number;
  }) {
    this.#proctor = options.proctor ?? null;
    this.#store = options.store;
    this.#invitations = options.invitations;
    this.#exams = options.exams;
    this.#identity = options.identity ?? null;
    this.#mailer = options.mailer ?? null;
    this.#whatsapp = options.whatsapp ?? false;
    this.#now = options.now ?? (() => Date.now());
  }

  /**
   * Send the results workbook to the member of staff asking, at their own
   * address — never anyone else's: it is the file they could download, sent
   * where they read their mail. Made when it is sent, so it is current.
   */
  async emailWorkbook(actor: Actor, examId: ExamId): Promise<{ readonly to: string }> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    if (actor.kind !== "user") throw new AttemptError("invalid_state", "Only a person has an address to send the results to");
    if (this.#identity === null || this.#mailer === null) throw new AttemptError("invalid_state", "Email is not set up on this server: download the results instead");
    const definition = await this.#store.loadExam(staffScope(actor.orgId), examId);
    if (definition === null) throw new AttemptError("not_found", `No such exam: ${examId}`);
    const now = new Date(this.#now());
    await this.#identity.queueStaffEmail(actor.orgId, "results_file", { userId: actor.id, examId }, `results:${actor.id}:${examId}:${now.getTime()}`, now);
    return { to: actor.email };
  }

  /**
   * Tell each graded candidate their result, by email and, where it is set
   * up and they gave a mobile number, WhatsApp (docs/PILOT.md: after the
   * sitting). One message each way, ever: pressing it again sends nobody a
   * second, so it is safe to press once more grading is done. The message is
   * written when it is sent, from the result as it then stands; with
   * `outcome`, it says whether they reached the qualifying mark. A dry run
   * queues nothing and says what sending would do.
   */
  async release(
    actor: Actor,
    examId: ExamId,
    options: { readonly outcome: boolean; readonly dryRun?: boolean },
  ): Promise<{
    readonly sent: number;
    readonly alreadySent: number;
    readonly notGraded: number;
    readonly unreachable: number;
    readonly channels: readonly ("email" | "whatsapp")[];
  }> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    if (this.#mailer === null && !this.#whatsapp) {
      throw new AttemptError("invalid_state", "Neither email nor WhatsApp is set up on this server: results cannot be sent to candidates");
    }
    const scope = staffScope(actor.orgId);
    const { rows } = await this.results(actor, examId);
    const invited = new Map((await this.#invitations.list(scope, examId)).filter((i) => i.attemptId !== null && !i.revoked).map((i) => [i.attemptId!, i]));
    const graded = rows.filter((r) => r.state === "graded");
    const messages = graded.map((r) => {
      const invitation = invited.get(r.attemptId);
      if (invitation === undefined) return [];
      const draft = (kind: "email" | "whatsapp", id: string) => ({
        kind,
        subject: { invitationId: invitation.id, outcome: options.outcome },
        purpose: "results",
        id,
        sendAfter: new Date(this.#now()),
      });
      return [
        ...(this.#mailer !== null && invitation.email !== null ? [draft("email", `results:${invitation.id}`)] : []),
        ...(this.#whatsapp && invitation.phone !== null ? [draft("whatsapp", `results:${invitation.id}:whatsapp`)] : []),
      ];
    });
    const drafts = messages.flat();
    const ids = drafts.map((d) => d.id);
    const written = new Set(
      options.dryRun === true
        ? await this.#invitations.queued(scope, ids).then((already) => ids.filter((id) => !already.includes(id)))
        : drafts.length === 0
          ? []
          : await this.#invitations.enqueue(scope, drafts),
    );
    const reached = messages.filter((m) => m.length > 0);
    const counts = {
      // A candidate counts as sent if any way of reaching them is new: one who gave a number since, say.
      sent: reached.filter((m) => m.some((d) => written.has(d.id))).length,
      alreadySent: reached.filter((m) => !m.some((d) => written.has(d.id))).length,
      notGraded: rows.filter((r) => r.state === "submitted").length,
      unreachable: graded.length - reached.length,
    };
    const channels = [...(this.#mailer === null ? [] : (["email"] as const)), ...(this.#whatsapp ? (["whatsapp"] as const) : [])];
    if (options.dryRun !== true) await this.#exams.recordAudit(actor, "results.released", examId, { ...counts, outcome: options.outcome });
    return { ...counts, channels };
  }

  /** One candidate's result, as the Results tab has it, for the message that tells them; null until graded. */
  async candidateResult(
    orgId: OrgId,
    attemptId: AttemptId,
    examIdOf: ExamId,
  ): Promise<{ readonly title: string; readonly total: number; readonly maxTotal: number; readonly percent: number; readonly outcome: "qualified" | "failed" | null } | null> {
    const scope = staffScope(orgId);
    const definition = await this.#store.loadExam(scope, examIdOf);
    if (definition === null) return null;
    const result = resultOf(await this.#store.load(scope, attemptId), definition);
    if (result === null || result.state !== "graded" || result.total === null || result.percent === null) return null;
    return { title: definition.title, total: result.total, maxTotal: result.maxTotal, percent: result.percent, outcome: result.outcome ?? null };
  }

  /** Sends a results workbook the outbox names, as its asker would download it now. */
  readonly mail = async (item: OutboxItem): Promise<"sent" | { readonly skip: string }> => {
    if (this.#identity === null || this.#mailer === null) return { skip: "Email is not configured" };
    const user = await this.#identity.findUser(item.orgId as OrgId, String(item.subject["userId"] ?? ""));
    if (user === null || user.disabled) return { skip: "The account is gone or disabled" };
    const actor: Actor = { kind: "user", id: user.id, orgId: user.orgId, role: user.role, name: user.name, email: user.email };
    if (!can(actor, "attempt:review")) return { skip: "The account may no longer read results" };
    const id = examId(String(item.subject["examId"] ?? ""));
    const table = await this.table(actor, id);
    await this.#mailer.send({
      to: user.email,
      subject: `Results: ${table.title}`,
      text: `The results of ${table.title}, as they stand now, are attached as an Excel workbook.\n\nIt holds candidates' names, contacts and marks: keep it where only those who need it can open it.`,
      html: `<p>The results of <strong>${escapeHtml(table.title)}</strong>, as they stand now, are attached as an Excel workbook.</p><p>It holds candidates' names, contacts and marks: keep it where only those who need it can open it.</p>`,
      attachments: [{ filename: `${id}-results.xlsx`, content: xlsx(table.title, table.rows), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
    });
    return "sent";
  };

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
    return { exam: examHead(definition), rows, analytics: cohortAnalytics(rows, definition) };
  }

  /** The results as a table: one row per candidate, one column per question the exam could set. */
  async table(actor: Actor, examId: ExamId): Promise<{ title: string; rows: Cell[][] }> {
    const { exam, rows } = await this.results(actor, examId);
    const definition = (await this.#store.loadExam(staffScope(actor.orgId), examId))!;
    const questions = allQuestions(definition);
    const cutoff = definition.policy.cutoff !== undefined;
    const header: Cell[] = [
      "Roll no.",
      "Name",
      "Email",
      "State",
      "Total",
      "Out of",
      "Percent",
      ...(cutoff ? ["Outcome"] : []),
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
      STATE_WORDS[r.state] ?? r.state,
      r.total,
      r.maxTotal,
      r.percent,
      ...(cutoff ? [r.outcome === null ? null : (OUTCOME_WORDS[r.outcome] ?? r.outcome)] : []),
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
    const saved = new Map<string, number[]>();
    for (const e of entries) {
      if (e.event.type !== "answer_submitted") continue;
      const id = e.event.response.questionId as string;
      saved.set(id, [...(saved.get(id) ?? []), e.timestamp - projection.attempt.startedAt]);
    }

    return {
      exam: examHead(definition),
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
          firstSavedMs: saved.get(q.id)?.[0] ?? null,
          lastSavedMs: saved.get(q.id)?.at(-1) ?? null,
          saves: saved.get(q.id)?.length ?? 0,
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
      standing: await this.#standing(scope, definition, result),
      ledger: { head: entries.at(-1)!.hash, length: entries.length },
      proctoring: await this.#proctoring(scope, attemptId, definition, projection),
    };
  }

  /** Where a graded result stands among the exam's other graded results. */
  async #standing(scope: Scope, definition: Exam, result: AttemptResult): Promise<CandidateReport["standing"]> {
    const chains = await this.#store.loadExamLedgers(scope, definition.id);
    const percents: number[] = [];
    for (const [id, entries] of chains) {
      if (id === result.attemptId) continue;
      const other = resultOf(entries, definition);
      if (other !== null && other.state === "graded" && other.percent !== null) percents.push(other.percent);
    }
    const graded = percents.length + (result.state === "graded" && result.percent !== null ? 1 : 0);
    const all = result.state === "graded" && result.percent !== null ? [...percents, result.percent] : percents;
    const meanPercent = all.length === 0 ? null : Math.round((all.reduce((s, p) => s + p, 0) / all.length) * 10) / 10;
    if (result.state !== "graded" || result.percent === null) return { percentile: null, rank: null, graded, meanPercent };
    return {
      percentile: percentileOf(result.percent, percents),
      rank: percents.filter((p) => p > result.percent!).length + 1,
      graded,
      meanPercent,
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
