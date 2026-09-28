import { foldAttempt } from "./attempt.js";
import type { LedgerEntry } from "./chain.js";
import type { AttemptState, Exam, ExamCutoff, QuestionId, VivaVerdict } from "./domain.js";
import { allQuestions, paperOf } from "./paper.js";

/**
 * Results and cohort analytics (ROADMAP §6).
 *
 * Everything here is computed from the ledger and the exam — nothing is stored
 * that the chain does not already say — so any figure a recruiter is shown can
 * be recomputed and checked the same way a grade can.
 *
 * The integrity figures describe the cohort's follow-ups: how many were asked,
 * answered and read, and how the readings fell. They are evidence for a person
 * to weigh, attached to no one; there is deliberately no ranking of candidates
 * by suspicion here or anywhere.
 */

export interface AttemptResult {
  readonly attemptId: string;
  readonly candidateId: string;
  readonly state: AttemptState;
  readonly total: number | null;
  /** The marks this candidate's own paper was out of. */
  readonly maxTotal: number;
  readonly percent: number | null;
  readonly startedAt: number;
  readonly submittedAt: number | null;
  readonly durationMs: number | null;
  /** Score and maximum for each question on this candidate's paper, once graded. */
  readonly scores: Readonly<Record<string, { readonly score: number; readonly max: number }>>;
  readonly probes: {
    readonly asked: number;
    readonly replied: number;
    readonly verdicts: Readonly<Partial<Record<VivaVerdict, number>>>;
  };
  readonly voidReason: string | null;
  /**
   * Marks by part of the paper, for an exam with sections: its fixed questions
   * (id "", "General") if it has any, then each section as this candidate drew it.
   * Empty for an exam without sections.
   */
  readonly sections: readonly SectionScore[];
  /** Against the exam's cut-off, once graded. Null without a cut-off, or before grading, or set aside. */
  readonly outcome: Outcome | null;
}

export type Outcome = "qualified" | "failed";

export interface SectionScore {
  readonly id: string;
  readonly title: string;
  readonly score: number | null;
  readonly max: number;
  readonly percent: number | null;
}

/**
 * Whether marks reach the cut-off: the whole paper's, and every section's
 * that has its own. A section worth nothing on this paper cannot hold anyone back.
 */
export function outcomeOf(cutoff: ExamCutoff | undefined, percent: number | null, sections: readonly SectionScore[]): Outcome | null {
  if (cutoff === undefined || percent === null) return null;
  if (percent < cutoff.percent) return "failed";
  for (const [id, minimum] of Object.entries(cutoff.sections ?? {})) {
    const part = sections.find((s) => s.id === id);
    if (part === undefined || part.max === 0 || part.percent === null) continue;
    if (part.percent < minimum) return "failed";
  }
  return "qualified";
}

/**
 * The share of `others` this percent is ahead of, ties counting half: the
 * percentile a scorecard states. Null with nobody to compare against.
 */
export function percentileOf(percent: number, others: readonly number[]): number | null {
  if (others.length === 0) return null;
  const below = others.filter((p) => p < percent).length;
  const level = others.filter((p) => p === percent).length;
  return round(((below + level / 2) * 100) / others.length, 1);
}

/** One attempt's result, from its chain. Null if the chain does not fold. */
export function resultOf(entries: readonly LedgerEntry[], definition: Exam): AttemptResult | null {
  const first = entries[0];
  if (first === undefined || first.event.type !== "attempt_started") return null;
  const paper = paperOf(definition, first.event.questionIds);
  const folded = foldAttempt(entries, { exam: paper });
  if (!folded.ok) return null;
  const { projection } = folded;

  // The last submission: an attempt that was reopened was submitted again.
  let submitted: LedgerEntry | undefined;
  if (projection.attempt.state !== "in_progress") {
    for (const e of entries) if (e.event.type === "attempt_submitted") submitted = e;
  }
  const maxTotal = paper.questions.reduce((sum, q) => sum + q.maxScore, 0);
  const graded = projection.total !== null;
  const scores: Record<string, { score: number; max: number }> = {};
  if (graded) {
    for (const q of paper.questions) scores[q.id] = { score: projection.scores.get(q.id) ?? 0, max: q.maxScore };
  }

  const onPaper = new Set(paper.questions.map((q) => q.id as string));
  const partOf = (id: string, title: string, ids: readonly string[]): SectionScore => {
    const questions = paper.questions.filter((q) => ids.includes(q.id));
    const max = questions.reduce((sum, q) => sum + q.maxScore, 0);
    const score = graded ? questions.reduce((sum, q) => sum + (projection.scores.get(q.id) ?? 0), 0) : null;
    return { id, title, score, max, percent: score === null || max === 0 ? null : round((score * 100) / max, 1) };
  };
  const sections: SectionScore[] = [];
  if ((definition.sections ?? []).length > 0) {
    const fixed = definition.questions.map((q) => q.id as string).filter((id) => onPaper.has(id));
    if (fixed.length > 0) sections.push(partOf("", "General", fixed));
    for (const section of definition.sections ?? []) {
      sections.push(partOf(section.id, section.title, section.pool.map((q) => q.id as string).filter((id) => onPaper.has(id))));
    }
  }
  const percent = projection.total === null || maxTotal === 0 ? null : round((projection.total * 100) / maxTotal, 1);
  const state = projection.attempt.state;

  const verdicts: Partial<Record<VivaVerdict, number>> = {};
  for (const viva of projection.vivas) {
    if (viva.assessment !== null) verdicts[viva.assessment.verdict] = (verdicts[viva.assessment.verdict] ?? 0) + 1;
  }

  return {
    attemptId: projection.attempt.id,
    candidateId: projection.attempt.candidateId,
    state,
    total: projection.total,
    maxTotal,
    percent,
    startedAt: projection.attempt.startedAt,
    submittedAt: submitted?.timestamp ?? null,
    durationMs: submitted === undefined ? null : submitted.timestamp - projection.attempt.startedAt,
    scores,
    probes: {
      asked: projection.vivas.length,
      replied: projection.vivas.filter((v) => v.exchange !== null).length,
      verdicts,
    },
    voidReason: projection.voidReason,
    sections,
    outcome: state === "graded" ? outcomeOf(definition.policy.cutoff, percent, sections) : null,
  };
}

export interface QuestionAnalytics {
  readonly questionId: QuestionId;
  readonly stem: string;
  readonly kind: string;
  readonly maxScore: number;
  /** Graded papers the question appeared on. With sections, not every paper has every question. */
  readonly appeared: number;
  /** Mean share of marks earned, 0 to 1. Low is hard. */
  readonly facility: number | null;
  /**
   * Upper-group mean minus lower-group mean, on this question, where the groups
   * are the top and bottom 27% of candidates by total. Near zero or negative:
   * the question does not separate strong candidates from weak ones, and is
   * worth a second look.
   */
  readonly discrimination: number | null;
}

export interface CohortAnalytics {
  readonly candidates: number;
  readonly graded: number;
  readonly setAside: number;
  readonly meanPercent: number | null;
  readonly medianPercent: number | null;
  /** Graded candidates at or above the cut-off, and below it; null for an exam without one. */
  readonly qualified: number | null;
  readonly failed: number | null;
  /** Graded candidates in each tenth of the range: 0–10%, 10–20% … 90–100%. */
  readonly distribution: readonly number[];
  readonly questions: readonly QuestionAnalytics[];
  readonly time: { readonly medianMinutes: number | null; readonly p90Minutes: number | null };
  readonly integrity: {
    readonly candidatesProbed: number;
    readonly asked: number;
    readonly replied: number;
    readonly read: number;
    readonly verdicts: Readonly<Record<VivaVerdict, number>>;
  };
}

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

function quantile(sorted: readonly number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (at - lo);
}

export function cohortAnalytics(results: readonly AttemptResult[], definition: Exam): CohortAnalytics {
  const graded = results.filter((r) => r.percent !== null && r.state === "graded");
  const percents = graded.map((r) => r.percent!).sort((a, b) => a - b);

  const distribution = Array.from({ length: 10 }, () => 0);
  // Negative marking can take a total below zero; it falls in the lowest band.
  for (const p of percents) distribution[Math.max(0, Math.min(9, Math.floor(p / 10)))]! += 1;

  // Kelley's 27%: large enough groups to be stable, far enough apart to show a difference.
  const byTotal = [...graded].sort((a, b) => b.percent! - a.percent!);
  const group = Math.floor(byTotal.length * 0.27);
  const upper = new Set(byTotal.slice(0, group).map((r) => r.attemptId));
  const lower = new Set(byTotal.slice(byTotal.length - group).map((r) => r.attemptId));

  const questions = allQuestions(definition).map((question): QuestionAnalytics => {
    const ratios = (among: (r: AttemptResult) => boolean) =>
      graded.filter((r) => among(r) && r.scores[question.id] !== undefined).map((r) => r.scores[question.id]!.score / question.maxScore);
    const all = ratios(() => true);
    const up = ratios((r) => upper.has(r.attemptId));
    const down = ratios((r) => lower.has(r.attemptId));
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    return {
      questionId: question.id,
      stem: question.stem.length > 120 ? `${question.stem.slice(0, 120)}…` : question.stem,
      kind: question.kind,
      maxScore: question.maxScore,
      appeared: all.length,
      facility: all.length === 0 ? null : round(mean(all), 3),
      discrimination: up.length < 2 || down.length < 2 ? null : round(mean(up) - mean(down), 3),
    };
  });

  const minutes = results
    .filter((r) => r.durationMs !== null)
    .map((r) => r.durationMs! / 60_000)
    .sort((a, b) => a - b);

  const verdicts: Record<VivaVerdict, number> = { consistent: 0, shallow: 0, inconsistent: 0, inconclusive: 0 };
  for (const r of results) for (const [v, n] of Object.entries(r.probes.verdicts)) verdicts[v as VivaVerdict] += n ?? 0;

  const median = quantile(percents, 0.5);
  const medianMinutes = quantile(minutes, 0.5);
  const p90Minutes = quantile(minutes, 0.9);

  return {
    candidates: results.length,
    graded: graded.length,
    setAside: results.filter((r) => r.state === "void").length,
    meanPercent: percents.length === 0 ? null : round(percents.reduce((s, p) => s + p, 0) / percents.length, 1),
    medianPercent: median === null ? null : round(median, 1),
    qualified: definition.policy.cutoff === undefined ? null : graded.filter((r) => r.outcome === "qualified").length,
    failed: definition.policy.cutoff === undefined ? null : graded.filter((r) => r.outcome === "failed").length,
    distribution,
    questions,
    time: {
      medianMinutes: medianMinutes === null ? null : round(medianMinutes, 1),
      p90Minutes: p90Minutes === null ? null : round(p90Minutes, 1),
    },
    integrity: {
      candidatesProbed: results.filter((r) => r.probes.asked > 0).length,
      asked: results.reduce((s, r) => s + r.probes.asked, 0),
      replied: results.reduce((s, r) => s + r.probes.replied, 0),
      read: Object.values(verdicts).reduce((s, n) => s + n, 0),
      verdicts,
    },
  };
}
