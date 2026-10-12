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
import type { ProctorService } from "./proctoring.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface ProctoringRouteDeps {
  readonly proctor: ProctorService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly candidate: (request: FastifyRequest, reply: FastifyReply) => Promise<AttemptClaims | null>;
}

const TAG = ["Proctoring"];
const CANDIDATE = ["Candidate"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 410: S.errorResponse, 422: S.errorResponse, 429: S.errorResponse } as const;

const media = z.object({ id: z.string(), kind: z.enum(["selfie", "id", "snapshot"]), takenAt: z.string(), sha256: z.string() });
const base64Image = z.string().min(100).describe("A JPEG or PNG, base64 (a data: URL prefix is accepted).");

export function registerProctoringRoutes(routes: Routes, deps: ProctoringRouteDeps): void {
  const { proctor, staff, candidate } = deps;

  routes.post(
    "/attempts/me/identity",
    {
      bodyLimit: 2_000_000,
      schema: {
        tags: CANDIDATE,
        summary: "The identity photos: the candidate, and their photo ID",
        description: "Once, before the questions. The ledger records both photos' SHA-256; the photos are sealed under the attempt's key.",
        security: [{ attemptToken: [] }],
        body: z.object({ selfie: base64Image, id: base64Image }),
        response: { 201: z.object({ ok: z.literal(true) }), ...refusals },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      await proctor.captureIdentity(claims, request.body.selfie, request.body.id);
      return reply.code(201).send({ ok: true });
    },
  );

  routes.post(
    "/attempts/me/snapshots",
    {
      bodyLimit: 400_000,
      schema: {
        tags: CANDIDATE,
        summary: "A webcam photo, at the exam's interval",
        security: [{ attemptToken: [] }],
        body: z.object({ image: base64Image }),
        response: { 202: z.object({ ok: z.literal(true) }), ...refusals },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      await proctor.snapshot(claims, request.body.image);
      return reply.code(202).send({ ok: true });
    },
  );

  routes.post(
    "/attempts/me/proctor-events",
    {
      schema: {
        tags: CANDIDATE,
        summary: "What the browser reported: the tab hidden, full screen left, a copy or paste, the camera stopping",
        description: "Timed on arrival, by the server.",
        security: [{ attemptToken: [] }],
        body: z.object({ events: z.array(z.string()).min(1).max(50) }),
        response: { 202: z.object({ ok: z.literal(true) }), ...refusals },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      await proctor.events(claims, request.body.events);
      return reply.code(202).send({ ok: true });
    },
  );

  const op = z.object({
    t: z.number().describe("The browser's clock, ms since 1970."),
    at: z.number().int().min(0),
    del: z.number().int().min(0),
    ins: z.string().max(256 * 1024),
    paste: z.boolean().optional(),
    reset: z.boolean().optional().describe("The whole text became `ins`."),
  });

  routes.post(
    "/attempts/me/code/:questionId/timeline",
    {
      bodyLimit: 600_000,
      schema: {
        tags: CANDIDATE,
        summary: "How a code answer is being written: the editor's changes, for playback",
        description: "Sent in batches while the candidate types. Sealed under the attempt's key; staff can play it back after. Capped per attempt.",
        security: [{ attemptToken: [] }],
        params: z.object({ questionId: z.string().min(1).max(200) }),
        body: z.object({ ops: z.array(op).min(1).max(1000) }),
        response: { 202: z.object({ ok: z.literal(true) }), ...refusals },
      },
    },
    async (request, reply) => {
      const claims = await candidate(request, reply);
      if (claims === null) return;
      await proctor.codeTimeline(claims, request.params.questionId, request.body.ops);
      return reply.code(202).send({ ok: true });
    },
  );

  routes.get(
    "/attempts/:attemptId/playback",
    {
      schema: {
        tags: TAG,
        summary: "How each code answer of an attempt was written, to play back",
        description: "The editor's changes in order, with every paste and how many were large. Signals for a person to weigh; none of it decides anything.",
        security: SECURED,
        params: S.attemptParams,
        response: {
          200: z.object({
            questions: z
              .array(
                z.object({
                  questionId: z.string(),
                  ops: z.array(op).readonly(),
                  pastes: z.array(z.object({ t: z.number(), chars: z.number() })).readonly(),
                  largePastes: z.number().describe("Pastes of 200 characters or more."),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send({ questions: await proctor.playback(actor, attemptId(request.params.attemptId)) });
    },
  );

  routes.get(
    "/attempts/:attemptId/proctoring",
    {
      schema: {
        tags: TAG,
        summary: "An attempt's identity photos, webcam photos and browser events",
        description: "Observations for a person to weigh; none of it decides anything.",
        security: SECURED,
        params: S.attemptParams,
        response: {
          200: z.object({
            policy: S.proctoringPolicy.nullable(),
            identity: z.object({
              selfie: media.nullable(),
              id: media.nullable(),
              capturedAt: z.number().nullable(),
              review: z.object({ outcome: z.enum(["verified", "rejected"]), reason: z.string(), decidedBy: z.string(), at: z.number() }).nullable(),
              matchesLedger: z.boolean().describe("The stored photos are the ones the ledger committed to."),
            }),
            snapshots: z.array(media).readonly(),
            events: z.array(z.object({ kind: z.string(), at: z.string() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send(await proctor.view(actor, attemptId(request.params.attemptId)));
    },
  );

  routes.get(
    "/attempts/:attemptId/proctoring/photos/:mediaId",
    {
      schema: {
        tags: TAG,
        summary: "One proctoring photo, as an image",
        description: "Opened from its seal and checked against its hash. Not cached.",
        security: SECURED,
        params: z.object({ attemptId: z.string().min(1), mediaId: z.string().min(1) }),
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      const { image, type } = await proctor.photo(actor, attemptId(request.params.attemptId), request.params.mediaId);
      return reply.header("cache-control", "no-store").type(type).send(image);
    },
  );

  routes.post(
    "/attempts/:attemptId/identity/review",
    {
      schema: {
        tags: TAG,
        summary: "Decide on the identity photos",
        description: "A signed-in person's decision, with a reason, recorded in the ledger with their name. Before grading; a later decision corrects an earlier one.",
        security: SECURED,
        params: S.attemptParams,
        body: z.object({ outcome: z.enum(["verified", "rejected"]), reason: z.string().min(1).max(500) }),
        response: { 200: z.object({ ok: z.literal(true) }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:extend");
      if (actor === null) return;
      await proctor.reviewIdentity(actor, attemptId(request.params.attemptId), request.body.outcome, request.body.reason);
      return reply.send({ ok: true });
    },
  );
}
