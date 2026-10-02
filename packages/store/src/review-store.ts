import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** A paper's review: sent, approved (and so locked), returned, reopened (migration 0050). */

export type ReviewStatus = "in_review" | "approved" | "returned" | "reopened";

export interface ExamReview {
  readonly examId: string;
  readonly status: ReviewStatus;
  readonly submittedBy: string;
  readonly submittedById: string;
  readonly submittedAt: string;
  readonly note: string;
  readonly reviewer: string | null;
  readonly decidedAt: string | null;
  readonly comment: string;
}

interface Row {
  exam_id: string;
  status: ReviewStatus;
  submitted_by: string;
  submitted_by_id: string;
  submitted_at: string | Date;
  note: string;
  reviewer: string | null;
  decided_at: string | Date | null;
  comment: string;
}

const iso = (v: string | Date) => new Date(v).toISOString();
const toReview = (r: Row): ExamReview => ({
  examId: r.exam_id,
  status: r.status,
  submittedBy: r.submitted_by,
  submittedById: r.submitted_by_id,
  submittedAt: iso(r.submitted_at),
  note: r.note,
  reviewer: r.reviewer,
  decidedAt: r.decided_at === null ? null : iso(r.decided_at),
  comment: r.comment,
});

export class ReviewStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async get(orgId: OrgId, examId: string): Promise<ExamReview | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(`SELECT exam_id, status, submitted_by, submitted_by_id, submitted_at, note, reviewer, decided_at, comment FROM exam_reviews WHERE org_id = $1 AND exam_id = $2`, [orgId, examId]);
      return rows[0] === undefined ? null : toReview(rows[0]);
    });
  }

  async forOrganisation(orgId: OrgId): Promise<readonly ExamReview[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query<Row>(`SELECT exam_id, status, submitted_by, submitted_by_id, submitted_at, note, reviewer, decided_at, comment FROM exam_reviews WHERE org_id = $1`, [orgId])).map(toReview),
    );
  }

  async put(orgId: OrgId, review: ExamReview): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      tx.query(
        `INSERT INTO exam_reviews (org_id, exam_id, status, submitted_by, submitted_by_id, submitted_at, note, reviewer, decided_at, comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (org_id, exam_id) DO UPDATE SET status = excluded.status, submitted_by = excluded.submitted_by, submitted_by_id = excluded.submitted_by_id,
           submitted_at = excluded.submitted_at, note = excluded.note, reviewer = excluded.reviewer, decided_at = excluded.decided_at, comment = excluded.comment`,
        [orgId, review.examId, review.status, review.submittedBy, review.submittedById, review.submittedAt, review.note, review.reviewer, review.decidedAt, review.comment],
      ),
    );
  }
}
