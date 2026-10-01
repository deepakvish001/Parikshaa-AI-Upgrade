import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { MAX_COHORT_ROWS, type PrepCampus } from "./prep-campus.js";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface PrepCampusRouteDeps {
  readonly campus: PrepCampus;
  readonly service: ExamService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const ADMIN = ["Prep (staff)"];
const STAFF = [{ staffAuth: [] }];
const refusals = { 400: S.errorResponse, 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse } as const;
const cohort = z.object({ id: z.string(), name: z.string(), plusDays: z.number(), createdBy: z.string(), createdAt: z.string() });
const cohortParams = z.object({ id: z.string().min(1).max(80) });

/** Campus licences (Prep blueprint F16): cohorts of students a college has bought Plus for, and how they are doing. */
export function registerPrepCampusRoutes(routes: Routes, deps: PrepCampusRouteDeps): void {
  const { campus, service, staff } = deps;

  routes.get(
    "/practice-admin/cohorts",
    {
      schema: {
        tags: ADMIN,
        summary: "Campus cohorts, with how far their students have got",
        security: STAFF,
        response: {
          200: z.object({
            cohorts: z
              .array(
                cohort.extend({
                  members: z.number().describe("Addresses in the cohort."),
                  joined: z.number().describe("Of them, with an account on the site."),
                  given: z.number().describe("Of them, given the cohort's Plus (their account is verified)."),
                  active7: z.number().describe("Of those who joined, submitted something in the last 7 days."),
                  solved: z.number().describe("Problems solved, all the cohort's students together."),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ cohorts: await campus.cohorts(actor.orgId) });
    },
  );

  routes.post(
    "/practice-admin/cohorts",
    {
      schema: {
        tags: ADMIN,
        summary: "Make a campus cohort: a college or batch, and the days of Plus it gives",
        security: STAFF,
        body: z.object({ name: z.string().max(120), plusDays: z.number().int() }),
        response: { 201: cohort, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const made = await campus.createCohort(actor.orgId, actor.id, request.body);
      await service.recordAudit(actor, "prep.cohort_created", made.id, { name: made.name, plusDays: made.plusDays });
      return reply.code(201).send(made);
    },
  );

  routes.post(
    "/practice-admin/cohorts/:id/members",
    {
      schema: {
        tags: ADMIN,
        summary: "Add students to a cohort from a CSV of email addresses",
        description: `The column headed "email", or the first; a header row is optional. At most ${MAX_COHORT_ROWS} rows. A verified account with an address gets Plus at once; any other address gets it when an account with it is verified. With \`dryRun\`, nothing is changed: the counts say what would happen.`,
        security: STAFF,
        params: cohortParams,
        body: z.object({ csv: z.string().max(1_000_000), dryRun: z.boolean().default(false) }),
        response: {
          200: z.object({
            rows: z.number(),
            added: z.number().describe("Addresses new to the cohort."),
            invalid: z.array(z.object({ line: z.number(), value: z.string() })).readonly(),
            duplicates: z.number().describe("Addresses given twice in the file."),
            already: z.number().describe("Addresses in the cohort before."),
            givenNow: z.number().describe("Of those added, verified accounts given Plus now (or that would be, on a dry run)."),
            onSignup: z.number().describe("Of those added, given Plus once an account with the address is verified."),
            dryRun: z.boolean(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const outcome = await campus.importCsv(actor.orgId, request.params.id, request.body.csv, request.body.dryRun);
      if (!outcome.dryRun) await service.recordAudit(actor, "prep.cohort_imported", request.params.id, { added: outcome.added, givenNow: outcome.givenNow });
      return reply.send(outcome);
    },
  );

  routes.get(
    "/practice-admin/cohorts/:id",
    {
      schema: {
        tags: ADMIN,
        summary: "A cohort's students, each on a line: the college's dashboard",
        security: STAFF,
        params: cohortParams,
        response: {
          200: z.object({
            cohort,
            students: z
              .array(
                z.object({
                  email: z.string(),
                  name: z.string().nullable(),
                  joined: z.boolean(),
                  verified: z.boolean(),
                  plusUntil: z.string().nullable().describe("Set once the cohort's Plus was given."),
                  solved: z.number(),
                  submissions: z.number(),
                  lastActiveAt: z.string().nullable(),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send(await campus.cohortReport(actor.orgId, request.params.id));
    },
  );
}
