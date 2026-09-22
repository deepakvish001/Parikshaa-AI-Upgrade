import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
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
import { ExamFrozen, type IdentityStore, type QuestionBank } from "@parikshaa/store";
import { registerAccountRoutes } from "./account-routes.js";
import { registerBankRoutes } from "./bank-routes.js";
import { AttemptTokens, type AttemptClaims } from "./auth.js";
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
  readonly loginThrottle?: LoginThrottle;
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
    logger: false,
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
      ],
      components: {
        securitySchemes: {
          staffAuth: {
            type: "http",
            scheme: "bearer",
            description: "A staff session token (`pks_…`) or an API key (`pkk_…`).",
          },
          attemptToken: { type: "http", scheme: "bearer", description: "A candidate's attempt-scoped token." },
        },
      },
    },
    transform: jsonSchemaTransform,
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
    if (permission !== null && !can(actor, permission)) {
      await reply.code(403).send({ error: "forbidden", message: `This account does not have ${permission}` });
      return null;
    }
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
    try {
      return await tokens.verify(token);
    } catch {
      await reply.code(401).send({ error: "invalid_attempt_token" });
      return null;
    }
  };

  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof AttemptError) {
      // 410 for an expired attempt: the window is gone, not merely a bad
      // request against the current state.
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "expired"
            ? 410
            : error.code === "reason_required" || error.code === "invalid_extension"
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
    if (error instanceof SpendCapReached) {
      return reply.code(402).send({ error: "spend_cap_reached", message: error.message });
    }
    if (error instanceof ExamFrozen) {
      return reply.code(409).send({ error: "exam_frozen", message: error.message });
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
        return reply.send(await service.heartbeat(claims));
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
    routes.get(
      "/attempts/me/probe",
      {
        schema: {
          tags: CANDIDATE,
          summary: "Stream the next micro-viva probe, if one is due",
          description:
            "text/event-stream. Events: `token` while the probe is written, then `probe` with its id and prompt, or `none` when nothing qualifies — which is the ordinary case.",
          security: [{ attemptToken: [] }],
          // No response schema: this writes to the raw socket, so the serializer
          // never sees it.
        },
      },
      async (request, reply) => {
        const claims = await requireAttempt(request, reply);
        if (claims === null) return;

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

    registerBankRoutes(routes, { service, bank: options.bank, staff });

    registerAccountRoutes(routes, {
      service,
      auth,
      identity: options.identity,
      throttle: options.loginThrottle ?? new LoginThrottle(),
      bearer,
      staff,
    });

  });

  if (options.clients !== undefined) {
    const { web, console: consoleRoot } = options.clients;

    void app.register(fastifyStatic, { root: consoleRoot, prefix: "/console/" });
    void app.register(fastifyStatic, { root: web, prefix: "/", decorateReply: false });

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
