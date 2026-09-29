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
  type OrgId,
  type QuestionId,
  type Timestamp,
} from "@parikshaa/core";
import { enqueue } from "./outbox-store.js";
import { isPersonal, openEvent, sealEvent, type DataKeys } from "./sealing.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Who a query runs on behalf of.
 *
 * Every method takes one, so there is no way to ask the store a question
 * without saying which organisation it is about. That is the first of two
 * isolation mechanisms: each query names `org_id` explicitly. The second is
 * row-level security, fed by the same scope — each call runs in a transaction
 * that sets `parikshaa.org_id`, `parikshaa.actor` and, for a candidate,
 * `parikshaa.attempt_id`, and the database refuses rows from any other
 * organisation even if a query here were to forget its filter.
 */
export type Scope =
  | { readonly orgId: OrgId; readonly actor: "staff" }
  | { readonly orgId: OrgId; readonly actor: "candidate"; readonly attemptId: AttemptId };

export const staffScope = (orgId: OrgId): Scope => ({ orgId, actor: "staff" });
export const candidateScope = (orgId: OrgId, attemptId: AttemptId): Scope => ({
  orgId,
  actor: "candidate",
  attemptId,
});

/**
 * Run `fn` in a transaction that carries the scope into the database, where
 * row-level security reads it. Every tenant query in this package goes through
 * here.
 */
export function withScope<T>(sql: SqlExecutor, scope: Scope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return sql.transaction(fn, {
    "parikshaa.org_id": scope.orgId,
    "parikshaa.actor": scope.actor,
    "parikshaa.attempt_id": scope.actor === "candidate" ? scope.attemptId : "",
  });
}

/**
 * The latest event that changed where an attempt stands, as a SQL expression
 * over an attempts row. The latest, not any: an attempt that was submitted and
 * then reopened is open again.
 */
export const lifecycleSql = (org: string, attempt: string) =>
  `(SELECT l.event_type FROM exam_ledger l WHERE l.org_id = ${org} AND l.attempt_id = ${attempt}
       AND l.event_type IN ('attempt_submitted', 'attempt_reopened', 'attempt_graded', 'attempt_voided')
     ORDER BY l.seq DESC LIMIT 1)`;

/** Where an attempt stands, from the event {@link lifecycleSql} found. */
export function lifecycleState(eventType: string | null): "in_progress" | "submitted" | "graded" | "void" {
  return eventType === "attempt_voided"
    ? "void"
    : eventType === "attempt_graded"
      ? "graded"
      : eventType === "attempt_submitted"
        ? "submitted"
        : "in_progress";
}

/** Ledger events that integrations are told about, by the name they are told. */
export const ANNOUNCED: Partial<Record<ExamEvent["type"], string>> = {
  attempt_started: "attempt.started",
  attempt_submitted: "attempt.submitted",
  attempt_graded: "attempt.graded",
  attempt_voided: "attempt.voided",
};

/** Raised when an exam that has already been sat is changed in place. */
export class ExamFrozen extends Error {
  constructor(readonly examId: string) {
    super(`Exam ${examId} has attempts and can no longer be edited; clone it instead`);
    this.name = "ExamFrozen";
  }
}

/** Thrown when an append's guard declined it. Not an error in the store. */
export class AppendRefused extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "AppendRefused";
  }
}

/**
 * Postgres-backed storage for an organisation's exams, attempts and ledgers,
 * and for the two other append-only records kept beside them: the audit log
 * and model usage.
 *
 * Two rules from before still shape the ledger half:
 *
 * 1. An append takes a row lock on the attempt before reading the head, so two
 *    concurrent appends serialize instead of racing for the same `seq`. The
 *    primary key on `(attempt_id, seq)` is the backstop if that ever fails.
 * 2. A load rebuilds each entry from its stored `preimage`, never from the
 *    `jsonb` column. The preimage is the exact string that was hashed.
 */
export class LedgerStore {
  readonly #sql: SqlExecutor;
  readonly #clock: () => Timestamp;
  readonly #newId: () => string;
  readonly #keys: DataKeys | null;

  /**
   * With `keys`, every new attempt gets its own data key and the personal
   * fields of its ledger are sealed under it (see `sealing.ts`). Without, they
   * are stored in the clear, as before sealing existed.
   */
  constructor(
    sql: SqlExecutor,
    options: { readonly clock?: () => Timestamp; readonly newId?: () => string; readonly keys?: DataKeys } = {},
  ) {
    this.#sql = sql;
    this.#clock = options.clock ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
    this.#keys = options.keys ?? null;
  }

  /** Give a new attempt its data key, in the transaction that creates it. */
  async #newKey(tx: SqlExecutor, scope: Scope, id: AttemptId): Promise<void> {
    if (this.#keys === null) return;
    await tx.query(`INSERT INTO attempt_keys (org_id, attempt_id, wrapped_key) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
      scope.orgId,
      id,
      this.#keys.newWrapped(scope.orgId, id),
    ]);
  }

  /**
   * The attempt's data key: a Buffer, `null` if it was erased, `undefined` if
   * it never had one (created before sealing, or without keys configured).
   */
  async #key(tx: SqlExecutor, scope: Scope, id: AttemptId): Promise<Buffer | null | undefined> {
    const rows = await tx.query<{ wrapped_key: string | null }>(
      `SELECT wrapped_key FROM attempt_keys WHERE org_id = $1 AND attempt_id = $2`,
      [scope.orgId, id],
    );
    const row = rows[0];
    if (row === undefined) return undefined;
    if (row.wrapped_key === null) return null;
    if (this.#keys === null) throw new Error("This ledger is sealed and no data key (PARIKSHAA_DATA_KEY) is configured");
    return this.#keys.unwrap(scope.orgId, id, row.wrapped_key);
  }

  /** An entry as the application reads it: personal fields opened, or `[erased]`. */
  #open(entry: LedgerEntry, key: Buffer | null | undefined): LedgerEntry {
    if (key === undefined) return entry;
    return Object.freeze({ ...entry, event: openEvent(entry.event, key) });
  }

  /** Run `fn` in a transaction that carries the scope into the database. */
  #scoped<T>(scope: Scope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return withScope(this.#sql, scope, fn);
  }

  // --- exams ----------------------------------------------------------------

  /**
   * Create an exam, or replace one that nobody has sat yet.
   *
   * Once an attempt exists the exam is frozen: a ledger records answers to
   * specific questions, and editing the questions afterwards would leave those
   * answers pointing at text the candidate never saw.
   */
  async createExam(scope: Scope, exam: Exam): Promise<void> {
    await this.#scoped(scope, async (tx) => {
      const sat = await tx.query<{ n: number | string }>(
        `SELECT count(*) AS n FROM attempts WHERE org_id = $1 AND exam_id = $2`,
        [scope.orgId, exam.id],
      );
      if (Number(sat[0]?.n ?? 0) > 0) throw new ExamFrozen(exam.id);

      await tx.query(
        `INSERT INTO exams (org_id, id, title, definition) VALUES ($1, $2, $3, $4)
         ON CONFLICT (org_id, id) DO UPDATE SET title = EXCLUDED.title, definition = EXCLUDED.definition`,
        [scope.orgId, exam.id, exam.title, JSON.stringify(exam)],
      );
    });
  }

  async loadExam(scope: Scope, id: ExamId): Promise<Exam | null> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{ definition: Exam }>(
        `SELECT definition FROM exams WHERE org_id = $1 AND id = $2`,
        [scope.orgId, id],
      );
      return rows[0]?.definition ?? null;
    });
  }

  /** Exams, newest first, for an authoring console. */
  async listExams(scope: Scope): Promise<readonly ExamSummary[]> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{
        id: string;
        title: string;
        created_at: string | Date;
        question_count: number | string;
        total_marks: number | string | null;
        section_count: number | string;
        duration_ms: number | string | null;
        proctored: boolean;
        cutoff_percent: number | string | null;
        invited: number | string;
        in_progress: number | string;
        submitted: number | string;
        graded: number | string;
        voided: number | string;
        opens_at: string | Date | null;
        closes_at: string | Date | null;
        archived_at: string | Date | null;
      }>(
        // Questions per paper: the fixed ones, plus what each section draws.
        // Attempts by where they stand, from the same closing events the attempt list reads.
        `SELECT e.id, e.title, e.created_at, e.archived_at, w.opens_at, w.closes_at,
                jsonb_array_length(e.definition -> 'questions')
                  + coalesce((SELECT sum((s ->> 'pick')::int)
                                FROM jsonb_array_elements(coalesce(e.definition -> 'sections', '[]'::jsonb)) s), 0)
                  AS question_count,
                (SELECT sum((q ->> 'maxScore')::numeric) FROM jsonb_array_elements(e.definition -> 'questions') q)
                  + coalesce((SELECT sum((s ->> 'pick')::int * (s -> 'pool' -> 0 ->> 'maxScore')::numeric)
                                FROM jsonb_array_elements(coalesce(e.definition -> 'sections', '[]'::jsonb)) s), 0)
                  AS total_marks,
                jsonb_array_length(coalesce(e.definition -> 'sections', '[]'::jsonb)) AS section_count,
                (e.definition -> 'policy' ->> 'durationMs')::bigint AS duration_ms,
                (e.definition -> 'policy' -> 'proctoring') IS NOT NULL
                  AND jsonb_typeof(e.definition -> 'policy' -> 'proctoring') = 'object' AS proctored,
                (e.definition -> 'policy' -> 'cutoff' ->> 'percent')::numeric AS cutoff_percent,
                (SELECT count(*) FROM invitations i WHERE i.org_id = e.org_id AND i.exam_id = e.id AND i.revoked_at IS NULL) AS invited,
                count(*) FILTER (WHERE a.id IS NOT NULL AND a.lifecycle IS DISTINCT FROM 'attempt_submitted'
                                  AND a.lifecycle IS DISTINCT FROM 'attempt_graded' AND a.lifecycle IS DISTINCT FROM 'attempt_voided') AS in_progress,
                count(*) FILTER (WHERE a.lifecycle = 'attempt_submitted') AS submitted,
                count(*) FILTER (WHERE a.lifecycle = 'attempt_graded') AS graded,
                count(*) FILTER (WHERE a.lifecycle = 'attempt_voided') AS voided
           FROM exams e
           LEFT JOIN LATERAL (
             SELECT att.id, ${lifecycleSql("att.org_id", "att.id")} AS lifecycle
               FROM attempts att WHERE att.org_id = e.org_id AND att.exam_id = e.id
           ) a ON true
           LEFT JOIN exam_windows w ON w.org_id = e.org_id AND w.exam_id = e.id
          WHERE e.org_id = $1
          GROUP BY e.org_id, e.id, e.title, e.created_at, e.definition, e.archived_at, w.opens_at, w.closes_at
          ORDER BY e.created_at DESC`,
        [scope.orgId],
      );
      return rows.map((row) => ({
        id: row.id as ExamId,
        title: row.title,
        questionCount: Number(row.question_count),
        createdAt: new Date(row.created_at).toISOString(),
        totalMarks: row.total_marks === null ? null : Number(row.total_marks),
        sectionCount: Number(row.section_count),
        durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
        proctored: row.proctored === true,
        cutoffPercent: row.cutoff_percent === null ? null : Number(row.cutoff_percent),
        attempts: {
          invited: Number(row.invited),
          inProgress: Number(row.in_progress),
          submitted: Number(row.submitted),
          graded: Number(row.graded),
          void: Number(row.voided),
        },
        window:
          row.opens_at === null || row.closes_at === null
            ? null
            : { opensAt: new Date(row.opens_at).toISOString(), closesAt: new Date(row.closes_at).toISOString() },
        archivedAt: row.archived_at === null ? null : new Date(row.archived_at).toISOString(),
      }));
    });
  }

  /**
   * Put an exam away, or bring it back. Only whether the console lists it
   * among current exams changes; returns false if there is no such exam.
   */
  async setExamArchived(scope: Scope, id: ExamId, archived: boolean, now: Date = new Date()): Promise<boolean> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `UPDATE exams SET archived_at = CASE WHEN $3 THEN coalesce(archived_at, $4::timestamptz) ELSE NULL END
          WHERE org_id = $1 AND id = $2
          RETURNING id`,
        [scope.orgId, id, archived, now.toISOString()],
      );
      return rows.length > 0;
    });
  }

  // --- attempts -------------------------------------------------------------

  /**
   * Attempts at one exam, with state derived in SQL.
   *
   * Folding every attempt's ledger to render a list would be correct and far
   * too slow; the closing events are enough to say where an attempt stands.
   */
  async listAttempts(scope: Scope, examId: ExamId): Promise<readonly AttemptSummary[]> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{
        id: string;
        candidate_id: string;
        last_seen_at: string | Date | null;
        entries: number | string;
        lifecycle: string | null;
      }>(
        `SELECT a.id,
                a.candidate_id,
                a.last_seen_at,
                (SELECT count(*) FROM exam_ledger l WHERE l.org_id = a.org_id AND l.attempt_id = a.id) AS entries,
                ${lifecycleSql("a.org_id", "a.id")} AS lifecycle
           FROM attempts a
          WHERE a.org_id = $1 AND a.exam_id = $2
          ORDER BY a.created_at DESC`,
        [scope.orgId, examId],
      );

      return rows.map((row) => ({
        id: row.id as AttemptId,
        candidateId: row.candidate_id as CandidateId,
        lastSeenAt: row.last_seen_at === null ? null : new Date(row.last_seen_at).toISOString(),
        entries: Number(row.entries),
        state: lifecycleState(row.lifecycle),
      }));
    });
  }

  async createAttempt(scope: Scope, id: AttemptId, examId: ExamId, candidateId: CandidateId): Promise<void> {
    await this.#scoped(scope, async (tx) => {
      await tx.query(`INSERT INTO attempts (org_id, id, exam_id, candidate_id) VALUES ($1, $2, $3, $4)`, [
        scope.orgId,
        id,
        examId,
        candidateId,
      ]);
      await this.#newKey(tx, scope, id);
    });
  }

  /**
   * Create the attempt if it does not exist yet. For starts that may be retried
   * after a failure part-way — an invitation claims its attempt id before the
   * attempt exists, so a crash between the two must be finishable.
   */
  async ensureAttempt(scope: Scope, id: AttemptId, examId: ExamId, candidateId: CandidateId): Promise<void> {
    await this.#scoped(scope, async (tx) => {
      await tx.query(
        `INSERT INTO attempts (org_id, id, exam_id, candidate_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [scope.orgId, id, examId, candidateId],
      );
      await this.#newKey(tx, scope, id);
    });
  }

  /** Record that the candidate's page checked in. Operational state, not evidence. */
  async touch(scope: Scope, attemptId: AttemptId, at: Timestamp): Promise<void> {
    await this.#scoped(scope, (tx) =>
      tx.query(`UPDATE attempts SET last_seen_at = $3 WHERE org_id = $1 AND id = $2`, [
        scope.orgId,
        attemptId,
        new Date(at).toISOString(),
      ]),
    );
  }

  // --- drafts ---------------------------------------------------------------

  /**
   * Keep the latest text for a question, uncommitted.
   *
   * Drafts are mutable and outside the chain on purpose (see migration 0004).
   * `savedAt` is the server's clock: it is compared against the deadline when
   * drafts are committed at the close of the window.
   */
  async saveDraft(
    scope: Scope,
    attemptId: AttemptId,
    questionId: QuestionId,
    answer: string,
    savedAt: Timestamp,
  ): Promise<void> {
    await this.#scoped(scope, (tx) =>
      tx.query(
        `INSERT INTO answer_drafts (org_id, attempt_id, question_id, answer, saved_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id, attempt_id, question_id)
         DO UPDATE SET answer = EXCLUDED.answer, saved_at = EXCLUDED.saved_at`,
        [scope.orgId, attemptId, questionId, answer, savedAt],
      ),
    );
  }

  async loadDrafts(scope: Scope, attemptId: AttemptId): Promise<readonly Draft[]> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{ question_id: string; answer: string; saved_at: number | string }>(
        `SELECT question_id, answer, saved_at FROM answer_drafts
          WHERE org_id = $1 AND attempt_id = $2 ORDER BY question_id`,
        [scope.orgId, attemptId],
      );
      return rows.map((row) => ({
        questionId: row.question_id as QuestionId,
        answer: row.answer,
        savedAt: Number(row.saved_at),
      }));
    });
  }

  // --- the ledger -----------------------------------------------------------

  /**
   * Append an event to an attempt's chain and return the entry committing to it.
   *
   * A `guard` is re-checked against the attempt's events *inside* the same
   * transaction that holds the attempt's row lock — which matters for anything
   * decided before a slow call, such as raising a probe.
   */
  async append(
    scope: Scope,
    attemptId: AttemptId,
    event: ExamEvent,
    options: { readonly guard?: (events: readonly ExamEvent[]) => string | null } = {},
  ): Promise<LedgerEntry> {
    return this.#scoped(scope, (tx) => this.#appendIn(tx, scope, attemptId, event, options.guard));
  }

  async #appendIn(
    tx: SqlExecutor,
    scope: Scope,
    attemptId: AttemptId,
    event: ExamEvent,
    guard?: (events: readonly ExamEvent[]) => string | null,
  ): Promise<LedgerEntry> {
    const locked = await tx.query<{ id: string }>(
      `SELECT id FROM attempts WHERE org_id = $1 AND id = $2 FOR UPDATE`,
      [scope.orgId, attemptId],
    );
    if (locked.length === 0) {
      throw new Error(`No such attempt: ${attemptId}`);
    }

    // Fetched lazily: only a guard or a personal event needs it.
    let key: Buffer | null | undefined | "unread" = "unread";
    const keyOf = async () => (key === "unread" ? (key = await this.#key(tx, scope, attemptId)) : key);

    if (guard !== undefined) {
      const rows = await tx.query<{ preimage: string }>(
        `SELECT preimage FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq ASC`,
        [scope.orgId, attemptId],
      );
      // A guard judges what the events say, so it reads them opened.
      const sealed = rows.map((row) => (JSON.parse(row.preimage) as { event: ExamEvent }).event);
      const opening = await keyOf();
      const events = opening === undefined ? sealed : sealed.map((e) => openEvent(e, opening));
      const refusal = guard(events);
      if (refusal !== null) throw new AppendRefused(refusal);
    }

    const head = await tx.query<{ seq: number; hash: string }>(
      `SELECT seq, hash FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq DESC LIMIT 1`,
      [scope.orgId, attemptId],
    );

    // Personal fields are sealed before hashing, so the chain commits to the
    // ciphertext and survives the key's erasure.
    let recorded = event;
    if (isPersonal(event)) {
      const sealing = await keyOf();
      if (sealing === null) throw new AppendRefused("This attempt's personal data has been erased");
      if (sealing !== undefined) recorded = sealEvent(event, sealing);
    }

    const previous = head[0];
    const draft = {
      seq: previous === undefined ? 0 : Number(previous.seq) + 1,
      timestamp: this.#clock(),
      event: recorded,
      prevHash: previous?.hash ?? GENESIS_HASH,
    } as const;

    const preimage = entryPreimage(draft);
    const hash = hashPreimage(preimage);

    await tx.query(
      `INSERT INTO exam_ledger (org_id, attempt_id, seq, ts, event_type, event, preimage, prev_hash, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        scope.orgId,
        attemptId,
        draft.seq,
        draft.timestamp,
        event.type,
        // The queryable copy holds what was hashed: sealed, like the preimage.
        JSON.stringify(recorded),
        preimage,
        draft.prevHash,
        hash,
      ],
    );

    // Announced in the same transaction: an integration hears of every
    // start, submission, grade and voiding that happened, and of none that
    // did not. The worker fans it out to webhooks and connectors (§7).
    const announced = ANNOUNCED[event.type];
    if (announced !== undefined) {
      await enqueue(tx, scope.orgId, [{ kind: "webhook", purpose: "event", subject: { event: announced, attemptId, seq: draft.seq } }], this.#newId);
    }

    return Object.freeze({ ...draft, hash });
  }

  /**
   * Erase an attempt's personal data (ROADMAP §11), in one transaction:
   * destroy its data key, so the sealed fields of its ledger can never be read
   * again; delete its unsent drafts; strip the invitation of name, email,
   * phone and reference; stop anything still queued to reach the candidate;
   * and record `data_erased` in the chain, which goes on verifying.
   *
   * Returns false if it was already erased. `guard` refuses, as for
   * {@link append}, when the attempt is in a state that may not be erased.
   */
  async erase(
    scope: Scope,
    attemptId: AttemptId,
    reason: "request" | "retention",
    options: { readonly decidedBy?: { userId: string; name: string }; readonly guard?: (events: readonly ExamEvent[]) => string | null } = {},
  ): Promise<boolean> {
    return this.#scoped(scope, async (tx) => {
      const current = await tx.query<{ erased_at: unknown }>(
        `SELECT erased_at FROM attempts WHERE org_id = $1 AND id = $2 FOR UPDATE`,
        [scope.orgId, attemptId],
      );
      if (current[0] === undefined) throw new Error(`No such attempt: ${attemptId}`);
      if (current[0].erased_at !== null) return false;

      await this.#appendIn(
        tx,
        scope,
        attemptId,
        { type: "data_erased", attemptId, reason, ...(options.decidedBy === undefined ? {} : { decidedBy: options.decidedBy }) },
        options.guard,
      );
      const at = new Date(this.#clock()).toISOString();
      // An attempt from before sealing has no key row: its ledger was never
      // sealed, which is what the erased marker on the attempt records.
      await tx.query(
        `INSERT INTO attempt_keys (org_id, attempt_id, wrapped_key, erased_at) VALUES ($1, $2, NULL, $3)
         ON CONFLICT (org_id, attempt_id) DO UPDATE SET wrapped_key = NULL, erased_at = EXCLUDED.erased_at`,
        [scope.orgId, attemptId, at],
      );
      await tx.query(`DELETE FROM answer_drafts WHERE org_id = $1 AND attempt_id = $2`, [scope.orgId, attemptId]);
      // Proctoring photos are unreadable once the key is gone; the rows go too.
      await tx.query(`DELETE FROM proctor_media WHERE org_id = $1 AND attempt_id = $2`, [scope.orgId, attemptId]);
      await tx.query(`DELETE FROM proctor_events WHERE org_id = $1 AND attempt_id = $2`, [scope.orgId, attemptId]);
      await tx.query(
        `UPDATE attempts SET candidate_id = 'erased', erased_at = $3, erasure_reason = $4 WHERE org_id = $1 AND id = $2`,
        [scope.orgId, attemptId, at, reason],
      );
      const invitations = await tx.query<{ id: string }>(
        `UPDATE invitations SET name = '', email = NULL, phone = NULL, source = NULL, candidate_ref = 'erased-' || id
          WHERE org_id = $1 AND attempt_id = $2 RETURNING id`,
        [scope.orgId, attemptId],
      );
      for (const { id } of invitations) {
        await tx.query(`UPDATE greenhouse_interviews SET profile_url = NULL WHERE org_id = $1 AND invitation_id = $2`, [scope.orgId, id]);
        await tx.query(
          `UPDATE outbox SET status = 'skipped', last_error = 'personal data erased'
            WHERE org_id = $1 AND kind IN ('email', 'sms') AND status = 'pending' AND subject->>'invitationId' = $2`,
          [scope.orgId, id],
        );
      }
      return true;
    });
  }

  /**
   * Attempts whose retention period has run out: nothing written to them for
   * the organisation's `retention_days`, not yet erased. Only for an
   * organisation that has set its privacy settings. `open` marks one never
   * submitted — abandoned — which has to be closed before it can be erased.
   */
  async dueForErasure(scope: Scope, now: Timestamp, limit = 100): Promise<readonly { readonly attemptId: AttemptId; readonly open: boolean }[]> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{ id: string; lifecycle: string | null }>(
        `SELECT a.id, ${lifecycleSql("a.org_id", "a.id")} AS lifecycle
           FROM attempts a JOIN privacy_settings p ON p.org_id = a.org_id
          WHERE a.org_id = $1 AND a.erased_at IS NULL
            AND (SELECT max(l.ts) FROM exam_ledger l WHERE l.org_id = a.org_id AND l.attempt_id = a.id) < $2 - p.retention_days::bigint * 86400000
          ORDER BY a.created_at LIMIT $3`,
        [scope.orgId, now, limit],
      );
      return rows.map((r) => ({ attemptId: r.id as AttemptId, open: lifecycleState(r.lifecycle) === "in_progress" }));
    });
  }

  /** Load an attempt's chain, rebuilt from the stored preimages. */
  async load(scope: Scope, attemptId: AttemptId): Promise<readonly LedgerEntry[]> {
    return (await this.loadBoth(scope, attemptId)).opened;
  }

  /**
   * The chain exactly as hashed, personal fields still sealed: what a receipt
   * carries and a verifier checks. Needs no key, so an auditor or a restore
   * drill can check every chain without being able to read one.
   */
  async loadRecord(scope: Scope, attemptId: AttemptId): Promise<readonly LedgerEntry[]> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<StoredRow>(
        `SELECT seq, ts, event, preimage, prev_hash, hash
           FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq ASC`,
        [scope.orgId, attemptId],
      );
      return rows.map(entryFromRow);
    });
  }

  /**
   * An attempt's chain both ways: `record`, exactly as hashed — what a receipt
   * carries and a verifier checks — and `opened`, with personal fields
   * decrypted for the application to use (or `[erased]`). Only `record`
   * verifies against its hashes once anything in it was sealed.
   */
  async loadBoth(scope: Scope, attemptId: AttemptId): Promise<{ record: readonly LedgerEntry[]; opened: readonly LedgerEntry[] }> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<StoredRow>(
        `SELECT seq, ts, event, preimage, prev_hash, hash
           FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq ASC`,
        [scope.orgId, attemptId],
      );
      const record = rows.map(entryFromRow);
      const key = await this.#key(tx, scope, attemptId);
      return { record, opened: key === undefined ? record : record.map((e) => this.#open(e, key)) };
    });
  }

  /**
   * Every attempt's chain at one exam, in one query — for results over a whole
   * cohort, where loading two thousand chains one at a time would not do.
   */
  async loadExamLedgers(scope: Scope, examId: ExamId): Promise<ReadonlyMap<AttemptId, readonly LedgerEntry[]>> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<StoredRow & { attempt_id: string }>(
        `SELECT l.attempt_id, l.seq, l.ts, l.event, l.preimage, l.prev_hash, l.hash
           FROM exam_ledger l JOIN attempts a ON a.org_id = l.org_id AND a.id = l.attempt_id
          WHERE l.org_id = $1 AND a.exam_id = $2
          ORDER BY a.created_at, l.attempt_id, l.seq`,
        [scope.orgId, examId],
      );
      const wrapped = await tx.query<{ attempt_id: string; wrapped_key: string | null }>(
        `SELECT k.attempt_id, k.wrapped_key FROM attempt_keys k JOIN attempts a ON a.org_id = k.org_id AND a.id = k.attempt_id
          WHERE k.org_id = $1 AND a.exam_id = $2`,
        [scope.orgId, examId],
      );
      const keys = new Map<string, Buffer | null>();
      for (const k of wrapped) {
        if (k.wrapped_key === null) keys.set(k.attempt_id, null);
        else if (this.#keys === null) throw new Error("This ledger is sealed and no data key (PARIKSHAA_DATA_KEY) is configured");
        else keys.set(k.attempt_id, this.#keys.unwrap(scope.orgId, k.attempt_id, k.wrapped_key));
      }
      const chains = new Map<AttemptId, LedgerEntry[]>();
      for (const row of rows) {
        const id = row.attempt_id as AttemptId;
        const chain = chains.get(id) ?? [];
        chain.push(this.#open(entryFromRow(row), keys.has(id) ? keys.get(id)! : undefined));
        chains.set(id, chain);
      }
      return chains;
    });
  }

  async head(scope: Scope, attemptId: AttemptId): Promise<string> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{ hash: string }>(
        `SELECT hash FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq DESC LIMIT 1`,
        [scope.orgId, attemptId],
      );
      return rows[0]?.hash ?? GENESIS_HASH;
    });
  }

  /** Whether the attempt's chain has begun: one indexed lookup, for the common case of a candidate reopening their link. */
  async hasStarted(scope: Scope, attemptId: AttemptId): Promise<boolean> {
    return this.#scoped(scope, async (tx) =>
      (await tx.query(`SELECT 1 FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 LIMIT 1`, [scope.orgId, attemptId])).length > 0,
    );
  }

  /** Every attempt in the organisation, oldest first: for walking all of its chains. */
  async attemptIds(scope: Scope): Promise<readonly AttemptId[]> {
    return this.#scoped(scope, async (tx) =>
      (await tx.query<{ id: string }>(`SELECT id FROM attempts WHERE org_id = $1 ORDER BY created_at, id`, [scope.orgId])).map(
        (r) => r.id as AttemptId,
      ),
    );
  }

  /**
   * Check stored rows against their own hashes, and check the jsonb copy
   * against the authoritative preimage. A `jsonb_drift` result means the
   * database re-rendered a value; nothing was tampered with, but any code that
   * recomputed a hash from the jsonb column would report that it had.
   */
  async verifyStored(scope: Scope, attemptId: AttemptId): Promise<StoredIntegrityResult> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<StoredRow>(
        `SELECT seq, ts, event, preimage, prev_hash, hash
           FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq ASC`,
        [scope.orgId, attemptId],
      );

      let expectedPrev = GENESIS_HASH;
      for (const [index, row] of rows.entries()) {
        const seq = Number(row.seq);
        if (seq !== index) return { ok: false, seq: index, reason: "bad_sequence" } as const;
        if (row.prev_hash !== expectedPrev) return { ok: false, seq, reason: "broken_link" } as const;
        if (hashPreimage(row.preimage) !== row.hash) return { ok: false, seq, reason: "hash_mismatch" } as const;

        const entry = entryFromRow(row);
        if (entryHash(entry) !== row.hash) return { ok: false, seq, reason: "hash_mismatch" } as const;
        if (canonicalize(row.event) !== canonicalize(entry.event)) {
          return { ok: false, seq, reason: "jsonb_drift" } as const;
        }

        expectedPrev = row.hash;
      }
      return { ok: true, length: rows.length } as const;
    });
  }

  // --- audit ----------------------------------------------------------------

  async appendAudit(scope: Scope, entry: AuditEntry): Promise<void> {
    await this.#scoped(scope, (tx) =>
      tx.query(
        `INSERT INTO audit_log (id, org_id, actor_kind, actor_id, action, target, detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          this.#newId(),
          scope.orgId,
          entry.actorKind,
          entry.actorId,
          entry.action,
          entry.target ?? null,
          JSON.stringify(entry.detail ?? {}),
        ],
      ),
    );
  }

  async listAudit(scope: Scope, limit = 100): Promise<readonly AuditRecord[]> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{
        at: string | Date;
        actor_kind: AuditEntry["actorKind"];
        actor_id: string | null;
        action: string;
        target: string | null;
        detail: Record<string, unknown>;
      }>(
        `SELECT at, actor_kind, actor_id, action, target, detail
           FROM audit_log WHERE org_id = $1 ORDER BY at DESC, id DESC LIMIT $2`,
        [scope.orgId, limit],
      );
      return rows.map((row) => ({
        at: new Date(row.at).toISOString(),
        actorKind: row.actor_kind,
        actorId: row.actor_id,
        action: row.action,
        target: row.target,
        detail: row.detail,
      }));
    });
  }

  /**
   * What the console's home page shows: the sittings around now — open, and
   * scheduled, with those closed in the last week — the latest actions, and
   * which first steps the organisation has taken.
   */
  async dashboard(scope: Scope, now: Date, options: { readonly activity: boolean }): Promise<Dashboard> {
    return this.#scoped(scope, async (tx) => {
      const windows = await tx.query<{
        exam_id: string;
        title: string | null;
        opens_at: string | Date;
        closes_at: string | Date;
        invited: string | number;
        started: string | number;
      }>(
        `SELECT w.exam_id, e.definition ->> 'title' AS title, w.opens_at, w.closes_at,
                (SELECT count(*) FROM invitations i WHERE i.org_id = w.org_id AND i.exam_id = w.exam_id AND i.revoked_at IS NULL) AS invited,
                (SELECT count(*) FROM invitations i WHERE i.org_id = w.org_id AND i.exam_id = w.exam_id AND i.attempt_id IS NOT NULL) AS started
           FROM exam_windows w
           JOIN exams e ON e.org_id = w.org_id AND e.id = w.exam_id
          WHERE w.org_id = $1 AND w.closes_at > $2::timestamptz - interval '7 days'
          -- The sixty nearest now: open ones first, then the soonest to come, then the latest closed.
          ORDER BY (w.opens_at <= $2::timestamptz AND w.closes_at > $2::timestamptz) DESC,
                   (w.opens_at > $2::timestamptz) DESC,
                   abs(extract(epoch FROM w.opens_at - $2::timestamptz))
          LIMIT 60`,
        [scope.orgId, now.toISOString()],
      );
      const activity = options.activity
        ? await tx.query<{
            at: string | Date;
            actor_kind: AuditEntry["actorKind"];
            actor_name: string | null;
            action: string;
            target: string | null;
            exam_id: string | null;
            exam_title: string | null;
          }>(
            // The exam an action concerns, by name: the target is an exam, or
            // an attempt or invitation on one.
            `SELECT a.at, a.actor_kind, s.name AS actor_name, a.action, a.target,
                    coalesce(ex.id, ae.id, ie.id) AS exam_id, coalesce(ex.title, ae.title, ie.title) AS exam_title
               FROM audit_log a
               LEFT JOIN staff_users s ON a.actor_kind = 'user' AND s.id = a.actor_id AND s.org_id = a.org_id
               LEFT JOIN exams ex ON ex.org_id = a.org_id AND ex.id = a.target
               LEFT JOIN attempts att ON att.org_id = a.org_id AND att.id = a.target
               LEFT JOIN exams ae ON ae.org_id = att.org_id AND ae.id = att.exam_id
               LEFT JOIN invitations inv ON inv.org_id = a.org_id AND inv.id = a.target
               LEFT JOIN exams ie ON ie.org_id = inv.org_id AND ie.id = inv.exam_id
              WHERE a.org_id = $1
              ORDER BY a.at DESC, a.id DESC
              LIMIT 10`,
            [scope.orgId],
          )
        : null;
      // The sample exam and its questions are there to look at: they do not
      // count as the organisation's own first exam or first questions.
      const [facts] = await tx.query<{
        exams: string | number;
        bank: string | number;
        windows: string | number;
        invited: string | number;
        staff: string | number;
        notice: boolean;
        sample: boolean;
      }>(
        `SELECT (SELECT count(*) FROM exams WHERE org_id = $1 AND id <> $2) AS exams,
                (SELECT count(*) FROM bank_questions WHERE org_id = $1 AND archived_at IS NULL AND NOT ($3 = ANY (tags))) AS bank,
                (SELECT count(*) FROM exam_windows WHERE org_id = $1) AS windows,
                (SELECT count(*) FROM invitations WHERE org_id = $1) AS invited,
                (SELECT count(*) FROM staff_users WHERE org_id = $1 AND disabled_at IS NULL) AS staff,
                EXISTS (SELECT 1 FROM privacy_settings WHERE org_id = $1) AS notice,
                EXISTS (SELECT 1 FROM exams WHERE org_id = $1 AND id = $2 AND archived_at IS NULL) AS sample`,
        [scope.orgId, SAMPLE_EXAM_ID, SAMPLE_TAG],
      );
      return {
        sittings: [...windows].sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime()).map((w) => ({
          examId: w.exam_id,
          title: w.title ?? w.exam_id,
          opensAt: new Date(w.opens_at).toISOString(),
          closesAt: new Date(w.closes_at).toISOString(),
          invited: Number(w.invited),
          started: Number(w.started),
        })),
        activity:
          activity === null
            ? null
            : activity.map((a) => ({
                at: new Date(a.at).toISOString(),
                actor: a.actor_kind === "user" ? (a.actor_name ?? "A former member of staff") : a.actor_kind === "api_key" ? "An API key" : "Parikshaa",
                action: a.action,
                target: a.target,
                exam: a.exam_id === null ? null : { id: a.exam_id, title: a.exam_title ?? a.exam_id },
              })),
        setup: {
          exams: Number(facts!.exams),
          bankQuestions: Number(facts!.bank),
          scheduled: Number(facts!.windows),
          invited: Number(facts!.invited),
          staff: Number(facts!.staff),
          privacyNotice: facts!.notice,
          sampleExamId: facts!.sample ? SAMPLE_EXAM_ID : null,
        },
      };
    });
  }

  // --- model usage (ROADMAP §0) ----------------------------------------------

  async recordUsage(scope: Scope, usage: UsageRecord): Promise<void> {
    await this.#scoped(scope, (tx) =>
      tx.query(
        `INSERT INTO model_usage (id, org_id, attempt_id, route, model, speed, input_tokens, output_tokens,
                                  cache_read_tokens, cache_write_5m_tokens, cache_write_1h_tokens, cost_micro_usd,
                                  inference_geo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          this.#newId(),
          scope.orgId,
          usage.attemptId,
          usage.route,
          usage.model,
          usage.speed,
          usage.inputTokens,
          usage.outputTokens,
          usage.cacheReadTokens,
          usage.cacheWrite5mTokens,
          usage.cacheWrite1hTokens,
          usage.costMicroUsd,
          usage.inferenceGeo,
        ],
      ),
    );
  }

  /** Total model spend since a moment, in micro-dollars. */
  async spendSince(scope: Scope, since: Date): Promise<number> {
    return this.#scoped(scope, async (tx) => {
      const rows = await tx.query<{ total: number | string | null }>(
        `SELECT coalesce(sum(cost_micro_usd), 0) AS total FROM model_usage WHERE org_id = $1 AND at >= $2`,
        [scope.orgId, since.toISOString()],
      );
      return Number(rows[0]?.total ?? 0);
    });
  }

  /**
   * Spend and token counts since a moment, broken down by route.
   *
   * The per-attempt figures are the number pricing is built on (ROADMAP §0).
   * Cache writes are reported by TTL so it is visible whether the one-hour
   * entries are earning their doubled write price.
   */
  async usageReport(scope: Scope, since: Date): Promise<UsageReport> {
    return this.#scoped(scope, async (tx) => {
      const byRoute = await tx.query<{
        route: UsageRecord["route"];
        calls: number | string;
        input_tokens: number | string;
        output_tokens: number | string;
        cache_read_tokens: number | string;
        cache_write_5m_tokens: number | string;
        cache_write_1h_tokens: number | string;
        cost_micro_usd: number | string;
      }>(
        `SELECT route,
                count(*)                   AS calls,
                sum(input_tokens)          AS input_tokens,
                sum(output_tokens)         AS output_tokens,
                sum(cache_read_tokens)     AS cache_read_tokens,
                sum(cache_write_5m_tokens) AS cache_write_5m_tokens,
                sum(cache_write_1h_tokens) AS cache_write_1h_tokens,
                sum(cost_micro_usd)        AS cost_micro_usd
           FROM model_usage WHERE org_id = $1 AND at >= $2
          GROUP BY route ORDER BY route`,
        [scope.orgId, since.toISOString()],
      );

      const perAttempt = await tx.query<{ attempts: number | string; p50: number | null; p90: number | null; max: number | string | null }>(
        `SELECT count(*) AS attempts,
                percentile_cont(0.5) WITHIN GROUP (ORDER BY cost) AS p50,
                percentile_cont(0.9) WITHIN GROUP (ORDER BY cost) AS p90,
                max(cost) AS max
           FROM (SELECT attempt_id, sum(cost_micro_usd) AS cost
                   FROM model_usage
                  WHERE org_id = $1 AND at >= $2 AND attempt_id IS NOT NULL
                  GROUP BY attempt_id) per_attempt`,
        [scope.orgId, since.toISOString()],
      );

      const geos = await tx.query<{ geo: string | null; calls: number | string }>(
        `SELECT inference_geo AS geo, count(*) AS calls
           FROM model_usage WHERE org_id = $1 AND at >= $2
          GROUP BY inference_geo ORDER BY count(*) DESC`,
        [scope.orgId, since.toISOString()],
      );

      const routes = byRoute.map((row) => ({
        route: row.route,
        calls: Number(row.calls),
        inputTokens: Number(row.input_tokens),
        outputTokens: Number(row.output_tokens),
        cacheReadTokens: Number(row.cache_read_tokens),
        cacheWrite5mTokens: Number(row.cache_write_5m_tokens),
        cacheWrite1hTokens: Number(row.cache_write_1h_tokens),
        costMicroUsd: Number(row.cost_micro_usd),
      }));
      const summary = perAttempt[0];

      return {
        since: since.toISOString(),
        totalCostMicroUsd: routes.reduce((sum, r) => sum + r.costMicroUsd, 0),
        routes,
        perAttempt: {
          attempts: Number(summary?.attempts ?? 0),
          p50MicroUsd: summary?.p50 === null || summary?.p50 === undefined ? null : Math.round(Number(summary.p50)),
          p90MicroUsd: summary?.p90 === null || summary?.p90 === undefined ? null : Math.round(Number(summary.p90)),
          maxMicroUsd: summary?.max === null || summary?.max === undefined ? null : Number(summary.max),
        },
        inferenceGeos: geos.map((row) => ({ geo: row.geo, calls: Number(row.calls) })),
      };
    });
  }
}

export interface ExamSummary {
  readonly id: ExamId;
  readonly title: string;
  readonly questionCount: number;
  readonly createdAt: string;
  /** Marks on the paper: the fixed questions', and each section's draw at its first question's marks. */
  readonly totalMarks: number | null;
  readonly sectionCount: number;
  readonly durationMs: number | null;
  readonly proctored: boolean;
  /** The qualifying mark, as a percentage of the paper, if one is set. */
  readonly cutoffPercent: number | null;
  /** Where its candidates stand: invitations not revoked, and attempts by state. */
  readonly attempts: {
    readonly invited: number;
    readonly inProgress: number;
    readonly submitted: number;
    readonly graded: number;
    readonly void: number;
  };
  /** When it can be sat, if a window has been set. */
  readonly window: { readonly opensAt: string; readonly closesAt: string } | null;
  /** When it was put away, or null while it is current. */
  readonly archivedAt: string | null;
}

export interface AttemptSummary {
  readonly id: AttemptId;
  readonly candidateId: CandidateId;
  /** When the candidate's page last checked in, or null if it never has. */
  readonly lastSeenAt: string | null;
  readonly entries: number;
  readonly state: "in_progress" | "submitted" | "graded" | "void";
}

export interface Draft {
  readonly questionId: QuestionId;
  readonly answer: string;
  readonly savedAt: Timestamp;
}

export interface AuditEntry {
  readonly actorKind: "user" | "api_key" | "system";
  readonly actorId: string | null;
  readonly action: string;
  readonly target?: string;
  readonly detail?: Record<string, unknown>;
}

/** The console's home page: see `LedgerStore.dashboard`. */
export interface Dashboard {
  readonly sittings: readonly {
    readonly examId: string;
    readonly title: string;
    readonly opensAt: string;
    readonly closesAt: string;
    readonly invited: number;
    readonly started: number;
  }[];
  /** Null for an account that may not read the audit log. */
  readonly activity:
    | readonly {
        readonly at: string;
        readonly actor: string;
        readonly action: string;
        readonly target: string | null;
        /** The exam it concerns, if any: the target itself, or the exam of the attempt or invitation it names. */
        readonly exam: { readonly id: string; readonly title: string } | null;
      }[]
    | null;
  readonly setup: {
    readonly exams: number;
    readonly bankQuestions: number;
    readonly scheduled: number;
    readonly invited: number;
    readonly staff: number;
    readonly privacyNotice: boolean;
    /** The sample exam, while it is loaded and not put away. */
    readonly sampleExamId: string | null;
  };
}

/** The sample exam a new organisation can load to look around (see the API's `onboarding.ts`): one per organisation, at this id. */
export const SAMPLE_EXAM_ID = "sample-aptitude";
/** The tag on the sample's questions in the bank. */
export const SAMPLE_TAG = "sample";

export interface AuditRecord {
  readonly at: string;
  readonly actorKind: AuditEntry["actorKind"];
  readonly actorId: string | null;
  readonly action: string;
  readonly target: string | null;
  readonly detail: Record<string, unknown>;
}

export interface UsageRecord {
  readonly attemptId: AttemptId | null;
  readonly route: "probe" | "assess" | "grade" | "tutor";
  readonly model: string;
  readonly speed: "standard" | "fast";
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheWrite5mTokens: number;
  readonly cacheWrite1hTokens: number;
  readonly costMicroUsd: number;
  readonly inferenceGeo: string | null;
}

export interface UsageReport {
  readonly since: string;
  readonly totalCostMicroUsd: number;
  readonly routes: readonly (Omit<UsageRecord, "attemptId" | "route" | "model" | "speed" | "inferenceGeo"> & {
    readonly route: UsageRecord["route"];
    readonly calls: number;
  })[];
  readonly perAttempt: {
    readonly attempts: number;
    readonly p50MicroUsd: number | null;
    readonly p90MicroUsd: number | null;
    readonly maxMicroUsd: number | null;
  };
  /** Where inference ran. Matters for data-residency questions (ROADMAP §11). */
  readonly inferenceGeos: readonly { readonly geo: string | null; readonly calls: number }[];
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
