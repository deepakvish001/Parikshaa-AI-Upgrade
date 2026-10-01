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
import { WebhookRejected, type BillingService } from "./billing.js";
import * as S from "./schemas.js";
import type { Actor, Permission } from "./staff-auth.js";

type Routes = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  FastifyBaseLogger,
  ZodTypeProvider
>;

export interface BillingRouteDeps {
  readonly billing: BillingService;
  readonly staff: (request: FastifyRequest, reply: FastifyReply, permission: Permission | null) => Promise<Actor | null>;
}

const TAG = ["Billing"];
const SECURED = [{ staffAuth: [] }];
const refusals = {
  401: S.errorResponse,
  403: S.errorResponse,
  404: S.errorResponse,
  409: S.errorResponse,
  422: S.errorResponse,
  502: S.errorResponse,
  503: S.errorResponse,
} as const;

const account = z.object({
  mode: z.enum(["prepaid", "invoiced"]),
  pricePaise: z.number().describe("Per attempt, excluding GST."),
  credits: z.number(),
  legalName: z.string(),
  gstin: z.string().nullable(),
  stateCode: z.string().nullable(),
  address: z.string(),
  billingEmail: z.string().nullable(),
  tdsPercent: z.number().describe("Deducted at source by the buyer under section 194J, on the value before GST."),
  updatedAt: z.string(),
});

const invoiceSummary = z.object({
  id: z.string(),
  number: z.string(),
  kind: z.enum(["credits", "usage", "credit_note"]),
  againstInvoice: z.string().nullable().describe("For a credit note: the invoice it reduces."),
  paymentId: z.string().nullable(),
  period: z.string().nullable(),
  totalPaise: z.number(),
  issuedAt: z.string(),
});

export function registerBillingRoutes(routes: Routes, deps: BillingRouteDeps): void {
  const { billing, staff } = deps;

  routes.get(
    "/billing",
    {
      schema: {
        tags: TAG,
        summary: "The organisation's plan, balance, payments and invoices",
        security: SECURED,
        response: {
          200: z.object({
            account: account.nullable().describe("Null: this organisation is not billed, and nothing is metered."),
            history: z
              .array(
                z.object({
                  id: z.string(),
                  delta: z.number(),
                  reason: z.enum(["purchase", "attempt", "grant", "refund", "payment_refund", "refund_reversed"]),
                  attemptId: z.string().nullable(),
                  paymentId: z.string().nullable(),
                  note: z.string().nullable(),
                  at: z.string(),
                }),
              )
              .readonly(),
            payments: z
              .array(
                z.object({
                  id: z.string(),
                  orderId: z.string(),
                  paymentId: z.string().nullable(),
                  credits: z.number(),
                  taxablePaise: z.number(),
                  taxPaise: z.number(),
                  amountPaise: z.number(),
                  buyerState: z.string().nullable(),
                  status: z.enum(["created", "paid"]),
                  createdAt: z.string(),
                  paidAt: z.string().nullable(),
                  poNumber: z.string().nullable(),
                }),
              )
              .readonly(),
            invoices: z.array(invoiceSummary).readonly(),
            refunds: z
              .array(
                z.object({
                  id: z.string(),
                  paymentId: z.string(),
                  credits: z.number(),
                  taxablePaise: z.number(),
                  taxPaise: z.number(),
                  amountPaise: z.number(),
                  reason: z.string(),
                  status: z.enum(["pending", "processed", "failed"]),
                  razorpayRefundId: z.string().nullable(),
                  creditNoteId: z.string().nullable(),
                  createdAt: z.string(),
                }),
              )
              .readonly()
              .describe("Unspent credits refunded with the payment that bought them, each with its credit note."),
            tdsCertificates: z
              .array(z.object({ id: z.string(), invoiceId: z.string(), amountPaise: z.number(), certificate: z.string(), quarter: z.string(), recordedAt: z.string() }))
              .readonly()
              .describe("Form 16A certificates received for TDS deducted."),
            checkout: z.object({ available: z.boolean(), keyId: z.string().nullable() }),
            bankTransfer: z.boolean().describe("Whether a quotation can be had, to pay by bank transfer against a purchase order."),
            supplier: z.object({ legalName: z.string(), stateCode: z.string() }).nullable(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await billing.summary(actor));
    },
  );

  routes.put(
    "/billing/details",
    {
      schema: {
        tags: TAG,
        summary: "The organisation's details, as its tax invoices carry them",
        description: "A GSTIN is checked, check digit included, and fixes the state: CGST and SGST within Parikshaa's state, IGST outside it. Audited.",
        security: SECURED,
        body: z.object({
          legalName: z.string().min(1).max(300),
          gstin: z.string().max(15).nullable(),
          stateCode: z.string().max(2).nullable(),
          address: z.string().max(1000),
          billingEmail: z.string().max(320).nullable(),
        }),
        response: { 200: account, ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await billing.updateBuyer(actor, request.body));
    },
  );

  routes.post(
    "/billing/quotations",
    {
      schema: {
        tags: TAG,
        summary: "A quotation, to pay by bank transfer",
        description:
          "The same price and GST as Checkout, with the buyer's purchase order number if given. Download it as a PDF (with the account to pay into) and pay by NEFT, RTGS or IMPS quoting its reference; credits and the tax invoice follow once the operator matches the transfer. Audited.",
        security: SECURED,
        body: z.object({ credits: z.number().int().min(1).max(100_000), poNumber: z.string().max(60).nullable().default(null) }),
        response: {
          201: z.object({ id: z.string(), orderId: z.string(), credits: z.number(), taxablePaise: z.number(), taxPaise: z.number(), amountPaise: z.number(), poNumber: z.string().nullable() }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const q = await billing.quote(actor, request.body.credits, request.body.poNumber);
      return reply.code(201).send({ id: q.id, orderId: q.orderId, credits: q.credits, taxablePaise: q.taxablePaise, taxPaise: q.taxPaise, amountPaise: q.amountPaise, poNumber: q.poNumber });
    },
  );

  routes.get(
    "/billing/quotations/:id/pdf",
    { schema: { tags: TAG, summary: "A quotation as a PDF", security: SECURED, params: z.object({ id: z.string() }) } },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const bytes = await billing.quotationPdf(actor, request.params.id);
      return reply.header("content-type", "application/pdf").header("content-disposition", `inline; filename="quotation.pdf"`).send(Buffer.from(bytes));
    },
  );

  routes.post(
    "/billing/orders",
    {
      schema: {
        tags: TAG,
        summary: "Start buying credits: a Razorpay order",
        description:
          "Priced at the organisation's rate plus GST. Open Razorpay Checkout with the order id and key; then confirm with `POST /billing/payments/verify`. A signed-in person only.",
        security: SECURED,
        body: z.object({ credits: z.number().int().min(1).max(100_000) }),
        response: {
          201: z.object({
            orderId: z.string(),
            keyId: z.string(),
            currency: z.literal("INR"),
            credits: z.number(),
            taxablePaise: z.number(),
            taxPaise: z.number(),
            amountPaise: z.number(),
            supplierName: z.string(),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.code(201).send(await billing.createOrder(actor, request.body.credits));
    },
  );

  routes.post(
    "/billing/payments/verify",
    {
      schema: {
        tags: TAG,
        summary: "Confirm a payment Checkout reported",
        description:
          "Credited only if `signature` is Razorpay's HMAC-SHA256 of `orderId|paymentId`. Once: confirming again, or Razorpay's webhook arriving too, changes nothing. Returns the tax invoice.",
        security: SECURED,
        body: z.object({ orderId: z.string().min(1), paymentId: z.string().min(1), signature: z.string().min(1) }),
        response: { 200: z.object({ credits: z.number(), invoice: invoiceSummary.extend({ document: z.record(z.string(), z.unknown()) }) }), ...refusals },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      const { orderId, paymentId, signature } = request.body;
      return reply.send(await billing.confirm(actor, orderId, paymentId, signature));
    },
  );

  routes.get(
    "/billing/invoices/:invoiceId",
    {
      schema: {
        tags: TAG,
        summary: "One tax invoice, as issued",
        security: SECURED,
        params: z.object({ invoiceId: z.string().min(1) }),
        response: {
          200: invoiceSummary.extend({
            document: z.record(z.string(), z.unknown()),
            eInvoice: z
              .object({ invoiceId: z.string(), irn: z.string(), ackNo: z.string(), ackDate: z.string(), signedQr: z.string() })
              .nullable()
              .describe("The IRN and signed QR code from the Invoice Registration Portal, once recorded."),
          }),
          ...refusals,
        },
      },
    },
    async (request, reply) => {
      const actor = await staff(request, reply, "org:manage");
      if (actor === null) return;
      return reply.send(await billing.invoice(actor, request.params.invoiceId));
    },
  );

  // Razorpay's webhook signs the body exactly as sent, so this route reads it
  // as a string: parsed and re-serialized, it would no longer match.
  void routes.register(async (raw) => {
    raw.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => done(null, body));
    raw.withTypeProvider<ZodTypeProvider>().post(
      "/billing/razorpay/webhook",
      {
        schema: {
          tags: TAG,
          summary: "Razorpay's webhook",
          description:
            "Set in the Razorpay dashboard for `order.paid` (and optionally `payment.captured`), with the webhook secret in RAZORPAY_WEBHOOK_SECRET. Verified by `X-Razorpay-Signature`; credits a payment whose browser never came back.",
          security: [{ razorpaySignature: [] }],
          response: { 200: z.object({ handled: z.boolean() }), 401: S.errorResponse, 503: S.errorResponse },
        },
      },
      async (request, reply) => {
        const header = request.headers["x-razorpay-signature"];
        const signature = typeof header === "string" ? header : "";
        try {
          return reply.send(await billing.webhook(String(request.body ?? ""), signature));
        } catch (error) {
          if (error instanceof WebhookRejected) return reply.code(401).send({ error: "invalid_signature", message: error.message });
          throw error;
        }
      },
    );
  });
}
