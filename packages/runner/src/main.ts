import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { cpus } from "node:os";
import { buildRunnerServer } from "./server.js";

/**
 * Start the runner — but only somewhere it is safe to.
 *
 * RUNNER_ISOLATION must say where it is running:
 *
 *   gvisor        the production setting. The runner checks that it really is
 *                 inside gVisor, that it has root to drop from, and refuses to
 *                 start otherwise.
 *   unsafe-none   for a developer's machine. Candidate code runs with the
 *                 runner's own privileges and network. It says so, loudly.
 *
 * There is no default. A runner that quietly executed untrusted code on a bare
 * host because a variable was forgotten is the failure this exists to prevent.
 */

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const isolation = process.env["RUNNER_ISOLATION"];
const token = process.env["RUNNER_TOKEN"] ?? fail("RUNNER_TOKEN is not set");
if (token.length < 32) fail("RUNNER_TOKEN must be at least 32 characters");

const isRoot = process.getuid?.() === 0;
if (isolation === "gvisor") {
  // gVisor's kernel identifies itself in its boot log, which real kernels do not.
  const log = spawnSync("dmesg", { encoding: "utf8" });
  if (!`${log.stdout}${log.stderr}`.includes("gVisor")) {
    fail("RUNNER_ISOLATION=gvisor, but this is not running under gVisor. Run the container with runtime: runsc.");
  }
  if (!isRoot) fail("The runner needs root inside its sandbox, to drop each run to its own uid.");
} else if (isolation === "unsafe-none") {
  process.stderr.write(
    "WARNING: RUNNER_ISOLATION=unsafe-none. Candidate code runs without a kernel boundary. Never use this with real candidates.\n",
  );
} else {
  fail('RUNNER_ISOLATION must be "gvisor" (production) or "unsafe-none" (development only).');
}

const count = Number(process.env["RUNNER_SLOTS"] ?? Math.max(1, cpus().length));
const slots = isRoot ? Array.from({ length: count }, (_, i) => ({ uid: 61000 + i, gid: 61000 + i })) : [];
const workRoot = process.env["RUNNER_WORKDIR"] ?? "/tmp/parikshaa-runs";
await mkdir(workRoot, { recursive: true, mode: 0o711 });

const app = buildRunnerServer({ token, workRoot, slots });
const port = Number(process.env["PORT"] ?? "4000");
await app.listen({ port, host: "0.0.0.0" });
process.stdout.write(`runner listening on :${port} with ${Math.max(slots.length, 1)} slot(s), isolation=${isolation}\n`);
