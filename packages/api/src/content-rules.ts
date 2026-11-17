import type { ContentType } from "@parikshaa/store";
import type { ContentFile, DesignItem, DsaItem, LessonItem, McqItem, ProjectItem, SqlItem } from "./content/types.js";

/**
 * Gate 2 of a content upload (docs/content/CONTENT-FORMAT.md §11): what an
 * item means, once its schema has passed. The same rules as the offline
 * validator, `scripts/content-validate.mjs`, so an item that passes there
 * passes here: slugs, difficulty and level, test groups and totals, a
 * reference in every language, the editorial's headings and markers, MCQ keys,
 * rubric weights. And gate 11, duplicates: within the bundle and against what
 * the site has already.
 *
 * Every message is for the author: it says what is wrong and, where it can,
 * what to do.
 */

export interface RuleReport {
  readonly errors: string[];
  readonly warnings: string[];
}

const LANGS = ["c", "cpp", "java", "python", "javascript"] as const;
const PROBLEM_SITES =
  /(leetcode\.com|geeksforgeeks\.org|interviewbit\.com|hackerrank\.com|codeforces\.com|codechef\.com|hackerearth\.com|indiabix\.com|takeuforward\.org|naukri\.com\/code360|codingninjas\.com|spoj\.com|atcoder\.jp|algoexpert\.io|educative\.io|neetcode\.io)/i;
const CLICHES = ["delve", "tapestry", "in today's fast-paced", "it's worth noting", "it is worth noting", "as an ai", "embark on", "unlock the power", "game-changer", "seamlessly", "in the realm of"];
const EDITORIAL_HEADINGS: Record<string, readonly string[]> = {
  en: ["Problem", "Understand The Problem", "Coming Up With The Solution", "Writing The Solution", "Testing / Reflection"],
  "hi-Latn": ["Samasya", "Samasya samjho", "Hal tak pahuncho", "Code likho", "Jaancho aur seekho"],
};
const APTITUDE_HEADINGS: Record<string, readonly string[]> = { en: ["Understand", "Plan", "Solve", "Check"], "hi-Latn": ["Samjho", "Plan", "Hal", "Jaancho"] };
const MIN_TESTS: Record<string, number> = { L0: 15, L1: 20, L2: 30, L3: 40, L4: 50 };
const LEVEL_DIFFICULTY: Record<string, string> = { L0: "easy", L1: "easy", L2: "medium", L3: "hard", L4: "hard" };
const BRUTE_GROUPS = ["samples", "minimal", "edge", "random_small", "output_edge"];

const stripCode = (md: string) => md.replace(/```[\s\S]*?```/g, " ");
export const countWords = (md: string) =>
  stripCode(md)
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w)).length;
const headings = (md: string, level: number) =>
  stripCode(md)
    .split("\n")
    .filter((l) => l.startsWith(`${"#".repeat(level)} `))
    .map((l) => l.slice(level + 1).trim());
const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Whether the brute solution is held to a test group (CONTENT-FORMAT §4). */
export const bruteHeldTo = (group: { readonly group: string; readonly brute?: boolean }) => group.brute ?? BRUTE_GROUPS.includes(group.group);

function checkEditorial(md: string, length: { form: string; target_words: number } | undefined, lang: string, r: RuleReport, options: { needCodeTabs?: boolean; visuals?: readonly { id: string }[] } = {}) {
  const want = EDITORIAL_HEADINGS[lang] ?? EDITORIAL_HEADINGS.en!;
  const h2 = headings(md, 2);
  if (!same(h2, want)) r.errors.push(`editorial: ## headings must be exactly ${want.map((h) => `"${h}"`).join(", ")} in order; found ${h2.map((h) => `"${h}"`).join(", ") || "none"}`);
  const long = length?.form === "long";
  const notes = (md.match(/^> \*\*Note:\*\*/gm) ?? []).length;
  if (notes < (long ? 3 : 1)) r.errors.push(`editorial: ${notes} "> **Note:**" callouts, need at least ${long ? 3 : 1}`);
  const why = (md.match(/Why this example\?|Kyun ye example\?/g) ?? []).length;
  if (why < (long ? 3 : 1)) r.errors.push(`editorial: "Why this example?" appears ${why} times, need at least ${long ? 3 : 1}`);
  if ((options.needCodeTabs ?? true) && !md.includes("[[code-tabs]]")) r.errors.push("editorial: [[code-tabs]] missing (where the reference code goes)");
  for (const [, id] of md.matchAll(/\[\[visual:([a-z0-9-]+)\]\]/g)) if (!(options.visuals ?? []).some((v) => v.id === id)) r.errors.push(`editorial: [[visual:${id}]] has no visual with that id`);
  const words = countWords(md);
  if (length !== undefined) {
    if (words < 0.85 * length.target_words) r.errors.push(`editorial: ${words} words, below 85% of the target ${length.target_words}`);
    else if (words < length.target_words) r.warnings.push(`editorial: ${words} words, under the target ${length.target_words}`);
  }
  if (!/time complexity/i.test(md) && !/samay/i.test(md)) r.errors.push("editorial: no time complexity in Testing / Reflection");
}

function checkCommon(item: Record<string, unknown>, r: RuleReport) {
  const text = JSON.stringify(item);
  const site = PROBLEM_SITES.exec(text);
  if (site !== null) r.errors.push(`links to another problem site (${site[1]}): use our own slugs in related`);
  const lower = text.toLowerCase();
  for (const c of CLICHES) if (lower.includes(c)) r.errors.push(`banned phrase "${c}" (EDITORIAL-STYLE section 6)`);
  const level = item.level as string | undefined;
  if (level !== undefined && item.difficulty !== undefined && LEVEL_DIFFICULTY[level] !== item.difficulty) r.errors.push(`level ${level} goes with difficulty ${LEVEL_DIFFICULTY[level]}, not ${String(item.difficulty)}`);
  const variants = item.variants as { params: { name: string }[]; sets: Record<string, unknown>[] } | undefined;
  if (variants !== undefined) {
    const names = variants.params.map((p) => p.name);
    variants.sets.forEach((set, i) => {
      if (!same(Object.keys(set).sort(), [...names].sort())) r.errors.push(`variants.sets[${i}] must give exactly ${names.join(", ")}`);
    });
    for (const n of names) if (!text.includes(`{{${n}}}`)) r.warnings.push(`variant parameter ${n} is never used as {{${n}}}`);
  }
}

function dsa(item: DsaItem, r: RuleReport) {
  for (const lang of item.languages) {
    if (item.starters[lang] === undefined) r.errors.push(`starters: no ${lang} starter`);
    if (!item.solutions.some((s) => s.role === "reference" && s.lang === lang)) r.errors.push(`solutions: no ${lang} reference`);
    if (item.limits.time_ms[lang] === undefined) r.errors.push(`limits.time_ms: no ${lang}`);
  }
  if (!item.solutions.some((s) => s.role === "reference" && s.lang === "python")) r.errors.push("solutions: a Python reference is required (it makes the expected outputs)");
  if (!item.solutions.some((s) => s.role === "brute")) r.errors.push("solutions: no brute");
  const wrong = item.solutions.filter((s) => s.role === "wrong");
  if (wrong.length < 2) r.errors.push(`solutions: ${wrong.length} wrong solutions, need at least 2`);
  for (const w of wrong) if (w.expect === undefined || w.why === undefined) r.errors.push("solutions: every wrong solution needs expect and why");
  if (item.hints.length < 3) r.errors.push(`hints: ${item.hints.length}, need 3`);
  const names = new Set((item.generators ?? []).map((g) => g.name));
  const count: Record<string, number> = {};
  let total = 0;
  for (const [i, g] of item.test_plan.entries()) {
    const n = (g.tests?.length ?? 0) + (g.gen !== undefined ? (g.args?.length ?? 0) : 0);
    if (n === 0) r.errors.push(`test_plan[${i}] (${g.group}): no tests`);
    if (g.gen !== undefined && !names.has(g.gen)) r.errors.push(`test_plan[${i}]: generator ${g.gen} not defined`);
    if (g.gen === undefined && g.args !== undefined) r.errors.push(`test_plan[${i}]: args without gen`);
    if (g.group === "samples" && g.hidden) r.errors.push("test_plan: samples must have hidden false");
    if (g.group !== "samples" && !g.hidden) r.warnings.push(`test_plan: group ${g.group} is visible`);
    if (g.group === "samples") for (const t of g.tests ?? []) if (!t.explanation) r.errors.push("test_plan: every sample needs an explanation");
    for (const t of g.tests ?? []) if (t.input.length > 2048) r.warnings.push(`test_plan: a literal ${g.group} test is over 2 KB; use a generator`);
    count[g.group] = (count[g.group] ?? 0) + n;
    total += n;
  }
  const need: Record<string, number> = { samples: 2, minimal: 2, boundary: 2, edge: 5, random_small: item.level === "L0" ? 5 : 10, random_large: 3, anti: 1 };
  for (const [group, min] of Object.entries(need)) if ((count[group] ?? 0) < min) r.errors.push(`test_plan: ${count[group] ?? 0} ${group} tests, need at least ${min}`);
  if (total < (MIN_TESTS[item.level] ?? 0)) r.errors.push(`test_plan: ${total} tests in all, ${item.level} needs at least ${MIN_TESTS[item.level]}`);
  if (total > 400) r.errors.push(`test_plan: ${total} tests; at most 400 can be stored with a problem`);
  for (const a of ["brute", "optimal"]) if (!item.approaches.some((x) => x.name === a)) r.errors.push(`approaches: no ${a}`);
  checkEditorial(item.editorial, item.editorial_length, item.text_language, r, { visuals: item.visuals ?? [] });
  const step2 = item.editorial.split(/^## /m)[3] ?? "";
  for (const h of ["Brute force", "Optimal"]) if (!headings(`## ${step2}`, 3).some((x) => x.startsWith(h))) r.errors.push(`editorial: "### ${h}" missing in step 2`);
  if (!(item.visuals ?? []).some((v) => v.kind === "dry-run")) r.errors.push("visuals: at least one dry-run visual");
  if (!item.editorial.includes("[[visual:")) r.errors.push("editorial: no [[visual:...]] marker");
}

function sql(item: SqlItem, r: RuleReport) {
  const purposes = new Set(item.datasets.map((d) => d.purpose));
  for (const p of ["sample", "empty", "many-rows"]) if (!purposes.has(p)) r.errors.push(`datasets: no ${p} dataset`);
  if ((/\bNULL\b/i.test(item.schema_sql) || !/NOT NULL/i.test(item.schema_sql)) && !purposes.has("null")) r.warnings.push("datasets: no null dataset (add one when a column can be NULL)");
  if ((item.order_matters || /rank|top|highest|lowest|first|latest/i.test(item.stem)) && !purposes.has("ties")) r.errors.push("datasets: no ties dataset, and the order or ranking matters");
  if (!item.datasets.some((d) => !d.hidden)) r.errors.push("datasets: none is shown (hidden false)");
  if (!item.datasets.some((d) => d.hidden)) r.errors.push("datasets: none is hidden");
  for (const d of item.datasets) if ((d.rows_sql === undefined) === (d.gen === undefined)) r.errors.push(`datasets ${d.id}: give rows_sql or gen, not both or neither`);
  if (new Set(item.datasets.map((d) => d.id)).size !== item.datasets.length) r.errors.push("datasets: ids repeat");
  if (/\b(RIGHT|FULL)\s+(OUTER\s+)?JOIN\b/i.test(item.reference)) r.errors.push("reference: RIGHT/FULL JOIN is not in older SQLite");
  checkEditorial(item.editorial, item.editorial_length, item.text_language, r);
}

function mcq(item: McqItem, r: RuleReport) {
  if (item.kind === "mcq") {
    if (item.options === undefined || item.correct === undefined) r.errors.push("an mcq needs options and correct");
    else if (item.correct >= item.options.length) r.errors.push("correct is past the last option");
    for (const d of item.distractors ?? []) if (d.option === item.correct || d.option >= (item.options?.length ?? 0)) r.errors.push(`distractors: option ${d.option} is not a wrong option`);
    if (item.options !== undefined && (item.distractors ?? []).length < item.options.length - 1) r.warnings.push("distractors: not every wrong option says which mistake leads to it");
  } else if (item.answer === undefined) r.errors.push("a numeric question needs answer");
  if (item.section.startsWith("aptitude-")) {
    const want = APTITUDE_HEADINGS[item.text_language] ?? APTITUDE_HEADINGS.en!;
    const h3 = headings(item.explanation, 3);
    if (!same(h3, want)) r.errors.push(`explanation: ### headings must be ${want.join(", ")}; found ${h3.join(", ") || "none"}`);
  }
  if ((item.section === "aptitude-quant" || item.variants !== undefined) && item.solver === undefined) r.errors.push("solver: required for quant items and for items with variants");
  if ((item.images ?? []).length > 0) r.errors.push("images: pictures in an upload are not taken yet (the platform does not store them from a bundle); write the question without one, or add it in the console after publishing");
}

function lesson(item: LessonItem, r: RuleReport) {
  const kinds = new Set(item.sections.map((s) => s.kind));
  for (const k of ["why", "concept", "misconception", "interview", "summary"]) if (!kinds.has(k as never)) r.errors.push(`sections: no ${k} section`);
  if (item.sections[0]?.kind !== "why") r.errors.push("sections: the first section is the why");
  for (const s of item.sections) if (s.kind === "interview" && (s.qa?.length ?? 0) < 2) r.errors.push("sections: the interview section needs 2+ qa pairs");
  for (const [i, q] of item.quiz.entries()) if (q.correct >= q.options.length) r.errors.push(`quiz[${i}]: correct is past the last option`);
  const words = countWords(item.sections.map((s) => `${s.body} ${(s.qa ?? []).map((x) => `${x.q} ${x.a}`).join(" ")}`).join("\n"));
  if (words < 800) r.errors.push(`sections: ${words} words, a lesson needs at least 800 (1,200-2,500 is the aim)`);
  else if (words < 1200) r.warnings.push(`sections: ${words} words, under the 1,200 aim`);
  const runnable = item.sections.flatMap((s) => s.code ?? []).filter((c) => c.expected_output !== undefined);
  for (const c of runnable) if (![...LANGS, "sql"].includes(c.lang as never)) r.errors.push(`code (${c.lang}): expected_output given but the runner has no ${c.lang}`);
  if (item.course.startsWith("lang-")) {
    if (runnable.length === 0) r.errors.push("a language lesson needs runnable examples with expected_output");
    if ((item.hands_on ?? []).length === 0) r.errors.push("a language lesson needs a hands_on task");
  }
  for (const h of item.hands_on ?? []) if (!h.tests.some((t) => t.hidden) || !h.tests.some((t) => !t.hidden)) r.errors.push(`hands_on ${h.id}: needs visible and hidden tests`);
  if (new Set((item.hands_on ?? []).map((h) => h.id)).size !== (item.hands_on ?? []).length) r.errors.push("hands_on: ids repeat");
  for (const s of item.sections) if (s.visual !== undefined && s.visual.alt.length < 15) r.errors.push("sections: a visual needs alt text");
}

function rubric(items: readonly { weight: number; checked_by: string }[], r: RuleReport) {
  const sum = items.reduce((n, x) => n + x.weight, 0);
  if (sum !== 100) r.errors.push(`rubric: weights sum to ${sum}, not 100`);
  const ai = items.filter((x) => x.checked_by === "ai-feedback").reduce((n, x) => n + x.weight, 0);
  if (ai > 20) r.errors.push(`rubric: ai-feedback weighs ${ai}, at most 20`);
}

function fileSet(files: readonly ContentFile[], solutionFiles: readonly ContentFile[], order: readonly string[], language: string, where: string, r: RuleReport) {
  const paths = new Set(files.map((f) => f.path));
  for (const f of solutionFiles) if (!paths.has(f.path)) r.errors.push(`${where}: solution file ${f.path} is not in files`);
  for (const p of order) if (!paths.has(p)) r.errors.push(`${where}: bundle_order names ${p}, which is not in files`);
  const code = ({ python: /\.py$/, javascript: /\.js$/, java: /\.java$/, c: /\.[ch]$/, cpp: /\.(cpp|cc|h|hpp)$/ } as Record<string, RegExp>)[language];
  for (const f of files) if (code?.test(f.path) === true && !order.includes(f.path)) r.errors.push(`${where}: ${f.path} is not in bundle_order`);
  if ((language === "python" || language === "javascript") && files.some((f) => f.path.includes("/"))) r.errors.push(`${where}: ${language} project files must sit at the top level`);
  if (language === "java") {
    for (const f of [...files, ...solutionFiles]) {
      if (/^\s*package\s/m.test(f.content)) r.errors.push(`${where}: ${f.path} has a package line`);
      if (/^public\s+(?:final\s+|abstract\s+)*(?:class|interface|enum|record)\s+(?!Main\b)/m.test(f.content)) r.errors.push(`${where}: ${f.path}: only Main may be public`);
    }
  }
}

function project(item: ProjectItem, r: RuleReport) {
  rubric(item.rubric, r);
  fileSet(item.files, item.solution_files, item.bundle_order, item.language, "files", r);
  const milestones = new Set(item.milestones.map((m) => m.id));
  for (const t of item.tests) if (t.milestone !== undefined && !milestones.has(t.milestone)) r.errors.push(`tests ${t.id}: milestone ${t.milestone} does not exist`);
  if (!item.tests.some((t) => t.hidden) || !item.tests.some((t) => !t.hidden)) r.errors.push("tests: needs visible and hidden tests");
  if (new Set(item.tests.map((t) => t.id)).size !== item.tests.length) r.errors.push("tests: ids repeat");
}

function design(item: DesignItem, r: RuleReport) {
  rubric(item.rubric, r);
  if (item.diagram === undefined) r.errors.push("diagram: required");
  if (item.mode === "hld") {
    if ((item.estimates ?? []).length < 3) r.errors.push("estimates: an HLD case needs at least 3");
    if ((item.expected_components ?? []).length < 6) r.errors.push("expected_components: an HLD case needs at least 6");
    if ((item.deep_dives ?? []).length < 2) r.errors.push("deep_dives: an HLD case needs at least 2");
  } else {
    if (item.kata === undefined) r.errors.push("kata: an LLD case needs one");
    if ((item.entities ?? []).length < 3) r.errors.push("entities: an LLD case needs at least 3");
    if ((item.patterns ?? []).length < 1) r.errors.push("patterns: an LLD case names at least one, with why");
    for (const [i, impl] of (item.kata?.implementations ?? []).entries()) {
      fileSet(impl.files, impl.solution_files, impl.bundle_order, impl.language, `kata.implementations[${i}]`, r);
      if (item.kata?.change_request !== undefined && impl.change_files === undefined) r.errors.push(`kata.implementations[${i}]: change_files missing for the change request`);
    }
    const langs = (item.kata?.implementations ?? []).map((i) => i.language);
    if (new Set(langs).size !== langs.length) r.errors.push("kata: one implementation per language");
  }
  for (const [i, q] of item.concept_checks.entries()) if (q.correct >= q.options.length) r.errors.push(`concept_checks[${i}]: correct is past the last option`);
}

/** Gate 2 for one item whose schema passed. */
export function ruleProblems(type: ContentType, item: unknown): RuleReport {
  const r: RuleReport = { errors: [], warnings: [] };
  checkCommon(item as Record<string, unknown>, r);
  if (type === "dsa-problem") dsa(item as DsaItem, r);
  else if (type === "sql-problem") sql(item as SqlItem, r);
  else if (type === "mcq") mcq(item as McqItem, r);
  else if (type === "lesson") lesson(item as LessonItem, r);
  else if (type === "project") project(item as ProjectItem, r);
  else design(item as DesignItem, r);
  return r;
}

// --- gate 11: duplicates ------------------------------------------------------------------------

/** What an item says, for the duplicate check: its title and its statement, stem, scenario, brief or lesson body. */
export function mainText(item: Record<string, unknown>): string {
  const sections = Array.isArray(item.sections) ? (item.sections as { body?: unknown }[]).map((s) => String(s.body ?? "")).join("\n") : "";
  const body = item.statement ?? item.stem ?? item.scenario ?? item.brief ?? sections;
  return `${String(item.title ?? "")}\n${typeof body === "string" ? body : ""}`;
}

/** The text's word 3-grams: what two texts are compared by. */
export function shingles(text: string): ReadonlySet<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
}

/** Jaccard similarity of two shingle sets: shared over all, 0–1. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const x of a) if (b.has(x)) common++;
  return common / (a.size + b.size - common);
}

/** At or above this, one text is taken to be a copy of another: the item fails. */
export const DUPLICATE_AT = 0.85;
/** At or above this (and below a copy), a reviewer should look: a warning. */
export const SIMILAR_AT = 0.6;
/** Too few shingles for the measure to mean anything. */
const MIN_SHINGLES = 12;

export interface TextDoc {
  /** How the report names it: "problem two-sum", "lesson tcp-handshake", "item 3 (apt-x)". */
  readonly label: string;
  /** Its own slug, never compared with itself (an earlier version of the same item). */
  readonly key: string;
  readonly shingles: ReadonlySet<string>;
}

/**
 * The texts a bundle is checked against, indexed by shingle, so each item is
 * compared only with documents that share a phrase with it.
 */
export class TextIndex {
  readonly #docs: TextDoc[] = [];
  readonly #by = new Map<string, number[]>();

  add(doc: TextDoc): void {
    if (doc.shingles.size < MIN_SHINGLES) return;
    const n = this.#docs.push(doc) - 1;
    for (const s of doc.shingles) {
      const list = this.#by.get(s);
      if (list === undefined) this.#by.set(s, [n]);
      else list.push(n);
    }
  }

  /** The most similar document to `doc` above `SIMILAR_AT`, other than its own key. */
  closest(doc: TextDoc): { readonly label: string; readonly similarity: number } | null {
    if (doc.shingles.size < MIN_SHINGLES) return null;
    const shared = new Map<number, number>();
    for (const s of doc.shingles) for (const n of this.#by.get(s) ?? []) shared.set(n, (shared.get(n) ?? 0) + 1);
    let best: { label: string; similarity: number } | null = null;
    for (const [n, common] of shared) {
      const other = this.#docs[n]!;
      if (other.key === doc.key) continue;
      const similarity = common / (doc.shingles.size + other.shingles.size - common);
      if (similarity >= SIMILAR_AT && (best === null || similarity > best.similarity)) best = { label: other.label, similarity };
    }
    return best;
  }
}
