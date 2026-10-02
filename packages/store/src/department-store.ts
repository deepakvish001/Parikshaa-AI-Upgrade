import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** Departments on staff and on exams (migration 0051). */
export class DepartmentStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async staff(orgId: OrgId): Promise<ReadonlyMap<string, string>> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      new Map((await tx.query<{ user_id: string; department: string }>(`SELECT user_id, department FROM staff_departments WHERE org_id = $1`, [orgId])).map((r) => [r.user_id, r.department])),
    );
  }

  async exams(orgId: OrgId): Promise<ReadonlyMap<string, string>> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      new Map((await tx.query<{ exam_id: string; department: string }>(`SELECT exam_id, department FROM exam_departments WHERE org_id = $1`, [orgId])).map((r) => [r.exam_id, r.department])),
    );
  }

  async setStaff(orgId: OrgId, userId: string, department: string | null): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      department === null
        ? tx.query(`DELETE FROM staff_departments WHERE org_id = $1 AND user_id = $2`, [orgId, userId])
        : tx.query(`INSERT INTO staff_departments (org_id, user_id, department) VALUES ($1, $2, $3) ON CONFLICT (org_id, user_id) DO UPDATE SET department = excluded.department`, [orgId, userId, department]),
    );
  }

  async setExam(orgId: OrgId, examId: string, department: string | null): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), (tx) =>
      department === null
        ? tx.query(`DELETE FROM exam_departments WHERE org_id = $1 AND exam_id = $2`, [orgId, examId])
        : tx.query(`INSERT INTO exam_departments (org_id, exam_id, department) VALUES ($1, $2, $3) ON CONFLICT (org_id, exam_id) DO UPDATE SET department = excluded.department`, [orgId, examId, department]),
    );
  }
}
