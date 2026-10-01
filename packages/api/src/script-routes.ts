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
import { MAX_PAGES, type HandwritingService } from "./handwriting.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** Handwritten copies: pages in, the model's suggestion, the examiner's marks, moderation, the marks sheet. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface ScriptRouteDeps {
  readonly handwriting: HandwritingService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Handwritten copies"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 402: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse } as const;
const marks = z.record(z.string(), z.object({ score: z.number(), comment: z.string().max(1000).default("") }));
const script = z.object({
  id: z.string(),
  examId: z.string(),
  candidateRef: z.string(),
  candidateName: z.string(),
  status: z.enum(["uploaded", "checked", "moderated", "disputed"]),
  pages: z.number(),
  suggestion: z
    .object({ at: z.string(), questions: z.array(z.object({ questionId: z.string(), score: z.number(), reason: z.string(), transcript: z.string() })).readonly() })
    .nullable()
    .describe("What the model read and suggests. It counts for nothing until an examiner checks the copy."),
  marks: marks.nullable(),
  checkedBy: z.string().nullable(),
  checkedAt: z.string().nullable(),
  moderation: z.object({ marks, by: z.string(), at: z.string(), gap: z.number(), resolvedBy: z.string().optional() }).nullable(),
  finalTotal: z.number().nullable(),
  uploadedBy: z.string(),
  createdAt: z.string(),
});
const idParams = z.object({ id: z.string() });
const marksBody = z.object({ marks });

export function registerScriptRoutes(routes: Routes, deps: ScriptRouteDeps): void {
  const { handwriting, staff } = deps;

  routes.post(
    "/exams/:examId/scripts/pages",
    {
      bodyLimit: 5_600_000,
      schema: {
        tags: TAGS,
        summary: "Add a page of a candidate's handwritten copy",
        description: `One photo or scan, base64. The candidate's copy is made with its first page; pages are kept in the order they arrive, at most ${MAX_PAGES}. A checked copy's pages no longer change.`,
        security: SECURED,
        params: S.examParams,
        body: z.object({ ref: z.string().min(1).max(100), name: z.string().max(200).default(""), image: z.string().min(1) }),
        response: { 201: z.object({ script, page: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.code(201).send(await handwriting.upload(actor, request.params.examId, request.body));
    },
  );

  routes.get(
    "/exams/:examId/scripts",
    {
      schema: {
        tags: TAGS,
        summary: "The paper, and every handwritten copy with where it stands",
        security: SECURED,
        params: S.examParams,
        response: {
          200: z.object({
            title: z.string(),
            questions: z.array(z.object({ id: z.string(), number: z.number(), stem: z.string(), maxScore: z.number() })).readonly(),
            total: z.number(),
            tolerancePercent: z.number(),
            scripts: z.array(script).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await handwriting.forExam(actor, request.params.examId));
    },
  );

  routes.get(
    "/exams/:examId/scripts.csv",
    { schema: { tags: TAGS, summary: "The marks sheet, as CSV", security: SECURED, params: S.examParams, response: { 200: z.string(), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="marks-${request.params.examId.replace(/[^a-zA-Z0-9-]/g, "")}.csv"`)
        .send(await handwriting.csv(actor, request.params.examId));
    },
  );

  routes.post(
    "/exams/:examId/scripts/sample",
    {
      schema: {
        tags: TAGS,
        summary: "Choose copies for a second examiner",
        description: "A random share of the checked copies not yet moderated.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ percent: z.number().int().min(1).max(100).default(10) }),
        response: { 200: z.object({ scripts: z.array(z.string()).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send({ scripts: await handwriting.sample(actor, request.params.examId, request.body.percent) });
    },
  );

  routes.get(
    "/scripts/:id",
    { schema: { tags: TAGS, summary: "A handwritten copy", security: SECURED, params: idParams, response: { 200: script, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await handwriting.get(actor, request.params.id));
    },
  );

  routes.get(
    "/scripts/:id/pages/:page",
    {
      schema: {
        tags: TAGS,
        summary: "A page of a handwritten copy, as the image it was",
        security: SECURED,
        params: z.object({ id: z.string(), page: z.coerce.number().int().min(1).max(MAX_PAGES) }),
        response: { 200: z.any(), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      const page = await handwriting.page(actor, request.params.id, request.params.page);
      return reply.header("content-type", page.mime).header("cache-control", "private, max-age=3600").header("x-content-type-options", "nosniff").send(page.bytes);
    },
  );

  routes.delete(
    "/scripts/:id",
    { schema: { tags: TAGS, summary: "Remove a copy not yet checked", description: "To scan it again. Audited.", security: SECURED, params: idParams, response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      await handwriting.remove(actor, request.params.id);
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/scripts/:id/suggest",
    {
      schema: {
        tags: TAGS,
        summary: "Have the model read the copy and suggest marks",
        description: "Per question: what it read, the marks it suggests and why. Counted against the month's spend cap (402 once it is reached). The suggestion is not a mark: an examiner checks the copy.",
        security: SECURED,
        params: idParams,
        response: { 200: script, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await handwriting.suggest(actor, request.params.id));
    },
  );

  routes.put(
    "/scripts/:id/marks",
    {
      schema: { tags: TAGS, summary: "The examiner's marks for a copy", description: "Every question, out of its marks, in steps of half a mark. These are the marks. Audited.", security: SECURED, params: idParams, body: marksBody, response: { 200: script, ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await handwriting.check(actor, request.params.id, request.body.marks));
    },
  );

  routes.post(
    "/scripts/:id/moderation",
    {
      schema: {
        tags: TAGS,
        summary: "A second examiner's marks",
        description: "By someone other than the first examiner. Within the tolerance the first marks stand; beyond it the copy is disputed. Audited.",
        security: SECURED,
        params: idParams,
        body: marksBody,
        response: { 200: script, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await handwriting.moderate(actor, request.params.id, request.body.marks));
    },
  );

  routes.post(
    "/scripts/:id/resolution",
    {
      schema: { tags: TAGS, summary: "Settle a disputed copy", description: "A head examiner's marks, which are final. Audited.", security: SECURED, params: idParams, body: marksBody, response: { 200: script, ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await handwriting.resolve(actor, request.params.id, request.body.marks));
    },
  );
}
