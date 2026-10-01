import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import type { PrepEngage } from "./prep-engage.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * Bringing learners back (Prep blueprint F2) and counting whether they come
 * (§17), through the HTTP API and the delivery worker. Runs as
 * `parikshaa_app`, so row-level security is live; the clock is the test's.
 */

// Monday 5 October 2026, 09:30 in India.
let clock = Date.parse("2026-10-05T04:00:00Z");
const at = (ist: string) => Date.parse(`${ist}+05:30`);
const PASSWORD = "a long enough password";
const S = "/practice/nit-practice";

let db: PGlite;
let app: FastifyInstance;
let engage: PrepEngage;
let worker: DeliveryWorker;
let mail: OutboxLog;
let owner: string;
let viewer: string;
const problems: Record<string, { id: string; slug: string }> = {};

function call(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}
async function ok(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200) {
  const res = await call(method, token, url, payload);
  expect(res.statusCode, res.payload).toBe(status);
  return res.json();
}
const signUp = async (email: string, name: string) => (await ok("POST", null, `${S}/signup`, { name, email, password: PASSWORD })).token as string;
const reminders = () => mail.sent.filter((m): m is EmailMessage => "subject" in m && !m.subject.startsWith("Confirm"));

beforeEach(async () => {
  clock = Date.parse("2026-10-05T04:00:00Z");
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  mail = new OutboxLog();
  let identity;
  let handlers;
  ({ app, identity, prepEngage: engage, handlers } = await wire(sql, { client: {} as unknown as Anthropic, mailer: mail, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await addStaff(identity, org, "viewer@nit.test", "viewer");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@nit.test");
  viewer = await signIn(app, "viewer@nit.test");
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
  await ok("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true }, 200);
  for (const [name, stem, difficulty] of [
    ["arrays", "Arrays are stored how", "easy"],
    ["search", "Binary search needs what", "medium"],
  ] as const) {
    const q = await ok("POST", owner, "/bank", { question: { kind: "mcq", stem, maxScore: 1, rubric: [], options: ["one", "two", "three"], correctIndex: 1 }, difficulty });
    problems[name] = await ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id });
  }
  const lesson = await ok("POST", owner, "/practice-admin/lessons", { title: "What an array is", body: "# Arrays", estMinutes: 15, published: true });
  await ok("POST", owner, "/practice-admin/tracks", {
    title: "DSA Basics",
    description: "",
    published: true,
    modules: [{ title: "Arrays", items: [{ lessonId: lesson.id }, { problemId: problems.arrays!.id }, { problemId: problems.search!.id }] }],
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const plan = { track: "dsa-basics", level: "beginner", deadline: "2026-10-30", dailyMinutes: 60, offDays: [] };

describe("the daily reminder", () => {
  it("is off until turned on, and goes at the learner's hour, once a day, only with something left to do", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    await ok("POST", asha, `${S}/plan`, plan);
    expect(await ok("GET", asha, `${S}/reminders`)).toEqual({ enabled: false, hour: 19, email: true });
    expect((await call("PUT", asha, `${S}/reminders`, { enabled: true, hour: 24 })).statusCode).toBe(422);
    expect(await ok("PUT", asha, `${S}/reminders`, { enabled: true, hour: 19 })).toEqual({ enabled: true, hour: 19 });

    // On, but with no plan and nothing due: nothing to say.
    const ravi = await signUp("ravi@example.com", "Ravi");
    await ok("PUT", ravi, `${S}/reminders`, { enabled: true, hour: 19 });
    // A plan, but another hour.
    const meena = await signUp("meena@example.com", "Meena");
    await ok("POST", meena, `${S}/plan`, plan);
    await ok("PUT", meena, `${S}/reminders`, { enabled: true, hour: 8 });
    // A plan and the hour, but not turned on.
    const kiran = await signUp("kiran@example.com", "Kiran");
    await ok("POST", kiran, `${S}/plan`, plan);

    clock = at("2026-10-05T18:59:00");
    expect(await engage.queueDue(["org-a"])).toBe(0);
    clock = at("2026-10-05T19:05:00");
    expect(await engage.queueDue(["org-a"])).toBe(1);
    expect(await engage.queueDue(["org-a"])).toBe(0);
    await worker.tick();
    const sent = reminders();
    expect(sent.map((m) => [m.to, m.subject])).toEqual([["asha@example.com", "2 tasks left today on NIT Practice"]]);
    expect(sent[0]!.text).toContain("• What an array is (15 min)");
    expect(sent[0]!.text).toContain("https://exam.test/practice/nit-practice/home");

    // The link in the email turns it off, without signing in; a forged one does not.
    const token = decodeURIComponent(/reminders\?off=(\S+)/.exec(sent[0]!.text)![1]!);
    expect((await call("POST", null, `${S}/reminders/off`, { token: `${token.split(".")[0]}.forged` })).statusCode).toBe(422);
    expect(await ok("POST", null, `${S}/reminders/off`, { token }, 200)).toEqual({ off: true });
    expect((await ok("GET", asha, `${S}/reminders`)).enabled).toBe(false);
    clock = at("2026-10-06T19:05:00");
    expect(await engage.queueDue(["org-a"])).toBe(0);
  });

  it("tells a learner who asked for email when their plan slips past its deadline, once a week at most", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    const ravi = await signUp("ravi@example.com", "Ravi");
    for (const t of [asha, ravi]) await ok("POST", t, `${S}/plan`, { ...plan, deadline: "2026-10-11" });
    await ok("PUT", asha, `${S}/reminders`, { enabled: true, hour: 19 });
    const late = () => mail.sent.filter((m): m is EmailMessage => "subject" in m && m.subject.includes("after your deadline"));

    // Nothing done for a week: the work moves past Sunday the 11th.
    clock = at("2026-10-12T10:00:00");
    for (const t of [asha, ravi]) expect((await ok("GET", t, `${S}/plan`)).plan.onTrack).toBe(false);
    await worker.tick();
    expect(late().map((m) => m.to)).toEqual(["asha@example.com"]);
    expect(late()[0]!.text).toContain("now finishes on 2026-10-14, after your deadline of 2026-10-11");
    expect(late()[0]!.text).toContain("https://exam.test/practice/nit-practice/plan");

    // It slips again the next day: not told again within the week.
    clock = at("2026-10-13T10:00:00");
    await ok("GET", asha, `${S}/plan`);
    await worker.tick();
    expect(late()).toHaveLength(1);
    // A week on, still late: told again.
    clock = at("2026-10-19T10:00:00");
    await ok("GET", asha, `${S}/plan`);
    await worker.tick();
    expect(late()).toHaveLength(2);
  });

  it("says nothing on a day whose tasks are done, and nothing a day late", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    const today = (await ok("POST", asha, `${S}/plan`, plan)).plan.today as { id: string }[];
    await ok("PUT", asha, `${S}/reminders`, { enabled: true, hour: 19 });
    clock = at("2026-10-05T19:05:00");
    expect(await engage.queueDue(["org-a"])).toBe(1);
    // Done before the email went: it is not sent.
    for (const task of today) await ok("PUT", asha, `${S}/plan/tasks/${task.id}`, { done: true }, 200);
    await worker.tick();
    expect(reminders()).toEqual([]);

    // Queued, then held up past its day: not sent either.
    clock = at("2026-10-06T19:05:00");
    expect(await engage.queueDue(["org-a"])).toBe(1);
    clock = at("2026-10-07T00:10:00");
    await worker.tick();
    expect(reminders()).toEqual([]);
  });
  it("is not sent on a day the learner took off", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    await ok("POST", asha, `${S}/plan`, plan);
    await ok("PUT", asha, `${S}/reminders`, { enabled: true, hour: 19 });
    await ok("POST", asha, `${S}/streak/freeze`, undefined, 200);
    clock = at("2026-10-05T19:05:00");
    expect(await engage.queueDue(["org-a"])).toBe(0);
  });
});

describe("analytics", () => {
  it("counts sign-ups, activation, D1 and D7 retention and the funnel, from what learners did", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    const ravi = await signUp("ravi@example.com", "Ravi");
    await signUp("meena@example.com", "Meena");
    // Asha solves on her first day and comes back the next; Ravi starts a plan and comes back a week later.
    await ok("POST", asha, `${S}/problems/${problems.arrays!.slug}/submit`, { answer: "1" }, 200);
    await ok("POST", ravi, `${S}/plan`, plan);
    clock = at("2026-10-06T10:00:00");
    await ok("GET", asha, `${S}/home`);
    clock = at("2026-10-12T10:00:00");
    await ok("GET", ravi, `${S}/home`);
    // Rows are dated by the database's clock; put them on the test's days.
    await db.exec(`RESET ROLE`);
    await db.exec(`UPDATE learners SET created_at = '2026-10-05T09:30:00+05:30'`);
    await db.exec(`UPDATE practice_submissions SET created_at = '2026-10-05T11:00:00+05:30'`);
    await db.exec(`SET ROLE parikshaa_app`);

    clock = at("2026-10-14T09:00:00");
    expect((await call("GET", asha, "/practice-admin/analytics")).statusCode).toBe(401);
    const a = await ok("GET", viewer, "/practice-admin/analytics");
    expect(a).toMatchObject({
      from: "2026-09-15",
      to: "2026-10-14",
      funnel: { signedUp: 3, startedPlan: 1, solvedOne: 1, usedTutor: 0, bought: 0 },
      activation: { cohort: 3, activated: 1 },
      retention: { d1: { cohort: 3, returned: 1 }, d7: { cohort: 3, returned: 1 } },
      reminders: { enabled: 0, sentInWindow: 0 },
    });
    expect(a.days).toHaveLength(30);
    const day = (d: string) => (a.days as { day: string; active: number; signups: number; solves: number }[]).find((x) => x.day === d);
    expect(day("2026-10-05")).toMatchObject({ signups: 3, solves: 1 });
    expect(day("2026-10-06")!.active).toBe(1);
    expect(day("2026-10-12")!.active).toBe(1);
  });
});
