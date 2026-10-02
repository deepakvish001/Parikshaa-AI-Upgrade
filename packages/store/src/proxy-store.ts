import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** Where attempts were opened from, and the model's identity comparisons (migration 0040). */

export interface AttemptOrigin {
  readonly attemptId: string;
  readonly candidateRef: string;
  readonly network: string;
  readonly device: string;
  readonly firstAt: string;
  readonly lastAt: string;
}

export interface IdentityCheck<R = unknown> {
  readonly attemptId: string;
  readonly result: R;
  readonly flagged: boolean;
  readonly checkedBy: string;
  readonly checkedAt: string;
}

const iso = (v: string | Date) => new Date(v).toISOString();

export class ProxyStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async recordOrigin(orgId: OrgId, o: { readonly attemptId: string; readonly examId: string; readonly candidateRef: string; readonly network: string; readonly device: string; readonly at: Date }): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      tx.query(
        `INSERT INTO attempt_origins (org_id, attempt_id, exam_id, candidate_ref, network, device, first_at, last_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         ON CONFLICT (org_id, attempt_id, network, device) DO UPDATE SET last_at = excluded.last_at`,
        [orgId, o.attemptId, o.examId, o.candidateRef, o.network, o.device, o.at.toISOString()],
      ),
    );
  }

  async origins(orgId: OrgId, examId: string): Promise<readonly AttemptOrigin[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (
        await tx.query<{ attempt_id: string; candidate_ref: string; network: string; device: string; first_at: string | Date; last_at: string | Date }>(
          `SELECT attempt_id, candidate_ref, network, device, first_at, last_at FROM attempt_origins WHERE org_id = $1 AND exam_id = $2 ORDER BY first_at`,
          [orgId, examId],
        )
      ).map((r) => ({ attemptId: r.attempt_id, candidateRef: r.candidate_ref, network: r.network, device: r.device, firstAt: iso(r.first_at), lastAt: iso(r.last_at) })),
    );
  }

  /** Identity photos (selfie or ID) stored, byte for byte, for more than one attempt: attempt ids by photo hash. */
  async reusedPhotos(orgId: OrgId): Promise<readonly { readonly sha256: string; readonly attempts: readonly string[] }[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (
        await tx.query<{ sha256: string; attempts: string[] }>(
          `SELECT sha256, array_agg(DISTINCT attempt_id ORDER BY attempt_id) AS attempts FROM proctor_media
            WHERE org_id = $1 AND kind IN ('selfie', 'id') GROUP BY sha256 HAVING count(DISTINCT attempt_id) > 1`,
          [orgId],
        )
      ).map((r) => ({ sha256: r.sha256, attempts: r.attempts })),
    );
  }

  async saveCheck(orgId: OrgId, examId: string, check: IdentityCheck): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      tx.query(
        `INSERT INTO identity_checks (org_id, attempt_id, exam_id, result, flagged, checked_by, checked_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, attempt_id) DO UPDATE SET result = excluded.result, flagged = excluded.flagged, checked_by = excluded.checked_by, checked_at = excluded.checked_at`,
        [orgId, check.attemptId, examId, JSON.stringify(check.result), check.flagged, check.checkedBy, check.checkedAt],
      ),
    );
  }

  async checks<R>(orgId: OrgId, examId: string): Promise<readonly IdentityCheck<R>[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (
        await tx.query<{ attempt_id: string; result: R | string; flagged: boolean; checked_by: string; checked_at: string | Date }>(
          `SELECT attempt_id, result, flagged, checked_by, checked_at FROM identity_checks WHERE org_id = $1 AND exam_id = $2`,
          [orgId, examId],
        )
      ).map((r) => ({ attemptId: r.attempt_id, result: typeof r.result === "string" ? (JSON.parse(r.result) as R) : r.result, flagged: r.flagged, checkedBy: r.checked_by, checkedAt: iso(r.checked_at) })),
    );
  }
}
