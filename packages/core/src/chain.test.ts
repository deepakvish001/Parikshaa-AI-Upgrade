import { describe, expect, it } from "vitest";
import {
  GENESIS_HASH,
  canonicalize,
  checkChain,
  checkChainAsync,
  entryPreimage,
  webcryptoSha256,
  type LedgerEntry,
} from "./chain.js";
import { attemptId, candidateId, examId, questionId, type ExamEvent } from "./domain.js";
import { ExamLedger, hashPreimage, verifyChain } from "./ledger.js";

const A = attemptId("attempt-1");

const chain = (...events: readonly ExamEvent[]): readonly LedgerEntry[] => {
  let now = 1_700_000_000_000;
  const ledger = new ExamLedger({ clock: () => (now += 1000) });
  for (const event of events) ledger.append(event);
  return ledger.entries();
};

const entries = chain(
  { type: "attempt_started", attemptId: A, examId: examId("e"), candidateId: candidateId("c") },
  {
    type: "answer_submitted",
    attemptId: A,
    response: { questionId: questionId("q1"), answer: "9.80", submittedAt: 1 },
  },
  { type: "attempt_submitted", attemptId: A },
  { type: "attempt_graded", attemptId: A, total: 7 },
);

describe("digest conformance", () => {
  /**
   * The point of this file. The server hashes with node:crypto and a candidate's
   * browser hashes with WebCrypto; if those ever disagreed, an untouched record
   * would fail verification in front of the person it is about, and look like
   * exactly the tampering this design exists to detect.
   */
  it("WebCrypto and node:crypto agree on every entry in a real chain", async () => {
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      const preimage = entryPreimage(entry);
      expect(await webcryptoSha256(preimage)).toBe(hashPreimage(preimage));
      expect(await webcryptoSha256(preimage)).toBe(entry.hash);
    }
  });

  it("agrees on awkward inputs too", async () => {
    for (const value of [
      "",
      "a",
      "परीक्षा", // multi-byte, so the two text encoders must agree
      "line\nbreak\ttab",
      "\u0000null byte",
      JSON.stringify({ deeply: { nested: [1, 2, { three: null }] } }),
      "x".repeat(10_000),
    ]) {
      expect(await webcryptoSha256(value)).toBe(hashPreimage(value));
    }
  });

  it("reaches the same verdict through both walks", async () => {
    expect(checkChain(entries, hashPreimage)).toEqual({ ok: true });
    expect(await checkChainAsync(entries, webcryptoSha256)).toEqual({ ok: true });

    const tampered = [...entries];
    tampered[1] = { ...tampered[1]!, timestamp: 0 } as LedgerEntry;

    expect(checkChain(tampered, hashPreimage)).toEqual({ ok: false, seq: 1, reason: "hash_mismatch" });
    expect(await checkChainAsync(tampered, webcryptoSha256)).toEqual({
      ok: false,
      seq: 1,
      reason: "hash_mismatch",
    });
  });
});

describe("checkChain", () => {
  it("accepts an empty chain and the ledger's own output", () => {
    expect(checkChain([], hashPreimage)).toEqual({ ok: true });
    expect(verifyChain(entries)).toEqual({ ok: true });
  });

  it("detects a renumbered, relinked or rewritten entry", () => {
    const renumbered = entries.map((e, i) => (i === 2 ? { ...e, seq: 9 } : e));
    expect(checkChain(renumbered, hashPreimage)).toEqual({ ok: false, seq: 2, reason: "bad_sequence" });

    const relinked = entries.map((e, i) => (i === 2 ? { ...e, prevHash: GENESIS_HASH } : e));
    expect(checkChain(relinked, hashPreimage)).toEqual({ ok: false, seq: 2, reason: "broken_link" });

    const rewritten = entries.map((e, i) =>
      i === 3 ? ({ ...e, event: { ...e.event, total: 100 } } as LedgerEntry) : e,
    );
    expect(checkChain(rewritten, hashPreimage)).toEqual({ ok: false, seq: 3, reason: "hash_mismatch" });
  });

  it("canonicalizes independently of key order", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
    expect(canonicalize([{ z: 1, a: 2 }])).toBe('[{"a":2,"z":1}]');
    expect(canonicalize({ kept: 1, dropped: undefined })).toBe('{"kept":1}');
  });
});
