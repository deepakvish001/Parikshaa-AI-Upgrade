import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel, type FakeModelScript } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** Signs of a proxy: one network and browser for several candidates, a reused photo, and the model's photo comparison. */

const MINUTE = 60_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
const jpeg = (fill: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, fill)]).toString("base64");
const PHONE = "Mozilla/5.0 (Linux; Android 14) Chrome/129";

let db: PGlite;
let app: FastifyInstance;
let owner: string;

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });

async function setUp(identity?: FakeModelScript["identity"]) {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel(identity === undefined ? {} : { identity }).client, now: () => OPENS + MINUTE });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  await call("POST", owner, "/exams", {
    id: "watched",
    title: "Watched",
    questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
    policy: { durationMs: 60 * MINUTE, allowRevision: true, vivaTriggerRatio: 0.99, proctoring: { identity: true, snapshotEverySeconds: 60, browserEvents: true } },
  });
  await call("PUT", owner, "/exams/watched/window", { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 180 * MINUTE).toISOString() });
  await call("POST", owner, "/exams/watched/invitations/import", { csv: "ref,name,email\nR1,Ananya,a@c.test\nR2,Rohan,r@c.test\nR3,Meera,m@c.test", dryRun: false, channels: [] });
}

/** Opens a candidate's attempt from a network and browser, with their identity photos. */
async function sit(ref: string, ip: string, agent: string, selfie: string, id = jpeg(ref.charCodeAt(1) + 20)): Promise<string> {
  const list = (await call("GET", owner, "/exams/watched/invitations")).json().invitations as { id: string; candidateRef: string }[];
  const code = new InviteCodes(TOKEN_SECRET).issue("org-a", list.find((i) => i.candidateRef === ref)!.id);
  const opened = await app.inject({ method: "POST", url: "/invitations/redeem", remoteAddress: ip, headers: { "user-agent": agent }, payload: { code, camera: true } });
  expect(opened.statusCode, opened.payload).toBe(200);
  const { token, attemptId } = opened.json();
  await call("POST", token, "/attempts/me/identity", { selfie, id });
  await call("POST", token, "/attempts/me/snapshots", { image: jpeg(5) });
  return attemptId;
}

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("the proxy report", () => {
  it("names candidates sharing a network and browser, and identity photos used twice", async () => {
    await setUp();
    await sit("R1", "203.0.113.7", PHONE, jpeg(1));
    await sit("R2", "203.0.113.7", PHONE, jpeg(2));
    await sit("R3", "198.51.100.4", "Firefox/131", jpeg(1));

    const report = (await call("GET", owner, "/exams/watched/proxy-report")).json();
    expect(report).toMatchObject({ lab: false, unchecked: 3, checks: [] });
    expect(report.sharedOrigins).toEqual([expect.objectContaining({ candidates: ["R1", "R2"], attempts: 2 })]);
    // R1 and R3 sent the very same selfie.
    expect(report.reusedPhotos).toEqual([{ candidates: ["R1", "R3"] }]);
    // The address itself is never kept.
    expect(JSON.stringify(report)).not.toContain("203.0.113.7");
  });

  it("does not count one network for everyone in a lab", async () => {
    await setUp();
    const set = await app.inject({ method: "PUT", url: "/exams/watched/lab", remoteAddress: "203.0.113.9", headers: bearer(owner), payload: { networks: ["203.0.113.0/24"], startTogether: false } });
    expect(set.statusCode, set.payload).toBe(200);
    await sit("R1", "203.0.113.7", PHONE, jpeg(1));
    await sit("R2", "203.0.113.7", PHONE, jpeg(2));
    expect((await call("GET", owner, "/exams/watched/proxy-report")).json()).toMatchObject({ lab: true, sharedOrigins: [] });
  });

  it("has the model compare each candidate's photos, and flags someone else answering", async () => {
    await setUp({ idMatchesSelfie: "same", snapshots: [{ photo: 1, person: "different", otherPeople: true }], summary: "A different person answers in photo 1." });
    const attempt = await sit("R1", "203.0.113.7", PHONE, jpeg(1));
    const one = (await call("POST", owner, `/attempts/${attempt}/identity/compare`)).json();
    expect(one).toEqual({ flagged: true, flags: ["Someone else answering in photo 1", "Another person in photo 1"], summary: "A different person answers in photo 1." });
    await sit("R2", "198.51.100.4", PHONE, jpeg(2));
    expect((await call("POST", owner, "/exams/watched/identity/compare", {})).json()).toEqual({ checked: 1, flagged: 1 });

    const report = (await call("GET", owner, "/exams/watched/proxy-report")).json();
    expect(report.unchecked).toBe(0);
    expect(report.checks.map((c: { ref: string; flagged: boolean }) => [c.ref, c.flagged])).toEqual([
      ["R1", true],
      ["R2", true],
    ]);
    expect(JSON.stringify((await call("GET", owner, "/audit")).json())).toContain("attempt.identity_compared");
  });
});
