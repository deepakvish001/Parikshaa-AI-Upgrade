import { allQuestions, examId as toExamId } from "@parikshaa/core";
import { staffScope, type LedgerStore, type OutcomeMap, type OutcomeStore } from "@parikshaa/store";
import type { ResultsService } from "./results.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Course outcome attainment (docs/PREP-TRACKER.md, V2-12 CL47), the way NBA
 * and NAAC ask for it. Each question is mapped to the course outcomes it
 * assesses; a candidate attains a CO when they earn at least the threshold
 * share of that CO's marks on their paper. A CO's attainment level is 3 when
 * at least 70% of candidates attain it, 2 at 60%, 1 at 50%, else 0. A
 * programme outcome's level is the average of its COs' levels weighted by
 * the CO–PO matrix (strengths 1 to 3), as NBA's SAR describes.
 */

export const LEVELS: readonly (readonly [number, number])[] = [
  [70, 3],
  [60, 2],
  [50, 1],
];

const CODE = /^(CO|PO|PSO)\d{1,2}$/;
const levelOf = (percent: number) => LEVELS.find(([min]) => percent >= min)?.[1] ?? 0;
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface Attainment {
  readonly threshold: number;
  readonly candidates: number;
  readonly courseOutcomes: readonly { readonly co: string; readonly questions: number; readonly candidates: number; readonly attained: number; readonly percent: number; readonly level: number }[];
  readonly programmeOutcomes: readonly { readonly po: string; readonly level: number }[];
}

export class OutcomeService {
  readonly #outcomes: OutcomeStore;
  readonly #store: LedgerStore;
  readonly #results: ResultsService;
  readonly #exams: ExamService;
  readonly #now: () => number;

  constructor(options: { readonly outcomes: OutcomeStore; readonly store: LedgerStore; readonly results: ResultsService; readonly exams: ExamService; readonly now?: () => number }) {
    this.#outcomes = options.outcomes;
    this.#store = options.store;
    this.#results = options.results;
    this.#exams = options.exams;
    this.#now = options.now ?? (() => Date.now());
  }

  async #questions(actor: Actor, examId: string) {
    const exam = await this.#store.loadExam(staffScope(actor.orgId), toExamId(examId));
    if (exam === null) throw new AttemptError("not_found", `No such exam: ${examId}`);
    return allQuestions(exam).map((q, i) => ({ id: q.id as string, number: i + 1, stem: q.stem.replace(/\s+/g, " ").slice(0, 120), maxScore: q.maxScore }));
  }

  async get(actor: Actor, examId: string) {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const [questions, map] = await Promise.all([this.#questions(actor, examId), this.#outcomes.get(actor.orgId, examId)]);
    return { questions, ...map };
  }

  async set(actor: Actor, examId: string, map: OutcomeMap): Promise<void> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    const questions = new Set((await this.#questions(actor, examId)).map((q) => q.id));
    const mapping: Record<string, string[]> = {};
    for (const [questionId, cos] of Object.entries(map.mapping)) {
      if (!questions.has(questionId)) throw new AttemptError("not_found", `No question ${questionId} in this exam`);
      const clean = [...new Set(cos.map((c) => c.trim().toUpperCase()).filter((c) => c !== ""))];
      const bad = clean.find((c) => !/^CO\d{1,2}$/.test(c));
      if (bad !== undefined) throw new AttemptError("invalid_state", `"${bad}" is not a course outcome like CO1`);
      if (clean.length > 0) mapping[questionId] = clean;
    }
    const matrix: Record<string, Record<string, number>> = {};
    for (const [co, row] of Object.entries(map.matrix)) {
      const c = co.trim().toUpperCase();
      if (!/^CO\d{1,2}$/.test(c)) throw new AttemptError("invalid_state", `"${co}" is not a course outcome like CO1`);
      for (const [po, strength] of Object.entries(row)) {
        const p = po.trim().toUpperCase();
        if (!CODE.test(p) || p.startsWith("CO")) throw new AttemptError("invalid_state", `"${po}" is not a programme outcome like PO1 or PSO2`);
        if (![1, 2, 3].includes(strength)) throw new AttemptError("invalid_state", "A CO–PO strength is 1, 2 or 3");
        (matrix[c] ??= {})[p] = strength;
      }
    }
    if (!Number.isInteger(map.threshold) || map.threshold < 1 || map.threshold > 100) throw new AttemptError("invalid_state", "The threshold is a percentage from 1 to 100");
    await this.#outcomes.set(actor.orgId, examId, { mapping, matrix, threshold: map.threshold }, new Date(this.#now()));
    await this.#exams.recordAudit(actor, "exam.outcomes_set", examId, { courseOutcomes: new Set(Object.values(mapping).flat()).size });
  }

  async attainment(actor: Actor, examId: string): Promise<Attainment> {
    if (!can(actor, "attempt:review")) throw new Forbidden("attempt:review");
    const map = await this.#outcomes.get(actor.orgId, examId);
    const { rows } = await this.#results.results(actor, toExamId(examId));
    const graded = rows.filter((r) => r.state === "graded");
    const cos = [...new Set(Object.values(map.mapping).flat())].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    const courseOutcomes = cos.map((co) => {
      const questionIds = Object.entries(map.mapping).filter(([, list]) => list.includes(co)).map(([id]) => id);
      let candidates = 0;
      let attained = 0;
      for (const row of graded) {
        // Only the questions this candidate's paper set: a pool draws different ones.
        const set = questionIds.map((id) => row.scores[id]).filter((s): s is { readonly score: number; readonly max: number } => s !== undefined && s.max > 0);
        if (set.length === 0) continue;
        candidates++;
        const got = set.reduce((n, s) => n + Math.max(0, s.score), 0);
        const max = set.reduce((n, s) => n + s.max, 0);
        if ((got * 100) / max >= map.threshold) attained++;
      }
      const percent = candidates === 0 ? 0 : round1((attained * 100) / candidates);
      return { co, questions: questionIds.length, candidates, attained, percent, level: candidates === 0 ? 0 : levelOf(percent) };
    });
    const level = new Map(courseOutcomes.map((c) => [c.co, c.level]));
    const pos = [...new Set(Object.values(map.matrix).flatMap((row) => Object.keys(row)))].sort((a, b) => (a.startsWith("PSO") === b.startsWith("PSO") ? a.localeCompare(b, "en", { numeric: true }) : a.startsWith("PSO") ? 1 : -1));
    const programmeOutcomes = pos.map((po) => {
      let weighted = 0;
      let weight = 0;
      for (const [co, row] of Object.entries(map.matrix)) {
        const strength = row[po];
        if (strength === undefined || !level.has(co)) continue;
        weighted += strength * level.get(co)!;
        weight += strength;
      }
      return { po, level: weight === 0 ? 0 : Math.round((weighted / weight) * 100) / 100 };
    });
    return { threshold: map.threshold, candidates: graded.length, courseOutcomes, programmeOutcomes };
  }
}
