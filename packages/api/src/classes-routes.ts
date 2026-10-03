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
import { MAX_CLASS_ITEMS, type ClassService } from "./classes.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Classes (plan row 95, F2 Campus): a cohort, its course, its tests and contests, and its attendance. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const TAGS = ["Classes"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse } as const;

const params = z.object({ id: z.string().min(1).max(100) });
const sessionParams = params.extend({ sessionId: z.string().min(1).max(100) });

const summary = z.object({
  id: z.string(),
  name: z.string(),
  cohort: z.object({ id: z.string(), name: z.string() }),
  track: z.object({ id: z.string(), title: z.string() }).nullable().describe("The course the class works through: one of the practice site's tracks."),
  tests: z.number().int(),
  contests: z.number().int(),
  createdAt: z.string(),
});

const session = z.object({
  id: z.string(),
  heldOn: z.string().describe("YYYY-MM-DD"),
  topic: z.string(),
  marks: z.record(z.string(), z.boolean()).describe("Present or not, by the address the cohort knows each student by."),
});

const report = z.object({
  class: summary,
  course: z.object({ lessons: z.number().int(), problems: z.number().int() }),
  tests: z.array(z.object({ examId: z.string(), title: z.string() })).readonly(),
  contests: z.array(z.object({ id: z.string(), title: z.string(), problems: z.number().int(), startsAt: z.string() })).readonly(),
  sessions: z.array(z.object({ id: z.string(), heldOn: z.string(), topic: z.string(), present: z.number().int(), marked: z.number().int() })).readonly(),
  students: z
    .array(
      z.object({
        email: z.string(),
        name: z.string().nullable(),
        joined: z.boolean().describe("Whether the student has an account on the practice site."),
        course: z.object({ lessonsDone: z.number().int(), problemsSolved: z.number().int(), percent: z.number().nullable() }),
        tests: z.record(z.string(), z.number().nullable()).describe("Percent in each test, by exam: the best graded attempt under the student's address. Null when not sat, not graded, or for an account that may not review marks."),
        contests: z.record(z.string(), z.number().int()).describe("Problems solved in each contest, by contest."),
        attendance: z.object({ present: z.number().int(), of: z.number().int(), percent: z.number().nullable() }),
        lastActiveAt: z.string().nullable(),
      }),
    )
    .readonly(),
});

export function registerClassRoutes(
  routes: Routes,
  deps: {
    readonly classes: ClassService;
    readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  },
): void {
  const { classes, staff } = deps;

  routes.get(
    "/classes",
    { schema: { tags: TAGS, summary: "Every class", security: SECURED, response: { 200: z.object({ classes: z.array(summary).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ classes: await classes.list(actor) });
    },
  );

  routes.get(
    "/classes/options",
    {
      schema: {
        tags: TAGS,
        summary: "What a class can be made from",
        description: "The practice site's cohorts and courses (tracks), its contests, and the exams not put away.",
        security: SECURED,
        response: {
          200: z.object({
            cohorts: z.array(z.object({ id: z.string(), name: z.string() })).readonly(),
            tracks: z.array(z.object({ id: z.string(), title: z.string() })).readonly(),
            contests: z.array(z.object({ id: z.string(), title: z.string(), startsAt: z.string() })).readonly(),
            exams: z.array(z.object({ id: z.string(), title: z.string() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send(await classes.options(actor));
    },
  );

  routes.post(
    "/classes",
    {
      schema: {
        tags: TAGS,
        summary: "Make a class",
        description: "From a cohort of the practice site's students (Campus), with the course they work through. Tests, contests and sessions are added afterwards. Audited.",
        security: SECURED,
        body: z.object({ name: z.string().min(1).max(120), cohortId: z.string().min(1).max(100), trackId: z.string().min(1).max(100).nullable().default(null) }),
        response: { 201: summary, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.code(201).send(await classes.create(actor, request.body));
    },
  );

  routes.get(
    "/classes/:id",
    {
      schema: {
        tags: TAGS,
        summary: "A class, each student on a line",
        description: "How much of the course each student has done, their mark in each test, what they solved in each contest, and their attendance. Marks need attempt:review.",
        security: SECURED,
        params,
        response: { 200: report, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send(await classes.report(actor, request.params.id));
    },
  );

  routes.put(
    "/classes/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Change a class's course, tests or contests",
        description: `Each field given replaces what was there; leave one out to keep it. At most ${MAX_CLASS_ITEMS} tests and ${MAX_CLASS_ITEMS} contests. Audited.`,
        security: SECURED,
        params,
        body: z.object({
          trackId: z.string().min(1).max(100).nullable().optional(),
          examIds: z.array(z.string().min(1).max(200)).max(MAX_CLASS_ITEMS).optional(),
          contestIds: z.array(z.string().min(1).max(200)).max(MAX_CLASS_ITEMS).optional(),
        }),
        response: { 200: report, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await classes.update(actor, request.params.id, request.body));
    },
  );

  routes.get(
    "/classes/:id/sessions",
    {
      schema: { tags: TAGS, summary: "A class's sessions, with who was present", security: SECURED, params, response: { 200: z.object({ sessions: z.array(session).readonly() }), ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ sessions: await classes.sessions(actor, request.params.id) });
    },
  );

  routes.post(
    "/classes/:id/sessions",
    {
      schema: {
        tags: TAGS,
        summary: "Add a session: a lecture or a lab, on a day",
        security: SECURED,
        params,
        body: z.object({ heldOn: z.string().min(10).max(10).describe("YYYY-MM-DD"), topic: z.string().max(200).default("") }),
        response: { 201: session, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.code(201).send(await classes.addSession(actor, request.params.id, request.body));
    },
  );

  routes.delete(
    "/classes/:id/sessions/:sessionId",
    { schema: { tags: TAGS, summary: "Remove a session and its attendance", security: SECURED, params: sessionParams, response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      await classes.removeSession(actor, request.params.id, request.params.sessionId);
      return reply.send({ ok: true });
    },
  );

  routes.put(
    "/classes/:id/sessions/:sessionId/attendance",
    {
      schema: {
        tags: TAGS,
        summary: "Mark who was present",
        description: "Present or not, by each student's address in the class's cohort. A mark given again replaces the last; students left out keep theirs.",
        security: SECURED,
        params: sessionParams,
        body: z.object({ marks: z.record(z.string().min(3).max(254), z.boolean()) }),
        response: { 200: session, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await classes.mark(actor, request.params.id, request.params.sessionId, request.body.marks));
    },
  );
}
