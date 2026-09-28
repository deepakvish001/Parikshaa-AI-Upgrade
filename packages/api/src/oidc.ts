import { createHash, randomBytes } from "node:crypto";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { safeRequest, type SafeHttpOptions } from "./safe-http.js";

/**
 * An OpenID Connect relying party, as small as the authorization code flow
 * with PKCE allows (ROADMAP §1). Google Workspace, Microsoft Entra ID, Okta,
 * Keycloak and Zoho all speak it, so none of them is special-cased.
 *
 * Every request to the provider goes through the same SSRF guard as webhooks:
 * the issuer is a URL an owner typed, and the server fetches it.
 */

export interface Discovery {
  readonly issuer: string;
  readonly authorization_endpoint: string;
  readonly token_endpoint: string;
  readonly jwks_uri: string;
}

export class OidcError extends Error {
  constructor(
    readonly code: "discovery_failed" | "token_exchange_failed" | "invalid_id_token",
    message: string,
  ) {
    super(message);
    this.name = "OidcError";
  }
}

/** base64url(SHA-256(verifier)): the S256 code challenge. */
export const codeChallenge = (verifier: string): string => createHash("sha256").update(verifier).digest("base64url");

export const randomToken = (): string => randomBytes(32).toString("base64url");

const trimSlash = (url: string) => url.replace(/\/+$/, "");

export class OidcClient {
  readonly #http: SafeHttpOptions;
  readonly #now: () => number;
  readonly #discovery = new Map<string, { readonly at: number; readonly value: Discovery }>();

  constructor(options: { readonly http?: SafeHttpOptions; readonly now?: () => number } = {}) {
    this.#http = options.http ?? {};
    this.#now = options.now ?? (() => Date.now());
  }

  async #getJson(url: string): Promise<unknown> {
    const response = await safeRequest(url, { method: "GET", headers: { accept: "application/json" } }, this.#http);
    if (response.status !== 200) throw new OidcError("discovery_failed", `${new URL(url).host} answered ${response.status}`);
    try {
      return JSON.parse(response.body) as unknown;
    } catch {
      throw new OidcError("discovery_failed", `${new URL(url).host} did not answer with JSON`);
    }
  }

  /** The provider's discovery document, cached for an hour. Its issuer must be the one configured, exactly. */
  async discover(issuer: string): Promise<Discovery> {
    const cached = this.#discovery.get(issuer);
    if (cached !== undefined && this.#now() - cached.at < 3_600_000) return cached.value;
    const doc = (await this.#getJson(`${trimSlash(issuer)}/.well-known/openid-configuration`)) as Partial<Discovery>;
    for (const key of ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"] as const) {
      if (typeof doc[key] !== "string") throw new OidcError("discovery_failed", `The discovery document has no ${key}`);
    }
    if (trimSlash(doc.issuer!) !== trimSlash(issuer)) {
      throw new OidcError("discovery_failed", `The provider calls itself ${doc.issuer}, not ${issuer}`);
    }
    const value = doc as Discovery;
    this.#discovery.set(issuer, { at: this.#now(), value });
    return value;
  }

  authorizationUrl(
    discovery: Discovery,
    request: { readonly clientId: string; readonly redirectUri: string; readonly state: string; readonly nonce: string; readonly verifier: string; readonly loginHint?: string },
  ): string {
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", request.clientId);
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", request.state);
    url.searchParams.set("nonce", request.nonce);
    url.searchParams.set("code_challenge", codeChallenge(request.verifier));
    url.searchParams.set("code_challenge_method", "S256");
    if (request.loginHint !== undefined) url.searchParams.set("login_hint", request.loginHint);
    return url.toString();
  }

  /**
   * Exchange the code for an ID token, and check it: signed by a key the
   * provider publishes, issued by it, for this client, with this sign-in's
   * nonce, and not expired. Returns the verified claims.
   */
  async exchange(
    discovery: Discovery,
    request: { readonly clientId: string; readonly clientSecret: string; readonly redirectUri: string; readonly code: string; readonly verifier: string; readonly nonce: string },
  ): Promise<{ readonly email: string | null; readonly emailVerified: boolean | null; readonly subject: string; readonly name: string | null }> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: request.code,
      redirect_uri: request.redirectUri,
      client_id: request.clientId,
      client_secret: request.clientSecret,
      code_verifier: request.verifier,
    }).toString();
    const response = await safeRequest(
      discovery.token_endpoint,
      { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body },
      this.#http,
    );
    let tokens: { id_token?: unknown };
    try {
      tokens = JSON.parse(response.body) as { id_token?: unknown };
    } catch {
      tokens = {};
    }
    if (response.status !== 200 || typeof tokens.id_token !== "string") {
      throw new OidcError("token_exchange_failed", `The provider refused the sign-in (${response.status})`);
    }

    const jwks = (await this.#getJson(discovery.jwks_uri)) as JSONWebKeySet;
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(tokens.id_token, createLocalJWKSet(jwks), {
        issuer: discovery.issuer,
        audience: request.clientId,
        currentDate: new Date(this.#now()),
        clockTolerance: 60,
      }));
    } catch (error) {
      throw new OidcError("invalid_id_token", `The provider's ID token did not verify: ${(error as Error).message}`);
    }
    if (payload["nonce"] !== request.nonce) throw new OidcError("invalid_id_token", "The ID token is for another sign-in");
    return {
      subject: String(payload["sub"] ?? ""),
      email: typeof payload["email"] === "string" ? payload["email"] : null,
      emailVerified: typeof payload["email_verified"] === "boolean" ? payload["email_verified"] : null,
      name: typeof payload["name"] === "string" ? payload["name"] : null,
    };
  }
}
