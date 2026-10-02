import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, ExamReview } from "../api.ts";
import { PaperReview } from "./PaperReview.tsx";

const waiting: ExamReview = { examId: "maths", status: "in_review", submittedBy: "Paper Setter", submittedById: "u-setter", submittedAt: "2026-10-05T05:00:00Z", note: "Unit 1", reviewer: null, decidedAt: null, comment: "" };

function mount(client: Partial<ConsoleClient>, selfId: string, canReopen = false) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <PaperReview client={client as ConsoleClient} examId="maths" selfId={selfId} canWrite canReopen={canReopen} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe("a paper's review", () => {
  it("lets someone other than the setter return it with a comment", async () => {
    const decideReview = vi.fn(async () => ({ ...waiting, status: "returned" as const }));
    mount({ examReview: async () => waiting, decideReview }, "u-hod");
    expect(await screen.findByText(/With its reviewer · sent by Paper Setter/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return with comment" })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Comment" }), "Q1 too easy");
    await userEvent.click(screen.getByRole("button", { name: "Return with comment" }));
    await waitFor(() => expect(decideReview).toHaveBeenCalledWith("maths", "return", "Q1 too easy"));
  });

  it("does not offer the setter a decision on their own paper", async () => {
    mount({ examReview: async () => waiting }, "u-setter");
    expect(await screen.findByText("Someone else reviews your paper.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve and lock" })).toBeNull();
  });

  it("sends an unreviewed paper", async () => {
    const sendForReview = vi.fn(async () => waiting);
    mount({ examReview: async () => null, sendForReview }, "u-setter");
    await userEvent.click(await screen.findByRole("button", { name: "Send for review" }));
    await waitFor(() => expect(sendForReview).toHaveBeenCalledWith("maths", ""));
  });
});
