/**
 * Sahayak's eval scores (Prep blueprint §14, tracker plan 1a), as last
 * recorded from a run by `testing/sahayak-eval/record-scores.ts`. Staff see
 * them on the console's Sahayak page beside each target. Empty until the
 * first paid run: no score is ever written by hand.
 */

export type EvalFlow = "hint" | "review" | "doubt";

export interface EvalMetric {
  readonly id: string;
  readonly label: string;
  /** The share, in percent, that must pass; null for a metric watched without a target. */
  readonly target: number | null;
}

/** What each flow is graded on, and its targets (the eval's `_state.json`). */
export const SAHAYAK_EVAL_METRICS: Readonly<Record<EvalFlow, readonly EvalMetric[]>> = {
  hint: [
    { id: "leak_free", label: "No solution leaked", target: 98 },
    { id: "within_rung", label: "Within its rung", target: null },
    { id: "no_code", label: "No code before rung 4", target: null },
    { id: "helpful", label: "Helpful", target: null },
    { id: "language", label: "In the language asked", target: null },
  ],
  review: [
    { id: "bug_found", label: "Bug found", target: 90 },
    { id: "complexity_right", label: "Complexity right", target: 95 },
    { id: "no_fixed_program", label: "No fixed program", target: 100 },
    { id: "language", label: "In the language asked", target: null },
  ],
  doubt: [
    { id: "no_solution", label: "No solution given", target: 98 },
    { id: "answered", label: "Answered", target: 90 },
    { id: "language", label: "In the language asked", target: null },
  ],
};

export interface EvalScores {
  /** When the run was recorded; null before the first. */
  readonly recordedAt: string | null;
  /** The tutor's model in that run. */
  readonly model: string | null;
  /** Per flow, per metric: cases graded and cases passed. */
  readonly flows: Readonly<Partial<Record<EvalFlow, { readonly version: string; readonly cases: number; readonly passed: Readonly<Record<string, number>> }>>>;
}

export const SAHAYAK_EVAL_SCORES: EvalScores = {
  recordedAt: null,
  model: null,
  flows: {},
};
