import type { CodeTest } from "@parikshaa/core";
import type { CodeRunner, RunResult } from "@parikshaa/runner";
import { rng, type Bug, type EvalProblem } from "./types.js";

/**
 * A problem's tests, and a check that its programs behave as the eval says
 * they do. Expected outputs are the reference program's own; the slow and the
 * overflowing programs, which are right on small inputs, must agree with it
 * there, which checks the reference too.
 */

const SMALL_TESTS = 4;

const seedOf = (slug: string) => [...slug].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

export interface TestInput {
  readonly id: string;
  readonly input: string;
  readonly hidden: boolean;
  /** small: every program but the off-by-one is right here. */
  readonly size: "example" | "small" | "edge" | "big";
}

export function testInputs(p: EvalProblem): TestInput[] {
  const r = rng(seedOf(p.slug));
  return [
    ...p.examples.map((input, i) => ({ id: `e${i + 1}`, input, hidden: false, size: "example" as const })),
    ...Array.from({ length: SMALL_TESTS }, (_, i) => ({ id: `s${i + 1}`, input: p.small(r), hidden: true, size: "small" as const })),
    ...(p.edges ?? []).map((input, i) => ({ id: `x${i + 1}`, input, hidden: true, size: "edge" as const })),
    { id: "b1", input: p.big(r), hidden: true, size: "big" as const },
  ];
}

const LANGUAGE = { python: "python", cpp: "cpp", java: "java" } as const;
const limitsOf = (p: EvalProblem) => ({ timeMs: p.timeMs ?? 2000, memoryMb: 256 });

/** The problem's tests with expected outputs, from running the reference. */
export async function buildTests(p: EvalProblem, runner: CodeRunner): Promise<CodeTest[]> {
  const inputs = testInputs(p);
  const ran = await runner.run({ language: "python", source: p.reference, tests: inputs.map((t) => ({ id: t.id, input: t.input, expected: "" })), limits: limitsOf(p) });
  if (!ran.compiled) throw new Error(`${p.slug}: the reference does not run`);
  return inputs.map((t, i) => {
    const out = ran.tests[i]!;
    if (out.status !== "passed" && out.status !== "wrong_answer") throw new Error(`${p.slug}: the reference gave ${out.status} on ${t.id}: ${out.stderr.slice(0, 300)}`);
    return { id: t.id, input: t.input, expected: out.stdout, hidden: t.hidden, weight: 1 };
  });
}

export interface BugCheck {
  readonly kind: Bug["kind"];
  readonly ok: boolean;
  readonly why: string;
  readonly statuses: Readonly<Record<string, string>>;
}

export async function runProgram(p: EvalProblem, tests: readonly CodeTest[], language: Bug["language"], source: string, runner: CodeRunner): Promise<RunResult> {
  return runner.run({ language: LANGUAGE[language], source, tests: tests.map(({ id, input, expected }) => ({ id, input, expected })), limits: limitsOf(p) });
}

/** Whether each wrong program is wrong the way it claims, and right where it should be. */
export async function checkBugs(p: EvalProblem, tests: readonly CodeTest[], runner: CodeRunner): Promise<BugCheck[]> {
  const sizes = new Map(testInputs(p).map((t) => [t.id, t.size]));
  const checks: BugCheck[] = [];
  for (const bug of p.bugs) {
    const result = await runProgram(p, tests, bug.language, bug.source, runner);
    if (!result.compiled) {
      checks.push({ kind: bug.kind, ok: false, why: `does not compile: ${result.compileOutput.slice(0, 300)}`, statuses: {} });
      continue;
    }
    const statuses = Object.fromEntries(result.tests.map((t) => [t.id, t.status]));
    const on = (size: string) => result.tests.filter((t) => sizes.get(t.id) === size);
    const allPass = (size: string) => on(size).every((t) => t.status === "passed");
    let ok: boolean;
    let why: string;
    if (bug.kind === "off_by_one") {
      ok = result.tests.some((t) => t.status === "wrong_answer" || t.status === "runtime_error");
      why = ok ? "fails a test" : "passes every test";
    } else if (bug.kind === "overflow") {
      const rightWhenSmall = allPass("example") && allPass("small");
      const wrongSomewhere = result.tests.some((t) => t.status === "wrong_answer");
      const notSlow = result.tests.every((t) => t.status !== "time_limit");
      ok = rightWhenSmall && wrongSomewhere && notSlow;
      why = !rightWhenSmall ? "wrong on small tests too" : !wrongSomewhere ? "never overflows" : !notSlow ? "runs out of time" : "right when small, wrong when large";
    } else {
      const rightWhenSmall = allPass("example") && allPass("small") && allPass("edge");
      const slow = on("big").every((t) => t.status === "time_limit");
      ok = rightWhenSmall && slow;
      why = !rightWhenSmall ? "wrong on small tests" : !slow ? `the big test ended ${on("big")[0]?.status}` : "right when small, too slow when large";
    }
    checks.push({ kind: bug.kind, ok, why, statuses });
  }
  return checks;
}
