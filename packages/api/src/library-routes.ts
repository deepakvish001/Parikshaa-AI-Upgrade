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
import type { LibraryDraft, LibraryFilter } from "@parikshaa/store";
import { LibraryRefused, type LibraryService } from "./library.js";
import { OperatorRefused } from "./operator.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

/**
 * The Parikshaa Library (docs/F1-GO-LIVE-PLAN.md §4, G2): browse it, take
 * questions into the bank (chosen, or a few at random), bring a copy up to
 * date; and, for Parikshaa's operators, file and retire questions.
 */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

const LIBRARY = ["Library"];
const SECURED = [{ staffAuth: [] }];
/** A refused question says what is wrong with it, as an exam's would. */
const invalid = z.object({ error: z.string(), message: z.string().optional(), problems: z.array(z.object({ path: z.string(), message: z.string() })).readonly().optional() });
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 422: invalid } as const;

const section = z.enum(["aptitude", "cs", "programming", "dsa", "sql", "frontend"]);
const tier = z.enum(["open", "hire"]);
const difficulty = z.enum(["easy", "medium", "hard"]);
const kind = z.enum(["mcq", "short", "numeric", "code"]);

const entry = z.object({
  id: z.string(),
  version: z.number().int(),
  section,
  topic: z.string(),
  difficulty,
  tags: z.array(z.string()).readonly(),
  question: S.questionSchema,
  explanation: z.string().describe("Markdown: why the answer is right, or the approaches."),
  tier: tier.describe("open: the same question is on practice sites, so learners may have seen it. hire: never shown to learners."),
  source: z.string(),
  exposure: z.number().int().nullable().describe("How many organisations have taken it; for Parikshaa's operators only."),
  updatedAt: z.string(),
  retired: z.boolean(),
  adopted: z.object({ bankQuestionId: z.string(), version: z.number().int() }).nullable().describe("This organisation's copy, if it took the question."),
  newerVersion: z.boolean().describe("The library has a newer version than the copy in the bank."),
});

const facets = z.object({
  total: z.number().int(),
  sections: z
    .array(z.object({ section, count: z.number().int(), topics: z.array(z.object({ topic: z.string(), count: z.number().int() })).readonly() }))
    .readonly(),
});

const filterQuery = z.object({
  section: section.optional(),
  topic: z.string().optional(),
  difficulty: difficulty.optional(),
  kind: kind.optional(),
  tier: tier.optional(),
  q: z.string().max(200).optional().describe("Matched against the question, its topic and its tags."),
  notTaken: z.enum(["true", "false"]).optional().describe("Only what this organisation has not taken yet."),
});

const taken = z.object({ added: z.number().int(), already: z.number().int(), bankQuestionIds: z.array(z.string()).readonly() });

const toFilter = (q: z.infer<typeof filterQuery>): LibraryFilter => ({
  ...(q.section === undefined ? {} : { section: q.section }),
  ...(q.topic === undefined || q.topic === "" ? {} : { topic: q.topic }),
  ...(q.difficulty === undefined ? {} : { difficulty: q.difficulty }),
  ...(q.kind === undefined ? {} : { kind: q.kind }),
  ...(q.tier === undefined ? {} : { tier: q.tier }),
  ...(q.q === undefined ? {} : { search: q.q }),
  ...(q.notTaken === "true" ? { notAdopted: true } : {}),
});

export function registerLibraryRoutes(
  routes: Routes,
  deps: {
    readonly library: LibraryService;
    readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  },
): void {
  const { library, staff } = deps;

  async function as<T>(request: FastifyRequest, reply: FastifyReply, permission: Permission | null, fn: (actor: Actor) => Promise<T>): Promise<T | undefined> {
    const actor = await staff(request, reply, permission);
    if (actor === null) return undefined;
    try {
      return await fn(actor);
    } catch (error) {
      if (error instanceof OperatorRefused) {
        const status = { not_found: 404, operator_needs_2fa: 403, email_taken: 409, invalid: 422 }[error.code];
        await reply.code(status).send(error.code === "not_found" ? { error: "not_found" } : { error: error.code, message: error.message });
        return undefined;
      }
      if (error instanceof LibraryRefused) {
        await reply
          .code(error.code === "not_found" ? 404 : 422)
          .send({ error: error.code, message: error.message, ...(error.problems.length > 0 ? { problems: error.problems } : {}) });
        return undefined;
      }
      throw error;
    }
  }

  routes.get(
    "/library",
    {
      schema: {
        tags: LIBRARY,
        summary: "Browse the Parikshaa Library",
        description: "Parikshaa's own questions, with answers, for staff who may see answer keys. Fifty at a time; `offset` for more.",
        security: SECURED,
        querystring: filterQuery.extend({ offset: z.coerce.number().int().min(0).default(0), limit: z.coerce.number().int().min(1).max(200).default(50) }),
        response: { 200: z.object({ items: z.array(entry).readonly(), total: z.number().int(), facets }), ...refusals },
      },
    },
    async (request, reply) => {
      const { offset, limit, ...rest } = request.query;
      const found = await as(request, reply, "exam:read_key", (actor) => library.browse(actor, toFilter(rest), { offset, limit }));
      if (found !== undefined) return reply.send(found);
    },
  );

  routes.get(
    "/library/:libraryId",
    { schema: { tags: LIBRARY, summary: "One library question", security: SECURED, params: z.object({ libraryId: z.string().min(1) }), response: { 200: entry, ...refusals } } },
    async (request, reply) => {
      const found = await as(request, reply, "exam:read_key", (actor) => library.item(actor, request.params.libraryId));
      if (found !== undefined) return reply.send(found);
    },
  );

  routes.post(
    "/library/take",
    {
      schema: {
        tags: LIBRARY,
        summary: "Copy library questions into the bank",
        description: "Each becomes a bank question of this organisation's, tagged `library:<id>`, to change as it likes. One taken before is not copied again.",
        security: SECURED,
        body: z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }),
        response: { 200: taken, ...refusals },
      },
    },
    async (request, reply) => {
      const done = await as(request, reply, "exam:write", (actor) => library.take(actor, request.body.ids));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.post(
    "/library/pick",
    {
      schema: {
        tags: LIBRARY,
        summary: "Copy a few library questions into the bank, chosen at random",
        description: "From those matching the filter that this organisation has not taken yet; fewer if there are not enough.",
        security: SECURED,
        body: filterQuery.omit({ notTaken: true }).extend({ count: z.number().int().min(1).max(50) }),
        response: { 200: taken, ...refusals },
      },
    },
    async (request, reply) => {
      const { count, ...rest } = request.body;
      const done = await as(request, reply, "exam:write", (actor) => library.pick(actor, toFilter(rest), count));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.post(
    "/library/:libraryId/refresh",
    {
      schema: {
        tags: LIBRARY,
        summary: "Bring the bank's copy up to the library's current version",
        description: "Replaces the copy, including any change made to it here. Exams already built keep their own copy.",
        security: SECURED,
        params: z.object({ libraryId: z.string().min(1) }),
        response: { 200: z.object({ bankQuestionId: z.string(), version: z.number().int() }), ...refusals },
      },
    },
    async (request, reply) => {
      const done = await as(request, reply, "exam:write", (actor) => library.refresh(actor, request.params.libraryId));
      if (done !== undefined) return reply.send(done);
    },
  );

  // --- Parikshaa's operators ------------------------------------------------------------

  routes.post(
    "/operator/library/seed",
    {
      schema: {
        tags: LIBRARY,
        summary: "File Parikshaa's built-in questions in the library",
        description: "For operators. New questions are added, changed ones get a new version, the rest are left alone. The API also does this when it starts.",
        security: SECURED,
        response: { 200: z.object({ added: z.number().int(), updated: z.number().int(), unchanged: z.number().int() }), ...refusals },
      },
    },
    async (request, reply) => {
      const done = await as(request, reply, null, (actor) => library.seed(actor));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.put(
    "/operator/library/:libraryId",
    {
      schema: {
        tags: LIBRARY,
        summary: "File or change one library question",
        description: "For operators. The question is checked as an exam would check it; a change gives it a new version, which organisations that took it may bring into their copy.",
        security: SECURED,
        params: z.object({ libraryId: z.string().min(1) }),
        body: z.object({
          section,
          topic: z.string().max(120),
          difficulty,
          tags: z.array(z.string().max(60)).max(20).default([]),
          question: S.newQuestionSchema,
          explanation: z.string().max(50_000).default(""),
          tier: tier.default("hire"),
        }),
        response: { 200: entry, ...refusals },
      },
    },
    async (request, reply) => {
      const draft = { ...request.body, id: request.params.libraryId, source: "parikshaa:content-team" } as unknown as LibraryDraft;
      const done = await as(request, reply, null, (actor) => library.file(actor, draft));
      if (done !== undefined) return reply.send(done);
    },
  );

  routes.post(
    "/operator/library/:libraryId/retire",
    {
      schema: { tags: LIBRARY, summary: "Retire a library question", description: "For operators. No one can take it any more; copies already taken stay.", security: SECURED, params: z.object({ libraryId: z.string().min(1) }), response: { 200: S.okResponse, ...refusals } },
    },
    async (request, reply) => {
      const done = await as(request, reply, null, async (actor) => {
        await library.retire(actor, request.params.libraryId);
        return true;
      });
      if (done !== undefined) return reply.send({ ok: true });
    },
  );
}
