import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { AdmitCodes } from "./seats.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** Exam day in rooms: seats by roll number, admit cards, and who is in the room. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-10T04:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let invigilator: string;

const call = (method: "GET" | "POST" | "PUT", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => OPENS - 24 * HOUR });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering College");
  await addStaff(wiring.identity, org, "tpo@acme.test", "owner");
  await addStaff(wiring.identity, org, "room@acme.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "tpo@acme.test");
  invigilator = await signIn(app, "room@acme.test");
  await call("POST", "/exams", owner, {
    id: "drive",
    title: "Campus drive",
    questions: [{ id: "q1", kind: "mcq", stem: "2 + 2?", maxScore: 1, rubric: [], options: ["3", "4"], correctIndex: 1 }],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  await call("PUT", "/exams/drive/window", owner, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
  const csv = ["ref,name", "CS10,Rohan", "CS2,Ananya", "CS1,Meera", "CS3,Kabir", "CS4,Isha"].join("\n");
  await call("POST", "/exams/drive/invitations/import", owner, { csv, dryRun: false, channels: [] });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("seating", () => {
  it("seats candidates by roll number, room after room", async () => {
    const rooms = [{ centre: "Main block", room: "Lab 1", seats: 3 }, { centre: "Main block", room: "Lab 2", seats: 10 }];
    expect((await call("POST", "/exams/drive/seats", owner, { rooms })).json()).toEqual({ seated: 5, spare: 8 });
    const seats = (await call("GET", "/exams/drive/seats", invigilator)).json().seats;
    expect(seats.map((s: { ref: string; room: string; seat: string }) => `${s.ref}@${s.room}/${s.seat}`)).toEqual(["CS1@Lab 1/01", "CS2@Lab 1/02", "CS3@Lab 1/03", "CS4@Lab 2/01", "CS10@Lab 2/02"]);
    expect(JSON.stringify((await call("GET", "/audit", owner)).json())).toContain("exam.seats_allocated");
  });

  it("refuses rooms too small, a room twice, and an exam that is not there", async () => {
    expect((await call("POST", "/exams/drive/seats", owner, { rooms: [{ room: "Lab 1", seats: 4 }] })).json().message).toMatch(/hold 4 but 5.*1 more/);
    expect((await call("POST", "/exams/drive/seats", owner, { rooms: [{ room: "Lab 1", seats: 4 }, { room: "Lab 1", seats: 4 }] })).statusCode).toBe(409);
    expect((await call("POST", "/exams/nope/seats", owner, { rooms: [{ room: "Lab 1", seats: 9 }] })).statusCode).toBe(404);
  });
});

describe("admit cards", () => {
  beforeEach(async () => {
    await call("POST", "/exams/drive/seats", owner, { rooms: [{ centre: "Main block", room: "Lab 1", seats: 30 }] });
  });

  it("prints a page per candidate, or one candidate's", async () => {
    const all = await call("GET", "/exams/drive/admit-cards.pdf", owner);
    expect(all.headers["content-type"]).toBe("application/pdf");
    expect(all.body.startsWith("%PDF-1.4")).toBe(true);
    expect(all.body).toContain("/Count 5");
    expect(all.body).toContain("(Admit card)");
    const one = await call("GET", "/exams/drive/admit-cards.pdf?ref=CS3", owner);
    expect(one.body).toContain("/Count 1");
    expect(one.body).toContain("(CS3)");
    expect((await call("GET", "/exams/drive/admit-cards.pdf?ref=NOPE", owner)).statusCode).toBe(404);
  });

  it("is the candidate's own to download, and their briefing says where to sit", async () => {
    const invitations = (await call("GET", "/exams/drive/invitations", owner)).json().invitations as { id: string; candidateRef: string }[];
    const code = new InviteCodes(TOKEN_SECRET).issue("org-a", invitations.find((i) => i.candidateRef === "CS2")!.id);
    const card = await app.inject({ method: "GET", url: `/invitations/admit-card.pdf?code=${encodeURIComponent(code)}` });
    expect(card.statusCode).toBe(200);
    expect(card.body).toContain("(CS2)");
    const brief = (await app.inject({ method: "POST", url: "/invitations/briefing", payload: { code } })).json();
    expect(brief.seat).toEqual({ centre: "Main block", room: "Lab 1", seat: "02" });
    expect((await app.inject({ method: "GET", url: "/invitations/admit-card.pdf?code=forged" })).statusCode).toBe(404);
  });
});

describe("attendance", () => {
  beforeEach(async () => {
    await call("POST", "/exams/drive/seats", owner, { rooms: [{ room: "Lab 1", seats: 30 }] });
  });

  it("marks a candidate present from their card's code or roll number, and notices a second scan", async () => {
    const admit = new AdmitCodes(TOKEN_SECRET).issue("org-a", "drive", "CS3");
    const first = (await call("POST", "/exams/drive/attendance", invigilator, { code: admit })).json();
    expect(first).toMatchObject({ ref: "CS3", name: "Kabir", room: "Lab 1", seat: "03", already: null });
    const again = (await call("POST", "/exams/drive/attendance", invigilator, { code: "cs3" })).json();
    expect(again.already).toMatchObject({ by: expect.any(String) });
    const seats = (await call("GET", "/exams/drive/seats", owner)).json().seats;
    expect(seats.filter((s: { present: boolean }) => s.present).map((s: { ref: string }) => s.ref)).toEqual(["CS3"]);
  });

  it("refuses a forged card, another exam's card, and someone not invited", async () => {
    const forged = new AdmitCodes("another-secret-entirely-another-secret").issue("org-a", "drive", "CS3");
    expect((await call("POST", "/exams/drive/attendance", invigilator, { code: forged })).statusCode).toBe(404);
    const other = new AdmitCodes(TOKEN_SECRET).issue("org-a", "elsewhere", "CS3");
    expect((await call("POST", "/exams/drive/attendance", invigilator, { code: other })).statusCode).toBe(409);
    expect((await call("POST", "/exams/drive/attendance", invigilator, { code: "ZZ9" })).statusCode).toBe(404);
  });
});
