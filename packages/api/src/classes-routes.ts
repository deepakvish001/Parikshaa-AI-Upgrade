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
import type { PracticeService } from "./practice.js";
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

const practical = z.object({
  problemId: z.string(),
  slug: z.string(),
  title: z.string(),
  module: z.string(),
  submission: z
    .object({ language: z.string().nullable(), source: z.string(), passed: z.number().int(), total: z.number().int(), at: z.string() })
    .nullable()
    .describe("The student's latest accepted program for it; null until they have one."),
  signedBy: z.string().nullable(),
  signedAt: z.string().nullable(),
});
const labRecord = z.object({
  class: z.object({ id: z.string(), name: z.string(), course: z.string().nullable() }),
  student: z.object({ email: z.string(), name: z.string().nullable() }),
  practicals: z.array(practical).readonly().describe("Each coding problem of the class's course, in course order."),
});
const myClass = z.object({
  id: z.string(),
  name: z.string(),
  course: z.object({ slug: z.string(), title: z.string() }).nullable(),
  tests: z.array(z.object({ title: z.string() })).readonly(),
  contests: z.array(z.object({ slug: z.string(), title: z.string(), startsAt: z.string(), endsAt: z.string() })).readonly(),
  attendance: z.object({
    present: z.number().int(),
    of: z.number().int(),
    sessions: z.array(z.object({ heldOn: z.string(), topic: z.string(), present: z.boolean().nullable().describe("Null when not marked.") })).readonly(),
  }),
  lab: z.object({ practicals: z.number().int(), done: z.number().int(), signed: z.number().int() }),
});
const pdf = (reply: FastifyReply, bytes: Uint8Array, name: string) =>
  reply.header("content-type", "application/pdf").header("content-disposition", `attachment; filename="${name}"`).header("cache-control", "no-store").send(Buffer.from(bytes));

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
    /** For a student's own classes on the practice site; their routes are left out without it. */
    readonly practice?: PracticeService | undefined;
    readonly bearer?: ((request: FastifyRequest) => string | null) | undefined;
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

  // --- the lab record, for staff -----------------------------------------------------------

  const labQuery = z.object({ email: z.string().min(3).max(254) });

  routes.get(
    "/classes/:id/lab",
    {
      schema: {
        tags: TAGS,
        summary: "A student's lab record",
        description: "Each coding problem of the class's course is a practical: the student's latest accepted program for it, and whether a teacher has signed it off.",
        security: SECURED,
        params,
        querystring: labQuery,
        response: { 200: labRecord, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send(await classes.lab(actor, request.params.id, request.query.email));
    },
  );

  routes.get(
    "/classes/:id/lab.pdf",
    {
      schema: { tags: TAGS, summary: "A student's lab record, as a PDF", security: SECURED, params, querystring: labQuery, response: { 200: z.any().describe("application/pdf"), ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      const record = await classes.lab(actor, request.params.id, request.query.email);
      return pdf(reply, await classes.labPdf(actor.orgId, record), "lab-record.pdf");
    },
  );

  routes.put(
    "/classes/:id/lab",
    {
      schema: {
        tags: TAGS,
        summary: "Sign off a practical, or take the sign-off back",
        description: "Only a coding problem of the class's course, for a student of its cohort. Audited.",
        security: SECURED,
        params,
        body: z.object({ email: z.string().min(3).max(254), problemId: z.string().min(1).max(200), signed: z.boolean() }),
        response: { 200: labRecord, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await classes.signOff(actor, request.params.id, request.body.email, request.body.problemId, request.body.signed));
    },
  );

  // --- a student's own, on the practice site ------------------------------------------------

  const { practice, bearer } = deps;
  if (practice === undefined || bearer === undefined) return;
  const LEARNER = [{ learnerAuth: [] }];
  const STUDENT = ["Classes (students)"];
  const siteParams = z.object({ site: z.string().min(1).max(60) });
  const signedIn = async (request: FastifyRequest, reply: FastifyReply) => {
    const site = await practice.site((request.params as { site: string }).site);
    request.orgId = site.orgId;
    const learner = await practice.learner(site, bearer(request) ?? undefined);
    if (learner === null) {
      await reply.code(401).send({ error: "sign_in_required", message: "Sign in to do that" });
      return null;
    }
    return { site, learner };
  };

  routes.get(
    "/practice/:site/classes",
    {
      schema: {
        tags: STUDENT,
        summary: "My classes",
        description: "The classes whose cohort has my address: the course, the tests and contests set, my attendance, and how far my lab record has got. Empty, with verified: false, until my address is confirmed.",
        security: LEARNER,
        params: siteParams,
        response: { 200: z.object({ verified: z.boolean(), classes: z.array(myClass).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await classes.mine(who.learner));
    },
  );

  const myParams = siteParams.extend({ id: z.string().min(1).max(100) });

  routes.get(
    "/practice/:site/classes/:id/lab",
    { schema: { tags: STUDENT, summary: "My lab record for a class", security: LEARNER, params: myParams, response: { 200: labRecord, ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await classes.myLab(who.learner, request.params.id));
    },
  );

  routes.get(
    "/practice/:site/classes/:id/lab.pdf",
    { schema: { tags: STUDENT, summary: "My lab record, as a PDF", security: LEARNER, params: myParams, response: { 200: z.any().describe("application/pdf"), ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const record = await classes.myLab(who.learner, request.params.id);
      return pdf(reply, await classes.labPdf(who.learner.orgId, record), "lab-record.pdf");
    },
  );
}
