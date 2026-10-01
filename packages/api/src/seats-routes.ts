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
import type { SeatService } from "./seats.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

/** Seats, admit cards and attendance for an exam held in rooms. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface SeatRouteDeps {
  readonly seats: SeatService;
  readonly throttle: LoginThrottle;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAGS = ["Invitations"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;

const seatRow = z.object({
  ref: z.string(),
  name: z.string(),
  centre: z.string(),
  room: z.string().describe("Empty until seated."),
  seat: z.string(),
  present: z.boolean(),
  attemptState: z.string(),
});

const pdfReply = (reply: FastifyReply, name: string, bytes: Uint8Array) =>
  reply.header("content-type", "application/pdf").header("content-disposition", `inline; filename="${name}"`).header("cache-control", "no-store").send(Buffer.from(bytes));

export function registerSeatRoutes(routes: Routes, deps: SeatRouteDeps): void {
  const { seats, throttle, staff } = deps;

  routes.get(
    "/exams/:examId/seats",
    {
      schema: {
        tags: TAGS,
        summary: "Who sits where, and who is in the room",
        security: SECURED,
        params: S.examParams,
        response: { 200: z.object({ seats: z.array(seatRow).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send({ seats: await seats.seats(actor, request.params.examId) });
    },
  );

  routes.post(
    "/exams/:examId/seats",
    {
      schema: {
        tags: TAGS,
        summary: "Seat the invited candidates",
        description: "Rooms in order, each with its centre and number of seats; candidates are seated by roll number, room after room. Replaces any earlier seating. Audited.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ rooms: z.array(z.object({ centre: z.string().max(200).default(""), room: z.string().min(1).max(100), seats: z.number().int().min(1).max(5000) })).min(1).max(200) }),
        response: { 200: z.object({ seated: z.number(), spare: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:start");
      if (actor === null) return;
      return reply.send(await seats.allocate(actor, request.params.examId, request.body.rooms));
    },
  );

  routes.get(
    "/exams/:examId/admit-cards.pdf",
    {
      schema: {
        tags: TAGS,
        summary: "Admit cards to print",
        description: "One A4 page per seated candidate, or only `ref`'s: the exam, when it opens, the centre, room and seat, and a code the invigilator scans at the door.",
        security: SECURED,
        params: S.examParams,
        querystring: z.object({ ref: z.string().optional() }),
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return pdfReply(reply, `admit-cards-${request.params.examId}.pdf`, await seats.admitCards(actor, request.params.examId, request.query.ref ?? null));
    },
  );

  routes.post(
    "/exams/:examId/attendance",
    {
      schema: {
        tags: TAGS,
        summary: "Mark a candidate present",
        description: "From the code on their admit card, as a phone's camera reads it, or their roll number typed in. Says where they sit, and whether they were marked already.",
        security: SECURED,
        params: S.examParams,
        body: z.object({ code: z.string().min(1).max(500) }),
        response: {
          200: z.object({ ref: z.string(), name: z.string(), room: z.string(), seat: z.string(), already: z.object({ by: z.string(), at: z.string() }).nullable() }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send(await seats.markPresent(actor, request.params.examId, request.body.code));
    },
  );

  routes.get(
    "/invitations/admit-card.pdf",
    {
      schema: {
        tags: ["Candidate"],
        summary: "A candidate's own admit card",
        description: "From the code in their invitation link. 404 when the link is not valid or the candidate has no seat yet.",
        querystring: z.object({ code: z.string().min(1).max(512) }),
      },
    },
    async (request, reply) => {
      if (throttle.blocked(request.ip, "invitation")) return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      try {
        const card = await seats.admitCardFor(request.query.code);
        if (card === null) return reply.code(404).send({ error: "no_seat", message: "Your seat has not been given yet" });
        return pdfReply(reply, "admit-card.pdf", card);
      } catch (error) {
        throttle.failed(request.ip, "invitation");
        throw error;
      }
    },
  );
}
