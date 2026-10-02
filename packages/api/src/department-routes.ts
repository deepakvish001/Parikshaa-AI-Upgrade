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
import type { DepartmentService } from "./departments.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Departments on staff and exams, and staff from a sheet. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface DepartmentRouteDeps {
  readonly departments: DepartmentService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Account"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse } as const;
const department = z.object({ department: z.string().max(100).nullable() });

export function registerDepartmentRoutes(routes: Routes, deps: DepartmentRouteDeps): void {
  const { departments, staff } = deps;

  routes.get(
    "/departments",
    {
      schema: {
        tags: TAGS,
        summary: "Departments, and who and what is in each",
        security: SECURED,
        response: {
          200: z.object({
            departments: z.array(z.string()).readonly(),
            staff: z.array(z.object({ userId: z.string(), department: z.string() })).readonly(),
            exams: z.array(z.object({ examId: z.string(), department: z.string() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send(await departments.list(actor));
    },
  );

  routes.put(
    "/staff/:userId/department",
    {
      schema: { tags: TAGS, summary: "Put a member of staff in a department, or none", description: "Audited.", security: SECURED, params: S.staffParams, body: department, response: { 200: S.okResponse, ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "staff:manage");
      if (actor === null) return;
      await departments.setStaff(actor, request.params.userId, request.body.department);
      return reply.send({ ok: true });
    },
  );

  routes.put(
    "/exams/:examId/department",
    {
      schema: {
        tags: TAGS,
        summary: "Put an exam in a department, or none",
        description: "Staff with a department of their own, other than owners, may put an exam only in theirs. Audited.",
        security: SECURED,
        params: S.examParams,
        body: department,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      await departments.setExam(actor, request.params.examId, request.body.department);
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/staff/import",
    {
      schema: {
        tags: TAGS,
        summary: "Add staff from a sheet",
        description:
          "Columns email, name, role (author, invigilator, reviewer, viewer; owners are made by hand) and department. With `dryRun`, or while any row is wrong, nothing is saved. Each new member is sent a link to set their password; someone already on staff is skipped. Audited.",
        security: SECURED,
        body: z.object({ csv: z.string().max(2_000_000), dryRun: z.boolean().default(true) }),
        response: {
          200: z.object({
            dryRun: z.boolean(),
            added: z.number(),
            skipped: z.number(),
            problems: z.array(z.object({ row: z.number(), message: z.string() })).readonly(),
            preview: z.array(z.object({ row: z.number(), email: z.string(), name: z.string(), role: z.string(), department: z.string().nullable() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "staff:manage");
      if (actor === null) return;
      return reply.send(await departments.importStaff(actor, request.body.csv, request.body.dryRun));
    },
  );
}
