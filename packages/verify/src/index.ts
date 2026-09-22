import { verifyChain, type ExamEvent, type LedgerEntry, type VerifyResult } from "@parikshaa/core";

/**
 * Offline verification of a candidate's receipt.
 *
 * This is the artefact the whole ledger exists for. A candidate who is told
 * their record says something can check that claim here, with no server, no
 * database and no network — which matters precisely because the party they are
 * disputing with runs all three.
 */

export interface Receipt {
  readonly head: string | null;
  readonly length: number;
  readonly sealed: boolean;
  readonly entries: readonly LedgerEntry[] | null;
}

export type ReceiptProblem =
  | { readonly kind: "not_a_receipt"; readonly detail: string }
  | { readonly kind: "unsealed" }
  | { readonly kind: "length_mismatch"; readonly claimed: number; readonly actual: number }
  | { readonly kind: "head_mismatch"; readonly claimed: string | null; readonly actual: string | null }
  | { readonly kind: "chain"; readonly seq: number; readonly reason: string }
  | { readonly kind: "pinned_head_absent"; readonly pinned: string }
  | { readonly kind: "pinned_head_moved"; readonly pinned: string; readonly seq: number };

export interface TimelineEntry {
  readonly seq: number;
  readonly at: string;
  readonly what: string;
}

export type VerificationReport =
  | { readonly ok: true; readonly head: string; readonly length: number; readonly timeline: readonly TimelineEntry[] }
  | { readonly ok: false; readonly problem: ReceiptProblem };

/** Parse an unknown value as a receipt, without trusting any of its fields. */
export function parseReceipt(value: unknown): Receipt | { readonly error: string } {
  if (typeof value !== "object" || value === null) return { error: "not an object" };
  const candidate = value as Partial<Receipt>;
  if (typeof candidate.sealed !== "boolean") return { error: "missing `sealed`" };
  if (typeof candidate.length !== "number") return { error: "missing `length`" };
  if (candidate.head !== null && typeof candidate.head !== "string") return { error: "bad `head`" };
  if (candidate.entries !== null && !Array.isArray(candidate.entries)) return { error: "bad `entries`" };
  return candidate as Receipt;
}

function describe(event: ExamEvent): string {
  switch (event.type) {
    case "attempt_started":
      return "Attempt started";
    case "answer_submitted":
      return `Answered ${event.response.questionId}`;
    case "attempt_submitted":
      return "Attempt submitted";
    case "viva_probed":
      return `Follow-up asked about ${event.probe.questionId}`;
    case "viva_replied":
      return `Replied to the follow-up after ${Math.round(event.exchange.latencyMs / 1000)}s`;
    case "viva_assessed":
      return `Follow-up read as "${event.assessment.verdict}"`;
    case "question_scored":
      return `Scored ${event.questionId}: ${event.score}`;
    case "attempt_graded":
      return `Graded: ${event.total}`;
    case "time_extended":
      return `Time extended by ${Math.round(event.extraMs / 60_000)} min by ${event.decidedBy.name} — ${event.reason}`;
    case "attempt_voided":
      return `Voided${event.decidedBy === undefined ? "" : ` by ${event.decidedBy.name}`} — ${event.reason}`;
  }
}

/**
 * Verify a receipt, optionally against a head hash pinned earlier.
 *
 * The pinned head is the strong check. A candidate who noted it while sitting
 * the exam is holding a commitment made before anything could be reconsidered;
 * finding that hash at its recorded position proves the record they are being
 * shown now grew from the one they saw then.
 */
export function verifyReceipt(receipt: Receipt, pinnedHead?: string): VerificationReport {
  if (!receipt.sealed || receipt.entries === null) {
    return { ok: false, problem: { kind: "unsealed" } };
  }

  const entries = receipt.entries;

  if (entries.length !== receipt.length) {
    return {
      ok: false,
      problem: { kind: "length_mismatch", claimed: receipt.length, actual: entries.length },
    };
  }

  const chain: VerifyResult = verifyChain(entries);
  if (!chain.ok) {
    return { ok: false, problem: { kind: "chain", seq: chain.seq, reason: chain.reason } };
  }

  const actualHead = entries.at(-1)?.hash ?? null;
  if (actualHead !== receipt.head) {
    return { ok: false, problem: { kind: "head_mismatch", claimed: receipt.head, actual: actualHead } };
  }

  if (pinnedHead !== undefined) {
    const at = entries.findIndex((entry) => entry.hash === pinnedHead);
    if (at === -1) {
      return { ok: false, problem: { kind: "pinned_head_absent", pinned: pinnedHead } };
    }
    // The pinned hash must sit at its own sequence position. Finding it
    // elsewhere would mean the prefix it committed to was rearranged.
    if (entries[at]?.seq !== at) {
      return { ok: false, problem: { kind: "pinned_head_moved", pinned: pinnedHead, seq: at } };
    }
  }

  return {
    ok: true,
    head: actualHead ?? "",
    length: entries.length,
    timeline: entries.map((entry) => ({
      seq: entry.seq,
      at: new Date(entry.timestamp).toISOString(),
      what: describe(entry.event),
    })),
  };
}

/** A human-readable explanation of a failure. */
export function explain(problem: ReceiptProblem): string {
  switch (problem.kind) {
    case "not_a_receipt":
      return `This file is not a Parikshaa receipt (${problem.detail}).`;
    case "unsealed":
      return "This receipt was taken while the attempt was still open, so it carries only a head hash. Download it again once the attempt is closed.";
    case "length_mismatch":
      return `The receipt claims ${problem.claimed} entries but contains ${problem.actual}.`;
    case "head_mismatch":
      return `The receipt's stated head (${problem.claimed ?? "none"}) is not the hash of its last entry (${problem.actual ?? "none"}).`;
    case "chain":
      return `Entry ${problem.seq} breaks the chain: ${problem.reason.replace(/_/g, " ")}. Every entry after it is therefore unverifiable.`;
    case "pinned_head_absent":
      return `The hash you pinned (${problem.pinned.slice(0, 16)}…) does not appear in this record at all. This is not a continuation of what you were shown.`;
    case "pinned_head_moved":
      return `The hash you pinned appears at position ${problem.seq}, which is not its own sequence number. The record has been rearranged.`;
  }
}

export { runCli, USAGE, type CliIO } from "./cli-core.js";
