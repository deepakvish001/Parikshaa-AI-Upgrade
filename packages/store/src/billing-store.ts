import { withScope, type Scope } from "./ledger-store.js";
import type { SqlExecutor } from "./sql.js";

/**
 * Billing (ROADMAP §12; migration 0010): an organisation's plan and balance,
 * the credits it spends, its Razorpay payments and its GST tax invoices.
 *
 * Money moves only inside a transaction that also writes why: a credit is
 * consumed with the attempt that consumed it, bought with the payment that
 * bought it, and invoiced with the number the invoice carries.
 */

export type BillingMode = "prepaid" | "invoiced";

export interface BillingAccount {
  readonly mode: BillingMode;
  /** Per attempt, excluding GST. */
  readonly pricePaise: number;
  readonly credits: number;
  readonly legalName: string;
  readonly gstin: string | null;
  readonly stateCode: string | null;
  readonly address: string;
  readonly billingEmail: string | null;
  readonly updatedAt: string;
}

export type BuyerDetails = Pick<BillingAccount, "legalName" | "gstin" | "stateCode" | "address" | "billingEmail">;

export interface CreditMovement {
  readonly id: string;
  readonly delta: number;
  readonly reason: "purchase" | "attempt" | "grant" | "refund";
  readonly attemptId: string | null;
  readonly paymentId: string | null;
  readonly note: string | null;
  readonly at: string;
}

export interface Payment {
  readonly id: string;
  readonly orderId: string;
  readonly paymentId: string | null;
  readonly credits: number;
  readonly taxablePaise: number;
  readonly taxPaise: number;
  readonly amountPaise: number;
  /** The buyer's GST state when the order was priced. */
  readonly buyerState: string | null;
  readonly status: "created" | "paid";
  readonly createdAt: string;
  readonly paidAt: string | null;
}

export interface Invoice {
  readonly id: string;
  readonly number: string;
  readonly kind: "credits" | "usage";
  readonly paymentId: string | null;
  readonly period: string | null;
  readonly document: Record<string, unknown>;
  readonly totalPaise: number;
  readonly issuedAt: string;
}

/** What starting an attempt did to the balance. */
export type Consumption =
  /** No billing account: not metered. */
  | "unmetered"
  /** Counted, and invoiced at the end of the month. */
  | "invoiced"
  | "consumed"
  /** This attempt had already consumed its credit: a retried start. */
  | "already"
  | "insufficient";

/** India's financial year, April to March, as GST numbers invoices by it: `2026-27`. */
export function financialYear(at: Date): string {
  // Invoices are dated in IST.
  const ist = new Date(at.getTime() + 330 * 60_000);
  const year = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
}

/** `PKS/2627/000123`: the prefix, the financial year's two short years, and the serial. Fifteen characters. */
export const invoiceNumber = (fy: string, serial: number): string => `PKS/${fy.slice(2, 4)}${fy.slice(5, 7)}/${String(serial).padStart(6, "0")}`;

interface AccountRow {
  mode: BillingMode;
  price_paise: number;
  credits: number;
  legal_name: string;
  gstin: string | null;
  state_code: string | null;
  address: string;
  billing_email: string | null;
  updated_at: string | Date;
}

const ACCOUNT = `mode, price_paise, credits, legal_name, gstin, state_code, address, billing_email, updated_at`;

const toAccount = (r: AccountRow): BillingAccount => ({
  mode: r.mode,
  pricePaise: Number(r.price_paise),
  credits: Number(r.credits),
  legalName: r.legal_name,
  gstin: r.gstin,
  stateCode: r.state_code,
  address: r.address,
  billingEmail: r.billing_email,
  updatedAt: new Date(r.updated_at).toISOString(),
});

interface PaymentRow {
  id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  credits: number;
  taxable_paise: number;
  tax_paise: number;
  amount_paise: number;
  buyer_state: string | null;
  status: "created" | "paid";
  created_at: string | Date;
  paid_at: string | Date | null;
}

const PAYMENT = `id, razorpay_order_id, razorpay_payment_id, credits, taxable_paise, tax_paise, amount_paise, buyer_state, status, created_at, paid_at`;

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  orderId: r.razorpay_order_id,
  paymentId: r.razorpay_payment_id,
  credits: Number(r.credits),
  taxablePaise: Number(r.taxable_paise),
  taxPaise: Number(r.tax_paise),
  amountPaise: Number(r.amount_paise),
  buyerState: r.buyer_state,
  status: r.status,
  createdAt: new Date(r.created_at).toISOString(),
  paidAt: r.paid_at === null ? null : new Date(r.paid_at).toISOString(),
});

interface InvoiceRow {
  id: string;
  number: string;
  kind: "credits" | "usage";
  payment_id: string | null;
  period: string | null;
  document: Record<string, unknown> | string;
  total_paise: number;
  issued_at: string | Date;
}

const INVOICE = `id, number, kind, payment_id, period, document, total_paise, issued_at`;

const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  number: r.number,
  kind: r.kind,
  paymentId: r.payment_id,
  period: r.period,
  document: typeof r.document === "string" ? (JSON.parse(r.document) as Record<string, unknown>) : r.document,
  totalPaise: Number(r.total_paise),
  issuedAt: new Date(r.issued_at).toISOString(),
});

/** Builds an invoice's document once its number is known, from the account and — for a purchase — the payment; returns it with its total. */
export type InvoiceBuilder = (
  number: string,
  issuedAt: Date,
  account: BillingAccount,
  payment: Payment | null,
) => { document: Record<string, unknown>; totalPaise: number };

export class BillingStore {
  readonly #sql: SqlExecutor;
  readonly #newId: () => string;

  constructor(sql: SqlExecutor, options: { readonly newId?: () => string } = {}) {
    this.#sql = sql;
    this.#newId = options.newId ?? (() => crypto.randomUUID());
  }

  async account(scope: Scope): Promise<BillingAccount | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<AccountRow>(`SELECT ${ACCOUNT} FROM billing_accounts WHERE org_id = $1`, [scope.orgId]);
      return rows[0] === undefined ? null : toAccount(rows[0]);
    });
  }

  /** Set the plan: the operator's decision, not the customer's (see `billing-cli`). */
  async setPlan(scope: Scope, mode: BillingMode, pricePaise: number): Promise<BillingAccount> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<AccountRow>(
        `INSERT INTO billing_accounts (org_id, mode, price_paise) VALUES ($1, $2, $3)
         ON CONFLICT (org_id) DO UPDATE SET mode = EXCLUDED.mode, price_paise = EXCLUDED.price_paise, updated_at = now()
         RETURNING ${ACCOUNT}`,
        [scope.orgId, mode, pricePaise],
      );
      return toAccount(rows[0]!);
    });
  }

  /** The buyer's details for their invoices. Null if the organisation is not billed. */
  async updateBuyer(scope: Scope, buyer: BuyerDetails): Promise<BillingAccount | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<AccountRow>(
        `UPDATE billing_accounts SET legal_name = $2, gstin = $3, state_code = $4, address = $5, billing_email = $6, updated_at = now()
          WHERE org_id = $1 RETURNING ${ACCOUNT}`,
        [scope.orgId, buyer.legalName, buyer.gstin, buyer.stateCode, buyer.address, buyer.billingEmail],
      );
      return rows[0] === undefined ? null : toAccount(rows[0]);
    });
  }

  /**
   * Spend one credit on starting `attemptId`, or say why not. Takes the
   * account's row lock, so concurrent starts cannot spend the same credit; and
   * an attempt spends at most one, however often its start is retried.
   */
  async consume(scope: Scope, attemptId: string): Promise<Consumption> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ mode: BillingMode; credits: number }>(
        `SELECT mode, credits FROM billing_accounts WHERE org_id = $1 FOR UPDATE`,
        [scope.orgId],
      );
      const account = rows[0];
      if (account === undefined) return "unmetered";
      if (account.mode === "invoiced") return "invoiced";
      const spent = await tx.query(`SELECT 1 FROM credit_ledger WHERE org_id = $1 AND attempt_id = $2 AND reason = 'attempt'`, [
        scope.orgId,
        attemptId,
      ]);
      if (spent.length > 0) return "already";
      if (Number(account.credits) < 1) return "insufficient";
      await tx.query(`INSERT INTO credit_ledger (org_id, id, delta, reason, attempt_id) VALUES ($1, $2, -1, 'attempt', $3)`, [
        scope.orgId,
        this.#newId(),
        attemptId,
      ]);
      await tx.query(`UPDATE billing_accounts SET credits = credits - 1 WHERE org_id = $1`, [scope.orgId]);
      return "consumed";
    });
  }

  /** Give back the credit an attempt consumed, when the attempt then failed to start. */
  async refund(scope: Scope, attemptId: string): Promise<void> {
    await withScope(this.#sql, scope, async (tx) => {
      const [spent, refunded] = await Promise.all([
        tx.query(`SELECT 1 FROM credit_ledger WHERE org_id = $1 AND attempt_id = $2 AND reason = 'attempt'`, [scope.orgId, attemptId]),
        tx.query(`SELECT 1 FROM credit_ledger WHERE org_id = $1 AND attempt_id = $2 AND reason = 'refund'`, [scope.orgId, attemptId]),
      ]);
      if (spent.length === 0 || refunded.length > 0) return;
      await tx.query(`INSERT INTO credit_ledger (org_id, id, delta, reason, attempt_id, note) VALUES ($1, $2, 1, 'refund', $3, 'attempt did not start')`, [
        scope.orgId,
        this.#newId(),
        attemptId,
      ]);
      await tx.query(`UPDATE billing_accounts SET credits = credits + 1 WHERE org_id = $1`, [scope.orgId]);
    });
  }

  /** Credits given without payment — a trial, a goodwill gesture. The operator's, with a note. */
  async grant(scope: Scope, credits: number, note: string): Promise<BillingAccount> {
    return withScope(this.#sql, scope, async (tx) => {
      await tx.query(`INSERT INTO credit_ledger (org_id, id, delta, reason, note) VALUES ($1, $2, $3, 'grant', $4)`, [
        scope.orgId,
        this.#newId(),
        credits,
        note,
      ]);
      const rows = await tx.query<AccountRow>(`UPDATE billing_accounts SET credits = credits + $2 WHERE org_id = $1 RETURNING ${ACCOUNT}`, [
        scope.orgId,
        credits,
      ]);
      if (rows[0] === undefined) throw new Error("This organisation has no billing account");
      return toAccount(rows[0]);
    });
  }

  async history(scope: Scope, limit = 200): Promise<readonly CreditMovement[]> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{
        id: string;
        delta: number;
        reason: CreditMovement["reason"];
        attempt_id: string | null;
        payment_id: string | null;
        note: string | null;
        created_at: string | Date;
      }>(
        `SELECT id, delta, reason, attempt_id, payment_id, note, created_at FROM credit_ledger
          WHERE org_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
        [scope.orgId, limit],
      );
      return rows.map((r) => ({
        id: r.id,
        delta: Number(r.delta),
        reason: r.reason,
        attemptId: r.attempt_id,
        paymentId: r.payment_id,
        note: r.note,
        at: new Date(r.created_at).toISOString(),
      }));
    });
  }

  // --- payments -------------------------------------------------------------

  async createPayment(
    scope: Scope,
    payment: {
      readonly id: string;
      readonly orderId: string;
      readonly credits: number;
      readonly taxablePaise: number;
      readonly taxPaise: number;
      readonly amountPaise: number;
      readonly buyerState: string | null;
    },
  ): Promise<Payment> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<PaymentRow>(
        `INSERT INTO payments (org_id, id, razorpay_order_id, credits, taxable_paise, tax_paise, amount_paise, buyer_state)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${PAYMENT}`,
        [scope.orgId, payment.id, payment.orderId, payment.credits, payment.taxablePaise, payment.taxPaise, payment.amountPaise, payment.buyerState],
      );
      return toPayment(rows[0]!);
    });
  }

  async paymentByOrder(scope: Scope, orderId: string): Promise<Payment | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<PaymentRow>(`SELECT ${PAYMENT} FROM payments WHERE org_id = $1 AND razorpay_order_id = $2`, [scope.orgId, orderId]);
      return rows[0] === undefined ? null : toPayment(rows[0]);
    });
  }

  async payments(scope: Scope): Promise<readonly Payment[]> {
    return withScope(this.#sql, scope, async (tx) =>
      (await tx.query<PaymentRow>(`SELECT ${PAYMENT} FROM payments WHERE org_id = $1 ORDER BY created_at DESC`, [scope.orgId])).map(toPayment),
    );
  }

  /**
   * Record a payment as made, once: add its credits and issue its tax invoice
   * in the same transaction. The browser's confirmation and Razorpay's webhook
   * both arrive, in either order; the second finds it paid and changes nothing.
   * Returns null for an order this organisation never created.
   */
  async markPaid(
    scope: Scope,
    orderId: string,
    razorpayPaymentId: string,
    build: InvoiceBuilder,
    at: Date,
  ): Promise<{ readonly payment: Payment; readonly invoice: Invoice; readonly newlyPaid: boolean } | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const found = await tx.query<PaymentRow>(`SELECT ${PAYMENT} FROM payments WHERE org_id = $1 AND razorpay_order_id = $2 FOR UPDATE`, [
        scope.orgId,
        orderId,
      ]);
      const payment = found[0];
      if (payment === undefined) return null;
      if (payment.status === "paid") {
        const invoice = await tx.query<InvoiceRow>(`SELECT ${INVOICE} FROM invoices WHERE org_id = $1 AND payment_id = $2`, [scope.orgId, payment.id]);
        return { payment: toPayment(payment), invoice: toInvoice(invoice[0]!), newlyPaid: false };
      }
      const paid = await tx.query<PaymentRow>(
        `UPDATE payments SET status = 'paid', razorpay_payment_id = $3, paid_at = $4 WHERE org_id = $1 AND id = $2 RETURNING ${PAYMENT}`,
        [scope.orgId, payment.id, razorpayPaymentId, at.toISOString()],
      );
      await tx.query(`INSERT INTO credit_ledger (org_id, id, delta, reason, payment_id) VALUES ($1, $2, $3, 'purchase', $4)`, [
        scope.orgId,
        this.#newId(),
        payment.credits,
        payment.id,
      ]);
      const accounts = await tx.query<AccountRow>(`UPDATE billing_accounts SET credits = credits + $2 WHERE org_id = $1 RETURNING ${ACCOUNT}`, [
        scope.orgId,
        payment.credits,
      ]);
      if (accounts[0] === undefined) throw new Error("This organisation has no billing account");
      const invoice = await this.#issue(tx, scope, toAccount(accounts[0]), { kind: "credits", payment: toPayment(paid[0]!), period: null }, build, at);
      return { payment: toPayment(paid[0]!), invoice, newlyPaid: true };
    });
  }

  // --- invoices -------------------------------------------------------------

  /**
   * Attempts started in `[from, to)`: what an invoiced organisation is billed
   * for. Counted from the ledger's `attempt_started` entries — the time the
   * record itself gives, which a candidate's receipt shows too.
   */
  async attemptsStarted(scope: Scope, from: Date, to: Date): Promise<number> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<{ n: number | string }>(
        `SELECT count(*) AS n FROM exam_ledger WHERE org_id = $1 AND event_type = 'attempt_started' AND ts >= $2 AND ts < $3`,
        [scope.orgId, from.getTime(), to.getTime()],
      );
      return Number(rows[0]?.n ?? 0);
    });
  }

  /** Issue the usage invoice for a month (`2026-10`), once. Returns the existing one if it was issued before. */
  async issueUsageInvoice(scope: Scope, period: string, build: InvoiceBuilder, at: Date): Promise<{ readonly invoice: Invoice; readonly created: boolean }> {
    return withScope(this.#sql, scope, async (tx) => {
      const existing = await tx.query<InvoiceRow>(`SELECT ${INVOICE} FROM invoices WHERE org_id = $1 AND kind = 'usage' AND period = $2`, [
        scope.orgId,
        period,
      ]);
      if (existing[0] !== undefined) return { invoice: toInvoice(existing[0]), created: false };
      const accounts = await tx.query<AccountRow>(`SELECT ${ACCOUNT} FROM billing_accounts WHERE org_id = $1 FOR UPDATE`, [scope.orgId]);
      if (accounts[0] === undefined) throw new Error("This organisation has no billing account");
      const invoice = await this.#issue(tx, scope, toAccount(accounts[0]), { kind: "usage", payment: null, period }, build, at);
      return { invoice, created: true };
    });
  }

  async invoices(scope: Scope): Promise<readonly Invoice[]> {
    return withScope(this.#sql, scope, async (tx) =>
      (await tx.query<InvoiceRow>(`SELECT ${INVOICE} FROM invoices WHERE org_id = $1 ORDER BY issued_at DESC, number DESC`, [scope.orgId])).map(toInvoice),
    );
  }

  async invoice(scope: Scope, id: string): Promise<Invoice | null> {
    return withScope(this.#sql, scope, async (tx) => {
      const rows = await tx.query<InvoiceRow>(`SELECT ${INVOICE} FROM invoices WHERE org_id = $1 AND id = $2`, [scope.orgId, id]);
      return rows[0] === undefined ? null : toInvoice(rows[0]);
    });
  }

  /**
   * Number and store an invoice. The serial is taken in the transaction that
   * stores it, so a failure leaves no gap in the series — GST expects one
   * consecutive series per financial year.
   */
  async #issue(
    tx: SqlExecutor,
    scope: Scope,
    account: BillingAccount,
    what: { readonly kind: Invoice["kind"]; readonly payment: Payment | null; readonly period: string | null },
    build: InvoiceBuilder,
    at: Date,
  ): Promise<Invoice> {
    const fy = financialYear(at);
    const counter = await tx.query<{ last: number }>(
      `INSERT INTO invoice_counters (fy, last) VALUES ($1, 1) ON CONFLICT (fy) DO UPDATE SET last = invoice_counters.last + 1 RETURNING last`,
      [fy],
    );
    const number = invoiceNumber(fy, Number(counter[0]!.last));
    const { document, totalPaise } = build(number, at, account, what.payment);
    const rows = await tx.query<InvoiceRow>(
      `INSERT INTO invoices (org_id, id, number, kind, payment_id, period, document, total_paise, issued_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${INVOICE}`,
      [scope.orgId, this.#newId(), number, what.kind, what.payment?.id ?? null, what.period, JSON.stringify(document), totalPaise, at.toISOString()],
    );
    return toInvoice(rows[0]!);
  }
}
