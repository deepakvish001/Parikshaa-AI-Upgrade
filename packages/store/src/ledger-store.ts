import {
  GENESIS_HASH,
  canonicalize,
  entryHash,
  entryPreimage,
  hashPreimage,
  type AttemptId,
  type CandidateId,
  type Exam,
  type ExamEvent,
  type ExamId,
  type LedgerEntry,
  type Timestamp,
} from "@parikshaa/core";
import type { SqlExecutor } from "./sql.js";

/**
 * Postgres-backed storage for exam ledgers.
 *
 * Two rules shape this class:
 *
 * 1. An append takes a row lock on the attempt before reading the head, so two
 *    concurrent appends serialize instead of racing for the same `seq`. The
 *    primary key on `(attempt_id, seq)` is the backstop if that ever fails.
 * 2. A load rebuilds each entry from its stored `preimage`, never from the
 *    `jsonb` column. The preimage is the exact string that was hashed; the
 *    jsonb is a convenience for querying and is not authoritative.
 */
export class LedgerStore {
  readonly #sql: SqlExecutor;
  readonly #clock: () => Timestamp;

  constructor(sql: SqlExecutor, options: { readonly clock?: () => Timestamp } = {}) {
    this.#sql = sql;
    this.#clock = options.clock ?? (() => Date.now());
  }

  async createExam(exam: Exam): Promise<void> {
    await this.#sql.query(
      `INSERT INTO exams (id, title, definition) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, definition = EXCLUDED.definition`,
      [exam.id, exam.title, JSON.stringify(exam)],
    );
  }

  async loadExam(id: ExamId): Promise<Exam | null> {
    const rows = await this.#sql.query<{ definition: Exam }>(
      `SELECT definition FROM exams WHERE id = $1`,
      [id],
    );
    return rows[0]?.definition ?? null;
  }

  /** Exams, newest first, for an authoring console. */
  async listExams(): Promise<readonly ExamSummary[]> {
    const rows = await this.#sql.query<{ id: string; title: string; question_count: number | string }>(
      `SELECT e.id, e.title, jsonb_array_length(e.definition -> 'questions') AS question_count
         FROM exams e ORDER BY e.created_at DESC`,
    );
    return rows.map((row) => ({
      id: row.id as ExamId,
      title: row.title,
      questionCount: Number(row.question_count),
    }));
  }

  /**
   * Attempts at one exam, with state derived in SQL.
   *
   * Folding every attempt's ledger to render a list would be correct and far
   * too slow; the closing events are enough to say where an attempt stands, and
   * anything that needs more opens the attempt itself.
   */
  async listAttempts(examId: ExamId): Promise<readonly AttemptSummary[]> {
    const rows = await this.#sql.query<{
      id: string;
      candidate_id: string;
      entries: number | string;
      submitted: boolean;
      graded: boolean;
      voided: boolean;
    }>(
      `SELECT a.id,
              a.candidate_id,
              (SELECT count(*) FROM exam_ledger l WHERE l.attempt_id = a.id) AS entries,
              EXISTS (SELECT 1 FROM exam_ledger l WHERE l.attempt_id = a.id AND l.event_type = 'attempt_submitted') AS submitted,
              EXISTS (SELECT 1 FROM exam_ledger l WHERE l.attempt_id = a.id AND l.event_type = 'attempt_graded') AS graded,
              EXISTS (SELECT 1 FROM exam_ledger l WHERE l.attempt_id = a.id AND l.event_type = 'attempt_voided') AS voided
         FROM attempts a
        WHERE a.exam_id = $1
        ORDER BY a.created_at DESC`,
      [examId],
    );

    return rows.map((row) => ({
      id: row.id as AttemptId,
      candidateId: row.candidate_id as CandidateId,
      entries: Number(row.entries),
      state: row.voided ? "void" : row.graded ? "graded" : row.submitted ? "submitted" : "in_progress",
    }));
  }

  async createAttempt(id: AttemptId, examId: ExamId, candidateId: CandidateId): Promise<void> {
    await this.#sql.query(
      `INSERT INTO attempts (id, exam_id, candidate_id) VALUES ($1, $2, $3)`,
      [id, examId, candidateId],
    );
  }

  /**
   * Append an event to an attempt's chain and return the entry committing to it.
   *
   * A `guard` is re-checked against the attempt's events *inside* the same
   * transaction that holds the attempt's row lock. That matters for anything
   * decided before a slow call: raising a probe reads the chain, spends a
   * second or two at the model, and only then appends — and two requests
   * arriving together would otherwise both pass the original check and write
   * two probes about one answer.
   */
  async append(
    attemptId: AttemptId,
    event: ExamEvent,
    options: { readonly guard?: (events: readonly ExamEvent[]) => string | null } = {},
  ): Promise<LedgerEntry> {
    return this.#sql.transaction(async (tx) => {
      const locked = await tx.query<{ id: string }>(
        `SELECT id FROM attempts WHERE id = $1 FOR UPDATE`,
        [attemptId],
      );
      if (locked.length === 0) {
        throw new Error(`No such attempt: ${attemptId}`);
      }

      if (options.guard !== undefined) {
        const rows = await tx.query<{ preimage: string }>(
          `SELECT preimage FROM exam_ledger WHERE attempt_id = $1 ORDER BY seq ASC`,
          [attemptId],
        );
        const events = rows.map((row) => (JSON.parse(row.preimage) as { event: ExamEvent }).event);
        const refusal = options.guard(events);
        if (refusal !== null) throw new AppendRefused(refusal);
      }

      const head = await tx.query<{ seq: number; hash: string }>(
        `SELECT seq, hash FROM exam_ledger WHERE attempt_id = $1 ORDER BY seq DESC LIMIT 1`,
        [attemptId],
      );

      const previous = head[0];
      const draft = {
        seq: previous === undefined ? 0 : Number(previous.seq) + 1,
        timestamp: this.#clock(),
        event,
        prevHash: previous?.hash ?? GENESIS_HASH,
      } as const;

      const preimage = entryPreimage(draft);
      const hash = hashPreimage(preimage);

      await tx.query(
        `INSERT INTO exam_ledger (attempt_id, seq, ts, event_type, event, preimage, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [attemptId, draft.seq, draft.timestamp, event.type, JSON.stringify(event), preimage, draft.prevHash, hash],
      );

      return Object.freeze({ ...draft, hash });
    });
  }

  /** Load an attempt's chain, rebuilt from the stored preimages. */
  async load(attemptId: AttemptId): Promise<readonly LedgerEntry[]> {
    const rows = await this.#sql.query<StoredRow>(
      `SELECT seq, ts, event, preimage, prev_hash, hash
         FROM exam_ledger WHERE attempt_id = $1 ORDER BY seq ASC`,
      [attemptId],
    );
    return rows.map(entryFromRow);
  }

  async head(attemptId: AttemptId): Promise<string> {
    const rows = await this.#sql.query<{ hash: string }>(
      `SELECT hash FROM exam_ledger WHERE attempt_id = $1 ORDER BY seq DESC LIMIT 1`,
      [attemptId],
    );
    return rows[0]?.hash ?? GENESIS_HASH;
  }

  /**
   * Check stored rows against their own hashes, and check the jsonb copy
   * against the authoritative preimage.
   *
   * The second check is the one worth having: a `jsonb_drift` result means the
   * database re-rendered a value on the way in or out (numbers are the usual
   * culprit). Nothing has been tampered with, but any code that recomputed a
   * hash from the jsonb column would report that it had.
   */
  async verifyStored(attemptId: AttemptId): Promise<StoredIntegrityResult> {
    const rows = await this.#sql.query<StoredRow>(
      `SELECT seq, ts, event, preimage, prev_hash, hash
         FROM exam_ledger WHERE attempt_id = $1 ORDER BY seq ASC`,
      [attemptId],
    );

    let expectedPrev = GENESIS_HASH;
    for (const [index, row] of rows.entries()) {
      const seq = Number(row.seq);
      if (seq !== index) return { ok: false, seq: index, reason: "bad_sequence" };
      if (row.prev_hash !== expectedPrev) return { ok: false, seq, reason: "broken_link" };
      if (hashPreimage(row.preimage) !== row.hash) return { ok: false, seq, reason: "hash_mismatch" };

      const entry = entryFromRow(row);
      if (entryHash(entry) !== row.hash) return { ok: false, seq, reason: "hash_mismatch" };
      if (canonicalize(row.event) !== canonicalize(entry.event)) {
        return { ok: false, seq, reason: "jsonb_drift" };
      }

      expectedPrev = row.hash;
    }
    return { ok: true, length: rows.length };
  }
}

/** Thrown when an append's guard declined it. Not an error in the store. */
export class AppendRefused extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AppendRefused";
  }
}

export interface ExamSummary {
  readonly id: ExamId;
  readonly title: string;
  readonly questionCount: number;
}

export interface AttemptSummary {
  readonly id: AttemptId;
  readonly candidateId: CandidateId;
  readonly entries: number;
  readonly state: "in_progress" | "submitted" | "graded" | "void";
}

export type StoredIntegrityResult =
  | { readonly ok: true; readonly length: number }
  | { readonly ok: false; readonly seq: number; readonly reason: StoredIntegrityFailure };

export type StoredIntegrityFailure =
  | "bad_sequence"
  | "broken_link"
  | "hash_mismatch"
  /** The jsonb copy no longer canonicalizes to the preimage that was hashed. */
  | "jsonb_drift";

interface StoredRow {
  readonly seq: number | string;
  readonly ts: number | string;
  readonly event: unknown;
  readonly preimage: string;
  readonly prev_hash: string;
  readonly hash: string;
}

/** Rebuild an entry from the bytes that were hashed, not from the jsonb column. */
function entryFromRow(row: StoredRow): LedgerEntry {
  const draft = JSON.parse(row.preimage) as Omit<LedgerEntry, "hash">;
  return Object.freeze({ ...draft, hash: row.hash });
}
