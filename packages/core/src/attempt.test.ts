import { describe, expect, it } from "vitest";
import { foldAttempt, type AttemptProjection } from "./attempt.js";
import {
  attemptId,
  candidateId,
  examId,
  questionId,
  vivaId,
  type Exam,
  type ExamEvent,
  type VivaProbe,
} from "./domain.js";
import type { LedgerEntry } from "./chain.js";
import { ExamLedger } from "./ledger.js";

const A = attemptId("attempt-1");
const E = examId("exam-1");
const C = candidateId("cand-1");
const Q1 = questionId("q1");
const Q2 = questionId("q2");
const P1 = vivaId("probe-1");

const fixedClock = (start = 1_700_000_000_000, step = 1_000) => {
  let now = start;
  return () => {
    const t = now;
    now += step;
    return t;
  };
};

/** Build a ledger from events and hand back its entries. */
const chain = (...events: readonly ExamEvent[]): readonly LedgerEntry[] => {
  const ledger = new ExamLedger({ clock: fixedClock() });
  for (const event of events) ledger.append(event);
  return ledger.entries();
};

const started: ExamEvent = { type: "attempt_started", attemptId: A, examId: E, candidateId: C };

const answered = (question = Q1, answer = "42"): ExamEvent => ({
  type: "answer_submitted",
  attemptId: A,
  response: { questionId: question, answer, submittedAt: 1_700_000_000_000 },
});

const submitted: ExamEvent = { type: "attempt_submitted", attemptId: A };

const probe: VivaProbe = {
  id: P1,
  questionId: Q1,
  prompt: "Which step would break if the premise changed?",
  rationale: "Answer scored above the viva trigger ratio.",
  askedAt: 1_700_000_005_000,
};

/** Unwrap a fold expected to succeed. */
const project = (entries: readonly LedgerEntry[], exam?: Exam): AttemptProjection => {
  const result = exam === undefined ? foldAttempt(entries) : foldAttempt(entries, { exam });
  if (!result.ok) throw new Error(`expected a successful fold, got ${result.reason} at ${result.seq}`);
  return result.projection;
};

const examWith = (allowRevision: boolean): Exam => ({
  id: E,
  title: "Test",
  questions: [],
  policy: { durationMs: 3_600_000, allowRevision, vivaTriggerRatio: 0.5 },
});

describe("foldAttempt", () => {
  it("rejects a ledger that does not open with attempt_started", () => {
    expect(foldAttempt([])).toEqual({ ok: false, seq: 0, reason: "no_start" });
    expect(foldAttempt(chain(submitted))).toEqual({ ok: false, seq: 0, reason: "no_start" });
  });

  it("takes identity and start time from the opening entry", () => {
    const { attempt } = project(chain(started));

    expect(attempt).toEqual({
      id: A,
      examId: E,
      candidateId: C,
      state: "in_progress",
      startedAt: 1_700_000_000_000,
      responses: [],
    });
  });

  it("accumulates answers in ledger order", () => {
    const { attempt } = project(chain(started, answered(Q1, "a"), answered(Q2, "b")));

    expect(attempt.responses.map((r) => [r.questionId, r.answer])).toEqual([
      [Q1, "a"],
      [Q2, "b"],
    ]);
  });

  it("replaces an answer in place when the policy allows revision", () => {
    const entries = chain(started, answered(Q1, "first"), answered(Q1, "second"));

    const { attempt } = project(entries, examWith(true));

    expect(attempt.responses).toHaveLength(1);
    expect(attempt.responses[0]?.answer).toBe("second");
  });

  it("rejects a revision when the policy forbids it", () => {
    const entries = chain(started, answered(Q1, "first"), answered(Q1, "second"));

    expect(foldAttempt(entries, { exam: examWith(false) })).toEqual({
      ok: false,
      seq: 2,
      reason: "revision_not_allowed",
    });
  });

  it("rejects an answer recorded after submission", () => {
    const entries = chain(started, submitted, answered());

    expect(foldAttempt(entries)).toEqual({ ok: false, seq: 2, reason: "not_in_progress" });
  });

  it("rejects a duplicate start and a foreign attempt", () => {
    expect(foldAttempt(chain(started, started))).toEqual({
      ok: false,
      seq: 1,
      reason: "duplicate_start",
    });

    const foreign: ExamEvent = { type: "attempt_submitted", attemptId: attemptId("attempt-2") };
    expect(foldAttempt(chain(started, foreign))).toEqual({
      ok: false,
      seq: 1,
      reason: "foreign_attempt",
    });
  });

  it("stitches a probe, its reply and its assessment into one record", () => {
    const entries = chain(
      started,
      answered(),
      { type: "viva_probed", attemptId: A, probe },
      {
        type: "viva_replied",
        attemptId: A,
        exchange: { probeId: P1, reply: "The monotonicity step.", repliedAt: 1, latencyMs: 9_400 },
      },
      {
        type: "viva_assessed",
        attemptId: A,
        assessment: { probeId: P1, verdict: "consistent", confidence: 0.8, reasoning: "Named the right step." },
      },
    );

    const { vivas } = project(entries);

    expect(vivas).toHaveLength(1);
    expect(vivas[0]?.probe.id).toBe(P1);
    expect(vivas[0]?.exchange?.latencyMs).toBe(9_400);
    expect(vivas[0]?.assessment?.verdict).toBe("consistent");
  });

  it("rejects a reply to a probe that was never recorded", () => {
    const entries = chain(started, {
      type: "viva_replied",
      attemptId: A,
      exchange: { probeId: P1, reply: "...", repliedAt: 1, latencyMs: 10 },
    });

    expect(foldAttempt(entries)).toEqual({ ok: false, seq: 1, reason: "unknown_probe" });
  });

  it("collects scores and the final total once graded", () => {
    const entries = chain(
      started,
      answered(Q1),
      answered(Q2),
      submitted,
      { type: "question_scored", attemptId: A, questionId: Q1, score: 4 },
      { type: "question_scored", attemptId: A, questionId: Q2, score: 3 },
      { type: "attempt_graded", attemptId: A, total: 7 },
    );

    const { attempt, scores, total } = project(entries);

    expect(attempt.state).toBe("graded");
    expect(total).toBe(7);
    expect([...scores]).toEqual([
      [Q1, 4],
      [Q2, 3],
    ]);
  });

  it("rejects scoring before submission, and any event after grading", () => {
    const scoring: ExamEvent = { type: "question_scored", attemptId: A, questionId: Q1, score: 4 };
    expect(foldAttempt(chain(started, scoring))).toEqual({
      ok: false,
      seq: 1,
      reason: "not_submitted",
    });

    const afterGrading = chain(started, submitted, { type: "attempt_graded", attemptId: A, total: 0 }, scoring);
    expect(foldAttempt(afterGrading)).toEqual({ ok: false, seq: 3, reason: "closed" });
  });

  it("allows a void after grading, which is when it is usually decided", () => {
    const graded = chain(
      started,
      answered(),
      submitted,
      { type: "attempt_graded", attemptId: A, total: 5 },
      { type: "attempt_voided", attemptId: A, reason: "Reviewed after a follow-up; attempt set aside." },
    );

    const { attempt, voidReason, total } = project(graded);

    expect(attempt.state).toBe("void");
    expect(voidReason).toMatch(/set aside/);
    // The grade it had is still in the record; voiding does not erase it.
    expect(total).toBe(5);
  });

  it("allows nothing at all after a void", () => {
    const afterVoid = chain(
      started,
      { type: "attempt_voided", attemptId: A, reason: "Withdrawn." },
      { type: "attempt_voided", attemptId: A, reason: "Again." },
    );

    expect(foldAttempt(afterVoid)).toEqual({ ok: false, seq: 2, reason: "closed" });
  });

  it("records a void with its reason and closes the attempt", () => {
    const entries = chain(started, answered(), {
      type: "attempt_voided",
      attemptId: A,
      reason: "Candidate withdrew.",
    });

    const { attempt, voidReason } = project(entries);

    expect(attempt.state).toBe("void");
    expect(voidReason).toBe("Candidate withdrew.");
    expect(foldAttempt(chain(started, { type: "attempt_voided", attemptId: A, reason: "x" }, submitted))).toEqual({
      ok: false,
      seq: 2,
      reason: "closed",
    });
  });

  describe("time extensions", () => {
    const extended = (minutes: number): ExamEvent => ({
      type: "time_extended",
      attemptId: A,
      extraMs: minutes * 60_000,
      reason: "Power cut in the exam hall.",
      decidedBy: { userId: "u1", name: "Invigilator" },
    });

    it("adds up every extension granted while the attempt is open", () => {
      const { extraTimeMs } = project(chain(started, extended(10), answered(), extended(5)));
      expect(extraTimeMs).toBe(15 * 60_000);
    });

    it("starts at none", () => {
      expect(project(chain(started)).extraTimeMs).toBe(0);
    });

    it("cannot reopen an attempt that has closed", () => {
      const result = foldAttempt(chain(started, submitted, extended(10)));
      expect(result).toMatchObject({ ok: false, reason: "not_in_progress", seq: 2 });
    });
  });

  describe("reopening", () => {
    const reopened = (minutes: number): ExamEvent => ({
      type: "attempt_reopened",
      attemptId: A,
      extraMs: minutes * 60_000,
      reason: "The laptop crashed and submitted on its own.",
      decidedBy: { userId: "u1", name: "Invigilator" },
    });
    const graded: ExamEvent = { type: "attempt_graded", attemptId: A, total: 3 };

    it("opens a submitted attempt again, with the time granted, and takes answers again", () => {
      const projection = project(chain(started, answered(Q1, "1"), submitted, reopened(20), answered(Q1, "2"), submitted));
      expect(projection.attempt.state).toBe("submitted");
      expect(projection.extraTimeMs).toBe(20 * 60_000);
      expect(projection.attempt.responses).toEqual([expect.objectContaining({ questionId: Q1, answer: "2" })]);
    });

    it("forgets scores from a grading that had begun on the old submission", () => {
      const scored: ExamEvent = { type: "question_scored", attemptId: A, questionId: Q1, score: 1 };
      expect(project(chain(started, answered(), submitted, scored, reopened(5))).scores.size).toBe(0);
    });

    it("never reopens an attempt that is open, graded or set aside", () => {
      const voided: ExamEvent = { type: "attempt_voided", attemptId: A, reason: "Sat by someone else, it turned out." };
      expect(foldAttempt(chain(started, reopened(5)))).toMatchObject({ ok: false, reason: "not_submitted", seq: 1 });
      expect(foldAttempt(chain(started, submitted, graded, reopened(5)))).toMatchObject({ ok: false, reason: "closed", seq: 3 });
      expect(foldAttempt(chain(started, submitted, voided, reopened(5)))).toMatchObject({ ok: false, reason: "closed", seq: 3 });
    });
  });

  describe("consent and erasure (ROADMAP §11)", () => {
    const consent: ExamEvent = { type: "consent_given", attemptId: A, noticeVersion: 2, noticeHash: "ab".repeat(32) };
    const erased: ExamEvent = { type: "data_erased", attemptId: A, reason: "request" };
    const graded: ExamEvent = { type: "attempt_graded", attemptId: A, total: 3 };

    it("records the notice agreed to, before anything the candidate does", () => {
      expect(project(chain(started, consent, answered())).consent).toEqual({ noticeVersion: 2, noticeHash: "ab".repeat(32) });
      expect(project(chain(started)).consent).toBeNull();
      expect(foldAttempt(chain(started, answered(), consent))).toMatchObject({ ok: false, reason: "not_in_progress", seq: 2 });
      expect(foldAttempt(chain(started, consent, consent))).toMatchObject({ ok: false, reason: "not_in_progress", seq: 2 });
    });

    it("erases a closed attempt — graded or set aside too — and keeps its scores", () => {
      const projection = project(chain(started, answered(), submitted, graded, erased));
      expect(projection.erasedAt).not.toBeNull();
      expect(projection.total).toBe(3);
      const voided: ExamEvent = { type: "attempt_voided", attemptId: A, reason: "Sat by someone else, it turned out." };
      expect(project(chain(started, submitted, voided, erased)).erasedAt).not.toBeNull();
    });

    it("never erases an open attempt, and nothing but a void follows erasure", () => {
      expect(foldAttempt(chain(started, erased))).toMatchObject({ ok: false, reason: "not_submitted", seq: 1 });
      expect(foldAttempt(chain(started, submitted, erased, graded))).toMatchObject({ ok: false, reason: "closed", seq: 3 });
      const voided: ExamEvent = { type: "attempt_voided", attemptId: A, reason: "Erased before it could be graded." };
      expect(project(chain(started, submitted, erased, voided)).attempt.state).toBe("void");
    });
  });
});
