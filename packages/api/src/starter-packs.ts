import { questionId, type OrgId, type Question } from "@parikshaa/core";
import { practiceStaff, type PracticeStore, type PrepStore } from "@parikshaa/store";
import { CS_FUNDAMENTALS } from "./content/cs-fundamentals.js";
import { DSA_STARTER } from "./content/dsa-starter.js";
import { DSA_TEXT } from "./content/dsa-starter-text.js";
import type { CsPack, DsaPack, SqlPack } from "./content/packs.js";
import { SQL_STARTER } from "./content/sql-starter.js";
import { PracticeError, slugOf } from "./practice.js";
import type { PrepService } from "./prep.js";

/**
 * Starter packs (ROADMAP §16): content a practice site takes in with one
 * click, so it does not open empty.
 *
 * - CS fundamentals, from Parikshaa-New's question bank: a lesson per topic,
 *   each question in it a practice MCQ whose editorial is the answer, and a
 *   track of them by subject.
 * - SQL: problems that run on SQLite, each with its approaches, and a track.
 * - DSA: 40 problems written for Parikshaa (the Sahayak eval's), each with a
 *   first hint, its brute force and optimal approaches, and a track by topic.
 *
 * A pack is taken in once: its track's address says it is there. Everything
 * it adds is the site's own afterwards, to change or hide like anything else.
 */

export const PACKS = ["cs-fundamentals", "sql-starter", "dsa-starter"] as const;
export type PackName = (typeof PACKS)[number];

export interface PackSummary {
  readonly name: PackName;
  readonly title: string;
  readonly description: string;
  readonly lessons: number;
  readonly problems: number;
  readonly imported: boolean;
}

const TRACK: Record<PackName, { slug: string; title: string; description: string }> = {
  "cs-fundamentals": {
    slug: "cs-fundamentals",
    title: "CS fundamentals",
    description: "Operating systems, databases, networks, OOP, theory of computation and compilers: read each topic, then answer its questions.",
  },
  "dsa-starter": {
    slug: "dsa-starter",
    title: "DSA, the patterns interviews ask",
    description: "Prefix sums, two pointers, sliding windows, stacks, heaps, binary search, dynamic programming and graphs: 40 problems, each with a first hint and its brute-force and optimal approaches.",
  },
  "sql-starter": {
    slug: "sql-starter",
    title: "SQL, from SELECT to window functions",
    description: "Queries that run: filtering, joins, grouping, subqueries and window functions, each with its approaches.",
  },
};

/** Headings in an answer go one level down, under the question's own. */
const demote = (markdown: string) => markdown.replace(/^(#{1,5}) /gm, "#$1 ");

export function csLessons(pack: CsPack) {
  return pack.subjects.flatMap((subject) =>
    subject.topics.map((topic) => ({
      subject,
      topic,
      slug: `cs-${topic.id}`.slice(0, 80),
      title: `${subject.name}: ${topic.name}`,
      body: [
        `# ${topic.name}`,
        "",
        ...topic.questions.flatMap((q) => [`## ${q.title}`, "", q.text, "", demote(q.answer), ""]),
      ].join("\n"),
      estMinutes: Math.min(120, Math.max(10, topic.questions.length * 8)),
    })),
  );
}

export function sqlQuestion(problem: SqlPack["problems"][number]): Question {
  return {
    id: questionId(`sql-${problem.slug}`),
    kind: "code",
    stem: problem.stem,
    maxScore: 10,
    rubric: [],
    language: "sql",
    languages: ["sql"],
    starter: "-- Write one query. The tables are made for each test.\nSELECT\n",
    tests: problem.tests,
    ...(problem.ordered ? {} : { checker: { kind: "unordered" as const } }),
    outputFormat: "One row to a line, columns separated by a tab, `NULL` for a null.",
  };
}

type DsaProblem = DsaPack["problems"][number];

export function dsaQuestion(problem: DsaProblem): Question {
  return {
    id: questionId(`dsa-${problem.slug}`),
    kind: "code",
    stem: problem.statement,
    maxScore: 10,
    rubric: [],
    language: "python",
    languages: ["python", "cpp", "java"],
    starter: "",
    inputFormat: problem.inputFormat,
    outputFormat: problem.outputFormat,
    constraints: problem.constraints,
    tests: problem.tests,
    ...(problem.timeMs === undefined ? {} : { limits: { timeMs: problem.timeMs } }),
  };
}

/** Brute force, then optimal, each a tab; the optimal with a right program in Python. */
export function dsaEditorial(problem: DsaProblem, brute: string): string {
  return [
    "## Brute force",
    brute,
    "",
    `Time: ${problem.bruteTime}. Too slow at the largest inputs.`,
    "",
    "## Optimal",
    problem.optimal,
    "",
    `Time: ${problem.optimalTime}.`,
    "",
    "```python",
    problem.reference.trim(),
    "```",
  ].join("\n");
}

/** The DSA track's modules, by pattern: every problem in exactly one. */
const DSA_MODULES: readonly [string, readonly string[]][] = [
  ["Arrays and prefix sums", ["range-sum-queries", "pairwise-product-sum", "range-bonus", "heaviest-square", "subarrays-summing-to-k", "total-pairwise-distance"]],
  ["Hashing and counting", ["pairs-with-target-sum", "pairs-with-difference", "frequent-value-score", "largest-pair-product"]],
  ["Sorting and greedy", ["closest-pair-gap", "make-equal-cost", "union-length", "rope-joining"]],
  ["Two pointers and sliding windows", ["best-k-window", "two-lists-budget", "nearest-to-zero-pair", "widest-container", "longest-window-under-budget", "distinct-in-windows", "small-product-windows", "trapped-rainwater"]],
  ["Binary search", ["slowest-eating-speed"]],
  ["Stacks and heaps", ["wait-for-warmer", "largest-rectangle-histogram", "sum-of-window-minimums", "running-median-sum"]],
  ["Dynamic programming", ["best-streak-sum", "circular-best-streak", "house-robber", "staircase-ways", "paint-houses", "grid-paths-with-blocks", "coin-change-ways", "knapsack-max-value"]],
  ["Divide and conquer, trees over values", ["count-inversions", "double-trouble-pairs", "increasing-triplets", "range-min-sum"]],
  ["Graphs", ["cheapest-route"]],
];

export class StarterPacks {
  readonly #practice: PracticeStore;
  readonly #prep: PrepStore;
  readonly #service: PrepService;

  constructor(options: { practice: PracticeStore; prep: PrepStore; service: PrepService }) {
    this.#practice = options.practice;
    this.#prep = options.prep;
    this.#service = options.service;
  }

  async list(orgId: OrgId): Promise<readonly PackSummary[]> {
    const tracks = await this.#prep.tracks(practiceStaff(orgId));
    const has = (name: PackName) => tracks.some((t) => t.slug === TRACK[name].slug);
    const csCount = CS_FUNDAMENTALS.subjects.reduce((n, s) => n + s.topics.reduce((m, t) => m + t.questions.length, 0), 0);
    return [
      { name: "cs-fundamentals", ...pick(TRACK["cs-fundamentals"]), lessons: csLessons(CS_FUNDAMENTALS).length, problems: csCount, imported: has("cs-fundamentals") },
      { name: "sql-starter", ...pick(TRACK["sql-starter"]), lessons: 0, problems: SQL_STARTER.problems.length, imported: has("sql-starter") },
      { name: "dsa-starter", ...pick(TRACK["dsa-starter"]), lessons: 0, problems: DSA_STARTER.problems.length, imported: has("dsa-starter") },
    ];
  }

  /** Take a pack in. Refused if it is in already; problems whose address is taken get the next free one. */
  async import(orgId: OrgId, name: PackName): Promise<{ readonly track: string; readonly lessons: number; readonly problems: number }> {
    if ((await this.list(orgId)).find((p) => p.name === name)?.imported === true) throw new PracticeError("slug_taken", "That pack is on this site already");
    const scope = practiceStaff(orgId);
    const taken = new Set((await this.#practice.problems(scope)).map((p) => p.slug));
    let position = taken.size;
    const free = (wanted: string) => {
      let slug = wanted.slice(0, 80).replace(/-+$/, "");
      for (let n = 2; taken.has(slug); n++) slug = `${wanted.slice(0, 74).replace(/-+$/, "")}-${n}`;
      taken.add(slug);
      return slug;
    };
    const addProblem = async (p: { slug: string; title: string; question: Question; difficulty: "easy" | "medium" | "hard"; tags: readonly string[]; editorial: string; hint?: string }) =>
      (await this.#practice.addProblem(orgId, { ...p, slug: free(p.slug), fromBank: null, position: position++, published: true })).id;

    if (name === "cs-fundamentals") {
      const lessonIds = new Map((await this.#prep.lessons(scope)).map((l) => [l.slug, l.id]));
      const modules: { title: string; items: { lessonId?: string; problemId?: string }[] }[] = [];
      let lessons = 0;
      let problems = 0;
      for (const lesson of csLessons(CS_FUNDAMENTALS)) {
        let lessonId = lessonIds.get(lesson.slug);
        if (lessonId === undefined) {
          lessonId = (await this.#service.saveLesson(orgId, null, { slug: lesson.slug, title: lesson.title, body: lesson.body, videoUrl: "", estMinutes: lesson.estMinutes, published: true })).id;
          lessons++;
        }
        const items: { lessonId?: string; problemId?: string }[] = [{ lessonId }];
        for (const [i, q] of lesson.topic.questions.entries()) {
          const question: Question = {
            id: questionId(`${lesson.slug}-${i + 1}`),
            kind: "mcq",
            stem: q.text === "" ? q.title : `${q.title}\n\n${q.text}`,
            maxScore: 1,
            rubric: [],
            options: q.options,
            correctIndex: q.correct,
          };
          items.push({ problemId: await addProblem({ slug: slugOf(q.title), title: q.title.slice(0, 160), question, difficulty: q.difficulty, tags: [lesson.subject.name, lesson.topic.name], editorial: q.answer }) });
          problems++;
        }
        const module = modules.find((m) => m.title === lesson.subject.name);
        if (module === undefined) modules.push({ title: lesson.subject.name, items });
        else module.items.push(...items);
      }
      await this.#service.saveTrack(orgId, null, { ...TRACK[name], published: true, modules });
      return { track: TRACK[name].slug, lessons, problems };
    }

    if (name === "dsa-starter") {
      const ids = new Map<string, string>();
      for (const p of DSA_STARTER.problems) {
        const text = DSA_TEXT[p.slug]!;
        ids.set(p.slug, await addProblem({ slug: p.slug, title: p.title, question: dsaQuestion(p), difficulty: p.difficulty, tags: p.tags, editorial: dsaEditorial(p, text.brute), hint: text.hint }));
      }
      const modules = DSA_MODULES.map(([title, slugs]) => ({ title, items: slugs.flatMap((s) => (ids.has(s) ? [{ problemId: ids.get(s)! }] : [])) }));
      await this.#service.saveTrack(orgId, null, { ...TRACK[name], published: true, modules });
      return { track: TRACK[name].slug, lessons: 0, problems: ids.size };
    }

    const groups: [string, readonly string[]][] = [
      ["Filtering", ["big-countries", "low-fat-and-recyclable"]],
      ["Joins and grouping", ["customers-who-never-order", "duplicate-emails", "managers-with-five-reports"]],
      ["Subqueries and window functions", ["second-highest-salary", "highest-paid-in-each-department", "rank-scores"]],
    ];
    const ids = new Map<string, string>();
    for (const p of SQL_STARTER.problems) {
      ids.set(p.slug, await addProblem({ slug: p.slug, title: p.title, question: sqlQuestion(p), difficulty: p.difficulty, tags: p.tags, editorial: p.editorial }));
    }
    const modules = groups.map(([title, slugs]) => ({ title, items: slugs.flatMap((s) => (ids.has(s) ? [{ problemId: ids.get(s)! }] : [])) }));
    await this.#service.saveTrack(orgId, null, { ...TRACK[name], published: true, modules });
    return { track: TRACK[name].slug, lessons: 0, problems: ids.size };
  }
}

const pick = (t: { title: string; description: string }) => ({ title: t.title, description: t.description });
