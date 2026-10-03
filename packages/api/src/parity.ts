import type { CodeRunner, RunRequest, RunResult } from "@parikshaa/runner";
import { DSA_STARTER } from "./content/dsa-starter.js";
import { SQL_STARTER } from "./content/sql-starter.js";

/**
 * The parity suite (docs/F1-GO-LIVE-PLAN.md §5.1, G3): the same programs on
 * two runners, which must give the same verdict for every test. Judge0 needs
 * cgroup v1, so CI cannot run it; staging runs `npm run parity` against both
 * backends each night, and before Judge0 takes real exams.
 *
 * The cases: every DSA problem's reference program, which must pass on both;
 * every SQL problem's reference query; a wrong answer, a crash, a program that
 * never stops and one that eats memory, on a few problems; a program that does
 * not compile; and each language's hello world.
 */

export interface ParityCase {
  readonly name: string;
  readonly request: RunRequest;
  /** What every test must come to, on both runners, when it is known. */
  readonly expect?: string;
}

const WRONG: readonly { readonly name: string; readonly source: string; readonly expect: string }[] = [
  { name: "wrong answer", source: "print(0)\n", expect: "wrong_answer" },
  { name: "crash", source: "import sys\nsys.stdin.read()\nraise ValueError('boom')\n", expect: "runtime_error" },
  { name: "never stops", source: "while True:\n    pass\n", expect: "time_limit" },
  { name: "eats memory", source: "x = []\nwhile True:\n    x.append(' ' * 10_000_000)\n", expect: "memory_limit" },
];

const HELLO: readonly [RunRequest["language"], string][] = [
  ["python", 'print("hello")\n'],
  ["javascript", 'console.log("hello");\n'],
  ["c", '#include <stdio.h>\nint main(void){puts("hello");return 0;}\n'],
  ["cpp", '#include <iostream>\nint main(){std::cout<<"hello\\n";}\n'],
  ["java", 'public class Main{public static void main(String[] a){System.out.println("hello");}}\n'],
];

export function parityCases(): ParityCase[] {
  const cases: ParityCase[] = [];
  for (const p of DSA_STARTER.problems) {
    const limits = p.timeMs === undefined ? {} : { limits: { timeMs: p.timeMs } };
    cases.push({ name: `dsa ${p.slug}: reference`, request: { language: "python", source: p.reference, tests: p.tests, ...limits }, expect: "passed" });
  }
  for (const p of DSA_STARTER.problems.slice(0, 3)) {
    for (const w of WRONG) {
      cases.push({ name: `dsa ${p.slug}: ${w.name}`, request: { language: "python", source: w.source, tests: p.tests.slice(0, 2) }, expect: w.expect });
    }
  }
  for (const p of SQL_STARTER.problems) {
    cases.push({
      name: `sql ${p.slug}: reference`,
      request: { language: "sql", source: p.reference, tests: p.tests, ...(p.ordered ? {} : { checker: { kind: "unordered" } }) },
      expect: "passed",
    });
  }
  cases.push({ name: "cpp: does not compile", request: { language: "cpp", source: "int main( {\n", tests: [{ id: "t", input: "", expected: "" }] }, expect: "compile_error" });
  for (const [language, source] of HELLO) {
    cases.push({ name: `${language}: hello`, request: { language, source, tests: [{ id: "t", input: "", expected: "hello\n" }] }, expect: "passed" });
  }
  return cases;
}

const verdicts = (result: RunResult): string[] => (result.compiled ? result.tests.map((t) => t.status) : ["compile_error"]);

export interface ParityReport {
  readonly cases: number;
  readonly same: number;
  /** Each case where the runners differ, or either missed what was expected. */
  readonly differences: readonly { readonly name: string; readonly a: readonly string[]; readonly b: readonly string[] }[];
}

/** Run every case on both runners, a few at a time, and say where they differ. */
export async function compareRunners(a: CodeRunner, b: CodeRunner, cases: readonly ParityCase[], options: { readonly concurrency?: number; readonly onCase?: (name: string, ok: boolean) => void } = {}): Promise<ParityReport> {
  const differences: { name: string; a: string[]; b: string[] }[] = [];
  const outcome = (error: unknown) => [`unavailable: ${error instanceof Error ? error.message : String(error)}`];
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const c = cases[next++]!;
      const [x, y] = await Promise.all([a.run(c.request).then(verdicts, outcome), b.run(c.request).then(verdicts, outcome)]);
      const ok = x.join() === y.join() && (c.expect === undefined || x.every((v) => v === c.expect));
      if (!ok) differences.push({ name: c.name, a: x, b: y });
      options.onCase?.(c.name, ok);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 4) }, worker));
  return { cases: cases.length, same: cases.length - differences.length, differences };
}
