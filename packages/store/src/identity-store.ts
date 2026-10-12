import type { OrgId } from "@parikshaa/core";
import { enqueue } from "./outbox-store.js";
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

export type StaffRole = "owner" | "author" | "invigilator" | "reviewer" | "viewer" | "recruiter" | "hiring_manager";
/** An integration is never the owner, nor a job's hiring manager, which is a person. */
export type ApiKeyRole = Exclude<StaffRole, "owner" | "hiring_manager">;

/** What an organisation is: a college examining its students, or a company hiring. */
export type OrganisationKind = "institution" | "company";

export interface Organisation {
  readonly id: OrgId;
  /** The ID people use for it: PKC- and six characters (migration 0067). */
  readonly publicId: string;
  readonly name: string;
  readonly kind: OrganisationKind;
  /** Paused by Parikshaa's operator: its staff cannot sign in. Null while it runs. */
  readonly suspended: { readonly at: string; readonly reason: string } | null;
  readonly monthlySpendCapMicroUsd: number | null;
  /** Owners must use a second factor (ROADMAP §1). */
  readonly requireOwner2fa: boolean;
  /** Checked by Parikshaa as a real employer (Hire, S18, F3); until then its hiring is limited. Null: not yet. */
  readonly verified: { readonly at: string; readonly by: string } | null;
}

/** An organisation's OpenID Connect provider. `clientSecret` is sealed by the caller. */
export interface SsoConfig {
  readonly orgId: OrgId;
  readonly issuer: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly emailDomains: readonly string[];
  readonly enforced: boolean;
  readonly enabled: boolean;
}

/** A second factor's state, for sign-in. Secrets are sealed by the caller. */
export interface TotpState {
  readonly secret: string | null;
  readonly pendingSecret: string | null;
  readonly enabledAt: string | null;
  readonly lastStep: number | null;
}

/** A password reset, as the mail worker and the confirming request see it. */
export interface PasswordReset {
  readonly id: string;
  readonly userId: string;
  readonly orgId: OrgId;
  readonly email: string;
  readonly name: string;
  readonly expiresAt: string;
  readonly used: boolean;
  readonly disabled: boolean;
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

interface OrganisationRow {
  id: string;
  public_id: string;
  name: string;
  kind: OrganisationKind;
  suspended_at: string | Date | null;
  suspended_reason: string | null;
  monthly_spend_cap_micro_usd: number | string | null;
  require_owner_2fa: boolean;
  verified_at: string | Date | null;
  verified_by: string | null;
}

const ORGANISATION_COLUMNS =
  "id, public_id, name, kind, suspended_at, suspended_reason, monthly_spend_cap_micro_usd, require_owner_2fa, verified_at, verified_by";

const toOrganisation = (row: OrganisationRow): Organisation => ({
  id: row.id as OrgId,
  publicId: row.public_id,
  name: row.name,
  kind: row.kind,
  suspended: row.suspended_at === null ? null : { at: new Date(row.suspended_at).toISOString(), reason: row.suspended_reason ?? "" },
  monthlySpendCapMicroUsd: row.monthly_spend_cap_micro_usd === null ? null : Number(row.monthly_spend_cap_micro_usd),
  requireOwner2fa: row.require_owner_2fa === true,
  verified: row.verified_at === null ? null : { at: new Date(row.verified_at).toISOString(), by: row.verified_by ?? "" },
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

  async createOrganisation(id: OrgId, name: string, kind: OrganisationKind = "institution"): Promise<Organisation> {
    // The public ID is drawn at random by the database; two alike, one in a
    // billion, and the insert is simply tried again.
    for (let attempt = 1; ; attempt++) {
      try {
        const rows = await this.#sql.query<{ public_id: string }>(`INSERT INTO organisations (id, name, kind) VALUES ($1, $2, $3) RETURNING public_id`, [id, name, kind]);
        return { id, publicId: rows[0]!.public_id, name, kind, suspended: null, monthlySpendCapMicroUsd: null, requireOwner2fa: false, verified: null };
      } catch (error) {
        if (attempt >= 5 || !String((error as Error).message).includes("organisations_public_id")) throw error;
      }
    }
  }

  /** Every organisation, newest first: for Parikshaa's operator. */
  async listOrganisations(): Promise<readonly (Organisation & { readonly createdAt: string })[]> {
    const rows = await this.#sql.query<OrganisationRow & { created_at: string | Date }>(`SELECT ${ORGANISATION_COLUMNS}, created_at FROM organisations ORDER BY created_at DESC, id`);
    return rows.map((row) => ({ ...toOrganisation(row), createdAt: new Date(row.created_at).toISOString() }));
  }

  /** An organisation by its public ID, as someone reads it out: case and spacing do not matter. */
  async organisationByPublicId(publicId: string): Promise<Organisation | null> {
    const rows = await this.#sql.query<OrganisationRow>(`SELECT ${ORGANISATION_COLUMNS} FROM organisations WHERE public_id = $1`, [publicId.trim().toUpperCase()]);
    return rows[0] === undefined ? null : toOrganisation(rows[0]);
  }

  /**
   * Pause an organisation (a reason given) or resume it (null). Pausing ends
   * every session of its staff at once; their keys stop working while it lasts.
   * False if there is no such organisation.
   */
  async setSuspended(id: OrgId, reason: string | null, now: Date): Promise<boolean> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query(
        `UPDATE organisations SET suspended_at = $2, suspended_reason = $3 WHERE id = $1 RETURNING id`,
        [id, reason === null ? null : now.toISOString(), reason],
      );
      if (rows.length === 0) return false;
      if (reason !== null) {
        await tx.query(
          `UPDATE staff_sessions SET revoked_at = $2 WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM staff_users WHERE org_id = $1)`,
          [id, now.toISOString()],
        );
      }
      return true;
    });
  }

  /** Every organisation's id, for tooling that walks the whole database. */
  async organisationIds(): Promise<readonly OrgId[]> {
    const rows = await this.#sql.query<{ id: string }>(`SELECT id FROM organisations ORDER BY id`);
    return rows.map((r) => r.id as OrgId);
  }

  async getOrganisation(id: OrgId): Promise<Organisation | null> {
    const rows = await this.#sql.query<OrganisationRow>(`SELECT ${ORGANISATION_COLUMNS} FROM organisations WHERE id = $1`, [id]);
    return rows[0] === undefined ? null : toOrganisation(rows[0]);
  }

  async setRequireOwner2fa(id: OrgId, required: boolean): Promise<void> {
    await this.#sql.query(`UPDATE organisations SET require_owner_2fa = $2 WHERE id = $1`, [id, required]);
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
    /** False for an owner who signed their institution up, until they open the link sent to them. */
    readonly emailVerified?: boolean;
  }): Promise<StaffUser> {
    const id = this.#newId();
    await this.#sql.query(
      `INSERT INTO staff_users (id, org_id, email, name, role, password_hash, email_verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7 THEN now() END)`,
      [id, user.orgId, user.email.trim(), user.name, user.role, user.passwordHash, user.emailVerified ?? true],
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

  /**
   * The user behind a live session: not revoked, not expired, not disabled.
   * `mustEnrol2fa` says the organisation requires owners to use a second
   * factor and this owner has none yet.
   */
  async userForSession(
    tokenHash: string,
    now: Date,
  ): Promise<(StaffUser & { readonly mustEnrol2fa: boolean; readonly emailUnverified: boolean }) | null> {
    const rows = await this.#sql.query<UserRow & { must_enrol: boolean; unverified: boolean }>(
      `SELECT u.id, u.org_id, u.email, u.name, u.role, u.password_hash, u.disabled_at,
              (u.role = 'owner' AND o.require_owner_2fa AND u.totp_enabled_at IS NULL) AS must_enrol,
              (u.email_verified_at IS NULL) AS unverified
         FROM staff_sessions s
         JOIN staff_users u ON u.id = s.user_id
         JOIN organisations o ON o.id = u.org_id
        WHERE s.token_hash = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > $2
          AND u.disabled_at IS NULL
          AND o.suspended_at IS NULL`,
      [tokenHash, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : { ...withoutSecret(toUser(row)), mustEnrol2fa: row.must_enrol === true, emailUnverified: row.unverified === true };
  }

  // --- an address shown to be theirs ---------------------------------------------

  /** Who an account is, for the verification email: its address, and whether it is shown already. */
  async emailState(userId: string): Promise<{ orgId: OrgId; email: string; name: string; verified: boolean; disabled: boolean } | null> {
    const rows = await this.#sql.query<{ org_id: string; email: string; name: string; email_verified_at: string | Date | null; disabled_at: string | Date | null }>(
      `SELECT org_id, email, name, email_verified_at, disabled_at FROM staff_users WHERE id = $1`,
      [userId],
    );
    const row = rows[0];
    return row === undefined
      ? null
      : { orgId: row.org_id as OrgId, email: row.email, name: row.name, verified: row.email_verified_at !== null, disabled: row.disabled_at !== null };
  }

  /**
   * Mark an address shown, if the account still has it: a link sent to an
   * address the account has since changed from proves nothing. True when
   * the account is now verified, whether by this call or before it.
   */
  async verifyEmail(userId: string, email: string, now: Date): Promise<boolean> {
    const rows = await this.#sql.query<{ id: string }>(
      `UPDATE staff_users SET email_verified_at = coalesce(email_verified_at, $3)
        WHERE id = $1 AND lower(email) = lower($2) AND disabled_at IS NULL
        RETURNING id`,
      [userId, email, now.toISOString()],
    );
    return rows.length > 0;
  }

  /** A message to a member of staff (or to the operator), sent by the delivery worker. */
  async queueStaffEmail(orgId: OrgId, purpose: string, subject: Record<string, unknown>, id: string, now: Date): Promise<void> {
    await this.#sql.transaction(async (tx) => {
      await enqueue(tx, orgId, [{ kind: "staff_email", subject, purpose, id, sendAfter: now }], this.#newId);
    });
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

  // --- second factor ----------------------------------------------------------

  async totpState(userId: string): Promise<TotpState> {
    const rows = await this.#sql.query<{
      totp_secret: string | null;
      totp_pending_secret: string | null;
      totp_enabled_at: string | Date | null;
      totp_last_step: number | string | null;
    }>(`SELECT totp_secret, totp_pending_secret, totp_enabled_at, totp_last_step FROM staff_users WHERE id = $1`, [userId]);
    const row = rows[0];
    return {
      secret: row?.totp_secret ?? null,
      pendingSecret: row?.totp_pending_secret ?? null,
      enabledAt: row?.totp_enabled_at == null ? null : new Date(row.totp_enabled_at).toISOString(),
      lastStep: row?.totp_last_step == null ? null : Number(row.totp_last_step),
    };
  }

  /** A secret being set up; it becomes the account's only once a code from it is accepted. */
  async setPendingTotp(userId: string, sealedSecret: string): Promise<void> {
    await this.#sql.query(`UPDATE staff_users SET totp_pending_secret = $2 WHERE id = $1`, [userId, sealedSecret]);
  }

  /** Make the pending secret the account's, with fresh recovery codes (as digests). */
  async enableTotp(userId: string, step: number, recoveryCodeHashes: readonly string[]): Promise<boolean> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `UPDATE staff_users
            SET totp_secret = totp_pending_secret, totp_pending_secret = NULL, totp_enabled_at = now(), totp_last_step = $2
          WHERE id = $1 AND totp_pending_secret IS NOT NULL
          RETURNING id`,
        [userId, step],
      );
      if (rows.length === 0) return false;
      await tx.query(`DELETE FROM staff_recovery_codes WHERE user_id = $1`, [userId]);
      for (const hash of recoveryCodeHashes) {
        await tx.query(`INSERT INTO staff_recovery_codes (user_id, code_hash) VALUES ($1, $2)`, [userId, hash]);
      }
      return true;
    });
  }

  async disableTotp(userId: string): Promise<void> {
    await this.#sql.transaction(async (tx) => {
      await tx.query(
        `UPDATE staff_users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled_at = NULL, totp_last_step = NULL WHERE id = $1`,
        [userId],
      );
      await tx.query(`DELETE FROM staff_recovery_codes WHERE user_id = $1`, [userId]);
    });
  }

  /**
   * Record that a code for `step` was used. Refuses a step at or before the
   * last one accepted, so a code seen once — over a shoulder, in a proxy —
   * cannot be used again.
   */
  async claimTotpStep(userId: string, step: number): Promise<boolean> {
    const rows = await this.#sql.query<{ id: string }>(
      `UPDATE staff_users SET totp_last_step = $2
        WHERE id = $1 AND totp_secret IS NOT NULL AND (totp_last_step IS NULL OR totp_last_step < $2)
        RETURNING id`,
      [userId, step],
    );
    return rows.length > 0;
  }

  /** Spend a recovery code. Each works once. */
  async useRecoveryCode(userId: string, codeHash: string): Promise<boolean> {
    const rows = await this.#sql.query<{ user_id: string }>(
      `UPDATE staff_recovery_codes SET used_at = now()
        WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
        RETURNING user_id`,
      [userId, codeHash],
    );
    return rows.length > 0;
  }

  async recoveryCodesLeft(userId: string): Promise<number> {
    const rows = await this.#sql.query<{ n: number | string }>(
      `SELECT count(*) AS n FROM staff_recovery_codes WHERE user_id = $1 AND used_at IS NULL`,
      [userId],
    );
    return Number(rows[0]?.n ?? 0);
  }

  // --- password reset -----------------------------------------------------------

  /**
   * Record a reset and queue its email in one transaction, so a reset exists
   * exactly when its mail is on its way. The outbox row names the reset only.
   */
  async requestPasswordReset(
    user: { readonly id: string; readonly orgId: OrgId },
    now: Date,
    expiresAt: Date,
    purpose: "password_reset" | "staff_invite" = "password_reset",
  ): Promise<string> {
    const id = this.#newId();
    await this.#sql.transaction(async (tx) => {
      await tx.query(`INSERT INTO password_resets (id, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`, [
        id,
        user.id,
        now.toISOString(),
        expiresAt.toISOString(),
      ]);
      await enqueue(
        tx,
        user.orgId,
        [{ kind: "staff_email", subject: { resetId: id }, purpose, id: `reset:${id}`, sendAfter: now }],
        this.#newId,
      );
    });
    return id;
  }

  /** How many resets an account asked for since a moment: a reset flood is an annoyance to its owner. */
  async recentResets(userId: string, since: Date): Promise<number> {
    const rows = await this.#sql.query<{ n: number | string }>(
      `SELECT count(*) AS n FROM password_resets WHERE user_id = $1 AND created_at > $2`,
      [userId, since.toISOString()],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async passwordReset(id: string): Promise<PasswordReset | null> {
    const rows = await this.#sql.query<{
      id: string;
      user_id: string;
      org_id: string;
      email: string;
      name: string;
      expires_at: string | Date;
      used_at: string | Date | null;
      disabled_at: string | Date | null;
    }>(
      `SELECT r.id, r.user_id, u.org_id, u.email, u.name, r.expires_at, r.used_at, u.disabled_at
         FROM password_resets r JOIN staff_users u ON u.id = r.user_id WHERE r.id = $1`,
      [id],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      userId: row.user_id,
      orgId: row.org_id as OrgId,
      email: row.email,
      name: row.name,
      expiresAt: new Date(row.expires_at).toISOString(),
      used: row.used_at !== null,
      disabled: row.disabled_at !== null,
    };
  }

  /**
   * Use a reset: set the password, end every session, and spend this reset and
   * any other outstanding for the account. Null if it was used, expired, or the
   * account is disabled — all under one statement's check, so two clicks on the
   * same link cannot both succeed.
   */
  async completePasswordReset(id: string, passwordHash: string, now: Date): Promise<{ userId: string; orgId: OrgId } | null> {
    return this.#sql.transaction(async (tx) => {
      const rows = await tx.query<{ user_id: string; org_id: string }>(
        `UPDATE password_resets r SET used_at = $2
           FROM staff_users u
          WHERE r.id = $1 AND u.id = r.user_id AND r.used_at IS NULL AND r.expires_at > $2 AND u.disabled_at IS NULL
          RETURNING r.user_id, u.org_id`,
        [id, now.toISOString()],
      );
      const row = rows[0];
      if (row === undefined) return null;
      await tx.query(`UPDATE staff_users SET password_hash = $2 WHERE id = $1`, [row.user_id, passwordHash]);
      await tx.query(`UPDATE password_resets SET used_at = $2 WHERE user_id = $1 AND used_at IS NULL`, [row.user_id, now.toISOString()]);
      await tx.query(`UPDATE staff_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [row.user_id]);
      return { userId: row.user_id, orgId: row.org_id as OrgId };
    });
  }

  // --- single sign-on -------------------------------------------------------------

  async ssoConfig(orgId: OrgId): Promise<SsoConfig | null> {
    const rows = await this.#sql.query<{
      org_id: string;
      issuer: string;
      client_id: string;
      client_secret: string;
      email_domains: string[];
      enforced: boolean;
      enabled: boolean;
    }>(`SELECT org_id, issuer, client_id, client_secret, email_domains, enforced, enabled FROM sso_configs WHERE org_id = $1`, [orgId]);
    const row = rows[0];
    if (row === undefined) return null;
    return {
      orgId: row.org_id as OrgId,
      issuer: row.issuer,
      clientId: row.client_id,
      clientSecret: row.client_secret,
      emailDomains: row.email_domains ?? [],
      enforced: row.enforced,
      enabled: row.enabled,
    };
  }

  async saveSsoConfig(config: SsoConfig): Promise<void> {
    await this.#sql.query(
      `INSERT INTO sso_configs (org_id, issuer, client_id, client_secret, email_domains, enforced, enabled, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (org_id) DO UPDATE SET
         issuer = EXCLUDED.issuer, client_id = EXCLUDED.client_id, client_secret = EXCLUDED.client_secret,
         email_domains = EXCLUDED.email_domains, enforced = EXCLUDED.enforced, enabled = EXCLUDED.enabled, updated_at = now()`,
      [config.orgId, config.issuer, config.clientId, config.clientSecret, JSON.stringify(config.emailDomains), config.enforced, config.enabled],
    );
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
          AND NOT EXISTS (SELECT 1 FROM organisations o WHERE o.id = api_keys.org_id AND o.suspended_at IS NOT NULL)
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
