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
import type { ProxyService } from "./proxy.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Signs of a proxy: shared origins, reused identity photos, and the model's photo comparisons. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface ProxyRouteDeps {
  readonly proxy: ProxyService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Proctoring"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 402: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse } as const;
const outcome = z.object({ flagged: z.boolean(), flags: z.array(z.string()).readonly(), summary: z.string() });

export function registerProxyRoutes(routes: Routes, deps: ProxyRouteDeps): void {
  const { proxy, staff } = deps;

  routes.get(
    "/exams/:examId/proxy-report",
    {
      schema: {
        tags: TAGS,
        summary: "Signs that someone sat for someone else",
        description:
          "Candidates who opened the exam from the same network and browser (not counted for an exam held in a lab), identity photos reused byte for byte across attempts, and what the model saw comparing each candidate's photos. Reasons to look, never findings.",
        security: SECURED,
        params: S.examParams,
        response: {
          200: z.object({
            lab: z.boolean(),
            sharedOrigins: z.array(z.object({ candidates: z.array(z.string()).readonly(), attempts: z.number(), from: z.string(), to: z.string() })).readonly(),
            reusedPhotos: z.array(z.object({ candidates: z.array(z.string()).readonly() })).readonly(),
            checks: z.array(z.object({ attemptId: z.string(), ref: z.string(), flagged: z.boolean(), flags: z.array(z.string()).readonly(), summary: z.string(), checkedAt: z.string() })).readonly(),
            unchecked: z.number(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send(await proxy.report(actor, request.params.examId));
    },
  );

  routes.post(
    "/attempts/:attemptId/identity/compare",
    {
      schema: {
        tags: TAGS,
        summary: "Have the model compare a candidate's photos",
        description: "The selfie with the photo ID and with photos taken while answering. Counted against the month's spend cap (402 once reached). Audited; a person decides.",
        security: SECURED,
        params: z.object({ attemptId: z.string() }),
        response: { 200: outcome, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send(await proxy.check(actor, request.params.attemptId));
    },
  );

  routes.post(
    "/exams/:examId/identity/compare",
    {
      schema: {
        tags: TAGS,
        summary: "Compare the photos of every candidate not yet compared",
        description: "Up to `limit` attempts in one go.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ limit: z.number().int().min(1).max(200).default(50) }),
        response: { 200: z.object({ checked: z.number(), flagged: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send(await proxy.checkAll(actor, request.params.examId, request.body.limit));
    },
  );
}
