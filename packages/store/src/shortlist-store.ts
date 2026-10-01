import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** Shortlists for hiring managers, and their decisions (migration 0038). */

export type ShortlistDecision = "shortlist" | "hold" | "reject";

export interface Shortlist {
  readonly id: string;
  readonly examId: string;
  readonly title: string;
  readonly refs: readonly string[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly revoked: boolean;
}

export interface Decision {
  readonly ref: string;
  readonly decision: ShortlistDecision;
  readonly comment: string;
  readonly by: string;
  readonly at: string;
}

interface Row {
  id: string;
  exam_id: string;
  title: string;
  refs: string[];
  created_by: string;
  created_at: string | Date;
  expires_at: string | Date;
  revoked: boolean;
}

const iso = (v: string | Date) => new Date(v).toISOString();
const toShortlist = (r: Row): Shortlist => ({ id: r.id, examId: r.exam_id, title: r.title, refs: r.refs, createdBy: r.created_by, createdAt: iso(r.created_at), expiresAt: iso(r.expires_at), revoked: r.revoked });

export class ShortlistStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async create(orgId: OrgId, s: Omit<Shortlist, "revoked">): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      tx.query(`INSERT INTO shortlists (org_id, id, exam_id, title, refs, created_by, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        orgId,
        s.id,
        s.examId,
        s.title,
        [...s.refs],
        s.createdBy,
        s.createdAt,
        s.expiresAt,
      ]),
    );
  }

  async get(orgId: OrgId, id: string): Promise<Shortlist | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(`SELECT id, exam_id, title, refs, created_by, created_at, expires_at, revoked FROM shortlists WHERE org_id = $1 AND id = $2`, [orgId, id]);
      return rows[0] === undefined ? null : toShortlist(rows[0]);
    });
  }

  async forExam(orgId: OrgId, examId: string): Promise<readonly Shortlist[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query<Row>(`SELECT id, exam_id, title, refs, created_by, created_at, expires_at, revoked FROM shortlists WHERE org_id = $1 AND exam_id = $2 ORDER BY created_at DESC`, [orgId, examId])).map(toShortlist),
    );
  }

  async revoke(orgId: OrgId, id: string): Promise<boolean> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => (await tx.query(`UPDATE shortlists SET revoked = true WHERE org_id = $1 AND id = $2 RETURNING id`, [orgId, id])).length > 0);
  }

  async decisions(orgId: OrgId, id: string): Promise<readonly Decision[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (
        await tx.query<{ candidate_ref: string; decision: ShortlistDecision; comment: string; decided_by: string; decided_at: string | Date }>(
          `SELECT candidate_ref, decision, comment, decided_by, decided_at FROM shortlist_decisions WHERE org_id = $1 AND shortlist_id = $2`,
          [orgId, id],
        )
      ).map((r) => ({ ref: r.candidate_ref, decision: r.decision, comment: r.comment, by: r.decided_by, at: iso(r.decided_at) })),
    );
  }

  async decide(orgId: OrgId, id: string, d: Decision): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      tx.query(
        `INSERT INTO shortlist_decisions (org_id, shortlist_id, candidate_ref, decision, comment, decided_by, decided_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, shortlist_id, candidate_ref) DO UPDATE SET decision = EXCLUDED.decision, comment = EXCLUDED.comment, decided_by = EXCLUDED.decided_by, decided_at = EXCLUDED.decided_at`,
        [orgId, id, d.ref, d.decision, d.comment, d.by, d.at],
      ),
    );
  }
}
