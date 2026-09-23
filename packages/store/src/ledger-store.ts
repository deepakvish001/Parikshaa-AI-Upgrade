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

  constructor(
    sql: SqlExecutor,
    options: { readonly clock?: () => Timestamp; readonly newId?: () => string } = {},
  ) {
    this.#sql = sql;
    this.#clock = options.clock ?? (() => Date.now());
    this.#newId = options.newId ?? (() => crypto.randomUUID());
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
      const rows = await tx.query<{ id: string; title: string; question_count: number | string }>(
        // Questions per paper: the fixed ones, plus what each section draws.
        `SELECT id, title,
                jsonb_array_length(definition -> 'questions')
                  + coalesce((SELECT sum((s ->> 'pick')::int)
                                FROM jsonb_array_elements(coalesce(definition -> 'sections', '[]'::jsonb)) s), 0)
                  AS question_count
           FROM exams WHERE org_id = $1 ORDER BY created_at DESC`,
        [scope.orgId],
      );
      return rows.map((row) => ({
        id: row.id as ExamId,
        title: row.title,
        questionCount: Number(row.question_count),
      }));
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
        submitted: boolean;
        graded: boolean;
        voided: boolean;
      }>(
        `SELECT a.id,
                a.candidate_id,
                a.last_seen_at,
                (SELECT count(*) FROM exam_ledger l WHERE l.org_id = a.org_id AND l.attempt_id = a.id) AS entries,
                EXISTS (SELECT 1 FROM exam_ledger l WHERE l.org_id = a.org_id AND l.attempt_id = a.id AND l.event_type = 'attempt_submitted') AS submitted,
                EXISTS (SELECT 1 FROM exam_ledger l WHERE l.org_id = a.org_id AND l.attempt_id = a.id AND l.event_type = 'attempt_graded') AS graded,
                EXISTS (SELECT 1 FROM exam_ledger l WHERE l.org_id = a.org_id AND l.attempt_id = a.id AND l.event_type = 'attempt_voided') AS voided
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
        state: row.voided ? "void" : row.graded ? "graded" : row.submitted ? "submitted" : "in_progress",
      }));
    });
  }

  async createAttempt(scope: Scope, id: AttemptId, examId: ExamId, candidateId: CandidateId): Promise<void> {
    await this.#scoped(scope, (tx) =>
      tx.query(`INSERT INTO attempts (org_id, id, exam_id, candidate_id) VALUES ($1, $2, $3, $4)`, [
        scope.orgId,
        id,
        examId,
        candidateId,
      ]),
    );
  }

  /**
   * Create the attempt if it does not exist yet. For starts that may be retried
   * after a failure part-way — an invitation claims its attempt id before the
   * attempt exists, so a crash between the two must be finishable.
   */
  async ensureAttempt(scope: Scope, id: AttemptId, examId: ExamId, candidateId: CandidateId): Promise<void> {
    await this.#scoped(scope, (tx) =>
      tx.query(
        `INSERT INTO attempts (org_id, id, exam_id, candidate_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [scope.orgId, id, examId, candidateId],
      ),
    );
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
    return this.#scoped(scope, async (tx) => {
      const locked = await tx.query<{ id: string }>(
        `SELECT id FROM attempts WHERE org_id = $1 AND id = $2 FOR UPDATE`,
        [scope.orgId, attemptId],
      );
      if (locked.length === 0) {
        throw new Error(`No such attempt: ${attemptId}`);
      }

      if (options.guard !== undefined) {
        const rows = await tx.query<{ preimage: string }>(
          `SELECT preimage FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq ASC`,
          [scope.orgId, attemptId],
        );
        const events = rows.map((row) => (JSON.parse(row.preimage) as { event: ExamEvent }).event);
        const refusal = options.guard(events);
        if (refusal !== null) throw new AppendRefused(refusal);
      }

      const head = await tx.query<{ seq: number; hash: string }>(
        `SELECT seq, hash FROM exam_ledger WHERE org_id = $1 AND attempt_id = $2 ORDER BY seq DESC LIMIT 1`,
        [scope.orgId, attemptId],
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
        `INSERT INTO exam_ledger (org_id, attempt_id, seq, ts, event_type, event, preimage, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          scope.orgId,
          attemptId,
          draft.seq,
          draft.timestamp,
          event.type,
          JSON.stringify(event),
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
    });
  }

  /** Load an attempt's chain, rebuilt from the stored preimages. */
  async load(scope: Scope, attemptId: AttemptId): Promise<readonly LedgerEntry[]> {
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
      const chains = new Map<AttemptId, LedgerEntry[]>();
      for (const row of rows) {
        const id = row.attempt_id as AttemptId;
        const chain = chains.get(id) ?? [];
        chain.push(entryFromRow(row));
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
  readonly route: "probe" | "assess" | "grade";
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
