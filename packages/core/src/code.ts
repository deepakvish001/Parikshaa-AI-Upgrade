import type { CodeQuestion, CodeTest } from "./domain.js";

/**
 * Code answers (ROADMAP §4).
 *
 * The languages the runner can build, which a question may offer. The runner
 * keeps its own copy of this list — it is deliberately a separate, small
 * package with no dependency on this one — and a test in the API checks the two
 * agree.
 */
export const CODE_LANGUAGES = ["python", "javascript", "c", "cpp", "java"] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

/**
 * What a candidate submits for a code question: the source, and which of the
 * question's languages it is in. Stored in the ledger as JSON in the answer
 * string, so the chain's shape does not change.
 */
export interface CodeAnswer {
  readonly language: string;
  readonly source: string;
}

export const encodeCodeAnswer = (answer: CodeAnswer): string =>
  JSON.stringify({ language: answer.language, source: answer.source });

/**
 * Read a code answer. An answer that is not the JSON above — one written before
 * candidates could choose a language — is the source itself, in the question's
 * default language.
 */
export function decodeCodeAnswer(answer: string, question: CodeQuestion): CodeAnswer {
  try {
    const parsed: unknown = JSON.parse(answer);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { language?: unknown }).language === "string" &&
      typeof (parsed as { source?: unknown }).source === "string"
    ) {
      return parsed as CodeAnswer;
    }
  } catch {
    // Not JSON: plain source.
  }
  return { language: question.language, source: answer };
}

/** The languages a candidate may answer this question in. */
export const languagesOf = (question: CodeQuestion): readonly string[] =>
  question.languages !== undefined && question.languages.length > 0 ? question.languages : [question.language];

/** Marks for a set of passed tests: the question's marks, shared by weight, to two decimals. */
export function scoreTests(question: CodeQuestion, passedIds: ReadonlySet<string>): number {
  const tests: readonly CodeTest[] = question.tests ?? [];
  const total = tests.reduce((sum, t) => sum + t.weight, 0);
  if (total === 0) return 0;
  const earned = tests.filter((t) => passedIds.has(t.id)).reduce((sum, t) => sum + t.weight, 0);
  return Math.round((question.maxScore * earned * 100) / total) / 100;
}
