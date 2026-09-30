import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { InviteCodes } from "./invite-codes.js";
import { admitted, networkProblem } from "./lab.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** Lab mode: an exam taken only from the college's network, and started for everyone at once. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
const LAB = "203.0.113.";
const STAFF_IP = `${LAB}10`;

let db: PGlite;
let app: FastifyInstance;
let clock: number;
let owner: string;
let invigilator: string;
const codes = new InviteCodes(TOKEN_SECRET);
let invitationOf: Map<string, string>;

const call = (method: "GET" | "POST" | "PUT", url: string, token: string, payload?: object, ip = STAFF_IP) =>
  app.inject({ method, url, remoteAddress: ip, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const open = (ref: string, ip: string) =>
  app.inject({ method: "POST", url: "/invitations/redeem", remoteAddress: ip, payload: { code: codes.issue("org-a", invitationOf.get(ref)!) } });
const setLab = (networks: string[], startTogether = false) => call("PUT", "/exams/drive/lab", owner, { networks, startTogether });

beforeEach(async () => {
  clock = OPENS + 60_000;
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => clock });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await addStaff(wiring.identity, org, "watch@acme.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  invigilator = await signIn(app, "watch@acme.test");
  await call("POST", "/exams", owner, {
    id: "drive",
    title: "Campus drive",
    questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  await call("PUT", "/exams/drive/window", owner, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
  await call("POST", "/exams/drive/invitations/import", owner, { csv: "ref,name\nCS001,Ananya\nCS002,Rohan", dryRun: false });
  invitationOf = new Map(
    ((await call("GET", "/exams/drive/invitations", owner)).json().invitations as { id: string; candidateRef: string }[]).map((i) => [i.candidateRef, i.id]),
  );
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("networks", () => {
  it("reads addresses and ranges, and says what is wrong with one that is not", () => {
    expect(networkProblem("203.0.113.0/24")).toBeNull();
    expect(networkProblem("2001:db8::/32")).toBeNull();
    expect(networkProblem("203.0.113.7")).toBeNull();
    expect(networkProblem("lab-1")).toMatch(/not an IP address/);
    expect(networkProblem("203.0.113.0/33")).toMatch(/0 to 32/);
    expect(admitted(["203.0.113.0/24"], "::ffff:203.0.113.99")).toBe(true);
    expect(admitted(["203.0.113.0/24"], "198.51.100.1")).toBe(false);
    expect(admitted([], "198.51.100.1")).toBe(true);
  });

  it("lets a candidate in from the lab, and turns one away from anywhere else, with a reason", async () => {
    expect((await setLab([`${LAB}0/24`])).statusCode).toBe(200);
    const away = await open("CS001", "198.51.100.1");
    expect(away.statusCode).toBe(403);
    expect(away.json()).toMatchObject({ error: "outside_network" });
    expect((await open("CS001", `${LAB}21`)).statusCode).toBe(200);
  });

  it("stops a candidate who carries on from outside, while the window is open, and not after", async () => {
    await setLab([`${LAB}0/24`]);
    const { token } = (await open("CS001", `${LAB}21`)).json();
    const answer = (ip: string) => app.inject({ method: "POST", url: "/attempts/me/answers", remoteAddress: ip, headers: bearer(token), payload: { questionId: "q1", answer: "0" } });
    expect((await answer(`${LAB}21`)).statusCode).toBe(202);
    const outside = await answer("198.51.100.1");
    expect(outside.statusCode).toBe(403);
    expect(outside.json()).toMatchObject({ error: "outside_network" });

    clock = OPENS + 3 * HOUR + 60_000;
    const record = await app.inject({ method: "GET", url: "/attempts/me", remoteAddress: "198.51.100.1", headers: bearer(token) });
    expect(record.statusCode).not.toBe(403);
  });

  it("refuses a list that would turn away the room staff are setting it from, or an entry that is not a network", async () => {
    const locked = await setLab(["198.51.100.0/24"]);
    expect(locked.statusCode).toBe(409);
    expect(locked.json().message).toMatch(/Your own address, 203\.0\.113\.10/);
    expect((await setLab(["lab one"])).statusCode).toBe(409);
    const view = (await call("GET", "/exams/drive/lab", owner)).json();
    expect(view).toEqual({ networks: [], startTogether: false, startedAt: null, yourAddress: STAFF_IP });
  });
});

describe("starting together", () => {
  it("holds candidates at the start until the invigilator starts the sitting, and records who did", async () => {
    await setLab([], true);
    const held = await open("CS001", "198.51.100.1");
    expect(held.statusCode).toBe(403);
    expect(held.json()).toMatchObject({ error: "waiting_for_start" });

    expect((await call("POST", "/exams/drive/lab/start", invigilator)).json()).toEqual({ startedAt: new Date(clock).toISOString() });
    expect((await open("CS001", "198.51.100.1")).statusCode).toBe(200);
    expect((await call("GET", "/exams/drive/lab", owner)).json().startedAt).toBe(new Date(clock).toISOString());
    expect((await call("POST", "/exams/drive/lab/start", invigilator)).statusCode).toBe(409);

    const audit = JSON.stringify((await call("GET", "/audit", owner)).json());
    expect(audit).toContain("exam.lab_set");
    expect(audit).toContain("exam.lab_started");
  });

  it("holds the next batch when waiting is turned on again, without stopping anyone already begun", async () => {
    await setLab([], true);
    await call("POST", "/exams/drive/lab/start", invigilator);
    const { token } = (await open("CS001", "198.51.100.1")).json();
    await setLab([], false);
    await setLab([], true);
    expect((await open("CS002", "198.51.100.1")).json()).toMatchObject({ error: "waiting_for_start" });
    expect((await open("CS001", "198.51.100.1")).statusCode).toBe(200);
    const answer = await app.inject({ method: "POST", url: "/attempts/me/answers", headers: bearer(token), payload: { questionId: "q1", answer: "0" } });
    expect(answer.statusCode).toBe(202);
  });

  it("is set by those who write exams, and started by invigilators", async () => {
    expect((await call("PUT", "/exams/drive/lab", invigilator, { networks: [], startTogether: true })).statusCode).toBe(403);
    expect((await call("GET", "/exams/drive/lab", invigilator)).statusCode).toBe(200);
  });
});
