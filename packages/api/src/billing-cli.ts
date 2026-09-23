import type Anthropic from "@anthropic-ai/sdk";
import { orgId } from "@parikshaa/core";
import { BillingStore, connect, IdentityStore, LedgerStore, staffScope } from "@parikshaa/store";
import { BillingService } from "./billing.js";
import { supplierFromEnv } from "./gst.js";
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
 *
 * Invoicing needs PARIKSHAA_SUPPLIER_NAME, _GSTIN and _ADDRESS.
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
      for (const i of await billingStore.invoices(scope)) out(`  ${i.number}  ${i.kind}  ${rupees(i.totalPaise)}  ${i.issuedAt.slice(0, 10)}`);
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
    default:
      throw new Error(`unknown command: ${command}`);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
