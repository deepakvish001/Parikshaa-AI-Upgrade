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
import { MAX_DAYS, ShortlistGone, type ShortlistService } from "./shortlists.js";
import * as S from "./schemas.js";
import type { Actor, LoginThrottle, Permission } from "./staff-auth.js";

/** Shortlists for hiring managers: made by staff, opened and decided on through a link. */

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface ShortlistRouteDeps {
  readonly shortlists: ShortlistService;
  readonly throttle: LoginThrottle;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const SECURED = [{ staffAuth: [] }];
const refusals = { 401: S.errorResponse, 403: S.errorResponse, 404: S.errorResponse, 409: S.errorResponse, 410: S.errorResponse, 429: S.errorResponse } as const;
const decision = z.enum(["shortlist", "hold", "reject"]);
const summary = z.object({
  id: z.string(),
  title: z.string(),
  candidates: z.number(),
  createdBy: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  revoked: z.boolean(),
  decided: z.object({ shortlist: z.number(), hold: z.number(), reject: z.number() }),
  link: z.string(),
});

export function registerShortlistRoutes(routes: Routes, deps: ShortlistRouteDeps): void {
  const { shortlists, throttle, staff } = deps;

  const guard = async <T>(request: FastifyRequest, reply: FastifyReply, run: () => Promise<T>) => {
    if (throttle.blocked(request.ip, "shortlist")) return reply.code(429).send({ error: "too_many_attempts", message: "Try again in a few minutes" });
    try {
      return await run();
    } catch (error) {
      if (error instanceof ShortlistGone) {
        if (error.reason === "unknown") throttle.failed(request.ip, "shortlist");
        return reply.code(error.reason === "unknown" ? 404 : 410).send({ error: `shortlist_${error.reason}`, message: error.message });
      }
      throw error;
    }
  };

  routes.post(
    "/exams/:examId/shortlists",
    {
      schema: {
        tags: ["Results"],
        summary: "Make a shortlist link for a hiring manager",
        description: `The roll numbers given, or (without \`refs\`) everyone who qualified. The link opens without an account for \`days\` days (at most ${MAX_DAYS}) and shows marks and sections only. Audited.`,
        security: SECURED,
        params: S.examParams,
        body: z.object({ title: z.string().max(200).default(""), refs: z.array(z.string().min(1)).max(5000).nullable().default(null), days: z.number().int().min(1).max(MAX_DAYS).default(7) }),
        response: { 201: summary, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.code(201).send(await shortlists.create(actor, request.params.examId, request.body));
    },
  );

  routes.get(
    "/exams/:examId/shortlists",
    {
      schema: {
        tags: ["Results"],
        summary: "An exam's shortlists and the manager's decisions",
        security: SECURED,
        params: S.examParams,
        response: {
          200: z.object({
            shortlists: z
              .array(summary.extend({ decisions: z.array(z.object({ ref: z.string(), decision, comment: z.string(), by: z.string(), at: z.string() })).readonly() }))
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      return reply.send({ shortlists: await shortlists.forExam(actor, request.params.examId) });
    },
  );

  routes.post(
    "/shortlists/:id/withdraw",
    { schema: { tags: ["Results"], summary: "Withdraw a shortlist link", security: SECURED, params: z.object({ id: z.string() }), response: { 200: S.okResponse, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "attempt:review");
      if (actor === null) return;
      await shortlists.revoke(actor, request.params.id);
      return reply.send({ ok: true });
    },
  );

  routes.get(
    "/shortlists/view/:code",
    {
      schema: {
        tags: ["Shortlist"],
        summary: "A shortlist, as its link shows it",
        description: "No account: the code in the link is the proof. Marks and sections only. 410 once expired or withdrawn.",
        params: z.object({ code: z.string().min(1).max(300) }),
        response: {
          200: z.object({
            institution: z.string(),
            examTitle: z.string(),
            title: z.string(),
            expiresAt: z.string(),
            candidates: z
              .array(
                z.object({
                  ref: z.string(),
                  name: z.string(),
                  percent: z.number().nullable(),
                  outcome: z.enum(["qualified", "failed"]).nullable(),
                  sections: z.array(z.object({ title: z.string(), percent: z.number().nullable() })).readonly(),
                  decision: decision.nullable(),
                  comment: z.string(),
                  decidedBy: z.string().nullable(),
                }),
              )
              .readonly(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => guard(request, reply, async () => reply.send(await shortlists.view(request.params.code))),
  );

  routes.post(
    "/shortlists/view/:code/decisions",
    {
      schema: {
        tags: ["Shortlist"],
        summary: "A hiring manager's decision on a candidate",
        description: "Shortlist, hold or reject, with an optional comment and the decider's name. The latest decision stands.",
        params: z.object({ code: z.string().min(1).max(300) }),
        body: z.object({ ref: z.string().min(1), decision, comment: z.string().max(1000).default(""), by: z.string().min(1).max(100) }),
        response: { 200: S.okResponse, ...refusals },
      },
    },
    async (request, reply) =>
      guard(request, reply, async () => {
        const { ref, decision: d, comment, by } = request.body;
        await shortlists.decide(request.params.code, ref, d, comment, by);
        return reply.send({ ok: true });
      }),
  );
}
