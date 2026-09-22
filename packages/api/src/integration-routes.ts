import { createHash } from "node:crypto";
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
import type { GreenhouseService } from "./greenhouse.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";
import { WEBHOOK_EVENTS, type WebhookService } from "./webhooks.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface IntegrationRouteDeps {
  readonly webhooks: WebhookService;
  readonly greenhouse: GreenhouseService;
  readonly throttle: LoginThrottle;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const INTEGRATIONS = ["Integrations"];
const GREENHOUSE = ["Greenhouse"];
const SECURED = [{ staffAuth: [] }];
const GREENHOUSE_AUTH = [{ greenhouseKey: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse } as const;

const webhookParams = z.object({ webhookId: z.string().min(1).max(200) });
const webhook = z.object({
  id: z.string(),
  url: z.string(),
  events: z.array(z.string()).readonly().describe("Empty: every event."),
  version: z.number().describe("Moves on each time the secret is rotated."),
  description: z.string(),
  createdAt: z.string(),
  disabled: z.boolean(),
});
const withSecret = z.object({
  webhook,
  secret: z.string().describe("The signing secret, `whsec_…`, in the Standard Webhooks form."),
});
const endpoints = z.record(z.string(), z.string()).describe("The URLs to give Greenhouse's partnerships team.");

export function registerIntegrationRoutes(routes: Routes, deps: IntegrationRouteDeps): void {
  const { webhooks, greenhouse, throttle, staff } = deps;

  // --- webhooks, managed by the organisation's owner ---------------------------

  routes.get(
    "/webhooks",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "List webhooks",
        security: SECURED,
        response: { 200: z.object({ webhooks: z.array(webhook).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send({ webhooks: await webhooks.list(actor) });
    },
  );

  routes.post(
    "/webhooks",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Register a webhook",
        description:
          "Deliveries are signed as Standard Webhooks describes (`webhook-id`, `webhook-timestamp`, `webhook-signature`), so any of its libraries can verify them. HTTPS only, to a public address.",
        security: SECURED,
        body: z.object({
          url: z.string().min(1).max(2000),
          events: z.array(z.enum(WEBHOOK_EVENTS)).max(WEBHOOK_EVENTS.length).default([]),
          description: z.string().max(200).default(""),
        }),
        response: { 201: withSecret, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.code(201).send(await webhooks.add(actor, request.body));
    },
  );

  routes.get(
    "/webhooks/:webhookId/secret",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Show a webhook's signing secret",
        description: "Audited.",
        security: SECURED,
        params: webhookParams,
        response: { 200: z.object({ secret: z.string() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send({ secret: await webhooks.secret(actor, request.params.webhookId) });
    },
  );

  routes.post(
    "/webhooks/:webhookId/rotate",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Give a webhook a new signing secret",
        description: "The old secret stops verifying at once, including for retries of earlier deliveries.",
        security: SECURED,
        params: webhookParams,
        response: { 200: withSecret, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await webhooks.rotate(actor, request.params.webhookId));
    },
  );

  routes.post(
    "/webhooks/:webhookId/disable",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Stop a webhook",
        security: SECURED,
        params: webhookParams,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      await webhooks.disable(actor, request.params.webhookId);
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/webhooks/:webhookId/test",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Send a test delivery",
        security: SECURED,
        params: webhookParams,
        response: { 202: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      await webhooks.test(actor, request.params.webhookId);
      return reply.code(202).send({ ok: true });
    },
  );

  routes.get(
    "/webhooks/:webhookId/deliveries",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "A webhook's recent deliveries",
        security: SECURED,
        params: webhookParams,
        response: {
          200: z.object({
            deliveries: z
              .array(
                z.object({
                  id: z.string(),
                  event: z.string(),
                  attemptId: z.string().nullable(),
                  status: z.string(),
                  attempts: z.number(),
                  error: z.string().nullable(),
                  createdAt: z.string(),
                  sentAt: z.string().nullable(),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send({ deliveries: await webhooks.deliveries(actor, request.params.webhookId) });
    },
  );

  // --- the Greenhouse connector, set up by the owner ----------------------------

  routes.get(
    "/integrations/greenhouse",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Whether the Greenhouse connector is on",
        security: SECURED,
        response: { 200: z.object({ enabled: z.boolean(), endpoints }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await greenhouse.settings(actor));
    },
  );

  routes.post(
    "/integrations/greenhouse/key",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Turn the Greenhouse connector on, or replace its key",
        description: "Give the key to your Greenhouse account manager. A new key stops the previous one working.",
        security: SECURED,
        response: { 200: z.object({ key: z.string(), endpoints }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await greenhouse.issueKey(actor));
    },
  );

  routes.post(
    "/integrations/greenhouse/disable",
    {
      schema: {
        tags: INTEGRATIONS,
        summary: "Turn the Greenhouse connector off",
        security: SECURED,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      await greenhouse.disable(actor);
      return reply.send({ ok: true });
    },
  );

  // --- Greenhouse's calls: Assessment Partner API ------------------------------

  const partner = async (request: FastifyRequest, reply: FastifyReply): Promise<Actor | null> => {
    // Throttled by the credential presented, not the address alone: Greenhouse
    // calls every partner from the same few addresses, and one customer's
    // mistyped key must not lock out every other customer.
    const presented = `greenhouse:${createHash("sha256").update(request.headers.authorization ?? "").digest("hex").slice(0, 32)}`;
    if (throttle.blocked(request.ip, presented)) {
      await reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      return null;
    }
    const actor = await greenhouse.authenticate(request.headers.authorization);
    if (actor === null) {
      throttle.failed(request.ip, presented);
      await reply.code(401).header("www-authenticate", 'Basic realm="parikshaa"').send({ error: "invalid_key" });
      return null;
    }
    return actor;
  };
  const partnerRefusals = { 401: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;

  routes.get(
    "/integrations/greenhouse/list_tests",
    {
      schema: {
        tags: GREENHOUSE,
        summary: "Greenhouse: the tests on offer",
        security: GREENHOUSE_AUTH,
        response: { 200: z.array(z.object({ partner_test_id: z.string(), partner_test_name: z.string() })), ...partnerRefusals },
      },
    },
    async (request, reply) => {
      const actor = await partner(request, reply);
      if (actor === null) return;
      return reply.send(await greenhouse.listTests(actor));
    },
  );

  routes.post(
    "/integrations/greenhouse/send_test",
    {
      schema: {
        tags: GREENHOUSE,
        summary: "Greenhouse: invite a candidate",
        description: "The candidate's invitation email goes out from Parikshaa. Sent again for the same application, it returns the same invitation.",
        security: GREENHOUSE_AUTH,
        body: z.object({
          partner_test_id: z.string().min(1),
          candidate: z.object({
            first_name: z.string().max(200),
            last_name: z.string().max(200),
            preferred_name: z.string().max(200).nullish(),
            email: z.email(),
            phone_number: z.string().max(50).nullish(),
            greenhouse_profile_url: z.string().max(2000).nullish(),
            id: z.union([z.number(), z.string()]).nullish(),
          }),
          application: z.object({ id: z.union([z.number(), z.string()]) }),
          sent_by: z.string().max(320).nullish(),
          url: z.string().max(2000),
        }),
        response: { 200: z.object({ partner_interview_id: z.string() }), ...partnerRefusals },
      },
    },
    async (request, reply) => {
      const actor = await partner(request, reply);
      if (actor === null) return;
      return reply.send(await greenhouse.sendTest(actor, request.body));
    },
  );

  routes.get(
    "/integrations/greenhouse/test_status",
    {
      schema: {
        tags: GREENHOUSE,
        summary: "Greenhouse: where a candidate's test has got to",
        description: "`complete` once the attempt is graded or set aside, with the score as a percentage and a link to the report.",
        security: GREENHOUSE_AUTH,
        querystring: z.object({ partner_interview_id: z.string().min(1).max(200) }),
        response: {
          200: z.object({
            partner_status: z.string(),
            partner_profile_url: z.string().optional(),
            partner_score: z.number().optional(),
            metadata: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
          }),
          ...partnerRefusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await partner(request, reply);
      if (actor === null) return;
      return reply.send(await greenhouse.testStatus(actor, request.query.partner_interview_id));
    },
  );

  routes.post(
    "/integrations/greenhouse/response_error",
    {
      schema: {
        tags: GREENHOUSE,
        summary: "Greenhouse: a reply of ours did not validate",
        description: "Recorded in the audit log.",
        security: GREENHOUSE_AUTH,
        body: z.object({
          api_call: z.string().max(100),
          errors: z.array(z.string().max(1000)).max(100),
          partner_test_id: z.string().nullish(),
          partner_interview_id: z.string().nullish(),
        }),
        response: { 200: z.object({ status: z.literal(200) }), ...partnerRefusals },
      },
    },
    async (request, reply) => {
      const actor = await partner(request, reply);
      if (actor === null) return;
      await greenhouse.responseError(actor, request.body);
      return reply.send({ status: 200 as const });
    },
  );
}
