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
import { InvalidEmailLink, SignupRefused, type Onboarding } from "./onboarding.js";
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

  // Resending is a person clicking a button: one a minute is plenty.
  const resends = new RateLimiter({ perSecond: 1 / 60, burst: 2 }, deps.now);

  routes.post(
    "/auth/verify-email",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Confirm an owner's email address, from the link sent to it",
        description:
          "An owner who signed their institution up can build exams at once, but invites candidates, adds staff and issues API keys only once this has been done. The link names the account and the address it was sent to; it stops working if the address changes.",
        body: S.verifyEmailBody,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      try {
        await onboarding.confirmEmail(request.body.token);
        return reply.send({ ok: true });
      } catch (error) {
        if (error instanceof InvalidEmailLink) return reply.code(422).send({ error: "invalid_link", message: error.message });
        throw error;
      }
    },
  );

  routes.post(
    "/auth/verify-email/resend",
    {
      schema: {
        tags: ACCOUNT,
        summary: "Send the link that confirms this account's address again",
        security: SECURED,
        response: { 200: S.resendResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, null);
      if (actor === null) return;
      if (!resends.take(actor.id).ok) return reply.code(429).send({ error: "too_many_attempts", message: "The link was sent a moment ago. Check your inbox and spam folder." });
      return reply.send({ sent: await onboarding.resendVerification(actor) });
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

  routes.post(
    "/onboarding/starter",
    {
      schema: {
        tags: INSTITUTION,
        summary: "Take the starter questions into the bank",
        description:
          "CS fundamentals multiple-choice questions and DSA coding problems that run, tagged `starter` and filed under the words the role library looks for, so a test from a role has questions to draw. Once only: again, it adds nothing. They are public practice questions; a serious round should mix in the organisation's own.",
        security: SECURED,
        response: { 200: S.starterResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await onboarding.loadStarter(actor));
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
