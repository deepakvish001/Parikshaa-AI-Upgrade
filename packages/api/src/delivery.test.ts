import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, Msg91Sender, OutboxLog, PermanentFailure, ist, type EmailMessage, type Mailer, type SmsMessage } from "./delivery.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** ROADMAP §5: invitations and reminders reach candidates, and only when they should. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
const CLOSES = Date.parse("2026-10-01T07:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let clock: number;
let owner: string;
let log: OutboxLog;
let worker: DeliveryWorker;
let mailer: Mailer;

beforeEach(async () => {
  clock = OPENS - 2 * 24 * HOUR;
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  let identity;
  ({ app, identity } = await wire(sql, { client: {} as unknown as Anthropic, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "Acme Engineering");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");

  await call("POST", "/exams", {
    id: "drive",
    title: "Campus drive",
    questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  await call("PUT", "/exams/drive/window", { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(CLOSES).toISOString() });
  const imported = await call("POST", "/exams/drive/invitations/import", {
    csv: "ref,name,email,phone\nCS001,Ananya Iyer,ananya@college.test,9876543210",
    dryRun: false,
  });
  expect(imported.statusCode).toBe(201);

  log = new OutboxLog();
  mailer = log;
  const codes = new InviteCodes(TOKEN_SECRET);
  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: (orgId, id) => `${PUBLIC_URL}/?invite=${encodeURIComponent(codes.issue(orgId, id))}`,
    mailer: { send: (m) => mailer.send(m) },
    sms: log,
    now: () => clock,
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(owner), ...(payload === undefined ? {} : { payload }) });

const emails = () => log.sent.filter((m): m is EmailMessage => "subject" in m);
const texts = () => log.sent.filter((m): m is SmsMessage => "variables" in m);

describe("the invitation", () => {
  it("goes out by email and SMS, with a link that opens the test", async () => {
    await worker.tick();

    const [email] = emails();
    expect(email).toMatchObject({ to: "ananya@college.test", subject: "Your Campus drive test — Acme Engineering" });
    expect(email!.text).toContain("Hello Ananya Iyer,");
    expect(email!.text).toContain(`Opens:  ${ist(new Date(OPENS).toISOString())}`);
    expect(email!.text).toMatch(/no webcam/);
    expect(email!.html).not.toMatch(/<script/i);

    const [sms] = texts();
    expect(sms).toMatchObject({ to: "919876543210" });
    expect(sms!.variables[0]).toBe("Campus drive");

    const link = email!.text.match(/https:\/\/exam\.test\/\?invite=(\S+)/)![1]!;
    clock = OPENS + 60_000;
    const opened = await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: decodeURIComponent(link) } });
    expect(opened.statusCode).toBe(200);
  });

  it("shows as sent against the candidate", async () => {
    await worker.tick();
    const [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    expect(invitation.delivery.email).toMatchObject({ status: "sent", purpose: "invite" });
    expect(invitation.delivery.sms).toMatchObject({ status: "sent", purpose: "invite" });
  });

  it("writes times in IST", () => {
    expect(ist("2026-10-01T04:30:00.000Z")).toMatch(/10:00\s?am IST$/i);
  });
});

describe("the reminder", () => {
  it("goes out an hour before the window opens", async () => {
    await worker.tick();
    log.sent.length = 0;

    clock = OPENS - HOUR - 60_000;
    await worker.tick();
    expect(log.sent).toHaveLength(0);

    clock = OPENS - HOUR + 1;
    await worker.tick();
    expect(emails()[0]!.subject).toMatch(/^Reminder: Campus drive opens/);
  });

  it("is not sent to a candidate who has already started", async () => {
    await worker.tick();
    const [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    // Opened early in a narrower window of their own is not possible, so move
    // the clock into the window, start, then let the reminder fall due.
    clock = OPENS + 1;
    const code = new InviteCodes(TOKEN_SECRET).issue("org-a", invitation.id);
    await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code } });
    log.sent.length = 0;

    await worker.tick();

    expect(log.sent).toHaveLength(0);
    const queued = await new OutboxStore(pgliteExecutor(db)).recent("org-a");
    expect(queued.filter((q) => q.purpose === "reminder").map((q) => q.status)).toEqual(["skipped", "skipped"]);
  });
});

describe("when sending fails", () => {
  it("retries a failure that might pass, later", async () => {
    let failures = 1;
    mailer = {
      send: async (m) => {
        if (failures-- > 0) throw new Error("421 try again later");
        await log.send(m);
      },
    };

    await worker.tick();
    expect(emails()).toHaveLength(0);

    clock += 2 * 60_000;
    await worker.tick();
    expect(emails()).toHaveLength(1);
  });

  it("stops at a failure that will not pass, and says why", async () => {
    mailer = {
      send: async () => {
        throw new PermanentFailure("SMTP 550: no such mailbox");
      },
    };
    await worker.tick();
    clock += 24 * HOUR;
    await worker.tick();

    const [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    expect(invitation.delivery.email).toMatchObject({ status: "failed", error: "SMTP 550: no such mailbox" });
  });

  it("sends nothing about a revoked invitation", async () => {
    const [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    await call("POST", `/invitations/${invitation.id}/revoke`);

    await worker.tick();

    expect(log.sent).toHaveLength(0);
  });
});

describe("MSG91", () => {
  it("sends the DLT template with the candidate's number and the values in order", async () => {
    let received: { headers: Record<string, unknown>; body: unknown } | null = null;
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received = { headers: req.headers, body: JSON.parse(body) };
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ type: "success", message: "ok" }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v5/flow`;

    await new Msg91Sender("auth-key", "tmpl-123", url).send({ to: "919876543210", variables: ["Drive", "1 Oct", "https://x"] });
    server.close();

    expect(received!.headers["authkey"]).toBe("auth-key");
    expect(received!.body).toEqual({
      template_id: "tmpl-123",
      short_url: "0",
      recipients: [{ mobiles: "919876543210", var1: "Drive", var2: "1 Oct", var3: "https://x" }],
    });
  });

  it("treats a refused template as permanent, and an outage as passing", async () => {
    for (const [status, permanent] of [
      [400, true],
      [503, false],
    ] as const) {
      const server = createServer((_req, res) => res.writeHead(status).end(JSON.stringify({ type: "error", message: "nope" })));
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
      const sent = new Msg91Sender("k", "t", url).send({ to: "919876543210", variables: [] });
      if (permanent) await expect(sent).rejects.toBeInstanceOf(PermanentFailure);
      else await expect(sent).rejects.not.toBeInstanceOf(PermanentFailure);
      server.close();
    }
  });
});
