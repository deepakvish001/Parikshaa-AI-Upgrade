import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/**
 * A placement cell's records (migration 0029): its students, entered once,
 * and its recruitment drives with how far each student got in each.
 */

export interface Student {
  /** The roll number: what the college calls the student, and the candidate reference in every exam. */
  readonly ref: string;
  readonly name: string;
  readonly email: string | null;
  /** 91 followed by ten digits. */
  readonly phone: string | null;
  readonly branch: string;
  /** Year of graduation. */
  readonly batch: number | null;
  readonly cgpa: number | null;
  readonly backlogs: number;
}

export interface StudentRow extends Student {
  /** Drives in which the student has an offer or has joined. */
  readonly offers: number;
  /** The best offer, in lakh a year; null without one. */
  readonly bestOfferLpa: number | null;
}

export interface Eligibility {
  readonly minCgpa?: number | undefined;
  readonly maxBacklogs?: number | undefined;
  /** Empty or absent: every branch. */
  readonly branches?: readonly string[] | undefined;
  readonly batches?: readonly number[] | undefined;
}

export interface DriveDraft {
  readonly company: string;
  readonly role: string;
  readonly ctcLpa: number | null;
  readonly location: string;
  readonly description: string;
  readonly eligibility: Eligibility;
  /** A date, YYYY-MM-DD. */
  readonly applyBy: string | null;
  readonly examId: string | null;
  readonly status: "open" | "closed";
}

export const STAGES = ["applied", "test", "interview", "offered", "joined", "rejected", "withdrawn"] as const;
export type Stage = (typeof STAGES)[number];

export interface Drive extends DriveDraft {
  readonly id: string;
  readonly createdAt: string;
  /** How many students are at each stage. */
  readonly stages: Readonly<Record<Stage, number>>;
}

export interface Application extends Student {
  readonly stage: Stage;
  readonly offerLpa: number | null;
  readonly updatedAt: string;
}

const num = (v: string | number | null): number | null => (v === null ? null : Number(v));
const iso = (v: string | Date) => new Date(v).toISOString();
const day = (v: string | Date | null): string | null => (v === null ? null : typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));

interface StudentDb {
  ref: string;
  name: string;
  email: string | null;
  phone: string | null;
  branch: string;
  batch: number | null;
  cgpa: string | number | null;
  backlogs: number;
}

const toStudent = (r: StudentDb): Student => ({
  ref: r.ref,
  name: r.name,
  email: r.email,
  phone: r.phone,
  branch: r.branch,
  batch: r.batch,
  cgpa: num(r.cgpa),
  backlogs: r.backlogs,
});

interface DriveDb {
  id: string;
  company: string;
  role: string;
  ctc_lpa: string | number | null;
  location: string;
  description: string;
  eligibility: Eligibility | string;
  apply_by: string | Date | null;
  exam_id: string | null;
  status: "open" | "closed";
  created_at: string | Date;
  stages: Record<string, number | string> | string | null;
}

const toDrive = (r: DriveDb): Drive => {
  const counts = (typeof r.stages === "string" ? JSON.parse(r.stages) : r.stages ?? {}) as Record<string, number | string>;
  return {
    id: r.id,
    company: r.company,
    role: r.role,
    ctcLpa: num(r.ctc_lpa),
    location: r.location,
    description: r.description,
    eligibility: typeof r.eligibility === "string" ? (JSON.parse(r.eligibility) as Eligibility) : r.eligibility,
    applyBy: day(r.apply_by),
    examId: r.exam_id,
    status: r.status,
    createdAt: iso(r.created_at),
    stages: Object.fromEntries(STAGES.map((s) => [s, Number(counts[s] ?? 0)])) as Record<Stage, number>,
  };
};

const DRIVE_COLUMNS = `d.id, d.company, d.role, d.ctc_lpa, d.location, d.description, d.eligibility, d.apply_by, d.exam_id, d.status, d.created_at,
  (SELECT jsonb_object_agg(stage, n) FROM (SELECT stage, count(*) AS n FROM drive_applications a
     WHERE a.org_id = d.org_id AND a.drive_id = d.id GROUP BY stage) s) AS stages`;

/** Whether a student meets a drive's criteria. A student without a CGPA or batch does not meet a limit on it. */
export function eligible(student: Student, rule: Eligibility): boolean {
  if (rule.minCgpa !== undefined && (student.cgpa === null || student.cgpa < rule.minCgpa)) return false;
  if (rule.maxBacklogs !== undefined && student.backlogs > rule.maxBacklogs) return false;
  if (rule.branches !== undefined && rule.branches.length > 0 && !rule.branches.some((b) => b.toLowerCase() === student.branch.toLowerCase())) return false;
  if (rule.batches !== undefined && rule.batches.length > 0 && (student.batch === null || !rule.batches.includes(student.batch))) return false;
  return true;
}

export class PlacementStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  // --- students ---------------------------------------------------------------

  /** Every student, by roll number, with their offers. */
  async students(orgId: OrgId): Promise<readonly StudentRow[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<StudentDb & { offers: string | number; best: string | number | null }>(
        `SELECT s.ref, s.name, s.email, s.phone, s.branch, s.batch, s.cgpa, s.backlogs,
                count(a.student_ref) AS offers, max(a.offer_lpa) AS best
           FROM students s
           LEFT JOIN drive_applications a ON a.org_id = s.org_id AND a.student_ref = s.ref AND a.stage IN ('offered', 'joined')
          WHERE s.org_id = $1
          GROUP BY s.org_id, s.ref
          ORDER BY s.ref`,
        [orgId],
      );
      return rows.map((r) => ({ ...toStudent(r), offers: Number(r.offers), bestOfferLpa: num(r.best) }));
    });
  }

  async refs(orgId: OrgId): Promise<ReadonlySet<string>> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<{ ref: string }>(`SELECT ref FROM students WHERE org_id = $1`, [orgId]);
      return new Set(rows.map((r) => r.ref));
    });
  }

  /** Add students, or bring existing ones up to date, in one transaction. Returns how many were new. */
  async upsert(orgId: OrgId, students: readonly Student[], at: Date): Promise<{ readonly added: number; readonly updated: number }> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      let added = 0;
      for (const s of students) {
        const rows = await tx.query<{ inserted: boolean }>(
          `INSERT INTO students (org_id, ref, name, email, phone, branch, batch, cgpa, backlogs, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
           ON CONFLICT (org_id, ref) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
             branch = EXCLUDED.branch, batch = EXCLUDED.batch, cgpa = EXCLUDED.cgpa, backlogs = EXCLUDED.backlogs, updated_at = EXCLUDED.updated_at
           RETURNING (xmax = 0) AS inserted`,
          [orgId, s.ref, s.name, s.email, s.phone, s.branch, s.batch, s.cgpa, s.backlogs, at.toISOString()],
        );
        if (rows[0]?.inserted === true) added++;
      }
      return { added, updated: students.length - added };
    });
  }

  /** Remove a student and their place in every drive. Their exams keep their attempts, as any candidate's do. */
  async remove(orgId: OrgId, ref: string): Promise<boolean> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query(`DELETE FROM students WHERE org_id = $1 AND ref = $2 RETURNING ref`, [orgId, ref]);
      return rows.length > 0;
    });
  }

  // --- drives ------------------------------------------------------------------

  async drives(orgId: OrgId): Promise<readonly Drive[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<DriveDb>(`SELECT ${DRIVE_COLUMNS} FROM drives d WHERE d.org_id = $1 ORDER BY d.status, d.created_at DESC`, [orgId]);
      return rows.map(toDrive);
    });
  }

  async drive(orgId: OrgId, id: string): Promise<Drive | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<DriveDb>(`SELECT ${DRIVE_COLUMNS} FROM drives d WHERE d.org_id = $1 AND d.id = $2`, [orgId, id]);
      return rows[0] === undefined ? null : toDrive(rows[0]);
    });
  }

  /** Make a drive, or change one. Returns false when `id` names no drive to change. */
  async saveDrive(orgId: OrgId, id: string, draft: DriveDraft, at: Date, create: boolean): Promise<boolean> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const values = [orgId, id, draft.company, draft.role, draft.ctcLpa, draft.location, draft.description, JSON.stringify(draft.eligibility), draft.applyBy, draft.examId, draft.status, at.toISOString()];
      const rows = create
        ? await tx.query(
            `INSERT INTO drives (org_id, id, company, role, ctc_lpa, location, description, eligibility, apply_by, exam_id, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $12) RETURNING id`,
            values,
          )
        : await tx.query(
            `UPDATE drives SET company = $3, role = $4, ctc_lpa = $5, location = $6, description = $7, eligibility = $8::jsonb,
               apply_by = $9, exam_id = $10, status = $11, updated_at = $12 WHERE org_id = $1 AND id = $2 RETURNING id`,
            values,
          );
      return rows.length > 0;
    });
  }

  async applications(orgId: OrgId, driveId: string): Promise<readonly Application[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<StudentDb & { stage: Stage; offer_lpa: string | number | null; updated_at: string | Date }>(
        `SELECT s.ref, s.name, s.email, s.phone, s.branch, s.batch, s.cgpa, s.backlogs, a.stage, a.offer_lpa, a.updated_at
           FROM drive_applications a JOIN students s ON s.org_id = a.org_id AND s.ref = a.student_ref
          WHERE a.org_id = $1 AND a.drive_id = $2
          ORDER BY s.ref`,
        [orgId, driveId],
      );
      return rows.map((r) => ({ ...toStudent(r), stage: r.stage, offerLpa: num(r.offer_lpa), updatedAt: iso(r.updated_at) }));
    });
  }

  /** Put students into a drive at "applied". Students already in it are left where they are. Returns how many were added. */
  async addApplications(orgId: OrgId, driveId: string, refs: readonly string[], by: string, at: Date): Promise<number> {
    if (refs.length === 0) return 0;
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query(
        `INSERT INTO drive_applications (org_id, drive_id, student_ref, stage, updated_by, updated_at)
         SELECT $1, $2, ref, 'applied', $4, $5 FROM unnest($3::text[]) AS ref
         ON CONFLICT (org_id, drive_id, student_ref) DO NOTHING RETURNING student_ref`,
        [orgId, driveId, [...refs], by, at.toISOString()],
      );
      return rows.length;
    });
  }

  /** Move students of a drive to a stage; an offer's amount only with an offer. Returns how many moved. */
  async setStage(orgId: OrgId, driveId: string, refs: readonly string[], stage: Stage, offerLpa: number | null, by: string, at: Date): Promise<number> {
    if (refs.length === 0) return 0;
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query(
        `UPDATE drive_applications SET stage = $4::text,
           offer_lpa = CASE WHEN $4::text IN ('offered', 'joined') THEN coalesce($5::numeric, offer_lpa) ELSE NULL END,
           updated_by = $6, updated_at = $7
         WHERE org_id = $1 AND drive_id = $2 AND student_ref = ANY($3::text[]) RETURNING student_ref`,
        [orgId, driveId, [...refs], stage, offerLpa, by, at.toISOString()],
      );
      return rows.length;
    });
  }
}
