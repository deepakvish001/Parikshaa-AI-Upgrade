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
import { AttemptTokens, type AttemptClaims } from "./auth.js";
import * as S from "./schemas.js";
import { AttemptError, ExamInvalidError, ExamService } from "./service.js";

export interface ServerOptions {
  readonly service: ExamService;
  readonly tokens: AttemptTokens;
  /** Bearer token for institution-side routes (exam authoring, grading, review). */
  readonly staffToken: string;
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
const errors = {
  400: S.errorResponse,
  401: S.errorResponse,
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
  const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>();
  const { service, tokens, staffToken } = options;
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
          "Assessment with a tamper-evident ledger and a micro-viva engine. Institution routes use a shared staff bearer token; candidate routes use a short-lived token scoped to one attempt, which is why they address it as `me`.",
      },
      tags: [
        { name: "Institution", description: "Authoring exams, issuing access codes, grading and review." },
        { name: "Candidate", description: "Sitting one attempt. Scoped entirely by the bearer token." },
      ],
      components: {
        securitySchemes: {
          staffToken: { type: "http", scheme: "bearer", description: "The institution's shared token." },
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

  const requireStaff = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    if (bearer(request) !== staffToken) {
      await reply.code(401).send({ error: "staff_token_required" });
      return false;
    }
    return true;
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
            : error.code === "reason_required"
              ? 422
              : 409;
      return reply.code(status).send({ error: error.code, message: error.message });
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
          security: [{ staffToken: [] }],
          body: S.examSchema,
          response: { 201: S.examSchema.pick({ id: true }), 422: S.examProblems, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        const exam = request.body as unknown as Exam;
        await service.createExam(exam);
        return reply.code(201).send({ id: exam.id });
      },
    );

    routes.get(
      "/exams",
      {
        schema: {
          tags: INSTITUTION,
          summary: "List exams",
          security: [{ staffToken: [] }],
          response: { 200: S.examListResponse, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        return reply.send({ exams: await service.listExams() });
      },
    );

    routes.get(
      "/exams/:examId",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Fetch an exam in full",
          description: "Includes the answer key, which is why it is staff-only. Candidates get `GET /attempts/me`.",
          security: [{ staffToken: [] }],
          params: S.examParams,
          response: { 200: S.examSchema, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        return reply.send(await service.loadExam(examId(request.params.examId)));
      },
    );

    routes.get(
      "/exams/:examId/attempts",
      {
        schema: {
          tags: INSTITUTION,
          summary: "List attempts at an exam",
          security: [{ staffToken: [] }],
          params: S.examParams,
          response: { 200: S.attemptListResponse, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        return reply.send({ attempts: await service.listAttempts(examId(request.params.examId)) });
      },
    );

    routes.post(
      "/exams/:examId/attempts",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Start an attempt and issue its access code",
          security: [{ staffToken: [] }],
          params: S.examParams,
          body: S.startAttemptBody,
          response: { 201: S.startAttemptResponse, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        const exam = examId(request.params.examId);
        const candidate = candidateId(request.body.candidateId);

        const id = await service.startAttempt(exam, candidate);
        const token = await tokens.issue({ attemptId: id, examId: exam, candidateId: candidate }, ttl);
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
          security: [{ staffToken: [] }],
          params: S.attemptParams,
          response: { 200: S.gradeResponse, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        return reply.send({ total: await service.grade(attemptId(request.params.attemptId)) });
      },
    );

    routes.post(
      "/attempts/:attemptId/assess/:probeId",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Record a reading of one micro-viva exchange",
          description: "Evidence about provenance. Separate from grading, and it feeds nothing back into a score.",
          security: [{ staffToken: [] }],
          params: S.probeParams,
          response: { 200: S.assessmentResponse, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        const { attemptId: raw, probeId } = request.params;
        return reply.send(await service.assess(attemptId(raw), vivaId(probeId)));
      },
    );

    routes.post(
      "/attempts/:attemptId/void",
      {
        schema: {
          tags: INSTITUTION,
          summary: "Set an attempt aside, with a recorded reason",
          description:
            "A person's decision. Nothing in the system reaches this on its own — no verdict, no confidence, no combination of them. The reason is written into the ledger and shown to the candidate.",
          security: [{ staffToken: [] }],
          params: S.attemptParams,
          body: S.voidBody,
          response: { 200: S.okResponse, 422: S.errorResponse, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        await service.voidAttempt(attemptId(request.params.attemptId), request.body.reason);
        return reply.send({ ok: true });
      },
    );

    routes.get(
      "/attempts/:attemptId/review",
      {
        schema: {
          tags: INSTITUTION,
          summary: "The grade and, separately, the provenance evidence",
          description: "Verdicts are reported beside the grade, never folded into it.",
          security: [{ staffToken: [] }],
          params: S.attemptParams,
          response: { 200: S.reviewResponse, ...errors },
        },
      },
      async (request, reply) => {
        if (!(await requireStaff(request, reply))) return;
        const projection = await service.projection(attemptId(request.params.attemptId));
        return reply.send({
          state: projection.attempt.state,
          total: projection.total,
          voidReason: projection.voidReason,
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
        return reply.send(await service.candidateState(claims.attemptId));
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
        await service.submitAnswer(claims.attemptId, questionId(request.body.questionId), request.body.answer);
        return reply.code(202).send({ ok: true });
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
        await service.submitAttempt(claims.attemptId);
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
          const probe = await service.raiseProbe(claims.attemptId, {
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
          claims.attemptId,
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

        const ledger = await service.candidateLedger(claims.attemptId);
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
