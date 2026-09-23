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
import type { InvigilationService } from "./invigilation.js";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface InvigilationRouteDeps {
  readonly invigilation: InvigilationService;
  readonly service: ExamService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly candidate: (request: FastifyRequest, reply: FastifyReply) => Promise<AttemptClaims | null>;
}

const LIVE = ["Invigilation"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 422: S.errorResponse } as const;

const announcement = z.object({ id: z.string(), message: z.string(), authorName: z.string(), at: z.string() });
const liveRow = z.object({
  invitationId: z.string().nullable(),
  attemptId: z.string().nullable(),
  ref: z.string(),
  name: z.string(),
  state: z.enum(["not_started", "in_progress", "submitted", "graded", "void"]),
  answered: z.number(),
  questions: z.number(),
  startedAt: z.number().nullable(),
  lastSeenAt: z.number().nullable(),
  lastActivityAt: z.number().nullable().describe("The latest autosave or committed answer: typing, as far as the server can tell."),
  expiresAt: z.number().nullable(),
  extraMinutes: z.number(),
  reopened: z.number(),
  awaitingReply: z.boolean().describe("A follow-up question is waiting for the candidate's reply."),
  proctoring: z
    .object({
      identity: z.enum(["not_taken", "pending", "verified", "rejected"]),
      snapshots: z.number(),
      lastSnapshotAt: z.number().nullable(),
      events: z.record(z.string(), z.number()).describe("What the browser reported, by kind: tab_hidden, fullscreen_exit, copy, paste, camera_off."),
    })
    .nullable()
    .describe("For a proctored exam: the identity check and what the camera and browser sent. Observations, not findings."),
  flags: z.object({
    cameraOff: z.boolean().describe("A proctored attempt whose webcam photos have stopped arriving."),
    away: z.boolean().describe("The page has stopped checking in: closed, or offline."),
    idle: z.boolean().describe("The page is open, but nothing has been typed for the idle threshold."),
    overdue: z.boolean().describe("Time is up and nothing has written since to close the attempt."),
  }),
});

export function registerInvigilationRoutes(routes: Routes, deps: InvigilationRouteDeps): void {
  const { invigilation, service, staff, candidate } = deps;

  routes.get(
    "/exams/:examId/live",
    {
      schema: {
        tags: LIVE,
        summary: "The sitting, live",
        description:
          "Who has started, how far each candidate has got, who has gone quiet, and what the room has been told. No answer is included. Poll it every few seconds.",
        security: SECURED,
        params: S.examParams,
        querystring: z.object({ idleMinutes: z.coerce.number().int().min(1).max(120).default(5) }),
        response: {
          200: z.object({
            exam: z.object({ id: z.string(), title: z.string() }),
            at: z.number(),
            counts: z.object({
              invited: z.number(),
              notStarted: z.number(),
              inProgress: z.number(),
              away: z.number(),
              idle: z.number(),
              cameraOff: z.number(),
              identityPending: z.number(),
              submitted: z.number(),
              graded: z.number(),
              void: z.number(),
            }),
            rows: z.array(liveRow).readonly(),
            announcements: z.array(announcement).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send(await invigilation.live(actor, request.params.examId, request.query.idleMinutes));
    },
  );

  routes.post(
    "/exams/:examId/announcements",
    {
      schema: {
        tags: LIVE,
        summary: "Tell everyone sitting this exam something",
        description: "Shown to every candidate on their page within half a minute. Audited.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ message: z.string().min(1).max(500) }),
        response: { 201: announcement, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:extend");
      if (actor === null) return;
      return reply.code(201).send(await invigilation.announce(actor, request.params.examId, request.body.message));
    },
  );

  routes.post(
    "/attempts/:attemptId/reopen",
    {
      schema: {
        tags: LIVE,
        summary: "Reopen a submitted attempt, with a reason and more time",
        description:
          "For an attempt that closed by accident — a crash, a power cut, submit pressed by mistake. Only before grading or setting aside. A signed-in person's decision, recorded in the ledger with their name and the reason; the candidate gets the minutes from now.",
        security: SECURED,
        params: S.attemptParams,
        body: S.extendBody,
        response: { 200: S.extendResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:extend");
      if (actor === null) return;
      const expiresAt = await service.reopen(actor, attemptId(request.params.attemptId), request.body.minutes, request.body.reason);
      return reply.send({ expiresAt });
    },
  );

  routes.get(
    "/attempts/me/announcements",
    {
      schema: {
        tags: ["Candidate"],
        summary: "What the invigilators have told this sitting",
        security: [{ attemptToken: [] }],
        response: {
          200: z.object({ announcements: z.array(z.object({ id: z.string(), message: z.string(), at: z.string() })).readonly() }),
          401: S.errorResponse,
          429: S.errorResponse,
        },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      const list = await invigilation.forCandidate(claims);
      return reply.send({ announcements: list.map(({ id, message, at }) => ({ id, message, at })) });
    },
  );
}
