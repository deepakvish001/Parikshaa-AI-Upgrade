import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, Interview } from "../api.ts";
import { InterviewsPanel } from "./Interviews.tsx";

const base: Interview = {
  id: "i1",
  title: "Backend round 1",
  candidateRef: "J1",
  candidateName: "Ananya",
  candidateEmail: null,
  interviewer: "HR",
  scheduledAt: "2026-10-06T04:30:00.000Z",
  minutes: 45,
  meetingUrl: "https://meet.jit.si/parikshaa-x",
  problem: "Reverse a linked list",
  language: "python",
  code: "def rev(h):\n  pass",
  codeUpdatedAt: "2026-10-06T04:35:00.000Z",
  notes: "",
  scorecard: null,
  status: "scheduled",
  link: "https://exam.test/?interview=abc",
};

function mount(client: Partial<ConsoleClient>) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <InterviewsPanel client={client as ConsoleClient} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("the interviews page", () => {
  it("lists interviews, opens the room with the candidate's code, and saves a scorecard", async () => {
    const scoreInterview = vi.fn(async () => ({ ...base, status: "done" as const, scorecard: { criteria: [{ name: "Problem solving", score: 4 }], recommendation: "yes" as const, summary: "" } }));
    mount({ interviews: async () => [base], interview: async () => base, scoreInterview });
    await userEvent.click(await screen.findByRole("button", { name: "Open the room" }));
    expect(await screen.findByLabelText("Candidate's code")).toHaveTextContent("def rev(h):");
    expect(screen.getByRole("link", { name: /Join the video call/ })).toHaveAttribute("href", base.meetingUrl);
    await userEvent.click(screen.getAllByRole("button", { name: "4" })[0]!);
    await userEvent.click(screen.getByRole("button", { name: "Yes" }));
    await userEvent.click(screen.getByRole("button", { name: "Save the scorecard and close" }));
    await waitFor(() => expect(scoreInterview).toHaveBeenCalledWith("i1", { criteria: [{ name: "Problem solving", score: 4 }], recommendation: "yes", summary: "" }));
    expect(await screen.findByRole("heading", { name: /Scorecard — Yes/ })).toBeInTheDocument();
  });

  it("says what to do when there are none", async () => {
    mount({ interviews: async () => [] });
    expect(await screen.findByText(/No interviews yet/)).toBeInTheDocument();
  });
});
