import type { SqlExecutor } from "./sql.js";

/**
 * The worker's side of the outbox (see migration 0006).
 *
 * Not tenant-scoped: one worker serves every organisation, which is why the
 * table holds only ids and purposes. Whatever is sent is built afterwards,
 * under the organisation's own scope.
 */

export interface OutboxItem {
  readonly id: string;
  readonly orgId: string;
  readonly kind: "email" | "sms" | "webhook" | "greenhouse" | "staff_email" | "learner_email" | "ats";
  readonly subject: Record<string, unknown>;
  readonly purpose: string;
  readonly attempts: number;
}

/** Something to send later, written with the change that caused it. */
export interface OutboxDraft {
  readonly kind: "email" | "sms" | "webhook" | "greenhouse" | "staff_email" | "learner_email" | "ats";
  readonly subject: Record<string, unknown>;
  readonly purpose: string;
  readonly sendAfter?: Date;
  /** A fixed id makes writing the item idempotent: a second write of it is a no-op. */
  readonly id?: string;
}

/** Write outbox items inside the caller's transaction, so they exist exactly when the change that caused them does. */
export async function enqueue(tx: SqlExecutor, orgId: string, drafts: readonly OutboxDraft[], newId: () => string) {
  for (const d of drafts) {
    await tx.query(
      `INSERT INTO outbox (id, org_id, kind, subject, purpose, send_after) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [d.id ?? newId(), orgId, d.kind, JSON.stringify(d.subject), d.purpose, (d.sendAfter ?? new Date()).toISOString()],
    );
  }
}

/** How long a claimed item is held before another worker may retry it. */
const LEASE_SECONDS = 120;

export class OutboxStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  /**
   * Claim up to `limit` due items. An item another worker claimed and did not
   * finish — it crashed — becomes claimable again when its lease runs out.
   */
  async claimDue(now: Date, limit: number): Promise<readonly OutboxItem[]> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query<{
        id: string;
        org_id: string;
        kind: OutboxItem["kind"];
        subject: Record<string, unknown>;
        purpose: string;
        attempts: number;
      }>(
        `UPDATE outbox SET status = 'sending', locked_until = $1::timestamptz + make_interval(secs => $3), attempts = attempts + 1
          WHERE id IN (
            SELECT id FROM outbox
             WHERE send_after <= $1
               AND (status = 'pending' OR (status = 'sending' AND locked_until < $1))
             ORDER BY send_after
             LIMIT $2
             FOR UPDATE SKIP LOCKED)
        RETURNING id, org_id, kind, subject, purpose, attempts`,
        [now.toISOString(), limit, LEASE_SECONDS],
      );
      return rows.map((r) => ({
        id: r.id,
        orgId: r.org_id,
        kind: r.kind,
        subject: r.subject,
        purpose: r.purpose,
        attempts: Number(r.attempts),
      }));
    });
  }

  async sent(id: string, at: Date): Promise<void> {
    await this.#sql.query(`UPDATE outbox SET status = 'sent', sent_at = $2, last_error = NULL, locked_until = NULL WHERE id = $1`, [
      id,
      at.toISOString(),
    ]);
  }

  /** Nothing to send after all — the candidate already started, the invitation was revoked. */
  async skipped(id: string, reason: string): Promise<void> {
    await this.#sql.query(`UPDATE outbox SET status = 'skipped', last_error = $2, locked_until = NULL WHERE id = $1`, [id, reason]);
  }

  /** Retry at `retryAt`, or give up if it is null. */
  async failed(id: string, error: string, retryAt: Date | null): Promise<void> {
    await this.#sql.query(
      `UPDATE outbox SET status = $2, last_error = $3, send_after = coalesce($4, send_after), locked_until = NULL WHERE id = $1`,
      [id, retryAt === null ? "failed" : "pending", error.slice(0, 500), retryAt?.toISOString() ?? null],
    );
  }

  /** An organisation's recent items, optionally about one subject, for a delivery log. */
  async recent(orgId: string, filter: { readonly key?: string; readonly value?: string } = {}, limit = 100) {
    const rows = await this.#sql.query<{
      id: string;
      kind: string;
      purpose: string;
      status: string;
      attempts: number;
      last_error: string | null;
      created_at: string | Date;
      sent_at: string | Date | null;
      subject: Record<string, unknown>;
    }>(
      `SELECT id, kind, purpose, status, attempts, last_error, created_at, sent_at, subject FROM outbox
        WHERE org_id = $1 AND ($2::text IS NULL OR subject ->> $2 = $3)
        ORDER BY created_at DESC LIMIT $4`,
      [orgId, filter.key ?? null, filter.value ?? null, limit],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      purpose: r.purpose,
      status: r.status,
      attempts: Number(r.attempts),
      error: r.last_error,
      createdAt: new Date(r.created_at).toISOString(),
      sentAt: r.sent_at === null ? null : new Date(r.sent_at).toISOString(),
      subject: r.subject,
    }));
  }
}
