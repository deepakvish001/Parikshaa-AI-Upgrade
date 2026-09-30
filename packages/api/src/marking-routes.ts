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
import type { MarkingService } from "./marking.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Marking by hand: the queue of written answers, and a mark kept or changed. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface MarkingRouteDeps {
  readonly marking: MarkingService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Results"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;

export function registerMarkingRoutes(routes: Routes, deps: MarkingRouteDeps): void {
  const { marking, staff } = deps;

  routes.get(
    "/exams/:examId/marking",
    {
      schema: {
        tags: TAGS,
        summary: "Written answers to read",
        description: "Every graded answer to a written or code question, without names, unread first, with the mark it has now.",
        security: SECURED,
        params: S.examParams,
        response: {
          200: z.object({
            questions: z
              .array(
                z.object({
                  id: z.string(),
                  number: z.number(),
                  stem: z.string(),
                  kind: z.string(),
                  max: z.number(),
                  rubric: z.array(z.string()).readonly(),
                  expectedPoints: z.array(z.string()).readonly(),
                  answers: z.number(),
                  reviewed: z.number(),
                }),
              )
              .readonly(),
            items: z
              .array(
                z.object({
                  attemptId: z.string(),
                  questionId: z.string(),
                  answer: z.string(),
                  language: z.string().nullable(),
                  score: z.number(),
                  max: z.number(),
                  reviewed: z.boolean(),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:grade");
      if (actor === null) return;
      return reply.send(await marking.queue(actor, request.params.examId));
    },
  );

  routes.post(
    "/exams/:examId/marking",
    {
      schema: {
        tags: TAGS,
        summary: "Keep or change an answer's mark",
        description: "Records the answer as read. A different mark is written to the attempt's ledger as score_revised, with who changed it. Audited.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ attemptId: z.string().min(1), questionId: z.string().min(1), score: z.number().min(0) }),
        response: { 200: z.object({ score: z.number(), changed: z.boolean() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:grade");
      if (actor === null) return;
      return reply.send(await marking.mark(actor, request.params.examId, request.body));
    },
  );
}
