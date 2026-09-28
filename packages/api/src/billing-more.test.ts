import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { BillingStore, pgliteExecutor, staffScope, type IdentityStore } from "@parikshaa/store";
import type { BillingService } from "./billing.js";
import { fakeModel } from "./fake-model.js";
import { eInvoicePayload, tdsOn } from "./gst.js";
import type { FakeRazorpay } from "./razorpay.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * ROADMAP §12, finished: refunds of unspent credits with GST credit notes,
 * TDS on invoices, e-invoicing's payload and IRN, and the monthly run.
 * Runs as `parikshaa_app`.
 */

const OCT = Date.parse("2026-10-01T04:30:00Z");
const ORG = orgId("org-a");
const MAHARASHTRA_GSTIN = "27AAACR5055K1Z7";
const KARNATAKA_GSTIN = "29AAGCP4401A1ZW";

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let billing: BillingService;
let razorpay: FakeRazorpay;
let plans: BillingStore;
let clock: number;
let owner: string;

beforeEach(async () => {
  clock = OCT;
  db = await freshDatabase();
  ({ app, identity, billing, razorpay } = await wire(pgliteExecutor(db), { client: fakeModel().client, now: () => clock }));
  await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, ORG, "owner@acme.test", "owner", "Asha Rao");
  await db.exec(`SET ROLE parikshaa_app`);
  plans = new BillingStore(pgliteExecutor(db));
  owner = await signIn(app, "owner@acme.test");
  await call("POST", owner, "/exams", {
    id: "drive",
    title: "Drive",
    questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
    policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({ method, url, headers: token === null ? {} : bearer(token), ...(payload === undefined ? {} : { payload }) });

const details = (gstin: string | null) =>
  call("PUT", owner, "/billing/details", { legalName: "Acme Technologies Pvt Ltd", gstin, stateCode: null, address: "4th Floor, Nirlon Park, Goregaon, Mumbai 400063", billingEmail: "accounts@acme.test" });

/** Buy `credits` and pay for them as Razorpay's Checkout would. */
async function buy(credits: number, paymentId: string) {
  const placed = (await call("POST", owner, "/billing/orders", { credits })).json() as { orderId: string };
  const paid = await call("POST", owner, "/billing/payments/verify", { orderId: placed.orderId, paymentId, signature: razorpay.sign(placed.orderId, paymentId) });
  expect(paid.statusCode, paid.payload).toBe(200);
  return paid.json().invoice as { id: string; number: string };
}

describe("refunds", () => {
  beforeEach(async () => {
    await plans.setPlan(staffScope(ORG), "prepaid", 5000);
    await details(MAHARASHTRA_GSTIN);
  });

  it("give back unspent credits through Razorpay, with a credit note against the invoice", async () => {
    const invoice = await buy(100, "pay_100");
    const { refund, creditNote } = await billing.refundPayment(ORG, { payment: "pay_100", credits: 40, reason: "Drive cancelled" });

    expect(refund).toMatchObject({ credits: 40, taxablePaise: 200_000, taxPaise: 36_000, amountPaise: 236_000, status: "processed" });
    expect(razorpay.refunds).toEqual([{ id: refund.razorpayRefundId, paymentId: "pay_100", amountPaise: 236_000, notes: expect.objectContaining({ creditNoteFor: invoice.number }) }]);
    expect(creditNote.number).toMatch(/^PKC\/2627\/000001$/);
    expect(creditNote.kind).toBe("credit_note");
    expect(creditNote.againstInvoice).toBe(invoice.id);
    expect(creditNote.document).toMatchObject({
      title: "Credit Note",
      against: { number: invoice.number },
      reason: "Drive cancelled",
      placeOfSupply: { code: "27" },
      taxes: [{ name: "IGST", ratePercent: 18, amountPaise: 36_000 }],
      totalPaise: 236_000,
    });

    const summary = (await call("GET", owner, "/billing")).json();
    expect(summary.account.credits).toBe(60);
    expect(summary.refunds).toHaveLength(1);
    expect(summary.history[0]).toMatchObject({ reason: "payment_refund", delta: -40 });
  });

  it("add up to the payment exactly when the rest is refunded, and never more than was bought", async () => {
    await buy(3, "pay_3");
    await billing.refundPayment(ORG, { payment: "pay_3", credits: 1, reason: "a" });
    await billing.refundPayment(ORG, { payment: "pay_3", credits: 2, reason: "b" });
    expect(razorpay.refunds.reduce((sum, r) => sum + r.amountPaise, 0)).toBe(17_700);
    await expect(billing.refundPayment(ORG, { payment: "pay_3", credits: 1, reason: "c" })).rejects.toThrow(/more credits than the payment bought/);
  });

  it("refuse credits already spent", async () => {
    await buy(1, "pay_1");
    expect((await call("POST", owner, "/exams/drive/attempts", { candidateId: "c1" })).statusCode).toBe(201);
    await expect(billing.refundPayment(ORG, { payment: "pay_1", credits: 1, reason: "x" })).rejects.toThrow(/spent/);
    expect(razorpay.refunds).toHaveLength(0);
  });

  it("put the credits back when Razorpay refuses", async () => {
    await buy(10, "pay_10");
    razorpay.refuseRefunds = true;
    await expect(billing.refundPayment(ORG, { payment: "pay_10", credits: 10, reason: "x" })).rejects.toThrow(/refused/);
    const summary = (await call("GET", owner, "/billing")).json();
    expect(summary.account.credits).toBe(10);
    expect(summary.refunds[0].status).toBe("failed");
    expect(summary.history.slice(0, 2).map((m: { reason: string }) => m.reason)).toEqual(["refund_reversed", "payment_refund"]);
    // Nothing numbered: the credit-note series has no gap.
    razorpay.refuseRefunds = false;
    expect((await billing.refundPayment(ORG, { payment: "pay_10", credits: 10, reason: "y" })).creditNote.number).toBe("PKC/2627/000001");
  });
});

describe("TDS", () => {
  it("shows on an invoiced organisation's usage invoice: what to deduct, and what to pay", async () => {
    await plans.setPlan(staffScope(ORG), "invoiced", 10_000);
    await details(KARNATAKA_GSTIN);
    await billing.setTds(ORG, 2);
    await call("POST", owner, "/exams/drive/attempts", { candidateId: "c1" });
    clock = Date.parse("2026-11-02T00:00:00Z");
    const { invoice } = await billing.issueUsageInvoice(ORG, "2026-10");
    expect(invoice.document).toMatchObject({ totalPaise: 11_800, tds: { section: "194J", ratePercent: 2, amountPaise: 200, netPayablePaise: 11_600 } });

    const certificate = await billing.recordTdsCertificate(ORG, { invoiceNumber: invoice.number, amountPaise: 200, certificate: "ABCD1234EF", quarter: "2026-27 Q3" });
    expect(certificate.amountPaise).toBe(200);
    expect((await call("GET", owner, "/billing")).json().tdsCertificates).toHaveLength(1);
    await expect(billing.setTds(ORG, 5)).rejects.toThrow(/0, 1, 2 or 10/);
  });

  it("is worked out on the value before GST", () => {
    expect(tdsOn(100_000, 118_000, 10)).toEqual({ section: "194J", ratePercent: 10, amountPaise: 10_000, netPayablePaise: 108_000 });
  });
});

describe("e-invoicing", () => {
  it("writes the invoice in the IRP's schema, and prints the IRN once recorded", async () => {
    await plans.setPlan(staffScope(ORG), "prepaid", 5000);
    await details(MAHARASHTRA_GSTIN);
    const invoice = await buy(100, "pay_e");
    const payload = await billing.eInvoiceJson(ORG, invoice.number);
    expect(payload).toMatchObject({
      Version: "1.1",
      TranDtls: { TaxSch: "GST", SupTyp: "B2B", RegRev: "N" },
      DocDtls: { Typ: "INV", No: invoice.number, Dt: "01/10/2026" },
      SellerDtls: { Gstin: KARNATAKA_GSTIN, Pin: 560025, Stcd: "29" },
      BuyerDtls: { Gstin: MAHARASHTRA_GSTIN, Pos: "27", Pin: 400063, Stcd: "27" },
      ItemList: [{ SlNo: "1", IsServc: "Y", HsnCd: "998399", Qty: 100, UnitPrice: 50, AssAmt: 5000, GstRt: 18, IgstAmt: 900, TotItemVal: 5900 }],
      ValDtls: { AssVal: 5000, IgstVal: 900, CgstVal: 0, SgstVal: 0, TotInvVal: 5900 },
    });

    const irn = "a".repeat(64);
    await expect(billing.recordIrn(ORG, invoice.number, { irn: "short", ackNo: "1", ackDate: "x", signedQr: "q" })).rejects.toThrow(/64/);
    await billing.recordIrn(ORG, invoice.number, { irn, ackNo: "112010036563310", ackDate: "2026-10-01 10:15:00", signedQr: "eyJhbGciOi.signed.qr" });
    const shown = (await call("GET", owner, `/billing/invoices/${invoice.id}`)).json();
    expect(shown.eInvoice).toMatchObject({ irn, ackNo: "112010036563310", signedQr: "eyJhbGciOi.signed.qr" });
  });

  it("refuses a buyer without a GSTIN, since only business supplies are e-invoiced", () => {
    expect(() =>
      eInvoicePayload({ title: "Tax Invoice", buyer: { gstin: null, address: "x" }, supplier: { address: "y" } }, new Date(OCT)),
    ).toThrow(/GSTIN/);
  });
});

describe("the monthly run", () => {
  it("issues last month's invoice to invoiced organisations, once however often it runs", async () => {
    await plans.setPlan(staffScope(ORG), "invoiced", 5000);
    await details(KARNATAKA_GSTIN);
    await call("POST", owner, "/exams/drive/attempts", { candidateId: "c1" });
    clock = Date.parse("2026-11-01T02:00:00Z"); // 07:30 IST on the 1st
    expect(await billing.invoiceLastMonth([ORG])).toBe(1);
    expect(await billing.invoiceLastMonth([ORG])).toBe(0);
    const invoices = (await call("GET", owner, "/billing")).json().invoices;
    expect(invoices).toEqual([expect.objectContaining({ kind: "usage", period: "2026-10" })]);
  });
});
