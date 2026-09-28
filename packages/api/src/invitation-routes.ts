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
import { CameraRequired, ImportRejected, InvalidInvitation, OutsideWindow, type InvitationService } from "./invitation-service.js";
import { ConsentRequired } from "./privacy.js";
import { noticeSchema } from "./privacy-routes.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface InvitationRouteDeps {
  readonly invitations: InvitationService;
  readonly throttle: LoginThrottle;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const INVITE = ["Invitations"];
const SECURED = [{ staffAuth: [] }];
const refusals = {
  400: S.errorResponse,
  401: S.errorResponse,
  403: S.errorResponse,
  404: S.errorResponse,
  409: S.errorResponse,
} as const;

const channel = z.enum(["email", "sms"]);
const windowBody = z.object({
  opensAt: z.iso.datetime({ offset: true }),
  closesAt: z.iso.datetime({ offset: true }),
  hardClose: z.boolean().default(true).describe("End every attempt when the window closes, however late it started."),
});
const windowResponse = z.object({ opensAt: z.string(), closesAt: z.string(), hardClose: z.boolean() });
const problem = z.object({ row: z.number(), message: z.string() });
const delivery = z.object({ status: z.string(), purpose: z.string(), at: z.string(), error: z.string().nullable() }).nullable();
const invitation = z.object({
  id: z.string(),
  candidateRef: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  opensAt: z.string(),
  closesAt: z.string(),
  attemptId: z.string().nullable(),
  attemptState: z.enum(["not_started", "in_progress", "submitted", "graded", "void"]),
  revoked: z.boolean(),
  delivery: z.object({ email: delivery, sms: delivery }),
});

const csvCell = (value: string | null) => {
  const text = value ?? "";
  // Quote everything, and defuse cells a spreadsheet would run as a formula.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/**
 * Inviting a cohort (ROADMAP §5): the exam's window, the candidate list, and
 * the one unauthenticated route a candidate uses to open their link.
 */
export function registerInvitationRoutes(routes: Routes, deps: InvitationRouteDeps): void {
  const { invitations, throttle, staff } = deps;

  routes.put(
    "/exams/:examId/window",
    {
      schema: {
        tags: INVITE,
        summary: "Schedule an exam",
        description: "Candidates can open their link only inside this window, or a narrower one of their own.",
        security: SECURED,
        params: S.examParams,
        body: windowBody,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const { opensAt, closesAt, hardClose } = request.body;
      await invitations.setWindow(actor, request.params.examId, {
        opensAt: new Date(opensAt).toISOString(),
        closesAt: new Date(closesAt).toISOString(),
        hardClose,
      });
      return reply.send({ ok: true });
    },
  );

  routes.get(
    "/exams/:examId/window",
    {
      schema: {
        tags: INVITE,
        summary: "When an exam can be sat",
        security: SECURED,
        params: S.examParams,
        response: { 200: windowResponse.nullable(), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send(await invitations.getWindow(actor, request.params.examId));
    },
  );

  routes.post(
    "/exams/:examId/invitations/import",
    {
      schema: {
        tags: INVITE,
        summary: "Invite candidates from a CSV file",
        description:
          "Columns: ref (or roll_number, candidate_id, application_id), name, email, phone, and optionally opens_at and closes_at for a narrower window per candidate. Times without an offset are India Standard Time; phones are Indian mobiles. With dryRun, everything is checked and nothing changes. Otherwise it is all or nothing, and each candidate's invitation and reminder are queued for delivery.",
        security: SECURED,
        params: S.examParams,
        body: z.object({
          csv: z.string().max(10_000_000),
          dryRun: z.boolean().default(true),
          channels: z.array(channel).readonly().default(["email", "sms"]),
        }),
        response: {
          200: z.object({
            dryRun: z.literal(true),
            candidates: z.number(),
            problems: z.array(problem).readonly(),
            warnings: z.array(problem).readonly(),
            preview: z
              .array(z.object({ candidateRef: z.string(), name: z.string(), email: z.string().nullable(), phone: z.string().nullable(), opensAt: z.string(), closesAt: z.string() }))
              .readonly(),
          }),
          201: z.object({ dryRun: z.literal(false), invited: z.number(), warnings: z.array(problem).readonly() }),
          422: z.object({ error: z.literal("invalid_import"), problems: z.array(problem).readonly() }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:start");
      if (actor === null) return;
      const { csv, dryRun, channels } = request.body;
      try {
        const result = await invitations.importCandidates(actor, request.params.examId, csv, { dryRun, channels });
        return reply.code(result.dryRun ? 200 : 201).send(result);
      } catch (error) {
        if (error instanceof ImportRejected) return reply.code(422).send({ error: "invalid_import", problems: error.problems });
        throw error;
      }
    },
  );

  routes.get(
    "/exams/:examId/invitations",
    {
      schema: {
        tags: INVITE,
        summary: "Everyone invited to an exam, and where each has got to",
        security: SECURED,
        params: S.examParams,
        response: { 200: z.object({ invitations: z.array(invitation).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:read");
      if (actor === null) return;
      return reply.send({ invitations: await invitations.list(actor, request.params.examId) });
    },
  );

  routes.get(
    "/candidates/search",
    {
      schema: {
        tags: INVITE,
        summary: "Find candidates across every exam",
        description: "By reference, name or email; the most recently invited first, at most twenty. Fewer than two characters finds nobody.",
        security: SECURED,
        querystring: z.object({ q: z.string().max(200) }),
        response: {
          200: z.object({
            candidates: z
              .array(
                z.object({
                  invitationId: z.string(),
                  examId: z.string(),
                  examTitle: z.string(),
                  candidateRef: z.string(),
                  name: z.string(),
                  email: z.string().nullable(),
                  attemptId: z.string().nullable(),
                  attemptState: z.enum(["not_started", "in_progress", "submitted", "graded", "void"]),
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
      return reply.send({ candidates: await invitations.search(actor, request.query.q) });
    },
  );

  routes.get(
    "/exams/:examId/invitations/links.csv",
    {
      schema: {
        tags: INVITE,
        summary: "Every candidate's link, as CSV",
        description: "For an institution that hands links out itself. The links are credentials; exporting them is audited.",
        security: SECURED,
        params: S.examParams,
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:start");
      if (actor === null) return;
      const rows = await invitations.links(actor, request.params.examId);
      const lines = [
        ["ref", "name", "email", "phone", "opens_at", "closes_at", "link"].map(csvCell).join(","),
        ...rows.map((r) => [r.candidateRef, r.name, r.email, r.phone, r.opensAt, r.closesAt, r.link].map(csvCell).join(",")),
      ];
      return reply
        .header("content-type", "text/csv; charset=utf-8")
        .header("content-disposition", `attachment; filename="${request.params.examId}-links.csv"`)
        .send(`﻿${lines.join("\r\n")}\r\n`);
    },
  );

  routes.post(
    "/invitations/:invitationId/resend",
    {
      schema: {
        tags: INVITE,
        summary: "Send a candidate their link again",
        security: SECURED,
        params: z.object({ invitationId: z.string().min(1) }),
        body: z.object({ channels: z.array(channel).readonly().default(["email", "sms"]) }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:start");
      if (actor === null) return;
      await invitations.resend(actor, request.params.invitationId, request.body.channels);
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/invitations/:invitationId/revoke",
    {
      schema: {
        tags: INVITE,
        summary: "Revoke an invitation",
        description: "Its link stops working. An attempt already started is not affected.",
        security: SECURED,
        params: z.object({ invitationId: z.string().min(1) }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:start");
      if (actor === null) return;
      await invitations.revoke(actor, request.params.invitationId);
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/invitations/briefing",
    {
      schema: {
        tags: ["Candidate"],
        summary: "Read an invitation's instructions without opening it",
        description:
          "The paper's shape and marking, for the instructions a candidate reads before beginning. Starts nothing and claims nothing; opening the test is still POST /invitations/redeem. `started` says the attempt has begun, so the page can skip straight to it.",
        body: z.object({ code: z.string().min(1).max(512) }),
        response: {
          200: z.object({
            title: z.string(),
            candidate: z.object({ name: z.string(), ref: z.string() }),
            started: z.boolean(),
            opensAt: z.string(),
            closesAt: z.string(),
            durationMs: z.number(),
            questionCount: z.number(),
            totalMarks: z.number(),
            sections: z.array(z.object({ title: z.string(), questionCount: z.number(), durationMs: z.number().nullable() })).readonly(),
            kinds: z.array(z.enum(["mcq", "multiple", "numeric", "short", "code"])).readonly(),
            negativeMarks: z.number().describe("The largest mark taken away for a wrong answer; zero when nothing is."),
            allowRevision: z.boolean(),
            calculator: z.boolean(),
            proctored: z.boolean(),
          }),
          404: S.errorResponse,
          429: S.errorResponse,
        },
      },
    },
    async (request, reply) => {
      if (throttle.blocked(request.ip, "invitation")) {
        return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      }
      try {
        return reply.send(await invitations.briefing(request.body.code));
      } catch (error) {
        if (error instanceof InvalidInvitation) {
          throttle.failed(request.ip, "invitation");
          return reply.code(404).send({ error: "invalid_invitation", message: error.message });
        }
        throw error;
      }
    },
  );

  routes.post(
    "/invitations/redeem",
    {
      schema: {
        tags: ["Candidate"],
        summary: "Open an invitation link",
        description:
          "Starts the candidate's attempt the first time, inside their window, and resumes it every time after — from any device — until the window closes. Answers 403 not_open_yet before the window, 410 window_closed after it, and 428 consent_required with the privacy notice when the organisation has one and this first opening did not agree to its current version.",
        body: z.object({
          code: z.string().min(1).max(512),
          consent: z
            .object({ noticeVersion: z.number().int().min(1) })
            .optional()
            .describe("Agreement to the organisation's privacy notice, by version. Needed on the first opening when the organisation has one."),
          camera: z.boolean().optional().describe("The page has the camera working. Needed on the first opening of a proctored exam."),
        }),
        response: {
          200: z.object({ token: z.string(), attemptId: z.string(), resumed: z.boolean() }),
          402: S.errorResponse.describe("out_of_credits: the organisation's prepaid credits have run out."),
          428: z.union([
            z.object({ error: z.literal("consent_required"), notice: noticeSchema }),
            z.object({ error: z.literal("camera_required"), proctoring: S.proctoringPolicy }),
          ]),
          403: z.object({ error: z.literal("not_open_yet"), opensAt: z.string(), closesAt: z.string() }),
          404: S.errorResponse,
          410: z.object({ error: z.literal("window_closed"), opensAt: z.string(), closesAt: z.string() }),
          429: S.errorResponse,
        },
      },
    },
    async (request, reply) => {
      if (throttle.blocked(request.ip, "invitation")) {
        return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      }
      try {
        const opened = await invitations.redeem(request.body.code, request.body.consent, request.body.camera);
        return reply.send(opened);
      } catch (error) {
        if (error instanceof ConsentRequired) return reply.code(428).send({ error: "consent_required", notice: error.notice });
        if (error instanceof CameraRequired) return reply.code(428).send({ error: "camera_required", proctoring: error.proctoring });
        if (error instanceof InvalidInvitation) {
          throttle.failed(request.ip, "invitation");
          return reply.code(404).send({ error: "invalid_invitation", message: error.message });
        }
        if (error instanceof OutsideWindow) {
          return error.when === "early"
            ? reply.code(403).send({ error: "not_open_yet", opensAt: error.opensAt, closesAt: error.closesAt })
            : reply.code(410).send({ error: "window_closed", opensAt: error.opensAt, closesAt: error.closesAt });
        }
        throw error;
      }
    },
  );
}
