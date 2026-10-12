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
import type { CandidateAccount } from "@parikshaa/store";
import type { Candidates } from "./candidates.js";
import { HireRefused } from "./hire.js";
import type { ApplyInput, HireApplications } from "./hire-apply.js";
import { hireRefusal, roundKind, screeningQuestion } from "./hire-routes.js";
import * as S from "./schemas.js";

/**
 * Applying, for candidates (docs/HIRE-V2.md §2, §10 F7, F25; H2b): the public
 * job and careers pages' data under `/hire/public/` (never under `/jobs` or
 * `/careers`, which are the pages' own addresses), and a candidate's
 * applications under `/candidate/applications`.
 */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const JOBS = ["Jobs"];
const APPLICANT = ["Applicant"];
const OPEN: { candidateAuth: never[] }[] = [];
const SIGNED_IN = [{ candidateAuth: [] }];
const refusals = { 401: S.errorResponse, 404: S.errorResponse, 409: hireRefusal, 422: hireRefusal, 429: hireRefusal, 503: S.errorResponse } as const;
const STATUS = { not_found: 404, invalid: 422, limit: 429, conflict: 409, unavailable: 503 } as const;

const workMode = z.enum(["onsite", "hybrid", "remote"]);
const employment = z.enum(["full_time", "internship", "contract"]);
const companyView = z.object({ name: z.string(), publicId: z.string(), verified: z.boolean().describe("Parikshaa has checked this employer.") });
const contact = z.object({ name: z.string(), email: z.string() });

const notice = z.object({
  version: z.string(),
  en: z.array(z.string()).readonly(),
  hi: z.array(z.string()).readonly(),
  hash: z.string().describe("Send it back when applying: it records which notice was agreed to."),
  keepDays: z.number().int(),
  contacts: z.object({ company: contact.nullable(), parikshaa: contact }),
});

const publicJob = z.object({
  company: companyView,
  code: z.string(),
  title: z.string(),
  department: z.string(),
  location: z.string(),
  workMode,
  employment,
  expMin: z.number().int(),
  expMax: z.number().int().nullable(),
  ctc: z.object({ minLpa: z.number().nullable(), maxLpa: z.number().nullable() }).nullable().describe("Null when the company does not show it."),
  openings: z.number().int(),
  applyBy: z.string().nullable().describe("The last day to apply (YYYY-MM-DD), until 23:59 India time."),
  skillsMust: z.array(z.string()).readonly(),
  skillsNice: z.array(z.string()).readonly(),
  description: z.string(),
  noteToCandidates: z.string(),
  questions: z.array(screeningQuestion).readonly().describe("Asked on applying. A question with `knockout` ends the application when the answer misses it."),
  steps: z.array(z.object({ kind: roundKind, title: z.string() })).readonly(),
  accepting: z.boolean(),
  notAccepting: z.enum(["paused", "closed", "past_apply_by", "full"]).nullable(),
  noindex: z.boolean().describe("Ask search engines not to list the page: the employer is not verified yet."),
  notice,
});

const careers = z.object({
  company: companyView,
  noindex: z.boolean(),
  jobs: z
    .array(
      z.object({
        code: z.string(),
        title: z.string(),
        location: z.string(),
        workMode,
        employment,
        expMin: z.number().int(),
        expMax: z.number().int().nullable(),
        publishedAt: z.string().nullable(),
      }),
    )
    .readonly(),
});

const company = z.string().min(3).max(40).describe("The company's Parikshaa ID, such as PKC-7K2M9Q.");
const code = z.string().min(4).max(12).describe("The job's code within the company.");

const applyBody = z
  .object({
    company,
    code,
    answers: z.record(z.string().max(40), z.union([z.string().max(1000), z.number().finite()])).default({}),
    noticeHash: z.string().max(100),
    adult: z.boolean().describe("I am 18 or older."),
    aiOptOut: z.boolean().default(false).describe("Have a person read my application without AI."),
    deviceReady: z.boolean().nullable().default(null).describe("A laptop with a webcam is available for the test. Never a reason to turn anyone down."),
    source: z.enum(["link", "careers", "referral"]).default("link"),
    sourceTag: z
      .string()
      .trim()
      .max(40)
      .regex(/^[A-Za-z0-9_-]*$/, "Letters, digits, - and _")
      .nullable()
      .default(null)
      .describe("Where the link was shared (`?src=`): linkedin, naukri, whatsapp…"),
    referrer: z.string().trim().max(200).nullable().default(null).describe("Who referred them, for a referral."),
  })
  .strict();

const stepState = z.enum(["waiting", "your_turn", "done", "not_moving_forward"]);
const myApplication = z.object({
  id: z.string(),
  company: z.object({ name: z.string(), publicId: z.string(), paused: z.boolean().describe("Parikshaa has paused this company's account: nothing moves until it is resumed.") }),
  job: z.object({ title: z.string(), code: z.string().nullable(), location: z.string(), closed: z.boolean() }),
  appliedAt: z.string(),
  status: z.enum(["in_progress", "not_moving_forward", "withdrawn", "hired", "joined", "did_not_join"]),
  decidedAt: z.string().nullable(),
  steps: z.array(z.object({ kind: roundKind, title: z.string(), state: stepState, current: z.boolean() })).readonly(),
  timeline: z.array(z.object({ at: z.string(), kind: z.string() })).readonly(),
  canWithdraw: z.boolean(),
});
const applicationParams = z.object({ applicationId: z.string().min(1).max(80) });

const REFUSED = Symbol("refused");

export function registerHireApplyRoutes(
  routes: Routes,
  deps: { readonly applications: HireApplications; readonly candidates: Candidates; readonly bearer: (request: FastifyRequest) => string | null },
): void {
  const { applications, candidates, bearer } = deps;

  /** Runs `fn`, answering a refusal in Hire's terms (and then returning REFUSED). */
  async function answer<T>(reply: FastifyReply, fn: () => Promise<T>): Promise<T | typeof REFUSED> {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof HireRefused)) throw error;
      await reply.code(STATUS[error.code]).send({ error: error.code, message: error.message, ...(error.problems.length > 0 ? { problems: error.problems } : {}) });
      return REFUSED;
    }
  }

  const signedIn = async (request: FastifyRequest, reply: FastifyReply): Promise<CandidateAccount | null> => {
    const found = await candidates.account(bearer(request));
    if (found === null) await reply.code(401).send({ error: "unauthenticated", message: "Sign in again" });
    return found;
  };

  routes.get(
    "/hire/public/jobs/:company/:code",
    {
      schema: {
        tags: JOBS,
        summary: "A job's page",
        description: "Anyone may read a published job. A draft, a held job, or any job of a suspended company is not found.",
        security: OPEN,
        params: z.object({ company, code }),
        response: { 200: publicJob, ...refusals },
      },
    },
    async (request, reply) => {
      const job = await answer(reply, () => applications.publicJob(request.params.company, request.params.code));
      // The store's readonly arrays are the schema's arrays; the cast says only that.
      if (job !== REFUSED) return reply.send(job as z.infer<typeof publicJob>);
    },
  );

  routes.get(
    "/hire/public/careers/:company",
    {
      schema: { tags: JOBS, summary: "A company's open jobs", security: OPEN, params: z.object({ company }), response: { 200: careers, ...refusals } },
    },
    async (request, reply) => {
      const page = await answer(reply, () => applications.careers(request.params.company));
      if (page !== REFUSED) return reply.send(page);
    },
  );

  routes.get(
    "/candidate/applications",
    {
      schema: {
        tags: APPLICANT,
        summary: "My applications, at every company",
        description: "Where each stands, step by step. Never a score, a note or anything about other applicants.",
        security: SIGNED_IN,
        response: { 200: z.object({ applications: z.array(myApplication).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const account = await signedIn(request, reply);
      if (account === null) return;
      return reply.send({ applications: await applications.mine(account) });
    },
  );

  routes.post(
    "/candidate/applications",
    {
      schema: {
        tags: APPLICANT,
        summary: "Apply to a job",
        description:
          "Sends the profile and resume on file as they are now, with the answers. 409 with `problems`: `notice_changed` (read the notice again), `already_applied`, `reapply_later`, `full`, `closed`, `past_apply_by`, `paused`. 422: an answer, the name or the resume is missing. 429: twenty applications today already.",
        security: SIGNED_IN,
        body: applyBody,
        response: { 201: z.object({ id: z.string(), status: z.enum(["active", "rejected"]).describe("rejected: an answer missed a knockout question.") }), ...refusals },
      },
    },
    async (request, reply) => {
      const account = await signedIn(request, reply);
      if (account === null) return;
      const made = await answer(reply, () => applications.apply(account, request.body as ApplyInput));
      if (made !== REFUSED) return reply.code(201).send(made);
    },
  );

  routes.get(
    "/candidate/applications/:applicationId",
    { schema: { tags: APPLICANT, summary: "One of my applications", security: SIGNED_IN, params: applicationParams, response: { 200: myApplication, ...refusals } } },
    async (request, reply) => {
      const account = await signedIn(request, reply);
      if (account === null) return;
      const one = await answer(reply, () => applications.one(account, request.params.applicationId));
      if (one !== REFUSED) return reply.send(one);
    },
  );

  routes.post(
    "/candidate/applications/:applicationId/withdraw",
    {
      schema: {
        tags: APPLICANT,
        summary: "Withdraw an application",
        description: "The company takes it no further, and it is erased within 30 days. Cannot be undone; applying again later is a new application.",
        security: SIGNED_IN,
        params: applicationParams,
        response: { 200: myApplication, ...refusals },
      },
    },
    async (request, reply) => {
      const account = await signedIn(request, reply);
      if (account === null) return;
      const done = await answer(reply, () => applications.withdraw(account, request.params.applicationId));
      if (done !== REFUSED) return reply.send(done);
    },
  );
}
