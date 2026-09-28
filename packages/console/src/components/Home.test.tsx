import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Dashboard } from "../api.ts";
import { describeAction, Home } from "./Home.tsx";

const NOW = Date.parse("2026-10-01T06:00:00Z"); // 11:30 IST
const dashboard: Dashboard = {
  sittings: [
    { examId: "past", title: "Mid-term", opensAt: "2026-09-30T04:30:00Z", closesAt: "2026-09-30T07:30:00Z", invited: 60, started: 58 },
    { examId: "now", title: "Campus drive", opensAt: "2026-10-01T04:30:00Z", closesAt: "2026-10-01T07:30:00Z", invited: 40, started: 12 },
    { examId: "next", title: "Scholarship test", opensAt: "2026-10-03T04:30:00Z", closesAt: "2026-10-03T06:30:00Z", invited: 200, started: 0 },
  ],
  activity: [],
  setup: { exams: 3, bankQuestions: 0, scheduled: 3, invited: 300, staff: 1, privacyNotice: false },
};

const renderHome = (onExam = vi.fn()) =>
  render(<Home dashboard={dashboard} exams={[]} name="Asha Rao" now={NOW} canWrite onExam={onExam} onGo={vi.fn()} />);

describe("the home calendar", () => {
  it("lays the sittings out by day, today's marked open, and greets by first name", () => {
    renderHome();
    expect(screen.getByText("Good morning, Asha.")).toBeInTheDocument();
    const month = screen.getByRole("group", { name: "October 2026" });
    expect(within(month).getByRole("button", { name: "1 October: 1 sitting" })).toHaveClass("today");
    expect(within(month).getByRole("button", { name: "3 October: 1 sitting" })).toBeInTheDocument();
    expect(within(month).getByRole("button", { name: "2 October" })).not.toHaveClass("busy");

    const today = screen.getByText("Today").closest(".agenda-day")!;
    expect(within(today as HTMLElement).getByText("Open now")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument(); // closed, but not a week ago
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("shows only a chosen day's sittings, and opens an exam from them", async () => {
    const onExam = vi.fn();
    renderHome(onExam);
    await userEvent.click(screen.getByRole("button", { name: "3 October: 1 sitting" }));
    expect(screen.getByRole("button", { name: "3 October: 1 sitting" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Campus drive" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Scholarship test" }));
    expect(onExam).toHaveBeenCalledWith("next");
    await userEvent.click(screen.getByRole("button", { name: "Show every sitting" }));
    expect(screen.getByRole("button", { name: "Campus drive" })).toBeInTheDocument();
  });

  it("moves between months", async () => {
    renderHome();
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("group", { name: "November 2026" })).toBeInTheDocument();
  });
});

describe("the activity feed", () => {
  it("says what an action was in words", () => {
    expect(describeAction("exam.window_set")).toBe("scheduled a sitting");
    expect(describeAction("something.new_here")).toBe("something new here");
  });
});
