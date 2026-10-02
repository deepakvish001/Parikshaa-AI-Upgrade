import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { questionId, validateQuestion, type CodeQuestion } from "@parikshaa/core";
import { IdentityStore, pgliteExecutor, PracticeStore, practiceStaff, type SqlExecutor } from "@parikshaa/store";
import { importLegacy, legacyProblem, legacySlug, type LegacyBundle } from "./legacy-import.js";
import { addOrganisation, freshDatabase } from "./testing/harness.js";

/** The old app's four problem tables, as its Supabase project has them. */
const LEGACY_SCHEMA = `
CREATE TABLE coding_problems (
  slug text PRIMARY KEY, title text NOT NULL, difficulty text NOT NULL, topics text[], description text NOT NULL,
  examples jsonb, constraints text[], hints text[], cpu_time_limit_sec numeric, memory_limit_kb integer,
  is_published boolean, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz, mcq jsonb, is_contest_pool boolean);
CREATE TABLE coding_problem_tests (id serial PRIMARY KEY, problem_slug text NOT NULL, kind text NOT NULL, input text NOT NULL, expected text NOT NULL, ord integer NOT NULL, created_at timestamptz DEFAULT now());
CREATE TABLE coding_problem_starter_code (id serial PRIMARY KEY, problem_slug text NOT NULL, lang_id text NOT NULL, code text NOT NULL, updated_at timestamptz);
CREATE TABLE coding_problem_reference_solutions (id serial PRIMARY KEY, problem_slug text NOT NULL, lang_id text NOT NULL, code text NOT NULL, updated_at timestamptz);
`;

const THREE_SUM_DESCRIPTION = [
  "Given an integer array, find all unique triplets [a, b, c] from the array such that a + b + c = 0.",
  "",
  "Input format: one line of space-separated integers.",
  "Output format: one triplet per line, values space-separated.",
].join("\n");

async function seedLegacy(sql: SqlExecutor) {
  await sql.exec(LEGACY_SCHEMA);
  await sql.query(
    `INSERT INTO coding_problems (slug, title, difficulty, topics, description, examples, constraints, hints, cpu_time_limit_sec, memory_limit_kb, is_published, created_at) VALUES
      ('three-sum', '3Sum', 'medium', '{Array,"Two Pointers"}', $1, '[{"input":"nums = [-1,0,1,2,-1,-4]","output":"-1 -1 2\\\\n-1 0 1"}]', '{"0 <= length <= 3000"}', '{"Sort, then two pointers.","Skip duplicates."}', 2.00, 256000, true, '2025-01-01'),
      ('only-statement', 'Only a statement', 'easy', '{Math}', 'Add two numbers.', '[{"input":"a = 1, b = 2","output":"3"}]', NULL, NULL, 1, 128000, true, '2025-01-02'),
      ('second-salary', 'Second highest salary', 'medium', '{SQL}', 'Find the second highest salary.', NULL, NULL, NULL, NULL, NULL, true, '2025-01-03'),
      ('House_Robber!!', 'House robber', 'hard', '{DP}', 'Rob houses.', NULL, NULL, NULL, 30, 4000000, true, '2025-01-04')`,
    [THREE_SUM_DESCRIPTION],
  );
  await sql.query(
    `INSERT INTO coding_problem_tests (problem_slug, kind, input, expected, ord) VALUES
      ('three-sum', 'sample', '-1 0 1 2 -1 -4', E'-1 -1 2\\n-1 0 1', 1),
      ('three-sum', 'hidden', '', '', 2),
      ('three-sum', 'sample', '0 1 1', '', 0),
      ('House_Robber!!', 'sample', '1 2 3', '4', 1)`,
  );
  await sql.query(
    `INSERT INTO coding_problem_starter_code (problem_slug, lang_id, code) VALUES
      ('three-sum', 'python3', 'import sys\\n'), ('three-sum', 'python', 'old python'), ('three-sum', 'go', 'package main'),
      ('three-sum', 'typescript', 'let x'), ('three-sum', 'cpp', '#include <iostream>')`,
  );
  await sql.query(
    `INSERT INTO coding_problem_reference_solutions (problem_slug, lang_id, code) VALUES
      ('three-sum', 'python3', 'def three_sum(nums):\\n    return []'), ('second-salary', 'sql', 'SELECT MAX(salary) FROM e')`,
  );
}

describe("one problem from the old app", () => {
  const bundle = (over: Partial<LegacyBundle> = {}): LegacyBundle => ({
    problem: {
      slug: "three-sum",
      title: "3Sum",
      difficulty: "medium",
      topics: ["Array", "Two Pointers", "Array"],
      description: THREE_SUM_DESCRIPTION,
      examples: [{ input: "nums = [0,1,1]", output: "(empty)" }],
      constraints: ["0 <= length <= 3000", " "],
      hints: ["Sort, then two pointers.", "Skip duplicates."],
      cpuTimeLimitSec: "2.00",
      memoryLimitKb: 256000,
      published: true,
    },
    tests: [
      { kind: "hidden", input: "", expected: "", ord: 2 },
      { kind: "sample", input: "0 1 1", expected: "", ord: 0 },
    ],
    starters: [
      { lang: "python", code: "old" },
      { lang: "python3", code: "import sys" },
      { lang: "go", code: "package main" },
    ],
    solutions: [{ lang: "python3", code: "def f():\n    pass\n" }],
    ...over,
  });

  it("becomes a program question judged by the same tests, in order, the sample shown", () => {
    const { draft, issues } = legacyProblem(bundle());
    const q = draft.question as CodeQuestion;
    expect(draft).toMatchObject({ slug: "three-sum", title: "3Sum", difficulty: "medium", tags: ["Array", "Two Pointers"], published: true, hint: "Sort, then two pointers.", fromBank: "legacy:three-sum" });
    expect(q.id).toBe(questionId("legacy-three-sum"));
    expect(q.stem).toBe("Given an integer array, find all unique triplets [a, b, c] from the array such that a + b + c = 0.");
    expect(q).toMatchObject({ inputFormat: "one line of space-separated integers.", outputFormat: "one triplet per line, values space-separated.", constraints: "- 0 <= length <= 3000" });
    expect(q.tests).toEqual([
      { id: "t1", input: "0 1 1", expected: "", hidden: false, weight: 1 },
      { id: "t2", input: "", expected: "", hidden: true, weight: 1 },
    ]);
    expect(q.limits).toEqual({ timeMs: 2000, memoryMb: 250 });
    expect(q.languages).toEqual(["python", "cpp", "java", "c", "javascript"]);
    // python3 is the newer starter; Go is left out and said so.
    expect(q.starters).toEqual({ python: "import sys" });
    expect(issues).toEqual(["starter code in go was left out: the runner does not run it"]);
    expect(draft.editorial).toContain("## Hints\n1. Sort, then two pointers.\n2. Skip duplicates.");
    expect(draft.editorial).toContain("```python\ndef f():\n    pass\n```");
    expect(validateQuestion(q, "q")).toEqual([]);
  });

  it("shows the old worked examples only when there is no sample test", () => {
    const withSamples = legacyProblem(bundle()).draft.question.stem;
    expect(withSamples).not.toContain("Example");
    const none = legacyProblem(bundle({ tests: [{ kind: "hidden", input: "1", expected: "1", ord: 0 }] })).draft.question.stem;
    expect(none).toContain("**Example 1**\n\n```\nInput: nums = [0,1,1]\nOutput: (empty)\n```");
  });

  it("comes in unpublished, with the reason, when it cannot be judged here", () => {
    const noTests = legacyProblem(bundle({ tests: [] }));
    expect(noTests.draft.published).toBe(false);
    expect(noTests.issues).toContain("it has no tests: add them before publishing");
    expect(validateQuestion(noTests.draft.question, "q")).toEqual([]);

    const allSamples = legacyProblem(bundle({ tests: [{ kind: "sample", input: "1", expected: "1", ord: 0 }] }));
    expect(allSamples.draft.published).toBe(false);
    expect(allSamples.issues).toContain("every test is a sample: add a hidden test before publishing");

    const sql = legacyProblem(bundle({ tests: [], solutions: [{ lang: "sql", code: "SELECT 1" }] }));
    expect(sql.draft.published).toBe(false);
    expect(sql.draft.question).toMatchObject({ language: "sql", languages: ["sql"] });
    expect(sql.issues.some((i) => /a SQL problem/.test(i))).toBe(true);

    const hidden = legacyProblem(bundle({ problem: { ...bundle().problem, published: false } }));
    expect(hidden.draft.published).toBe(false);
    expect(hidden.issues).toContain("it was unpublished in the old app");
  });

  it("keeps limits within what the runner allows", () => {
    const q = legacyProblem(bundle({ problem: { ...bundle().problem, cpuTimeLimitSec: 30, memoryLimitKb: 4_000_000 } })).draft.question as CodeQuestion;
    expect(q.limits).toEqual({ timeMs: 10_000, memoryMb: 1024 });
  });

  it("makes any old slug one the site accepts", () => {
    expect(legacySlug("House_Robber!!")).toBe("house-robber");
    expect(legacySlug("a")).toBe("p-a");
    expect(legacySlug("x".repeat(100))).toHaveLength(80);
    for (const s of ["House_Robber!!", "a", "--3sum--", "x".repeat(100)]) expect(legacySlug(s)).toMatch(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/);
  });
});

describe("importing onto a site", () => {
  let target: PGlite;
  let source: PGlite;
  let practice: PracticeStore;
  let org: Awaited<ReturnType<typeof addOrganisation>>;

  beforeEach(async () => {
    target = await freshDatabase();
    source = new PGlite();
    const sql = pgliteExecutor(target);
    org = await addOrganisation(new IdentityStore(sql), "parikshaa", "Parikshaa");
    practice = new PracticeStore(sql);
    await practice.saveSite({ orgId: org, slug: "learn", title: "Parikshaa Learn", welcome: "", open: true });
    await seedLegacy(pgliteExecutor(source));
  });

  afterEach(async () => {
    await target.close();
    await source.close();
  });

  it("writes nothing on a dry run, and says what it would do", async () => {
    const report = await importLegacy(pgliteExecutor(source), practice, org, { dryRun: true });
    expect(report).toMatchObject({ problems: 4, added: 4, updated: 0, published: 1 });
    expect(await practice.problems(practiceStaff(org))).toEqual([]);
  });

  it("brings every problem, oldest first, publishing only those that can be judged", async () => {
    const report = await importLegacy(pgliteExecutor(source), practice, org);
    expect(report).toMatchObject({ problems: 4, added: 4, updated: 0, published: 1 });
    expect(report.issues.map((i) => i.slug)).toEqual(["three-sum", "only-statement", "second-salary", "house-robber"]);
    const problems = await practice.problems(practiceStaff(org));
    expect(problems.map((p) => [p.slug, p.position, p.published])).toEqual([
      ["three-sum", 0, true],
      ["only-statement", 1, false],
      ["second-salary", 2, false],
      ["house-robber", 3, false],
    ]);
    const threeSum = problems[0]!.question as CodeQuestion;
    expect(threeSum.tests?.map((t) => [t.input, t.hidden])).toEqual([
      ["0 1 1", false],
      ["-1 0 1 2 -1 -4", false],
      ["", true],
    ]);
    expect(threeSum.starters).toEqual({ python: "import sys\\n", cpp: "#include <iostream>" });
  });

  it("updates what it brought before and adds nothing twice", async () => {
    await importLegacy(pgliteExecutor(source), practice, org);
    await pgliteExecutor(source).query(`UPDATE coding_problems SET title = '3Sum (updated)' WHERE slug = 'three-sum'`);
    const again = await importLegacy(pgliteExecutor(source), practice, org);
    expect(again).toMatchObject({ added: 0, updated: 4 });
    const problems = await practice.problems(practiceStaff(org));
    expect(problems).toHaveLength(4);
    expect(problems.find((p) => p.slug === "three-sum")?.title).toBe("3Sum (updated)");
  });

  it("leaves a site's own problem alone and takes the next free address", async () => {
    const own = legacyProblem({
      problem: { slug: "three-sum", title: "Our own", difficulty: "easy", topics: [], description: "Ours.", examples: null, constraints: null, hints: null, cpuTimeLimitSec: null, memoryLimitKb: null, published: true },
      tests: [{ kind: "hidden", input: "1", expected: "1", ord: 0 }],
      starters: [],
      solutions: [],
    }).draft;
    await practice.addProblem(org, { ...own, fromBank: null, position: 0 });
    await importLegacy(pgliteExecutor(source), practice, org);
    const problems = await practice.problems(practiceStaff(org));
    expect(problems.find((p) => p.slug === "three-sum")?.title).toBe("Our own");
    expect(problems.find((p) => p.slug === "three-sum-2")?.title).toBe("3Sum");
  });
});
