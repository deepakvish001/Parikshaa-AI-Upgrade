import { readFileSync } from "node:fs";
import { join } from "node:path";
import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The practice site's service worker (public/sw.js), run against fakes of
 * what a browser gives one: caches, the network, clients and notifications.
 */

const source = readFileSync(join(__dirname, "../../public/sw.js"), "utf8");
const ORIGIN = "https://exam.test";
const SCOPE = `${ORIGIN}/practice/nit-practice/`;

type Listener = (event: FakeEvent) => void;
interface FakeEvent {
  request?: Request;
  data?: { json: () => unknown } | null;
  notification?: { data: unknown; close: () => void };
  respondWith: (p: Promise<Response>) => void;
  waitUntil: (p: Promise<unknown>) => void;
  responded?: Promise<Response>;
  waited?: Promise<unknown>;
}

function fakeCaches() {
  const stores = new Map<string, Map<string, Response>>();
  // As a browser's cache matches: by URL, fragment left out.
  const keyOf = (k: Request | string) => {
    const url = new URL(typeof k === "string" ? k : k.url, `${ORIGIN}/sw.js`);
    url.hash = "";
    return url.href;
  };
  return {
    stores,
    async open(name: string) {
      const store = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, store);
      return {
        async put(k: Request | string, r: Response) {
          store.set(keyOf(k), r);
        },
        async match(k: Request | string) {
          return store.get(keyOf(k))?.clone();
        },
        async delete(k: Request | string) {
          return store.delete(keyOf(k));
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
}

let listeners: Record<string, Listener>;
let caches: ReturnType<typeof fakeCaches>;
let network: ReturnType<typeof vi.fn>;
let shown: { title: string; options: { body: string; tag?: string; data: { url: string } } }[];
let opened: string[];
let windows: { url: string; focus: ReturnType<typeof vi.fn> }[];

beforeEach(() => {
  listeners = {};
  caches = fakeCaches();
  network = vi.fn();
  shown = [];
  opened = [];
  windows = [];
  const self = {
    addEventListener: (type: string, fn: Listener) => (listeners[type] = fn),
    registration: { scope: SCOPE, showNotification: async (title: string, options: (typeof shown)[number]["options"]) => void shown.push({ title, options }) },
    location: { origin: ORIGIN },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined, matchAll: async () => windows, openWindow: async (url: string) => void opened.push(url) },
  };
  new Function("self", "caches", "fetch", "crypto", source)(self, caches, network, webcrypto);
});

function event(extra: Partial<FakeEvent>): FakeEvent {
  const e: FakeEvent = {
    ...extra,
    respondWith: (p) => void (e.responded = p),
    waitUntil: (p) => void (e.waited = p),
  };
  return e;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const get = (path: string, token?: string) => new Request(`${ORIGIN}${path}`, token === undefined ? {} : { headers: { authorization: `Bearer ${token}` } });

describe("the service worker", () => {
  it("keeps the page when installed, and opens it offline", async () => {
    network.mockResolvedValueOnce(new Response("<!doctype html><title>shell</title>", { status: 200 }));
    const install = event({});
    listeners["install"]!(install);
    await install.waited;
    expect((network.mock.calls[0]![0] as Request).url).toBe(SCOPE);

    network.mockRejectedValueOnce(new TypeError("offline"));
    const nav = event({ request: new Request(`${SCOPE}home`) });
    Object.defineProperty(nav.request!, "mode", { value: "navigate" });
    listeners["fetch"]!(nav);
    expect(await (await nav.responded!).text()).toContain("<title>shell</title>");
  });

  it("answers a learner's day from the network, and from what it kept when offline, for that learner only", async () => {
    network.mockResolvedValueOnce(json({ plan: { today: ["Two sum"] } }));
    const online = event({ request: get("/api/practice/nit-practice/plan", "pl_asha") });
    listeners["fetch"]!(online);
    expect(await (await online.responded!).json()).toEqual({ plan: { today: ["Two sum"] } });

    network.mockRejectedValue(new TypeError("offline"));
    const offline = event({ request: get("/api/practice/nit-practice/plan", "pl_asha") });
    listeners["fetch"]!(offline);
    expect(await (await offline.responded!).json()).toEqual({ plan: { today: ["Two sum"] } });

    // Someone else on the same phone gets nothing of Asha's.
    const other = event({ request: get("/api/practice/nit-practice/plan", "pl_ravi") });
    listeners["fetch"]!(other);
    await expect(other.responded!).rejects.toThrow("offline");
    const stranger = event({ request: get("/api/practice/nit-practice/plan") });
    listeners["fetch"]!(stranger);
    await expect(stranger.responded!).rejects.toThrow("offline");
  });

  it("keeps the tracks, lessons and problems a learner read, for reading offline", async () => {
    for (const path of ["/api/practice/nit-practice/tracks", "/api/practice/nit-practice/tracks/dsa", "/api/practice/nit-practice/lessons/arrays", "/api/practice/nit-practice/problems", "/api/practice/nit-practice/problems/two-sum"]) {
      network.mockResolvedValueOnce(json({ path }));
      const online = event({ request: get(path, "pl_asha") });
      listeners["fetch"]!(online);
      await online.responded;
      network.mockRejectedValueOnce(new TypeError("offline"));
      const offline = event({ request: get(path, "pl_asha") });
      listeners["fetch"]!(offline);
      expect(await (await offline.responded!).json(), path).toEqual({ path });
    }
  });

  it("forgets what it kept for a session the server has ended", async () => {
    network.mockResolvedValueOnce(json({ name: "Asha" }));
    const first = event({ request: get("/api/practice/nit-practice/me", "pl_asha") });
    listeners["fetch"]!(first);
    await first.responded;
    network.mockResolvedValueOnce(json({ error: "sign_in_required" }, 401));
    const ended = event({ request: get("/api/practice/nit-practice/me", "pl_asha") });
    listeners["fetch"]!(ended);
    expect((await ended.responded!).status).toBe(401);
    network.mockRejectedValueOnce(new TypeError("offline"));
    const offline = event({ request: get("/api/practice/nit-practice/me", "pl_asha") });
    listeners["fetch"]!(offline);
    await expect(offline.responded!).rejects.toThrow("offline");
  });

  it("leaves everything else to the network: answers, other sites' data, other origins", () => {
    for (const request of [
      new Request(`${ORIGIN}/api/practice/nit-practice/problems/two-sum/submit`, { method: "POST", body: "{}" }),
      get("/api/practice/nit-practice/problems/two-sum/comments"),
      get("/api/practice/nit-practice/companies"),
      get("/api/practice/nit-practice/problems/two-sum?contest=weekly-1"),
      get("/api/practice/nit-practice/plan?x=1"),
      new Request("https://cdn.example/x.js"),
    ]) {
      const e = event({ request });
      listeners["fetch"]!(e);
      expect(e.responded).toBeUndefined();
    }
  });

  it("shows the daily reminder, and a tap opens its page on this site only", async () => {
    const push = event({ data: { json: () => ({ title: "2 tasks left today", body: "Two sum", url: "/practice/nit-practice/home", tag: "reminder:nit-practice" }) } });
    listeners["push"]!(push);
    await push.waited;
    expect(shown).toEqual([{ title: "2 tasks left today", options: expect.objectContaining({ body: "Two sum", tag: "reminder:nit-practice", data: { url: "/practice/nit-practice/home" } }) }]);

    const close = vi.fn();
    const tap = event({ notification: { data: shown[0]!.options.data, close } });
    listeners["notificationclick"]!(tap);
    await tap.waited;
    expect(close).toHaveBeenCalled();
    expect(opened).toEqual([`${SCOPE}home`]);

    // An address elsewhere is not followed: the site's start opens instead.
    const away = event({ notification: { data: { url: "https://evil.example/" }, close } });
    listeners["notificationclick"]!(away);
    await away.waited;
    expect(opened[1]).toBe(SCOPE);

    // A window already on the page is brought forward, not opened twice.
    windows.push({ url: `${SCOPE}home`, focus: vi.fn() });
    const again = event({ notification: { data: { url: "/practice/nit-practice/home" }, close } });
    listeners["notificationclick"]!(again);
    await again.waited;
    expect(windows[0]!.focus).toHaveBeenCalled();
    expect(opened).toHaveLength(2);
  });
});
