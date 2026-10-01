import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Printer, ReceiptText, TicketPercent } from "lucide-react";
import { usePreferences } from "../i18n.tsx";
import { loadCheckout, type RazorpayConstructor } from "./checkout.ts";
import { loadRef, saveRef, type Billing, type Quote } from "./client.ts";
import { Link, messageOf, SignInNeeded, useWhen, type Context } from "./parts.tsx";
import { usePrepText, type PrepKey } from "./prep-text.ts";
import { STATES } from "./states.ts";
import "./prep.css";

/**
 * Plus (Prep blueprint §16, F12): what the site sells, with each price's GST
 * shown, a coupon (typed, or brought by an affiliate's `?ref=` link), the
 * details the invoice is made out to, and every order with its tax invoice.
 */

const key = (site: string, ...rest: readonly unknown[]) => ["practice", site, "prep", ...rest];
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;

function useDay() {
  const { language } = usePreferences();
  return (day: string) => new Intl.DateTimeFormat(`${language}-IN`, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

const FAQ: readonly (readonly [PrepKey, PrepKey])[] = [
  ["plus.faq.gstQ", "plus.faq.gstA"],
  ["plus.faq.invoiceQ", "plus.faq.invoiceA"],
  ["plus.faq.renewQ", "plus.faq.renewA"],
  ["plus.faq.couponQ", "plus.faq.couponA"],
  ["plus.faq.freeQ", "plus.faq.freeA"],
];

export function PlusPage({ client, nav, learner, site, checkout = loadCheckout }: Context & { readonly checkout?: () => Promise<RazorpayConstructor> }) {
  const p = usePrepText();
  const day = useDay();
  const when = useWhen();
  const queryClient = useQueryClient();
  const plus = useQuery({ queryKey: key(site, "plus", learner?.id ?? null), queryFn: () => client.plus() });
  const credits = useQuery({ queryKey: key(site, "credits"), queryFn: () => client.credits(), enabled: learner !== null });
  const orders = useQuery({ queryKey: key(site, "orders", learner?.id ?? null), queryFn: () => client.orders(), enabled: learner !== null });
  const [outcome, setOutcome] = useState<"paid" | "failed" | null>(null);
  // A coupon an affiliate's link brought is filled in, and applied.
  const [typed, setTyped] = useState(() => loadRef(site) ?? "");
  const [coupon, setCoupon] = useState(() => loadRef(site) ?? "");
  const [billing, setBilling] = useState<Required<Pick<Billing, "name" | "stateCode" | "gstin">>>({ name: "", stateCode: "", gstin: "" });
  const products = plus.data?.products ?? [];
  const quotes = useQueries({
    queries: products.map((product) => ({
      queryKey: key(site, "quote", product.id, coupon),
      queryFn: () => client.quote(product.id, coupon),
      enabled: coupon !== "",
      retry: false,
    })),
  });
  const quoteOf = (id: string): Quote | null => {
    const i = products.findIndex((x) => x.id === id);
    return coupon === "" ? null : (quotes[i]?.data ?? null);
  };
  const couponError = coupon !== "" && quotes.length > 0 && quotes.every((q) => q.isError) ? messageOf(quotes[0]!.error, p("plus.coupon.bad")) : null;
  useEffect(() => {
    // A link's coupon that no plan takes is not kept for next time.
    if (couponError !== null && loadRef(site) === coupon) saveRef(site, null);
  }, [couponError, coupon, site]);

  const buy = useMutation({
    mutationFn: async (productId: string) => {
      const usable = quoteOf(productId)?.coupon ?? undefined;
      const [order, Razorpay] = await Promise.all([client.checkout(productId, { ...billing, coupon: usable }), checkout()]);
      await new Promise<void>((resolve, reject) => {
        const rz = new Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amountPaise,
          currency: "INR",
          name: order.title,
          prefill: { name: order.learner.name, email: order.learner.email },
          handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
            client.confirmPayment(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature).then(() => resolve(), reject);
          },
          modal: { ondismiss: () => reject(new Error("dismissed")) },
        });
        rz.on("payment.failed", () => reject(new Error("failed")));
        rz.open();
      });
      if (usable !== undefined && loadRef(site) === usable) saveRef(site, null);
    },
    onSuccess: () => {
      setOutcome("paid");
      void queryClient.invalidateQueries({ queryKey: ["practice", site] });
    },
    onError: () => setOutcome("failed"),
  });

  if (plus.isPending) return <p className="notice">{p("common.loading")}</p>;
  if (plus.isError) return <p className="error" role="alert">{messageOf(plus.error, p("common.failed"))}</p>;
  const o = plus.data;
  const field = (name: keyof typeof billing) => ({ value: billing[name], onChange: (e: { target: { value: string } }) => setBilling({ ...billing, [name]: e.target.value }) });
  return (
    <div className="prep-page">
      <header className="prep-head">
        <div>
          <h1>
            <Crown aria-hidden="true" /> {p("plus.title")}
          </h1>
          <p className="notice">{o.enabled ? p("plus.hint") : p("plus.off")}</p>
        </div>
        {o.enabled && learner !== null ? (
          <span className={`pill ${o.active ? "ok" : ""}`}>{o.active && o.until !== null ? p("plus.active", { date: day(o.until.slice(0, 10)) }) : p("plus.none")}</span>
        ) : null}
      </header>
      {outcome === "paid" ? <p className="alert ok" role="status">{p("plus.paid")}</p> : outcome === "failed" ? <p className="alert warn" role="alert">{p("plus.failed")}</p> : null}
      {o.products.length === 0 ? null : (
        <>
          <form
            className="card coupon-form"
            aria-label={p("plus.coupon.title")}
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setCoupon(typed.trim().toUpperCase());
            }}
          >
            <label htmlFor="coupon">
              <TicketPercent aria-hidden="true" /> {p("plus.coupon.title")}
            </label>
            <div className="row">
              <input id="coupon" value={typed} maxLength={30} autoCapitalize="characters" onChange={(e) => setTyped(e.target.value)} placeholder={p("plus.coupon.placeholder")} />
              <button type="submit" className="secondary" disabled={typed.trim() === ""}>
                {p("plus.coupon.apply")}
              </button>
              {coupon === "" ? null : (
                <button type="button" className="quiet" onClick={() => { setCoupon(""); setTyped(""); saveRef(site, null); }}>
                  {p("plus.coupon.remove")}
                </button>
              )}
            </div>
            {couponError !== null ? (
              <p className="error" role="alert">{couponError}</p>
            ) : coupon !== "" && quotes.some((q) => q.data !== undefined) ? (
              <p className="notice" role="status">{p("plus.coupon.applied", { code: coupon })}</p>
            ) : null}
          </form>
          <div className="track-cards">
            {o.products.map((product) => {
              const q = quoteOf(product.id);
              const price = q?.pricePaise ?? product.pricePaise;
              const tax = q?.taxPaise ?? product.taxPaise;
              return (
                <section key={product.id} className="card plan-card" aria-label={product.title}>
                  <h2>{product.title}</h2>
                  <p className="price">
                    {q !== null && q.discountPaise > 0 ? <s className="was">{rupees(q.listPaise)}</s> : null} {rupees(price)}
                  </p>
                  <p className="notice gst-breakup">{p("plus.breakup", { base: rupees(price - tax), gst: rupees(tax) })}</p>
                  {q !== null && q.discountPaise > 0 ? <p className="saving">{p("plus.coupon.saving", { amount: rupees(q.discountPaise) })}</p> : null}
                  <ul>
                    {product.days > 0 ? <li>{p(product.kind === "company" ? "plus.companyDays" : "plus.days", { n: product.days })}</li> : null}
                    {product.credits > 0 ? <li>{p("plus.credits", { n: product.credits.toLocaleString("en-IN") })}</li> : null}
                  </ul>
                  {learner === null ? (
                    <SignInNeeded nav={nav} next="/plus" />
                  ) : o.checkout ? (
                    <button type="button" disabled={buy.isPending} onClick={() => { setOutcome(null); buy.mutate(product.id); }}>
                      {p("plus.buy", { price: rupees(price) })}
                    </button>
                  ) : (
                    <p className="notice">{p("plus.noCheckout")}</p>
                  )}
                </section>
              );
            })}
          </div>
          {learner === null || !o.checkout || !o.invoices ? null : (
            <details className="card invoice-details">
              <summary>{p("plus.billing.title")}</summary>
              <p className="notice">{p("plus.billing.hint")}</p>
              <div className="grid">
                <div className="field">
                  <label htmlFor="bill-name">{p("plus.billing.name")}</label>
                  <input id="bill-name" maxLength={160} placeholder={learner.name} {...field("name")} />
                </div>
                <div className="field">
                  <label htmlFor="bill-state">{p("plus.billing.state")}</label>
                  <select id="bill-state" {...field("stateCode")}>
                    <option value="">{p("plus.billing.stateNone")}</option>
                    {STATES.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="bill-gstin">{p("plus.billing.gstin")}</label>
                  <input id="bill-gstin" maxLength={15} autoCapitalize="characters" {...field("gstin")} />
                </div>
              </div>
            </details>
          )}
        </>
      )}
      {learner === null ? null : (
        <div className="plan-layout">
          <section className="card" aria-labelledby="credits-title">
            <h2 id="credits-title">{p("credits.title")}</h2>
            <p className="coin-balance">{p("credits.balance", { n: credits.data?.balance ?? 0 })}</p>
            {o.monthlyCredits > 0 ? <p className="notice">{p("credits.monthly", { n: o.monthlyCredits })}</p> : null}
            <ul className="coin-history">
              {(credits.data?.history ?? []).map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <span>{p(`credits.reason.${h.reason}` as PrepKey)}</span>
                  <span className="notice">{when(h.at)}</span>
                  <strong className={h.delta > 0 ? "plus" : "minus"}>
                    {h.delta > 0 ? "+" : ""}
                    {h.delta}
                  </strong>
                </li>
              ))}
            </ul>
          </section>
          <section className="card" aria-labelledby="orders-title">
            <h2 id="orders-title">{p("plus.orders")}</h2>
            {(orders.data ?? []).every((x) => x.status !== "paid") ? <p className="notice">{p("plus.noOrders")}</p> : null}
            <ul className="coin-history">
              {(orders.data ?? [])
                .filter((x) => x.status === "paid")
                .map((x) => (
                  <li key={x.id}>
                    <span>
                      {x.title}
                      {x.coupon === null ? null : <span className="notice"> · {p("plus.coupon.used", { code: x.coupon, amount: rupees(x.discountPaise) })}</span>}
                    </span>
                    <span className="notice">{x.paidAt === null ? "" : when(x.paidAt)}</span>
                    <strong>{rupees(x.amountPaise)}</strong>
                    {x.invoice === null ? null : (
                      <Link nav={nav} to={`/invoices/${encodeURIComponent(x.invoice)}`}>
                        <ReceiptText aria-hidden="true" /> {p("plus.invoice", { number: x.invoice })}
                      </Link>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        </div>
      )}
      {o.enabled ? (
        <section className="card faq" aria-labelledby="faq-title">
          <h2 id="faq-title">{p("plus.faq.title")}</h2>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{p(q)}</summary>
              <p>{p(a)}</p>
            </details>
          ))}
        </section>
      ) : null}
    </div>
  );
}

/** A tax invoice, laid out to print or save as a PDF from the browser. */
export function InvoicePage({ client, nav, learner, site, number }: Context & { readonly number: string }) {
  const p = usePrepText();
  const invoice = useQuery({ queryKey: key(site, "invoice", number), queryFn: () => client.invoice(number), enabled: learner !== null });
  if (learner === null) return <SignInNeeded nav={nav} next={`/invoices/${encodeURIComponent(number)}`} />;
  if (invoice.isPending) return <p className="notice">{p("common.loading")}</p>;
  if (invoice.isError) return <p className="error" role="alert">{messageOf(invoice.error, p("common.failed"))}</p>;
  const d = invoice.data.document;
  return (
    <article className="card tax-invoice" aria-label={`${d.title} ${d.number}`}>
      <div className="row no-print">
        <Link nav={nav} to="/plus">
          ← {p("plus.title")}
        </Link>
        <button type="button" className="secondary" onClick={() => window.print()}>
          <Printer aria-hidden="true" /> {p("plus.print")}
        </button>
      </div>
      <h1>{d.title}</h1>
      <dl className="invoice-meta">
        <dt>{p("invoice.number")}</dt>
        <dd>{d.number}</dd>
        <dt>{p("invoice.date")}</dt>
        <dd>{d.date}</dd>
        <dt>{p("invoice.place")}</dt>
        <dd>
          {d.placeOfSupply.state} ({d.placeOfSupply.code})
        </dd>
      </dl>
      <div className="invoice-parties">
        <section>
          <h2>{p("invoice.from")}</h2>
          <p>
            <strong>{d.supplier.legalName}</strong>
            <br />
            {d.supplier.address}
            <br />
            GSTIN {d.supplier.gstin}
          </p>
        </section>
        <section>
          <h2>{p("invoice.to")}</h2>
          <p>
            <strong>{d.buyer.legalName}</strong>
            {d.buyer.state === null ? null : (
              <>
                <br />
                {d.buyer.state}
              </>
            )}
            {d.buyer.gstin === null ? null : (
              <>
                <br />
                GSTIN {d.buyer.gstin}
              </>
            )}
          </p>
        </section>
      </div>
      <table>
        <thead>
          <tr>
            <th scope="col">{p("invoice.item")}</th>
            <th scope="col">SAC</th>
            <th scope="col" className="num">
              {p("invoice.amount")}
            </th>
          </tr>
        </thead>
        <tbody>
          {d.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.description}</td>
              <td>{l.sac}</td>
              <td className="num">{rupees(l.amountPaise)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" colSpan={2}>
              {p("invoice.taxable")}
            </th>
            <td className="num">{rupees(d.taxablePaise)}</td>
          </tr>
          {d.taxes.map((t) => (
            <tr key={t.name}>
              <th scope="row" colSpan={2}>
                {t.name} @ {t.ratePercent}%
              </th>
              <td className="num">{rupees(t.amountPaise)}</td>
            </tr>
          ))}
          <tr className="total">
            <th scope="row" colSpan={2}>
              {p("invoice.total")}
            </th>
            <td className="num">{rupees(d.totalPaise)}</td>
          </tr>
        </tbody>
      </table>
      <p>{d.totalInWords}</p>
      {d.note === undefined ? null : <p className="notice">{d.note}</p>}
      <p className="notice">{p("invoice.reverse")}</p>
    </article>
  );
}
