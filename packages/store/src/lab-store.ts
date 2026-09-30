import { staffScope, withScope, type Scope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/**
 * Lab mode (migration 0026): the networks an exam may be taken from, and
 * whether its candidates wait for an invigilator to start the sitting.
 */

export interface LabSettings {
  /** IP addresses and CIDR ranges; empty means anywhere. */
  readonly networks: readonly string[];
  readonly startTogether: boolean;
  /** When an invigilator started the sitting; null until then. */
  readonly startedAt: string | null;
}

export const NO_LAB: LabSettings = { networks: [], startTogether: false, startedAt: null };

const iso = (value: string | Date) => new Date(value).toISOString();

interface Row {
  networks: string[];
  start_together: boolean;
  started_at: string | Date | null;
}

const toSettings = (row: Row | undefined): LabSettings =>
  row === undefined
    ? NO_LAB
    : { networks: row.networks, startTogether: row.start_together, startedAt: row.started_at === null ? null : iso(row.started_at) };

export class LabStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  /** An exam's lab settings, read under any scope of its organisation: a candidate's requests read them too. */
  async get(scope: Scope, examId: string): Promise<LabSettings> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<Row>(`SELECT networks, start_together, started_at FROM exam_lab WHERE org_id = $1 AND exam_id = $2`, [
        scope.orgId,
        examId,
      ]);
      return toSettings(rows[0]);
    });
  }

  /**
   * Set the networks and whether candidates wait for the start. Turning
   * waiting on again after a start holds the next candidates until the next
   * start; a candidate already begun is not affected either way.
   */
  async set(orgId: OrgId, examId: string, settings: { readonly networks: readonly string[]; readonly startTogether: boolean }, at: Date): Promise<LabSettings> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(
        `INSERT INTO exam_lab (org_id, exam_id, networks, start_together, updated_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id, exam_id) DO UPDATE SET networks = EXCLUDED.networks, start_together = EXCLUDED.start_together,
           started_at = CASE WHEN EXCLUDED.start_together AND NOT exam_lab.start_together THEN NULL ELSE exam_lab.started_at END,
           updated_at = EXCLUDED.updated_at
         RETURNING networks, start_together, started_at`,
        [orgId, examId, [...settings.networks], settings.startTogether, at.toISOString()],
      );
      return toSettings(rows[0]);
    });
  }

  /** Start a sitting whose candidates are waiting. Returns false if it was not set to wait, or had started already. */
  async start(orgId: OrgId, examId: string, at: Date): Promise<boolean> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query(
        `UPDATE exam_lab SET started_at = $3, updated_at = $3
          WHERE org_id = $1 AND exam_id = $2 AND start_together AND started_at IS NULL RETURNING exam_id`,
        [orgId, examId, at.toISOString()],
      );
      return rows.length > 0;
    });
  }
}
