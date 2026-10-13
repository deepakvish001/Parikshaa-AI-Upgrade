import type { OrgId } from "@parikshaa/core";
import type { BlobStore } from "./blobs.js";
import { hireApplicant, hireScoped, hireStaff } from "./candidate-store.js";
import { HireApplicationStore, type ApplicationSource, type ApplicationStatus, type RoundResultStatus } from "./hire-application-store.js";
import { enqueue, type OutboxDraft } from "./outbox-store.js";
import { NO_SEAL, type RecordSeal } from "./sealing.js";
import type { SqlExecutor } from "./sql.js";

/**
 * A job's pipeline (docs/HIRE-V2.md §5, §10 S4, P13–P15, P20, B9; H2c,
 * migration 0073): where each application stands, and what the company does
 * with it: move it to another round, reject it, restore it, write a note
 * about it or a message to the candidate.
 *
 * Reading the pipeline is one plain query over the tables (P15): each
 * application with its current round's result, every round's status and
 * score, the AI screening's reading and the integrity level (`not_checked`
 * when nothing has been checked yet).
 *
 * Every change writes its event, and any mail it causes, in the same
 * transaction. Events the candidate sees (moved, rejected, restored, message)
 * carry no reason, score or staff name in their detail; notes and overrides
 * are never theirs to see (the database refuses it, S4). Free text (notes,
 * messages, override reasons) is sealed under the "hire" record key, bound to
 * the application and the event.
 *
 * Who may do what is the service's to check: this store is given ids, and
 * writes in the organisation's staff scope.
 */

/** Why the company turned an application down (P20). Never told to the candidate. */
export type RejectReason = "skills" | "experience" | "ctc" | "notice" | "location" | "integrity" | "no_show" | "candidate_declined" | "filled" | "other";
export const REJECT_REASONS: readonly RejectReason[] = ["skills", "experience", "ctc", "notice", "location", "integrity", "no_show", "candidate_declined", "filled", "other"];
export type IntegrityLevel = "not_checked" | "clear" | "review" | "high";
export type ScreenRecommendation = "advance" | "hold" | "low_match";

export interface PipelineFilter {
  /** Applications whose current round is this one. */
  readonly roundId?: string | undefined;
  readonly status?: ApplicationStatus | undefined;
  /** Part of the name, or the ref. */
  readonly search?: string | undefined;
  readonly recommendation?: ScreenRecommendation | undefined;
  readonly integrity?: IntegrityLevel | undefined;
  /** Active ones that have been in their round longer than the job's `review_sla_days` (P13). */
  readonly pastSla?: boolean | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

/** Where an application stands in one round. */
export interface RoundState {
  readonly status: RoundResultStatus;
  readonly score: number | null;
}

/** One row of the pipeline table. No contact details: those are the drawer's (S22). */
export interface PipelineRow {
  readonly id: string;
  readonly ref: string;
  readonly name: string;
  readonly status: ApplicationStatus;
  readonly rejectReason: RejectReason | null;
  readonly roundId: string | null;
  /** Since when it has been in its current round. */
  readonly roundSince: string;
  readonly pastSla: boolean;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly source: ApplicationSource;
  readonly sourceTag: string | null;
  /** Its result in the current round, if any. */
  readonly current: RoundState | null;
  /** Every round it has a result in, by round id. */
  readonly rounds: Readonly<Record<string, RoundState>>;
  readonly screening: { readonly status: "done" | "failed" | "skipped"; readonly score: number | null; readonly recommendation: ScreenRecommendation | null } | null;
  readonly integrity: { readonly level: IntegrityLevel; readonly verdict: "genuine" | "not_genuine" | null };
}

export interface Pipeline {
  /** The rows the filter matches, in the order they applied, up to the limit. */
  readonly rows: readonly PipelineRow[];
  /** How many rows the filter matches in all. */
  readonly total: number;
  /** Over the whole job, whatever the filter: active applications in each round, and applications in each status. */
  readonly counts: {
    readonly byRound: Readonly<Record<string, number>>;
    readonly byStatus: Readonly<Record<string, number>>;
    readonly pastSla: number;
  };
}

/** One entry of an application's timeline, opened. `text`: of a note, a message or an override's reason. */
export interface TimelineEvent {
  readonly id: string;
  readonly at: string;
  readonly kind: string;
  readonly roundId: string | null;
  /** A staff user's id, or "candidate" or "system". */
  readonly by: string;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly text: string | null;
  readonly candidateVisible: boolean;
}

/** Everything the company holds about one application, opened: the drawer. The resume file is read on its own. */
export interface ApplicationDetail {
  readonly id: string;
  readonly jobId: string;
  readonly candidateId: string | null;
  readonly ref: string;
  readonly status: ApplicationStatus;
  readonly statusReason: string | null;
  readonly rejectReason: RejectReason | null;
  readonly roundId: string | null;
  readonly roundSince: string;
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly source: ApplicationSource;
  readonly sourceTag: string | null;
  readonly referrer: string | null;
  readonly aiOptOut: boolean;
  readonly deviceReady: boolean | null;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly profile: unknown;
  readonly answers: Readonly<Record<string, string | number | null>>;
  readonly resume: { readonly name: string; readonly type: "pdf" | "docx"; readonly text: string } | null;
  readonly results: readonly {
    readonly roundId: string;
    readonly status: RoundResultStatus;
    readonly score: number | null;
    readonly detail: Readonly<Record<string, unknown>>;
    readonly invitedAt: string | null;
    readonly completedAt: string | null;
    readonly decidedBy: string | null;
    readonly decidedAt: string | null;
  }[];
  readonly screening: PipelineRow["screening"];
  readonly integrity: PipelineRow["integrity"];
  readonly events: readonly TimelineEvent[];
}

export type MoveOutcome = "moved" | "not_active" | "same_round" | "last_round" | "integrity_high" | "not_found";
export type RejectOutcome = "rejected" | "not_active" | "not_found";
export type RestoreOutcome = "restored" | "not_rejected" | "newer_application" | "not_found";

/** A round of the job, as moving needs it. */
interface RoundRow {
  id: string;
  position: number;
  config: Record<string, unknown> | string;
}

const iso = (d: string | Date) => new Date(d).toISOString();
const isoOrNull = (d: string | Date | null) => (d === null ? null : iso(d));
const json = <T>(value: T | string): T => (typeof value === "string" ? (JSON.parse(value) as T) : value);
const num = (v: string | number | null) => (v === null ? null : Number(v));
const isUnique = (error: unknown) => (error as { code?: string }).code === "23505";
const DAY = 86_400_000;
/** A rejection mail waits this long, so a mistake can be undone before the candidate hears of it (P14). */
export const REJECTION_MAIL_DELAY_MS = DAY;
/** Kinds whose detail holds sealed free text. */
const SEALED_TEXT = new Set(["note", "message", "override"]);

export class HirePipelineStore {
  readonly #sql: SqlExecutor;
  readonly #seal: RecordSeal;
  readonly #newId: () => string;
  readonly #blobs: BlobStore | null;

  constructor(sql: SqlExecutor, seal: RecordSeal = NO_SEAL, options: { readonly newId?: () => string; readonly blobs?: BlobStore | null } = {}) {
    this.#sql = sql;
    this.#seal = seal;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.#blobs = options.blobs ?? null;
  }

  #aad(orgId: string, applicationId: string, eventId: string): string {
    return HireApplicationStore.aad(orgId, applicationId, `event:${eventId}`);
  }

  async #event(
    tx: SqlExecutor,
    orgId: OrgId,
    e: {
      readonly applicationId: string;
      readonly candidateId: string | null;
      readonly kind: string;
      readonly roundId: string | null;
      readonly by: string;
      readonly detail?: Record<string, unknown>;
      readonly text?: string;
      readonly visible: boolean;
      readonly at: Date;
    },
  ): Promise<string> {
    const id = this.#newId();
    const detail = { ...(e.detail ?? {}), ...(e.text === undefined ? {} : { text: this.#seal.text(e.text, this.#aad(orgId, e.applicationId, id)) }) };
    await tx.query(
      `INSERT INTO hire_events (org_id, id, application_id, candidate_id, at, kind, round_id, by, detail, candidate_visible)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [orgId, id, e.applicationId, e.candidateId, e.at, e.kind, e.roundId, e.by, JSON.stringify(detail), e.visible],
    );
    return id;
  }

  // --- reading ------------------------------------------------------------------

  /**
   * A job's pipeline: the applications the filter matches, with where each
   * stands, in one query; and the counts by round and status over the whole
   * job. Erased applications are left out.
   */
  async pipeline(orgId: OrgId, jobId: string, filter: PipelineFilter, now: Date): Promise<Pipeline> {
    const limit = Math.min(Math.max(filter.limit ?? 1000, 1), 1000);
    const offset = Math.max(filter.offset ?? 0, 0);
    const search = filter.search?.trim() ?? "";
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{
        id: string;
        ref: string;
        name: string;
        status: ApplicationStatus;
        reject_reason: RejectReason | null;
        round_id: string | null;
        round_since: string | Date;
        past_sla: boolean;
        created_at: string | Date;
        decided_at: string | Date | null;
        source: ApplicationSource;
        source_tag: string | null;
        results: Record<string, { status: RoundResultStatus; score: string | number | null }> | string;
        screen_status: "done" | "failed" | "skipped" | null;
        screen_score: number | null;
        recommendation: ScreenRecommendation | null;
        integrity: IntegrityLevel;
        verdict: "genuine" | "not_genuine" | null;
        total: number;
      }>(
        `WITH matching AS (
           SELECT a.org_id, a.id, a.ref, a.name, a.status, a.reject_reason, a.round_id, a.round_since, a.created_at,
                  a.decided_at, a.source, a.source_tag,
                  (a.status = 'active' AND a.round_since < $3::timestamptz - make_interval(days => j.review_sla_days)) AS past_sla,
                  s.status AS screen_status, s.score AS screen_score, s.recommendation,
                  coalesce(i.level, 'not_checked') AS integrity, i.verdict
             FROM hire_applications a
             JOIN hire_jobs j ON j.org_id = a.org_id AND j.id = a.job_id
             LEFT JOIN hire_screenings s ON s.org_id = a.org_id AND s.application_id = a.id
             LEFT JOIN hire_integrity i ON i.org_id = a.org_id AND i.application_id = a.id
            WHERE a.org_id = $1 AND a.job_id = $2 AND a.erased_at IS NULL
              AND ($4::text IS NULL OR a.round_id = $4)
              AND ($5::text IS NULL OR a.status = $5)
              AND ($6::text = '' OR a.name ILIKE '%' || $6 || '%' OR a.ref = upper($6))
              AND ($7::text IS NULL OR s.recommendation = $7)
              AND ($8::text IS NULL OR coalesce(i.level, 'not_checked') = $8)
         ), page AS (
           SELECT m.*, count(*) OVER ()::int AS total FROM matching m
            WHERE NOT $9::boolean OR m.past_sla
            ORDER BY m.created_at, m.id
            LIMIT $10 OFFSET $11
         )
         SELECT p.*,
                coalesce((SELECT jsonb_object_agg(r.round_id, jsonb_build_object('status', r.status, 'score', r.score))
                            FROM hire_round_results r WHERE r.org_id = p.org_id AND r.application_id = p.id), '{}'::jsonb) AS results
           FROM page p ORDER BY p.created_at, p.id`,
        [
          orgId,
          jobId,
          now,
          filter.roundId ?? null,
          filter.status ?? null,
          search.replace(/[\\%_]/g, (c) => `\\${c}`),
          filter.recommendation ?? null,
          filter.integrity ?? null,
          filter.pastSla === true,
          limit,
          offset,
        ],
      );
      const counts = await tx.query<{ round_id: string | null; status: ApplicationStatus; past_sla: number; n: number }>(
        `SELECT a.round_id, a.status, count(*)::int AS n,
                count(*) FILTER (WHERE a.status = 'active' AND a.round_since < $3::timestamptz - make_interval(days => j.review_sla_days))::int AS past_sla
           FROM hire_applications a JOIN hire_jobs j ON j.org_id = a.org_id AND j.id = a.job_id
          WHERE a.org_id = $1 AND a.job_id = $2 AND a.erased_at IS NULL
          GROUP BY a.round_id, a.status`,
        [orgId, jobId, now],
      );
      const byRound: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      let pastSla = 0;
      for (const c of counts) {
        byStatus[c.status] = (byStatus[c.status] ?? 0) + c.n;
        if (c.status === "active" && c.round_id !== null) byRound[c.round_id] = (byRound[c.round_id] ?? 0) + c.n;
        pastSla += c.past_sla;
      }
      return {
        total: rows[0]?.total ?? 0,
        counts: { byRound, byStatus, pastSla },
        rows: rows.map((r) => {
          const results = Object.fromEntries(Object.entries(json(r.results)).map(([round, x]) => [round, { status: x.status, score: num(x.score) }]));
          return {
            id: r.id,
            ref: r.ref,
            name: r.name,
            status: r.status,
            rejectReason: r.reject_reason,
            roundId: r.round_id,
            roundSince: iso(r.round_since),
            pastSla: r.past_sla,
            createdAt: iso(r.created_at),
            decidedAt: isoOrNull(r.decided_at),
            source: r.source,
            sourceTag: r.source_tag,
            current: r.round_id === null ? null : (results[r.round_id] ?? null),
            rounds: results,
            screening: r.screen_status === null ? null : { status: r.screen_status, score: r.screen_score, recommendation: r.recommendation },
            integrity: { level: r.integrity, verdict: r.verdict },
          };
        }),
      };
    });
  }

  /** The job an application belongs to, or null if there is no such application here. */
  async jobOf(orgId: OrgId, applicationId: string): Promise<string | null> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{ job_id: string }>(`SELECT job_id FROM hire_applications WHERE org_id = $1 AND id = $2 AND erased_at IS NULL`, [orgId, applicationId]);
      return rows[0]?.job_id ?? null;
    });
  }

  /** One application, everything opened: what the candidate gave, each round's result, the readings and the timeline. */
  async application(orgId: OrgId, applicationId: string): Promise<ApplicationDetail | null> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{
        id: string;
        job_id: string;
        candidate_id: string | null;
        ref: string;
        status: ApplicationStatus;
        status_reason: string | null;
        reject_reason: RejectReason | null;
        round_id: string | null;
        round_since: string | Date;
        created_at: string | Date;
        decided_at: string | Date | null;
        source: ApplicationSource;
        source_tag: string | null;
        referrer: string | null;
        ai_opt_out: boolean;
        device_ready: boolean | null;
        name: string;
        email: string;
        phone: string | null;
        profile: string | null;
        answers: string | null;
        resume_text: string | null;
        resume_name: string | null;
        resume_type: "pdf" | "docx" | null;
        screen_status: "done" | "failed" | "skipped" | null;
        screen_score: number | null;
        recommendation: ScreenRecommendation | null;
        integrity: IntegrityLevel;
        verdict: "genuine" | "not_genuine" | null;
      }>(
        `SELECT a.id, a.job_id, a.candidate_id, a.ref, a.status, a.status_reason, a.reject_reason, a.round_id, a.round_since,
                a.created_at, a.decided_at, a.source, a.source_tag, a.referrer, a.ai_opt_out, a.device_ready, a.name, a.email,
                a.phone, a.profile, a.answers, a.resume_text, a.resume_name, a.resume_type,
                s.status AS screen_status, s.score AS screen_score, s.recommendation,
                coalesce(i.level, 'not_checked') AS integrity, i.verdict
           FROM hire_applications a
           LEFT JOIN hire_screenings s ON s.org_id = a.org_id AND s.application_id = a.id
           LEFT JOIN hire_integrity i ON i.org_id = a.org_id AND i.application_id = a.id
          WHERE a.org_id = $1 AND a.id = $2 AND a.erased_at IS NULL`,
        [orgId, applicationId],
      );
      const a = rows[0];
      if (a === undefined) return null;
      const results = await tx.query<{
        round_id: string;
        status: RoundResultStatus;
        score: string | number | null;
        detail: Record<string, unknown> | string;
        invited_at: string | Date | null;
        completed_at: string | Date | null;
        decided_by: string | null;
        decided_at: string | Date | null;
      }>(
        `SELECT r.round_id, r.status, r.score, r.detail, r.invited_at, r.completed_at, r.decided_by, r.decided_at
           FROM hire_round_results r JOIN hire_rounds x ON x.org_id = r.org_id AND x.id = r.round_id
          WHERE r.org_id = $1 AND r.application_id = $2 ORDER BY x.position`,
        [orgId, applicationId],
      );
      const events = await tx.query<{
        id: string;
        at: string | Date;
        kind: string;
        round_id: string | null;
        by: string;
        detail: Record<string, unknown> | string;
        candidate_visible: boolean;
      }>(`SELECT id, at, kind, round_id, by, detail, candidate_visible FROM hire_events WHERE org_id = $1 AND application_id = $2 ORDER BY at, id`, [
        orgId,
        applicationId,
      ]);
      const aad = (field: string) => HireApplicationStore.aad(orgId, a.id, field);
      const profile = this.#seal.open(a.profile, aad("profile"));
      const answers = this.#seal.open(a.answers, aad("answers"));
      return {
        id: a.id,
        jobId: a.job_id,
        candidateId: a.candidate_id,
        ref: a.ref,
        status: a.status,
        statusReason: a.status_reason,
        rejectReason: a.reject_reason,
        roundId: a.round_id,
        roundSince: iso(a.round_since),
        createdAt: iso(a.created_at),
        decidedAt: isoOrNull(a.decided_at),
        source: a.source,
        sourceTag: a.source_tag,
        referrer: a.referrer,
        aiOptOut: a.ai_opt_out,
        deviceReady: a.device_ready,
        name: a.name,
        email: this.#seal.open(a.email, aad("email")),
        phone: this.#seal.open(a.phone, aad("phone")),
        profile: profile === null ? null : JSON.parse(profile),
        answers: answers === null ? {} : JSON.parse(answers),
        resume: a.resume_name === null || a.resume_type === null ? null : { name: a.resume_name, type: a.resume_type, text: this.#seal.open(a.resume_text, aad("resume_text")) ?? "" },
        results: results.map((r) => ({
          roundId: r.round_id,
          status: r.status,
          score: num(r.score),
          detail: json(r.detail),
          invitedAt: isoOrNull(r.invited_at),
          completedAt: isoOrNull(r.completed_at),
          decidedBy: r.decided_by,
          decidedAt: isoOrNull(r.decided_at),
        })),
        screening: a.screen_status === null ? null : { status: a.screen_status, score: a.screen_score, recommendation: a.recommendation },
        integrity: { level: a.integrity, verdict: a.verdict },
        events: events.map((e) => this.#timeline(orgId, applicationId, e)),
      };
    });
  }

  #timeline(
    orgId: OrgId,
    applicationId: string,
    e: { id: string; at: string | Date; kind: string; round_id: string | null; by: string; detail: Record<string, unknown> | string; candidate_visible: boolean },
  ): TimelineEvent {
    const { text, ...detail } = json(e.detail);
    return {
      id: e.id,
      at: iso(e.at),
      kind: e.kind,
      roundId: e.round_id,
      by: e.by,
      detail,
      text: SEALED_TEXT.has(e.kind) && typeof text === "string" ? this.#seal.open(text, this.#aad(orgId, applicationId, e.id)) : null,
      candidateVisible: e.candidate_visible,
    };
  }

  /** The resume file the candidate gave with the application, opened. Null if there is none (or it was erased). */
  async resumeFile(orgId: OrgId, applicationId: string): Promise<{ readonly file: Buffer; readonly name: string; readonly type: "pdf" | "docx" } | null> {
    const row = await hireScoped(this.#sql, hireStaff(orgId), async (tx) =>
      (
        await tx.query<{ resume_file: Buffer | null; resume_key: string | null; resume_name: string | null; resume_type: "pdf" | "docx" | null }>(
          `SELECT resume_file, resume_key, resume_name, resume_type FROM hire_applications WHERE org_id = $1 AND id = $2 AND erased_at IS NULL`,
          [orgId, applicationId],
        )
      )[0],
    );
    if (row === undefined || row.resume_name === null || row.resume_type === null) return null;
    const sealed = row.resume_key !== null ? await this.#blobs?.get(row.resume_key) : row.resume_file;
    if (sealed == null) return null;
    return { file: this.#seal.openBytes(Buffer.from(sealed), HireApplicationStore.aad(orgId, applicationId, "resume_file")), name: row.resume_name, type: row.resume_type };
  }

  /**
   * The messages the company sent the candidate about one of their
   * applications, read in the candidate's own scope: the database gives them
   * only events marked for them, so never a note or an override (S4).
   */
  async thread(orgId: OrgId, candidateId: string, applicationId: string): Promise<readonly { readonly id: string; readonly at: string; readonly text: string }[]> {
    const rows = await hireScoped(this.#sql, hireApplicant(candidateId, orgId), (tx) =>
      tx.query<{ id: string; at: string | Date; detail: Record<string, unknown> | string }>(
        `SELECT id, at, detail FROM hire_events WHERE org_id = $1 AND application_id = $2 AND kind = 'message' ORDER BY at, id`,
        [orgId, applicationId],
      ),
    );
    return rows.map((r) => {
      const text = json(r.detail)["text"];
      return { id: r.id, at: iso(r.at), text: typeof text === "string" ? this.#seal.open(text, this.#aad(orgId, applicationId, r.id)) : "" };
    });
  }

  /** What a mail about a message needs: its text, opened. Null if the event is not a message of this application. */
  async messageText(orgId: OrgId, applicationId: string, eventId: string): Promise<string | null> {
    const rows = await hireScoped(this.#sql, hireStaff(orgId), (tx) =>
      tx.query<{ detail: Record<string, unknown> | string }>(`SELECT detail FROM hire_events WHERE org_id = $1 AND application_id = $2 AND id = $3 AND kind = 'message'`, [
        orgId,
        applicationId,
        eventId,
      ]),
    );
    const text = rows[0] === undefined ? undefined : json(rows[0].detail)["text"];
    return typeof text === "string" ? this.#seal.open(text, this.#aad(orgId, applicationId, eventId)) : null;
  }

  // --- changing -----------------------------------------------------------------

  /** The job's rounds in order, and the applications asked for, locked. */
  async #lock(tx: SqlExecutor, orgId: OrgId, jobId: string, ids: readonly string[]) {
    const rounds = await tx.query<RoundRow>(`SELECT id, position, config FROM hire_rounds WHERE org_id = $1 AND job_id = $2 ORDER BY position`, [orgId, jobId]);
    const apps = await tx.query<{ id: string; candidate_id: string | null; status: ApplicationStatus; round_id: string | null; level: IntegrityLevel; verdict: string | null }>(
      `SELECT a.id, a.candidate_id, a.status, a.round_id, coalesce(i.level, 'not_checked') AS level, i.verdict
         FROM hire_applications a LEFT JOIN hire_integrity i ON i.org_id = a.org_id AND i.application_id = a.id
        WHERE a.org_id = $1 AND a.job_id = $2 AND a.id = ANY($3) AND a.erased_at IS NULL
        ORDER BY a.id
          FOR UPDATE OF a`,
      [orgId, jobId, [...ids]],
    );
    return { rounds, apps: new Map(apps.map((a) => [a.id, a])) };
  }

  /** Set an application's result in a round, making the row if it has none. */
  async #result(tx: SqlExecutor, orgId: OrgId, applicationId: string, roundId: string, status: RoundResultStatus, decision: { readonly by: string; readonly at: Date } | null): Promise<void> {
    await tx.query(
      `INSERT INTO hire_round_results (org_id, application_id, round_id, status, decided_by, decided_at) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (org_id, application_id, round_id) DO UPDATE SET status = EXCLUDED.status, decided_by = EXCLUDED.decided_by, decided_at = EXCLUDED.decided_at`,
      [orgId, applicationId, roundId, status, decision?.by ?? null, decision?.at ?? null],
    );
  }

  /**
   * Move applications of a job to a round, or each to the round after its
   * own ("next"). Moving on marks the round it leaves `passed` (and any it
   * jumps over `skipped`); the round it reaches waits (`pending`). An
   * application whose integrity is `high` and not found genuine by a person
   * moves only with `overrideReason`, which is kept as its own private
   * event. A round set to tell the candidate (`sendOnMove`, P20) writes the
   * mail. Each id gets its own outcome.
   */
  async move(
    orgId: OrgId,
    jobId: string,
    ids: readonly string[],
    to: string | "next",
    by: string,
    now: Date,
    options: { readonly overrideReason?: string | undefined } = {},
  ): Promise<{ readonly roundFound: boolean; readonly results: readonly { readonly id: string; readonly outcome: MoveOutcome }[] }> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const { rounds, apps } = await this.#lock(tx, orgId, jobId, ids);
      if (to !== "next" && !rounds.some((r) => r.id === to)) return { roundFound: false, results: [] };
      const results: { id: string; outcome: MoveOutcome }[] = [];
      for (const id of ids) {
        const a = apps.get(id);
        if (a === undefined) {
          results.push({ id, outcome: "not_found" });
          continue;
        }
        if (a.status !== "active") {
          results.push({ id, outcome: "not_active" });
          continue;
        }
        const from = rounds.findIndex((r) => r.id === a.round_id);
        const target = to === "next" ? rounds[from + 1] : rounds.find((r) => r.id === to);
        if (target === undefined) {
          results.push({ id, outcome: "last_round" });
          continue;
        }
        if (target.id === a.round_id) {
          results.push({ id, outcome: "same_round" });
          continue;
        }
        const high = a.level === "high" && a.verdict !== "genuine";
        if (high && (options.overrideReason ?? "") === "") {
          results.push({ id, outcome: "integrity_high" });
          continue;
        }
        const decision = { by, at: now };
        if (from >= 0 && target.position > rounds[from]!.position) {
          await this.#result(tx, orgId, id, rounds[from]!.id, "passed", decision);
          for (const skipped of rounds.filter((r) => r.position > rounds[from]!.position && r.position < target.position)) {
            await this.#result(tx, orgId, id, skipped.id, "skipped", decision);
          }
        }
        await this.#result(tx, orgId, id, target.id, "pending", null);
        await tx.query(`UPDATE hire_applications SET round_id = $3, round_since = $4, updated_at = $4 WHERE org_id = $1 AND id = $2`, [orgId, id, target.id, now]);
        await this.#event(tx, orgId, { applicationId: id, candidateId: a.candidate_id, kind: "moved", roundId: target.id, by, detail: { from: a.round_id, to: target.id }, visible: true, at: now });
        if (high) {
          await this.#event(tx, orgId, {
            applicationId: id,
            candidateId: a.candidate_id,
            kind: "override",
            roundId: target.id,
            by,
            detail: { level: "high" },
            text: options.overrideReason!,
            visible: false,
            at: now,
          });
        }
        if (json(target.config)["sendOnMove"] === true) {
          await enqueue(tx, orgId, [{ kind: "hire", subject: { applicationId: id, roundId: target.id }, purpose: "mail_moved", id: `hire:${id}:moved:${target.id}:${now.getTime()}`, sendAfter: now }], this.#newId);
        }
        results.push({ id, outcome: "moved" });
      }
      return { roundFound: true, results };
    });
  }

  /**
   * Reject applications of a job that are still going: the reason is kept for
   * the company (P20), the current round is `failed`, and with `mail` a polite
   * mail waits a day before it goes (P14), so a Restore can still stop it.
   */
  async reject(
    orgId: OrgId,
    jobId: string,
    ids: readonly string[],
    rejectReason: RejectReason,
    by: string,
    now: Date,
    options: { readonly mail: boolean },
  ): Promise<readonly { readonly id: string; readonly outcome: RejectOutcome }[]> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const { apps } = await this.#lock(tx, orgId, jobId, ids);
      const results: { id: string; outcome: RejectOutcome }[] = [];
      for (const id of ids) {
        const a = apps.get(id);
        if (a === undefined || a.status !== "active") {
          results.push({ id, outcome: a === undefined ? "not_found" : "not_active" });
          continue;
        }
        await tx.query(
          `UPDATE hire_applications SET status = 'rejected', status_reason = 'company', reject_reason = $3, decided_at = $4, updated_at = $4
            WHERE org_id = $1 AND id = $2`,
          [orgId, id, rejectReason, now],
        );
        if (a.round_id !== null) await this.#result(tx, orgId, id, a.round_id, "failed", { by, at: now });
        await this.#event(tx, orgId, { applicationId: id, candidateId: a.candidate_id, kind: "rejected", roundId: a.round_id, by, visible: true, at: now });
        if (options.mail) {
          const mail: OutboxDraft = {
            kind: "hire",
            subject: { applicationId: id, decidedAt: now.toISOString() },
            purpose: "mail_rejected",
            id: `hire:${id}:rejected:${now.getTime()}`,
            sendAfter: new Date(now.getTime() + REJECTION_MAIL_DELAY_MS),
          };
          await enqueue(tx, orgId, [mail], this.#newId);
        }
        results.push({ id, outcome: "rejected" });
      }
      return results;
    });
  }

  /**
   * Bring a rejected application back to the round it was in. Never a
   * withdrawn one: the candidate took their consent back. Refused when the
   * same person has applied to the job again since (B9). A rejection mail
   * still waiting is not sent.
   */
  async restore(orgId: OrgId, applicationId: string, by: string, now: Date): Promise<RestoreOutcome> {
    try {
      return await hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
        const rows = await tx.query<{ job_id: string; candidate_id: string | null; status: ApplicationStatus; round_id: string | null; email_canonical_hash: string }>(
          `SELECT job_id, candidate_id, status, round_id, email_canonical_hash FROM hire_applications
            WHERE org_id = $1 AND id = $2 AND erased_at IS NULL FOR UPDATE`,
          [orgId, applicationId],
        );
        const a = rows[0];
        if (a === undefined) return "not_found";
        if (a.status !== "rejected") return "not_rejected";
        const newer = await tx.query(
          `SELECT 1 FROM hire_applications
            WHERE org_id = $1 AND job_id = $2 AND email_canonical_hash = $3 AND id <> $4 AND erased_at IS NULL
              AND status NOT IN ('rejected', 'withdrawn', 'did_not_join')`,
          [orgId, a.job_id, a.email_canonical_hash, applicationId],
        );
        if (newer.length > 0) return "newer_application";
        await tx.query(
          `UPDATE hire_applications SET status = 'active', status_reason = NULL, reject_reason = NULL, decided_at = NULL,
                  round_since = $3, updated_at = $3
            WHERE org_id = $1 AND id = $2`,
          [orgId, applicationId, now],
        );
        if (a.round_id !== null) await this.#result(tx, orgId, applicationId, a.round_id, "pending", null);
        await this.#event(tx, orgId, { applicationId, candidateId: a.candidate_id, kind: "restored", roundId: a.round_id, by, visible: true, at: now });
        await tx.query(
          `UPDATE outbox SET status = 'skipped', last_error = 'Restored before it was sent', locked_until = NULL
            WHERE org_id = $1 AND kind = 'hire' AND purpose = 'mail_rejected' AND status = 'pending' AND subject->>'applicationId' = $2`,
          [orgId, applicationId],
        );
        return "restored";
      });
    } catch (error) {
      // The same person's newer application went live at the same moment: the index says so.
      if (isUnique(error)) return "newer_application";
      throw error;
    }
  }

  /** A note about the application, for the company only (S4). Null if there is no such application. */
  async note(orgId: OrgId, applicationId: string, text: string, by: string, now: Date): Promise<string | null> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{ candidate_id: string | null; round_id: string | null }>(
        `SELECT candidate_id, round_id FROM hire_applications WHERE org_id = $1 AND id = $2 AND erased_at IS NULL`,
        [orgId, applicationId],
      );
      const a = rows[0];
      if (a === undefined) return null;
      return this.#event(tx, orgId, { applicationId, candidateId: a.candidate_id, kind: "note", roundId: a.round_id, by, text, visible: false, at: now });
    });
  }

  /**
   * A message to the candidate (P14): kept in the thread their portal shows,
   * and mailed. Not to someone who withdrew.
   */
  async message(orgId: OrgId, applicationId: string, text: string, by: string, now: Date): Promise<{ readonly outcome: "sent"; readonly eventId: string } | { readonly outcome: "not_found" | "withdrawn" }> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{ candidate_id: string | null; round_id: string | null; status: ApplicationStatus }>(
        `SELECT candidate_id, round_id, status FROM hire_applications WHERE org_id = $1 AND id = $2 AND erased_at IS NULL`,
        [orgId, applicationId],
      );
      const a = rows[0];
      if (a === undefined) return { outcome: "not_found" } as const;
      if (a.status === "withdrawn") return { outcome: "withdrawn" } as const;
      const eventId = await this.#event(tx, orgId, { applicationId, candidateId: a.candidate_id, kind: "message", roundId: a.round_id, by, text, visible: true, at: now });
      await enqueue(tx, orgId, [{ kind: "hire", subject: { applicationId, eventId }, purpose: "mail_message", id: `hire:${applicationId}:message:${eventId}`, sendAfter: now }], this.#newId);
      return { outcome: "sent", eventId } as const;
    });
  }
}
