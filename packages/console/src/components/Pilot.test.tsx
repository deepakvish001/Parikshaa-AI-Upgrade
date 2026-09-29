import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Dashboard, ExamSummary } from "../api.ts";
import { Home } from "./Home.tsx";
import { TimeDialog } from "./Intervene.tsx";
import { PageFrame } from "./kit.tsx";

/** What a pilot's first sittings need: attempts to grade said on Home, and extra time for a whole hall. */

const dashboard: Dashboard = {
  sittings: [],
  activity: [],
  setup: { exams: 2, bankQuestions: 3, scheduled: 2, invited: 40, staff: 2, privacyNotice: true, sampleExamId: null, prepaidCredits: null },
};
const exam = (id: string, title: string, submitted: number): ExamSummary => ({
  id,
  title,
  questionCount: 10,
  attempts: { invited: 20, inProgress: 0, submitted, graded: 0, void: 0 },
});

const renderHome = (exams: readonly ExamSummary[], onResults = vi.fn(), onExams = vi.fn()) => {
  render(
    <PageFrame title="Home" note="">
      <Home dashboard={dashboard} exams={exams} name="Asha" canWrite onExam={vi.fn()} onExams={onExams} onGo={vi.fn()} onResults={onResults} />
    </PageFrame>,
  );
  return { onResults, onExams };
};

describe("attempts waiting on Home", () => {
  it("goes straight to the one exam's Results, where Grade all is", async () => {
    const { onResults } = renderHome([exam("drive", "Campus drive", 12), exam("mid", "Mid-term", 0)]);
    expect(screen.getByText("12 attempts waiting to be graded")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Grade them" }));
    expect(onResults).toHaveBeenCalledWith("drive");
  });

  it("lists the exams when several are waiting", async () => {
    const { onExams } = renderHome([exam("drive", "Campus drive", 2), exam("mid", "Mid-term", 1)]);
    expect(screen.getByText("3 attempts waiting to be graded")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "See which exams" }));
    expect(onExams).toHaveBeenCalledWith("grading");
  });

  it("says nothing when none are", () => {
    renderHome([exam("drive", "Campus drive", 0)]);
    expect(screen.queryByText(/waiting to be graded/)).toBeNull();
  });
});

describe("extra time for everyone", () => {
  it("names how many it reaches, and needs minutes and a reason", async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<TimeDialog kind="everyone" who="37 candidates" onSubmit={onSubmit} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Extra time for everyone still sitting" })).toBeInTheDocument();
    expect(screen.getByText(/each of the 37 candidates still sitting/)).toBeInTheDocument();
    const grant = screen.getByRole("button", { name: "Grant extra time to 37 candidates" });
    expect(grant).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Reason"), "Power cut across the lab block");
    await userEvent.click(grant);
    expect(onSubmit).toHaveBeenCalledWith(10, "Power cut across the lab block");
  });
});
