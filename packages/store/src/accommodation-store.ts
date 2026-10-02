import { staffScope, withScope } from "./ledger-store.js";
import { NO_SEAL, type RecordSeal } from "./sealing.js";
import type { SqlExecutor } from "./sql.js";
import type { OrgId } from "@parikshaa/core";

/** A candidate's arrangements on an exam: extra time, a scribe, larger text (migration 0053). */
export interface Accommodation {
  readonly candidateRef: string;
  readonly extraPercent: number;
  readonly scribe: boolean;
  readonly largeText: boolean;
  readonly note: string;
  readonly setBy: { readonly userId: string; readonly name: string };
  readonly setAt: string;
}

interface Row {
  candidate_ref: string;
  extra_percent: number;
  scribe: boolean;
  large_text: boolean;
  note: string;
  set_by_id: string;
  set_by_name: string;
  set_at: string | Date;
}

const COLUMNS = "candidate_ref, extra_percent, scribe, large_text, note, set_by_id, set_by_name, set_at";
const aad = (orgId: string, examId: string, ref: string) => `accommodations/${orgId}/${examId}/${ref}/note`;

export class AccommodationStore {
  readonly #sql: SqlExecutor;
  readonly #seal: RecordSeal;

  /** `seal`: the note may name a condition, so it is kept sealed. */
  constructor(sql: SqlExecutor, seal: RecordSeal = NO_SEAL) {
    this.#sql = sql;
    this.#seal = seal;
  }

  #open(orgId: string, examId: string, r: Row): Accommodation {
    return {
      candidateRef: r.candidate_ref,
      extraPercent: r.extra_percent,
      scribe: r.scribe,
      largeText: r.large_text,
      note: this.#seal.open(r.note, aad(orgId, examId, r.candidate_ref)) ?? "",
      setBy: { userId: r.set_by_id, name: r.set_by_name },
      setAt: new Date(r.set_at).toISOString(),
    };
  }

  async list(orgId: OrgId, examId: string): Promise<readonly Accommodation[]> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query<Row>(`SELECT ${COLUMNS} FROM accommodations WHERE org_id = $1 AND exam_id = $2 ORDER BY candidate_ref`, [orgId, examId])).map((r) => this.#open(orgId, examId, r)),
    );
  }

  async get(orgId: OrgId, examId: string, ref: string): Promise<Accommodation | null> {
    return withScope(this.#sql, staffScope(orgId), async (tx) => {
      const rows = await tx.query<Row>(`SELECT ${COLUMNS} FROM accommodations WHERE org_id = $1 AND exam_id = $2 AND candidate_ref = $3`, [orgId, examId, ref]);
      return rows[0] === undefined ? null : this.#open(orgId, examId, rows[0]);
    });
  }

  async put(orgId: OrgId, examId: string, a: Accommodation): Promise<void> {
    await withScope(this.#sql, staffScope(orgId), async (tx) => {
      await tx.query(
        `INSERT INTO accommodations (org_id, exam_id, ${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (org_id, exam_id, candidate_ref) DO UPDATE SET extra_percent = EXCLUDED.extra_percent, scribe = EXCLUDED.scribe, large_text = EXCLUDED.large_text,
           note = EXCLUDED.note, set_by_id = EXCLUDED.set_by_id, set_by_name = EXCLUDED.set_by_name, set_at = EXCLUDED.set_at`,
        [orgId, examId, a.candidateRef, a.extraPercent, a.scribe, a.largeText, this.#seal.text(a.note, aad(orgId, examId, a.candidateRef)) ?? "", a.setBy.userId, a.setBy.name, a.setAt],
      );
    });
  }

  async remove(orgId: OrgId, examId: string, ref: string): Promise<boolean> {
    return withScope(this.#sql, staffScope(orgId), async (tx) =>
      (await tx.query(`DELETE FROM accommodations WHERE org_id = $1 AND exam_id = $2 AND candidate_ref = $3 RETURNING candidate_ref`, [orgId, examId, ref])).length > 0,
    );
  }
}
