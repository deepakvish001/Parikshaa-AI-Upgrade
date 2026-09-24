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
import { questionId, validateQuestion, type Question } from "@parikshaa/core";
import { NotAnImage, staffScope, type BankDraft, type QuestionBank, type QuestionMedia } from "@parikshaa/store";
import { importDocx } from "./docx-import.js";
import { importQuestions } from "./bank-import.js";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface BankRouteDeps {
  readonly service: ExamService;
  readonly bank: QuestionBank;
  readonly media: QuestionMedia;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const BANK = ["Question bank"];
const SECURED = [{ staffAuth: [] }];
const refusals = {
  400: S.errorResponse,
  401: S.errorResponse,
  403: S.errorResponse,
  404: S.errorResponse,
} as const;

/**
 * The question bank (ROADMAP §3).
 *
 * Reading it needs `exam:read_key`, because it holds answer keys; writing it
 * needs `exam:write`. Questions reach an exam by being copied into it, never by
 * reference — see migration 0005.
 */
export function registerBankRoutes(routes: Routes, deps: BankRouteDeps): void {
  const { service, bank, media, staff } = deps;

  /** Check a question the way an exam would, before it is filed. */
  const problemsWith = (draft: BankDraft) =>
    validateQuestion({ ...draft.question, id: questionId("new") } as Question, "question");

  routes.get(
    "/bank",
    {
      schema: {
        tags: BANK,
        summary: "Browse the question bank",
        security: SECURED,
        querystring: S.bankQuery,
        response: { 200: S.bankListResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read_key");
      if (actor === null) return;
      const scope = staffScope(actor.orgId);
      const { topic, difficulty, tag, q } = request.query;
      const [questions, topics] = await Promise.all([
        bank.list(scope, {
          ...(topic === undefined ? {} : { topic }),
          ...(difficulty === undefined ? {} : { difficulty }),
          ...(tag === undefined ? {} : { tag }),
          ...(q === undefined ? {} : { search: q }),
        }),
        bank.topics(scope),
      ]);
      return reply.send({ questions, topics });
    },
  );

  routes.post(
    "/bank",
    {
      schema: {
        tags: BANK,
        summary: "File a question",
        security: SECURED,
        body: S.bankDraftBody,
        response: { 201: S.bankEntry, 422: S.examProblems, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const draft = request.body as unknown as BankDraft;
      const problems = problemsWith(draft);
      if (problems.length > 0) return reply.code(422).send({ error: "invalid_exam", problems });

      const [entry] = await bank.add(staffScope(actor.orgId), [draft]);
      if (entry === undefined) throw new Error("The bank filed nothing");
      await service.recordAudit(actor, "bank.added", entry.id);
      return reply.code(201).send(entry);
    },
  );

  routes.put(
    "/bank/:questionId",
    {
      schema: {
        tags: BANK,
        summary: "Edit a question in the bank",
        description: "Changes no exam already built from it: exams hold their own copy.",
        security: SECURED,
        params: S.bankParams,
        body: S.bankDraftBody,
        response: { 200: S.bankEntry, 422: S.examProblems, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const draft = request.body as unknown as BankDraft;
      const problems = problemsWith(draft);
      if (problems.length > 0) return reply.code(422).send({ error: "invalid_exam", problems });

      const entry = await bank.update(staffScope(actor.orgId), request.params.questionId, draft);
      if (entry === null) return reply.code(404).send({ error: "not_found" });
      await service.recordAudit(actor, "bank.edited", entry.id);
      return reply.send(entry);
    },
  );

  routes.delete(
    "/bank/:questionId",
    {
      schema: {
        tags: BANK,
        summary: "Archive a question",
        description: "Hidden from the bank, kept for the record.",
        security: SECURED,
        params: S.bankParams,
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      if (!(await bank.archive(staffScope(actor.orgId), request.params.questionId))) {
        return reply.code(404).send({ error: "not_found" });
      }
      await service.recordAudit(actor, "bank.archived", request.params.questionId);
      return reply.send({ ok: true });
    },
  );

  routes.post(
    "/bank/import",
    {
      schema: {
        tags: BANK,
        summary: "Import questions from a CSV file",
        description:
          "One question per row under a header row. Columns, in any order: kind (mcq | numeric | short), question, options (mcq, separated by |), answer (mcq: letter, number or text; numeric: value; short: expected points separated by |), tolerance, marks, rubric, topic, difficulty (easy | medium | hard), tags. All or nothing: any problem imports nothing and every problem is reported with its row number. Save an Excel sheet as CSV to import it.",
        security: SECURED,
        body: S.bankImportBody,
        response: { 201: S.bankImportResponse, 422: S.bankImportProblems, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const result = importQuestions(request.body.csv);
      if (!result.ok) return reply.code(422).send({ error: "invalid_import", problems: result.problems });

      const added = await bank.add(staffScope(actor.orgId), result.drafts);
      await service.recordAudit(actor, "bank.imported", actor.orgId, { questions: added.length });
      return reply.code(201).send({ imported: added.length });
    },
  );

  routes.post(
    "/bank/import/docx",
    {
      bodyLimit: 14_500_000,
      schema: {
        tags: BANK,
        summary: "Import questions from a Word (.docx) document",
        description:
          'A question paper as it is usually typed: each question numbered ("1.", "Q1.", or Word\'s own numbered list), mcq options lettered ("a)", "(a)"), then "Answer:", and optionally "Marks:", "Topic:", "Difficulty:", "Tags:", "Type:", "Tolerance:", "Rubric:" lines. The right option can instead be marked with a leading "*". Options make a question mcq; otherwise a numeric answer makes it numeric and anything else short (expected points separated by | or ;). Text before the first question is skipped; pictures and equations are not imported and are noted in the preview. All or nothing, like the CSV import. Send with dryRun first to preview.',
        security: SECURED,
        body: S.bankDocxBody,
        response: { 200: S.bankDocxResponse, 201: S.bankDocxResponse, 422: S.bankDocxProblems, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const result = importDocx(Buffer.from(request.body.file, "base64"));
      if (!result.ok) return reply.code(422).send({ error: "invalid_import", problems: result.problems });
      if (request.body.dryRun) return reply.code(200).send({ imported: 0, preview: result.preview });

      // The pictures first, so no question ever names one that is not there.
      for (const bytes of result.pictures.values()) await media.add(staffScope(actor.orgId), bytes);
      const added = await bank.add(staffScope(actor.orgId), result.drafts);
      await service.recordAudit(actor, "bank.imported", actor.orgId, { questions: added.length, pictures: result.pictures.size, from: "docx" });
      return reply.code(201).send({ imported: added.length, preview: result.preview });
    },
  );

  // --- pictures in questions ----------------------------------------------------

  routes.post(
    "/media",
    {
      bodyLimit: 3_000_000,
      schema: {
        tags: BANK,
        summary: "Upload a picture for a question or passage",
        description:
          "PNG, JPEG, GIF or WebP, at most 2 MB, recognised by its bytes. Returns its SHA-256, which a question names in `images`; the same picture uploaded twice is kept once.",
        security: SECURED,
        body: S.mediaUploadBody,
        response: { 201: S.mediaUploadResponse, 422: S.errorResponse, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      try {
        const saved = await media.add(staffScope(actor.orgId), Buffer.from(request.body.image, "base64"));
        return reply.code(201).send({ media: saved.media, url: `/api/media/${saved.media}` });
      } catch (error) {
        if (error instanceof NotAnImage) return reply.code(422).send({ error: "not_an_image", message: error.message });
        throw error;
      }
    },
  );

  routes.get(
    "/media/:sha256",
    {
      schema: {
        tags: BANK,
        summary: "A picture in a question, by its SHA-256",
        description:
          "No session: an <img> cannot send one. The hash can only be known by someone who has the picture or the exam that names it. Cached for good, since the bytes behind a hash never change.",
        params: S.mediaParams,
        response: { 404: S.errorResponse },
      },
    },
    async (request, reply) => {
      const found = await media.byHash(request.params.sha256);
      if (found === null) return reply.code(404).send({ error: "not_found" });
      return reply
        .header("content-type", found.mime)
        .header("cache-control", "public, max-age=31536000, immutable")
        .header("x-content-type-options", "nosniff")
        .header("content-security-policy", "default-src 'none'")
        // A Buffer goes out as it is: Fastify serialises only objects.
        .send(found.bytes as never);
    },
  );
}