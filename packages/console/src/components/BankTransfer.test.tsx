import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { BillingSummary, ConsoleClient } from "../api.ts";
import { BankTransfer } from "./BankTransfer.tsx";

describe("paying by bank transfer", () => {
  it("gets a quotation with the purchase order, and lists quotations awaiting transfer", async () => {
    const summary = {
      payments: [{ id: "p1", orderId: "neft_abc", paymentId: null, credits: 500, amountPaise: 2_950_000, status: "created", createdAt: "", poNumber: "PO/118" }],
    } as unknown as BillingSummary;
    const client = { createQuotation: vi.fn(async () => ({ id: "p2", orderId: "neft_def", credits: 200, amountPaise: 1, poNumber: "PO/119" })), quotationPdf: vi.fn(async () => new Blob(["%PDF"])) };
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BankTransfer client={client as unknown as ConsoleClient} summary={summary} />
      </QueryClientProvider>,
    );
    const table = screen.getByRole("table", { name: "Quotations" });
    expect(within(table).getByText("neft_abc").closest("tr")).toHaveTextContent("PO/118500₹29,500.00Awaiting transfer");
    const credits = screen.getByRole("spinbutton", { name: "Credits to quote for" });
    await user.clear(credits);
    await user.type(credits, "200");
    await user.type(screen.getByRole("textbox", { name: "Purchase order number" }), "PO/119");
    await user.click(screen.getByRole("button", { name: "Get a quotation (PDF)" }));
    await waitFor(() => expect(client.createQuotation).toHaveBeenCalledWith(200, "PO/119"));
    await waitFor(() => expect(client.quotationPdf).toHaveBeenCalledWith("p2"));
  });
});
