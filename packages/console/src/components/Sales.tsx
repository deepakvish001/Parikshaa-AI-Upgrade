import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConsoleError, type ConsoleClient, type PlusCoupon, type PlusCouponDraft } from "../api.ts";

/**
 * Selling Plus (Prep blueprint §16, F12): coupons, with what each has brought
 * in, and every plan bought with its coupon and GST invoice. An affiliate's
 * link is the site's Plus page with `?ref=CODE`: the code is filled in at
 * checkout.
 */

const failure = (error: unknown, fallback: string) =>
  error instanceof ConsoleError ? (error.detail ?? (error.problems[0]?.message ?? fallback)) : fallback;
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-IN");

const off = (c: Pick<PlusCoupon, "kind" | "value">) => (c.kind === "percent" ? `${c.value}%` : rupees(c.value));

export function Sales({ client }: { client: ConsoleClient }) {
  const queryClient = useQueryClient();
  const coupons = useQuery({ queryKey: ["prep", "coupons"], queryFn: () => client.plusCoupons() });
  const admin = useQuery({ queryKey: ["prep", "plus"], queryFn: () => client.plusAdmin() });
  const orders = useQuery({ queryKey: ["prep", "plus-orders"], queryFn: () => client.plusOrders() });
  const learners = useQuery({ queryKey: ["practice", "learners"], queryFn: () => client.practiceLearners() });
  const site = useQuery({ queryKey: ["practice", "site"], queryFn: () => client.practiceSite() });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["prep", "coupons"] });
  const [draft, setDraft] = useState({ code: "", kind: "percent" as "percent" | "flat", amount: 20, productId: "", maxUses: "", endsOn: "", affiliate: "" });
  const create = useMutation({
    mutationFn: () =>
      client.savePlusCoupon(
        {
          code: draft.code.trim().toUpperCase(),
          kind: draft.kind,
          value: draft.kind === "percent" ? draft.amount : Math.round(draft.amount * 100),
          productId: draft.productId === "" ? null : draft.productId,
          maxUses: draft.maxUses === "" ? null : Number(draft.maxUses),
          // The end of the chosen day, in India.
          endsAt: draft.endsOn === "" ? null : new Date(`${draft.endsOn}T23:59:59+05:30`).toISOString(),
          affiliate: draft.affiliate.trim(),
          active: true,
        },
        true,
      ),
    onSuccess: () => {
      setDraft({ ...draft, code: "", affiliate: "" });
      void refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (c: PlusCoupon) => {
      const { createdAt: _c, uses: _u, revenuePaise: _r, discountPaise: _d, ...rest } = c;
      return client.savePlusCoupon({ ...(rest as PlusCouponDraft), active: !c.active }, false);
    },
    onSuccess: refresh,
  });
  const [open, setOpen] = useState<string | null>(null);
  const invoice = useQuery({ queryKey: ["prep", "invoice", open], queryFn: () => client.plusInvoice(open!), enabled: open !== null });
  const products = admin.data?.products ?? [];
  const planName = new Map(products.map((p) => [p.id, p.title]));
  const nameOf = new Map((learners.data ?? []).map((l) => [l.id, l.name]));
  const paid = (orders.data ?? []).filter((o) => o.status !== "created");
  const [refunding, setRefunding] = useState<{ id: string; reason: string } | null>(null);
  const refund = useMutation({
    mutationFn: (r: { id: string; reason: string }) => client.refundPlusOrder(r.id, r.reason.trim()),
    onSuccess: () => {
      setRefunding(null);
      void queryClient.invalidateQueries({ queryKey: ["prep", "plus-orders"] });
    },
  });
  const linkOf = (code: string) => (site.data === undefined || site.data === null ? null : `${window.location.origin}/practice/${site.data.slug}/plus?ref=${code}`);

  return (
    <>
      <section className="card prep-card" aria-label="Coupons">
        <div className="bar">
          <strong>Coupons</strong>
        </div>
        <p className="notice">
          A coupon takes a share or a sum off a plan; no coupon takes a price below ₹1. Each learner uses one once. Give an affiliate their link: it opens the Plus
          page with the code filled in. Uses and revenue count paid orders only.
        </p>
        {coupons.data === undefined ? (
          <p className="notice">Loading…</p>
        ) : coupons.data.length === 0 ? (
          <p className="notice">No coupons yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Off</th>
                <th scope="col">Plan</th>
                <th scope="col">Limits</th>
                <th scope="col">Affiliate</th>
                <th scope="col">Used</th>
                <th scope="col">Revenue</th>
                <th scope="col">Given off</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {coupons.data.map((c) => (
                <tr key={c.code} className={c.active ? "" : "muted"}>
                  <td>
                    <code>{c.code}</code>
                    {linkOf(c.code) === null ? null : (
                      <>
                        <br />
                        <small>{linkOf(c.code)}</small>
                      </>
                    )}
                  </td>
                  <td>{off(c)}</td>
                  <td>{c.productId === null ? "Any" : (planName.get(c.productId) ?? "—")}</td>
                  <td>
                    {c.maxUses === null ? "No limit" : `${c.maxUses} uses`}
                    {c.endsAt === null ? "" : `, until ${day(c.endsAt)}`}
                  </td>
                  <td>{c.affiliate || "—"}</td>
                  <td>{c.uses}</td>
                  <td>{rupees(c.revenuePaise)}</td>
                  <td>{rupees(c.discountPaise)}</td>
                  <td>
                    <button type="button" className="secondary" disabled={toggle.isPending} onClick={() => toggle.mutate(c)}>
                      {c.active ? "Turn off" : "Turn on"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form
          className="row"
          aria-label="New coupon"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label>
            Code
            <input value={draft.code} required minLength={3} maxLength={30} pattern="[A-Za-z0-9][A-Za-z0-9-]{2,29}" onChange={(e) => setDraft({ ...draft, code: e.target.value })} />
          </label>
          <label>
            Kind
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as "percent" | "flat" })}>
              <option value="percent">Percent off</option>
              <option value="flat">Rupees off</option>
            </select>
          </label>
          <label>
            {draft.kind === "percent" ? "Percent" : "Rupees"}
            <input type="number" min={1} max={draft.kind === "percent" ? 90 : undefined} step={draft.kind === "percent" ? 1 : 0.01} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
          </label>
          <label>
            Plan
            <select value={draft.productId} onChange={(e) => setDraft({ ...draft, productId: e.target.value })}>
              <option value="">Any plan</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Uses (blank: no limit)
            <input type="number" min={1} value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: e.target.value })} />
          </label>
          <label>
            Last day
            <input type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} />
          </label>
          <label className="grow">
            Affiliate
            <input value={draft.affiliate} maxLength={120} onChange={(e) => setDraft({ ...draft, affiliate: e.target.value })} />
          </label>
          <button type="submit" disabled={create.isPending}>
            Make coupon
          </button>
        </form>
        {create.isError ? (
          <p className="error" role="alert">
            {failure(create.error, "The coupon could not be made.")}
          </p>
        ) : null}
      </section>

      <section className="card prep-card" aria-label="Plans bought">
        <div className="bar">
          <strong>Plans bought</strong>
        </div>
        {paid.length === 0 ? (
          <p className="notice">Nothing sold yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Learner</th>
                <th scope="col">Plan</th>
                <th scope="col">Coupon</th>
                <th scope="col">Amount</th>
                <th scope="col">GST within</th>
                <th scope="col">Invoice</th>
                <th scope="col">Refund</th>
              </tr>
            </thead>
            <tbody>
              {paid.map((o) => (
                <tr key={o.id}>
                  <td>{day(o.paidAt ?? o.createdAt)}</td>
                  <td>{nameOf.get(o.learnerId) ?? "—"}</td>
                  <td>{o.title}</td>
                  <td>{o.coupon === null ? "—" : `${o.coupon} (−${rupees(o.discountPaise)})`}</td>
                  <td>{rupees(o.amountPaise)}</td>
                  <td>{rupees(o.taxPaise)}</td>
                  <td>
                    {o.invoice === null ? (
                      "—"
                    ) : (
                      <button type="button" className="link-button" aria-expanded={open === o.invoice} onClick={() => setOpen(open === o.invoice ? null : o.invoice)}>
                        {o.invoice}
                      </button>
                    )}
                  </td>
                  <td>
                    {o.status === "refunded" ? (
                      <>
                        <span className="pill">Refunded {o.refundedAt === null ? "" : day(o.refundedAt)}</span>{" "}
                        {(o.creditNote ?? null) === null ? null : (
                          <button type="button" className="link-button" aria-expanded={open === o.creditNote} onClick={() => setOpen(open === o.creditNote ? null : o.creditNote)}>
                            {o.creditNote}
                          </button>
                        )}
                      </>
                    ) : refunding?.id === o.id ? (
                      <form
                        className="row"
                        aria-label={`Refund ${o.title}`}
                        onSubmit={(e) => {
                          e.preventDefault();
                          refund.mutate(refunding);
                        }}
                      >
                        <label>
                          Why
                          <input value={refunding.reason} required minLength={5} maxLength={300} onChange={(e) => setRefunding({ ...refunding, reason: e.target.value })} />
                        </label>
                        <button type="submit" disabled={refund.isPending}>
                          Refund {rupees(o.amountPaise)}
                        </button>
                        <button type="button" className="secondary" onClick={() => setRefunding(null)}>
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button type="button" className="secondary" onClick={() => setRefunding({ id: o.id, reason: "" })}>
                        Refund…
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="notice">A refund gives the whole amount back through Razorpay, ends the pass the order gave, takes back its credits as far as they are unspent, and issues a GST credit note against the invoice.</p>
        {refund.isError ? (
          <p className="error" role="alert">
            {failure(refund.error, "The order could not be refunded.")}
          </p>
        ) : null}
        {open === null || invoice.data === undefined ? null : (
          <dl className="invoice-summary" aria-label={`${open.startsWith("PKC") ? "Credit note" : "Invoice"} ${open}`}>
            <dt>Billed to</dt>
            <dd>
              {invoice.data.document.buyer.legalName}
              {invoice.data.document.buyer.gstin === null ? "" : `, GSTIN ${invoice.data.document.buyer.gstin}`}
            </dd>
            <dt>Place of supply</dt>
            <dd>{invoice.data.document.placeOfSupply.state}</dd>
            <dt>Taxable value</dt>
            <dd>{rupees(invoice.data.document.taxablePaise)}</dd>
            {invoice.data.document.taxes.map((t) => (
              <Tax key={t.name} name={`${t.name} @ ${t.ratePercent}%`} paise={t.amountPaise} />
            ))}
            <dt>Total</dt>
            <dd>{rupees(invoice.data.document.totalPaise)}</dd>
          </dl>
        )}
      </section>
    </>
  );
}

function Tax({ name, paise }: { name: string; paise: number }) {
  return (
    <>
      <dt>{name}</dt>
      <dd>{rupees(paise)}</dd>
    </>
  );
}
