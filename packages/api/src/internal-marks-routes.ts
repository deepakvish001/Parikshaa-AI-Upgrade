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
import type { InternalMarksService } from "./internal-marks.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Internal marks (CIA): several exams' results as one sheet for the university. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface InternalMarksRouteDeps {
  readonly internalMarks: InternalMarksService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;

export function registerInternalMarksRoutes(routes: Routes, deps: InternalMarksRouteDeps): void {
  const { internalMarks, staff } = deps;
  routes.post(
    "/reports/internal-marks",
    {
      schema: {
        tags: ["Results"],
        summary: "Internal marks (CIA) across exams",
        description:
          "Each exam's result scaled to the marks its component is worth, optionally the best N of them, rounded as the university asks. Returns the sheet and the same as CSV (roll number, name, each component, total; AB where a student did not sit one). Audited.",
        security: [{ staffAuth: [] }],
        body: z.object({
          components: z.array(z.object({ examId: z.string().min(1), label: z.string().max(60).optional(), marks: z.number().positive().max(1000) })).min(1).max(12),
          best: z.number().int().min(1).optional(),
          rounding: z.enum(["up", "nearest", "none"]).default("up"),
        }),
        response: {
          200: z.object({
            columns: z.array(z.object({ examId: z.string(), label: z.string(), marks: z.number() })).readonly(),
            outOf: z.number(),
            best: z.number().nullable(),
            rows: z.array(z.object({ ref: z.string(), name: z.string(), marks: z.array(z.number().nullable()).readonly(), total: z.number() })).readonly(),
            csv: z.string(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await internalMarks.compute(actor, request.body));
    },
  );
}
