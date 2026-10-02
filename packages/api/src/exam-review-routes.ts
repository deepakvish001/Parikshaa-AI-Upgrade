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
import type { ExamReviewService } from "./exam-review.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/** A paper's review: sent, approved or returned, reopened. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface ExamReviewRouteDeps {
  readonly reviews: ExamReviewService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Exams"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse } as const;
const review = z.object({
  examId: z.string(),
  status: z.enum(["in_review", "approved", "returned", "reopened"]),
  submittedBy: z.string(),
  submittedById: z.string(),
  submittedAt: z.string(),
  note: z.string(),
  reviewer: z.string().nullable(),
  decidedAt: z.string().nullable(),
  comment: z.string(),
});

export function registerExamReviewRoutes(routes: Routes, deps: ExamReviewRouteDeps): void {
  const { reviews, staff } = deps;

  routes.get(
    "/exams/reviews",
    { schema: { tags: TAGS, summary: "Every paper's review", security: SECURED, response: { 200: z.object({ reviews: z.array(review).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ reviews: await reviews.all(actor) });
    },
  );

  routes.get(
    "/exams/:examId/review",
    { schema: { tags: TAGS, summary: "Where a paper's review stands", security: SECURED, params: S.examParams, response: { 200: z.object({ review: review.nullable() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ review: await reviews.get(actor, request.params.examId) });
    },
  );

  routes.post(
    "/exams/:examId/review",
    {
      schema: {
        tags: TAGS,
        summary: "Send a paper for review",
        description: "Until its reviewer approves or returns it, the paper cannot be changed. Audited.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ note: z.string().max(2000).default("") }),
        response: { 200: review, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await reviews.submit(actor, request.params.examId, request.body.note));
    },
  );

  routes.post(
    "/exams/:examId/review/decision",
    {
      schema: {
        tags: TAGS,
        summary: "Approve a paper, or return it with a comment",
        description: "By someone other than its setter. An approved paper is locked against change until an owner reopens it. Audited.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ decision: z.enum(["approve", "return"]), comment: z.string().max(2000).default("") }),
        response: { 200: review, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await reviews.decide(actor, request.params.examId, request.body.decision, request.body.comment));
    },
  );

  routes.post(
    "/exams/:examId/review/reopen",
    {
      schema: {
        tags: TAGS,
        summary: "Reopen a locked paper for change",
        description: "Owners only, with a reason. Audited.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ reason: z.string().max(2000) }),
        response: { 200: review, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await reviews.reopen(actor, request.params.examId, request.body.reason));
    },
  );
}
