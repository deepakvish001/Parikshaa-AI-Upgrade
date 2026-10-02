import { examId as toExamId } from "@parikshaa/core";
import type { ResultsService } from "./results.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Internal marks (docs/PREP-TRACKER.md, V2-12: CL65). A course's internal
 * assessment (CIA) is several tests — two mid-terms, a quiz, an assignment —
 * each worth so many marks, sometimes the best two of three. This puts the
 * results of those exams together into one sheet per student, scaled to each
 * component's marks and rounded the way the university asks, in the shape
 * its portal takes: roll number, name, each component, the total. Handwritten
 * copies count as the online results do (CL63). Nothing is stored: the sheet
 * is worked out from the results each time.
 */

export interface InternalComponent {
  readonly examId: string;
  /** What the column is called; the exam's title if blank. */
  readonly label?: string | undefined;
  /** The marks this component is worth. */
  readonly marks: number;
}

export interface InternalMarksRequest {
  readonly components: readonly InternalComponent[];
  /** Count only the best this many components (their marks must be equal). */
  readonly best?: number | undefined;
  /** "up": a fraction of a mark counts as a whole one; "nearest": half up; "none": two decimals. */
  readonly rounding?: "up" | "nearest" | "none" | undefined;
}

export interface InternalMarks {
  readonly columns: readonly { readonly examId: string; readonly label: string; readonly marks: number }[];
  readonly outOf: number;
  readonly best: number | null;
  readonly rows: readonly {
    readonly ref: string;
    readonly name: string;
    /** Each component's marks, scaled; null where the student did not sit it. */
    readonly marks: readonly (number | null)[];
    readonly total: number;
  }[];
  readonly csv: string;
}

const two = (n: number) => Math.round(n * 100) / 100;
const cell = (value: string | number | null) => {
  if (value === null) return "AB";
  if (typeof value === "number") return String(value);
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
};

export class InternalMarksService {
  readonly #results: ResultsService;
  readonly #exams: ExamService;

  constructor(options: { readonly results: ResultsService; readonly exams: ExamService }) {
    this.#results = options.results;
    this.#exams = options.exams;
  }

  async compute(actor: Actor, request: InternalMarksRequest): Promise<InternalMarks> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const components = request.components;
    if (components.length === 0) throw new AttemptError("invalid_state", "Choose at least one exam");
    if (new Set(components.map((c) => c.examId)).size !== components.length) throw new AttemptError("invalid_state", "Each exam once");
    if (components.some((c) => !(c.marks > 0 && c.marks <= 1000))) throw new AttemptError("invalid_state", "Each component is worth between 1 and 1000 marks");
    const best = request.best ?? null;
    if (best !== null) {
      if (!Number.isInteger(best) || best < 1 || best >= components.length) throw new AttemptError("invalid_state", "Best of: fewer than the number of exams");
      if (new Set(components.map((c) => c.marks)).size !== 1) throw new AttemptError("invalid_state", "For the best of them, each must be worth the same marks");
    }
    const round = (n: number) => (request.rounding === "none" ? two(n) : request.rounding === "nearest" ? Math.round(two(n)) : Math.ceil(two(n)));

    const results = await Promise.all(components.map((c) => this.#results.results(actor, toExamId(c.examId))));
    const columns = components.map((c, i) => ({ examId: c.examId, label: c.label?.trim() || results[i]!.exam.title, marks: c.marks }));
    const students = new Map<string, { name: string; percent: (number | null)[] }>();
    results.forEach((r, i) => {
      for (const row of r.rows) {
        if (row.percent === null || row.state !== "graded") continue;
        const s = students.get(row.ref) ?? { name: "", percent: components.map(() => null) };
        if (s.name === "" && row.name !== "") s.name = row.name;
        // Two attempts at one exam: the better counts.
        s.percent[i] = Math.max(s.percent[i] ?? 0, row.percent);
        students.set(row.ref, s);
      }
    });

    const rows = [...students.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
      .map(([ref, s]) => {
        const marks = s.percent.map((p, i) => (p === null ? null : two((p / 100) * components[i]!.marks)));
        const counted = best === null ? marks.map((m) => m ?? 0) : marks.map((m) => m ?? 0).sort((a, b) => b - a).slice(0, best);
        return { ref, name: s.name, marks, total: round(counted.reduce((a, b) => a + b, 0)) };
      });
    const outOf = best === null ? components.reduce((n, c) => n + c.marks, 0) : best * components[0]!.marks;

    const head = ["Roll No", "Name", ...columns.map((c) => `${c.label} (${c.marks})`), best === null ? `Total (${outOf})` : `Total, best ${best} (${outOf})`];
    const csv = `﻿${[head.map(cell), ...rows.map((r) => [cell(r.ref), cell(r.name), ...r.marks.map(cell), cell(r.total)])].map((r) => r.join(",")).join("\r\n")}\r\n`;
    await this.#exams.recordAudit(actor, "results.internal_exported", components.map((c) => c.examId).join(","), { students: rows.length, outOf });
    return { columns, outOf, best, rows, csv };
  }
}
