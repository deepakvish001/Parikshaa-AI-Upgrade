/**
 * Code playback (docs/F1-GO-LIVE-PLAN.md §5.4, G4): how a code answer was
 * written, as the editor's edits in order. The browser records them, the
 * server keeps them sealed, a reviewer replays them.
 */

/** At offset `at`, `del` characters removed and `ins` put in, at time `t`. `reset`: the whole text became `ins`. */
export interface TimelineOp {
  readonly t: number;
  readonly at: number;
  readonly del: number;
  readonly ins: string;
  readonly paste?: boolean | undefined;
  readonly reset?: boolean | undefined;
}

/** The one edit that turns `before` into `after`: what lies between their common start and common end. */
export function diffOp(before: string, after: string, t: number): TimelineOp | null {
  if (before === after) return null;
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  let end = 0;
  while (end < max - start && before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)) end++;
  return { t, at: start, del: before.length - start - end, ins: after.slice(start, after.length - end) };
}

/** Apply edits in order: what a reviewer's playback shows at each step. */
export function replay(ops: readonly TimelineOp[], upTo = ops.length): string {
  let text = "";
  for (const op of ops.slice(0, upTo)) text = op.reset === true ? op.ins : text.slice(0, op.at) + op.ins + text.slice(op.at + op.del);
  return text;
}

/** A paste this long is shown to a reviewer as a signal: never a finding. */
export const LARGE_PASTE = 200;

