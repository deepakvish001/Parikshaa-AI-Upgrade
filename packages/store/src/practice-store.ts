import type { OrgId, Question } from "@parikshaa/core";
import type { Difficulty } from "./question-bank.js";
import { enqueue } from "./outbox-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Practice (ROADMAP §15): an organisation's practice site, its learners, the
 * problems it publishes, and what learners do with them.
 *
 * Learners are a third kind of actor, beside staff and candidates, and have
 * their own scope: a learner scope cannot be passed to anything that touches
 * exams or the ledger, because it is not the type those take. Row-level
 * security admits a learner to published problems, contests, visible comments,
 * and their own submissions — nothing else. Aggregates over every learner (a
 * leaderboard, a scoreboard, how often a problem is solved) are read by the
 * service in the organisation's staff scope and published as names and counts.
 */

export type PracticeScope =
  | { readonly orgId: OrgId; readonly actor: "staff" }
  /** `learnerId` null: a visitor who has not signed in, who may read what is published. */
  | { readonly orgId: OrgId; readonly actor: "learner"; readonly learnerId: string | null };

export const practiceStaff = (orgId: OrgId): PracticeScope => ({ orgId, actor: "staff" });
export const practiceLearner = (orgId: OrgId, learnerId: string | null): PracticeScope & { readonly actor: "learner" } => ({ orgId, actor: "learner", learnerId });

function scoped<T>(sql: SqlExecutor, scope: PracticeScope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return sql.transaction(fn, {
    "parikshaa.org_id": scope.orgId,
    "parikshaa.actor": scope.actor,
    "parikshaa.attempt_id": "",
    "parikshaa.learner_id": scope.actor === "learner" ? (scope.learnerId ?? "") : "",
  });
}

export interface PracticeSite {
  readonly orgId: OrgId;
  readonly slug: string;
  readonly title: string;
  readonly welcome: string;
  readonly open: boolean;
}

export interface Learner {
  readonly id: string;
  readonly orgId: OrgId;
  readonly email: string;
  readonly name: string;
  readonly createdAt: string;
  readonly erased: boolean;
  /** The learner proved the address is theirs: by the emailed link, or a provider that vouched for it. */
  readonly emailVerified: boolean;
}

/** How a site's learners may sign in. The Google secret is sealed by the caller. */
export interface PracticeSignIn {
  readonly requireVerified: boolean;
  readonly googleEnabled: boolean;
  readonly googleClientId: string | null;
  readonly googleClientSecret: string | null;
}

export interface LearnerWithSecret extends Learner {
  readonly passwordHash: string;
}

export interface PracticeProblem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly question: Question;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly editorial: string;
  /** The author's first hint, given as rung 1 of the ladder in place of the tutor's. Empty when there is none. */
  readonly hint: string;
  readonly fromBank: string | null;
  readonly position: number;
  readonly published: boolean;
  readonly updatedAt: string;
}

export interface ProblemDraft {
  readonly slug: string;
  readonly title: string;
  readonly question: Question;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly editorial: string;
  /** Empty or absent: no author's hint. */
  readonly hint?: string;
  readonly fromBank: string | null;
  readonly position: number;
  readonly published: boolean;
}

export interface Contest {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly problemIds: readonly string[];
}

export type ContestDraft = Omit<Contest, "id">;

export interface Submission {
  readonly id: string;
  readonly learnerId: string;
  readonly problemId: string;
  readonly contestId: string | null;
  readonly language: string | null;
  readonly answer: string;
  readonly status: string;
  readonly passed: number;
  readonly total: number;
  readonly timeMs: number | null;
  readonly memoryKb: number | null;
  readonly createdAt: string;
}

export type SubmissionDraft = Omit<Submission, "id" | "createdAt" | "learnerId">;

export interface Comment {
  readonly id: string;
  readonly problemId: string;
  readonly authorName: string;
  /** The learner who wrote it; null for staff. */
  readonly learnerId: string | null;
  /** Written by the institution's staff, not a learner. */
  readonly fromStaff: boolean;
  readonly body: string;
  readonly createdAt: string;
  readonly hidden: boolean;
}

export interface ProblemStats {
  readonly problemId: string;
  readonly submissions: number;
  readonly accepted: number;
  /** Learners who have solved it. */
  readonly solvedBy: number;
}

export interface LeaderboardRow {
  readonly learnerId: string;
  readonly name: string;
  readonly solved: number;
  readonly lastSolvedAt: string;
}

export interface LearnerSummary extends Learner {
  readonly solved: number;
  readonly submissions: number;
  readonly lastActiveAt: string | null;
}

/** A learner's first accepted submission of each problem, and every day they were accepted anything. */
export interface Progress {
  readonly solved: readonly { readonly problemId: string; readonly at: string }[];
  readonly attempted: readonly string[];
  /** Accepted submissions by day (YYYY-MM-DD, India Standard Time). */
  readonly days: readonly { readonly day: string; readonly accepted: number; readonly submitted: number }[];
}

export class SlugTaken extends Error {
  constructor(what: string) {
    super(`That ${what} address is taken`);
    this.name = "SlugTaken";
  }
}

export class EmailTaken extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "EmailTaken";
  }
}

const iso = (value: string | Date) => new Date(value).toISOString();

/**
 * Whose submissions a query reads: a learner only ever their own — named in the
 * query as well as enforced by row-level security — and staff whoever they ask
 * about. A visitor who has not signed in has none.
 */
const whose = (scope: PracticeScope, asked?: string): string | null =>
  scope.actor === "learner" ? scope.learnerId : (asked ?? null);
const isUnique = (error: unknown) => (error as { code?: string }).code === "23505";

interface ProblemRow {
  id: string;
  slug: string;
  title: string;
  question: Question;
  difficulty: Difficulty;
  tags: string[];
  editorial: string;
  hint: string;
  from_bank: string | null;
  position: number;
  published: boolean;
  updated_at: string | Date;
}
const toProblem = (r: ProblemRow): PracticeProblem => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  question: r.question,
  difficulty: r.difficulty,
  tags: r.tags,
  editorial: r.editorial,
  hint: r.hint,
  fromBank: r.from_bank,
  position: r.position,
  published: r.published,
  updatedAt: iso(r.updated_at),
});
const PROBLEM_COLUMNS = "id, slug, title, question, difficulty, tags, editorial, hint, from_bank, position, published, updated_at";

interface ContestRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  starts_at: string | Date;
  ends_at: string | Date;
  problem_ids: string[];
}
const toContest = (r: ContestRow): Contest => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  description: r.description,
  startsAt: iso(r.starts_at),
  endsAt: iso(r.ends_at),
  problemIds: r.problem_ids,
});

interface SubmissionRow {
  id: string;
  learner_id: string;
  problem_id: string;
  contest_id: string | null;
  language: string | null;
  answer: string;
  status: string;
  passed: number;
  total: number;
  time_ms: number | null;
  memory_kb: number | null;
  created_at: string | Date;
}
const toSubmission = (r: SubmissionRow): Submission => ({
  id: r.id,
  learnerId: r.learner_id,
  problemId: r.problem_id,
  contestId: r.contest_id,
  language: r.language,
  answer: r.answer,
  status: r.status,
  passed: Number(r.passed),
  total: Number(r.total),
  timeMs: r.time_ms === null ? null : Number(r.time_ms),
  memoryKb: r.memory_kb === null ? null : Number(r.memory_kb),
  createdAt: iso(r.created_at),
});

interface LearnerRow {
  id: string;
  org_id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string | Date;
  erased_at: string | Date | null;
  email_verified_at: string | Date | null;
}
const LEARNER_COLUMNS = "id, org_id, email, name, password_hash, created_at, erased_at, email_verified_at";
const toLearner = (r: LearnerRow): LearnerWithSecret => ({
  id: r.id,
  orgId: r.org_id as OrgId,
  email: r.email,
  name: r.name,
  passwordHash: r.password_hash,
  createdAt: iso(r.created_at),
  erased: r.erased_at !== null,
  emailVerified: r.email_verified_at !== null && r.email_verified_at !== undefined,
});
const withoutSecret = ({ passwordHash: _, ...learner }: LearnerWithSecret): Learner => learner;

export class PracticeStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- the site -----------------------------------------------------------------

  async siteBySlug(slug: string): Promise<PracticeSite | null> {
    const rows = await this.#sql.query<{ org_id: string; slug: string; title: string; welcome: string; open: boolean }>(
      `SELECT org_id, slug, title, welcome, open FROM practice_sites WHERE slug = $1`,
      [slug],
    );
    const r = rows[0];
    return r === undefined ? null : { orgId: r.org_id as OrgId, slug: r.slug, title: r.title, welcome: r.welcome, open: r.open };
  }

  async siteOf(orgId: OrgId): Promise<PracticeSite | null> {
    const rows = await this.#sql.query<{ org_id: string; slug: string; title: string; welcome: string; open: boolean }>(
      `SELECT org_id, slug, title, welcome, open FROM practice_sites WHERE org_id = $1`,
      [orgId],
    );
    const r = rows[0];
    return r === undefined ? null : { orgId: r.org_id as OrgId, slug: r.slug, title: r.title, welcome: r.welcome, open: r.open };
  }

  async saveSite(site: PracticeSite): Promise<PracticeSite> {
    try {
      await this.#sql.query(
        `INSERT INTO practice_sites (org_id, slug, title, welcome, open) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (org_id) DO UPDATE SET slug = $2, title = $3, welcome = $4, open = $5, updated_at = now()`,
        [site.orgId, site.slug, site.title, site.welcome, site.open],
      );
    } catch (error) {
      if (isUnique(error)) throw new SlugTaken("site");
      throw error;
    }
    return site;
  }

  // --- learners -------------------------------------------------------------------

  /** `verified`: the address was vouched for already, by a provider it was signed in with. */
  async createLearner(learner: { orgId: OrgId; email: string; name: string; passwordHash: string; verified?: boolean }): Promise<Learner> {
    try {
      const rows = await this.#sql.query<LearnerRow>(
        `INSERT INTO learners (id, org_id, email, name, password_hash, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 THEN now() END)
         RETURNING ${LEARNER_COLUMNS}`,
        [this.#newId(), learner.orgId, learner.email.trim(), learner.name.trim(), learner.passwordHash, learner.verified === true],
      );
      return withoutSecret(toLearner(rows[0]!));
    } catch (error) {
      if (isUnique(error)) throw new EmailTaken();
      throw error;
    }
  }

  async learnerByEmail(orgId: OrgId, email: string): Promise<LearnerWithSecret | null> {
    const rows = await this.#sql.query<LearnerRow>(
      `SELECT ${LEARNER_COLUMNS} FROM learners
        WHERE org_id = $1 AND lower(email) = lower($2) AND erased_at IS NULL`,
      [orgId, email.trim()],
    );
    return rows[0] === undefined ? null : toLearner(rows[0]);
  }

  async createSession(learnerId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.#sql.query(`INSERT INTO learner_sessions (token_hash, learner_id, expires_at) VALUES ($1, $2, $3)`, [tokenHash, learnerId, expiresAt]);
  }

  async learnerForSession(tokenHash: string, now: Date): Promise<Learner | null> {
    const rows = await this.#sql.query<LearnerRow>(
      `SELECT l.id, l.org_id, l.email, l.name, l.password_hash, l.created_at, l.erased_at, l.email_verified_at
         FROM learner_sessions s JOIN learners l ON l.id = s.learner_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2 AND l.erased_at IS NULL`,
      [tokenHash, now],
    );
    return rows[0] === undefined ? null : withoutSecret(toLearner(rows[0]));
  }

  async learnerById(orgId: OrgId, id: string): Promise<Learner | null> {
    const rows = await this.#sql.query<LearnerRow>(
      `SELECT ${LEARNER_COLUMNS} FROM learners WHERE org_id = $1 AND id = $2 AND erased_at IS NULL`,
      [orgId, id],
    );
    return rows[0] === undefined ? null : withoutSecret(toLearner(rows[0]));
  }

  /** Mark the address verified — only if it is still the one the link was made for. */
  async markVerified(orgId: OrgId, id: string, email: string): Promise<boolean> {
    const rows = await this.#sql.query<{ id: string }>(
      `UPDATE learners SET email_verified_at = coalesce(email_verified_at, now())
        WHERE org_id = $1 AND id = $2 AND lower(email) = lower($3) AND erased_at IS NULL RETURNING id`,
      [orgId, id, email],
    );
    return rows.length > 0;
  }

  /** Queue a verification email. The outbox row names the learner only; the message is built when sent. */
  async queueVerification(orgId: OrgId, learnerId: string, now: Date): Promise<void> {
    await enqueue(this.#sql, orgId, [{ kind: "learner_email", subject: { learnerId }, purpose: "verify_email", sendAfter: now }], this.#newId);
  }

  async signInSettings(orgId: OrgId): Promise<PracticeSignIn> {
    const rows = await this.#sql.query<{
      require_verified: boolean;
      google_enabled: boolean;
      google_client_id: string | null;
      google_client_secret: string | null;
    }>(`SELECT require_verified, google_enabled, google_client_id, google_client_secret FROM practice_sign_in WHERE org_id = $1`, [orgId]);
    const r = rows[0];
    return {
      requireVerified: r?.require_verified ?? false,
      googleEnabled: r?.google_enabled ?? false,
      googleClientId: r?.google_client_id ?? null,
      googleClientSecret: r?.google_client_secret ?? null,
    };
  }

  async saveSignInSettings(orgId: OrgId, settings: PracticeSignIn): Promise<void> {
    await this.#sql.query(
      `INSERT INTO practice_sign_in (org_id, require_verified, google_enabled, google_client_id, google_client_secret, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (org_id) DO UPDATE SET require_verified = $2, google_enabled = $3, google_client_id = $4,
         google_client_secret = $5, updated_at = now()`,
      [orgId, settings.requireVerified, settings.googleEnabled, settings.googleClientId, settings.googleClientSecret],
    );
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.#sql.query(`UPDATE learner_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash]);
  }

  /**
   * Delete an account, as far as that can be done without losing the site's
   * history: name and email are replaced, every session ends, and the learner
   * can never sign in again. Their submissions stay, attributed to no one.
   */
  async eraseLearner(orgId: OrgId, learnerId: string): Promise<void> {
    await this.#sql.transaction(async (tx) => {
      await tx.query(
        `UPDATE learners SET name = 'Deleted account', email = id || '@erased.invalid', password_hash = '!', erased_at = now()
          WHERE org_id = $1 AND id = $2 AND erased_at IS NULL`,
        [orgId, learnerId],
      );
      await tx.query(`UPDATE learner_sessions SET revoked_at = now() WHERE learner_id = $1 AND revoked_at IS NULL`, [learnerId]);
      // What prep kept that is theirs to say or where they live (ROADMAP §16):
      // notes and what they asked the tutor go; a postal address is blanked; an
      // interview write-up stays for others to read, under no one's name.
      await tx.query(`DELETE FROM prep_notes WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      await tx.query(`DELETE FROM prep_tutor WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      await tx.query(`DELETE FROM prep_reminders WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      await tx.query(`DELETE FROM prep_push_subscriptions WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      await tx.query(`DELETE FROM prep_profiles WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      // Their study itself goes too (plan row 47; migration 0054): plan, cards,
      // lists, focus, coins, credits, ratings, shares, stories and reports.
      await tx.query(`SELECT prep_erase_study($1, $2)`, [orgId, learnerId]);
      await tx.query(`DELETE FROM prep_experience_votes WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      await tx.query(`DELETE FROM prep_targets WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      await tx.query(`UPDATE prep_store_orders SET address = '' WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      await tx.query(`UPDATE prep_experiences SET author_name = 'Anonymous' WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
    }, { "parikshaa.org_id": orgId, "parikshaa.actor": "staff", "parikshaa.attempt_id": "", "parikshaa.learner_id": "" });
  }

  /** Every learner, with how much they have done. Staff only. */
  /** The names of these learners, those not erased: cheaper than `learners` when a name is all that is wanted. */
  async learnerNames(orgId: OrgId, ids: readonly string[]): Promise<ReadonlyMap<string, string>> {
    if (ids.length === 0) return new Map();
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string; name: string }>(`SELECT id, name FROM learners WHERE org_id = $1 AND id = ANY($2::text[]) AND erased_at IS NULL`, [orgId, [...ids]]);
      return new Map(rows.map((r) => [r.id, r.name]));
    });
  }

  async learners(orgId: OrgId): Promise<readonly LearnerSummary[]> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<LearnerRow & { solved: string; submissions: string; last_active_at: string | Date | null }>(
        `SELECT l.id, l.org_id, l.email, l.name, l.password_hash, l.created_at, l.erased_at,
                count(DISTINCT s.problem_id) FILTER (WHERE s.status = 'passed') AS solved,
                count(s.id) AS submissions,
                max(s.created_at) AS last_active_at
           FROM learners l LEFT JOIN practice_submissions s ON s.org_id = l.org_id AND s.learner_id = l.id
          WHERE l.org_id = $1 AND l.erased_at IS NULL
          GROUP BY l.id
          ORDER BY l.created_at DESC
          LIMIT 5000`,
        [orgId],
      );
      return rows.map((r) => ({
        ...withoutSecret(toLearner(r)),
        solved: Number(r.solved),
        submissions: Number(r.submissions),
        lastActiveAt: r.last_active_at === null ? null : iso(r.last_active_at),
      }));
    });
  }

  // --- problems --------------------------------------------------------------------

  async problems(scope: PracticeScope): Promise<readonly PracticeProblem[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<ProblemRow>(`SELECT ${PROBLEM_COLUMNS} FROM practice_problems WHERE org_id = $1 ORDER BY position, created_at LIMIT 2000`, [
          scope.orgId,
        ])
      ).map(toProblem),
    );
  }

  async problemBySlug(scope: PracticeScope, slug: string): Promise<PracticeProblem | null> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<ProblemRow>(`SELECT ${PROBLEM_COLUMNS} FROM practice_problems WHERE org_id = $1 AND slug = $2`, [scope.orgId, slug]);
      return rows[0] === undefined ? null : toProblem(rows[0]);
    });
  }

  async addProblem(orgId: OrgId, draft: ProblemDraft): Promise<PracticeProblem> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const id = this.#newId();
      try {
        const rows = await tx.query<ProblemRow>(
          `INSERT INTO practice_problems (org_id, id, slug, title, question, difficulty, tags, editorial, from_bank, position, published, hint)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING ${PROBLEM_COLUMNS}`,
          [orgId, id, draft.slug, draft.title, JSON.stringify({ ...draft.question, id }), draft.difficulty, [...draft.tags], draft.editorial, draft.fromBank, draft.position, draft.published, draft.hint ?? ""],
        );
        return toProblem(rows[0]!);
      } catch (error) {
        if (isUnique(error)) throw new SlugTaken("problem");
        throw error;
      }
    });
  }

  async updateProblem(orgId: OrgId, id: string, draft: ProblemDraft): Promise<PracticeProblem | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      try {
        const rows = await tx.query<ProblemRow>(
          `UPDATE practice_problems
              SET slug = $3, title = $4, question = $5, difficulty = $6, tags = $7, editorial = $8, position = $9, published = $10, hint = $11, updated_at = now()
            WHERE org_id = $1 AND id = $2 RETURNING ${PROBLEM_COLUMNS}`,
          [orgId, id, draft.slug, draft.title, JSON.stringify({ ...draft.question, id }), draft.difficulty, [...draft.tags], draft.editorial, draft.position, draft.published, draft.hint ?? ""],
        );
        return rows[0] === undefined ? null : toProblem(rows[0]);
      } catch (error) {
        if (isUnique(error)) throw new SlugTaken("problem");
        throw error;
      }
    });
  }

  // --- contests ---------------------------------------------------------------------

  async contests(scope: PracticeScope): Promise<readonly Contest[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<ContestRow>(
          `SELECT id, slug, title, description, starts_at, ends_at, problem_ids FROM contests WHERE org_id = $1 ORDER BY starts_at DESC LIMIT 500`,
          [scope.orgId],
        )
      ).map(toContest),
    );
  }

  async contestBySlug(scope: PracticeScope, slug: string): Promise<Contest | null> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<ContestRow>(
        `SELECT id, slug, title, description, starts_at, ends_at, problem_ids FROM contests WHERE org_id = $1 AND slug = $2`,
        [scope.orgId, slug],
      );
      return rows[0] === undefined ? null : toContest(rows[0]);
    });
  }

  async saveContest(orgId: OrgId, id: string | null, draft: ContestDraft): Promise<Contest | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const params = [orgId, id ?? this.#newId(), draft.slug, draft.title, draft.description, draft.startsAt, draft.endsAt, [...draft.problemIds]];
      try {
        const rows =
          id === null
            ? await tx.query<ContestRow>(
                `INSERT INTO contests (org_id, id, slug, title, description, starts_at, ends_at, problem_ids)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, slug, title, description, starts_at, ends_at, problem_ids`,
                params,
              )
            : await tx.query<ContestRow>(
                `UPDATE contests SET slug = $3, title = $4, description = $5, starts_at = $6, ends_at = $7, problem_ids = $8
                  WHERE org_id = $1 AND id = $2 RETURNING id, slug, title, description, starts_at, ends_at, problem_ids`,
                params,
              );
        return rows[0] === undefined ? null : toContest(rows[0]);
      } catch (error) {
        if (isUnique(error)) throw new SlugTaken("contest");
        throw error;
      }
    });
  }

  // --- submissions --------------------------------------------------------------------

  /** Record a submission; `at` is when it came in (a contest's, judged after waiting in the queue), the database's now when absent. */
  async addSubmission(scope: PracticeScope & { actor: "learner" }, draft: SubmissionDraft, at?: Date): Promise<Submission> {
    if (scope.learnerId === null) throw new Error("Only a signed-in learner submits");
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<SubmissionRow>(
        `INSERT INTO practice_submissions (org_id, id, learner_id, problem_id, contest_id, language, answer, status, passed, total, time_ms, memory_kb, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, now()))
         RETURNING id, learner_id, problem_id, contest_id, language, answer, status, passed, total, time_ms, memory_kb, created_at`,
        [
          scope.orgId,
          this.#newId(),
          scope.learnerId,
          draft.problemId,
          draft.contestId,
          draft.language,
          draft.answer,
          draft.status,
          draft.passed,
          draft.total,
          draft.timeMs,
          draft.memoryKb,
          at ?? null,
        ],
      );
      return toSubmission(rows[0]!);
    });
  }

  /** Submissions, newest first: a learner's own, or — for staff — anyone's they name. */
  async submissions(scope: PracticeScope, filter: { learnerId?: string; problemId?: string; limit?: number } = {}): Promise<readonly Submission[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<SubmissionRow>(
          `SELECT id, learner_id, problem_id, contest_id, language, answer, status, passed, total, time_ms, memory_kb, created_at
             FROM practice_submissions
            WHERE org_id = $1 AND ($2::text IS NULL OR learner_id = $2) AND ($3::text IS NULL OR problem_id = $3)
            ORDER BY created_at DESC LIMIT $4`,
          [scope.orgId, whose(scope, filter.learnerId), filter.problemId ?? null, Math.min(filter.limit ?? 50, 500)],
        )
      ).map(toSubmission),
    );
  }

  /** A learner's progress: their own, or — for staff — the one they name. */
  async progress(scope: PracticeScope, learnerId?: string): Promise<Progress> {
    const who = whose(scope, learnerId);
    if (who === null) return { solved: [], attempted: [], days: [] };
    return scoped(this.#sql, scope, async (tx) => {
      const solved = await tx.query<{ problem_id: string; at: string | Date }>(
        `SELECT problem_id, min(created_at) AS at FROM practice_submissions
          WHERE org_id = $1 AND learner_id = $2 AND status = 'passed' GROUP BY problem_id ORDER BY at`,
        [scope.orgId, who],
      );
      const attempted = await tx.query<{ problem_id: string }>(
        `SELECT DISTINCT problem_id FROM practice_submissions WHERE org_id = $1 AND learner_id = $2`,
        [scope.orgId, who],
      );
      const days = await tx.query<{ day: string; accepted: string; submitted: string }>(
        `SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
                count(*) FILTER (WHERE status = 'passed') AS accepted, count(*) AS submitted
           FROM practice_submissions WHERE org_id = $1 AND learner_id = $2 AND created_at > now() - interval '400 days'
          GROUP BY 1 ORDER BY 1`,
        [scope.orgId, who],
      );
      return {
        solved: solved.map((r) => ({ problemId: r.problem_id, at: iso(r.at) })),
        attempted: attempted.map((r) => r.problem_id),
        days: days.map((r) => ({ day: r.day, accepted: Number(r.accepted), submitted: Number(r.submitted) })),
      };
    });
  }

  // --- aggregates over every learner (read in the staff scope, published as counts) ----

  async problemStats(orgId: OrgId): Promise<readonly ProblemStats[]> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) =>
      (
        await tx.query<{ problem_id: string; submissions: string; accepted: string; solved_by: string }>(
          `SELECT problem_id, count(*) AS submissions, count(*) FILTER (WHERE status = 'passed') AS accepted,
                  count(DISTINCT learner_id) FILTER (WHERE status = 'passed') AS solved_by
             FROM practice_submissions WHERE org_id = $1 GROUP BY problem_id`,
          [orgId],
        )
      ).map((r) => ({ problemId: r.problem_id, submissions: Number(r.submissions), accepted: Number(r.accepted), solvedBy: Number(r.solved_by) })),
    );
  }

  /** Learners by problems solved; ties go to whoever got there first. */
  async leaderboard(orgId: OrgId, limit = 100): Promise<readonly LeaderboardRow[]> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) =>
      (
        await tx.query<{ learner_id: string; name: string; solved: string; last_solved_at: string | Date }>(
          `SELECT s.learner_id, l.name, count(DISTINCT s.problem_id) AS solved, max(s.created_at) AS last_solved_at
             FROM practice_submissions s JOIN learners l ON l.id = s.learner_id
            WHERE s.org_id = $1 AND s.status = 'passed' AND l.erased_at IS NULL
            GROUP BY s.learner_id, l.name
            ORDER BY solved DESC, last_solved_at ASC
            LIMIT $2`,
          [orgId, limit],
        )
      ).map((r) => ({ learnerId: r.learner_id, name: r.name, solved: Number(r.solved), lastSolvedAt: iso(r.last_solved_at) })),
    );
  }

  /** Every submission made during a contest, oldest first, with who made it. */
  async contestSubmissions(orgId: OrgId, contestId: string): Promise<readonly (Submission & { readonly name: string })[]> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) =>
      (
        await tx.query<SubmissionRow & { name: string }>(
          `SELECT s.id, s.learner_id, s.problem_id, s.contest_id, s.language, '' AS answer, s.status, s.passed, s.total, s.time_ms, s.memory_kb, s.created_at, l.name
             FROM practice_submissions s JOIN learners l ON l.id = s.learner_id
            WHERE s.org_id = $1 AND s.contest_id = $2
            ORDER BY s.created_at`,
          [orgId, contestId],
        )
      ).map((r) => ({ ...toSubmission(r), name: r.name })),
    );
  }

  // --- discussion ------------------------------------------------------------------------

  async comments(scope: PracticeScope, problemId: string | null): Promise<readonly Comment[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ id: string; problem_id: string; learner_id: string | null; author_name: string; staff_user_id: string | null; body: string; created_at: string | Date; hidden_at: string | Date | null }>(
          `SELECT id, problem_id, learner_id, author_name, staff_user_id, body, created_at, hidden_at FROM practice_comments
            WHERE org_id = $1 AND ($2::text IS NULL OR problem_id = $2)
            ORDER BY created_at ${problemId === null ? "DESC" : "ASC"} LIMIT 500`,
          [scope.orgId, problemId],
        )
      ).map((r) => ({
        id: r.id,
        problemId: r.problem_id,
        authorName: r.author_name,
        learnerId: r.learner_id,
        fromStaff: r.staff_user_id !== null,
        body: r.body,
        createdAt: iso(r.created_at),
        hidden: r.hidden_at !== null,
      })),
    );
  }

  async addComment(
    scope: PracticeScope,
    comment: { problemId: string; authorName: string; body: string; staffUserId?: string },
  ): Promise<Comment> {
    return scoped(this.#sql, scope, async (tx) => {
      const learnerId = scope.actor === "learner" ? scope.learnerId : null;
      const rows = await tx.query<{ id: string; created_at: string | Date }>(
        `INSERT INTO practice_comments (org_id, id, problem_id, learner_id, staff_user_id, author_name, body)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
        [scope.orgId, this.#newId(), comment.problemId, learnerId, comment.staffUserId ?? null, comment.authorName, comment.body],
      );
      return {
        id: rows[0]!.id,
        problemId: comment.problemId,
        authorName: comment.authorName,
        learnerId,
        fromStaff: scope.actor === "staff",
        body: comment.body,
        createdAt: iso(rows[0]!.created_at),
        hidden: false,
      };
    });
  }

  async setCommentHidden(orgId: OrgId, id: string, hidden: boolean): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `UPDATE practice_comments SET hidden_at = CASE WHEN $3 THEN now() ELSE NULL END WHERE org_id = $1 AND id = $2 RETURNING id`,
        [orgId, id, hidden],
      );
      return rows.length > 0;
    });
  }
}
