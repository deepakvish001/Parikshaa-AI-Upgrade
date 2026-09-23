import { withScope, type Scope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";

/** Announcements to a sitting (ROADMAP §8; migration 0008). */

export interface Announcement {
  readonly id: string;
  readonly examId: string;
  readonly message: string;
  readonly authorName: string;
  readonly at: string;
}

interface Row {
  id: string;
  exam_id: string;
  message: string;
  author_name: string;
  created_at: string | Date;
}

const toAnnouncement = (r: Row): Announcement => ({
  id: r.id,
  examId: r.exam_id,
  message: r.message,
  authorName: r.author_name,
  at: new Date(r.created_at).toISOString(),
});

export class InvigilationStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  async announce(scope: Scope, examId: string, message: string, authorName: string, at: Date): Promise<Announcement> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<Row>(
        `INSERT INTO announcements (org_id, id, exam_id, message, author_name, created_at) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, exam_id, message, author_name, created_at`,
        [scope.orgId, this.#newId(), examId, message, authorName, at.toISOString()],
      );
      return toAnnouncement(rows[0]!);
    });
  }

  /** When each attempt of an exam last autosaved a draft: typing, as far as the server can tell. */
  async lastDraftAt(scope: Scope, examId: string): Promise<ReadonlyMap<string, number>> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ attempt_id: string; at: string | number }>(
        `SELECT d.attempt_id, max(d.saved_at) AS at
           FROM answer_drafts d JOIN attempts a ON a.org_id = d.org_id AND a.id = d.attempt_id
          WHERE d.org_id = $1 AND a.exam_id = $2
          GROUP BY d.attempt_id`,
        [scope.orgId, examId],
      );
      return new Map(rows.map((r) => [r.attempt_id, Number(r.at)]));
    });
  }

  /** Oldest first. A candidate's scope sees only those for the exam they are sitting. */
  async announcements(scope: Scope, examId: string): Promise<readonly Announcement[]> {
    return withScope(this.#sql, scope, async (tx) =>
      (
        await tx.query<Row>(
          `SELECT id, exam_id, message, author_name, created_at FROM announcements
            WHERE org_id = $1 AND exam_id = $2 ORDER BY created_at, id`,
          [scope.orgId, examId],
        )
      ).map(toAnnouncement),
    );
  }
}
