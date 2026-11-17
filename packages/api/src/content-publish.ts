import { questionId, validateQuestion, type CodeQuestion, type CodeTest, type Question } from "@parikshaa/core";
import type { ContentType, GateProblem } from "@parikshaa/store";
import { defaultSet, type Built, type BuiltTest } from "./content-gates.js";
import type { ContentChecker, DsaItem, LessonItem, McqItem, SqlItem, Tags, Visual } from "./content/types.js";

/**
 * What a content item becomes on the practice site when it is published
 * (docs/content/CONTENT-FORMAT.md §4–§7, "Stored as"): a `practice_problems`
 * row for a DSA, SQL or MCQ item; a `prep_lessons` row for a lesson, with its
 * quiz and hands-on tasks as problems of their own. Projects and system design
 * have no page on Learn yet, so they stay drafts.
 *
 * Variants are not per learner yet: the projection is the default set's.
 * Hint rungs after the first, revision cards, related links, per-language
 * time limits and company claims stay with the item in `content_items` until
 * the platform has a place for them (CONTENT-FORMAT §12).
 */

export interface ProblemProjection {
  readonly slug: string;
  readonly title: string;
  readonly question: Question;
  readonly difficulty: "easy" | "medium" | "hard";
  readonly tags: readonly string[];
  readonly editorial: string;
  readonly hint: string;
}

export interface LessonProjection {
  readonly slug: string;
  readonly title: string;
  readonly body: string;
  readonly estMinutes: number;
  readonly videoUrl: string;
}

export type Projection =
  | { readonly kind: "problem"; readonly problem: ProblemProjection }
  | { readonly kind: "lesson"; readonly lesson: LessonProjection; readonly quiz: readonly ProblemProjection[]; readonly handsOn: readonly ProblemProjection[] }
  | { readonly kind: "none"; readonly reason: string };

export const NOT_ON_LEARN: Partial<Record<ContentType, string>> = {
  project: "Learn has no project page yet (Kadam 3/4): a project stays a draft until it does.",
  "system-design": "Learn has no system design page yet (Kadam 3/4): a design case stays a draft until it does.",
};

const LESSON_BODY_MAX = 200_000;

const FENCE: Record<string, string> = { c: "c", cpp: "cpp", java: "java", python: "python", javascript: "javascript", sql: "sql" };

/** Topics, patterns and extra labels, once each: a problem's tags. */
const tagsOf = (tags: Tags, more: readonly string[] = []) => [...new Set([...tags.topics, ...(tags.patterns ?? []), ...(tags.extra ?? []), ...more])];

const fenced = (lang: string, src: string) => {
  const ticks = src.includes("```") ? "````" : "```";
  return `${ticks}${FENCE[lang] ?? lang}\n${src.replace(/\n+$/, "")}\n${ticks}`;
};

/** A visual as text, until Learn draws them: a dry run as a table of its frames, anything else as what it shows. */
export function visualText(visual: Visual): string {
  const frames = visual.data.frames;
  if (visual.kind === "dry-run" && Array.isArray(frames) && frames.length > 0) {
    const rows = frames.filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null);
    const vars = [...new Set(rows.flatMap((f) => (typeof f.vars === "object" && f.vars !== null ? Object.keys(f.vars) : [])))];
    const cell = (v: unknown) => String(typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? "")).replace(/\|/g, "\\|").replace(/\n/g, " ");
    const head = ["Step", ...vars, "Note"];
    return [
      `*${visual.alt}*`,
      "",
      `| ${head.join(" | ")} |`,
      `| ${head.map(() => "---").join(" | ")} |`,
      ...rows.map((f) => `| ${[cell(f.step), ...vars.map((v) => cell((f.vars as Record<string, unknown> | undefined)?.[v])), cell(f.note)].join(" | ")} |`),
    ].join("\n");
  }
  return `*${visual.alt}*`;
}

/** The editorial with its markers replaced: the references' code for `[[code-tabs]]`, each visual as text. */
function editorialText(md: string, code: readonly { readonly lang: string; readonly src: string }[], visuals: readonly Visual[]): string {
  return md
    .replace(/\[\[code-tabs\]\]/g, () => code.map((c) => fenced(c.lang, c.src)).join("\n\n"))
    .replace(/\[\[visual:([a-z0-9-]+)\]\]/g, (m, id: string) => {
      const v = visuals.find((x) => x.id === id);
      return v === undefined ? m : visualText(v);
    });
}

const checkerOf = (c: ContentChecker | undefined): CodeQuestion["checker"] | undefined => (c === undefined || c.kind === "exact" ? undefined : c);

const codeTests = (tests: readonly BuiltTest[]): CodeTest[] =>
  tests.map((t) => ({ id: t.id, input: t.input, expected: t.expected, hidden: t.hidden, weight: 1, ...(t.explanation === undefined ? {} : { explanation: t.explanation }) }));

function dsa(original: DsaItem, built: Built): ProblemProjection {
  const item = defaultSet(original);
  const references = item.languages.flatMap((lang) => item.solutions.filter((s) => s.role === "reference" && s.lang === lang).slice(0, 1));
  const checker = checkerOf(item.checker);
  const question: CodeQuestion = {
    id: questionId(item.slug),
    kind: "code",
    stem: item.statement,
    maxScore: 10,
    rubric: [],
    language: "python",
    languages: [...item.languages],
    starters: { ...item.starters } as Record<string, string>,
    inputFormat: item.input_format,
    outputFormat: item.output_format,
    constraints: item.constraints,
    tests: codeTests(built.tests ?? []),
    ...(checker === undefined ? {} : { checker }),
    limits: { timeMs: Math.max(...Object.values(item.limits.time_ms).map(Number)), memoryMb: item.limits.memory_mb },
  };
  return {
    slug: item.slug,
    title: item.title,
    question,
    difficulty: item.difficulty,
    tags: tagsOf(item.tags),
    editorial: editorialText(item.editorial, references, item.visuals ?? []),
    hint: item.hints[0] ?? "",
  };
}

function sql(original: SqlItem, built: Built): ProblemProjection {
  const item = defaultSet(original);
  const question: CodeQuestion = {
    id: questionId(item.slug),
    kind: "code",
    stem: item.stem,
    maxScore: 10,
    rubric: [],
    language: "sql",
    languages: ["sql"],
    starter: item.starter,
    outputFormat: "One row to a line, columns separated by a tab, `NULL` for a null.",
    tests: codeTests(built.tests ?? []),
    ...(item.order_matters ? {} : { checker: { kind: "unordered" as const } }),
  };
  const code = [item.reference, ...(item.alternatives ?? [])].map((src) => ({ lang: "sql", src }));
  return { slug: item.slug, title: item.title, question, difficulty: item.difficulty, tags: tagsOf(item.tags), editorial: editorialText(item.editorial, code, []), hint: item.hints[0] ?? "" };
}

function mcq(original: McqItem, built: Built): ProblemProjection {
  const item = defaultSet(original);
  const values = built.values ?? {};
  const fill = (s: string) => s.replace(/\{\{([a-z][a-z0-9_]{0,30})\}\}/g, (m, n: string) => (n in values ? String(values[n]) : m));
  const stem = fill(item.stem) + (item.kind === "numeric" && item.unit !== undefined ? `\n\nGive the answer in ${item.unit}.` : "");
  const passage = item.passage === undefined ? {} : { passage: { id: item.passage.id, text: fill(item.passage.text), ...(item.passage.title === undefined ? {} : { title: item.passage.title }) } };
  const question: Question =
    item.kind === "numeric"
      ? { id: questionId(item.slug), kind: "numeric", stem, maxScore: 1, rubric: [], expected: item.answer ?? 0, tolerance: item.tolerance ?? 0, ...passage }
      : { id: questionId(item.slug), kind: "mcq", stem, maxScore: 1, rubric: [], options: (item.options ?? []).map(fill), correctIndex: item.correct ?? 0, ...passage };
  const shortcut = (original as { shortcut?: string }).shortcut;
  return {
    slug: item.slug,
    title: item.title,
    question,
    difficulty: item.difficulty,
    tags: tagsOf(item.tags, [item.section, item.topic]),
    editorial: fill(item.explanation) + (shortcut === undefined ? "" : `\n\n> **Shortcut:** ${fill(shortcut)}`),
    hint: "",
  };
}

/** A child problem's slug: the lesson's, then a suffix, cut so the whole stays a slug (80 characters). */
export function childSlug(lesson: string, suffix: string): string {
  const tail = `-${suffix}`;
  return `${lesson.slice(0, 80 - tail.length).replace(/-+$/, "")}${tail}`;
}

/** A lesson's sections as Markdown: a heading each, its text, its code, its picture as text, its questions and answers. */
export function lessonBody(item: LessonItem): string {
  const parts: string[] = [];
  for (const s of item.sections) {
    parts.push(`## ${s.heading}`, s.body.trim());
    for (const c of s.code ?? []) {
      parts.push(fenced(c.lang, c.src));
      if (c.caption !== undefined) parts.push(`*${c.caption}*`);
      if (c.expected_output !== undefined) parts.push(`Output:\n\n${fenced("text", c.expected_output)}`);
    }
    if (s.visual !== undefined) parts.push(visualText(s.visual));
    for (const qa of s.qa ?? []) parts.push(`**Q:** ${qa.q}\n\n**A:** ${qa.a}`);
  }
  return `${parts.join("\n\n")}\n`;
}

function lesson(original: LessonItem): Extract<Projection, { kind: "lesson" }> {
  const item = defaultSet(original);
  const tags = tagsOf(item.tags, [item.course]);
  const quiz = item.quiz.map((q, i): ProblemProjection => {
    const slug = childSlug(item.slug, `q${i + 1}`);
    return {
      slug,
      title: `${item.title.slice(0, 140)}: question ${i + 1}`,
      question: { id: questionId(slug), kind: "mcq", stem: q.stem, maxScore: 1, rubric: [], options: [...q.options], correctIndex: q.correct },
      difficulty: item.difficulty,
      tags,
      editorial: q.explanation,
      hint: "",
    };
  });
  const handsOn = (item.hands_on ?? []).map((h): ProblemProjection => {
    const slug = childSlug(item.slug, h.id);
    const checker = checkerOf(h.checker);
    return {
      slug,
      title: h.title,
      question: {
        id: questionId(slug),
        kind: "code",
        stem: h.task,
        maxScore: 10,
        rubric: [],
        language: h.lang,
        languages: [h.lang],
        starter: h.starter,
        tests: h.tests.map((t) => ({ id: t.id, input: t.input, expected: t.expected, hidden: t.hidden, weight: t.weight ?? 1 })),
        ...(checker === undefined ? {} : { checker }),
      },
      difficulty: item.difficulty,
      tags,
      editorial: `${fenced(h.lang, h.solution)}\n`,
      hint: "",
    };
  });
  return {
    kind: "lesson",
    lesson: { slug: item.slug, title: item.title, body: lessonBody(item), estMinutes: Math.min(600, Math.max(1, item.est_minutes)), videoUrl: item.video_url ?? "" },
    quiz,
    handsOn,
  };
}

/** What an item is published as. */
export function project(type: ContentType, item: unknown, built: Built): Projection {
  if (type === "dsa-problem") return { kind: "problem", problem: dsa(item as DsaItem, built) };
  if (type === "sql-problem") return { kind: "problem", problem: sql(item as SqlItem, built) };
  if (type === "mcq") return { kind: "problem", problem: mcq(item as McqItem, built) };
  if (type === "lesson") return lesson(item as LessonItem);
  return { kind: "none", reason: NOT_ON_LEARN[type] ?? "Learn cannot show this yet." };
}

/** What the site would refuse in a projection: checked with the gates, so a passed item can always be published. */
export function projectionProblems(projection: Projection): GateProblem[] {
  const out: GateProblem[] = [];
  const problem = (p: ProblemProjection, what: string) => {
    if (p.title.length > 160) out.push({ gate: "store", message: `${what}: the title is over 160 characters` });
    for (const x of validateQuestion(p.question, what)) out.push({ gate: "store", message: `${x.path}: ${x.message}` });
  };
  if (projection.kind === "problem") problem(projection.problem, "problem");
  if (projection.kind === "lesson") {
    if (projection.lesson.body.length > LESSON_BODY_MAX) out.push({ gate: "store", message: `the lesson's text is ${projection.lesson.body.length} characters; at most ${LESSON_BODY_MAX} fit` });
    projection.quiz.forEach((q, i) => problem(q, `quiz[${i}]`));
    projection.handsOn.forEach((h) => problem(h, `hands_on ${h.slug}`));
    const slugs = [projection.lesson.slug, ...projection.quiz.map((q) => q.slug), ...projection.handsOn.map((h) => h.slug)];
    if (new Set(slugs.slice(1)).size !== slugs.length - 1) out.push({ gate: "store", message: "two of the lesson's quiz and hands-on problems would get the same address" });
  }
  return out;
}
