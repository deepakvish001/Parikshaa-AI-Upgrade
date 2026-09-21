import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { attemptId, candidateId, examId, questionId, vivaId, type Exam } from "@parikshaa/core";
import { AttemptTokens, type AttemptClaims } from "./auth.js";
import { AttemptError, ExamService } from "./service.js";

export interface ServerOptions {
  readonly service: ExamService;
  readonly tokens: AttemptTokens;
  /** Bearer token for institution-side routes (exam authoring, grading, review). */
  readonly staffToken: string;
  /** Lifetime of an issued attempt token. Defaults to three hours. */
  readonly attemptTtlSeconds?: number;
}

const startBody = z.object({ candidateId: z.string().min(1) });
const answerBody = z.object({ questionId: z.string().min(1), answer: z.string() });
const replyBody = z.object({ reply: z.string().min(1) });

/**
 * Attempt-scoped routes address the attempt as `me`.
 *
 * The attempt is taken from the bearer token, never from the path, so there is
 * no attempt id for a candidate to change. A whole class of access bug simply
 * has nowhere to live.
 */
export function buildServer(options: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: false });
  const { service, tokens, staffToken } = options;
  const ttl = options.attemptTtlSeconds ?? 3 * 60 * 60;

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
      const status = error.code === "not_found" ? 404 : 409;
      return reply.code(status).send({ error: error.code, message: error.message });
    }
    if (error instanceof z.ZodError) {
      return reply.code(400).send({ error: "invalid_body", issues: error.issues });
    }
    return reply.code(500).send({ error: "internal_error" });
  });

  // --- institution routes -------------------------------------------------

  app.post("/exams", async (request, reply) => {
    if (!(await requireStaff(request, reply))) return;
    const exam = request.body as Exam;
    await service.createExam(exam);
    return reply.code(201).send({ id: exam.id });
  });

  app.post("/exams/:examId/attempts", async (request, reply) => {
    if (!(await requireStaff(request, reply))) return;
    const { examId: rawExamId } = request.params as { examId: string };
    const body = startBody.parse(request.body);

    const id = await service.startAttempt(examId(rawExamId), candidateId(body.candidateId));
    const token = await tokens.issue(
      { attemptId: id, examId: examId(rawExamId), candidateId: candidateId(body.candidateId) },
      ttl,
    );
    return reply.code(201).send({ attemptId: id, token, expiresInSeconds: ttl });
  });

  app.post("/attempts/:attemptId/grade", async (request, reply) => {
    if (!(await requireStaff(request, reply))) return;
    const { attemptId: raw } = request.params as { attemptId: string };
    const total = await service.grade(attemptId(raw));
    return reply.send({ total });
  });

  /**
   * The provenance evidence, for a human to act on. Verdicts are reported
   * beside the grade, never folded into it (SPEC §6.1).
   */
  app.get("/attempts/:attemptId/review", async (request, reply) => {
    if (!(await requireStaff(request, reply))) return;
    const { attemptId: raw } = request.params as { attemptId: string };
    const projection = await service.projection(attemptId(raw));
    return reply.send({
      state: projection.attempt.state,
      total: projection.total,
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
  });

  // --- candidate routes ---------------------------------------------------

  app.post("/attempts/me/answers", async (request, reply) => {
    const claims = await requireAttempt(request, reply);
    if (claims === null) return;
    const body = answerBody.parse(request.body);

    await service.submitAnswer(claims.attemptId, questionId(body.questionId), body.answer);
    return reply.code(202).send({ ok: true });
  });

  app.post("/attempts/me/submit", async (request, reply) => {
    const claims = await requireAttempt(request, reply);
    if (claims === null) return;
    await service.submitAttempt(claims.attemptId);
    return reply.send({ ok: true });
  });

  /**
   * Stream the next probe, if one is due.
   *
   * Server-Sent Events, because delivery is one-way and the candidate should
   * see the probe as it is written rather than after a pause. The probe's
   * `askedAt` is recorded server-side when the ledger entry is appended — that
   * timestamp, not anything the client reports, is what reply latency is
   * measured from.
   */
  app.get("/attempts/me/probe", async (request, reply) => {
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
  });

  app.post("/attempts/me/probes/:probeId/reply", async (request, reply) => {
    const claims = await requireAttempt(request, reply);
    if (claims === null) return;
    const { probeId } = request.params as { probeId: string };
    const body = replyBody.parse(request.body);

    // No latency field is accepted from the client, by design.
    const exchange = await service.recordReply(claims.attemptId, vivaId(probeId), body.reply);
    return reply.send({ ok: true, latencyMs: exchange.latencyMs });
  });

  /**
   * The candidate's own ledger.
   *
   * SPEC §6.2: a record kept against someone that they cannot inspect is not
   * evidence. The head hash is returned so they can keep it and later prove
   * which record they were shown.
   */
  app.get("/attempts/me/ledger", async (request, reply) => {
    const claims = await requireAttempt(request, reply);
    if (claims === null) return;

    const entries = await service.ledger(claims.attemptId);
    return reply.send({
      head: entries.at(-1)?.hash ?? null,
      entries: entries.map((e) => ({
        seq: e.seq,
        timestamp: e.timestamp,
        type: e.event.type,
        event: e.event,
        prevHash: e.prevHash,
        hash: e.hash,
      })),
    });
  });

  app.get("/health", async (_request, reply) => reply.send({ ok: true }));

  return app;
}
