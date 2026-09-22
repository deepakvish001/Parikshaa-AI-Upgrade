import type { ExamEvent, Timestamp } from "./domain.js";

/**
 * The hash chain, independent of how bytes are hashed.
 *
 * Chain-walking lives here, parameterized by a digest, so that the server (via
 * `node:crypto`) and a browser (via WebCrypto, whose digest is async) share one
 * implementation. Two copies of this logic would eventually disagree, and the
 * disagreement would look exactly like tampering — which is the failure this
 * whole design exists to make impossible.
 *
 * Nothing here imports a platform module, so it bundles anywhere.
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

export type VerifyFailure = "bad_sequence" | "broken_link" | "hash_mismatch";

export type VerifyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly seq: number; readonly reason: VerifyFailure };

export type Digest = (preimage: string) => string;
export type AsyncDigest = (preimage: string) => Promise<string>;

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
 * hash: re-deriving it from a database round-trip is how an untouched row
 * starts looking tampered with. One definition, used by the hash, the store and
 * every verifier.
 */
export function entryPreimage(input: Omit<LedgerEntry, "hash">): string {
  return canonicalize({
    seq: input.seq,
    timestamp: input.timestamp,
    event: input.event,
    prevHash: input.prevHash,
  });
}

/** The structural checks, shared by both the sync and async walks. */
function structuralProblem(entry: LedgerEntry, index: number, expectedPrev: string): VerifyResult | null {
  if (entry.seq !== index) return { ok: false, seq: index, reason: "bad_sequence" };
  if (entry.prevHash !== expectedPrev) return { ok: false, seq: index, reason: "broken_link" };
  return null;
}

/**
 * Check that a sequence of entries forms an unbroken chain: sequence numbers
 * ascend from zero, each entry points at its predecessor, and each hash matches
 * the contents it claims to cover.
 */
export function checkChain(entries: readonly LedgerEntry[], digest: Digest): VerifyResult {
  let prevHash = GENESIS_HASH;
  for (const [index, entry] of entries.entries()) {
    const problem = structuralProblem(entry, index, prevHash);
    if (problem !== null) return problem;
    if (digest(entryPreimage(entry)) !== entry.hash) {
      return { ok: false, seq: index, reason: "hash_mismatch" };
    }
    prevHash = entry.hash;
  }
  return { ok: true };
}

/** {@link checkChain} for a digest that is asynchronous, as WebCrypto's is. */
export async function checkChainAsync(
  entries: readonly LedgerEntry[],
  digest: AsyncDigest,
): Promise<VerifyResult> {
  let prevHash = GENESIS_HASH;
  for (const [index, entry] of entries.entries()) {
    const problem = structuralProblem(entry, index, prevHash);
    if (problem !== null) return problem;
    if ((await digest(entryPreimage(entry))) !== entry.hash) {
      return { ok: false, seq: index, reason: "hash_mismatch" };
    }
    prevHash = entry.hash;
  }
  return { ok: true };
}

/**
 * SHA-256 over WebCrypto, available in browsers and in Node.
 *
 * The server hashes with `node:crypto` instead, so a conformance test pins the
 * two to the same output rather than trusting that they agree.
 */
export async function webcryptoSha256(preimage: string): Promise<string> {
  const bytes = new TextEncoder().encode(preimage);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
