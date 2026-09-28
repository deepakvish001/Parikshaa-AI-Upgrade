import { orgId as toOrgId, type OrgId } from "@parikshaa/core";
import {
  staffScope,
  type LedgerStore,
  type BillingAccount,
  type BillingStore,
  type BuyerDetails,
  type CreditMovement,
  type IdentityStore,
  type EInvoice,
  type Invoice,
  type InvoiceBuilder,
  type Payment,
  type Refund,
  type TdsCertificate,
} from "@parikshaa/store";
import { STATES, creditNote, eInvoicePayload, stateOf, taxInvoice, taxesOn, validGstin, type Supplier } from "./gst.js";
import type { PaymentGateway } from "./razorpay.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Billing (ROADMAP §12).
 *
 * An organisation is either **prepaid** — every attempt starts against a
 * credit bought in advance, and none starts without one — or **invoiced**,
 * counted and billed monthly in arrears. Which one, and at what price, is the
 * operator's decision (`billing-cli`); the organisation's owner buys credits,
 * keeps the details their invoices carry, and reads the invoices.
 */

/** A prepaid organisation has no credits left. */
export class OutOfCredits extends Error {
  constructor() {
    super("This organisation has no attempt credits left. Its owner can buy more on the console's Billing page.");
    this.name = "OutOfCredits";
  }
}

/** Buying needs Razorpay and a supplier to invoice as; without either, there is nothing to buy through. */
export class BillingNotConfigured extends Error {
  constructor(what: string) {
    super(`Buying credits is not set up on this server: ${what}`);
    this.name = "BillingNotConfigured";
  }
}

export const MAX_CREDITS_PER_ORDER = 100_000;

export interface BillingSummary {
  readonly account: BillingAccount | null;
  readonly history: readonly CreditMovement[];
  readonly payments: readonly Payment[];
  readonly invoices: readonly Omit<Invoice, "document">[];
  readonly refunds: readonly Refund[];
  readonly tdsCertificates: readonly TdsCertificate[];
  /** Whether credits can be bought here, and the Razorpay key Checkout needs. */
  readonly checkout: { readonly available: boolean; readonly keyId: string | null };
  readonly supplier: { readonly legalName: string; readonly stateCode: string } | null;
}

export interface Order {
  readonly orderId: string;
  readonly keyId: string;
  readonly currency: "INR";
  readonly credits: number;
  readonly taxablePaise: number;
  readonly taxPaise: number;
  readonly amountPaise: number;
  readonly supplierName: string;
}

/** The first instant of a month in IST, and of the next: an invoice month is India's month. */
export function istMonth(period: string): { from: Date; to: Date } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (match === null) throw new AttemptError("invalid_state", `Not a month: ${period} (expected YYYY-MM)`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new AttemptError("invalid_state", `Not a month: ${period}`);
  const offset = 330 * 60_000;
  return { from: new Date(Date.UTC(year, month - 1, 1) - offset), to: new Date(Date.UTC(year, month, 1) - offset) };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export class BillingService {
  readonly #o: {
    readonly store: LedgerStore;
    readonly billing: BillingStore;
    readonly identity: IdentityStore;
    readonly exams: ExamService;
    readonly gateway: PaymentGateway | null;
    readonly supplier: Supplier | null;
    readonly now: () => number;
    readonly newId: () => string;
  };

  constructor(options: {
    store: LedgerStore;
    billing: BillingStore;
    identity: IdentityStore;
    exams: ExamService;
    gateway?: PaymentGateway | null;
    supplier?: Supplier | null;
    now?: () => number;
    newId?: () => string;
  }) {
    this.#o = {
      ...options,
      gateway: options.gateway ?? null,
      supplier: options.supplier ?? null,
      now: options.now ?? (() => Date.now()),
      newId: options.newId ?? (() => crypto.randomUUID()),
    };
  }

  #owner(actor: Actor) {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
    return staffScope(actor.orgId);
  }

  // --- metering: called when an attempt starts --------------------------------

  /**
   * Spend a credit on starting `attemptId`, or refuse the start. Idempotent: a
   * retried start of the same attempt spends nothing more.
   */
  async consume(orgId: OrgId, attemptId: string): Promise<void> {
    if ((await this.#o.billing.consume(staffScope(orgId), attemptId)) === "insufficient") throw new OutOfCredits();
  }

  /** Give the credit back when the attempt it was spent on then failed to start. */
  async refund(orgId: OrgId, attemptId: string): Promise<void> {
    await this.#o.billing.refund(staffScope(orgId), attemptId);
  }

  // --- the owner's side -------------------------------------------------------

  async summary(actor: Actor): Promise<BillingSummary> {
    const scope = this.#owner(actor);
    const [account, history, payments, invoices, refunds, tdsCertificates] = await Promise.all([
      this.#o.billing.account(scope),
      this.#o.billing.history(scope, 100),
      this.#o.billing.payments(scope),
      this.#o.billing.invoices(scope),
      this.#o.billing.refunds(scope),
      this.#o.billing.tdsCertificates(scope),
    ]);
    const { gateway, supplier } = this.#o;
    return {
      account,
      history,
      payments,
      invoices: invoices.map(({ document: _, ...rest }) => rest),
      refunds,
      tdsCertificates,
      checkout: { available: gateway !== null && supplier !== null && account?.mode === "prepaid", keyId: gateway?.keyId ?? null },
      supplier: supplier === null ? null : { legalName: supplier.legalName, stateCode: stateOf(supplier.gstin) },
    };
  }

  async updateBuyer(actor: Actor, details: BuyerDetails): Promise<BillingAccount> {
    const scope = this.#owner(actor);
    const gstin = details.gstin === null || details.gstin.trim() === "" ? null : details.gstin.trim().toUpperCase();
    const stateCode = details.stateCode === null || details.stateCode === "" ? null : details.stateCode;
    if (gstin !== null && !validGstin(gstin)) throw new AttemptError("invalid_billing", "That GSTIN is not valid: check it against your registration certificate");
    if (stateCode !== null && STATES[stateCode] === undefined) throw new AttemptError("invalid_billing", `Not a GST state code: ${stateCode}`);
    if (gstin !== null && stateCode !== null && stateOf(gstin) !== stateCode) {
      throw new AttemptError("invalid_billing", "The state must be the one the GSTIN is registered in (its first two digits)");
    }
    if (details.legalName.trim().length < 2) throw new AttemptError("invalid_billing", "Invoices need the organisation's legal name");
    const account = await this.#o.billing.updateBuyer(scope, {
      legalName: details.legalName.trim(),
      gstin,
      stateCode: stateCode ?? (gstin === null ? null : stateOf(gstin)),
      address: details.address.trim(),
      billingEmail: details.billingEmail === null || details.billingEmail.trim() === "" ? null : details.billingEmail.trim(),
    });
    if (account === null) throw new AttemptError("not_found", "This organisation is not billed");
    await this.#o.exams.recordAudit(actor, "billing.details_saved", actor.orgId, { gstin: gstin !== null });
    return account;
  }

  /** A Razorpay order for `credits`, priced at the organisation's rate plus GST. */
  async createOrder(actor: Actor, credits: number): Promise<Order> {
    const scope = this.#owner(actor);
    if (actor.kind !== "user") throw new Forbidden("org:manage");
    const { gateway, supplier } = this.#o;
    if (gateway === null) throw new BillingNotConfigured("no Razorpay keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)");
    if (supplier === null) throw new BillingNotConfigured("no supplier details to invoice as (PARIKSHAA_SUPPLIER_*)");
    if (!Number.isInteger(credits) || credits < 1 || credits > MAX_CREDITS_PER_ORDER) {
      throw new AttemptError("invalid_billing", `Buy between 1 and ${MAX_CREDITS_PER_ORDER} credits at a time`);
    }
    const account = await this.#o.billing.account(scope);
    if (account === null || account.mode !== "prepaid") throw new AttemptError("invalid_state", "Only a prepaid organisation buys credits");
    if (account.legalName === "") throw new AttemptError("invalid_billing", "Add the organisation's legal name for its invoices first");

    const taxablePaise = credits * account.pricePaise;
    const taxes = taxesOn(taxablePaise, stateOf(supplier.gstin), account.stateCode);
    const id = this.#o.newId();
    const order = await gateway.createOrder({ amountPaise: taxes.totalPaise, receipt: id, notes: { orgId: actor.orgId, paymentId: id } });
    await this.#o.billing.createPayment(scope, {
      id,
      orderId: order.id,
      credits,
      taxablePaise,
      taxPaise: taxes.taxPaise,
      amountPaise: taxes.totalPaise,
      buyerState: account.stateCode,
    });
    await this.#o.exams.recordAudit(actor, "billing.order_created", id, { credits, amountPaise: taxes.totalPaise });
    return {
      orderId: order.id,
      keyId: gateway.keyId,
      currency: "INR",
      credits,
      taxablePaise,
      taxPaise: taxes.taxPaise,
      amountPaise: taxes.totalPaise,
      supplierName: supplier.legalName,
    };
  }

  /** Checkout's confirmation, from the owner's browser: credited only if Razorpay's signature checks out. */
  async confirm(actor: Actor, orderId: string, paymentId: string, signature: string): Promise<{ invoice: Invoice; credits: number }> {
    const scope = this.#owner(actor);
    const gateway = this.#gateway();
    if (!gateway.verifyPayment(orderId, paymentId, signature)) {
      throw new AttemptError("invalid_billing", "That payment's signature does not check out; nothing was credited");
    }
    const paid = await this.#o.billing.markPaid(scope, orderId, paymentId, this.#creditsInvoice(), new Date(this.#o.now()));
    if (paid === null) throw new AttemptError("not_found", "No such order");
    if (paid.newlyPaid) {
      await this.#o.exams.recordAudit(actor, "billing.paid", paid.payment.id, { credits: paid.payment.credits, invoice: paid.invoice.number });
    }
    const account = await this.#o.billing.account(scope);
    return { invoice: paid.invoice, credits: account?.credits ?? 0 };
  }

  /**
   * Razorpay's webhook: the same payment, told server to server, so a
   * customer who closes the tab before Checkout returns is still credited.
   * Returns whether it recorded a payment; an event it does not act on is
   * acknowledged and ignored.
   */
  async webhook(rawBody: string, signature: string): Promise<{ handled: boolean }> {
    const gateway = this.#gateway();
    if (!gateway.verifyWebhook(rawBody, signature)) throw new WebhookRejected();
    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; order_id?: string; notes?: Record<string, string> } };
        order?: { entity?: { id?: string; notes?: Record<string, string> } };
      };
    };
    if (event.event !== "order.paid" && event.event !== "payment.captured") return { handled: false };
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;
    const orgId = order?.notes?.["orgId"] ?? payment?.notes?.["orgId"];
    const orderId = order?.id ?? payment?.order_id;
    if (orgId === undefined || orderId === undefined || payment?.id === undefined) return { handled: false };

    const scope = staffScope(toOrgId(orgId));
    const paid = await this.#o.billing.markPaid(scope, orderId, payment.id, this.#creditsInvoice(), new Date(this.#o.now()));
    if (paid === null) return { handled: false };
    if (paid.newlyPaid) {
      await this.#o.store.appendAudit(scope, {
        actorKind: "system",
        actorId: null,
        action: "billing.paid",
        target: paid.payment.id,
        detail: { credits: paid.payment.credits, invoice: paid.invoice.number, via: "webhook" },
      });
    }
    return { handled: true };
  }

  async invoices(actor: Actor): Promise<readonly Omit<Invoice, "document">[]> {
    return (await this.#o.billing.invoices(this.#owner(actor))).map(({ document: _, ...rest }) => rest);
  }

  async invoice(actor: Actor, id: string): Promise<Invoice & { readonly eInvoice: EInvoice | null }> {
    const scope = this.#owner(actor);
    const found = await this.#o.billing.invoice(scope, id);
    if (found === null) throw new AttemptError("not_found", "No such invoice");
    return { ...found, eInvoice: await this.#o.billing.eInvoice(scope, id) };
  }

  // --- refunds, TDS and e-invoicing: the operator's (billing-cli) ----------------------------

  /**
   * Refund unspent credits of one payment through Razorpay, and issue the GST
   * credit note against the payment's invoice. The credits are taken back
   * first, under lock, so they cannot be spent while the money goes back;
   * if Razorpay refuses, they are restored and the refund is marked failed.
   */
  async refundPayment(orgId: OrgId, input: { readonly payment: string; readonly credits: number; readonly reason: string }): Promise<{ refund: Refund; creditNote: Invoice }> {
    const supplier = this.#o.supplier;
    if (supplier === null) throw new BillingNotConfigured("no supplier details to issue a credit note as (PARIKSHAA_SUPPLIER_*)");
    const gateway = this.#gateway();
    if (!Number.isInteger(input.credits) || input.credits < 1) throw new AttemptError("invalid_billing", "Refund a whole number of credits");
    if (input.reason.trim() === "") throw new AttemptError("invalid_billing", "A refund needs a reason: it is printed on the credit note");
    const scope = staffScope(orgId);
    const id = this.#o.newId();
    const reserved = await this.#o.billing.reserveRefund(scope, {
      id,
      payment: input.payment,
      credits: input.credits,
      reason: input.reason.trim(),
      price: (payment, before) => {
        // Everything left of the payment: exactly what remains, so the refunds add up to the payment.
        if (before.credits + input.credits === payment.credits) {
          return {
            taxablePaise: payment.taxablePaise - before.taxablePaise,
            taxPaise: payment.taxPaise - before.taxPaise,
            amountPaise: payment.amountPaise - before.amountPaise,
          };
        }
        const taxablePaise = Math.round((payment.taxablePaise * input.credits) / payment.credits);
        const taxes = taxesOn(taxablePaise, stateOf(supplier.gstin), payment.buyerState);
        return { taxablePaise, taxPaise: taxes.taxPaise, amountPaise: taxes.totalPaise };
      },
    });
    if (!reserved.ok) {
      const why = {
        no_payment: "No such payment for this organisation",
        not_paid: "That payment was never completed",
        more_than_bought: "That is more credits than the payment bought, less any refunded already",
        already_spent: "Those credits have been spent: only unspent credits can be refunded",
      }[reserved.refusal];
      throw new AttemptError("invalid_billing", why);
    }
    const { refund, payment, invoice } = reserved;
    let razorpayRefund: { id: string };
    try {
      razorpayRefund = await gateway.refund(payment.paymentId!, refund.amountPaise, { orgId, refundId: refund.id, creditNoteFor: invoice.number });
    } catch (error) {
      await this.#o.billing.failRefund(scope, refund.id);
      throw error;
    }
    const at = new Date(this.#o.now());
    const note = await this.#o.billing.completeRefund(
      scope,
      refund.id,
      razorpayRefund.id,
      invoice.id,
      (number, issuedAt, account) =>
        creditNote({
          number,
          issuedAt,
          supplier,
          buyer: { ...account, stateCode: payment.buyerState },
          original: { number: invoice.number, date: String(invoice.document["date"] ?? invoice.issuedAt.slice(0, 10)) },
          description: `Refund of ${refund.credits} unused assessment attempt credit${refund.credits === 1 ? "" : "s"}`,
          quantity: refund.credits,
          taxablePaise: refund.taxablePaise,
          taxPaise: refund.taxPaise,
          reason: refund.reason,
        }),
      at,
    );
    await this.#o.store.appendAudit(scope, {
      actorKind: "system",
      actorId: null,
      action: "billing.refunded",
      target: refund.id,
      detail: { credits: refund.credits, amountPaise: refund.amountPaise, creditNote: note.number, razorpayRefund: razorpayRefund.id },
    });
    return { refund: { ...refund, status: "processed", razorpayRefundId: razorpayRefund.id, creditNoteId: note.id }, creditNote: note };
  }

  /** The rate the buyer deducts at source, printed on invoices issued from now on. */
  async setTds(orgId: OrgId, percent: number): Promise<BillingAccount> {
    if (![0, 1, 2, 10].includes(percent)) throw new AttemptError("invalid_billing", "TDS under 194J is 0, 1, 2 or 10 percent");
    const account = await this.#o.billing.setTds(staffScope(orgId), percent as 0 | 1 | 2 | 10);
    if (account === null) throw new AttemptError("not_found", "This organisation has no billing account");
    return account;
  }

  /** A Form 16A the buyer sent, against one of its invoices. */
  async recordTdsCertificate(orgId: OrgId, input: { readonly invoiceNumber: string; readonly amountPaise: number; readonly certificate: string; readonly quarter: string }): Promise<TdsCertificate> {
    const scope = staffScope(orgId);
    const invoice = await this.#o.billing.invoiceByNumber(scope, input.invoiceNumber);
    if (invoice === null || invoice.kind === "credit_note") throw new AttemptError("not_found", `No invoice ${input.invoiceNumber} for this organisation`);
    if (!/^\d{4}-\d{2} Q[1-4]$/.test(input.quarter)) throw new AttemptError("invalid_billing", "The quarter reads like 2026-27 Q2");
    return this.#o.billing.recordTdsCertificate(scope, { invoiceId: invoice.id, amountPaise: input.amountPaise, certificate: input.certificate.trim(), quarter: input.quarter });
  }

  /** An invoice or credit note in the e-invoice schema, to upload to the IRP. */
  async eInvoiceJson(orgId: OrgId, invoiceNumber: string): Promise<Record<string, unknown>> {
    const invoice = await this.#o.billing.invoiceByNumber(staffScope(orgId), invoiceNumber);
    if (invoice === null) throw new AttemptError("not_found", `No invoice ${invoiceNumber} for this organisation`);
    return eInvoicePayload(invoice.document, new Date(invoice.issuedAt));
  }

  /** What the IRP returned for an invoice: its IRN, acknowledgement and signed QR code, printed from then on. */
  async recordIrn(orgId: OrgId, invoiceNumber: string, irp: { readonly irn: string; readonly ackNo: string; readonly ackDate: string; readonly signedQr: string }): Promise<EInvoice> {
    const scope = staffScope(orgId);
    const invoice = await this.#o.billing.invoiceByNumber(scope, invoiceNumber);
    if (invoice === null) throw new AttemptError("not_found", `No invoice ${invoiceNumber} for this organisation`);
    const irn = irp.irn.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(irn)) throw new AttemptError("invalid_billing", "An IRN is 64 hexadecimal characters");
    const record: EInvoice = { invoiceId: invoice.id, irn, ackNo: irp.ackNo.trim(), ackDate: irp.ackDate.trim(), signedQr: irp.signedQr.trim() };
    await this.#o.billing.recordEInvoice(scope, record);
    return record;
  }

  /**
   * Issue last month's usage invoice to every invoiced organisation that has
   * not had it: run daily, it does nothing after the first time each month.
   */
  async invoiceLastMonth(orgIds: readonly OrgId[]): Promise<number> {
    if (this.#o.supplier === null) return 0;
    const ist = new Date(this.#o.now() + 330 * 60_000);
    const last = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1));
    const period = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}`;
    let issued = 0;
    for (const orgId of orgIds) {
      const account = await this.#o.billing.account(staffScope(orgId));
      if (account?.mode !== "invoiced") continue;
      const { created } = await this.issueUsageInvoice(orgId, period);
      if (created) issued += 1;
    }
    return issued;
  }

  // --- the operator's side (billing-cli) --------------------------------------

  /** Issue an invoiced organisation's invoice for a month of attempts, once. */
  async issueUsageInvoice(orgId: OrgId, period: string): Promise<{ invoice: Invoice; created: boolean; attempts: number }> {
    const supplier = this.#o.supplier;
    if (supplier === null) throw new BillingNotConfigured("no supplier details to invoice as (PARIKSHAA_SUPPLIER_*)");
    const scope = staffScope(orgId);
    const { from, to } = istMonth(period);
    if (to.getTime() > this.#o.now()) throw new AttemptError("invalid_state", `${period} has not ended yet`);
    const attempts = await this.#o.billing.attemptsStarted(scope, from, to);
    const label = `${MONTHS[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;
    const build: InvoiceBuilder = (number, issuedAt, account) =>
      taxInvoice({
        number,
        issuedAt,
        supplier,
        buyer: account,
        lines: [{ description: `Assessment attempts started in ${label}`, quantity: attempts, ratePaise: account.pricePaise }],
        tdsPercent: account.tdsPercent,
      });
    const { invoice, created } = await this.#o.billing.issueUsageInvoice(scope, period, build, new Date(this.#o.now()));
    return { invoice, created, attempts };
  }

  #gateway(): PaymentGateway {
    if (this.#o.gateway === null) throw new BillingNotConfigured("no Razorpay keys (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)");
    return this.#o.gateway;
  }

  /** The invoice for a purchase of credits: what was bought, at the price it was bought at. */
  #creditsInvoice(): InvoiceBuilder {
    const supplier = this.#o.supplier;
    if (supplier === null) throw new BillingNotConfigured("no supplier details to invoice as (PARIKSHAA_SUPPLIER_*)");
    return (number, issuedAt, account, payment) => {
      if (payment === null) throw new Error("A credits invoice needs its payment");
      return taxInvoice({
        number,
        issuedAt,
        supplier,
        // Taxed as it was priced, even if the buyer's state has changed since.
        buyer: { ...account, stateCode: payment.buyerState },
        lines: [{ description: "Assessment attempt credits (prepaid)", quantity: payment.credits, ratePaise: payment.taxablePaise / payment.credits }],
        note: `Paid through Razorpay, payment ${payment.paymentId ?? ""}`,
      });
    };
  }
}

/** The webhook's signature did not check out. */
export class WebhookRejected extends Error {
  constructor() {
    super("The webhook's signature does not check out");
    this.name = "WebhookRejected";
  }
}
