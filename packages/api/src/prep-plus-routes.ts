import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest, RawReplyDefaultExpression, RawRequestDefaultExpression, RawServerDefault } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { Learner, PracticeSite } from "@parikshaa/store";
import { PracticeError, type PracticeService } from "./practice.js";
import type { PrepPlus } from "./prep-plus.js";
import type { Sahayak } from "./sahayak.js";
import * as S from "./schemas.js";
import type { ExamService } from "./service.js";
import { RateLimiter } from "./rate-limit.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<RawServerDefault, RawRequestDefaultExpression, RawReplyDefaultExpression, FastifyBaseLogger, ZodTypeProvider>;

export interface PrepPlusRouteDeps {
  readonly practice: PracticeService;
  readonly plus: PrepPlus;
  readonly tutor: Sahayak;
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
  503: S.errorResponse,
} as const;

/** Questions to the tutor, per learner: enough for an evening's study, not for a script. */
const TUTOR_RATE = { perSecond: 30 / 3600, burst: 10 };

const siteParams = z.object({ site: z.string().min(1).max(40) });
const problemParams = siteParams.extend({ problem: z.string().min(1).max(80) });
const replyIn = z.enum(["en", "hi"]).default("en").describe("The language the tutor answers in.");

const product = z.object({ id: z.string(), title: z.string(), kind: z.enum(["plus", "credits", "company"]).describe("Plus; credits for the tutor; or a Company Pass, which opens every company's full list."), days: z.number(), credits: z.number(), pricePaise: z.number().describe("GST included.") });
const learnerProduct = product.extend({ taxPaise: z.number().describe("The GST within the price, at 18%.") });
const overview = z.object({
  enabled: z.boolean().describe("The site sells Plus. When false, nothing is locked."),
  active: z.boolean(),
  until: z.string().nullable(),
  freeModules: z.number(),
  monthlyCredits: z.number(),
  tutor: z.boolean(),
  checkout: z.boolean().describe("Payments are set up on this server."),
  invoices: z.boolean().describe("Paid orders get a GST tax invoice: the server knows its supplier."),
  products: z.array(learnerProduct).readonly(),
});
const tutorAnswer = z.object({ id: z.string(), mode: z.enum(["hint", "review", "doubt"]), hintLevel: z.number().nullable(), answer: z.string().describe("Markdown."), credits: z.number(), createdAt: z.string() });
const tutorHistory = z.object({
  entries: z.array(tutorAnswer.omit({}).extend({ question: z.string() })).readonly(),
  nextHint: z.object({ level: z.number(), credits: z.number(), available: z.boolean().describe("The last rung opens after three wrong submissions.") }).nullable(),
  failures: z.number(),
  costs: z.object({ hint1: z.number(), hint: z.number(), review: z.number(), doubt: z.number() }),
});
const order = z.object({
  id: z.string(),
  title: z.string(),
  days: z.number(),
  credits: z.number(),
  listPaise: z.number().describe("The plan's price before the coupon."),
  coupon: z.string().nullable(),
  discountPaise: z.number(),
  amountPaise: z.number().describe("What was charged, GST included."),
  taxPaise: z.number().describe("The GST within the amount."),
  status: z.enum(["created", "paid"]),
  createdAt: z.string(),
  paidAt: z.string().nullable(),
  invoice: z.string().nullable().describe("The tax invoice's number, once paid."),
});
const quote = z.object({ productId: z.string(), title: z.string(), listPaise: z.number(), discountPaise: z.number(), pricePaise: z.number(), taxPaise: z.number(), coupon: z.string().nullable() });
const couponCode = z.string().max(40).optional().describe("A coupon code, any case.");
const invoiceView = z.object({ number: z.string(), issuedAt: z.string(), document: z.record(z.string(), z.unknown()).describe("Everything printed on the tax invoice, fixed when it was issued.") });
const coupon = z.object({
  code: z.string(),
  kind: z.enum(["percent", "flat"]),
  value: z.number().describe("A percentage, or paise off."),
  productId: z.string().nullable().describe("The plan it is for; null for any."),
  maxUses: z.number().nullable(),
  endsAt: z.string().nullable(),
  affiliate: z.string().describe("Who hands it out. A `?ref=CODE` link fills the code in at checkout."),
  active: z.boolean(),
  createdAt: z.string(),
});
const couponReport = coupon.extend({ uses: z.number(), revenuePaise: z.number(), discountPaise: z.number() });
const couponBody = z.object({
  kind: z.enum(["percent", "flat"]),
  value: z.number().int(),
  productId: z.string().nullable().optional(),
  maxUses: z.number().int().nullable().optional(),
  endsAt: z.string().nullable().optional(),
  affiliate: z.string().max(120).optional(),
  active: z.boolean().optional(),
});
const settings = z.object({ plusEnabled: z.boolean(), freeModules: z.number().int(), monthlyCredits: z.number().int(), tutorEnabled: z.boolean() });
const staffProduct = product.extend({ active: z.boolean(), position: z.number() });
const productBody = z.object({
  title: z.string().min(1).max(120),
  kind: z.enum(["plus", "credits", "company"]),
  days: z.number().int().default(0),
  credits: z.number().int().default(0),
  pricePaise: z.number().int(),
  active: z.boolean().default(true),
  position: z.number().int().optional(),
});

/**
 * Plus and the tutor (ROADMAP §16): what a learner buys and asks, under
 * `/practice/<site>`, and what staff set, under `/practice-admin`.
 */
export function registerPrepPlusRoutes(routes: Routes, deps: PrepPlusRouteDeps): void {
  const { practice, plus, tutor, service, staff, bearer } = deps;
  const asking = new RateLimiter(TUTOR_RATE);

  const siteOf = async (request: FastifyRequest): Promise<PracticeSite> => {
    const site = await practice.site((request.params as { site: string }).site);
    request.orgId = site.orgId;
    return site;
  };
  const signedIn = async (request: FastifyRequest, reply: FastifyReply): Promise<{ site: PracticeSite; learner: Learner } | null> => {
    const site = await siteOf(request);
    const learner = await practice.learner(site, bearer(request) ?? undefined);
    if (learner === null) {
      await reply.code(401).send({ error: "sign_in_required", message: "Sign in to do that" });
      return null;
    }
    return { site, learner };
  };
  const limit = (learner: Learner) => {
    if (!asking.take(learner.id).ok) throw new PracticeError("too_many_runs", "That is a lot of questions for one sitting. Try again in a little while.");
  };

  // --- Plus -----------------------------------------------------------------------------

  routes.get(
    "/practice/:site/plus",
    { schema: { tags: PREP, summary: "What this site sells, and whether I hold Plus", security: OPEN, params: siteParams, response: { 200: overview, ...refusals } } },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send(await plus.overview(site, await practice.learner(site, bearer(request) ?? undefined)));
    },
  );

  routes.post(
    "/practice/:site/plus/checkout",
    {
      schema: {
        tags: PREP,
        summary: "Start buying a plan: a Razorpay order at its price",
        description: "Open Razorpay Checkout with the key and order returned, then confirm with what Checkout hands back.",
        security: LEARNER,
        params: siteParams,
        body: z.object({
          productId: z.string().min(1).max(80),
          coupon: couponCode,
          name: z.string().max(160).optional().describe("The name for the invoice; the learner's own when absent."),
          stateCode: z.string().max(2).optional().describe("The GST state code of the learner's address: it decides CGST and SGST against IGST."),
          gstin: z.string().max(15).optional().describe("A GSTIN, to claim the tax: printed on the invoice, and its state used."),
        }),
        response: {
          201: z.object({ keyId: z.string(), orderId: z.string(), amountPaise: z.number(), title: z.string(), learner: z.object({ name: z.string(), email: z.string() }) }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const { productId, ...extra } = request.body;
      return reply.code(201).send(await plus.checkout(who.site, who.learner, productId, extra));
    },
  );

  routes.post(
    "/practice/:site/plus/quote",
    {
      schema: {
        tags: PREP,
        summary: "A plan's price with a coupon, before buying",
        description: "Checks the coupon as checkout will: active, not past its date, for this plan, with uses left, and not used by this learner before.",
        security: OPEN,
        params: siteParams,
        body: z.object({ productId: z.string().min(1).max(80), coupon: couponCode }),
        response: { 200: quote, ...refusals },
      },
    },
    async (request, reply) => {
      const site = await siteOf(request);
      return reply.send(await plus.quote(site, await practice.learner(site, bearer(request) ?? undefined), request.body.productId, request.body.coupon));
    },
  );

  routes.get(
    "/practice/:site/invoices/:number",
    {
      schema: {
        tags: PREP,
        summary: "One of my tax invoices",
        security: LEARNER,
        params: siteParams.extend({ number: z.string().min(1).max(20) }),
        response: { 200: invoiceView, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await plus.invoice(who.site, who.learner, request.params.number));
    },
  );

  routes.post(
    "/practice/:site/plus/confirm",
    {
      schema: {
        tags: PREP,
        summary: "Confirm a payment Checkout reports",
        description: "Given only if `signature` is Razorpay's HMAC-SHA256 of `orderId|paymentId`. Confirming twice, or the webhook arriving too, gives nothing more.",
        security: LEARNER,
        params: siteParams,
        body: z.object({ orderId: z.string().min(1).max(80), paymentId: z.string().min(1).max(80), signature: z.string().min(1).max(200) }),
        response: { 200: z.object({ order, plus: z.object({ enabled: z.boolean(), active: z.boolean(), until: z.string().nullable() }) }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      const { order: paid, plus: status } = await plus.confirm(who.site, who.learner, request.body);
      const mine = (await plus.orders(who.site, who.learner)).find((o) => o.id === paid.id)!;
      return reply.send({ order: mine, plus: status });
    },
  );

  routes.get(
    "/practice/:site/orders",
    { schema: { tags: PREP, summary: "What I have bought", security: LEARNER, params: siteParams, response: { 200: z.object({ orders: z.array(order).readonly() }), ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send({ orders: await plus.orders(who.site, who.learner) });
    },
  );

  routes.get(
    "/practice/:site/credits",
    {
      schema: {
        tags: PREP,
        summary: "My tutor credits",
        description: "The month's free credits are given the first time the balance is read in a month.",
        security: LEARNER,
        params: siteParams,
        response: {
          200: z.object({ balance: z.number(), history: z.array(z.object({ delta: z.number(), reason: z.enum(["monthly", "purchase", "grant", "spend", "refund"]), at: z.string() })).readonly() }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await plus.credits(who.site, who.learner));
    },
  );

  // --- the tutor -------------------------------------------------------------------------------

  routes.get(
    "/practice/:site/problems/:problem/tutor",
    { schema: { tags: PREP, summary: "What the tutor has said to me about a problem, and the next hint", security: LEARNER, params: problemParams, response: { 200: tutorHistory, ...refusals } } },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send(await tutor.history(who.site, who.learner, request.params.problem));
    },
  );

  routes.post(
    "/practice/:site/problems/:problem/tutor/hint",
    {
      schema: {
        tags: PREP,
        summary: "The next rung of the hint ladder",
        description:
          "Rung 1: an observation. 2: the approach. 3: pseudo-code. 4: the worked solution, only after three wrong submissions. Costs credits, given back if the tutor fails. Closed while a contest that includes the problem runs.",
        security: LEARNER,
        params: problemParams,
        body: z.object({ code: z.string().max(20_000).optional(), language: z.string().max(20).optional(), replyIn }),
        response: { 200: tutorAnswer, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      limit(who.learner);
      return reply.send(await tutor.hint(who.site, who.learner, request.params.problem, request.body));
    },
  );

  routes.post(
    "/practice/:site/problems/:problem/tutor/review",
    {
      schema: {
        tags: PREP,
        summary: "A review of my latest submission",
        description: "Logic, complexity, code quality and edge cases. Which hidden test failed is never said.",
        security: LEARNER,
        params: problemParams,
        body: z.object({ replyIn }),
        response: { 200: tutorAnswer, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      limit(who.learner);
      return reply.send(await tutor.review(who.site, who.learner, request.params.problem, request.body.replyIn));
    },
  );

  routes.post(
    "/practice/:site/tutor/doubt",
    {
      schema: {
        tags: PREP,
        summary: "Ask the tutor a doubt about a problem or a lesson",
        security: LEARNER,
        params: siteParams,
        body: z.object({ problem: z.string().max(80).optional(), lesson: z.string().max(80).optional(), question: z.string().max(2000), replyIn }),
        response: { 200: tutorAnswer, ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      limit(who.learner);
      const { problem, lesson, question, replyIn: language } = request.body;
      return reply.send(await tutor.doubt(who.site, who.learner, { problem, lesson }, question, language));
    },
  );

  routes.delete(
    "/practice/:site/tutor",
    {
      schema: {
        tags: PREP,
        summary: "Delete what the tutor said to me: everything, or about one problem",
        security: LEARNER,
        params: siteParams,
        querystring: z.object({ problem: z.string().max(80).optional() }),
        response: { 200: z.object({ deleted: z.number() }), ...refusals },
      },
    },
    async (request, reply) => {
      const who = await signedIn(request, reply);
      if (who === null) return;
      return reply.send({ deleted: await tutor.forget(who.site, who.learner, request.query.problem ?? null) });
    },
  );

  // --- staff ------------------------------------------------------------------------------------

  routes.get("/practice-admin/plus", { schema: { tags: ADMIN, summary: "Plus and the tutor: settings and plans", security: STAFF, response: { 200: z.object({ settings, products: z.array(staffProduct).readonly() }), ...refusals } } }, async (request, reply) => {
    const actor = await staff(request, reply, "exam:read");
    if (actor === null) return;
    const [s, products] = await Promise.all([plus.settings(actor.orgId), plus.staffProducts(actor.orgId)]);
    return reply.send({ settings: s, products });
  });

  routes.put(
    "/practice-admin/plus",
    { schema: { tags: ADMIN, summary: "Turn Plus and the tutor on or off, and set what is free", security: STAFF, body: settings.partial(), response: { 200: settings, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const saved = await plus.saveSettings(actor.orgId, Object.fromEntries(Object.entries(request.body).filter(([, v]) => v !== undefined)));
      await service.recordAudit(actor, "prep.plus_settings", actor.orgId, { ...saved });
      return reply.send(saved);
    },
  );

  routes.post(
    "/practice-admin/plus/products",
    { schema: { tags: ADMIN, summary: "Add a plan", security: STAFF, body: productBody, response: { 201: staffProduct, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const saved = await plus.saveProduct(actor.orgId, null, request.body);
      await service.recordAudit(actor, "prep.plan_created", saved.id, { pricePaise: saved.pricePaise });
      return reply.code(201).send(saved);
    },
  );

  routes.put(
    "/practice-admin/plus/products/:id",
    { schema: { tags: ADMIN, summary: "Change a plan", security: STAFF, params: z.object({ id: z.string().min(1) }), body: productBody, response: { 200: staffProduct, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const saved = await plus.saveProduct(actor.orgId, request.params.id, request.body);
      await service.recordAudit(actor, "prep.plan_changed", saved.id, { pricePaise: saved.pricePaise, active: saved.active });
      return reply.send(saved);
    },
  );

  routes.post(
    "/practice-admin/learners/:id/plus",
    {
      schema: {
        tags: ADMIN,
        summary: "Give a learner Plus: a campus licence, a scholarship, a prize",
        description: "Runs on from any Plus they already hold.",
        security: STAFF,
        params: z.object({ id: z.string().min(1) }),
        body: z.object({ days: z.number().int() }),
        response: { 200: z.object({ until: z.string() }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const given = await plus.grant(actor.orgId, request.params.id, request.body.days, actor.id);
      await service.recordAudit(actor, "prep.plus_granted", request.params.id, { days: request.body.days });
      return reply.send(given);
    },
  );

  routes.get("/practice-admin/plus/orders", { schema: { tags: ADMIN, summary: "Plans bought", security: STAFF, response: { 200: z.object({ orders: z.array(order.extend({ learnerId: z.string() })).readonly() }), ...refusals } } }, async (request, reply) => {
    const actor = await staff(request, reply, "org:manage");
    if (actor === null) return;
    const orders = await plus.staffOrders(actor.orgId);
    return reply.send({
      orders: orders.map(({ id, learnerId, title, days, credits, listPaise, couponCode, discountPaise, amountPaise, taxPaise, status, createdAt, paidAt, invoice }) => ({
        id,
        learnerId,
        title,
        days,
        credits,
        listPaise,
        coupon: couponCode,
        discountPaise,
        amountPaise,
        taxPaise,
        status,
        createdAt,
        paidAt,
        invoice,
      })),
    });
  });

  routes.get(
    "/practice-admin/plus/invoices/:number",
    { schema: { tags: ADMIN, summary: "A learner's tax invoice", security: STAFF, params: z.object({ number: z.string().min(1).max(20) }), response: { 200: invoiceView, ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await plus.staffInvoice(actor.orgId, request.params.number));
    },
  );

  routes.get(
    "/practice-admin/plus/coupons",
    { schema: { tags: ADMIN, summary: "Coupons, with what each has sold", description: "Uses, revenue and discount count paid orders only.", security: STAFF, response: { 200: z.object({ coupons: z.array(couponReport).readonly() }), ...refusals } } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send({ coupons: await plus.coupons(actor.orgId) });
    },
  );

  routes.post(
    "/practice-admin/plus/coupons",
    {
      schema: {
        tags: ADMIN,
        summary: "Make a coupon",
        description: "A code of 3 to 30 letters, digits and dashes (kept in capitals); a percentage (1 to 90) or a sum in paise off; optionally for one plan, a number of uses, an end date and an affiliate. No coupon takes a price below ₹1.",
        security: STAFF,
        body: couponBody.extend({ code: z.string().min(1).max(40) }),
        response: { 201: coupon, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const saved = await plus.saveCoupon(actor.orgId, request.body, true);
      await service.recordAudit(actor, "prep.coupon_created", saved.code, { kind: saved.kind, value: saved.value, affiliate: saved.affiliate });
      return reply.code(201).send(saved);
    },
  );

  routes.put(
    "/practice-admin/plus/coupons/:code",
    {
      schema: { tags: ADMIN, summary: "Change a coupon, or turn it off", security: STAFF, params: z.object({ code: z.string().min(1).max(40) }), body: couponBody, response: { 200: coupon, ...refusals } },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const saved = await plus.saveCoupon(actor.orgId, { ...request.body, code: request.params.code }, false);
      await service.recordAudit(actor, "prep.coupon_changed", saved.code, { kind: saved.kind, value: saved.value, active: saved.active });
      return reply.send(saved);
    },
  );

  // Razorpay's webhook signs the body exactly as sent, so it is read as a string.
  void routes.register(async (raw) => {
    raw.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => done(null, body));
    raw.withTypeProvider<ZodTypeProvider>().post(
      "/practice-billing/razorpay/webhook",
      {
        schema: {
          tags: ["Billing"],
          summary: "Razorpay's webhook, for practice sites' plans",
          description: "A second webhook in the Razorpay dashboard, for `order.paid`. Verified by `X-Razorpay-Signature`; pays an order whose browser never came back. Orders not made by a practice site are ignored.",
          security: [{ razorpaySignature: [] }],
          response: { 200: z.object({ handled: z.boolean() }), 400: S.errorResponse, 409: S.errorResponse },
        },
      },
      async (request, reply) => {
        const header = request.headers["x-razorpay-signature"];
        return reply.send(await plus.webhook(String(request.body ?? ""), typeof header === "string" ? header : ""));
      },
    );
  });
}
