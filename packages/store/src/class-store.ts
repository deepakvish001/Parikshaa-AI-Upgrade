import type { OrgId } from "@parikshaa/core";
import { practiceStaff } from "./practice-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Classes (docs/PREP-TRACKER.md plan row 95): a cohort of the practice site's
 * students, the course they work through (a track), the tests and contests
 * set for them, and the sessions they were present at. Staff only.
 */

function staff<T>(sql: SqlExecutor, orgId: OrgId, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  const scope = practiceStaff(orgId);
  return sql.transaction(fn, { "parikshaa.org_id": scope.orgId, "parikshaa.actor": scope.actor, "parikshaa.attempt_id": "", "parikshaa.learner_id": "" });
}

const iso = (value: string | Date) => new Date(value).toISOString();
const day = (value: string | Date) => (typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10));

export interface ClassRecord {
  readonly id: string;
  readonly name: string;
  readonly cohortId: string;
  readonly trackId: string | null;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly testIds: readonly string[];
  readonly contestIds: readonly string[];
}

export interface ClassSession {
  readonly id: string;
  readonly heldOn: string;
  readonly topic: string;
  /** Addresses marked, present or not. */
  readonly marks: Readonly<Record<string, boolean>>;
}

/** One student of a class, and how far they have got with its course and contests. */
export interface ClassStudentProgress {
  readonly email: string;
  readonly learnerId: string | null;
  readonly name: string | null;
  readonly lessonsDone: number;
  readonly problemsSolved: number;
  /** Problems solved in each of the class's contests, by contest. */
  readonly contests: Readonly<Record<string, number>>;
  readonly lastActiveAt: string | null;
}

export interface ClassProgress {
  readonly lessons: number;
  readonly problems: number;
  readonly students: readonly ClassStudentProgress[];
}

/** One practical of a lab record: a coding problem of the course, the student's latest accepted program, and its sign-off. */
export interface LabPractical {
  readonly problemId: string;
  readonly slug: string;
  readonly title: string;
  readonly module: string;
  readonly submission: { readonly language: string | null; readonly source: string; readonly passed: number; readonly total: number; readonly at: string } | null;
  readonly signedBy: string | null;
  readonly signedAt: string | null;
}

export class ClassNameTaken extends Error {
  constructor() {
    super("A class has that name already");
  }
}

type ClassRow = { id: string; name: string; cohort_id: string; track_id: string | null; created_by: string; created_at: string | Date; test_ids: string[] | null; contest_ids: string[] | null };
const SELECT_CLASS = `SELECT c.id, c.name, c.cohort_id, c.track_id, c.created_by, c.created_at,
         ARRAY(SELECT exam_id FROM class_tests t WHERE t.org_id = c.org_id AND t.class_id = c.id ORDER BY position) AS test_ids,
         ARRAY(SELECT contest_id FROM class_contests k WHERE k.org_id = c.org_id AND k.class_id = c.id ORDER BY position) AS contest_ids
    FROM classes c`;
const classOf = (r: ClassRow): ClassRecord => ({
  id: r.id,
  name: r.name,
  cohortId: r.cohort_id,
  trackId: r.track_id,
  createdBy: r.created_by,
  createdAt: iso(r.created_at),
  testIds: r.test_ids ?? [],
  contestIds: r.contest_ids ?? [],
});

export class ClassStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  list(orgId: OrgId): Promise<readonly ClassRecord[]> {
    return staff(this.#sql, orgId, async (tx) => (await tx.query<ClassRow>(`${SELECT_CLASS} WHERE c.org_id = $1 ORDER BY c.created_at, c.name`, [orgId])).map(classOf));
  }

  get(orgId: OrgId, id: string): Promise<ClassRecord | null> {
    return staff(this.#sql, orgId, async (tx) => {
      const [row] = await tx.query<ClassRow>(`${SELECT_CLASS} WHERE c.org_id = $1 AND c.id = $2`, [orgId, id]);
      return row === undefined ? null : classOf(row);
    });
  }

  create(orgId: OrgId, draft: { readonly name: string; readonly cohortId: string; readonly trackId: string | null; readonly createdBy: string }, at: Date): Promise<ClassRecord> {
    return staff(this.#sql, orgId, async (tx) => {
      const taken = await tx.query(`SELECT 1 FROM classes WHERE org_id = $1 AND lower(name) = lower($2)`, [orgId, draft.name]);
      if (taken.length > 0) throw new ClassNameTaken();
      const id = this.#newId();
      await tx.query(`INSERT INTO classes (org_id, id, name, cohort_id, track_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
        orgId,
        id,
        draft.name,
        draft.cohortId,
        draft.trackId,
        draft.createdBy,
        at,
      ]);
      return { id, name: draft.name, cohortId: draft.cohortId, trackId: draft.trackId, createdBy: draft.createdBy, createdAt: at.toISOString(), testIds: [], contestIds: [] };
    });
  }

  /** The course a class works through; null for none. */
  async setTrack(orgId: OrgId, id: string, trackId: string | null): Promise<void> {
    await staff(this.#sql, orgId, (tx) => tx.query(`UPDATE classes SET track_id = $3 WHERE org_id = $1 AND id = $2`, [orgId, id, trackId]));
  }

  /** Set the class's tests to these exams, in this order. */
  async setTests(orgId: OrgId, id: string, examIds: readonly string[]): Promise<void> {
    await staff(this.#sql, orgId, async (tx) => {
      await tx.query(`DELETE FROM class_tests WHERE org_id = $1 AND class_id = $2`, [orgId, id]);
      for (const [position, examId] of examIds.entries()) {
        await tx.query(`INSERT INTO class_tests (org_id, class_id, exam_id, position) VALUES ($1, $2, $3, $4)`, [orgId, id, examId, position]);
      }
    });
  }

  /** Set the class's contests to these, in this order. */
  async setContests(orgId: OrgId, id: string, contestIds: readonly string[]): Promise<void> {
    await staff(this.#sql, orgId, async (tx) => {
      await tx.query(`DELETE FROM class_contests WHERE org_id = $1 AND class_id = $2`, [orgId, id]);
      for (const [position, contestId] of contestIds.entries()) {
        await tx.query(`INSERT INTO class_contests (org_id, class_id, contest_id, position) VALUES ($1, $2, $3, $4)`, [orgId, id, contestId, position]);
      }
    });
  }

  // --- sessions and attendance ----------------------------------------------------

  addSession(orgId: OrgId, classId: string, heldOn: string, topic: string): Promise<ClassSession> {
    return staff(this.#sql, orgId, async (tx) => {
      const id = this.#newId();
      await tx.query(`INSERT INTO class_sessions (org_id, id, class_id, held_on, topic) VALUES ($1, $2, $3, $4, $5)`, [orgId, id, classId, heldOn, topic]);
      return { id, heldOn, topic, marks: {} };
    });
  }

  async removeSession(orgId: OrgId, classId: string, sessionId: string): Promise<boolean> {
    return staff(this.#sql, orgId, async (tx) => {
      const gone = await tx.query(`DELETE FROM class_sessions WHERE org_id = $1 AND class_id = $2 AND id = $3 RETURNING id`, [orgId, classId, sessionId]);
      return gone.length > 0;
    });
  }

  sessions(orgId: OrgId, classId: string): Promise<readonly ClassSession[]> {
    return staff(this.#sql, orgId, async (tx) => {
      const sessions = await tx.query<{ id: string; held_on: string | Date; topic: string }>(
        `SELECT id, held_on, topic FROM class_sessions WHERE org_id = $1 AND class_id = $2 ORDER BY held_on, id`,
        [orgId, classId],
      );
      const marks = await tx.query<{ session_id: string; email: string; present: boolean }>(
        `SELECT a.session_id, a.email, a.present FROM class_attendance a
           JOIN class_sessions s ON s.org_id = a.org_id AND s.id = a.session_id
          WHERE a.org_id = $1 AND s.class_id = $2`,
        [orgId, classId],
      );
      return sessions.map((s) => ({
        id: s.id,
        heldOn: day(s.held_on),
        topic: s.topic,
        marks: Object.fromEntries(marks.filter((m) => m.session_id === s.id).map((m) => [m.email, m.present])),
      }));
    });
  }

  /** Mark who was present at a session; a mark given again replaces the last. False when the session is not the class's. */
  async mark(orgId: OrgId, classId: string, sessionId: string, marks: Readonly<Record<string, boolean>>, by: string, at: Date): Promise<boolean> {
    return staff(this.#sql, orgId, async (tx) => {
      const [session] = await tx.query(`SELECT 1 FROM class_sessions WHERE org_id = $1 AND class_id = $2 AND id = $3`, [orgId, classId, sessionId]);
      if (session === undefined) return false;
      for (const [email, present] of Object.entries(marks)) {
        await tx.query(
          `INSERT INTO class_attendance (org_id, session_id, email, present, marked_by, marked_at) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (org_id, session_id, email) DO UPDATE SET present = EXCLUDED.present, marked_by = EXCLUDED.marked_by, marked_at = EXCLUDED.marked_at`,
          [orgId, sessionId, email.toLowerCase(), present, by, at],
        );
      }
      return true;
    });
  }

  // --- a student's own classes, and the lab record -------------------------------------

  /** Exams' titles, by id: what a student is told their class's tests are called. */
  examTitles(orgId: OrgId, ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    return staff(this.#sql, orgId, async (tx) => {
      const rows = await tx.query<{ id: string; title: string }>(`SELECT id, title FROM exams WHERE org_id = $1 AND id = ANY($2::text[])`, [orgId, ids]);
      return new Map(rows.map((r) => [r.id, r.title]));
    });
  }

  /** The classes whose cohort has this address. */
  forEmail(orgId: OrgId, email: string): Promise<readonly ClassRecord[]> {
    return staff(this.#sql, orgId, async (tx) =>
      (
        await tx.query<ClassRow>(
          `${SELECT_CLASS}
            WHERE c.org_id = $1 AND EXISTS (SELECT 1 FROM prep_cohort_members m WHERE m.org_id = c.org_id AND m.cohort_id = c.cohort_id AND m.email = lower($2))
            ORDER BY c.created_at, c.name`,
          [orgId, email],
        )
      ).map(classOf),
    );
  }

  /** Each coding problem of the class's course, in course order, with this student's latest accepted program and its sign-off. */
  labRecord(orgId: OrgId, record: ClassRecord, email: string): Promise<readonly LabPractical[]> {
    return staff(this.#sql, orgId, async (tx) => {
      const rows = await tx.query<{
        problem_id: string;
        slug: string;
        title: string;
        module: string;
        language: string | null;
        answer: string | null;
        passed: number | null;
        total: number | null;
        at: string | Date | null;
        signed_by: string | null;
        signed_at: string | Date | null;
      }>(
        `SELECT p.id AS problem_id, p.slug, p.title, m.title AS module,
                s.language, s.answer, s.passed, s.total, s.created_at AS at,
                o.signed_by, o.signed_at
           FROM prep_items i
           JOIN prep_modules m ON m.org_id = i.org_id AND m.id = i.module_id
           JOIN practice_problems p ON p.org_id = i.org_id AND p.id = i.problem_id
           LEFT JOIN learners l ON l.org_id = i.org_id AND lower(l.email) = lower($3) AND l.erased_at IS NULL
           LEFT JOIN LATERAL (
             SELECT language, answer, passed, total, created_at FROM practice_submissions
              WHERE org_id = i.org_id AND learner_id = l.id AND problem_id = p.id AND status = 'passed'
              ORDER BY created_at DESC LIMIT 1
           ) s ON l.id IS NOT NULL
           LEFT JOIN class_lab_signoffs o ON o.org_id = i.org_id AND o.class_id = $4 AND o.email = lower($3) AND o.problem_id = p.id
          WHERE i.org_id = $1 AND m.track_id = $2 AND p.question->>'kind' = 'code'
          ORDER BY m.position, i.position`,
        [orgId, record.trackId, email, record.id],
      );
      return rows.map((r) => ({
        problemId: r.problem_id,
        slug: r.slug,
        title: r.title,
        module: r.module,
        submission: r.answer === null ? null : { language: r.language, source: r.answer, passed: Number(r.passed ?? 0), total: Number(r.total ?? 0), at: iso(r.at!) },
        signedBy: r.signed_by,
        signedAt: r.signed_at === null ? null : iso(r.signed_at),
      }));
    });
  }

  /** Sign a practical off for a student, or take the sign-off back. */
  async signOff(orgId: OrgId, classId: string, email: string, problemId: string, signed: boolean, by: string, at: Date): Promise<void> {
    await staff(this.#sql, orgId, async (tx) => {
      if (signed) {
        await tx.query(
          `INSERT INTO class_lab_signoffs (org_id, class_id, email, problem_id, signed_by, signed_at) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (org_id, class_id, email, problem_id) DO NOTHING`,
          [orgId, classId, email.toLowerCase(), problemId, by, at],
        );
      } else {
        await tx.query(`DELETE FROM class_lab_signoffs WHERE org_id = $1 AND class_id = $2 AND email = $3 AND problem_id = $4`, [orgId, classId, email.toLowerCase(), problemId]);
      }
    });
  }

  // --- progress ---------------------------------------------------------------------

  /** The class's students, from its cohort, each with how far they have got in its course and contests. */
  progress(orgId: OrgId, record: ClassRecord): Promise<ClassProgress> {
    return staff(this.#sql, orgId, async (tx) => {
      const [totals] = await tx.query<{ lessons: string | number; problems: string | number }>(
        `SELECT count(i.lesson_id) AS lessons, count(i.problem_id) AS problems
           FROM prep_items i JOIN prep_modules m ON m.org_id = i.org_id AND m.id = i.module_id
          WHERE i.org_id = $1 AND m.track_id = $2`,
        [orgId, record.trackId],
      );
      const rows = await tx.query<{
        email: string;
        learner_id: string | null;
        name: string | null;
        lessons_done: string | number | null;
        solved: string | number | null;
        last_active_at: string | Date | null;
        contests: Record<string, number> | string | null;
      }>(
        `WITH course AS (
           SELECT i.lesson_id, i.problem_id FROM prep_items i JOIN prep_modules m ON m.org_id = i.org_id AND m.id = i.module_id
            WHERE i.org_id = $1 AND m.track_id = $3
         )
         SELECT mem.email, l.id AS learner_id, l.name,
                (SELECT count(*) FROM prep_lessons_done d WHERE d.org_id = mem.org_id AND d.learner_id = l.id AND d.lesson_id IN (SELECT lesson_id FROM course WHERE lesson_id IS NOT NULL)) AS lessons_done,
                (SELECT count(DISTINCT s.problem_id) FROM practice_submissions s WHERE s.org_id = mem.org_id AND s.learner_id = l.id AND s.status = 'passed'
                    AND s.problem_id IN (SELECT problem_id FROM course WHERE problem_id IS NOT NULL)) AS solved,
                (SELECT max(s.created_at) FROM practice_submissions s WHERE s.org_id = mem.org_id AND s.learner_id = l.id) AS last_active_at,
                (SELECT json_object_agg(k.contest_id, k.solved) FROM (
                   SELECT c.contest_id, (SELECT count(DISTINCT s.problem_id) FROM practice_submissions s
                                          WHERE s.org_id = mem.org_id AND s.learner_id = l.id AND s.contest_id = c.contest_id AND s.status = 'passed') AS solved
                     FROM unnest($4::text[]) AS c(contest_id)
                 ) k) AS contests
           FROM prep_cohort_members mem
           LEFT JOIN learners l ON l.org_id = mem.org_id AND lower(l.email) = mem.email AND l.erased_at IS NULL
          WHERE mem.org_id = $1 AND mem.cohort_id = $2
          ORDER BY mem.email`,
        [orgId, record.cohortId, record.trackId, record.contestIds],
      );
      return {
        lessons: Number(totals?.lessons ?? 0),
        problems: Number(totals?.problems ?? 0),
        students: rows.map((r) => {
          const contests = typeof r.contests === "string" ? (JSON.parse(r.contests) as Record<string, number>) : (r.contests ?? {});
          return {
            email: r.email,
            learnerId: r.learner_id,
            name: r.name,
            lessonsDone: r.learner_id === null ? 0 : Number(r.lessons_done ?? 0),
            problemsSolved: r.learner_id === null ? 0 : Number(r.solved ?? 0),
            contests: Object.fromEntries(record.contestIds.map((id) => [id, r.learner_id === null ? 0 : Number(contests[id] ?? 0)])),
            lastActiveAt: r.last_active_at === null ? null : iso(r.last_active_at),
          };
        }),
      };
    });
  }
}
