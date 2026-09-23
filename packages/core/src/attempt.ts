import type {
  Attempt,
  AttemptState,
  Exam,
  QuestionId,
  Response,
  StaffAttribution,
  Timestamp,
  VivaAssessment,
  VivaExchange,
  VivaId,
  VivaProbe,
} from "./domain.js";
import type { LedgerEntry } from "./chain.js";

/**
 * Reconstructing an attempt from its ledger.
 *
 * Attempt state is never stored — it is a fold over the attempt's events. That
 * is what makes a grade checkable: given the ledger (which verifies against its
 * own hash chain), anyone can recompute what Parikshaa reported and compare.
 *
 * The fold is strict on purpose. An answer recorded after submission, a second
 * `attempt_started`, an event belonging to a different attempt — each of these
 * means a bug in whatever wrote the ledger, or an attack. A fold that quietly
 * tolerated them would hide exactly the thing an audit is looking for, so the
 * fold reports the first one it meets and stops.
 */

/** A probe and whatever has happened to it so far. */
export interface VivaRecord {
  readonly probe: VivaProbe;
  readonly exchange: VivaExchange | null;
  readonly assessment: VivaAssessment | null;
}

export interface AttemptProjection {
  readonly attempt: Attempt;
  readonly vivas: readonly VivaRecord[];
  readonly scores: ReadonlyMap<QuestionId, number>;
  /** Final total, once `attempt_graded` has been recorded. */
  readonly total: number | null;
  readonly voidReason: string | null;
  /** Who set the attempt aside. Null for a void recorded before staff had accounts. */
  readonly voidedBy: StaffAttribution | null;
  /** A hard close from the attempt's scheduled window, if it had one. */
  readonly closesAt: Timestamp | null;
  /** Time added to the exam's window for this attempt, by `time_extended` entries. */
  readonly extraTimeMs: number;
  /** When the attempt's personal data was erased, if it was (`data_erased`). */
  readonly erasedAt: Timestamp | null;
  /** The identity check (ROADMAP §14): the photos' hashes, and a person's decision on them. */
  readonly identity: {
    readonly selfieSha256: string;
    readonly idSha256: string;
    readonly capturedAt: Timestamp;
    readonly review: { readonly outcome: "verified" | "rejected"; readonly reason: string; readonly decidedBy: StaffAttribution; readonly at: Timestamp } | null;
  } | null;
  /** The privacy notice the candidate agreed to, if one was asked for. */
  readonly consent: { readonly noticeVersion: number; readonly noticeHash: string } | null;
  /** Test results for each code question's current answer; cleared when the answer changes. */
  readonly codeScores: ReadonlyMap<QuestionId, { readonly score: number; readonly passed: number; readonly total: number }>;
}

export type FoldFailure =
  /** The chain does not open with `attempt_started`. */
  | "no_start"
  | "duplicate_start"
  /** An event carrying a different attemptId than the one that started the chain. */
  | "foreign_attempt"
  /** An answer or probe recorded once the attempt was no longer open. */
  | "not_in_progress"
  /** Scoring or grading before the attempt was submitted. */
  | "not_submitted"
  /** An event after the attempt was voided, or a non-void event after grading. */
  | "closed"
  /** A second answer to a question, under a policy that forbids revision. */
  | "revision_not_allowed"
  /** A reply or assessment for a probe that was never recorded. */
  | "unknown_probe";

export type FoldResult =
  | { readonly ok: true; readonly projection: AttemptProjection }
  | { readonly ok: false; readonly seq: number; readonly reason: FoldFailure };

interface MutableViva {
  readonly probe: VivaProbe;
  exchange: VivaExchange | null;
  assessment: VivaAssessment | null;
}

/**
 * Fold a verified ledger into the attempt it describes.
 *
 * Pass the {@link Exam} to additionally enforce its policy — currently
 * `allowRevision`. Without it, only structural rules are checked, which is the
 * right mode for an auditor who has the ledger but not the exam definition.
 *
 * Ordering comes from the ledger, not from timestamps inside the payloads: the
 * entry's position in the chain is what the hash commits to.
 */
export function foldAttempt(
  entries: readonly LedgerEntry[],
  options: { readonly exam?: Exam } = {},
): FoldResult {
  const first = entries[0];
  if (first === undefined || first.event.type !== "attempt_started") {
    return { ok: false, seq: first?.seq ?? 0, reason: "no_start" };
  }

  const allowRevision = options.exam?.policy.allowRevision ?? true;
  const { attemptId, examId, candidateId } = first.event;
  const closesAt = first.event.closesAt ?? null;
  const startedAt = first.timestamp;

  let state: AttemptState = "in_progress";
  let total: number | null = null;
  let voidReason: string | null = null;
  let voidedBy: StaffAttribution | null = null;
  let extraTimeMs = 0;
  let erasedAt: Timestamp | null = null;
  let consent: { noticeVersion: number; noticeHash: string } | null = null;
  let identity: AttemptProjection["identity"] = null;
  const codeScores = new Map<QuestionId, { score: number; passed: number; total: number }>();
  const responses: Response[] = [];
  const vivas = new Map<VivaId, MutableViva>();
  const scores = new Map<QuestionId, number>();

  const project = (): FoldResult => ({
    ok: true,
    projection: {
      attempt: { id: attemptId, examId, candidateId, state, startedAt, responses },
      vivas: [...vivas.values()].map((v) => ({ ...v })),
      scores,
      total,
      voidReason,
      voidedBy,
      closesAt,
      extraTimeMs,
      erasedAt,
      identity,
      consent,
      codeScores,
    },
  });

  for (const entry of entries.slice(1)) {
    const event = entry.event;
    const fail = (reason: FoldFailure): FoldResult => ({ ok: false, seq: entry.seq, reason });

    if (event.attemptId !== attemptId) return fail("foreign_attempt");

    // Voiding is the one thing that may follow grading, and deliberately so:
    // an attempt is usually voided *because* someone reviewed it, which happens
    // after it was graded. Nothing follows a void.
    // Erasure may follow either, and only a void may follow erasure: there is
    // nothing left to grade, and nothing personal may be written again.
    if (event.type === "data_erased") {
      if (state === "in_progress") return fail("not_submitted");
      erasedAt = entry.timestamp;
      continue;
    }
    if (state === "void") return fail("closed");
    if (erasedAt !== null && event.type !== "attempt_voided") return fail("closed");
    if (state === "graded" && event.type !== "attempt_voided") return fail("closed");

    switch (event.type) {
      case "attempt_started":
        return fail("duplicate_start");

      case "answer_submitted": {
        if (state !== "in_progress") return fail("not_in_progress");
        const existing = responses.findIndex((r) => r.questionId === event.response.questionId);
        if (existing === -1) {
          responses.push(event.response);
        } else {
          if (!allowRevision) return fail("revision_not_allowed");
          responses[existing] = event.response;
        }
        // A result belongs to the answer it tested, not to the question.
        codeScores.delete(event.response.questionId);
        break;
      }

      case "attempt_submitted": {
        if (state !== "in_progress") return fail("not_in_progress");
        state = "submitted";
        break;
      }

      // A probe may be raised mid-attempt or after submission, but not once the
      // attempt is closed — that is caught by the `closed` guard above.
      case "viva_probed": {
        vivas.set(event.probe.id, { probe: event.probe, exchange: null, assessment: null });
        break;
      }

      case "viva_replied": {
        const viva = vivas.get(event.exchange.probeId);
        if (viva === undefined) return fail("unknown_probe");
        viva.exchange = event.exchange;
        break;
      }

      case "viva_assessed": {
        const viva = vivas.get(event.assessment.probeId);
        if (viva === undefined) return fail("unknown_probe");
        viva.assessment = event.assessment;
        break;
      }

      case "question_scored": {
        if (state !== "submitted") return fail("not_submitted");
        scores.set(event.questionId, event.score);
        break;
      }

      case "attempt_graded": {
        if (state !== "submitted") return fail("not_submitted");
        state = "graded";
        total = event.total;
        break;
      }

      // While open, when an answer is committed, or after submission, when
      // grading tests one that was never tested — never once graded.
      case "code_tested": {
        if (state !== "in_progress" && state !== "submitted") return fail("not_in_progress");
        codeScores.set(event.questionId, { score: event.score, passed: event.passed, total: event.total });
        break;
      }

      // Only while the attempt is open: an extension cannot reopen a closed one.
      case "time_extended": {
        if (state !== "in_progress") return fail("not_in_progress");
        extraTimeMs += event.extraMs;
        break;
      }

      // Only a submitted attempt, not yet graded: grading and voiding are the
      // guard above. Scores from a partial grading belong to the old
      // submission, so they go; test results belong to the answers, so they stay.
      case "attempt_reopened": {
        if (state !== "submitted") return fail("not_submitted");
        state = "in_progress";
        extraTimeMs += event.extraMs;
        scores.clear();
        break;
      }

      // Once, while the attempt is open: the photos are the first thing asked for.
      case "identity_captured": {
        if (state !== "in_progress" || identity !== null) return fail("not_in_progress");
        identity = { selfieSha256: event.selfieSha256, idSha256: event.idSha256, capturedAt: entry.timestamp, review: null };
        break;
      }

      // Before grading — the closed guard refuses it after — and only of photos taken.
      // A later review replaces an earlier one: a person may correct themselves, on the record.
      case "identity_reviewed": {
        // (widened: TypeScript narrows the loop variable to its initial null)
        const captured = identity as AttemptProjection["identity"];
        if (captured === null) return fail("not_in_progress");
        identity = { ...captured, review: { outcome: event.outcome, reason: event.reason, decidedBy: event.decidedBy, at: entry.timestamp } };
        break;
      }

      // Before anything the candidate does: consent is asked before the clock starts.
      case "consent_given": {
        if (state !== "in_progress" || consent !== null || responses.length > 0) return fail("not_in_progress");
        consent = { noticeVersion: event.noticeVersion, noticeHash: event.noticeHash };
        break;
      }

      case "attempt_voided": {
        state = "void";
        voidReason = event.reason;
        voidedBy = event.decidedBy ?? null;
        break;
      }

    }
  }

  return project();
}
