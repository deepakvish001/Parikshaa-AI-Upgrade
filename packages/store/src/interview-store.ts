import { staffScope, withScope } from "./ledger-store.js";
import { NO_SEAL, type RecordSeal } from "./sealing.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** Interviews: the room, the candidate's code, the notes and the scorecard (migration 0036). */

export type Recommendation = "strong_yes" | "yes" | "no" | "strong_no";

export interface Scorecard {
  readonly criteria: readonly { readonly name: string; readonly score: number }[];
  readonly recommendation: Recommendation;
  readonly summary: string;
}

export interface Interview {
  readonly id: string;
  readonly title: string;
  readonly candidateRef: string;
  readonly candidateName: string;
  readonly candidateEmail: string | null;
  readonly interviewer: string;
  readonly scheduledAt: string;
  readonly minutes: number;
  readonly meetingUrl: string;
  readonly problem: string;
  readonly language: string;
  readonly code: string;
  readonly codeUpdatedAt: string | null;
  readonly notes: string;
  readonly scorecard: Scorecard | null;
  readonly status: "scheduled" | "done" | "cancelled";
  readonly driveId: string | null;
  readonly createdAt: string;
  /** The staff on its panel, by id; the one who set it up first. Empty for an interview from before panels. */
  readonly panel: readonly string[];
}

/** One panel member's own scorecard (CO41). */
export interface PanelScore {
  readonly userId: string;
  readonly name: string;
  readonly scorecard: Scorecard;
  readonly scoredAt: string;
}

interface Row {
  id: string;
  title: string;
  candidate_ref: string;
  candidate_name: string;
  candidate_email: string | null;
  interviewer: string;
  scheduled_at: string | Date;
  minutes: number;
  meeting_url: string;
  problem: string;
  language: string;
  code: string;
  code_updated_at: string | Date | null;
  notes: string;
  scorecard: Scorecard | string | null;
  status: Interview["status"];
  drive_id: string | null;
  created_at: string | Date;
  panel: string[] | string | null;
}

const iso = (v: string | Date) => new Date(v).toISOString();
const COLUMNS = `id, title, candidate_ref, candidate_name, candidate_email, interviewer, scheduled_at, minutes, meeting_url, problem, language, code, code_updated_at, notes, scorecard, status, drive_id, created_at, panel`;
const toInterview = (r: Row): Interview => ({
  id: r.id,
  title: r.title,
  candidateRef: r.candidate_ref,
  candidateName: r.candidate_name,
  candidateEmail: r.candidate_email,
  interviewer: r.interviewer,
  scheduledAt: iso(r.scheduled_at),
  minutes: r.minutes,
  meetingUrl: r.meeting_url,
  problem: r.problem,
  language: r.language,
  code: r.code,
  codeUpdatedAt: r.code_updated_at === null ? null : iso(r.code_updated_at),
  notes: r.notes,
  scorecard: r.scorecard === null ? null : typeof r.scorecard === "string" ? (JSON.parse(r.scorecard) as Scorecard) : r.scorecard,
  status: r.status,
  driveId: r.drive_id,
  createdAt: iso(r.created_at),
  panel: Array.isArray(r.panel) ? r.panel : [],
});

const aad = (orgId: string, id: string, field: "email" | "code" | "notes") => `interviews/${orgId}/${id}/${field}`;

export class InterviewStore {
  readonly #sql: SqlExecutor;
  readonly #seal: RecordSeal;

  /** `seal`: the candidate's email, their code and the interviewer's notes are kept sealed (T1). */
  constructor(sql: SqlExecutor, seal: RecordSeal = NO_SEAL) {
    this.#sql = sql;
    this.#seal = seal;
  }

  #open(orgId: string, r: Row): Interview {
    const i = toInterview(r);
    return { ...i, candidateEmail: this.#seal.open(i.candidateEmail, aad(orgId, i.id, "email")), code: this.#seal.open(i.code, aad(orgId, i.id, "code")), notes: this.#seal.open(i.notes, aad(orgId, i.id, "notes")) };
  }

  async create(orgId: OrgId, i: Omit<Interview, "code" | "codeUpdatedAt" | "notes" | "scorecard" | "status" | "language" | "panel"> & { readonly language: string; readonly panel?: readonly string[] }): Promise<Interview> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(
        `INSERT INTO interviews (org_id, id, title, candidate_ref, candidate_name, candidate_email, interviewer, scheduled_at, minutes, meeting_url, problem, language, drive_id, created_at, panel)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING ${COLUMNS}`,
        [orgId, i.id, i.title, i.candidateRef, i.candidateName, this.#seal.text(i.candidateEmail, aad(orgId, i.id, "email")), i.interviewer, i.scheduledAt, i.minutes, i.meetingUrl, i.problem, i.language, i.driveId, i.createdAt, [...(i.panel ?? [])]],
      );
      return this.#open(orgId, rows[0]!);
    });
  }

  async get(orgId: OrgId, id: string): Promise<Interview | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM interviews WHERE org_id = $1 AND id = $2`, [orgId, id]);
      return rows[0] === undefined ? null : this.#open(orgId, rows[0]);
    });
  }

  async list(orgId: OrgId): Promise<readonly Interview[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query<Row>(`SELECT ${COLUMNS} FROM interviews WHERE org_id = $1 ORDER BY scheduled_at DESC LIMIT 500`, [orgId])).map((r) => this.#open(orgId, r)),
    );
  }

  async update(orgId: OrgId, id: string, patch: { readonly problem?: string; readonly notes?: string; readonly language?: string; readonly code?: string; readonly codeAt?: Date; readonly scorecard?: Scorecard; readonly status?: Interview["status"] }): Promise<Interview | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(
        `UPDATE interviews SET
           problem = coalesce($3, problem), notes = coalesce($4, notes), language = coalesce($5, language),
           code = coalesce($6, code), code_updated_at = coalesce($7, code_updated_at),
           scorecard = coalesce($8::jsonb, scorecard), status = coalesce($9, status)
         WHERE org_id = $1 AND id = $2 RETURNING ${COLUMNS}`,
        [
          orgId,
          id,
          patch.problem ?? null,
          patch.notes === undefined ? null : this.#seal.text(patch.notes, aad(orgId, id, "notes")),
          patch.language ?? null,
          patch.code === undefined ? null : this.#seal.text(patch.code, aad(orgId, id, "code")),
          patch.codeAt?.toISOString() ?? null,
          patch.scorecard === undefined ? null : JSON.stringify(patch.scorecard),
          patch.status ?? null,
        ],
      );
      return rows[0] === undefined ? null : this.#open(orgId, rows[0]);
    });
  }

  /** The panel's own scorecards, for these interviews. */
  async scores(orgId: OrgId, ids: readonly string[]): Promise<ReadonlyMap<string, readonly PanelScore[]>> {
    if (ids.length === 0) return new Map();
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<{ interview_id: string; user_id: string; name: string; scorecard: Scorecard | string; scored_at: string | Date }>(
        `SELECT interview_id, user_id, name, scorecard, scored_at FROM interview_scores WHERE org_id = $1 AND interview_id = ANY($2) ORDER BY scored_at`,
        [orgId, [...ids]],
      );
      const out = new Map<string, PanelScore[]>();
      for (const r of rows) {
        const list = out.get(r.interview_id) ?? [];
        list.push({ userId: r.user_id, name: r.name, scorecard: typeof r.scorecard === "string" ? (JSON.parse(r.scorecard) as Scorecard) : r.scorecard, scoredAt: iso(r.scored_at) });
        out.set(r.interview_id, list);
      }
      return out;
    });
  }

  /** A panel member's scorecard; a second one from them replaces the first. */
  async putScore(orgId: OrgId, id: string, score: PanelScore): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), async (tx) => {
      await tx.query(
        `INSERT INTO interview_scores (org_id, interview_id, user_id, name, scorecard, scored_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
         ON CONFLICT (org_id, interview_id, user_id) DO UPDATE SET name = EXCLUDED.name, scorecard = EXCLUDED.scorecard, scored_at = EXCLUDED.scored_at`,
        [orgId, id, score.userId, score.name, JSON.stringify(score.scorecard), score.scoredAt],
      );
    });
  }

  /** Interviews done or cancelled before `before`: removed by the retention sweep (T1). Returns how many. */
  async sweep(orgId: OrgId, before: Date): Promise<number> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query(`DELETE FROM interviews WHERE org_id = $1 AND status <> 'scheduled' AND scheduled_at < $2 RETURNING id`, [orgId, before.toISOString()])).length,
    );
  }
}
