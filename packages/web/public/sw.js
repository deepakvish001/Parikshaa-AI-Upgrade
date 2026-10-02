/*
 * The practice site's service worker (Prep blueprint §17, A1). Registered by
 * a practice site, scoped to /practice/<site>/; an exam never registers it.
 *
 * - The app shell (the page and its hashed scripts) is kept, so the site opens
 *   without a network.
 * - A learner's day — who they are, the dashboard, the plan — and what they
 *   read — tracks, lessons, the problems they opened — is fetched from
 *   the network when there is one, and kept; offline, the kept copy answers.
 *   Kept copies are filed under a hash of the learner's session, so one
 *   learner's day is never shown to another on a shared phone.
 * - The daily reminder arrives as a push and is shown as a notification; a tap
 *   opens the page it names, on this site only.
 */

const VERSION = "v1";
const SHELL = `parikshaa-shell-${VERSION}`;
const DAY = `parikshaa-day-${VERSION}`;
/**
 * The learner's day, as the site reads it — the site, me, home, the plan —
 * and what they read offline: the tracks, the lessons, the problem list and
 * each problem opened (plan row 42).
 */
const KEPT =
  /^\/api\/practice\/[a-z0-9][a-z0-9-]*(?:\/(?:me|home|plan|focus|revise|tracks(?:\/[a-z0-9-]+)?|lessons\/[a-z0-9-]+|problems(?:\/[a-z0-9-]+)?))?$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => fetch(new Request(self.registration.scope, { headers: { accept: "text/html" } })).then((page) => (page.ok ? cache.put("shell", page) : undefined)))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith("parikshaa-") && n !== SHELL && n !== DAY).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

async function who(request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth === "") return "anyone";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(auth));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The network, kept for later; the kept copy when there is no network. */
async function dayFirstFromNetwork(request) {
  // A query, not a fragment: the cache ignores fragments when it matches.
  const key = `${request.url}?who=${await who(request)}`;
  const cache = await caches.open(DAY);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(key, response.clone());
    // Signed out: nothing of theirs is kept under that session any more.
    else if (response.status === 401) await cache.delete(key);
    return response;
  } catch (error) {
    const kept = await cache.match(key);
    if (kept !== undefined) return kept;
    throw error;
  }
}

async function page(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put("shell", response.clone());
    return response;
  } catch (error) {
    const kept = await cache.match("shell");
    if (kept !== undefined) return kept;
    throw error;
  }
}

/** Hashed file names never change: the kept copy is the copy. */
async function asset(request) {
  const cache = await caches.open(SHELL);
  const kept = await cache.match(request);
  if (kept !== undefined) return kept;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") event.respondWith(page(request));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(asset(request));
  else if (KEPT.test(url.pathname) && url.search === "") event.respondWith(dayFirstFromNetwork(request));
});

self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data === null ? {} : event.data.json();
  } catch {
    message = {};
  }
  const title = typeof message.title === "string" && message.title !== "" ? message.title : "Parikshaa";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof message.body === "string" ? message.body : "",
      tag: typeof message.tag === "string" ? message.tag : undefined,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: typeof message.url === "string" ? message.url : self.registration.scope },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only a page of this site: a notification never opens anywhere else.
  let target = new URL(self.registration.scope);
  try {
    const asked = new URL(event.notification.data?.url ?? "", self.registration.scope);
    if (asked.origin === target.origin && asked.pathname.startsWith(target.pathname)) target = asked;
  } catch {
    // The site's own start, then.
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((open) => {
      const same = open.find((c) => c.url === target.href);
      return same !== undefined ? same.focus() : self.clients.openWindow(target.href);
    }),
  );
});
