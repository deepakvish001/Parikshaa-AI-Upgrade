import { createHash } from "node:crypto";
import type { OrgId } from "@parikshaa/core";
import { staffScope, withScope } from "./ledger-store.js";
import { NO_SEAL, type RecordSeal } from "./sealing.js";
import type { SqlExecutor } from "./sql.js";

/**
 * The AI interviewer's records (migration 0060): the interview, and its
 * transcript as a hash chain. The candidate's email and every turn's words
 * and code are sealed (T1); each turn's hash is over its plain text, so the
 * chain can be checked once the turns are opened.
 */

export type AiInterviewStatus = "invited" | "in_progress" | "done" | "cancelled";
export type Seniority = "fresher" | "junior" | "mid" | "senior";
export type AiRecommendation = "strong_yes" | "yes" | "no" | "strong_no";

/** The model's reading of a finished interview: evidence for a person, not a decision. */
export interface AiAssessment {
  readonly criteria: readonly { readonly name: string; readonly score: number; readonly evidence: readonly string[] }[];
  readonly summary: string;
  readonly concerns: readonly string[];
}

/** What a person decided, having read the transcript. */
export interface AiScorecard {
  readonly criteria: readonly { readonly name: string; readonly score: number }[];
  readonly recommendation: AiRecommendation;
  readonly summary: string;
}

export interface AiInterview {
  readonly id: string;
  readonly title: string;
  readonly roleId: string | null;
  readonly job: string;
  readonly seniority: Seniority;
  readonly questions: number;
  readonly minutes: number;
  readonly candidateRef: string;
  readonly candidateName: string;
  readonly candidateEmail: string | null;
  /** The resume the recruiter pasted, or null. */
  readonly resume: string | null;
  readonly status: AiInterviewStatus;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly assessment: AiAssessment | null;
  readonly scorecard: AiScorecard | null;
  readonly decidedBy: string | null;
  readonly decidedAt: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
}

export type TurnSpeaker = "interviewer" | "candidate";
export type TurnKind = "question" | "follow_up" | "answer" | "closing";

export interface AiTurn {
  readonly seq: number;
  readonly speaker: TurnSpeaker;
  readonly kind: TurnKind;
  readonly body: string;
  readonly code: string | null;
  readonly language: string | null;
  readonly at: string;
  readonly prevHash: string;
  readonly hash: string;
}

export type NewTurn = Pick<AiTurn, "speaker" | "kind" | "body" | "code" | "language" | "at">;

const GENESIS = "0".repeat(64);

/** The hash of one turn, over its plain words and the turn before. */
export function turnHash(prevHash: string, seq: number, t: NewTurn): string {
  return createHash("sha256")
    .update(prevHash)
    .update(JSON.stringify([seq, t.speaker, t.kind, t.body, t.code, t.language, t.at]))
    .digest("hex");
}

/** Whether a transcript's chain holds: each turn's hash recomputed, each linked to the one before. */
export function chainHolds(turns: readonly AiTurn[]): boolean {
  let prev = GENESIS;
  for (const [i, t] of turns.entries()) {
    if (t.seq !== i || t.prevHash !== prev || turnHash(prev, t.seq, t) !== t.hash) return false;
    prev = t.hash;
  }
  return true;
}

/** A turn written by another request first: the seq was taken. */
export class TurnTaken extends Error {
  constructor() {
    super("Another turn was written first");
    this.name = "TurnTaken";
  }
}

const COLUMNS = `id, title, role_id, job, seniority, questions, minutes, candidate_ref, candidate_name, candidate_email, resume, status,
  started_at, ended_at, assessment, scorecard, decided_by, decided_at, created_by, created_at`;

interface Row {
  id: string;
  title: string;
  role_id: string | null;
  job: string;
  seniority: Seniority;
  questions: number;
  minutes: number;
  candidate_ref: string;
  candidate_name: string;
  candidate_email: string | null;
  resume: string | null;
  status: AiInterviewStatus;
  started_at: string | Date | null;
  ended_at: string | Date | null;
  assessment: AiAssessment | null;
  scorecard: AiScorecard | null;
  decided_by: string | null;
  decided_at: string | Date | null;
  created_by: string;
  created_at: string | Date;
}

const iso = (v: string | Date | null) => (v === null ? null : new Date(v).toISOString());
const aad = (orgId: string, id: string, field: string) => `ai-interview:${orgId}:${id}:${field}`;

export class AiInterviewStore {
  readonly #sql: SqlExecutor;
  readonly #seal: RecordSeal;

  constructor(sql: SqlExecutor, seal: RecordSeal = NO_SEAL) {
    this.#sql = sql;
    this.#seal = seal;
  }

  #toInterview(orgId: string, r: Row): AiInterview {
    return {
      id: r.id,
      title: r.title,
      roleId: r.role_id,
      job: r.job,
      seniority: r.seniority,
      questions: r.questions,
      minutes: r.minutes,
      candidateRef: r.candidate_ref,
      candidateName: r.candidate_name,
      candidateEmail: this.#seal.open(r.candidate_email, aad(orgId, r.id, "email")),
      resume: this.#seal.open(r.resume, aad(orgId, r.id, "resume")),
      status: r.status,
      startedAt: iso(r.started_at),
      endedAt: iso(r.ended_at),
      assessment: r.assessment,
      scorecard: r.scorecard,
      decidedBy: r.decided_by,
      decidedAt: iso(r.decided_at),
      createdBy: r.created_by,
      createdAt: new Date(r.created_at).toISOString(),
    };
  }

  async create(
    orgId: OrgId,
    i: Pick<AiInterview, "id" | "title" | "roleId" | "job" | "seniority" | "questions" | "minutes" | "candidateRef" | "candidateName" | "candidateEmail" | "createdBy" | "createdAt"> & { readonly resume?: string | null },
  ): Promise<AiInterview> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(
        `INSERT INTO ai_interviews (org_id, id, title, role_id, job, seniority, questions, minutes, candidate_ref, candidate_name, candidate_email, resume, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING ${COLUMNS}`,
        [orgId, i.id, i.title, i.roleId, i.job, i.seniority, i.questions, i.minutes, i.candidateRef, i.candidateName, this.#seal.text(i.candidateEmail, aad(orgId, i.id, "email")), this.#seal.text(i.resume ?? null, aad(orgId, i.id, "resume")), i.createdBy, i.createdAt],
      );
      return this.#toInterview(orgId, rows[0]!);
    });
  }

  async get(orgId: OrgId, id: string): Promise<AiInterview | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM ai_interviews WHERE org_id = $1 AND id = $2`, [orgId, id]);
      return rows[0] === undefined ? null : this.#toInterview(orgId, rows[0]);
    });
  }

  async list(orgId: OrgId): Promise<readonly AiInterview[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query<Row>(`SELECT ${COLUMNS} FROM ai_interviews WHERE org_id = $1 ORDER BY created_at DESC LIMIT 500`, [orgId])).map((r) => this.#toInterview(orgId, r)),
    );
  }

  /** Moves the interview on. `from` guards against two requests racing: nothing changes unless it is in that state. */
  async update(
    orgId: OrgId,
    id: string,
    patch: {
      readonly from?: AiInterviewStatus;
      readonly status?: AiInterviewStatus;
      readonly startedAt?: string;
      readonly endedAt?: string;
      readonly assessment?: AiAssessment;
      readonly scorecard?: AiScorecard;
      readonly decidedBy?: string;
      readonly decidedAt?: string;
    },
  ): Promise<AiInterview | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(
        `UPDATE ai_interviews SET
           status = COALESCE($3, status),
           started_at = COALESCE($4, started_at),
           ended_at = COALESCE($5, ended_at),
           assessment = COALESCE($6::jsonb, assessment),
           scorecard = COALESCE($7::jsonb, scorecard),
           decided_by = COALESCE($8, decided_by),
           decided_at = COALESCE($9, decided_at)
         WHERE org_id = $1 AND id = $2 AND ($10::text IS NULL OR status = $10)
         RETURNING ${COLUMNS}`,
        [
          orgId,
          id,
          patch.status ?? null,
          patch.startedAt ?? null,
          patch.endedAt ?? null,
          patch.assessment === undefined ? null : JSON.stringify(patch.assessment),
          patch.scorecard === undefined ? null : JSON.stringify(patch.scorecard),
          patch.decidedBy ?? null,
          patch.decidedAt ?? null,
          patch.from ?? null,
        ],
      );
      return rows[0] === undefined ? null : this.#toInterview(orgId, rows[0]);
    });
  }

  async turns(orgId: OrgId, id: string): Promise<readonly AiTurn[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<{ seq: number; speaker: TurnSpeaker; kind: TurnKind; body: string; code: string | null; language: string | null; at: string | Date; prev_hash: string; hash: string }>(
        `SELECT seq, speaker, kind, body, code, language, at, prev_hash, hash FROM ai_interview_turns WHERE org_id = $1 AND interview_id = $2 ORDER BY seq`,
        [orgId, id],
      );
      return rows.map((r) => ({
        seq: r.seq,
        speaker: r.speaker,
        kind: r.kind,
        body: this.#seal.open(r.body, aad(orgId, id, `turn-${r.seq}`)),
        code: this.#seal.open(r.code, aad(orgId, id, `code-${r.seq}`)),
        language: r.language,
        at: new Date(r.at).toISOString(),
        prevHash: r.prev_hash,
        hash: r.hash.trim(),
      }));
    });
  }

  /** Appends turns after the last one, chained to it. Throws {@link TurnTaken} if another request wrote first. */
  async append(orgId: OrgId, id: string, after: readonly AiTurn[], next: readonly NewTurn[]): Promise<readonly AiTurn[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      let prev = after.at(-1)?.hash ?? GENESIS;
      let seq = after.length;
      const written: AiTurn[] = [];
      for (const t of next) {
        const hash = turnHash(prev, seq, t);
        try {
          await tx.query(
            `INSERT INTO ai_interview_turns (org_id, interview_id, seq, speaker, kind, body, code, language, at, prev_hash, hash)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [orgId, id, seq, t.speaker, t.kind, this.#seal.text(t.body, aad(orgId, id, `turn-${seq}`)), this.#seal.text(t.code, aad(orgId, id, `code-${seq}`)), t.language, t.at, prev, hash],
          );
        } catch (error) {
          if ((error as { code?: string }).code === "23505") throw new TurnTaken();
          throw error;
        }
        written.push({ ...t, seq, prevHash: prev, hash });
        prev = hash;
        seq++;
      }
      return [...after, ...written];
    });
  }

  /**
   * Interviews finished or cancelled before `before`, and invitations never
   * taken up since then, with their transcripts: removed by the retention
   * sweep (T1). Returns how many.
   */
  async sweep(orgId: OrgId, before: Date): Promise<number> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (
        await tx.query(
          `DELETE FROM ai_interviews WHERE org_id = $1
             AND ((status IN ('done', 'cancelled') AND COALESCE(ended_at, created_at) < $2) OR (status = 'invited' AND created_at < $2))
           RETURNING id`,
          [orgId, before.toISOString()],
        )
      ).length,
    );
  }
}
