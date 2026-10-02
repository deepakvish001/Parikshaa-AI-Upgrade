import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient } from "../api.ts";
import { InternalMarks } from "./InternalMarks.tsx";

describe("internal marks", () => {
  it("adds the course's other exams, counts the best two, and shows the sheet", async () => {
    const internalMarks = vi.fn(async () => ({
      columns: [
        { examId: "mid1", label: "Mid-term 1", marks: 10 },
        { examId: "mid2", label: "Mid-term 2", marks: 10 },
        { examId: "quiz", label: "Quiz", marks: 10 },
      ],
      outOf: 20,
      best: 2,
      rows: [{ ref: "CS2", name: "Ravi", marks: [7.5, null, 10], total: 18 }],
      csv: "x",
    }));
    const listExams = async () => [
      { id: "mid1", title: "Mid-term 1", questionCount: 4 },
      { id: "mid2", title: "Mid-term 2", questionCount: 4 },
      { id: "quiz", title: "Quiz", questionCount: 4 },
    ];
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <InternalMarks client={{ listExams, internalMarks } as unknown as ConsoleClient} examId="mid1" />
      </QueryClientProvider>,
    );
    const add = await screen.findByRole("combobox", { name: /Add an exam/ });
    await userEvent.selectOptions(add, "mid2");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: /Add an exam/ }), "quiz");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Count" }), "2");
    await userEvent.click(screen.getByRole("button", { name: "Work out the marks" }));
    await waitFor(() =>
      expect(internalMarks).toHaveBeenCalledWith({
        components: [
          { examId: "mid1", marks: 10 },
          { examId: "mid2", marks: 10 },
          { examId: "quiz", marks: 10 },
        ],
        best: 2,
        rounding: "up",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("1 students · out of 20 (best 2)");
    expect(screen.getByRole("table", { name: "Internal marks" })).toHaveTextContent("CS2Ravi7.5AB1018");
  });
});
