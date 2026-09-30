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
import { attemptId, orgId } from "@parikshaa/core";
import type { FeedbackStore } from "@parikshaa/store";
import type { AttemptClaims } from "./auth.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/**
 * How the test went, in candidates' words (docs/PILOT.md): two questions after
 * submitting, both optional, asked once. Staff read the answers without names,
 * so a candidate can say what got in the way without it counting against them.
 */

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface FeedbackRouteDeps {
  readonly feedback: FeedbackStore;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly candidate: (request: FastifyRequest, reply: FastifyReply) => Promise<AttemptClaims | null>;
  readonly now: () => number;
}

const CANDIDATE = ["Candidate"];
const RESULTS = ["Results"];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;

export function registerFeedbackRoutes(routes: Routes, deps: FeedbackRouteDeps): void {
  const { feedback, staff, candidate } = deps;

  routes.post(
    "/attempts/me/feedback",
    {
      schema: {
        tags: CANDIDATE,
        summary: "Say how the test went",
        description:
          "Once, after submitting. The institution sees the rating and comment without the candidate's name. 409 before the attempt is submitted, or when feedback was already given.",
        security: [{ attemptToken: [] }],
        body: z.object({
          rating: z.number().int().min(1).max(5).describe("1 (it got in the way) to 5 (it went well)."),
          comment: z.string().max(1000).optional().describe("Anything that got in the way, in the candidate's words."),
        }),
        response: { 201: z.object({ ok: z.literal(true) }), ...refusals },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      const comment = request.body.comment?.trim() ?? "";
      const outcome = await feedback.give(orgId(claims.orgId), attemptId(claims.attemptId), request.body.rating, comment === "" ? null : comment, new Date(deps.now()));
      if (outcome === "not_submitted") return reply.code(409).send({ error: "not_submitted", message: "Submit the test first." });
      if (outcome === "already_given") return reply.code(409).send({ error: "already_given", message: "Thank you: your feedback is already in." });
      return reply.code(201).send({ ok: true as const });
    },
  );

  routes.get(
    "/attempts/me/feedback",
    {
      schema: {
        tags: CANDIDATE,
        summary: "Whether the candidate has said how the test went",
        security: [{ attemptToken: [] }],
        response: { 200: z.object({ given: z.boolean() }), ...refusals },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      return reply.send({ given: await feedback.given(orgId(claims.orgId), attemptId(claims.attemptId)) });
    },
  );

  routes.get(
    "/exams/:examId/feedback",
    {
      schema: {
        tags: RESULTS,
        summary: "What candidates said about the test",
        description: "Ratings out of 5 and comments, without names, from candidates who answered after submitting.",
        security: [{ staffAuth: [] }],
        params: S.examParams,
        response: {
          200: z.object({
            responses: z.number().int(),
            submitted: z.number().int().describe("Candidates who submitted: what responses is out of."),
            average: z.number().nullable(),
            counts: z.array(z.number().int()).length(5).describe("How many gave each rating, 1 to 5."),
            comments: z.array(z.object({ rating: z.number().int(), comment: z.string(), at: z.string() })),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      const summary = await feedback.summary(actor.orgId, request.params.examId);
      return reply.send({ ...summary, counts: [...summary.counts], comments: [...summary.comments] });
    },
  );
}
