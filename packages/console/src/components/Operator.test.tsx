import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import { ConsoleError, type ConsoleClient, type OperatorOrg } from "../api.ts";
import { OperatorPanel } from "./Operator.tsx";

/** Parikshaa's operator panel (G1): the list, opening a company, pausing, credits, a new invitation. */

const acme: OperatorOrg = {
  id: "acme",
  publicId: "PKC-7F3K2Q",
  name: "Acme Engineering",
  kind: "company",
  createdAt: "2026-10-01T04:00:00.000Z",
  suspended: null,
  owner: { name: "Asha", email: "owner@acme.test", verified: true },
  staff: 3,
  exams: 2,
  invited: 40,
  started: 31,
  credits: 12,
  lastActivity: "2026-10-03T05:00:00.000Z",
};
const nit: OperatorOrg = { ...acme, id: "nit", publicId: "PKC-AB12CD", name: "NIT Trichy", kind: "institution", owner: { name: "Ravi", email: "tpo@nit.test", verified: false }, credits: null };

function client(overrides: Partial<ConsoleClient> = {}) {
  return {
    operatorOrgs: vi.fn(async () => [acme, nit]),
    createOrg: vi.fn(async () => ({ ...acme, id: "zeta", publicId: "PKC-ZZ99ZZ", name: "Zeta Labs", owner: { name: "Kiran", email: "kiran@zeta.test", verified: true } })),
    suspendOrg: vi.fn(async () => ({ ...acme, suspended: { at: "2026-10-03T06:00:00.000Z", reason: "Unpaid" } })),
    resumeOrg: vi.fn(async () => acme),
    grantOrgCredits: vi.fn(async () => ({ ...acme, credits: 37 })),
    reinviteOwner: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as ConsoleClient & Record<string, ReturnType<typeof vi.fn>>;
}

const renderPanel = (c: ConsoleClient) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <OperatorPanel client={c} />
      </ToastProvider>
    </QueryClientProvider>,
  );

describe("the operator panel", () => {
  it("lists every organisation by its Company ID, and finds one", async () => {
    renderPanel(client());
    const rows = await screen.findAllByRole("row");
    expect(within(rows[1]!).getByText("PKC-7F3K2Q")).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Acme Engineering · company");
    expect(rows[2]).toHaveTextContent("NIT Trichy · college");
    expect(rows[2]).toHaveTextContent("invoiced");
    await userEvent.type(screen.getByLabelText("Find"), "pkc-ab");
    expect(screen.queryByText("Acme Engineering")).toBeNull();
    expect(screen.getByText("NIT Trichy")).toBeInTheDocument();
  });

  it("opens a company with its owner", async () => {
    const c = client();
    renderPanel(c);
    await userEvent.click(await screen.findByRole("button", { name: "New company" }));
    const form = screen.getByRole("form", { name: "New company" });
    const open = within(form).getByRole("button", { name: "Open the account" });
    expect(open).toBeDisabled();
    await userEvent.type(within(form).getByLabelText("Name"), "Zeta Labs");
    await userEvent.type(within(form).getByLabelText("Owner's name"), "Kiran Shah");
    await userEvent.type(within(form).getByLabelText("Owner's work email"), "kiran@zeta.test");
    await userEvent.click(open);
    expect(c.createOrg).toHaveBeenCalledWith({ name: "Zeta Labs", kind: "company", ownerName: "Kiran Shah", ownerEmail: "kiran@zeta.test", pricePerAttemptRupees: 99, invoiced: false, credits: 25 });
    expect(await screen.findByText(/Zeta Labs is open as PKC-ZZ99ZZ/)).toBeInTheDocument();
  });

  it("pauses with a reason, gives credits with a note, and sends the invitation again", async () => {
    const c = client();
    renderPanel(c);
    await userEvent.click(await screen.findByRole("button", { name: "Pause Acme Engineering" }));
    const pause = screen.getByRole("form", { name: "Pause Acme Engineering" });
    await userEvent.type(within(pause).getByLabelText("Why (the owner is told)"), "Invoice unpaid");
    await userEvent.click(within(pause).getByRole("button", { name: "Pause" }));
    expect(c.suspendOrg).toHaveBeenCalledWith("PKC-7F3K2Q", "Invoice unpaid");

    await userEvent.click(screen.getByRole("button", { name: "Give credits to Acme Engineering" }));
    const give = screen.getByRole("form", { name: "Give credits to Acme Engineering" });
    await userEvent.type(within(give).getByLabelText("Credits"), "25");
    await userEvent.type(within(give).getByLabelText("Note"), "Paid by NEFT");
    await userEvent.click(within(give).getByRole("button", { name: "Give" }));
    expect(c.grantOrgCredits).toHaveBeenCalledWith("PKC-7F3K2Q", 25, "Paid by NEFT");

    await userEvent.click(screen.getByRole("button", { name: "Send NIT Trichy's owner a new invitation" }));
    expect(c.reinviteOwner).toHaveBeenCalledWith("PKC-AB12CD");
  });

  it("shows a paused company, and resumes it", async () => {
    const c = client({ operatorOrgs: vi.fn(async () => [{ ...acme, suspended: { at: "2026-10-03T06:00:00.000Z", reason: "Unpaid" } }]) } as Partial<ConsoleClient>);
    renderPanel(c);
    expect(await screen.findByText("Paused")).toHaveAttribute("title", "Unpaid");
    await userEvent.click(screen.getByRole("button", { name: "Resume Acme Engineering" }));
    await waitFor(() => expect(c.resumeOrg).toHaveBeenCalledWith("PKC-7F3K2Q"));
  });

  it("asks an operator without a second factor to set one up", async () => {
    renderPanel(client({ operatorOrgs: vi.fn(async () => Promise.reject(new ConsoleError(403, "operator_needs_2fa", [], "Set up a second factor on your account first"))) } as Partial<ConsoleClient>));
    expect(await screen.findByRole("alert")).toHaveTextContent("Set up a second factor on your account first. Turn it on under Account.");
    expect(screen.queryByRole("button", { name: "New company" })).toBeNull();
  });
});
