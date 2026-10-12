import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runnerFromEnv } from "./backend.js";
import { HttpCodeRunner, RunnerUnavailable, type CodeRunner } from "./client.js";
import type { RunRequest, RunResult } from "./execute.js";
import { CHECKER_WRAPPER, FallbackCodeRunner, Judge0CodeRunner, mapLanguages, sqlProgram } from "./judge0.js";

/**
 * The Judge0 backend (G3), against a fake Judge0 that speaks its HTTP API:
 * `/languages`, batch submit, batch poll by token. What a "program" does is
 * up to each test; the fake keeps every submission so a test can see what was
 * sent. The real Judge0 is held to the in-house runner by the parity suite on
 * staging (`npm run parity`), not here: it needs cgroup v1.
 */

const LANGUAGES = [
  { id: 71, name: "Python (3.8.1)" },
  { id: 100, name: "Python (3.12.5)" },
  { id: 102, name: "JavaScript (Node.js 22.08.0)" },
  { id: 103, name: "C (GCC 14.1.0)" },
  { id: 105, name: "C++ (GCC 14.1.0)" },
  { id: 91, name: "Java (JDK 17.0.6)" },
  { id: 82, name: "SQL (SQLite 3.27.2)" },
];

interface Sent {
  readonly source_code: string;
  readonly language_id: number;
  readonly stdin: string;
  readonly cpu_time_limit: number;
  readonly wall_time_limit: number;
  readonly memory_limit: number;
  readonly enable_network: boolean;
}

interface Ran {
  readonly status: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly compile_output?: string;
  readonly exit_code?: number;
  readonly memory?: number;
  readonly time?: string;
}

const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64");
const unb64 = (text: string) => Buffer.from(text, "base64").toString("utf8");

interface Fake {
  readonly url: string;
  readonly sent: { source: string; stdin: string; raw: Sent }[];
  readonly posts: number;
  readonly headers: string[];
  close(): Promise<void>;
}

let open: Server[] = [];
afterEach(async () => {
  await Promise.all(open.map((s) => new Promise((resolve) => s.close(resolve))));
  open = [];
});

/** A fake Judge0; `exec` decides what each program does; each is "In Queue" for `queuedPolls` polls first. */
async function fakeJudge0(exec: (source: string, stdin: string, sent: Sent) => Ran, options: { queuedPolls?: number; languages?: unknown } = {}): Promise<Fake> {
  const results = new Map<string, { ran: Ran; polls: number }>();
  const state = { sent: [] as Fake["sent"][number][], posts: 0, headers: [] as string[] };
  let next = 0;
  const server = createServer((req, res) => {
    state.headers.push(String(req.headers["x-auth-token"]));
    const url = new URL(req.url ?? "/", "http://fake");
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.headers["x-auth-token"] !== "secret") return reply(401, { error: "Authentication failed." });
    if (req.method === "GET" && url.pathname === "/languages") return reply(200, options.languages ?? LANGUAGES);
    if (req.method === "POST" && url.pathname === "/submissions/batch") {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        state.posts++;
        expect(url.searchParams.get("base64_encoded")).toBe("true");
        const { submissions } = JSON.parse(body) as { submissions: Sent[] };
        reply(
          201,
          submissions.map((s) => {
            const token = `t${next++}`;
            const source = unb64(s.source_code);
            const stdin = unb64(s.stdin);
            state.sent.push({ source, stdin, raw: s });
            results.set(token, { ran: exec(source, stdin, s), polls: 0 });
            return { token };
          }),
        );
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/submissions/batch") {
      const tokens = (url.searchParams.get("tokens") ?? "").split(",");
      return reply(200, {
        submissions: tokens.map((token) => {
          const r = results.get(token);
          if (r === undefined) return null;
          r.polls++;
          if (r.polls <= (options.queuedPolls ?? 1)) return { token, status: { id: 1, description: "In Queue" } };
          const { ran } = r;
          return {
            token,
            status: { id: ran.status, description: "" },
            stdout: ran.stdout === undefined ? null : b64(ran.stdout),
            stderr: ran.stderr === undefined ? null : b64(ran.stderr),
            compile_output: ran.compile_output === undefined ? null : b64(ran.compile_output),
            message: null,
            exit_code: ran.exit_code ?? (ran.status === 3 ? 0 : null),
            time: ran.time ?? "0.010",
            wall_time: ran.time ?? "0.020",
            memory: ran.memory ?? 3000,
          };
        }),
      });
    }
    reply(404, { error: "not found" });
  });
  open.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    get sent() {
      return state.sent;
    },
    get posts() {
      return state.posts;
    },
    get headers() {
      return state.headers;
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Adds the two numbers on stdin, as a right program would. */
const adder = (_source: string, stdin: string): Ran => {
  const [a, b] = stdin.trim().split(/\s+/).map(Number);
  return { status: 3, stdout: `${a! + b!}\n` };
};

const sum: RunRequest = {
  language: "python",
  source: "a, b = map(int, input().split())\nprint(a + b)\n",
  tests: [
    { id: "t1", input: "2 3\n", expected: "5\n" },
    { id: "t2", input: "10 -4\n", expected: "6" },
    { id: "t3", input: "1 1\n", expected: "3\n" },
  ],
};

const statuses = (result: RunResult) => (result.compiled ? result.tests.map((t) => t.status) : ["compile_error"]);
const judge0 = (fake: Fake, options: ConstructorParameters<typeof Judge0CodeRunner>[2] = {}) => new Judge0CodeRunner(fake.url, "secret", { pollMs: 5, maxPollMs: 20, ...options });

describe("Judge0's languages", () => {
  it("are found by name, the newest version of each; SQL runs as Python", () => {
    expect(mapLanguages(LANGUAGES)).toEqual({ python: 100, javascript: 102, c: 103, cpp: 105, java: 91, sql: 100 });
    expect(mapLanguages([{ id: 1, name: "Bash (5.0.0)" }])).toEqual({});
  });
});

describe("a run on Judge0", () => {
  it("sends every test in batches with the token and our limits, polls until done, and judges the outputs itself", async () => {
    const fake = await fakeJudge0(adder, { queuedPolls: 2 });
    const result = await judge0(fake, { batchSize: 2 }).run({ ...sum, limits: { timeMs: 1500, memoryMb: 128 } });
    expect(statuses(result)).toEqual(["passed", "passed", "wrong_answer"]);
    expect(fake.posts).toBe(2);
    expect(new Set(fake.headers)).toEqual(new Set(["secret"]));
    expect(fake.sent.map((s) => s.stdin)).toEqual(["2 3\n", "10 -4\n", "1 1\n"]);
    expect(fake.sent[0]!.source).toBe(sum.source);
    expect(fake.sent[0]!.raw).toMatchObject({ language_id: 100, cpu_time_limit: 1.5, wall_time_limit: 1.5, memory_limit: 128 * 1024, enable_network: false });
    if (!result.compiled) throw new Error("compiled");
    expect(result.tests[0]).toMatchObject({ id: "t1", stdout: "5\n", timeMs: 20, memoryKb: 3000 });
  });

  it("uses the question's checker, not exact matching, when it has one", async () => {
    const fake = await fakeJudge0(() => ({ status: 3, stdout: "0.3333334\n" }));
    const result = await judge0(fake).run({ ...sum, tests: [{ id: "t", input: "", expected: "0.3333333" }], checker: { kind: "numbers", tolerance: 1e-6 } });
    expect(statuses(result)).toEqual(["passed"]);
  });

  it("names each failure as the in-house runner does", async () => {
    const outcomes: Ran[] = [
      { status: 5 },
      { status: 8, stdout: "y\n".repeat(10) },
      { status: 11, stderr: "Traceback…\nZeroDivisionError", exit_code: 1 },
      { status: 11, stderr: "MemoryError", exit_code: 1 },
      { status: 7, memory: 250_000 },
      { status: 12, stderr: "Exception in thread main java.lang.OutOfMemoryError" },
    ];
    let i = 0;
    const fake = await fakeJudge0(() => outcomes[i++]!);
    const tests = outcomes.map((_, k) => ({ id: `t${k}`, input: "", expected: "" }));
    expect(statuses(await judge0(fake).run({ ...sum, tests, limits: { memoryMb: 256 } }))).toEqual([
      "time_limit",
      "output_limit",
      "runtime_error",
      "memory_limit",
      "memory_limit",
      "memory_limit",
    ]);
  });

  it("reports a compile error once, not per test", async () => {
    const fake = await fakeJudge0(() => ({ status: 6, compile_output: "main.cpp:1:1: error: expected ';'\n" }));
    const result = await judge0(fake).run({ ...sum, language: "cpp", source: "int main( {" });
    expect(result).toEqual({ compiled: false, compileOutput: "main.cpp:1:1: error: expected ';'" });
    expect(fake.sent[0]!.raw.language_id).toBe(105);
  });

  it("splits a function question's result from what the program printed", async () => {
    const fake = await fakeJudge0(() => ({ status: 3, stdout: "debug line\n@@R@@\n[1, 2]\n" }));
    const result = await judge0(fake).run({ ...sum, tests: [{ id: "t", input: "", expected: "[1,2]" }], checker: { kind: "json", tolerance: 0, unordered: "none" }, resultMarker: "@@R@@" });
    if (!result.compiled) throw new Error("compiled");
    expect(result.tests[0]).toMatchObject({ status: "passed", stdout: "debug line", result: "[1, 2]" });
  });

  it("runs a question's own checker as a second batch, in Python, given the input, expected and output", async () => {
    const fake = await fakeJudge0((source, stdin, sent) => {
      if (source !== CHECKER_WRAPPER) return { status: 3, stdout: `${stdin.trim()}\n` };
      expect(sent.language_id).toBe(100);
      const pk = JSON.parse(stdin) as { checker: string; output: string };
      expect(pk.checker).toBe("CHECK");
      const exit = { ok: 0, no: 1, bad: 2 }[pk.output.trim() as "ok" | "no" | "bad"];
      return exit === 0 ? { status: 3, stdout: "fine" } : { status: 11, exit_code: exit, stdout: exit === 1 ? "off by one" : "", stderr: exit === 2 ? "crash" : "" };
    });
    const tests = ["ok", "no", "bad"].map((input) => ({ id: input, input, expected: "" }));
    const result = await judge0(fake).run({ ...sum, tests, checker: { kind: "custom", source: "CHECK" } });
    expect(statuses(result)).toEqual(["passed", "wrong_answer", "checker_error"]);
    if (!result.compiled) throw new Error("compiled");
    expect(result.tests[1]!.checkerMessage).toBe("off by one");
    expect(fake.posts).toBe(2);
  });

  it("does not ask the checker about a run that already failed", async () => {
    const fake = await fakeJudge0((source) => (source === CHECKER_WRAPPER ? { status: 3 } : { status: 5 }));
    expect(statuses(await judge0(fake).run({ ...sum, tests: [{ id: "t", input: "", expected: "" }], checker: { kind: "custom", source: "x" } }))).toEqual(["time_limit"]);
    expect(fake.posts).toBe(1);
  });

  it("sends SQL as Python with the driver and the answer written in", async () => {
    const fake = await fakeJudge0(() => ({ status: 3, stdout: "Asha\n" }));
    await judge0(fake).run({ ...sum, language: "sql", source: "SELECT name FROM e;", tests: [{ id: "t", input: "CREATE TABLE e (name TEXT);", expected: "Asha" }] });
    expect(fake.sent[0]!.raw.language_id).toBe(100);
    expect(fake.sent[0]!.source).toContain('source = "SELECT name FROM e;"');
    expect(fake.sent[0]!.stdin).toBe("CREATE TABLE e (name TEXT);");
  });
});

describe("Judge0 counts as unavailable", () => {
  it("when it cannot be reached", async () => {
    const fake = await fakeJudge0(adder);
    await fake.close();
    open = [];
    await expect(judge0(fake).run(sum)).rejects.toBeInstanceOf(RunnerUnavailable);
  });

  it("when the token is wrong", async () => {
    const fake = await fakeJudge0(adder);
    await expect(new Judge0CodeRunner(fake.url, "wrong").run(sum)).rejects.toThrow("Judge0 answered 401");
  });

  it("when it fails inside, has no such language, or does not finish in time", async () => {
    const broken = await fakeJudge0(() => ({ status: 13 }));
    await expect(judge0(broken).run(sum)).rejects.toThrow(/failed internally/);
    const noJava = await fakeJudge0(adder, { languages: LANGUAGES.filter((l) => !l.name.startsWith("Java")) });
    await expect(judge0(noJava).run({ ...sum, language: "java" })).rejects.toThrow(/no language for java/);
    const stuck = await fakeJudge0(adder, { queuedPolls: Number.POSITIVE_INFINITY });
    await expect(judge0(stuck, { timeoutMs: 150 }).run(sum)).rejects.toThrow(/did not finish in time/);
  });

  it("and reads /languages again on the next run after a failed read", async () => {
    let calls = 0;
    const fake = await fakeJudge0(adder, {
      get languages() {
        calls++;
        return calls === 1 ? { not: "a list" } : LANGUAGES;
      },
    });
    const runner = judge0(fake);
    await expect(runner.run(sum)).rejects.toBeInstanceOf(RunnerUnavailable);
    expect(statuses(await runner.run(sum))).toEqual(["passed", "passed", "wrong_answer"]);
  });
});

describe("falling back to the in-house runner", () => {
  const ok: RunResult = { compiled: true, tests: [] };
  const stub = (run: () => Promise<RunResult>) => ({ run: vi.fn(run) }) satisfies CodeRunner;

  it("happens when Judge0 is unavailable, and Judge0 is left alone for a while", async () => {
    let now = 1000;
    const primary = stub(() => Promise.reject(new RunnerUnavailable("down")));
    const fallback = stub(() => Promise.resolve(ok));
    const onFallback = vi.fn();
    const runner = new FallbackCodeRunner(primary, fallback, { cooldownMs: 30_000, onFallback, now: () => now });
    expect(await runner.run(sum)).toBe(ok);
    expect(await runner.run(sum)).toBe(ok);
    expect(primary.run).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledTimes(1);
    now += 30_001;
    await runner.run(sum);
    expect(primary.run).toHaveBeenCalledTimes(2);
    expect(fallback.run).toHaveBeenCalledTimes(3);
  });

  it("does not happen for any other error, or when Judge0 answers", async () => {
    const fallback = stub(() => Promise.resolve(ok));
    await expect(new FallbackCodeRunner(stub(() => Promise.reject(new Error("bug"))), fallback).run(sum)).rejects.toThrow("bug");
    const answered: RunResult = { compiled: false, compileOutput: "x" };
    expect(await new FallbackCodeRunner(stub(() => Promise.resolve(answered)), fallback).run(sum)).toBe(answered);
    expect(fallback.run).not.toHaveBeenCalled();
  });

  it("works end to end: Judge0 down, the in-house runner answers", async () => {
    const fake = await fakeJudge0(adder);
    await fake.close();
    open = [];
    const inHouse = stub(() => Promise.resolve(ok));
    expect(await new FallbackCodeRunner(judge0(fake), inHouse).run(sum)).toBe(ok);
  });
});

describe("choosing the backend from the environment", () => {
  it("is the in-house runner by default, or none without RUNNER_URL", () => {
    expect(runnerFromEnv({})).toBeUndefined();
    expect(runnerFromEnv({ RUNNER_URL: "http://runner:8080", RUNNER_TOKEN: "t" })).toBeInstanceOf(HttpCodeRunner);
    expect(() => runnerFromEnv({ RUNNER_URL: "http://runner:8080" })).toThrow("RUNNER_TOKEN");
  });

  it("is Judge0 with the in-house runner behind it, when asked", () => {
    expect(runnerFromEnv({ RUNNER_BACKEND: "judge0", JUDGE0_URL: "http://10.0.0.5:2358", JUDGE0_TOKEN: "t" })).toBeInstanceOf(Judge0CodeRunner);
    expect(runnerFromEnv({ RUNNER_BACKEND: "judge0", JUDGE0_URL: "http://j", JUDGE0_TOKEN: "t", RUNNER_URL: "http://r", RUNNER_TOKEN: "t" })).toBeInstanceOf(FallbackCodeRunner);
    expect(() => runnerFromEnv({ RUNNER_BACKEND: "judge0", JUDGE0_URL: "http://j" })).toThrow("JUDGE0_TOKEN");
    expect(() => runnerFromEnv({ RUNNER_BACKEND: "isolate" })).toThrow("gvisor or judge0");
  });
});

const python = spawnSync("python3", ["--version"]).status === 0;

describe.skipIf(!python)("the programs Judge0 is sent, run by a real Python", () => {
  const py = (source: string, stdin: string) => spawnSync("python3", ["-c", source], { input: stdin, encoding: "utf8", cwd: mkdtempSync(join(tmpdir(), "judge0-py-")) });

  it("the SQL program prints a query's rows as the in-house runner does", () => {
    const out = py(sqlProgram("SELECT name, boss FROM e ORDER BY id; -- \"quotes\" and \\ too"), "CREATE TABLE e (id INT, name TEXT, boss INT); INSERT INTO e VALUES (1,'Asha',NULL),(2,'Ravi',1);");
    expect(out.stdout).toBe("Asha\tNULL\nRavi\t1\n");
  });

  it("the checker wrapper gives the checker its three files and passes on its exit code", () => {
    const checker = "import sys\nout = open(sys.argv[3]).read().split()\nexp = open(sys.argv[2]).read().split()\nprint('saw', open(sys.argv[1]).read().strip())\nsys.exit(0 if sorted(out) == sorted(exp) else 1)\n";
    const run = (output: string) => py(CHECKER_WRAPPER, JSON.stringify({ checker, input: "IN", expected: "1 2 3", output }));
    const right = run("3 2 1");
    expect([right.status, right.stdout.trim()]).toEqual([0, "saw IN"]);
    expect(run("3 2 2").status).toBe(1);
  });
});
