import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { CandidateReport, CodePlayback } from "../api.ts";
import { AttemptReview } from "./AttemptReview.tsx";

/** Code playback (G4): a reviewer watches a code answer being written, with large pastes marked as signals. */

const answers = {
  candidate: { ref: "R1", name: "Asha", email: null },
  result: { maxTotal: 10 },
  questions: [{ id: "sum", stem: "Add two numbers", kind: "code", maxScore: 10, score: 10, answer: "print(1+2)", language: "python", tests: null }],
  vivas: [],
  voidReason: null,
  voidedBy: null,
} as unknown as CandidateReport;

const pasted = `print(${"1+".repeat(110)}2)`;
const playback: CodePlayback[] = [
  {
    questionId: "sum",
    ops: [
      { t: 0, at: 0, del: 0, ins: "", reset: true },
      { t: 1000, at: 0, del: 0, ins: "pr" },
      { t: 2000, at: 0, del: 2, ins: pasted, paste: true },
      { t: 61_000, at: 0, del: pasted.length, ins: "print(1+2)" },
    ],
    pastes: [{ t: 2000, chars: pasted.length }],
    largePastes: 1,
  },
];

const renderReview = () =>
  render(
    <AttemptReview
      attemptId="a1"
      review={{ state: "graded", total: 10, voidReason: null, vivas: [] }}
      grading={false}
      assessing={null}
      voiding={false}
      onGrade={() => undefined}
      onAssess={() => undefined}
      onVoid={() => undefined}
      answers={answers}
      playback={playback}
    />,
  );

describe("code playback", () => {
  it("marks a large paste beside the answer and plays the writing back, step by step", async () => {
    renderReview();
    const answer = screen.getByRole("listitem", { name: "Answer 1" });
    expect(within(answer).getByText("1 large paste")).toBeInTheDocument();
    await userEvent.click(within(answer).getByRole("button", { name: "Watch it being written" }));

    const drawer = await screen.findByRole("dialog", { name: "Playback" });
    expect(within(drawer).getByText(/4 changes over 1:01/)).toBeInTheDocument();
    expect(within(drawer).getByLabelText("The code at this step")).toHaveTextContent("print(1+2)");

    fireEvent.change(within(drawer).getByRole("slider"), { target: { value: "2" } });
    expect(within(drawer).getByLabelText("The code at this step")).toHaveTextContent(/^pr$/);

    await userEvent.click(within(drawer).getByRole("button", { name: /0:02: 228 characters \(large\)/ }));
    expect(within(drawer).getByLabelText("The code at this step")).toHaveTextContent(pasted);
    expect(within(drawer).getByText("Pasted 228 characters here")).toBeInTheDocument();
  });

  it("offers nothing to watch for an answer without a recording", () => {
    render(
      <AttemptReview
        attemptId="a1"
        review={{ state: "graded", total: 10, voidReason: null, vivas: [] }}
        grading={false}
        assessing={null}
        voiding={false}
        onGrade={() => undefined}
        onAssess={() => undefined}
        onVoid={() => undefined}
        answers={answers}
        playback={[]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Watch it being written" })).toBeNull();
  });
});
