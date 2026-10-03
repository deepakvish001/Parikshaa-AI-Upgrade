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
import { MAX_REPORT_DAYS, type CandidateReports } from "./candidate-report.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

/** The candidate report v2 (plan row 90): its PDF, and a link for a hiring manager. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const RESULTS = ["Results"];
const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 429: S.errorResponse } as const;

const shared = z.object({
  valid: z.literal(true),
  institution: z.string(),
  exam: z.object({ title: z.string() }),
  candidate: z.object({ name: z.string(), ref: z.string() }),
  sat: z.string(),
  durationMs: z.number().nullable(),
  total: z.number(),
  maxTotal: z.number(),
  percent: z.number(),
  outcome: z.enum(["qualified", "failed"]).nullable(),
  standing: z.object({ percentile: z.number().nullable(), rank: z.number().int().nullable(), graded: z.number().int(), meanPercent: z.number().nullable() }),
  sections: z.array(z.object({ title: z.string(), score: z.number(), max: z.number() })).readonly(),
  questions: z
    .array(
      z.object({
        number: z.number().int(),
        stem: z.string(),
        kind: z.string(),
        score: z.number(),
        max: z.number(),
        tests: z.object({ passed: z.number().int(), total: z.number().int() }).nullable(),
        code: z.object({ language: z.string(), source: z.string() }).nullable().describe("The program a code question was answered with; other answers stay with the institution."),
        aiPrompts: z.number().int(),
      }),
    )
    .readonly(),
  followUps: z.array(z.object({ number: z.number().int(), prompt: z.string(), reply: z.string().nullable(), verdict: z.string().nullable() })).readonly(),
  integrity: z
    .object({
      identity: z.enum(["not_taken", "pending", "verified", "rejected"]),
      snapshots: z.number().int(),
      events: z.array(z.object({ kind: z.string(), label: z.string(), count: z.number().int() })).readonly(),
    })
    .nullable()
    .describe("For a proctored exam: observations for a person to weigh, never a finding."),
  record: z.object({ head: z.string(), length: z.number().int() }),
  expiresAt: z.string(),
});

const pdf = (reply: FastifyReply, bytes: Uint8Array, name: string) =>
  reply.header("content-type", "application/pdf").header("content-disposition", `attachment; filename="${name}"`).header("cache-control", "no-store").send(Buffer.from(bytes));

export function registerCandidateReportRoutes(
  routes: Routes,
  deps: {
    readonly reports: CandidateReports;
    readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
    readonly throttle: LoginThrottle;
  },
): void {
  const { reports, staff, throttle } = deps;

  routes.get(
    "/attempts/:attemptId/report.pdf",
    {
      schema: {
        tags: RESULTS,
        summary: "A candidate's report, as a PDF",
        description: "One page to decide from (marks, standing, sections, each question with its tests and AI prompts, the proctoring's observations, follow-up questions), then each program. Graded attempts only.",
        security: SECURED,
        params: S.attemptParams,
        response: { 200: z.any().describe("application/pdf"), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return pdf(reply, await reports.pdfForStaff(actor, attemptId(request.params.attemptId)), `report-${request.params.attemptId}.pdf`);
    },
  );

  routes.post(
    "/attempts/:attemptId/report-link",
    {
      schema: {
        tags: RESULTS,
        summary: "A link to a candidate's report, for a hiring manager",
        description: `Anyone with the link sees the report until it expires (at most ${MAX_REPORT_DAYS} days), with no contact details. It reads the record when opened, so a result set aside or erased since shows as withdrawn. Audited as report.shared.`,
        security: SECURED,
        params: S.attemptParams,
        body: z.object({ days: z.number().int().min(1).max(MAX_REPORT_DAYS).default(7) }),
        response: { 201: z.object({ link: z.string(), expiresAt: z.string() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.code(201).send(await reports.share(actor, attemptId(request.params.attemptId), request.body.days));
    },
  );

  routes.get(
    "/reports/:code",
    {
      schema: {
        tags: RESULTS,
        summary: "Open a shared candidate report",
        description: "Public, through the link. valid: false with expired once the link has run out, withdrawn when the result has since been set aside or erased, unknown for a link Parikshaa did not make.",
        params: z.object({ code: z.string().min(1).max(400) }),
        response: { 200: z.union([shared, z.object({ valid: z.literal(false), reason: z.enum(["unknown", "expired", "withdrawn"]) })]), 429: S.errorResponse },
      },
    },
    async (request, reply) => {
      if (throttle.blocked(request.ip, "report")) return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      const seen = await reports.view(request.params.code);
      if (!seen.valid && seen.reason === "unknown") throttle.failed(request.ip, "report");
      return reply.header("cache-control", "no-store").header("referrer-policy", "no-referrer").send(seen);
    },
  );

  routes.get(
    "/reports/:code/report.pdf",
    {
      schema: {
        tags: RESULTS,
        summary: "A shared candidate report, as a PDF",
        params: z.object({ code: z.string().min(1).max(400) }),
        response: { 200: z.any().describe("application/pdf"), 404: S.errorResponse, 429: S.errorResponse },
      },
    },
    async (request, reply) => {
      if (throttle.blocked(request.ip, "report")) return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
      const bytes = await reports.viewPdf(request.params.code);
      if (bytes === null) {
        throttle.failed(request.ip, "report");
        return reply.code(404).send({ error: "not_found", message: "This link shows nothing now: it has expired, or the result was withdrawn" });
      }
      return pdf(reply, bytes, "candidate-report.pdf");
    },
  );
}
