import { describe, expect, it } from "vitest";
import { attemptId, candidateId, examId, questionId, type ExamEvent } from "./domain.js";
import { canonicalize, GENESIS_HASH, type LedgerEntry } from "./chain.js";
import { entryHash, ExamLedger, verifyChain } from "./ledger.js";

const A = attemptId("attempt-1");

/** A clock that advances a fixed step per call, so hashes are reproducible. */
const fixedClock = (start = 1_700_000_000_000, step = 1_000) => {
  let now = start;
  return () => {
    const t = now;
    now += step;
    return t;
  };
};

const started: ExamEvent = {
  type: "attempt_started",
  attemptId: A,
  examId: examId("exam-1"),
  candidateId: candidateId("cand-1"),
};

const answered = (answer: string): ExamEvent => ({
  type: "answer_submitted",
  attemptId: A,
  response: { questionId: questionId("q1"), answer, submittedAt: 1_700_000_000_000 },
});

const seeded = () => {
  const ledger = new ExamLedger({ clock: fixedClock() });
  ledger.append(started);
  ledger.append(answered("42"));
  ledger.append({ type: "attempt_submitted", attemptId: A });
  return ledger;
};

describe("ExamLedger", () => {
  it("starts empty, verifying, with the genesis head", () => {
    const ledger = new ExamLedger({ clock: fixedClock() });

    expect(ledger.length).toBe(0);
    expect(ledger.head).toBe(GENESIS_HASH);
    expect(ledger.verify()).toEqual({ ok: true });
  });

  it("anchors the first entry to the genesis hash", () => {
    const ledger = new ExamLedger({ clock: fixedClock() });

    const entry = ledger.append(started);

    expect(entry.seq).toBe(0);
    expect(entry.prevHash).toBe(GENESIS_HASH);
    expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(ledger.head).toBe(entry.hash);
  });

  it("links each entry to its predecessor", () => {
    const entries = seeded().entries();

    expect(entries).toHaveLength(3);
    for (const [index, entry] of entries.entries()) {
      expect(entry.seq).toBe(index);
      expect(entry.prevHash).toBe(index === 0 ? GENESIS_HASH : entries[index - 1]!.hash);
    }
    expect(verifyChain(entries)).toEqual({ ok: true });
  });

  it("detects an edited payload", () => {
    const entries = [...seeded().entries()];
    // Rewrite the answer but keep the recorded hash — the classic silent edit.
    entries[1] = { ...entries[1]!, event: answered("99") } as LedgerEntry;

    expect(verifyChain(entries)).toEqual({ ok: false, seq: 1, reason: "hash_mismatch" });
  });

  it("detects a spliced-out entry", () => {
    const entries = seeded().entries();
    const withoutMiddle = [entries[0]!, { ...entries[2]!, seq: 1 }];

    expect(verifyChain(withoutMiddle)).toEqual({ ok: false, seq: 1, reason: "broken_link" });
  });

  it("hashes independently of key order", () => {
    const reordered = {
      response: { submittedAt: 1_700_000_000_000, answer: "42", questionId: questionId("q1") },
      attemptId: A,
      type: "answer_submitted",
    } as ExamEvent;

    const draft = { seq: 0, timestamp: 1, prevHash: GENESIS_HASH } as const;

    expect(canonicalize(reordered)).toBe(canonicalize(answered("42")));
    expect(entryHash({ ...draft, event: reordered })).toBe(entryHash({ ...draft, event: answered("42") }));
  });

  it("refuses to load a chain that does not verify", () => {
    const entries = [...seeded().entries()];
    entries[2] = { ...entries[2]!, prevHash: GENESIS_HASH } as LedgerEntry;

    expect(() => ExamLedger.from(entries)).toThrow(/does not verify: broken_link at seq 2/);
    expect(ExamLedger.from(seeded().entries()).length).toBe(3);
  });
});
