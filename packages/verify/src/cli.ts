#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { explain, parseReceipt, verifyReceipt } from "./index.js";

const USAGE = `parikshaa-verify <receipt.json> [--head <hash>]

Checks a Parikshaa receipt offline. Needs no server and no network.

  --head <hash>   Also check that a head hash you noted during the exam
                  appears in this record at its own position.

Exit code 0 if the record verifies, 1 if it does not.
`;

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  process.stdout.write(USAGE);
  process.exit(args.length === 0 ? 1 : 0);
}

const path = args[0]!;
const headIndex = args.indexOf("--head");
const pinned = headIndex === -1 ? undefined : args[headIndex + 1];

if (headIndex !== -1 && pinned === undefined) {
  process.stderr.write("--head needs a hash\n");
  process.exit(1);
}

let parsed: unknown;
try {
  parsed = JSON.parse(await readFile(path, "utf8"));
} catch (error) {
  process.stderr.write(`Could not read ${path}: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

const receipt = parseReceipt(parsed);
if ("error" in receipt) {
  process.stderr.write(`${explain({ kind: "not_a_receipt", detail: receipt.error })}\n`);
  process.exit(1);
}

const report = pinned === undefined ? verifyReceipt(receipt) : verifyReceipt(receipt, pinned);

if (!report.ok) {
  process.stderr.write(`NOT VERIFIED\n\n${explain(report.problem)}\n`);
  process.exit(1);
}

process.stdout.write(`VERIFIED — ${report.length} entries, unbroken.\n`);
process.stdout.write(`head ${report.head}\n`);
if (pinned !== undefined) {
  process.stdout.write(`The head you pinned appears in this record at its own position.\n`);
}
process.stdout.write(`\nWhat the record says:\n`);
for (const entry of report.timeline) {
  process.stdout.write(`  ${String(entry.seq).padStart(3)}  ${entry.at}  ${entry.what}\n`);
}
