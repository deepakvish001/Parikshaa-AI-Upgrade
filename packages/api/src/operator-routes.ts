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
import { OperatorRefused, type OperatorService } from "./operator.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/**
 * Parikshaa's operator panel (docs/F1-GO-LIVE-PLAN.md §3, G1): every
 * organisation by its Company ID, making one with its owner, pausing and
 * resuming it, giving credits, and sending the owner's invitation again.
 * Answers 404 to anyone who is not an operator.
 */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const OPERATOR = ["Operator"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse } as const;

const company = z.object({
  id: z.string(),
  publicId: z.string().describe("The Company ID: PKC- and six characters."),
  name: z.string(),
  kind: z.enum(["institution", "company"]),
  createdAt: z.string(),
  suspended: z.object({ at: z.string(), reason: z.string() }).nullable(),
  owner: z.object({ name: z.string(), email: z.string(), verified: z.boolean() }).nullable(),
  staff: z.number().int(),
  exams: z.number().int(),
  invited: z.number().int(),
  started: z.number().int(),
  credits: z.number().int().nullable().describe("Credits left on a prepaid plan; null when invoiced or not billed."),
  lastActivity: z.string().nullable(),
});
const params = z.object({ publicId: z.string().min(1).max(20) });

export function registerOperatorRoutes(
  routes: Routes,
  deps: {
    readonly operator: OperatorService;
    readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  },
): void {
  const { operator, staff } = deps;

  /** Runs `fn` for an operator, answering a refusal in the operator's terms. */
  async function as<T>(request: FastifyRequest, reply: FastifyReply, fn: (actor: Actor) => Promise<T>): Promise<T | undefined> {
    const actor = await staff(request, reply, null);
    if (actor === null) return undefined;
    try {
      return await fn(actor);
    } catch (error) {
      if (!(error instanceof OperatorRefused)) throw error;
      const status = { not_found: 404, operator_needs_2fa: 403, email_taken: 409, invalid: 422 }[error.code];
      await reply.code(status).send(error.code === "not_found" ? { error: "not_found" } : { error: error.code, message: error.message });
      return undefined;
    }
  }

  routes.get(
    "/operator/companies",
    {
      schema: {
        tags: OPERATOR,
        summary: "Every organisation, newest first",
        description: "For Parikshaa's operators only (PARIKSHAA_OPERATORS, signed in with a second factor); anyone else is answered 404.",
        security: SECURED,
        response: { 200: z.object({ companies: z.array(company).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const companies = await as(request, reply, (actor) => operator.companies(actor));
      if (companies !== undefined) return reply.header("cache-control", "no-store").send({ companies });
    },
  );

  routes.post(
    "/operator/companies",
    {
      schema: {
        tags: OPERATOR,
        summary: "Open an organisation with its first owner",
        description:
          "Makes the organisation, its billing plan and starting credits, and its owner, who is emailed a link (valid seven days) to set a password. The owner's address may not already have an account.",
        security: SECURED,
        body: z.object({
          name: z.string().max(120),
          kind: z.enum(["institution", "company"]),
          ownerName: z.string().max(120),
          ownerEmail: z.string().max(320),
          pricePerAttemptRupees: z.number().positive(),
          invoiced: z.boolean().default(false),
          credits: z.number().int().min(0).max(100_000).default(0),
        }),
        response: { 201: company, ...refusals },
      },
    },
    async (request, reply) => {
      const made = await as(request, reply, (actor) => operator.create(actor, request.body));
      if (made !== undefined) return reply.code(201).send(made);
    },
  );

  routes.get(
    "/operator/companies/:publicId",
    {
      schema: { tags: OPERATOR, summary: "One organisation, by its Company ID", security: SECURED, params, response: { 200: company, ...refusals } },
    },
    async (request, reply) => {
      const found = await as(request, reply, (actor) => operator.company(actor, request.params.publicId));
      if (found !== undefined) return reply.header("cache-control", "no-store").send(found);
    },
  );

  routes.post(
    "/operator/companies/:publicId/suspend",
    {
      schema: {
        tags: OPERATOR,
        summary: "Pause an organisation",
        description: "Its staff are signed out and cannot sign in, and its API keys stop working, until it is resumed. Candidates already given links can still take their tests.",
        security: SECURED,
        params,
        body: z.object({ reason: z.string().max(500) }),
        response: { 200: company, ...refusals },
      },
    },
    async (request, reply) => {
      const done = await as(request, reply, (actor) => operator.suspend(actor, request.params.publicId, request.body.reason));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.post(
    "/operator/companies/:publicId/resume",
    {
      schema: { tags: OPERATOR, summary: "Resume a paused organisation", security: SECURED, params, response: { 200: company, ...refusals } },
    },
    async (request, reply) => {
      const done = await as(request, reply, (actor) => operator.resume(actor, request.params.publicId));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.post(
    "/operator/companies/:publicId/credits",
    {
      schema: {
        tags: OPERATOR,
        summary: "Give an organisation credits without payment",
        security: SECURED,
        params,
        body: z.object({ credits: z.number().int().min(1).max(100_000), note: z.string().max(300) }),
        response: { 200: company, ...refusals },
      },
    },
    async (request, reply) => {
      const done = await as(request, reply, (actor) => operator.grant(actor, request.params.publicId, request.body.credits, request.body.note));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.post(
    "/operator/companies/:publicId/invite",
    {
      schema: {
        tags: OPERATOR,
        summary: "Email the owner a new link to set their password",
        security: SECURED,
        params,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const done = await as(request, reply, async (actor) => {
        await operator.reinvite(actor, request.params.publicId);
        return true;
      });
      if (done !== undefined) return reply.send({ ok: true });
    },
  );
}
