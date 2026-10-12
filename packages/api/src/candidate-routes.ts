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
import { CandidateRefused, type Candidates } from "./candidates.js";
import * as S from "./schemas.js";
import type { LoginThrottle } from "./staff-auth.js";

/**
 * A candidate's own account for Hire (docs/HIRE-V2.md §1, §10 S5, S19, F25;
 * H1a): signing in with a mailed code, the profile, the data export, and
 * deleting the account. Applications come with H2.
 */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const APPLICANT = ["Applicant"];
const SIGNED_IN = [{ candidateAuth: [] }];
const OPEN: { candidateAuth: never[] }[] = [];
const refusals = { 401: S.errorResponse, 404: S.errorResponse, 422: S.errorResponse, 429: S.errorResponse, 503: S.errorResponse } as const;

const REFUSED = Symbol("refused");

const STATUS = { invalid: 422, too_many: 429, email_not_configured: 503, mail_failed: 503, sign_in_failed: 401, not_found: 404 } as const;

const email = z.string().max(200);
const code = z.string().max(12).describe("The six digits from the email.");

const account = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  createdAt: z.string(),
});

const session = z.object({
  token: z.string().describe("A candidate session token (`pc_…`)."),
  expiresAt: z.string(),
  kept: z.boolean().describe("True: keep it on this device (14 days from each use). False: keep it only for this tab (12 hours)."),
  account,
});

const text = (max: number) => z.string().trim().max(max);
/** A web address someone may open from a company's screen: http or https, nothing else. */
const link = z
  .string()
  .max(300)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Use a web address that starts with https://");
const details = z
  .object({
    headline: text(120).optional(),
    location: text(80).optional(),
    experienceYears: z.number().min(0).max(60).optional(),
    currentCompany: text(120).optional(),
    currentCtcLpa: z.number().min(0).max(1000).optional(),
    expectedCtcLpa: z.number().min(0).max(1000).optional(),
    noticeDays: z.number().int().min(0).max(365).optional(),
    links: z.object({ linkedin: link.optional(), github: link.optional(), portfolio: link.optional() }).strict().optional(),
    skills: z.array(text(40)).max(30).optional(),
  })
  .strict();

const profile = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
  details: details.nullable(),
  resume: z.object({ name: z.string(), type: z.enum(["pdf", "docx"]), sha256: z.string(), at: z.string() }).nullable(),
});

const view = (a: CandidateAccount) => ({ id: a.id, email: a.email, name: a.name, createdAt: a.createdAt });

export function registerCandidateRoutes(
  routes: Routes,
  deps: { readonly candidates: Candidates; readonly bearer: (request: FastifyRequest) => string | null; readonly throttle: LoginThrottle },
): void {
  const { candidates, bearer, throttle } = deps;

  /** Runs `fn`, answering a refusal in the candidate's terms (and then returning REFUSED). */
  async function answer<T>(reply: FastifyReply, fn: () => Promise<T>): Promise<T | typeof REFUSED> {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof CandidateRefused)) throw error;
      await reply.code(STATUS[error.code]).send({ error: error.code, message: error.message });
      return REFUSED;
    }
  }

  const signedIn = async (request: FastifyRequest, reply: FastifyReply): Promise<CandidateAccount | null> => {
    const found = await candidates.account(bearer(request));
    if (found === null) await reply.code(401).send({ error: "unauthenticated", message: "Sign in again" });
    return found;
  };

  routes.post(
    "/candidate/code",
    {
      schema: {
        tags: APPLICANT,
        summary: "Email me a sign-in code",
        description:
          "Mails a six-digit code that works for 10 minutes, once. The answer is the same whether or not the address has an account; the account is made when the code is entered. 503 `email_not_configured` when this server sends no mail.",
        security: OPEN,
        body: z.object({ email }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      if ((await answer(reply, () => candidates.requestCode(request.body.email, request.ip))) === REFUSED) return;
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/candidate/verify",
    {
      schema: {
        tags: APPLICANT,
        summary: "Sign in with the code",
        description: "Five tries per code. A wrong code, an expired one and an address with no code are refused alike.",
        security: OPEN,
        body: z.object({ email, code, keep: z.boolean().default(false) }),
        response: { 200: session, ...refusals },
      },
    },
    async (request, reply) => {
      const key = `candidate:${request.body.email.trim().toLowerCase()}`;
      if (throttle.blocked(request.ip, key)) return reply.code(429).send({ error: "too_many", message: "Try again in a few minutes" });
      const signed = await answer(reply, () => candidates.verify(request.body.email, request.body.code, request.body.keep));
      if (signed === REFUSED) {
        throttle.failed(request.ip, key);
        return;
      }
      return reply.send({ ...signed, account: view(signed.account) });
    },
  );

  routes.get(
    "/candidate/me",
    { schema: { tags: APPLICANT, summary: "Who is signed in", security: SIGNED_IN, response: { 200: account, ...refusals } } },
    async (request, reply) => {
      const me = await signedIn(request, reply);
      if (me === null) return;
      return reply.send(view(me));
    },
  );

  routes.post(
    "/candidate/signout",
    { schema: { tags: APPLICANT, summary: "Sign out on this device", security: SIGNED_IN, response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      await candidates.signOut(bearer(request));
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/candidate/signout-everywhere",
    {
      schema: {
        tags: APPLICANT,
        summary: "Sign out on every device",
        security: SIGNED_IN,
        response: { 200: z.object({ ended: z.number().int().describe("Sessions ended, this one included.") }), ...refusals },
      },
    },
    async (request, reply) => {
      const me = await signedIn(request, reply);
      if (me === null) return;
      return reply.send({ ended: await candidates.signOutEverywhere(me) });
    },
  );

  routes.get(
    "/candidate/profile",
    { schema: { tags: APPLICANT, summary: "My profile", security: SIGNED_IN, response: { 200: profile, ...refusals } } },
    async (request, reply) => {
      const me = await signedIn(request, reply);
      if (me === null) return;
      const found = await answer(reply, () => candidates.profile(me));
      if (found === REFUSED) return;
      return reply.send(found as z.infer<typeof profile>);
    },
  );

  routes.put(
    "/candidate/profile",
    {
      schema: {
        tags: APPLICANT,
        summary: "Change my profile",
        description: "Kept sealed. A company sees it only as it was when you applied to it.",
        security: SIGNED_IN,
        body: z.object({ name: text(120).nullable(), phone: z.string().max(20).nullable(), details }),
        response: { 200: profile, ...refusals },
      },
    },
    async (request, reply) => {
      const me = await signedIn(request, reply);
      if (me === null) return;
      const saved = await answer(reply, () => candidates.saveProfile(me, request.body));
      if (saved === REFUSED) return;
      return reply.send(saved as z.infer<typeof profile>);
    },
  );

  routes.get(
    "/candidate/export",
    {
      schema: {
        tags: APPLICANT,
        summary: "Everything kept about me",
        description: "The account, the profile, the devices signed in (never their tokens) and which companies' applications are yours.",
        security: SIGNED_IN,
        response: {
          200: z.object({
            account,
            profile,
            sessions: z.array(z.object({ createdAt: z.string(), expiresAt: z.string(), kept: z.boolean() })).readonly(),
            applications: z.array(z.object({ orgId: z.string(), applicationId: z.string(), createdAt: z.string() })).readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const me = await signedIn(request, reply);
      if (me === null) return;
      const data = await answer(reply, () => candidates.exportData(me));
      if (data === REFUSED) return;
      return reply.header("content-disposition", 'attachment; filename="parikshaa-account.json"').send({ ...data, account: view(data.account), profile: data.profile as z.infer<typeof profile> });
    },
  );

  routes.post(
    "/candidate/step-up",
    {
      schema: {
        tags: APPLICANT,
        summary: "Email me a code to confirm a step",
        description: "Deleting the account needs a fresh code from your email, as well as being signed in.",
        security: SIGNED_IN,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const me = await signedIn(request, reply);
      if (me === null) return;
      if ((await answer(reply, () => candidates.requestStepUp(me, request.ip))) === REFUSED) return;
      return reply.send({ ok: true });
    },
  );

  routes.delete(
    "/candidate/me",
    {
      schema: {
        tags: APPLICANT,
        summary: "Delete my account",
        description: "Needs the code from POST /candidate/step-up. The profile, the resume and every session go now.",
        security: SIGNED_IN,
        body: z.object({ code }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const me = await signedIn(request, reply);
      if (me === null) return;
      if ((await answer(reply, () => candidates.deleteAccount(me, request.body.code))) === REFUSED) return;
      return reply.send({ ok: true });
    },
  );
}
