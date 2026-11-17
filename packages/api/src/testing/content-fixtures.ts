import type { RunRequest, RunResult, TestResult } from "@parikshaa/runner";

/**
 * Content items that pass the format's schemas and rules (docs/content/), small
 * enough for tests: one of each kind the bulk upload publishes. Their programs
 * are real (the e2e test runs them on the code runner); `fakeRun` stands in
 * for the runner in unit tests by knowing what each of them prints.
 *
 * All of it written for these tests.
 */

const AUTHORING = { author: "Content tests", generated_with: "human", originality: "Written for Parikshaa's tests: our own story, statement, tests and solutions." } as const;

/** Plain sentences, varied, to reach a word count without repeating a phrase. */
export function prose(topic: string, words: number): string {
  const subjects = ["A learner", "The reviewer", "Our checker", "Every test", "The idea", "This step", "A careful reader", "The program", "One example", "The last case"];
  const verbs = ["looks at", "counts", "compares", "keeps", "reads", "writes down", "checks", "follows", "explains", "tries"];
  const objects = ["each number once", "the running total", "the smallest input", "the largest input", "an empty line", "the order of values", "what changes", "what stays the same", "the answer twice", "the first value"];
  const tails = ["before moving on.", "with a pencil.", "and notes why.", "in one pass.", "without guessing.", "slowly at first.", "and then faster.", "to be sure.", "as the plan says.", "for " + topic + "."];
  const out: string[] = [];
  let count = 0;
  for (let i = 0; count < words; i++) {
    const s = `${subjects[i % 10]} ${verbs[Math.floor(i / 10) % 10]} ${objects[Math.floor(i / 100) % 10]} ${tails[(i * 7) % 10]}`;
    out.push(s);
    count += s.split(" ").length;
  }
  return out.join(" ");
}

// --- programs ----------------------------------------------------------------------------------

export const SUM = {
  python: "import sys\ndata = sys.stdin.read().split()\nn = int(data[0])\nprint(sum(int(x) for x in data[1:1 + n]))\n",
  brute: "import sys\ndata = sys.stdin.read().split()\nn = int(data[0])\ntotal = 0\nfor i in range(n):\n    total = total + int(data[1 + i])\nprint(total)\n",
  cpp: "#include <bits/stdc++.h>\nint main(){std::ios::sync_with_stdio(false);long long n,x,s=0;std::cin>>n;for(long long i=0;i<n;i++){std::cin>>x;s+=x;}std::cout<<s<<\"\\n\";}\n",
  c: "#include <stdio.h>\nint main(void){long long n,x,s=0;if(scanf(\"%lld\",&n)!=1)return 0;for(long long i=0;i<n;i++){scanf(\"%lld\",&x);s+=x;}printf(\"%lld\\n\",s);return 0;}\n",
  java: "import java.io.*;\nimport java.util.*;\npublic class Main{public static void main(String[] a)throws IOException{BufferedReader r=new BufferedReader(new InputStreamReader(System.in));StreamTokenizer t=new StreamTokenizer(r);t.nextToken();long n=(long)t.nval,s=0;for(long i=0;i<n;i++){t.nextToken();s+=(long)t.nval;}System.out.println(s);}}\n",
  javascript: "const d=require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);let s=0;for(let i=0;i<d[0];i++)s+=d[1+i];console.log(String(s));\n",
  /** Forgets the last value. */
  wrongLast: "import sys\ndata = sys.stdin.read().split()\nn = int(data[0])\nprint(sum(int(x) for x in data[1:n]))\n",
  /** Prints the largest value, not the sum. */
  wrongMax: "import sys\ndata = sys.stdin.read().split()\nn = int(data[0])\nprint(max(int(x) for x in data[1:1 + n]))\n",
  starter: {
    python: "import sys\n\ndef total(values):\n    # Write your code here\n    return 0\n\ndata = sys.stdin.read().split()\nn = int(data[0])\nprint(total([int(x) for x in data[1:1 + n]]))\n",
    cpp: "#include <bits/stdc++.h>\nlong long total(const std::vector<long long>& v){ return 0; }\nint main(){std::ios::sync_with_stdio(false);long long n;std::cin>>n;std::vector<long long> v(n);for(auto&x:v)std::cin>>x;std::cout<<total(v)<<\"\\n\";}\n",
    c: "#include <stdio.h>\nlong long total(long long *v, long long n){ return 0; }\nint main(void){long long n;static long long v[100000];if(scanf(\"%lld\",&n)!=1)return 0;for(long long i=0;i<n;i++)scanf(\"%lld\",&v[i]);printf(\"%lld\\n\",total(v,n));return 0;}\n",
    java: "import java.io.*;\nimport java.util.*;\npublic class Main{static long total(long[] v){return 0;}public static void main(String[] a)throws IOException{StreamTokenizer t=new StreamTokenizer(new BufferedReader(new InputStreamReader(System.in)));t.nextToken();int n=(int)t.nval;long[] v=new long[n];for(int i=0;i<n;i++){t.nextToken();v[i]=(long)t.nval;}System.out.println(total(v));}}\n",
    javascript: "function total(v){ return 0; }\nconst d=require('fs').readFileSync(0,'utf8').trim().split(/\\s+/).map(Number);console.log(String(total(d.slice(1,1+d[0]))));\n",
  },
  /** Reads `count seed`, prints a list of that many values. */
  generator: "import sys, random\nargs = sys.stdin.readline().split()\nn, seed = int(args[0]), int(args[1])\nrng = random.Random(seed)\nprint(n)\nprint(' '.join(str(rng.randint(-1000, 1000)) for _ in range(n)))\n",
  validator: "import sys\ndata = sys.stdin.read().split()\nn = int(data[0])\nassert 1 <= n <= 100000, 'n out of range'\nassert len(data) == n + 1, 'wrong count'\nfor x in data[1:]:\n    assert -1000 <= int(x) <= 1000, 'value out of range'\n",
};

/** What each of the fixture's programs prints for an input: the fake runner's knowledge. */
function sumOf(input: string, skipLast = false): string {
  const data = input.split(/\s+/).filter(Boolean).map(Number);
  const n = data[0] ?? 0;
  const values = data.slice(1, 1 + n);
  return `${(skipLast ? values.slice(0, -1) : values).reduce((a, b) => a + b, 0)}\n`;
}
function generated(args: string): string {
  const [n = 0, seed = 0] = args.split(/\s+/).filter(Boolean).map(Number);
  // A deterministic stand-in for Python's random: only the shape matters to the fake.
  const values = Array.from({ length: n }, (_, i) => ((seed * 31 + i * 17) % 2001) - 1000);
  return `${n}\n${values.join(" ")}\n`;
}

export const ORDERS = {
  schema: "CREATE TABLE orders (id INTEGER PRIMARY KEY, customer TEXT NOT NULL, amount INTEGER);",
  reference: "SELECT customer, SUM(amount) AS total FROM orders WHERE amount IS NOT NULL GROUP BY customer;",
  alternative: "SELECT customer, SUM(amount) AS total FROM orders GROUP BY customer HAVING COUNT(amount) > 0;",
  wrongCount: "SELECT customer, COUNT(*) AS total FROM orders GROUP BY customer;",
  wrongMax: "SELECT customer, MAX(amount) AS total FROM orders GROUP BY customer;",
  starter: "-- Write one query.\nSELECT customer FROM orders;",
  generator: "import sys\nn = int(sys.stdin.readline())\nfor i in range(1, n + 1):\n    print(\"INSERT INTO orders VALUES (%d, 'c%d', %d);\" % (i, i % 7, (i * 13) % 50))\n",
};

/** The orders a dataset's INSERTs make. */
function ordersOf(input: string): { customer: string; amount: number | null }[] {
  return [...input.matchAll(/\((\d+),\s*'([^']*)',\s*(NULL|-?\d+)\)/g)].map((m) => ({ customer: m[2]!, amount: m[3] === "NULL" ? null : Number(m[3]) }));
}
function grouped(input: string, how: "sum" | "count" | "max" | "names"): string {
  const rows = ordersOf(input);
  if (how === "names") return rows.map((r) => `${r.customer}\n`).join("");
  const by = new Map<string, (number | null)[]>();
  for (const r of rows) by.set(r.customer, [...(by.get(r.customer) ?? []), r.amount]);
  const lines: string[] = [];
  for (const [customer, amounts] of by) {
    const known = amounts.filter((a): a is number => a !== null);
    if (how === "count") lines.push(`${customer}\t${amounts.length}`);
    else if (how === "max") lines.push(`${customer}\t${known.length === 0 ? "NULL" : Math.max(...known)}`);
    else if (known.length > 0) lines.push(`${customer}\t${known.reduce((a, b) => a + b, 0)}`);
  }
  return lines.map((l) => `${l}\n`).join("");
}
function ordersGenerated(args: string): string {
  const n = Number(args.trim());
  return Array.from({ length: n }, (_, k) => `INSERT INTO orders VALUES (${k + 1}, 'c${(k + 1) % 7}', ${((k + 1) * 13) % 50});\n`).join("");
}

export const SOLVER = 'import json, sys\nv = json.load(sys.stdin)\na, b = v.get("a", 12), v.get("b", 30)\nprint(json.dumps({"answer": str(a + b), "values": {"s": a + b, "s1": a + b + 1, "s2": a + b - 1, "s3": a * b}}))\n';
export const HELLO = 'print("hello, parikshaa")\n';
export const ADD = {
  solution: "a, b = map(int, input().split())\nprint(a + b)\n",
  starter: "a, b = map(int, input().split())\n# Write your code here\nprint(0)\n",
};

type Outcome = { readonly stdout: string; readonly status?: TestResult["status"] };
type Program = ((input: string) => Outcome) | "compile_error";

/** The programs the fixtures run, by their source. */
export const FAKE_PROGRAMS = new Map<string, Program>([
  [SUM.python, (i) => ({ stdout: sumOf(i) })],
  [SUM.brute, (i) => ({ stdout: sumOf(i) })],
  [SUM.cpp, (i) => ({ stdout: sumOf(i) })],
  [SUM.c, (i) => ({ stdout: sumOf(i) })],
  [SUM.java, (i) => ({ stdout: sumOf(i) })],
  [SUM.javascript, (i) => ({ stdout: sumOf(i) })],
  [SUM.wrongLast, (i) => ({ stdout: sumOf(i, true) })],
  [SUM.wrongMax, (i) => ({ stdout: `${Math.max(...i.split(/\s+/).filter(Boolean).map(Number).slice(1))}\n` })],
  ...Object.values(SUM.starter).map((s) => [s, () => ({ stdout: "0\n" })] as [string, Program]),
  [SUM.generator, (i) => ({ stdout: generated(i) })],
  [SUM.validator, () => ({ stdout: "" })],
  [ORDERS.reference, (i) => ({ stdout: grouped(i, "sum") })],
  [ORDERS.alternative, (i) => ({ stdout: grouped(i, "sum") })],
  [ORDERS.wrongCount, (i) => ({ stdout: grouped(i, "count") })],
  [ORDERS.wrongMax, (i) => ({ stdout: grouped(i, "max") })],
  [ORDERS.starter, (i) => ({ stdout: grouped(i, "names") })],
  [ORDERS.generator, (i) => ({ stdout: ordersGenerated(i) })],
  [
    SOLVER,
    (i) => {
      const v = JSON.parse(i) as { a?: number; b?: number };
      const a = v.a ?? 12;
      const b = v.b ?? 30;
      return { stdout: `${JSON.stringify({ answer: String(a + b), values: { s: a + b, s1: a + b + 1, s2: a + b - 1, s3: a * b } })}\n` };
    },
  ],
  [HELLO, () => ({ stdout: "hello, parikshaa\n" })],
  [ADD.solution, (i) => ({ stdout: `${i.split(/\s+/).filter(Boolean).map(Number).reduce((a, b) => a + b, 0)}\n` })],
  [ADD.starter, () => ({ stdout: "0\n" })],
]);

const unordered = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trimEnd()).filter((l) => l !== "").sort().join("\n");
const exact = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").replace(/\n+$/, "");

/**
 * A code runner that runs the fixtures' programs by knowing what each prints.
 * `programs` adds or overrides some; an unknown source does not compile. Every
 * request it was asked is kept in `requests`.
 */
export function fakeRunner(programs: ReadonlyMap<string, Program> = new Map()) {
  const requests: RunRequest[] = [];
  const run = async (request: RunRequest): Promise<RunResult> => {
    requests.push(request);
    const program = programs.get(request.source) ?? FAKE_PROGRAMS.get(request.source);
    if (program === undefined || program === "compile_error") return { compiled: false, compileOutput: "main: error: this program is not one the fake runner knows" };
    return {
      compiled: true,
      tests: request.tests.map((t) => {
        const out = program(t.input);
        const judged = request.checker?.kind === "unordered" ? unordered(out.stdout) === unordered(t.expected) : exact(out.stdout) === exact(t.expected);
        return { id: t.id, status: out.status ?? (judged ? "passed" : "wrong_answer"), timeMs: 5, memoryKb: 1000, stdout: out.stdout, stderr: "" };
      }),
    };
  };
  return { run, requests };
}

// --- items -------------------------------------------------------------------------------------

const editorial = (topic: string, words: number, extra: { codeTabs?: boolean; visual?: string; brute?: boolean } = {}) =>
  [
    "## Problem",
    `**Add up the list.** ${prose(topic, 20)}`,
    "## Understand The Problem",
    prose(topic, Math.floor(words / 4)),
    "## Coming Up With The Solution",
    "Why this example? It has a negative value, so a wrong sign shows at once.",
    ...(extra.brute === false ? [] : ["### Brute force", prose(topic, 20), "### Optimal", prose(topic, 20)]),
    prose(topic, Math.floor(words / 4)),
    "> **Note:** Keep the total in a 64-bit integer.",
    "## Writing The Solution",
    ...(extra.codeTabs === false ? [] : ["[[code-tabs]]"]),
    prose(topic, Math.floor(words / 4)),
    "## Testing / Reflection",
    ...(extra.visual === undefined ? [] : [`[[visual:${extra.visual}]]`]),
    `The time complexity is O(n) and the space O(1). ${prose(topic, Math.floor(words / 4))}`,
  ].join("\n\n");

export function dsaItem(over: Record<string, unknown> = {}) {
  return {
    schema: "parikshaa.content/dsa-problem@1",
    slug: "list-total",
    version: 1,
    title: "Total of a list",
    tier: "public",
    text_language: "en",
    difficulty: "easy",
    level: "L1",
    tags: { topics: ["arrays"], patterns: ["simulation"] },
    authoring: AUTHORING,
    statement: `Meera keeps a list of the day's gains and losses at her tea stall. Print their total. ${prose("the stall", 30)}`,
    input_format: "The first line has n. The second has n integers.",
    output_format: "One integer: the total.",
    constraints: "1 ≤ n ≤ 10^5, -1000 ≤ a_i ≤ 1000",
    constraints_structured: [
      { name: "n", type: "int", min: 1, max: 100000 },
      { name: "a_i", type: "int", min: -1000, max: 1000 },
    ],
    statement_rules: { output_when_empty: "There is always at least one value." },
    languages: ["c", "cpp", "java", "python", "javascript"],
    starters: SUM.starter,
    solutions: [
      { role: "reference", lang: "python", src: SUM.python },
      { role: "reference", lang: "cpp", src: SUM.cpp },
      { role: "reference", lang: "c", src: SUM.c },
      { role: "reference", lang: "java", src: SUM.java },
      { role: "reference", lang: "javascript", src: SUM.javascript },
      { role: "brute", lang: "python", src: SUM.brute },
      { role: "wrong", lang: "python", src: SUM.wrongLast, expect: "WA", why: "off by one: forgets the last value" },
      { role: "wrong", lang: "python", src: SUM.wrongMax, expect: "WA", why: "prints the largest value instead of the total" },
    ],
    generators: [{ name: "random_list", lang: "python", src: SUM.generator }],
    validator: { lang: "python", src: SUM.validator },
    test_plan: [
      {
        group: "samples",
        hidden: false,
        tests: [
          { input: "3\n1 2 3\n", expected: "6\n", explanation: "1 + 2 + 3 = 6." },
          { input: "2\n-5 5\n", explanation: "The two cancel out." },
        ],
      },
      { group: "minimal", hidden: true, tests: [{ input: "1\n7\n" }, { input: "1\n-7\n" }] },
      { group: "boundary", hidden: true, tests: [{ input: "1\n1000\n" }, { input: "1\n-1000\n" }] },
      { group: "edge", hidden: true, tests: [{ input: "2\n0 0\n" }, { input: "3\n-1 -2 -3\n" }, { input: "4\n1000 1000 1000 1000\n" }, { input: "2\n1 -1\n" }, { input: "5\n5 4 3 2 1\n" }] },
      { group: "random_small", hidden: true, gen: "random_list", args: Array.from({ length: 10 }, (_, i) => [5 + i, i + 1]) },
      { group: "random_large", hidden: true, gen: "random_list", args: [[2000, 1], [3000, 2], [4000, 3]] },
      { group: "anti", hidden: true, tests: [{ input: "3\n-1000 -1000 -1000\n" }] },
    ],
    limits: { time_ms: { c: 1000, cpp: 1000, java: 2000, python: 3000, javascript: 2000 }, memory_mb: 256 },
    hints: ["Walk the list once.", "Keep a running total as you go.", "Add each value to the total, then print it."],
    approaches: [
      { name: "brute", time: "O(n)", space: "O(1)", summary: "Add the values one by one in a loop." },
      { name: "optimal", time: "O(n)", space: "O(1)", summary: "The same single pass; nothing better is possible." },
    ],
    editorial: editorial("the stall", 240, { visual: "walk" }),
    editorial_length: { form: "standard", target_words: 200 },
    visuals: [{ id: "walk", kind: "dry-run", alt: "The running total after each value of 1 2 3.", data: { frames: [{ step: 1, note: "add 1", vars: { total: 1 } }, { step: 2, note: "add 2", vars: { total: 3 } }] } }],
    related: ["pair-sums", "running-average"],
    ...over,
  };
}

export function sqlItem(over: Record<string, unknown> = {}) {
  return {
    schema: "parikshaa.content/sql-problem@1",
    slug: "sql-customer-totals",
    version: 1,
    title: "What each customer spent",
    tier: "public",
    text_language: "en",
    difficulty: "easy",
    level: "L1",
    tags: { topics: ["group-by"] },
    authoring: AUTHORING,
    stem: "Table `orders(id INTEGER PRIMARY KEY, customer TEXT NOT NULL, amount INTEGER)`; amount may be NULL. For each customer with at least one known amount, return `customer, total`: the sum of their known amounts. Any order.",
    schema_sql: ORDERS.schema,
    datasets: [
      { id: "sample", hidden: false, purpose: "sample", rows_sql: "INSERT INTO orders VALUES (1, 'asha', 10);\nINSERT INTO orders VALUES (2, 'ravi', 5);\nINSERT INTO orders VALUES (3, 'asha', 7);\n", expected: "asha\t17\nravi\t5\n" },
      { id: "empty", hidden: true, purpose: "empty", rows_sql: "" },
      { id: "nulls", hidden: true, purpose: "null", rows_sql: "INSERT INTO orders VALUES (1, 'asha', NULL);\nINSERT INTO orders VALUES (2, 'ravi', 4);\n" },
      { id: "ties", hidden: true, purpose: "ties", rows_sql: "INSERT INTO orders VALUES (1, 'a', 5);\nINSERT INTO orders VALUES (2, 'b', 5);\n" },
      { id: "dupes", hidden: true, purpose: "duplicates", rows_sql: "INSERT INTO orders VALUES (1, 'a', 5);\nINSERT INTO orders VALUES (2, 'a', 5);\nINSERT INTO orders VALUES (3, 'a', 9);\n" },
      { id: "many", hidden: true, purpose: "many-rows", gen: { src: ORDERS.generator, args: "200" } },
    ],
    order_matters: false,
    reference: ORDERS.reference,
    alternatives: [ORDERS.alternative],
    wrong: [
      { src: ORDERS.wrongCount, why: "counts the orders instead of adding the amounts" },
      { src: ORDERS.wrongMax, why: "takes the largest amount, not the sum" },
    ],
    starter: ORDERS.starter,
    hints: ["Group the rows by customer.", "SUM skips NULL on its own.", "Drop customers with no known amount."],
    approaches: [{ name: "group by", summary: "Group by customer and add the known amounts together." }],
    editorial: editorial("the orders table", 200, { brute: false }),
    editorial_length: { form: "standard", target_words: 200 },
    ...over,
  };
}

export function mcqItem(over: Record<string, unknown> = {}) {
  return {
    schema: "parikshaa.content/mcq@1",
    slug: "apt-quant-two-numbers",
    version: 1,
    title: "Two piles of mangoes",
    tier: "public",
    text_language: "en",
    difficulty: "easy",
    section: "aptitude-quant",
    topic: "arithmetic",
    tags: { topics: ["arithmetic"] },
    authoring: AUTHORING,
    variants: { params: [{ name: "a", description: "first pile" }, { name: "b", description: "second pile" }], sets: [{ a: 12, b: 30 }, { a: 15, b: 40 }] },
    kind: "mcq",
    stem: "A stall has {{a}} mangoes in one pile and {{b}} in another. How many mangoes are there in all?",
    options: ["{{s}}", "{{s1}}", "{{s2}}", "{{s3}}"],
    correct: 0,
    explanation: "### Understand\n\nTwo piles, one total.\n\n### Plan\n\nAdd the piles.\n\n### Solve\n\n{{a}} + {{b}} = {{s}}.\n\n### Check\n\n{{s1}} and {{s2}} are one off; {{s3}} multiplies.",
    distractors: [
      { option: 1, mistake: "counts one mango twice" },
      { option: 2, mistake: "drops one mango" },
      { option: 3, mistake: "multiplies the piles" },
    ],
    time_target_sec: 30,
    solver: SOLVER,
    ...over,
  };
}

export function lessonItem(over: Record<string, unknown> = {}) {
  return {
    schema: "parikshaa.content/lesson@1",
    slug: "os-what-a-process-is",
    version: 1,
    title: "What a process is",
    tier: "public",
    text_language: "en",
    course: "os",
    difficulty: "easy",
    tags: { topics: ["processes"] },
    authoring: AUTHORING,
    placement: [{ track: "os-basics", module: "Processes", position: 0 }],
    est_minutes: 10,
    outcomes: ["Say what a process is in one line.", "Tell a process from a program."],
    sections: [
      { kind: "why", heading: "Why it matters", body: prose("processes", 160) },
      { kind: "concept", heading: "The idea", body: prose("a running program", 220), code: [{ lang: "python", src: HELLO, runnable: true, expected_output: "hello, parikshaa\n" }] },
      { kind: "example", heading: "An example", body: prose("a shell", 160) },
      { kind: "misconception", heading: "A common mistake", body: prose("threads", 120) },
      {
        kind: "interview",
        heading: "In an interview",
        body: prose("interviews", 60),
        qa: [
          { q: "What is a process?", a: "A program while it runs, with its own memory and state." },
          { q: "Is a program a process?", a: "No: a program is the file; a process is one run of it." },
        ],
      },
      { kind: "summary", heading: "In short", body: prose("the summary", 120) },
    ],
    quiz: [
      { stem: "Which one is a process?", options: ["A file on disk", "A program that is running"], correct: 1, explanation: "A process is a program while it runs." },
      { stem: "Do two runs of one program share memory?", options: ["Yes", "No"], correct: 1, explanation: "Each run is its own process." },
      { stem: "What does a process have of its own?", options: ["Memory and state", "Nothing"], correct: 0, explanation: "Its memory, open files and state." },
    ],
    hands_on: [
      {
        id: "add-two",
        title: "Add two numbers",
        task: "Read two integers on one line and print their sum.",
        lang: "python",
        starter: ADD.starter,
        solution: ADD.solution,
        tests: [
          { id: "t1", input: "1 2\n", expected: "3\n", hidden: false },
          { id: "t2", input: "5 5\n", expected: "10\n", hidden: true },
          { id: "t3", input: "-4 4\n", expected: "0\n", hidden: true },
        ],
      },
    ],
    revision_card: { front: "Program or process?", back: "A program is the file; a process is one run of it." },
    ...over,
  };
}

export const MANIFEST = {
  bundle_id: "content-tests-01",
  version: 1,
  title: "Content tests, batch 1",
  author: { name: "Content tests" },
  created_on: "2026-11-17",
  licence: { owner: "Parikshaa", terms: "All rights reserved; written for Parikshaa's tests." },
  originality: { statement: "Every item here was written for Parikshaa's tests: our own stories, statements, tests and solutions.", checks: ["read by the author"] },
  tracks: [{ slug: "os-basics", title: "Operating systems, the basics", description: "Processes, threads and memory, a lesson at a time.", modules: ["Processes", "Memory"] }],
};

/** A single-file bundle of these items. */
export function bundleJson(items: readonly unknown[], manifest: Record<string, unknown> = MANIFEST): string {
  return JSON.stringify({ schema: "parikshaa.content/bundle@1", manifest, items });
}
