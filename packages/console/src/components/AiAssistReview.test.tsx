import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { CodeQuestion } from "@parikshaa/core/browser";
import type { AttemptReview as Review } from "../api.ts";
import { AttemptReview } from "./AttemptReview.tsx";
import { CodeFields } from "./CodeFields.tsx";

/** Plan row 87: the author allows AI on a code question; the reviewer reads how it was used. */

const question = { id: "q1", kind: "code", stem: "Find a duplicate.", maxScore: 10, rubric: [], language: "python" } as unknown as CodeQuestion;

function Editor({ seen }: { seen: (q: CodeQuestion) => void }) {
  const [q, setQ] = useState(question);
  return (
    <CodeFields
      question={q}
      onChange={(next) => {
        setQ(next);
        seen(next);
      }}
    />
  );
}

describe("an AI-fluency question", () => {
  it("is switched on and off in the question's editor", async () => {
    const seen: CodeQuestion[] = [];
    render(<Editor seen={(q) => seen.push(q)} />);
    const box = screen.getByRole("checkbox", { name: /AI allowed/ });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(seen.at(-1)).toMatchObject({ aiAssist: true });
    await userEvent.click(box);
    expect(seen.at(-1)).not.toHaveProperty("aiAssist");
  });

  it("shows the reviewer every question to the assistant, its answer and the code then", async () => {
    const review: Review = {
      state: "submitted",
      total: null,
      voidReason: null,
      vivas: [],
      assists: [
        { questionId: "q1", prompt: "Fastest way?", reply: "Use a hash set.", code: "def dup(a): pass", at: Date.parse("2026-10-05T05:00:00Z") },
        { questionId: "q1", prompt: "Explain it", reply: "Each seen value goes in a set.", code: null, at: Date.parse("2026-10-05T05:02:00Z") },
      ],
    };
    render(<AttemptReview attemptId="a1" review={review} grading={false} assessing={null} voiding={false} onGrade={() => undefined} onAssess={() => undefined} onVoid={() => undefined} />);
    const section = screen.getByRole("region", { name: "Use of the AI assistant" });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Fastest way?");
    expect(items[0]).toHaveTextContent("Use a hash set.");
    await userEvent.click(within(items[0]!).getByText("Show"));
    expect(items[0]).toHaveTextContent("def dup(a): pass");
    expect(items[1]).not.toHaveTextContent("Their code then");
  });

  it("shows nothing about AI on an attempt that never used it", () => {
    render(<AttemptReview attemptId="a1" review={{ state: "submitted", total: null, voidReason: null, vivas: [] }} grading={false} assessing={null} voiding={false} onGrade={() => undefined} onAssess={() => undefined} onVoid={() => undefined} />);
    expect(screen.queryByRole("region", { name: "Use of the AI assistant" })).toBeNull();
  });
});
