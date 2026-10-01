import type { OrgId } from "@parikshaa/core";
import { practiceStaff } from "./practice-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Campus licences (Prep blueprint F16, migration 0038): cohorts of students a
 * college has bought Plus for, by email. Staff only; the server gives the Plus.
 */

function staff<T>(sql: SqlExecutor, orgId: OrgId, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const scope = practiceStaff(orgId);
  return sql.transaction(fn, { "parikshaa.org_id": scope.orgId, "parikshaa.actor": scope.actor, "parikshaa.attempt_id": "", "parikshaa.learner_id": "" });
}

const iso = (value: string | Date) => new Date(value).toISOString();

export interface Cohort {
  readonly id: string;
  readonly name: string;
  readonly plusDays: number;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface CohortMember {
  readonly cohortId: string;
  readonly email: string;
  /** The account that was given Plus, once it was. */
  readonly learnerId: string | null;
  readonly grantedAt: string | null;
  readonly plusUntil: string | null;
  readonly addedAt: string;
}

export interface CohortStudent {
  readonly cohortId: string;
  readonly email: string;
  readonly plusUntil: string | null;
  /** The live account with the address, if one has been made. */
  readonly learnerId: string | null;
  readonly name: string | null;
  readonly verified: boolean;
  readonly solved: number;
  readonly submissions: number;
  readonly lastActiveAt: string | null;
}

export class CohortNameTaken extends Error {
  constructor() {
    super("A cohort has that name already");
  }
}

type CohortRow = { id: string; name: string; plus_days: number; created_by: string; created_at: string | Date };
const cohortOf = (r: CohortRow): Cohort => ({ id: r.id, name: r.name, plusDays: r.plus_days, createdBy: r.created_by, createdAt: iso(r.created_at) });
type MemberRow = { cohort_id: string; email: string; learner_id: string | null; granted_at: string | Date | null; plus_until: string | Date | null; added_at: string | Date };
const memberOf = (r: MemberRow): CohortMember => ({
  cohortId: r.cohort_id,
  email: r.email,
  learnerId: r.learner_id,
  grantedAt: r.granted_at === null ? null : iso(r.granted_at),
  plusUntil: r.plus_until === null ? null : iso(r.plus_until),
  addedAt: iso(r.added_at),
});

export class PrepCampusStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  async cohorts(orgId: OrgId): Promise<readonly Cohort[]> {
    return staff(this.#sql, orgId, async (tx) =>
      (await tx.query<CohortRow>(`SELECT id, name, plus_days, created_by, created_at FROM prep_cohorts WHERE org_id = $1 ORDER BY created_at, name`, [orgId])).map(cohortOf),
    );
  }

  async cohort(orgId: OrgId, id: string): Promise<Cohort | null> {
    return staff(this.#sql, orgId, async (tx) => {
      const [row] = await tx.query<CohortRow>(`SELECT id, name, plus_days, created_by, created_at FROM prep_cohorts WHERE org_id = $1 AND id = $2`, [orgId, id]);
      return row === undefined ? null : cohortOf(row);
    });
  }

  async createCohort(orgId: OrgId, draft: { name: string; plusDays: number; createdBy: string }, at: Date = new Date()): Promise<Cohort> {
    return staff(this.#sql, orgId, async (tx) => {
      const taken = await tx.query(`SELECT 1 FROM prep_cohorts WHERE org_id = $1 AND lower(name) = lower($2)`, [orgId, draft.name]);
      if (taken.length > 0) throw new CohortNameTaken();
      const [row] = await tx.query<CohortRow>(
        `INSERT INTO prep_cohorts (org_id, id, name, plus_days, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, plus_days, created_by, created_at`,
        [orgId, this.#newId(), draft.name, draft.plusDays, draft.createdBy, at],
      );
      return cohortOf(row!);
    });
  }

  /** Every member of a cohort, or of every cohort. */
  async members(orgId: OrgId, cohortId?: string): Promise<readonly CohortMember[]> {
    return staff(this.#sql, orgId, async (tx) =>
      (
        await tx.query<MemberRow>(
          `SELECT cohort_id, email, learner_id, granted_at, plus_until, added_at FROM prep_cohort_members
           WHERE org_id = $1 AND ($2::text IS NULL OR cohort_id = $2) ORDER BY added_at, email`,
          [orgId, cohortId ?? null],
        )
      ).map(memberOf),
    );
  }

  /** Add addresses (lower case) to a cohort. Those in it already are left as they are. Returns the ones added. */
  async addMembers(orgId: OrgId, cohortId: string, emails: readonly string[], at: Date = new Date()): Promise<readonly string[]> {
    if (emails.length === 0) return [];
    return staff(this.#sql, orgId, async (tx) =>
      (
        await tx.query<{ email: string }>(
          `INSERT INTO prep_cohort_members (org_id, cohort_id, email, added_at)
           SELECT $1, $2, e, $4 FROM unnest($3::text[]) AS e
           ON CONFLICT DO NOTHING RETURNING email`,
          [orgId, cohortId, emails, at],
        )
      ).map((r) => r.email),
    );
  }

  /** The live accounts with these addresses (lower case). */
  async accounts(orgId: OrgId, emails: readonly string[]): Promise<readonly { id: string; email: string; verified: boolean }[]> {
    if (emails.length === 0) return [];
    return staff(this.#sql, orgId, (tx) =>
      tx.query<{ id: string; email: string; verified: boolean }>(
        `SELECT id, lower(email) AS email, email_verified_at IS NOT NULL AS verified FROM learners
         WHERE org_id = $1 AND erased_at IS NULL AND lower(email) = ANY($2::text[])`,
        [orgId, emails],
      ),
    );
  }

  /** Each member of a cohort (or of every cohort), with their account and how much they have practised. */
  async students(orgId: OrgId, cohortId?: string): Promise<readonly CohortStudent[]> {
    return staff(this.#sql, orgId, async (tx) =>
      (
        await tx.query<{
          cohort_id: string;
          email: string;
          plus_until: string | Date | null;
          learner_id: string | null;
          name: string | null;
          verified: boolean | null;
          solved: string | number | null;
          submissions: string | number | null;
          last_active_at: string | Date | null;
        }>(
          `SELECT m.cohort_id, m.email, m.plus_until, l.id AS learner_id, l.name, l.email_verified_at IS NOT NULL AS verified,
                  s.solved, s.submissions, s.last_active_at
             FROM prep_cohort_members m
             LEFT JOIN learners l ON l.org_id = m.org_id AND lower(l.email) = m.email AND l.erased_at IS NULL
             LEFT JOIN LATERAL (
               SELECT count(DISTINCT problem_id) FILTER (WHERE status = 'passed') AS solved, count(*) AS submissions, max(created_at) AS last_active_at
                 FROM practice_submissions WHERE org_id = m.org_id AND learner_id = l.id
             ) s ON l.id IS NOT NULL
            WHERE m.org_id = $1 AND ($2::text IS NULL OR m.cohort_id = $2)
            ORDER BY m.added_at, m.email`,
          [orgId, cohortId ?? null],
        )
      ).map((r) => ({
        cohortId: r.cohort_id,
        email: r.email,
        plusUntil: r.plus_until === null ? null : iso(r.plus_until),
        learnerId: r.learner_id,
        name: r.name,
        verified: r.verified === true,
        solved: Number(r.solved ?? 0),
        submissions: Number(r.submissions ?? 0),
        lastActiveAt: r.last_active_at === null ? null : iso(r.last_active_at),
      })),
    );
  }

  /** The cohorts still owing this address Plus. */
  async owed(orgId: OrgId, email: string): Promise<readonly Cohort[]> {
    return staff(this.#sql, orgId, async (tx) =>
      (
        await tx.query<CohortRow>(
          `SELECT c.id, c.name, c.plus_days, c.created_by, c.created_at FROM prep_cohort_members m
           JOIN prep_cohorts c ON c.org_id = m.org_id AND c.id = m.cohort_id
           WHERE m.org_id = $1 AND m.email = lower($2) AND m.granted_at IS NULL ORDER BY c.created_at`,
          [orgId, email],
        )
      ).map(cohortOf),
    );
  }

  async markGranted(orgId: OrgId, cohortId: string, email: string, learnerId: string, until: Date, at: Date = new Date()): Promise<void> {
    await staff(this.#sql, orgId, (tx) =>
      tx.query(`UPDATE prep_cohort_members SET learner_id = $4, granted_at = $5, plus_until = $6 WHERE org_id = $1 AND cohort_id = $2 AND email = lower($3) AND granted_at IS NULL`, [
        orgId,
        cohortId,
        email,
        learnerId,
        at,
        until,
      ]),
    );
  }
}
