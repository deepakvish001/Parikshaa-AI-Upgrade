import { staffScope, withScope } from "./ledger-store.js";
import { NO_SEAL, type RecordSeal } from "./sealing.js";
import type { ImageMime } from "./question-media.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** Handwritten answer copies, their scanned pages, suggested and checked marks, and moderation (migration 0043). */

export type ScriptStatus = "uploaded" | "checked" | "moderated" | "disputed";

/** Marks per question id: the score and an optional comment. */
export type ScriptMarks = Readonly<Record<string, { readonly score: number; readonly comment: string }>>;

export interface ScriptSuggestion {
  readonly questions: readonly { readonly questionId: string; readonly score: number; readonly reason: string; readonly transcript: string }[];
  readonly at: string;
}

export interface Moderation {
  readonly marks: ScriptMarks;
  readonly by: string;
  readonly at: string;
  /** The first examiner's total less the moderator's. */
  readonly gap: number;
  readonly resolvedBy?: string;
}

export interface AnswerScript {
  readonly id: string;
  readonly examId: string;
  readonly candidateRef: string;
  readonly candidateName: string;
  readonly status: ScriptStatus;
  readonly pages: number;
  readonly suggestion: ScriptSuggestion | null;
  readonly marks: ScriptMarks | null;
  readonly checkedBy: string | null;
  readonly checkedAt: string | null;
  readonly moderation: Moderation | null;
  readonly finalTotal: number | null;
  readonly uploadedBy: string;
  readonly createdAt: string;
}

interface Row {
  id: string;
  exam_id: string;
  candidate_ref: string;
  candidate_name: string;
  status: ScriptStatus;
  pages: number | string;
  suggestion: ScriptSuggestion | string | null;
  marks: ScriptMarks | string | null;
  checked_by: string | null;
  checked_at: string | Date | null;
  moderation: Moderation | string | null;
  final_total: number | string | null;
  uploaded_by: string;
  created_at: string | Date;
}

const iso = (v: string | Date) => new Date(v).toISOString();
const json = <T>(v: T | string | null): T | null => (v === null ? null : typeof v === "string" ? (JSON.parse(v) as T) : v);
const COLUMNS = `s.id, s.exam_id, s.candidate_ref, s.candidate_name, s.status, s.suggestion, s.marks, s.checked_by, s.checked_at, s.moderation, s.final_total, s.uploaded_by, s.created_at,
  (SELECT count(*) FROM answer_script_pages p WHERE p.org_id = s.org_id AND p.script_id = s.id) AS pages`;
const toScript = (r: Row): AnswerScript => ({
  id: r.id,
  examId: r.exam_id,
  candidateRef: r.candidate_ref,
  candidateName: r.candidate_name,
  status: r.status,
  pages: Number(r.pages),
  suggestion: json<ScriptSuggestion>(r.suggestion),
  marks: json<ScriptMarks>(r.marks),
  checkedBy: r.checked_by,
  checkedAt: r.checked_at === null ? null : iso(r.checked_at),
  moderation: json<Moderation>(r.moderation),
  finalTotal: r.final_total === null ? null : Number(r.final_total),
  uploadedBy: r.uploaded_by,
  createdAt: iso(r.created_at),
});

const pageAad = (orgId: string, scriptId: string, page: number) => `scripts/${orgId}/${scriptId}/page/${page}`;
const suggestionAad = (orgId: string, scriptId: string) => `scripts/${orgId}/${scriptId}/suggestion`;

export class ScriptStore {
  readonly #sql: SqlExecutor;
  readonly #seal: RecordSeal;

  /** `seal`: the scanned pages, and what the model read from them, are kept sealed (T1). */
  constructor(sql: SqlExecutor, seal: RecordSeal = NO_SEAL) {
    this.#sql = sql;
    this.#seal = seal;
  }

  /** A row, with the suggestion opened: stored sealed as a JSON string, or plain from before sealing. */
  #open(orgId: string, r: Row): AnswerScript {
    const raw = r.suggestion;
    const opened = typeof raw === "string" && raw.startsWith("enc:") ? (JSON.parse(this.#seal.open(raw, suggestionAad(orgId, r.id))) as ScriptSuggestion) : raw;
    return toScript({ ...r, suggestion: opened });
  }

  /** The candidate's copy in this exam, made on its first page. */
  async ensure(orgId: OrgId, s: { readonly id: string; readonly examId: string; readonly candidateRef: string; readonly candidateName: string; readonly uploadedBy: string; readonly createdAt: string }): Promise<AnswerScript> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      await tx.query(
        `INSERT INTO answer_scripts (org_id, id, exam_id, candidate_ref, candidate_name, uploaded_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (org_id, exam_id, candidate_ref) DO UPDATE SET candidate_name = CASE WHEN excluded.candidate_name = '' THEN answer_scripts.candidate_name ELSE excluded.candidate_name END`,
        [orgId, s.id, s.examId, s.candidateRef, s.candidateName, s.uploadedBy, s.createdAt],
      );
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM answer_scripts s WHERE s.org_id = $1 AND s.exam_id = $2 AND s.candidate_ref = $3`, [orgId, s.examId, s.candidateRef]);
      return this.#open(orgId, rows[0]!);
    });
  }

  /** Adds a page after the last. Returns its number. */
  async addPage(orgId: OrgId, scriptId: string, mime: ImageMime, bytes: Uint8Array): Promise<number> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const next = (await tx.query<{ page: number }>(`SELECT coalesce(max(page), 0) + 1 AS page FROM answer_script_pages WHERE org_id = $1 AND script_id = $2`, [orgId, scriptId]))[0]!.page;
      await tx.query(`INSERT INTO answer_script_pages (org_id, script_id, page, mime, bytes, sealed) VALUES ($1, $2, $3, $4, $5, $6)`, [
        orgId,
        scriptId,
        next,
        mime,
        this.#seal.bytes(bytes, pageAad(orgId, scriptId, next)),
        this.#seal !== NO_SEAL,
      ]);
      return next;
    });
  }

  async get(orgId: OrgId, id: string): Promise<AnswerScript | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM answer_scripts s WHERE s.org_id = $1 AND s.id = $2`, [orgId, id]);
      return rows[0] === undefined ? null : this.#open(orgId, rows[0]);
    });
  }

  async forExam(orgId: OrgId, examId: string): Promise<readonly AnswerScript[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query<Row>(`SELECT ${COLUMNS} FROM answer_scripts s WHERE s.org_id = $1 AND s.exam_id = $2 ORDER BY s.candidate_ref`, [orgId, examId])).map((r) => this.#open(orgId, r)),
    );
  }

  async page(orgId: OrgId, id: string, page: number): Promise<{ readonly mime: ImageMime; readonly bytes: Buffer } | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<{ mime: ImageMime; bytes: Uint8Array; sealed: boolean }>(`SELECT mime, bytes, sealed FROM answer_script_pages WHERE org_id = $1 AND script_id = $2 AND page = $3`, [orgId, id, page]);
      const r = rows[0];
      return r === undefined ? null : { mime: r.mime, bytes: r.sealed ? this.#seal.openBytes(Buffer.from(r.bytes), pageAad(orgId, id, page)) : Buffer.from(r.bytes) };
    });
  }

  async pages(orgId: OrgId, id: string): Promise<readonly { readonly mime: ImageMime; readonly bytes: Buffer }[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query<{ page: number; mime: ImageMime; bytes: Uint8Array; sealed: boolean }>(`SELECT page, mime, bytes, sealed FROM answer_script_pages WHERE org_id = $1 AND script_id = $2 ORDER BY page`, [orgId, id])).map((r) => ({
        mime: r.mime,
        bytes: r.sealed ? this.#seal.openBytes(Buffer.from(r.bytes), pageAad(orgId, id, r.page)) : Buffer.from(r.bytes),
      })),
    );
  }

  async update(
    orgId: OrgId,
    id: string,
    patch: {
      readonly suggestion?: ScriptSuggestion;
      readonly marks?: ScriptMarks;
      readonly checkedBy?: string;
      readonly checkedAt?: string;
      readonly moderation?: Moderation;
      readonly status?: ScriptStatus;
      readonly finalTotal?: number;
    },
  ): Promise<AnswerScript | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const changed = await tx.query<{ id: string }>(
        `UPDATE answer_scripts SET
           suggestion = coalesce($3::jsonb, suggestion), marks = coalesce($4::jsonb, marks),
           checked_by = coalesce($5, checked_by), checked_at = coalesce($6, checked_at),
           moderation = coalesce($7::jsonb, moderation), status = coalesce($8, status), final_total = coalesce($9, final_total)
         WHERE org_id = $1 AND id = $2 RETURNING id`,
        [
          orgId,
          id,
          patch.suggestion === undefined ? null : JSON.stringify(this.#seal === NO_SEAL ? patch.suggestion : this.#seal.text(JSON.stringify(patch.suggestion), suggestionAad(orgId, id))),
          patch.marks === undefined ? null : JSON.stringify(patch.marks),
          patch.checkedBy ?? null,
          patch.checkedAt ?? null,
          patch.moderation === undefined ? null : JSON.stringify(patch.moderation),
          patch.status ?? null,
          patch.finalTotal ?? null,
        ],
      );
      if (changed.length === 0) return null;
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM answer_scripts s WHERE s.org_id = $1 AND s.id = $2`, [orgId, id]);
      return this.#open(orgId, rows[0]!);
    });
  }

  /** Copies made before `before`: removed, pages and all, by the retention sweep (T1). Returns how many. */
  async sweep(orgId: OrgId, before: Date): Promise<number> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => (await tx.query(`DELETE FROM answer_scripts WHERE org_id = $1 AND created_at < $2 RETURNING id`, [orgId, before.toISOString()])).length);
  }

  async remove(orgId: OrgId, id: string): Promise<boolean> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => (await tx.query<{ id: string }>(`DELETE FROM answer_scripts WHERE org_id = $1 AND id = $2 RETURNING id`, [orgId, id])).length > 0);
  }
}
