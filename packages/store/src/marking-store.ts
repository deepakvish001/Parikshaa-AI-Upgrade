import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** Which written answers a person has read after the model marked them (migration 0028). */
export class MarkingStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  /** The answers of an exam already read, as `attemptId:questionId`. */
  async reviewed(orgId: OrgId, examId: string): Promise<ReadonlySet<string>> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<{ attempt_id: string; question_id: string }>(
        `SELECT attempt_id, question_id FROM mark_reviews WHERE org_id = $1 AND exam_id = $2`,
        [orgId, examId],
      );
      return new Set(rows.map((r) => `${r.attempt_id}:${r.question_id}`));
    });
  }

  /** Record that `by` has read this answer; a second read by anyone is kept as the latest. */
  async mark(orgId: OrgId, examId: string, attemptId: string, questionId: string, by: string, at: Date): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      tx.query(
        `INSERT INTO mark_reviews (org_id, attempt_id, question_id, exam_id, reviewed_by, reviewed_at) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, attempt_id, question_id) DO UPDATE SET reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at`,
        [orgId, attemptId, questionId, examId, by, at.toISOString()],
      ),
    );
  }
}
