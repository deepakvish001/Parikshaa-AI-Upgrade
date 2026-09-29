/**
 * An editorial written as approaches (ROADMAP §16): brute force, then better,
 * then optimal, each under its own second-level heading. Staff write plain
 * Markdown; an editorial with two or more such headings is shown as tabs, the
 * rest as it is.
 */

export interface Approach {
  readonly title: string;
  readonly body: string;
}

const APPROACH = /^##\s+((?:brute|better|optimal|approach)\b.*)$/i;

/** The text before the first approach, and the approaches; null when it is not written that way. */
export function approachesOf(markdown: string): { readonly intro: string; readonly approaches: readonly Approach[] } | null {
  const lines = markdown.split("\n");
  const starts = lines.flatMap((line, i) => (APPROACH.test(line.trim()) ? [i] : []));
  if (starts.length < 2) return null;
  const approaches = starts.map((start, n) => ({
    title: APPROACH.exec(lines[start]!.trim())![1]!.trim(),
    body: lines
      .slice(start + 1, starts[n + 1] ?? lines.length)
      .join("\n")
      .trim(),
  }));
  return { intro: lines.slice(0, starts[0]).join("\n").trim(), approaches };
}
