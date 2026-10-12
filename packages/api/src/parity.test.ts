import type { CodeRunner, RunRequest, RunResult } from "@parikshaa/runner";
import { describe, expect, it } from "vitest";
import { compareRunners, parityCases, type ParityCase } from "./parity.js";

/** The parity suite (G3): its cases, and how two runners are compared. The real comparison runs on staging. */

const passes = (request: RunRequest): RunResult => ({ compiled: true, tests: request.tests.map((t) => ({ id: t.id, status: "passed", timeMs: 1, memoryKb: 1, stdout: "", stderr: "" })) });
const runner = (fn: (request: RunRequest) => RunResult | Promise<RunResult>): CodeRunner => ({ run: async (request) => fn(request) });

describe("the parity suite", () => {
  it("has every DSA and SQL reference, wrong programs, a compile error and each language's hello", () => {
    const cases = parityCases();
    const names = cases.map((c) => c.name);
    expect(names.filter((n) => n.startsWith("dsa ") && n.endsWith(": reference"))).toHaveLength(40);
    expect(names.filter((n) => n.startsWith("sql "))).toHaveLength(8);
    expect(cases.filter((c) => c.expect !== "passed").map((c) => c.expect)).toEqual(expect.arrayContaining(["wrong_answer", "runtime_error", "time_limit", "memory_limit", "compile_error"]));
    expect(new Set(cases.map((c) => c.request.language))).toEqual(new Set(["python", "javascript", "c", "cpp", "java", "sql"]));
    expect(new Set(names).size).toBe(names.length);
    for (const c of cases) expect(c.request.tests.length).toBeGreaterThan(0);
  });

  it("counts a case the same only when both runners agree with each other and with what was expected", async () => {
    const cases: ParityCase[] = [
      { name: "both pass", request: { language: "python", source: "ok", tests: [{ id: "t", input: "", expected: "" }] }, expect: "passed" },
      { name: "they differ", request: { language: "python", source: "differs", tests: [{ id: "t", input: "", expected: "" }] } },
      { name: "both wrong the same way", request: { language: "python", source: "bad", tests: [{ id: "t", input: "", expected: "" }] }, expect: "passed" },
      { name: "one is down", request: { language: "cpp", source: "ok", tests: [{ id: "t", input: "", expected: "" }] } },
    ];
    const wrong = (r: RunRequest): RunResult => ({ compiled: false, compileOutput: r.source });
    const a = runner((r) => (r.source === "bad" ? wrong(r) : passes(r)));
    const b = runner((r) => {
      if (r.language === "cpp") throw new Error("Judge0 could not be reached");
      return r.source === "differs" ? { compiled: true, tests: [{ id: "t", status: "time_limit", timeMs: 1, memoryKb: null, stdout: "", stderr: "" }] } : r.source === "bad" ? wrong(r) : passes(r);
    });
    const seen: string[] = [];
    const report = await compareRunners(a, b, cases, { concurrency: 2, onCase: (name, ok) => seen.push(`${ok ? "same" : "diff"} ${name}`) });
    expect(report).toMatchObject({ cases: 4, same: 1 });
    expect(report.differences.map((d) => d.name).sort()).toEqual(["both wrong the same way", "one is down", "they differ"]);
    expect(report.differences.find((d) => d.name === "they differ")).toEqual({ name: "they differ", a: ["passed"], b: ["time_limit"] });
    expect(report.differences.find((d) => d.name === "one is down")!.b[0]).toMatch(/^unavailable: /);
    expect(seen).toContain("same both pass");
  });
});
