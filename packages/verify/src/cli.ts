#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { runCli } from "./cli-core.js";

/**
 * A closed pipe must not look like a failed verification.
 *
 * `parikshaa-verify receipt.json | head` closes stdout early. Without this,
 * Node raises EPIPE as an unhandled error and the process exits 1 — which a
 * script would read as "this record did not verify". Swallowing EPIPE leaves
 * the exit code that the verification itself produced.
 */
process.stdout.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code !== "EPIPE") throw error;
});

process.exitCode = await runCli(process.argv.slice(2), {
  readFile: (path) => readFile(path, "utf8"),
  stdout: (text) => void process.stdout.write(text),
  stderr: (text) => void process.stderr.write(text),
});
