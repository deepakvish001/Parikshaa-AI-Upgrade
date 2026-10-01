import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** The interview room: scheduled by staff, joined by link, code watched as it is typed, scored. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let author: string;

const call = (method: "GET" | "POST" | "PUT", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const open = (method: "GET" | "PUT", url: string, payload?: object) => app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
const codeOf = (link: string) => encodeURIComponent(new URL(link).searchParams.get("interview")!);

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => Date.parse("2026-10-05T05:00:00Z") });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Hiring");
  await addStaff(wiring.identity, org, "hr@acme.test", "owner");
  await addStaff(wiring.identity, org, "author@acme.test", "author");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hr@acme.test");
  author = await signIn(app, "author@acme.test");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("an interview", () => {
  it("is scheduled with a video room, joined by link, and the candidate's code reaches the interviewer", async () => {
    const made = await call("POST", "/interviews", owner, { title: "Backend round 1", candidateName: "Ananya", candidateRef: "J1", scheduledAt: "2026-10-06T10:00:00+05:30", problem: "Reverse a linked list" });
    expect(made.statusCode).toBe(201);
    const interview = made.json();
    expect(interview).toMatchObject({ status: "scheduled", minutes: 45, language: "python", scheduledAt: "2026-10-06T04:30:00.000Z" });
    expect(interview.meetingUrl).toMatch(/^https:\/\/meet\.jit\.si\/parikshaa-/);
    const code = codeOf(interview.link);

    const room = (await open("GET", `/interviews/room/${code}`)).json();
    expect(room).toMatchObject({ title: "Backend round 1", problem: "Reverse a linked list", code: "", meetingUrl: interview.meetingUrl });
    expect(room).not.toHaveProperty("notes");

    expect((await open("PUT", `/interviews/room/${code}/code`, { code: "def rev(h):\n  pass", language: "python" })).statusCode).toBe(200);
    await call("PUT", `/interviews/${interview.id}`, owner, { problem: "Now do it recursively", notes: "Good start" });
    expect((await open("GET", `/interviews/room/${code}`)).json()).toMatchObject({ problem: "Now do it recursively", code: "def rev(h):\n  pass" });
    const seen = (await call("GET", `/interviews/${interview.id}`, owner)).json();
    expect(seen).toMatchObject({ code: "def rev(h):\n  pass", notes: "Good start" });
    expect(seen.codeUpdatedAt).not.toBeNull();
  });

  it("is scored, which closes the room to more code, and is audited", async () => {
    const interview = (await call("POST", "/interviews", owner, { title: "Round 2", candidateName: "Rohan", scheduledAt: "2026-10-06T11:00:00+05:30", meetingUrl: "https://meet.google.com/abc-defg-hij" })).json();
    expect(interview.meetingUrl).toBe("https://meet.google.com/abc-defg-hij");
    expect((await call("POST", `/interviews/${interview.id}/scorecard`, owner, { criteria: [{ name: "Problem solving", score: 6 }], recommendation: "yes" })).statusCode).toBe(409);
    const scored = await call("POST", `/interviews/${interview.id}/scorecard`, owner, { criteria: [{ name: "Problem solving", score: 4 }, { name: "Communication", score: 5 }], recommendation: "strong_yes", summary: "Hire" });
    expect(scored.json()).toMatchObject({ status: "done", scorecard: { recommendation: "strong_yes", summary: "Hire" } });
    expect((await open("PUT", `/interviews/room/${codeOf(interview.link)}/code`, { code: "late", language: "python" })).statusCode).toBe(409);
    const audit = JSON.stringify((await call("GET", "/audit", owner)).json());
    expect(audit).toContain("interview.scheduled");
    expect(audit).toContain("interview.scored");
  });

  it("refuses a non-https call link, an author, a forged link, and a cancelled one", async () => {
    expect((await call("POST", "/interviews", owner, { title: "X", candidateName: "Y", scheduledAt: "2026-10-06T11:00:00Z", meetingUrl: "http://evil.test" })).statusCode).toBe(409);
    expect((await call("POST", "/interviews", author, { title: "X", candidateName: "Y", scheduledAt: "2026-10-06T11:00:00Z" })).statusCode).toBe(403);
    const interview = (await call("POST", "/interviews", owner, { title: "X", candidateName: "Y", scheduledAt: "2026-10-06T11:00:00Z" })).json();
    expect((await open("GET", `/interviews/room/org-a.${interview.id}.forgedforgedforgedforge`)).statusCode).toBe(404);
    await call("PUT", `/interviews/${interview.id}`, owner, { cancel: true });
    expect((await open("GET", `/interviews/room/${codeOf(interview.link)}`)).statusCode).toBe(404);
    expect((await call("GET", "/interviews", owner)).json().interviews[0]).toMatchObject({ status: "cancelled" });
  });
});
