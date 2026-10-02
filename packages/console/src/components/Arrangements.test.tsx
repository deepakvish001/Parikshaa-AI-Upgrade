import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient } from "../api.ts";
import { Arrangements } from "./Arrangements.tsx";

describe("arrangements for a disability", () => {
  it("lists them and sets a third extra time with a scribe", async () => {
    const setArrangement = vi.fn(async () => ({}) as never);
    const client = {
      arrangements: async () => [{ candidateRef: "PWD1", extraPercent: 33, scribe: false, largeText: true, note: "Low vision", setBy: { userId: "u", name: "CoE" }, setAt: "" }],
      setArrangement,
    };
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <Arrangements client={client as unknown as ConsoleClient} examId="sem" />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("33% extra time · larger text")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Roll number"), "PWD2");
    await userEvent.click(screen.getByLabelText("A scribe"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(setArrangement).toHaveBeenCalledWith("sem", "PWD2", { extraPercent: 33, scribe: true, largeText: false, note: "" }));
  });
});
