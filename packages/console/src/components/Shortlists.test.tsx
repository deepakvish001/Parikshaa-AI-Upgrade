import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, ShortlistRow } from "../api.ts";
import { Shortlists } from "./Shortlists.tsx";

const list: ShortlistRow = {
  id: "s1",
  title: "Round 2",
  candidates: 4,
  createdBy: "Asha",
  createdAt: "2026-10-01T00:00:00Z",
  expiresAt: "2099-10-08T00:00:00Z",
  revoked: false,
  decided: { shortlist: 2, hold: 1, reject: 0 },
  link: "https://exam.test/?shortlist=x",
  decisions: [{ ref: "J1", decision: "shortlist", comment: "Strong", by: "Priya", at: "" }],
};

describe("shortlists for hiring managers", () => {
  it("makes a link for the qualified, and shows the manager's decisions", async () => {
    const client = { shortlists: vi.fn(async () => [list]), createShortlist: vi.fn(async () => list), withdrawShortlist: vi.fn() };
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Shortlists client={client as unknown as ConsoleClient} examId="java" qualified={4} />
      </QueryClientProvider>,
    );
    const card = await screen.findByRole("region", { name: "Shortlists for hiring managers" });
    expect(await within(card).findByText("Round 2")).toBeTruthy();
    expect(card).toHaveTextContent("2 shortlisted · 1 on hold · 0 rejected");
    expect(card).toHaveTextContent("J1: Shortlisted (“Strong”)");
    await user.type(within(card).getByRole("textbox", { name: "Shortlist title" }), "Final");
    await user.click(within(card).getByRole("button", { name: "Make the link" }));
    await waitFor(() => expect(client.createShortlist).toHaveBeenCalledWith("java", { title: "Final", refs: null, days: 7 }));
  });
});
