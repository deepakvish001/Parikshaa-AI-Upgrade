import { randomUUID } from "node:crypto";
import { z } from "zod";
import fastifyCompress from "@fastify/compress";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import Fastify, { LogController, type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { attemptId, candidateId, examId, questionId, vivaId, type Exam } from "@parikshaa/core";
import { RunnerUnavailable } from "@parikshaa/runner";
import { ExamFrozen, type IdentityStore, type QuestionBank, type QuestionMedia } from "@parikshaa/store";
import { registerAccountRoutes } from "./account-routes.js";
import { registerBankRoutes } from "./bank-routes.js";
import { PracticeError, type PracticeService } from "./practice.js";
import { registerPracticeRoutes } from "./practice-routes.js";
import type { PracticeIdentity } from "./practice-identity.js";
import { registerPracticeIdentityRoutes } from "./practice-identity-routes.js";
import type { InvitationService } from "./invitation-service.js";
import { registerInvitationRoutes } from "./invitation-routes.js";
import type { ResultsService } from "./results.js";
import { registerResultsRoutes } from "./results-routes.js";
import type { GreenhouseService } from "./greenhouse.js";
import { registerIntegrationRoutes } from "./integration-routes.js";
import { registerAtsRoutes } from "./ats-routes.js";
import type { LtiService } from "./lti.js";
import { registerLtiRoutes } from "./lti-routes.js";
import { UnsafeUrl } from "./safe-http.js";
import type { WebhookService } from "./webhooks.js";
import type { InvigilationService } from "./invigilation.js";
import { registerInvigilationRoutes } from "./invigilation-routes.js";
import type { PrivacyService } from "./privacy.js";
import { BillingNotConfigured, OutOfCredits, type BillingService } from "./billing.js";
import { registerBillingRoutes } from "./billing-routes.js";
import type { ProctorService } from "./proctoring.js";
import { registerProctoringRoutes } from "./proctoring-routes.js";
import { GatewayUnavailable } from "./razorpay.js";
import { registerPrivacyRoutes } from "./privacy-routes.js";
import { registerSecurityRoutes, securityStatus } from "./security-routes.js";
import { AtsError, type AtsService } from "./ats.js";
import { SecurityError, type StaffSecurity } from "./staff-security.js";
import { AttemptTokens, type AttemptClaims } from "./auth.js";
import { DEFAULT_LIMITS, RateLimiter, type RateLimit } from "./rate-limit.js";
import * as S from "./schemas.js";
import { AttemptError, ExamInvalidError, ExamService, Forbidden, SpendCapReached } from "./service.js";
import { LoginThrottle, WeakPassword, can, type Actor, type Permission, type StaffAuth } from "./staff-auth.js";

export interface ServerOptions {
  readonly service: ExamService;
  readonly tokens: AttemptTokens;
  /** Resolves staff sessions and API keys into actors. */
  readonly auth: StaffAuth;
  /** Staff accounts and API keys, for the account-management routes. */
  readonly identity: IdentityStore;
  readonly bank: QuestionBank;
  /** Pictures in questions and passages. */
  readonly media: QuestionMedia;
  /** Practice sites (ROADMAP §15). Absent: no practice routes. */
  readonly practice?: PracticeService;
  /** Practice learners' email verification and Google sign-in. */
  readonly practiceIdentity?: PracticeIdentity;
  readonly invitations: InvitationService;
  readonly results: ResultsService;
  readonly webhooks: WebhookService;
  readonly greenhouse: GreenhouseService;
  /** Lever, Zoho Recruit and Darwinbox. Absent: no routes for them. */
  readonly ats?: AtsService;
  /** Moodle and other LMSs, through LTI 1.3. */
  readonly lti?: LtiService;
  readonly invigilation: InvigilationService;
  readonly privacy: PrivacyService;
  readonly billing: BillingService;
  readonly proctor: ProctorService;
  /** Password reset, a second factor and single sign-on (ROADMAP §1). Absent: none of their routes. */
  readonly security?: StaffSecurity;
  readonly loginThrottle?: LoginThrottle;
  /**
   * Send Strict-Transport-Security: browsers then refuse plain HTTP to this
   * host. On when the deployment is served over HTTPS (`PUBLIC_URL`).
   */
  readonly hsts?: boolean;
  /** Take the client address from X-Forwarded-For. Set only behind a proxy you control. */
  readonly trustProxy?: boolean;
  /** Lifetime of an issued attempt token. Defaults to three hours. */
  readonly attemptTtlSeconds?: number;
  /**
   * Directories holding the built client bundles.
   *
   * Serving them from the API keeps the deployment to one process: there is no
   * second origin, so no CORS configuration and no cookie or token sharing
   * across origins to get wrong.
   */
  readonly clients?: { readonly web: string; readonly console: string };
  /**
   * Structured request logs. Off unless given. Each line names the route
   * pattern, status, duration and organisation — never a body, a query string,
   * a header or an error message, since any of those can carry an answer, a
   * token or someone's email address (see `observability.test.ts`).
   */
  readonly log?: { readonly level?: string; readonly stream?: { write(line: string): void } };
  /** Per-organisation and per-attempt request rates; `false` turns limiting off. */
  readonly rateLimits?: { readonly organisation: RateLimit; readonly attempt: RateLimit } | false;
}

declare module "fastify" {
  interface FastifyRequest {
    /** The organisation a request acted for, once authenticated: for the log line. */
    orgId?: string;
  }
}

const INSTITUTION = ["Institution"];
const CANDIDATE = ["Candidate"];

/** Every route answers with this shape when it refuses. */
export const errors = {
  400: S.errorResponse,
  401: S.errorResponse,
  402: S.errorResponse,
  403: S.errorResponse,
  429: S.errorResponse,
  503: S.errorResponse,
  404: S.errorResponse,
  409: S.errorResponse,
  410: S.errorResponse,
} as const;

/**
 * Attempt-scoped routes address the attempt as `me`.
 *
 * The attempt is taken from the bearer token, never from the path, so there is
 * no attempt id for a candidate to change. A whole class of access bug simply
 * has nowhere to live.
 *
 * Routes carry Zod schemas for both request and response. The response half is
 * not decoration: serialization drops keys the schema does not name, so the
 * candidate-facing shapes are a second enforcement of the answer-key boundary
 * that `candidateView` closes in the type system.
 */
export function buildServer(options: ServerOptions): FastifyInstance {
  const app = Fastify({
    logger:
      options.log === undefined
        ? false
        : {
            level: options.log.level ?? "info",
            ...(options.log.stream === undefined ? {} : { stream: options.log.stream }),
            // Belt and braces: nothing below logs these, and if a future line does, they are masked.
            redact: {
              paths: ["req.headers", "req.body", "req.query", "*.authorization", "*.password", "*.token", "*.answer", "*.reply", "*.email"],
              censor: "[redacted]",
            },
          },
    // One line per request, written below, instead of Fastify's own pair, which include the URL.
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => randomUUID(),
    // Both clients call the API under `/api`, which the Vite dev servers strip
    // before proxying. Served from this process there is no proxy, so the
    // prefix is stripped here instead; without it every client request in a
    // single-process deployment would miss its route.
    rewriteUrl: (request) => {
      const url = request.url ?? "/";
      if (url.startsWith("/api/")) return url.slice(4);
      if (url === "/api" || url.startsWith("/api?")) return `/${url.slice(4)}`;
      return url;
    },
    // Behind a load balancer every request arrives from the balancer's address.
    // The login throttle keys on the client address, so without this it would
    // key every client together — and anyone could lock any account out.
    trustProxy: options.trustProxy ?? false,
  }).withTypeProvider<ZodTypeProvider>();
  const { service, tokens, auth } = options;
  const ttl = options.attemptTtlSeconds ?? 3 * 60 * 60;

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Compressed when the client accepts it (ROADMAP §9): on a 2G connection
  // the exam, the state polls and the client bundles are most of the wait.
  // Small replies are left alone; the probe stream writes to the raw socket
  // and is never buffered by this.
  void app.register(fastifyCompress, { global: true, threshold: 1024, encodings: ["br", "gzip"] });

  void app.register(fastifySwagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Parikshaa",
        version: "0.0.0",
        description:
          "Assessment with a tamper-evident ledger and a micro-viva engine. Institution routes take a staff session token (from `POST /auth/login`) or an API key, and act within that account's organisation; candidate routes use a short-lived token scoped to one attempt, which is why they address it as `me`.",
      },
      tags: [
        { name: "Institution", description: "Authoring exams, issuing access codes, grading and review." },
        { name: "Candidate", description: "Sitting one attempt. Scoped entirely by the bearer token." },
        { name: "Account", description: "Signing in, staff accounts, API keys, spend and the audit log." },
        { name: "Question bank", description: "Reusable questions, filed by topic and difficulty, and imported from CSV." },
        { name: "Invitations", description: "Scheduling a sitting, inviting a cohort, and delivering each candidate's link." },
        { name: "Results", description: "Results, exports, cohort analytics and per-candidate reports." },
        { name: "Integrations", description: "Signed webhooks, and setting up the Greenhouse connector." },
        { name: "Invigilation", description: "The sitting live: progress, who has gone quiet, announcements, and reopening an attempt." },
        { name: "Privacy", description: "The DPDP Act: the notice candidates agree to, retention, and erasure." },
        { name: "Billing", description: "Prepaid attempt credits, Razorpay payments and GST tax invoices." },
        { name: "Practice", description: "An institution's practice site, as its learners use it: problems, Run and Submit, progress, contests and discussion. No answer key reaches it." },
        { name: "Practice (staff)", description: "Running a practice site: publishing problems from the bank, editorials, contests, learners and moderation." },
        { name: "LTI", description: "Moodle and other LMSs through LTI 1.3: registering the LMS, the launch, and grades back to its grade book." },
        { name: "Proctoring", description: "Camera proctoring an exam's author turns on: identity photos, webcam photos, browser events. Observations, never verdicts." },
        {
          name: "Greenhouse",
          description: "Greenhouse's Assessment Partner API, called by Greenhouse with the organisation's key as the Basic-auth username.",
        },
      ],
      components: {
        securitySchemes: {
          staffAuth: {
            type: "http",
            scheme: "bearer",
            description: "A staff session token (`pks_…`) or an API key (`pkk_…`).",
          },
          attemptToken: { type: "http", scheme: "bearer", description: "A candidate's attempt-scoped token." },
          learnerAuth: { type: "http", scheme: "bearer", description: "A practice learner's session token (`pl_…`), for one site." },
          greenhouseKey: {
            type: "http",
            scheme: "basic",
            description: "The organisation's Greenhouse key (`ghk.…`) as the username, with no password.",
          },
          razorpaySignature: {
            type: "apiKey",
            in: "header",
            name: "X-Razorpay-Signature",
            description: "HMAC-SHA256 of the raw body with the webhook secret, as Razorpay sends it.",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  const limits = options.rateLimits ?? DEFAULT_LIMITS;
  const limiters =
    limits === false ? null : { organisation: new RateLimiter(limits.organisation), attempt: new RateLimiter(limits.attempt) };

  /** Refuse with 429 when `key` has spent its bucket. */
  const limited = async (reply: FastifyReply, kind: "organisation" | "attempt", key: string): Promise<boolean> => {
    const verdict = limiters?.[kind].take(key) ?? { ok: true as const };
    if (verdict.ok) return false;
    await reply
      .code(429)
      .header("retry-after", String(verdict.retryAfterSeconds))
      .send({ error: "rate_limited", message: `Too many requests; try again in ${verdict.retryAfterSeconds}s` });
    return true;
  };

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    // ROADMAP §11. Every response: nothing sniffed into a script, never
    // framed (a framed exam page is a clickjacking target), and no Referer —
    // an invitation code or a reset link in the address must not follow a
    // click to another site.
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    reply.header("cross-origin-opener-policy", "same-origin");
    reply.header("permissions-policy", "camera=(self), microphone=(), geolocation=(), payment=(self)");
    if (options.hsts === true) reply.header("strict-transport-security", "max-age=31536000; includeSubDomains");
  });
  // The pages themselves: scripts only from this origin, so an injected
  // <script> or inline handler does not run. The console alone may load
  // Razorpay's Checkout, which the Billing page opens to buy credits.
  app.addHook("onSend", async (request, reply, payload) => {
    const type = reply.getHeader("content-type");
    if (typeof type !== "string" || !type.startsWith("text/html")) return payload;
    const console = request.originalUrl.startsWith("/console");
    const razorpay = console ? " https://*.razorpay.com" : "";
    reply.header(
      "content-security-policy",
      [
        "default-src 'self'",
        `script-src 'self'${razorpay}`,
        // React sets style attributes; no stylesheet is fetched from elsewhere.
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob:${razorpay}`,
        "font-src 'self' data:",
        `connect-src 'self'${razorpay}`,
        `frame-src ${console ? "https://*.razorpay.com" : "'none'"}`,
        "media-src 'self' blob:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
    );
    return payload;
  });
  // The route *pattern*, never the URL: a URL can carry a token or an invitation code.
  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        route: request.routeOptions.url ?? "(no route)",
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
        ...(request.orgId === undefined ? {} : { org: request.orgId }),
      },
      "request",
    );
  });

  const bearer = (request: FastifyRequest): string | null => {
    const header = request.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
    return header.slice("Bearer ".length);
  };

  /**
   * The staff actor behind a request, if it may do `permission`.
   *
   * 401 when nobody is signed in, 403 when someone is but their role does not
   * allow this. The service checks the permission again; this check is what
   * lets the route answer before doing any work.
   */
  const staff = async (
    request: FastifyRequest,
    reply: FastifyReply,
    permission: Permission | null,
  ): Promise<Actor | null> => {
    const token = bearer(request);
    const actor = token === null ? null : await auth.resolve(token);
    if (actor === null) {
      await reply.code(401).send({ error: "staff_auth_required" });
      return null;
    }
    request.orgId = actor.orgId;
    // An owner their organisation requires to use a second factor, who has
    // none yet, may do nothing but set one up (routes that ask no permission).
    if (permission !== null && actor.kind === "user" && actor.mustEnrol2fa === true) {
      await reply.code(403).send({ error: "two_factor_required", message: "Set up a second factor before continuing" });
      return null;
    }
    if (permission !== null && !can(actor, permission)) {
      await reply.code(403).send({ error: "forbidden", message: `This account does not have ${permission}` });
      return null;
    }
    if (await limited(reply, "organisation", actor.orgId)) return null;
    return actor;
  };

  const requireAttempt = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<AttemptClaims | null> => {
    const token = bearer(request);
    if (token === null) {
      await reply.code(401).send({ error: "attempt_token_required" });
      return null;
    }
    let claims: AttemptClaims;
    try {
      claims = await tokens.verify(token);
    } catch {
      await reply.code(401).send({ error: "invalid_attempt_token" });
      return null;
    }
    request.orgId = claims.orgId;
    if (await limited(reply, "attempt", claims.attemptId)) return null;
    return claims;
  };

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AtsError) {
      const status = { invalid_request: 400, unauthorised: 401, not_configured: 409, upstream: 502 }[error.code];
      return reply.code(status).send({ error: error.code, message: error.message });
    }
    if (error instanceof SecurityError) {
      return reply.code(securityStatus[error.code]).send({ error: error.code, message: error.message });
    }
    if (error instanceof PracticeError) {
      const status = {
        not_found: 404,
        closed: 404,
        invalid: 422,
        not_practicable: 422,
        email_taken: 409,
        slug_taken: 409,
        language_not_offered: 409,
        sign_in_failed: 401,
        too_many_runs: 429,
        contest_not_started: 403,
        email_not_verified: 403,
      }[error.code];
      return reply.code(status).send({ error: error.code, message: error.message });
    }
    if (error instanceof AttemptError) {
      // 410 for an expired attempt: the window is gone, not merely a bad
      // request against the current state.
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "expired"
            ? 410
            : error.code === "reason_required" || error.code === "invalid_extension" || error.code === "invalid_privacy" || error.code === "invalid_billing" || error.code === "invalid_proctoring" || error.code === "invalid_integration"
              ? 422
              : error.code === "too_many_runs"
                ? 429
                : 409;
      return reply.code(status).send({ error: error.code, message: error.message });
    }
    if (error instanceof RunnerUnavailable) {
      return reply.code(503).send({ error: "runner_unavailable", message: "Code cannot be run just now." });
    }
    if (error instanceof Forbidden) {
      return reply.code(403).send({ error: "forbidden", message: error.message });
    }
    if (error instanceof OutOfCredits) {
      return reply.code(402).send({ error: "out_of_credits", message: error.message });
    }
    if (error instanceof BillingNotConfigured) {
      return reply.code(503).send({ error: "billing_not_configured", message: error.message });
    }
    if (error instanceof GatewayUnavailable) {
      return reply.code(502).send({ error: "payment_gateway_unavailable", message: "Razorpay could not take the order just now. Try again in a moment." });
    }
    if (error instanceof SpendCapReached) {
      return reply.code(402).send({ error: "spend_cap_reached", message: error.message });
    }
    if (error instanceof ExamFrozen) {
      return reply.code(409).send({ error: "exam_frozen", message: error.message });
    }
    if (error instanceof UnsafeUrl) {
      return reply.code(422).send({ error: "unsafe_url", message: error.message });
    }
    if (error instanceof WeakPassword) {
      return reply.code(422).send({ error: "weak_password", message: error.message });
    }
    if (error instanceof ExamInvalidError) {
      return reply.code(422).send({ error: "invalid_exam", problems: error.problems });
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({ error: "invalid_request", message: error.message });
    }
    if (isResponseSerializationError(error)) {
      // A response that does not match its schema is a bug in this service, and
      // the schema is what keeps a candidate's payload free of an answer key —
      // so it fails loudly rather than shipping an unchecked body.
      return reply.code(500).send({ error: "invalid_response", message: error.message });
    }
    // Fastify's own refusals — malformed JSON, an empty body sent as JSON, an
    // unsupported media type — carry a 4xx status. They are the client's
    // mistake and are reported as such, not as a fault in this service.
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) {
      const code = (error as { code?: unknown }).code;
      return reply
        .code(status)
        .send({ error: typeof code === "string" ? code : "bad_request", message: (error as Error).message });
    }
    // The message is left out: a database error quotes the row it tripped on,
    // which can be a roll number or an email. The type, code and call stack
    // are enough to find the fault.
    const failure = error as Error & { code?: unknown };
    request.log.error(
      {
        err: {
          type: failure.name,
          ...(typeof failure.code === "string" ? { code: failure.code } : {}),
          stack: (failure.stack ?? "").split("\n").slice(1, 12).join("\n"),
        },
      },
      "unhandled error",
    );
    return reply.code(500).send({ error: "internal_error" });
  });

  /**
   * Routes live in a child plugin so that they register *after* the OpenAPI
   * plugin above.
   *
   * Fastify defers plugin loading, but a route added straight onto `app` is
   * registered immediately — before `@fastify/swagger` has installed the
   * `onRoute` hook it collects the document from. The result is a valid but
   * empty spec, which is worse than none, so the ordering is made explicit.
   */
  void app.register(async (instance) => {
    const routes = instance.withTypeProvider<ZodTypeProvider>();

    // --- the contract itself --------------------------------------------------

    routes.get(
      "/openapi.json",
      {
        schema: {
          tags: INSTITUTION,
          summary: "This API's OpenAPI document",
          description: "Served from the same schemas the routes validate against, so it cannot drift from them.",
        },
      },
      async (_request, reply) => reply.send(app.swagger()),
    );

    // --- institution routes ---------------------------------------------------

    routes.post(
      "/exams",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Create or replace an exam",
          description: "Rejected with 422 and every problem at once if the exam is misconfigured.",
          security: [{ staffAuth: [] }],
          body: S.examSchema,
          response: { 201: S.examSchema.pick({ id: true }), 422: S.examProblems, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "exam:write");
        if (actor === null) return;
        const exam = request.body as unknown as Exam;
        await service.createExam(actor, exam);
        return reply.code(201).send({ id: exam.id });
      },
    );

    routes.post(
      "/exams/:examId/clone",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Copy an exam under a new id",
          description:
            "The way to change an exam that has been sat. A sat exam is frozen, because its ledgers record answers to its questions as they were; the copy has no attempts and can be edited.",
          security: [{ staffAuth: [] }],
          params: S.examParams,
          body: S.cloneExamBody,
          response: { 201: S.examSchema.pick({ id: true }), 422: S.examProblems, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "exam:write");
        if (actor === null) return;
        const { id, title } = request.body;
        await service.cloneExam(actor, examId(request.params.examId), examId(id), title);
        return reply.code(201).send({ id });
      },
    );

    routes.get(
      "/exams",
      {
        schema: {
          tags: INSTITUTION,
          summary: "List exams",
          security: [{ staffAuth: [] }],
          response: { 200: S.examListResponse, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "exam:read");
        if (actor === null) return;
        return reply.send({ exams: await service.listExams(actor) });
      },
    );

    routes.get(
      "/exams/:examId",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Fetch an exam in full",
          description: "Includes the answer key, which is why it is staff-only. Candidates get `GET /attempts/me`.",
          security: [{ staffAuth: [] }],
          params: S.examParams,
          response: { 200: S.examSchema, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "exam:read_key");
        if (actor === null) return;
        return reply.send(await service.loadExam(actor, examId(request.params.examId)));
      },
    );

    routes.get(
      "/exams/:examId/attempts",
      {
        schema: {
          tags: INSTITUTION,
          summary: "List attempts at an exam",
          security: [{ staffAuth: [] }],
          params: S.examParams,
          response: { 200: S.attemptListResponse, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "attempt:read");
        if (actor === null) return;
        return reply.send({ attempts: await service.listAttempts(actor, examId(request.params.examId)) });
      },
    );

    routes.post(
      "/exams/:examId/attempts",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Start an attempt and issue its access code",
          security: [{ staffAuth: [] }],
          params: S.examParams,
          body: S.startAttemptBody,
          response: { 201: S.startAttemptResponse, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "attempt:start");
        if (actor === null) return;
        const exam = examId(request.params.examId);
        const candidate = candidateId(request.body.candidateId);

        const id = await service.startAttempt(actor, exam, candidate);
        const token = await tokens.issue(
          { orgId: actor.orgId, attemptId: id, examId: exam, candidateId: candidate },
          ttl,
        );
        return reply.code(201).send({ attemptId: id, token, expiresInSeconds: ttl });
      },
    );

    routes.post(
      "/attempts/:attemptId/grade",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Grade a submitted attempt",
          description: "Consults scores only. A viva verdict never moves a grade.",
          security: [{ staffAuth: [] }],
          params: S.attemptParams,
          response: { 200: S.gradeResponse, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "attempt:grade");
        if (actor === null) return;
        return reply.send({ total: await service.grade(actor, attemptId(request.params.attemptId)) });
      },
    );

    routes.post(
      "/attempts/:attemptId/assess/:probeId",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Record a reading of one micro-viva exchange",
          description: "Evidence about provenance. Separate from grading, and it feeds nothing back into a score.",
          security: [{ staffAuth: [] }],
          params: S.probeParams,
          response: { 200: S.assessmentResponse, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "attempt:assess");
        if (actor === null) return;
        const { attemptId: raw, probeId } = request.params;
        return reply.send(await service.assess(actor, attemptId(raw), vivaId(probeId)));
      },
    );

    routes.post(
      "/attempts/:attemptId/void",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Set an attempt aside, with a recorded reason",
          description:
            "A person's decision, so a signed-in user's and never an API key's. Nothing in the system reaches this on its own — no verdict, no confidence, no combination of them. The reason and who decided are written into the ledger and shown to the candidate.",
          security: [{ staffAuth: [] }],
          params: S.attemptParams,
          body: S.voidBody,
          response: { 200: S.okResponse, 422: S.errorResponse, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "attempt:void");
        if (actor === null) return;
        await service.voidAttempt(actor, attemptId(request.params.attemptId), request.body.reason);
        return reply.send({ ok: true });
      },
    );

    routes.post(
      "/attempts/:attemptId/extend",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Give an open attempt more time, with a reason",
          description:
            "For a technical failure or an accommodation. A signed-in person's decision, recorded in the ledger with their name and the reason, and shown on the candidate's receipt. Works after the window has passed, as long as nothing has closed the attempt yet.",
          security: [{ staffAuth: [] }],
          params: S.attemptParams,
          body: S.extendBody,
          response: { 200: S.extendResponse, 422: S.errorResponse, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "attempt:extend");
        if (actor === null) return;
        const { minutes, reason } = request.body;
        const expiresAt = await service.extendTime(actor, attemptId(request.params.attemptId), minutes, reason);
        return reply.send({ expiresAt });
      },
    );

    routes.get(
      "/attempts/:attemptId/review",
      {
        schema: {
          tags: INSTITUTION,
          summary: "The grade and, separately, the provenance evidence",
          description: "Verdicts are reported beside the grade, never folded into it.",
          security: [{ staffAuth: [] }],
          params: S.attemptParams,
          response: { 200: S.reviewResponse, ...errors },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "attempt:review");
        if (actor === null) return;
        const projection = await service.projection(actor, attemptId(request.params.attemptId));
        return reply.send({
          state: projection.attempt.state,
          total: projection.total,
          voidReason: projection.voidReason,
          voidedBy: projection.voidedBy,
          vivas: projection.vivas.map((v) => ({
            probeId: v.probe.id,
            questionId: v.probe.questionId,
            prompt: v.probe.prompt,
            rationale: v.probe.rationale,
            reply: v.exchange?.reply ?? null,
            latencyMs: v.exchange?.latencyMs ?? null,
            verdict: v.assessment?.verdict ?? null,
            confidence: v.assessment?.confidence ?? null,
            reasoning: v.assessment?.reasoning ?? null,
          })),
        });
      },
    );

    // --- candidate routes -----------------------------------------------------

    routes.get(
      "/attempts/me",
      {
        schema: {
          tags: CANDIDATE,
          summary: "This attempt, and the exam stripped of its answer key",
          security: [{ attemptToken: [] }],
          response: { 200: S.candidateStateResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;
        return reply.send(await service.candidateState(claims));
      },
    );

    routes.post(
      "/attempts/me/answers",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Submit or revise an answer",
          security: [{ attemptToken: [] }],
          body: S.answerBody,
          response: { 202: S.okResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;
        await service.submitAnswer(claims, questionId(request.body.questionId), request.body.answer);
        return reply.code(202).send({ ok: true });
      },
    );

    routes.post(
      "/attempts/me/run",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Run code against the question's examples, or on input of the candidate's own",
          description:
            "Hidden tests are never run on request. Nothing is recorded: running is working, not answering. The answer is what the candidate commits, which is when it is tested in full.",
          security: [{ attemptToken: [] }],
          body: S.runBody,
          response: { 200: S.runResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;
        const { questionId: q, language, source, input } = request.body;
        return reply.send(await service.runCode(claims, questionId(q), { language, source }, input));
      },
    );

    routes.post(
      "/attempts/me/code/submit",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Commit a code answer and test it against every test",
          description:
            "The answer is committed first, as with any answer, and stands whatever the tests find. What comes back is as much as the exam tells: every test's verdict, a hidden test's without its content — or the visible tests' only.",
          security: [{ attemptToken: [] }],
          body: S.submitCodeBody,
          response: { 200: S.submitCodeResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;
        const { questionId: q, language, source } = request.body;
        return reply.send(await service.submitCode(claims, questionId(q), { language, source }));
      },
    );

    routes.put(
      "/attempts/me/drafts/:questionId",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Autosave what has been typed so far",
          description:
            "Not an answer yet: nothing is written to the ledger. Drafts are committed when the candidate commits the answer, submits, or the window closes — and restored if the page is reopened, on this device or another.",
          security: [{ attemptToken: [] }],
          params: S.draftParams,
          body: S.draftBody,
          response: { 202: S.okResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;
        await service.saveDraft(claims, questionId(request.params.questionId), request.body.answer);
        return reply.code(202).send({ ok: true });
      },
    );

    routes.post(
      "/attempts/me/heartbeat",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Check in",
          description:
            "Tells an invigilator the candidate is here, and returns the deadline as it now stands so the page learns of an extension without reloading. Records presence only — nothing about what the candidate is doing.",
          security: [{ attemptToken: [] }],
          response: { 200: S.heartbeatResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;
        const beat = await service.heartbeat(claims);
        const announcements = (await options.invigilation.forCandidate(claims)).length;
        return reply.send({ ...beat, announcements });
      },
    );

    routes.post(
      "/attempts/me/submit",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Submit the attempt",
          security: [{ attemptToken: [] }],
          response: { 200: S.okResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;
        await service.submitAttempt(claims);
        return reply.send({ ok: true });
      },
    );

    /**
     * Stream the next probe, if one is due.
     *
     * Server-Sent Events, because delivery is one-way and the candidate should
     * see the probe as it is written rather than after a pause. The probe's
     * `askedAt` is recorded server-side when the ledger entry is appended — that
     * timestamp, not anything the client reports, is what reply latency is
     * measured from.
     */
    routes.post(
      "/attempts/me/sections/next",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Leave the current part and enter the next section",
          description:
            "For an exam whose sections have their own time. The part left is locked; the next section's clock starts now. A section whose time is up keeps only the drafts saved in time.",
          security: [{ attemptToken: [] }],
          response: { 200: z.object({ ok: z.literal(true) }), ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;
        await service.nextSection(claims);
        return reply.send({ ok: true });
      },
    );

    routes.get(
      "/attempts/me/probe",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Stream the next micro-viva probe, if one is due",
          description:
            "text/event-stream. Events: `token` while the probe is written, then `probe` with its id and prompt, or `none` when nothing qualifies — which is the ordinary case. With `stream=0` (low-bandwidth mode), one JSON reply instead: `{ probe: { id, prompt } | null }`.",
          security: [{ attemptToken: [] }],
          querystring: z.object({ stream: z.enum(["0", "1"]).default("1") }),
          // No response schema: this writes to the raw socket, so the serializer
          // never sees it.
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;

        // One reply, no stream: a flaky 2G connection holds a short request
        // better than an open one, and a proxy that buffers streams cannot stall it.
        if (request.query.stream === "0") {
          const probe = await service.raiseProbe(claims, {});
          return reply.send({ probe: probe === null ? null : { id: probe.id, prompt: probe.prompt } });
        }

        reply.raw.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });

        const send = (event: string, data: unknown): void => {
          reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };

        try {
          const probe = await service.raiseProbe(claims, {
            onToken: (token) => send("token", { token }),
          });
          send(probe === null ? "none" : "probe", probe === null ? {} : { id: probe.id, prompt: probe.prompt });
        } catch (error) {
          send("error", { message: error instanceof Error ? error.message : "probe failed" });
        } finally {
          reply.raw.end();
        }
        return reply;
      },
    );

    routes.post(
      "/attempts/me/probes/:probeId/reply",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Reply to a probe",
          description:
            "The body carries the reply and nothing else. How long it took is measured on the server, between the probe's recorded `askedAt` and this request arriving.",
          security: [{ attemptToken: [] }],
          params: S.candidateProbeParams,
          body: S.replyBody,
          response: { 200: S.replyResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;

        const exchange = await service.recordReply(
          claims,
          vivaId(request.params.probeId),
          request.body.reply,
        );
        return reply.send({ ok: true, latencyMs: exchange.latencyMs });
      },
    );

    /**
     * The candidate's own ledger.
     *
     * SPEC §6.2: a record kept against someone that they cannot inspect is not
     * evidence. While the attempt is open this returns the head hash only — the
     * candidate pins it now and verifies the chain once the attempt closes, which
     * keeps the tamper-evidence guarantee intact without disclosing the probe
     * rationales and verdicts the entries carry.
     */
    routes.get(
      "/attempts/me/ledger",
      {
        schema: {
          tags: CANDIDATE,
          summary: "This attempt's record",
          description:
            "While the attempt is open, the head hash alone. Once closed, the whole chain — which `@parikshaa/verify` checks offline.",
          security: [{ attemptToken: [] }],
          response: { 200: S.ledgerResponse, ...errors },
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;

        const ledger = await service.candidateLedger(claims);
        return reply.send({
          head: ledger.head,
          length: ledger.length,
          sealed: ledger.sealed,
          entries:
            ledger.entries === null
              ? null
              : ledger.entries.map((e) => ({
                  seq: e.seq,
                  timestamp: e.timestamp,
                  type: e.event.type,
                  event: e.event,
                  prevHash: e.prevHash,
                  hash: e.hash,
                })),
        });
      },
    );

    routes.get(
      "/health",
      { schema: { tags: INSTITUTION, summary: "Liveness", response: { 200: S.okResponse } } },
      async (_request, reply) => reply.send({ ok: true }),
    );

    registerBankRoutes(routes, { service, bank: options.bank, media: options.media, staff });
    const throttle = options.loginThrottle ?? new LoginThrottle();
    if (options.practice !== undefined) {
      const identity = options.practiceIdentity;
      registerPracticeRoutes(routes, { practice: options.practice, service, staff, bearer, throttle, ...(identity === undefined ? {} : { identity }) });
      if (identity !== undefined) registerPracticeIdentityRoutes(routes, { practice: options.practice, identity, service, bearer, staff });
    }

    registerInvitationRoutes(routes, { invitations: options.invitations, throttle, staff });
    registerResultsRoutes(routes, { results: options.results, staff });
    registerIntegrationRoutes(routes, { webhooks: options.webhooks, greenhouse: options.greenhouse, throttle, staff });
    if (options.ats !== undefined) registerAtsRoutes(routes, { ats: options.ats, throttle, staff });
    if (options.lti !== undefined) registerLtiRoutes(routes, { lti: options.lti, staff });
    registerInvigilationRoutes(routes, { invigilation: options.invigilation, service, staff, candidate: requireAttempt });
    registerPrivacyRoutes(routes, { privacy: options.privacy, staff, candidate: requireAttempt });
    registerBillingRoutes(routes, { billing: options.billing, staff });
    registerProctoringRoutes(routes, { proctor: options.proctor, staff, candidate: requireAttempt });

    registerAccountRoutes(routes, {
      service,
      auth,
      identity: options.identity,
      throttle,
      bearer,
      staff,
    });
    if (options.security !== undefined) registerSecurityRoutes(routes, { service, security: options.security, throttle, staff });
  });

  if (options.clients !== undefined) {
    const { web, console: consoleRoot } = options.clients;

    void app.register(fastifyStatic, { root: consoleRoot, prefix: "/console/" });
    void app.register(fastifyStatic, { root: web, prefix: "/", decorateReply: false });

    // A practice site's pages share their addresses with its API: /practice/<site>
    // is a page to a browser and JSON to the app, which calls it under /api.
    // A browser's navigation there gets the web client's shell.
    app.addHook("onRequest", async (request, reply) => {
      if (request.method !== "GET" || !request.originalUrl.startsWith("/practice/")) return;
      if (request.headers.accept?.includes("text/html") !== true) return;
      return reply.sendFile("index.html", web);
    });

    // Both clients hold their own view state, so a deep link or a reload must
    // return the shell rather than a 404. API routes are matched first, and
    // anything under /console belongs to the console bundle.
    app.setNotFoundHandler(async (request, reply) => {
      if (request.method !== "GET" || request.headers.accept?.includes("text/html") !== true) {
        return reply.code(404).send({ error: "not_found" });
      }
      return reply.sendFile("index.html", request.url.startsWith("/console") ? consoleRoot : web);
    });
  }

  return app;
}
