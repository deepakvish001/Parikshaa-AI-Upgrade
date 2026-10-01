import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { BillingStore, pgliteExecutor, staffScope, type IdentityStore } from "@parikshaa/store";
import type { BillingService } from "./billing.js";
import { fakeModel } from "./fake-model.js";
import { rupeesInWords, taxesOn, validGstin } from "./gst.js";
import { InviteCodes } from "./invite-codes.js";
import type { FakeRazorpay } from "./razorpay.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** ROADMAP §12: prepaid credits enforced, Razorpay payments credited once, GST invoices. Runs as `parikshaa_app`. */

const OCT = Date.parse("2026-10-01T04:30:00Z");
const ORG = orgId("org-a");
const KARNATAKA_GSTIN = "29AAGCP4401A1ZW"; // the tests' supplier's own state
const MAHARASHTRA_GSTIN = "27AAACR5055K1Z7";

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
  await addStaff(identity, ORG, "inv@acme.test", "invigilator");
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

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object, headers: Record<string, string> = {}) =>
  app.inject({ method, url, headers: { ...(token === null ? {} : bearer(token)), ...headers }, ...(payload === undefined ? {} : { payload }) });

const start = () => call("POST", owner, "/exams/drive/attempts", { candidateId: "c1" });
const details = (gstin: string | null, stateCode: string | null = null) =>
  call("PUT", owner, "/billing/details", { legalName: "Acme Technologies Pvt Ltd", gstin, stateCode, address: "1 MG Road", billingEmail: "accounts@acme.test" });

describe("credits", () => {
  it("leave an organisation without a plan unmetered", async () => {
    expect((await start()).statusCode).toBe(201);
    expect((await call("GET", owner, "/billing")).json().account).toBeNull();
  });

  it("are spent one per attempt, and an attempt without one does not start", async () => {
    await plans.setPlan(staffScope(ORG), "prepaid", 5000);
    const refused = await start();
    expect(refused.statusCode).toBe(402);
    expect(refused.json().error).toBe("out_of_credits");

    await plans.grant(staffScope(ORG), 1, "trial");
    expect((await start()).statusCode).toBe(201);
    expect((await start()).statusCode).toBe(402);
    expect((await call("GET", owner, "/billing")).json().account.credits).toBe(0);
  });

  it("are spent once per candidate who opens their link, however often they open it", async () => {
    await plans.setPlan(staffScope(ORG), "prepaid", 5000);
    await call("PUT", owner, "/exams/drive/window", { opensAt: new Date(OCT - 60_000).toISOString(), closesAt: new Date(OCT + 3_600_000).toISOString() });
    await call("POST", owner, "/exams/drive/invitations/import", { csv: "ref,name,email\nR1,Ananya,a@c.test\nR2,Bala,b@c.test", dryRun: false, channels: [] });
    const list = (await call("GET", owner, "/exams/drive/invitations")).json().invitations as { id: string; candidateRef: string }[];
    const redeem = (ref: string) =>
      call("POST", null, "/invitations/redeem", { code: new InviteCodes(TOKEN_SECRET).issue("org-a", list.find((i) => i.candidateRef === ref)!.id) });

    expect((await redeem("R1")).statusCode).toBe(402);
    await plans.grant(staffScope(ORG), 1, "trial");
    expect((await redeem("R1")).statusCode).toBe(200);
    expect((await redeem("R1")).statusCode).toBe(200); // resumed: nothing more spent
    expect((await redeem("R2")).statusCode).toBe(402);
    expect((await call("GET", owner, "/billing")).json().history.map((m: { reason: string }) => m.reason)).toEqual(["attempt", "grant"]);
  });

  it("are counted, not spent, for an invoiced organisation", async () => {
    await plans.setPlan(staffScope(ORG), "invoiced", 5000);
    expect((await start()).statusCode).toBe(201);
  });
});

describe("the buyer's details", () => {
  beforeEach(async () => {
    await plans.setPlan(staffScope(ORG), "prepaid", 5000);
  });

  it("take a GSTIN, check digit and all, and the state it is registered in", async () => {
    const saved = await details(MAHARASHTRA_GSTIN);
    expect(saved.statusCode, saved.payload).toBe(200);
    expect(saved.json()).toMatchObject({ gstin: MAHARASHTRA_GSTIN, stateCode: "27" });
    expect((await details("27AAACR5055K1Z8")).statusCode).toBe(422);
    expect((await details(MAHARASHTRA_GSTIN, "29")).statusCode).toBe(422);
    expect((await details(null, "29")).json()).toMatchObject({ gstin: null, stateCode: "29" });
  });

  it("are the owner's to keep", async () => {
    const invigilator = await signIn(app, "inv@acme.test");
    expect((await call("GET", invigilator, "/billing")).statusCode).toBe(403);
    expect((await call("PUT", invigilator, "/billing/details", { legalName: "x", gstin: null, stateCode: null, address: "", billingEmail: null })).statusCode).toBe(403);
  });
});

describe("buying credits", () => {
  beforeEach(async () => {
    await plans.setPlan(staffScope(ORG), "prepaid", 5000);
  });

  async function order(credits = 100) {
    const res = await call("POST", owner, "/billing/orders", { credits });
    expect(res.statusCode, res.payload).toBe(201);
    return res.json() as { orderId: string; amountPaise: number; taxPaise: number; taxablePaise: number; keyId: string };
  }

  it("prices an order at the organisation's rate, with CGST and SGST inside the supplier's state", async () => {
    await details(KARNATAKA_GSTIN);
    const placed = await order(100);
    expect(placed).toMatchObject({ taxablePaise: 500_000, taxPaise: 90_000, amountPaise: 590_000, keyId: "rzp_test_fake" });
    expect(razorpay.orders.at(-1)).toMatchObject({ id: placed.orderId, amountPaise: 590_000, notes: { orgId: "org-a" } });
  });

  it("needs the organisation's legal name first, and a whole number of credits", async () => {
    expect((await call("POST", owner, "/billing/orders", { credits: 100 })).statusCode).toBe(422);
    await details(null, "29");
    expect((await call("POST", owner, "/billing/orders", { credits: 0 })).statusCode).toBe(400);
  });

  it("credits a payment only when Razorpay's signature checks out, and only once", async () => {
    await details(MAHARASHTRA_GSTIN);
    const placed = await order(100);

    const forged = await call("POST", owner, "/billing/payments/verify", { orderId: placed.orderId, paymentId: "pay_1", signature: "0".repeat(64) });
    expect(forged.statusCode).toBe(422);
    expect((await call("GET", owner, "/billing")).json().account.credits).toBe(0);

    const verify = () => call("POST", owner, "/billing/payments/verify", { orderId: placed.orderId, paymentId: "pay_1", signature: razorpay.sign(placed.orderId, "pay_1") });
    const paid = await verify();
    expect(paid.statusCode, paid.payload).toBe(200);
    expect(paid.json().credits).toBe(100);
    const invoice = paid.json().invoice;
    expect(invoice.number).toMatch(/^PKS\/2627\/\d{6}$/);
    // Out of state: IGST at 18%, and the total in words.
    expect(invoice.document).toMatchObject({
      title: "Tax Invoice",
      supplier: { gstin: KARNATAKA_GSTIN, stateCode: "29" },
      buyer: { legalName: "Acme Technologies Pvt Ltd", gstin: MAHARASHTRA_GSTIN, stateCode: "27" },
      placeOfSupply: { code: "27", state: "Maharashtra" },
      lines: [{ quantity: 100, ratePaise: 5000, sac: "998399", amountPaise: 500_000 }],
      taxes: [{ name: "IGST", ratePercent: 18, amountPaise: 90_000 }],
      totalPaise: 590_000,
      totalInWords: "Rupees Five Thousand Nine Hundred Only",
    });

    expect((await verify()).json().invoice.number).toBe(invoice.number);
    const summary = (await call("GET", owner, "/billing")).json();
    expect(summary.account.credits).toBe(100);
    expect(summary.invoices).toHaveLength(1);
    expect((await call("GET", owner, `/billing/invoices/${invoice.id}`)).json().number).toBe(invoice.number);
    const actions = (await call("GET", owner, "/audit")).json().entries.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(["billing.order_created", "billing.paid"]));
  });

  it("credits a payment Razorpay's webhook reports, when the browser never came back", async () => {
    await details(KARNATAKA_GSTIN);
    const placed = await order(10);
    const body = JSON.stringify({
      event: "order.paid",
      payload: {
        payment: { entity: { id: "pay_9", order_id: placed.orderId, notes: { orgId: "org-a" } } },
        order: { entity: { id: placed.orderId, notes: { orgId: "org-a" } } },
      },
    });
    const hook = (signature: string) =>
      call("POST", null, "/billing/razorpay/webhook", undefined, { "content-type": "application/json", "x-razorpay-signature": signature });
    const send = (signature: string) =>
      app.inject({ method: "POST", url: "/billing/razorpay/webhook", headers: { "content-type": "application/json", "x-razorpay-signature": signature }, payload: body });

    expect((await send("f".repeat(64))).statusCode).toBe(401);
    expect((await hook("")).statusCode).toBe(401);
    expect((await send(razorpay.signWebhook(body))).json()).toEqual({ handled: true });
    expect((await send(razorpay.signWebhook(body))).json()).toEqual({ handled: true });

    const summary = (await call("GET", owner, "/billing")).json();
    expect(summary.account.credits).toBe(10);
    expect(summary.invoices).toHaveLength(1);
    // Paid by webhook, then confirmed by the browser after all: nothing changes.
    const late = await call("POST", owner, "/billing/payments/verify", { orderId: placed.orderId, paymentId: "pay_9", signature: razorpay.sign(placed.orderId, "pay_9") });
    expect(late.json().credits).toBe(10);
  });

  it("is refused to an invoiced organisation, and when Razorpay is down", async () => {
    await details(KARNATAKA_GSTIN);
    razorpay.unavailable = true;
    expect((await call("POST", owner, "/billing/orders", { credits: 10 })).statusCode).toBe(502);
    razorpay.unavailable = false;
    await plans.setPlan(staffScope(ORG), "invoiced", 5000);
    expect((await call("POST", owner, "/billing/orders", { credits: 10 })).statusCode).toBe(409);
  });
});

describe("usage invoices", () => {
  it("bill an invoiced organisation for the attempts started in a month, in IST, once", async () => {
    await plans.setPlan(staffScope(ORG), "invoiced", 4000);
    await details(KARNATAKA_GSTIN);
    await start();
    await start();
    clock = Date.parse("2026-10-31T18:29:00Z"); // 23:59 IST, still October
    await start();
    clock = Date.parse("2026-10-31T18:31:00Z"); // 00:01 IST, November
    await start();

    await expect(billing.issueUsageInvoice(ORG, "2026-11")).rejects.toThrow(/not ended/);
    const { invoice, attempts, created } = await billing.issueUsageInvoice(ORG, "2026-10");
    expect({ attempts, created }).toEqual({ attempts: 3, created: true });
    expect(invoice.document).toMatchObject({
      lines: [{ description: "Assessment attempts started in October 2026", quantity: 3, ratePaise: 4000 }],
      taxes: [
        { name: "CGST", ratePercent: 9, amountPaise: 1080 },
        { name: "SGST", ratePercent: 9, amountPaise: 1080 },
      ],
      totalPaise: 14_160,
    });
    expect((await billing.issueUsageInvoice(ORG, "2026-10")).created).toBe(false);
  });
});

describe("GST arithmetic", () => {
  it("rounds each tax half up, and writes rupees the Indian way", () => {
    expect(taxesOn(1_001, "29", "29")).toMatchObject({ cgstPaise: 90, sgstPaise: 90, totalPaise: 1_181 });
    expect(taxesOn(1_001, "29", "27")).toMatchObject({ igstPaise: 180, totalPaise: 1_181 });
    expect(rupeesInWords(1_23_45_678_90)).toBe("Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only");
    expect(validGstin(KARNATAKA_GSTIN) && validGstin(MAHARASHTRA_GSTIN) && !validGstin("29AAGCP4401A1ZX")).toBe(true);
  });
});

describe("paying by bank transfer against a quotation", () => {
  beforeEach(async () => {
    await plans.setPlan(staffScope(ORG), "prepaid", 5000);
    await details(MAHARASHTRA_GSTIN);
  });

  it("quotes with the purchase order, prints the account to pay into, and credits once the transfer is recorded", async () => {
    expect((await call("GET", owner, "/billing")).json().bankTransfer).toBe(true);
    const made = await call("POST", owner, "/billing/quotations", { credits: 200, poNumber: "PO/2026/118" });
    expect(made.statusCode).toBe(201);
    const quote = made.json();
    expect(quote).toMatchObject({ credits: 200, taxablePaise: 1_000_000, taxPaise: 180_000, amountPaise: 1_180_000, poNumber: "PO/2026/118" });
    expect(quote.orderId).toMatch(/^neft_/);

    const pdf = await call("GET", owner, `/billing/quotations/${quote.id}/pdf`);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.body).toContain("(PO/2026/118)");
    expect(pdf.body).toContain("(HDFC0001234)");
    expect(pdf.body).toContain(`(${quote.orderId})`);

    // Nothing is credited on a quotation alone.
    expect((await call("GET", owner, "/billing")).json().account.credits).toBe(0);
    const first = await billing.recordTransfer(ORG, quote.orderId, "hdfcr52026100112345");
    expect(first).toMatchObject({ credits: 200, newlyPaid: true });
    const again = await billing.recordTransfer(ORG, quote.orderId, "HDFCR52026100112345");
    expect(again.newlyPaid).toBe(false);
    const summary = (await call("GET", owner, "/billing")).json();
    expect(summary.account.credits).toBe(200);
    expect(summary.payments.find((p: { id: string }) => p.id === quote.id)).toMatchObject({ status: "paid", poNumber: "PO/2026/118", paymentId: "utr_HDFCR52026100112345" });
    expect(summary.invoices).toHaveLength(1);
  });

  it("refuses a bad UTR, an unknown quotation, and an invoiced organisation", async () => {
    const quote = (await call("POST", owner, "/billing/quotations", { credits: 10 })).json();
    await expect(billing.recordTransfer(ORG, quote.orderId, "12")).rejects.toThrow(/UTR/);
    await expect(billing.recordTransfer(ORG, "neft_nope", "ABCDEFGH1234")).rejects.toThrow(/No such quotation/);
    await expect(billing.recordTransfer(ORG, "order_x", "ABCDEFGH1234")).rejects.toThrow(/neft_/);
    await plans.setPlan(staffScope(ORG), "invoiced", 5000);
    expect((await call("POST", owner, "/billing/quotations", { credits: 10 })).statusCode).toBe(409);
  });
});
