import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, type SqlExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { fakeModel } from "./fake-model.js";
import { calendar, combine } from "./interviews.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PUBLIC_URL, signIn, wire } from "./testing/harness.js";

/** CO27 and CO41: a panel, each with their own scorecard and the average, and a calendar invite by email. */

let db: PGlite;
let app: FastifyInstance;
let lead: string;
let second: string;
let outsider: string;
let secondId: string;
let mail: OutboxLog;
let worker: DeliveryWorker;
const clock = Date.parse("2026-10-05T05:00:00Z");

const call = (token: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) => app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const emails = () => mail.sent as EmailMessage[];
async function drain() {
  for (let i = 0; i < 5; i++) if ((await worker.tick()) === 0) return;
}

beforeEach(async () => {
  db = await freshDatabase();
  mail = new OutboxLog();
  const sql: SqlExecutor = pgliteExecutor(db);
  const wiring = await wire(sql, { client: fakeModel({ latencyMs: 0 }).client, now: () => clock, mailer: mail });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Hiring");
  await addStaff(wiring.identity, org, "lead@acme.test", "owner", "Priya Lead");
  secondId = await addStaff(wiring.identity, org, "second@acme.test", "reviewer", "Arjun Second");
  await addStaff(wiring.identity, org, "outsider@acme.test", "reviewer", "Other Person");
  await db.exec(`SET ROLE parikshaa_app`);
  lead = await signIn(app, "lead@acme.test");
  second = await signIn(app, "second@acme.test");
  outsider = await signIn(app, "outsider@acme.test");
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

const schedule = (panel: string[]) =>
  call(lead, "POST", "/interviews", { title: "Backend round 2", candidateName: "Ananya", candidateEmail: "ananya@mail.test", scheduledAt: "2026-10-06T10:00:00+05:30", minutes: 60, panel });

describe("an interview panel", () => {
  it("sends each panel member and the candidate a calendar invite", async () => {
    const made = await schedule([secondId]);
    expect(made.statusCode).toBe(201);
    expect(made.json().panel).toEqual([expect.objectContaining({ name: "Priya Lead", scored: false }), { userId: secondId, name: "Arjun Second", scored: false }]);
    await drain();
    expect(emails().map((m) => m.to).sort()).toEqual(["ananya@mail.test", "lead@acme.test", "second@acme.test"]);
    const toCandidate = emails().find((m) => m.to === "ananya@mail.test")!;
    expect(toCandidate.text).toContain("Interview room, where you will write code: ");
    const ics = new TextDecoder().decode(toCandidate.attachments![0]!.content);
    expect(ics).toContain("DTSTART:20261006T043000Z");
    expect(ics).toContain("DTEND:20261006T053000Z");
    expect(ics).toContain(`UID:interview-${made.json().id}@parikshaa`);
    expect(toCandidate.attachments![0]!.contentType).toContain("text/calendar");

    // Cancelled: a second calendar file replaces the first.
    await call(lead, "PUT", `/interviews/${made.json().id}`, { cancel: true });
    await drain();
    const cancels = emails().filter((m) => m.subject.startsWith("Cancelled:"));
    expect(cancels).toHaveLength(3);
    expect(new TextDecoder().decode(cancels[0]!.attachments![0]!.content)).toContain("METHOD:CANCEL");
  });

  it("keeps each member's scorecard, averages them, and closes once all have scored", async () => {
    const id = (await schedule([secondId])).json().id;
    const first = await call(lead, "POST", `/interviews/${id}/scorecard`, { criteria: [{ name: "Problem solving", score: 4 }, { name: "Code", score: 3 }], recommendation: "yes", summary: "Solid" });
    expect(first.json()).toMatchObject({ status: "scheduled", scorecard: { recommendation: "yes" } });
    expect((await call(outsider, "POST", `/interviews/${id}/scorecard`, { criteria: [{ name: "Code", score: 5 }], recommendation: "strong_yes" })).statusCode).toBe(409);

    const done = (await call(second, "POST", `/interviews/${id}/scorecard`, { criteria: [{ name: "Problem solving", score: 5 }, { name: "Code", score: 4 }], recommendation: "strong_yes", summary: "Very good" })).json();
    expect(done.status).toBe("done");
    expect(done.scorecard).toEqual({
      criteria: [
        { name: "Problem solving", score: 4.5 },
        { name: "Code", score: 3.5 },
      ],
      recommendation: "strong_yes",
      summary: "Priya Lead: Solid\n\nArjun Second: Very good",
    });
    expect(done.scores.map((s: { name: string }) => s.name)).toEqual(["Priya Lead", "Arjun Second"]);
    expect(done.panel.every((p: { scored: boolean }) => p.scored)).toBe(true);
  });

  it("refuses someone not on the staff as a panel member", async () => {
    expect((await schedule(["no-such-user"])).statusCode).toBe(409);
  });

  it("gives staff the calendar file to download", async () => {
    const id = (await schedule([])).json().id;
    const file = await call(lead, "GET", `/interviews/${id}/calendar`);
    expect(file.statusCode).toBe(200);
    expect(file.headers["content-type"]).toContain("text/calendar");
    expect(file.body).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(file.body).toContain("SUMMARY:Backend round 2");
  });
});

describe("the calendar file and the average", () => {
  it("escapes text and folds long lines", () => {
    const ics = calendar(
      { id: "i1", title: "Round 1; Data, SQL", candidateRef: "", candidateName: "A", candidateEmail: null, interviewer: "B", scheduledAt: "2026-10-06T04:30:00.000Z", minutes: 30, meetingUrl: "https://meet.example/" + "x".repeat(120), problem: "", language: "python", code: "", codeUpdatedAt: null, notes: "", scorecard: null, status: "scheduled", driveId: null, createdAt: "", panel: [] },
      { now: clock, join: "https://p.test/?interview=x", forCandidate: true },
    );
    expect(ics).toContain("SUMMARY:Round 1\\; Data\\, SQL");
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
  });

  it("leans no when the panel splits evenly", () => {
    const card = (recommendation: "yes" | "no") => ({ criteria: [{ name: "Code", score: 3 }], recommendation, summary: "" });
    expect(combine([{ userId: "a", name: "A", scorecard: card("yes"), scoredAt: "" }, { userId: "b", name: "B", scorecard: card("no"), scoredAt: "" }])?.recommendation).toBe("no");
  });
});
