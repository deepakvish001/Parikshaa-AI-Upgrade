import { spawn, spawnSync } from "node:child_process";
import { chmod, chown, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
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
}

export type TestStatus = "passed" | "wrong_answer" | "time_limit" | "runtime_error" | "output_limit";

export interface TestResult {
  readonly id: string;
  readonly status: TestStatus;
  readonly timeMs: number;
  /** Truncated to a few kilobytes: enough to show a candidate what went wrong. */
  readonly stdout: string;
  readonly stderr: string;
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

/** Output as a judge compares it: LF endings, no trailing space on a line, no trailing blank lines. */
export const normalise = (text: string): string =>
  text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/, "");

const truncate = (text: string, cap = REPORT_CAP): string =>
  text.length <= cap ? text : `${text.slice(0, cap)}\n… (${text.length - cap} more characters)`;

interface Outcome {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timeMs: number;
  readonly timedOut: boolean;
  readonly outputExceeded: boolean;
}

/** Run one command inside every layer the options allow. */
function contained(
  argv: readonly string[],
  options: {
    readonly cwd: string;
    readonly stdin: string;
    readonly limits: Limits;
    readonly addressSpace: boolean;
    readonly slot: Slot | null;
  },
): Promise<Outcome> {
  const { limits, slot } = options;
  const cpuSeconds = Math.ceil(limits.timeMs / 1000) + 1;

  const wrapper = [
    ...(slot === null ? [] : ["unshare", "--net", "--ipc", "--uts", "--pid", "--fork", "--kill-child", "--"]),
    "prlimit",
    `--cpu=${cpuSeconds}`,
    `--fsize=${MAX_FILE_BYTES}`,
    `--nofile=${MAX_OPEN_FILES}`,
    ...(slot === null ? [] : [`--nproc=${MAX_PROCESSES}`]),
    ...(options.addressSpace ? [`--as=${limits.memoryMb * 1024 * 1024}`] : []),
    "--",
    ...(slot === null
      ? []
      : ["setpriv", `--reuid=${slot.uid}`, `--regid=${slot.gid}`, "--clear-groups", "--no-new-privs", "--"]),
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
      stdio: ["pipe", "pipe", "pipe"],
    });

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
      resolve({
        exitCode,
        signal,
        stdout,
        stderr,
        timeMs: Number((process.hrtime.bigint() - started) / 1_000_000n),
        timedOut,
        outputExceeded,
      });
    });
  });
}

function classify(outcome: Outcome, expected: string): TestStatus {
  if (outcome.outputExceeded) return "output_limit";
  if (outcome.timedOut || outcome.signal === "SIGXCPU") return "time_limit";
  if (outcome.exitCode !== 0 || outcome.signal !== null) return "runtime_error";
  return normalise(outcome.stdout) === normalise(expected) ? "passed" : "wrong_answer";
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

    const tests: TestResult[] = [];
    for (const test of request.tests) {
      const outcome = await contained(spec.run(limits.memoryMb), {
        cwd: dir,
        stdin: test.input,
        limits,
        addressSpace: spec.addressSpaceLimit,
        slot: options.slot,
      });
      await sweep(options.slot);
      tests.push({
        id: test.id,
        status: classify(outcome, test.expected),
        timeMs: outcome.timeMs,
        stdout: truncate(outcome.stdout),
        stderr: truncate(outcome.stderr, 2048),
      });
    }
    return { compiled: true, tests };
  } finally {
    await sweep(options.slot);
    await rm(dir, { recursive: true, force: true });
  }
}
