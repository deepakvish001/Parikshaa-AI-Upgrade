import { PROBLEMS_A } from "./problems-a.js";
import { PROBLEMS_B } from "./problems-b.js";
import { PROBLEMS_C } from "./problems-c.js";
import { PROBLEMS_D } from "./problems-d.js";
import type { Bug, Doubt, EvalProblem } from "./types.js";

/**
 * The eval's 360 cases: for each of the 40 problems, a hint and a review for
 * each wrong program, and each of its three doubts. Hint rungs rotate, so each
 * problem is asked at rungs 1, 2 and 3 and each rung gets 40 cases; rung 4 is
 * the worked solution, which gives nothing away by design.
 */

export const PROBLEMS: readonly EvalProblem[] = [...PROBLEMS_A, ...PROBLEMS_B, ...PROBLEMS_C, ...PROBLEMS_D];

export type Flow = "hint" | "review" | "doubt";

interface Base {
  readonly id: string;
  readonly problem: EvalProblem;
  readonly replyIn: "en" | "hi";
}
export interface HintCase extends Base {
  readonly flow: "hint";
  readonly bug: Bug;
  readonly rung: 1 | 2 | 3;
}
export interface ReviewCase extends Base {
  readonly flow: "review";
  readonly bug: Bug;
}
export interface DoubtCase extends Base {
  readonly flow: "doubt";
  readonly doubt: Doubt;
}
export type EvalCase = HintCase | ReviewCase | DoubtCase;

const RUNGS = [1, 2, 3] as const;

export function casesOf(flow: Flow): EvalCase[] {
  return PROBLEMS.flatMap<EvalCase>((problem, p) => {
    const replyIn = problem.hindi ? ("hi" as const) : ("en" as const);
    if (flow === "doubt") return problem.doubts.map((doubt) => ({ flow, id: `${problem.slug}.${doubt.kind}`, problem, replyIn, doubt }));
    return problem.bugs.map((bug, b) =>
      flow === "hint"
        ? { flow, id: `${problem.slug}.${bug.kind}`, problem, replyIn, bug, rung: RUNGS[(p + b) % 3]! }
        : { flow, id: `${problem.slug}.${bug.kind}`, problem, replyIn, bug },
    );
  });
}

/**
 * The pilot: eight cases a flow, from problems spread over the set (three of
 * them Hindi), each problem giving a different bug or doubt kind in turn.
 */
export const PILOT_PROBLEMS = ["range-sum-queries", "pairs-with-target-sum", "trapped-rainwater", "staircase-ways", "coin-change-ways", "cheapest-route", "nearest-to-zero-pair", "rope-joining"] as const;

export function pilotOf(flow: Flow): EvalCase[] {
  const all = casesOf(flow);
  return PILOT_PROBLEMS.map((slug, i) => {
    const mine = all.filter((c) => c.problem.slug === slug);
    if (mine.length !== 3) throw new Error(`no pilot problem ${slug}`);
    return mine[i % 3]!;
  });
}
