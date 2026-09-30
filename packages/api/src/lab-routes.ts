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
import type { LabService } from "./lab.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Lab mode's settings and its start button (docs/PILOT.md, "A sitting in a lab"). */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface LabRouteDeps {
  readonly lab: LabService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Invigilation"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;

const lab = z.object({
  networks: z.array(z.string()).readonly().describe("IP addresses and CIDR ranges candidates may take the exam from; empty means anywhere."),
  startTogether: z.boolean().describe("Candidates wait at the start until an invigilator starts the sitting."),
  startedAt: z.string().nullable().describe("When an invigilator started the sitting; null until then."),
  yourAddress: z.string().describe("The address this request came from: what to add for the room you are in."),
});

export function registerLabRoutes(routes: Routes, deps: LabRouteDeps): void {
  const { lab: service, staff } = deps;

  routes.get(
    "/exams/:examId/lab",
    {
      schema: {
        tags: TAGS,
        summary: "An exam's lab mode",
        description: "Where the exam may be taken from, and whether its candidates wait for the invigilator to start.",
        security: SECURED,
        params: S.examParams,
        response: { 200: lab, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send(await service.get(actor, request.params.examId, request.ip));
    },
  );

  routes.put(
    "/exams/:examId/lab",
    {
      schema: {
        tags: TAGS,
        summary: "Set an exam's lab mode",
        description:
          "Limit the exam to the institution's network, and choose whether candidates wait for the invigilator. A list that leaves out the address of whoever sets it is refused, since it would turn away the room they are in. Takes effect within ten seconds, including for candidates already sitting. Audited.",
        security: SECURED,
        params: S.examParams,
        body: z.object({
          networks: z.array(z.string().max(64)).max(50).readonly(),
          startTogether: z.boolean(),
        }),
        response: { 200: lab, 400: S.errorResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await service.set(actor, request.params.examId, request.body, request.ip));
    },
  );

  routes.post(
    "/exams/:examId/lab/start",
    {
      schema: {
        tags: TAGS,
        summary: "Start the sitting",
        description: "Lets every candidate waiting at the start begin; their own clocks start as each begins. 409 unless the exam is set to wait and has not started. Audited.",
        security: SECURED,
        params: S.examParams,
        response: { 200: z.object({ startedAt: z.string() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:extend");
      if (actor === null) return;
      return reply.send({ startedAt: await service.start(actor, request.params.examId) });
    },
  );
}
