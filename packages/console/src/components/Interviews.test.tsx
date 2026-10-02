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

  it("puts others on the panel, and shows each member's scorecard beside the average", async () => {
    const scheduleInterview = vi.fn(async () => ({ ...base, id: "i2" }));
    const card = (score: number, recommendation: "yes" | "strong_yes") => ({ criteria: [{ name: "Code", score }], recommendation, summary: "" });
    const scored: Interview = {
      ...base,
      id: "i2",
      status: "done",
      scorecard: { criteria: [{ name: "Code", score: 4.5 }], recommendation: "strong_yes", summary: "" },
      panel: [
        { userId: "u1", name: "Priya", scored: true },
        { userId: "u2", name: "Arjun", scored: true },
      ],
      scores: [
        { userId: "u1", name: "Priya", scorecard: card(4, "yes"), scoredAt: "" },
        { userId: "u2", name: "Arjun", scorecard: card(5, "strong_yes"), scoredAt: "" },
      ],
    };
    mount({
      interviews: async () => [],
      interview: async () => scored,
      scheduleInterview,
      me: async () => ({ id: "u1" }) as never,
      listStaff: async () => [
        { id: "u1", name: "Priya", email: "p@x.in", role: "owner", disabled: false },
        { id: "u2", name: "Arjun", email: "a@x.in", role: "reviewer", disabled: false },
      ] as never,
    });
    await userEvent.click((await screen.findAllByRole("button", { name: /Schedule an interview/ }))[0]!);
    await userEvent.type(screen.getByLabelText("Interview"), "Round 2");
    await userEvent.type(screen.getByLabelText("Candidate's name"), "Ananya");
    await userEvent.type(screen.getByLabelText("Date and time (India time)"), "2026-10-06T10:00");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Arjun" }));
    expect(screen.queryByRole("checkbox", { name: "Priya" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Schedule and copy the link" }));
    await waitFor(() => expect(scheduleInterview).toHaveBeenCalledWith(expect.objectContaining({ panel: ["u2"] })));
    expect(await screen.findByRole("heading", { name: /Panel average \(2\) — Strong yes/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Each member's scorecard" })).toHaveTextContent("ArjunCode 5Strong yes");
    expect(screen.getByLabelText("Panel")).toHaveTextContent("Priya ✓ · Arjun ✓");
  });

  it("says what to do when there are none", async () => {
    mount({ interviews: async () => [] });
    expect(await screen.findByText(/No interviews yet/)).toBeInTheDocument();
  });
});
