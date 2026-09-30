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
import { attemptId } from "@parikshaa/core";
import type { AttemptClaims } from "./auth.js";
import { RecheckError, type RecheckService } from "./rechecks.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

/** Results as candidates see them, rechecks, and scorecards (docs/PILOT.md, "After"). */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface RecheckRouteDeps {
  readonly rechecks: RecheckService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly candidate: (request: FastifyRequest, reply: FastifyReply) => Promise<AttemptClaims | null>;
  readonly throttle: LoginThrottle;
}

const CANDIDATE = ["Candidate"];
const RESULTS = ["Results"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;
const STATUS: Record<RecheckError["code"], 409 | 422> = { not_released: 409, not_graded: 409, closed: 409, already_asked: 409, too_many: 409, not_on_paper: 422 };

const status = z.enum(["open", "changed", "unchanged"]);
const outcome = z.enum(["qualified", "failed"]).nullable();
const recheck = z.object({
  id: z.string(),
  attemptId: z.string(),
  examId: z.string(),
  questionId: z.string(),
  reason: z.string(),
  status,
  scoreBefore: z.number().nullable(),
  scoreAfter: z.number().nullable(),
  reply: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
});

const pdf = (reply: FastifyReply, bytes: Uint8Array, name: string) =>
  reply.header("content-type", "application/pdf").header("content-disposition", `attachment; filename="${name}"`).header("cache-control", "no-store").send(Buffer.from(bytes));

export function registerRecheckRoutes(routes: Routes, deps: RecheckRouteDeps): void {
  const { rechecks, staff, candidate, throttle } = deps;

  routes.get(
    "/attempts/me/result",
    {
      schema: {
        tags: CANDIDATE,
        summary: "My result, once released",
        description: `Marks by question, and any rechecks asked for, once the institution has released the exam's results; { released: false } until then. recheckUntil is when asking closes, or null once closed or the limit is reached.`,
        security: [{ attemptToken: [] }],
        response: {
          200: z.union([
            z.object({ released: z.literal(false) }),
            z.object({
              released: z.literal(true),
              title: z.string(),
              institution: z.string(),
              total: z.number(),
              maxTotal: z.number(),
              percent: z.number(),
              outcome,
              questions: z.array(z.object({ id: z.string(), number: z.number(), stem: z.string(), score: z.number(), max: z.number() })).readonly(),
              rechecks: z
                .array(recheck.pick({ id: true, questionId: true, reason: true, status: true, scoreBefore: true, scoreAfter: true, reply: true, decidedAt: true }))
                .readonly(),
              recheckUntil: z.string().nullable(),
            }),
          ]),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      return reply.send(await rechecks.mine(claims.orgId, claims.attemptId, claims.examId));
    },
  );

  routes.post(
    "/attempts/me/rechecks",
    {
      schema: {
        tags: CANDIDATE,
        summary: "Ask for a question to be rechecked",
        description: "Once results are released, within seven days, for up to three questions, once each. A person reads the answer again and replies; a changed mark is recorded in the attempt's ledger.",
        security: [{ attemptToken: [] }],
        body: z.object({ questionId: z.string().min(1).max(100), reason: z.string().trim().min(10).max(1000) }),
        response: { 201: recheck, 422: S.errorResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      try {
        return reply.code(201).send(await rechecks.ask(claims.orgId, claims.attemptId, claims.examId, request.body.questionId, request.body.reason));
      } catch (error) {
        if (error instanceof RecheckError) return reply.code(STATUS[error.code]).send({ error: error.code, message: error.message });
        throw error;
      }
    },
  );

  routes.get(
    "/attempts/me/scorecard.pdf",
    {
      schema: {
        tags: CANDIDATE,
        summary: "My scorecard, as a PDF",
        description: "Once results are released. Carries a code, as a QR and a link, that shows anyone the result as it stands in the record.",
        security: [{ attemptToken: [] }],
        response: { 200: z.any().describe("application/pdf"), ...refusals },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      const bytes = await rechecks.scorecard(claims.orgId, claims.attemptId, claims.examId);
      if (bytes === null) return reply.code(409).send({ error: "not_released", message: "Results for this test are not released yet" });
      return pdf(reply, bytes, "scorecard.pdf");
    },
  );

  routes.get(
    "/scorecards/:code",
    {
      schema: {
        tags: RESULTS,
        summary: "Check a scorecard",
        description: "Public: what the code printed on a scorecard proves, read from the record now. valid: false with withdrawn when the result has since been set aside or erased.",
        params: z.object({ code: z.string().min(1).max(300) }),
        response: {
          200: z.union([
            z.object({
              valid: z.literal(true),
              institution: z.string(),
              candidate: z.object({ name: z.string(), ref: z.string() }),
              title: z.string(),
              total: z.number(),
              maxTotal: z.number(),
              percent: z.number(),
              outcome,
              sittingDate: z.string(),
              record: z.string(),
            }),
            z.object({ valid: z.literal(false), reason: z.enum(["unknown", "withdrawn"]) }),
          ]),
          429: S.errorResponse,
        },
      },
    },
    async (request, reply) => {
      if (throttle.blocked(request.ip, "scorecard")) return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      const checked = await rechecks.check(request.params.code);
      if (!checked.valid && checked.reason === "unknown") throttle.failed(request.ip, "scorecard");
      return reply.header("cache-control", "no-store").send(checked);
    },
  );

  routes.get(
    "/exams/:examId/rechecks",
    {
      schema: {
        tags: RESULTS,
        summary: "Rechecks asked for",
        description: "Open first. Each with the candidate, the question, what they answered and the mark as it stands.",
        security: SECURED,
        params: S.examParams,
        response: {
          200: z.object({
            rechecks: z
              .array(
                recheck.extend({
                  candidate: z.object({ ref: z.string(), name: z.string() }),
                  question: z.object({ number: z.number(), stem: z.string(), kind: z.string(), max: z.number() }),
                  answer: z.string().nullable(),
                  score: z.number(),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send({ rechecks: await rechecks.forExam(actor, request.params.examId) });
    },
  );

  routes.get(
    "/rechecks/open",
    {
      schema: {
        tags: RESULTS,
        summary: "How many rechecks await an answer, by exam",
        security: SECURED,
        response: { 200: z.object({ open: z.record(z.string(), z.number()) }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send({ open: await rechecks.openCounts(actor) });
    },
  );

  routes.post(
    "/rechecks/:recheckId/answer",
    {
      schema: {
        tags: RESULTS,
        summary: "Answer a recheck",
        description:
          "With the mark as it now stands and a reply the candidate reads. A different mark is written to the attempt's ledger as score_revised, with who and why; the candidate is emailed that their request is answered. Audited.",
        security: SECURED,
        params: z.object({ recheckId: z.string().min(1).max(100) }),
        body: z.object({ score: z.number().min(0), reply: z.string().trim().min(1).max(1000) }),
        response: { 200: recheck, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:grade");
      if (actor === null) return;
      return reply.send(await rechecks.answer(actor, request.params.recheckId, request.body));
    },
  );

  routes.get(
    "/attempts/:attemptId/scorecard.pdf",
    {
      schema: {
        tags: RESULTS,
        summary: "A candidate's scorecard, as a PDF",
        description: "The PDF the candidate downloads, with its checking code; available to staff before results are released.",
        security: SECURED,
        params: S.attemptParams,
        response: { 200: z.any().describe("application/pdf"), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return pdf(reply, await rechecks.scorecardForStaff(actor, attemptId(request.params.attemptId)), `scorecard-${request.params.attemptId}.pdf`);
    },
  );
}
