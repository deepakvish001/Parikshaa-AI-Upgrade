import { HttpCodeRunner, Judge0CodeRunner } from "@parikshaa/runner";
import { compareRunners, parityCases } from "./parity.js";

/**
 * The parity suite on staging (docs/F1-GO-LIVE-PLAN.md §5.1, G3): the in-house
 * runner and Judge0, the same programs, the same verdicts.
 *
 *   RUNNER_URL=… RUNNER_TOKEN=… JUDGE0_URL=… JUDGE0_TOKEN=… npm run parity -w @parikshaa/api
 *
 * Exits 1 when any case differs; Judge0 does not take exams until it is 0.
 */

const env = (name: string) => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    process.stderr.write("usage: RUNNER_URL=… RUNNER_TOKEN=… JUDGE0_URL=… JUDGE0_TOKEN=… [PARITY_CONCURRENCY=4] parity\n");
    process.exit(2);
  }
  return value;
};

const inHouse = new HttpCodeRunner(env("RUNNER_URL"), env("RUNNER_TOKEN"));
const judge0 = new Judge0CodeRunner(env("JUDGE0_URL"), env("JUDGE0_TOKEN"));
const started = Date.now();
const report = await compareRunners(inHouse, judge0, parityCases(), {
  concurrency: Number.parseInt(process.env["PARITY_CONCURRENCY"] ?? "4", 10),
  onCase: (name, ok) => process.stdout.write(`${ok ? "same" : "DIFF"}  ${name}\n`),
});
for (const d of report.differences) process.stdout.write(`\n${d.name}\n  in-house: ${d.a.join(" ")}\n  judge0:   ${d.b.join(" ")}\n`);
process.stdout.write(`\n${report.same} of ${report.cases} cases the same, in ${Math.round((Date.now() - started) / 1000)} s\n`);
if (report.differences.length > 0) process.exitCode = 1;
