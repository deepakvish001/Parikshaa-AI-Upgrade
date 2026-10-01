import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, PrepAnalytics } from "../api.ts";
import { PrepAnalyticsPanel } from "./PrepAnalytics.tsx";

/** The practice site's numbers in the console (Prep blueprint §17), against a stub of its client. */

const data: PrepAnalytics = {
  from: "2026-09-15",
  to: "2026-10-14",
  funnel: { signedUp: 40, startedPlan: 20, solvedOne: 30, usedTutor: 10, bought: 4 },
  activation: { cohort: 25, activated: 15 },
  retention: { d1: { cohort: 38, returned: 19 }, d7: { cohort: 25, returned: 5 } },
  days: Array.from({ length: 30 }, (_, i) => ({ day: new Date(Date.UTC(2026, 8, 15 + i)).toISOString().slice(0, 10), active: i, signups: i % 3, solves: i % 5 })),
  reminders: { enabled: 12, sentInWindow: 80 },
};

describe("practice analytics", () => {
  it("shows activation, D1 and D7, the funnel and each day, newest first", async () => {
    const client = { prepAnalytics: vi.fn(async () => data) } as unknown as ConsoleClient;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <PrepAnalyticsPanel client={client} />
      </QueryClientProvider>,
    );
    const month = await screen.findByRole("region", { name: "This month" });
    expect(month.textContent).toContain("Activation60%");
    expect(month.textContent).toContain("Back the next day (D1)50%");
    expect(month.textContent).toContain("Back a week later (D7)20%");
    expect(month.textContent).toContain("80 sent in these days");
    const funnel = screen.getByRole("region", { name: "From sign-up to purchase" });
    expect(within(funnel).getByRole("row", { name: /Bought a plan/ }).textContent).toBe("Bought a plan410%");
    const days = within(screen.getByRole("region", { name: "Day by day" })).getAllByRole("row");
    expect(days).toHaveLength(31);
    expect(days[1]!.textContent).toContain("14 Oct");
  });
});
