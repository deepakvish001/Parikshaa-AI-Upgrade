import { staffScope, withScope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** Seats and attendance for an exam held in rooms (migration 0037). */

export interface Seat {
  readonly ref: string;
  readonly centre: string;
  readonly room: string;
  readonly seat: string;
}

export interface Attendance {
  readonly ref: string;
  readonly markedBy: string;
  readonly markedAt: string;
}

export class SeatStore {
  readonly #sql: SqlExecutor;

  constructor(sql: SqlExecutor) {
    this.#sql = sql;
  }

  async seats(orgId: OrgId, examId: string): Promise<readonly Seat[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (
        await tx.query<{ candidate_ref: string; centre: string; room: string; seat: string }>(
          `SELECT candidate_ref, centre, room, seat FROM exam_seats WHERE org_id = $1 AND exam_id = $2 ORDER BY centre, room, seat`,
          [orgId, examId],
        )
      ).map((r) => ({ ref: r.candidate_ref, centre: r.centre, room: r.room, seat: r.seat })),
    );
  }

  /** Replace an exam's seating with `seats`, in one transaction. */
  async replace(orgId: OrgId, examId: string, seats: readonly Seat[]): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), async (tx) => {
      await tx.query(`DELETE FROM exam_seats WHERE org_id = $1 AND exam_id = $2`, [orgId, examId]);
      for (const s of seats) {
        await tx.query(`INSERT INTO exam_seats (org_id, exam_id, candidate_ref, centre, room, seat) VALUES ($1, $2, $3, $4, $5, $6)`, [orgId, examId, s.ref, s.centre, s.room, s.seat]);
      }
    });
  }

  async attendance(orgId: OrgId, examId: string): Promise<readonly Attendance[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (
        await tx.query<{ candidate_ref: string; marked_by: string; marked_at: string | Date }>(
          `SELECT candidate_ref, marked_by, marked_at FROM exam_attendance WHERE org_id = $1 AND exam_id = $2 ORDER BY marked_at`,
          [orgId, examId],
        )
      ).map((r) => ({ ref: r.candidate_ref, markedBy: r.marked_by, markedAt: new Date(r.marked_at).toISOString() })),
    );
  }

  /** Mark a candidate present. Returns the earlier mark when they had one already. */
  async mark(orgId: OrgId, examId: string, ref: string, by: string, at: Date): Promise<Attendance | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const before = await tx.query<{ marked_by: string; marked_at: string | Date }>(
        `SELECT marked_by, marked_at FROM exam_attendance WHERE org_id = $1 AND exam_id = $2 AND candidate_ref = $3`,
        [orgId, examId, ref],
      );
      if (before[0] !== undefined) return { ref, markedBy: before[0].marked_by, markedAt: new Date(before[0].marked_at).toISOString() };
      await tx.query(`INSERT INTO exam_attendance (org_id, exam_id, candidate_ref, marked_by, marked_at) VALUES ($1, $2, $3, $4, $5)`, [orgId, examId, ref, by, at.toISOString()]);
      return null;
    });
  }
}
