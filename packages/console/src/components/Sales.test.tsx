import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, PlusCoupon, PlusCouponDraft } from "../api.ts";
import { Sales } from "./Sales.tsx";

/** Coupons and what they sold, in the console (Prep blueprint §16), against a stub of its client. */

function stub() {
  const coupons: PlusCoupon[] = [
    {
      code: "LAUNCH20",
      kind: "percent",
      value: 20,
      productId: "pr1",
      maxUses: 100,
      endsAt: null,
      affiliate: "Campus Coding Club",
      active: true,
      createdAt: "2026-10-01T00:00:00Z",
      uses: 2,
      revenuePaise: 159_840,
      discountPaise: 39_960,
    },
  ];
  return {
    plusCoupons: vi.fn(async () => [...coupons]),
    savePlusCoupon: vi.fn(async (draft: PlusCouponDraft, create: boolean) => {
      const saved = { ...draft, createdAt: "2026-10-05T00:00:00Z", uses: 0, revenuePaise: 0, discountPaise: 0 };
      if (create) coupons.unshift(saved);
      else coupons.splice(coupons.findIndex((c) => c.code === draft.code), 1, { ...coupons.find((c) => c.code === draft.code)!, ...draft });
      return saved;
    }),
    plusAdmin: vi.fn(async () => ({ settings: { plusEnabled: true, freeModules: 1, monthlyCredits: 100, tutorEnabled: true }, products: [{ id: "pr1", title: "Plus, 3 months", kind: "plus", days: 90, credits: 1000, pricePaise: 99_900, active: true, position: 0 }] })),
    plusOrders: vi.fn(async () => [
      { id: "o1", learnerId: "l1", title: "Plus, 3 months", days: 90, credits: 1000, listPaise: 99_900, coupon: "LAUNCH20", discountPaise: 19_980, amountPaise: 79_920, taxPaise: 12_191, status: "paid", createdAt: "2026-10-05T04:00:00Z", paidAt: "2026-10-05T04:01:00Z", invoice: "PKP/2627/000001" },
      { id: "o2", learnerId: "l1", title: "Plus, 3 months", days: 90, credits: 1000, listPaise: 99_900, coupon: null, discountPaise: 0, amountPaise: 99_900, taxPaise: 15_239, status: "created", createdAt: "2026-10-05T05:00:00Z", paidAt: null, invoice: null },
    ]),
    plusInvoice: vi.fn(async (number: string) => ({
      number,
      issuedAt: "2026-10-05T04:01:00Z",
      document: { buyer: { legalName: "Asha Rao", gstin: null, state: "Maharashtra" }, placeOfSupply: { state: "Maharashtra" }, taxablePaise: 67_729, taxes: [{ name: "IGST", ratePercent: 18, amountPaise: 12_191 }], totalPaise: 79_920 },
    })),
    practiceLearners: vi.fn(async () => [{ id: "l1", name: "Asha Rao", email: "asha@example.com", joinedAt: "", solved: 0, submissions: 0, lastActiveAt: null }]),
    practiceSite: vi.fn(async () => ({ slug: "nit-practice", title: "NIT Practice", welcome: "", open: true })),
  };
}

const show = (client: ReturnType<typeof stub>) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Sales client={client as unknown as ConsoleClient} />
    </QueryClientProvider>,
  );

describe("coupons and sales", () => {
  it("lists coupons with what they sold and the affiliate's link, makes one, and turns one off", async () => {
    const client = stub();
    const user = userEvent.setup();
    show(client);
    const table = await screen.findByRole("region", { name: "Coupons" });
    const row = (await within(table).findByText("LAUNCH20")).closest("tr")!;
    expect(row.textContent).toContain("20%");
    expect(row.textContent).toContain("Plus, 3 months");
    expect(row.textContent).toContain("Campus Coding Club");
    expect(row.textContent).toContain("₹1,598.4");
    expect(row.textContent).toContain(`${window.location.origin}/practice/nit-practice/plus?ref=LAUNCH20`);

    const form = screen.getByRole("form", { name: "New coupon" });
    await user.type(within(form).getByLabelText("Code"), "diwali");
    await user.selectOptions(within(form).getByLabelText("Kind"), "flat");
    await user.clear(within(form).getByLabelText("Rupees"));
    await user.type(within(form).getByLabelText("Rupees"), "150");
    await user.type(within(form).getByLabelText(/Uses/), "50");
    await user.type(within(form).getByLabelText("Affiliate"), "Ravi");
    await user.click(within(form).getByRole("button", { name: "Make coupon" }));
    await waitFor(() =>
      expect(client.savePlusCoupon).toHaveBeenCalledWith({ code: "DIWALI", kind: "flat", value: 15_000, productId: null, maxUses: 50, endsAt: null, affiliate: "Ravi", active: true }, true),
    );

    await user.click(within(row).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(client.savePlusCoupon).toHaveBeenLastCalledWith(expect.objectContaining({ code: "LAUNCH20", active: false }), false));
  });

  it("lists paid orders with their coupon, and opens an invoice's taxes", async () => {
    const client = stub();
    const user = userEvent.setup();
    show(client);
    const sold = await screen.findByRole("region", { name: "Plans bought" });
    await within(sold).findByText("LAUNCH20 (−₹199.8)");
    // An order not paid is not a sale.
    expect(within(sold).getAllByRole("row")).toHaveLength(2);
    await user.click(within(sold).getByRole("button", { name: "PKP/2627/000001" }));
    const summary = await screen.findByLabelText("Invoice PKP/2627/000001");
    expect(summary.textContent).toContain("IGST @ 18%");
    expect(summary.textContent).toContain("Maharashtra");
    expect(client.plusInvoice).toHaveBeenCalledWith("PKP/2627/000001");
  });
});
