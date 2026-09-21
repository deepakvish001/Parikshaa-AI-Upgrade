import { createHash } from "node:crypto";
import type { ExamEvent, Timestamp } from "./domain.js";

/**
 * Tamper-evident append-only ledger for exam events.
 *
 * Each entry commits to its predecessor's hash, so altering, reordering or
 * removing any entry invalidates every hash after it. This does not *prevent*
 * tampering — anyone holding the store can rewrite the whole chain — but it
 * means a candidate, an invigilator and an appeals board can each hold a copy
 * of the head hash and later prove the record they were shown is the one that
 * was written. That is the property an assessment dispute actually turns on.
 */

/** Hash a genesis entry points at: 32 zero bytes, hex-encoded. */
export const GENESIS_HASH = "0".repeat(64);

export interface LedgerEntry {
  /** Zero-based position in the chain. */
  readonly seq: number;
  readonly timestamp: Timestamp;
  readonly event: ExamEvent;
  /** Hash of the entry at `seq - 1`, or {@link GENESIS_HASH} for the first. */
  readonly prevHash: string;
  readonly hash: string;
}

export type VerifyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly seq: number; readonly reason: VerifyFailure };

export type VerifyFailure =
  | "bad_sequence"
  | "broken_link"
  | "hash_mismatch";

/**
 * Serialize a value with object keys in a stable order.
 *
 * Two structurally equal events must hash identically regardless of the key
 * order their JSON happened to arrive in, otherwise a round-trip through any
 * store that reorders keys would look like tampering.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
  return `{${entries.join(",")}}`;
}

/**
 * The exact bytes an entry's hash covers.
 *
 * Exported because storage must persist this string verbatim alongside the
 * hash: re-deriving it from a database round-trip is how a untouched row starts
 * looking tampered with. One definition, used by both the hash and the store.
 */
export function entryPreimage(input: Omit<LedgerEntry, "hash">): string {
  return canonicalize({
    seq: input.seq,
    timestamp: input.timestamp,
    event: input.event,
    prevHash: input.prevHash,
  });
}

/** The hash an entry must carry, given its contents. */
export function entryHash(input: Omit<LedgerEntry, "hash">): string {
  return hashPreimage(entryPreimage(input));
}

/** Hash a preimage that was persisted earlier, without rebuilding it. */
export function hashPreimage(preimage: string): string {
  return createHash("sha256").update(preimage, "utf8").digest("hex");
}

/** Injectable clock, so tests and replays are deterministic. */
export type Clock = () => Timestamp;

export class ExamLedger {
  readonly #entries: LedgerEntry[] = [];
  readonly #clock: Clock;

  constructor(options: { readonly clock?: Clock } = {}) {
    this.#clock = options.clock ?? (() => Date.now());
  }

  /** Rebuild a ledger from stored entries, rejecting the batch if it does not verify. */
  static from(entries: readonly LedgerEntry[], options: { readonly clock?: Clock } = {}): ExamLedger {
    const result = verifyChain(entries);
    if (!result.ok) {
      throw new Error(`Refusing to load a ledger that does not verify: ${result.reason} at seq ${result.seq}`);
    }
    const ledger = new ExamLedger(options);
    ledger.#entries.push(...entries);
    return ledger;
  }

  /** Hash of the newest entry, or {@link GENESIS_HASH} when empty. */
  get head(): string {
    return this.#entries.at(-1)?.hash ?? GENESIS_HASH;
  }

  get length(): number {
    return this.#entries.length;
  }

  /** A snapshot of the chain. The returned array is a copy; entries are frozen. */
  entries(): readonly LedgerEntry[] {
    return [...this.#entries];
  }

  /** Append an event and return the entry that now commits to it. */
  append(event: ExamEvent): LedgerEntry {
    const draft = {
      seq: this.#entries.length,
      timestamp: this.#clock(),
      event,
      prevHash: this.head,
    } as const;
    const entry: LedgerEntry = Object.freeze({ ...draft, hash: entryHash(draft) });
    this.#entries.push(entry);
    return entry;
  }

  /** Verify this ledger's own chain. */
  verify(): VerifyResult {
    return verifyChain(this.#entries);
  }
}

/**
 * Check that a sequence of entries forms an unbroken chain: sequence numbers
 * ascend from zero, each entry points at its predecessor, and each hash matches
 * the contents it claims to cover.
 */
export function verifyChain(entries: readonly LedgerEntry[]): VerifyResult {
  let prevHash = GENESIS_HASH;
  for (const [index, entry] of entries.entries()) {
    if (entry.seq !== index) {
      return { ok: false, seq: index, reason: "bad_sequence" };
    }
    if (entry.prevHash !== prevHash) {
      return { ok: false, seq: index, reason: "broken_link" };
    }
    if (entryHash(entry) !== entry.hash) {
      return { ok: false, seq: index, reason: "hash_mismatch" };
    }
    prevHash = entry.hash;
  }
  return { ok: true };
}
