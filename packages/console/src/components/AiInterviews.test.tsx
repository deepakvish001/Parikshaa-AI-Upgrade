import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { AiInterviewDetail, ConsoleClient, JobRole } from "../api.ts";
import { AiInterviewsPanel } from "./AiInterviews.tsx";

const done: AiInterviewDetail = {
  id: "a1",
  title: "Backend screen",
  roleId: "java-developer",
  job: "",
  seniority: "junior",
  questions: 2,
  minutes: 30,
  candidateRef: "J-17",
  candidateName: "Ananya",
  candidateEmail: null,
  status: "done",
  startedAt: "2026-10-05T05:00:00.000Z",
  endedAt: "2026-10-05T05:20:00.000Z",
  assessment: {
    criteria: [
      { name: "Problem solving", score: 4, evidence: ["I would use a set"] },
      { name: "Code quality", score: 0, evidence: [] },
    ],
    summary: "Clear reasoning on the basics.",
    concerns: ["The second answer reads as pasted."],
  },
  scorecard: null,
  decidedBy: null,
  decidedAt: null,
  createdBy: "HR",
  createdAt: "2026-10-04T05:00:00.000Z",
  link: "https://exam.test/?ai-interview=abc",
  turns: [
    { seq: 0, speaker: "interviewer", kind: "question", body: "How would you find a duplicate?", code: null, language: null, at: "2026-10-05T05:00:00.000Z", hash: "h0" },
    { seq: 1, speaker: "candidate", kind: "answer", body: "I would use a set", code: "seen = set()", language: "python", at: "2026-10-05T05:01:00.000Z", hash: "h1" },
  ],
  transcriptIntact: true,
};
const role: JobRole = { id: "java-developer", family: "Software engineering", title: "Java Developer", summary: "", minutes: 60, cutoffPercent: 60, sections: [] };

function mount(client: Partial<ConsoleClient>, canWrite = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AiInterviewsPanel client={client as ConsoleClient} canWrite={canWrite} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("the AI interviews page", () => {
  it("sets one up for a role, without sending the candidate's details to the model", async () => {
    const createAiInterview = vi.fn(async () => ({ ...done, status: "invited" as const, turns: [], assessment: null }));
    mount({ aiInterviews: async () => [], jobRoles: async () => [role], createAiInterview, aiInterview: async () => ({ ...done, status: "invited" as const, turns: [], assessment: null }) });
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole("button", { name: /Set up an AI interview/ }))[0]!);
    const form = screen.getByRole("form", { name: "AI interview details" });
    await user.type(within(form).getByRole("textbox", { name: "Interview" }), "Backend screen");
    await screen.findByRole("option", { name: "Java Developer" });
    await user.selectOptions(within(form).getByRole("combobox", { name: "Role" }), "java-developer");
    await user.type(within(form).getByRole("textbox", { name: "Candidate's name" }), "Ananya");
    expect(form).toHaveTextContent("never the candidate's name");
    await user.click(within(form).getByRole("button", { name: "Set up and copy the link" }));
    await waitFor(() => expect(createAiInterview).toHaveBeenCalledWith(expect.objectContaining({ title: "Backend screen", roleId: "java-developer", seniority: "junior", questions: 4, minutes: 30, candidateName: "Ananya" })));
    expect(await screen.findByText("The candidate has not started yet.")).toBeInTheDocument();
  });

  it("shows the transcript, the AI's reading with its evidence, and records a person's decision", async () => {
    const decideAiInterview = vi.fn(async () => ({ ...done, scorecard: { criteria: [{ name: "Problem solving", score: 4 }], recommendation: "yes" as const, summary: "" }, decidedBy: "HR", decidedAt: "2026-10-05T06:00:00.000Z" }));
    mount({ aiInterviews: async () => [done], aiInterview: async () => done, decideAiInterview });
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Open" }));
    const transcript = await screen.findByRole("region", { name: "Transcript" });
    expect(transcript).toHaveTextContent("How would you find a duplicate?");
    expect(within(transcript).getByLabelText("Candidate's code (python)")).toHaveTextContent("seen = set()");
    expect(screen.getByText(/Transcript unchanged/)).toBeInTheDocument();
    const reading = screen.getByRole("region", { name: "The AI's reading" });
    expect(reading).toHaveTextContent("Problem solving: 4 / 5");
    expect(reading).toHaveTextContent("“I would use a set”");
    expect(reading).toHaveTextContent("Code quality: no evidence");
    expect(reading).toHaveTextContent("reads as pasted");

    const form = screen.getByRole("form", { name: "Decision" });
    await user.click(within(within(form).getByRole("group", { name: "Problem solving" })).getByRole("button", { name: "4" }));
    await user.click(within(form).getByRole("button", { name: "Yes" }));
    await user.click(within(form).getByRole("button", { name: "Save the decision" }));
    await waitFor(() => expect(decideAiInterview).toHaveBeenCalledWith("a1", { criteria: [{ name: "Problem solving", score: 4 }], recommendation: "yes", summary: "" }));
    expect(await screen.findByText(/By HR/)).toBeInTheDocument();
  });

  it("warns when the transcript was changed, and offers to read it again when the reading did not come", async () => {
    const reassessAiInterview = vi.fn(async () => done);
    mount({ aiInterviews: async () => [done], aiInterview: async () => ({ ...done, assessment: null, transcriptIntact: false }), reassessAiInterview }, false);
    const user = userEvent.setup();
    expect(screen.queryByRole("button", { name: /Set up an AI interview/ })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Open" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed after it was written");
    await user.click(screen.getByRole("button", { name: /Read it again/ }));
    await waitFor(() => expect(reassessAiInterview).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(screen.getByRole("region", { name: "The AI's reading" })).toHaveTextContent("Problem solving: 4 / 5"));
  });
});
