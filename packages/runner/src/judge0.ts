import { RunnerUnavailable, type CodeRunner } from "./client.js";
import {
  CHECKER_LIMITS,
  OUT_OF_MEMORY,
  clampLimits,
  truncate,
  type Limits,
  type RunRequest,
  type RunResult,
  type TestCase,
  type TestResult,
  type TestStatus,
} from "./execute.js";
import { EXACT, accepts, splitResult } from "./judge.js";
import { SQL_DRIVER, type Language } from "./languages.js";

/**
 * Judge0 as a backend for the runner (docs/F1-GO-LIVE-PLAN.md §5.1–5.3, G3).
 *
 * Judge0 only runs a program on a given stdin within given limits. Everything
 * else stays ours, exactly as the in-house runner does it: whether an output is
 * right (`judge.ts`), a question's own checker, the result marker of a function
 * question, and what each failure is called. So a verdict means the same
 * whichever backend gave it, and the parity suite can hold both to that.
 *
 * Each test is one submission, sent in batches and polled for by token. Judge0
 * answers with callbacks off and waiting off (deploy/judge0/judge0.conf), so
 * nothing ever calls back into our network.
 *
 * Languages are found by name in Judge0's own `/languages`, read once, never by
 * a hardcoded id: ids differ between Judge0 images, names say what they are.
 * SQL runs through Python, with the same driver the in-house runner uses, so a
 * test's tables and a query's rows mean the same on both.
 */

/** How each of our languages is named in `/languages`; the newest version that matches wins. */
const NAMES: Readonly<Record<Language, RegExp>> = {
  python: /^Python \(3\./,
  javascript: /^JavaScript \(Node\.js/,
  c: /^C \(GCC/,
  cpp: /^C\+\+ \(GCC/,
  java: /^Java \((OpenJDK|JDK)/,
  sql: /^Python \(3\./,
};

/** Judge0's status ids (they are part of its API, unlike language ids). */
const STATUS = {
  inQueue: 1,
  processing: 2,
  accepted: 3,
  wrongAnswer: 4,
  timeLimit: 5,
  compilationError: 6,
  outputLimit: 8,
  internalError: 13,
} as const;

const FIELDS = "token,status,stdout,stderr,compile_output,message,exit_code,time,wall_time,memory";

/**
 * A checker runs as a Python program of its own, in a box of its own: this
 * writes the files the in-house runner gives it, then runs it as its main.
 */
export const CHECKER_WRAPPER = `import io, json, runpy, sys
pk = json.loads(sys.stdin.read())
for name in ("input", "expected", "output"):
    with open(name + ".txt", "w", encoding="utf-8") as f:
        f.write(pk[name])
with open("checker.py", "w", encoding="utf-8") as f:
    f.write(pk["checker"])
sys.stdin = io.StringIO("")
sys.argv = ["checker.py", "input.txt", "expected.txt", "output.txt"]
runpy.run_path("checker.py", run_name="__main__")
`;

const SQL_READ = 'with open("main.sql", encoding="utf-8") as f:\n    source = f.read()\n';

/** The SQL driver with the answer written in, since a submission is one file. A JSON string is a Python string. */
export function sqlProgram(source: string): string {
  if (!SQL_DRIVER.includes(SQL_READ)) throw new Error("The SQL driver no longer reads main.sql as expected");
  return SQL_DRIVER.replace(SQL_READ, `source = ${JSON.stringify(source)}\n`);
}

interface Submission {
  readonly token?: string;
  readonly status?: { readonly id: number; readonly description?: string };
  readonly stdout?: string | null;
  readonly stderr?: string | null;
  readonly compile_output?: string | null;
  readonly message?: string | null;
  readonly exit_code?: number | null;
  readonly time?: string | null;
  readonly wall_time?: string | null;
  readonly memory?: number | null;
}

interface Job {
  readonly languageId: number;
  readonly source: string;
  readonly stdin: string;
  readonly limits: Limits;
}

export interface Judge0Options {
  /** How long a whole run may take, queueing included, before Judge0 counts as unavailable. */
  readonly timeoutMs?: number;
  /** Submissions per batch; Judge0's MAX_SUBMISSION_BATCH_SIZE. */
  readonly batchSize?: number;
  /** The first wait between polls; it grows to `maxPollMs`. */
  readonly pollMs?: number;
  readonly maxPollMs?: number;
}

const encode = (text: string) => Buffer.from(text, "utf8").toString("base64");
const decode = (text: string | null | undefined) => (text === null || text === undefined ? "" : Buffer.from(text, "base64").toString("utf8"));
const seconds = (ms: number) => Math.round(ms) / 1000;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The highest version first: "Python (3.12.5)" before "Python (3.8.1)". */
function newer(a: string, b: string): number {
  const version = (name: string) => (name.match(/\d+(\.\d+)*/)?.[0] ?? "0").split(".").map(Number);
  const [x, y] = [version(a), version(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (y[i] ?? 0) - (x[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Which of Judge0's languages each of ours runs as; a language it lacks is missing. */
export function mapLanguages(available: readonly { readonly id: number; readonly name: string }[]): Partial<Record<Language, number>> {
  const map: Partial<Record<Language, number>> = {};
  for (const [language, pattern] of Object.entries(NAMES) as [Language, RegExp][]) {
    const found = available.filter((l) => pattern.test(l.name)).sort((a, b) => newer(a.name, b.name))[0];
    if (found !== undefined) map[language] = found.id;
  }
  return map;
}

export class Judge0CodeRunner implements CodeRunner {
  readonly #url: string;
  readonly #token: string;
  readonly #timeoutMs: number;
  readonly #batchSize: number;
  readonly #pollMs: number;
  readonly #maxPollMs: number;
  #languages: Promise<Partial<Record<Language, number>>> | null = null;

  constructor(url: string, token: string, options: Judge0Options = {}) {
    this.#url = url.replace(/\/$/, "");
    this.#token = token;
    this.#timeoutMs = options.timeoutMs ?? 120_000;
    this.#batchSize = options.batchSize ?? 20;
    this.#pollMs = options.pollMs ?? 200;
    this.#maxPollMs = options.maxPollMs ?? 1500;
  }

  async run(request: RunRequest): Promise<RunResult> {
    const deadline = Date.now() + this.#timeoutMs;
    const languages = await this.#languageIds();
    const languageId = languages[request.language];
    if (languageId === undefined) throw new RunnerUnavailable(`Judge0 has no language for ${request.language}`);
    const limits = clampLimits(request.limits);
    const source = request.language === "sql" ? sqlProgram(request.source) : request.source;

    const ran = await this.#execute(request.tests.map((test) => ({ languageId, source, stdin: test.input, limits })), deadline);
    const broken = ran.find((s) => s.status?.id === STATUS.compilationError);
    if (broken !== undefined) {
      return { compiled: false, compileOutput: truncate(`${decode(broken.compile_output)}${decode(broken.message)}`.trim(), 8192) };
    }

    const checker = request.checker ?? EXACT;
    const marker = request.resultMarker;
    const judged = ran.map((s) => {
      const stdout = decode(s.stdout);
      const stderr = decode(s.stderr);
      const { printed, result } = marker === undefined ? { printed: stdout, result: null } : splitResult(stdout, marker);
      return { s, stdout, stderr, printed, result, output: marker === undefined ? stdout : result, status: failure(s, stderr, limits) };
    });

    // A question's own checker runs only on the outputs it has to judge, as a second batch.
    const verdicts = new Map<number, { status: TestStatus; message: string }>();
    if (checker.kind === "custom") {
      const pythonId = languages.python;
      if (pythonId === undefined) throw new RunnerUnavailable("Judge0 has no Python for the question's checker");
      const due = judged.flatMap((j, i) => (j.status === null && j.output !== null ? [i] : []));
      const checked = await this.#execute(
        due.map((i) => ({
          languageId: pythonId,
          source: CHECKER_WRAPPER,
          stdin: JSON.stringify({ checker: checker.source, input: request.tests[i]!.input, expected: request.tests[i]!.expected, output: judged[i]!.output }),
          limits: CHECKER_LIMITS,
        })),
        deadline,
      );
      due.forEach((i, k) => verdicts.set(i, checkerVerdict(checked[k]!)));
    }

    const tests: TestResult[] = judged.map((j, i) => {
      const test: TestCase = request.tests[i]!;
      let status = j.status;
      let checkerMessage: string | undefined;
      if (status === null) {
        if (j.output === null) status = "wrong_answer";
        else if (checker.kind === "custom") {
          const verdict = verdicts.get(i)!;
          status = verdict.status;
          checkerMessage = verdict.message;
        } else status = accepts(checker, test.expected, j.output) ? "passed" : "wrong_answer";
      }
      const time = Number(j.s.wall_time ?? j.s.time ?? 0);
      return {
        id: test.id,
        status,
        timeMs: Number.isFinite(time) ? Math.round(time * 1000) : 0,
        memoryKb: typeof j.s.memory === "number" ? j.s.memory : null,
        stdout: truncate(j.printed),
        stderr: truncate(j.stderr, 2048),
        ...(marker === undefined ? {} : { result: j.result === null ? null : truncate(j.result) }),
        ...(checkerMessage === undefined || checkerMessage === "" ? {} : { checkerMessage: truncate(checkerMessage, 1024) }),
      };
    });
    return { compiled: true, tests };
  }

  /** Read `/languages` once; a failed read is tried again on the next run. */
  #languageIds(): Promise<Partial<Record<Language, number>>> {
    this.#languages ??= this.#call<{ id: number; name: string }[]>("/languages", { method: "GET" }, Date.now() + 10_000)
      .then((list) => {
        if (!Array.isArray(list)) throw new RunnerUnavailable("Judge0's /languages did not answer a list");
        return mapLanguages(list);
      })
      .catch((error: unknown) => {
        this.#languages = null;
        throw error;
      });
    return this.#languages;
  }

  /** Submit jobs in batches, then poll until every one has finished; results in the jobs' order. */
  async #execute(jobs: readonly Job[], deadline: number): Promise<Submission[]> {
    const tokens: string[] = [];
    for (let at = 0; at < jobs.length; at += this.#batchSize) {
      const submissions = jobs.slice(at, at + this.#batchSize).map((job) => ({
        source_code: encode(job.source),
        language_id: job.languageId,
        stdin: encode(job.stdin),
        cpu_time_limit: seconds(job.limits.timeMs),
        wall_time_limit: seconds(job.limits.timeMs),
        memory_limit: job.limits.memoryMb * 1024,
        enable_network: false,
        redirect_stderr_to_stdout: false,
      }));
      const answer = await this.#call<Submission[]>("/submissions/batch?base64_encoded=true", { method: "POST", body: JSON.stringify({ submissions }) }, deadline);
      if (!Array.isArray(answer) || answer.length !== submissions.length) throw new RunnerUnavailable("Judge0 did not take the whole batch");
      for (const s of answer) {
        if (typeof s.token !== "string") throw new RunnerUnavailable(`Judge0 refused a submission: ${JSON.stringify(s).slice(0, 300)}`);
        tokens.push(s.token);
      }
    }

    const done = new Map<string, Submission>();
    let wait = this.#pollMs;
    while (done.size < tokens.length) {
      if (Date.now() >= deadline) throw new RunnerUnavailable("Judge0 did not finish in time");
      await pause(Math.min(wait, Math.max(0, deadline - Date.now())));
      wait = Math.min(Math.round(wait * 1.5), this.#maxPollMs);
      const pending = tokens.filter((t) => !done.has(t));
      for (let at = 0; at < pending.length; at += this.#batchSize) {
        const chunk = pending.slice(at, at + this.#batchSize);
        const answer = await this.#call<{ submissions?: (Submission | null)[] }>(
          `/submissions/batch?tokens=${chunk.map(encodeURIComponent).join(",")}&base64_encoded=true&fields=${FIELDS}`,
          { method: "GET" },
          deadline,
        );
        for (const s of answer.submissions ?? []) {
          if (s === null || typeof s.token !== "string" || s.status === undefined) continue;
          if (s.status.id === STATUS.inQueue || s.status.id === STATUS.processing) continue;
          if (s.status.id === STATUS.internalError) throw new RunnerUnavailable(`Judge0 failed internally: ${decode(s.message).slice(0, 300)}`);
          done.set(s.token, s);
        }
      }
    }
    return tokens.map((t) => done.get(t)!);
  }

  async #call<T>(path: string, init: { method: string; body?: string }, deadline: number): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.#url}${path}`, {
        ...init,
        headers: { "x-auth-token": this.#token, ...(init.body === undefined ? {} : { "content-type": "application/json" }) },
        signal: AbortSignal.timeout(Math.max(1, Math.min(30_000, deadline - Date.now()))),
      });
    } catch (error) {
      if (Date.now() >= deadline) throw new RunnerUnavailable("Judge0 did not finish in time");
      throw new RunnerUnavailable(`Judge0 could not be reached: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) throw new RunnerUnavailable(`Judge0 answered ${response.status}`);
    try {
      return (await response.json()) as T;
    } catch {
      throw new RunnerUnavailable("Judge0 answered something that is not JSON");
    }
  }
}

/** What went wrong with a run, in our words; null when it ran cleanly and its output is to be judged. */
function failure(s: Submission, stderr: string, limits: Limits): TestStatus | null {
  const id = s.status?.id;
  if (id === STATUS.accepted || id === STATUS.wrongAnswer) return null;
  if (id === STATUS.timeLimit) return "time_limit";
  if (id === STATUS.outputLimit) return "output_limit";
  const nearCap = typeof s.memory === "number" && s.memory >= limits.memoryMb * 1024 * 0.9;
  return OUT_OF_MEMORY.test(stderr) || OUT_OF_MEMORY.test(decode(s.message)) || nearCap ? "memory_limit" : "runtime_error";
}

/** A checker says right by ending 0 and wrong by ending 1; anything else is the question's fault. */
function checkerVerdict(s: Submission): { status: TestStatus; message: string } {
  const message = `${decode(s.stdout)}${decode(s.stderr)}`.trim();
  if (s.status?.id === STATUS.accepted) return { status: "passed", message };
  if (s.exit_code === 1 && s.status?.id !== STATUS.timeLimit && s.status?.id !== STATUS.outputLimit) return { status: "wrong_answer", message };
  return { status: "checker_error", message };
}

/**
 * Judge0 first; when it cannot be reached, the in-house runner. After a
 * failure, Judge0 is left alone for a while rather than tried, and waited on,
 * for every run.
 */
export class FallbackCodeRunner implements CodeRunner {
  readonly #primary: CodeRunner;
  readonly #fallback: CodeRunner;
  readonly #cooldownMs: number;
  readonly #onFallback: (error: RunnerUnavailable) => void;
  readonly #now: () => number;
  #skipUntil = 0;

  constructor(
    primary: CodeRunner,
    fallback: CodeRunner,
    options: { readonly cooldownMs?: number; readonly onFallback?: (error: RunnerUnavailable) => void; readonly now?: () => number } = {},
  ) {
    this.#primary = primary;
    this.#fallback = fallback;
    this.#cooldownMs = options.cooldownMs ?? 30_000;
    this.#onFallback = options.onFallback ?? (() => undefined);
    this.#now = options.now ?? Date.now;
  }

  async run(request: RunRequest): Promise<RunResult> {
    if (this.#now() < this.#skipUntil) return this.#fallback.run(request);
    try {
      return await this.#primary.run(request);
    } catch (error) {
      if (!(error instanceof RunnerUnavailable)) throw error;
      this.#skipUntil = this.#now() + this.#cooldownMs;
      this.#onFallback(error);
      return this.#fallback.run(request);
    }
  }
}
