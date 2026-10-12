import { spawn, spawnSync } from "node:child_process";
import { chmod, chown, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { accepts, EXACT, splitResult, type Checker } from "./judge.js";
import { SPECS, type Language } from "./languages.js";

/**
 * Running untrusted code (ROADMAP §4).
 *
 * Candidate code is hostile by assumption: it will read the filesystem, open
 * sockets, fork until the machine stops and loop forever. Every run is wrapped,
 * outermost first, in:
 *
 *   unshare   a fresh network namespace (no interfaces but a dead loopback),
 *             and fresh IPC, UTS and PID namespaces. `--kill-child` ties the
 *             candidate's process tree to the wrapper's lifetime.
 *   prlimit   CPU seconds, process count, file size, open files and — where the
 *             language allows it — address space.
 *   setpriv   drop from root to this slot's own unprivileged uid, with no
 *             supplementary groups and no way to regain privileges.
 *
 * plus a wall-clock timeout that kills the process group, an output cap, a
 * clean environment, and a private 0700 working directory that is deleted
 * afterwards. Because each concurrent slot has its own uid, cleanup can kill
 * *every* process that uid owns — which catches a fork bomb that escaped its
 * process group, and means concurrent runs cannot signal or read each other.
 *
 * None of this is a kernel boundary: a kernel exploit walks through all of it.
 * That boundary is gVisor, which the runner's container runs under in
 * production and which `main.ts` refuses to start without. This layer is what
 * makes the ordinary attacks fail cheaply and legibly, inside that boundary.
 *
 * Without root (development, most CI), the namespace and uid steps cannot be
 * taken and are skipped, and so is the process-count limit, which would count
 * every process the developer's own user runs. `main.ts` will not serve like
 * that unless told explicitly that isolation is off.
 */

export interface TestCase {
  readonly id: string;
  /** Given to the program on standard input. */
  readonly input: string;
  /** What standard output must be, compared after normalising line endings and trailing space. */
  readonly expected: string;
}

export interface Limits {
  /** Wall-clock per test. */
  readonly timeMs: number;
  readonly memoryMb: number;
}

export interface RunRequest {
  readonly language: Language;
  readonly source: string;
  readonly tests: readonly TestCase[];
  readonly limits?: Partial<Limits>;
  /** How an output is judged. Exact, forgiving line endings and trailing space, when absent. */
  readonly checker?: Checker;
  /**
   * Set for a function question: the program prints this, then the function's
   * result. Only what follows it is judged; what precedes it is the program's
   * own output. See `splitResult`.
   */
  readonly resultMarker?: string;
}

export type TestStatus =
  | "passed"
  | "wrong_answer"
  | "time_limit"
  | "memory_limit"
  | "runtime_error"
  | "output_limit"
  /** The question's own checker program failed: the question's fault, not the candidate's. */
  | "checker_error";

export interface TestResult {
  readonly id: string;
  readonly status: TestStatus;
  readonly timeMs: number;
  /** Peak resident memory, in kilobytes; null when it could not be measured. */
  readonly memoryKb: number | null;
  /** Truncated to a few kilobytes: enough to show a candidate what went wrong. */
  readonly stdout: string;
  readonly stderr: string;
  /** For a function question: what the function returned, as JSON; null when it returned nothing. */
  readonly result?: string | null;
  /** What a custom checker said about the output, if it said anything. */
  readonly checkerMessage?: string;
}

export type RunResult =
  | { readonly compiled: false; readonly compileOutput: string }
  | { readonly compiled: true; readonly tests: readonly TestResult[] };

/** Who a run executes as, when the runner has root to drop from. */
export interface Slot {
  readonly uid: number;
  readonly gid: number;
}

export interface SandboxOptions {
  /** Where per-run working directories are made. */
  readonly workRoot: string;
  /** The slot's uid to run as; null when the runner is not root. */
  readonly slot: Slot | null;
}

export const DEFAULT_LIMITS: Limits = { timeMs: 2000, memoryMb: 256 };
export const MAX_LIMITS: Limits = { timeMs: 10_000, memoryMb: 1024 };

const COMPILE_LIMITS: Limits = { timeMs: 30_000, memoryMb: 1024 };
export const CHECKER_LIMITS: Limits = { timeMs: 5_000, memoryMb: 512 };
/** Most a single stream may produce before the run is stopped. */
const OUTPUT_CAP = 1024 * 1024;
/** Most of a stream kept for the report. */
const REPORT_CAP = 4096;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_PROCESSES = 128;
const MAX_OPEN_FILES = 64;

export const clampLimits = (limits: Partial<Limits> | undefined): Limits => ({
  timeMs: Math.min(Math.max(limits?.timeMs ?? DEFAULT_LIMITS.timeMs, 100), MAX_LIMITS.timeMs),
  memoryMb: Math.min(Math.max(limits?.memoryMb ?? DEFAULT_LIMITS.memoryMb, 32), MAX_LIMITS.memoryMb),
});

export const truncate = (text: string, cap = REPORT_CAP): string =>
  text.length <= cap ? text : `${text.slice(0, cap)}\n… (${text.length - cap} more characters)`;

interface Outcome {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timeMs: number;
  readonly memoryKb: number | null;
  readonly timedOut: boolean;
  readonly outputExceeded: boolean;
}

/**
 * The meter: the innermost wrapper of a test run. It starts the program as its
 * child, waits for it, and reports the child's peak resident memory and the
 * time it ran on descriptor 3, which the program itself never gets. A program
 * killed by a signal is reported the same way, and the meter then dies of the
 * same signal so the outcome reads exactly as it would without it.
 */
const METER = [
  "import os, sys, time, resource, signal",
  "resource.setrlimit(resource.RLIMIT_CORE, (0, 0))",
  "argv = sys.argv[1:]",
  "t0 = time.monotonic()",
  "pid = os.fork()",
  "if pid == 0:",
  "    os.close(3)",
  "    try:",
  "        os.execvp(argv[0], argv)",
  "    except OSError as e:",
  "        os.write(2, (str(e) + '\\n').encode())",
  "        os._exit(127)",
  "_, status, usage = os.wait4(pid, 0)",
  "elapsed = int((time.monotonic() - t0) * 1000)",
  "os.write(3, ('%d %d\\n' % (usage.ru_maxrss, elapsed)).encode())",
  "if os.WIFSIGNALED(status):",
  "    sig = os.WTERMSIG(status)",
  "    signal.signal(sig, signal.SIG_DFL)",
  "    os.kill(os.getpid(), sig)",
  "os._exit(os.WEXITSTATUS(status))",
].join("\n");

let meterAvailable: boolean | undefined;
/** Whether the meter can run here: it needs python3, which every runner image has. */
const canMeasure = (): boolean => (meterAvailable ??= spawnSync("python3", ["-c", ""]).status === 0);

/** Run one command inside every layer the options allow. */
function contained(
  argv: readonly string[],
  options: {
    readonly cwd: string;
    readonly stdin: string;
    readonly limits: Limits;
    readonly addressSpace: boolean;
    readonly slot: Slot | null;
    /** Report peak memory and run time through the meter. */
    readonly measure?: boolean;
  },
): Promise<Outcome> {
  const { limits, slot } = options;
  const measure = options.measure === true && canMeasure();
  const cpuSeconds = Math.ceil(limits.timeMs / 1000) + 1;

  const wrapper = [
    ...(slot === null ? [] : ["unshare", "--net", "--ipc", "--uts", "--pid", "--fork", "--kill-child", "--"]),
    "prlimit",
    `--cpu=${cpuSeconds}`,
    `--fsize=${MAX_FILE_BYTES}`,
    `--nofile=${MAX_OPEN_FILES}`,
    "--core=0",
    ...(slot === null ? [] : [`--nproc=${MAX_PROCESSES}`]),
    ...(options.addressSpace ? [`--as=${limits.memoryMb * 1024 * 1024}`] : []),
    "--",
    ...(slot === null
      ? []
      : ["setpriv", `--reuid=${slot.uid}`, `--regid=${slot.gid}`, "--clear-groups", "--no-new-privs", "--"]),
    ...(measure ? ["python3", "-I", "-S", "-c", METER] : []),
    ...argv,
  ];

  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(wrapper[0]!, wrapper.slice(1), {
      cwd: options.cwd,
      // Nothing of the runner's own environment — no token, no proxy settings,
      // no JAVA_TOOL_OPTIONS — reaches candidate code.
      env: { PATH: process.env["PATH"] ?? "/usr/local/bin:/usr/bin:/bin", HOME: options.cwd, TMPDIR: options.cwd, LANG: "C.UTF-8" },
      detached: true,
      stdio: measure ? ["pipe", "pipe", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
    });

    let metered = "";
    if (measure) child.stdio[3]?.on("data", (chunk: Buffer) => (metered += chunk.toString("utf8")));

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputExceeded = false;
    const killGroup = () => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, "SIGKILL");
      } catch {
        // Already gone.
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, limits.timeMs);

    const collect = (which: "stdout" | "stderr") => (chunk: Buffer) => {
      if (which === "stdout") stdout += chunk.toString("utf8");
      else stderr += chunk.toString("utf8");
      if (stdout.length + stderr.length > OUTPUT_CAP && !outputExceeded) {
        outputExceeded = true;
        killGroup();
      }
    };
    child.stdout.on("data", collect("stdout"));
    child.stderr.on("data", collect("stderr"));

    // A program that exits without reading its input closes the pipe; that is
    // the program's business, not an error in the runner.
    child.stdin.on("error", () => undefined);
    child.stdin.end(options.stdin);

    child.on("error", (error) => {
      stderr += `\n${error.message}`;
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      const wall = Number((process.hrtime.bigint() - started) / 1_000_000n);
      const [maxRssKb, ranMs] = /^(\d+) (\d+)$/.exec(metered.trim())?.slice(1).map(Number) ?? [];
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
        // The meter's own clock leaves out the wrappers' start-up.
        timeMs: ranMs ?? wall,
        memoryKb: maxRssKb ?? null,
        timedOut,
        outputExceeded,
      });
    });
  });
}

/** What each language says when it runs out of memory. */
export const OUT_OF_MEMORY = /MemoryError|std::bad_alloc|OutOfMemoryError|heap out of memory|Cannot allocate memory/;

/** How a run ended, before its output is judged; null when it ended normally. */
function failure(outcome: Outcome, limits: Limits): TestStatus | null {
  if (outcome.outputExceeded) return "output_limit";
  if (outcome.timedOut || outcome.signal === "SIGXCPU") return "time_limit";
  if (outcome.exitCode === 0 && outcome.signal === null) return null;
  const nearCap = outcome.memoryKb !== null && outcome.memoryKb >= limits.memoryMb * 1024 * 0.9;
  return OUT_OF_MEMORY.test(outcome.stderr) || nearCap ? "memory_limit" : "runtime_error";
}

/**
 * Kill everything the slot's uid owns, until it owns nothing.
 *
 * One pass is not enough against a fork bomb: `pkill` kills a snapshot while
 * the survivors keep forking, and processes that are dying still show for a
 * moment. So it stops them all first — a stopped process cannot fork — then
 * kills, and repeats until the uid has no processes left. The slot is not
 * reused until this returns, which is what keeps one run from leaking into the
 * next.
 */
async function sweep(slot: Slot | null): Promise<void> {
  if (slot === null) return;
  const uid = String(slot.uid);
  for (let round = 0; round < 100; round++) {
    spawnSync("pkill", ["-STOP", "-u", uid]);
    spawnSync("pkill", ["-KILL", "-u", uid]);
    if (spawnSync("pgrep", ["-u", uid]).status !== 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Processes of uid ${uid} survived cleanup; this slot must not be reused`);
}

/**
 * Run a question's own checker on one output.
 *
 * In a directory of its own that the program never saw, holding only what is
 * written here, readable but not writable by the slot's uid — so nothing the
 * candidate's program left behind can stand in for the checker or the files it
 * reads. Python runs isolated (-I), so it imports nothing from that directory
 * either.
 */
async function check(
  source: string,
  test: TestCase,
  output: string,
  options: SandboxOptions,
): Promise<{ status: TestStatus; message: string }> {
  const dir = await mkdtemp(join(options.workRoot, "check-"));
  try {
    await chmod(dir, 0o755);
    const files: [string, string][] = [
      ["checker.py", source],
      ["input.txt", test.input],
      ["expected.txt", test.expected],
      ["output.txt", output],
    ];
    for (const [name, content] of files) await writeFile(join(dir, name), content, { mode: 0o644 });
    const outcome = await contained(["python3", "-I", "-S", "checker.py", "input.txt", "expected.txt", "output.txt"], {
      cwd: dir,
      stdin: "",
      limits: CHECKER_LIMITS,
      addressSpace: true,
      slot: options.slot,
    });
    await sweep(options.slot);
    const message = `${outcome.stdout}${outcome.stderr}`.trim();
    if (outcome.timedOut || outcome.outputExceeded || outcome.signal !== null) return { status: "checker_error", message };
    if (outcome.exitCode === 0) return { status: "passed", message };
    if (outcome.exitCode === 1) return { status: "wrong_answer", message };
    return { status: "checker_error", message };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Build the program, then run it against each test in turn. */
export async function execute(request: RunRequest, options: SandboxOptions): Promise<RunResult> {
  const spec = SPECS[request.language];
  const limits = clampLimits(request.limits);
  if (options.slot !== null) {
    // Traversable but not listable: a slot uid can reach its own run directory
    // by name, but cannot discover anyone else's.
    await chmod(options.workRoot, 0o711);
  }
  const dir = await mkdtemp(join(options.workRoot, "run-"));

  try {
    await writeFile(join(dir, spec.file), request.source, { mode: 0o600 });
    if (options.slot !== null) {
      await chown(dir, options.slot.uid, options.slot.gid);
      await chown(join(dir, spec.file), options.slot.uid, options.slot.gid);
    }

    if (spec.compile !== undefined) {
      const built = await contained(spec.compile, {
        cwd: dir,
        stdin: "",
        limits: COMPILE_LIMITS,
        // Compilers are native; javac is a JVM and gets its heap from -J-Xmx.
        addressSpace: request.language !== "java",
        slot: options.slot,
      });
      await sweep(options.slot);
      if (built.exitCode !== 0 || built.timedOut) {
        const output = built.timedOut ? "Compilation took too long." : `${built.stderr}${built.stdout}`;
        return { compiled: false, compileOutput: truncate(output.trim(), 8192) };
      }
    }

    const checker = request.checker ?? EXACT;
    const marker = request.resultMarker;
    const tests: TestResult[] = [];
    for (const test of request.tests) {
      const outcome = await contained(spec.run(limits.memoryMb), {
        cwd: dir,
        stdin: test.input,
        limits,
        addressSpace: spec.addressSpaceLimit,
        slot: options.slot,
        measure: true,
      });
      await sweep(options.slot);

      const { printed, result } = marker === undefined ? { printed: outcome.stdout, result: null } : splitResult(outcome.stdout, marker);
      const judged = marker === undefined ? outcome.stdout : result;
      let status = failure(outcome, limits);
      let checkerMessage: string | undefined;
      if (status === null) {
        if (judged === null) status = "wrong_answer";
        else if (checker.kind === "custom") {
          const verdict = await check(checker.source, test, judged, options);
          status = verdict.status;
          checkerMessage = verdict.message;
        } else status = accepts(checker, test.expected, judged) ? "passed" : "wrong_answer";
      }
      tests.push({
        id: test.id,
        status,
        timeMs: outcome.timeMs,
        memoryKb: outcome.memoryKb,
        stdout: truncate(printed),
        stderr: truncate(outcome.stderr, 2048),
        ...(marker === undefined ? {} : { result: result === null ? null : truncate(result) }),
        ...(checkerMessage === undefined || checkerMessage === "" ? {} : { checkerMessage: truncate(checkerMessage, 1024) }),
      });
    }
    return { compiled: true, tests };
  } finally {
    await sweep(options.slot);
    await rm(dir, { recursive: true, force: true });
  }
}
