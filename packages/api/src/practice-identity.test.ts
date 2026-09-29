import { mkdtemp } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire, type Wiring } from "./testing/harness.js";

/**
 * Practice sites, finished (ROADMAP §15): learners' addresses verified by an
 * emailed link, signing in with Google, and — for staff — learners whose code
 * looks alike. Runs as `parikshaa_app`, and code runs in the real runner.
 */

const isRoot = process.getuid?.() === 0;
let workRoot: string;
const runner: CodeRunner = { run: (request) => execute(request, { workRoot, slot: isRoot ? { uid: 61081, gid: 61081 } : null }) };

const SUM = {
  kind: "code",
  stem: "Sum of a list\n\nRead numbers, one line, and print their sum.",
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python"],
  tests: [
    { id: "sample", input: "1 2 3\n", expected: "6\n", hidden: false, weight: 1 },
    { id: "negative", input: "-4 10 -1\n", expected: "5\n", hidden: true, weight: 1 },
  ],
  limits: { timeMs: 3000 },
};

const ORIGINAL = `numbers = list(map(int, input().split()))
total = 0
for value in numbers:
    if value > 0:
        total = total + value
    else:
        total = total + value
print(total)
`;
// The same program, renamed and recommented: what copying looks like.
const COPIED = `# my own solution
xs = list(map(int, input().split()))
acc = 0
for item in xs:
    if item > 0:
        acc = acc + item   # add it
    else:
        acc = acc + item
print(acc)
`;
const DIFFERENT = `import sys
print(sum(int(token) for token in sys.stdin.read().split()))
`;

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let reviewer: string;
let author: string;
let mail: OutboxLog;
let worker: DeliveryWorker;
let handlers: Wiring["handlers"];
let clock: number;

let idp: Server;
let issuer: string;
let privateKey: CryptoKey;
let claims: Record<string, unknown>;
let nonce = "";

beforeEach(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "api-practice-id-"));
  clock = Date.now();

  const keys = await generateKeyPair("RS256");
  privateKey = keys.privateKey;
  const jwk = { ...(await exportJWK(keys.publicKey)), kid: "g1", alg: "RS256", use: "sig" };
  claims = { email: "meera@gmail.test", email_verified: true, name: "Meera Iyer" };
  idp = createServer((req, res) => {
    const url = new URL(req.url ?? "/", issuer);
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/.well-known/openid-configuration") {
      res.end(JSON.stringify({ issuer, authorization_endpoint: `${issuer}/o/oauth2/v2/auth`, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/certs` }));
    } else if (url.pathname === "/certs") {
      res.end(JSON.stringify({ keys: [jwk] }));
    } else if (url.pathname === "/token") {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", async () => {
        const form = new URLSearchParams(body);
        if (form.get("client_secret") !== "google-secret") {
          res.statusCode = 400;
          return res.end("{}");
        }
        const idToken = await new SignJWT({ ...claims, nonce })
          .setProtectedHeader({ alg: "RS256", kid: "g1" })
          .setIssuer(issuer)
          .setAudience("google-client.apps.googleusercontent.com")
          .setSubject("1234567890")
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(privateKey);
        res.end(JSON.stringify({ id_token: idToken }));
      });
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise<void>((resolve) => idp.listen(0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${(idp.address() as AddressInfo).port}`;

  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  mail = new OutboxLog();
  let identity;
  ({ app, identity, handlers } = await wire(sql, {
    client: {} as unknown as Anthropic,
    runner,
    mailer: mail,
    http: { allowPrivate: true },
    googleIssuer: issuer,
    now: () => clock,
  }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await addStaff(identity, org, "reviewer@nit.test", "reviewer");
  await addStaff(identity, org, "author@nit.test", "author");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@nit.test");
  reviewer = await signIn(app, "reviewer@nit.test");
  author = await signIn(app, "author@nit.test");
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

  expect((await call("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true })).statusCode).toBe(200);
});

afterEach(async () => {
  await app.close();
  await db.close();
  await new Promise<void>((resolve) => idp.close(() => resolve()));
});

function call(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}

async function signUp(email: string, name: string): Promise<string> {
  const res = await call("POST", null, "/practice/nit-practice/signup", { name, email, password: "a long enough password" });
  expect(res.statusCode, res.payload).toBe(201);
  expect(res.json().learner.emailVerified).toBe(false);
  return res.json().token as string;
}

async function publishSum(): Promise<{ id: string; slug: string }> {
  const bank = await call("POST", owner, "/bank", { question: SUM, difficulty: "easy", tags: ["arrays"] });
  expect(bank.statusCode, bank.payload).toBe(201);
  const res = await call("POST", author, "/practice-admin/problems", { bankQuestionId: bank.json().id });
  expect(res.statusCode, res.payload).toBe(201);
  return res.json();
}

const emails = () => mail.sent.filter((m): m is EmailMessage => "subject" in m);
const linkIn = (message: EmailMessage) => decodeURIComponent(/\?verify=([^\s"&]+)/.exec(message.text)![1]!);

describe("verifying a learner's email", () => {
  it("sends a link on sign-up, and the link marks the address verified", async () => {
    const token = await signUp("asha@example.com", "Asha");
    await worker.tick();
    const [message] = emails();
    expect(message!.to).toBe("asha@example.com");
    expect(message!.text).toContain("https://exam.test/practice/nit-practice?verify=");

    expect((await call("POST", null, "/practice/nit-practice/verify", { token: `${linkIn(message!)}x` })).statusCode).toBe(422);
    expect((await call("POST", null, "/practice/nit-practice/verify", { token: linkIn(message!) })).statusCode).toBe(200);
    expect((await call("GET", token, "/practice/nit-practice/me")).json()).toMatchObject({ emailVerified: true });

    // Verified: asking again sends nothing more.
    expect((await call("POST", token, "/practice/nit-practice/verify/resend")).statusCode).toBe(202);
    await worker.tick();
    expect(emails()).toHaveLength(1);
  });

  it("when the site requires it, keeps an unverified learner from submitting and commenting — not from reading", async () => {
    const { slug } = await publishSum();
    const put = await call("PUT", owner, "/practice-admin/sign-in", { requireVerified: true, google: { enabled: false, clientId: null } });
    expect(put.statusCode, put.payload).toBe(200);
    const token = await signUp("ravi@example.com", "Ravi");

    expect((await call("GET", token, `/practice/nit-practice/problems/${slug}`)).statusCode).toBe(200);
    const refused = await call("POST", token, `/practice/nit-practice/problems/${slug}/submit`, { answer: DIFFERENT, language: "python" });
    expect(refused.statusCode).toBe(403);
    expect(refused.json().error).toBe("email_not_verified");
    expect((await call("POST", token, `/practice/nit-practice/problems/${slug}/comments`, { body: "hi" })).statusCode).toBe(403);

    await worker.tick();
    await call("POST", null, "/practice/nit-practice/verify", { token: linkIn(emails()[0]!) });
    const accepted = await call("POST", token, `/practice/nit-practice/problems/${slug}/submit`, { answer: DIFFERENT, language: "python" });
    expect(accepted.statusCode, accepted.payload).toBe(200);
    expect(accepted.json().status).toBe("passed");
  }, 30_000);

  it("sends at most three links an hour", async () => {
    const token = await signUp("kiran@example.com", "Kiran");
    for (let i = 0; i < 5; i++) await call("POST", token, "/practice/nit-practice/verify/resend");
    await worker.tick();
    expect(emails()).toHaveLength(3);
  });
});

describe("signing in with Google", () => {
  const enableGoogle = async () => {
    const res = await call("PUT", owner, "/practice-admin/sign-in", {
      requireVerified: false,
      google: { enabled: true, clientId: "google-client.apps.googleusercontent.com", clientSecret: "google-secret" },
    });
    expect(res.statusCode, res.payload).toBe(200);
    expect(res.json()).toMatchObject({ google: { enabled: true, secretSet: true }, redirectUri: "https://exam.test/api/practice/nit-practice/auth/google/callback" });
    expect(res.payload).not.toContain("google-secret");
  };

  async function roundTrip(): Promise<string> {
    const start = await call("GET", null, "/practice/nit-practice/auth/google");
    expect(start.statusCode).toBe(302);
    const to = new URL(start.headers.location as string);
    expect(to.searchParams.get("redirect_uri")).toBe("https://exam.test/api/practice/nit-practice/auth/google/callback");
    nonce = to.searchParams.get("nonce")!;
    const back = await call("GET", null, `/practice/nit-practice/auth/google/callback?code=c&state=${encodeURIComponent(to.searchParams.get("state")!)}`);
    expect(back.statusCode).toBe(302);
    return back.headers.location as string;
  }

  it("is offered only once the site sets it up", async () => {
    expect((await call("GET", null, "/practice/nit-practice/sign-in-options")).json()).toEqual({ google: false, requireVerified: false });
    expect((await call("GET", null, "/practice/nit-practice/auth/google")).headers.location).toBe("/practice/nit-practice?signin_error=not_found");
    await enableGoogle();
    expect((await call("GET", null, "/practice/nit-practice/sign-in-options")).json()).toEqual({ google: true, requireVerified: false });
  });

  it("makes a verified account the first time, and signs the same one in after", async () => {
    await enableGoogle();
    const first = await roundTrip();
    expect(first).toMatch(/^\/practice\/nit-practice#session=pl_/);
    const token = decodeURIComponent(first.split("#session=")[1]!);
    expect((await call("GET", token, "/practice/nit-practice/me")).json()).toMatchObject({ name: "Meera Iyer", email: "meera@gmail.test", emailVerified: true });

    const again = decodeURIComponent((await roundTrip()).split("#session=")[1]!);
    expect((await call("GET", again, "/practice/nit-practice/me")).json().id).toBe((await call("GET", token, "/practice/nit-practice/me")).json().id);
    // No password was set, so none signs in.
    expect((await call("POST", null, "/practice/nit-practice/signin", { email: "meera@gmail.test", password: "!" })).statusCode).toBe(401);
  });

  it("verifies an existing account with the same address", async () => {
    const token = await signUp("meera@gmail.test", "Meera");
    await enableGoogle();
    await roundTrip();
    expect((await call("GET", token, "/practice/nit-practice/me")).json().emailVerified).toBe(true);
  });

  it("refuses an address Google does not vouch for", async () => {
    await enableGoogle();
    claims = { email: "someone@gmail.test", email_verified: false };
    expect(await roundTrip()).toBe("/practice/nit-practice?signin_error=sign_in_failed");
  });
});

describe("similar code between learners", () => {
  it("pairs a copied solution with its original, not with an honest one, for a reviewer only", async () => {
    const { id, slug } = await publishSum();
    for (const [email, name, source] of [
      ["a@example.com", "Asha", ORIGINAL],
      ["b@example.com", "Bilal", COPIED],
      ["c@example.com", "Chitra", DIFFERENT],
    ] as const) {
      const token = await signUp(email, name);
      const res = await call("POST", token, `/practice/nit-practice/problems/${slug}/submit`, { answer: source, language: "python" });
      expect(res.statusCode, res.payload).toBe(200);
    }

    expect((await call("GET", author, `/practice-admin/problems/${id}/similarity`)).statusCode).toBe(403);
    const report = await call("GET", reviewer, `/practice-admin/problems/${id}/similarity`);
    expect(report.statusCode, report.payload).toBe(200);
    const body = report.json();
    expect(body.compared).toBe(3);
    expect(body.pairs).toHaveLength(1);
    expect([body.pairs[0].a.name, body.pairs[0].b.name].sort()).toEqual(["Asha", "Bilal"]);
    expect(body.pairs[0].similarity).toBeGreaterThanOrEqual(0.7);
  }, 60_000);
});
