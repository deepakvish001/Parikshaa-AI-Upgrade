import type {
  Attempt,
  AttemptState,
  Exam,
  QuestionId,
  Response,
  VivaAssessment,
  VivaExchange,
  VivaId,
  VivaProbe,
} from "./domain.js";
import type { LedgerEntry } from "./ledger.js";

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
  /** Any event after the attempt was graded or voided. */
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
  const startedAt = first.timestamp;

  let state: AttemptState = "in_progress";
  let total: number | null = null;
  let voidReason: string | null = null;
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
    },
  });

  for (const entry of entries.slice(1)) {
    const event = entry.event;
    const fail = (reason: FoldFailure): FoldResult => ({ ok: false, seq: entry.seq, reason });

    if (event.attemptId !== attemptId) return fail("foreign_attempt");
    if (state === "graded" || state === "void") return fail("closed");

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

      case "attempt_voided": {
        state = "void";
        voidReason = event.reason;
        break;
      }
    }
  }

  return project();
}
