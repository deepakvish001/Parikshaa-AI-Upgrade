import type { Question, QuestionId } from "@parikshaa/core";
import { withScope, type Scope } from "./ledger-store.js";
import type { Difficulty } from "./question-bank.js";
import type { SqlExecutor, TransactionSettings } from "./sql.js";

/**
 * The Parikshaa Library (migration 0068; docs/F1-GO-LIVE-PLAN.md §4): questions
 * Parikshaa writes, which any organisation's staff may browse and copy into
 * their own bank.
 *
 * The library is no organisation's, so changing it runs as staff without an
 * organisation; who may do it (Parikshaa's operators) is the API's decision.
 * Reading it, and taking from it, run in an organisation's scope, so the
 * adoptions an organisation sees are its own.
 */

export type LibrarySection = "aptitude" | "cs" | "programming" | "dsa" | "sql" | "frontend";
export const LIBRARY_SECTIONS: readonly LibrarySection[] = ["aptitude", "cs", "programming", "dsa", "sql", "frontend"];
export type LibraryTier = "open" | "hire";

/** A question as Parikshaa files it in the library. `id` is stable: the same question keeps it across versions. */
export interface LibraryDraft {
  readonly id: string;
  readonly section: LibrarySection;
  readonly topic: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly question: Question;
  readonly explanation: string;
  readonly tier: LibraryTier;
  readonly source: string;
}

export interface LibraryEntry extends LibraryDraft {
  readonly version: number;
  readonly exposure: number;
  readonly updatedAt: string;
  readonly retired: boolean;
  /** This organisation's copy, if it took the question: which bank question, and from which version. */
  readonly adopted: { readonly bankQuestionId: string; readonly version: number } | null;
}

export interface LibraryFilter {
  readonly section?: LibrarySection;
  readonly topic?: string;
  readonly difficulty?: Difficulty;
  readonly kind?: Question["kind"];
  readonly tier?: LibraryTier;
  /** Matched against the stem, the topic and the tags, without case. */
  readonly search?: string;
  /** Only questions this organisation has not taken yet. */
  readonly notAdopted?: boolean;
  readonly includeRetired?: boolean;
}

export interface LibraryFacets {
  readonly total: number;
  readonly sections: readonly { readonly section: LibrarySection; readonly count: number; readonly topics: readonly { readonly topic: string; readonly count: number }[] }[];
}

interface Row {
  id: string;
  version: number;
  section: LibrarySection;
  topic: string;
  difficulty: Difficulty;
  tags: string[];
  question: Question;
  explanation: string;
  tier: LibraryTier;
  source: string;
  exposure: number;
  updated_at: string | Date;
  retired_at: string | Date | null;
  bank_question_id: string | null;
  adopted_version: number | null;
}

const COLUMNS = `q.id, q.version, q.section, q.topic, q.difficulty, q.tags, q.question, q.explanation, q.tier, q.source, q.exposure, q.updated_at, q.retired_at,
  a.bank_question_id, a.version AS adopted_version`;

const toEntry = (row: Row): LibraryEntry => ({
  id: row.id,
  version: Number(row.version),
  section: row.section,
  topic: row.topic,
  difficulty: row.difficulty,
  tags: row.tags,
  question: row.question,
  explanation: row.explanation,
  tier: row.tier,
  source: row.source,
  exposure: Number(row.exposure),
  updatedAt: new Date(row.updated_at).toISOString(),
  retired: row.retired_at !== null,
  adopted: row.bank_question_id === null ? null : { bankQuestionId: row.bank_question_id, version: Number(row.adopted_version) },
});

/** Staff, in no organisation: how the library itself is changed. */
const LIBRARY_SETTINGS: TransactionSettings = { "parikshaa.actor": "staff", "parikshaa.org_id": "", "parikshaa.attempt_id": "" };

/** The question as filed: its id is the library's, whatever the draft said. */
const filed = (draft: LibraryDraft): Question => ({ ...draft.question, id: draft.id as QuestionId }) as Question;

const filterSql = `
  ($2::text IS NULL OR q.section = $2)
  AND ($3::text IS NULL OR q.topic = $3)
  AND ($4::text IS NULL OR q.difficulty = $4)
  AND ($5::text IS NULL OR q.question ->> 'kind' = $5)
  AND ($6::text IS NULL OR q.tier = $6)
  AND ($7::text IS NULL OR position(lower($7) IN lower(q.question ->> 'stem' || ' ' || q.topic || ' ' || array_to_string(q.tags, ' '))) > 0)
  AND (NOT $8 OR a.library_id IS NULL)
  AND ($9 OR q.retired_at IS NULL)`;

const filterParams = (f: LibraryFilter) => [
  f.section ?? null,
  f.topic ?? null,
  f.difficulty ?? null,
  f.kind ?? null,
  f.tier ?? null,
  f.search === undefined || f.search.trim() === "" ? null : f.search.trim(),
  f.notAdopted ?? false,
  f.includeRetired ?? false,
];

export class LibraryStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- changing the library (Parikshaa's operators) -----------------------------------

  /**
   * File questions: a new id is added at version 1; one whose content changed
   * gets the next version; one unchanged is left alone. A retired question
   * filed again comes back. Returns how many of each.
   */
  async upsert(drafts: readonly LibraryDraft[]): Promise<{ readonly added: number; readonly updated: number; readonly unchanged: number }> {
    return this.#sql.transaction(async (tx) => {
      let added = 0;
      let updated = 0;
      let unchanged = 0;
      for (const draft of drafts) {
        const question = JSON.stringify(filed(draft));
        const params = [draft.id, draft.section, draft.topic.trim(), draft.difficulty, [...draft.tags], question, draft.explanation, draft.tier, draft.source];
        const inserted = await tx.query(
          `INSERT INTO library_questions (id, section, topic, difficulty, tags, question, explanation, tier, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING RETURNING id`,
          params,
        );
        if (inserted.length > 0) {
          added++;
          continue;
        }
        const changed = await tx.query(
          `UPDATE library_questions
              SET version = version + 1, section = $2, topic = $3, difficulty = $4, tags = $5, question = $6,
                  explanation = $7, tier = $8, source = $9, updated_at = now(), retired_at = NULL
            WHERE id = $1
              AND (section, topic, difficulty, tags, question, explanation, tier, source, retired_at IS NULL)
                  IS DISTINCT FROM ($2, $3, $4, $5::text[], $6::jsonb, $7, $8, $9, true)
            RETURNING id`,
          params,
        );
        if (changed.length > 0) updated++;
        else unchanged++;
      }
      return { added, updated, unchanged };
    }, LIBRARY_SETTINGS);
  }

  /** Take a question out of the library: no one can take it any more; copies already taken stay. */
  async retire(id: string): Promise<boolean> {
    return this.#sql.transaction(
      async (tx) => (await tx.query(`UPDATE library_questions SET retired_at = now() WHERE id = $1 AND retired_at IS NULL RETURNING id`, [id])).length > 0,
      LIBRARY_SETTINGS,
    );
  }

  // --- reading it, as an organisation --------------------------------------------------

  async list(scope: Scope, filter: LibraryFilter = {}, page: { readonly limit?: number; readonly offset?: number } = {}): Promise<{ readonly items: readonly LibraryEntry[]; readonly total: number }> {
    return withScope(this.#sql, scope, async (tx) => {
      const params = [scope.orgId, ...filterParams(filter)];
      const from = `FROM library_questions q LEFT JOIN library_adoptions a ON a.org_id = $1 AND a.library_id = q.id WHERE ${filterSql}`;
      const [rows, count] = await Promise.all([
        tx.query<Row>(`SELECT ${COLUMNS} ${from} ORDER BY q.section, q.topic, q.difficulty, q.id LIMIT $10 OFFSET $11`, [
          ...params,
          Math.min(page.limit ?? 50, 200),
          page.offset ?? 0,
        ]),
        tx.query<{ n: number | string }>(`SELECT count(*) AS n ${from}`, params),
      ]);
      return { items: rows.map(toEntry), total: Number(count[0]?.n ?? 0) };
    });
  }

  async get(scope: Scope, id: string): Promise<LibraryEntry | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<Row>(
        `SELECT ${COLUMNS} FROM library_questions q LEFT JOIN library_adoptions a ON a.org_id = $1 AND a.library_id = q.id WHERE q.id = $2`,
        [scope.orgId, id],
      );
      return rows[0] === undefined ? null : toEntry(rows[0]);
    });
  }

  /** How many questions each section and topic has, for the filters. Retired ones are not counted. */
  async facets(scope: Scope): Promise<LibraryFacets> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ section: LibrarySection; topic: string; n: number | string }>(
        `SELECT section, topic, count(*) AS n FROM library_questions WHERE retired_at IS NULL GROUP BY section, topic ORDER BY section, topic`,
      );
      const sections = LIBRARY_SECTIONS.map((section) => {
        const topics = rows.filter((r) => r.section === section).map((r) => ({ topic: r.topic, count: Number(r.n) }));
        return { section, count: topics.reduce((sum, t) => sum + t.count, 0), topics };
      });
      return { total: sections.reduce((sum, s) => sum + s.count, 0), sections };
    });
  }

  /** Up to `count` questions matching, that this organisation has not taken, chosen at random. */
  async pick(scope: Scope, filter: LibraryFilter, count: number): Promise<readonly string[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `SELECT q.id FROM library_questions q LEFT JOIN library_adoptions a ON a.org_id = $1 AND a.library_id = q.id
          WHERE ${filterSql} ORDER BY random() LIMIT $10`,
        [scope.orgId, ...filterParams({ ...filter, notAdopted: true, includeRetired: false }), Math.max(0, Math.min(count, 100))],
      );
      return rows.map((r) => r.id);
    });
  }

  /**
   * Copy questions into this organisation's bank, tagged with where they came
   * from. One taken before is not copied again: its bank question is returned.
   * The first time an organisation takes a question, its exposure goes up.
   * Retired or unknown ids are left out of the result.
   */
  async adopt(scope: Scope, ids: readonly string[]): Promise<readonly { readonly libraryId: string; readonly bankQuestionId: string; readonly added: boolean }[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const out: { libraryId: string; bankQuestionId: string; added: boolean }[] = [];
      for (const id of new Set(ids)) {
        const [row] = await tx.query<Row>(
          `SELECT ${COLUMNS} FROM library_questions q LEFT JOIN library_adoptions a ON a.org_id = $1 AND a.library_id = q.id WHERE q.id = $2`,
          [scope.orgId, id],
        );
        if (row === undefined) continue;
        if (row.bank_question_id !== null) {
          out.push({ libraryId: id, bankQuestionId: row.bank_question_id, added: false });
          continue;
        }
        if (row.retired_at !== null) continue;
        const bankId = this.#newId();
        await tx.query(
          `INSERT INTO bank_questions (org_id, id, question, topic, difficulty, tags) VALUES ($1, $2, $3, $4, $5, $6)`,
          [scope.orgId, bankId, JSON.stringify({ ...row.question, id: bankId }), row.topic, row.difficulty, [...row.tags, `library:${id}`]],
        );
        await tx.query(`INSERT INTO library_adoptions (org_id, library_id, version, bank_question_id) VALUES ($1, $2, $3, $4)`, [
          scope.orgId,
          id,
          row.version,
          bankId,
        ]);
        await tx.query(`UPDATE library_questions SET exposure = exposure + 1 WHERE id = $1`, [id]);
        out.push({ libraryId: id, bankQuestionId: bankId, added: true });
      }
      return out;
    });
  }

  /**
   * Replace this organisation's copy with the library's current version. Any
   * change the organisation made to its copy is lost; exams already built
   * keep their own copy as ever. Null if it never took the question.
   */
  async refresh(scope: Scope, id: string): Promise<{ readonly bankQuestionId: string; readonly version: number } | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const [row] = await tx.query<Row>(
        `SELECT ${COLUMNS} FROM library_questions q JOIN library_adoptions a ON a.org_id = $1 AND a.library_id = q.id WHERE q.id = $2`,
        [scope.orgId, id],
      );
      if (row === undefined || row.bank_question_id === null) return null;
      await tx.query(
        `UPDATE bank_questions SET question = $3, topic = $4, difficulty = $5, tags = $6, updated_at = now(), archived_at = NULL WHERE org_id = $1 AND id = $2`,
        [scope.orgId, row.bank_question_id, JSON.stringify({ ...row.question, id: row.bank_question_id }), row.topic, row.difficulty, [...row.tags, `library:${id}`]],
      );
      await tx.query(`UPDATE library_adoptions SET version = $3 WHERE org_id = $1 AND library_id = $2`, [scope.orgId, id, row.version]);
      return { bankQuestionId: row.bank_question_id, version: Number(row.version) };
    });
  }
}
