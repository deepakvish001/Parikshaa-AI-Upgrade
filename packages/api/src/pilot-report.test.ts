import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { BillingStore, IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, ReportStore, staffScope, type OrganisationFacts } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { DailyPilotReport, flagsFor, pilotReport, renderReport } from "./pilot-report.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** The operator's view of a pilot: who signed up, what they have done, and who needs a call. */

const DAY = 24 * 3_600_000;
const NOW = Date.parse("2026-10-05T04:30:00Z");

const facts = (over: Partial<OrganisationFacts> = {}): OrganisationFacts => ({
  id: orgId("sahyadri"),
  name: "Sahyadri College",
  createdAt: new Date(NOW - 2 * DAY).toISOString(),
  owner: { name: "Meera Kulkarni", email: "meera@sahyadri.test", verified: true },
  staff: 1,
  exams: 1,
  sampleLoaded: false,
  invited: 0,
  started: 0,
  awaitingGrading: 0,
  graded: 0,
  credits: 25,
  attemptsCharged: 0,
  failedMessages: 0,
  overdueMessages: 0,
  lastActivity: new Date(NOW - DAY).toISOString(),
  nextSitting: null,
  ...over,
});

const texts = (o: OrganisationFacts) => flagsFor(o, NOW).map((f) => `${f.level}: ${f.text}`);

describe("what the report asks the operator to do", () => {
  it("nothing, for an organisation getting on with it", () => {
    expect(texts(facts())).toEqual([]);
  });

  it("call an owner who has not confirmed their email after a day, and only then", () => {
    const unconfirmed = { owner: { name: "Meera", email: "m@s.test", verified: false } };
    expect(texts(facts({ ...unconfirmed, createdAt: new Date(NOW - 3 * 3_600_000).toISOString() }))).toEqual([
      "watch: The owner has not confirmed their email yet",
    ]);
    expect(texts(facts(unconfirmed))).toEqual(["act: The owner has not confirmed their email after 2 days: call them, it may be in spam"]);
  });

  it("top up an organisation running out of credits, before a sitting it cannot cover", () => {
    expect(texts(facts({ credits: 3 }))).toEqual(["act: Only 3 attempts left"]);
    expect(texts(facts({ credits: 0 }))).toEqual(["act: No attempts left: candidates cannot start a test"]);
    const sitting = {
      examId: "drive",
      title: "Campus drive",
      opensAt: new Date(NOW + DAY).toISOString(),
      closesAt: new Date(NOW + DAY + 3 * 3_600_000).toISOString(),
      waiting: 40,
    };
    expect(texts(facts({ credits: 25, nextSitting: sitting }))).toEqual([
      "act: Campus drive opens 6 Oct 2026, 10:00 am IST with 40 candidates yet to begin, and 25 credits left",
    ]);
    // A sitting weeks away is not today's problem, and an invoiced organisation has no credits to run out of.
    expect(texts(facts({ credits: 25, nextSitting: { ...sitting, opensAt: new Date(NOW + 20 * DAY).toISOString() } }))).toEqual([]);
    expect(texts(facts({ credits: null, nextSitting: sitting }))).toEqual([]);
    // Already open, it says so.
    expect(texts(facts({ credits: 25, nextSitting: { ...sitting, opensAt: new Date(NOW - 3_600_000).toISOString() } }))).toEqual([
      "act: Campus drive is open now, until 6 Oct 2026, 1:00 pm IST, with 40 candidates yet to begin, and 25 credits left",
    ]);
  });

  it("look at messages that failed, or have not gone at all", () => {
    expect(texts(facts({ failedMessages: 2, overdueMessages: 1 }))).toEqual([
      "act: 2 messages could not be sent: the exam's Candidates tab says why",
      "act: 1 message overdue by more than 15 minutes: is the API running?",
    ]);
  });

  it("keep an eye on grading, a slow start, and silence", () => {
    expect(
      texts(facts({ awaitingGrading: 12, exams: 0, createdAt: new Date(NOW - 5 * DAY).toISOString(), lastActivity: new Date(NOW - 8 * DAY).toISOString() })),
    ).toEqual(["watch: 12 attempts waiting to be graded", "watch: No exam of its own after 5 days", "watch: Nothing done for 8 days"]);
  });

  it("puts those needing a call first, and leaves out organisations nobody uses", () => {
    const report = pilotReport(
      [
        facts({ id: orgId("fine"), name: "Fine" }),
        facts({ id: orgId("low"), name: "Low", credits: 1 }),
        facts({ id: orgId("default"), name: "Default organisation", owner: null, staff: 0, exams: 0 }),
      ],
      NOW,
    );
    expect(report.organisations.map((o) => o.name)).toEqual(["Low", "Fine"]);
    const text = renderReport(report);
    expect(text).toContain("2 organisations, 1 needs attention today");
    expect(text).toContain("  ! Only 1 attempt left");
  });
});

describe("the report, from the database", () => {
  let db: PGlite | undefined;
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    await db?.close();
  });

  it("counts what each organisation has done, the sample exam aside", async () => {
    let clock = NOW;
    db = await freshDatabase();
    const sql = pgliteExecutor(db);
    let identity;
    ({ app, identity } = await wire(sql, { client: {} as unknown as Anthropic, now: () => clock }));
    const org = await addOrganisation(identity, "sahyadri", "Sahyadri College");
    await addStaff(identity, org, "meera@sahyadri.test", "owner");
    await db.exec(`SET ROLE parikshaa_app`);
    const billing = new BillingStore(sql);
    await billing.setPlan(staffScope(orgId("sahyadri")), "prepaid", 4_900);
    await billing.grant(staffScope(orgId("sahyadri")), 3, "trial");
    const owner = await signIn(app, "meera@sahyadri.test");
    const call = (method: "POST" | "PUT", url: string, payload: object) => app!.inject({ method, url, headers: bearer(owner), payload });

    await call("POST", "/exams", {
      id: "drive",
      title: "Campus drive",
      questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
      policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
    });
    await call("PUT", "/exams/drive/window", { opensAt: new Date(NOW + DAY).toISOString(), closesAt: new Date(NOW + DAY + 3 * 3_600_000).toISOString() });
    const imported = await call("POST", "/exams/drive/invitations/import", {
      csv: "ref,name,email\nCS001,A,a@college.test\nCS002,B,b@college.test\nCS003,C,c@college.test\nCS004,D,d@college.test",
      dryRun: false,
      channels: ["email"],
    });
    expect(imported.statusCode, imported.payload).toBe(201);
    await call("POST", "/onboarding/sample", {});

    const before = (await new ReportStore(sql).organisations(new Date(clock))).find((o) => o.id === "sahyadri")!;
    expect(before).toMatchObject({
      name: "Sahyadri College",
      owner: { email: "meera@sahyadri.test", verified: true },
      exams: 1,
      sampleLoaded: true,
      invited: 4,
      started: 0,
      credits: 3,
      nextSitting: { examId: "drive", title: "Campus drive", waiting: 4 },
    });
    // Four waiting and three credits, a day out: a call to make.
    expect(flagsFor(before, clock).map((f) => f.text)).toContain(
      "Campus drive opens 6 Oct 2026, 10:00 am IST with 4 candidates yet to begin, and 3 credits left",
    );

    // One candidate sits it and submits.
    clock = NOW + DAY + 60_000;
    const [invitation] = (await app.inject({ method: "GET", url: "/exams/drive/invitations", headers: bearer(owner) })).json().invitations;
    const opened = await app.inject({
      method: "POST",
      url: "/invitations/redeem",
      payload: { code: new InviteCodes(TOKEN_SECRET).issue("sahyadri", invitation.id) },
    });
    expect(opened.statusCode, opened.payload).toBe(200);
    const submitted = await app.inject({ method: "POST", url: "/attempts/me/submit", headers: bearer(opened.json().token) });
    expect(submitted.statusCode, submitted.payload).toBe(200);

    const after = (await new ReportStore(sql).organisations(new Date(clock))).find((o) => o.id === "sahyadri")!;
    expect(after).toMatchObject({ started: 1, awaitingGrading: 1, graded: 0, credits: 2, attemptsCharged: 1, failedMessages: 0 });
    expect(after.lastActivity).not.toBeNull();
    // Nothing has sent the invitations: past the quarter hour, they show as overdue.
    expect(after.overdueMessages).toBeGreaterThan(0);
  });
});

describe("the report each morning", () => {
  let db: PGlite | undefined;
  afterEach(async () => {
    await db?.close();
  });

  it("goes to the operator once a day, after eight in India, however often it is asked for", async () => {
    // 02:00 UTC is 7:30 in India.
    let clock = Date.parse("2026-10-05T02:00:00Z");
    db = await freshDatabase();
    const sql = pgliteExecutor(db);
    const identity = new IdentityStore(sql);
    const org = await addOrganisation(identity, "sahyadri", "Sahyadri College");
    await addStaff(identity, org, "meera@sahyadri.test", "owner");
    await db.exec(`SET ROLE parikshaa_app`);
    const mailer = new OutboxLog();
    const daily = new DailyPilotReport({ identity, reports: new ReportStore(sql), mailer, to: "operator@parikshaa.test", now: () => clock });
    const worker = new DeliveryWorker({
      outbox: new OutboxStore(sql),
      invitations: new InvitationStore(sql),
      store: new LedgerStore(sql),
      identity,
      link: () => "",
      mailer,
      sms: null,
      handlers: { staff_email: daily.mail },
      now: () => clock,
    });
    const sent = () => mailer.sent as EmailMessage[];

    expect(await daily.due()).toBe(false);
    await worker.tick();
    expect(sent()).toHaveLength(0);

    clock = Date.parse("2026-10-05T02:31:00Z");
    expect(await daily.due()).toBe(true);
    expect(await daily.due()).toBe(true);
    await worker.tick();
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ to: "operator@parikshaa.test", subject: "Pilot report, 5 Oct 2026: nothing needs you today" });
    expect(sent()[0]!.text).toContain("Sahyadri College  (sahyadri)");

    // Later the same day: nothing more. The next morning: the next report.
    clock = Date.parse("2026-10-05T12:00:00Z");
    await daily.due();
    await worker.tick();
    expect(sent()).toHaveLength(1);
    clock = Date.parse("2026-10-06T03:00:00Z");
    await daily.due();
    await worker.tick();
    expect(sent()).toHaveLength(2);
  });
});
