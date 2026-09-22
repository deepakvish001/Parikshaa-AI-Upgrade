import { describe, expect, it } from "vitest";
import {
  ExamLedger,
  attemptId,
  candidateId,
  examId,
  questionId,
  type LedgerEntry,
} from "@parikshaa/core";
import { runCli, type CliIO } from "./cli-core.js";

const A = attemptId("attempt-1");

function chain(): readonly LedgerEntry[] {
  let now = 1_700_000_000_000;
  const ledger = new ExamLedger({ clock: () => (now += 1000) });
  ledger.append({ type: "attempt_started", attemptId: A, examId: examId("e"), candidateId: candidateId("c") });
  ledger.append({
    type: "answer_submitted",
    attemptId: A,
    response: { questionId: questionId("q1"), answer: "mergesort", submittedAt: 1 },
  });
  ledger.append({ type: "attempt_graded", attemptId: A, total: 4 });
  return ledger.entries();
}

const entries = chain();
const receiptJson = JSON.stringify({
  head: entries.at(-1)!.hash,
  length: entries.length,
  sealed: true,
  entries,
});

/** Run the CLI over an in-memory filesystem and collect what it wrote. */
async function run(argv: readonly string[], files: Record<string, string> = { "r.json": receiptJson }) {
  let out = "";
  let err = "";
  const io: CliIO = {
    readFile: async (path) => {
      const file = files[path];
      if (file === undefined) throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      return file;
    },
    stdout: (text) => (out += text),
    stderr: (text) => (err += text),
  };
  const code = await runCli(argv, io);
  return { code, out, err };
}

describe("runCli", () => {
  it("verifies a good receipt and prints the record", async () => {
    const { code, out } = await run(["r.json"]);

    expect(code).toBe(0);
    expect(out).toContain("VERIFIED — 3 entries, unbroken.");
    expect(out).toContain(entries.at(-1)!.hash);
    expect(out).toContain("Answered q1");
  });

  it("confirms a pinned head only when one was given", async () => {
    const withoutPin = await run(["r.json"]);
    expect(withoutPin.out).not.toContain("pinned");

    const withPin = await run(["r.json", "--head", entries[1]!.hash]);
    expect(withPin.code).toBe(0);
    expect(withPin.out).toContain("The head you pinned appears in this record at its own position.");
  });

  it("fails when the pinned head is not in the record", async () => {
    // The answer this tool must never get wrong: a wholly substituted chain
    // verifies on its own, and only the pin catches it.
    const { code, err } = await run(["r.json", "--head", "d".repeat(64)]);

    expect(code).toBe(1);
    expect(err).toContain("NOT VERIFIED");
    expect(err).toMatch(/not a continuation/i);
  });

  it("accepts the receipt path before or after the flag", async () => {
    const before = await run(["r.json", "--head", entries[1]!.hash]);
    const after = await run(["--head", entries[1]!.hash, "r.json"]);

    expect(before.code).toBe(0);
    expect(after.code).toBe(0);
    expect(after.out).toContain("pinned");
  });

  it("never treats the hash as the receipt path", async () => {
    // Reading the hash as a filename would report "could not read", which looks
    // like a missing file rather than a usage error.
    const { code, err } = await run(["--head", entries[1]!.hash]);

    expect(code).toBe(1);
    expect(err).toBe("No receipt file given\n");
  });

  it("refuses --head with nothing after it, rather than silently skipping the check", async () => {
    // Silently dropping the pin would print VERIFIED for a substituted record.
    for (const argv of [["r.json", "--head"], ["r.json", "--head", "--verbose"]]) {
      const { code, err, out } = await run(argv);
      expect(code).toBe(1);
      expect(err).toBe("--head needs a hash\n");
      expect(out).not.toContain("VERIFIED");
    }
  });

  it("reports a tampered record with the entry that broke", async () => {
    const tampered = [...entries];
    tampered[1] = { ...tampered[1]!, timestamp: 0 } as LedgerEntry;
    const files = {
      "bad.json": JSON.stringify({ head: entries.at(-1)!.hash, length: 3, sealed: true, entries: tampered }),
    };

    const { code, err } = await run(["bad.json"], files);

    expect(code).toBe(1);
    expect(err).toContain("Entry 1 breaks the chain");
  });

  it("explains an unreadable file, malformed JSON and a file that is not a receipt", async () => {
    const missing = await run(["nope.json"]);
    expect(missing.code).toBe(1);
    expect(missing.err).toMatch(/Could not read nope\.json/);

    const notJson = await run(["x.json"], { "x.json": "{not json" });
    expect(notJson.code).toBe(1);
    expect(notJson.err).toMatch(/not valid JSON/);

    const notReceipt = await run(["x.json"], { "x.json": '{"hello":"world"}' });
    expect(notReceipt.code).toBe(1);
    expect(notReceipt.err).toMatch(/not a Parikshaa receipt/);
  });

  it("refuses an unsealed receipt with advice rather than a bare failure", async () => {
    const files = { "open.json": JSON.stringify({ head: "a".repeat(64), length: 2, sealed: false, entries: null }) };

    const { code, err } = await run(["open.json"], files);

    expect(code).toBe(1);
    expect(err).toMatch(/Download it again once the attempt is closed/);
  });

  it("prints usage on --help and on no arguments, with the right exit codes", async () => {
    const help = await run(["--help"]);
    expect(help.code).toBe(0);
    expect(help.out).toContain("parikshaa-verify <receipt.json>");

    const bare = await run([]);
    expect(bare.code).toBe(1);
    expect(bare.err).toContain("parikshaa-verify <receipt.json>");
  });
});
