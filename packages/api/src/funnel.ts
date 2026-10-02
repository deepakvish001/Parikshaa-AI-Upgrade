import type { Stage } from "@parikshaa/store";

/**
 * A drive's funnel (docs/PREP-TRACKER.md, CO38): how many of those who
 * applied reached each round, and where the rest fell away. A student counts
 * at every round up to the one they are at now; one not selected or who
 * withdrew counts as having applied (and as tested, if they sat the test)
 * and then as dropped. Joined is the end of the road.
 */

export const FUNNEL = ["applied", "test", "interview", "offered", "joined"] as const;
export type FunnelStage = (typeof FUNNEL)[number];

export interface Funnel {
  readonly applied: number;
  readonly test: number;
  readonly interview: number;
  readonly offered: number;
  readonly joined: number;
  readonly dropped: number;
}

const RANK: Readonly<Record<Stage, number>> = { applied: 0, test: 1, interview: 2, offered: 3, joined: 4, rejected: -1, withdrawn: -1 };

/** One funnel from each student's current stage and whether they have a test result. */
export function funnelOf(rows: readonly { readonly stage: Stage; readonly tested: boolean }[]): Funnel {
  const counts = { applied: 0, test: 0, interview: 0, offered: 0, joined: 0, dropped: 0 };
  for (const r of rows) {
    counts.applied++;
    const rank = RANK[r.stage];
    if (rank < 0) {
      counts.dropped++;
      if (r.tested) counts.test++;
      continue;
    }
    if (rank >= 1 || r.tested) counts.test++;
    if (rank >= 2) counts.interview++;
    if (rank >= 3) counts.offered++;
    if (rank >= 4) counts.joined++;
  }
  return counts;
}
