import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Landmark } from "lucide-react";
import { ConsoleError, type BillingSummary, type ConsoleClient } from "../api.ts";
import { rupees } from "./Billing.tsx";
import { SettingsGroup } from "./kit.tsx";

/**
 * Paying by bank transfer (docs/PREP-TRACKER.md, V2-12 CL57): most colleges
 * pay against a purchase order by NEFT, not by card. A quotation carries the
 * same price and GST as Checkout and the account to pay into; credits and the
 * tax invoice follow once the transfer is matched.
 */

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function BankTransfer({ client, summary }: { client: ConsoleClient; summary: BillingSummary }) {
  const queryClient = useQueryClient();
  const [credits, setCredits] = useState("500");
  const [po, setPo] = useState("");
  const pdf = useMutation({ mutationFn: (q: { id: string; orderId: string }) => client.quotationPdf(q.id).then((blob) => save(blob, `quotation-${q.orderId}.pdf`)) });
  const quote = useMutation({
    mutationFn: () => client.createQuotation(Number(credits), po.trim() === "" ? null : po.trim()),
    onSuccess: (q) => {
      void queryClient.invalidateQueries({ queryKey: ["billing"] });
      pdf.mutate(q);
    },
  });
  const open = summary.payments.filter((p) => p.orderId.startsWith("neft_"));
  return (
    <SettingsGroup id="billing-transfer" title="Pay by bank transfer" description="Against your purchase order, by NEFT, RTGS or IMPS. Credits and the tax invoice follow once the transfer is matched, usually within a working day.">
      <form
        className="row"
        aria-label="Get a quotation"
        onSubmit={(e) => {
          e.preventDefault();
          quote.mutate();
        }}
      >
        <label className="inline">
          Credits <input type="number" min={1} max={100000} className="minutes-input" value={credits} onChange={(e) => setCredits(e.target.value)} aria-label="Credits to quote for" />
        </label>
        <input aria-label="Purchase order number" placeholder="Purchase order number (optional)" value={po} onChange={(e) => setPo(e.target.value)} />
        <button type="submit" disabled={quote.isPending || !(Number(credits) >= 1)}>
          <Landmark aria-hidden="true" />
          Get a quotation (PDF)
        </button>
      </form>
      {quote.error === null ? null : (
        <p className="error" role="alert">
          {quote.error instanceof ConsoleError && quote.error.detail !== undefined ? quote.error.detail : "That did not work."}
        </p>
      )}
      {open.length === 0 ? null : (
        <div className="scroll">
          <table aria-label="Quotations">
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Purchase order</th>
                <th scope="col" className="num">
                  Credits
                </th>
                <th scope="col" className="num">
                  Total
                </th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">PDF</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {open.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.orderId}</td>
                  <td>{p.poNumber ?? "—"}</td>
                  <td className="num">{p.credits.toLocaleString("en-IN")}</td>
                  <td className="num">{rupees(p.amountPaise)}</td>
                  <td>{p.status === "paid" ? <span className="pill tone-ok">Paid</span> : <span className="pill">Awaiting transfer</span>}</td>
                  <td>
                    <button type="button" className="quiet" onClick={() => pdf.mutate(p)} aria-label={`Download ${p.orderId}`}>
                      <Download aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingsGroup>
  );
}
