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
import type { JobTestService } from "./job-test.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** A test from a job: the role library, a draft from a role or a job description, and saving it. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface JobTestRouteDeps {
  readonly jobs: JobTestService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Exams"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 402: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;

const kind = z.enum(["mcq", "numeric", "short", "code"]);
const seniority = z.enum(["fresher", "junior", "mid", "senior"]);

export function registerJobTestRoutes(routes: Routes, deps: JobTestRouteDeps): void {
  const { jobs, staff } = deps;

  routes.get(
    "/job-tests/roles",
    {
      schema: {
        tags: TAGS,
        summary: "The role library",
        description: "Ready tests by role: the sections each draws from the question bank, how many questions, the time and the qualifying mark.",
        security: SECURED,
        response: {
          200: z.object({
            roles: z
              .array(
                z.object({
                  id: z.string(),
                  title: z.string(),
                  summary: z.string(),
                  minutes: z.number(),
                  cutoffPercent: z.number(),
                  sections: z.array(z.object({ id: z.string(), title: z.string(), keywords: z.array(z.string()).readonly(), kinds: z.array(kind).readonly(), count: z.number() })).readonly(),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send({ roles: jobs.roles() });
    },
  );

  routes.post(
    "/job-tests/draft",
    {
      schema: {
        tags: TAGS,
        summary: "Draft a test from a role or a job description",
        description:
          "With `description`, the model reads the job (closest role, seniority, skills beyond the role's) and its cost counts toward the monthly spend cap; with only `roleId`, no model is asked. The questions always come from the organisation's own bank, and `notes` says where it is short. Nothing is saved.",
        security: SECURED,
        body: z.object({ roleId: z.string().optional(), description: z.string().max(20_000).optional(), seniority: seniority.optional() }),
        response: {
          200: z.object({
            title: z.string(),
            roleId: z.string(),
            seniority,
            source: z.enum(["model", "role"]),
            skills: z.array(z.string()).readonly(),
            sections: z
              .array(
                z.object({
                  id: z.string(),
                  title: z.string(),
                  keywords: z.array(z.string()).readonly(),
                  kinds: z.array(kind).readonly(),
                  wanted: z.number(),
                  pick: z.number(),
                  pool: z.array(z.object({ id: z.string(), stem: z.string(), kind: z.string(), topic: z.string(), difficulty: z.string(), maxScore: z.number() })).readonly(),
                }),
              )
              .readonly(),
            durationMinutes: z.number(),
            cutoffPercent: z.number(),
            notes: z.array(z.string()).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await jobs.draft(actor, request.body));
    },
  );

  routes.post(
    "/job-tests",
    {
      schema: {
        tags: TAGS,
        summary: "Save a drafted test as an exam",
        description: "Each section becomes a pool of the bank questions named, of which every candidate draws `pick`. The exam is then an ordinary one, to change in the editor, schedule and send.",
        security: SECURED,
        body: z.object({
          title: z.string().min(1).max(200),
          durationMinutes: z.number().min(5).max(300),
          cutoffPercent: z.number().min(0).max(100).nullable().default(null),
          sections: z.array(z.object({ title: z.string().max(200), questionIds: z.array(z.string()).max(500).readonly(), pick: z.number().int().min(1) })).min(1).max(20).readonly(),
        }),
        response: { 201: z.object({ examId: z.string(), questions: z.number() }), ...refusals, 422: S.examProblems },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.code(201).send(await jobs.create(actor, request.body));
    },
  );
}
