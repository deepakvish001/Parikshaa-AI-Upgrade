import { createHash } from "node:crypto";
import type { ExamEvent, Timestamp } from "./domain.js";
import {
  GENESIS_HASH,
  checkChain,
  entryPreimage,
  type Digest,
  type LedgerEntry,
  type VerifyResult,
} from "./chain.js";

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

/** The hash an entry must carry, given its contents. */
export function entryHash(input: Omit<LedgerEntry, "hash">): string {
  return hashPreimage(entryPreimage(input));
}

/** Hash a preimage that was persisted earlier, without rebuilding it. */
export const hashPreimage: Digest = (preimage) =>
  createHash("sha256").update(preimage, "utf8").digest("hex");

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

/** Verify a chain using the server's digest. See `checkChain` for the walk. */
export function verifyChain(entries: readonly LedgerEntry[]): VerifyResult {
  return checkChain(entries, hashPreimage);
}
