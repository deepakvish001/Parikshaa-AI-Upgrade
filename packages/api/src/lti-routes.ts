import { parse as parseQuery } from "node:querystring";
import type {
  FastifyBaseLogger,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { LtiError, type LtiService } from "./lti.js";
import { RateLimiter, type RateLimit } from "./rate-limit.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface LtiRouteDeps {
  readonly lti: LtiService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  /** Requests from one address to the open login and launch; `LAUNCHES` unless given. */
  readonly limit?: RateLimit;
}

const TAG = ["LTI"];
const SECURED = [{ staffAuth: [] }];
const OPEN: { ltiPlatform: never[] }[] = [];
/**
 * The open login and launch, per client address (ROADMAP §10): enough for a
 * lab of learners behind one NAT opening an exam together, not for a loop.
 */
const LAUNCHES: RateLimit = { perSecond: 20, burst: 600 };
const refusals = { 400: S.errorResponse, 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse } as const;

const platformBody = z.object({
  name: z.string().min(1).max(120),
  issuer: z.string().url().describe("The LMS's issuer: for Moodle, its site address, e.g. https://lms.college.ac.in"),
  clientId: z.string().min(1).max(200),
  deploymentIds: z.array(z.string().max(200)).max(20).describe("Empty: any deployment."),
  authLoginUrl: z.string().url().describe("Moodle: <site>/mod/lti/auth.php"),
  authTokenUrl: z.string().url().describe("Moodle: <site>/mod/lti/token.php"),
  jwksUrl: z.string().url().describe("Moodle: <site>/mod/lti/certs.php"),
  enabled: z.boolean().optional(),
});
const platformView = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string(),
  clientId: z.string(),
  deploymentIds: z.array(z.string()).readonly(),
  authLoginUrl: z.string(),
  authTokenUrl: z.string(),
  jwksUrl: z.string(),
  toolKid: z.string(),
  enabled: z.boolean(),
  tool: z
    .object({ toolUrl: z.string(), loginUrl: z.string(), redirectUrl: z.string(), jwksUrl: z.string(), customParameters: z.string() })
    .describe("What to type into the LMS when registering the tool."),
});

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A small page for the browser, which is what an LMS launch lands on. */
function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
<style>body{font:16px/1.55 "IBM Plex Sans",system-ui,sans-serif;margin:0;background:#f6f6f4;color:#0a0a0b}main{max-width:36rem;margin:3rem auto;padding:1.5rem 16px;background:#fff;border:1px solid #e2e2de;border-radius:12px}h1{font-size:1.3rem;margin:0 0 .5rem}code{background:#ebefff;padding:.1rem .3rem;border-radius:4px}a{color:#2349e6}</style>
</head><body><main><h1>${escape(title)}</h1>${body}</main></body></html>`;
}

/**
 * LTI 1.3 (ROADMAP §7): an owner registers their LMS; the LMS starts a login,
 * posts the launch, and fetches the tool's keys.
 */
export function registerLtiRoutes(routes: Routes, deps: LtiRouteDeps): void {
  const { lti, staff } = deps;

  routes.get(
    "/lti/platforms",
    { schema: { tags: TAG, summary: "Registered LMSs", security: SECURED, response: { 200: z.object({ platforms: z.array(platformView).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send({ platforms: await lti.platforms(actor) });
    },
  );

  routes.post(
    "/lti/platforms",
    {
      schema: {
        tags: TAG,
        summary: "Register an LMS (Moodle, Canvas, …) as an LTI 1.3 platform",
        description: "Makes the tool's key pair for this platform. Answers with the URLs to enter in the LMS.",
        security: SECURED,
        body: platformBody,
        response: { 201: platformView, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.code(201).send(await lti.register(actor, request.body));
    },
  );

  routes.put(
    "/lti/platforms/:platformId",
    {
      schema: {
        tags: TAG,
        summary: "Change or switch off a registered LMS",
        security: SECURED,
        params: z.object({ platformId: z.string().min(1) }),
        body: platformBody,
        response: { 200: platformView, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await lti.update(actor, request.params.platformId, request.body));
    },
  );

  routes.get(
    "/lti/:platformId/jwks",
    {
      schema: {
        tags: TAG,
        summary: "The tool's public key, for the LMS",
        security: OPEN,
        params: z.object({ platformId: z.string().min(1) }),
        response: { 200: z.object({ keys: z.array(z.record(z.string(), z.unknown())) }), 404: S.errorResponse },
      },
    },
    async (request, reply) => {
      try {
        return reply.header("cache-control", "public, max-age=300").send(await lti.jwks(request.params.platformId));
      } catch (error) {
        if (error instanceof LtiError) return reply.code(404).send({ error: "not_found" });
        throw error;
      }
    },
  );

  // The LMS posts forms: its login initiation, and the launch itself.
  void routes.register(async (forms) => {
    forms.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
      done(null, parseQuery(String(body)));
    });
    const r = forms.withTypeProvider<ZodTypeProvider>();

    // Anyone can call these, and each looks up a platform: one bucket per address, shared by
    // login and launch. A route names its limiter as `config.rateLimit`; this hook applies it.
    const launches = new RateLimiter(deps.limit ?? LAUNCHES);
    forms.addHook("onRequest", async (request, reply) => {
      const verdict = (request.routeOptions.config as { rateLimit?: RateLimiter }).rateLimit?.take(request.ip);
      if (verdict === undefined || verdict.ok) return;
      return reply
        .code(429)
        .header("retry-after", String(verdict.retryAfterSeconds))
        .type("text/html")
        .send(page("Too many launches from this network", "<p>Wait a minute, then go back to the course and open the activity again.</p>"));
    });

    const login = async (params: Record<string, string | undefined>, reply: FastifyReply) => {
      try {
        return reply.redirect(await lti.login(params), 302);
      } catch (error) {
        if (error instanceof LtiError) return reply.code(400).type("text/html").send(page("This link cannot open Parikshaa", `<p>${escape(error.message)}.</p>`));
        throw error;
      }
    };
    const loginParams = z.record(z.string(), z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v[0]! : v)));

    r.get(
      "/lti/login",
      { schema: { tags: TAG, summary: "The LMS starts a launch (OpenID Connect third-party login)", security: OPEN, querystring: loginParams }, config: { rateLimit: launches } },
      async (request, reply) => login(request.query, reply),
    );
    r.post(
      "/lti/login",
      { schema: { tags: TAG, summary: "The LMS starts a launch, by form post", security: OPEN, body: loginParams }, config: { rateLimit: launches } },
      async (request, reply) => login(request.body, reply),
    );

    r.post(
      "/lti/launch",
      {
        schema: {
          tags: TAG,
          summary: "The LMS posts the signed launch",
          description:
            "A learner is sent to their personal link for the exam the activity names (`exam=<exam id>` as a custom parameter); a teacher sees what the activity sets. Set the activity to open in a new window: Parikshaa's pages will not load inside a frame.",
          security: OPEN,
          body: z.object({ id_token: z.string().min(10).max(20_000), state: z.string().min(10).max(4000) }).passthrough(),
        },
        config: { rateLimit: launches },
      },
      async (request, reply) => {
        try {
          const outcome = await lti.launch(request.body.id_token, request.body.state);
          if (outcome.kind === "learner") return reply.redirect(outcome.redirect, 303);
          return reply
            .type("text/html")
            .send(
              page(
                outcome.examTitle,
                `<p>This activity opens the exam <code>${escape(outcome.examId)}</code> for each learner, with their own attempt. Their grade comes back to this course's grade book once the attempt is graded.</p><p>Invigilate, grade and read results in the <a href="${escape(outcome.consoleUrl)}" target="_blank" rel="noreferrer">Parikshaa console</a>.</p>`,
              ),
            );
        } catch (error) {
          if (error instanceof LtiError) {
            return reply.code(400).type("text/html").send(page("The exam could not be opened", `<p>${escape(error.message)}.</p><p>Go back to the course and open the activity again, or ask your teacher.</p>`));
          }
          throw error;
        }
      },
    );
  });
}
