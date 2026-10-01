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
import { InterviewGone, LANGUAGES, type InterviewService } from "./interviews.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

/** The interview room: scheduling and scoring by staff, and the candidate's side by link. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface InterviewRouteDeps {
  readonly interviews: InterviewService;
  readonly throttle: LoginThrottle;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Interviews"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;
const recommendation = z.enum(["strong_yes", "yes", "no", "strong_no"]);
const scorecard = z.object({ criteria: z.array(z.object({ name: z.string().min(1).max(100), score: z.number().int() })).min(1).max(12).readonly(), recommendation, summary: z.string().max(5000).default("") });
const language = z.enum(LANGUAGES);
const interview = z.object({
  id: z.string(),
  title: z.string(),
  candidateRef: z.string(),
  candidateName: z.string(),
  candidateEmail: z.string().nullable(),
  interviewer: z.string(),
  scheduledAt: z.string(),
  minutes: z.number(),
  meetingUrl: z.string(),
  problem: z.string(),
  language: z.string(),
  code: z.string(),
  codeUpdatedAt: z.string().nullable(),
  notes: z.string(),
  scorecard: scorecard.nullable(),
  status: z.enum(["scheduled", "done", "cancelled"]),
  driveId: z.string().nullable(),
  createdAt: z.string(),
  link: z.string().describe("The candidate's link to the room."),
});
const idParams = z.object({ id: z.string() });
const codeParams = z.object({ code: z.string().min(5).max(300) });

export function registerInterviewRoutes(routes: Routes, deps: InterviewRouteDeps): void {
  const { interviews, throttle, staff } = deps;

  const guard = async <T>(request: FastifyRequest, reply: FastifyReply, run: () => Promise<T>) => {
    if (throttle.blocked(request.ip, "interview")) return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
    try {
      return await run();
    } catch (error) {
      if (error instanceof InterviewGone) {
        throttle.failed(request.ip, "interview");
        return reply.code(404).send({ error: "interview_not_found", message: error.message });
      }
      throw error;
    }
  };

  routes.post(
    "/interviews",
    {
      schema: {
        tags: TAGS,
        summary: "Schedule an interview",
        description: "With the candidate's details, a time, the video call link (or none, and a Jitsi room is made) and the problem to start on. Returns the candidate's link to the room. Audited.",
        security: SECURED,
        body: z.object({
          title: z.string().min(1).max(200),
          candidateName: z.string().min(1).max(200),
          candidateRef: z.string().max(100).default(""),
          candidateEmail: z.string().email().max(320).nullable().default(null),
          scheduledAt: z.string(),
          minutes: z.number().int().min(10).max(240).default(45),
          meetingUrl: z.string().max(500).nullable().default(null),
          problem: z.string().max(20000).default(""),
          language: language.default("python"),
          driveId: z.string().nullable().default(null),
        }),
        response: { 201: interview, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.code(201).send(await interviews.schedule(actor, request.body));
    },
  );

  routes.get(
    "/interviews",
    { schema: { tags: TAGS, summary: "Interviews, latest first", security: SECURED, response: { 200: z.object({ interviews: z.array(interview).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send({ interviews: await interviews.list(actor) });
    },
  );

  routes.get(
    "/interviews/:id",
    { schema: { tags: TAGS, summary: "An interview, with the candidate's code as it stands", security: SECURED, params: idParams, response: { 200: interview, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await interviews.get(actor, request.params.id));
    },
  );

  routes.put(
    "/interviews/:id",
    {
      schema: {
        tags: TAGS,
        summary: "Change the problem, keep notes, or cancel",
        security: SECURED,
        params: idParams,
        body: z.object({ problem: z.string().max(20000).optional(), notes: z.string().max(20000).optional(), cancel: z.boolean().optional() }),
        response: { 200: interview, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await interviews.edit(actor, request.params.id, request.body));
    },
  );

  routes.post(
    "/interviews/:id/scorecard",
    {
      schema: { tags: TAGS, summary: "Score the interview, and close it", description: "Criteria on 1–5 and a recommendation. Audited.", security: SECURED, params: idParams, body: scorecard, response: { 200: interview, ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send(await interviews.score(actor, request.params.id, request.body));
    },
  );

  routes.get(
    "/interviews/room/:code",
    {
      schema: {
        tags: ["Interview room"],
        summary: "The room, as the candidate's link shows it",
        description: "No account: the code in the link is the proof. The time, the video call link, the problem and the candidate's own code; never the notes or the scorecard.",
        params: codeParams,
        response: {
          200: z.object({
            title: z.string(),
            candidateName: z.string(),
            interviewer: z.string(),
            scheduledAt: z.string(),
            minutes: z.number(),
            meetingUrl: z.string(),
            problem: z.string(),
            language: z.string(),
            code: z.string(),
            status: z.enum(["scheduled", "done", "cancelled"]),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => guard(request, reply, async () => reply.send(await interviews.room(request.params.code))),
  );

  routes.put(
    "/interviews/room/:code/code",
    {
      schema: {
        tags: ["Interview room"],
        summary: "The candidate's code, as they type it",
        params: codeParams,
        body: z.object({ code: z.string().max(100_000), language }),
        response: { 200: z.object({ savedAt: z.string() }), ...refusals },
      },
    },
    async (request, reply) => guard(request, reply, async () => reply.send(await interviews.writeCode(request.params.code, request.body.code, request.body.language))),
  );
}
