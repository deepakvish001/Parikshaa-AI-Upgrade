import { allQuestions, attemptId as toAttemptId, decodeCodeAnswer, examId as toExamId, foldAttempt, paperOf, type OrgId } from "@parikshaa/core";
import { staffScope, type LedgerStore, type MarkingStore } from "@parikshaa/store";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Marking by hand (docs/PILOT.md, "After"): every written answer of an exam,
 * one after another, with the mark the model gave, for a person to keep or
 * change. Blind by design — no names, only "answer 3 of 40" — so a marker
 * reads the answer, not the candidate. A changed mark is a `score_revised`
 * entry in the attempt's ledger, like a recheck's.
 */

export interface MarkingQuestion {
  readonly id: string;
  readonly number: number;
  readonly stem: string;
  readonly kind: string;
  readonly max: number;
  /** What the rubric looks for, as the author wrote it. */
  readonly rubric: readonly string[];
  readonly expectedPoints: readonly string[];
  readonly answers: number;
  readonly reviewed: number;
}

export interface MarkingItem {
  readonly attemptId: string;
  readonly questionId: string;
  readonly answer: string;
  /** A code answer's language; null for prose. */
  readonly language: string | null;
  readonly score: number;
  readonly max: number;
  readonly reviewed: boolean;
}

/** Kinds a model or a test run marks, and a person may want to read. */
const WRITTEN = new Set(["short", "code"]);

export class MarkingService {
  readonly #store: LedgerStore;
  readonly #marking: MarkingStore;
  readonly #exams: ExamService;
  readonly #now: () => number;

  constructor(options: { readonly store: LedgerStore; readonly marking: MarkingStore; readonly exams: ExamService; readonly now?: () => number }) {
    this.#store = options.store;
    this.#marking = options.marking;
    this.#exams = options.exams;
    this.#now = options.now ?? (() => Date.now());
  }

  /** The queue: each written question, and every graded answer to it, unread first. */
  async queue(actor: Actor, examId: string): Promise<{ readonly questions: readonly MarkingQuestion[]; readonly items: readonly MarkingItem[] }> {
    if (!can(actor, "attempt:grade")) throw new Forbidden("attempt:grade");
    const scope = staffScope(actor.orgId);
    const exam = await this.#store.loadExam(scope, toExamId(examId));
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${examId}`);
    const written = allQuestions(exam).map((q, i) => ({ q, number: i + 1 })).filter(({ q }) => WRITTEN.has(q.kind));
    const [chains, reviewed] = await Promise.all([this.#store.loadExamLedgers(scope, toExamId(examId)), this.#marking.reviewed(actor.orgId, examId)]);

    const items: MarkingItem[] = [];
    for (const entries of chains.values()) {
      const first = entries[0]?.event;
      if (first?.type !== "attempt_started") continue;
      const folded = foldAttempt(entries, { exam: paperOf(exam, first.questionIds) });
      if (!folded.ok || folded.projection.attempt.state !== "graded") continue;
      const { projection } = folded;
      for (const { q } of written) {
        const response = projection.attempt.responses.find((r) => r.questionId === q.id);
        if (response === undefined || response.answer.trim() === "") continue;
        const code = q.kind === "code" ? decodeCodeAnswer(response.answer, q) : null;
        items.push({
          attemptId: projection.attempt.id,
          questionId: q.id,
          answer: code === null ? response.answer : code.source,
          language: code?.language ?? null,
          score: projection.scores.get(q.id) ?? 0,
          max: q.maxScore,
          reviewed: reviewed.has(`${projection.attempt.id}:${q.id}`),
        });
      }
    }
    // Unread first; otherwise a fixed order that says nothing about who sat when.
    items.sort((a, b) => Number(a.reviewed) - Number(b.reviewed) || a.attemptId.localeCompare(b.attemptId));

    const questions = written.map(({ q, number }): MarkingQuestion => {
      const mine = items.filter((i) => i.questionId === q.id);
      return {
        id: q.id,
        number,
        stem: q.stem,
        kind: q.kind,
        max: q.maxScore,
        rubric: "rubric" in q ? q.rubric.map((r) => r.description) : [],
        expectedPoints: "expectedPoints" in q ? [...(q.expectedPoints ?? [])] : [],
        answers: mine.length,
        reviewed: mine.filter((i) => i.reviewed).length,
      };
    });
    return { questions, items };
  }

  /** Keep or change one answer's mark, and record that it has been read. */
  async mark(actor: Actor, examId: string, item: { readonly attemptId: string; readonly questionId: string; readonly score: number }): Promise<{ readonly score: number; readonly changed: boolean }> {
    if (!can(actor, "attempt:grade")) throw new Forbidden("attempt:grade");
    const { items } = await this.queue(actor, examId);
    const found = items.find((i) => i.attemptId === item.attemptId && i.questionId === item.questionId);
    if (found === undefined) throw new AttemptError("not_found", "No such graded answer in this exam");
    const changed = found.score !== item.score;
    if (changed) await this.#exams.reviseScore(actor, toAttemptId(item.attemptId), item.questionId, item.score, "Read and re-marked by a marker");
    await this.#marking.mark(actor.orgId as OrgId, examId, item.attemptId, item.questionId, actor.name, new Date(this.#now()));
    return { score: item.score, changed };
  }
}
