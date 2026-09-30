/**
 * The Sahayak eval's cases (ROADMAP §16, blueprint §14).
 *
 * Each problem is written for this eval, in its own words, with a right
 * program and three wrong ones a learner might write: one off by one, one that
 * overflows a 32-bit integer, and one that is right but too slow. The cases
 * check the problems themselves on the real runner (`validate.ts`): the slow
 * and the overflowing programs agree with the right one on small tests, and
 * each wrong program really fails.
 */

export type BugKind = "off_by_one" | "overflow" | "tle";
export type Language = "python" | "cpp" | "java";

export interface Bug {
  readonly kind: BugKind;
  readonly language: Language;
  readonly source: string;
  /** What is wrong, for the judge only. The tutor never sees it. */
  readonly mistake: string;
  /** This program's time complexity, e.g. "O(n^2)". */
  readonly time: string;
}

export interface Doubt {
  /** push: asks for the whole solution; concept: asks why or how; stuck: describes being stuck. */
  readonly kind: "push" | "concept" | "stuck";
  readonly text: string;
}

export interface Rng {
  int(lo: number, hi: number): number;
  pick<T>(items: readonly T[]): T;
}

export interface EvalProblem {
  readonly slug: string;
  readonly title: string;
  readonly difficulty: "easy" | "medium" | "hard";
  readonly tags: readonly string[];
  /** Markdown. */
  readonly statement: string;
  readonly inputFormat: string;
  readonly outputFormat: string;
  readonly constraints: string;
  /** Visible examples: inputs only; outputs come from the reference. */
  readonly examples: readonly string[];
  /** A small random input, where every program but the off-by-one agrees. */
  readonly small: (r: Rng) => string;
  /** One large input: the slow program runs out of time, the overflowing one goes wrong. */
  readonly big: (r: Rng) => string;
  /** Hand-written hidden edge inputs, if the random ones may miss a bug. */
  readonly edges?: readonly string[];
  /** The approach the tutor may draw on, never to quote whole. */
  readonly editorial: string;
  /** The best time complexity, e.g. "O(n log n)". */
  readonly optimal: string;
  /** A right program, in Python. */
  readonly reference: string;
  readonly bugs: readonly [Bug, Bug, Bug];
  readonly doubts: readonly [Doubt, Doubt, Doubt];
  /** The learner writes, and is answered, in Hindi. */
  readonly hindi?: true;
  /** Per-test time limit when not the default 2 s. */
  readonly timeMs?: number;
}

/** A seeded generator (mulberry32), so every run builds the same tests. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
  };
}

/** n integers in [lo, hi], space-separated. */
export const ints = (r: Rng, n: number, lo: number, hi: number): string => Array.from({ length: n }, () => r.int(lo, hi)).join(" ");
