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
import type { ProgressService } from "./progress.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** A placement cell's view: candidates across its tests. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export function registerProgressRoutes(
  routes: Routes,
  deps: { readonly progress: ProgressService; readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null> },
): void {
  routes.get(
    "/progress",
    {
      schema: {
        tags: ["Results"],
        summary: "Candidates across tests",
        description:
          "Each candidate, by roll number, with their percentage in each graded test (the latest twelve, or those named in exams, comma-separated), their average and the change from their first to their latest; and each test's graded count, mean and qualified count. search keeps roll numbers or names containing it.",
        security: [{ staffAuth: [] }],
        querystring: z.object({ exams: z.string().max(2000).optional(), search: z.string().max(100).optional() }),
        response: {
          200: z.object({
            exams: z
              .array(z.object({ id: z.string(), title: z.string(), date: z.string(), graded: z.number(), meanPercent: z.number().nullable(), qualified: z.number().nullable() }))
              .readonly(),
            candidates: z
              .array(
                z.object({
                  ref: z.string(),
                  name: z.string(),
                  results: z.record(z.string(), z.object({ percent: z.number(), outcome: z.enum(["qualified", "failed"]).nullable() })),
                  average: z.number().nullable(),
                  change: z.number().nullable(),
                }),
              )
              .readonly(),
            available: z.array(z.object({ id: z.string(), title: z.string() })).readonly(),
          }),
          401: S.errorResponse,
          403: S.errorResponse,
          429: S.errorResponse,
        },
      },
    },
    async (request, reply) => {
      const actor = await deps.staff(request, reply, "attempt:review");
      if (actor === null) return;
      const examIds = request.query.exams?.split(",").map((s) => s.trim()).filter((s) => s !== "");
      return reply.send(await deps.progress.progress(actor, { ...(examIds === undefined ? {} : { examIds }), ...(request.query.search === undefined ? {} : { search: request.query.search }) }));
    },
  );

  routes.get(
    "/question-quality",
    {
      schema: {
        tags: ["Results"],
        summary: "Questions worth a second look",
        description:
          "Across the latest twelve tests with at least eight graded papers: questions strong candidates did no better on than weak ones, that very few got (under 20% of the marks), or that almost everyone got (over 95%). Only questions on eight or more graded papers are read.",
        security: [{ staffAuth: [] }],
        response: {
          200: z.object({
            flags: z
              .array(
                z.object({
                  examId: z.string(),
                  examTitle: z.string(),
                  questionId: z.string(),
                  number: z.number(),
                  stem: z.string(),
                  kind: z.string(),
                  appeared: z.number(),
                  facility: z.number(),
                  discrimination: z.number().nullable(),
                  reason: z.enum(["does_not_separate", "too_hard", "too_easy"]),
                }),
              )
              .readonly(),
            questions: z.number().describe("Questions read, across the tests."),
            exams: z.number().describe("Tests read."),
          }),
          401: S.errorResponse,
          403: S.errorResponse,
          429: S.errorResponse,
        },
      },
    },
    async (request, reply) => {
      const actor = await deps.staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await deps.progress.quality(actor));
    },
  );
}
