import { verify as argon2Verify } from "@node-rs/argon2";
import type { OrgId } from "@parikshaa/core";
import type { IdentityStore, OutboxItem, StaffUser } from "@parikshaa/store";
import type { ItemHandler, Mailer } from "./delivery.js";
import { OidcClient, OidcError, randomToken } from "./oidc.js";
import { checkUrl, type SafeHttpOptions } from "./safe-http.js";
import { digest, hashPassword, type Actor, type LoginResult, type StaffAuth } from "./staff-auth.js";
import type { StaffSecrets } from "./staff-secrets.js";
import { matchTotp, newRecoveryCodes, newTotpSecret, normaliseRecoveryCode, otpauthUri } from "./totp.js";

/**
 * What finishes staff sign-in (ROADMAP §1): a password reset by email, a
 * second factor, and single sign-on through the organisation's own provider.
 *
 * None of it weakens what was there. A reset link is one use, an hour, and
 * ends every session; a second factor is asked after the password and a code
 * works once; a provider can only sign in someone who is already a member of
 * staff of that organisation, and never an address outside its domains.
 */

export type User = Actor & { readonly kind: "user" };

const RESET_TTL_MS = 60 * 60 * 1000;
/** Resets one account may ask for in an hour: enough for a mistyped link, too few to flood its owner. */
const RESETS_PER_HOUR = 3;
const SSO_STATE_TTL_MS = 10 * 60 * 1000;

export class SecurityError extends Error {
  constructor(
    readonly code:
      | "invalid_code"
      | "invalid_credentials"
      | "already_enabled"
      | "not_enabled"
      | "required_by_organisation"
      | "enrol_first"
      | "invalid_reset"
      | "sso_not_configured"
      | "invalid_sso"
      | "not_staff",
    message: string,
  ) {
    super(message);
    this.name = "SecurityError";
  }
}

export interface SsoSettingsInput {
  readonly issuer: string;
  readonly clientId: string;
  /** Absent: keep the one already set. */
  readonly clientSecret?: string | undefined;
  readonly emailDomains: readonly string[];
  readonly enforced: boolean;
  readonly enabled: boolean;
}

export interface SsoSettingsView {
  readonly configured: boolean;
  readonly issuer: string | null;
  readonly clientId: string | null;
  readonly emailDomains: readonly string[];
  readonly enforced: boolean;
  readonly enabled: boolean;
  /** What to register with the provider as the redirect URI. */
  readonly redirectUri: string;
}

export class StaffSecurity {
  readonly #identity: IdentityStore;
  readonly #auth: StaffAuth;
  readonly #secrets: StaffSecrets;
  readonly #oidc: OidcClient;
  readonly #publicUrl: string;
  readonly #http: SafeHttpOptions;
  readonly #mailer: Mailer | null;
  readonly #now: () => number;

  constructor(options: {
    readonly identity: IdentityStore;
    readonly auth: StaffAuth;
    readonly secrets: StaffSecrets;
    readonly publicUrl: string;
    readonly mailer?: Mailer | null;
    readonly http?: SafeHttpOptions;
    readonly now?: () => number;
  }) {
    this.#identity = options.identity;
    this.#auth = options.auth;
    this.#secrets = options.secrets;
    this.#publicUrl = options.publicUrl.replace(/\/+$/, "");
    this.#http = options.http ?? {};
    this.#mailer = options.mailer ?? null;
    this.#now = options.now ?? (() => Date.now());
    this.#oidc = new OidcClient({ http: this.#http, now: this.#now });
  }

  get redirectUri(): string {
    return `${this.#publicUrl}/api/auth/sso/callback`;
  }

  // --- a second factor -------------------------------------------------------------

  async twoFactorStatus(user: User): Promise<{ enabled: boolean; recoveryCodesLeft: number; required: boolean }> {
    const [totp, org, left] = await Promise.all([
      this.#identity.totpState(user.id),
      this.#identity.getOrganisation(user.orgId),
      this.#identity.recoveryCodesLeft(user.id),
    ]);
    return { enabled: totp.secret !== null, recoveryCodesLeft: left, required: user.role === "owner" && org?.requireOwner2fa === true };
  }

  /** A new secret for the authenticator app. It is not the account's until `enableTotp` sees a code from it. */
  async beginTotp(user: User): Promise<{ secret: string; uri: string }> {
    const totp = await this.#identity.totpState(user.id);
    if (totp.secret !== null) throw new SecurityError("already_enabled", "A second factor is already set up; turn it off first to replace it");
    const secret = newTotpSecret();
    await this.#identity.setPendingTotp(user.id, this.#secrets.seal("totp", user.id, secret));
    const org = await this.#identity.getOrganisation(user.orgId);
    return { secret, uri: otpauthUri(secret, user.email, `Parikshaa (${org?.name ?? user.orgId})`) };
  }

  /** Turn the factor on with a first code from it. Returns recovery codes, shown this once. */
  async enableTotp(user: User, code: string): Promise<readonly string[]> {
    const totp = await this.#identity.totpState(user.id);
    if (totp.secret !== null) throw new SecurityError("already_enabled", "A second factor is already set up");
    const secret = totp.pendingSecret === null ? null : this.#secrets.open("totp", user.id, totp.pendingSecret);
    if (secret === null) throw new SecurityError("enrol_first", "Start setting up the authenticator first");
    const step = matchTotp(secret, code, this.#now());
    if (step === null) throw new SecurityError("invalid_code", "That code is not right. Check the phone's clock and try the next one.");
    const codes = newRecoveryCodes();
    const enabled = await this.#identity.enableTotp(user.id, step, codes.map((c) => digest(normaliseRecoveryCode(c))));
    if (!enabled) throw new SecurityError("enrol_first", "Start setting up the authenticator first");
    return codes;
  }

  /** Turn it off: needs the password and a code, so a session left open is not enough. */
  async disableTotp(user: User, password: string, code: string): Promise<void> {
    const status = await this.twoFactorStatus(user);
    if (!status.enabled) throw new SecurityError("not_enabled", "No second factor is set up");
    if (status.required) throw new SecurityError("required_by_organisation", "Your organisation requires owners to use a second factor");
    const record = await this.#identity.findUser(user.orgId, user.id);
    const passwordOk = record !== null && (await argon2Verify(record.passwordHash, password).catch(() => false));
    if (!passwordOk) throw new SecurityError("invalid_credentials", "The password was not accepted");
    if (!(await this.#auth.verifySecondFactor(user.id, code))) throw new SecurityError("invalid_code", "That code is not right");
    await this.#identity.disableTotp(user.id);
    await this.#identity.revokeUserSessions(user.id);
  }

  /** Require owners to use a second factor. Only an owner who has one may turn this on, so the rule is never set blind. */
  async setOwnerRequirement(user: User, required: boolean): Promise<void> {
    if (required && !(await this.twoFactorStatus(user)).enabled) {
      throw new SecurityError("enrol_first", "Set up your own second factor before requiring one of every owner");
    }
    await this.#identity.setRequireOwner2fa(user.orgId, required);
  }

  // --- password reset ----------------------------------------------------------------

  /**
   * Ask for a reset link by email. Says nothing about whether the address has
   * an account: the caller answers the same either way.
   */
  async requestReset(email: string): Promise<User | null> {
    const user = await this.#identity.findUserByEmail(email);
    if (user === null || user.disabled) return null;
    const since = new Date(this.#now() - 60 * 60 * 1000);
    if ((await this.#identity.recentResets(user.id, since)) >= RESETS_PER_HOUR) return null;
    await this.#identity.requestPasswordReset(user, new Date(this.#now()), new Date(this.#now() + RESET_TTL_MS));
    return asActor(user);
  }

  /** Set a new password from a reset link. Every session ends; the second factor, if any, stays. */
  async completeReset(token: string, password: string): Promise<User> {
    const id = this.#secrets.verifyResetToken(token.trim());
    if (id === null) throw new SecurityError("invalid_reset", "This reset link is not valid");
    const hash = await hashPassword(password);
    const done = await this.#identity.completePasswordReset(id, hash, new Date(this.#now()));
    if (done === null) throw new SecurityError("invalid_reset", "This reset link has been used or has expired. Ask for a new one.");
    const user = await this.#identity.findUser(done.orgId, done.userId);
    if (user === null) throw new SecurityError("invalid_reset", "This reset link is not valid");
    return asActor(user);
  }

  /** Sends the reset email the outbox names. */
  readonly resetMail: ItemHandler = async (item: OutboxItem) => {
    const reset = await this.#identity.passwordReset(String(item.subject["resetId"] ?? ""));
    if (reset === null) return { skip: "The reset is gone" };
    if (reset.used) return { skip: "Already used" };
    if (reset.disabled) return { skip: "The account is disabled" };
    if (Date.parse(reset.expiresAt) <= this.#now()) return { skip: "Expired" };
    if (this.#mailer === null) return { skip: "Email is not configured" };
    const org = await this.#identity.getOrganisation(reset.orgId);
    const link = `${this.#publicUrl}/console/?reset=${encodeURIComponent(this.#secrets.resetToken(reset.id))}`;
    const name = reset.name.trim() === "" ? "Hello," : `Hello ${reset.name},`;
    const text = [
      name,
      "",
      `Someone asked to reset the password for your Parikshaa console account at ${org?.name ?? reset.orgId}.`,
      "If it was you, choose a new password here within the hour:",
      link,
      "",
      "The link works once. Using it signs you out everywhere. If you did not ask for this, ignore this email; your password has not changed.",
    ].join("\n");
    const html = `<p>${escape(name)}</p>
<p>Someone asked to reset the password for your Parikshaa console account at ${escape(org?.name ?? reset.orgId)}.</p>
<p><a href="${escape(link)}">Choose a new password</a> — within the hour; the link works once and signs you out everywhere.</p>
<p>If you did not ask for this, ignore this email; your password has not changed.</p>`;
    await this.#mailer.send({ to: reset.email, subject: "Reset your Parikshaa password", text, html });
    return "sent";
  };

  // --- single sign-on ------------------------------------------------------------------

  async ssoSettings(orgId: OrgId): Promise<SsoSettingsView> {
    const config = await this.#identity.ssoConfig(orgId);
    return {
      configured: config !== null,
      issuer: config?.issuer ?? null,
      clientId: config?.clientId ?? null,
      emailDomains: config?.emailDomains ?? [],
      enforced: config?.enforced ?? false,
      enabled: config?.enabled ?? false,
      redirectUri: this.redirectUri,
    };
  }

  /** Save the provider, after checking its discovery document can be read and names itself correctly. */
  async saveSso(orgId: OrgId, input: SsoSettingsInput): Promise<SsoSettingsView> {
    const existing = await this.#identity.ssoConfig(orgId);
    const secret = input.clientSecret ?? (existing === null ? null : this.#secrets.open("sso-client", orgId, existing.clientSecret));
    if (secret === null || secret === "") throw new SecurityError("invalid_sso", "The client secret is required");
    const issuer = checkUrl(input.issuer.trim(), this.#http).toString().replace(/\/+$/, "");
    try {
      await this.#oidc.discover(issuer);
    } catch (error) {
      throw new SecurityError("invalid_sso", error instanceof Error ? error.message : "The provider could not be reached");
    }
    const domains = [...new Set(input.emailDomains.map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter((d) => d !== ""))];
    await this.#identity.saveSsoConfig({
      orgId,
      issuer,
      clientId: input.clientId.trim(),
      clientSecret: this.#secrets.seal("sso-client", orgId, secret),
      emailDomains: domains,
      enforced: input.enforced,
      enabled: input.enabled,
    });
    return this.ssoSettings(orgId);
  }

  /** Where to send the browser to sign in through the organisation's provider. */
  async ssoStart(orgId: OrgId, loginHint?: string): Promise<string> {
    const config = await this.#identity.ssoConfig(orgId);
    if (config === null || !config.enabled) throw new SecurityError("sso_not_configured", "This organisation has not set up single sign-on");
    const discovery = await this.#oidc.discover(config.issuer);
    const nonce = randomToken();
    const verifier = randomToken();
    // Everything the callback needs, sealed: the browser carries it and cannot read or change it.
    const state = this.#secrets.seal(
      "sso-state",
      "state",
      JSON.stringify({ o: orgId, n: nonce, v: verifier, e: this.#now() + SSO_STATE_TTL_MS }),
    );
    return this.#oidc.authorizationUrl(discovery, {
      clientId: config.clientId,
      redirectUri: this.redirectUri,
      state,
      nonce,
      verifier,
      ...(loginHint === undefined || loginHint === "" ? {} : { loginHint }),
    });
  }

  /**
   * The provider sent the browser back. Sign in the member of staff whose
   * address the provider vouches for — who must already exist, in this
   * organisation, at one of its domains. Nobody is created here.
   */
  async ssoCallback(code: string, stateParam: string): Promise<LoginResult & { readonly user: StaffUser }> {
    const opened = this.#secrets.open("sso-state", "state", stateParam);
    if (opened === null) throw new SecurityError("invalid_sso", "This sign-in did not start here");
    const state = JSON.parse(opened) as { o: string; n: string; v: string; e: number };
    if (state.e <= this.#now()) throw new SecurityError("invalid_sso", "This sign-in took too long; start again");

    const orgId = state.o as OrgId;
    const config = await this.#identity.ssoConfig(orgId);
    if (config === null || !config.enabled) throw new SecurityError("sso_not_configured", "Single sign-on is off for this organisation");
    const clientSecret = this.#secrets.open("sso-client", orgId, config.clientSecret);
    if (clientSecret === null) throw new SecurityError("sso_not_configured", "The provider's client secret cannot be read; set it again");

    let claims;
    try {
      const discovery = await this.#oidc.discover(config.issuer);
      claims = await this.#oidc.exchange(discovery, {
        clientId: config.clientId,
        clientSecret,
        redirectUri: this.redirectUri,
        code,
        verifier: state.v,
        nonce: state.n,
      });
    } catch (error) {
      if (error instanceof OidcError) throw new SecurityError("invalid_sso", error.message);
      throw error;
    }

    // Microsoft Entra ID leaves `email_verified` out; an explicit false is a refusal everywhere.
    if (claims.email === null || claims.emailVerified === false) {
      throw new SecurityError("invalid_sso", "The provider did not vouch for an email address");
    }
    const domain = claims.email.split("@").pop()?.toLowerCase() ?? "";
    if (config.emailDomains.length > 0 && !config.emailDomains.includes(domain)) {
      throw new SecurityError("not_staff", `Addresses at ${domain} cannot sign in to this organisation`);
    }
    const user = await this.#identity.findUserByEmail(claims.email);
    if (user === null || user.orgId !== orgId || user.disabled) {
      throw new SecurityError("not_staff", "That address is not a member of staff here. Ask an owner to add you.");
    }
    const { passwordHash: _, ...safe } = user;
    return this.#auth.startSession(safe);
  }
}

const asActor = (user: StaffUser): User => ({
  kind: "user",
  id: user.id,
  orgId: user.orgId,
  role: user.role,
  name: user.name,
  email: user.email,
});

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
