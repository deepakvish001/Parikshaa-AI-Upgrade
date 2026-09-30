import type { OrgId } from "@parikshaa/core";
import { lifecycleSql, lifecycleState, withScope, type Scope } from "./ledger-store.js";
import { enqueue, type OutboxDraft } from "./outbox-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Exam windows and invitations (ROADMAP §5). Staff scope only: invitations
 * hold candidates' contact details.
 */

export interface ExamWindow {
  readonly opensAt: string;
  readonly closesAt: string;
  readonly hardClose: boolean;
}

export interface InvitationDraft {
  readonly candidateRef: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly hardClose: boolean;
  readonly source?: Record<string, unknown>;
}

export interface Invitation extends InvitationDraft {
  readonly id: string;
  readonly orgId: OrgId;
  readonly examId: string;
  readonly attemptId: string | null;
  readonly revoked: boolean;
  readonly createdAt: string;
}

/** An invitation with where its candidate has got to, for a list. */
export interface InvitationStatus extends Invitation {
  readonly attemptState: "not_started" | "in_progress" | "submitted" | "graded" | "void";
  /** The latest message about this invitation, by channel. */
  readonly delivery: { readonly email: DeliveryState | null; readonly sms: DeliveryState | null };
}

/** A candidate found by search, with the exam they were invited to. */
export interface CandidateHit {
  readonly invitationId: string;
  readonly examId: string;
  readonly examTitle: string;
  readonly candidateRef: string;
  readonly name: string;
  readonly email: string | null;
  readonly attemptId: string | null;
  readonly attemptState: InvitationStatus["attemptState"];
}

export interface DeliveryState {
  readonly status: "pending" | "sending" | "sent" | "failed" | "skipped";
  readonly purpose: string;
  readonly at: string;
  readonly error: string | null;
}

interface Row {
  org_id: string;
  id: string;
  exam_id: string;
  candidate_ref: string;
  name: string;
  email: string | null;
  phone: string | null;
  opens_at: string | Date;
  closes_at: string | Date;
  hard_close: boolean;
  attempt_id: string | null;
  source: Record<string, unknown> | null;
  created_at: string | Date;
  revoked_at: string | Date | null;
}

const iso = (v: string | Date) => new Date(v).toISOString();

const toInvitation = (row: Row): Invitation => ({
  id: row.id,
  orgId: row.org_id as OrgId,
  examId: row.exam_id,
  candidateRef: row.candidate_ref,
  name: row.name,
  email: row.email,
  phone: row.phone,
  opensAt: iso(row.opens_at),
  closesAt: iso(row.closes_at),
  hardClose: row.hard_close,
  attemptId: row.attempt_id,
  ...(row.source === null ? {} : { source: row.source }),
  revoked: row.revoked_at !== null,
  createdAt: iso(row.created_at),
});

const COLUMNS = `org_id, id, exam_id, candidate_ref, name, email, phone, opens_at, closes_at, hard_close,
                 attempt_id, source, created_at, revoked_at`;

/** Insert outbox rows inside a caller's transaction. */
/**
 * Which message about an invitation the console shows: the latest one that has
 * fallen due, or, before any has, the next to go. Not the latest written — an
 * invitation and its reminders are written together, and a reminder queued for
 * tomorrow says nothing about whether the invitation went out today.
 */
const LATEST_DUE = `send_after > $3::timestamptz, CASE WHEN send_after <= $3::timestamptz THEN send_after END DESC NULLS LAST, send_after`;
/** A reminder skipped because the candidate had already begun was not needed; it is not a failure to show. */
const NEEDED = `NOT (purpose IN ('reminder', 'reminder_day') AND status = 'skipped')`;

export class InvitationStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- windows --------------------------------------------------------------

  async setWindow(scope: Scope, examId: string, window: ExamWindow): Promise<void> {
    await withScope(this.#sql, scope, (tx) =>
      tx.query(
        `INSERT INTO exam_windows (org_id, exam_id, opens_at, closes_at, hard_close) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id, exam_id)
         DO UPDATE SET opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at, hard_close = EXCLUDED.hard_close`,
        [scope.orgId, examId, window.opensAt, window.closesAt, window.hardClose],
      ),
    );
  }

  /**
   * Reschedule an exam, taking its invited candidates with it: everyone whose
   * window was the exam's `from` window, who has not begun and was not
   * withdrawn, moves to `to`. A candidate with a window of their own stays in
   * it. With `retime`, their reminders still to go are cancelled (they were
   * for the old time) and `messages` queues what replaces them, given each
   * candidate's id and the channels their invitation went by. All in one
   * transaction, so no candidate is moved without their messages. Returns
   * how many moved.
   */
  async moveWindow(
    scope: Scope,
    examId: string,
    from: ExamWindow,
    to: ExamWindow,
    options: {
      readonly retime: boolean;
      readonly messages: (invitationId: string, channels: readonly ("email" | "sms")[]) => readonly OutboxDraft[];
    },
  ): Promise<number> {
    return withScope(this.#sql, scope, async (tx) => {
      await tx.query(
        `INSERT INTO exam_windows (org_id, exam_id, opens_at, closes_at, hard_close) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id, exam_id)
         DO UPDATE SET opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at, hard_close = EXCLUDED.hard_close`,
        [scope.orgId, examId, to.opensAt, to.closesAt, to.hardClose],
      );
      const moved = await tx.query<{ id: string }>(
        `UPDATE invitations SET opens_at = $3, closes_at = $4, hard_close = $5
          WHERE org_id = $1 AND exam_id = $2 AND revoked_at IS NULL AND attempt_id IS NULL
            AND opens_at = $6::timestamptz AND closes_at = $7::timestamptz
        RETURNING id`,
        [scope.orgId, examId, to.opensAt, to.closesAt, to.hardClose, from.opensAt, from.closesAt],
      );
      const ids = moved.map((m) => m.id);
      if (!options.retime || ids.length === 0) return ids.length;

      await tx.query(
        `UPDATE outbox SET status = 'skipped', last_error = 'Rescheduled', locked_until = NULL
          WHERE org_id = $1 AND status = 'pending' AND purpose IN ('reminder', 'reminder_day', 'rescheduled')
            AND subject ->> 'invitationId' = ANY ($2::text[])`,
        [scope.orgId, ids],
      );
      const sent = await tx.query<{ id: string; kinds: ("email" | "sms")[] }>(
        `SELECT subject ->> 'invitationId' AS id, array_agg(DISTINCT kind ORDER BY kind) AS kinds FROM outbox
          WHERE org_id = $1 AND purpose = 'invite' AND kind IN ('email', 'sms') AND subject ->> 'invitationId' = ANY ($2::text[])
          GROUP BY 1`,
        [scope.orgId, ids],
      );
      const channels = new Map(sent.map((r) => [r.id, r.kinds]));
      for (const id of ids) await enqueue(tx, scope.orgId, options.messages(id, channels.get(id) ?? []), this.#newId);
      return ids.length;
    });
  }

  async getWindow(scope: Scope, examId: string): Promise<ExamWindow | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ opens_at: string | Date; closes_at: string | Date; hard_close: boolean }>(
        `SELECT opens_at, closes_at, hard_close FROM exam_windows WHERE org_id = $1 AND exam_id = $2`,
        [scope.orgId, examId],
      );
      const row = rows[0];
      return row === undefined ? null : { opensAt: iso(row.opens_at), closesAt: iso(row.closes_at), hardClose: row.hard_close };
    });
  }

  // --- invitations ----------------------------------------------------------

  /**
   * Invite candidates, all or none, and queue what must be sent about them in
   * the same transaction. `messages` is called with each new invitation's id.
   */
  async invite(
    scope: Scope,
    examId: string,
    drafts: readonly InvitationDraft[],
    messages: (invitationId: string, draft: InvitationDraft) => readonly OutboxDraft[],
  ): Promise<readonly Invitation[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const created: Invitation[] = [];
      for (const d of drafts) {
        const rows = await tx.query<Row>(
          `INSERT INTO invitations (org_id, id, exam_id, candidate_ref, name, email, phone, opens_at, closes_at, hard_close, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING ${COLUMNS}`,
          [
            scope.orgId,
            this.#newId(),
            examId,
            d.candidateRef,
            d.name,
            d.email,
            d.phone,
            d.opensAt,
            d.closesAt,
            d.hardClose,
            d.source === undefined ? null : JSON.stringify(d.source),
          ],
        );
        const invitation = toInvitation(rows[0]!);
        created.push(invitation);
        await enqueue(tx, scope.orgId, messages(invitation.id, d), this.#newId);
      }
      return created;
    });
  }

  /** Candidate references already invited to this exam, to report duplicates before importing. */
  async existingRefs(scope: Scope, examId: string): Promise<ReadonlySet<string>> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ candidate_ref: string }>(
        `SELECT candidate_ref FROM invitations WHERE org_id = $1 AND exam_id = $2`,
        [scope.orgId, examId],
      );
      return new Set(rows.map((r) => r.candidate_ref));
    });
  }

  async get(scope: Scope, id: string): Promise<Invitation | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM invitations WHERE org_id = $1 AND id = $2`, [scope.orgId, id]);
      return rows[0] === undefined ? null : toInvitation(rows[0]);
    });
  }

  async byAttempt(scope: Scope, attemptId: string): Promise<Invitation | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM invitations WHERE org_id = $1 AND attempt_id = $2`, [
        scope.orgId,
        attemptId,
      ]);
      return rows[0] === undefined ? null : toInvitation(rows[0]);
    });
  }

  /** Every invitation to an exam, where its attempt stands, and its latest message due by `now`. */
  async list(scope: Scope, examId: string, now: Date = new Date()): Promise<readonly InvitationStatus[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<
        Row & { lifecycle: string | null; email_delivery: DeliveryRow | null; sms_delivery: DeliveryRow | null }
      >(
        `SELECT i.org_id, i.id, i.exam_id, i.candidate_ref, i.name, i.email, i.phone, i.opens_at, i.closes_at, i.hard_close,
                i.attempt_id, i.source, i.created_at, i.revoked_at,
                ${lifecycleSql("i.org_id", "i.attempt_id")} AS lifecycle,
                (SELECT to_jsonb(o) FROM (SELECT status, purpose, coalesce(sent_at, created_at) AS at, last_error AS error
                   FROM outbox WHERE org_id = i.org_id AND kind = 'email' AND subject ->> 'invitationId' = i.id
                    AND ${NEEDED}
                   ORDER BY ${LATEST_DUE} LIMIT 1) o) AS email_delivery,
                (SELECT to_jsonb(o) FROM (SELECT status, purpose, coalesce(sent_at, created_at) AS at, last_error AS error
                   FROM outbox WHERE org_id = i.org_id AND kind = 'sms' AND subject ->> 'invitationId' = i.id
                    AND ${NEEDED}
                   ORDER BY ${LATEST_DUE} LIMIT 1) o) AS sms_delivery
           FROM invitations i
          WHERE i.org_id = $1 AND i.exam_id = $2
          ORDER BY i.created_at, i.candidate_ref`,
        [scope.orgId, examId, now.toISOString()],
      );
      return rows.map((row) => ({
        ...toInvitation(row),
        attemptState: row.attempt_id === null ? "not_started" : lifecycleState(row.lifecycle),
        delivery: { email: toDelivery(row.email_delivery), sms: toDelivery(row.sms_delivery) },
      }));
    });
  }

  /**
   * Candidates across every exam whose reference, name or email contains
   * `text`, most recently invited first: what the console's search finds.
   */
  async search(scope: Scope, text: string, limit = 20): Promise<readonly CandidateHit[]> {
    const needle = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{
        id: string;
        exam_id: string;
        exam_title: string | null;
        candidate_ref: string;
        name: string;
        email: string | null;
        attempt_id: string | null;
        lifecycle: string | null;
      }>(
        `SELECT i.id, i.exam_id, e.definition ->> 'title' AS exam_title, i.candidate_ref, i.name, i.email, i.attempt_id,
                ${lifecycleSql("i.org_id", "i.attempt_id")} AS lifecycle
           FROM invitations i
           LEFT JOIN exams e ON e.org_id = i.org_id AND e.id = i.exam_id
          WHERE i.org_id = $1 AND i.revoked_at IS NULL
            AND (i.candidate_ref ILIKE $2 OR i.name ILIKE $2 OR coalesce(i.email, '') ILIKE $2)
          ORDER BY i.created_at DESC, i.candidate_ref
          LIMIT $3`,
        [scope.orgId, needle, limit],
      );
      return rows.map((row) => ({
        invitationId: row.id,
        examId: row.exam_id,
        examTitle: row.exam_title ?? row.exam_id,
        candidateRef: row.candidate_ref,
        name: row.name,
        email: row.email,
        attemptId: row.attempt_id,
        attemptState: row.attempt_id === null ? "not_started" : lifecycleState(row.lifecycle),
      }));
    });
  }

  /**
   * Claim the right to start this invitation's attempt under `attemptId`.
   * Returns the attempt id that holds it — `attemptId` if this call won, or
   * the one an earlier call recorded.
   */
  async claimAttempt(scope: Scope, id: string, attemptId: string): Promise<{ attemptId: string; claimed: boolean }> {
    return withScope(this.#sql, scope, async (tx) => {
      const claimed = await tx.query<{ attempt_id: string }>(
        `UPDATE invitations SET attempt_id = $3 WHERE org_id = $1 AND id = $2 AND attempt_id IS NULL RETURNING attempt_id`,
        [scope.orgId, id, attemptId],
      );
      if (claimed[0] !== undefined) return { attemptId, claimed: true };
      const existing = await tx.query<{ attempt_id: string }>(
        `SELECT attempt_id FROM invitations WHERE org_id = $1 AND id = $2`,
        [scope.orgId, id],
      );
      return { attemptId: existing[0]!.attempt_id, claimed: false };
    });
  }

  async revoke(scope: Scope, id: string): Promise<boolean> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `UPDATE invitations SET revoked_at = now() WHERE org_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
        [scope.orgId, id],
      );
      return rows.length > 0;
    });
  }

  /** Queue messages outside an invitation's creation — a resend, a webhook. */
  async enqueue(scope: Scope, drafts: readonly OutboxDraft[]): Promise<void> {
    await withScope(this.#sql, scope, (tx) => enqueue(tx, scope.orgId, drafts, this.#newId));
  }
}

interface DeliveryRow {
  status: DeliveryState["status"];
  purpose: string;
  at: string;
  error: string | null;
}

const toDelivery = (row: DeliveryRow | null): DeliveryState | null =>
  row === null ? null : { status: row.status, purpose: row.purpose, at: iso(row.at), error: row.error };
