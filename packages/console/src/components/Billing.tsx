import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, type BillingAccount, type BillingOrder, type BuyerDetails, type ConsoleClient, type InvoiceDocument } from "../api.ts";
import { QrCode } from "./Security.tsx";

/**
 * Billing (ROADMAP §12): the balance, the details a tax invoice carries,
 * buying credits through Razorpay Checkout, and the invoices. Owner only.
 */

export const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(paise / 100);

const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

/** GST state codes, for the place of supply. The server holds the same list and checks it. */
const STATES: readonly (readonly [string, string])[] = [
  ["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"], ["05", "Uttarakhand"],
  ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"], ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"],
  ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"], ["16", "Tripura"], ["17", "Meghalaya"],
  ["18", "Assam"], ["19", "West Bengal"], ["20", "Jharkhand"], ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"],
  ["24", "Gujarat"], ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["27", "Maharashtra"], ["29", "Karnataka"], ["30", "Goa"],
  ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"], ["34", "Puducherry"], ["35", "Andaman and Nicobar Islands"],
  ["36", "Telangana"], ["37", "Andhra Pradesh"], ["38", "Ladakh"], ["97", "Other Territory"],
];

/** Razorpay Checkout, as its script defines it on `window`. */
interface RazorpayCheckout {
  open(): void;
  on(event: "payment.failed", handler: (response: { error: { description?: string } }) => void): void;
}
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayCheckout;

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Load Checkout once, when someone first buys: nobody else downloads it. */
export function loadCheckout(): Promise<RazorpayConstructor> {
  const existing = (window as { Razorpay?: RazorpayConstructor }).Razorpay;
  if (existing !== undefined) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => {
      const loaded = (window as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (loaded === undefined) reject(new Error("Checkout did not load"));
      else resolve(loaded);
    };
    script.onerror = () => reject(new Error("Checkout could not be reached"));
    document.head.appendChild(script);
  });
}

export function BillingPanel({ client, checkout = loadCheckout }: { client: ConsoleClient; checkout?: () => Promise<RazorpayConstructor> }) {
  const summary = useQuery({ queryKey: ["billing"], queryFn: () => client.billing() });
  const [open, setOpen] = useState<string | null>(null);

  if (summary.isPending) return <p className="notice">Loading…</p>;
  if (summary.error !== null) return <p className="error">Could not load billing.</p>;
  const { account, history, invoices } = summary.data;

  if (open !== null) return <InvoiceView client={client} id={open} onBack={() => setOpen(null)} />;

  return (
    <>
      <section className="card" aria-label="Plan and balance">
        <h2 style={{ marginTop: 0 }}>Billing</h2>
        {account === null ? (
          <p className="notice">This organisation is not billed: every attempt is allowed. Plans are set by Parikshaa — write to us to choose one.</p>
        ) : (
          <dl className="figures">
            <div>
              <dt>Plan</dt>
              <dd>{account.mode === "prepaid" ? "Prepaid credits" : "Invoiced monthly"}</dd>
            </div>
            <div>
              <dt>Per attempt</dt>
              <dd>{rupees(account.pricePaise)} + GST</dd>
            </div>
            {account.mode === "prepaid" ? (
              <div>
                <dt>Credits left</dt>
                <dd className={account.credits === 0 ? "warn" : undefined}>{account.credits}</dd>
              </div>
            ) : null}
          </dl>
        )}
        {account?.mode === "prepaid" ? (
          <p className="notice">
            One credit is spent when a candidate's attempt starts, once, however often they open their link. With none left, no new
            attempt starts; those already started carry on.
          </p>
        ) : null}
      </section>

      {account === null ? null : <Details client={client} account={account} />}
      {account?.mode === "prepaid" ? (
        summary.data.checkout.available ? (
          <Buy client={client} account={account} supplierState={summary.data.supplier?.stateCode ?? null} checkout={checkout} />
        ) : (
          <p className="notice card">Buying credits online is not set up on this server yet. Write to us and we will add them.</p>
        )
      ) : null}

      {invoices.length === 0 ? null : (
        <section className="card" aria-label="Invoices">
          <strong>Invoices</strong>
          <table>
            <thead>
              <tr>
                <th scope="col">Number</th>
                <th scope="col">For</th>
                <th scope="col">Date</th>
                <th scope="col">Total</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.number}</td>
                  <td>{i.kind === "credits" ? "Credits" : i.kind === "credit_note" ? "Credit note: refund" : `Attempts, ${i.period}`}</td>
                  <td>{when(i.issuedAt)}</td>
                  <td>{rupees(i.totalPaise)}</td>
                  <td>
                    <button type="button" className="quiet" onClick={() => setOpen(i.id)}>
                      View {i.number}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {history.length === 0 ? null : (
        <section className="card" aria-label="Credit history">
          <strong>Credit history</strong>
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">What</th>
                <th scope="col">Credits</th>
              </tr>
            </thead>
            <tbody>
              {history.map((m) => (
                <tr key={m.id}>
                  <td>{when(m.at)}</td>
                  <td>
                    {m.reason === "attempt"
                      ? "An attempt started"
                      : m.reason === "purchase"
                        ? "Bought"
                        : m.reason === "grant"
                          ? `Granted${m.note === null ? "" : ` — ${m.note}`}`
                          : m.reason === "payment_refund"
                            ? `Refunded${m.note === null ? "" : ` — ${m.note}`}`
                            : m.reason === "refund_reversed"
                              ? "Restored: the refund did not go through"
                              : "Returned: the attempt did not start"}
                  </td>
                  <td className="mono">{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function Details({ client, account }: { client: ConsoleClient; account: BillingAccount }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BuyerDetails>(account);
  useEffect(() => setDraft(account), [account]);
  const save = useMutation({
    mutationFn: () => client.saveBillingDetails(draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing"] }),
  });
  const text = (field: "legalName" | "address") => (e: { target: { value: string } }) => setDraft({ ...draft, [field]: e.target.value });
  const nullable = (field: "gstin" | "billingEmail" | "stateCode") => (e: { target: { value: string } }) =>
    setDraft({ ...draft, [field]: e.target.value === "" ? null : e.target.value });

  return (
    <section className="card" aria-label="Invoice details">
      <strong>On your invoices</strong>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid">
          <div className="field">
            <label htmlFor="legal-name">Legal name</label>
            <input id="legal-name" value={draft.legalName} onChange={text("legalName")} />
          </div>
          <div className="field">
            <label htmlFor="gstin">GSTIN (if registered)</label>
            <input id="gstin" value={draft.gstin ?? ""} onChange={nullable("gstin")} maxLength={15} style={{ textTransform: "uppercase" }} />
          </div>
          <div className="field">
            <label htmlFor="state">State</label>
            <select id="state" value={draft.stateCode ?? ""} onChange={nullable("stateCode")}>
              <option value="">—</option>
              {STATES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name} ({code})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="billing-email">Billing email</label>
            <input id="billing-email" type="email" value={draft.billingEmail ?? ""} onChange={nullable("billingEmail")} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="billing-address">Address</label>
          <textarea id="billing-address" value={draft.address} onChange={text("address")} />
        </div>
        <div className="row">
          <button type="submit" disabled={save.isPending}>
            Save details
          </button>
          {save.isSuccess ? (
            <span className="notice" role="status">
              Saved.
            </span>
          ) : null}
          {save.error instanceof ConsoleError ? <span className="error">{save.error.detail ?? "That did not save."}</span> : null}
        </div>
      </form>
    </section>
  );
}

const PACKS = [100, 500, 1000] as const;

function Buy({
  client,
  account,
  supplierState,
  checkout,
}: {
  client: ConsoleClient;
  account: BillingAccount;
  supplierState: string | null;
  checkout: () => Promise<RazorpayConstructor>;
}) {
  const queryClient = useQueryClient();
  const [credits, setCredits] = useState<number>(PACKS[0]);
  const [outcome, setOutcome] = useState<{ kind: "paid"; invoice: string } | { kind: "failed"; message: string } | null>(null);
  const taxable = credits * account.pricePaise;
  const intra = (account.stateCode ?? supplierState) === supplierState;
  const tax = intra ? 2 * Math.floor((taxable * 9 + 50) / 100) : Math.floor((taxable * 18 + 50) / 100);

  const pay = useMutation({
    mutationFn: async () => {
      setOutcome(null);
      const order: BillingOrder = await client.createOrder(credits);
      const Razorpay = await checkout();
      await new Promise<void>((resolve) => {
        const rzp = new Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: order.currency,
          name: order.supplierName,
          description: `${order.credits} assessment attempt credits`,
          prefill: { email: account.billingEmail ?? undefined, name: account.legalName },
          handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            client
              .verifyPayment(response.razorpay_order_id, response.razorpay_payment_id, response.razorpay_signature)
              .then((paid) => setOutcome({ kind: "paid", invoice: paid.invoice.number }))
              .catch((error: unknown) =>
                setOutcome({ kind: "failed", message: error instanceof ConsoleError ? (error.detail ?? "The payment could not be confirmed.") : "The payment could not be confirmed." }),
              )
              .finally(() => {
                void queryClient.invalidateQueries({ queryKey: ["billing"] });
                resolve();
              });
          },
          modal: { ondismiss: () => resolve() },
        });
        rzp.on("payment.failed", (response) => setOutcome({ kind: "failed", message: response.error.description ?? "The payment did not go through." }));
        rzp.open();
      });
    },
    onError: (error) =>
      setOutcome({ kind: "failed", message: error instanceof ConsoleError ? (error.detail ?? "That did not work.") : "Checkout could not be opened." }),
  });

  return (
    <section className="card" aria-label="Buy credits">
      <strong>Buy credits</strong>
      <div className="row">
        {PACKS.map((n) => (
          <label className="inline" key={n}>
            <input type="radio" name="pack" checked={credits === n} onChange={() => setCredits(n)} /> {n}
          </label>
        ))}
        <label className="inline">
          Other{" "}
          <input
            aria-label="Number of credits"
            type="number"
            min={1}
            max={100000}
            value={credits}
            onChange={(e) => setCredits(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            style={{ width: "7rem" }}
          />
        </label>
      </div>
      <p aria-live="polite">
        {credits} × {rupees(account.pricePaise)} = {rupees(taxable)} + {intra ? "CGST 9% + SGST 9%" : "IGST 18%"} {rupees(tax)} ={" "}
        <strong>{rupees(taxable + tax)}</strong>
      </p>
      <div className="row">
        <button type="button" disabled={pay.isPending || account.legalName === ""} onClick={() => pay.mutate()}>
          Pay {rupees(taxable + tax)} with Razorpay
        </button>
        {account.legalName === "" ? <span className="notice">Add your legal name above first: it goes on the tax invoice.</span> : null}
      </div>
      {outcome?.kind === "paid" ? (
        <p className="notice" role="status">
          Paid. {credits} credits added; tax invoice {outcome.invoice} is below.
        </p>
      ) : null}
      {outcome?.kind === "failed" ? (
        <p className="error" role="status">
          {outcome.message}
        </p>
      ) : null}
    </section>
  );
}

/** A tax invoice as issued, ready to print or save as PDF. */
function InvoiceView({ client, id, onBack }: { client: ConsoleClient; id: string; onBack: () => void }) {
  const invoice = useQuery({ queryKey: ["invoice", id], queryFn: () => client.invoice(id) });
  if (invoice.isPending) return <p className="notice">Loading…</p>;
  if (invoice.error !== null) return <p className="error">Could not load the invoice.</p>;
  const d: InvoiceDocument = invoice.data.document;
  return (
    <article className="report" aria-label={`${d.title === "Credit Note" ? "Credit note" : "Tax invoice"} ${d.number}`}>
      <div className="row no-print" style={{ marginTop: 0 }}>
        <button type="button" className="secondary" onClick={onBack}>
          Back to billing
        </button>
        <button type="button" className="secondary" onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>{d.title}</h2>
        <div className="grid">
          <div>
            <strong>{d.supplier.legalName}</strong>
            <p style={{ whiteSpace: "pre-line", margin: ".2rem 0" }}>{d.supplier.address}</p>
            <p className="mono">GSTIN {d.supplier.gstin}</p>
            <p>
              {d.supplier.state} ({d.supplier.stateCode})
            </p>
          </div>
          <div>
            <p>
              {d.title === "Credit Note" ? "Credit note" : "Invoice"} <span className="mono">{d.number}</span>
            </p>
            <p>Date {d.date}</p>
            {d.against === undefined ? null : (
              <p>
                Against invoice <span className="mono">{d.against.number}</span> of {d.against.date}
              </p>
            )}
            <p>
              Place of supply: {d.placeOfSupply.state} ({d.placeOfSupply.code})
            </p>
            <p>Reverse charge: {d.reverseCharge ? "Yes" : "No"}</p>
          </div>
        </div>
        <p style={{ marginBottom: 0 }}>Billed to</p>
        <strong>{d.buyer.legalName}</strong>
        <p style={{ whiteSpace: "pre-line", margin: ".2rem 0" }}>{d.buyer.address}</p>
        {d.buyer.gstin === null ? <p className="notice">Unregistered</p> : <p className="mono">GSTIN {d.buyer.gstin}</p>}
        <table>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">SAC</th>
              <th scope="col">Qty</th>
              <th scope="col">Rate</th>
              <th scope="col">Taxable value</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l, i) => (
              <tr key={i}>
                <td>{l.description}</td>
                <td className="mono">{l.sac}</td>
                <td>{l.quantity}</td>
                <td>{rupees(l.ratePaise)}</td>
                <td>{rupees(l.amountPaise)}</td>
              </tr>
            ))}
            {d.taxes.map((t) => (
              <tr key={t.name}>
                <td colSpan={4}>
                  {t.name} @ {t.ratePercent}%
                </td>
                <td>{rupees(t.amountPaise)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" colSpan={4}>
                Total
              </th>
              <td>
                <strong>{rupees(d.totalPaise)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        <p>{d.totalInWords}</p>
        {d.tds === undefined ? null : (
          <p>
            TDS deductible under section {d.tds.section} @ {d.tds.ratePercent}% of the taxable value: {rupees(d.tds.amountPaise)}. Net payable:{" "}
            <strong>{rupees(d.tds.netPayablePaise)}</strong>.
          </p>
        )}
        {d.reason === undefined ? null : <p>Reason: {d.reason}</p>}
        {d.note === undefined ? null : <p className="notice">{d.note}</p>}
        {invoice.data.eInvoice == null ? null : (
          <div className="qr-row">
            <QrCode value={invoice.data.eInvoice.signedQr} size={132} />
            <div>
              <p className="mono" style={{ wordBreak: "break-all" }}>
                IRN {invoice.data.eInvoice.irn}
              </p>
              <p>
                Ack. no. {invoice.data.eInvoice.ackNo} · {invoice.data.eInvoice.ackDate}
              </p>
            </div>
          </div>
        )}
      </section>
    </article>
  );
}
