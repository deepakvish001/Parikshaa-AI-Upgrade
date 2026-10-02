import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, type PushSubscriptionRecord } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type Mailer } from "./delivery.js";
import type { PrepEngage } from "./prep-engage.js";
import { androidAppFromEnv } from "./android-app.js";
import { isPushEndpoint, type PushMessage, type PushSender } from "./push.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * The practice site as an installable app, and its notifications (Prep
 * blueprint §17, A1), through the HTTP API and the delivery worker. The push
 * service is a fake that records what it is given. Runs as `parikshaa_app`,
 * so row-level security is live; the clock is the test's.
 */

const at = (ist: string) => Date.parse(`${ist}+05:30`);
const PASSWORD = "a long enough password";
const S = "/practice/nit-practice";
const FCM = "https://fcm.googleapis.com/fcm/send/";
const keys = { p256dh: `B${"A".repeat(86)}`, auth: "x".repeat(22) };

let clock = at("2026-10-05T09:30:00");
let db: PGlite;
let app: FastifyInstance;
let engage: PrepEngage;
let worker: DeliveryWorker;
let owner: string;
let started = false;
let pushed: { endpoint: string; message: PushMessage }[];
let gone: Set<string>;

const fakePush: PushSender = {
  publicKey: "BFakePublicKey",
  async send(sub: PushSubscriptionRecord, message: PushMessage) {
    if (gone.has(sub.endpoint)) return "gone";
    pushed.push({ endpoint: sub.endpoint, message });
    return "sent";
  },
};

function call(method: "GET" | "POST" | "PUT" | "DELETE", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}
async function ok(method: "GET" | "POST" | "PUT" | "DELETE", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200) {
  const res = await call(method, token, url, payload);
  expect(res.statusCode, res.payload).toBe(status);
  return res.statusCode === 204 ? null : res.json();
}
const signUp = async (email: string, name: string) => (await ok("POST", null, `${S}/signup`, { name, email, password: PASSWORD })).token as string;

/** A site with a track to plan, as in prep-engage.test.ts; push on, email as given. */
async function start(options: { push: boolean; mailer: Mailer | null }) {
  clock = at("2026-10-05T09:30:00");
  pushed = [];
  gone = new Set();
  db = await freshDatabase();
  started = true;
  const sql = pgliteExecutor(db);
  let identity;
  let handlers;
  ({ app, identity, prepEngage: engage, handlers } = await wire(sql, {
    client: {} as unknown as Anthropic,
    ...(options.mailer === null ? {} : { mailer: options.mailer }),
    ...(options.push ? { push: fakePush } : {}),
    now: () => clock,
  }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@nit.test");
  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: () => "",
    mailer: options.mailer,
    sms: null,
    handlers,
    now: () => clock,
  });
  await ok("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice Hub", welcome: "", open: true }, 200);
  const q = await ok("POST", owner, "/bank", { question: { kind: "mcq", stem: "Arrays are stored how", maxScore: 1, rubric: [], options: ["one", "two"], correctIndex: 1 }, difficulty: "easy" });
  const problem = await ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id });
  const lesson = await ok("POST", owner, "/practice-admin/lessons", { title: "What an array is", body: "# Arrays", estMinutes: 15, published: true });
  await ok("POST", owner, "/practice-admin/tracks", { title: "DSA Basics", description: "", published: true, modules: [{ title: "Arrays", items: [{ lessonId: lesson.id }, { problemId: problem.id }] }] });
}

const plan = { track: "dsa-basics", level: "beginner", deadline: "2026-10-30", dailyMinutes: 60, offDays: [] };

afterEach(async () => {
  if (!started) return;
  started = false;
  await app.close();
  await db.close();
});

describe("push addresses", () => {
  it("are only the push services browsers use", () => {
    expect(isPushEndpoint(`${FCM}abc`)).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QGuQ")).toBe(true);
    expect(isPushEndpoint("https://wns2-pn1p.notify.windows.com/w/?token=abc")).toBe(true);
    expect(isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/fcm/send/abc")).toBe(false);
    expect(isPushEndpoint("https://evil.example/fcm.googleapis.com")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isPushEndpoint("https://user:pw@fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isPushEndpoint("not a url")).toBe(false);
  });
});

describe("the installable app", () => {
  beforeEach(() => start({ push: true, mailer: new OutboxLog() }));

  it("has a manifest named after the site, opening on the dashboard", async () => {
    const res = await call("GET", null, `${S}/manifest.webmanifest`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("application/manifest+json");
    expect(res.json()).toMatchObject({
      name: "NIT Practice Hub",
      short_name: "NIT Practice",
      start_url: "/practice/nit-practice/home",
      scope: "/practice/nit-practice/",
      display: "standalone",
      icons: [{ sizes: "192x192" }, { sizes: "512x512" }, { purpose: "maskable" }],
    });
    expect((await call("GET", null, "/practice/nowhere/manifest.webmanifest")).statusCode).toBe(404);
  });
});

describe("notifications", () => {
  beforeEach(() => start({ push: true, mailer: new OutboxLog() }));

  it("are subscribed to per browser, only at a browser's push service, and turned off again", async () => {
    expect(await ok("GET", null, `${S}/push/key`)).toEqual({ key: "BFakePublicKey" });
    const asha = await signUp("asha@example.com", "Asha");
    expect((await call("POST", null, `${S}/push`, { endpoint: `${FCM}one`, keys })).statusCode).toBe(401);
    expect((await call("POST", asha, `${S}/push`, { endpoint: "https://evil.example/hook", keys })).statusCode).toBe(422);
    expect((await call("POST", asha, `${S}/push`, { endpoint: `${FCM}one`, keys: { p256dh: "short", auth: keys.auth } })).statusCode).toBe(422);
    expect(await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}one`, keys })).toEqual({ devices: 1 });
    // The same browser again (new keys) is still one browser.
    expect(await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}one`, keys: { ...keys, auth: "y".repeat(22) } })).toEqual({ devices: 1 });
    expect(await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}two`, keys })).toEqual({ devices: 2 });
    expect(await ok("GET", asha, `${S}/reminders`)).toEqual({ enabled: false, hour: 19, email: true, push: true, devices: 2 });
    expect(await ok("DELETE", asha, `${S}/push`, { endpoint: `${FCM}two` })).toEqual({ devices: 1 });

    // A browser handed to someone else: the endpoint is theirs now, and Asha's ends.
    const ravi = await signUp("ravi@example.com", "Ravi");
    await ok("POST", ravi, `${S}/push`, { endpoint: `${FCM}one`, keys });
    expect((await ok("GET", asha, `${S}/reminders`)).devices).toBe(0);
    // Ravi's subscription is not Asha's to remove.
    await ok("DELETE", asha, `${S}/push`, { endpoint: `${FCM}one` });
    expect((await ok("GET", ravi, `${S}/reminders`)).devices).toBe(1);
  });

  it("are ten browsers at most", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    for (let i = 0; i < 10; i++) await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}d${i}`, keys });
    expect((await call("POST", asha, `${S}/push`, { endpoint: `${FCM}d10`, keys })).statusCode).toBe(422);
    await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}d3`, keys });
  });

  it("carry the daily reminder with the email, and forget a browser the push service has", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    await ok("POST", asha, `${S}/plan`, plan);
    await ok("PUT", asha, `${S}/reminders`, { enabled: true, hour: 19 });
    await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}phone`, keys });
    await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}old-laptop`, keys });
    gone.add(`${FCM}old-laptop`);

    clock = at("2026-10-05T19:05:00");
    expect(await engage.queueDue(["org-a"])).toBe(1);
    await worker.tick();
    expect(pushed).toEqual([
      {
        endpoint: `${FCM}phone`,
        message: {
          // The first three of the day's tasks, and the streak.
          title: "3 tasks left today on NIT Practice Hub",
          body: "What an array is (15 min)\nArrays are stored how (25 min)\nSprint 1 revision (30 min)\nStart a streak today.",
          url: "/practice/nit-practice/home",
          tag: "reminder:nit-practice",
        },
      },
    ]);
    expect((await ok("GET", asha, `${S}/reminders`)).devices).toBe(1);
  });

  it("go when the account does", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}phone`, keys });
    await ok("PUT", asha, `${S}/profile`, { username: "asha", public: true, bio: "Learning DSA." });
    await ok("DELETE", asha, `${S}/me`, { password: PASSWORD });
    const again = await signUp("asha2@example.com", "Asha Two");
    // The endpoint is free again, and the old public profile is gone.
    expect(await ok("POST", again, `${S}/push`, { endpoint: `${FCM}phone`, keys })).toEqual({ devices: 1 });
    expect((await call("GET", null, `${S}/u/asha`)).statusCode).toBe(404);
  });
});

describe("notifications without email", () => {
  beforeEach(() => start({ push: true, mailer: null }));

  it("still carry the reminder", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    await ok("POST", asha, `${S}/plan`, plan);
    await ok("PUT", asha, `${S}/reminders`, { enabled: true, hour: 19 });
    clock = at("2026-10-05T19:05:00");
    // Nowhere to send it yet: queued, then skipped.
    expect(await engage.queueDue(["org-a"])).toBe(1);
    await worker.tick();
    expect(pushed).toEqual([]);
    await ok("POST", asha, `${S}/push`, { endpoint: `${FCM}phone`, keys });
    clock = at("2026-10-06T19:05:00");
    expect(await engage.queueDue(["org-a"])).toBe(1);
    await worker.tick();
    expect(pushed.map((p) => p.message.url)).toEqual(["/practice/nit-practice/home"]);
  });
});

describe("a server without notifications", () => {
  beforeEach(() => start({ push: false, mailer: new OutboxLog() }));

  it("says so, and takes no subscription", async () => {
    expect(await ok("GET", null, `${S}/push/key`)).toEqual({ key: null });
    const asha = await signUp("asha@example.com", "Asha");
    expect((await call("POST", asha, `${S}/push`, { endpoint: `${FCM}one`, keys })).statusCode).toBe(503);
    expect(await ok("GET", asha, `${S}/reminders`)).toEqual({ enabled: false, hour: 19, email: true, push: false, devices: 0 });
  });
});

describe("the Android app (plan row 43)", () => {
  const FP = Array.from({ length: 32 }, (_, i) => (i * 7).toString(16).padStart(2, "0").toUpperCase()).join(":");

  it("is read from the environment, and refused when it is not a package and a fingerprint", () => {
    expect(androidAppFromEnv({})).toBeNull();
    expect(androidAppFromEnv({ TWA_PACKAGE: "in.parikshaa.practice", TWA_SHA256: `${FP.toLowerCase()}, ${FP}` })).toEqual({ packageName: "in.parikshaa.practice", fingerprints: [FP, FP] });
    expect(() => androidAppFromEnv({ TWA_PACKAGE: "parikshaa", TWA_SHA256: FP })).toThrow(/package name/);
    expect(() => androidAppFromEnv({ TWA_PACKAGE: "in.parikshaa.practice" })).toThrow(/fingerprint/);
    expect(() => androidAppFromEnv({ TWA_PACKAGE: "in.parikshaa.practice", TWA_SHA256: "AB:CD" })).toThrow(/fingerprint/);
  });

  it("is published as Digital Asset Links when configured, and not otherwise", async () => {
    db = await freshDatabase();
    started = true;
    ({ app } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, server: { androidApp: { packageName: "in.parikshaa.practice", fingerprints: [FP] } } }));
    const res = await app.inject({ method: "GET", url: "/.well-known/assetlinks.json" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: "in.parikshaa.practice", sha256_cert_fingerprints: [FP] } },
    ]);
    await app.close();
    ({ app } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic }));
    expect((await app.inject({ method: "GET", url: "/.well-known/assetlinks.json" })).statusCode).toBe(404);
  });
});
