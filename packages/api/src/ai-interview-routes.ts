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
import { AiInterviewGone, CRITERIA, type AiInterviewService } from "./ai-interview.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

/** The AI interviewer: set up and scored by staff, held with the candidate by link. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface AiInterviewRouteDeps {
  readonly aiInterviews: AiInterviewService;
  readonly throttle: LoginThrottle;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["AI interviews"];
const ROOM_TAGS = ["AI interview room"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 402: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse, 429: S.errorResponse } as const;
const status = z.enum(["invited", "in_progress", "done", "cancelled"]);
const seniority = z.enum(["fresher", "junior", "mid", "senior"]);
const recommendation = z.enum(["strong_yes", "yes", "no", "strong_no"]);
const scorecard = z.object({
  criteria: z.array(z.object({ name: z.string().min(1).max(100), score: z.number().int().min(1).max(5) })).min(1).max(12).readonly(),
  recommendation,
  summary: z.string().max(5000).default(""),
});
const assessment = z
  .object({
    criteria: z.array(z.object({ name: z.string(), score: z.number(), evidence: z.array(z.string()).readonly() })).readonly(),
    summary: z.string(),
    concerns: z.array(z.string()).readonly(),
  })
  .describe(`The model's reading of the transcript: ${CRITERIA.join(", ")}, each 1–5 with the candidate's own words as evidence (0 when it gave none). A suggestion for the person who decides.`);
const turn = z.object({
  seq: z.number(),
  speaker: z.enum(["interviewer", "candidate"]),
  kind: z.enum(["question", "follow_up", "answer", "closing"]),
  body: z.string(),
  code: z.string().nullable(),
  language: z.string().nullable(),
  at: z.string(),
  hash: z.string(),
});
const interview = z.object({
  id: z.string(),
  title: z.string(),
  roleId: z.string().nullable(),
  job: z.string(),
  seniority,
  questions: z.number(),
  minutes: z.number(),
  candidateRef: z.string(),
  candidateName: z.string(),
  candidateEmail: z.string().nullable(),
  resume: z.string().nullable().describe("The resume the recruiter pasted. The model reads it with the name, email, phone and links taken out."),
  status,
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  assessment: assessment.nullable(),
  scorecard: z.object({ criteria: z.array(z.object({ name: z.string(), score: z.number() })).readonly(), recommendation, summary: z.string() }).nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  link: z.string().describe("The candidate's link to the interview."),
});
const full = interview.extend({
  turns: z.array(turn).readonly(),
  transcriptIntact: z.boolean().describe("Whether every turn's hash holds: false means the transcript was changed after it was written."),
});
const room = z.object({
  title: z.string(),
  candidateName: z.string(),
  minutes: z.number(),
  questions: z.number(),
  asked: z.number(),
  status,
  startedAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  turns: z.array(z.object({ speaker: z.enum(["interviewer", "candidate"]), kind: z.enum(["question", "follow_up", "answer", "closing"]), body: z.string(), code: z.string().nullable(), language: z.string().nullable(), at: z.string() })).readonly(),
});
const idParams = z.object({ id: z.string() });
const codeParams = z.object({ code: z.string().min(5).max(300) });

export function registerAiInterviewRoutes(routes: Routes, deps: AiInterviewRouteDeps): void {
  const { aiInterviews, throttle, staff } = deps;

  const guard = async <T>(request: FastifyRequest, reply: FastifyReply, run: () => Promise<T>) => {
    if (throttle.blocked(request.ip, "ai-interview")) return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
    try {
      return await run();
    } catch (error) {
      if (error instanceof AiInterviewGone) {
        throttle.failed(request.ip, "ai-interview");
        return reply.code(404).send({ error: "interview_not_found", message: error.message });
      }
      throw error;
    }
  };

  routes.post(
    "/ai-interviews",
    {
      schema: {
        tags: TAGS,
        summary: "Set up an AI interview",
        description:
          "A first-round interview the model holds by chat, for a role from the library or a pasted job description: a number of questions, each with one follow-up, within a time limit. The model is never told who the candidate is. Returns the candidate's link. Audited.",
        security: SECURED,
        body: z.object({
          title: z.string().min(1).max(200),
          roleId: z.string().max(100).nullable().default(null).describe("A role from GET /job-tests/roles."),
          job: z.string().max(20_000).default("").describe("The job description, when there is no role, or to add to it."),
          seniority: seniority.default("junior"),
          questions: z.number().int().min(2).max(8).default(4),
          minutes: z.number().int().min(10).max(90).default(30),
          candidateName: z.string().min(1).max(200),
          candidateRef: z.string().max(100).default(""),
          candidateEmail: z.string().email().max(320).nullable().default(null).describe("When given, and the server sends email, the candidate is emailed the link."),
          resume: z.string().max(20_000).nullable().default(null).describe("The candidate's resume as text, for questions from their own work. Sealed; the model never sees the name, email, phone or links in it."),
        }),
        response: { 201: full, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.code(201).send(await aiInterviews.create(actor, request.body));
    },
  );

  routes.get(
    "/ai-interviews",
    { schema: { tags: TAGS, summary: "AI interviews, latest first", security: SECURED, response: { 200: z.object({ interviews: z.array(interview).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send({ interviews: await aiInterviews.list(actor) });
    },
  );

  routes.get(
    "/ai-interviews/:id",
    { schema: { tags: TAGS, summary: "An AI interview with its transcript", description: "Whether the transcript's hash chain holds, and the model's reading beside it.", security: SECURED, params: idParams, response: { 200: full, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await aiInterviews.view(actor, request.params.id));
    },
  );

  routes.post(
    "/ai-interviews/:id/scorecard",
    {
      schema: { tags: TAGS, summary: "Record a person's decision", description: "Once the interview has finished: criteria on 1–5 and a recommendation, by the person who read it. Audited.", security: SECURED, params: idParams, body: scorecard, response: { 200: full, ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await aiInterviews.decide(actor, request.params.id, request.body));
    },
  );

  routes.post(
    "/ai-interviews/:id/assess",
    { schema: { tags: TAGS, summary: "Read the transcript again", description: "When the reading after the interview did not come (the model was busy, or the spend cap was reached).", security: SECURED, params: idParams, response: { 200: full, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await aiInterviews.reassess(actor, request.params.id));
    },
  );

  routes.post(
    "/ai-interviews/:id/cancel",
    { schema: { tags: TAGS, summary: "Cancel an AI interview", description: "The link stops working. Audited.", security: SECURED, params: idParams, response: { 200: full, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await aiInterviews.cancel(actor, request.params.id));
    },
  );

  routes.get(
    "/ai-interviews/room/:code",
    { schema: { tags: ROOM_TAGS, summary: "The interview, as the candidate's link shows it", description: "No account: the code in the link is the proof. The conversation so far; never the reading or the scorecard.", params: codeParams, response: { 200: room, ...refusals } } },
    async (request, reply) => guard(request, reply, async () => reply.send(await aiInterviews.room(request.params.code))),
  );

  routes.post(
    "/ai-interviews/room/:code/start",
    { schema: { tags: ROOM_TAGS, summary: "Start the interview", description: "The clock starts and the first question is asked. Called again, it asks again only when the interviewer has not replied (the model was busy); otherwise it changes nothing.", params: codeParams, response: { 200: room, ...refusals } } },
    async (request, reply) => guard(request, reply, async () => reply.send(await aiInterviews.start(request.params.code))),
  );

  routes.post(
    "/ai-interviews/room/:code/answer",
    {
      schema: {
        tags: ROOM_TAGS,
        summary: "Answer the question on screen",
        description: "Text, with code when it helps. Returns the conversation with the interviewer's next words; after the last question's follow-up, the interview ends.",
        params: codeParams,
        body: z.object({ text: z.string().max(8_000), code: z.string().max(40_000).nullable().default(null), language: z.string().max(20).nullable().default(null) }),
        response: { 200: room, ...refusals },
      },
    },
    async (request, reply) => guard(request, reply, async () => reply.send(await aiInterviews.answer(request.params.code, request.body))),
  );
}
