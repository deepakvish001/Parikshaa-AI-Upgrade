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
import type { Job } from "@parikshaa/store";
import { HireRefused, type HireService, type JobInput } from "./hire.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/**
 * A company's jobs for Hire, for its staff (docs/HIRE-V2.md §3, §10 F7; H2a):
 * writing a job and its rounds, publishing, pausing, closing and copying it.
 * Under `/hire/`, never `/jobs`, which is the job page's own address (F7).
 */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const HIRING = ["Hiring"];
const SECURED = [{ staffAuth: [] }];
/** A refusal, with what is wrong in words when a job cannot be saved as it is. */
export const hireRefusal = z.object({
  error: z.string(),
  message: z.string().optional(),
  problems: z.array(z.string()).readonly().optional().describe("Each thing to change, in words."),
});
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: hireRefusal, 422: hireRefusal } as const;
const STATUS = { not_found: 404, invalid: 422, limit: 409, conflict: 409, unavailable: 503 } as const;
/** For the other staff routes of Hire (H2c on): the same refusals, answered with the same codes. */
export { refusals as hireRefusals, STATUS as hireStatus };

const text = (max: number) => z.string().trim().max(max);
const skill = text(40).min(1);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date as YYYY-MM-DD");

export const screeningQuestion = z
  .object({
    id: z.string().min(1).max(40),
    text: text(300).min(1),
    kind: z.enum(["yes_no", "number", "choice", "text"]),
    options: z.array(text(100).min(1)).max(20).optional(),
    required: z.boolean(),
    knockout: z
      .object({
        equals: z.enum(["yes", "no"]).optional(),
        min: z.number().finite().optional(),
        max: z.number().finite().optional(),
        oneOf: z.array(text(100)).max(20).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const roundKind = z.enum(["screen", "assessment", "ai_interview", "interview", "review", "offer"]);
const round = z.object({
  id: z.string().min(1).max(80).optional().describe("Keep this round (and what applicants did in it): send its id back."),
  kind: roundKind,
  title: text(120).min(1),
  config: z.record(z.string(), z.unknown()).default({}).describe("Per kind (docs/HIRE-V2.md §1). Any round may say `sendOnMove: true` to mail the candidate when they reach it."),
});

const jobInput = z
  .object({
    title: text(200).min(1),
    roleId: z.string().max(80).nullable().default(null),
    department: text(120).default(""),
    location: text(200).default(""),
    workMode: z.enum(["onsite", "hybrid", "remote"]).default("onsite"),
    employment: z.enum(["full_time", "internship", "contract"]).default("full_time"),
    expMin: z.number().int().min(0).max(60).default(0),
    expMax: z.number().int().min(0).max(60).nullable().default(null),
    ctcMinLpa: z.number().min(0).max(10000).nullable().default(null),
    ctcMaxLpa: z.number().min(0).max(10000).nullable().default(null),
    showCtc: z.boolean().default(false),
    openings: z.number().int().min(1).max(10000).default(1),
    skillsMust: z.array(skill).max(30).default([]),
    skillsNice: z.array(skill).max(30).default([]),
    description: z.string().max(20000).default(""),
    questions: z.array(screeningQuestion).max(10).default([]),
    noteToCandidates: text(2000).default(""),
    rejectionLine: text(500).default("").describe("A line added to this job's rejection mails: polite, never a reason. Not sent until Parikshaa verifies the company."),
    contactEmail: z.string().email().max(200).nullable().default(null),
    applyBy: day.nullable().default(null),
    autoScreen: z.boolean().default(false),
    screenThreshold: z.number().int().min(0).max(100).default(60),
    screenDailyMax: z.number().int().min(1).max(5000).default(200),
    maxApplicants: z.number().int().min(1).nullable().default(null),
    reapplyAfterDays: z.number().int().min(0).max(3650).default(90),
    reviewSlaDays: z.number().int().min(1).max(60).default(2),
    managers: z.array(z.string().min(1).max(80)).max(20).default([]),
    rounds: z.array(round).min(1).max(10).optional().describe("In order. Left out: the usual six (screen, test, AI interview, interview, review, offer)."),
  })
  .strict();

const roundView = z.object({ id: z.string(), position: z.number().int(), kind: roundKind, title: z.string(), config: z.record(z.string(), z.unknown()) });
const jobView = jobInput.omit({ rounds: true }).strip().extend({
  id: z.string(),
  status: z.enum(["draft", "held", "open", "paused", "closed"]),
  heldReason: z.string().nullable(),
  publicCode: z.string().nullable().describe("The job page's address within the company's; given when first published."),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  rounds: z.array(roundView).readonly(),
});
const jobSummary = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["draft", "held", "open", "paused", "closed"]),
  publicCode: z.string().nullable(),
  location: z.string(),
  openings: z.number().int(),
  createdAt: z.string(),
  publishedAt: z.string().nullable(),
  applicants: z.number().int(),
  active: z.number().int(),
  hired: z.number().int(),
  newToday: z.number().int().describe("Applied in the last 24 hours."),
  byRound: z.record(z.string(), z.number().int()).describe("Active applicants in each round, by round id."),
});
const params = z.object({ jobId: z.string().min(1).max(80) });

export function registerHireRoutes(
  routes: Routes,
  deps: {
    readonly hire: HireService;
    readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  },
): void {
  const { hire, staff } = deps;

  /** Runs `fn` for staff who may do `permission`, answering a refusal in the company's terms. */
  async function as<T>(request: FastifyRequest, reply: FastifyReply, permission: Permission, fn: (actor: Actor) => Promise<T>): Promise<T | undefined> {
    const actor = await staff(request, reply, permission);
    if (actor === null) return undefined;
    try {
      return await fn(actor);
    } catch (error) {
      if (!(error instanceof HireRefused)) throw error;
      await reply.code(STATUS[error.code]).send({ error: error.code, message: error.message, ...(error.problems.length > 0 ? { problems: error.problems } : {}) });
      return undefined;
    }
  }

  const send = (reply: FastifyReply, job: Job | undefined, code = 200) => (job === undefined ? undefined : reply.code(code).send(job as z.infer<typeof jobView>));

  routes.get(
    "/hire/jobs",
    { schema: { tags: HIRING, summary: "The company's jobs, newest first", description: "A hiring manager sees only the jobs they manage.", security: SECURED, response: { 200: z.object({ jobs: z.array(jobSummary).readonly() }), ...refusals } } },
    async (request, reply) => {
      const jobs = await as(request, reply, "hire:review", (actor) => hire.jobs(actor));
      if (jobs !== undefined) return reply.send({ jobs });
    },
  );

  routes.post(
    "/hire/jobs",
    {
      schema: {
        tags: HIRING,
        summary: "Write a new job, as a draft",
        description:
          "Screening questions may end an application (a knockout), never on age, gender, marriage, family, religion, caste or disability. Until Parikshaa verifies the company, AI screening is off and at most 100 people may apply.",
        security: SECURED,
        body: jobInput,
        response: { 201: jobView, ...refusals },
      },
    },
    async (request, reply) => send(reply, await as(request, reply, "hire:manage", (actor) => hire.create(actor, request.body as JobInput)), 201),
  );

  routes.get(
    "/hire/jobs/:jobId",
    { schema: { tags: HIRING, summary: "One job, with its rounds", security: SECURED, params, response: { 200: jobView, ...refusals } } },
    async (request, reply) => send(reply, await as(request, reply, "hire:review", (actor) => hire.job(actor, request.params.jobId))),
  );

  routes.put(
    "/hire/jobs/:jobId",
    {
      schema: {
        tags: HIRING,
        summary: "Change a job and its rounds",
        description: "A round applicants have reached cannot be removed. Rounds left out of the body stay as they are.",
        security: SECURED,
        params,
        body: jobInput,
        response: { 200: jobView, ...refusals },
      },
    },
    async (request, reply) => send(reply, await as(request, reply, "hire:manage", (actor) => hire.update(actor, request.params.jobId, request.body as JobInput))),
  );

  for (const [action, summary, description] of [
    ["publish", "Open the job to applicants", "Gives the job its address the first time. Until Parikshaa verifies the company, two jobs may be open at once, and a job whose wording asks applicants for money is held for Parikshaa to read (status `held`)."],
    ["pause", "Stop taking applications for now", "The job page says applications are paused; applicants already in go on."],
    ["close", "Close the job", "No more applications; the pipeline stays to finish."],
    ["duplicate", "Copy the job as a new draft", "Everything it says, its questions and its rounds; not its applicants."],
  ] as const) {
    routes.post(
      `/hire/jobs/:jobId/${action}`,
      { schema: { tags: HIRING, summary, description, security: SECURED, params, response: { 200: jobView, 201: jobView, ...refusals } } },
      async (request, reply) =>
        send(
          reply,
          await as(request, reply, "hire:manage", (actor) => hire[action](actor, request.params.jobId)),
          action === "duplicate" ? 201 : 200,
        ),
    );
  }

  routes.delete(
    "/hire/jobs/:jobId",
    { schema: { tags: HIRING, summary: "Delete a draft nobody applied to", security: SECURED, params, response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      const done = await as(request, reply, "hire:manage", async (actor) => {
        await hire.remove(actor, request.params.jobId);
        return true;
      });
      if (done === true) return reply.send({ ok: true });
    },
  );
}
