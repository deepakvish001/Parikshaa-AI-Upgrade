import { explain, parseReceipt, verifyReceipt } from "./index.js";

/**
 * The CLI's behaviour, separated from the process it usually runs in.
 *
 * Argument handling here is not incidental: if `--head` were quietly dropped,
 * the tool would print VERIFIED for a wholly substituted record, which is the
 * one answer it must never give wrongly. So it is written as a function over
 * injected IO and tested directly, rather than left to be exercised by hand.
 */

export interface CliIO {
  readonly readFile: (path: string) => Promise<string>;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export const USAGE = `parikshaa-verify <receipt.json> [--head <hash>]

Checks a Parikshaa receipt offline. Needs no server and no network.

  --head <hash>   Also check that a head hash you noted during the exam
                  appears in this record at its own position.

Exit code 0 if the record verifies, 1 if it does not.
`;

export async function runCli(argv: readonly string[], io: CliIO): Promise<number> {
  if (argv.length === 0) {
    io.stderr(USAGE);
    return 1;
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    io.stdout(USAGE);
    return 0;
  }

  const headIndex = argv.indexOf("--head");
  const pinned = headIndex === -1 ? undefined : argv[headIndex + 1];
  if (headIndex !== -1 && (pinned === undefined || pinned.startsWith("--"))) {
    io.stderr("--head needs a hash\n");
    return 1;
  }

  // Skip the value belonging to --head, but only when --head is actually
  // present: with headIndex at -1, `headIndex + 1` is 0, which would skip the
  // receipt path itself.
  const hashIndex = headIndex === -1 ? -1 : headIndex + 1;
  const path = argv.find((arg, index) => !arg.startsWith("--") && index !== hashIndex);
  if (path === undefined) {
    io.stderr("No receipt file given\n");
    return 1;
  }

  let contents: string;
  try {
    contents = await io.readFile(path);
  } catch (error) {
    io.stderr(`Could not read ${path}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(contents);
  } catch {
    io.stderr(`${explain({ kind: "not_a_receipt", detail: "not valid JSON" })}\n`);
    return 1;
  }

  const receipt = parseReceipt(parsedJson);
  if ("error" in receipt) {
    io.stderr(`${explain({ kind: "not_a_receipt", detail: receipt.error })}\n`);
    return 1;
  }

  const report = pinned === undefined ? verifyReceipt(receipt) : verifyReceipt(receipt, pinned);

  if (!report.ok) {
    io.stderr(`NOT VERIFIED\n\n${explain(report.problem)}\n`);
    return 1;
  }

  io.stdout(`VERIFIED — ${report.length} entries, unbroken.\n`);
  io.stdout(`head ${report.head}\n`);
  if (pinned !== undefined) {
    io.stdout("The head you pinned appears in this record at its own position.\n");
  }
  io.stdout("\nWhat the record says:\n");
  for (const entry of report.timeline) {
    io.stdout(`  ${String(entry.seq).padStart(3)}  ${entry.at}  ${entry.what}\n`);
  }
  return 0;
}
