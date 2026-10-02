import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, type SqlExecutor } from "@parikshaa/store";
import { redactResume } from "./ai-interview.js";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { fakeModel, type FakeModelScript } from "./fake-model.js";
import type { PrivacyService } from "./privacy.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, wire } from "./testing/harness.js";

/** The AI interviewer, v2 (plan row 93): the link by email, questions from a resume the model reads without who wrote it, and the retention sweep. */

const DAY = 86_400_000;
let db: PGlite;
let app: FastifyInstance;
let owner: string;
let mail: OutboxLog;
let worker: DeliveryWorker;
let script: FakeModelScript;
let privacy: PrivacyService;
let clock: number;

const call = (method: "GET" | "POST" | "PUT", url: string, payload?: object) => app.inject({ method, url, headers: bearer(owner), ...(payload === undefined ? {} : { payload }) });
const open = (method: "GET" | "POST", url: string, payload?: object) => app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
const codeOf = (link: string) => encodeURIComponent(new URL(link).searchParams.get("ai-interview")!);
const emails = () => mail.sent as EmailMessage[];
async function drain() {
  for (let i = 0; i < 5; i++) if ((await worker.tick()) === 0) return;
}
async function raw<T>(sql: string): Promise<T[]> {
  await db.exec("RESET ROLE");
  const rows = (await db.query<T>(sql)).rows;
  await db.exec("SET ROLE parikshaa_app");
  return rows;
}

const RESUME = `Ananya Rao
ananya.rao@mail.test | +91 98123 45678 | linkedin.com/in/ananya-rao | https://github.com/ananyarao

Experience
Backend intern, Zeta Payments (2024): built a Kafka consumer that settled 2 lakh UPI refunds a day; cut retries by 40%.
Projects: a URL shortener in Go with Redis; 16 GB RAM benchmark.`;

beforeEach(async () => {
  clock = Date.parse("2026-10-05T05:00:00Z");
  db = await freshDatabase();
  mail = new OutboxLog();
  const sql: SqlExecutor = pgliteExecutor(db);
  const model = fakeModel({ latencyMs: 0 });
  script = model.script;
  const wiring = await wire(sql, { client: model.client, now: () => clock, mailer: mail });
  app = wiring.app;
  privacy = wiring.privacy;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Hiring");
  await addStaff(wiring.identity, org, "hr@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hr@acme.test");
  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: () => PUBLIC_URL,
    mailer: mail,
    sms: null,
    whatsapp: null,
    handlers: wiring.handlers,
    now: () => clock,
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const setUp = async (extra: object = {}) => {
  const made = await call("POST", "/ai-interviews", { title: "Backend screen", roleId: "java-developer", questions: 2, minutes: 30, candidateName: "Ananya Rao", ...extra });
  expect(made.statusCode).toBe(201);
  return made.json();
};

describe("the link by email", () => {
  it("emails the candidate their link, and word when it is cancelled", async () => {
    const interview = await setUp({ candidateEmail: "ananya@mail.test" });
    await drain();
    expect(emails()).toHaveLength(1);
    expect(emails()[0]).toMatchObject({ to: "ananya@mail.test", subject: "Interview by chat: Backend screen" });
    expect(emails()[0]!.text).toContain(interview.link);
    expect(emails()[0]!.text).toContain("not told your name");

    await call("POST", `/ai-interviews/${interview.id}/cancel`);
    await drain();
    expect(emails()).toHaveLength(2);
    expect(emails()[1]).toMatchObject({ to: "ananya@mail.test", subject: "Cancelled: Backend screen" });
  });

  it("sends nothing without an email, and no invite once the interview is cancelled", async () => {
    await setUp();
    const cancelled = await setUp({ candidateEmail: "rohan@mail.test", candidateName: "Rohan" });
    // Cancelled before the outbox ran: the invite is skipped, the cancellation goes.
    await call("POST", `/ai-interviews/${cancelled.id}/cancel`);
    await drain();
    expect(emails().map((e) => e.subject)).toEqual(["Cancelled: Backend screen"]);
  });
});

describe("questions from a resume", () => {
  it("lets the model read the work, never who wrote it, and keeps the resume sealed", async () => {
    const interview = await setUp({ resume: RESUME, candidateEmail: "ananya.rao@mail.test" });
    expect(interview.resume).toBe(RESUME);
    await open("POST", `/ai-interviews/room/${codeOf(interview.link)}/start`);
    const prompt = script.interviewPrompts[0]!;
    expect(prompt).toContain("<resume>");
    expect(prompt).toContain("Kafka consumer that settled 2 lakh UPI refunds");
    expect(prompt).toContain("16 GB RAM");
    for (const leak of ["Ananya", "Rao", "ananya", "98123", "linkedin.com", "github.com", "@mail.test"]) expect(prompt).not.toContain(leak);

    const [row] = await raw<{ resume: string }>("SELECT resume FROM ai_interviews");
    expect(row!.resume).toMatch(/^enc:v1:/);
  });

  it("refuses a resume that is too long", async () => {
    expect((await call("POST", "/ai-interviews", { title: "x", roleId: "java-developer", candidateName: "y", resume: "a".repeat(20_001) })).statusCode).toBe(400);
  });

  it("takes out the name, email, phone and links, and leaves the rest", () => {
    const out = redactResume(RESUME, { name: "Ananya Rao", email: "ananya.rao@mail.test" });
    expect(out).toContain("[name] [name]");
    expect(out).toContain("[email] | [phone] | [link] | [link]");
    expect(out).toContain("Zeta Payments (2024)");
    expect(out).toContain("2 lakh UPI refunds");
    expect(out).toContain("16 GB RAM");
    expect(redactResume("Ram Kumar. 16 GB RAM, programmed in C.", { name: "Ram Kumar", email: null })).toBe("[name] [name]. 16 GB RAM, programmed in C.");
  });
});

describe("the retention sweep", () => {
  it("removes finished, cancelled and untaken interviews with their transcripts, and keeps one under way", async () => {
    const finished = await setUp();
    const code = codeOf(finished.link);
    await open("POST", `/ai-interviews/room/${code}/start`);
    for (const text of ["a", "b", "c", "d"]) await open("POST", `/ai-interviews/room/${code}/answer`, { text });
    const cancelled = await setUp({ candidateName: "B" });
    await call("POST", `/ai-interviews/${cancelled.id}/cancel`);
    const untaken = await setUp({ candidateName: "C" });

    clock += 40 * DAY;
    const ongoing = await setUp({ candidateName: "D", minutes: 90 });
    await open("POST", `/ai-interviews/room/${codeOf(ongoing.link)}/start`);

    await call("PUT", "/privacy", { controllerName: "Acme Hiring", grievanceName: "HR", grievanceEmail: "hr@acme.test", purpose: "Hiring.", retentionDays: 30 });
    expect(await privacy.sweep()).toBe(3);
    for (const gone of [finished, cancelled, untaken]) expect((await call("GET", `/ai-interviews/${gone.id}`)).statusCode).toBe(404);
    expect((await call("GET", `/ai-interviews/${ongoing.id}`)).statusCode).toBe(200);
    expect(await raw<{ interview_id: string }>("SELECT DISTINCT interview_id FROM ai_interview_turns")).toEqual([{ interview_id: ongoing.id }]);
    expect(JSON.stringify((await call("GET", "/audit")).json())).toContain("ai_interviews");
  });
});
