import { createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** ROADMAP §14: camera proctoring an exam's author turns on. Runs as `parikshaa_app`. */

const MINUTE = 60_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
/** Enough of a JPEG for anyone storing it: the magic bytes, then anything. */
const jpeg = (fill: number, size = 400) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size, fill)]);
const b64 = (b: Buffer) => b.toString("base64");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let clock: number;
let owner: string;
let invigilator: string;

const POLICY = { identity: true, snapshotEverySeconds: 60, browserEvents: true };
/** Secure mode alone: no camera at all, the screen shared and the room listened to. */
const SECURE = { identity: false, snapshotEverySeconds: null, browserEvents: true, screenShare: true, audio: true };

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
  for (const [id, proctoring] of [["watched", POLICY], ["open-book", undefined], ["secure", SECURE]] as const) {
    const saved = await call("POST", owner, "/exams", {
      id,
      title: id,
      questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
      policy: { durationMs: 60 * MINUTE, allowRevision: true, vivaTriggerRatio: 0.99, ...(proctoring === undefined ? {} : { proctoring }) },
    });
    expect(saved.statusCode, saved.payload).toBe(201);
    await call("PUT", owner, `/exams/${id}/window`, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * 60 * MINUTE).toISOString() });
    await call("POST", owner, `/exams/${id}/invitations/import`, { csv: "ref,name,email\nR1,Ananya,a@c.test", dryRun: false, channels: [] });
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });

async function redeem(exam: string, camera?: boolean) {
  const list = (await call("GET", owner, `/exams/${exam}/invitations`)).json().invitations as { id: string }[];
  const code = new InviteCodes(TOKEN_SECRET).issue("org-a", list[0]!.id);
  return call("POST", null, "/invitations/redeem", { code, ...(camera === undefined ? {} : { camera }) });
}

async function start(): Promise<{ token: string; attemptId: string }> {
  const opened = await redeem("watched", true);
  expect(opened.statusCode, opened.payload).toBe(200);
  return opened.json();
}

describe("starting a proctored exam", () => {
  it("waits for the camera before the clock starts, and tells the candidate what it will take", async () => {
    const refused = await redeem("watched");
    expect(refused.statusCode).toBe(428);
    expect(refused.json()).toEqual({ error: "camera_required", proctoring: POLICY });
    const list = (await call("GET", owner, "/exams/watched/invitations")).json().invitations as { id: string }[];
    const brief = await call("POST", null, "/invitations/briefing", { code: new InviteCodes(TOKEN_SECRET).issue("org-a", list[0]!.id) });
    expect(brief.json()).toMatchObject({ proctored: true, proctoring: POLICY });
    expect((await call("GET", owner, "/exams/watched/invitations")).json().invitations[0].attemptState).toBe("not_started");

    const { token } = await start();
    const state = (await call("GET", token, "/attempts/me")).json();
    expect(state.exam.proctoring).toEqual(POLICY);
    expect(state.identityCaptured).toBe(false);
  });

  it("asks nothing of an exam that is not proctored", async () => {
    expect((await redeem("open-book")).statusCode).toBe(200);
  });
});

describe("the identity check", () => {
  it("keeps both photos sealed, commits the ledger to their hashes, and happens once", async () => {
    const { token, attemptId } = await start();
    const selfie = jpeg(1);
    const id = jpeg(2);
    const taken = await call("POST", token, "/attempts/me/identity", { selfie: b64(selfie), id: `data:image/jpeg;base64,${b64(id)}` });
    expect(taken.statusCode, taken.payload).toBe(201);
    expect((await call("GET", token, "/attempts/me")).json().identityCaptured).toBe(true);
    expect((await call("POST", token, "/attempts/me/identity", { selfie: b64(selfie), id: b64(id) })).statusCode).toBe(409);

    const view = (await call("GET", invigilator, `/attempts/${attemptId}/proctoring`)).json();
    expect(view.identity).toMatchObject({ selfie: { sha256: sha(selfie) }, id: { sha256: sha(id) }, matchesLedger: true, review: null });
    const photo = await call("GET", invigilator, `/attempts/${attemptId}/proctoring/photos/${view.identity.selfie.id}`);
    expect(photo.headers["content-type"]).toBe("image/jpeg");
    expect(photo.headers["cache-control"]).toBe("no-store");
    expect(photo.rawPayload.equals(selfie)).toBe(true);
  });

  it("refuses what is not a photo, and photos from the candidate's own token for staff routes", async () => {
    const { token, attemptId } = await start();
    const text = Buffer.from("not an image at all, just words ".repeat(10));
    expect((await call("POST", token, "/attempts/me/identity", { selfie: b64(text), id: b64(jpeg(2)) })).statusCode).toBe(422);
    expect((await call("GET", token, `/attempts/${attemptId}/proctoring`)).statusCode).toBe(401);
  });

  it("is decided by a person, with a reason, in the ledger — and only before grading", async () => {
    const { token, attemptId } = await start();
    await call("POST", token, "/attempts/me/identity", { selfie: b64(jpeg(1)), id: b64(jpeg(2)) });

    await addStaff(identity, "org-a" as never, "viewer@acme.test", "viewer");
    const viewer = await signIn(app, "viewer@acme.test");
    expect((await call("POST", viewer, `/attempts/${attemptId}/identity/review`, { outcome: "verified", reason: "Face matches the ID." })).statusCode).toBe(403);
    expect((await call("POST", invigilator, `/attempts/${attemptId}/identity/review`, { outcome: "verified", reason: "ok" })).statusCode).toBe(422);
    const decided = await call("POST", invigilator, `/attempts/${attemptId}/identity/review`, { outcome: "verified", reason: "Face matches the college ID." });
    expect(decided.statusCode, decided.payload).toBe(200);
    expect((await call("GET", invigilator, `/attempts/${attemptId}/proctoring`)).json().identity.review).toMatchObject({
      outcome: "verified",
      decidedBy: "Meera Nair",
    });

    await call("POST", token, "/attempts/me/submit");
    const types = (await call("GET", token, "/attempts/me/ledger")).json().entries.map((e: { event: { type: string } }) => e.event.type);
    expect(types).toEqual(["attempt_started", "identity_captured", "identity_reviewed", "attempt_submitted"]);
    await call("POST", owner, `/attempts/${attemptId}/grade`);
    expect((await call("POST", invigilator, `/attempts/${attemptId}/identity/review`, { outcome: "rejected", reason: "Second look: not them." })).statusCode).toBe(409);
  });
});

describe("secure mode: the screen shared, the room listened to", () => {
  it("asks for the devices before the clock starts, though no camera photo is taken", async () => {
    const refused = await redeem("secure");
    expect(refused.statusCode).toBe(428);
    expect(refused.json()).toEqual({ error: "camera_required", proctoring: SECURE });
    expect((await redeem("secure", true)).statusCode).toBe(200);
  });

  it("records sharing stopping and starting, a second screen and voices heard, as events only", async () => {
    const { token, attemptId } = (await redeem("secure", true)).json();
    const sent = await call("POST", token, "/attempts/me/proctor-events", { events: ["second_screen", "screen_share_off", "screen_share_on", "voice"] });
    expect(sent.statusCode, sent.payload).toBe(202);
    const view = (await call("GET", invigilator, `/attempts/${attemptId}/proctoring`)).json();
    expect(view.policy).toEqual(SECURE);
    expect(view.events.map((e: { kind: string }) => e.kind).sort()).toEqual(["screen_share_off", "screen_share_on", "second_screen", "voice"]);
    expect(view.snapshots).toEqual([]);
    // No camera in this exam: no photos are taken from it.
    expect((await call("POST", token, "/attempts/me/snapshots", { image: b64(jpeg(3)) })).statusCode).toBe(409);
  });

  it("refuses those events from an exam that does not ask for them, and stores nothing of a refused batch", async () => {
    const { token, attemptId } = await start();
    for (const kind of ["screen_share_off", "second_screen", "voice"]) {
      const refused = await call("POST", token, "/attempts/me/proctor-events", { events: ["tab_hidden", kind] });
      expect(refused.statusCode, kind).toBe(409);
    }
    expect((await call("GET", invigilator, `/attempts/${attemptId}/proctoring`)).json().events).toEqual([]);
  });

  it("counts them on the live view", async () => {
    const { token } = (await redeem("secure", true)).json();
    await call("POST", token, "/attempts/me/proctor-events", { events: ["screen_share_off", "voice", "voice"] });
    const live = (await call("GET", invigilator, "/exams/secure/live")).json();
    expect(live.rows[0].proctoring.events).toMatchObject({ screen_share_off: 1, voice: 2 });
  });
});

describe("while the candidate answers", () => {
  it("keeps webcam photos and browser events, and refuses them once the attempt closes", async () => {
    const { token, attemptId } = await start();
    expect((await call("POST", token, "/attempts/me/snapshots", { image: b64(jpeg(3)) })).statusCode).toBe(202);
    expect((await call("POST", token, "/attempts/me/proctor-events", { events: ["tab_hidden", "paste"] })).statusCode).toBe(202);
    expect((await call("POST", token, "/attempts/me/proctor-events", { events: ["screenshot"] })).statusCode).toBe(422);

    const view = (await call("GET", invigilator, `/attempts/${attemptId}/proctoring`)).json();
    expect(view.snapshots).toHaveLength(1);
    expect(view.events.map((e: { kind: string }) => e.kind)).toEqual(["tab_hidden", "paste"]);

    await call("POST", token, "/attempts/me/submit");
    expect((await call("POST", token, "/attempts/me/snapshots", { image: b64(jpeg(3)) })).statusCode).toBe(409);
  });

  it("are refused for an exam that is not proctored", async () => {
    const opened = (await redeem("open-book")).json();
    expect((await call("POST", opened.token, "/attempts/me/snapshots", { image: b64(jpeg(3)) })).statusCode).toBe(409);
  });

  it("show on the live view: the identity check waiting, the camera gone quiet, what the browser said", async () => {
    const { token } = await start();
    await call("POST", token, "/attempts/me/identity", { selfie: b64(jpeg(1)), id: b64(jpeg(2)) });
    await call("POST", token, "/attempts/me/proctor-events", { events: ["tab_hidden"] });
    clock += 5 * MINUTE; // no photo for five minutes, at one a minute
    await call("POST", token, "/attempts/me/heartbeat");

    const live = (await call("GET", invigilator, "/exams/watched/live")).json();
    const row = live.rows[0];
    expect(row.proctoring).toMatchObject({ identity: "pending", snapshots: 0, events: { tab_hidden: 1 } });
    expect(row.flags.cameraOff).toBe(true);
    expect(live.counts).toMatchObject({ cameraOff: 1, identityPending: 1 });
  });

  it("appear in the report as observations, and are erased with the rest", async () => {
    await call("PUT", owner, "/privacy", {
      controllerName: "Acme",
      grievanceName: "DPO",
      grievanceEmail: "dpo@acme.test",
      purpose: "Hiring.",
      retentionDays: 30,
    });
    const list = (await call("GET", owner, "/exams/watched/invitations")).json().invitations as { id: string }[];
    const code = new InviteCodes(TOKEN_SECRET).issue("org-a", list[0]!.id);
    const { token, attemptId } = (await call("POST", null, "/invitations/redeem", { code, camera: true, consent: { noticeVersion: 1 } })).json();
    await call("POST", token, "/attempts/me/identity", { selfie: b64(jpeg(1)), id: b64(jpeg(2)) });
    await call("POST", token, "/attempts/me/snapshots", { image: b64(jpeg(3)) });
    await call("POST", token, "/attempts/me/proctor-events", { events: ["fullscreen_exit"] });
    expect((await call("GET", token, "/attempts/me/data")).json().proctoring.photos).toHaveLength(3);
    await call("POST", token, "/attempts/me/submit");

    const report = (await call("GET", owner, `/attempts/${attemptId}/report`)).json();
    expect(report.proctoring).toEqual({ identity: "pending", identityReason: null, identityDecidedBy: null, snapshots: 1, events: { fullscreen_exit: 1 } });

    const view = (await call("GET", invigilator, `/attempts/${attemptId}/proctoring`)).json();
    await call("POST", owner, `/attempts/${attemptId}/erase`);
    expect((await call("GET", invigilator, `/attempts/${attemptId}/proctoring/photos/${view.snapshots[0].id}`)).statusCode).toBe(404);
    expect((await call("GET", invigilator, `/attempts/${attemptId}/proctoring`)).json().snapshots).toEqual([]);
  });
});
