import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { SignJWT, exportJWK, generateKeyPair, type KeyLike } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OrgId } from "@parikshaa/core";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, type IdentityStore as Identity } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PASSWORD, signIn, wire, type Wiring } from "./testing/harness.js";
import { stepAt, totpCode } from "./totp.js";

/** ROADMAP §1, finished: password reset, a second factor, and single sign-on. */

let db: PGlite;
let app: FastifyInstance;
let identity: Identity;
let handlers: Wiring["handlers"];
let clock: number;
let mail: OutboxLog;
let worker: DeliveryWorker;
let org: OrgId;

const NEW_PASSWORD = "a much longer new password";

beforeEach(async () => {
  clock = Date.parse("2026-09-27T06:00:00Z");
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  mail = new OutboxLog();
  ({ app, identity, handlers } = await wire(sql, {
    client: {} as unknown as Anthropic,
    now: () => clock,
    mailer: mail,
    staffClock: true,
    http: { allowPrivate: true },
  }));
  org = await addOrganisation(identity, "acme", "Acme Engineering");
  await addStaff(identity, org, "owner@acme.test", "owner", "Asha Rao");
  await addStaff(identity, org, "author@acme.test", "author", "Ravi Kumar");
  await db.exec(`SET ROLE parikshaa_app`);

  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: () => "",
    mailer: mail,
    sms: null,
    handlers,
    now: () => clock,
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const login = (email: string, password = PASSWORD, code?: string) =>
  app.inject({ method: "POST", url: "/auth/login", payload: { email, password, ...(code === undefined ? {} : { code }) } });

const call = (token: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

const emails = () => mail.sent.filter((m): m is EmailMessage => "subject" in m);

describe("password reset", () => {
  const request = (email: string) => app.inject({ method: "POST", url: "/auth/password-reset", payload: { email } });
  const tokenFrom = (message: EmailMessage) => decodeURIComponent(/\?reset=([^\s"&]+)/.exec(message.text)![1]!);

  it("answers the same for an address with no account, and sends nothing", async () => {
    const known = await request("author@acme.test");
    const unknown = await request("nobody@acme.test");
    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(unknown.payload).toBe(known.payload);
    await worker.tick();
    expect(emails().map((m) => m.to)).toEqual(["author@acme.test"]);
  });

  it("sets a new password once, ends every session, and the old password stops working", async () => {
    const session = await signIn(app, "author@acme.test");
    await request("author@acme.test");
    await worker.tick();
    const [message] = emails();
    expect(message!.subject).toMatch(/reset/i);
    expect(message!.text).toContain("https://exam.test/console/?reset=");
    const token = tokenFrom(message!);

    const done = await app.inject({ method: "POST", url: "/auth/password-reset/confirm", payload: { token, password: NEW_PASSWORD } });
    expect(done.statusCode).toBe(200);

    expect((await call(session, "GET", "/auth/me")).statusCode).toBe(401);
    expect((await login("author@acme.test")).statusCode).toBe(401);
    expect((await login("author@acme.test", NEW_PASSWORD)).statusCode).toBe(200);

    const again = await app.inject({ method: "POST", url: "/auth/password-reset/confirm", payload: { token, password: "yet another password here" } });
    expect(again.statusCode).toBe(410);
  });

  it("refuses a token it did not issue, and one past its hour", async () => {
    await request("author@acme.test");
    await worker.tick();
    const token = tokenFrom(emails()[0]!);
    const forged = `${token.split(".")[0]}.${"A".repeat(32)}`;
    expect((await app.inject({ method: "POST", url: "/auth/password-reset/confirm", payload: { token: forged, password: NEW_PASSWORD } })).statusCode).toBe(410);

    clock += 61 * 60 * 1000;
    expect((await app.inject({ method: "POST", url: "/auth/password-reset/confirm", payload: { token, password: NEW_PASSWORD } })).statusCode).toBe(410);
  });

  it("sends at most three an hour for one account", async () => {
    for (let i = 0; i < 5; i++) await request("author@acme.test");
    await worker.tick();
    expect(emails()).toHaveLength(3);
  });

  it("keeps a short password out", async () => {
    await request("author@acme.test");
    await worker.tick();
    const res = await app.inject({ method: "POST", url: "/auth/password-reset/confirm", payload: { token: tokenFrom(emails()[0]!), password: "short" } });
    expect(res.statusCode).toBe(422);
  });
});

describe("a second factor", () => {
  async function enrol(email: string): Promise<{ token: string; secret: string; recovery: readonly string[] }> {
    const token = await signIn(app, email);
    const setup = await call(token, "POST", "/auth/2fa/setup");
    expect(setup.statusCode).toBe(200);
    const { secret, uri } = setup.json() as { secret: string; uri: string };
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain(`secret=${secret}`);

    expect((await call(token, "POST", "/auth/2fa/enable", { code: "000000" === totpCode(secret, stepAt(clock)) ? "111111" : "000000" })).statusCode).toBe(422);
    const enabled = await call(token, "POST", "/auth/2fa/enable", { code: totpCode(secret, stepAt(clock)) });
    expect(enabled.statusCode).toBe(200);
    const recovery = (enabled.json() as { recoveryCodes: string[] }).recoveryCodes;
    expect(recovery).toHaveLength(10);
    return { token, secret, recovery };
  }

  it("is asked for after the password, and a code works once", async () => {
    const { secret } = await enrol("author@acme.test");
    clock += 30_000;

    const first = await login("author@acme.test");
    expect(first.statusCode).toBe(401);
    expect(first.json()).toMatchObject({ error: "second_factor_required" });

    // A wrong password is still only "invalid": the factor is asked for the right one alone.
    expect((await login("author@acme.test", "wrong password entirely")).json()).toMatchObject({ error: "invalid_credentials" });

    const code = totpCode(secret, stepAt(clock));
    expect((await login("author@acme.test", PASSWORD, code)).statusCode).toBe(200);
    // The same code again is a replay.
    expect((await login("author@acme.test", PASSWORD, code)).statusCode).toBe(401);
    // A code from the step after still works.
    clock += 30_000;
    expect((await login("author@acme.test", PASSWORD, totpCode(secret, stepAt(clock)))).statusCode).toBe(200);
  });

  it("takes a recovery code in place of the app, once", async () => {
    const { recovery } = await enrol("author@acme.test");
    const code = recovery[0]!.toUpperCase();
    expect((await login("author@acme.test", PASSWORD, code)).statusCode).toBe(200);
    expect((await login("author@acme.test", PASSWORD, code)).statusCode).toBe(401);
    const status = await call(await (async () => (await login("author@acme.test", PASSWORD, recovery[1]!)).json().token as string)(), "GET", "/auth/2fa");
    expect(status.json()).toMatchObject({ enabled: true, recoveryCodesLeft: 8 });
  });

  it("is turned off only with the password and a code", async () => {
    const { token, secret } = await enrol("author@acme.test");
    clock += 30_000;
    expect((await call(token, "POST", "/auth/2fa/disable", { password: "not the password", code: totpCode(secret, stepAt(clock)) })).statusCode).toBe(401);
    expect((await call(token, "POST", "/auth/2fa/disable", { password: PASSWORD, code: "123456" === totpCode(secret, stepAt(clock)) ? "654321" : "123456" })).statusCode).toBe(422);
    expect((await call(token, "POST", "/auth/2fa/disable", { password: PASSWORD, code: totpCode(secret, stepAt(clock)) })).statusCode).toBe(200);
    expect((await login("author@acme.test")).statusCode).toBe(200);
  });

  it("can be required of owners, who then may do nothing else until they set it up", async () => {
    const owner = await signIn(app, "owner@acme.test");
    // Not blind: the owner turning it on must have one.
    expect((await call(owner, "PUT", "/org/security", { requireOwner2fa: true })).statusCode).toBe(409);
    await addStaff(identity, org, "second-owner@acme.test", "owner", "Meera");
    const { token } = await enrol("owner@acme.test");
    expect((await call(token, "PUT", "/org/security", { requireOwner2fa: true })).statusCode).toBe(200);

    const other = await signIn(app, "second-owner@acme.test");
    const me = await call(other, "GET", "/auth/me");
    expect(me.json()).toMatchObject({ mustEnrol2fa: true });
    const refused = await call(other, "GET", "/exams");
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ error: "two_factor_required" });
    expect((await call(other, "POST", "/auth/2fa/setup")).statusCode).toBe(200);

    // Authors are not owners: nothing changes for them.
    const author = await signIn(app, "author@acme.test");
    expect((await call(author, "GET", "/exams")).statusCode).toBe(200);
  });
});

describe("single sign-on", () => {
  let idp: Server;
  let issuer: string;
  let privateKey: KeyLike;
  /** What the provider will say the person signing in is. */
  let claims: Record<string, unknown>;
  let lastNonce = "";
  let tokenRequests: URLSearchParams[] = [];

  beforeEach(async () => {
    const keys = await generateKeyPair("RS256");
    privateKey = keys.privateKey;
    const jwk = { ...(await exportJWK(keys.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
    claims = { email: "author@acme.test", email_verified: true };
    tokenRequests = [];

    idp = createServer((req, res) => {
      const url = new URL(req.url ?? "/", issuer);
      if (url.pathname === "/.well-known/openid-configuration") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks` }));
      } else if (url.pathname === "/jwks") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ keys: [jwk] }));
      } else if (url.pathname === "/token") {
        let body = "";
        req.on("data", (c: Buffer) => (body += c.toString()));
        req.on("end", async () => {
          const form = new URLSearchParams(body);
          tokenRequests.push(form);
          if (form.get("code") !== "good-code" || form.get("client_secret") !== "s3cret") {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "invalid_grant" }));
            return;
          }
          const idToken = await new SignJWT({ ...claims, nonce: lastNonce })
            .setProtectedHeader({ alg: "RS256", kid: "k1" })
            .setIssuer(issuer)
            .setAudience("parikshaa-client")
            .setSubject("user-123")
            .setIssuedAt(Math.floor(clock / 1000))
            .setExpirationTime(Math.floor(clock / 1000) + 300)
            .sign(privateKey);
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ id_token: idToken, access_token: "x", token_type: "Bearer" }));
        });
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    await new Promise<void>((resolve) => idp.listen(0, "127.0.0.1", resolve));
    issuer = `http://127.0.0.1:${(idp.address() as AddressInfo).port}`;
  });

  afterEach(() => new Promise<void>((resolve) => idp.close(() => resolve())));

  const configure = async (overrides: object = {}) => {
    const owner = await signIn(app, "owner@acme.test");
    const res = await call(owner, "PUT", "/org/sso", {
      issuer,
      clientId: "parikshaa-client",
      clientSecret: "s3cret",
      emailDomains: ["acme.test"],
      enforced: false,
      enabled: true,
      ...overrides,
    });
    expect(res.statusCode).toBe(200);
    return { owner, settings: res.json() as { redirectUri: string; issuer: string } };
  };

  /** Start at the console's button, as the provider would be visited, and come back with `code`. */
  async function roundTrip(code = "good-code"): Promise<string> {
    const start = await app.inject({ method: "GET", url: "/auth/sso/acme/start" });
    expect(start.statusCode).toBe(302);
    const to = new URL(start.headers.location as string);
    expect(to.origin + to.pathname).toBe(`${issuer}/authorize`);
    expect(to.searchParams.get("code_challenge_method")).toBe("S256");
    expect(to.searchParams.get("redirect_uri")).toBe("https://exam.test/api/auth/sso/callback");
    lastNonce = to.searchParams.get("nonce")!;
    const state = to.searchParams.get("state")!;
    const back = await app.inject({ method: "GET", url: `/auth/sso/callback?code=${code}&state=${encodeURIComponent(state)}` });
    expect(back.statusCode).toBe(302);
    return back.headers.location as string;
  }

  it("signs in existing staff the provider vouches for, with PKCE, and never shows the secret", async () => {
    const { owner, settings } = await configure();
    expect(settings.redirectUri).toBe("https://exam.test/api/auth/sso/callback");
    const view = await call(owner, "GET", "/org/sso");
    expect(view.payload).not.toContain("s3cret");

    const location = await roundTrip();
    expect(location).toMatch(/^\/console\/#sso=pks_/);
    const token = decodeURIComponent(location.split("#sso=")[1]!);
    const me = await call(token, "GET", "/auth/me");
    expect(me.json()).toMatchObject({ email: "author@acme.test", role: "author" });
    expect(tokenRequests[0]!.get("code_verifier")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("refuses an address that is not staff, one outside the domains, and one the provider does not vouch for", async () => {
    await configure();
    claims = { email: "stranger@acme.test", email_verified: true };
    expect(await roundTrip()).toBe("/console/?sso_error=not_staff");
    claims = { email: "author@elsewhere.test", email_verified: true };
    expect(await roundTrip()).toBe("/console/?sso_error=not_staff");
    claims = { email: "author@acme.test", email_verified: false };
    expect(await roundTrip()).toBe("/console/?sso_error=invalid_sso");
  });

  it("refuses a code the provider rejects, and a state it did not issue", async () => {
    await configure();
    expect(await roundTrip("bad-code")).toBe("/console/?sso_error=invalid_sso");
    const forged = await app.inject({ method: "GET", url: "/auth/sso/callback?code=good-code&state=forged" });
    expect(forged.headers.location).toBe("/console/?sso_error=invalid_sso");
  });

  it("when enforced, keeps passwords for owners only", async () => {
    await configure({ enforced: true });
    expect((await login("author@acme.test")).json()).toMatchObject({ error: "sso_required" });
    expect((await login("owner@acme.test")).statusCode).toBe(200);
  });

  it("checks the provider before saving it", async () => {
    const owner = await signIn(app, "owner@acme.test");
    const res = await call(owner, "PUT", "/org/sso", {
      issuer: `${issuer}/nowhere`,
      clientId: "c",
      clientSecret: "s",
      emailDomains: [],
      enforced: false,
      enabled: true,
    });
    expect(res.statusCode).toBe(422);
  });

  it("sends an organisation without it back to the console", async () => {
    const start = await app.inject({ method: "GET", url: "/auth/sso/acme/start" });
    expect(start.headers.location).toBe("/console/?sso_error=sso_not_configured");
  });
});
