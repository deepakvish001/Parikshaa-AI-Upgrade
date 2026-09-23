import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** ROADMAP §8: the sitting live, announcements, and reopening an attempt. Runs as `parikshaa_app`. */

const MINUTE = 60_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let clock: number;
let owner: string;
let invigilator: string;

beforeEach(async () => {
  clock = OPENS;
  db = await freshDatabase();
  ({ app, identity } = await wire(pgliteExecutor(db), { client: fakeModel().client, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await addStaff(identity, org, "inv@acme.test", "invigilator", "Meera Nair");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  invigilator = await signIn(app, "inv@acme.test");
  for (const id of ["drive", "other"]) {
    const res = await call("POST", owner, "/exams", {
      id,
      title: `Drive ${id}`,
      questions: [
        { id: "q1", kind: "mcq", stem: "Pick", maxScore: 2, rubric: [], options: ["a", "b"], correctIndex: 0 },
        { id: "q2", kind: "numeric", stem: "2+2", maxScore: 1, rubric: [], expected: 4, tolerance: 0 },
      ],
      policy: { durationMs: 60 * MINUTE, allowRevision: true, vivaTriggerRatio: 0.99 },
    });
    expect(res.statusCode, res.payload).toBe(201);
    await call("PUT", owner, `/exams/${id}/window`, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * 60 * MINUTE).toISOString() });
  }
  await call("POST", owner, "/exams/drive/invitations/import", {
    csv: "ref,name,email\nR1,Ananya,a@c.test\nR2,Bala,b@c.test\nR3,Chitra,c@c.test\nR4,Dev,d@c.test",
    dryRun: false,
    channels: [],
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });

/** Open the invited candidate `ref`'s link; returns their token and attempt. */
async function open(ref: string, exam = "drive") {
  const list = (await call("GET", owner, `/exams/${exam}/invitations`)).json().invitations as { id: string; candidateRef: string }[];
  const id = list.find((i) => i.candidateRef === ref)!.id;
  const res = await call("POST", null, "/invitations/redeem", { code: new InviteCodes(TOKEN_SECRET).issue("org-a", id) });
  expect(res.statusCode, res.payload).toBe(200);
  return res.json() as { token: string; attemptId: string };
}

const row = (live: { rows: { ref: string }[] }, ref: string) =>
  live.rows.find((r) => r.ref === ref) as unknown as Record<string, unknown> & { flags: Record<string, boolean> };

describe("the sitting, live", () => {
  it("shows who has started, how far they are, and who has gone quiet — and no answer", async () => {
    const ananya = await open("R1"); // typing and here
    const bala = await open("R2"); // page open, nothing typed
    await open("R3"); // opened, then the page went away
    // R4 never opens their link.

    clock += 6 * MINUTE;
    await call("PUT", ananya.token, "/attempts/me/drafts/q2", { answer: "SECRET-DRAFT-4" });
    await call("POST", ananya.token, "/attempts/me/answers", { questionId: "q1", answer: "0" });
    await call("POST", ananya.token, "/attempts/me/heartbeat");
    await call("POST", bala.token, "/attempts/me/heartbeat");

    const res = await call("GET", invigilator, "/exams/drive/live");
    expect(res.statusCode, res.payload).toBe(200);
    const live = res.json();

    expect(live.counts).toMatchObject({ invited: 4, notStarted: 1, inProgress: 3, away: 1, idle: 2 });
    expect(row(live, "R1")).toMatchObject({ name: "Ananya", state: "in_progress", answered: 1, questions: 2, flags: { away: false, idle: false } });
    expect(row(live, "R2").flags).toEqual({ away: false, idle: true, overdue: false });
    expect(row(live, "R3").flags).toMatchObject({ away: true, idle: true });
    expect(row(live, "R4")).toMatchObject({ state: "not_started", attemptId: null });
    expect(res.payload).not.toContain("SECRET-DRAFT");
  });

  it("flags an attempt whose time is up but has not been closed", async () => {
    await open("R1");
    clock += 61 * MINUTE;
    expect(row((await call("GET", invigilator, "/exams/drive/live")).json(), "R1").flags.overdue).toBe(true);
  });

  it("is for staff of the organisation", async () => {
    const { token } = await open("R1");
    expect((await call("GET", token, "/exams/drive/live")).statusCode).toBe(401);
    const other = await addOrganisation(identity, "org-b", "Other");
    await addStaff(identity, other, "owner@other.test", "owner");
    expect((await call("GET", await signIn(app, "owner@other.test"), "/exams/drive/live")).statusCode).toBe(404);
  });
});

describe("announcements", () => {
  it("reach every candidate of the sitting, and only them", async () => {
    const ananya = await open("R1");
    await call("POST", owner, "/exams/other/invitations/import", { csv: "ref,name,email\nX1,Elsewhere,x@c.test", dryRun: false, channels: [] });
    const elsewhere = await open("X1", "other");
    expect((await call("POST", ananya.token, "/attempts/me/heartbeat")).json().announcements).toBe(0);

    const posted = await call("POST", invigilator, "/exams/drive/announcements", { message: "Question 2: log means log base 2." });
    expect(posted.statusCode, posted.payload).toBe(201);
    expect(posted.json()).toMatchObject({ authorName: "Meera Nair" });

    expect((await call("POST", ananya.token, "/attempts/me/heartbeat")).json().announcements).toBe(1);
    expect((await call("GET", ananya.token, "/attempts/me/announcements")).json().announcements).toEqual([
      expect.objectContaining({ message: "Question 2: log means log base 2." }),
    ]);
    expect((await call("GET", elsewhere.token, "/attempts/me/announcements")).json().announcements).toEqual([]);
    expect((await call("GET", invigilator, "/exams/drive/live")).json().announcements).toHaveLength(1);

    const actions = (await call("GET", owner, "/audit")).json().entries.map((e: { action: string }) => e.action);
    expect(actions).toContain("sitting.announced");
  });

  it("are refused to a role that cannot intervene, and when empty", async () => {
    await addStaff(identity, "org-a" as never, "viewer@acme.test", "viewer");
    const viewer = await signIn(app, "viewer@acme.test");
    expect((await call("POST", viewer, "/exams/drive/announcements", { message: "Hello" })).statusCode).toBe(403);
    expect((await call("POST", invigilator, "/exams/drive/announcements", { message: "   " })).statusCode).toBe(422);
  });
});

describe("reopening an attempt", () => {
  const reason = "Laptop crashed and submitted the attempt on its own.";

  it("opens a submitted attempt with more time, on the record, and takes answers again", async () => {
    const { token, attemptId } = await open("R1");
    await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "1" });
    await call("POST", token, "/attempts/me/submit");
    clock += 10 * MINUTE;

    const reopened = await call("POST", invigilator, `/attempts/${attemptId}/reopen`, { minutes: 15, reason });
    expect(reopened.statusCode, reopened.payload).toBe(200);
    expect(reopened.json().expiresAt).toBe(OPENS + 60 * MINUTE); // still inside the hour: nothing added

    const state = (await call("GET", token, "/attempts/me")).json();
    expect(state.state).toBe("in_progress");
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" })).statusCode).toBe(202);
    expect((await call("POST", token, "/attempts/me/submit")).statusCode).toBe(200);

    const ledger = (await call("GET", token, "/attempts/me/ledger")).json();
    expect(ledger.entries.map((e: { event: { type: string } }) => e.event.type)).toEqual([
      "attempt_started",
      "answer_submitted",
      "attempt_submitted",
      "attempt_reopened",
      "answer_submitted",
      "attempt_submitted",
    ]);
    expect(ledger.entries[3].event).toMatchObject({ reason, decidedBy: { name: "Meera Nair" }, extraMs: 0 });
    const list = (await call("GET", owner, "/exams/drive/invitations")).json().invitations;
    expect(list.find((i: { candidateRef: string }) => i.candidateRef === "R1").attemptState).toBe("submitted");
  });

  it("gives the minutes from now when the deadline has already passed", async () => {
    const { token, attemptId } = await open("R1");
    clock += 70 * MINUTE;
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" })).statusCode).toBe(410); // closes it

    const reopened = await call("POST", invigilator, `/attempts/${attemptId}/reopen`, { minutes: 20, reason });
    expect(reopened.json().expiresAt).toBe(clock + 20 * MINUTE);
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" })).statusCode).toBe(202);
    const live = row((await call("GET", invigilator, "/exams/drive/live")).json(), "R1");
    expect(live).toMatchObject({ state: "in_progress", reopened: 1, extraMinutes: 30 });
  });

  it("is refused for an open, graded or set-aside attempt, without a reason, and to a viewer", async () => {
    const { token, attemptId } = await open("R1");
    expect((await call("POST", invigilator, `/attempts/${attemptId}/reopen`, { minutes: 10, reason })).statusCode).toBe(409);
    await call("POST", token, "/attempts/me/submit");
    expect((await call("POST", invigilator, `/attempts/${attemptId}/reopen`, { minutes: 10, reason: "oops" })).statusCode).toBe(422);
    await addStaff(identity, "org-a" as never, "viewer@acme.test", "viewer");
    expect((await call("POST", await signIn(app, "viewer@acme.test"), `/attempts/${attemptId}/reopen`, { minutes: 10, reason })).statusCode).toBe(403);

    await call("POST", owner, `/attempts/${attemptId}/grade`);
    expect((await call("POST", invigilator, `/attempts/${attemptId}/reopen`, { minutes: 10, reason })).statusCode).toBe(409);
  });
});
