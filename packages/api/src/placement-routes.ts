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
import { STAGES } from "@parikshaa/store";
import { ImportRejected, type PlacementService } from "./placement.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** The placement cell: students on file, and recruitment drives. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface PlacementRouteDeps {
  readonly placement: PlacementService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Placement"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse, 429: S.errorResponse } as const;

const student = z.object({
  ref: z.string().describe("Roll number: the candidate reference in every exam."),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable().describe("91 followed by ten digits."),
  branch: z.string(),
  batch: z.number().nullable().describe("Year of passing."),
  cgpa: z.number().nullable(),
  backlogs: z.number(),
});
const problem = z.object({ row: z.number(), message: z.string() });
const stage = z.enum(STAGES);
const eligibility = z.object({
  minCgpa: z.number().min(0).max(10).optional(),
  maxBacklogs: z.number().int().min(0).max(100).optional(),
  branches: z.array(z.string().max(100)).max(50).readonly().optional(),
  batches: z.array(z.number().int().min(1990).max(2100)).max(10).readonly().optional(),
});
const driveBody = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  ctcLpa: z.number().min(0).max(9999).nullable().default(null).describe("Package, in lakh rupees a year."),
  location: z.string().max(200).default(""),
  description: z.string().max(20_000).default("").describe("The job description."),
  eligibility: eligibility.default({}),
  applyBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  examId: z.string().min(1).nullable().default(null).describe("The drive's test: an exam of the organisation."),
  status: z.enum(["open", "closed"]).default("open"),
});
const drive = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  ctcLpa: z.number().nullable(),
  location: z.string(),
  description: z.string(),
  eligibility,
  applyBy: z.string().nullable(),
  examId: z.string().nullable(),
  status: z.enum(["open", "closed"]),
  createdAt: z.string(),
  stages: z.record(stage, z.number()),
});
const driveParams = z.object({ driveId: z.string().min(1) });
const refs = z.array(z.string().min(1).max(100)).min(1).max(20_000);

export function registerPlacementRoutes(routes: Routes, deps: PlacementRouteDeps): void {
  const { placement, staff } = deps;

  routes.get(
    "/students",
    {
      schema: {
        tags: TAGS,
        summary: "Students on file",
        description: "Every student, by roll number, with branch, batch, CGPA, backlogs and their offers so far.",
        security: SECURED,
        response: { 200: z.object({ students: z.array(student.extend({ offers: z.number(), bestOfferLpa: z.number().nullable() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send({ students: await placement.students(actor) });
    },
  );

  routes.post(
    "/students/import",
    {
      schema: {
        tags: TAGS,
        summary: "Bring in students from a spreadsheet",
        description:
          "CSV with a header row: roll_number (or ref, enrollment_no), name, email, phone, branch, batch (year of passing), cgpa (out of 10), backlogs. A student already on file is updated to what the sheet says. `dryRun` checks and changes nothing; otherwise all or nothing. Audited.",
        security: SECURED,
        body: z.object({ csv: z.string().max(5_000_000), dryRun: z.boolean().default(true) }),
        response: {
          200: z.object({ dryRun: z.boolean(), students: z.number(), added: z.number(), updated: z.number(), problems: z.array(problem).readonly(), preview: z.array(student).readonly() }),
          ...refusals,
          422: z.object({ error: z.literal("invalid_import"), problems: z.array(problem).readonly() }),
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      try {
        return reply.send(await placement.importStudents(actor, request.body.csv, request.body.dryRun));
      } catch (error) {
        if (error instanceof ImportRejected) return reply.code(422).send({ error: "invalid_import", problems: error.problems });
        throw error;
      }
    },
  );

  routes.delete(
    "/students/:ref",
    {
      schema: {
        tags: TAGS,
        summary: "Remove a student",
        description: "Takes them off file and out of every drive. Their exams keep their attempts, as any candidate's do. Audited.",
        security: SECURED,
        params: z.object({ ref: z.string().min(1) }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      await placement.removeStudent(actor, request.params.ref);
      return reply.send({ ok: true });
    },
  );

  routes.get(
    "/placement/readiness",
    {
      schema: {
        tags: TAGS,
        summary: "Readiness: each branch in each topic",
        description:
          "Across the organisation's recent graded tests (`exams`, default 6): each branch's average percentage in each topic, and the students below 40% overall with their weakest topic. A topic is where the question is filed in the bank, else the section it was drawn in.",
        security: SECURED,
        querystring: z.object({ batch: z.coerce.number().int().min(1990).max(2100).optional(), exams: z.coerce.number().int().min(1).max(24).optional() }),
        response: {
          200: z.object({
            exams: z.array(z.object({ id: z.string(), title: z.string() })).readonly(),
            topics: z.array(z.string()).readonly(),
            branches: z.array(z.object({ branch: z.string(), students: z.number(), cells: z.record(z.string(), z.object({ percent: z.number(), students: z.number() })) })).readonly(),
            atRisk: z.array(z.object({ ref: z.string(), name: z.string(), branch: z.string(), percent: z.number(), weakest: z.string() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await placement.readiness(actor, request.query));
    },
  );

  routes.get(
    "/drives",
    { schema: { tags: TAGS, summary: "Recruitment drives", security: SECURED, response: { 200: z.object({ drives: z.array(drive).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send({ drives: await placement.drives(actor) });
    },
  );

  routes.post(
    "/drives",
    {
      schema: {
        tags: TAGS,
        summary: "Make a drive",
        description: "A company, a role, who may apply (minimum CGPA, most backlogs, branches, years of passing) and, optionally, the drive's test. Audited.",
        security: SECURED,
        body: driveBody,
        response: { 201: drive, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.code(201).send(await placement.createDrive(actor, request.body));
    },
  );

  routes.put(
    "/drives/:driveId",
    { schema: { tags: TAGS, summary: "Change a drive, or close it", security: SECURED, params: driveParams, body: driveBody, response: { 200: drive, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await placement.updateDrive(actor, request.params.driveId, request.body));
    },
  );

  routes.get(
    "/drives/:driveId",
    {
      schema: {
        tags: TAGS,
        summary: "A drive and its students",
        description: "Each student in the drive with their stage, offer and, once graded, their result in the drive's test; and how many more students meet the criteria.",
        security: SECURED,
        params: driveParams,
        response: {
          200: z.object({
            drive,
            applications: z
              .array(
                student.extend({
                  stage,
                  offerLpa: z.number().nullable(),
                  updatedAt: z.string(),
                  test: z.object({ percent: z.number(), outcome: z.enum(["qualified", "failed"]).nullable() }).nullable(),
                }),
              )
              .readonly(),
            eligibleNotAdded: z.number(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await placement.drive(actor, request.params.driveId));
    },
  );

  routes.post(
    "/drives/:driveId/students",
    {
      schema: {
        tags: TAGS,
        summary: "Add students to a drive",
        description: "`eligible: true` adds every student who meets the drive's criteria and is not in it yet; otherwise the roll numbers given, which must be on file. Audited.",
        security: SECURED,
        params: driveParams,
        body: z.union([z.object({ eligible: z.literal(true) }), z.object({ refs })]),
        response: { 200: z.object({ added: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      const body = request.body;
      return reply.send(await placement.addStudents(actor, request.params.driveId, "refs" in body ? body.refs : "eligible"));
    },
  );

  routes.post(
    "/drives/:driveId/stage",
    {
      schema: {
        tags: TAGS,
        summary: "Move students to a stage",
        description: "applied → test → interview → offered → joined, or rejected or withdrawn. `offerLpa` is kept only with an offer. Audited.",
        security: SECURED,
        params: driveParams,
        body: z.object({ refs, stage, offerLpa: z.number().min(0).max(9999).nullable().default(null) }),
        response: { 200: z.object({ moved: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      const { refs: chosen, stage: to, offerLpa } = request.body;
      return reply.send(await placement.setStage(actor, request.params.driveId, chosen, to, offerLpa));
    },
  );

  routes.post(
    "/drives/:driveId/send-test",
    {
      schema: {
        tags: TAGS,
        summary: "Send the drive's test",
        description:
          "Invites the drive's students still at applied (or the roll numbers given) to its exam, on the exam's window, and moves them to test. Anyone already invited keeps their invitation. Needs attempt:start as well.",
        security: SECURED,
        params: driveParams,
        body: z.object({ refs: refs.optional(), channels: z.array(z.enum(["email", "sms", "whatsapp"])).readonly().default(["email", "sms"]) }),
        response: { 200: z.object({ invited: z.number(), skipped: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await placement.sendTest(actor, request.params.driveId, request.body.refs ?? null, request.body.channels));
    },
  );

  routes.get(
    "/drives/:driveId/students.csv",
    {
      schema: {
        tags: TAGS,
        summary: "The drive's students as CSV",
        description: "For the company: roll number, contact, branch, batch, CGPA, backlogs, stage, test result and offer. Audited, since it leaves the system.",
        security: SECURED,
        params: driveParams,
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      const { filename, csv } = await placement.exportCsv(actor, request.params.driveId);
      return reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", `attachment; filename="${filename}"`).send(csv);
    },
  );
}
