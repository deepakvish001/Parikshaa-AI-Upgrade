import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { enqueue, IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
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

describe("the reminders", () => {
  it("go out a day before the window opens, and again an hour before", async () => {
    await worker.tick();
    log.sent.length = 0;

    clock = OPENS - 24 * HOUR - 60_000;
    await worker.tick();
    expect(log.sent).toHaveLength(0);

    clock = OPENS - 24 * HOUR + 1;
    await worker.tick();
    const [day] = emails();
    expect(day!.subject).toBe(`Reminder: Campus drive opens ${ist(new Date(OPENS).toISOString())}`);
    expect(day!.text).toContain(`A reminder: your Campus drive test with Acme Engineering opens ${ist(new Date(OPENS).toISOString())}.`);
    expect(day!.text).toMatch(/Before it opens: charge your phone or laptop, find a quiet place with a steady connection, and keep this email/);
    expect(texts()).toHaveLength(1);
    log.sent.length = 0;

    clock = OPENS - HOUR - 60_000;
    await worker.tick();
    expect(log.sent).toHaveLength(0);

    clock = OPENS - HOUR + 1;
    await worker.tick();
    expect(emails()[0]!.subject).toMatch(/^Reminder: Campus drive opens/);
    expect(emails()[0]!.text).toContain("opens in 60 minutes.");
  });

  it("say the test is open now when one goes out late", async () => {
    await worker.tick();
    log.sent.length = 0;
    clock = OPENS + 5 * 60_000;
    await worker.tick();
    // The day's reminder, held up this long, gives way to the hour's.
    expect(emails().map((e) => e.subject)).toEqual(["Reminder: Campus drive is open now"]);
    expect(emails()[0]!.text).toContain("A reminder: your Campus drive test with Acme Engineering is open now.");
  });

  it("are not sent to a candidate who has already started", async () => {
    await worker.tick();
    const [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    // Opened early in a narrower window of their own is not possible, so move
    // the clock into the window, start, then let the reminders fall due.
    clock = OPENS + 1;
    const code = new InviteCodes(TOKEN_SECRET).issue("org-a", invitation.id);
    await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code } });
    log.sent.length = 0;

    await worker.tick();

    expect(log.sent).toHaveLength(0);
    const queued = await new OutboxStore(pgliteExecutor(db)).recent("org-a");
    expect(queued.filter((q) => q.purpose.startsWith("reminder")).map((q) => q.status)).toEqual(["skipped", "skipped", "skipped", "skipped"]);
    // Not needed is not a failure: the candidate still shows their invitation as sent.
    const [after] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    expect(after.delivery.email).toMatchObject({ status: "sent", purpose: "invite" });
  });

  it("show against the candidate once sent, and not before", async () => {
    await worker.tick();
    clock = OPENS - 24 * HOUR - 60_000;
    let [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    // The day's reminder is queued, but the invitation is what has happened.
    expect(invitation.delivery.email).toMatchObject({ status: "sent", purpose: "invite" });

    clock = OPENS - 24 * HOUR + 1;
    await worker.tick();
    [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    expect(invitation.delivery.email).toMatchObject({ status: "sent", purpose: "reminder_day" });
  });
});

describe("what the email says about the test", () => {
  it("gives its length, and says it uses no camera", async () => {
    await worker.tick();
    const [email] = emails();
    expect(email!.text).toContain("Once you begin, you have 60 minutes.");
    expect(email!.text).toContain("The test uses no webcam, no screen capture and no keystroke monitoring.");
    expect(email!.text).not.toMatch(/Before it opens/);
  });

  it("tells a proctored exam's candidates what the camera does, and to bring their ID", async () => {
    await call("POST", "/exams", {
      id: "proctored",
      title: "Proctored drive",
      questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
      policy: {
        durationMs: 90 * 60_000,
        allowRevision: true,
        vivaTriggerRatio: 0.99,
        proctoring: { identity: true, snapshotEverySeconds: 120, browserEvents: true },
      },
    });
    await call("PUT", "/exams/proctored/window", { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(CLOSES).toISOString() });
    await call("POST", "/exams/proctored/invitations/import", { csv: "ref,name,email\nCS009,Ravi Kumar,ravi@college.test", dryRun: false, channels: ["email"] });
    await worker.tick();

    const invite = emails().find((e) => e.to === "ravi@college.test")!;
    expect(invite.text).toContain("Once you begin, you have 90 minutes.");
    expect(invite.text).toContain(
      "This test uses your camera: a photo of you and of your photo ID before you begin, and a photo from your camera every 2 minutes while you work.",
    );
    expect(invite.text).toContain("It notes if you leave the test's tab or full screen, or copy or paste");
    expect(invite.text).not.toMatch(/no webcam/);

    log.sent.length = 0;
    clock = OPENS - 24 * HOUR + 1;
    await worker.tick();
    const reminder = emails().find((e) => e.to === "ravi@college.test")!;
    expect(reminder.text).toContain("keep your photo ID to hand");
  });
});

describe("rescheduling", () => {
  const LATER = OPENS + 2 * 24 * HOUR;
  const move = (opensAt: number, extra: object = {}) =>
    call("PUT", "/exams/drive/window", {
      opensAt: new Date(opensAt).toISOString(),
      closesAt: new Date(opensAt + 3 * HOUR).toISOString(),
      ...extra,
    });
  const outbox = async () => new OutboxStore(pgliteExecutor(db)).recent("org-a");

  it("moves a candidate who has not begun, tells them the new time, and reminds them for it", async () => {
    await worker.tick();
    log.sent.length = 0;

    const moved = await move(LATER);
    expect(moved.json()).toEqual({ ok: true, moved: 1 });
    const [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    expect(invitation.opensAt).toBe(new Date(LATER).toISOString());

    // The old time's reminders are withdrawn; the new time's are queued, with the news.
    const queued = await outbox();
    expect(queued.filter((q) => q.status === "skipped").map((q) => [q.kind, q.purpose, q.error]).sort()).toEqual([
      ["email", "reminder", "Rescheduled"],
      ["email", "reminder_day", "Rescheduled"],
      ["sms", "reminder", "Rescheduled"],
      ["sms", "reminder_day", "Rescheduled"],
    ]);
    expect(queued.filter((q) => q.status === "pending").map((q) => `${q.kind}:${q.purpose}`).sort()).toEqual([
      "email:reminder",
      "email:reminder_day",
      "email:rescheduled",
      "sms:reminder",
      "sms:reminder_day",
      "sms:rescheduled",
    ]);

    await worker.tick();
    const [news] = emails();
    expect(news!.subject).toBe(`New time: Campus drive opens ${ist(new Date(LATER).toISOString())}`);
    expect(news!.text).toContain(`The time of your Campus drive test with Acme Engineering has changed. It now opens ${ist(new Date(LATER).toISOString())}.`);
    expect(news!.text).toContain(`Opens:  ${ist(new Date(LATER).toISOString())}`);
    expect(texts()).toHaveLength(1);

    // Nothing goes out at the old time; the reminders come for the new one.
    log.sent.length = 0;
    clock = OPENS - HOUR + 1;
    await worker.tick();
    expect(log.sent).toHaveLength(0);
    clock = LATER - HOUR + 1;
    await worker.tick();
    expect(emails().map((e) => e.subject)).toEqual([`Reminder: Campus drive opens ${ist(new Date(LATER).toISOString())}`]);

    // The link opens at the new time, not the old.
    const code = new InviteCodes(TOKEN_SECRET).issue("org-a", invitation.id);
    clock = OPENS + 60_000;
    expect((await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code } })).statusCode).toBe(403);
    clock = LATER + 60_000;
    expect((await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code } })).statusCode).toBe(200);
  });

  it("leaves a candidate with a window of their own, and one who has begun, where they are", async () => {
    // A narrower window of their own, inside the exam's.
    const own = OPENS + HOUR;
    const imported = await call("POST", "/exams/drive/invitations/import", {
      csv: `ref,name,email,opens_at,closes_at\nCS002,Own Window,own@college.test,${new Date(own).toISOString()},${new Date(own + HOUR).toISOString()}`,
      dryRun: false,
      channels: ["email"],
    });
    expect(imported.statusCode, imported.payload).toBe(201);
    const [first] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    clock = OPENS + 1;
    await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: new InviteCodes(TOKEN_SECRET).issue("org-a", first.id) } });

    expect((await move(LATER)).json()).toEqual({ ok: true, moved: 0 });
    const after = (await call("GET", "/exams/drive/invitations")).json().invitations;
    expect(after.map((i: { candidateRef: string; opensAt: string }) => [i.candidateRef, i.opensAt])).toEqual([
      ["CS001", new Date(OPENS).toISOString()],
      ["CS002", new Date(own).toISOString()],
    ]);
    expect((await outbox()).filter((q) => q.purpose === "rescheduled")).toEqual([]);
  });

  it("moves quietly when asked not to tell anyone, still reminding them for the new time", async () => {
    expect((await move(LATER, { notify: false })).json()).toEqual({ ok: true, moved: 1 });
    const pending = (await outbox()).filter((q) => q.status === "pending").map((q) => `${q.kind}:${q.purpose}`);
    expect(pending).not.toContain("email:rescheduled");
    expect(pending).toContain("email:reminder_day");
  });

  it("moves nobody when only the hard close changes", async () => {
    expect((await move(OPENS, { hardClose: false })).json()).toEqual({ ok: true, moved: 0 });
    expect((await outbox()).filter((q) => q.status === "skipped")).toEqual([]);
  });

  it("does not tell a candidate who begins before the news goes out", async () => {
    await move(OPENS - 12 * HOUR);
    const [invitation] = (await call("GET", "/exams/drive/invitations")).json().invitations;
    clock = OPENS - 12 * HOUR + 60_000;
    await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: new InviteCodes(TOKEN_SECRET).issue("org-a", invitation.id) } });
    log.sent.length = 0;
    await worker.tick();
    expect(emails().map((e) => e.subject)).toEqual(["Your Campus drive test — Acme Engineering"]);
    expect((await outbox()).filter((q) => q.purpose === "rescheduled").map((q) => q.status)).toEqual(["skipped", "skipped"]);
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

describe("a handler that says not yet", () => {
  it("holds the item until then, without counting the try (F2)", async () => {
    const sql = pgliteExecutor(db);
    await sql.transaction((tx) => enqueue(tx, "org-a", [{ kind: "hire", subject: { applicationId: "a1" }, purpose: "mail_applied", id: "held-1", sendAfter: new Date(clock) }], () => "x"), {
      "parikshaa.org_id": "org-a",
      "parikshaa.actor": "staff",
    });
    let suspended = true;
    const seen: string[] = [];
    const held = new DeliveryWorker({
      outbox: new OutboxStore(sql),
      invitations: new InvitationStore(sql),
      store: new LedgerStore(sql),
      identity: new IdentityStore(sql),
      link: () => PUBLIC_URL,
      mailer: null,
      sms: null,
      handlers: {
        hire: async (item) => {
          seen.push(item.id);
          return suspended ? { later: new Date(clock + HOUR) } : "sent";
        },
      },
      now: () => clock,
    });
    const item = async () => (await new OutboxStore(sql).recent("org-a")).find((q) => q.id === "held-1");

    for (let i = 0; i < 10; i++) {
      await held.tick();
      clock += HOUR;
    }
    expect(await item()).toMatchObject({ status: "pending", attempts: 0 });
    expect(seen).toHaveLength(10);

    suspended = false;
    await held.tick();
    expect(await item()).toMatchObject({ status: "sent" });
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
