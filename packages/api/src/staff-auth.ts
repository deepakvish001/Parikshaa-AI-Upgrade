import { createHash, randomBytes } from "node:crypto";
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";
import type { OrgId } from "@parikshaa/core";
import type { ApiKeyRole, IdentityStore, StaffRole, StaffUser } from "@parikshaa/store";
import type { StaffSecrets } from "./staff-secrets.js";
import { matchTotp, normaliseRecoveryCode } from "./totp.js";

/**
 * Staff authentication and authorization.
 *
 * Replaces a single shared token that every member of every institution would
 * have held. That token could not say *who* did anything, which is why the
 * ledger refused to record who set an attempt aside. With individual accounts
 * it can.
 *
 * Secrets are handled the same way throughout: generated with 32 bytes of
 * randomness, shown to the holder once, and stored only as a SHA-256 digest.
 * Passwords are hashed with argon2id at the OWASP-recommended parameters
 * (19 MiB, two passes).
 */

export type Actor =
  | {
      readonly kind: "user";
      readonly id: string;
      readonly orgId: OrgId;
      readonly role: StaffRole;
      readonly name: string;
      readonly email: string;
      /**
       * The organisation requires owners to use a second factor and this one
       * has none yet: until they set it up, nothing but that is allowed.
       */
      readonly mustEnrol2fa?: boolean;
      /**
       * An owner who signed their institution up and has not opened the link
       * sent to their address yet: they may build, but not reach anyone else.
       */
      readonly emailUnverified?: boolean;
    }
  | {
      readonly kind: "api_key";
      readonly id: string;
      readonly orgId: OrgId;
      readonly role: ApiKeyRole;
      readonly name: string;
    };

/**
 * What an actor may do.
 *
 * `exam:read` lists exams; `exam:read_key` fetches one in full, answer key
 * included. They are split because an invigilator is in the room with the
 * candidates and has no use for the key. Likewise `attempt:read` lists attempts
 * and their state, while `attempt:review` opens the evidence — probe
 * rationales, replies and verdicts.
 */
export type Permission =
  | "exam:read"
  | "exam:read_key"
  | "exam:write"
  | "attempt:start"
  | "attempt:read"
  | "attempt:review"
  | "attempt:grade"
  | "attempt:assess"
  | "attempt:void"
  | "attempt:extend"
  | "usage:read"
  | "audit:read"
  | "staff:manage"
  | "apikey:manage"
  | "org:manage"
  // Hire (docs/HIRE-V2.md §1): jobs and their rounds; reading applicants; deciding on them; offers.
  | "hire:manage"
  | "hire:review"
  | "hire:decide"
  | "hire:offer";

const EVERYTHING: readonly Permission[] = [
  "exam:read",
  "exam:read_key",
  "exam:write",
  "attempt:start",
  "attempt:read",
  "attempt:review",
  "attempt:grade",
  "attempt:assess",
  "attempt:void",
  "attempt:extend",
  "usage:read",
  "audit:read",
  "staff:manage",
  "apikey:manage",
  "org:manage",
  "hire:manage",
  "hire:review",
  "hire:decide",
  "hire:offer",
];

const HIRE_ALL: readonly Permission[] = ["hire:manage", "hire:review", "hire:decide", "hire:offer"];

const GRANTS: Record<StaffRole, ReadonlySet<Permission>> = {
  owner: new Set(EVERYTHING),
  author: new Set(["exam:read", "exam:read_key", "exam:write", "attempt:start", "attempt:read", ...HIRE_ALL]),
  invigilator: new Set(["exam:read", "attempt:start", "attempt:read", "attempt:extend"]),
  reviewer: new Set([
    "exam:read",
    "exam:read_key",
    "attempt:read",
    "attempt:review",
    "attempt:grade",
    "attempt:assess",
    "attempt:void",
    "hire:review",
    "hire:decide",
  ]),
  viewer: new Set(["exam:read", "attempt:read", "attempt:review", "hire:review"]),
  // Runs hiring end to end, the tests it sends included (P3).
  recruiter: new Set(["exam:read", "exam:write", "attempt:start", "attempt:read", "attempt:review", "attempt:extend", ...HIRE_ALL]),
  // Reviews and decides on the jobs they manage, which Hire checks job by job;
  // nothing of the organisation's exams, which no job could limit (F6).
  hiring_manager: new Set(["hire:review", "hire:decide"]),
};

/**
 * Whether an actor may do something.
 *
 * One rule sits above the role table: setting an attempt aside is a person's
 * decision (SPEC §6.1), so an API key cannot do it whatever its role. An
 * integration can grade and fetch evidence; it cannot decide. Granting extra
 * time is held to the same rule, because the ledger records who granted it.
 */
export function can(actor: Actor, permission: Permission): boolean {
  // Granting time is recorded against a person for the same reason; so are
  // moving an applicant on and making an offer (S7).
  if ((permission === "attempt:void" || permission === "attempt:extend" || permission === "hire:decide" || permission === "hire:offer") && actor.kind !== "user") return false;
  if (actor.kind === "user" && actor.emailUnverified === true && UNTIL_VERIFIED.has(permission)) return false;
  return GRANTS[actor.role].has(permission);
}

/**
 * What waits for a new owner's address to be shown to be theirs: everything
 * that reaches other people or spends. Inviting candidates and starting
 * attempts are `attempt:start`; adding staff and issuing keys the others;
 * publishing a job and making an offer the Hire ones (S7).
 */
export const UNTIL_VERIFIED: ReadonlySet<Permission> = new Set(["attempt:start", "staff:manage", "apikey:manage", "hire:manage", "hire:offer"]);

/** Everything an actor may do, for a client deciding what to show. */
export const permissionsOf = (actor: Actor): readonly Permission[] => EVERYTHING.filter((p) => can(actor, p));

export const MIN_PASSWORD_LENGTH = 12;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const SESSION_PREFIX = "pks_";
const API_KEY_PREFIX = "pkk_";

/** SHA-256 of a bearer secret, as stored. */
export const digest = (secret: string): string => createHash("sha256").update(secret, "utf8").digest("hex");

/** A fresh secret. The prefix says what it is, which helps anyone who finds one in a log. */
const newSecret = (prefix: string): string => `${prefix}${randomBytes(32).toString("base64url")}`;

export class WeakPassword extends Error {
  constructor() {
    super(`Passwords must be at least ${MIN_PASSWORD_LENGTH} characters`);
    this.name = "WeakPassword";
  }
}

export function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new WeakPassword();
  return argon2Hash(password);
}

/**
 * A hash to verify against when the email is unknown, so that a wrong address
 * and a wrong password take the same time. Otherwise the response time alone
 * would tell an attacker which addresses have accounts.
 */
let decoy: Promise<string> | null = null;
const decoyHash = () => (decoy ??= argon2Hash(randomBytes(24).toString("base64url")));

export interface LoginResult {
  readonly token: string;
  readonly expiresAt: string;
  readonly user: StaffUser;
}

/**
 * How a sign-in went. The refusals after `invalid` are said only once the
 * password was right, so they reveal nothing to someone guessing.
 */
export type LoginOutcome =
  | ({ readonly ok: true } & LoginResult)
  | { readonly ok: false; readonly reason: "invalid" | "second_factor_required" | "sso_required" | "suspended" };

export class StaffAuth {
  readonly #identity: IdentityStore;
  readonly #now: () => number;
  readonly #secrets: StaffSecrets | null;

  constructor(identity: IdentityStore, options: { readonly now?: () => number; readonly secrets?: StaffSecrets } = {}) {
    this.#identity = identity;
    this.#now = options.now ?? (() => Date.now());
    this.#secrets = options.secrets ?? null;
  }

  /**
   * Sign in with a password, and a second factor when the account has one:
   * a code from the authenticator app, or one of its recovery codes.
   */
  async login(email: string, password: string, code?: string): Promise<LoginOutcome> {
    const user = await this.#identity.findUserByEmail(email);
    if (user === null) {
      await argon2Verify(await decoyHash(), password).catch(() => false);
      return { ok: false, reason: "invalid" };
    }

    const ok = await argon2Verify(user.passwordHash, password).catch(() => false);
    if (!ok || user.disabled) return { ok: false, reason: "invalid" };

    // Paused by Parikshaa's operator (G1): said only once the password was right.
    if ((await this.#identity.getOrganisation(user.orgId))?.suspended != null) return { ok: false, reason: "suspended" };

    // An organisation that signs its staff in through its own provider keeps
    // passwords for owners only, so a broken provider cannot lock everyone out.
    if (user.role !== "owner") {
      const sso = await this.#identity.ssoConfig(user.orgId);
      if (sso !== null && sso.enabled && sso.enforced) return { ok: false, reason: "sso_required" };
    }

    const totp = await this.#identity.totpState(user.id);
    if (totp.secret !== null) {
      if (code === undefined || code.trim() === "") return { ok: false, reason: "second_factor_required" };
      if (!(await this.#secondFactor(user.id, totp.secret, code))) return { ok: false, reason: "invalid" };
    }

    const { passwordHash: _, ...safe } = user;
    return { ok: true, ...(await this.startSession(safe)) };
  }

  /** Whether `code` is a current authenticator code or an unused recovery code; spends either. */
  async #secondFactor(userId: string, sealed: string, code: string): Promise<boolean> {
    const secret = this.#secrets?.open("totp", userId, sealed) ?? null;
    if (secret === null) return false;
    const step = matchTotp(secret, code, this.#now());
    if (step !== null) return this.#identity.claimTotpStep(userId, step);
    const recovery = normaliseRecoveryCode(code);
    if (recovery.length !== 10) return false;
    return this.#identity.useRecoveryCode(userId, digest(recovery));
  }

  /** Check a code for a signed-in account, as turning the factor off asks for one. */
  async verifySecondFactor(userId: string, code: string): Promise<boolean> {
    const totp = await this.#identity.totpState(userId);
    return totp.secret !== null && this.#secondFactor(userId, totp.secret, code);
  }

  /** A fresh session for someone already proven to be `user`: by password, or by their organisation's provider. */
  async startSession(user: StaffUser): Promise<LoginResult> {
    const token = newSecret(SESSION_PREFIX);
    const expiresAt = new Date(this.#now() + SESSION_TTL_MS);
    await this.#identity.createSession(user.id, digest(token), expiresAt);
    return { token, expiresAt: expiresAt.toISOString(), user };
  }

  async logout(token: string): Promise<void> {
    await this.#identity.revokeSession(digest(token));
  }

  /** The actor behind a bearer value — a session or an API key — or null. */
  async resolve(bearer: string): Promise<Actor | null> {
    if (bearer.startsWith(SESSION_PREFIX)) {
      const user = await this.#identity.userForSession(digest(bearer), new Date(this.#now()));
      if (user === null) return null;
      return {
        kind: "user",
        id: user.id,
        orgId: user.orgId,
        role: user.role,
        name: user.name,
        email: user.email,
        ...(user.mustEnrol2fa ? { mustEnrol2fa: true } : {}),
        ...(user.emailUnverified ? { emailUnverified: true } : {}),
      };
    }
    if (bearer.startsWith(API_KEY_PREFIX)) {
      const key = await this.#identity.useApiKey(digest(bearer));
      if (key === null) return null;
      return { kind: "api_key", id: key.id, orgId: key.orgId, role: key.role, name: key.name };
    }
    return null;
  }

  /** Changing a password ends every other session, so a stolen one stops working. */
  async changePassword(actor: Actor & { kind: "user" }, current: string, next: string): Promise<boolean> {
    const user = await this.#identity.findUser(actor.orgId, actor.id);
    if (user === null) return false;
    const ok = await argon2Verify(user.passwordHash, current).catch(() => false);
    if (!ok) return false;
    await this.#identity.setPassword(actor.orgId, actor.id, await hashPassword(next));
    await this.#identity.revokeUserSessions(actor.id);
    return true;
  }

  /** Issue an API key. The returned secret is the only time it exists in the clear. */
  async issueApiKey(
    orgId: OrgId,
    name: string,
    role: ApiKeyRole,
    createdBy: string | null,
  ): Promise<{ readonly id: string; readonly secret: string }> {
    const secret = newSecret(API_KEY_PREFIX);
    const record = await this.#identity.createApiKey({ orgId, name, role, keyHash: digest(secret), createdBy });
    return { id: record.id, secret };
  }
}

/**
 * Slows password guessing against one account from one address.
 *
 * After `limit` failures within the window, further attempts for that pair are
 * refused until the window ends — without checking the password, so a correct
 * guess during the lockout is not rewarded. Keying on address *and* email means
 * an attacker cannot lock a real user out from elsewhere.
 *
 * In memory, so per process. That is enough to turn an online guessing attack
 * from thousands of attempts a minute into a handful; a shared limiter belongs
 * with horizontal scaling (ROADMAP §10).
 */
export class LoginThrottle {
  readonly #failures = new Map<string, { count: number; resetAt: number }>();
  readonly #limit: number;
  readonly #windowMs: number;
  readonly #now: () => number;

  constructor(options: { readonly limit?: number; readonly windowMs?: number; readonly now?: () => number } = {}) {
    this.#limit = options.limit ?? 10;
    this.#windowMs = options.windowMs ?? 15 * 60 * 1000;
    this.#now = options.now ?? (() => Date.now());
  }

  #key = (address: string, email: string): string => `${address}|${email.trim().toLowerCase()}`;

  blocked(address: string, email: string): boolean {
    const entry = this.#failures.get(this.#key(address, email));
    if (entry === undefined) return false;
    if (entry.resetAt <= this.#now()) {
      this.#failures.delete(this.#key(address, email));
      return false;
    }
    return entry.count >= this.#limit;
  }

  failed(address: string, email: string): void {
    const now = this.#now();
    if (this.#failures.size > 10_000) {
      for (const [key, entry] of this.#failures) if (entry.resetAt <= now) this.#failures.delete(key);
    }
    const key = this.#key(address, email);
    const entry = this.#failures.get(key);
    if (entry === undefined || entry.resetAt <= now) {
      this.#failures.set(key, { count: 1, resetAt: now + this.#windowMs });
    } else {
      entry.count += 1;
    }
  }

  succeeded(address: string, email: string): void {
    this.#failures.delete(this.#key(address, email));
  }
}
