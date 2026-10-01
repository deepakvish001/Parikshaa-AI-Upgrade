import { createHmac } from "node:crypto";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog } from "./delivery.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, TOKEN_SECRET, wire, type Wiring } from "./testing/harness.js";

/**
 * ROADMAP §7: Lever, Zoho Recruit and Darwinbox, end to end — a hook from the
 * ATS invites the candidate, and once graded the result goes back through the
 * outbox to a stand-in for each vendor's API on 127.0.0.1.
 */

const HOUR = 3_600_000;

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
let mail: OutboxLog;
let vendor: Server;
let base: string;
let received: Received[];
let handlers: Wiring["handlers"];

beforeEach(async () => {
  // Ahead of the real clock: the ledger writes its webhook items at the real time, and the worker sends what is due by this one.
  clock = Date.parse("2036-10-01T04:30:00Z");
  received = [];
  vendor = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push({ method: req.method!, url: req.url!, headers: req.headers, body });
      res.setHeader("content-type", "application/json");
      if (req.url === "/v1/opportunities/opp-42" && req.method === "GET") {
        return res.end(JSON.stringify({ data: { id: "opp-42", name: "Ananya  Iyer", emails: ["ananya@example.test"], phones: [{ value: "+91 98765 43210" }] } }));
      }
      if (req.url === "/v1/stages" && req.method === "GET") {
        const good = req.headers.authorization === `Basic ${Buffer.from("lever-api-key:").toString("base64")}`;
        res.statusCode = good ? 200 : 401;
        return res.end(JSON.stringify(good ? { data: [{ id: "lead", text: "Lead" }, { id: "stage-assess", text: "Assessment" }] } : { code: "Unauthorized" }));
      }
      if (req.url === "/darwinbox/locked") {
        res.statusCode = 403;
        return res.end("{}");
      }
      if (req.url === "/oauth/v2/token") {
        const form = new URLSearchParams(body);
        return res.end(JSON.stringify(form.get("refresh_token") === "1000.refresh" ? { access_token: "1000.access", expires_in: 3600 } : { error: "invalid_code" }));
      }
      res.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise<void>((resolve) => vendor.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(vendor.address() as AddressInfo).port}`;

  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  let identity;
  ({ app, identity, handlers } = await wire(sql, {
    client: {} as unknown as Anthropic,
    now: () => clock,
    http: { allowPrivate: true, timeoutMs: 2000 },
    atsBases: { lever: base, zoho: base },
  }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await addStaff(identity, org, "author@acme.test", "author");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  const exam = await call("POST", owner, "/exams", {
    id: "drive",
    title: "Backend engineer",
    questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 4, rubric: [], options: ["a", "b"], correctIndex: 0 }],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  expect(exam.statusCode).toBe(201);

  mail = new OutboxLog();
  const codes = new InviteCodes(TOKEN_SECRET);
  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: (orgId, id) => `${PUBLIC_URL}/?invite=${encodeURIComponent(codes.issue(orgId, id))}`,
    mailer: mail,
    sms: mail,
    handlers,
    now: () => clock,
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
  await new Promise((r) => vendor.close(r));
});

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: unknown) =>
  app.inject({ method, url, headers: token === null ? {} : bearer(token), ...(payload === undefined ? {} : { payload: payload as object }) });

async function drain() {
  for (let i = 0; i < 6; i++) if ((await worker.tick()) === 0) return;
}

async function connect(provider: string, settings: object, credentials: object): Promise<string> {
  const saved = await call("PUT", owner, `/integrations/ats/${provider}`, { settings, credentials });
  expect(saved.statusCode, saved.payload).toBe(200);
  expect(saved.payload).not.toContain(JSON.stringify(credentials).slice(2, 12));
  const issued = await call("POST", owner, `/integrations/ats/${provider}/key`);
  expect(issued.statusCode).toBe(200);
  const { hookUrl } = issued.json() as { hookUrl: string };
  expect(hookUrl.startsWith(`${PUBLIC_URL}/api/integrations/ats/${provider}/hook/atk.org-a.${provider}.`)).toBe(true);
  return hookUrl.replace(`${PUBLIC_URL}/api`, "");
}

/** Open the candidate's link, answer, submit, and have the owner grade it. */
async function sitAndGrade(invitationId: string) {
  const { token, attemptId } = (await call("POST", null, "/invitations/redeem", { code: new InviteCodes(TOKEN_SECRET).issue("org-a", invitationId) })).json();
  await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" });
  await call("POST", token, "/attempts/me/submit");
  await call("POST", owner, `/attempts/${attemptId}/grade`);
  await drain();
  return attemptId as string;
}

const leverHook = (token: string, stage: string, signatureToken = "lever-signing") => {
  const triggeredAt = 1_727_000_000_000;
  return {
    event: "candidateStageChange",
    token,
    triggeredAt,
    signature: createHmac("sha256", signatureToken).update(`${token}${triggeredAt}`).digest("hex"),
    data: { opportunityId: "opp-42", toStageId: stage, fromStageId: "lead", candidateId: "cand-7" },
  };
};

describe("Lever", () => {
  const setUp = () => connect("lever", { stageExams: { "stage-assess": "drive" } }, { apiKey: "lever-api-key", signatureToken: "lever-signing" });

  it("invites the candidate a mapped stage sends, once, with details from the opportunity", async () => {
    const hook = await setUp();
    const first = await call("POST", null, hook, leverHook("t1", "stage-assess"));
    expect(first.statusCode, first.payload).toBe(202);
    const again = await call("POST", null, hook, leverHook("t2", "stage-assess"));
    expect(again.json()).toEqual(first.json());

    const [invitation] = (await call("GET", owner, "/exams/drive/invitations")).json().invitations;
    expect(invitation).toMatchObject({ candidateRef: "LV-opp-42", name: "Ananya Iyer", email: "ananya@example.test", phone: "919876543210" });
    const lookup = received.find((r) => r.method === "GET")!;
    expect(lookup.headers.authorization).toBe(`Basic ${Buffer.from("lever-api-key:").toString("base64")}`);
  });

  it("ignores other stages, and refuses a bad signature or a key it did not issue", async () => {
    const hook = await setUp();
    expect((await call("POST", null, hook, leverHook("t1", "stage-offer"))).json()).toEqual({ ignored: "No exam for that stage" });
    expect((await call("POST", null, hook, leverHook("t1", "stage-assess", "forged"))).statusCode).toBe(401);
    expect((await call("POST", null, `${hook}x`, leverHook("t1", "stage-assess"))).statusCode).toBe(401);
    // A key for Lever is not a key for Darwinbox.
    expect((await call("POST", null, hook.replace("/ats/lever/", "/ats/darwinbox/"), {})).statusCode).toBe(401);
  });

  it("leaves a note on the opportunity with the marks and the report, once graded", async () => {
    const hook = await setUp();
    const { invitationId } = (await call("POST", null, hook, leverHook("t1", "stage-assess"))).json();
    const attemptId = await sitAndGrade(invitationId);
    const note = received.find((r) => r.method === "POST" && r.url === "/v1/opportunities/opp-42/notes")!;
    expect(note).toBeDefined();
    const value = JSON.parse(note.body).value as string;
    expect(value).toContain("Backend engineer: 4 / 4 (100%)");
    expect(value).toContain(`${PUBLIC_URL}/console/?report=${attemptId}`);
  });

  it("stops working when a new key is issued or the connector is switched off", async () => {
    const hook = await setUp();
    const next = (await call("POST", owner, "/integrations/ats/lever/key")).json().hookUrl.replace(`${PUBLIC_URL}/api`, "");
    expect((await call("POST", null, hook, leverHook("t1", "stage-assess"))).statusCode).toBe(401);
    expect((await call("POST", null, next, leverHook("t1", "stage-assess"))).statusCode).toBe(202);
    await call("POST", owner, "/integrations/ats/lever/disable");
    expect((await call("POST", null, next, leverHook("t1", "stage-assess"))).statusCode).toBe(401);
  });
});

describe("Zoho Recruit", () => {
  it("invites from a workflow webhook and notes the result on the candidate, with a fresh access token", async () => {
    const hook = await connect(
      "zoho_recruit",
      { dataCentre: "in", defaultExamId: "drive" },
      { clientId: "1000.client", clientSecret: "zoho-secret", refreshToken: "1000.refresh" },
    );
    const res = await call("POST", null, hook, { candidateId: 58300000123, email: "ravi@example.test", firstName: "Ravi", lastName: "Kumar", mobile: "9876500000" });
    expect(res.statusCode, res.payload).toBe(202);
    await sitAndGrade(res.json().invitationId);

    const token = received.find((r) => r.url === "/oauth/v2/token")!;
    expect(new URLSearchParams(token.body).get("grant_type")).toBe("refresh_token");
    const note = received.find((r) => r.url === "/recruit/v2/Notes")!;
    expect(note.headers.authorization).toBe("Zoho-oauthtoken 1000.access");
    expect(JSON.parse(note.body).data[0]).toMatchObject({ Parent_Id: "58300000123", se_module: "Candidates", Note_Title: "Parikshaa: Backend engineer" });
  });

  it("refuses settings it cannot use", async () => {
    const res = await call("PUT", owner, "/integrations/ats/zoho_recruit", { settings: { dataCentre: "mars", defaultExamId: null }, credentials: { clientId: "a", clientSecret: "b", refreshToken: "c" } });
    expect(res.statusCode).toBe(422);
    const noSecrets = await call("PUT", owner, "/integrations/ats/zoho_recruit", { settings: { dataCentre: "in", defaultExamId: null } });
    expect(noSecrets.statusCode).toBe(422);
  });
});

describe("Darwinbox", () => {
  it("invites from its call, and posts the result to its callback with its token", async () => {
    const hook = await connect("darwinbox", { callbackUrl: `${base}/darwinbox/assessment-result`, defaultExamId: null }, { callbackToken: "db-token" });
    expect((await call("POST", null, hook, { candidate_id: "DB-1" })).json()).toEqual({ ignored: "No test_id, and no default set" });
    const res = await call("POST", null, hook, { candidate_id: 991, job_id: 12, name: "Meera Nair", email: "meera@example.test", test_id: "drive" });
    expect(res.statusCode, res.payload).toBe(202);
    const attemptId = await sitAndGrade(res.json().invitationId);

    const callback = received.find((r) => r.url === "/darwinbox/assessment-result")!;
    expect(callback.headers.authorization).toBe("Bearer db-token");
    expect(JSON.parse(callback.body)).toMatchObject({
      candidate_id: "991",
      job_id: "12",
      status: "completed",
      score: 4,
      max_score: 4,
      report_url: `${PUBLIC_URL}/console/?report=${attemptId}`,
    });
  });

  it("is set up only by an owner, and never shows the stored credentials", async () => {
    const author = await signIn(app, "author@acme.test");
    expect((await call("GET", author, "/integrations/ats")).statusCode).toBe(403);
    await connect("darwinbox", { callbackUrl: `${base}/cb`, defaultExamId: "drive" }, { callbackToken: "never-shown" });
    const list = await call("GET", owner, "/integrations/ats");
    expect(list.payload).not.toContain("never-shown");
    expect(list.json().connectors.find((c: { provider: string }) => c.provider === "darwinbox")).toMatchObject({ enabled: true, credentialsSet: true });
  });
});

describe("testing a connection", () => {
  const check = (provider: string) => call("POST", owner, `/integrations/ats/${provider}/check`);

  it("proves Lever's key against the account, and that the mapped stages exist", async () => {
    await connect("lever", { stageExams: { "stage-assess": "drive" } }, { apiKey: "lever-api-key", signatureToken: "s" });
    expect((await check("lever")).json()).toEqual({ ok: true, detail: "The API key works; 2 stages in the account, and 1 mapped to exams all exist" });

    await connect("lever", { stageExams: { "stage-gone": "drive" } }, { apiKey: "lever-api-key", signatureToken: "s" });
    expect((await check("lever")).json()).toMatchObject({ ok: false, detail: expect.stringContaining("not in this Lever account: stage-gone") });

    await connect("lever", { stageExams: { "stage-assess": "drive" } }, { apiKey: "wrong", signatureToken: "s" });
    expect((await check("lever")).json()).toMatchObject({ ok: false, detail: expect.stringContaining("Lever refused the credentials (401)") });
  });

  it("proves Zoho's refresh token, and names the data centre when it is refused", async () => {
    await connect("zoho_recruit", { dataCentre: "in", defaultExamId: "drive" }, { clientId: "c", clientSecret: "s", refreshToken: "1000.refresh" });
    expect((await check("zoho_recruit")).json()).toEqual({ ok: true, detail: "Zoho (zoho.in) accepted the client and the refresh token" });
    await connect("zoho_recruit", { dataCentre: "in", defaultExamId: "drive" }, { clientId: "c", clientSecret: "s", refreshToken: "stale" });
    expect((await check("zoho_recruit")).json()).toMatchObject({ ok: false, detail: expect.stringContaining("Zoho refused the refresh token (invalid_code)") });
  });

  it("asks Darwinbox's callback whether it answers, posting nothing", async () => {
    await connect("darwinbox", { callbackUrl: `${base}/darwinbox/assessment-result`, defaultExamId: null }, { callbackToken: "db-token" });
    received.length = 0;
    expect((await check("darwinbox")).json()).toMatchObject({ ok: true });
    expect(received.map((r) => r.method)).toEqual(["GET"]);
    await connect("darwinbox", { callbackUrl: `${base}/darwinbox/locked`, defaultExamId: null }, { callbackToken: "db-token" });
    expect((await check("darwinbox")).json()).toMatchObject({ ok: false, detail: expect.stringContaining("refused the credentials (403)") });
  });

  it("is the owner's, needs a connector first, and is recorded", async () => {
    expect((await check("lever")).statusCode).toBe(404);
    const author = await signIn(app, "author@acme.test");
    expect((await call("POST", author, "/integrations/ats/lever/check")).statusCode).toBe(403);
    await connect("lever", { stageExams: {} }, { apiKey: "lever-api-key", signatureToken: "s" });
    await check("lever");
    expect(JSON.stringify((await call("GET", owner, "/audit")).json())).toContain("ats.checked");
  });
});
