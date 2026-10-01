import type { OrgId } from "@parikshaa/core";
import type { UsageRecord } from "./ledger-store.js";
import { practiceStaff, type PracticeScope } from "./practice-store.js";
import type { SqlExecutor } from "./sql.js";
import { financialYear, invoiceNumber } from "./billing-store.js";

/**
 * Plus and the tutor's credits (ROADMAP §16, migration 0020): what a practice
 * site sells, what a learner holds, and what the tutor said.
 *
 * Money and credits are written only in the staff scope, by the server: row-
 * level security lets a learner read their own orders, Plus and credits, and
 * never write one. The credit ledger is added to, never changed, and each row
 * carries a key so the same grant or charge is never made twice.
 */

function scoped<T>(sql: SqlExecutor, scope: PracticeScope, fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
  return sql.transaction(fn, {
    "parikshaa.org_id": scope.orgId,
    "parikshaa.actor": scope.actor,
    "parikshaa.attempt_id": "",
    "parikshaa.learner_id": scope.actor === "learner" ? (scope.learnerId ?? "") : "",
  });
}

function own(scope: PracticeScope): string {
  if (scope.actor !== "learner" || scope.learnerId === null) throw new Error("Only a signed-in learner has rows of their own");
  return scope.learnerId;
}

const iso = (value: string | Date) => new Date(value).toISOString();

export interface PrepSettings {
  readonly plusEnabled: boolean;
  readonly freeModules: number;
  readonly monthlyCredits: number;
  readonly tutorEnabled: boolean;
  /** Days of Plus a learner may try free, once; 0 for no trial. */
  readonly trialDays: number;
}

export const DEFAULT_PREP_SETTINGS: PrepSettings = { plusEnabled: false, freeModules: 1, monthlyCredits: 100, tutorEnabled: true, trialDays: 0 };

export interface PrepProduct {
  readonly id: string;
  readonly title: string;
  /** Plus, a Company Pass (the company lists alone), a DSA Pass (lessons and the plan alone), or tutor credits. */
  readonly kind: "plus" | "credits" | "company" | "dsa";
  readonly days: number;
  readonly credits: number;
  readonly pricePaise: number;
  readonly active: boolean;
  readonly position: number;
}
export type PrepProductDraft = Omit<PrepProduct, "id">;

export interface PrepOrder {
  readonly id: string;
  readonly learnerId: string;
  readonly productId: string;
  readonly title: string;
  readonly days: number;
  readonly credits: number;
  /** What the plan cost before the coupon. */
  readonly listPaise: number;
  readonly couponCode: string | null;
  readonly discountPaise: number;
  /** What was charged, GST included. */
  readonly amountPaise: number;
  readonly taxPaise: number;
  /** Who the invoice is made out to, and the state that decides its taxes. */
  readonly buyerName: string;
  readonly buyerState: string | null;
  readonly buyerGstin: string | null;
  /** Which pass its days are for. */
  readonly pass: Pass;
  readonly gatewayOrderId: string;
  readonly paymentId: string | null;
  readonly status: "created" | "paid" | "refunded";
  readonly createdAt: string;
  readonly paidAt: string | null;
  readonly refundedAt: string | null;
  readonly refundReason: string;
}

export type Pass = "plus" | "company" | "dsa";

export interface PrepCoupon {
  /** Upper case: what a learner types, and what a `?ref=` link carries. */
  readonly code: string;
  readonly kind: "percent" | "flat";
  /** A percentage, or paise off. */
  readonly value: number;
  /** For one plan; null for any. */
  readonly productId: string | null;
  readonly maxUses: number | null;
  readonly endsAt: string | null;
  /** Who hands it out, for the sales report; empty for none. */
  readonly affiliate: string;
  readonly active: boolean;
  readonly createdAt: string;
  /** For this learner alone (one bought with coins); null for anyone. */
  readonly learnerId: string | null;
}

/** A coupon with what it has brought in: paid orders only. */
export interface CouponReport extends PrepCoupon {
  readonly uses: number;
  readonly revenuePaise: number;
  readonly discountPaise: number;
}

export interface PrepInvoice {
  readonly id: string;
  readonly orderId: string;
  readonly learnerId: string;
  readonly number: string;
  readonly document: Record<string, unknown>;
  readonly totalPaise: number;
  readonly issuedAt: string;
}

/** A credit note: shaped as an invoice is. */
export type PrepCreditNote = PrepInvoice;

/** Builds a refunded order's credit note once its number is known, against the order's invoice (if one was issued). */
export type PrepCreditNoteBuilder = (number: string, order: PrepOrder, invoice: PrepInvoice | null, at: Date) => { readonly document: Record<string, unknown>; readonly totalPaise: number };

/** Builds an order's invoice once its number is known: the document, and its total. */
export type PrepInvoiceBuilder = (number: string, order: PrepOrder, at: Date) => { readonly document: Record<string, unknown>; readonly totalPaise: number };

interface CouponRow {
  code: string;
  kind: "percent" | "flat";
  value: number;
  product_id: string | null;
  max_uses: number | null;
  ends_at: string | Date | null;
  affiliate: string;
  active: boolean;
  created_at: string | Date;
  learner_id: string | null;
}
const COUPON_COLUMNS = "code, kind, value, product_id, max_uses, ends_at, affiliate, active, created_at, learner_id";
const toCoupon = (r: CouponRow): PrepCoupon => ({
  code: r.code,
  kind: r.kind,
  value: Number(r.value),
  productId: r.product_id,
  maxUses: r.max_uses === null ? null : Number(r.max_uses),
  endsAt: r.ends_at === null ? null : new Date(r.ends_at).toISOString(),
  affiliate: r.affiliate,
  active: r.active,
  createdAt: new Date(r.created_at).toISOString(),
  learnerId: r.learner_id,
});

interface InvoiceRow {
  id: string;
  order_id: string;
  learner_id: string;
  number: string;
  document: Record<string, unknown>;
  total_paise: number;
  issued_at: string | Date;
}
const INVOICE_COLUMNS = "id, order_id, learner_id, number, document, total_paise, issued_at";
const toInvoice = (r: InvoiceRow): PrepInvoice => ({
  id: r.id,
  orderId: r.order_id,
  learnerId: r.learner_id,
  number: r.number,
  document: r.document,
  totalPaise: Number(r.total_paise),
  issuedAt: new Date(r.issued_at).toISOString(),
});

/** Learners' invoices are numbered in a series of their own: `PKP/2627/000001`. */
export const prepInvoiceNumber = (fy: string, serial: number): string => invoiceNumber(fy, serial, "PKP");
/** And their credit notes in another: `PKC/2627/000001`. */
export const prepCreditNoteNumber = (fy: string, serial: number): string => invoiceNumber(fy, serial, "PKC");

export interface PlusSpan {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly source: "payment" | "grant" | "coins" | "trial";
  /** Plus, a Company Pass or a DSA Pass. */
  readonly pass: Pass;
}

export type CreditReason = "monthly" | "purchase" | "grant" | "spend" | "refund" | "order_refund";

export interface TutorEntry {
  readonly id: string;
  readonly mode: "hint" | "review" | "doubt" | "notes" | "followup" | "followup_reply";
  readonly problemId: string | null;
  readonly lessonId: string | null;
  readonly hintLevel: number | null;
  readonly question: string;
  readonly answer: string;
  readonly credits: number;
  readonly model: string;
  readonly createdAt: string;
  /** What the answer said in a fixed shape: a review's findings, follow-up questions, a reply's verdict. Null otherwise. */
  readonly data?: Record<string, unknown> | null;
}

/** Days what the tutor said is kept (DPDP): then the retention sweep deletes it. */
export const TUTOR_KEEP_DAYS = 180;

interface OrderRow {
  id: string;
  learner_id: string;
  product_id: string;
  title: string;
  days: number;
  credits: number;
  list_paise: number;
  coupon_code: string | null;
  discount_paise: number;
  amount_paise: number;
  tax_paise: number;
  buyer_name: string;
  buyer_state: string | null;
  buyer_gstin: string | null;
  pass: Pass;
  gateway_order_id: string;
  payment_id: string | null;
  status: "created" | "paid" | "refunded";
  created_at: string | Date;
  paid_at: string | Date | null;
  refunded_at: string | Date | null;
  refund_reason: string;
}
const ORDER_COLUMNS =
  "id, learner_id, product_id, title, days, credits, list_paise, coupon_code, discount_paise, amount_paise, tax_paise, buyer_name, buyer_state, buyer_gstin, pass, gateway_order_id, payment_id, status, created_at, paid_at, refunded_at, refund_reason";
const toOrder = (r: OrderRow): PrepOrder => ({
  id: r.id,
  learnerId: r.learner_id,
  productId: r.product_id,
  title: r.title,
  days: Number(r.days),
  credits: Number(r.credits),
  listPaise: Number(r.list_paise),
  couponCode: r.coupon_code,
  discountPaise: Number(r.discount_paise),
  amountPaise: Number(r.amount_paise),
  taxPaise: Number(r.tax_paise),
  buyerName: r.buyer_name,
  buyerState: r.buyer_state,
  buyerGstin: r.buyer_gstin,
  pass: r.pass,
  gatewayOrderId: r.gateway_order_id,
  paymentId: r.payment_id,
  status: r.status,
  createdAt: iso(r.created_at),
  paidAt: r.paid_at === null ? null : iso(r.paid_at),
  refundedAt: r.refunded_at === null ? null : iso(r.refunded_at),
  refundReason: r.refund_reason,
});

interface ProductRow {
  id: string;
  title: string;
  kind: "plus" | "credits" | "company";
  days: number;
  credits: number;
  price_paise: number;
  active: boolean;
  position: number;
}
const toProduct = (r: ProductRow): PrepProduct => ({
  id: r.id,
  title: r.title,
  kind: r.kind,
  days: Number(r.days),
  credits: Number(r.credits),
  pricePaise: Number(r.price_paise),
  active: r.active,
  position: Number(r.position),
});

export class CouponTaken extends Error {
  constructor() {
    super("A coupon with that code exists");
    this.name = "CouponTaken";
  }
}

export class PrepPlusStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  // --- settings and products -------------------------------------------------------------

  async settings(scope: PracticeScope): Promise<PrepSettings> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ plus_enabled: boolean; free_modules: number; monthly_credits: number; tutor_enabled: boolean; trial_days: number }>(
        `SELECT plus_enabled, free_modules, monthly_credits, tutor_enabled, trial_days FROM prep_settings WHERE org_id = $1`,
        [scope.orgId],
      );
      const r = rows[0];
      return r === undefined
        ? DEFAULT_PREP_SETTINGS
        : { plusEnabled: r.plus_enabled, freeModules: Number(r.free_modules), monthlyCredits: Number(r.monthly_credits), tutorEnabled: r.tutor_enabled, trialDays: Number(r.trial_days) };
    });
  }

  async saveSettings(orgId: OrgId, settings: PrepSettings): Promise<void> {
    await scoped(this.#sql, practiceStaff(orgId), (tx) =>
      tx.query(
        `INSERT INTO prep_settings (org_id, plus_enabled, free_modules, monthly_credits, tutor_enabled, trial_days, updated_at) VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (org_id) DO UPDATE SET plus_enabled = $2, free_modules = $3, monthly_credits = $4, tutor_enabled = $5, trial_days = $6, updated_at = now()`,
        [orgId, settings.plusEnabled, settings.freeModules, settings.monthlyCredits, settings.tutorEnabled, settings.trialDays],
      ),
    );
  }

  /** A learner sees the active ones; staff, all. */
  async products(scope: PracticeScope): Promise<readonly PrepProduct[]> {
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<ProductRow>(`SELECT id, title, kind, days, credits, price_paise, active, position FROM prep_products WHERE org_id = $1 ORDER BY position, price_paise`, [
          scope.orgId,
        ])
      ).map(toProduct),
    );
  }

  async saveProduct(orgId: OrgId, id: string | null, draft: PrepProductDraft): Promise<PrepProduct | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const params = [orgId, id ?? this.#newId(), draft.title, draft.kind, draft.days, draft.credits, draft.pricePaise, draft.active, draft.position];
      const rows =
        id === null
          ? await tx.query<ProductRow>(
              `INSERT INTO prep_products (org_id, id, title, kind, days, credits, price_paise, active, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING id, title, kind, days, credits, price_paise, active, position`,
              params,
            )
          : await tx.query<ProductRow>(
              `UPDATE prep_products SET title = $3, kind = $4, days = $5, credits = $6, price_paise = $7, active = $8, position = $9
                WHERE org_id = $1 AND id = $2 RETURNING id, title, kind, days, credits, price_paise, active, position`,
              params,
            );
      return rows[0] === undefined ? null : toProduct(rows[0]);
    });
  }

  // --- orders ---------------------------------------------------------------------------------

  async createOrder(orgId: OrgId, order: Omit<PrepOrder, "id" | "paymentId" | "status" | "createdAt" | "paidAt" | "refundedAt" | "refundReason">): Promise<PrepOrder> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<OrderRow>(
        `INSERT INTO prep_orders (org_id, id, learner_id, product_id, title, days, credits, amount_paise, tax_paise, gateway_order_id,
                                  list_paise, coupon_code, discount_paise, buyer_name, buyer_state, buyer_gstin, pass)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING ${ORDER_COLUMNS}`,
        [
          orgId,
          this.#newId(),
          order.learnerId,
          order.productId,
          order.title,
          order.days,
          order.credits,
          order.amountPaise,
          order.taxPaise,
          order.gatewayOrderId,
          order.listPaise,
          order.couponCode,
          order.discountPaise,
          order.buyerName,
          order.buyerState,
          order.buyerGstin,
          order.pass,
        ],
      );
      return toOrder(rows[0]!);
    });
  }

  async orders(scope: PracticeScope): Promise<readonly PrepOrder[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<OrderRow>(
          `SELECT ${ORDER_COLUMNS} FROM prep_orders WHERE org_id = $1 AND ($2::text IS NULL OR learner_id = $2) ORDER BY created_at DESC LIMIT 500`,
          [scope.orgId, scope.actor === "learner" ? own(scope) : null],
        )
      ).map(toOrder),
    );
  }

  /**
   * Mark an order paid, once: its Plus and its credits are given in the same
   * transaction, each under a key that makes a second confirmation a no-op.
   * Null when there is no such order.
   */
  async markPaid(
    orgId: OrgId,
    gatewayOrderId: string,
    paymentId: string,
    at: Date,
    invoice?: PrepInvoiceBuilder,
  ): Promise<{ readonly order: PrepOrder; readonly newlyPaid: boolean } | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const found = await tx.query<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM prep_orders WHERE org_id = $1 AND gateway_order_id = $2 FOR UPDATE`, [orgId, gatewayOrderId]);
      if (found[0] === undefined) return null;
      if (found[0].status === "paid") return { order: toOrder(found[0]), newlyPaid: false };
      const rows = await tx.query<OrderRow>(
        `UPDATE prep_orders SET status = 'paid', payment_id = $3, paid_at = $4 WHERE org_id = $1 AND gateway_order_id = $2 RETURNING ${ORDER_COLUMNS}`,
        [orgId, gatewayOrderId, paymentId, at],
      );
      const order = toOrder(rows[0]!);
      if (order.days > 0) {
        // Plus bought while Plus is held runs on from the end of what is held.
        // A pass bought while the same pass is held runs on from the end of what is held.
        const held = await tx.query<{ ends_at: string | Date | null }>(
          `SELECT max(ends_at) AS ends_at FROM prep_plus WHERE org_id = $1 AND learner_id = $2 AND ends_at > $3 AND pass = $4 AND revoked_at IS NULL`,
          [orgId, order.learnerId, at, order.pass],
        );
        const from = held[0]?.ends_at === null || held[0]?.ends_at === undefined ? at : new Date(held[0].ends_at);
        await tx.query(
          `INSERT INTO prep_plus (org_id, id, learner_id, starts_at, ends_at, source, ref, pass) VALUES ($1, $2, $3, $4, $5, 'payment', $6, $7) ON CONFLICT DO NOTHING`,
          [orgId, this.#newId(), order.learnerId, from, new Date(from.getTime() + order.days * 86_400_000), order.id, order.pass],
        );
      }
      if (order.credits > 0) {
        await tx.query(
          `INSERT INTO prep_credits (org_id, id, learner_id, delta, reason, key) VALUES ($1, $2, $3, $4, 'purchase', $5) ON CONFLICT DO NOTHING`,
          [orgId, this.#newId(), order.learnerId, order.credits, `order:${order.id}`],
        );
      }
      if (invoice !== undefined) await this.#issue(tx, orgId, order, invoice, at);
      return { order, newlyPaid: true };
    });
  }

  /**
   * Number and store an order's invoice, in the transaction that pays it: the
   * serial is taken there, so a failure leaves no gap in the series.
   */
  async #issue(tx: SqlExecutor, orgId: OrgId, order: PrepOrder, build: PrepInvoiceBuilder, at: Date): Promise<PrepInvoice> {
    const fy = financialYear(at);
    const counter = await tx.query<{ last: number }>(
      `INSERT INTO invoice_counters (fy, last) VALUES ($1, 1) ON CONFLICT (fy) DO UPDATE SET last = invoice_counters.last + 1 RETURNING last`,
      [`PP:${fy}`],
    );
    const number = prepInvoiceNumber(fy, Number(counter[0]!.last));
    const { document, totalPaise } = build(number, order, at);
    const rows = await tx.query<InvoiceRow>(
      `INSERT INTO prep_invoices (org_id, id, order_id, learner_id, number, document, total_paise, issued_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${INVOICE_COLUMNS}`,
      [orgId, this.#newId(), order.id, order.learnerId, number, JSON.stringify(document), totalPaise, at.toISOString()],
    );
    return toInvoice(rows[0]!);
  }

  /** A learner's invoices, or (staff) everyone's; newest first. */
  async invoices(scope: PracticeScope): Promise<readonly PrepInvoice[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<InvoiceRow>(
          `SELECT ${INVOICE_COLUMNS} FROM prep_invoices WHERE org_id = $1 AND ($2::text IS NULL OR learner_id = $2) ORDER BY issued_at DESC, number DESC LIMIT 1000`,
          [scope.orgId, scope.actor === "learner" ? own(scope) : null],
        )
      ).map(toInvoice),
    );
  }

  // --- coupons ----------------------------------------------------------------------------------

  async coupons(orgId: OrgId): Promise<readonly CouponReport[]> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) =>
      (
        await tx.query<CouponRow & { uses: number; revenue: number; discount: number }>(
          `SELECT ${COUPON_COLUMNS.split(", ").map((c) => `c.${c}`).join(", ")},
                  count(o.id)::int AS uses, coalesce(sum(o.amount_paise), 0)::bigint AS revenue, coalesce(sum(o.discount_paise), 0)::bigint AS discount
             FROM prep_coupons c
             LEFT JOIN prep_orders o ON o.org_id = c.org_id AND o.coupon_code = c.code AND o.status = 'paid'
            WHERE c.org_id = $1
            GROUP BY c.org_id, c.code
            ORDER BY c.created_at DESC`,
          [orgId],
        )
      ).map((r) => ({ ...toCoupon(r), uses: Number(r.uses), revenuePaise: Number(r.revenue), discountPaise: Number(r.discount) })),
    );
  }

  async coupon(orgId: OrgId, code: string): Promise<PrepCoupon | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<CouponRow>(`SELECT ${COUPON_COLUMNS} FROM prep_coupons WHERE org_id = $1 AND code = $2`, [orgId, code]);
      return rows[0] === undefined ? null : toCoupon(rows[0]);
    });
  }

  /** Paid uses of a coupon: in all, and by one learner. */
  async couponUses(orgId: OrgId, code: string, learnerId: string): Promise<{ readonly total: number; readonly mine: number }> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ total: number; mine: number }>(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE learner_id = $3)::int AS mine FROM prep_orders WHERE org_id = $1 AND coupon_code = $2 AND status = 'paid'`,
        [orgId, code, learnerId],
      );
      return { total: Number(rows[0]?.total ?? 0), mine: Number(rows[0]?.mine ?? 0) };
    });
  }

  /** A new coupon, or a change to one; the code itself never changes. Null when changing one that is not there. */
  async saveCoupon(orgId: OrgId, coupon: Omit<PrepCoupon, "createdAt" | "learnerId">, create: boolean): Promise<PrepCoupon | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const params = [orgId, coupon.code, coupon.kind, coupon.value, coupon.productId, coupon.maxUses, coupon.endsAt, coupon.affiliate, coupon.active];
      try {
        const rows = create
          ? await tx.query<CouponRow>(
              `INSERT INTO prep_coupons (org_id, code, kind, value, product_id, max_uses, ends_at, affiliate, active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING ${COUPON_COLUMNS}`,
              params,
            )
          : await tx.query<CouponRow>(
              `UPDATE prep_coupons SET kind = $3, value = $4, product_id = $5, max_uses = $6, ends_at = $7, affiliate = $8, active = $9
                WHERE org_id = $1 AND code = $2 RETURNING ${COUPON_COLUMNS}`,
              params,
            );
        return rows[0] === undefined ? null : toCoupon(rows[0]);
      } catch (error) {
        if ((error as { code?: string }).code === "23505") throw new CouponTaken();
        throw error;
      }
    });
  }

  // --- Plus -------------------------------------------------------------------------------------

  async plus(scope: PracticeScope, learnerId?: string): Promise<readonly PlusSpan[]> {
    const who = scope.actor === "learner" ? (scope.learnerId ?? null) : (learnerId ?? null);
    if (who === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{ starts_at: string | Date; ends_at: string | Date; source: PlusSpan["source"]; pass: PlusSpan["pass"] }>(
          `SELECT starts_at, ends_at, source, pass FROM prep_plus WHERE org_id = $1 AND learner_id = $2 AND revoked_at IS NULL ORDER BY ends_at`,
          [scope.orgId, who],
        )
      ).map((r) => ({ startsAt: iso(r.starts_at), endsAt: iso(r.ends_at), source: r.source, pass: r.pass })),
    );
  }

  /** Give Plus. False when that grant was made already. */
  async grantPlus(orgId: OrgId, learnerId: string, span: { startsAt: Date; endsAt: Date; source: "grant" | "coins"; ref: string }): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `INSERT INTO prep_plus (org_id, id, learner_id, starts_at, ends_at, source, ref) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id`,
        [orgId, this.#newId(), learnerId, span.startsAt, span.endsAt, span.source, span.ref],
      );
      return rows.length > 0;
    });
  }

  /** Start a learner's free trial of Plus, from `at`. False when they have had one. */
  async startTrial(orgId: OrgId, learnerId: string, days: number, at: Date): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `INSERT INTO prep_plus (org_id, id, learner_id, starts_at, ends_at, source, ref, pass) VALUES ($1, $2, $3, $4, $5, 'trial', $6, 'plus') ON CONFLICT DO NOTHING RETURNING id`,
        [orgId, this.#newId(), learnerId, at, new Date(at.getTime() + days * 86_400_000), `trial:${learnerId}`],
      );
      return rows.length > 0;
    });
  }

  /** Whether a learner has had their trial. */
  async hadTrial(orgId: OrgId, learnerId: string): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) =>
      (await tx.query(`SELECT 1 FROM prep_plus WHERE org_id = $1 AND source = 'trial' AND ref = $2`, [orgId, `trial:${learnerId}`])).length > 0,
    );
  }

  /**
   * Record a refund given through the gateway: the order is refunded, the
   * pass it gave revoked, its credits taken back as far as they are unspent,
   * and a credit note issued against its invoice. Null when there is no such
   * paid order; refunding twice changes nothing.
   */
  async refundOrder(
    orgId: OrgId,
    orderId: string,
    refund: { readonly refundId: string; readonly reason: string },
    at: Date,
    creditNote?: PrepCreditNoteBuilder,
  ): Promise<{ readonly order: PrepOrder; readonly creditNote: PrepCreditNote | null; readonly creditsTaken: number } | null> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const found = await tx.query<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM prep_orders WHERE org_id = $1 AND id = $2 FOR UPDATE`, [orgId, orderId]);
      if (found[0] === undefined || found[0].status === "created") return null;
      if (found[0].status === "refunded") {
        const notes = await tx.query<InvoiceRow>(`SELECT ${INVOICE_COLUMNS} FROM prep_credit_notes WHERE org_id = $1 AND order_id = $2`, [orgId, orderId]);
        return { order: toOrder(found[0]), creditNote: notes[0] === undefined ? null : toInvoice(notes[0]), creditsTaken: 0 };
      }
      const rows = await tx.query<OrderRow>(
        `UPDATE prep_orders SET status = 'refunded', refunded_at = $3, refund_id = $4, refund_reason = $5 WHERE org_id = $1 AND id = $2 RETURNING ${ORDER_COLUMNS}`,
        [orgId, orderId, at, refund.refundId, refund.reason],
      );
      const order = toOrder(rows[0]!);
      await tx.query(`UPDATE prep_plus SET revoked_at = $3 WHERE org_id = $1 AND source = 'payment' AND ref = $2 AND revoked_at IS NULL`, [orgId, order.id, at]);
      let creditsTaken = 0;
      if (order.credits > 0) {
        const balance = await tx.query<{ total: string | null }>(`SELECT sum(delta) AS total FROM prep_credits WHERE org_id = $1 AND learner_id = $2`, [orgId, order.learnerId]);
        creditsTaken = Math.max(0, Math.min(order.credits, Number(balance[0]?.total ?? 0)));
        if (creditsTaken > 0) {
          await tx.query(`INSERT INTO prep_credits (org_id, id, learner_id, delta, reason, key) VALUES ($1, $2, $3, $4, 'order_refund', $5) ON CONFLICT DO NOTHING`, [
            orgId,
            this.#newId(),
            order.learnerId,
            -creditsTaken,
            `order_refund:${order.id}`,
          ]);
        }
      }
      let note: PrepCreditNote | null = null;
      if (creditNote !== undefined) {
        const invoices = await tx.query<InvoiceRow>(`SELECT ${INVOICE_COLUMNS} FROM prep_invoices WHERE org_id = $1 AND order_id = $2`, [orgId, order.id]);
        const fy = financialYear(at);
        const counter = await tx.query<{ last: number }>(
          `INSERT INTO invoice_counters (fy, last) VALUES ($1, 1) ON CONFLICT (fy) DO UPDATE SET last = invoice_counters.last + 1 RETURNING last`,
          [`PC:${fy}`],
        );
        const number = prepCreditNoteNumber(fy, Number(counter[0]!.last));
        const { document, totalPaise } = creditNote(number, order, invoices[0] === undefined ? null : toInvoice(invoices[0]), at);
        const inserted = await tx.query<InvoiceRow>(
          `INSERT INTO prep_credit_notes (org_id, id, order_id, learner_id, number, document, total_paise, issued_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${INVOICE_COLUMNS}`,
          [orgId, this.#newId(), order.id, order.learnerId, number, JSON.stringify(document), totalPaise, at.toISOString()],
        );
        note = toInvoice(inserted[0]!);
      }
      return { order, creditNote: note, creditsTaken };
    });
  }

  /** A learner's credit notes, or (staff) everyone's; newest first. */
  async creditNotes(scope: PracticeScope): Promise<readonly PrepCreditNote[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (await tx.query<InvoiceRow>(`SELECT ${INVOICE_COLUMNS} FROM prep_credit_notes WHERE org_id = $1 ORDER BY issued_at DESC LIMIT 2000`, [scope.orgId])).map(toInvoice),
    );
  }

  // --- credits ------------------------------------------------------------------------------------

  /** Add to or take from the ledger. False when the key was used already. */
  async credit(orgId: OrgId, learnerId: string, entry: { delta: number; reason: CreditReason; key: string }, at: Date = new Date()): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `INSERT INTO prep_credits (org_id, id, learner_id, delta, reason, key, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING RETURNING id`,
        [orgId, this.#newId(), learnerId, entry.delta, entry.reason, entry.key, at],
      );
      return rows.length > 0;
    });
  }

  /**
   * Spend credits if there are enough, in one transaction so two requests at
   * once cannot both spend the last of them. False when there are not.
   */
  async spend(orgId: OrgId, learnerId: string, amount: number, key: string, at: Date): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      // One learner's spending is serialised on their row.
      await tx.query(`SELECT id FROM learners WHERE id = $1 FOR UPDATE`, [learnerId]);
      const balance = await tx.query<{ total: string | null }>(`SELECT sum(delta) AS total FROM prep_credits WHERE org_id = $1 AND learner_id = $2`, [orgId, learnerId]);
      if (Number(balance[0]?.total ?? 0) < amount) return false;
      await tx.query(`INSERT INTO prep_credits (org_id, id, learner_id, delta, reason, key, created_at) VALUES ($1, $2, $3, $4, 'spend', $5, $6)`, [
        orgId,
        this.#newId(),
        learnerId,
        -amount,
        key,
        at,
      ]);
      return true;
    });
  }

  async credits(scope: PracticeScope, limit = 50): Promise<{ readonly balance: number; readonly history: readonly { readonly delta: number; readonly reason: CreditReason; readonly at: string }[] }> {
    if (scope.actor === "learner" && scope.learnerId === null) return { balance: 0, history: [] };
    return scoped(this.#sql, scope, async (tx) => {
      const who = own(scope);
      const total = await tx.query<{ total: string | null }>(`SELECT sum(delta) AS total FROM prep_credits WHERE org_id = $1 AND learner_id = $2`, [scope.orgId, who]);
      const rows = await tx.query<{ delta: number; reason: CreditReason; created_at: string | Date }>(
        `SELECT delta, reason, created_at FROM prep_credits WHERE org_id = $1 AND learner_id = $2 ORDER BY created_at DESC, id LIMIT $3`,
        [scope.orgId, who, limit],
      );
      return { balance: Number(total[0]?.total ?? 0), history: rows.map((r) => ({ delta: Number(r.delta), reason: r.reason, at: iso(r.created_at) })) };
    });
  }

  // --- the tutor ------------------------------------------------------------------------------------

  async addTutor(orgId: OrgId, learnerId: string, entry: Omit<TutorEntry, "id" | "createdAt">, at: Date): Promise<TutorEntry> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const id = this.#newId();
      await tx.query(
        `INSERT INTO prep_tutor (org_id, id, learner_id, mode, problem_id, lesson_id, hint_level, question, answer, credits, model, created_at, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [orgId, id, learnerId, entry.mode, entry.problemId, entry.lessonId, entry.hintLevel, entry.question, entry.answer, entry.credits, entry.model, at, (entry.data ?? null) === null ? null : JSON.stringify(entry.data)],
      );
      return { ...entry, data: entry.data ?? null, id, createdAt: at.toISOString() };
    });
  }

  async tutorHistory(scope: PracticeScope, filter: { problemId?: string; lessonId?: string } = {}): Promise<readonly TutorEntry[]> {
    if (scope.actor === "learner" && scope.learnerId === null) return [];
    return scoped(this.#sql, scope, async (tx) =>
      (
        await tx.query<{
          id: string;
          mode: TutorEntry["mode"];
          problem_id: string | null;
          lesson_id: string | null;
          hint_level: number | null;
          question: string;
          answer: string;
          credits: number;
          model: string;
          created_at: string | Date;
          data: Record<string, unknown> | string | null;
        }>(
          `SELECT id, mode, problem_id, lesson_id, hint_level, question, answer, credits, model, created_at, data FROM prep_tutor
            WHERE org_id = $1 AND learner_id = $2 AND ($3::text IS NULL OR problem_id = $3) AND ($4::text IS NULL OR lesson_id = $4)
            ORDER BY created_at, hint_level NULLS LAST, id LIMIT 200`,
          [scope.orgId, own(scope), filter.problemId ?? null, filter.lessonId ?? null],
        )
      ).map((r) => ({
        id: r.id,
        mode: r.mode,
        problemId: r.problem_id,
        lessonId: r.lesson_id,
        hintLevel: r.hint_level === null ? null : Number(r.hint_level),
        question: r.question,
        answer: r.answer,
        credits: Number(r.credits),
        model: r.model,
        createdAt: iso(r.created_at),
        data: r.data === null ? null : typeof r.data === "string" ? (JSON.parse(r.data) as Record<string, unknown>) : r.data,
      })),
    );
  }

  /** Delete what the tutor said before `before` (the retention sweep); how many entries went. */
  async purgeTutor(orgId: OrgId, before: Date): Promise<number> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) =>
      (await tx.query<{ id: string }>(`DELETE FROM prep_tutor WHERE org_id = $1 AND created_at < $2 RETURNING id`, [orgId, before])).length,
    );
  }

  /** A learner deletes what the tutor said to them; everything, or about one problem. */
  async forgetTutor(scope: PracticeScope, problemId: string | null): Promise<number> {
    return scoped(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ id: string }>(
        `DELETE FROM prep_tutor WHERE org_id = $1 AND learner_id = $2 AND ($3::text IS NULL OR problem_id = $3) RETURNING id`,
        [scope.orgId, own(scope), problemId],
      );
      return rows.length;
    });
  }

  /** The tutor's model spend, counted with the rest of the organisation's (ROADMAP §0). */
  async recordUsage(orgId: OrgId, usage: Omit<UsageRecord, "attemptId" | "route">, at: Date = new Date()): Promise<void> {
    await scoped(this.#sql, practiceStaff(orgId), (tx) =>
      tx.query(
        `INSERT INTO model_usage (id, org_id, attempt_id, route, model, speed, input_tokens, output_tokens, cache_read_tokens,
                                  cache_write_5m_tokens, cache_write_1h_tokens, cost_micro_usd, inference_geo, at)
         VALUES ($1, $2, NULL, 'tutor', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          this.#newId(),
          orgId,
          usage.model,
          usage.speed,
          usage.inputTokens,
          usage.outputTokens,
          usage.cacheReadTokens,
          usage.cacheWrite5mTokens,
          usage.cacheWrite1hTokens,
          usage.costMicroUsd,
          usage.inferenceGeo,
          at,
        ],
      ),
    );
  }

  /** Whether the organisation's model spend this month is under its cap, if it has one. */
  async withinBudget(orgId: OrgId, monthStart: Date): Promise<boolean> {
    return scoped(this.#sql, practiceStaff(orgId), async (tx) => {
      const rows = await tx.query<{ cap: string | null; spent: string | null }>(
        `SELECT o.monthly_spend_cap_micro_usd AS cap,
                (SELECT coalesce(sum(cost_micro_usd), 0) FROM model_usage WHERE org_id = $1 AND at >= $2) AS spent
           FROM organisations o WHERE o.id = $1`,
        [orgId, monthStart],
      );
      const r = rows[0];
      return r === undefined || r.cap === null || Number(r.spent) < Number(r.cap);
    });
  }
}
