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
import type { OutcomeService } from "./outcomes.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Course outcomes: the CO mapping, the CO–PO matrix, and attainment. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface OutcomeRouteDeps {
  readonly outcomes: OutcomeService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;
const map = z.object({
  mapping: z.record(z.string(), z.array(z.string().max(10)).max(10).readonly()).describe('{ "<question id>": ["CO1", "CO3"] }'),
  matrix: z.record(z.string(), z.record(z.string(), z.number().int())).describe('{ "CO1": { "PO1": 3, "PSO1": 2 } }, strengths 1 to 3'),
  threshold: z.number().int().min(1).max(100).default(60).describe("The share of a CO's marks that counts as attaining it, in percent."),
});

export function registerOutcomeRoutes(routes: Routes, deps: OutcomeRouteDeps): void {
  const { outcomes, staff } = deps;

  routes.get(
    "/exams/:examId/outcomes",
    {
      schema: {
        tags: ["Results"],
        summary: "Course outcomes: the mapping and the CO–PO matrix",
        security: SECURED,
        params: S.examParams,
        response: { 200: map.extend({ questions: z.array(z.object({ id: z.string(), number: z.number(), stem: z.string(), maxScore: z.number() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await outcomes.get(actor, request.params.examId));
    },
  );

  routes.put(
    "/exams/:examId/outcomes",
    {
      schema: { tags: ["Results"], summary: "Map questions to course outcomes, and COs to POs", description: "Audited.", security: SECURED, params: S.examParams, body: map, response: { 200: S.okResponse, ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      await outcomes.set(actor, request.params.examId, request.body);
      return reply.send({ ok: true });
    },
  );

  routes.get(
    "/exams/:examId/attainment",
    {
      schema: {
        tags: ["Results"],
        summary: "CO and PO attainment",
        description:
          "Each CO: candidates whose paper set it, how many earned at least the threshold of its marks, and its level (3 at 70% of candidates, 2 at 60%, 1 at 50%). Each PO: the average of its COs' levels weighted by the matrix.",
        security: SECURED,
        params: S.examParams,
        response: {
          200: z.object({
            threshold: z.number(),
            candidates: z.number(),
            courseOutcomes: z.array(z.object({ co: z.string(), questions: z.number(), candidates: z.number(), attained: z.number(), percent: z.number(), level: z.number() })).readonly(),
            programmeOutcomes: z.array(z.object({ po: z.string(), level: z.number() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await outcomes.attainment(actor, request.params.examId));
    },
  );
}
