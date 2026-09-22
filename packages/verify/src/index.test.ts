import { describe, expect, it } from "vitest";
import {
  ExamLedger,
  attemptId,
  candidateId,
  examId,
  questionId,
  vivaId,
  type ExamEvent,
  type LedgerEntry,
} from "@parikshaa/core";
import { explain, parseReceipt, verifyReceipt, type Receipt } from "./index.js";

const A = attemptId("attempt-1");

function build(): readonly LedgerEntry[] {
  let now = 1_700_000_000_000;
  const ledger = new ExamLedger({ clock: () => (now += 60_000) });
  const events: ExamEvent[] = [
    { type: "attempt_started", attemptId: A, examId: examId("e1"), candidateId: candidateId("c1") },
    {
      type: "answer_submitted",
      attemptId: A,
      response: { questionId: questionId("q1"), answer: "mergesort", submittedAt: 1 },
    },
    {
      type: "viva_probed",
      attemptId: A,
      probe: { id: vivaId("p1"), questionId: questionId("q1"), prompt: "Why?", rationale: "r", askedAt: 1 },
    },
    {
      type: "viva_replied",
      attemptId: A,
      exchange: { probeId: vivaId("p1"), reply: "Because…", repliedAt: 2, latencyMs: 12_000 },
    },
    { type: "attempt_submitted", attemptId: A },
    { type: "question_scored", attemptId: A, questionId: questionId("q1"), score: 4 },
    { type: "attempt_graded", attemptId: A, total: 4 },
  ];
  for (const event of events) ledger.append(event);
  return ledger.entries();
}

const entries = build();

const receipt = (overrides: Partial<Receipt> = {}): Receipt => ({
  head: entries.at(-1)!.hash,
  length: entries.length,
  sealed: true,
  entries,
  ...overrides,
});

describe("verifyReceipt", () => {
  it("verifies a receipt the system actually produced", () => {
    const report = verifyReceipt(receipt());

    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.length).toBe(7);
      expect(report.head).toBe(entries.at(-1)!.hash);
    }
  });

  it("renders the record in terms a person can read", () => {
    const report = verifyReceipt(receipt());
    if (!report.ok) throw new Error("expected ok");

    // An appeals board reading raw JSON is not served by this tool.
    expect(report.timeline.map((t) => t.what)).toEqual([
      "Attempt started",
      "Answered q1",
      "Follow-up asked about q1",
      "Replied to the follow-up after 12s",
      "Attempt submitted",
      "Scored q1: 4",
      "Graded: 4",
    ]);
    expect(report.timeline[0]?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("refuses a receipt taken while the attempt was still open", () => {
    const report = verifyReceipt({ head: "abc", length: 3, sealed: false, entries: null });

    expect(report.ok).toBe(false);
    if (!report.ok) expect(explain(report.problem)).toMatch(/still open/i);
  });

  it("catches an edited entry", () => {
    const tampered = [...entries];
    tampered[5] = {
      ...tampered[5]!,
      event: { type: "question_scored", attemptId: A, questionId: questionId("q1"), score: 40 },
    } as LedgerEntry;

    const report = verifyReceipt(receipt({ entries: tampered }));

    expect(report.ok).toBe(false);
    if (!report.ok) {
      expect(report.problem).toEqual({ kind: "chain", seq: 5, reason: "hash_mismatch" });
      expect(explain(report.problem)).toMatch(/Entry 5 breaks the chain/);
    }
  });

  it("catches a removed entry and a stated head that is not the last hash", () => {
    const missing = entries.filter((_, i) => i !== 3);
    expect(verifyReceipt(receipt({ entries: missing, length: 6 })).ok).toBe(false);

    const lying = verifyReceipt(receipt({ head: "f".repeat(64) }));
    expect(lying.ok).toBe(false);
    if (!lying.ok) expect(lying.problem.kind).toBe("head_mismatch");
  });

  it("catches a receipt whose entry count does not match its claim", () => {
    const report = verifyReceipt(receipt({ length: 99 }));

    expect(report.ok).toBe(false);
    if (!report.ok) expect(report.problem).toMatchObject({ kind: "length_mismatch", claimed: 99, actual: 7 });
  });

  describe("against a head pinned during the exam", () => {
    it("accepts a record that grew from what the candidate was shown", () => {
      // The candidate noted the head after their second entry; the finished
      // record must still contain that hash, at that position.
      const pinned = entries[1]!.hash;

      expect(verifyReceipt(receipt(), pinned).ok).toBe(true);
    });

    it("rejects a record the pinned head does not appear in", () => {
      const report = verifyReceipt(receipt(), "d".repeat(64));

      expect(report.ok).toBe(false);
      if (!report.ok) {
        expect(report.problem.kind).toBe("pinned_head_absent");
        expect(explain(report.problem)).toMatch(/not a continuation/i);
      }
    });

    it("rejects a substituted record that verifies on its own", () => {
      // A wholly rewritten chain is internally consistent — verifying it alone
      // proves nothing. The pinned head is what makes substitution detectable.
      let now = 9_000_000_000_000;
      const other = new ExamLedger({ clock: () => (now += 1000) });
      other.append({ type: "attempt_started", attemptId: A, examId: examId("e1"), candidateId: candidateId("c1") });
      other.append({ type: "attempt_graded", attemptId: A, total: 0 });
      const substituted = other.entries();

      const alone = verifyReceipt({
        head: substituted.at(-1)!.hash,
        length: substituted.length,
        sealed: true,
        entries: substituted,
      });
      expect(alone.ok).toBe(true);

      const withPin = verifyReceipt(
        { head: substituted.at(-1)!.hash, length: substituted.length, sealed: true, entries: substituted },
        entries[1]!.hash,
      );
      expect(withPin.ok).toBe(false);
    });
  });
});

describe("parseReceipt", () => {
  it("rejects anything that is not shaped like a receipt", () => {
    for (const value of [null, 42, "text", {}, { sealed: true }, { sealed: true, length: "3" }]) {
      expect(parseReceipt(value)).toHaveProperty("error");
    }
  });

  it("accepts a receipt round-tripped through JSON", () => {
    const parsed = parseReceipt(JSON.parse(JSON.stringify(receipt())));

    expect(parsed).not.toHaveProperty("error");
    expect(verifyReceipt(parsed as Receipt).ok).toBe(true);
  });
});
