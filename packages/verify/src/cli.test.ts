import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ExamLedger, attemptId, candidateId, examId } from "@parikshaa/core";

/**
 * The binary itself, in a real process.
 *
 * `cli-core.test.ts` covers the behaviour; this covers what only a process has:
 * exit codes as a shell sees them, and what happens when stdout goes away.
 */

const BINARY = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

let receiptPath: string;

beforeAll(async () => {
  let now = 1_700_000_000_000;
  const ledger = new ExamLedger({ clock: () => (now += 1000) });
  const A = attemptId("a1");
  ledger.append({ type: "attempt_started", attemptId: A, examId: examId("e"), candidateId: candidateId("c") });
  ledger.append({ type: "attempt_submitted", attemptId: A });
  ledger.append({ type: "attempt_graded", attemptId: A, total: 3 });
  const entries = ledger.entries();

  const dir = await mkdtemp(join(tmpdir(), "parikshaa-cli-"));
  receiptPath = join(dir, "receipt.json");
  await writeFile(
    receiptPath,
    JSON.stringify({ head: entries.at(-1)!.hash, length: entries.length, sealed: true, entries }),
  );
});

/** Run the binary, optionally closing stdout after the first chunk. */
function runBinary(args: readonly string[], options: { closeEarly?: boolean } = {}) {
  return new Promise<{ code: number | null; out: string; err: string }>((resolve) => {
    const child = spawn(process.execPath, [BINARY, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
      if (options.closeEarly === true) child.stdout.destroy();
    });
    child.stderr.on("data", (chunk: Buffer) => (err += chunk.toString()));
    child.on("close", (code) => resolve({ code, out, err }));
  });
}

describe("the parikshaa-verify binary", () => {
  it("exits 0 on a record that verifies", async () => {
    const { code, out } = await runBinary([receiptPath]);

    expect(code).toBe(0);
    expect(out).toContain("VERIFIED");
  });

  it("exits 1 when a pinned head is absent", async () => {
    const { code, err } = await runBinary([receiptPath, "--head", "e".repeat(64)]);

    expect(code).toBe(1);
    expect(err).toContain("NOT VERIFIED");
  });

  it("still exits 0 when stdout is closed early", async () => {
    // `parikshaa-verify receipt.json | head` closes the pipe. Node raises EPIPE,
    // and without handling it the process dies with exit 1 — which a script
    // would read as "this record did not verify".
    const { code } = await runBinary([receiptPath], { closeEarly: true });

    expect(code).toBe(0);
  });
});
