import { candidateScope, lifecycleSql, staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { AttemptId, OrgId } from "@parikshaa/core";

/**
 * How the test went, in candidates' own words (migration 0024): given once,
 * after submitting, and read by staff without names.
 */

export interface FeedbackSummary {
  readonly responses: number;
  /** Candidates who submitted, whether or not they answered: what `responses` is out of. */
  readonly submitted: number;
  /** Mean rating, one decimal; null with no responses. */
  readonly average: number | null;
  /** How many gave each rating, 1 to 5. */
  readonly counts: readonly [number, number, number, number, number];
  /** What was written, newest first, without whose it was. */
  readonly comments: readonly { readonly rating: number; readonly comment: string; readonly at: string }[];
}

export type GiveOutcome = "saved" | "already_given" | "not_submitted";

export class FeedbackStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  /** A candidate's feedback on their own attempt: only once it is submitted, and only once. */
  async give(orgId: OrgId, attemptId: AttemptId, rating: number, comment: string | null, at: Date): Promise<GiveOutcome> {
    return withScope(this.#sql, candidateScope(orgId, attemptId), async (tx) => {
      const [state] = await tx.query<{ lifecycle: string | null }>(
        `SELECT ${lifecycleSql("a.org_id", "a.id")} AS lifecycle FROM attempts a WHERE a.org_id = $1 AND a.id = $2`,
        [orgId, attemptId],
      );
      if (state === undefined || (state.lifecycle !== "attempt_submitted" && state.lifecycle !== "attempt_graded")) return "not_submitted";
      const inserted = await tx.query<{ attempt_id: string }>(
        `INSERT INTO attempt_feedback (org_id, attempt_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id, attempt_id) DO NOTHING RETURNING attempt_id`,
        [orgId, attemptId, rating, comment, at.toISOString()],
      );
      return inserted.length === 0 ? "already_given" : "saved";
    });
  }

  /** Whether a candidate has already answered, so their page does not ask twice. */
  async given(orgId: OrgId, attemptId: AttemptId): Promise<boolean> {
    return withScope(this.#sql, candidateScope(orgId, attemptId), async (tx) => {
      const rows = await tx.query(`SELECT 1 FROM attempt_feedback WHERE org_id = $1 AND attempt_id = $2`, [orgId, attemptId]);
      return rows.length > 0;
    });
  }

  /** What an exam's candidates said. */
  async summary(orgId: OrgId, examId: string): Promise<FeedbackSummary> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<{ rating: number; comment: string | null; created_at: string | Date }>(
        `SELECT f.rating, f.comment, f.created_at FROM attempt_feedback f
           JOIN attempts a ON a.org_id = f.org_id AND a.id = f.attempt_id
          WHERE f.org_id = $1 AND a.exam_id = $2
          ORDER BY f.created_at DESC`,
        [orgId, examId],
      );
      const [done] = await tx.query<{ n: string }>(
        `SELECT count(*) AS n FROM attempts a WHERE a.org_id = $1 AND a.exam_id = $2
            AND ${lifecycleSql("a.org_id", "a.id")} IN ('attempt_submitted', 'attempt_graded')`,
        [orgId, examId],
      );
      const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
      for (const r of rows) counts[Number(r.rating) - 1]!++;
      const total = rows.reduce((n, r) => n + Number(r.rating), 0);
      return {
        responses: rows.length,
        submitted: Number(done?.n ?? 0),
        average: rows.length === 0 ? null : Math.round((total / rows.length) * 10) / 10,
        counts,
        comments: rows
          .filter((r) => r.comment !== null && r.comment.trim() !== "")
          .map((r) => ({ rating: Number(r.rating), comment: r.comment!, at: new Date(r.created_at).toISOString() })),
      };
    });
  }
}
