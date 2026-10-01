import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient } from "../api.ts";
import { Outcomes } from "./Outcomes.tsx";

describe("course outcomes", () => {
  it("shows attainment, and maps questions and the CO–PO matrix", async () => {
    const client = {
      outcomes: vi.fn(async () => ({
        questions: [
          { id: "q1", number: 1, stem: "Arrays", maxScore: 2 },
          { id: "q2", number: 2, stem: "Trees", maxScore: 2 },
        ],
        mapping: { q1: ["CO1"] },
        matrix: { CO1: { PO1: 3 } },
        threshold: 60,
      })),
      attainment: vi.fn(async () => ({ threshold: 60, candidates: 5, courseOutcomes: [{ co: "CO1", questions: 1, candidates: 5, attained: 4, percent: 80, level: 3 }], programmeOutcomes: [{ po: "PO1", level: 3 }] })),
      saveOutcomes: vi.fn(async () => undefined),
    };
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Outcomes client={client as unknown as ConsoleClient} examId="dsa" canEdit />
      </QueryClientProvider>,
    );
    const table = await screen.findByRole("table", { name: "Attainment" });
    expect(within(table).getByRole("rowheader", { name: "CO1" }).closest("tr")).toHaveTextContent("CO114 of 5 (80%)3");
    expect(within(table).getByRole("rowheader", { name: "PO1" }).closest("tr")).toHaveTextContent("3.00");
    await user.click(screen.getByRole("button", { name: "Change the mapping" }));
    await user.type(screen.getByRole("textbox", { name: "Course outcomes for question 2" }), "co2");
    await user.selectOptions(await screen.findByRole("combobox", { name: "CO2 to PO2" }), "2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(client.saveOutcomes).toHaveBeenCalledWith("dsa", { mapping: { q1: ["CO1"], q2: ["co2"] }, matrix: { CO1: { PO1: 3 }, CO2: { PO2: 2 } }, threshold: 60 }),
    );
  });
});
