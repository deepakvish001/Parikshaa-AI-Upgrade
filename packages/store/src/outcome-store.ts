import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** An exam's course outcomes and their mapping to programme outcomes (migration 0035). */
export interface OutcomeMap {
  readonly mapping: Readonly<Record<string, readonly string[]>>;
  readonly matrix: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly threshold: number;
}

export const NO_OUTCOMES: OutcomeMap = { mapping: {}, matrix: {}, threshold: 60 };

const parse = <T>(v: T | string): T => (typeof v === "string" ? (JSON.parse(v) as T) : v);

export class OutcomeStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async get(orgId: OrgId, examId: string): Promise<OutcomeMap> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<{ mapping: OutcomeMap["mapping"] | string; matrix: OutcomeMap["matrix"] | string; threshold: number }>(
        `SELECT mapping, matrix, threshold FROM exam_outcomes WHERE org_id = $1 AND exam_id = $2`,
        [orgId, examId],
      );
      return rows[0] === undefined ? NO_OUTCOMES : { mapping: parse(rows[0].mapping), matrix: parse(rows[0].matrix), threshold: rows[0].threshold };
    });
  }

  async set(orgId: OrgId, examId: string, map: OutcomeMap, at: Date): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      tx.query(
        `INSERT INTO exam_outcomes (org_id, exam_id, mapping, matrix, threshold, updated_at) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
         ON CONFLICT (org_id, exam_id) DO UPDATE SET mapping = EXCLUDED.mapping, matrix = EXCLUDED.matrix, threshold = EXCLUDED.threshold, updated_at = EXCLUDED.updated_at`,
        [orgId, examId, JSON.stringify(map.mapping), JSON.stringify(map.matrix), map.threshold, at.toISOString()],
      ),
    );
  }
}
