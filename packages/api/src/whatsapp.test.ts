import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, examId, orgId } from "@parikshaa/core";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, type SqlExecutor } from "@parikshaa/store";
import { CloudWhatsApp, DeliveryWorker, OutboxLog, PermanentFailure, ist, whatsAppText, type WhatsAppMessage, type WhatsAppSender } from "./delivery.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, TOKEN_SECRET, wire, type Wiring } from "./testing/harness.js";

/** WhatsApp reaches candidates as email does: the invitation, its reminders, a new time and the result. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
const CLOSES = Date.parse("2026-10-01T07:30:00Z");

let db: PGlite;
let sql: SqlExecutor;
let app: FastifyInstance;
let wiring: Wiring;
let clock: number;
let owner: string;
let log: OutboxLog;

const call = (method: "GET" | "POST" | "PUT", url: string, payload?: object, token = owner) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const messages = () => log.sent.filter((m): m is WhatsAppMessage => "template" in m);
const codes = new InviteCodes(TOKEN_SECRET);

const workerWith = (whatsapp: WhatsAppSender | null) =>
  new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: (org, id) => `${PUBLIC_URL}/?invite=${encodeURIComponent(codes.issue(org, id))}`,
    mailer: log,
    sms: null,
    whatsapp,
    result: (org, invitation) => wiring.results.candidateResult(orgId(org), attemptId(invitation.attemptId!), examId(invitation.examId)),
    now: () => clock,
  });

beforeEach(async () => {
  clock = OPENS - 2 * 24 * HOUR;
  db = await freshDatabase();
  sql = pgliteExecutor(db);
  log = new OutboxLog();
  wiring = await wire(sql, { client: {} as unknown as Anthropic, now: () => clock, mailer: log, whatsapp: true });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  await call("POST", "/exams", {
    id: "drive",
    title: "Campus drive",
    questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 2, rubric: [], options: ["a", "b"], correctIndex: 0 }],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99, cutoff: { percent: 50 } },
  });
  await call("PUT", "/exams/drive/window", { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(CLOSES).toISOString() });
  const imported = await call("POST", "/exams/drive/invitations/import", {
    csv: "ref,name,email,phone\nCS001,Ananya Iyer,ananya@college.test,9876543210\nCS002,Rohan Das,rohan@college.test,",
    dryRun: false,
    channels: ["email", "whatsapp"],
  });
  expect(imported.statusCode, imported.payload).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("WhatsApp", () => {
  it("sends the invitation template to a candidate with a mobile number, with a link that opens the test", async () => {
    await workerWith(log).tick();
    const sent = messages();
    expect(sent).toHaveLength(1);
    const [invite] = sent;
    expect(invite).toMatchObject({ to: "919876543210", template: "invite" });
    const [name, institution, title, opens, closes, link] = invite!.parameters;
    expect([name, institution, title]).toEqual(["Ananya Iyer", "Acme Engineering", "Campus drive"]);
    expect(opens).toBe(ist(new Date(OPENS).toISOString()));
    expect(closes).toBe(ist(new Date(CLOSES).toISOString()));

    const rows = (await call("GET", "/exams/drive/invitations")).json().invitations;
    expect(rows.find((r: { candidateRef: string }) => r.candidateRef === "CS001").delivery.whatsapp).toMatchObject({ status: "sent", purpose: "invite" });
    expect(rows.find((r: { candidateRef: string }) => r.candidateRef === "CS002").delivery.whatsapp).toBeNull();

    clock = OPENS + 60_000;
    const code = decodeURIComponent(link!.match(/\?invite=(\S+)/)![1]!);
    expect((await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code } })).statusCode).toBe(200);
  });

  it("reminds a day before and shortly before, in the reminder template", async () => {
    const worker = workerWith(log);
    await worker.tick();
    clock = OPENS - 24 * HOUR + 60_000;
    await worker.tick();
    clock = OPENS - HOUR + 60_000;
    await worker.tick();
    const reminders = messages().filter((m) => m.template === "reminder");
    expect(reminders.map((m) => m.parameters[3])).toEqual([`opens ${ist(new Date(OPENS).toISOString())}`, "opens in 59 minutes"]);
  });

  it("tells a candidate a new time", async () => {
    const worker = workerWith(log);
    await worker.tick();
    const later = OPENS + 24 * HOUR;
    await call("PUT", "/exams/drive/window", { opensAt: new Date(later).toISOString(), closesAt: new Date(later + 3 * HOUR).toISOString(), notify: true });
    await worker.tick();
    const moved = messages().find((m) => m.template === "rescheduled");
    expect(moved!.parameters.slice(0, 5)).toEqual(["Ananya Iyer", "Campus drive", "Acme Engineering", ist(new Date(later).toISOString()), ist(new Date(later + 3 * HOUR).toISOString())]);
  });

  it("is skipped, and says why, when the server has no WhatsApp", async () => {
    await workerWith(null).tick();
    expect(messages()).toEqual([]);
    const rows = (await call("GET", "/exams/drive/invitations")).json().invitations;
    expect(rows[0].delivery.whatsapp).toMatchObject({ status: "skipped", error: "WhatsApp is not configured" });
  });

  it("carries a candidate's result, counting them once however many ways it goes", async () => {
    clock = OPENS + 60_000;
    const worker = workerWith(log);
    for (const ref of ["CS001", "CS002"]) {
      const invitation = (await call("GET", "/exams/drive/invitations")).json().invitations.find((r: { candidateRef: string }) => r.candidateRef === ref);
      const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", invitation.id) } })).json();
      await call("POST", "/attempts/me/answers", { questionId: "q1", answer: "0" }, opened.token);
      await call("POST", "/attempts/me/submit", undefined, opened.token);
      expect((await call("POST", `/attempts/${opened.attemptId}/grade`)).statusCode).toBe(200);
    }
    await worker.tick();
    log.sent.length = 0;

    const preview = (await call("POST", "/exams/drive/results/release", { dryRun: true })).json();
    expect(preview).toEqual({ sent: 2, alreadySent: 0, notGraded: 0, unreachable: 0, channels: ["email", "whatsapp"] });
    await worker.tick();
    expect(log.sent).toEqual([]);

    expect((await call("POST", "/exams/drive/results/release", {})).json()).toMatchObject({ sent: 2, alreadySent: 0 });
    await worker.tick();
    const [result] = messages();
    expect(result).toMatchObject({ to: "919876543210", template: "result" });
    expect(result!.parameters.slice(0, 7)).toEqual(["Ananya Iyer", "Acme Engineering", "Campus drive", "2", "2", "100", "You reached the qualifying mark."]);
    expect(log.sent.filter((m) => "subject" in m)).toHaveLength(2);

    expect((await call("POST", "/exams/drive/results/release", { dryRun: true })).json()).toMatchObject({ sent: 0, alreadySent: 2 });
  });
});

describe("the WhatsApp Cloud API", () => {
  const serve = async (status: number, reply: object) => {
    let received: { url: string; headers: Record<string, unknown>; body: unknown } | null = null;
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received = { url: req.url!, headers: req.headers, body: JSON.parse(body) };
        res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(reply));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    return { base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v21.0`, received: () => received!, close: () => server.close() };
  };

  it("sends the approved template, in the configured language, with the values in order", async () => {
    const meta = await serve(200, { messages: [{ id: "wamid.1" }] });
    await new CloudWhatsApp("token-1", "1234", { baseUrl: meta.base, language: "en_US" }).send({
      to: "919876543210",
      template: "invite",
      parameters: ["Ananya", "Acme\nEngineering", ""],
    });
    meta.close();
    expect(meta.received().url).toBe("/v21.0/1234/messages");
    expect(meta.received().headers["authorization"]).toBe("Bearer token-1");
    expect(meta.received().body).toEqual({
      messaging_product: "whatsapp",
      to: "919876543210",
      type: "template",
      template: {
        name: "parikshaa_invite",
        language: { code: "en_US" },
        components: [{ type: "body", parameters: [{ type: "text", text: "Ananya" }, { type: "text", text: "Acme Engineering" }, { type: "text", text: "-" }] }],
      },
    });
  });

  it("treats a refused message as permanent, and an outage or a rate limit as passing", async () => {
    for (const [status, permanent] of [
      [400, true],
      [429, false],
      [503, false],
    ] as const) {
      const meta = await serve(status, { error: { message: "nope", code: 131026 } });
      const sent = new CloudWhatsApp("t", "1", { baseUrl: meta.base }).send({ to: "919876543210", template: "result", parameters: [] });
      if (permanent) await expect(sent).rejects.toThrow(new PermanentFailure("WhatsApp 400: nope (131026)"));
      else await expect(sent).rejects.not.toBeInstanceOf(PermanentFailure);
      meta.close();
    }
  });

  it("keeps template values to what WhatsApp accepts", () => {
    expect(whatsAppText("a\n\tb     c ")).toBe("a b c");
    expect(whatsAppText("  ")).toBe("-");
  });
});
