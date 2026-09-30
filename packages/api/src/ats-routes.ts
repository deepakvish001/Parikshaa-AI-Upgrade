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
import { ATS_PROVIDERS, type AtsService } from "./ats.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface AtsRouteDeps {
  readonly ats: AtsService;
  readonly throttle: LoginThrottle;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const INTEGRATIONS = ["Integrations"];
const SECURED = [{ staffAuth: [] }];
const HOOK: { atsKey: never[] }[] = [];
const refusals = { 400: S.errorResponse, 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse, 429: S.errorResponse, 502: S.errorResponse } as const;

const provider = z.enum(ATS_PROVIDERS as unknown as ["lever", "zoho_recruit", "darwinbox"]);
const providerParams = z.object({ provider });
const view = z.object({
  provider,
  label: z.string(),
  configured: z.boolean(),
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()).describe("Not secret: Lever's stage-to-exam map, Zoho's data centre, Darwinbox's callback address."),
  credentialsSet: z.boolean().describe("Credentials are stored sealed and never returned."),
});

/**
 * Lever, Zoho Recruit and Darwinbox (ROADMAP §7): set up by an owner, and
 * each ATS's hook, which authenticates by the key in its path.
 */
export function registerAtsRoutes(routes: Routes, deps: AtsRouteDeps): void {
  const { ats, throttle, staff } = deps;

  routes.get(
    "/integrations/ats",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Lever, Zoho Recruit and Darwinbox connectors",
        security: SECURED,
        response: { 200: z.object({ connectors: z.array(view).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send({ connectors: await ats.list(actor) });
    },
  );

  routes.put(
    "/integrations/ats/:provider",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Set up an ATS connector, and turn it on",
        description: [
          "`lever`: settings `{ stageExams: { <Lever stage id>: <exam id> } }`, credentials `{ apiKey, signatureToken }` (the webhook's signature token).",
          "`zoho_recruit`: settings `{ dataCentre: 'in' | 'com' | 'eu' | …, defaultExamId }`, credentials `{ clientId, clientSecret, refreshToken }` (a self-client with ZohoRecruit.modules.ALL).",
          "`darwinbox`: settings `{ callbackUrl, defaultExamId }`, credentials `{ callbackToken }`.",
          "Leave `credentials` out to keep the stored ones.",
        ].join(" "),
        security: SECURED,
        params: providerParams,
        body: z.object({ settings: z.record(z.string(), z.unknown()), credentials: z.record(z.string(), z.string()).optional() }),
        response: { 200: view, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await ats.save(actor, request.params.provider, request.body.settings, request.body.credentials));
    },
  );

  routes.post(
    "/integrations/ats/:provider/key",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Issue the hook URL the ATS calls",
        description: "The URL carries a new key; it is in this response and nowhere else, and the previous one stops working.",
        security: SECURED,
        params: providerParams,
        response: { 200: z.object({ key: z.string(), hookUrl: z.string() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await ats.issueKey(actor, request.params.provider));
    },
  );

  routes.post(
    "/integrations/ats/:provider/check",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Test a connector's credentials",
        description:
          "A call to the live account that changes nothing there: Lever lists its stages (and checks the mapped ones exist), Zoho exchanges the refresh token, Darwinbox's callback is asked whether it answers. ok false says what was refused. Audited.",
        security: SECURED,
        params: providerParams,
        response: { 200: z.object({ ok: z.boolean(), detail: z.string() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await ats.check(actor, request.params.provider));
    },
  );

  routes.post(
    "/integrations/ats/:provider/disable",
    { schema: { tags: INTEGRATIONS, summary: "Turn an ATS connector off", security: SECURED, params: providerParams, response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      await ats.disable(actor, request.params.provider);
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/integrations/ats/:provider/hook/:key",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "The ATS asks for a test",
        description:
          "Called by Lever (a `candidateStageChange` webhook, whose signature is checked too), Zoho Recruit (a workflow webhook) or Darwinbox. The key in the path is the credential. Invites the candidate — the same invitation if asked again — and answers 202.",
        security: HOOK,
        params: z.object({ provider, key: z.string().min(10).max(400) }),
        body: z.unknown(),
        response: {
          202: z.object({ invitationId: z.string().optional(), ignored: z.string().optional() }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      // Guessing keys is throttled like guessing passwords, per address.
      const account = `ats:${request.params.provider}`;
      if (throttle.blocked(request.ip, account)) return reply.code(429).send({ error: "too_many_attempts", message: "Try again later" });
      try {
        return reply.code(202).send(await ats.inbound(request.params.provider, request.params.key, request.body));
      } catch (error) {
        if ((error as { code?: string }).code === "unauthorised") throttle.failed(request.ip, account);
        throw error;
      }
    },
  );
}
