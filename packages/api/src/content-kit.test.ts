import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The content kit's validator (scripts/content-validate.mjs, plan row 141): the samples meet the schemas and the
 * semantic gates, and a small item is run on the real runner: a right one passes, a broken one fails for the
 * reasons the gates name. The full sample run (every reference in five languages) is a developer's step:
 *
 *   node scripts/content-validate.mjs content/samples
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const SCRIPT = join(ROOT, "scripts", "content-validate.mjs");
const validate = (...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8", timeout: 120_000 });

const quant = (correct: number, solverAnswer: string) => ({
  schema: "parikshaa.content/mcq@1",
  slug: "apt-test-percent",
  version: 1,
  title: "Test: a percentage",
  tier: "public",
  text_language: "en",
  difficulty: "easy",
  section: "aptitude-quant",
  topic: "percentages",
  tags: { topics: ["percentages"] },
  authoring: { author: "Test", generated_with: "human", originality: "Written for this test by the Parikshaa team." },
  kind: "mcq",
  stem: "What is 20% of 150?",
  options: ["20", "30", "45", "50"],
  correct,
  explanation: "### Understand\nA share of 150.\n\n### Plan\nMultiply by 20/100.\n\n### Solve\n150 × 0.2 = 30.\n\n### Check\n10% is 15, so 20% is 30.",
  time_target_sec: 30,
  solver: `import json, sys\njson.load(sys.stdin)\nprint(json.dumps({"answer": "${solverAnswer}"}))`,
});

const lesson = (expected: string) => ({
  schema: "parikshaa.content/lesson@1",
  slug: "lang-python-test",
  version: 1,
  title: "Test lesson",
  tier: "public",
  text_language: "en",
  course: "lang-python",
  difficulty: "easy",
  tags: { topics: ["basics"] },
  authoring: { author: "Test", generated_with: "human", originality: "Written for this test by the Parikshaa team." },
  est_minutes: 5,
  outcomes: ["can print a sum in Python", "can read a number from input"],
  sections: [
    { kind: "why", heading: "Why", body: "word ".repeat(200) },
    { kind: "concept", heading: "Concept", body: "word ".repeat(300), code: [{ lang: "python", src: "print(2 + 3)", runnable: true, expected_output: expected }] },
    { kind: "misconception", heading: "Mistake", body: "word ".repeat(150) },
    { kind: "interview", heading: "Interview", body: "word ".repeat(150), qa: [{ q: "What prints?", a: "Five, the sum." }, { q: "And 2 * 3?", a: "Six, the product." }] },
    { kind: "summary", heading: "Summary", body: "word ".repeat(100) },
  ],
  quiz: [0, 1, 2].map((i) => ({ stem: `Question ${i}`, options: ["a", "b", "c", "d"], correct: 0, explanation: "Because." })),
  hands_on: [
    {
      id: "double",
      title: "Double it",
      task: "Print twice the number.",
      lang: "python",
      starter: "n = int(input())\nprint(0)",
      solution: "n = int(input())\nprint(2 * n)",
      tests: [
        { id: "a", input: "2\n", expected: "4\n", hidden: false },
        { id: "b", input: "0\n", expected: "0\n", hidden: true },
        { id: "c", input: "-7\n", expected: "-14\n", hidden: true },
      ],
    },
  ],
  revision_card: { front: "How do you print a sum?", back: "print(a + b)" },
});

function folder(items: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "content-kit-"));
  for (const [name, item] of Object.entries(items)) {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, "item.json"), JSON.stringify(item));
  }
  return dir;
}

describe("content validator", () => {
  it("passes every sample on the schemas and the semantic gates", () => {
    const run = validate("content/samples", "--no-run", "--json");
    const report = JSON.parse(run.stdout) as { global: string[]; items: { slug: string; errors: string[] }[] };
    expect(report.global).toEqual([]);
    expect(report.items.length).toBeGreaterThan(0);
    expect(report.items.filter((i) => i.errors.length > 0)).toEqual([]);
    expect(run.status).toBe(0);
  });

  it("checks an aptitude key against its solver", () => {
    const good = validate(folder({ q: quant(1, "30") }), "--json");
    expect(good.status).toBe(0);
    const bad = validate(folder({ q: quant(2, "30") }), "--json");
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain("the key is");
  });

  it("refuses an item outside the schema, and a link to another problem site", () => {
    const outside = validate(folder({ q: { ...quant(1, "30"), surprise: true } }), "--no-run", "--json");
    expect(outside.stdout).toContain('unknown field \\"surprise\\"');
    const linked = validate(folder({ q: { ...quant(1, "30"), stem: "As on leetcode.com: what is 20% of 150?" } }), "--no-run", "--json");
    expect(linked.stdout).toContain("another problem site");
  });

  it("runs a lesson's code and hands-on task on the runner", () => {
    const good = validate(folder({ l: lesson("5\n") }), "--json");
    expect(JSON.parse(good.stdout).items[0].errors).toEqual([]);
    const bad = validate(folder({ l: lesson("6\n") }), "--json");
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain("does not pass");
  });
});
