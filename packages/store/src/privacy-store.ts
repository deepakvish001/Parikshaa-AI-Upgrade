import { withScope, type Scope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";

/** An organisation's privacy settings (ROADMAP §11; migration 0009): what its candidates are told. */
export interface PrivacySettings {
  /** The data fiduciary, as the notice names it. */
  readonly controllerName: string;
  readonly grievanceName: string;
  readonly grievanceEmail: string;
  /** Why the data is collected, in the organisation's words. */
  readonly purpose: string;
  readonly retentionDays: number;
  /** Moves on whenever the wording changes, so a consent records which one was agreed to. */
  readonly noticeVersion: number;
  readonly updatedAt: string;
}

export type PrivacyDraft = Omit<PrivacySettings, "noticeVersion" | "updatedAt">;

interface Row {
  controller_name: string;
  grievance_name: string;
  grievance_email: string;
  purpose: string;
  retention_days: number;
  notice_version: number;
  updated_at: string | Date;
}

const toSettings = (r: Row): PrivacySettings => ({
  controllerName: r.controller_name,
  grievanceName: r.grievance_name,
  grievanceEmail: r.grievance_email,
  purpose: r.purpose,
  retentionDays: Number(r.retention_days),
  noticeVersion: Number(r.notice_version),
  updatedAt: new Date(r.updated_at).toISOString(),
});

export class PrivacyStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  /** Staff only: the table is not visible to a candidate's scope, so the service reads it on their behalf. */
  async get(scope: Scope): Promise<PrivacySettings | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<Row>(
        `SELECT controller_name, grievance_name, grievance_email, purpose, retention_days, notice_version, updated_at
           FROM privacy_settings WHERE org_id = $1`,
        [scope.orgId],
      );
      return rows[0] === undefined ? null : toSettings(rows[0]);
    });
  }

  /**
   * Save the settings. The notice version moves on whenever anything the
   * notice says changes, and only then: saving the same wording twice does not
   * ask every later candidate to agree to "a new notice".
   */
  async put(scope: Scope, draft: PrivacyDraft, at: Date): Promise<PrivacySettings> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<Row>(
        `INSERT INTO privacy_settings (org_id, controller_name, grievance_name, grievance_email, purpose, retention_days, notice_version, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
         ON CONFLICT (org_id) DO UPDATE SET
           controller_name = EXCLUDED.controller_name,
           grievance_name  = EXCLUDED.grievance_name,
           grievance_email = EXCLUDED.grievance_email,
           purpose         = EXCLUDED.purpose,
           retention_days  = EXCLUDED.retention_days,
           notice_version  = privacy_settings.notice_version +
             CASE WHEN (privacy_settings.controller_name, privacy_settings.grievance_name, privacy_settings.grievance_email,
                        privacy_settings.purpose, privacy_settings.retention_days)
                     = (EXCLUDED.controller_name, EXCLUDED.grievance_name, EXCLUDED.grievance_email, EXCLUDED.purpose, EXCLUDED.retention_days)
                  THEN 0 ELSE 1 END,
           updated_at      = EXCLUDED.updated_at
         RETURNING controller_name, grievance_name, grievance_email, purpose, retention_days, notice_version, updated_at`,
        [scope.orgId, draft.controllerName, draft.grievanceName, draft.grievanceEmail, draft.purpose, draft.retentionDays, at.toISOString()],
      );
      return toSettings(rows[0]!);
    });
  }
}
