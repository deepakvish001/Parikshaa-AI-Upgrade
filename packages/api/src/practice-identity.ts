import { createHmac, timingSafeEqual } from "node:crypto";
import type { OrgId } from "@parikshaa/core";
import type { Learner, OutboxItem, PracticeSite, PracticeStore } from "@parikshaa/store";
import type { ItemHandler, Mailer } from "./delivery.js";
import { OidcClient, OidcError, randomToken } from "./oidc.js";
import { PracticeError, type LearnerSession, type PracticeService } from "./practice.js";
import { RateLimiter } from "./rate-limit.js";
import type { SafeHttpOptions } from "./safe-http.js";
import type { StaffSecrets } from "./staff-secrets.js";

/**
 * Who a practice learner is (ROADMAP §15): their email address verified by a
 * link, and signing in with Google.
 *
 * A verification link is derived, not stored — an HMAC over the learner and
 * the address it was sent to — so it stops working if the address changes,
 * and a copy of the database verifies nobody. Google is an OpenID Connect
 * provider like any other (see `oidc.ts`); an address it vouches for is
 * verified, and signing in with it for the first time makes the account.
 */

export const GOOGLE_ISSUER = "https://accounts.google.com";
const STATE_TTL_MS = 10 * 60 * 1000;

export interface SignInSettingsView {
  readonly requireVerified: boolean;
  readonly google: { readonly enabled: boolean; readonly clientId: string | null; readonly secretSet: boolean };
  /** Register this with Google as an authorised redirect URI; null until the site has an address. */
  readonly redirectUri: string | null;
}

export class PracticeIdentity {
  readonly #store: PracticeStore;
  readonly #practice: PracticeService;
  readonly #secrets: StaffSecrets;
  readonly #publicUrl: string;
  readonly #mailer: Mailer | null;
  readonly #oidc: OidcClient;
  readonly #issuer: string;
  readonly #now: () => number;
  readonly #key: Buffer;
  /** Three verification emails an hour per learner: enough for a typo'd spam filter, not a mail bomb. */
  readonly #resends = new RateLimiter({ perSecond: 1 / 1200, burst: 3 });

  constructor(options: {
    readonly store: PracticeStore;
    readonly practice: PracticeService;
    readonly secrets: StaffSecrets;
    readonly secret: string;
    readonly publicUrl: string;
    readonly mailer?: Mailer | null;
    readonly http?: SafeHttpOptions;
    /** Google's, unless a test stands in for it. */
    readonly issuer?: string;
    readonly now?: () => number;
  }) {
    this.#store = options.store;
    this.#practice = options.practice;
    this.#secrets = options.secrets;
    this.#publicUrl = options.publicUrl.replace(/\/+$/, "");
    this.#mailer = options.mailer ?? null;
    this.#issuer = options.issuer ?? GOOGLE_ISSUER;
    this.#now = options.now ?? (() => Date.now());
    this.#oidc = new OidcClient({ ...(options.http === undefined ? {} : { http: options.http }), now: this.#now });
    this.#key = createHmac("sha256", options.secret).update("parikshaa-learner-verification").digest();
  }

  /** Per site: each organisation registers its own Google client, with its own site's address. */
  redirectUri(slug: string): string {
    return `${this.#publicUrl}/api/practice/${slug}/auth/google/callback`;
  }

  // --- verifying an address ---------------------------------------------------------------

  #mac(learner: { readonly orgId: string; readonly id: string; readonly email: string }): string {
    return createHmac("sha256", this.#key).update(`${learner.orgId}\u0000${learner.id}\u0000${learner.email.toLowerCase()}`).digest("base64url").slice(0, 32);
  }

  verificationToken(learner: Learner): string {
    return `${learner.id}.${this.#mac(learner)}`;
  }

  /** Send the link, unless the address is verified already or too many were sent lately. */
  async sendVerification(learner: Learner): Promise<boolean> {
    if (learner.emailVerified) return false;
    if (!this.#resends.take(learner.id).ok) return false;
    await this.#store.queueVerification(learner.orgId, learner.id, new Date(this.#now()));
    return true;
  }

  /** Follow a link. Any failure reads the same: the link is not valid. */
  async verify(site: PracticeSite, token: string): Promise<void> {
    const dot = token.lastIndexOf(".");
    const learner = dot <= 0 ? null : await this.#store.learnerById(site.orgId, token.slice(0, dot));
    const given = Buffer.from(token.slice(dot + 1));
    const expected = learner === null ? null : Buffer.from(this.#mac(learner));
    if (learner === null || expected === null || given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new PracticeError("invalid", "This link is not valid. Ask for a new one from your account.");
    }
    await this.#store.markVerified(site.orgId, learner.id, learner.email);
  }

  /** Refuse what a site keeps for verified learners — submitting and discussing — to one who is not. */
  async assertMayContribute(site: PracticeSite, learner: Learner): Promise<void> {
    if (learner.emailVerified) return;
    const settings = await this.#store.signInSettings(site.orgId);
    if (settings.requireVerified) {
      throw new PracticeError("email_not_verified", "Verify your email address first: open the link we sent you.");
    }
  }

  /** Sends the verification email the outbox names. */
  readonly verificationMail: ItemHandler = async (item: OutboxItem) => {
    const learner = await this.#store.learnerById(item.orgId as OrgId, String(item.subject["learnerId"] ?? ""));
    if (learner === null) return { skip: "The account is gone" };
    if (learner.emailVerified) return { skip: "Already verified" };
    if (this.#mailer === null) return { skip: "Email is not configured" };
    const site = await this.#practice.siteFor(learner.orgId);
    if (site === null) return { skip: "The site is gone" };
    const link = `${this.#publicUrl}/practice/${site.slug}?verify=${encodeURIComponent(this.verificationToken(learner))}`;
    const hello = learner.name.trim() === "" ? "Hello," : `Hello ${learner.name},`;
    await this.#mailer.send({
      to: learner.email,
      subject: `Confirm your email for ${site.title}`,
      text: [hello, "", `Confirm this is your address for ${site.title}:`, link, "", "If you did not sign up, ignore this email."].join("\n"),
      html: `<p>${escape(hello)}</p><p>Confirm this is your address for ${escape(site.title)}:</p><p><a href="${escape(link)}">Confirm my email</a></p><p>If you did not sign up, ignore this email.</p>`,
    });
    return "sent";
  };

  // --- settings (staff) --------------------------------------------------------------------

  async settings(orgId: OrgId): Promise<SignInSettingsView> {
    const [s, site] = await Promise.all([this.#store.signInSettings(orgId), this.#practice.siteFor(orgId)]);
    return {
      requireVerified: s.requireVerified,
      google: { enabled: s.googleEnabled, clientId: s.googleClientId, secretSet: s.googleClientSecret !== null },
      redirectUri: site === null ? null : this.redirectUri(site.slug),
    };
  }

  async saveSettings(
    orgId: OrgId,
    input: { readonly requireVerified: boolean; readonly google: { readonly enabled: boolean; readonly clientId: string | null; readonly clientSecret?: string | undefined } },
  ): Promise<SignInSettingsView> {
    const existing = await this.#store.signInSettings(orgId);
    const secret =
      input.google.clientSecret === undefined || input.google.clientSecret === ""
        ? existing.googleClientSecret
        : this.#secrets.seal("practice-google", orgId, input.google.clientSecret);
    const clientId = input.google.clientId?.trim() || null;
    if (input.google.enabled && (clientId === null || secret === null)) {
      throw new PracticeError("invalid", "Google sign-in needs its client ID and secret");
    }
    await this.#store.saveSignInSettings(orgId, {
      requireVerified: input.requireVerified,
      googleEnabled: input.google.enabled,
      googleClientId: clientId,
      googleClientSecret: secret,
    });
    return this.settings(orgId);
  }

  /** What a visitor's sign-in page offers. */
  async options(site: PracticeSite): Promise<{ google: boolean; requireVerified: boolean }> {
    const s = await this.#store.signInSettings(site.orgId);
    return { google: s.googleEnabled && s.googleClientId !== null, requireVerified: s.requireVerified };
  }

  // --- signing in with Google ----------------------------------------------------------------

  async googleStart(site: PracticeSite): Promise<string> {
    const s = await this.#store.signInSettings(site.orgId);
    if (!s.googleEnabled || s.googleClientId === null) throw new PracticeError("not_found", "This site does not offer Google sign-in");
    const discovery = await this.#discover();
    const nonce = randomToken();
    const verifier = randomToken();
    const state = this.#secrets.seal("practice-state", "state", JSON.stringify({ s: site.slug, n: nonce, v: verifier, e: this.#now() + STATE_TTL_MS }));
    return this.#oidc.authorizationUrl(discovery, { clientId: s.googleClientId, redirectUri: this.redirectUri(site.slug), state, nonce, verifier });
  }

  async #discover() {
    try {
      return await this.#oidc.discover(this.#issuer);
    } catch (error) {
      if (error instanceof OidcError) throw new PracticeError("sign_in_failed", "Google could not be reached. Try again.");
      throw error;
    }
  }

  /** Google sent the browser back: sign the learner in, making their account the first time. */
  async googleCallback(site: PracticeSite, code: string, stateParam: string): Promise<LearnerSession> {
    const opened = this.#secrets.open("practice-state", "state", stateParam);
    if (opened === null) throw new PracticeError("sign_in_failed", "This sign-in did not start here");
    const state = JSON.parse(opened) as { s: string; n: string; v: string; e: number };
    const fail = (message: string) => new PracticeError("sign_in_failed", message);
    if (state.s !== site.slug) throw fail("This sign-in started on another site");
    if (state.e <= this.#now()) throw fail("The sign-in took too long; try again");

    const s = await this.#store.signInSettings(site.orgId);
    const secret = s.googleClientSecret === null ? null : this.#secrets.open("practice-google", site.orgId, s.googleClientSecret);
    if (!s.googleEnabled || s.googleClientId === null || secret === null) throw fail("This site does not offer Google sign-in");

    let claims;
    try {
      claims = await this.#oidc.exchange(await this.#discover(), {
        clientId: s.googleClientId,
        clientSecret: secret,
        redirectUri: this.redirectUri(site.slug),
        code,
        verifier: state.v,
        nonce: state.n,
      });
    } catch (error) {
      if (error instanceof OidcError) throw fail("Google did not complete the sign-in");
      throw error;
    }
    if (claims.email === null || claims.emailVerified !== true) throw fail("Google did not confirm an email address");

    const existing = await this.#store.learnerByEmail(site.orgId, claims.email);
    let learner: Learner;
    if (existing === null) {
      const name = (claims.name ?? claims.email.split("@")[0] ?? "Learner").slice(0, 80);
      // No password: this account signs in with Google. "!" is no argon2 hash, so no password matches it.
      learner = await this.#store.createLearner({ orgId: site.orgId, email: claims.email, name, passwordHash: "!", verified: true });
    } else {
      await this.#store.markVerified(site.orgId, existing.id, existing.email);
      const { passwordHash: _, ...rest } = existing;
      learner = { ...rest, emailVerified: true };
    }
    return this.#practice.sessionFor(learner);
  }
}

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
