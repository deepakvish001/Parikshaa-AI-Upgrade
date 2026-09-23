import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { BillingStore, financialYear, invoiceNumber, type InvoiceBuilder } from "./billing-store.js";
import { candidateScope, staffScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** ROADMAP §12: credits spent atomically, payments recorded once, invoices numbered without gaps. Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
const S = staffScope(A);

let db: PGlite;
let sql: SqlExecutor;
let billing: BillingStore;

const build: InvoiceBuilder = (number, _at, account) => ({ document: { number, buyer: account.legalName }, totalPaise: 1180 });

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  for (const id of [A, B]) await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, $1)`, [id]);
  await db.exec(`SET ROLE parikshaa_app`);
  billing = new BillingStore(sql);
});

afterEach(async () => {
  await db.close();
});

describe("credits", () => {
  it("leave an organisation without a plan unmetered, and count an invoiced one's attempts without spending", async () => {
    expect(await billing.consume(S, "a1")).toBe("unmetered");
    await billing.setPlan(S, "invoiced", 5000);
    expect(await billing.consume(S, "a1")).toBe("invoiced");
  });

  it("are spent one per attempt, however often its start is retried, and refused at zero", async () => {
    await billing.setPlan(S, "prepaid", 5000);
    await billing.grant(S, 2, "trial");
    expect(await billing.consume(S, "a1")).toBe("consumed");
    expect(await billing.consume(S, "a1")).toBe("already");
    expect(await billing.consume(S, "a2")).toBe("consumed");
    expect(await billing.consume(S, "a3")).toBe("insufficient");
    expect((await billing.account(S))!.credits).toBe(0);
    expect((await billing.history(S)).map((m) => [m.reason, m.delta])).toEqual([
      ["attempt", -1],
      ["attempt", -1],
      ["grant", 2],
    ]);
  });

  it("are never spent twice by starts racing for the last few", async () => {
    await billing.setPlan(S, "prepaid", 5000);
    await billing.grant(S, 5, "trial");
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) => billing.consume(S, `a${i}`)));
    expect(results.filter((r) => r === "consumed")).toHaveLength(5);
    expect(results.filter((r) => r === "insufficient")).toHaveLength(15);
    expect((await billing.account(S))!.credits).toBe(0);
  });

  it("come back once when the attempt they were spent on did not start", async () => {
    await billing.setPlan(S, "prepaid", 5000);
    await billing.grant(S, 1, "trial");
    await billing.consume(S, "a1");
    await billing.refund(S, "a1");
    await billing.refund(S, "a1");
    expect((await billing.account(S))!.credits).toBe(1);
  });

  it("are a ledger nobody can rewrite, and nobody else's business", async () => {
    await billing.setPlan(S, "prepaid", 5000);
    await billing.grant(S, 3, "trial");
    await expect(sql.transaction((tx) => tx.query(`UPDATE credit_ledger SET delta = 100`), { "parikshaa.org_id": A, "parikshaa.actor": "staff", "parikshaa.attempt_id": "" })).rejects.toThrow();
    expect(await billing.account(staffScope(B))).toBeNull();
    expect(await billing.history(staffScope(B))).toEqual([]);
    expect(await billing.account(candidateScope(A, "a1" as never))).toBeNull();
  });
});

describe("payments", () => {
  beforeEach(async () => {
    await billing.setPlan(S, "prepaid", 5000);
    await billing.createPayment(S, { id: "p1", orderId: "order_1", credits: 100, taxablePaise: 500_000, taxPaise: 90_000, amountPaise: 590_000, buyerState: null });
  });

  it("add their credits and issue their invoice once, whichever confirmation arrives first", async () => {
    const at = new Date("2026-10-01T06:00:00Z");
    const first = await billing.markPaid(S, "order_1", "pay_1", build, at);
    const second = await billing.markPaid(S, "order_1", "pay_1", build, at);

    expect(first).toMatchObject({ newlyPaid: true, payment: { status: "paid", paymentId: "pay_1" } });
    expect(second).toMatchObject({ newlyPaid: false });
    expect(second!.invoice.number).toBe(first!.invoice.number);
    expect((await billing.account(S))!.credits).toBe(100);
    expect(await billing.invoices(S)).toHaveLength(1);
  });

  it("are not found for an order another organisation made", async () => {
    const other = staffScope(B);
    await billing.setPlan(other, "prepaid", 5000);
    expect(await billing.markPaid(other, "order_1", "pay_1", build, new Date())).toBeNull();
  });
});

describe("invoice numbers", () => {
  it("run in one consecutive series per financial year across every organisation, at most 16 characters", async () => {
    await billing.setPlan(S, "invoiced", 5000);
    await billing.setPlan(staffScope(B), "invoiced", 5000);
    const april = new Date("2027-03-31T19:00:00Z"); // 00:30 on 1 April in IST: the next year
    const a = await billing.issueUsageInvoice(S, "2026-09", build, new Date("2026-10-01T06:00:00Z"));
    const b = await billing.issueUsageInvoice(staffScope(B), "2026-09", build, new Date("2026-10-01T06:00:00Z"));
    const c = await billing.issueUsageInvoice(S, "2027-03", build, april);
    expect([a.invoice.number, b.invoice.number, c.invoice.number]).toEqual(["PKS/2627/000001", "PKS/2627/000002", "PKS/2728/000001"]);
    expect(a.invoice.number.length).toBeLessThanOrEqual(16);
    expect((await billing.issueUsageInvoice(S, "2026-09", build, new Date())).created).toBe(false);
  });

  it("follow India's financial year, in IST", () => {
    expect(financialYear(new Date("2026-03-31T18:29:00Z"))).toBe("2025-26");
    expect(financialYear(new Date("2026-03-31T18:31:00Z"))).toBe("2026-27");
    expect(invoiceNumber("2099-00", 7)).toBe("PKS/9900/000007");
  });
});
