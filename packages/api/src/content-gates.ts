import { accepts, normalise, type Checker, type RunRequest, type RunResult, type TestResult } from "@parikshaa/runner";
import type { ContentType, GateProblem } from "@parikshaa/store";
import { bruteHeldTo } from "./content-rules.js";
import type { ContentChecker, DesignItem, DsaItem, LessonItem, McqItem, SqlItem } from "./content/types.js";

/**
 * Gates 3–11 of a content upload, on the code runner (docs/content/
 * CONTENT-FORMAT.md §11): what only running the item's programs can show.
 *
 * Producing steps (a generator's test input, the Python reference's expected
 * output, an SQL reference's rows, an MCQ solver's answer) ask the runner for
 * each test's whole output (`fullOutput`). Judging steps run every solution
 * against every test, as a learner's would be. Runs go one after another: a
 * bulk upload takes one place in the judge's queue at a time, and learners'
 * runs keep theirs.
 *
 * Not checked yet, and said so in every report it applies to: mutation
 * (gate 10), the time-limit gate (PROBLEM-STANDARD §4c) and a starter's
 * reading time, variant sets after the first for DSA and SQL, and the runner
 * gates of projects and LLD katas (the platform has no page for them yet).
 */

export type Run = (request: RunRequest) => Promise<RunResult>;

/** A test the gates made, with the expected output the reference gave. */
export interface BuiltTest {
  readonly id: string;
  readonly group: string;
  readonly hidden: boolean;
  readonly input: string;
  readonly expected: string;
  readonly explanation?: string;
}

/** What the gates made that publishing needs. */
export interface Built {
  /** DSA and SQL: the tests, expected outputs filled in. */
  readonly tests?: readonly BuiltTest[];
  /** MCQ: the values the solver derived for the default set, for the {{name}} in its text. */
  readonly values?: Readonly<Record<string, unknown>>;
}

export interface GateOutcome {
  readonly problems: GateProblem[];
  readonly warnings: string[];
  readonly built: Built;
}

const MIB = 1024 * 1024;
/** Most of a run's tests by size, and how long one request may take, so no request outlasts the runner client's patience. */
const BATCH_BYTES = 40 * MIB;
const BATCH_MS = 90_000;
const PRODUCE_MS = 10_000;
const PRODUCE_MB = 512;

export const NOT_CHECKED = {
  mutation: "not checked yet: mutation (gate 10), whether the tests kill small changes to the Python reference",
  timeLimit: "not checked yet: the time-limit gate (PROBLEM-STANDARD §4c), and whether a starter reads the largest input within 20% of the time limit",
  variants: (sets: number) => `not checked yet: variant sets 2 to ${sets}; only the first set (the default) went through the gates`,
  project: "not checked yet: the runner gates of a project (its starter fails and its solution passes): Learn has no project page yet",
  kata: "not checked yet: the runner gates of an LLD kata (starters, solutions, the change request): Learn has no kata page yet",
} as const;

class NoRunner extends Error {}

const verdicts: Record<string, string> = { passed: "OK", wrong_answer: "WA", time_limit: "TLE", memory_limit: "MLE", runtime_error: "RE", output_limit: "OLE", checker_error: "CHECKER" };
const lastLine = (text: string) => text.trim().split("\n").pop()?.slice(0, 200) ?? "";
const allPassed = (r: RunResult) => r.compiled && r.tests.every((t) => t.status === "passed");
function summarise(r: RunResult): string {
  if (!r.compiled) return `does not compile: ${r.compileOutput.split("\n").slice(0, 4).join(" | ").slice(0, 400)}`;
  const bad = r.tests.filter((t) => t.status !== "passed");
  const shown = bad.slice(0, 4).map((t) => `${t.id} ${verdicts[t.status] ?? t.status}${t.stderr.trim() === "" ? "" : ` (${lastLine(t.stderr)})`}`);
  return `${r.tests.length - bad.length}/${r.tests.length} passed; ${shown.join(", ")}${bad.length > 4 ? ", …" : ""}`;
}

const runChecker = (c: ContentChecker | undefined): Checker | undefined => (c === undefined || c.kind === "exact" ? undefined : (c as Checker));
/** Whether a literal expected output agrees with the reference's, as the item's checker would judge it. */
function agrees(checker: ContentChecker | undefined, given: string, made: string): boolean {
  if (checker === undefined || checker.kind === "custom") return normalise(given) === normalise(made);
  return accepts(checker as Exclude<Checker, { kind: "custom" }>, given, made);
}

/** Every string's {{name}} filled from the default set: the item the gates check. */
export function defaultSet<T>(item: T): T {
  const variants = (item as { variants?: { params: { name: string }[]; sets: Record<string, unknown>[] } }).variants;
  if (variants === undefined) return item;
  const set = variants.sets[0] ?? {};
  const names = new Set(variants.params.map((p) => p.name));
  const sub = (x: unknown): unknown =>
    typeof x === "string"
      ? x.replace(/\{\{([a-z][a-z0-9_]{0,30})\}\}/g, (m, name: string) => (names.has(name) && name in set ? String(set[name]) : m))
      : Array.isArray(x)
        ? x.map(sub)
        : x !== null && typeof x === "object"
          ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "variants" ? v : sub(v)]))
          : x;
  return sub(item) as T;
}

/**
 * The runner, for the gates: tests split into requests the runner takes (100
 * tests, 40 MiB, about 90 seconds of running each), the results joined.
 */
class Runner {
  constructor(readonly run: Run | null) {}

  async all(request: RunRequest): Promise<RunResult> {
    if (this.run === null) throw new NoRunner();
    const timeMs = Math.min(10_000, Math.max(100, Math.round(request.limits?.timeMs ?? 2000)));
    const perBatch = Math.max(1, Math.min(100, Math.floor(BATCH_MS / (timeMs + 250))));
    const batches: (typeof request.tests)[number][][] = [];
    let batch: (typeof request.tests)[number][] = [];
    let size = 0;
    for (const t of request.tests) {
      const bytes = t.input.length + t.expected.length;
      if (batch.length > 0 && (batch.length >= perBatch || size + bytes > BATCH_BYTES)) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      batch.push(t);
      size += bytes;
    }
    if (batch.length > 0 || request.tests.length === 0) batches.push(batch);
    const results: TestResult[] = [];
    for (const tests of batches) {
      const r = await this.run({ ...request, tests, limits: { timeMs, memoryMb: Math.min(1024, Math.max(32, request.limits?.memoryMb ?? 256)) } });
      if (!r.compiled) return r;
      results.push(...r.tests);
    }
    return { compiled: true, tests: results };
  }

  /** Each input's whole standard output: ok when the program finished well (exit 0, in time, within its output). */
  async produce(language: RunRequest["language"], source: string, inputs: readonly { readonly id: string; readonly input: string }[], timeMs = PRODUCE_MS): Promise<Map<string, { ok: boolean; stdout: string; why: string }>> {
    const out = new Map<string, { ok: boolean; stdout: string; why: string }>();
    if (inputs.length === 0) return out;
    const r = await this.all({ language, source, tests: inputs.map((i) => ({ id: i.id, input: i.input, expected: "" })), limits: { timeMs, memoryMb: PRODUCE_MB }, fullOutput: true });
    if (!r.compiled) {
      for (const i of inputs) out.set(i.id, { ok: false, stdout: "", why: `does not compile: ${lastLine(r.compileOutput)}` });
      return out;
    }
    for (const t of r.tests) {
      const ok = t.status === "passed" || t.status === "wrong_answer";
      out.set(t.id, { ok, stdout: t.stdout, why: ok ? "" : `${verdicts[t.status] ?? t.status}${t.stderr.trim() === "" ? "" : `: ${lastLine(t.stderr)}`}` });
    }
    return out;
  }
}

function wrongMatches(expect: string, r: RunResult): boolean {
  if (!r.compiled) return expect === "FAIL" || expect === "RE";
  const statuses = new Set(r.tests.map((t) => t.status));
  const by: Record<string, boolean> = {
    WA: statuses.has("wrong_answer"),
    TLE: statuses.has("time_limit"),
    RE: statuses.has("runtime_error"),
    MLE: statuses.has("memory_limit") || statuses.has("runtime_error"),
    FAIL: [...statuses].some((s) => s !== "passed"),
  };
  return by[expect] ?? false;
}

// --- DSA ---------------------------------------------------------------------------------------

async function dsa(original: DsaItem, runner: Runner, out: GateOutcome) {
  const item = defaultSet(original);
  const problem = (gate: string, message: string) => out.problems.push({ gate, message });
  const unordered = item.checker?.kind === "unordered";
  const gens = new Map((item.generators ?? []).map((g) => [g.name, g]));

  // The tests: literal ones as given, generated ones from their generator.
  const tests: { id: string; group: string; hidden: boolean; brute: boolean; input: string; given?: string; explanation?: string }[] = [];
  const asks: { gen: string; id: string; input: string; at: number }[] = [];
  for (const g of item.test_plan) {
    let n = 0;
    const brute = bruteHeldTo(g);
    for (const t of g.tests ?? []) {
      tests.push({ id: `${g.group}-${++n}`, group: g.group, hidden: g.hidden, brute, input: t.input, ...(t.expected === undefined ? {} : { given: t.expected }), ...(t.explanation === undefined ? {} : { explanation: t.explanation }) });
    }
    if (g.gen !== undefined) {
      for (const args of g.args ?? []) {
        const id = `${g.group}-${++n}`;
        asks.push({ gen: g.gen, id, input: `${args.join(" ")}\n`, at: tests.length });
        tests.push({ id, group: g.group, hidden: g.hidden, brute, input: "" });
      }
    }
  }
  for (const [name, gen] of gens) {
    const mine = asks.filter((a) => a.gen === name);
    const made = await runner.produce("python", gen.src, mine);
    for (const a of mine) {
      const m = made.get(a.id)!;
      if (!m.ok) problem("generator", `generator ${name} with "${a.input.trim()}" failed: ${m.why}`);
      else tests[a.at]!.input = m.stdout;
    }
  }
  if (out.problems.length > 0) return;
  for (const t of tests) if (Buffer.byteLength(t.input) > MIB) problem("generator", `test ${t.id}: input over 1 MiB (the runner's limit)`);
  if (out.problems.length > 0) return;

  // Gate 3: every input within the constraints.
  if (item.validator !== undefined) {
    const checked = await runner.produce("python", item.validator.src, tests);
    for (const t of tests) {
      const c = checked.get(t.id)!;
      if (!c.ok) problem("constraints", `test ${t.id} breaks the constraints (validator): ${c.why}`);
    }
    if (out.problems.length > 0) return;
  } else out.warnings.push("no validator: the test inputs were not checked against the constraints");

  // Gate 4a: the Python reference makes the expected outputs.
  const reference = item.solutions.find((s) => s.role === "reference" && s.lang === "python")!;
  const made = await runner.produce("python", reference.src, tests);
  const built: BuiltTest[] = [];
  for (const t of tests) {
    const m = made.get(t.id)!;
    if (!m.ok) {
      problem("reference", `the Python reference fails on ${t.id}: ${m.why}`);
      continue;
    }
    if (Buffer.byteLength(m.stdout) > MIB) problem("reference", `test ${t.id}: expected output over 1 MiB (the runner's limit)`);
    if (t.given !== undefined && !agrees(unordered ? { kind: "unordered" } : item.checker, t.given, m.stdout)) problem("reference", `test ${t.id}: the expected output given differs from the Python reference's`);
    built.push({ id: t.id, group: t.group, hidden: t.hidden, input: t.input, expected: m.stdout, ...(t.explanation === undefined ? {} : { explanation: t.explanation }) });
  }
  if (out.problems.length > 0) return;

  // Gates 4b–6: every solution judged as a learner's would be.
  const judge = (subset: readonly typeof tests[number][]) => subset.map((t) => ({ id: t.id, input: t.input, expected: built.find((b) => b.id === t.id)!.expected }));
  const timeOf = (lang: string) => item.limits.time_ms[lang as keyof typeof item.limits.time_ms] ?? 2000;
  const checker = runChecker(item.checker);
  for (const s of item.solutions) {
    const subset = s.role === "brute" ? tests.filter((t) => t.brute) : tests;
    const timeMs = s.role === "brute" ? Math.max(timeOf(s.lang), 5000) : timeOf(s.lang);
    const r = await runner.all({ language: s.lang, source: s.src, tests: judge(subset), limits: { timeMs, memoryMb: item.limits.memory_mb }, ...(checker === undefined ? {} : { checker }) });
    if (s.role === "wrong") {
      if (allPassed(r)) problem("wrong", `the wrong solution (${s.lang}, ${s.why ?? "no reason given"}) passes every test: the tests are too weak to catch it`);
      else if (!wrongMatches(s.expect ?? "FAIL", r)) problem("wrong", `the wrong solution (${s.lang}, ${s.why ?? "no reason given"}) fails, but not with ${s.expect}: ${summarise(r)}`);
    } else if (!allPassed(r)) problem(s.role, `the ${s.role} (${s.lang}) does not pass: ${summarise(r)}`);
    else if (s.role === "reference" && r.compiled) {
      const slowest = Math.max(0, ...r.tests.map((t) => t.timeMs));
      const share = s.lang === "cpp" || s.lang === "c" ? 0.25 : 0.5;
      if (slowest > timeOf(s.lang) * share) out.warnings.push(`the reference (${s.lang}) takes ${slowest} ms on its slowest test, over ${share * 100}% of its time limit`);
    }
  }

  // Gate 7: every starter compiles and does not pass already.
  const shown = tests.filter((t) => t.group === "samples" || t.group === "minimal");
  for (const [lang, src] of Object.entries(item.starters)) {
    if (src === undefined) continue;
    const r = await runner.all({ language: lang as RunRequest["language"], source: src, tests: judge(shown), limits: { timeMs: timeOf(lang), memoryMb: item.limits.memory_mb }, ...(checker === undefined ? {} : { checker }) });
    if (!r.compiled) problem("starter", `the starter (${lang}) does not compile: ${summarise(r)}`);
    else if (allPassed(r)) problem("starter", `the starter (${lang}) already passes the samples`);
  }
  out.warnings.push(NOT_CHECKED.mutation, NOT_CHECKED.timeLimit);
  if (original.variants !== undefined) out.warnings.push(NOT_CHECKED.variants(original.variants.sets.length));
  (out as { built: Built }).built = { tests: built };
}

// --- SQL ---------------------------------------------------------------------------------------

async function sql(original: SqlItem, runner: Runner, out: GateOutcome) {
  const item = defaultSet(original);
  const problem = (gate: string, message: string) => out.problems.push({ gate, message });
  const rows = new Map<string, string>();
  for (const d of item.datasets) {
    if (d.gen === undefined) {
      rows.set(d.id, d.rows_sql ?? "");
      continue;
    }
    const g = (await runner.produce("python", d.gen.src, [{ id: d.id, input: `${d.gen.args ?? ""}\n` }])).get(d.id)!;
    if (!g.ok) problem("generator", `dataset ${d.id}: its generator failed: ${g.why}`);
    else rows.set(d.id, g.stdout);
  }
  if (out.problems.length > 0) return;
  const inputs = item.datasets.map((d) => ({ id: d.id, input: `${item.schema_sql.trim()}\n${rows.get(d.id) ?? ""}` }));
  for (const i of inputs) if (Buffer.byteLength(i.input) > MIB) problem("generator", `dataset ${i.id}: over 1 MiB (the runner's limit)`);
  if (out.problems.length > 0) return;
  const made = await runner.produce("sql", item.reference, inputs, 5000);
  const unordered = !item.order_matters;
  const built: BuiltTest[] = [];
  for (const d of item.datasets) {
    const m = made.get(d.id)!;
    if (!m.ok) {
      problem("reference", `the reference fails on dataset ${d.id}: ${m.why}`);
      continue;
    }
    if (d.expected !== undefined && !agrees(unordered ? { kind: "unordered" } : undefined, d.expected, m.stdout)) problem("reference", `dataset ${d.id}: the expected rows given differ from the reference's`);
    if (d.purpose === "empty" && normalise(m.stdout) !== "" && !/COUNT|SUM|TOTAL|COALESCE/i.test(item.reference)) out.warnings.push(`dataset ${d.id} (empty) gives rows`);
    built.push({ id: d.id, group: d.purpose, hidden: d.hidden, input: inputs.find((i) => i.id === d.id)!.input, expected: m.stdout });
  }
  if (out.problems.length > 0) return;
  const distinct = new Set(built.map((t) => normalise(t.expected)));
  if (distinct.size < Math.min(3, built.length)) out.warnings.push(`only ${distinct.size} different expected outputs across the datasets`);
  const tests = built.map((t) => ({ id: t.id, input: t.input, expected: t.expected }));
  const checker: Checker | undefined = unordered ? { kind: "unordered" } : undefined;
  const judge = (source: string, subset = tests) => runner.all({ language: "sql", source, tests: subset, limits: { timeMs: 5000, memoryMb: 256 }, ...(checker === undefined ? {} : { checker }) });
  for (const [i, q] of [item.reference, ...(item.alternatives ?? [])].entries()) {
    const r = await judge(q);
    if (!allPassed(r)) problem("reference", `${i === 0 ? "the reference" : `alternative ${i}`} does not pass: ${summarise(r)}`);
  }
  for (const w of item.wrong) {
    if (allPassed(await judge(w.src))) problem("wrong", `the wrong query (${w.why}) passes every dataset: add a dataset that catches it`);
  }
  const starter = await judge(item.starter.trim() === "" ? "SELECT 1;" : item.starter, tests.slice(0, 2));
  if (allPassed(starter)) problem("starter", "the starter already passes");
  if (original.variants !== undefined) out.warnings.push(NOT_CHECKED.variants(original.variants.sets.length));
  (out as { built: Built }).built = { tests: built };
}

// --- MCQ ---------------------------------------------------------------------------------------

/** The variant sets: each set's values, every string of the item filled from them. */
function expand<T>(item: T): { index: number; values: Record<string, unknown>; item: T }[] {
  const variants = (item as { variants?: { sets: Record<string, unknown>[] } }).variants;
  if (variants === undefined) return [{ index: 0, values: {}, item }];
  return variants.sets.map((set, index) => ({ index, values: set, item: defaultSet({ ...(item as object), variants: { ...variants, sets: [set] } } as T) }));
}

async function mcq(item: McqItem, runner: Runner, out: GateOutcome) {
  if (item.solver === undefined) return;
  const problem = (message: string) => out.problems.push({ gate: "solver", message });
  for (const { index, values, item: it } of expand(item)) {
    const tag = item.variants === undefined ? "" : ` [set ${index + 1}]`;
    const ran = (await runner.produce("python", it.solver!, [{ id: "solve", input: JSON.stringify(values) }])).get("solve")!;
    if (!ran.ok) {
      problem(`the solver fails: ${ran.why}${tag}`);
      continue;
    }
    let got: { answer?: unknown; values?: Record<string, unknown> };
    try {
      got = JSON.parse(ran.stdout.trim().split("\n").pop() ?? "") as typeof got;
    } catch {
      problem(`the solver's output is not one line of JSON: ${ran.stdout.slice(0, 80)}${tag}`);
      continue;
    }
    const derived = got.values ?? {};
    const fill = (s: string) => s.replace(/\{\{([a-z][a-z0-9_]{0,30})\}\}/g, (m, n: string) => (n in derived ? String(derived[n]) : m));
    const left = [it.stem, it.explanation, ...(it.options ?? [])].map(fill).join("\n").match(/\{\{[a-z][a-z0-9_]*\}\}/);
    if (left !== null) problem(`${left[0]} is not filled for this set (a parameter, or a value the solver prints)${tag}`);
    if (index === 0) (out as { built: Built }).built = { values: derived };
    if (it.kind === "numeric") {
      if (typeof got.answer !== "number") problem(`the solver's answer is not a number${tag}`);
      else if (index === 0 && Math.abs(got.answer - (it.answer ?? Number.NaN)) > Math.max(it.tolerance ?? 0, 1e-9)) problem(`the solver says ${got.answer}, the key is ${it.answer}${tag}`);
      continue;
    }
    const options = (it.options ?? []).map(fill);
    if (new Set(options).size !== options.length) problem(`the options repeat for this set: ${options.join(" | ")}${tag}`);
    const keyed = options[it.correct ?? 0] ?? "";
    if (String(got.answer).trim() !== keyed.trim()) problem(`the solver says "${String(got.answer)}", the key is "${keyed}"${tag}`);
  }
}

// --- lessons ------------------------------------------------------------------------------------

async function lesson(item: LessonItem, runner: Runner, out: GateOutcome) {
  for (const s of item.sections) {
    for (const c of s.code ?? []) {
      if (c.expected_output === undefined) continue;
      const r = await runner.all({ language: c.lang as RunRequest["language"], source: c.src, tests: [{ id: "run", input: c.stdin ?? "", expected: c.expected_output }], limits: { timeMs: 3000, memoryMb: 256 } });
      if (!allPassed(r)) out.problems.push({ gate: "code", message: `the code block in "${s.heading}" (${c.lang}) does not print its expected_output: ${summarise(r)}` });
    }
  }
  for (const h of item.hands_on ?? []) {
    const tests = h.tests.map((t) => ({ id: t.id, input: t.input, expected: t.expected }));
    const checker = runChecker(h.checker);
    const run = (source: string) => runner.all({ language: h.lang, source, tests, limits: { timeMs: 3000, memoryMb: 256 }, ...(checker === undefined ? {} : { checker }) });
    const solution = await run(h.solution);
    if (!allPassed(solution)) out.problems.push({ gate: "hands-on", message: `hands_on ${h.id}: the solution does not pass: ${summarise(solution)}` });
    const starter = await run(h.starter);
    if (!starter.compiled) out.problems.push({ gate: "hands-on", message: `hands_on ${h.id}: the starter does not compile: ${summarise(starter)}` });
    else if (allPassed(starter)) out.problems.push({ gate: "hands-on", message: `hands_on ${h.id}: the starter already passes every test` });
  }
}

// --- system design ------------------------------------------------------------------------------

async function design(item: DesignItem, runner: Runner, out: GateOutcome) {
  for (const e of item.estimates ?? []) {
    if (e.solver === undefined) continue;
    const ran = (await runner.produce("python", e.solver, [{ id: e.id, input: "{}" }])).get(e.id)!;
    const got = Number(ran.stdout.trim().split("\n").pop());
    if (!ran.ok || !Number.isFinite(got)) out.problems.push({ gate: "solver", message: `estimate ${e.id}: the solver failed${ran.why === "" ? "" : `: ${ran.why}`}` });
    else if (Math.abs(got - e.answer) > Math.abs(e.answer) * 1e-9 + 1e-9) out.problems.push({ gate: "solver", message: `estimate ${e.id}: the solver says ${got}, the answer is ${e.answer}` });
  }
  if (item.mode === "lld") out.warnings.push(NOT_CHECKED.kata);
}

/**
 * The runner's gates for one item that passed gates 1–2. Throws
 * RunnerUnavailable when the runner cannot be reached, so the item waits for
 * another try; with no runner configured at all, an item that needs one fails.
 */
export async function runGates(type: ContentType, item: unknown, run: Run | null): Promise<GateOutcome> {
  const out: GateOutcome = { problems: [], warnings: [], built: {} };
  const runner = new Runner(run);
  try {
    if (type === "dsa-problem") await dsa(item as DsaItem, runner, out);
    else if (type === "sql-problem") await sql(item as SqlItem, runner, out);
    else if (type === "mcq") await mcq(item as McqItem, runner, out);
    else if (type === "lesson") await lesson(item as LessonItem, runner, out);
    else if (type === "system-design") await design(item as DesignItem, runner, out);
    else out.warnings.push(NOT_CHECKED.project);
  } catch (error) {
    if (!(error instanceof NoRunner)) throw error;
    out.problems.push({ gate: "runner", message: "No code runner is set up on this server, so this item's programs could not be run. Set RUNNER_URL (or Judge0) and upload it again." });
  }
  return out;
}
