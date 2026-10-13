import type { OrgId } from "@parikshaa/core";
import { hireScoped, hireStaff } from "./candidate-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * A company's jobs for Hire (docs/HIRE-V2.md §1; H2a, migration 0071): what
 * the job is, the screening questions, and the rounds an applicant goes
 * through. Everything here is the organisation's own, read and written in its
 * staff scope; the rules about what may be published live in the service.
 */

export type WorkMode = "onsite" | "hybrid" | "remote";
export type Employment = "full_time" | "internship" | "contract";
/** held: waiting for Parikshaa, because its wording asks applicants for money (S18). */
export type JobStatus = "draft" | "held" | "open" | "paused" | "closed";
export type RoundKind = "screen" | "assessment" | "ai_interview" | "interview" | "review" | "offer";

/** A question asked on applying; a knockout one ends the application when the answer misses (S23: never a protected topic). */
export interface ScreeningQuestion {
  readonly id: string;
  readonly text: string;
  readonly kind: "yes_no" | "number" | "choice" | "text";
  readonly options?: readonly string[] | undefined;
  readonly required: boolean;
  readonly knockout?:
    | {
        readonly equals?: "yes" | "no" | undefined;
        readonly min?: number | undefined;
        readonly max?: number | undefined;
        readonly oneOf?: readonly string[] | undefined;
      }
    | undefined;
}

/** What a company writes about a job. */
export interface JobFields {
  readonly title: string;
  readonly roleId: string | null;
  readonly department: string;
  readonly location: string;
  readonly workMode: WorkMode;
  readonly employment: Employment;
  readonly expMin: number;
  readonly expMax: number | null;
  readonly ctcMinLpa: number | null;
  readonly ctcMaxLpa: number | null;
  readonly showCtc: boolean;
  readonly openings: number;
  readonly skillsMust: readonly string[];
  readonly skillsNice: readonly string[];
  readonly description: string;
  readonly questions: readonly ScreeningQuestion[];
  readonly noteToCandidates: string;
  /** A line added to this job's rejection mails (P14): polite, never a reason. Empty: none. */
  readonly rejectionLine: string;
  readonly contactEmail: string | null;
  /** YYYY-MM-DD: applying closes at the end of this day, India time. */
  readonly applyBy: string | null;
  readonly autoScreen: boolean;
  readonly screenThreshold: number;
  readonly screenDailyMax: number;
  readonly maxApplicants: number | null;
  readonly reapplyAfterDays: number;
  readonly reviewSlaDays: number;
  /** Staff user ids: the hiring managers, who review and decide on this job alone. */
  readonly managers: readonly string[];
}

export interface RoundFields {
  readonly kind: RoundKind;
  readonly title: string;
  readonly config: Readonly<Record<string, unknown>>;
}

export interface Round extends RoundFields {
  readonly id: string;
  readonly position: number;
}

export interface Job extends JobFields {
  readonly id: string;
  readonly status: JobStatus;
  readonly heldReason: string | null;
  readonly publicCode: string | null;
  readonly createdBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  readonly closedAt: string | null;
  readonly rounds: readonly Round[];
}

/** A row of the Jobs list: the job and where its applicants stand. */
export interface JobSummary {
  readonly id: string;
  readonly title: string;
  readonly status: JobStatus;
  readonly publicCode: string | null;
  readonly location: string;
  readonly openings: number;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  readonly applicants: number;
  readonly active: number;
  readonly hired: number;
  readonly newToday: number;
  /** Active applicants in each round, by round id. */
  readonly byRound: Readonly<Record<string, number>>;
}

export class PublicCodeTaken extends Error {
  constructor() {
    super("That job address is taken");
    this.name = "PublicCodeTaken";
  }
}

interface JobRow {
  id: string;
  title: string;
  role_id: string | null;
  department: string;
  location: string;
  work_mode: WorkMode;
  employment: Employment;
  exp_min: number;
  exp_max: number | null;
  ctc_min_lpa: number | null;
  ctc_max_lpa: number | null;
  show_ctc: boolean;
  openings: number;
  skills_must: string[];
  skills_nice: string[];
  description: string;
  questions: ScreeningQuestion[] | string;
  note_to_candidates: string;
  rejection_line: string;
  contact_email: string | null;
  apply_by: string | null;
  status: JobStatus;
  held_reason: string | null;
  public_code: string | null;
  auto_screen: boolean;
  screen_threshold: number;
  screen_daily_max: number;
  max_applicants: number | null;
  reapply_after_days: number;
  review_sla_days: number;
  managers: string[];
  created_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  published_at: string | Date | null;
  closed_at: string | Date | null;
}

const JOB_COLUMNS = `id, title, role_id, department, location, work_mode, employment, exp_min, exp_max,
  ctc_min_lpa::float8 AS ctc_min_lpa, ctc_max_lpa::float8 AS ctc_max_lpa, show_ctc, openings, skills_must, skills_nice,
  description, questions, note_to_candidates, rejection_line, contact_email, to_char(apply_by, 'YYYY-MM-DD') AS apply_by, status,
  held_reason, public_code, auto_screen, screen_threshold, screen_daily_max, max_applicants, reapply_after_days,
  review_sla_days, managers, created_by, created_at, updated_at, published_at, closed_at`;

const iso = (d: string | Date) => new Date(d).toISOString();
const isoOrNull = (d: string | Date | null) => (d === null ? null : iso(d));
const json = <T>(value: T | string): T => (typeof value === "string" ? (JSON.parse(value) as T) : value);
const isUnique = (error: unknown) => (error as { code?: string }).code === "23505";

function toJob(r: JobRow, rounds: readonly Round[]): Job {
  return {
    id: r.id,
    title: r.title,
    roleId: r.role_id,
    department: r.department,
    location: r.location,
    workMode: r.work_mode,
    employment: r.employment,
    expMin: r.exp_min,
    expMax: r.exp_max,
    ctcMinLpa: r.ctc_min_lpa,
    ctcMaxLpa: r.ctc_max_lpa,
    showCtc: r.show_ctc,
    openings: r.openings,
    skillsMust: r.skills_must,
    skillsNice: r.skills_nice,
    description: r.description,
    questions: json(r.questions),
    noteToCandidates: r.note_to_candidates,
    rejectionLine: r.rejection_line,
    contactEmail: r.contact_email,
    applyBy: r.apply_by,
    status: r.status,
    heldReason: r.held_reason,
    publicCode: r.public_code,
    autoScreen: r.auto_screen,
    screenThreshold: r.screen_threshold,
    screenDailyMax: r.screen_daily_max,
    maxApplicants: r.max_applicants,
    reapplyAfterDays: r.reapply_after_days,
    reviewSlaDays: r.review_sla_days,
    managers: r.managers,
    createdBy: r.created_by,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    publishedAt: isoOrNull(r.published_at),
    closedAt: isoOrNull(r.closed_at),
    rounds,
  };
}

/** The writable fields as SQL parameters, $3 onwards, in the order of FIELD_COLUMNS. */
const FIELD_COLUMNS = [
  "title",
  "role_id",
  "department",
  "location",
  "work_mode",
  "employment",
  "exp_min",
  "exp_max",
  "ctc_min_lpa",
  "ctc_max_lpa",
  "show_ctc",
  "openings",
  "skills_must",
  "skills_nice",
  "description",
  "questions",
  "note_to_candidates",
  "rejection_line",
  "contact_email",
  "apply_by",
  "auto_screen",
  "screen_threshold",
  "screen_daily_max",
  "max_applicants",
  "reapply_after_days",
  "review_sla_days",
  "managers",
] as const;

const fieldValues = (f: JobFields): unknown[] => [
  f.title,
  f.roleId,
  f.department,
  f.location,
  f.workMode,
  f.employment,
  f.expMin,
  f.expMax,
  f.ctcMinLpa,
  f.ctcMaxLpa,
  f.showCtc,
  f.openings,
  [...f.skillsMust],
  [...f.skillsNice],
  f.description,
  JSON.stringify(f.questions),
  f.noteToCandidates,
  f.rejectionLine,
  f.contactEmail,
  f.applyBy,
  f.autoScreen,
  f.screenThreshold,
  f.screenDailyMax,
  f.maxApplicants,
  f.reapplyAfterDays,
  f.reviewSlaDays,
  [...f.managers],
];

export class HireStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  async #rounds(tx: SqlExecutor, orgId: OrgId, jobIds: readonly string[]): Promise<Map<string, Round[]>> {
    const rows = await tx.query<{ job_id: string; id: string; position: number; kind: RoundKind; title: string; config: Record<string, unknown> | string }>(
      `SELECT job_id, id, position, kind, title, config FROM hire_rounds WHERE org_id = $1 AND job_id = ANY($2) ORDER BY job_id, position`,
      [orgId, [...jobIds]],
    );
    const byJob = new Map<string, Round[]>();
    for (const r of rows) {
      const list = byJob.get(r.job_id) ?? [];
      list.push({ id: r.id, position: r.position, kind: r.kind, title: r.title, config: json(r.config) });
      byJob.set(r.job_id, list);
    }
    return byJob;
  }

  async #job(tx: SqlExecutor, orgId: OrgId, id: string): Promise<Job | null> {
    const rows = await tx.query<JobRow>(`SELECT ${JOB_COLUMNS} FROM hire_jobs WHERE org_id = $1 AND id = $2`, [orgId, id]);
    if (rows[0] === undefined) return null;
    return toJob(rows[0], (await this.#rounds(tx, orgId, [id])).get(id) ?? []);
  }

  async #writeRounds(tx: SqlExecutor, orgId: OrgId, jobId: string, rounds: readonly (RoundFields & { readonly id?: string | undefined })[]): Promise<void> {
    const keep = rounds.map((r) => r.id).filter((id): id is string => id !== undefined);
    await tx.query(`DELETE FROM hire_rounds WHERE org_id = $1 AND job_id = $2 AND NOT (id = ANY($3))`, [orgId, jobId, keep]);
    for (const [position, r] of rounds.entries()) {
      if (r.id === undefined) {
        await tx.query(`INSERT INTO hire_rounds (org_id, id, job_id, position, kind, title, config) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
          orgId,
          this.#newId(),
          jobId,
          position,
          r.kind,
          r.title,
          JSON.stringify(r.config),
        ]);
      } else {
        const updated = await tx.query(
          `UPDATE hire_rounds SET position = $4, kind = $5, title = $6, config = $7 WHERE org_id = $1 AND job_id = $2 AND id = $3 RETURNING id`,
          [orgId, jobId, r.id, position, r.kind, r.title, JSON.stringify(r.config)],
        );
        if (updated.length === 0) throw new Error(`No round ${r.id} in this job`);
      }
    }
  }

  async createJob(orgId: OrgId, job: { readonly id: string; readonly fields: JobFields; readonly rounds: readonly RoundFields[]; readonly createdBy: string | null; readonly now: Date }): Promise<Job> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const placeholders = FIELD_COLUMNS.map((_, i) => `$${i + 3}`).join(", ");
      const n = FIELD_COLUMNS.length;
      await tx.query(
        `INSERT INTO hire_jobs (org_id, id, ${FIELD_COLUMNS.join(", ")}, created_by, created_at, updated_at)
         VALUES ($1, $2, ${placeholders}, $${n + 3}, $${n + 4}, $${n + 4})`,
        [orgId, job.id, ...fieldValues(job.fields), job.createdBy, job.now],
      );
      await this.#writeRounds(tx, orgId, job.id, job.rounds);
      return (await this.#job(tx, orgId, job.id))!;
    });
  }

  async job(orgId: OrgId, id: string): Promise<Job | null> {
    return hireScoped(this.#sql, hireStaff(orgId), (tx) => this.#job(tx, orgId, id));
  }

  /** Change what the job says, and its rounds; a round given with its id keeps it. Null if there is no such job. */
  async updateJob(orgId: OrgId, id: string, fields: JobFields, rounds: readonly (RoundFields & { readonly id?: string | undefined })[], now: Date): Promise<Job | null> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const sets = FIELD_COLUMNS.map((c, i) => `${c} = $${i + 3}`).join(", ");
      const updated = await tx.query(
        `UPDATE hire_jobs SET ${sets}, updated_at = $${FIELD_COLUMNS.length + 3} WHERE org_id = $1 AND id = $2 RETURNING id`,
        [orgId, id, ...fieldValues(fields), now],
      );
      if (updated.length === 0) return null;
      await this.#writeRounds(tx, orgId, id, rounds);
      return this.#job(tx, orgId, id);
    });
  }

  /**
   * Move a job to another status. `publicCode` is set only when the job has
   * none yet, so a job keeps its address for good. Null if there is no such job.
   */
  async setStatus(
    orgId: OrgId,
    id: string,
    change: { readonly status: JobStatus; readonly now: Date; readonly publicCode?: string; readonly heldReason?: string | null },
  ): Promise<Job | null> {
    try {
      return await hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
        const updated = await tx.query(
          `UPDATE hire_jobs
              SET status = $3, updated_at = $4,
                  public_code = coalesce(public_code, $5),
                  held_reason = $6,
                  published_at = CASE WHEN $3 = 'open' THEN coalesce(published_at, $4) ELSE published_at END,
                  closed_at = CASE WHEN $3 = 'closed' THEN $4 ELSE NULL END
            WHERE org_id = $1 AND id = $2 RETURNING id`,
          [orgId, id, change.status, change.now, change.publicCode ?? null, change.heldReason ?? null],
        );
        return updated.length === 0 ? null : this.#job(tx, orgId, id);
      });
    } catch (error) {
      if (isUnique(error)) throw new PublicCodeTaken();
      throw error;
    }
  }

  /** How many of the organisation's jobs take applications now. */
  async openJobs(orgId: OrgId): Promise<number> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM hire_jobs WHERE org_id = $1 AND status = 'open'`, [orgId]))[0]!.n);
  }

  /** The Jobs list, newest first, with where each job's applicants stand. */
  async jobs(orgId: OrgId, now: Date, options: { readonly status?: JobStatus } = {}): Promise<readonly JobSummary[]> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{
        id: string;
        title: string;
        status: JobStatus;
        public_code: string | null;
        location: string;
        openings: number;
        created_at: string | Date;
        published_at: string | Date | null;
        applicants: number;
        active: number;
        hired: number;
        new_today: number;
      }>(
        `SELECT j.id, j.title, j.status, j.public_code, j.location, j.openings, j.created_at, j.published_at,
                count(a.id) FILTER (WHERE a.status NOT IN ('invited', 'not_claimed'))::int AS applicants,
                count(a.id) FILTER (WHERE a.status = 'active')::int AS active,
                count(a.id) FILTER (WHERE a.status IN ('hired', 'joined'))::int AS hired,
                count(a.id) FILTER (WHERE a.created_at > $2 AND a.status NOT IN ('invited', 'not_claimed'))::int AS new_today
           FROM hire_jobs j LEFT JOIN hire_applications a ON a.org_id = j.org_id AND a.job_id = j.id
          WHERE j.org_id = $1 AND ($3::text IS NULL OR j.status = $3)
          GROUP BY j.org_id, j.id
          ORDER BY j.created_at DESC
          LIMIT 500`,
        [orgId, new Date(now.getTime() - 24 * 3_600_000), options.status ?? null],
      );
      const counts = await tx.query<{ job_id: string; round_id: string; n: number }>(
        `SELECT job_id, round_id, count(*)::int AS n FROM hire_applications
          WHERE org_id = $1 AND status = 'active' AND round_id IS NOT NULL AND job_id = ANY($2)
          GROUP BY job_id, round_id`,
        [orgId, rows.map((r) => r.id)],
      );
      const byJob = new Map<string, Record<string, number>>();
      for (const c of counts) byJob.set(c.job_id, { ...(byJob.get(c.job_id) ?? {}), [c.round_id]: c.n });
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        publicCode: r.public_code,
        location: r.location,
        openings: r.openings,
        createdAt: iso(r.created_at),
        publishedAt: isoOrNull(r.published_at),
        applicants: r.applicants,
        active: r.active,
        hired: r.hired,
        newToday: r.new_today,
        byRound: byJob.get(r.id) ?? {},
      }));
    });
  }

  /**
   * A job as its public page shows it, by the address it was given: one that
   * was published (open, paused or closed). A draft or a held job has no page.
   */
  async publishedJob(orgId: OrgId, publicCode: string): Promise<Job | null> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `SELECT id FROM hire_jobs WHERE org_id = $1 AND public_code = $2 AND status IN ('open', 'paused', 'closed')`,
        [orgId, publicCode],
      );
      return rows[0] === undefined ? null : this.#job(tx, orgId, rows[0].id);
    });
  }

  /** The jobs taking applications now, for the careers page: newest first. */
  async openJobList(orgId: OrgId): Promise<readonly Job[]> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<JobRow>(`SELECT ${JOB_COLUMNS} FROM hire_jobs WHERE org_id = $1 AND status = 'open' ORDER BY published_at DESC, id LIMIT 200`, [orgId]);
      return rows.map((r) => toJob(r, []));
    });
  }

  /** Remove a draft that never took an application. False if it is not a draft or has applications. */
  async deleteDraft(orgId: OrgId, id: string): Promise<boolean> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query(
        `DELETE FROM hire_jobs WHERE org_id = $1 AND id = $2 AND status = 'draft'
           AND NOT EXISTS (SELECT 1 FROM hire_applications a WHERE a.org_id = $1 AND a.job_id = $2) RETURNING id`,
        [orgId, id],
      );
      return rows.length > 0;
    });
  }

  /** Whether any application has reached this round: such a round may change, not go. */
  async roundsInUse(orgId: OrgId, jobId: string): Promise<ReadonlySet<string>> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) => {
      const rows = await tx.query<{ round_id: string }>(
        `SELECT DISTINCT r.round_id FROM hire_round_results r JOIN hire_rounds x ON x.org_id = r.org_id AND x.id = r.round_id
          WHERE r.org_id = $1 AND x.job_id = $2
         UNION
         SELECT DISTINCT round_id FROM hire_applications WHERE org_id = $1 AND job_id = $2 AND round_id IS NOT NULL`,
        [orgId, jobId],
      );
      return new Set(rows.map((r) => r.round_id));
    });
  }
}
