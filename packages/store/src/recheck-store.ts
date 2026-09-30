import { candidateScope, staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { AttemptId, OrgId } from "@parikshaa/core";

/**
 * Results released to candidates, and their requests for a recheck
 * (migration 0027). A changed mark is written to the ledger by the caller;
 * this keeps what was asked and what was answered.
 */

export interface Release {
  readonly outcome: boolean;
  readonly releasedAt: string;
}

export interface Recheck {
  readonly id: string;
  readonly attemptId: string;
  readonly examId: string;
  readonly questionId: string;
  readonly reason: string;
  readonly status: "open" | "changed" | "unchanged";
  readonly scoreBefore: number | null;
  readonly scoreAfter: number | null;
  readonly reply: string | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly createdAt: string;
}

interface Row {
  id: string;
  attempt_id: string;
  exam_id: string;
  question_id: string;
  reason: string;
  status: Recheck["status"];
  score_before: string | number | null;
  score_after: string | number | null;
  reply: string | null;
  decided_by: string | null;
  decided_at: string | Date | null;
  created_at: string | Date;
}

const iso = (value: string | Date) => new Date(value).toISOString();
const num = (value: string | number | null) => (value === null ? null : Number(value));
const COLUMNS = "id, attempt_id, exam_id, question_id, reason, status, score_before, score_after, reply, decided_by, decided_at, created_at";

const toRecheck = (row: Row): Recheck => ({
  id: row.id,
  attemptId: row.attempt_id,
  examId: row.exam_id,
  questionId: row.question_id,
  reason: row.reason,
  status: row.status,
  scoreBefore: num(row.score_before),
  scoreAfter: num(row.score_after),
  reply: row.reply,
  decidedBy: row.decided_by,
  decidedAt: row.decided_at === null ? null : iso(row.decided_at),
  createdAt: iso(row.created_at),
});

export type AskOutcome = { readonly ok: true; readonly recheck: Recheck } | { readonly ok: false; readonly reason: "already_asked" | "too_many" };

export class RecheckStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, newId: () => string = () => crypto.randomUUID()) {
    this.#sql = sql;
    this.#newId = newId;
  }

  /** Let an exam's candidates see their results; a second release updates whether the outcome is shown. */
  async release(orgId: OrgId, examId: string, outcome: boolean, at: Date): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      tx.query(
        `INSERT INTO result_releases (org_id, exam_id, outcome, released_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (org_id, exam_id) DO UPDATE SET outcome = EXCLUDED.outcome`,
        [orgId, examId, outcome, at.toISOString()],
      ),
    );
  }

  /** Whether an exam's results are released, read under any scope of its organisation. */
  async released(orgId: OrgId, examId: string, attemptId?: AttemptId): Promise<Release | null> {
    const scope = attemptId === undefined ? staffScope(orgId) : candidateScope(orgId, attemptId);
    return withScope(this.#sql, scope, async (tx) => {
      const [row] = await tx.query<{ outcome: boolean; released_at: string | Date }>(
        `SELECT outcome, released_at FROM result_releases WHERE org_id = $1 AND exam_id = $2`,
        [orgId, examId],
      );
      return row === undefined ? null : { outcome: row.outcome, releasedAt: iso(row.released_at) };
    });
  }

  /** A candidate's request about one question: once per question, and at most `limit` per attempt. */
  async ask(orgId: OrgId, attemptId: AttemptId, examId: string, questionId: string, reason: string, at: Date, limit: number): Promise<AskOutcome> {
    return withScope(this.#sql, candidateScope(orgId, attemptId), async (tx) => {
      const asked = await tx.query<{ question_id: string }>(`SELECT question_id FROM recheck_requests WHERE org_id = $1 AND attempt_id = $2`, [orgId, attemptId]);
      if (asked.some((r) => r.question_id === questionId)) return { ok: false, reason: "already_asked" } as const;
      if (asked.length >= limit) return { ok: false, reason: "too_many" } as const;
      const [row] = await tx.query<Row>(
        `INSERT INTO recheck_requests (org_id, id, attempt_id, exam_id, question_id, reason, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUMNS}`,
        [orgId, this.#newId(), attemptId, examId, questionId, reason, at.toISOString()],
      );
      return { ok: true, recheck: toRecheck(row!) } as const;
    });
  }

  /** A candidate's own requests. */
  async mine(orgId: OrgId, attemptId: AttemptId): Promise<readonly Recheck[]> {
    return withScope(this.#sql, candidateScope(orgId, attemptId), async (tx) =>
      (await tx.query<Row>(`SELECT ${COLUMNS} FROM recheck_requests WHERE org_id = $1 AND attempt_id = $2 ORDER BY created_at`, [orgId, attemptId])).map(toRecheck),
    );
  }

  /** An exam's requests, open first, then the latest answered. */
  async forExam(orgId: OrgId, examId: string): Promise<readonly Recheck[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (
        await tx.query<Row>(
          `SELECT ${COLUMNS} FROM recheck_requests WHERE org_id = $1 AND exam_id = $2
            ORDER BY (status = 'open') DESC, coalesce(decided_at, created_at) DESC`,
          [orgId, examId],
        )
      ).map(toRecheck),
    );
  }

  async get(orgId: OrgId, id: string): Promise<Recheck | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const [row] = await tx.query<Row>(`SELECT ${COLUMNS} FROM recheck_requests WHERE org_id = $1 AND id = $2`, [orgId, id]);
      return row === undefined ? null : toRecheck(row);
    });
  }

  /** Answer an open request. Returns null if it was answered meanwhile. */
  async answer(
    orgId: OrgId,
    id: string,
    answer: { readonly status: "changed" | "unchanged"; readonly scoreBefore: number | null; readonly scoreAfter: number | null; readonly reply: string; readonly decidedBy: string },
    at: Date,
  ): Promise<Recheck | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const [row] = await tx.query<Row>(
        `UPDATE recheck_requests SET status = $3, score_before = $4, score_after = $5, reply = $6, decided_by = $7, decided_at = $8
          WHERE org_id = $1 AND id = $2 AND status = 'open' RETURNING ${COLUMNS}`,
        [orgId, id, answer.status, answer.scoreBefore, answer.scoreAfter, answer.reply, answer.decidedBy, at.toISOString()],
      );
      return row === undefined ? null : toRecheck(row);
    });
  }

  /** How many requests await an answer, per exam: for the console's badge. */
  async openCounts(orgId: OrgId): Promise<Readonly<Record<string, number>>> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<{ exam_id: string; n: string | number }>(
        `SELECT exam_id, count(*) AS n FROM recheck_requests WHERE org_id = $1 AND status = 'open' GROUP BY exam_id`,
        [orgId],
      );
      return Object.fromEntries(rows.map((r) => [r.exam_id, Number(r.n)]));
    });
  }
}
