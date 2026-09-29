import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Learner, PracticeSite } from "@parikshaa/store";
import type { PracticeService } from "./practice.js";
import type { PrepCommunity } from "./prep-community.js";
import * as S from "./schemas.js";
import { PACKS, type StarterPacks } from "./starter-packs.js";
import type { ExamService } from "./service.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface PrepCommunityRouteDeps {
  readonly practice: PracticeService;
  readonly community: PrepCommunity;
  /** Starter content a site takes in with one click. */
  readonly packs?: StarterPacks | undefined;
  readonly service: ExamService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
  readonly bearer: (request: FastifyRequest) => string | null;
}

const PREP = ["Prep"];
const ADMIN = ["Prep (staff)"];
const LEARNER = [{ learnerAuth: [] }];
const OPEN: { learnerAuth: never[] }[] = [];
const STAFF = [{ staffAuth: [] }];
const refusals = {
  400: S.errorResponse,
  401: S.errorResponse,
  402: S.errorResponse,
  403: S.errorResponse,
  404: S.errorResponse,
  409: S.errorResponse,
  422: S.errorResponse,
  429: S.errorResponse,
} as const;

const siteParams = z.object({ site: z.string().min(1).max(40) });
const difficulty = z.enum(["easy", "medium", "hard"]);
const verdict = z.enum(["offer", "reject", "waiting"]);
const round = z.object({
  kind: z.string().trim().min(1).max(40).describe("Online test, DSA, system design, HR…"),
  asked: z.string().max(4000).describe("What was asked. Markdown."),
  problemSlugs: z.array(z.string().max(80)).max(10).default([]).describe("This site's problems the round asked, or close to them."),
});
const experience = z.object({
  id: z.string(),
  company: z.object({ slug: z.string(), name: z.string() }),
  role: z.string(),
  interviewed: z.string().describe("YYYY-MM."),
  verdict,
  rounds: z.array(z.object({ kind: z.string(), asked: z.string(), problemSlugs: z.array(z.string()).readonly() })).readonly(),
  tips: z.string(),
  author: z.string().describe('The learner\'s name, or "Anonymous".'),
  status: z.enum(["pending", "published", "rejected"]),
  votes: z.number(),
  voted: z.boolean(),
  mine: z.boolean(),
  at: z.string(),
});
const companyCard = z.object({ slug: z.string(), name: z.string(), problems: z.number().describe("Problems asked in the last 180 days."), experiences: z.number() });
const companyPage = z.object({
  slug: z.string(),
  name: z.string(),
  about: z.string(),
  window: z.string(),
  counts: z.record(z.string(), z.number()).describe("Problems asked, by window: 30, 60, 180 days and all."),
  problems: z
    .array(z.object({ slug: z.string(), title: z.string(), difficulty, tags: z.array(z.string()).readonly(), times: z.number(), lastAsked: z.string(), solved: z.boolean() }))
    .readonly(),
  locked: z.number().describe("More problems in this window, which come with Plus."),
  topics: z.array(z.object({ tag: z.string(), problems: z.number() })).readonly(),
  difficulty: z.object({ easy: z.number(), medium: z.number(), hard: z.number() }),
  experiences: z.array(experience).readonly(),
});
const itemKind = z.enum(["plus", "digital", "physical"]);
const storeOrder = z.object({
  id: z.string(),
  title: z.string(),
  priceCoins: z.number(),
  status: z.enum(["placed", "fulfilled", "cancelled"]),
  note: z.string(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
});
const storeView = z.object({
  balance: z.number(),
  opensAt: z.string().nullable().describe("A new account may spend coins from this moment; null when it may now."),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        kind: itemKind,
        plusDays: z.number(),
        priceCoins: z.number(),
        soldOut: z.boolean(),
        left: z.number().nullable(),
        bought: z.number(),
        perLearner: z.number(),
      }),
    )
    .readonly(),
  orders: z.array(storeOrder).readonly(),
});
const achievement = z.object({ id: z.string(), have: z.number(), need: z.number(), earned: z.boolean() });
const ratingView = z.object({
  board: z.array(z.object({ rank: z.number(), name: z.string(), rating: z.number(), title: z.string(), contests: z.number(), you: z.boolean() })).readonly(),
  me: z
    .object({
      rating: z.number().nullable().describe("Null until a first rated contest."),
      title: z.string(),
      contests: z.number(),
      history: z.array(z.object({ contest: z.string(), slug: z.string(), rank: z.number(), field: z.number(), before: z.number(), after: z.number(), at: z.string() })).readonly(),
      achievements: z.array(achievement).readonly(),
    })
    .nullable(),
});

const staffItem = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  kind: itemKind,
  plusDays: z.number(),
  priceCoins: z.number(),
  stock: z.number().nullable(),
  perLearner: z.number(),
  active: z.boolean(),
});
const itemBody = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).default(""),
  kind: itemKind,
  plusDays: z.number().int().min(0).max(400).default(0),
  priceCoins: z.number().int().min(1).max(10_000_000),
  stock: z.number().int().min(0).nullable().default(null).describe("Null: no limit."),
  perLearner: z.number().int().min(1).max(100).default(1),
  active: z.boolean().default(true),
});
const staffCompany = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  about: z.string(),
  reports: z
    .array(
      z.object({
        id: z.string(),
        companyId: z.string(),
        problemId: z.string(),
        problemTitle: z.string(),
        reportedOn: z.string(),
        source: z.enum(["staff", "experience"]),
        experienceId: z.string().nullable(),
      }),
    )
    .readonly(),
});
const companyBody = z.object({ name: z.string().trim().min(1).max(120), about: z.string().max(20_000).default(""), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/).optional() });

/**
 * Companies, interview experiences, the coin store and ratings (ROADMAP §16):
 * under `/practice/<site>` for learners, `/practice-admin` for staff.
 */
export function registerPrepCommunityRoutes(routes: Routes, deps: PrepCommunityRouteDeps): void {
  const { practice, community, packs, service, staff, bearer } = deps;

  const siteOf = async (request: FastifyRequest): Promise<PracticeSite> => {
    const site = await practice.site((request.params as { site: string }).site);
    request.orgId = site.orgId;
    return site;
  };
  const maybe = async (request: FastifyRequest) => {
    const site = await siteOf(request);
    return { site, learner: await practice.learner(site, bearer(request) ?? undefined) };
  };
  const signedIn = async (request: FastifyRequest, reply: FastifyReply): Promise<{ site: PracticeSite; learner: Learner } | null> => {
    const { site, learner } = await maybe(request);
    if (learner === null) {
      await reply.code(401).send({ error: "sign_in_required", message: "Sign in to do that" });
      return null;
    }
    return { site, learner };
  };

  // --- companies --------------------------------------------------------------------------

  routes.get(
    "/practice/:site/companies",
    { schema: { tags: PREP, summary: "Companies, and how much is known of what they ask", security: OPEN, params: siteParams, response: { 200: z.object({ companies: z.array(companyCard).readonly() }), ...refusals } } },
    async (request, reply) => reply.send({ companies: await community.companies(await siteOf(request)) }),
  );

  routes.get(
    "/practice/:site/companies/:company",
    {
      schema: {
        tags: PREP,
        summary: "What a company asks: problems by how often, in a window of days",
        description: "Counted from reports: staff's, and each published interview experience's. When the site sells Plus, a learner without it sees the five most asked.",
        security: OPEN,
        params: siteParams.extend({ company: z.string().min(1).max(80) }),
        querystring: z.object({ window: z.enum(["30", "60", "180", "all"]).default("60") }),
        response: { 200: companyPage, ...refusals },
      },
    },
    async (request, reply) => {
      const { site, learner } = await maybe(request);
      const w = request.query.window;
      return reply.send(await community.company(site, request.params.company, learner, w === "all" ? "all" : (Number(w) as 30 | 60 | 180)));
    },
  );

  // --- experiences --------------------------------------------------------------------------

  routes.get(
    "/practice/:site/experiences",
    {
      schema: {
        tags: PREP,
        summary: "Interview experiences: published ones, and my own",
        security: OPEN,
        params: siteParams,
        querystring: z.object({ company: z.string().max(80).optional() }),
        response: { 200: z.object({ experiences: z.array(experience).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const { site, learner } = await maybe(request);
      return reply.send({ experiences: await community.experiences(site, learner, request.query.company) });
    },
  );

  routes.post(
    "/practice/:site/experiences",
    {
      schema: {
        tags: PREP,
        summary: "Write up an interview",
        description: "Waits for staff to read it. Once published, it pays 100 coins, and the problems its rounds name count on the company's page.",
        security: LEARNER,
        params: siteParams,
        body: z.object({
          company: z.string().min(1).max(80).describe("The company's slug."),
          role: z.string().trim().min(1).max(120),
          interviewed: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
          verdict,
          rounds: z.array(round).min(1).max(10),
          tips: z.string().max(10_000).default(""),
          anonymous: z.boolean().default(false),
        }),
        response: { 201: experience, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.code(201).send(await community.submitExperience(who.site, who.learner, request.body));
    },
  );

  for (const [method, on] of [
    ["put", true],
    ["delete", false],
  ] as const) {
    routes[method](
      "/practice/:site/experiences/:id/vote",
      {
        schema: {
          tags: PREP,
          summary: on ? "Mark an experience helpful" : "Take back my vote",
          security: LEARNER,
          params: siteParams.extend({ id: z.string().min(1).max(80) }),
          response: { 204: z.null(), ...refusals },
        },
      },
      async (request, reply) => {
        const who = await signedIn(request, reply);
        if (who === null) return;
        await community.vote(who.site, who.learner, request.params.id, on);
        return reply.code(204).send(null);
      },
    );
  }

  // --- the store ------------------------------------------------------------------------------

  routes.get(
    "/practice/:site/store",
    { schema: { tags: PREP, summary: "What coins buy here, my balance and my orders", security: OPEN, params: siteParams, response: { 200: storeView, ...refusals } } },
    async (request, reply) => {
      const { site, learner } = await maybe(request);
      return reply.send(await community.store(site, learner));
    },
  );

  routes.post(
    "/practice/:site/store/:item/redeem",
    {
      schema: {
        tags: PREP,
        summary: "Spend coins on an item",
        description: "All at once or not at all: the coins, the order and the stock. A Plus item gives its days of Plus at once; others are sent by staff. Accounts spend from 14 days old.",
        security: LEARNER,
        params: siteParams.extend({ item: z.string().min(1).max(80) }),
        body: z.object({ address: z.string().max(1000).default("").describe("For something posted.") }),
        response: { 201: z.object({ order: storeOrder, balance: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.code(201).send(await community.redeem(who.site, who.learner, request.params.item, request.body.address));
    },
  );

  // --- ratings ---------------------------------------------------------------------------------

  routes.get(
    "/practice/:site/rating",
    {
      schema: {
        tags: PREP,
        summary: "Contest ratings, and mine: history, title, achievements",
        description: "Elo from contests, from 1500. A contest is rated once, when it has ended.",
        security: OPEN,
        params: siteParams,
        response: { 200: ratingView, ...refusals },
      },
    },
    async (request, reply) => {
      const { site, learner } = await maybe(request);
      return reply.send(await community.rating(site, learner));
    },
  );

  // --- staff ------------------------------------------------------------------------------------

  routes.get("/practice-admin/companies", { schema: { tags: ADMIN, summary: "Companies and their reports", security: STAFF, response: { 200: z.object({ companies: z.array(staffCompany).readonly() }), ...refusals } } }, async (request, reply) => {
    const actor = await staff(request, reply, "exam:read");
    if (actor === null) return;
    return reply.send({ companies: await community.staffCompanies(actor.orgId) });
  });

  routes.post(
    "/practice-admin/companies",
    { schema: { tags: ADMIN, summary: "Add a company", security: STAFF, body: companyBody, response: { 201: staffCompany.omit({ reports: true }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const saved = await community.saveCompany(actor.orgId, null, request.body);
      await service.recordAudit(actor, "prep.company_created", saved.id, { name: saved.name });
      return reply.code(201).send(saved);
    },
  );

  routes.put(
    "/practice-admin/companies/:id",
    { schema: { tags: ADMIN, summary: "Change a company", security: STAFF, params: z.object({ id: z.string().min(1) }), body: companyBody, response: { 200: staffCompany.omit({ reports: true }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.send(await community.saveCompany(actor.orgId, request.params.id, request.body));
    },
  );

  routes.post(
    "/practice-admin/companies/:id/reports",
    {
      schema: {
        tags: ADMIN,
        summary: "Report problems a company asked, on a day",
        security: STAFF,
        params: z.object({ id: z.string().min(1) }),
        body: z.object({ problemIds: z.array(z.string().min(1)).min(1).max(200), reportedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
        response: { 201: z.object({ added: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      return reply.code(201).send({ added: await community.addReports(actor.orgId, request.params.id, request.body) });
    },
  );

  routes.delete(
    "/practice-admin/company-reports/:id",
    { schema: { tags: ADMIN, summary: "Take back a report", security: STAFF, params: z.object({ id: z.string().min(1) }), response: { 204: z.null(), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      await community.deleteReport(actor.orgId, request.params.id);
      return reply.code(204).send(null);
    },
  );

  routes.get(
    "/practice-admin/experiences",
    {
      schema: {
        tags: ADMIN,
        summary: "Interview experiences, to read before they are published",
        security: STAFF,
        querystring: z.object({ status: z.enum(["pending", "published", "rejected"]).optional() }),
        response: { 200: z.object({ experiences: z.array(experience.extend({ learnerId: z.string() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:read");
      if (actor === null) return;
      return reply.send({ experiences: await community.staffExperiences(actor.orgId, request.query.status) });
    },
  );

  routes.post(
    "/practice-admin/experiences/:id/decision",
    {
      schema: {
        tags: ADMIN,
        summary: "Publish or reject an experience",
        description: "Publishing pays its author 100 coins and reports the problems its rounds name against the company.",
        security: STAFF,
        params: z.object({ id: z.string().min(1) }),
        body: z.object({ status: z.enum(["published", "rejected"]) }),
        response: { 200: z.object({ id: z.string(), status: z.enum(["pending", "published", "rejected"]) }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "exam:write");
      if (actor === null) return;
      const decided = await community.decideExperience(actor.orgId, request.params.id, request.body.status, actor.id);
      await service.recordAudit(actor, `prep.experience_${request.body.status}`, decided.id, {});
      return reply.send({ id: decided.id, status: decided.status });
    },
  );

  if (packs !== undefined) {
    const pack = z.object({
      name: z.enum(PACKS),
      title: z.string(),
      description: z.string(),
      lessons: z.number(),
      problems: z.number(),
      imported: z.boolean(),
    });
    routes.get(
      "/practice-admin/starter-packs",
      { schema: { tags: ADMIN, summary: "Starter content this site can take in", security: STAFF, response: { 200: z.object({ packs: z.array(pack).readonly() }), ...refusals } } },
      async (request, reply) => {
        const actor = await staff(request, reply, "exam:read");
        if (actor === null) return;
        return reply.send({ packs: await packs.list(actor.orgId) });
      },
    );
    routes.post(
      "/practice-admin/starter-packs/:name",
      {
        schema: {
          tags: ADMIN,
          summary: "Take in a starter pack: its lessons, problems and track",
          description: "Once per site. Everything it adds is the site's own afterwards.",
          security: STAFF,
          params: z.object({ name: z.enum(PACKS) }),
          response: { 201: z.object({ track: z.string(), lessons: z.number(), problems: z.number() }), ...refusals },
        },
      },
      async (request, reply) => {
        const actor = await staff(request, reply, "exam:write");
        if (actor === null) return;
        const added = await packs.import(actor.orgId, request.params.name);
        await service.recordAudit(actor, "prep.starter_pack_imported", request.params.name, { ...added });
        return reply.code(201).send(added);
      },
    );
  }

  routes.get("/practice-admin/store/items", { schema: { tags: ADMIN, summary: "The coin store's items", security: STAFF, response: { 200: z.object({ items: z.array(staffItem).readonly() }), ...refusals } } }, async (request, reply) => {
    const actor = await staff(request, reply, "exam:read");
    if (actor === null) return;
    return reply.send({ items: await community.staffItems(actor.orgId) });
  });

  routes.post(
    "/practice-admin/store/items",
    { schema: { tags: ADMIN, summary: "Add an item to the coin store", security: STAFF, body: itemBody, response: { 201: staffItem, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const saved = await community.saveItem(actor.orgId, null, request.body);
      await service.recordAudit(actor, "prep.store_item_created", saved.id, { priceCoins: saved.priceCoins });
      return reply.code(201).send(saved);
    },
  );

  routes.put(
    "/practice-admin/store/items/:id",
    { schema: { tags: ADMIN, summary: "Change an item", security: STAFF, params: z.object({ id: z.string().min(1) }), body: itemBody, response: { 200: staffItem, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const saved = await community.saveItem(actor.orgId, request.params.id, request.body);
      await service.recordAudit(actor, "prep.store_item_changed", saved.id, { priceCoins: saved.priceCoins, active: saved.active });
      return reply.send(saved);
    },
  );

  routes.get(
    "/practice-admin/store/orders",
    {
      schema: {
        tags: ADMIN,
        summary: "Orders from the coin store",
        security: STAFF,
        response: { 200: z.object({ orders: z.array(storeOrder.extend({ learnerId: z.string(), learnerName: z.string(), learnerEmail: z.string(), address: z.string(), itemId: z.string() })).readonly() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send({ orders: await community.storeOrders(actor.orgId) });
    },
  );

  routes.post(
    "/practice-admin/store/orders/:id/close",
    {
      schema: {
        tags: ADMIN,
        summary: "Mark an order sent, or cancel it",
        description: "Cancelling gives the coins and the stock back.",
        security: STAFF,
        params: z.object({ id: z.string().min(1) }),
        body: z.object({ status: z.enum(["fulfilled", "cancelled"]), note: z.string().max(1000).default("") }),
        response: { 200: storeOrder, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const closed = await community.closeOrder(actor.orgId, request.params.id, request.body.status, request.body.note);
      await service.recordAudit(actor, `prep.store_order_${request.body.status}`, closed.id, {});
      const { id, title, priceCoins, status, note, createdAt, closedAt } = closed;
      return reply.send({ id, title, priceCoins, status, note, createdAt, closedAt });
    },
  );
}
