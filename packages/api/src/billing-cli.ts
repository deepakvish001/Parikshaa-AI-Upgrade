import { readFile } from "node:fs/promises";
import type Anthropic from "@anthropic-ai/sdk";
import { orgId } from "@parikshaa/core";
import { BillingStore, connect, IdentityStore, LedgerStore, staffScope } from "@parikshaa/store";
import { BillingService } from "./billing.js";
import { bankFromEnv, supplierFromEnv } from "./gst.js";
import { RazorpayGateway } from "./razorpay.js";
import { ExamService } from "./service.js";

/**
 * The operator's billing tool (ROADMAP §12). Plans and prices are Parikshaa's
 * to set, not a customer's, so they are set here rather than in the console.
 *
 *   DATABASE_URL=… npm run billing -w @parikshaa/api -- <command>
 *
 *   show <org>                                 the plan, balance and invoices
 *   plan <org> prepaid|invoiced <rupees>       the plan, and the price per attempt excluding GST
 *   grant <org> <credits> <note…>              credits without payment: a trial, a goodwill gesture
 *   invoice <org> <YYYY-MM>                    an invoiced organisation's usage invoice for a month
 *   invoice-all <YYYY-MM>                      the same, for every invoiced organisation
 *   refund <org> <payment> <credits> <reason…> refund unspent credits through Razorpay, with a GST credit note
 *   tds <org> 0|1|2|10                         the TDS rate (194J) the buyer deducts, printed on invoices from now
 *   tds-certificate <org> <invoice no> <rupees> <certificate no> <FY Q>   a Form 16A received, e.g. "2026-27 Q2"
 *   e-invoice <org> <invoice no>               the invoice as e-invoice JSON (INV-01 1.1), for the IRP
 *   irn <org> <invoice no> <irn> <ack no> <ack date> <signed-qr-file>      record what the IRP returned
 *   transfer <org> <quotation ref> <UTR>      a bank transfer received against a quotation: credits and the tax invoice
 *
 * Invoicing needs PARIKSHAA_SUPPLIER_NAME, _GSTIN and _ADDRESS; refunds need
 * RAZORPAY_KEY_ID, _KEY_SECRET and _WEBHOOK_SECRET too.
 */

const [command, ...args] = process.argv.slice(2);
const url = process.env["DATABASE_URL"];
if (url === undefined || url === "" || command === undefined) {
  process.stderr.write("usage: DATABASE_URL=… billing show|plan|grant|invoice|invoice-all …\n");
  process.exit(2);
}

const sql = connect(url, { max: 2 });
const store = new LedgerStore(sql);
const identity = new IdentityStore(sql);
const billingStore = new BillingStore(sql);
const service = new BillingService({
  store,
  billing: billingStore,
  identity,
  exams: new ExamService({ store, identity, client: {} as Anthropic }),
  supplier: supplierFromEnv(process.env),
  bank: bankFromEnv(process.env),
  gateway:
    (process.env["RAZORPAY_KEY_ID"] ?? "") === ""
      ? null
      : new RazorpayGateway({
          keyId: process.env["RAZORPAY_KEY_ID"]!,
          keySecret: process.env["RAZORPAY_KEY_SECRET"] ?? "",
          webhookSecret: process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "",
        }),
});
const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;
const out = (line: string) => process.stdout.write(`${line}\n`);

try {
  switch (command) {
    case "show": {
      const scope = staffScope(orgId(args[0]!));
      const account = await billingStore.account(scope);
      if (account === null) out("not billed: every attempt is allowed, and nothing is metered");
      else out(`${account.mode}, ${rupees(account.pricePaise)} per attempt + GST, ${account.credits} credits, invoices to ${account.legalName || "(no legal name yet)"}`);
      if (account !== null && account.tdsPercent > 0) out(`  TDS deducted by the buyer: ${account.tdsPercent}% (194J)`);
      for (const i of await billingStore.invoices(scope)) out(`  ${i.number}  ${i.kind}  ${rupees(i.totalPaise)}  ${i.issuedAt.slice(0, 10)}`);
      for (const r of await billingStore.refunds(scope)) out(`  refund ${r.id}: ${r.credits} credits, ${rupees(r.amountPaise)}, ${r.status}`);
      for (const c of await billingStore.tdsCertificates(scope)) out(`  Form 16A ${c.certificate} (${c.quarter}): ${rupees(c.amountPaise)}`);
      break;
    }
    case "plan": {
      const [org, mode, price] = args;
      if ((mode !== "prepaid" && mode !== "invoiced") || !(Number(price) > 0)) throw new Error("plan <org> prepaid|invoiced <rupees>");
      const account = await billingStore.setPlan(staffScope(orgId(org!)), mode, Math.round(Number(price) * 100));
      out(`${org}: ${account.mode}, ${rupees(account.pricePaise)} per attempt + GST`);
      break;
    }
    case "grant": {
      const [org, credits, ...note] = args;
      if (!Number.isInteger(Number(credits)) || Number(credits) < 1 || note.length === 0) throw new Error("grant <org> <credits> <note…>");
      const account = await billingStore.grant(staffScope(orgId(org!)), Number(credits), note.join(" "));
      out(`${org}: ${account.credits} credits`);
      break;
    }
    case "invoice":
    case "invoice-all": {
      const period = command === "invoice" ? args[1]! : args[0]!;
      const orgs = command === "invoice" ? [args[0]!] : await identity.organisationIds();
      for (const org of orgs) {
        const account = await billingStore.account(staffScope(orgId(org)));
        if (account?.mode !== "invoiced") continue;
        const { invoice, created, attempts } = await service.issueUsageInvoice(orgId(org), period);
        out(`${org}: ${invoice.number} for ${attempts} attempts, ${rupees(invoice.totalPaise)}${created ? "" : " (issued before)"}`);
      }
      break;
    }
    case "refund": {
      const [org, payment, credits, ...reason] = args;
      if (payment === undefined || !Number.isInteger(Number(credits)) || reason.length === 0) throw new Error("refund <org> <payment> <credits> <reason…>");
      const { refund, creditNote } = await service.refundPayment(orgId(org!), { payment, credits: Number(credits), reason: reason.join(" ") });
      out(`${org}: refunded ${refund.credits} credits, ${rupees(refund.amountPaise)} (Razorpay ${refund.razorpayRefundId}); credit note ${creditNote.number}`);
      break;
    }
    case "tds": {
      const [org, percent] = args;
      const account = await service.setTds(orgId(org!), Number(percent));
      out(`${org}: TDS ${account.tdsPercent}% under 194J on invoices from now`);
      break;
    }
    case "tds-certificate": {
      const [org, number, amount, certificate, ...quarter] = args;
      if (number === undefined || !(Number(amount) > 0) || certificate === undefined) throw new Error('tds-certificate <org> <invoice no> <rupees> <certificate no> "<FY> Q<n>"');
      const recorded = await service.recordTdsCertificate(orgId(org!), {
        invoiceNumber: number,
        amountPaise: Math.round(Number(amount) * 100),
        certificate,
        quarter: quarter.join(" "),
      });
      out(`${org}: Form 16A ${recorded.certificate} for ${rupees(recorded.amountPaise)} recorded`);
      break;
    }
    case "e-invoice": {
      const [org, number] = args;
      out(JSON.stringify(await service.eInvoiceJson(orgId(org!), number!), null, 2));
      break;
    }
    case "transfer": {
      const [org, reference, utr] = args;
      if (reference === undefined || utr === undefined) throw new Error("transfer <org> <quotation ref, neft_…> <UTR>");
      const { invoice, credits, newlyPaid } = await service.recordTransfer(orgId(org!), reference, utr);
      out(newlyPaid ? `${org}: ${credits} credits added; tax invoice ${invoice.number} for ${rupees(invoice.totalPaise)}` : `${org}: ${reference} was recorded before (invoice ${invoice.number}); nothing changed`);
      break;
    }
    case "irn": {
      const [org, number, irn, ackNo, ackDate, qrFile] = args;
      if (qrFile === undefined) throw new Error("irn <org> <invoice no> <irn> <ack no> <ack date> <signed-qr-file>");
      await service.recordIrn(orgId(org!), number!, { irn: irn!, ackNo: ackNo!, ackDate: ackDate!, signedQr: await readFile(qrFile, "utf8") });
      out(`${org}: ${number} registered, IRN ${irn}`);
      break;
    }
    default:
      throw new Error(`unknown command: ${command}`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
