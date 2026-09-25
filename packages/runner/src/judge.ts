/**
 * Deciding whether an output is right.
 *
 * Most questions want the exact output, forgiving only line endings and
 * trailing space. Some cannot: an answer in floating point is right within a
 * tolerance, a list may come in any order, and some problems have many right
 * answers. Each is a checker a question chooses. A problem with many right
 * answers brings its own checker program, which the runner runs in the
 * sandbox (see `execute.ts`); everything else is decided here, without
 * running anything.
 */

export type Checker =
  /** Exact, after normalising line endings and trailing space. The default. */
  | { readonly kind: "exact" }
  /** The same words in the same order, however they are spaced or split across lines. */
  | { readonly kind: "tokens" }
  /** Word by word; words that are both numbers are equal within `tolerance`, absolute or relative. */
  | { readonly kind: "numbers"; readonly tolerance: number }
  /** The same lines in any order. */
  | { readonly kind: "unordered" }
  /**
   * One JSON value: what a function returned (function questions). Numbers are
   * equal within `tolerance`; arrays may be in any order at the top level
   * (`"top"`) or at every level (`"deep"`).
   */
  | { readonly kind: "json"; readonly tolerance: number; readonly unordered: "none" | "top" | "deep" }
  /**
   * A program by the question's author, in Python 3, run as
   * `checker.py input expected output`: exit 0 accepts, exit 1 rejects, and
   * anything it prints is its reason.
   */
  | { readonly kind: "custom"; readonly source: string };

export const EXACT: Checker = { kind: "exact" };

/** Output as a judge compares it: LF endings, no trailing space on a line, no trailing blank lines. */
export const normalise = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");

const words = (text: string): string[] => text.split(/\s+/).filter((w) => w !== "");

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** Equal within `tolerance`, absolutely or relative to the expected value. */
export const near = (expected: number, actual: number, tolerance: number): boolean => {
  if (expected === actual) return true;
  if (!Number.isFinite(expected) || !Number.isFinite(actual)) return false;
  const difference = Math.abs(expected - actual);
  return difference <= tolerance || difference <= tolerance * Math.abs(expected);
};

/** A canonical text for a JSON value, with every array sorted, so equal multisets read the same. */
const canonical = (value: unknown, deep: boolean): string => {
  if (Array.isArray(value)) {
    const parts = value.map((v) => canonical(v, deep));
    return `[${deep ? parts.sort().join(",") : parts.join(",")}]`;
  }
  return JSON.stringify(value);
};

const sortedArray = (value: unknown[], deep: boolean): unknown[] =>
  value
    .map((v) => (deep && Array.isArray(v) ? sortedArray(v, deep) : v))
    .map((v) => ({ v, key: canonical(v, deep) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((x) => x.v);

function jsonEqual(expected: unknown, actual: unknown, tolerance: number, unordered: "none" | "top" | "deep", depth = 0): boolean {
  if (typeof expected === "number" && typeof actual === "number") return near(expected, actual, tolerance);
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return false;
    const sort = unordered === "deep" || (unordered === "top" && depth === 0);
    const [e, a] = sort ? [sortedArray(expected, unordered === "deep"), sortedArray(actual, unordered === "deep")] : [expected, actual];
    return e.every((x, i) => jsonEqual(x, a[i], tolerance, unordered, depth + 1));
  }
  if (expected !== null && actual !== null && typeof expected === "object" && typeof actual === "object") {
    const keys = Object.keys(expected);
    if (keys.length !== Object.keys(actual).length) return false;
    return keys.every((k) => k in actual && jsonEqual((expected as Record<string, unknown>)[k], (actual as Record<string, unknown>)[k], tolerance, unordered, depth + 1));
  }
  return expected === actual;
}

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/**
 * Whether `actual` is right, for every checker but a custom one, which needs
 * running and is the sandbox's job.
 */
export function accepts(checker: Exclude<Checker, { kind: "custom" }>, expected: string, actual: string): boolean {
  switch (checker.kind) {
    case "exact":
      return normalise(actual) === normalise(expected);
    case "tokens": {
      const [e, a] = [words(expected), words(actual)];
      return e.length === a.length && e.every((w, i) => w === a[i]);
    }
    case "numbers": {
      const [e, a] = [words(expected), words(actual)];
      return (
        e.length === a.length &&
        e.every((w, i) => (NUMBER.test(w) && NUMBER.test(a[i]!) ? near(Number(w), Number(a[i]), checker.tolerance) : w === a[i]))
      );
    }
    case "unordered": {
      const lines = (text: string) => normalise(text).split("\n").sort();
      const [e, a] = [lines(expected), lines(actual)];
      return e.length === a.length && e.every((l, i) => l === a[i]);
    }
    case "json": {
      const [e, a] = [parseJson(expected.trim()), parseJson(actual.trim())];
      if (!e.ok || !a.ok) return false;
      return jsonEqual(e.value, a.value, checker.tolerance, checker.unordered);
    }
  }
}

/**
 * A function question's program prints whatever the candidate's code prints,
 * then this marker, then the function's result. The marker splits the two: what
 * came before is shown as the program's own output, what came after is judged.
 */
export function splitResult(stdout: string, marker: string): { readonly printed: string; readonly result: string | null } {
  const at = stdout.lastIndexOf(marker);
  if (at < 0) return { printed: stdout, result: null };
  const printed = stdout.slice(0, at).replace(/\n$/, "");
  return { printed, result: stdout.slice(at + marker.length).trim() };
}
