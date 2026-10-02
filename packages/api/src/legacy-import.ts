import { questionId, type CodeQuestion, type CodeTest, type OrgId, type Question, validateQuestion } from "@parikshaa/core";
import { practiceStaff, type Difficulty, type PracticeStore, type ProblemDraft, type SqlExecutor } from "@parikshaa/store";

/**
 * Problems from the owner's earlier app (docs/PREP-TRACKER.md, Faisle: the
 * Singapore Supabase project), brought onto a practice site. That app kept a
 * problem in four tables: the statement, its tests (sample or hidden, standard
 * input and output), starter code and a reference solution per language.
 *
 * Each becomes an ordinary practice problem, a program that reads standard
 * input, judged by the same tests. Nothing is lost quietly: a problem that
 * cannot be judged here (no tests, no hidden test, SQL in the old format) still
 * comes in, unpublished, with the reason in the report, for an author to finish.
 * Run again, it updates what it brought before and adds nothing twice: an
 * imported problem says where it came from, `legacy:<slug>`, where a problem
 * taken from the question bank names its bank question.
 */

export interface LegacyProblem {
  readonly slug: string;
  readonly title: string;
  readonly difficulty: string;
  readonly topics: readonly string[] | null;
  readonly description: string;
  readonly examples: unknown;
  readonly constraints: readonly string[] | null;
  readonly hints: readonly string[] | null;
  readonly cpuTimeLimitSec: number | string | null;
  readonly memoryLimitKb: number | null;
  readonly published: boolean;
}

export interface LegacyTest {
  readonly kind: string;
  readonly input: string;
  readonly expected: string;
  readonly ord: number;
}

export interface LegacyCode {
  readonly lang: string;
  readonly code: string;
}

export interface LegacyBundle {
  readonly problem: LegacyProblem;
  readonly tests: readonly LegacyTest[];
  readonly starters: readonly LegacyCode[];
  readonly solutions: readonly LegacyCode[];
}

export interface ImportedProblem {
  readonly draft: Omit<ProblemDraft, "position">;
  /** Why it is unpublished, or what was left behind; empty when it came in whole. */
  readonly issues: readonly string[];
}

/** The old app's language names, as the runner knows them. Go and TypeScript are not run here. */
const LANGUAGE: Readonly<Record<string, string>> = { python3: "python", python: "python", cpp: "cpp", c: "c", java: "java", javascript: "javascript", sql: "sql" };
const PROGRAM_LANGUAGES = ["python", "cpp", "java", "c", "javascript"] as const;
const FENCE: Readonly<Record<string, string>> = { python: "python", cpp: "cpp", c: "c", java: "java", javascript: "javascript", sql: "sql" };
const MAX_STARTER = 64 * 1024;

export const legacyQuestionId = (slug: string) => `legacy-${slug}`;
export const legacyOrigin = (slug: string) => `legacy:${slug}`;

/** A slug the practice site accepts: lower case, letters, digits and single dashes, 2 to 80 long. */
export function legacySlug(slug: string): string {
  const clean = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
  return clean.length >= 2 ? clean : `p-${clean || "x"}`;
}

const difficultyOf = (d: string): Difficulty => (d === "easy" || d === "hard" ? d : "medium");

/** "Input format:" and "Output format:" lines move out of the statement into their own sections. */
function splitStatement(description: string): { stem: string; inputFormat: string; outputFormat: string } {
  let inputFormat = "";
  let outputFormat = "";
  const kept: string[] = [];
  for (const line of description.split("\n")) {
    const input = /^\s*input format\s*:\s*(.*)$/i.exec(line);
    const output = /^\s*output format\s*:\s*(.*)$/i.exec(line);
    if (input !== null && inputFormat === "") inputFormat = input[1]!.trim();
    else if (output !== null && outputFormat === "") outputFormat = output[1]!.trim();
    else kept.push(line);
  }
  return { stem: kept.join("\n").replace(/\n{3,}/g, "\n\n").trim(), inputFormat, outputFormat };
}

/** The old app's worked examples, as Markdown, for a problem with no sample test to show instead. */
function examplesMarkdown(examples: unknown): string {
  if (!Array.isArray(examples)) return "";
  const parts = examples.flatMap((e, i) => {
    if (typeof e !== "object" || e === null) return [];
    const { input, output, explanation } = e as { input?: unknown; output?: unknown; explanation?: unknown };
    if (typeof input !== "string" || typeof output !== "string") return [];
    const lines = [`**Example ${i + 1}**`, "", "```", `Input: ${input}`, `Output: ${output.replace(/\\n/g, "\n")}`, "```"];
    if (typeof explanation === "string" && explanation.trim() !== "") lines.push("", explanation.trim());
    return [lines.join("\n")];
  });
  return parts.join("\n\n");
}

export function legacyProblem(bundle: LegacyBundle): ImportedProblem {
  const { problem } = bundle;
  const issues: string[] = [];
  const slug = legacySlug(problem.slug);
  const { stem: statement, inputFormat, outputFormat } = splitStatement(problem.description ?? "");

  const solutions = bundle.solutions.flatMap((s) => (LANGUAGE[s.lang] === undefined || s.code.trim() === "" ? [] : [{ lang: LANGUAGE[s.lang]!, code: s.code }]));
  const isSql = solutions.length > 0 && solutions.every((s) => s.lang === "sql");

  const tests: CodeTest[] = [...bundle.tests]
    .sort((a, b) => a.ord - b.ord)
    .map((t, i) => ({ id: `t${i + 1}`, input: t.input, expected: t.expected, hidden: t.kind !== "sample", weight: 1 }));

  const starters: Record<string, string> = {};
  for (const s of bundle.starters) {
    const lang = LANGUAGE[s.lang];
    if (lang === undefined || lang === "sql" || s.code.trim() === "") continue;
    if (s.code.length > MAX_STARTER) {
      issues.push(`starter code in ${lang} is over 64 KB and was left out`);
      continue;
    }
    if (starters[lang] === undefined || s.lang === "python3") starters[lang] = s.code;
  }
  const dropped = [...new Set(bundle.starters.map((s) => s.lang).filter((l) => LANGUAGE[l] === undefined))].sort();
  if (dropped.length > 0) issues.push(`starter code in ${dropped.join(", ")} was left out: the runner does not run it`);

  const samples = tests.filter((t) => !t.hidden).length;
  const examples = samples === 0 ? examplesMarkdown(problem.examples) : "";
  const stem = [statement || problem.title, examples].filter((p) => p !== "").join("\n\n");
  const constraints = (problem.constraints ?? []).filter((c) => c.trim() !== "").map((c) => `- ${c.trim()}`).join("\n");

  const seconds = Number(problem.cpuTimeLimitSec ?? 0);
  const timeMs = Number.isFinite(seconds) && seconds > 0 ? Math.min(10_000, Math.max(100, Math.round(seconds * 1000))) : undefined;
  const memoryMb = problem.memoryLimitKb !== null && problem.memoryLimitKb > 0 ? Math.min(1024, Math.max(32, Math.round(problem.memoryLimitKb / 1024))) : undefined;

  let publishable = problem.published;
  if (!problem.published) issues.push("it was unpublished in the old app");
  if (isSql) {
    publishable = false;
    issues.push("a SQL problem: its tests must be rewritten as tables, as this site's SQL problems are");
  } else if (tests.length === 0) {
    publishable = false;
    issues.push("it has no tests: add them before publishing");
  } else if (tests.every((t) => !t.hidden)) {
    publishable = false;
    issues.push("every test is a sample: add a hidden test before publishing");
  }

  const language = isSql ? "sql" : "python";
  const question: CodeQuestion = {
    id: questionId(legacyQuestionId(slug)),
    kind: "code",
    stem,
    maxScore: 10,
    // Judged by its tests; one with none waits, unpublished, for an author.
    rubric: tests.length > 0 && !isSql ? [] : [{ id: "correct", description: "A correct, efficient solution to the problem as stated.", weight: 1 }],
    language,
    languages: isSql ? ["sql"] : [...PROGRAM_LANGUAGES],
    ...(Object.keys(starters).length > 0 && !isSql ? { starters } : {}),
    ...(inputFormat === "" ? {} : { inputFormat }),
    ...(outputFormat === "" ? {} : { outputFormat }),
    ...(constraints === "" ? {} : { constraints }),
    ...(isSql ? {} : { tests }),
    ...(timeMs === undefined && memoryMb === undefined ? {} : { limits: { ...(timeMs === undefined ? {} : { timeMs }), ...(memoryMb === undefined ? {} : { memoryMb }) } }),
  };

  const invalid = validateQuestion(question as Question, slug);
  if (invalid.length > 0) {
    publishable = false;
    issues.push(...invalid.map((p) => p.message));
  }

  const hints = (problem.hints ?? []).map((h) => h.trim()).filter((h) => h !== "");
  const reference = solutions.find((s) => s.lang === "python") ?? solutions[0];
  const editorial = [
    ...(hints.length === 0 ? [] : ["## Hints", ...hints.map((h, i) => `${i + 1}. ${h}`), ""]),
    ...(reference === undefined ? [] : ["## Reference solution", "", "```" + FENCE[reference.lang], reference.code.trim(), "```"]),
  ]
    .join("\n")
    .trim();

  return {
    draft: {
      slug,
      title: problem.title.trim().slice(0, 160) || slug,
      question,
      difficulty: difficultyOf(problem.difficulty),
      tags: [...new Set((problem.topics ?? []).map((t) => t.trim()).filter((t) => t !== ""))],
      editorial,
      hint: hints[0] ?? "",
      fromBank: legacyOrigin(slug),
      published: publishable,
    },
    issues,
  };
}

/** Reads the old app's problems, oldest first. */
export async function readLegacy(source: SqlExecutor): Promise<LegacyBundle[]> {
  const problems = await source.query<{
    slug: string;
    title: string;
    difficulty: string;
    topics: string[] | null;
    description: string;
    examples: unknown;
    constraints: string[] | null;
    hints: string[] | null;
    cpu_time_limit_sec: string | number | null;
    memory_limit_kb: number | null;
    is_published: boolean | null;
  }>(
    `SELECT slug, title, difficulty, topics, description, examples, constraints, hints, cpu_time_limit_sec, memory_limit_kb, is_published
       FROM coding_problems ORDER BY created_at, slug`,
  );
  const tests = await source.query<{ problem_slug: string; kind: string; input: string; expected: string; ord: number }>(
    `SELECT problem_slug, kind, input, expected, ord FROM coding_problem_tests ORDER BY problem_slug, ord`,
  );
  const starters = await source.query<{ problem_slug: string; lang_id: string; code: string }>(`SELECT problem_slug, lang_id, code FROM coding_problem_starter_code`);
  const solutions = await source.query<{ problem_slug: string; lang_id: string; code: string }>(`SELECT problem_slug, lang_id, code FROM coding_problem_reference_solutions`);

  const group = <T extends { problem_slug: string }>(rows: readonly T[]) => {
    const by = new Map<string, T[]>();
    for (const r of rows) by.set(r.problem_slug, [...(by.get(r.problem_slug) ?? []), r]);
    return by;
  };
  const testsBy = group(tests);
  const startersBy = group(starters);
  const solutionsBy = group(solutions);
  return problems.map((p) => ({
    problem: {
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      topics: p.topics,
      description: p.description,
      examples: p.examples,
      constraints: p.constraints,
      hints: p.hints,
      cpuTimeLimitSec: p.cpu_time_limit_sec,
      memoryLimitKb: p.memory_limit_kb,
      published: p.is_published !== false,
    },
    tests: (testsBy.get(p.slug) ?? []).map((t) => ({ kind: t.kind, input: t.input ?? "", expected: t.expected ?? "", ord: t.ord })),
    starters: (startersBy.get(p.slug) ?? []).map((s) => ({ lang: s.lang_id, code: s.code ?? "" })),
    solutions: (solutionsBy.get(p.slug) ?? []).map((s) => ({ lang: s.lang_id, code: s.code ?? "" })),
  }));
}

export interface ImportReport {
  readonly problems: number;
  readonly published: number;
  readonly added: number;
  readonly updated: number;
  /** Problems that came in with something to finish, and what. */
  readonly issues: readonly { readonly slug: string; readonly issues: readonly string[] }[];
}

/** Brings the old app's problems onto a site. With `dryRun`, reads and checks everything and writes nothing. */
export async function importLegacy(
  source: SqlExecutor,
  practice: PracticeStore,
  orgId: OrgId,
  options: { readonly dryRun?: boolean } = {},
): Promise<ImportReport> {
  const bundles = await readLegacy(source);
  const existing = await practice.problems(practiceStaff(orgId));
  const byOrigin = new Map(existing.flatMap((p) => (p.fromBank?.startsWith("legacy:") ? [[p.fromBank, p] as const] : [])));
  const taken = new Set(existing.map((p) => p.slug));
  let position = existing.length;
  let added = 0;
  let updated = 0;
  let published = 0;
  const issues: { slug: string; issues: readonly string[] }[] = [];

  for (const bundle of bundles) {
    const imported = legacyProblem(bundle);
    if (imported.draft.published) published++;
    if (imported.issues.length > 0) issues.push({ slug: imported.draft.slug, issues: imported.issues });
    const before = byOrigin.get(imported.draft.fromBank!);
    if (before !== undefined) {
      if (options.dryRun !== true) await practice.updateProblem(orgId, before.id, { ...imported.draft, slug: before.slug, position: before.position });
      updated++;
      continue;
    }
    // A problem of the site's own may hold the address already: the import takes the next free one.
    let slug = imported.draft.slug;
    for (let n = 2; taken.has(slug); n++) slug = `${imported.draft.slug.slice(0, 74).replace(/-+$/, "")}-${n}`;
    taken.add(slug);
    if (options.dryRun !== true) await practice.addProblem(orgId, { ...imported.draft, slug, position: position++ });
    added++;
  }
  return { problems: bundles.length, published, added, updated, issues };
}
