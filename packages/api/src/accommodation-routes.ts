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
import type { AccommodationService } from "./accommodations.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Arrangements for candidates with a disability: extra time, a scribe, larger text (CL62). */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface AccommodationRouteDeps {
  readonly accommodations: AccommodationService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Candidates"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;
const accommodation = z.object({
  candidateRef: z.string(),
  extraPercent: z.number(),
  scribe: z.boolean(),
  largeText: z.boolean(),
  note: z.string().describe("Staff only; never shown to the candidate."),
  setBy: z.object({ userId: z.string(), name: z.string() }),
  setAt: z.string(),
});
const refParams = S.examParams.extend({ ref: z.string().min(1).max(100) });

export function registerAccommodationRoutes(routes: Routes, deps: AccommodationRouteDeps): void {
  const { accommodations, staff } = deps;

  routes.get(
    "/exams/:examId/accommodations",
    { schema: { tags: TAGS, summary: "Candidates' arrangements for a disability", security: SECURED, params: S.examParams, response: { 200: z.object({ accommodations: z.array(accommodation).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:extend");
      if (actor === null) return;
      return reply.send({ accommodations: await accommodations.list(actor, request.params.examId) });
    },
  );

  routes.put(
    "/exams/:examId/accommodations/:ref",
    {
      schema: {
        tags: TAGS,
        summary: "Set a candidate's arrangements",
        description:
          "Extra time as a share of the paper's (20 minutes an hour is 33), added to the attempt's ledger as it starts; a scribe; larger text. Set before the candidate starts; for an attempt already open, extend its time instead. Audited, without the note.",
        security: SECURED,
        params: refParams,
        body: z.object({ extraPercent: z.number().int().min(0).max(100), scribe: z.boolean().default(false), largeText: z.boolean().default(false), note: z.string().max(4000).default("") }),
        response: { 200: accommodation, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:extend");
      if (actor === null) return;
      return reply.send(await accommodations.set(actor, request.params.examId, request.params.ref, request.body));
    },
  );

  routes.delete(
    "/exams/:examId/accommodations/:ref",
    { schema: { tags: TAGS, summary: "Remove a candidate's arrangements", description: "Audited.", security: SECURED, params: refParams, response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:extend");
      if (actor === null) return;
      await accommodations.remove(actor, request.params.examId, request.params.ref);
      return reply.send({ ok: true });
    },
  );
}
