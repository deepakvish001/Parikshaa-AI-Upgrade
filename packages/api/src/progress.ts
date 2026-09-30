import { examId as toExamId } from "@parikshaa/core";
import type { ExamService } from "./service.js";
import type { ResultsService } from "./results.js";
import { Forbidden } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * A placement cell's view across its tests (docs/PILOT.md, "After the pilot"):
 * every candidate by roll number, their percentage in each test, and how the
 * batch did in each. A roll number is what ties one person's attempts
 * together; the same number in two tests is taken to be the same student.
 */

export interface ProgressExam {
  readonly id: string;
  readonly title: string;
  /** When it was sat: its window's opening, or when it was made. */
  readonly date: string;
  readonly graded: number;
  readonly meanPercent: number | null;
  readonly qualified: number | null;
}

export interface ProgressRow {
  readonly ref: string;
  readonly name: string;
  /** Percent and outcome in each exam, by id; absent when not graded there. */
  readonly results: Readonly<Record<string, { readonly percent: number; readonly outcome: "qualified" | "failed" | null }>>;
  readonly average: number | null;
  /** Latest percentage minus the first, across the tests they sat; null with fewer than two. */
  readonly change: number | null;
}

/** A question worth a second look, and why, in one of the organisation's tests. */
export interface QuestionFlag {
  readonly examId: string;
  readonly examTitle: string;
  readonly questionId: string;
  readonly number: number;
  readonly stem: string;
  readonly kind: string;
  readonly appeared: number;
  readonly facility: number;
  readonly discrimination: number | null;
  readonly reason: "does_not_separate" | "too_hard" | "too_easy";
}

/** Graded papers a question needs before its figures mean anything. */
export const QUALITY_MINIMUM = 8;

/** Tests shown at once: enough for a semester's drives. */
export const PROGRESS_EXAMS = 12;

const round = (n: number) => Math.round(n * 10) / 10;

export class ProgressService {
  readonly #exams: ExamService;
  readonly #results: ResultsService;

  constructor(options: { readonly exams: ExamService; readonly results: ResultsService }) {
    this.#exams = options.exams;
    this.#results = options.results;
  }

  /**
   * The organisation's graded tests, oldest first, and its candidates across
   * them. `examIds` picks which; `search` keeps roll numbers or names
   * containing it, such as a branch's prefix.
   */
  async progress(actor: Actor, options: { readonly examIds?: readonly string[]; readonly search?: string } = {}): Promise<{ readonly exams: readonly ProgressExam[]; readonly candidates: readonly ProgressRow[]; readonly available: readonly { readonly id: string; readonly title: string }[] }> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const listed = (await this.#exams.listExams(actor)).filter((e) => e.attempts.graded > 0);
    const dated = listed
      .map((e) => ({ id: e.id as string, title: e.title, date: e.window?.opensAt ?? e.createdAt }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const chosen = options.examIds === undefined || options.examIds.length === 0 ? dated.slice(-PROGRESS_EXAMS) : dated.filter((e) => options.examIds!.includes(e.id)).slice(-PROGRESS_EXAMS);

    const people = new Map<string, { name: string; results: Record<string, { percent: number; outcome: "qualified" | "failed" | null }> }>();
    const exams: ProgressExam[] = [];
    for (const exam of chosen) {
      const { rows, analytics } = await this.#results.results(actor, toExamId(exam.id));
      const graded = rows.filter((r) => r.state === "graded" && r.percent !== null);
      for (const row of graded) {
        const person = people.get(row.ref) ?? { name: row.name, results: {} };
        if (person.name === "") person.name = row.name;
        person.results[exam.id] = { percent: row.percent!, outcome: row.outcome };
        people.set(row.ref, person);
      }
      exams.push({
        ...exam,
        graded: graded.length,
        meanPercent: graded.length === 0 ? null : round(graded.reduce((s, r) => s + r.percent!, 0) / graded.length),
        qualified: analytics.qualified ?? null,
      });
    }

    const needle = (options.search ?? "").trim().toLowerCase();
    const candidates = [...people.entries()]
      .filter(([ref, p]) => needle === "" || ref.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle))
      .map(([ref, p]): ProgressRow => {
        const sat = exams.map((e) => p.results[e.id]).filter((r) => r !== undefined);
        return {
          ref,
          name: p.name,
          results: p.results,
          average: sat.length === 0 ? null : round(sat.reduce((s, r) => s + r.percent, 0) / sat.length),
          change: sat.length < 2 ? null : round(sat.at(-1)!.percent - sat[0]!.percent),
        };
      })
      .sort((a, b) => a.ref.localeCompare(b.ref, "en", { numeric: true }));
    return { exams, candidates, available: dated.map(({ id, title }) => ({ id, title })) };
  }

  /**
   * Questions worth a second look across the organisation's recent tests,
   * read as the Results tab reads one test: strong candidates did no better
   * than weak ones, very few got it, or almost everyone did. Only questions
   * that appeared on enough graded papers to say.
   */
  async quality(actor: Actor): Promise<{ readonly flags: readonly QuestionFlag[]; readonly questions: number; readonly exams: number }> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const recent = (await this.#exams.listExams(actor))
      .filter((e) => e.attempts.graded >= QUALITY_MINIMUM)
      .sort((a, b) => (b.window?.opensAt ?? b.createdAt).localeCompare(a.window?.opensAt ?? a.createdAt))
      .slice(0, PROGRESS_EXAMS);
    const flags: QuestionFlag[] = [];
    let questions = 0;
    for (const exam of recent) {
      const { analytics } = await this.#results.results(actor, toExamId(exam.id));
      analytics.questions.forEach((q, i) => {
        if (q.facility === null || q.appeared < QUALITY_MINIMUM) return;
        questions++;
        // At either extreme nobody is separated from anybody; say which extreme.
        const reason =
          q.facility > 0.95 ? "too_easy" : q.facility < 0.2 ? "too_hard" : q.discrimination !== null && q.discrimination <= 0 ? "does_not_separate" : null;
        if (reason === null) return;
        flags.push({
          examId: exam.id,
          examTitle: exam.title,
          questionId: q.questionId,
          number: i + 1,
          stem: q.stem,
          kind: q.kind,
          appeared: q.appeared,
          facility: q.facility,
          discrimination: q.discrimination,
          reason,
        });
      });
    }
    // The ones that tell least about a candidate first.
    const order = { does_not_separate: 0, too_hard: 1, too_easy: 2 } as const;
    flags.sort((a, b) => order[a.reason] - order[b.reason] || a.facility - b.facility);
    return { flags, questions, exams: recent.length };
  }
}
