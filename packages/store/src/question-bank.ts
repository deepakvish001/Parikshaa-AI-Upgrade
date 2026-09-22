import type { Question, QuestionId } from "@parikshaa/core";
import { withScope, type Scope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * An organisation's question bank (ROADMAP §3).
 *
 * Staff only — the bank holds answer keys, and row-level security admits no
 * candidate scope to it. Questions are archived rather than deleted: an exam
 * built last year from a question should still be able to say where it came
 * from.
 */

export type Difficulty = "easy" | "medium" | "hard";

export interface BankEntry {
  readonly id: string;
  readonly question: Question;
  readonly topic: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly updatedAt: string;
  readonly archived: boolean;
}

/** A question to file, without an id: the bank assigns one. */
export interface BankDraft {
  readonly question: DistributiveOmit<Question, "id">;
  readonly topic: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export interface BankFilter {
  readonly topic?: string;
  readonly difficulty?: Difficulty;
  readonly tag?: string;
  /** Matched against the question's stem, case-insensitively. */
  readonly search?: string;
  readonly includeArchived?: boolean;
}

interface Row {
  id: string;
  question: Question;
  topic: string;
  difficulty: Difficulty;
  tags: string[];
  updated_at: string | Date;
  archived_at: string | Date | null;
}

const toEntry = (row: Row): BankEntry => ({
  id: row.id,
  question: row.question,
  topic: row.topic,
  difficulty: row.difficulty,
  tags: row.tags,
  updatedAt: new Date(row.updated_at).toISOString(),
  archived: row.archived_at !== null,
});

export class QuestionBank {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  /** File several questions at once: all of them, or — if any insert fails — none. */
  async add(scope: Scope, drafts: readonly BankDraft[]): Promise<readonly BankEntry[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const added: BankEntry[] = [];
      for (const draft of drafts) {
        const id = this.#newId();
        const question = { ...draft.question, id: id as QuestionId } as Question;
        const rows = await tx.query<Row>(
          `INSERT INTO bank_questions (org_id, id, question, topic, difficulty, tags)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, question, topic, difficulty, tags, updated_at, archived_at`,
          [scope.orgId, id, JSON.stringify(question), draft.topic.trim(), draft.difficulty, [...draft.tags]],
        );
        added.push(toEntry(rows[0]!));
      }
      return added;
    });
  }

  async update(scope: Scope, id: string, draft: BankDraft): Promise<BankEntry | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const question = { ...draft.question, id: id as QuestionId } as Question;
      const rows = await tx.query<Row>(
        `UPDATE bank_questions
            SET question = $3, topic = $4, difficulty = $5, tags = $6, updated_at = now()
          WHERE org_id = $1 AND id = $2
        RETURNING id, question, topic, difficulty, tags, updated_at, archived_at`,
        [scope.orgId, id, JSON.stringify(question), draft.topic.trim(), draft.difficulty, [...draft.tags]],
      );
      return rows[0] === undefined ? null : toEntry(rows[0]);
    });
  }

  async archive(scope: Scope, id: string): Promise<boolean> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `UPDATE bank_questions SET archived_at = now()
          WHERE org_id = $1 AND id = $2 AND archived_at IS NULL RETURNING id`,
        [scope.orgId, id],
      );
      return rows.length > 0;
    });
  }

  async list(scope: Scope, filter: BankFilter = {}): Promise<readonly BankEntry[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<Row>(
        `SELECT id, question, topic, difficulty, tags, updated_at, archived_at
           FROM bank_questions
          WHERE org_id = $1
            AND ($2::text IS NULL OR topic = $2)
            AND ($3::text IS NULL OR difficulty = $3)
            AND ($4::text IS NULL OR $4 = ANY (tags))
            AND ($5::text IS NULL OR position(lower($5) IN lower(question ->> 'stem')) > 0)
            AND ($6 OR archived_at IS NULL)
          ORDER BY topic, updated_at DESC
          LIMIT 1000`,
        [
          scope.orgId,
          filter.topic ?? null,
          filter.difficulty ?? null,
          filter.tag ?? null,
          filter.search ?? null,
          filter.includeArchived ?? false,
        ],
      );
      return rows.map(toEntry);
    });
  }

  /** Topics in use, for a filter menu. */
  async topics(scope: Scope): Promise<readonly string[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ topic: string }>(
        `SELECT DISTINCT topic FROM bank_questions
          WHERE org_id = $1 AND archived_at IS NULL AND topic <> '' ORDER BY topic`,
        [scope.orgId],
      );
      return rows.map((r) => r.topic);
    });
  }
}
