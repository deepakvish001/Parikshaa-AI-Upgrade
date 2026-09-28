import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** The console's home page: sittings around now, the latest actions, and the first steps. */

const HOUR = 3_600_000;
const NOW = Date.parse("2026-10-01T04:30:00Z");

const exam = (id: string, title: string) => ({
  id,
  title,
  questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
  policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
});

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let owner: string;

beforeEach(async () => {
  db = await freshDatabase();
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => NOW }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner", "Asha Rao");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string, url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

const schedule = (id: string, opens: number, closes: number) =>
  call("PUT", owner, `/exams/${id}/window`, { opensAt: new Date(opens).toISOString(), closesAt: new Date(closes).toISOString() });

describe("the dashboard", () => {
  it("starts a new organisation on its first steps, with nothing scheduled", async () => {
    const res = await call("GET", owner, "/dashboard");
    expect(res.statusCode, res.payload).toBe(200);
    expect(res.json()).toMatchObject({
      sittings: [],
      setup: { exams: 0, bankQuestions: 0, scheduled: 0, invited: 0, staff: 1, privacyNotice: false },
    });
  });

  it("lists sittings open, coming and lately closed, in order, and who did what", async () => {
    for (const [id, title] of [
      ["open", "Open now"],
      ["later", "Next week"],
      ["past", "Last month"],
      ["recent", "Closed yesterday"],
    ] as const) {
      expect((await call("POST", owner, "/exams", exam(id, title))).statusCode).toBe(201);
    }
    await schedule("open", NOW - HOUR, NOW + HOUR);
    await schedule("later", NOW + 7 * 24 * HOUR, NOW + 7 * 24 * HOUR + 3 * HOUR);
    await schedule("past", NOW - 30 * 24 * HOUR, NOW - 30 * 24 * HOUR + HOUR);
    await schedule("recent", NOW - 26 * HOUR, NOW - 24 * HOUR);
    await call("POST", owner, "/exams/open/invitations/import", { csv: "ref,name\nCS001,A\nCS002,B", dryRun: false, channels: [] });

    const { sittings, activity, setup } = (await call("GET", owner, "/dashboard")).json();

    expect(sittings.map((s: { title: string }) => s.title)).toEqual(["Closed yesterday", "Open now", "Next week"]);
    expect(sittings[1]).toMatchObject({ examId: "open", invited: 2, started: 0 });
    expect(setup).toMatchObject({ exams: 4, scheduled: 4, invited: 2 });
    expect(activity[0]).toMatchObject({ actor: "Asha Rao" });
    expect(activity.length).toBeLessThanOrEqual(10);
    // Named by the exam it concerns, not an id.
    expect(activity.find((a: { action: string }) => a.action === "invitations.imported")).toMatchObject({ exam: { id: "open", title: "Open now" } });
    expect(activity.find((a: { action: string }) => a.action === "auth.login")?.exam ?? null).toBeNull();
  });

  it("leaves the audit log out for an account that may not read it", async () => {
    await addStaff(identity, "org-a" as never, "author@acme.test", "author");
    const author = await signIn(app, "author@acme.test");
    const res = await call("GET", author, "/dashboard");
    expect(res.statusCode).toBe(200);
    expect(res.json().activity).toBeNull();
  });

  it("shows nothing of another organisation", async () => {
    await call("POST", owner, "/exams", exam("open", "Open now"));
    await schedule("open", NOW - HOUR, NOW + HOUR);
    const other = await addOrganisation(identity, "org-b", "Other");
    await addStaff(identity, other, "owner@other.test", "owner");
    const outsider = await signIn(app, "owner@other.test");
    expect((await call("GET", outsider, "/dashboard")).json()).toMatchObject({ sittings: [], setup: { exams: 0, scheduled: 0 } });
  });
});
