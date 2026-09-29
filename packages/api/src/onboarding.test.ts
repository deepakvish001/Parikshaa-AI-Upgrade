import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { IdentityStore as Identity, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { validateExam } from "@parikshaa/core";
import { organisationId, SAMPLE_QUESTIONS, type SignupPolicy } from "./onboarding.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** A new institution's first day: signing itself up, and the sample exam. */

let db: PGlite | undefined;
let app: FastifyInstance | undefined;
let identity: IdentityStore;

const POLICY: SignupPolicy = { trialCredits: 25, pricePaise: 4_900 };

async function start(signup?: SignupPolicy, mailer?: OutboxLog): Promise<{ app: FastifyInstance; db: PGlite; worker: DeliveryWorker }> {
  const database = await freshDatabase();
  const sql = pgliteExecutor(database);
  const wiring = await wire(sql, { client: {} as unknown as Anthropic, ...(signup === undefined ? {} : { signup }), ...(mailer === undefined ? {} : { mailer }) });
  identity = wiring.identity;
  await database.exec(`SET ROLE parikshaa_app`);
  db = database;
  app = wiring.app;
  const worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new Identity(sql),
    link: () => "",
    mailer: mailer ?? null,
    sms: null,
    handlers: wiring.handlers,
  });
  return { app: wiring.app, db: database, worker };
}

afterEach(async () => {
  await app?.close();
  await db?.close();
  app = undefined;
  db = undefined;
});

const signup = (payload: object, ip = "10.0.0.1") => app!.inject({ method: "POST", url: "/auth/signup", payload, remoteAddress: ip });
const ASHA = { organisation: "Nalanda Institute of Technology", name: "Asha Rao", email: "asha@nalanda.test", password: "a long pilot password" };

describe("signing an institution up", () => {
  it("is closed unless the server takes sign-ups", async () => {
    const { app } = await start();
    expect((await app.inject({ method: "GET", url: "/auth/signup" })).json()).toEqual({ open: false, trialCredits: 0 });
    expect((await signup(ASHA)).statusCode).toBe(404);
  });

  it("makes the organisation, its owner and a session, prepaid with the trial credits", async () => {
    const { app } = await start(POLICY);
    expect((await app.inject({ method: "GET", url: "/auth/signup" })).json()).toEqual({ open: true, trialCredits: 25 });

    const res = await signup(ASHA);
    expect(res.statusCode, res.payload).toBe(201);
    const { token, user } = res.json();
    expect(user).toMatchObject({ name: "Asha Rao", email: "asha@nalanda.test", role: "owner" });

    const me = (await app.inject({ method: "GET", url: "/auth/me", headers: bearer(token) })).json();
    expect(me.organisation.name).toBe("Nalanda Institute of Technology");
    expect(me.organisation.id).toMatch(/^nalanda-institute-of-technology-[0-9a-f]{6}$/);
    expect(me.permissions).toContain("org:manage");

    const billing = (await app.inject({ method: "GET", url: "/billing", headers: bearer(token) })).json();
    expect(billing.account).toMatchObject({ mode: "prepaid", credits: 25, pricePaise: 4_900 });
    expect(billing.history[0]).toMatchObject({ delta: 25, reason: "grant" });

    // Signing in afterwards works like any owner's.
    expect(await signIn(app, "asha@nalanda.test", "a long pilot password")).toMatch(/^pks_/);
    const audit = (await app.inject({ method: "GET", url: "/audit", headers: bearer(token) })).json();
    expect(audit.entries.map((e: { action: string }) => e.action)).toContain("org.created");
  });

  it("refuses a taken address, a short password and a missing name, leaving nothing behind", async () => {
    const { db } = await start(POLICY);
    const count = async () => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM organisations`)).rows[0]!.n;
    const org = await addOrganisation(identity, "org-a", "Acme");
    await addStaff(identity, org, "taken@acme.test", "owner", "Ravi");
    const before = await count();

    const taken = await signup({ ...ASHA, email: "Taken@acme.test" });
    expect(taken.statusCode).toBe(409);
    expect(taken.json().error).toBe("email_taken");
    expect((await signup({ ...ASHA, password: "short" })).json()).toMatchObject({ error: "invalid", message: "A password is at least 12 characters" });
    expect((await signup({ ...ASHA, organisation: " " })).statusCode).toBe(422);
    expect((await signup({ ...ASHA, email: "not an address" })).statusCode).toBe(422);

    expect(await count()).toBe(before);
  });

  it("takes a few sign-ups from one network, then asks it to wait", async () => {
    await start(POLICY);
    for (let i = 0; i < 5; i++) expect((await signup({ ...ASHA, email: `p${i}@x.test` }, "10.9.9.9")).statusCode).toBe(201);
    const refused = await signup({ ...ASHA, email: "p5@x.test" }, "10.9.9.9");
    expect(refused.statusCode).toBe(429);
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    expect((await signup({ ...ASHA, email: "p6@x.test" }, "10.9.9.10")).statusCode).toBe(201);
  });

  it("names an organisation from its name, whatever the script", () => {
    expect(organisationId("St. Xavier's College, Mumbai", "abc123")).toBe("st-xavier-s-college-mumbai-abc123");
    expect(organisationId("आईआईटी", "abc123")).toBe("org-abc123");
    expect(organisationId("x".repeat(90), "abc123")).toBe(`${"x".repeat(40)}-abc123`);
  });
});

describe("confirming a new owner's address", () => {
  it("sends a link; until it is opened the owner builds but reaches nobody, and the operator hears of the institution", async () => {
    const mail = new OutboxLog();
    const { app, worker } = await start({ ...POLICY, notify: "ops@parikshaa.test" }, mail);
    const { token } = (await signup(ASHA)).json();
    const as = (method: "GET" | "POST", url: string, payload?: object) =>
      app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

    const me = (await as("GET", "/auth/me")).json();
    expect(me.emailVerified).toBe(false);
    expect(me.permissions).toContain("exam:write");
    expect(me.permissions).not.toContain("attempt:start");
    expect(me.permissions).not.toContain("staff:manage");

    // Building is allowed; inviting, adding staff and issuing keys wait.
    const exam = {
      id: "drive",
      title: "Drive",
      questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
      policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
    };
    expect((await as("POST", "/exams", exam)).statusCode).toBe(201);
    const invite = await as("POST", "/exams/drive/invitations/import", { csv: "ref,name\nCS001,A", dryRun: false, channels: [] });
    expect(invite.statusCode).toBe(403);
    expect(invite.json().error).toBe("email_unverified");
    expect((await as("POST", "/staff", { email: "x@nalanda.test", name: "X", role: "author", password: "a long enough password" })).json().error).toBe("email_unverified");

    await worker.tick();
    const sent = mail.sent.filter((m): m is EmailMessage => "subject" in m);
    const verify = sent.find((m) => m.to === "asha@nalanda.test")!;
    expect(verify.subject).toBe("Confirm your email for Parikshaa");
    expect(verify.text).toContain("Nalanda Institute of Technology");
    const notice = sent.find((m) => m.to === "ops@parikshaa.test")!;
    expect(notice.subject).toBe("New institution: Nalanda Institute of Technology");
    expect(notice.text).toContain("Asha Rao <asha@nalanda.test>");

    const link = /\?verify=([^\s]+)/.exec(verify.text)![1]!;
    expect((await app.inject({ method: "POST", url: "/auth/verify-email", payload: { token: decodeURIComponent(link).replace(/.$/, "x") } })).statusCode).toBe(422);
    expect((await app.inject({ method: "POST", url: "/auth/verify-email", payload: { token: decodeURIComponent(link) } })).statusCode).toBe(200);
    // Opening it twice is harmless.
    expect((await app.inject({ method: "POST", url: "/auth/verify-email", payload: { token: decodeURIComponent(link) } })).statusCode).toBe(200);

    expect((await as("GET", "/auth/me")).json().emailVerified).toBe(true);
    const after = await as("POST", "/exams/drive/invitations/import", { csv: "ref,name\nCS001,A", dryRun: false, channels: [] });
    // Past the gate: what stops it now is only that the exam has no window yet.
    expect(after.json().error).toBe("invalid_import");
    expect((await as("POST", "/auth/verify-email/resend")).json()).toEqual({ sent: false });
    const audit = (await as("GET", "/audit")).json().entries.map((e: { action: string }) => e.action);
    expect(audit).toContain("auth.email_verified");
  });

  it("sends the link again on asking, not more than twice a minute", async () => {
    const mail = new OutboxLog();
    const { app, worker } = await start(POLICY, mail);
    const { token } = (await signup(ASHA)).json();
    const resend = () => app.inject({ method: "POST", url: "/auth/verify-email/resend", headers: bearer(token) });
    expect((await resend()).json()).toEqual({ sent: true });
    expect((await resend()).statusCode).toBe(200);
    expect((await resend()).statusCode).toBe(429);
    await worker.tick();
    expect(mail.sent.filter((m) => "subject" in m && m.to === "asha@nalanda.test")).toHaveLength(3);
  });

  it("does not hold back anyone the operator or an owner added", async () => {
    const { app } = await start();
    const org = await addOrganisation(identity, "org-a", "Acme");
    await addStaff(identity, org, "owner@acme.test", "owner", "Ravi");
    const token = await signIn(app, "owner@acme.test");
    const me = (await app.inject({ method: "GET", url: "/auth/me", headers: bearer(token) })).json();
    expect(me.emailVerified).toBe(true);
    expect(me.permissions).toContain("attempt:start");
  });

  it("reports a prepaid organisation's credits on its home page", async () => {
    const { app } = await start(POLICY);
    const { token } = (await signup(ASHA)).json();
    const home = (await app.inject({ method: "GET", url: "/dashboard", headers: bearer(token) })).json();
    expect(home.setup.prepaidCredits).toBe(25);
  });
});

describe("the sample exam", () => {
  it("is a valid exam of every kind of question", () => {
    const kinds = new Set(SAMPLE_QUESTIONS.map((d) => d.question.kind));
    expect([...kinds].sort()).toEqual(["mcq", "numeric", "short"]);
    const questions = SAMPLE_QUESTIONS.map((d, i) => ({ ...d.question, id: `q${i}` }));
    expect(validateExam({ id: "s", title: "s", questions, policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.7 } } as never)).toMatchObject({ ok: true });
  });

  it("loads into the bank and the exams without counting as the organisation's own, and goes away again", async () => {
    const { app } = await start();
    const org = await addOrganisation(identity, "org-a", "Acme");
    await addStaff(identity, org, "owner@acme.test", "owner", "Asha Rao");
    await addStaff(identity, org, "watch@acme.test", "invigilator", "Ravi");
    const owner = await signIn(app, "owner@acme.test");
    const call = (method: "GET" | "POST" | "DELETE", url: string, token = owner) => app.inject({ method, url, headers: bearer(token) });

    expect((await call("GET", "/dashboard")).json().setup.sampleExamId).toBeNull();
    expect((await call("POST", "/onboarding/sample", await signIn(app, "watch@acme.test"))).statusCode).toBe(403);

    const loaded = await call("POST", "/onboarding/sample");
    expect(loaded.statusCode, loaded.payload).toBe(200);
    expect(loaded.json()).toEqual({ examId: "sample-aptitude" });
    // Twice is still one.
    await call("POST", "/onboarding/sample");

    const exam = (await call("GET", "/exams/sample-aptitude")).json();
    expect(exam.title).toBe("Sample: campus aptitude round");
    expect(exam.questions).toHaveLength(SAMPLE_QUESTIONS.length);
    const bank = (await call("GET", "/bank?tag=sample")).json();
    expect(bank.questions).toHaveLength(SAMPLE_QUESTIONS.length);

    const { setup } = (await call("GET", "/dashboard")).json();
    expect(setup).toMatchObject({ sampleExamId: "sample-aptitude", exams: 0, bankQuestions: 0 });

    expect((await call("DELETE", "/onboarding/sample")).statusCode).toBe(200);
    expect((await call("GET", "/dashboard")).json().setup.sampleExamId).toBeNull();
    const after = (await call("GET", "/bank?tag=sample")).json();
    expect(after.questions).toHaveLength(0);
    const exams = (await call("GET", "/exams")).json().exams;
    expect(exams.find((e: { id: string }) => e.id === "sample-aptitude").archivedAt).not.toBeNull();

    // And back.
    await call("POST", "/onboarding/sample");
    expect((await call("GET", "/dashboard")).json().setup.sampleExamId).toBe("sample-aptitude");
    const actions = (await call("GET", "/audit")).json().entries.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["sample.loaded", "sample.removed"]));
  });
});
