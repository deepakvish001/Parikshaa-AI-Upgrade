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
import { SignupRefused, type Onboarding } from "./onboarding.js";
import { RateLimiter, type RateLimit } from "./rate-limit.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const ACCOUNT = ["Account"];
const INSTITUTION = ["Institution"];
const SECURED = [{ staffAuth: [] }];

const refusals = {
  401: S.errorResponse,
  403: S.errorResponse,
  404: S.errorResponse,
  409: S.errorResponse,
  422: S.errorResponse,
  429: S.errorResponse,
} as const;

/** A few sign-ups an hour from one address: a college's lab shares one, and nobody needs more. */
export const SIGNUPS: RateLimit = { perSecond: 1 / 600, burst: 5 };

/** An institution signing itself up, and the sample exam it can look around with. */
export function registerOnboardingRoutes(
  routes: Routes,
  deps: {
    readonly onboarding: Onboarding;
    readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
    readonly now?: () => number;
    /** Sign-ups from one address; `SIGNUPS` unless given. */
    readonly limit?: RateLimit;
  },
): void {
  const { onboarding, staff } = deps;
  const signups = new RateLimiter(deps.limit ?? SIGNUPS, deps.now);

  routes.get(
    "/auth/signup",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Whether institutions may sign themselves up here",
        description: "When they may, how many attempt credits a new organisation starts with.",
        response: { 200: S.signupStatus },
      },
    },
    async (_request, reply) => {
      const policy = onboarding.signup;
      return reply.send(policy === null ? { open: false, trialCredits: 0 } : { open: true, trialCredits: policy.trialCredits });
    },
  );

  routes.post(
    "/auth/signup",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Make an institution's account",
        description:
          "Creates the organisation and its first owner, and signs them in: the response is the same as signing in. The organisation starts prepaid, with the server's trial credits. 404 when this server does not take sign-ups; 409 `email_taken` when an account already uses the address.",
        body: S.signupBody,
        response: { 201: S.loginResponse, ...refusals },
      },
    },
    async (request, reply) => {
      if (onboarding.signup === null) return reply.code(404).send({ error: "not_found", message: "Institutions cannot sign themselves up here" });
      const allowed = signups.take(request.ip);
      if (!allowed.ok) {
        return reply
          .code(429)
          .header("retry-after", String(allowed.retryAfterSeconds))
          .send({ error: "too_many_attempts", message: "Too many sign-ups from this network. Try again later." });
      }
      try {
        return reply.code(201).send(await onboarding.signUp(request.body));
      } catch (error) {
        if (error instanceof SignupRefused) return reply.code(error.code === "email_taken" ? 409 : 422).send({ error: error.code, message: error.message });
        throw error;
      }
    },
  );

  routes.post(
    "/onboarding/sample",
    {
      schema: {
        tags: INSTITUTION,
        summary: "Load the sample exam",
        description:
          "A short campus aptitude round — every kind of question — in the bank (tagged `sample`) and among the exams, to preview, schedule and sit. It does not count towards the home page's first steps. Loading it again brings it back if it was put away.",
        security: SECURED,
        response: { 200: S.sampleResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await onboarding.loadSample(actor));
    },
  );

  routes.delete(
    "/onboarding/sample",
    {
      schema: {
        tags: INSTITUTION,
        summary: "Put the sample exam away",
        description: "Archives the sample exam and its questions in the bank. Anything sat on it stays, as with any archived exam.",
        security: SECURED,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      await onboarding.removeSample(actor);
      return reply.send({ ok: true });
    },
  );
}
