import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { Question } from "@parikshaa/core/browser";
import type { ConsoleClient } from "../api.ts";
import { Marking } from "./Marking.tsx";
import { QuestionFields } from "./QuestionFields.tsx";

/** Plan row 88: a take-home is set on a short question, and marked by a person who opens the link. */

const short = { id: "q1", kind: "short", stem: "Build a URL shortener.", maxScore: 20, rubric: [{ id: "r1", description: "Works", weight: 1 }], expectedPoints: [] } as unknown as Question;

function Editor({ seen }: { seen: (q: Question) => void }) {
  const [q, setQ] = useState(short);
  return <QuestionFields question={q} onChange={(next) => (setQ(next), seen(next))} />;
}

describe("a take-home", () => {
  it("is switched on and off on a short question", async () => {
    const seen: Question[] = [];
    render(<Editor seen={(q) => seen.push(q)} />);
    const box = screen.getByRole("checkbox", { name: /Take-home/ });
    await userEvent.click(box);
    expect(seen.at(-1)).toMatchObject({ kind: "short", takeHome: true });
    await userEvent.click(box);
    expect(seen.at(-1)).not.toHaveProperty("takeHome");
  });

  it("is marked by opening the candidate's link, and the reader is told it counts as 0 until then", async () => {
    const client = {
      marking: async () => ({
        questions: [{ id: "q1", number: 1, stem: "Build a URL shortener.", kind: "short", max: 20, rubric: ["Works"], expectedPoints: [], answers: 1, reviewed: 0, takeHome: true }],
        items: [{ attemptId: "a1", questionId: "q1", answer: JSON.stringify({ link: "https://github.com/a/shortener", notes: "Run make test" }), language: null, score: 0, max: 20, reviewed: false }],
      }),
    } as unknown as ConsoleClient;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <Marking client={client} examId="e1" />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/count as 0 until you mark them/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Start marking" }));
    const link = await screen.findByRole("link", { name: "https://github.com/a/shortener" });
    expect(link).toHaveAttribute("href", "https://github.com/a/shortener");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(within(link.closest(".take-home-work") as HTMLElement).getByText("Run make test")).toBeInTheDocument();
  });
});
