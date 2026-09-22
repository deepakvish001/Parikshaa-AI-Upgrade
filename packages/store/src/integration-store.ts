import { withScope, type Scope } from "./ledger-store.js";
import { enqueue, type OutboxDraft } from "./outbox-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Webhooks and the Greenhouse connector (ROADMAP §7). Staff scope only.
 *
 * Nothing secret is kept: signing secrets and keys are derived from the
 * server's own secret and the `version` here (see migration 0007).
 */

export interface Webhook {
  readonly id: string;
  readonly url: string;
  /** Empty means every event. */
  readonly events: readonly string[];
  readonly version: number;
  readonly description: string;
  readonly createdAt: string;
  readonly disabled: boolean;
}

export interface GreenhouseSettings {
  readonly keyVersion: number;
  readonly enabled: boolean;
}

export interface GreenhouseInterview {
  readonly invitationId: string;
  readonly applicationId: string;
  readonly profileUrl: string | null;
  readonly completeUrl: string;
  readonly sentBy: string | null;
}

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  version: number;
  description: string;
  created_at: string | Date;
  disabled_at: string | Date | null;
}

const toWebhook = (r: WebhookRow): Webhook => ({
  id: r.id,
  url: r.url,
  events: r.events,
  version: Number(r.version),
  description: r.description,
  createdAt: new Date(r.created_at).toISOString(),
  disabled: r.disabled_at !== null,
});

const WEBHOOK_COLUMNS = "id, url, events, version, description, created_at, disabled_at";

export class IntegrationStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- webhooks -------------------------------------------------------------

  async addWebhook(scope: Scope, hook: { readonly url: string; readonly events: readonly string[]; readonly description: string }): Promise<Webhook> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<WebhookRow>(
        `INSERT INTO webhooks (org_id, id, url, events, description) VALUES ($1, $2, $3, $4, $5) RETURNING ${WEBHOOK_COLUMNS}`,
        [scope.orgId, `wh_${this.#newId()}`, hook.url, [...hook.events], hook.description],
      );
      return toWebhook(rows[0]!);
    });
  }

  async webhooks(scope: Scope): Promise<readonly Webhook[]> {
    return withScope(this.#sql, scope, async (tx) =>
      (await tx.query<WebhookRow>(`SELECT ${WEBHOOK_COLUMNS} FROM webhooks WHERE org_id = $1 ORDER BY created_at`, [scope.orgId])).map(toWebhook),
    );
  }

  async webhook(scope: Scope, id: string): Promise<Webhook | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<WebhookRow>(`SELECT ${WEBHOOK_COLUMNS} FROM webhooks WHERE org_id = $1 AND id = $2`, [scope.orgId, id]);
      return rows[0] === undefined ? null : toWebhook(rows[0]);
    });
  }

  async disableWebhook(scope: Scope, id: string): Promise<boolean> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `UPDATE webhooks SET disabled_at = coalesce(disabled_at, now()) WHERE org_id = $1 AND id = $2 RETURNING id`,
        [scope.orgId, id],
      );
      return rows.length > 0;
    });
  }

  /** Give a webhook a new signing secret; the old one stops verifying at once. */
  async rotateWebhook(scope: Scope, id: string): Promise<Webhook | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<WebhookRow>(
        `UPDATE webhooks SET version = version + 1 WHERE org_id = $1 AND id = $2 AND disabled_at IS NULL RETURNING ${WEBHOOK_COLUMNS}`,
        [scope.orgId, id],
      );
      return rows[0] === undefined ? null : toWebhook(rows[0]);
    });
  }

  /** The active webhooks that want `event`. */
  async subscribers(scope: Scope, event: string): Promise<readonly Webhook[]> {
    return withScope(this.#sql, scope, async (tx) =>
      (
        await tx.query<WebhookRow>(
          `SELECT ${WEBHOOK_COLUMNS} FROM webhooks
            WHERE org_id = $1 AND disabled_at IS NULL AND (cardinality(events) = 0 OR $2 = ANY (events))
            ORDER BY created_at`,
          [scope.orgId, event],
        )
      ).map(toWebhook),
    );
  }

  async enqueue(scope: Scope, drafts: readonly OutboxDraft[]): Promise<void> {
    await withScope(this.#sql, scope, (tx) => enqueue(tx, scope.orgId, drafts, this.#newId));
  }

  // --- Greenhouse -----------------------------------------------------------

  async greenhouse(scope: Scope): Promise<GreenhouseSettings | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ key_version: number; enabled: boolean }>(
        `SELECT key_version, enabled FROM greenhouse_settings WHERE org_id = $1`,
        [scope.orgId],
      );
      return rows[0] === undefined ? null : { keyVersion: Number(rows[0].key_version), enabled: rows[0].enabled };
    });
  }

  /** Turn the connector on, or issue a new key if it is on: the old key stops working. */
  async issueGreenhouseKey(scope: Scope): Promise<GreenhouseSettings> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ key_version: number; enabled: boolean }>(
        `INSERT INTO greenhouse_settings (org_id) VALUES ($1)
         ON CONFLICT (org_id) DO UPDATE SET key_version = greenhouse_settings.key_version + 1, enabled = true
         RETURNING key_version, enabled`,
        [scope.orgId],
      );
      return { keyVersion: Number(rows[0]!.key_version), enabled: rows[0]!.enabled };
    });
  }

  async disableGreenhouse(scope: Scope): Promise<void> {
    await withScope(this.#sql, scope, (tx) => tx.query(`UPDATE greenhouse_settings SET enabled = false WHERE org_id = $1`, [scope.orgId]));
  }

  async recordInterview(scope: Scope, interview: GreenhouseInterview): Promise<void> {
    await withScope(this.#sql, scope, (tx) =>
      tx.query(
        `INSERT INTO greenhouse_interviews (org_id, invitation_id, application_id, profile_url, complete_url, sent_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (org_id, invitation_id) DO UPDATE SET complete_url = EXCLUDED.complete_url`,
        [scope.orgId, interview.invitationId, interview.applicationId, interview.profileUrl, interview.completeUrl, interview.sentBy],
      ),
    );
  }

  async interview(scope: Scope, invitationId: string): Promise<GreenhouseInterview | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{
        invitation_id: string;
        application_id: string;
        profile_url: string | null;
        complete_url: string;
        sent_by: string | null;
      }>(
        `SELECT invitation_id, application_id, profile_url, complete_url, sent_by FROM greenhouse_interviews WHERE org_id = $1 AND invitation_id = $2`,
        [scope.orgId, invitationId],
      );
      const r = rows[0];
      return r === undefined
        ? null
        : { invitationId: r.invitation_id, applicationId: r.application_id, profileUrl: r.profile_url, completeUrl: r.complete_url, sentBy: r.sent_by };
    });
  }
}
