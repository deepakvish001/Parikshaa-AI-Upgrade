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
 * ROADMAP §7: signed webhooks, and Greenhouse's assessment partner API, end
 * to end — through the outbox and the worker to a real HTTP server. Runs as
 * `parikshaa_app`. The server here is on 127.0.0.1, which the production
 * guard refuses (see safe-http.test.ts); these tests let it through.
 */

const HOUR = 3_600_000;
// Ahead of the real clock: the ledger writes its webhook items at the real time, and the worker sends what is due by this one.
const START = Date.parse("2036-10-01T04:30:00Z");

interface Received {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let clock: number;
let owner: string;
let worker: DeliveryWorker;
let mail: OutboxLog;
let receiver: Server;
let base: string;
let received: Received[];
let answer: (r: Received) => number;
let handlers: Wiring["handlers"];

beforeEach(async () => {
  clock = START;
  received = [];
  answer = () => 200;
  receiver = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const r = { method: req.method!, url: req.url!, headers: req.headers, body };
      received.push(r);
      res.writeHead(answer(r)).end();
    });
  });
  await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`;

  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  ({ app, identity, handlers } = await wire(sql, {
    client: {} as unknown as Anthropic,
    now: () => clock,
    http: { allowPrivate: true, timeoutMs: 2000 },
    greenhouseHosts: ["127.0.0.1"],
  }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  expect(
    (
      await call("POST", owner, "/exams", {
        id: "drive",
        title: "Backend engineer",
        questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 4, rubric: [], options: ["a", "b"], correctIndex: 0 }],
        policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
      })
    ).statusCode,
  ).toBe(201);

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
  await new Promise((r) => receiver.close(r));
});

const call = (method: "GET" | "POST", token: string | null, url: string, payload?: object, headers: Record<string, string> = {}) =>
  app.inject({
    method,
    url,
    headers: { ...(token === null ? {} : bearer(token)), ...headers },
    ...(payload === undefined ? {} : { payload }),
  });

/** Let the worker run until nothing is due: an announcement, then its deliveries. */
async function drain() {
  for (let i = 0; i < 5; i++) if ((await worker.tick()) === 0) return;
}

/** Sit and grade one attempt started from the console. */
async function sitAndGrade(answerIndex: string) {
  const { attemptId, token } = (await call("POST", owner, "/exams/drive/attempts", { candidateId: "cand-1" })).json();
  await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: answerIndex });
  clock += 20 * 60_000;
  await call("POST", token, "/attempts/me/submit");
  await call("POST", owner, `/attempts/${attemptId}/grade`);
  return attemptId as string;
}

/** Verify a delivery the way a receiver using a Standard Webhooks library would. */
function verifies(r: Received, secret: string): boolean {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${r.headers["webhook-id"]}.${r.headers["webhook-timestamp"]}.${r.body}`;
  const expected = `v1,${createHmac("sha256", key).update(signed).digest("base64")}`;
  return String(r.headers["webhook-signature"]).split(" ").includes(expected);
}

describe("webhooks", () => {
  const register = async (events: string[] = []) => {
    const res = await call("POST", owner, "/webhooks", { url: `${base}/hook`, events, description: "ATS" });
    expect(res.statusCode, res.payload).toBe(201);
    return res.json() as { webhook: { id: string }; secret: string };
  };

  it("tells a receiver of each start, submission and grade, signed, with the result", async () => {
    const { secret } = await register();

    const attemptId = await sitAndGrade("0");
    await drain();

    const events = received.map((r) => JSON.parse(r.body).type);
    expect(events.sort()).toEqual(["attempt.graded", "attempt.started", "attempt.submitted"]);
    for (const r of received) expect(verifies(r, secret), r.body).toBe(true);
    const graded = JSON.parse(received.find((r) => r.body.includes("attempt.graded"))!.body);
    expect(graded.data).toMatchObject({
      attemptId,
      examId: "drive",
      examTitle: "Backend engineer",
      candidate: { id: "cand-1", ref: "cand-1" },
      state: "graded",
      total: 4,
      maxTotal: 4,
      percent: 100,
      reportUrl: `${PUBLIC_URL}/console/?report=${attemptId}`,
    });
  });

  it("sends only the events a hook asked for", async () => {
    await register(["attempt.graded"]);
    await sitAndGrade("1");
    await drain();
    expect(received.map((r) => JSON.parse(r.body).type)).toEqual(["attempt.graded"]);
  });

  it("retries a receiver that is down, under the same id, and logs each try", async () => {
    const { webhook } = await register(["attempt.graded"]);
    answer = () => 503;
    await sitAndGrade("0");
    await drain();

    const log = (await call("GET", owner, `/webhooks/${webhook.id}/deliveries`)).json().deliveries;
    expect(log).toEqual([expect.objectContaining({ event: "attempt.graded", status: "pending", attempts: 1, error: "HTTP 503" })]);

    answer = () => 204;
    clock += 2 * 60_000;
    await drain();

    expect(received).toHaveLength(2);
    expect(received[1]!.headers["webhook-id"]).toBe(received[0]!.headers["webhook-id"]);
    const after = (await call("GET", owner, `/webhooks/${webhook.id}/deliveries`)).json().deliveries;
    expect(after[0]).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("sends nothing twice when an announcement is handled twice", async () => {
    await register(["attempt.started"]);
    await call("POST", owner, "/exams/drive/attempts", { candidateId: "cand-1" });
    // The worker dies after fanning out but before recording it: the lease runs out and another worker fans out again.
    const outbox = new OutboxStore(pgliteExecutor(db));
    const [announcement] = await outbox.claimDue(new Date(clock), 10);
    await worker.tick(); // nothing due: the announcement is leased
    await handlers.webhook(announcement!);
    await handlers.webhook(announcement!);
    await drain();
    expect(received).toHaveLength(1);
  });

  it("rotates a secret: deliveries after it verify only with the new one", async () => {
    const { webhook, secret } = await register(["attempt.started"]);
    const rotated = (await call("POST", owner, `/webhooks/${webhook.id}/rotate`)).json();
    expect(rotated.secret).not.toBe(secret);
    expect((await call("GET", owner, `/webhooks/${webhook.id}/secret`)).json().secret).toBe(rotated.secret);

    await call("POST", owner, "/exams/drive/attempts", { candidateId: "cand-1" });
    await drain();

    expect(verifies(received[0]!, rotated.secret)).toBe(true);
    expect(verifies(received[0]!, secret)).toBe(false);
  });

  it("sends a test delivery on request, and nothing once disabled", async () => {
    const { webhook, secret } = await register();
    expect((await call("POST", owner, `/webhooks/${webhook.id}/test`)).statusCode).toBe(202);
    await drain();
    expect(JSON.parse(received[0]!.body).type).toBe("webhook.test");
    expect(verifies(received[0]!, secret)).toBe(true);

    await call("POST", owner, `/webhooks/${webhook.id}/disable`);
    await sitAndGrade("0");
    await drain();
    expect(received).toHaveLength(1);
  });

  it("is managed by the owner alone, and kept within the organisation", async () => {
    const { webhook } = await register();
    await addStaff(identity, "org-a" as never, "author@acme.test", "author");
    const author = await signIn(app, "author@acme.test");
    expect((await call("GET", author, "/webhooks")).statusCode).toBe(403);
    expect((await call("POST", author, "/webhooks", { url: `${base}/x` })).statusCode).toBe(403);

    const other = await addOrganisation(identity, "org-b", "Other");
    await addStaff(identity, other, "owner@other.test", "owner");
    const outsider = await signIn(app, "owner@other.test");
    expect((await call("GET", outsider, "/webhooks")).json().webhooks).toEqual([]);
    expect((await call("GET", outsider, `/webhooks/${webhook.id}/secret`)).statusCode).toBe(404);

    const actions = (await call("GET", owner, "/audit")).json().entries.map((e: { action: string }) => e.action);
    expect(actions).toContain("webhook.created");
  });

  it("refuses a URL that is not http(s) at all", async () => {
    const res = await call("POST", owner, "/webhooks", { url: "file:///etc/passwd" });
    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("unsafe_url");
  });
});

describe("Greenhouse", () => {
  let key: string;
  const basic = (k: string) => ({ authorization: `Basic ${Buffer.from(`${k}:`).toString("base64")}` });
  const gh = (method: "GET" | "POST", path: string, payload?: object, k = key) =>
    call(method, null, `/integrations/greenhouse/${path}`, payload, basic(k));
  const sendTest = (applicationId: number, url = `${base}/take_home_tests/${applicationId}`) =>
    gh("POST", "send_test", {
      partner_test_id: "drive",
      candidate: {
        first_name: "Ananya",
        last_name: "Iyer",
        preferred_name: "Ananya",
        email: "ananya@example.test",
        phone_number: "+91 98765 43210",
        greenhouse_profile_url: "https://app.greenhouse.io/people/1?application_id=2",
        id: 4000024002,
      },
      application: { id: applicationId },
      sent_by: "recruiter@acme.test",
      url,
    });

  beforeEach(async () => {
    const issued = await call("POST", owner, "/integrations/greenhouse/key");
    expect(issued.statusCode).toBe(200);
    key = issued.json().key;
    expect(issued.json().endpoints.send_test).toBe(`${PUBLIC_URL}/api/integrations/greenhouse/send_test`);
  });

  it("throttles a wrong key without locking out a right one from the same address", async () => {
    for (let i = 0; i < 12; i++) await gh("GET", "list_tests", undefined, `${key}x`);
    expect((await gh("GET", "list_tests", undefined, `${key}x`)).statusCode).toBe(429);
    expect((await gh("GET", "list_tests")).statusCode).toBe(200);
  });

  it("lists the organisation's exams as tests", async () => {
    const res = await gh("GET", "list_tests");
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ partner_test_id: "drive", partner_test_name: "Backend engineer" }]);
  });

  it("refuses a missing, wrong, replaced or switched-off key", async () => {
    expect((await call("GET", null, "/integrations/greenhouse/list_tests")).statusCode).toBe(401);
    expect((await gh("GET", "list_tests", undefined, `${key}x`)).statusCode).toBe(401);

    const old = key;
    key = (await call("POST", owner, "/integrations/greenhouse/key")).json().key;
    expect((await gh("GET", "list_tests", undefined, old)).statusCode).toBe(401);
    expect((await gh("GET", "list_tests")).statusCode).toBe(200);

    await call("POST", owner, "/integrations/greenhouse/disable");
    expect((await gh("GET", "list_tests")).statusCode).toBe(401);
  });

  it("invites the candidate from send_test, once however often it is sent", async () => {
    const first = await sendTest(4000027002);
    expect(first.statusCode, first.payload).toBe(200);
    const again = await sendTest(4000027002);
    expect(again.json()).toEqual(first.json());

    const [invitation] = (await call("GET", owner, "/exams/drive/invitations")).json().invitations;
    expect(invitation).toMatchObject({ id: first.json().partner_interview_id, candidateRef: "GH-4000027002", name: "Ananya Iyer", phone: "919876543210" });

    await drain();
    expect(mail.sent.find((m) => "subject" in m)).toMatchObject({ to: "ananya@example.test" });
  });

  it("reports progress, tells Greenhouse when the test is done, and gives the score", async () => {
    const id = (await sendTest(7)).json().partner_interview_id;
    expect((await gh("GET", `test_status?partner_interview_id=${id}`)).json()).toEqual({ partner_status: "sent" });

    const { token, attemptId } = (
      await call("POST", null, "/invitations/redeem", { code: new InviteCodes(TOKEN_SECRET).issue("org-a", id) })
    ).json();
    expect((await gh("GET", `test_status?partner_interview_id=${id}`)).json()).toEqual({ partner_status: "in_progress" });
    await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" });
    await call("POST", token, "/attempts/me/submit");
    expect((await gh("GET", `test_status?partner_interview_id=${id}`)).json()).toEqual({ partner_status: "awaiting_grading" });

    await drain();
    expect(received.filter((r) => r.method === "PATCH")).toEqual([]);
    await call("POST", owner, `/attempts/${attemptId}/grade`);
    await drain();

    const patch = received.find((r) => r.method === "PATCH")!;
    expect(patch.url).toBe("/take_home_tests/7");
    expect(patch.headers.authorization).toBe(basic(key).authorization);
    expect(patch.body).toBe("");

    const status = (await gh("GET", `test_status?partner_interview_id=${id}`)).json();
    expect(status).toMatchObject({
      partner_status: "complete",
      partner_score: 100,
      partner_profile_url: `${PUBLIC_URL}/console/?report=${attemptId}`,
      metadata: { Marks: "4 / 4" },
    });
    expect(JSON.stringify(status)).not.toMatch(/consistent|shallow|verdict/);
  });

  it("will not send the completion call anywhere but Greenhouse", async () => {
    const id = (await sendTest(8, "http://evil.test/take_home_tests/8")).json().partner_interview_id;
    const { token, attemptId } = (
      await call("POST", null, "/invitations/redeem", { code: new InviteCodes(TOKEN_SECRET).issue("org-a", id) })
    ).json();
    await call("POST", token, "/attempts/me/submit");
    await call("POST", owner, `/attempts/${attemptId}/grade`);
    await drain();

    const failed = (await new OutboxStore(pgliteExecutor(db)).recent("org-a")).find((r) => r.kind === "greenhouse");
    expect(failed).toMatchObject({ status: "failed", error: "evil.test is not a Greenhouse address" });
  });

  it("does not show one organisation's tests to another's key", async () => {
    const id = (await sendTest(9)).json().partner_interview_id;
    const other = await addOrganisation(identity, "org-b", "Other");
    await addStaff(identity, other, "owner@other.test", "owner");
    const outsider = await signIn(app, "owner@other.test");
    const otherKey = (await call("POST", outsider, "/integrations/greenhouse/key")).json().key;

    expect((await gh("GET", `test_status?partner_interview_id=${id}`, undefined, otherKey)).statusCode).toBe(404);
    expect((await gh("GET", "list_tests", undefined, otherKey)).json()).toEqual([]);
  });

  it("records Greenhouse's error reports in the audit log, without the candidate's email", async () => {
    const res = await gh("POST", "response_error", {
      api_call: "test_status",
      errors: ["partner_profile_url is missing"],
      partner_interview_id: "299506",
      candidate_email: "hpotter@hogwarts.edu",
    });
    expect(res.json()).toEqual({ status: 200 });
    const entries = (await call("GET", owner, "/audit")).json().entries;
    const entry = entries.find((e: { action: string }) => e.action === "greenhouse.response_error");
    expect(entry).toMatchObject({ target: "299506" });
    expect(JSON.stringify(entries)).not.toContain("hogwarts");
  });

  it("is set up by the owner alone", async () => {
    await addStaff(identity, "org-a" as never, "author@acme.test", "author");
    const author = await signIn(app, "author@acme.test");
    expect((await call("POST", author, "/integrations/greenhouse/key")).statusCode).toBe(403);
  });
});
