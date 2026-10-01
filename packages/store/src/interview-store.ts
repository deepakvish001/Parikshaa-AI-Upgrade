import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** Interviews: the room, the candidate's code, the notes and the scorecard (migration 0042). */

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
}

const iso = (v: string | Date) => new Date(v).toISOString();
const COLUMNS = `id, title, candidate_ref, candidate_name, candidate_email, interviewer, scheduled_at, minutes, meeting_url, problem, language, code, code_updated_at, notes, scorecard, status, drive_id, created_at`;
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
});

export class InterviewStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async create(orgId: OrgId, i: Omit<Interview, "code" | "codeUpdatedAt" | "notes" | "scorecard" | "status" | "language"> & { readonly language: string }): Promise<Interview> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(
        `INSERT INTO interviews (org_id, id, title, candidate_ref, candidate_name, candidate_email, interviewer, scheduled_at, minutes, meeting_url, problem, language, drive_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING ${COLUMNS}`,
        [orgId, i.id, i.title, i.candidateRef, i.candidateName, i.candidateEmail, i.interviewer, i.scheduledAt, i.minutes, i.meetingUrl, i.problem, i.language, i.driveId, i.createdAt],
      );
      return toInterview(rows[0]!);
    });
  }

  async get(orgId: OrgId, id: string): Promise<Interview | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM interviews WHERE org_id = $1 AND id = $2`, [orgId, id]);
      return rows[0] === undefined ? null : toInterview(rows[0]);
    });
  }

  async list(orgId: OrgId): Promise<readonly Interview[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query<Row>(`SELECT ${COLUMNS} FROM interviews WHERE org_id = $1 ORDER BY scheduled_at DESC LIMIT 500`, [orgId])).map(toInterview),
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
          patch.notes ?? null,
          patch.language ?? null,
          patch.code ?? null,
          patch.codeAt?.toISOString() ?? null,
          patch.scorecard === undefined ? null : JSON.stringify(patch.scorecard),
          patch.status ?? null,
        ],
      );
      return rows[0] === undefined ? null : toInterview(rows[0]);
    });
  }
}
