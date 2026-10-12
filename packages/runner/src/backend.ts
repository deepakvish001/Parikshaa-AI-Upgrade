import { HttpCodeRunner, type CodeRunner, type RunnerUnavailable } from "./client.js";
import { FallbackCodeRunner, Judge0CodeRunner } from "./judge0.js";

/**
 * Which runner the API uses, from its environment (docs/F1-GO-LIVE-PLAN.md §5.1):
 *
 * - `RUNNER_BACKEND=gvisor` (the default): the in-house runner at `RUNNER_URL`,
 *   with `RUNNER_TOKEN`; none at all when `RUNNER_URL` is not set.
 * - `RUNNER_BACKEND=judge0`: Judge0 at `JUDGE0_URL`, with `JUDGE0_TOKEN`; and,
 *   when `RUNNER_URL` is set too, the in-house runner whenever Judge0 cannot
 *   be reached.
 *
 * A setting that names a backend without what it needs fails at boot.
 */
export function runnerFromEnv(
  env: Readonly<Record<string, string | undefined>>,
  onFallback: (error: RunnerUnavailable) => void = () => undefined,
): CodeRunner | undefined {
  const value = (name: string) => (env[name] === undefined || env[name] === "" ? undefined : env[name]);
  const required = (name: string) => {
    const found = value(name);
    if (found === undefined) throw new Error(`Missing required environment variable: ${name}`);
    return found;
  };
  const backend = value("RUNNER_BACKEND") ?? "gvisor";
  if (backend !== "gvisor" && backend !== "judge0") throw new Error(`RUNNER_BACKEND must be gvisor or judge0, not ${backend}`);

  const runnerUrl = value("RUNNER_URL");
  const inHouse = runnerUrl === undefined ? undefined : new HttpCodeRunner(runnerUrl, required("RUNNER_TOKEN"));
  if (backend === "gvisor") return inHouse;

  const timeout = value("JUDGE0_TIMEOUT_MS");
  const judge0 = new Judge0CodeRunner(required("JUDGE0_URL"), required("JUDGE0_TOKEN"), timeout === undefined ? {} : { timeoutMs: Number.parseInt(timeout, 10) });
  return inHouse === undefined ? judge0 : new FallbackCodeRunner(judge0, inHouse, { onFallback });
}
