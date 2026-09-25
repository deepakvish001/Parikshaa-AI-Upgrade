import type { CandidateCodeQuestion } from "@parikshaa/core/browser";

/** Each language by the name candidates know its toolchain by. */
export const LANGUAGE_NAMES: Record<string, string> = {
  python: "Python 3",
  javascript: "JavaScript (Node)",
  c: "C (GCC)",
  cpp: "C++17 (GCC)",
  java: "Java 17",
};

/** The starter in a language, read defensively: a server from before per-language starters sends only one. */
export const starterIn = (question: CandidateCodeQuestion, language: string): string =>
  question.starters?.[language] ?? (language === question.language ? (question.starter ?? "") : (question.starter ?? ""));

export function readCodeAnswer(value: string, question: CandidateCodeQuestion): { language: string; source: string } {
  try {
    const parsed = JSON.parse(value) as { language?: unknown; source?: unknown };
    if (typeof parsed.language === "string" && typeof parsed.source === "string") {
      return { language: parsed.language, source: parsed.source };
    }
  } catch {
    // Plain source.
  }
  return { language: question.language, source: value === "" ? starterIn(question, question.language) : value };
}

/** A function question's arguments, one per parameter, from a test's input lines. */
export const argumentsOf = (input: string): string[] =>
  input
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

/** Kilobytes as a person reads them. */
export const memory = (kb: number | null | undefined): string | null =>
  kb === null || kb === undefined ? null : kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;

/**
 * A statement's first paragraph, to head the question, and the rest. A
 * statement that opens with anything but a plain paragraph is all body.
 */
export function splitStem(stem: string): { title: string; body: string } {
  const text = stem.replace(/\r\n?/g, "\n").trim();
  const end = text.search(/\n\s*\n/);
  const first = end < 0 ? text : text.slice(0, end);
  if (/^\s*(#|```|~~~|[-*+]\s|\d+[.)]\s|>)/.test(first) || first.includes("\n```")) return { title: "", body: text };
  return { title: first.replace(/\s*\n\s*/g, " "), body: end < 0 ? "" : text.slice(end).trim() };
}
