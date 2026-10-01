import { examId as toExamId, type OrgId } from "@parikshaa/core";
import type { ExamReview, LedgerStore, ReviewStore } from "@parikshaa/store";
import { staffScope } from "@parikshaa/store";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * A paper's review (docs/PREP-TRACKER.md, CL60). The setter sends the paper
 * for review; someone else with the right to write exams — the head of
 * department — approves it, or returns it with a comment saying what to
 * change. While it is with the reviewer, and once approved, it cannot be
 * changed: what was approved is what is sat. An owner can reopen it, with a
 * reason, which is audited like every step.
 */

export class ExamReviewService {
  readonly #reviews: ReviewStore;
  readonly #ledger: LedgerStore;
  readonly #exams: ExamService;
  readonly #now: () => number;

  constructor(options: { readonly reviews: ReviewStore; readonly ledger: LedgerStore; readonly exams: ExamService; readonly now?: () => number }) {
    this.#reviews = options.reviews;
    this.#ledger = options.ledger;
    this.#exams = options.exams;
    this.#now = options.now ?? (() => Date.now());
  }

  /** Why an exam may not be saved now, or null when it may. */
  async locked(orgId: OrgId, examId: string): Promise<string | null> {
    const review = await this.#reviews.get(orgId, examId);
    if (review?.status === "in_review") return "This paper is with its reviewer: it cannot change until they approve or return it";
    if (review?.status === "approved") return `This paper was approved by ${review.reviewer ?? "its reviewer"} and is locked: an owner can reopen it`;
    return null;
  }

  async #exam(actor: Actor, examId: string) {
    if ((await this.#ledger.loadExam(staffScope(actor.orgId), toExamId(examId))) === null) throw new AttemptError("not_found", `No such exam: ${examId}`);
  }

  async get(actor: Actor, examId: string): Promise<ExamReview | null> {
    if (!can(actor, "exam:read")) throw new Forbidden("exam:read");
    return this.#reviews.get(actor.orgId, examId);
  }

  /** Every paper's review, for the exam list. */
  async all(actor: Actor): Promise<readonly ExamReview[]> {
    if (!can(actor, "exam:read")) throw new Forbidden("exam:read");
    return this.#reviews.forOrganisation(actor.orgId);
  }

  async submit(actor: Actor, examId: string, note: string): Promise<ExamReview> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    await this.#exam(actor, examId);
    const current = await this.#reviews.get(actor.orgId, examId);
    if (current?.status === "in_review") throw new AttemptError("invalid_state", "This paper is already with its reviewer");
    if (current?.status === "approved") throw new AttemptError("invalid_state", "This paper is already approved");
    const review: ExamReview = {
      examId,
      status: "in_review",
      submittedBy: actor.name,
      submittedById: actor.id,
      submittedAt: new Date(this.#now()).toISOString(),
      note: note.trim().slice(0, 2000),
      reviewer: null,
      decidedAt: null,
      comment: "",
    };
    await this.#reviews.put(actor.orgId, review);
    await this.#exams.recordAudit(actor, "exam.review_requested", examId, {});
    return review;
  }

  /** Approve, or return with a comment. Never by the one who sent it. */
  async decide(actor: Actor, examId: string, decision: "approve" | "return", comment: string): Promise<ExamReview> {
    if (!can(actor, "exam:write")) throw new Forbidden("exam:write");
    const current = await this.#reviews.get(actor.orgId, examId);
    if (current === null || current.status !== "in_review") throw new AttemptError("invalid_state", "This paper is not waiting for review");
    if (current.submittedById === actor.id) throw new AttemptError("invalid_state", "Someone other than the paper's setter reviews it");
    const said = comment.trim().slice(0, 2000);
    if (decision === "return" && said === "") throw new AttemptError("invalid_state", "Say what should change");
    const review: ExamReview = { ...current, status: decision === "approve" ? "approved" : "returned", reviewer: actor.name, decidedAt: new Date(this.#now()).toISOString(), comment: said };
    await this.#reviews.put(actor.orgId, review);
    await this.#exams.recordAudit(actor, decision === "approve" ? "exam.approved" : "exam.returned", examId, said === "" ? {} : { comment: said });
    return review;
  }

  /** An owner unlocks an approved paper, or takes one back from review, saying why. */
  async reopen(actor: Actor, examId: string, reason: string): Promise<ExamReview> {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
    const current = await this.#reviews.get(actor.orgId, examId);
    if (current === null || (current.status !== "approved" && current.status !== "in_review")) throw new AttemptError("invalid_state", "This paper is not locked");
    const why = reason.trim().slice(0, 2000);
    if (why.length < 5) throw new AttemptError("invalid_state", "Say why the paper is reopened");
    const review: ExamReview = { ...current, status: "reopened", comment: why, reviewer: actor.name, decidedAt: new Date(this.#now()).toISOString() };
    await this.#reviews.put(actor.orgId, review);
    await this.#exams.recordAudit(actor, "exam.reopened_for_change", examId, { reason: why });
    return review;
  }
}
