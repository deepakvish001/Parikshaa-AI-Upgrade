import type { OrgId } from "@parikshaa/core";
import type { SqlExecutor } from "./sql.js";

/**
 * Organisations, staff accounts, sessions and API keys.
 *
 * These tables sit outside tenant row-level security on purpose: they are what
 * *establishes* an organisation for a request. A login looks a user up by email
 * before anyone knows which organisation they belong to. Only the
 * authentication layer reads them, and every tenant query afterwards is scoped
 * by what they return.
 *
 * No secret is stored in the clear. Sessions and API keys are kept as SHA-256
 * digests of the bearer value, passwords as a slow salted hash produced by the
 * caller. A copy of these tables grants nobody access.
 */

export type StaffRole = "owner" | "author" | "invigilator" | "reviewer" | "viewer";
export type ApiKeyRole = Exclude<StaffRole, "owner">;

export interface Organisation {
  readonly id: OrgId;
  readonly name: string;
  readonly monthlySpendCapMicroUsd: number | null;
}

export interface StaffUser {
  readonly id: string;
  readonly orgId: OrgId;
  readonly email: string;
  readonly name: string;
  readonly role: StaffRole;
  readonly disabled: boolean;
}

export interface StaffUserWithSecret extends StaffUser {
  readonly passwordHash: string;
}

export interface ApiKeyRecord {
  readonly id: string;
  readonly orgId: OrgId;
  readonly name: string;
  readonly role: ApiKeyRole;
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  readonly revoked: boolean;
}

interface UserRow {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: StaffRole;
  password_hash: string;
  disabled_at: string | Date | null;
}

const toUser = (row: UserRow): StaffUserWithSecret => ({
  id: row.id,
  orgId: row.org_id as OrgId,
  email: row.email,
  name: row.name,
  role: row.role,
  disabled: row.disabled_at !== null,
  passwordHash: row.password_hash,
});

const withoutSecret = ({ passwordHash: _, ...user }: StaffUserWithSecret): StaffUser => user;

export class IdentityStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- organisations --------------------------------------------------------

  async createOrganisation(id: OrgId, name: string): Promise<Organisation> {
    await this.#sql.query(`INSERT INTO organisations (id, name) VALUES ($1, $2)`, [id, name]);
    return { id, name, monthlySpendCapMicroUsd: null };
  }

  /** Every organisation's id, for tooling that walks the whole database. */
  async organisationIds(): Promise<readonly OrgId[]> {
    const rows = await this.#sql.query<{ id: string }>(`SELECT id FROM organisations ORDER BY id`);
    return rows.map((r) => r.id as OrgId);
  }

  async getOrganisation(id: OrgId): Promise<Organisation | null> {
    const rows = await this.#sql.query<{ id: string; name: string; monthly_spend_cap_micro_usd: number | string | null }>(
      `SELECT id, name, monthly_spend_cap_micro_usd FROM organisations WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id as OrgId,
      name: row.name,
      monthlySpendCapMicroUsd:
        row.monthly_spend_cap_micro_usd === null ? null : Number(row.monthly_spend_cap_micro_usd),
    };
  }

  async setSpendCap(id: OrgId, capMicroUsd: number | null): Promise<void> {
    await this.#sql.query(`UPDATE organisations SET monthly_spend_cap_micro_usd = $2 WHERE id = $1`, [id, capMicroUsd]);
  }

  // --- users ----------------------------------------------------------------

  async createUser(user: {
    readonly orgId: OrgId;
    readonly email: string;
    readonly name: string;
    readonly role: StaffRole;
    readonly passwordHash: string;
  }): Promise<StaffUser> {
    const id = this.#newId();
    await this.#sql.query(
      `INSERT INTO staff_users (id, org_id, email, name, role, password_hash) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, user.orgId, user.email.trim(), user.name, user.role, user.passwordHash],
    );
    return { id, orgId: user.orgId, email: user.email.trim(), name: user.name, role: user.role, disabled: false };
  }

  /** For login only: returns the stored hash so the caller can verify it. */
  async findUserByEmail(email: string): Promise<StaffUserWithSecret | null> {
    const rows = await this.#sql.query<UserRow>(
      `SELECT id, org_id, email, name, role, password_hash, disabled_at FROM staff_users WHERE lower(email) = lower($1)`,
      [email.trim()],
    );
    return rows[0] === undefined ? null : toUser(rows[0]);
  }

  async findUser(orgId: OrgId, id: string): Promise<StaffUserWithSecret | null> {
    const rows = await this.#sql.query<UserRow>(
      `SELECT id, org_id, email, name, role, password_hash, disabled_at FROM staff_users WHERE org_id = $1 AND id = $2`,
      [orgId, id],
    );
    return rows[0] === undefined ? null : toUser(rows[0]);
  }

  async listUsers(orgId: OrgId): Promise<readonly StaffUser[]> {
    const rows = await this.#sql.query<UserRow>(
      `SELECT id, org_id, email, name, role, password_hash, disabled_at
         FROM staff_users WHERE org_id = $1 ORDER BY created_at ASC`,
      [orgId],
    );
    return rows.map((row) => withoutSecret(toUser(row)));
  }

  async setPassword(orgId: OrgId, id: string, passwordHash: string): Promise<void> {
    await this.#sql.query(`UPDATE staff_users SET password_hash = $3 WHERE org_id = $1 AND id = $2`, [
      orgId,
      id,
      passwordHash,
    ]);
  }

  async setRole(orgId: OrgId, id: string, role: StaffRole): Promise<boolean> {
    const rows = await this.#sql.query<{ id: string }>(
      `UPDATE staff_users SET role = $3 WHERE org_id = $1 AND id = $2 RETURNING id`,
      [orgId, id, role],
    );
    return rows.length > 0;
  }

  /** Disabling also ends every session the user holds. */
  async disableUser(orgId: OrgId, id: string): Promise<boolean> {
    const rows = await this.#sql.query<{ id: string }>(
      `UPDATE staff_users SET disabled_at = now() WHERE org_id = $1 AND id = $2 AND disabled_at IS NULL RETURNING id`,
      [orgId, id],
    );
    if (rows.length > 0) await this.revokeUserSessions(id);
    return rows.length > 0;
  }

  async countOwners(orgId: OrgId): Promise<number> {
    const rows = await this.#sql.query<{ n: number | string }>(
      `SELECT count(*) AS n FROM staff_users WHERE org_id = $1 AND role = 'owner' AND disabled_at IS NULL`,
      [orgId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  // --- sessions -------------------------------------------------------------

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.#sql.query(`INSERT INTO staff_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`, [
      tokenHash,
      userId,
      expiresAt.toISOString(),
    ]);
  }

  /** The user behind a live session: not revoked, not expired, not disabled. */
  async userForSession(tokenHash: string, now: Date): Promise<StaffUser | null> {
    const rows = await this.#sql.query<UserRow>(
      `SELECT u.id, u.org_id, u.email, u.name, u.role, u.password_hash, u.disabled_at
         FROM staff_sessions s JOIN staff_users u ON u.id = s.user_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > $2
          AND u.disabled_at IS NULL`,
      [tokenHash, now.toISOString()],
    );
    return rows[0] === undefined ? null : withoutSecret(toUser(rows[0]));
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.#sql.query(`UPDATE staff_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`, [
      tokenHash,
    ]);
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await this.#sql.query(`UPDATE staff_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [
      userId,
    ]);
  }

  // --- API keys -------------------------------------------------------------

  async createApiKey(key: {
    readonly orgId: OrgId;
    readonly name: string;
    readonly role: ApiKeyRole;
    readonly keyHash: string;
    readonly createdBy: string | null;
  }): Promise<ApiKeyRecord> {
    const id = this.#newId();
    await this.#sql.query(
      `INSERT INTO api_keys (id, org_id, name, key_hash, role, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, key.orgId, key.name, key.keyHash, key.role, key.createdBy],
    );
    return {
      id,
      orgId: key.orgId,
      name: key.name,
      role: key.role,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revoked: false,
    };
  }

  /** A live key by its digest. Records the use, so a leaked key shows up as activity. */
  async useApiKey(keyHash: string): Promise<ApiKeyRecord | null> {
    const rows = await this.#sql.query<ApiKeyRow>(
      `UPDATE api_keys SET last_used_at = now()
        WHERE key_hash = $1 AND revoked_at IS NULL
        RETURNING id, org_id, name, role, created_at, last_used_at, revoked_at`,
      [keyHash],
    );
    return rows[0] === undefined ? null : toKey(rows[0]);
  }

  async listApiKeys(orgId: OrgId): Promise<readonly ApiKeyRecord[]> {
    const rows = await this.#sql.query<ApiKeyRow>(
      `SELECT id, org_id, name, role, created_at, last_used_at, revoked_at
         FROM api_keys WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return rows.map(toKey);
  }

  async revokeApiKey(orgId: OrgId, id: string): Promise<boolean> {
    const rows = await this.#sql.query<{ id: string }>(
      `UPDATE api_keys SET revoked_at = now() WHERE org_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
      [orgId, id],
    );
    return rows.length > 0;
  }
}

interface ApiKeyRow {
  id: string;
  org_id: string;
  name: string;
  role: ApiKeyRole;
  created_at: string | Date;
  last_used_at: string | Date | null;
  revoked_at: string | Date | null;
}

const toKey = (row: ApiKeyRow): ApiKeyRecord => ({
  id: row.id,
  orgId: row.org_id as OrgId,
  name: row.name,
  role: row.role,
  createdAt: new Date(row.created_at).toISOString(),
  lastUsedAt: row.last_used_at === null ? null : new Date(row.last_used_at).toISOString(),
  revoked: row.revoked_at !== null,
});
