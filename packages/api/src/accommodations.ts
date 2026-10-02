import type { OrgId } from "@parikshaa/core";
import type { Accommodation, AccommodationStore } from "@parikshaa/store";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Arrangements for a candidate with a disability (docs/PREP-TRACKER.md,
 * V2-12: CL62). Staff who may give extra time set them per candidate on an
 * exam: compensatory time as a share of the paper's (the common rule is 20
 * minutes an hour, a third), a scribe, larger text. The time goes into the
 * attempt's ledger as it starts — `time_extended`, with who set it — so the
 * deadline the candidate was held to can be checked like any other. Larger
 * text opens the test at the largest size; a scribe is for the invigilator
 * to arrange, and the candidate's instructions say it is. The note, which may
 * name a condition, is sealed and never shown to the candidate.
 */

export interface AccommodationRequest {
  readonly extraPercent: number;
  readonly scribe: boolean;
  readonly largeText: boolean;
  readonly note: string;
}

/** What the candidate's own page is told: never the note. */
export interface CandidateArrangements {
  readonly extraMinutes: number;
  readonly scribe: boolean;
  readonly largeText: boolean;
}

/** The extra time for a paper of `durationMs`, in whole minutes. */
export const extraMinutes = (durationMs: number, percent: number) => Math.round((durationMs * percent) / 100 / 60_000);

export class AccommodationService {
  readonly #store: AccommodationStore;
  readonly #exams: ExamService;
  readonly #now: () => number;

  constructor(options: { readonly store: AccommodationStore; readonly exams: ExamService; readonly now?: () => number }) {
    this.#store = options.store;
    this.#exams = options.exams;
    this.#now = options.now ?? (() => Date.now());
  }

  #require(actor: Actor) {
    if (!can(actor, "attempt:extend")) throw new Forbidden("attempt:extend");
  }

  async list(actor: Actor, examId: string): Promise<readonly Accommodation[]> {
    this.#require(actor);
    return this.#store.list(actor.orgId, examId);
  }

  async set(actor: Actor, examId: string, ref: string, request: AccommodationRequest): Promise<Accommodation> {
    this.#require(actor);
    if (actor.kind !== "user") throw new Forbidden("attempt:extend");
    const candidate = ref.trim();
    if (candidate === "") throw new AttemptError("invalid_state", "Name the candidate by their roll number or reference");
    if (!Number.isInteger(request.extraPercent) || request.extraPercent < 0 || request.extraPercent > 100) throw new AttemptError("invalid_state", "Extra time is 0 to 100 per cent of the paper's");
    if (request.extraPercent === 0 && !request.scribe && !request.largeText) throw new AttemptError("invalid_state", "Choose at least one arrangement, or remove it");
    const accommodation: Accommodation = {
      candidateRef: candidate,
      extraPercent: request.extraPercent,
      scribe: request.scribe,
      largeText: request.largeText,
      note: request.note.trim().slice(0, 4000),
      setBy: { userId: actor.id, name: actor.name },
      setAt: new Date(this.#now()).toISOString(),
    };
    await this.#store.put(actor.orgId, examId, accommodation);
    // Never the note: the audit log outlives an erasure.
    await this.#exams.recordAudit(actor, "candidate.accommodated", examId, { candidate, extraPercent: request.extraPercent, scribe: request.scribe, largeText: request.largeText });
    return accommodation;
  }

  async remove(actor: Actor, examId: string, ref: string): Promise<void> {
    this.#require(actor);
    if (!(await this.#store.remove(actor.orgId, examId, ref))) throw new AttemptError("not_found", "No arrangements for that candidate");
    await this.#exams.recordAudit(actor, "candidate.accommodation_removed", examId, { candidate: ref });
  }

  /** The extra time to record as the attempt starts, if any. */
  async atStart(orgId: OrgId, examId: string, ref: string, durationMs: number): Promise<{ readonly extraMs: number; readonly reason: string; readonly decidedBy: { readonly userId: string; readonly name: string } } | null> {
    const a = await this.#store.get(orgId, examId, ref);
    if (a === null || a.extraPercent === 0) return null;
    const minutes = extraMinutes(durationMs, a.extraPercent);
    if (minutes === 0) return null;
    return { extraMs: minutes * 60_000, reason: `Compensatory time for a candidate with a disability: ${a.extraPercent}% of the paper's time`, decidedBy: a.setBy };
  }

  /** What the candidate's instructions say. */
  async forCandidate(orgId: OrgId, examId: string, ref: string, durationMs: number): Promise<CandidateArrangements | null> {
    const a = await this.#store.get(orgId, examId, ref);
    return a === null ? null : { extraMinutes: extraMinutes(durationMs, a.extraPercent), scribe: a.scribe, largeText: a.largeText };
  }
}
