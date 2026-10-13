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
import { REJECT_REASONS } from "@parikshaa/store";
import { HireRefused } from "./hire.js";
import { MAX_BULK, MAX_TEXT, type HirePipeline, type MoveInput, type RejectInput } from "./hire-pipeline.js";
import { hireRefusals, hireStatus, roundKind } from "./hire-routes.js";
import type { Actor, Permission } from "./staff-auth.js";

/**
 * A job's pipeline, for the company's staff (docs/HIRE-V2.md §3, §5, §10
 * S7, S15, S18, S21, S22, P14, P15, P20, F7; H2c): the table of applications,
 * one application's drawer and resume, and moving, rejecting, restoring,
 * notes and messages. Under `/hire/` (F7).
 */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const HIRING = ["Hiring"];
const SECURED = [{ staffAuth: [] }];

const applicationStatus = z.enum(["invited", "not_claimed", "active", "rejected", "withdrawn", "hired", "joined", "did_not_join"]);
const roundStatus = z.enum(["pending", "invited", "in_progress", "done", "passed", "failed", "skipped", "expired", "abandoned"]);
const rejectReason = z.enum(REJECT_REASONS as unknown as [string, ...string[]]);
const recommendation = z.enum(["advance", "hold", "low_match"]);
const integrityLevel = z.enum(["not_checked", "clear", "review", "high"]);
const source = z.enum(["link", "careers", "referral", "manual", "import"]);

const roundState = z.object({ status: roundStatus, score: z.number().nullable().describe("0–100, when known.") });
const screening = z
  .object({ status: z.enum(["done", "failed", "skipped"]), score: z.number().int().nullable(), recommendation: recommendation.nullable() })
  .nullable()
  .describe("The AI screening's reading (AI: may be wrong). Null until it has run.");
const integrity = z.object({ level: integrityLevel.describe("not_checked until a check has run."), verdict: z.enum(["genuine", "not_genuine"]).nullable().describe("A person's verdict.") });

const pipelineRow = z.object({
  id: z.string(),
  ref: z.string(),
  name: z.string(),
  status: applicationStatus,
  rejectReason: rejectReason.nullable(),
  roundId: z.string().nullable(),
  roundSince: z.string().describe("Since when it has been in its current round."),
  pastSla: z.boolean().describe("Active, and in its round longer than the job's review days."),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  source,
  sourceTag: z.string().nullable(),
  current: roundState.nullable().describe("Its result in the current round."),
  rounds: z.record(z.string(), roundState).describe("Its result in each round it has reached, by round id."),
  screening,
  integrity,
});

const pipelineView = z.object({
  job: z.object({
    id: z.string(),
    title: z.string(),
    status: z.enum(["draft", "held", "open", "paused", "closed"]),
    reviewSlaDays: z.number().int(),
    rounds: z.array(z.object({ id: z.string(), kind: roundKind, title: z.string(), position: z.number().int() })).readonly(),
  }),
  rows: z.array(pipelineRow).readonly().describe("In the order they applied. No contact details: open one for those."),
  total: z.number().int().describe("How many match the filter in all."),
  counts: z.object({
    byRound: z.record(z.string(), z.number().int()).describe("Active applications in each round, by round id."),
    byStatus: z.record(z.string(), z.number().int()),
    pastSla: z.number().int(),
  }),
});

const applicationView = z.object({
  id: z.string(),
  jobId: z.string(),
  ref: z.string().describe("The candidate's reference in this company: the same for every job."),
  name: z.string(),
  status: applicationStatus,
  rejectReason: rejectReason.nullable(),
  roundId: z.string().nullable(),
  roundSince: z.string(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  source,
  sourceTag: z.string().nullable(),
  aiOptOut: z.boolean().describe("The candidate asked for a person to read the application without AI."),
  deviceReady: z.boolean().nullable(),
  results: z
    .array(
      z.object({
        roundId: z.string(),
        status: roundStatus,
        score: z.number().nullable(),
        detail: z.record(z.string(), z.unknown()),
        invitedAt: z.string().nullable(),
        completedAt: z.string().nullable(),
        decidedBy: z.string().nullable(),
        decidedAt: z.string().nullable(),
      }),
    )
    .readonly(),
  screening,
  integrity,
  timeline: z
    .array(
      z.object({
        id: z.string(),
        at: z.string(),
        kind: z.string(),
        roundId: z.string().nullable(),
        by: z.string().describe("A member of staff by name, or candidate, or system."),
        text: z.string().nullable().describe("A note's, a message's or an override's words: only for those who may decide."),
        candidateVisible: z.boolean().describe("The candidate sees this step in their portal (never its detail)."),
      }),
    )
    .readonly(),
  contact: z
    .object({
      email: z.string(),
      phone: z.string().nullable(),
      referrer: z.string().nullable(),
      profile: z.unknown(),
      answers: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
      resume: z.object({ name: z.string(), type: z.enum(["pdf", "docx"]), text: z.string().describe("Read from the file; shown first.") }).nullable(),
      resumeDownload: z.boolean().describe("The file may be downloaded: not until Parikshaa verifies the company."),
    })
    .nullable()
    .describe("What the candidate gave: only for those who may decide on the application (hire:decide)."),
});

const bulkOutcome = z.object({
  done: z.array(z.string()).readonly().describe("The applications changed."),
  refused: z
    .array(z.object({ id: z.string(), reason: z.string().describe("not_found, not_active, same_round, last_round or override_needs_reason.") }))
    .readonly(),
});

const ids = z.array(z.string().min(1).max(80)).min(1).max(MAX_BULK);
const moveBody = z
  .object({
    ids,
    to: z.string().min(1).max(80).describe('A round of the job, or "next": each to the round after its own.'),
    overrideReason: z
      .string()
      .max(MAX_TEXT)
      .nullable()
      .optional()
      .describe("Why an application whose integrity is high, and not found genuine, moves on anyway: ten characters or more. Kept privately and audited."),
  })
  .strict();
const rejectBody = z
  .object({
    ids,
    rejectReason: rejectReason.describe("Kept for the company; never told to the candidate."),
    mail: z.boolean().default(true).describe("Send the polite rejection mail, a day later: a Restore before then stops it."),
    filter: z
      .object({ recommendation: recommendation.nullable().optional() })
      .strict()
      .nullable()
      .optional()
      .describe("The filter the list was chosen with. On the AI's recommendation, `reason` is needed."),
    reason: z.string().max(MAX_TEXT).nullable().optional().describe("Why, in ten characters or more, when the list came from the AI's recommendation. Kept as a note on each."),
  })
  .strict();
const textBody = z.object({ text: z.string().max(MAX_TEXT) }).strict();

const jobParams = z.object({ jobId: z.string().min(1).max(80) });
const applicationParams = z.object({ applicationId: z.string().min(1).max(80) });
const pipelineQuery = z.object({
  round: z.string().min(1).max(80).optional().describe("Only those whose current round is this one."),
  status: applicationStatus.optional(),
  search: z.string().trim().max(100).optional().describe("Part of the name, or the ref."),
  recommendation: recommendation.optional(),
  integrity: integrityLevel.optional(),
  pastSla: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export function registerHirePipelineRoutes(
  routes: Routes,
  deps: {
    readonly pipeline: HirePipeline;
    readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  },
): void {
  const { pipeline, staff } = deps;

  /** Runs `fn` for staff who may do `permission`, answering a refusal in the company's terms. */
  async function as<T>(request: FastifyRequest, reply: FastifyReply, permission: Permission, fn: (actor: Actor) => Promise<T>): Promise<T | undefined> {
    const actor = await staff(request, reply, permission);
    if (actor === null) return undefined;
    try {
      return await fn(actor);
    } catch (error) {
      if (!(error instanceof HireRefused)) throw error;
      await reply.code(hireStatus[error.code]).send({ error: error.code, message: error.message, ...(error.problems.length > 0 ? { problems: error.problems } : {}) });
      return undefined;
    }
  }

  routes.get(
    "/hire/jobs/:jobId/applications",
    {
      schema: {
        tags: HIRING,
        summary: "A job's pipeline",
        description: "Each application with its round, every round's result, the AI screening's reading and the integrity level, filtered; and counts over the whole job. A thousand rows at most per page.",
        security: SECURED,
        params: jobParams,
        querystring: pipelineQuery,
        response: { 200: pipelineView, ...hireRefusals },
      },
    },
    async (request, reply) => {
      const q = request.query;
      const view = await as(request, reply, "hire:review", (actor) =>
        pipeline.pipeline(actor, request.params.jobId, {
          roundId: q.round,
          status: q.status,
          search: q.search,
          recommendation: q.recommendation,
          integrity: q.integrity,
          pastSla: q.pastSla === "true",
          limit: q.limit,
          offset: q.offset,
        }),
      );
      if (view !== undefined) return reply.send(view);
    },
  );

  routes.post(
    "/hire/jobs/:jobId/applications/move",
    {
      schema: {
        tags: HIRING,
        summary: "Move applications to another round",
        description:
          "Up to 200 at a time. The round left is marked passed, any jumped over skipped. One whose integrity is high, and not found genuine by a person, moves only with `overrideReason`. A round with `sendOnMove` mails the candidate.",
        security: SECURED,
        params: jobParams,
        body: moveBody,
        response: { 200: bulkOutcome, ...hireRefusals },
      },
    },
    async (request, reply) => {
      const done = await as(request, reply, "hire:decide", (actor) => pipeline.move(actor, request.params.jobId, request.body as MoveInput));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.post(
    "/hire/jobs/:jobId/applications/reject",
    {
      schema: {
        tags: HIRING,
        summary: "Turn applications down",
        description: "Up to 200 at a time. The reason is the company's; the candidate's mail, if sent, gives none and goes a day later.",
        security: SECURED,
        params: jobParams,
        body: rejectBody,
        response: { 200: bulkOutcome, ...hireRefusals },
      },
    },
    async (request, reply) => {
      const done = await as(request, reply, "hire:decide", (actor) => pipeline.reject(actor, request.params.jobId, request.body as RejectInput));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.get(
    "/hire/applications/:applicationId",
    {
      schema: {
        tags: HIRING,
        summary: "One application: what the candidate gave, each round, the timeline",
        description: "Contact details, answers, the profile and the resume only for those who may decide on it; others see the name, round states and scores.",
        security: SECURED,
        params: applicationParams,
        response: { 200: applicationView, ...hireRefusals },
      },
    },
    async (request, reply) => {
      const view = await as(request, reply, "hire:review", (actor) => pipeline.application(actor, request.params.applicationId));
      if (view !== undefined) return reply.send(view as z.infer<typeof applicationView>);
    },
  );

  routes.get(
    "/hire/applications/:applicationId/resume",
    {
      schema: {
        tags: HIRING,
        summary: "The candidate's resume file, as a download",
        description: "For those who may decide on the application, once Parikshaa has verified the company. Each download is recorded.",
        security: SECURED,
        params: applicationParams,
        response: { 200: z.any().describe("application/pdf, or a Word document"), ...hireRefusals },
      },
    },
    async (request, reply) => {
      const found = await as(request, reply, "hire:decide", (actor) => pipeline.resume(actor, request.params.applicationId));
      if (found === undefined) return;
      return reply
        .type(found.contentType)
        .header("content-disposition", `attachment; filename="${found.filename}"`)
        .header("x-content-type-options", "nosniff")
        .header("cache-control", "private, no-store")
        .send(found.file);
    },
  );

  routes.post(
    "/hire/applications/:applicationId/restore",
    {
      schema: {
        tags: HIRING,
        summary: "Bring back a rejected application",
        description: "To the round it was in. Never a withdrawn one, nor one whose person has applied to the job again since. A rejection mail still waiting is not sent.",
        security: SECURED,
        params: applicationParams,
        response: { 200: applicationView, ...hireRefusals },
      },
    },
    async (request, reply) => {
      const view = await as(request, reply, "hire:decide", (actor) => pipeline.restore(actor, request.params.applicationId));
      if (view !== undefined) return reply.send(view as z.infer<typeof applicationView>);
    },
  );

  for (const [path, summary, description, run] of [
    ["notes", "Write a note on an application", "For the team: the candidate never sees it.", (actor: Actor, id: string, text: string) => pipeline.note(actor, id, text)],
    [
      "messages",
      "Send the candidate a message",
      "Shown in their portal and mailed from \"<Company> via Parikshaa\", replies going to the job's contact address. Until Parikshaa verifies the company, the mail only says a message is waiting.",
      (actor: Actor, id: string, text: string) => pipeline.message(actor, id, text),
    ],
  ] as const) {
    routes.post(
      `/hire/applications/:applicationId/${path}`,
      { schema: { tags: HIRING, summary, description, security: SECURED, params: applicationParams, body: textBody, response: { 201: applicationView, ...hireRefusals } } },
      async (request, reply) => {
        const view = await as(request, reply, "hire:decide", (actor) => run(actor, request.params.applicationId, request.body.text));
        if (view !== undefined) return reply.code(201).send(view as z.infer<typeof applicationView>);
      },
    );
  }
}
