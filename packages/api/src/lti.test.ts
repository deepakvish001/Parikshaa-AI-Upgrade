import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, jwtVerify, type JSONWebKeySet } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog } from "./delivery.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, wire, type Wiring } from "./testing/harness.js";

/**
 * ROADMAP §7, universities: Moodle through LTI 1.3, against a stand-in
 * platform on 127.0.0.1 that signs launches with its own key, checks the
 * tool's client assertion against the tool's published key, and records the
 * score posted to its grade book.
 */

const HOUR = 3_600_000;
const CLAIM = "https://purl.imsglobal.org/spec/lti/claim";

interface Received {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

let db: PGlite;
let app: FastifyInstance;
let clock: number;
let owner: string;
let worker: DeliveryWorker;
let handlers: Wiring["handlers"];
let moodle: Server;
let site: string;
let platformKey: CryptoKey;
let platformJwks: JSONWebKeySet;
let received: Received[];
let platformId: string;

beforeEach(async () => {
  clock = Date.now();
  received = [];
  const keys = await generateKeyPair("RS256");
  platformKey = keys.privateKey;
  platformJwks = { keys: [{ ...(await exportJWK(keys.publicKey)), kid: "moodle-1", alg: "RS256", use: "sig" }] };

  moodle = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      received.push({ method: req.method!, url: req.url!, headers: req.headers, body });
      res.setHeader("content-type", "application/json");
      if (req.url === "/mod/lti/certs.php") return res.end(JSON.stringify(platformJwks));
      if (req.url === "/mod/lti/token.php") {
        const form = new URLSearchParams(body);
        if (!(await toolAssertionHolds(form.get("client_assertion")!))) {
          res.statusCode = 401;
          return res.end(JSON.stringify({ error: "invalid_client" }));
        }
        return res.end(JSON.stringify({ access_token: "moodle-access", token_type: "Bearer", expires_in: 3600, scope: form.get("scope") }));
      }
      res.end("{}");
    });
  });
  await new Promise<void>((resolve) => moodle.listen(0, "127.0.0.1", resolve));
  site = `http://127.0.0.1:${(moodle.address() as AddressInfo).port}`;

  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  let identity;
  ({ app, identity, handlers } = await wire(sql, { client: {} as unknown as Anthropic, now: () => clock, http: { allowPrivate: true, timeoutMs: 2000 } }));
  const org = await addOrganisation(identity, "org-a", "IIT Hyderabad");
  await addStaff(identity, org, "owner@iith.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@iith.test");
  expect(
    (
      await call("POST", owner, "/exams", {
        id: "quiz-1",
        title: "Data structures quiz",
        questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 5, rubric: [], options: ["a", "b"], correctIndex: 0 }],
        policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
      })
    ).statusCode,
  ).toBe(201);

  const registered = await call("POST", owner, "/lti/platforms", {
    name: "IITH Moodle",
    issuer: site,
    clientId: "moodle-client-1",
    deploymentIds: ["1"],
    authLoginUrl: `${site}/mod/lti/auth.php`,
    authTokenUrl: `${site}/mod/lti/token.php`,
    jwksUrl: `${site}/mod/lti/certs.php`,
  });
  expect(registered.statusCode, registered.payload).toBe(201);
  platformId = registered.json().id;
  expect(registered.json().tool).toEqual({
    toolUrl: `${PUBLIC_URL}/api/lti/launch`,
    loginUrl: `${PUBLIC_URL}/api/lti/login`,
    redirectUrl: `${PUBLIC_URL}/api/lti/launch`,
    jwksUrl: `${PUBLIC_URL}/api/lti/${platformId}/jwks`,
    customParameters: "exam=<exam id>",
  });

  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: () => "",
    mailer: new OutboxLog(),
    sms: null,
    handlers,
    now: () => clock,
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
  await new Promise((r) => moodle.close(r));
});

/** The stand-in Moodle checks the tool's client assertion against the key the tool publishes. */
async function toolAssertionHolds(assertion: string): Promise<boolean> {
  const toolKeys = (await app.inject({ method: "GET", url: `/lti/${platformId}/jwks` })).json() as JSONWebKeySet;
  try {
    await jwtVerify(assertion, createLocalJWKSet(toolKeys), { issuer: "moodle-client-1", audience: `${site}/mod/lti/token.php` });
    return true;
  } catch {
    return false;
  }
}

const call = (method: "GET" | "POST", token: string | null, url: string, payload?: object) =>
  app.inject({ method, url, headers: token === null ? {} : bearer(token), ...(payload === undefined ? {} : { payload }) });

/** Run the worker until nothing is due; the clock moves on a little, as it would. */
async function drain() {
  for (let i = 0; i < 6; i++) {
    clock += 5_000;
    if ((await worker.tick()) === 0) return;
  }
}

/** Moodle's side of a launch: start the login, then post a signed ID token for `claims`. */
async function launch(claims: Record<string, unknown>, tamper: { nonce?: string; audience?: string } = {}) {
  const start = await app.inject({ method: "GET", url: `/lti/login?iss=${encodeURIComponent(site)}&login_hint=u42&client_id=moodle-client-1&lti_message_hint=m1` });
  expect(start.statusCode, start.payload).toBe(302);
  const to = new URL(start.headers.location as string);
  expect(to.origin + to.pathname).toBe(`${site}/mod/lti/auth.php`);
  expect(to.searchParams.get("response_mode")).toBe("form_post");
  expect(to.searchParams.get("redirect_uri")).toBe(`${PUBLIC_URL}/api/lti/launch`);

  const idToken = await new SignJWT({
    nonce: tamper.nonce ?? to.searchParams.get("nonce"),
    [`${CLAIM}/message_type`]: "LtiResourceLinkRequest",
    [`${CLAIM}/version`]: "1.3.0",
    [`${CLAIM}/deployment_id`]: "1",
    [`${CLAIM}/resource_link`]: { id: "activity-9" },
    [`${CLAIM}/custom`]: { exam: "quiz-1" },
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "moodle-1" })
    .setIssuer(site)
    .setAudience(tamper.audience ?? "moodle-client-1")
    .setSubject("42")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(platformKey);
  return app.inject({
    method: "POST",
    url: "/lti/launch",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: new URLSearchParams({ id_token: idToken, state: to.searchParams.get("state")! }).toString(),
  });
}

const learner = {
  name: "Priya Sharma",
  email: "priya@iith.test",
  [`${CLAIM}/roles`]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
  "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint": {
    scope: ["https://purl.imsglobal.org/spec/lti-ags/scope/lineitem", "https://purl.imsglobal.org/spec/lti-ags/scope/score"],
    lineitem: "__SITE__/mod/lti/services.php/2/lineitems/7/lineitem?type_id=1",
  },
};
const asLearner = () =>
  JSON.parse(JSON.stringify(learner).replace("__SITE__", site)) as Record<string, unknown>;

describe("launching from Moodle", () => {
  it("sends a learner to their own attempt, the same one each time", async () => {
    const first = await launch(asLearner());
    expect(first.statusCode, first.payload).toBe(303);
    expect(first.headers.location).toMatch(new RegExp(`^${PUBLIC_URL}/\\?invite=org-a\\.`));
    const again = await launch(asLearner());
    expect(again.headers.location).toBe(first.headers.location);

    const [invitation] = (await call("GET", owner, "/exams/quiz-1/invitations")).json().invitations;
    expect(invitation).toMatchObject({ candidateRef: "LTI-42", name: "Priya Sharma", email: "priya@iith.test" });
  });

  it("shows a teacher what the activity does, not a test", async () => {
    const res = await launch({ [`${CLAIM}/roles`]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"] });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.payload).toContain("Data structures quiz");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("refuses a launch with the wrong nonce, for another client, or naming no exam", async () => {
    expect((await launch(asLearner(), { nonce: "replayed" })).statusCode).toBe(400);
    expect((await launch(asLearner(), { audience: "someone-else" })).statusCode).toBe(400);
    const none = await launch({ ...asLearner(), [`${CLAIM}/custom`]: {} });
    expect(none.statusCode).toBe(400);
    expect(none.payload).toContain("exam=&lt;exam id&gt;");
  });

  it("refuses an LMS that is not registered", async () => {
    const res = await app.inject({ method: "GET", url: "/lti/login?iss=https%3A%2F%2Fother.example&login_hint=x" });
    expect(res.statusCode).toBe(400);
  });
});

describe("registering an LMS", () => {
  it("keeps the issuer without the trailing slashes an owner typed, however many", async () => {
    const res = await call("POST", owner, "/lti/platforms", {
      name: "IITH Moodle, second client",
      issuer: `${site}${"/".repeat(5_000)}`,
      clientId: "moodle-client-2",
      deploymentIds: [],
      authLoginUrl: `${site}/mod/lti/auth.php`,
      authTokenUrl: `${site}/mod/lti/token.php`,
      jwksUrl: `${site}/mod/lti/certs.php`,
    });
    expect(res.statusCode, res.payload).toBe(201);
    expect(res.json().issuer).toBe(site);
  });
});

describe("the grade", () => {
  it("goes back to Moodle's grade book once graded, with a token bought by the tool's signed assertion", async () => {
    const res = await launch(asLearner());
    const code = decodeURIComponent(new URL(res.headers.location as string).searchParams.get("invite")!);
    const { token, attemptId } = (await call("POST", null, "/invitations/redeem", { code })).json();
    await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" });
    await call("POST", token, "/attempts/me/submit");
    await drain();
    expect(received.some((r) => r.url.includes("/scores"))).toBe(false);

    await call("POST", owner, `/attempts/${attemptId}/grade`);
    await drain();

    const tokenCall = received.find((r) => r.url === "/mod/lti/token.php")!;
    expect(new URLSearchParams(tokenCall.body).get("scope")).toBe("https://purl.imsglobal.org/spec/lti-ags/scope/score");
    const score = received.find((r) => r.method === "POST" && r.url.startsWith("/mod/lti/services.php/2/lineitems/7/lineitem/scores"))!;
    expect(score.url).toBe("/mod/lti/services.php/2/lineitems/7/lineitem/scores?type_id=1");
    expect(score.headers.authorization).toBe("Bearer moodle-access");
    expect(score.headers["content-type"]).toBe("application/vnd.ims.lis.v1.score+json");
    expect(JSON.parse(score.body)).toMatchObject({ userId: "42", scoreGiven: 5, scoreMaximum: 5, activityProgress: "Completed", gradingProgress: "FullyGraded" });
  });

  it("is not sent when the score scope is not one entry of the scope list", async () => {
    const endpoint = "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint";
    const claims = asLearner();
    const res = await launch({ ...claims, [endpoint]: { ...(claims[endpoint] as object), scope: "https://purl.imsglobal.org/spec/lti-ags/scope/score" } });
    const code = decodeURIComponent(new URL(res.headers.location as string).searchParams.get("invite")!);
    const { token, attemptId } = (await call("POST", null, "/invitations/redeem", { code })).json();
    await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" });
    await call("POST", token, "/attempts/me/submit");
    await drain();
    await call("POST", owner, `/attempts/${attemptId}/grade`);
    await drain();
    expect(received.some((r) => r.url === "/mod/lti/token.php" || r.url.includes("/scores"))).toBe(false);
  });

  it("publishes only the tool's public key", async () => {
    const jwks = (await app.inject({ method: "GET", url: `/lti/${platformId}/jwks` })).json() as { keys: Record<string, unknown>[] };
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kty: "RSA", alg: "RS256", use: "sig" });
    expect(jwks.keys[0]!["d"]).toBeUndefined();
    const listed = await call("GET", owner, "/lti/platforms");
    expect(listed.payload).not.toContain("PRIVATE KEY");
  });
});
