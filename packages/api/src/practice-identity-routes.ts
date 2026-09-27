import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { PracticeError, type PracticeService } from "./practice.js";
import type { PracticeIdentity } from "./practice-identity.js";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const PRACTICE = ["Practice"];
const ADMIN = ["Practice (staff)"];
const LEARNER = [{ learnerAuth: [] }];
const OPEN: { learnerAuth: never[] }[] = [];
const STAFF = [{ staffAuth: [] }];
const refusals = { 400: S.errorResponse, 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse, 429: S.errorResponse } as const;

const siteParams = z.object({ site: z.string().min(1).max(40) });
const settingsView = z.object({
  requireVerified: z.boolean(),
  google: z.object({ enabled: z.boolean(), clientId: z.string().nullable(), secretSet: z.boolean() }),
  redirectUri: z.string().nullable().describe("Register this with Google as an authorised redirect URI."),
});
const settingsBody = z.object({
  requireVerified: z.boolean().describe("Learners must verify their email before they submit or comment."),
  google: z.object({
    enabled: z.boolean(),
    clientId: z.string().max(500).nullable(),
    clientSecret: z.string().max(2000).optional().describe("Leave out to keep the one already set."),
  }),
});
const side = z.object({
  learnerId: z.string(),
  name: z.string(),
  language: z.string(),
  source: z.string(),
  status: z.string(),
  submittedAt: z.string(),
});
const similarity = z.object({
  problem: z.object({ id: z.string(), title: z.string() }),
  compared: z.number().int(),
  pairs: z.array(z.object({ a: side, b: side, similarity: z.number(), shared: z.number().int() })).readonly(),
});

export interface PracticeIdentityRouteDeps {
  readonly practice: PracticeService;
  readonly identity: PracticeIdentity;
  readonly service: ExamService;
  readonly bearer: (request: FastifyRequest) => string | null;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

/**
 * Practice sites' identity routes (ROADMAP §15): verifying a learner's email,
 * signing in with Google, and — for staff — how learners sign in, and whose
 * code looks alike.
 */
export function registerPracticeIdentityRoutes(routes: Routes, deps: PracticeIdentityRouteDeps): void {
  const { practice, identity, service, bearer, staff } = deps;

  const siteOf = async (request: FastifyRequest) => {
    const site = await practice.site((request.params as { site: string }).site);
    request.orgId = site.orgId;
    return site;
  };

  routes.get(
    "/practice/:site/sign-in-options",
    {
      schema: {
        tags: PRACTICE,
        summary: "How learners may sign in here",
        security: OPEN,
        params: siteParams,
        response: { 200: z.object({ google: z.boolean(), requireVerified: z.boolean() }), ...refusals },
      },
    },
    async (request, reply) => reply.send(await identity.options(await siteOf(request))),
  );

  routes.post(
    "/practice/:site/verify",
    {
      schema: {
        tags: PRACTICE,
        summary: "Confirm an email address from the emailed link",
        security: OPEN,
        params: siteParams,
        body: z.object({ token: z.string().min(10).max(300) }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      await identity.verify(await siteOf(request), request.body.token);
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/practice/:site/verify/resend",
    {
      schema: {
        tags: PRACTICE,
        summary: "Send the verification email again",
        description: "At most three an hour. Answers 202 whether or not one was sent.",
        security: LEARNER,
        params: siteParams,
        response: { 202: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      const learner = await practice.learner(site, bearer(request) ?? undefined);
      if (learner === null) return reply.code(401).send({ error: "sign_in_required", message: "Sign in to do that" });
      await identity.sendVerification(learner);
      return reply.code(202).send({ ok: true });
    },
  );

  routes.get(
    "/practice/:site/auth/google",
    {
      schema: {
        tags: PRACTICE,
        summary: "Sign in with Google",
        description: "Redirects the browser to Google. Call it as /api/practice/<site>/auth/google, since /practice/… in a browser is the site's page.",
        security: OPEN,
        params: siteParams,
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      try {
        return reply.redirect(await identity.googleStart(site), 302);
      } catch (error) {
        if (error instanceof PracticeError) return reply.redirect(`/practice/${site.slug}?signin_error=${error.code}`, 302);
        throw error;
      }
    },
  );

  routes.get(
    "/practice/:site/auth/google/callback",
    {
      schema: {
        tags: PRACTICE,
        summary: "Where Google sends the browser back",
        description: "Signs the learner in — making their account the first time — and returns to the site with the session in the URL fragment, which no server logs.",
        security: OPEN,
        params: siteParams,
        querystring: z.object({ code: z.string().max(4000).optional(), state: z.string().max(4000).optional(), error: z.string().max(200).optional() }),
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      const { code, state } = request.query;
      if (code === undefined || state === undefined) return reply.redirect(`/practice/${site.slug}?signin_error=sign_in_failed`, 302);
      try {
        const session = await identity.googleCallback(site, code, state);
        return reply.redirect(`/practice/${site.slug}#session=${encodeURIComponent(session.token)}`, 302);
      } catch (error) {
        if (error instanceof PracticeError) return reply.redirect(`/practice/${site.slug}?signin_error=sign_in_failed`, 302);
        throw error;
      }
    },
  );

  // --- staff ------------------------------------------------------------------------------

  routes.get(
    "/practice-admin/sign-in",
    { schema: { tags: ADMIN, summary: "How learners sign in to the practice site", description: "Never the Google client secret.", security: STAFF, response: { 200: settingsView, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await identity.settings(actor.orgId));
    },
  );

  routes.put(
    "/practice-admin/sign-in",
    {
      schema: {
        tags: ADMIN,
        summary: "Require verified email, and set up Google sign-in",
        security: STAFF,
        body: settingsBody,
        response: { 200: settingsView, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const saved = await identity.saveSettings(actor.orgId, request.body);
      await service.recordAudit(actor, "practice.sign_in_saved", actor.orgId, { requireVerified: saved.requireVerified, google: saved.google.enabled });
      return reply.send(saved);
    },
  );

  routes.get(
    "/practice-admin/problems/:id/similarity",
    {
      schema: {
        tags: ADMIN,
        summary: "Learners whose code for a problem looks alike",
        description:
          "Each learner's latest accepted answer (or latest, if none was), compared by winnowing once names, comments, layout and literals are set aside and the starter code taken out. For a person to read; it changes nothing a learner sees.",
        security: STAFF,
        params: z.object({ id: z.string().min(1) }),
        response: { 200: similarity, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      const report = await practice.similarity(actor.orgId, request.params.id);
      await service.recordAudit(actor, "practice.similarity_viewed", request.params.id);
      return reply.send(report);
    },
  );
}
