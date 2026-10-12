import type { OrgId } from "@parikshaa/core";
import { NO_SEAL, type RecordSeal } from "./sealing.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Candidate accounts for Hire (docs/HIRE-V2.md §1, §10; H1a, migration 0070):
 * one account per person, for every company they apply to. They sign in with
 * a code mailed to them; nothing they could be phished for is ever made.
 *
 * Accounts, sessions and codes are outside tenant row-level security, as
 * learners are: signing in finds an account before any scope exists. The
 * profile is sealed under the "candidates" record key, each value bound to its
 * account and field. Codes keep neither the address (a blind index) nor the
 * code (an HMAC the service makes): this store only counts and spends them.
 */

/**
 * Who a Hire query runs as (§10 S4, F24): a copy of the practice store's
 * scope, with the candidate in `parikshaa.candidate_id`. Only Hire's stores
 * take it. Never hand an applicant scope to another store: some tables let
 * any actor of an organisation read them.
 */
export type HireScope =
  | { readonly actor: "staff"; readonly orgId: OrgId }
  /** `orgId` absent: reading across organisations (the candidate's links). */
  | { readonly actor: "applicant"; readonly candidateId: string; readonly orgId?: OrgId };

export const hireStaff = (orgId: OrgId): HireScope => ({ actor: "staff", orgId });
export const hireApplicant = (candidateId: string, orgId?: OrgId): HireScope =>
  orgId === undefined ? { actor: "applicant", candidateId } : { actor: "applicant", candidateId, orgId };

export function hireScoped<T>(sql: SqlExecutor, scope: HireScope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return sql.transaction(fn, {
    "parikshaa.org_id": scope.orgId ?? "",
    "parikshaa.actor": scope.actor,
    "parikshaa.attempt_id": "",
    "parikshaa.learner_id": "",
    "parikshaa.candidate_id": scope.actor === "applicant" ? scope.candidateId : "",
  });
}

export type CodePurpose = "sign_in" | "step_up";

export interface CandidateAccount {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

/** What a candidate keeps about themselves. `details` is the service's to shape; the store seals it whole. */
export interface CandidateProfile {
  readonly name: string | null;
  readonly phone: string | null;
  readonly details: unknown;
  readonly resume: { readonly name: string; readonly type: "pdf" | "docx"; readonly sha256: string; readonly at: string } | null;
}

export interface CandidateSession {
  readonly account: CandidateAccount;
  readonly kept: boolean;
  readonly createdAt: string;
  readonly expiresAt: string;
}

/** How many codes were asked for, to hold the limits (S5). */
export interface CodeCounts {
  /** For this address in the last hour, and the last day. */
  readonly emailHour: number;
  readonly emailDay: number;
  /** Codes for this address in the last day that ran out of tries unused. */
  readonly failedDay: number;
  /** From this network address in the last hour. */
  readonly ipHour: number;
  /** Everyone's, in the last hour: the circuit breaker. */
  readonly allHour: number;
}

/** A code with a try spent on it, for the service to compare. */
export interface SpentCode {
  readonly id: string;
  readonly codeHash: string;
  readonly attempts: number;
}

export const MAX_CODE_ATTEMPTS = 5;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

interface AccountRow {
  id: string;
  email: string;
  name: string | null;
  created_at: string | Date;
  last_seen_at: string | Date;
}

const ACCOUNT_COLUMNS = "id, email, name, created_at, last_seen_at";
const iso = (d: string | Date) => new Date(d).toISOString();
const aad = (id: string, field: string) => `candidates/${id}/${field}`;

const toAccount = (r: AccountRow): CandidateAccount => ({
  id: r.id,
  email: r.email,
  name: r.name,
  createdAt: iso(r.created_at),
  lastSeenAt: iso(r.last_seen_at),
});

export class CandidateStore {
  readonly #sql: SqlExecutor;
  readonly #seal: RecordSeal;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, seal: RecordSeal = NO_SEAL, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#seal = seal;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- codes ------------------------------------------------------------------

  async codeCounts(emailHash: string, ipHash: string, now: Date): Promise<CodeCounts> {
    const hour = new Date(now.getTime() - HOUR);
    const day = new Date(now.getTime() - DAY);
    const rows = await this.#sql.query<{ email_hour: number; email_day: number; failed_day: number; ip_hour: number; all_hour: number }>(
      `SELECT count(*) FILTER (WHERE email_hash = $1 AND created_at > $3)::int AS email_hour,
              count(*) FILTER (WHERE email_hash = $1 AND created_at > $4)::int AS email_day,
              count(*) FILTER (WHERE email_hash = $1 AND created_at > $4 AND used_at IS NULL AND attempts >= $5)::int AS failed_day,
              count(*) FILTER (WHERE ip_hash = $2 AND created_at > $3)::int AS ip_hour,
              count(*) FILTER (WHERE created_at > $3)::int AS all_hour
         FROM candidate_codes WHERE created_at > $4`,
      [emailHash, ipHash, hour, day, MAX_CODE_ATTEMPTS],
    );
    const r = rows[0]!;
    return { emailHour: r.email_hour, emailDay: r.email_day, failedDay: r.failed_day, ipHour: r.ip_hour, allHour: r.all_hour };
  }

  /** Keep a new code; any earlier one for the same address and purpose stops working. */
  async issueCode(code: {
    readonly id: string;
    readonly purpose: CodePurpose;
    readonly emailHash: string;
    readonly codeHash: string;
    readonly ipHash: string;
    readonly now: Date;
    readonly expiresAt: Date;
  }): Promise<void> {
    await this.#sql.transaction(async (tx) => {
      await tx.query(
        `UPDATE candidate_codes SET superseded_at = $3
          WHERE email_hash = $1 AND purpose = $2 AND used_at IS NULL AND superseded_at IS NULL`,
        [code.emailHash, code.purpose, code.now],
      );
      await tx.query(
        `INSERT INTO candidate_codes (id, purpose, email_hash, code_hash, ip_hash, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [code.id, code.purpose, code.emailHash, code.codeHash, code.ipHash, code.now, code.expiresAt],
      );
    });
  }

  /**
   * Spend one try on the address's live code, in one statement, so tries
   * running at the same time cannot get past the limit between them. Null:
   * no live code, or its tries are used up.
   */
  async spendAttempt(emailHash: string, purpose: CodePurpose, now: Date): Promise<SpentCode | null> {
    const rows = await this.#sql.query<{ id: string; code_hash: string; attempts: number }>(
      `UPDATE candidate_codes SET attempts = attempts + 1
        WHERE id = (SELECT id FROM candidate_codes
                     WHERE email_hash = $1 AND purpose = $2 AND used_at IS NULL AND superseded_at IS NULL AND expires_at > $3
                     ORDER BY created_at DESC LIMIT 1)
          AND attempts < $4 AND used_at IS NULL AND superseded_at IS NULL AND expires_at > $3
        RETURNING id, code_hash, attempts`,
      [emailHash, purpose, now, MAX_CODE_ATTEMPTS],
    );
    const r = rows[0];
    return r === undefined ? null : { id: r.id, codeHash: r.code_hash, attempts: r.attempts };
  }

  /** Use a code that matched. Once only: false if it was used already. */
  async useCode(id: string, now: Date): Promise<boolean> {
    const rows = await this.#sql.query(`UPDATE candidate_codes SET used_at = $2 WHERE id = $1 AND used_at IS NULL RETURNING id`, [id, now]);
    return rows.length > 0;
  }

  // --- accounts -----------------------------------------------------------------

  async accountByEmail(email: string): Promise<CandidateAccount | null> {
    const rows = await this.#sql.query<AccountRow>(`SELECT ${ACCOUNT_COLUMNS} FROM candidate_accounts WHERE email = $1 AND erased_at IS NULL`, [email]);
    return rows[0] === undefined ? null : toAccount(rows[0]);
  }

  async account(id: string): Promise<CandidateAccount | null> {
    const rows = await this.#sql.query<AccountRow>(`SELECT ${ACCOUNT_COLUMNS} FROM candidate_accounts WHERE id = $1 AND erased_at IS NULL`, [id]);
    return rows[0] === undefined ? null : toAccount(rows[0]);
  }

  /**
   * The account for an address whose code was just entered: the one there is,
   * or a new one. `email` is already trimmed and in lower case.
   */
  async signIn(email: string, now: Date): Promise<CandidateAccount> {
    const rows = await this.#sql.query<AccountRow>(
      `INSERT INTO candidate_accounts (id, email, created_at, verified_at, last_seen_at) VALUES ($1, $2, $3, $3, $3)
       ON CONFLICT (email) WHERE erased_at IS NULL DO UPDATE SET last_seen_at = $3, warned_at = NULL
       RETURNING ${ACCOUNT_COLUMNS}`,
      [this.#newId(), email, now],
    );
    return toAccount(rows[0]!);
  }

  async profile(id: string): Promise<CandidateProfile | null> {
    const rows = await this.#sql.query<{
      name: string | null;
      phone: string | null;
      profile: string | null;
      resume_name: string | null;
      resume_type: "pdf" | "docx" | null;
      resume_sha256: string | null;
      resume_at: string | Date | null;
    }>(`SELECT name, phone, profile, resume_name, resume_type, resume_sha256, resume_at FROM candidate_accounts WHERE id = $1 AND erased_at IS NULL`, [id]);
    const r = rows[0];
    if (r === undefined) return null;
    const details = this.#seal.open(r.profile, aad(id, "profile"));
    return {
      name: r.name,
      phone: this.#seal.open(r.phone, aad(id, "phone")),
      details: details === null ? null : JSON.parse(details),
      resume:
        r.resume_name === null || r.resume_type === null || r.resume_sha256 === null || r.resume_at === null
          ? null
          : { name: r.resume_name, type: r.resume_type, sha256: r.resume_sha256, at: iso(r.resume_at) },
    };
  }

  async saveProfile(id: string, p: { readonly name: string | null; readonly phone: string | null; readonly details: unknown }): Promise<boolean> {
    const rows = await this.#sql.query(
      `UPDATE candidate_accounts SET name = $2, phone = $3, profile = $4 WHERE id = $1 AND erased_at IS NULL RETURNING id`,
      [id, p.name, this.#seal.text(p.phone, aad(id, "phone")), p.details === null ? null : this.#seal.text(JSON.stringify(p.details), aad(id, "profile"))],
    );
    return rows.length > 0;
  }

  /**
   * Erase an account: the row stays, so an application keeps its candidate id,
   * but the address, the name and everything sealed go; sessions end, and the
   * address's codes are deleted. False if it was erased already.
   */
  async erase(id: string, emailHash: string, now: Date): Promise<boolean> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query(
        `UPDATE candidate_accounts
            SET email = '', name = NULL, phone = NULL, profile = NULL, resume_text = NULL, resume_file = NULL, resume_key = NULL,
                resume_name = NULL, resume_type = NULL, resume_sha256 = NULL, resume_at = NULL, warned_at = NULL, erased_at = $2
          WHERE id = $1 AND erased_at IS NULL RETURNING id`,
        [id, now],
      );
      if (rows.length === 0) return false;
      await tx.query(`UPDATE candidate_sessions SET revoked_at = $2 WHERE candidate_id = $1 AND revoked_at IS NULL`, [id, now]);
      await tx.query(`DELETE FROM candidate_codes WHERE email_hash = $1`, [emailHash]);
      return true;
    });
  }

  // --- sessions -----------------------------------------------------------------

  async createSession(s: { readonly tokenHash: string; readonly candidateId: string; readonly kept: boolean; readonly now: Date; readonly expiresAt: Date }): Promise<void> {
    await this.#sql.query(
      `INSERT INTO candidate_sessions (token_hash, candidate_id, kept, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)`,
      [s.tokenHash, s.candidateId, s.kept, s.now, s.expiresAt],
    );
  }

  async session(tokenHash: string, now: Date): Promise<CandidateSession | null> {
    const rows = await this.#sql.query<AccountRow & { kept: boolean; session_created_at: string | Date; expires_at: string | Date }>(
      `SELECT a.id, a.email, a.name, a.created_at, a.last_seen_at, s.kept, s.created_at AS session_created_at, s.expires_at
         FROM candidate_sessions s JOIN candidate_accounts a ON a.id = s.candidate_id
        WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > $2 AND a.erased_at IS NULL`,
      [tokenHash, now],
    );
    const r = rows[0];
    return r === undefined ? null : { account: toAccount(r), kept: r.kept, createdAt: iso(r.session_created_at), expiresAt: iso(r.expires_at) };
  }

  /** A session in use: a kept one runs on to `expiresAt`, and the account was seen (a warning about disuse lapses). */
  async touch(tokenHash: string, candidateId: string, now: Date, expiresAt: Date | null): Promise<void> {
    await this.#sql.transaction(async (tx) => {
      if (expiresAt !== null) {
        await tx.query(`UPDATE candidate_sessions SET expires_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL AND kept`, [tokenHash, expiresAt]);
      }
      await tx.query(`UPDATE candidate_accounts SET last_seen_at = $2, warned_at = NULL WHERE id = $1 AND erased_at IS NULL`, [candidateId, now]);
    });
  }

  async revokeSession(tokenHash: string, now: Date): Promise<void> {
    await this.#sql.query(`UPDATE candidate_sessions SET revoked_at = $2 WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash, now]);
  }

  /** "Sign out everywhere" (S19). */
  async revokeAll(candidateId: string, now: Date): Promise<number> {
    const rows = await this.#sql.query(`UPDATE candidate_sessions SET revoked_at = $2 WHERE candidate_id = $1 AND revoked_at IS NULL RETURNING token_hash`, [candidateId, now]);
    return rows.length;
  }

  /** The candidate's sessions, for their data export: when, and whether kept. Never the tokens. */
  async sessions(candidateId: string, now: Date): Promise<readonly { readonly createdAt: string; readonly expiresAt: string; readonly kept: boolean }[]> {
    const rows = await this.#sql.query<{ created_at: string | Date; expires_at: string | Date; kept: boolean }>(
      `SELECT created_at, expires_at, kept FROM candidate_sessions
        WHERE candidate_id = $1 AND revoked_at IS NULL AND expires_at > $2 ORDER BY created_at DESC LIMIT 100`,
      [candidateId, now],
    );
    return rows.map((r) => ({ createdAt: iso(r.created_at), expiresAt: iso(r.expires_at), kept: r.kept }));
  }

  // --- links (S2) -----------------------------------------------------------------

  /** The organisations' applications that are this candidate's, read as the candidate. */
  async links(candidateId: string): Promise<readonly { readonly orgId: string; readonly applicationId: string; readonly createdAt: string }[]> {
    return hireScoped(this.#sql, hireApplicant(candidateId), async (tx) =>
      (
        await tx.query<{ org_id: string; application_id: string; created_at: string | Date }>(
          `SELECT org_id, application_id, created_at FROM candidate_links WHERE candidate_id = $1 ORDER BY created_at DESC`,
          [candidateId],
        )
      ).map((r) => ({ orgId: r.org_id, applicationId: r.application_id, createdAt: iso(r.created_at) })),
    );
  }

  /** Link an application to its candidate, as the candidate (they applied, or claimed it). */
  async link(candidateId: string, orgId: OrgId, applicationId: string, now: Date): Promise<void> {
    await hireScoped(this.#sql, hireApplicant(candidateId), (tx) =>
      tx.query(
        `INSERT INTO candidate_links (candidate_id, org_id, application_id, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [candidateId, orgId, applicationId, now],
      ),
    );
  }

  /** Remove an organisation's link to an application (it was erased), as that organisation's staff. */
  async unlink(orgId: OrgId, applicationId: string): Promise<number> {
    return hireScoped(this.#sql, hireStaff(orgId), async (tx) =>
      (await tx.query<{ n: number }>(`SELECT candidate_unlink($1, $2) AS n`, [orgId, applicationId]))[0]!.n,
    );
  }

  // --- retention (F4, F22) --------------------------------------------------------

  /** Delete what is spent: codes a day old, sessions a week past their end. */
  async sweep(now: Date): Promise<{ readonly codes: number; readonly sessions: number }> {
    const codes = await this.#sql.query(`DELETE FROM candidate_codes WHERE created_at < $1 RETURNING id`, [new Date(now.getTime() - DAY)]);
    const sessions = await this.#sql.query(
      `DELETE FROM candidate_sessions WHERE coalesce(revoked_at, expires_at) < $1 RETURNING token_hash`,
      [new Date(now.getTime() - 7 * DAY)],
    );
    return { codes: codes.length, sessions: sessions.length };
  }

  /** Accounts not seen since `before` and not yet warned: to be told they will be erased. */
  async unused(before: Date, limit: number): Promise<readonly CandidateAccount[]> {
    const rows = await this.#sql.query<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM candidate_accounts
        WHERE erased_at IS NULL AND warned_at IS NULL AND last_seen_at < $1 ORDER BY last_seen_at LIMIT $2`,
      [before, limit],
    );
    return rows.map(toAccount);
  }

  async markWarned(id: string, now: Date): Promise<void> {
    await this.#sql.query(`UPDATE candidate_accounts SET warned_at = $2 WHERE id = $1 AND erased_at IS NULL`, [id, now]);
  }

  /** Accounts warned before `before` and not seen since: to be erased. */
  async warnedUnused(before: Date, limit: number): Promise<readonly CandidateAccount[]> {
    const rows = await this.#sql.query<AccountRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM candidate_accounts
        WHERE erased_at IS NULL AND warned_at < $1 AND last_seen_at < warned_at ORDER BY warned_at LIMIT $2`,
      [before, limit],
    );
    return rows.map(toAccount);
  }
}
