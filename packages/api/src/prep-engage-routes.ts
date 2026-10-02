import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Learner, PracticeSite } from "@parikshaa/store";
import type { PracticeService } from "./practice.js";
import type { PrepEngage } from "./prep-engage.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface PrepEngageRouteDeps {
  readonly practice: PracticeService;
  readonly engage: PrepEngage;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly bearer: (request: FastifyRequest) => string | null;
}

const PREP = ["Prep"];
const ADMIN = ["Prep (staff)"];
const LEARNER = [{ learnerAuth: [] }];
const OPEN: { learnerAuth: never[] }[] = [];
const STAFF = [{ staffAuth: [] }];
const refusals = { 400: S.errorResponse, 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 422: S.errorResponse } as const;
const siteParams = z.object({ site: z.string().min(1).max(40) });
const prefs = z.object({ enabled: z.boolean(), hour: z.number().int().describe("The hour of the day in India (0 to 23) the email goes out.") });
const count = z.object({ cohort: z.number(), returned: z.number() });
const analytics = z.object({
  from: z.string(),
  to: z.string(),
  funnel: z.object({ signedUp: z.number(), startedPlan: z.number(), solvedOne: z.number(), usedTutor: z.number(), bought: z.number() }).describe("Learners who signed up in the window, and what they went on to do."),
  activation: z.object({ cohort: z.number(), activated: z.number() }).describe("Of sign-ups in the window at least a week ago: solved a problem within 7 days."),
  retention: z.object({ d1: count, d7: count }).describe("Of sign-ups in the window: did something the day after (D1), or a week after (D7)."),
  days: z.array(z.object({ day: z.string(), active: z.number(), signups: z.number(), solves: z.number() })).readonly(),
  reminders: z.object({ enabled: z.number(), sentInWindow: z.number() }),
});

/** The daily reminder (Prep blueprint F2), and the console's numbers (§17). */
export function registerPrepEngageRoutes(routes: Routes, deps: PrepEngageRouteDeps): void {
  const { practice, engage, staff, bearer } = deps;
  const siteOf = async (request: FastifyRequest): Promise<PracticeSite> => {
    const site = await practice.site((request.params as { site: string }).site);
    request.orgId = site.orgId;
    return site;
  };
  const signedIn = async (request: FastifyRequest, reply: FastifyReply): Promise<{ site: PracticeSite; learner: Learner } | null> => {
    const site = await siteOf(request);
    const learner = await practice.learner(site, bearer(request) ?? undefined);
    if (learner === null) {
      await reply.code(401).send({ error: "sign_in_required", message: "Sign in to do that" });
      return null;
    }
    return { site, learner };
  };

  routes.get(
    "/practice/:site/reminders",
    {
      schema: {
        tags: PREP,
        summary: "My daily reminder",
        description: "Off until turned on. `email` says whether this server can send email at all, `push` whether it sends notifications; `devices` is how many browsers take them.",
        security: LEARNER,
        params: siteParams,
        response: { 200: prefs.extend({ email: z.boolean(), push: z.boolean(), devices: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await engage.reminder(who.site, who.learner));
    },
  );

  routes.put(
    "/practice/:site/reminders",
    {
      schema: {
        tags: PREP,
        summary: "Turn my daily reminder on or off, and set its hour",
        description: "An email once a day, at the hour given (India's time), on a day the study plan has tasks left or problems are due to revise.",
        security: LEARNER,
        params: siteParams,
        body: prefs,
        response: { 200: prefs, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await engage.saveReminder(who.site, who.learner, request.body));
    },
  );

  routes.post(
    "/practice/:site/reminders/off",
    {
      schema: {
        tags: PREP,
        summary: "Turn a daily reminder off from the link in its email",
        description: "No sign-in: the token in the link names the learner and is signed by this server.",
        security: OPEN,
        params: siteParams,
        body: z.object({ token: z.string().min(1).max(200) }),
        response: { 200: z.object({ off: z.literal(true) }), ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      await engage.turnOff(site, request.body.token);
      return reply.send({ off: true as const });
    },
  );

  // --- the installable app and its notifications ----------------------------------------------

  routes.get(
    "/practice/:site/manifest.webmanifest",
    {
      schema: {
        tags: PREP,
        summary: "The site as an installable app (a web app manifest)",
        description: "Named after the site; opens on the learner's dashboard. JSON, served as application/manifest+json.",
        security: OPEN,
        params: siteParams,
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      const base = `/practice/${site.slug}`;
      const manifest = {
        id: `${base}/`,
        name: site.title,
        short_name: site.title.length <= 12 ? site.title : site.title.slice(0, 12).trimEnd(),
        description: "Practice, a study plan and revision, every day.",
        lang: "en-IN",
        start_url: `${base}/home`,
        scope: `${base}/`,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#4338ca",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      };
      return reply.type("application/manifest+json").header("cache-control", "public, max-age=3600").send(JSON.stringify(manifest));
    },
  );

  routes.get(
    "/practice/:site/push/key",
    {
      schema: {
        tags: PREP,
        summary: "The key a browser subscribes to notifications with",
        description: "Null when this server sends no notifications.",
        security: OPEN,
        params: siteParams,
        response: { 200: z.object({ key: z.string().nullable().describe("The VAPID public key, base64url.") }), ...refusals },
      },
    },
    async (request, reply) => {
      await siteOf(request);
      return reply.send({ key: engage.pushKey() });
    },
  );

  routes.post(
    "/practice/:site/push",
    {
      schema: {
        tags: PREP,
        summary: "Take my daily reminder as a notification in this browser too",
        description: "The browser's push subscription. Only the push services browsers use are accepted. Ten browsers at most.",
        security: LEARNER,
        params: siteParams,
        body: z.object({ endpoint: z.string().min(1).max(1000), keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) }),
        response: { 201: z.object({ devices: z.number() }), ...refusals, 503: S.errorResponse },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      await engage.subscribe(who.site, who.learner, { endpoint: request.body.endpoint, p256dh: request.body.keys.p256dh, auth: request.body.keys.auth });
      return reply.code(201).send({ devices: (await engage.reminder(who.site, who.learner)).devices });
    },
  );

  routes.delete(
    "/practice/:site/push",
    {
      schema: {
        tags: PREP,
        summary: "No more notifications in this browser",
        security: LEARNER,
        params: siteParams,
        body: z.object({ endpoint: z.string().min(1).max(1000) }),
        response: { 200: z.object({ devices: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      await engage.unsubscribe(who.site, who.learner, request.body.endpoint);
      return reply.send({ devices: (await engage.reminder(who.site, who.learner)).devices });
    },
  );

  routes.get(
    "/practice-admin/analytics",
    {
      schema: {
        tags: ADMIN,
        summary: "How learners are doing: the last 30 days",
        description: "Counted from what learners did (sign-ups, solves, lessons, plan tasks, the tutor, orders, the daily check-in). Days are India's.",
        security: STAFF,
        response: { 200: analytics, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send(await engage.analytics(actor.orgId));
    },
  );
}
