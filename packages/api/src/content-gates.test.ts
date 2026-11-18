import { describe, expect, it } from "vitest";
import { RunnerUnavailable } from "@parikshaa/runner";
import { NOT_CHECKED, runGates } from "./content-gates.js";
import { project, projectionProblems, visualText } from "./content-publish.js";
import { ADD, dsaItem, fakeRunner, HELLO, lessonItem, mcqItem, ORDERS, SOLVER, sqlItem, SUM } from "./testing/content-fixtures.js";

/** Gates 3–11 of a content upload, on a fake runner that knows what the fixtures' programs print (row 141 part B). */

const messages = (o: { problems: readonly { gate: string; message: string }[] }) => o.problems.map((p) => `${p.gate}: ${p.message}`);

describe("a DSA problem's gates", () => {
  it("make the tests from the generators and the Python reference, and run every solution and starter against them", async () => {
    const { run, requests } = fakeRunner();
    const out = await runGates("dsa-problem", dsaItem(), run);
    expect(messages(out)).toEqual([]);
    const tests = out.built.tests!;
    expect(tests).toHaveLength(25);
    expect(tests[0]).toEqual({ id: "samples-1", group: "samples", hidden: false, input: "3\n1 2 3\n", expected: "6\n", explanation: "1 + 2 + 3 = 6." });
    expect(tests.find((t) => t.id === "random_small-1")).toMatchObject({ hidden: true, input: expect.stringMatching(/^5\n/) });
    // Producing steps ask for the whole output; judging steps run each solution as a learner's.
    expect([...new Set(requests.filter((r) => r.fullOutput === true).map((r) => r.source))]).toEqual([SUM.generator, SUM.validator, SUM.python]);
    expect(requests.filter((r) => r.source === SUM.brute).flatMap((r) => r.tests)).toHaveLength(tests.filter((t) => ["samples", "minimal", "edge", "random_small"].includes(t.group)).length);
    expect(requests.filter((r) => r.source === SUM.cpp)[0]?.limits).toEqual({ timeMs: 1000, memoryMb: 256 });
    expect(out.warnings).toEqual(expect.arrayContaining([NOT_CHECKED.mutation, NOT_CHECKED.timeLimit]));
  });

  it("fails an item whose wrong solution passes, whose literal output disagrees, or whose starter passes", async () => {
    const item = dsaItem();
    const plan = item.test_plan.map((g) => (g.group === "samples" ? { ...g, tests: [{ input: "3\n1 2 3\n", expected: "7\n", explanation: "Wrong on purpose." }, g.tests![1]!] } : g));
    const solutions = item.solutions.map((s) => (s.src === SUM.wrongMax ? { ...s, src: SUM.brute } : s));
    const out = await runGates("dsa-problem", dsaItem({ test_plan: plan }), fakeRunner().run);
    expect(messages(out)).toEqual(["reference: test samples-1: the expected output given differs from the Python reference's"]);
    const weak = await runGates("dsa-problem", dsaItem({ solutions }), fakeRunner().run);
    expect(messages(weak)).toEqual(["wrong: the wrong solution (python, prints the largest value instead of the total) passes every test: the tests are too weak to catch it"]);
    const ready = await runGates("dsa-problem", dsaItem({ starters: { ...item.starters, python: SUM.python } }), fakeRunner().run);
    expect(messages(ready)).toEqual(["starter: the starter (python) already passes the samples"]);
    const broken = await runGates("dsa-problem", dsaItem({ starters: { ...item.starters, java: "class Main {" } }), fakeRunner().run);
    expect(messages(broken)).toEqual([expect.stringMatching(/^starter: the starter \(java\) does not compile/)]);
  });

  it("fails an input the validator rejects, and a reference that crashes", async () => {
    const strict = fakeRunner(new Map([[SUM.validator, (input: string) => (input.startsWith("4\n") ? { stdout: "", status: "runtime_error" as const } : { stdout: "" })]]));
    const out = await runGates("dsa-problem", dsaItem(), strict.run);
    expect(messages(out)).toEqual(["constraints: test edge-3 breaks the constraints (validator): RE"]);
    const crash = fakeRunner(new Map([[SUM.python, (input: string) => (input.startsWith("1\n") ? { stdout: "", status: "runtime_error" as const } : { stdout: "1\n" })]]));
    const failed = await runGates("dsa-problem", dsaItem(), crash.run);
    expect(messages(failed)).toEqual(expect.arrayContaining(["reference: the Python reference fails on minimal-1: RE"]));
  });

  it("checks only the default variant set, and says so", async () => {
    const item = dsaItem({ variants: { params: [{ name: "shop", description: "the shop's name" }], sets: [{ shop: "tea stall" }, { shop: "juice stall" }] }, statement: `${dsaItem().statement} The shop is a {{shop}}.` });
    const out = await runGates("dsa-problem", item, fakeRunner().run);
    expect(messages(out)).toEqual([]);
    expect(out.warnings).toContain(NOT_CHECKED.variants(2));
    const projected = project("dsa-problem", item, out.built);
    expect(projected.kind === "problem" && projected.problem.question.stem).toMatch(/The shop is a tea stall\.$/);
  });

  it("splits a run into requests the runner takes", async () => {
    const many = dsaItem({ test_plan: [...dsaItem().test_plan, { group: "random_small", hidden: true, gen: "random_list", args: Array.from({ length: 150 }, (_, i) => [3, 100 + i]) }] });
    const { run, requests } = fakeRunner();
    const out = await runGates("dsa-problem", many, run);
    expect(messages(out)).toEqual([]);
    expect(Math.max(...requests.map((r) => r.tests.length))).toBeLessThanOrEqual(100);
    // A 1-second limit: 72 tests to a request, so no request outlasts the runner client's two minutes.
    expect(requests.filter((r) => r.source === SUM.c).map((r) => r.tests.length)).toEqual([72, 72, 31]);
  });
});

describe("an SQL problem's gates", () => {
  it("make each dataset a test, the reference's rows its expected output, and run the right and wrong queries", async () => {
    const { run, requests } = fakeRunner();
    const out = await runGates("sql-problem", sqlItem(), run);
    expect(messages(out)).toEqual([]);
    expect(out.built.tests?.map((t) => [t.id, t.hidden])).toEqual([
      ["sample", false],
      ["empty", true],
      ["nulls", true],
      ["ties", true],
      ["dupes", true],
      ["many", true],
    ]);
    expect(out.built.tests?.[0]?.expected).toBe("asha\t17\nravi\t5\n");
    expect(out.built.tests?.[5]?.input.split("\n").filter((l) => l.startsWith("INSERT")).length).toBe(200);
    expect(requests.filter((r) => r.source === ORDERS.alternative)[0]?.checker).toEqual({ kind: "unordered" });
  });

  it("fails a wrong query that every dataset lets through", async () => {
    const out = await runGates("sql-problem", sqlItem({ wrong: [{ src: ORDERS.alternative, why: "is not wrong at all" }, sqlItem().wrong[1]] }), fakeRunner().run);
    expect(messages(out)).toEqual(["wrong: the wrong query (is not wrong at all) passes every dataset: add a dataset that catches it"]);
  });
});

describe("an MCQ's gates", () => {
  it("hold the key to the solver for every variant set, and keep the default set's values", async () => {
    const { run, requests } = fakeRunner();
    const out = await runGates("mcq", mcqItem(), run);
    expect(messages(out)).toEqual([]);
    expect(requests.map((r) => r.tests[0]?.input)).toEqual(['{"a":12,"b":30}', '{"a":15,"b":40}']);
    expect(out.built.values).toEqual({ s: 42, s1: 43, s2: 41, s3: 360 });
    const projected = project("mcq", mcqItem(), out.built);
    expect(projected.kind === "problem" && projected.problem.question).toMatchObject({ kind: "mcq", stem: expect.stringContaining("12 mangoes"), options: ["42", "43", "41", "360"], correctIndex: 0 });
    // Section, then topic, lead: Learn's aptitude screen groups by them (K2-8).
    expect(projected.kind === "problem" && projected.problem.tags).toEqual(["aptitude-quant", "arithmetic"]);
    // The shortcut is filled like the rest: a variant's parameter from the default set, a derived value from the solver.
    const short = project("mcq", mcqItem({ shortcut: "Add {{a}} and {{b}}: {{s}}." }), out.built);
    expect(short.kind === "problem" && short.problem.editorial).toMatch(/> \*\*Shortcut:\*\* Add 12 and 30: 42\.$/);
  });

  it("fails a key the solver disagrees with, naming the set", async () => {
    const out = await runGates("mcq", mcqItem({ correct: 1, distractors: [] }), fakeRunner().run);
    expect(messages(out)).toEqual(['solver: the solver says "42", the key is "43" [set 1]', 'solver: the solver says "55", the key is "56" [set 2]']);
  });

  it("needs no runner without a solver", async () => {
    const { solver: _, ...plain } = mcqItem({ variants: undefined, section: "aptitude-verbal", stem: "Pick the word that means fast.", options: ["quick", "slow", "late", "tired"], explanation: "### Understand\n\nA synonym.\n\n### Plan\n\nMatch.\n\n### Solve\n\nQuick.\n\n### Check\n\nThe rest mean other things." });
    expect(await runGates("mcq", plain, null)).toEqual({ problems: [], warnings: [], built: {} });
  });
});

describe("a lesson's gates", () => {
  it("run each code block with an expected output, and its hands-on solution and starter", async () => {
    const { run, requests } = fakeRunner();
    const out = await runGates("lesson", lessonItem(), run);
    expect(messages(out)).toEqual([]);
    expect(requests.map((r) => r.source)).toEqual([HELLO, ADD.solution, ADD.starter]);
  });

  it("fails a block that prints something else, and a hands-on starter that passes already", async () => {
    const lesson = lessonItem();
    const sections = lesson.sections.map((s) => (s.code === undefined ? s : { ...s, code: [{ ...s.code[0]!, expected_output: "hi\n" }] }));
    const out = await runGates("lesson", lessonItem({ sections, hands_on: [{ ...lesson.hands_on[0]!, starter: ADD.solution }] }), fakeRunner().run);
    expect(messages(out)).toEqual([expect.stringMatching(/^code: the code block in "The idea" \(python\) does not print its expected_output/), "hands-on: hands_on add-two: the starter already passes every test"]);
  });
});

describe("the runner", () => {
  it("missing, fails an item that needs it", async () => {
    expect(messages(await runGates("sql-problem", sqlItem(), null))).toEqual([expect.stringMatching(/^runner: No code runner is set up/)]);
  });

  it("unreachable, stops the gates so the item waits for another try", async () => {
    const down = async () => {
      throw new RunnerUnavailable("down");
    };
    await expect(runGates("mcq", mcqItem(), down)).rejects.toBeInstanceOf(RunnerUnavailable);
  });

  it("is not asked about a project, which says what was not checked", async () => {
    expect(await runGates("project", {}, null)).toEqual({ problems: [], warnings: [NOT_CHECKED.project], built: {} });
  });
});

describe("the projection", () => {
  it("makes a DSA problem with its tests, every language, the references in its editorial and the dry run as a table", async () => {
    const out = await runGates("dsa-problem", dsaItem(), fakeRunner().run);
    const projected = project("dsa-problem", dsaItem(), out.built);
    if (projected.kind !== "problem") throw new Error("expected a problem");
    const q = projected.problem.question;
    expect(q).toMatchObject({ kind: "code", language: "python", languages: ["c", "cpp", "java", "python", "javascript"], limits: { timeMs: 3000, memoryMb: 256 } });
    expect(q.kind === "code" && q.tests?.length).toBe(25);
    expect(projected.problem.editorial).toContain("```cpp\n#include <bits/stdc++.h>");
    expect(projected.problem.editorial).not.toContain("[[code-tabs]]");
    expect(projected.problem.editorial).toContain("| Step | total | Note |");
    expect(projected.problem).toMatchObject({ hint: "Walk the list once.", tags: ["arrays", "simulation"] });
    expect(projectionProblems(projected)).toEqual([]);
  });

  it("makes a lesson's body from its sections, and its quiz and hands-on tasks problems of their own", () => {
    const projected = project("lesson", lessonItem(), {});
    if (projected.kind !== "lesson") throw new Error("expected a lesson");
    expect(projected.lesson.body).toMatch(/^## Why it matters\n\n/);
    expect(projected.lesson.body).toContain("```python\nprint(\"hello, parikshaa\")\n```");
    expect(projected.lesson.body).toContain("**Q:** What is a process?");
    expect(projected.quiz.map((q) => q.slug)).toEqual(["os-what-a-process-is-q1", "os-what-a-process-is-q2", "os-what-a-process-is-q3"]);
    expect(projected.handsOn.map((h) => [h.slug, h.question.kind])).toEqual([["os-what-a-process-is-add-two", "code"]]);
    // The course leads, as an MCQ's section does.
    expect(projected.quiz[0]!.tags).toEqual(["os", "processes"]);
    expect(projectionProblems(projected)).toEqual([]);
  });

  it("leaves projects and system design as drafts", () => {
    expect(project("project", {}, {})).toEqual({ kind: "none", reason: expect.stringContaining("no project page") });
  });

  it("shows a visual it cannot draw as what it shows", () => {
    expect(visualText({ id: "g", kind: "graph", alt: "Three towns joined in a ring.", data: {} })).toBe("*Three towns joined in a ring.*");
    expect(SOLVER).toContain("json.dumps");
  });
});
