import { writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { examId, validateExam } from "@parikshaa/core";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { DSA_STARTER } from "./content/dsa-starter.js";
import { DSA_BETTER, DSA_TEXT } from "./content/dsa-starter-text.js";
import type { DsaPack } from "./content/packs.js";
import { dsaEditorial, dsaQuestion } from "./starter-packs.js";
import { PROBLEMS_A } from "./testing/sahayak-eval/problems-a.js";
import { PROBLEMS_B } from "./testing/sahayak-eval/problems-b.js";
import { PROBLEMS_C } from "./testing/sahayak-eval/problems-c.js";
import { PROBLEMS_D } from "./testing/sahayak-eval/problems-d.js";
import { testInputs } from "./testing/sahayak-eval/validate.js";

/**
 * The DSA starter (Prep blueprint §15) is made from the Sahayak eval's
 * problems: their statements, the optimal approach and a reference program
 * each. Its tests are the eval's examples, small random cases and edge cases
 * — not the eval's one large input, which would make every problem a
 * megabyte — with the reference program's output as expected.
 *
 * This test builds the pack again on the real runner and holds the stored
 * one to it. To write it after a problem changes:
 *
 *   WRITE_DSA_PACK=1 npx vitest run src/content-dsa.test.ts
 */

const EVAL = [...PROBLEMS_A, ...PROBLEMS_B, ...PROBLEMS_C, ...PROBLEMS_D];
let workRoot: string;
beforeAll(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "dsa-pack-"));
});
const runner: CodeRunner = { run: (request) => execute(request, { workRoot, slot: null }) };

async function build(): Promise<DsaPack> {
  const problems = [];
  for (const p of EVAL) {
    const inputs = testInputs(p).filter((t) => t.size !== "big");
    const ran = await runner.run({ language: "python", source: p.reference, tests: inputs.map((t) => ({ id: t.id, input: t.input, expected: "" })), limits: { timeMs: p.timeMs ?? 2000, memoryMb: 256 } });
    if (!ran.compiled) throw new Error(`${p.slug}: the reference does not run`);
    const tests = inputs.map((t, i) => {
      const out = ran.tests[i]!;
      if (out.status !== "passed" && out.status !== "wrong_answer") throw new Error(`${p.slug}: the reference gave ${out.status} on ${t.id}`);
      return { id: t.id, input: t.input, expected: out.stdout, hidden: t.hidden, weight: 1 };
    });
    problems.push({
      slug: p.slug,
      title: p.title,
      difficulty: p.difficulty,
      tags: p.tags,
      statement: p.statement,
      inputFormat: p.inputFormat,
      outputFormat: p.outputFormat,
      constraints: p.constraints,
      tests,
      optimal: p.editorial,
      optimalTime: p.optimal,
      bruteTime: p.bugs.find((b) => b.kind === "tle")!.time,
      reference: p.reference,
      ...(p.timeMs === undefined ? {} : { timeMs: p.timeMs }),
    });
  }
  return { problems };
}

describe("the DSA starter", () => {
  it("is the eval's problems, each test's expected output the reference program's own", async () => {
    const built = await build();
    if (process.env["WRITE_DSA_PACK"] === "1") {
      writeFileSync(
        new URL("./content/dsa-starter.ts", import.meta.url),
        `// Made by content-dsa.test.ts from the Sahayak eval's problems (written for Parikshaa); do not edit by hand.\n` +
          `// Each test's expected output is the reference program's, run on the real runner.\n` +
          `import type { DsaPack } from "./packs.js";\n\nexport const DSA_STARTER: DsaPack = ${JSON.stringify(built, null, 2)};\n`,
      );
    }
    expect(DSA_STARTER).toEqual(built);
  }, 300_000);

  it("is valid, has a hint and a brute force for every problem written for it, and names its approaches", () => {
    const questions = DSA_STARTER.problems.map(dsaQuestion);
    expect(validateExam({ id: examId("dsa"), title: "DSA", questions, policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 } })).toEqual({ ok: true });
    expect(Object.keys(DSA_TEXT).sort()).toEqual(DSA_STARTER.problems.map((p) => p.slug).sort());
    for (const p of DSA_STARTER.problems) {
      const text = DSA_TEXT[p.slug]!;
      // A first hint is an observation: no code, and not the editorial's words.
      expect(text.hint, p.slug).not.toMatch(/```|def |for \(|while /);
      expect(text.hint.length, p.slug).toBeLessThan(260);
      expect(p.tests.some((t) => !t.hidden) && p.tests.some((t) => t.hidden), p.slug).toBe(true);
      const better = DSA_BETTER[p.slug];
      const editorial = dsaEditorial(p, text.brute, better);
      expect(editorial, p.slug).toMatch(/^## Brute force\n/);
      expect(editorial, p.slug).toMatch(/\n## Optimal\n/);
      expect(editorial, p.slug).toContain(p.reference.trim());
      if (better !== undefined) {
        // Between the two, in that order, with its own time.
        expect(editorial.indexOf("## Better"), p.slug).toBeGreaterThan(editorial.indexOf("## Brute force"));
        expect(editorial.indexOf("## Better"), p.slug).toBeLessThan(editorial.indexOf("## Optimal"));
        expect(better.time, p.slug).toMatch(/^O\(/);
        expect(better.text, p.slug).not.toMatch(/```/);
      } else {
        expect(editorial, p.slug).not.toContain("## Better");
      }
    }
    // Only real problems of the pack, and enough of them to matter.
    expect(Object.keys(DSA_BETTER).every((slug) => DSA_STARTER.problems.some((p) => p.slug === slug))).toBe(true);
    expect(Object.keys(DSA_BETTER).length).toBeGreaterThanOrEqual(15);
  });
});
