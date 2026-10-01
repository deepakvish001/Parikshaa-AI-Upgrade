import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, ProxyReport } from "../api.ts";
import { ProxyCheck } from "./ProxyCheck.tsx";

const wrap = (client: Partial<ConsoleClient>, onReview = vi.fn()) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <ProxyCheck client={client as ConsoleClient} examId="e1" onReview={onReview} />
      </ToastProvider>
    </QueryClientProvider>,
  );

describe("signs of a proxy", () => {
  it("lists a reused photo, a shared network and a flagged comparison, and compares the rest", async () => {
    const report: ProxyReport = {
      lab: false,
      sharedOrigins: [{ candidates: ["R1", "R2"], attempts: 2, from: "2026-10-01T04:31:00Z", to: "2026-10-01T05:20:00Z" }],
      reusedPhotos: [{ candidates: ["R1", "R3"] }],
      checks: [{ attemptId: "a4", ref: "R4", flagged: true, flags: ["Another person in photo 2"], summary: "", checkedAt: "" }],
      unchecked: 3,
    };
    const compareIdentities = vi.fn(async () => ({ checked: 3, flagged: 0 }));
    const onReview = vi.fn();
    wrap({ proxyReport: async () => report, compareIdentities }, onReview);
    expect(await screen.findByText(/for R1, R3/)).toBeInTheDocument();
    expect(screen.getByText(/for R1, R2, 10:01 am–10:50 am/i)).toBeInTheDocument();
    expect(screen.getByText(/Another person in photo 2/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onReview).toHaveBeenCalledWith("a4");
    await userEvent.click(screen.getByRole("button", { name: "Compare photos of 3" }));
    await waitFor(() => expect(compareIdentities).toHaveBeenCalledWith("e1"));
  });

  it("stays out of the way when there is nothing to look at", async () => {
    const proxyReport = vi.fn(async () => ({ lab: false, sharedOrigins: [], reusedPhotos: [], checks: [], unchecked: 0 }));
    wrap({ proxyReport });
    await waitFor(() => expect(proxyReport).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("region", { name: "Signs of a proxy" })).toBeNull();
  });
});
