import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { attemptId, candidateId, examId, questionId, vivaId, type Exam } from "@parikshaa/core";
import { AttemptTokens, type AttemptClaims } from "./auth.js";
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
    if (error instanceof ExamInvalidError) {
      return reply.code(422).send({ error: "invalid_exam", problems: error.problems });
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

  app.get("/exams", async (request, reply) => {
    if (!(await requireStaff(request, reply))) return;
    return reply.send({ exams: await service.listExams() });
  });

  /** The full exam, answer key included. Staff-only, unlike GET /attempts/me. */
  app.get("/exams/:examId", async (request, reply) => {
    if (!(await requireStaff(request, reply))) return;
    const { examId: raw } = request.params as { examId: string };
    return reply.send(await service.loadExam(examId(raw)));
  });

  app.get("/exams/:examId/attempts", async (request, reply) => {
    if (!(await requireStaff(request, reply))) return;
    const { examId: raw } = request.params as { examId: string };
    return reply.send({ attempts: await service.listAttempts(examId(raw)) });
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
   * Assess a replied-to probe and record the verdict.
   *
   * Institution-side and deliberately separate from grading: a verdict is
   * evidence about provenance, and nothing here feeds back into a score.
   */
  app.post("/attempts/:attemptId/assess/:probeId", async (request, reply) => {
    if (!(await requireStaff(request, reply))) return;
    const { attemptId: rawAttempt, probeId } = request.params as {
      attemptId: string;
      probeId: string;
    };
    const assessment = await service.assess(attemptId(rawAttempt), vivaId(probeId));
    return reply.send(assessment);
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

  app.get("/attempts/me", async (request, reply) => {
    const claims = await requireAttempt(request, reply);
    if (claims === null) return;
    return reply.send(await service.candidateState(claims.attemptId));
  });

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
   * evidence. While the attempt is open this returns the head hash only — the
   * candidate pins it now and verifies the chain once the attempt closes, which
   * keeps the tamper-evidence guarantee intact without disclosing the probe
   * rationales and verdicts the entries carry.
   */
  app.get("/attempts/me/ledger", async (request, reply) => {
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
  });

  app.get("/health", async (_request, reply) => reply.send({ ok: true }));

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
