import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Dashboard } from "../api.ts";
import { describeAction, Home } from "./Home.tsx";
import { PageFrame } from "./kit.tsx";

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

const renderHome = (onExam = vi.fn(), onExams = vi.fn(), data: Dashboard = dashboard) =>
  render(
    <PageFrame title="Home" note="">
      <Home
        dashboard={data}
        exams={[
          { id: "now", title: "Campus drive", questionCount: 20, attempts: { invited: 40, inProgress: 12, submitted: 3, graded: 0, void: 0 } },
          { id: "old", title: "Old", questionCount: 5, archivedAt: "2026-01-01T00:00:00Z", attempts: { invited: 0, inProgress: 0, submitted: 0, graded: 0, void: 0 } },
        ]}
        name="Asha Rao"
        now={NOW}
        canWrite
        onExam={onExam}
        onExams={onExams}
        onGo={vi.fn()}
      />
    </PageFrame>,
  );

describe("the figures", () => {
  it("counts in the glossary's words, and each opens the exams it counts", async () => {
    const onExams = vi.fn();
    renderHome(vi.fn(), onExams);
    const glance = screen.getByRole("region", { name: "At a glance" });
    expect(within(glance).getByRole("button", { name: "12 In progress" })).toBeInTheDocument();
    // Archived exams are not counted among the organisation's exams.
    expect(within(glance).getByRole("button", { name: "1 Exams" })).toBeInTheDocument();
    await userEvent.click(within(glance).getByRole("button", { name: "3 To grade" }));
    expect(onExams).toHaveBeenCalledWith("grading");
  });
});

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

describe("the week", () => {
  it("draws each sitting as a block across its hours", async () => {
    const onExam = vi.fn();
    renderHome(onExam);
    await userEvent.click(screen.getByRole("button", { name: "Week" }));
    const week = screen.getByRole("group", { name: "Week of 28 September" });
    const block = within(week).getByRole("button", { name: "Campus drive" }).closest("li")!;
    expect(block).toHaveClass("open");
    expect(block).toHaveTextContent("10:00 am – 1:00 pm");
    await userEvent.click(within(week).getByRole("button", { name: "Scholarship test" }));
    expect(onExam).toHaveBeenCalledWith("next");
    await userEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("group", { name: "Week of 5 October" })).toHaveTextContent("No sitting this week.");
  });
});

describe("the activity feed", () => {
  it("groups the latest actions by day, naming the exam each concerns", async () => {
    const onExam = vi.fn();
    renderHome(onExam, vi.fn(), {
      ...dashboard,
      activity: [
        { at: "2026-10-01T05:50:00Z", actor: "Asha", action: "invitations.imported", target: "now", exam: { id: "now", title: "Campus drive" } },
        { at: "2026-09-30T08:00:00Z", actor: "Ravi", action: "auth.login", target: null, exam: null },
      ],
    });
    const feed = screen.getByRole("region", { name: "Recent activity" });
    const today = within(feed).getByText("Today").closest(".activity-day") as HTMLElement;
    expect(today).toHaveTextContent("Asha invited candidates · Campus drive10 min ago");
    expect(within(feed).getByText("Yesterday").closest(".activity-day")).toHaveTextContent("Ravi signed in");
    await userEvent.click(within(today).getByRole("button", { name: "Campus drive" }));
    expect(onExam).toHaveBeenCalledWith("now");
  });

  it("says what an action was in words", () => {
    expect(describeAction("exam.window_set")).toBe("set when an exam is open");
    expect(describeAction("something.new_here")).toBe("something new here");
  });
});
