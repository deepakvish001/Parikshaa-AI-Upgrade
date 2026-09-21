import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { ConsoleClient, ConsoleError, type AttemptReview, type ExamSummary } from "./api.ts";

const exams: ExamSummary[] = [{ id: "exam-1", title: "Algorithms", questionCount: 2 }];

const review: AttemptReview = {
  state: "graded",
  total: 11,
  vivas: [
    {
      probeId: "p1",
      questionId: "q1",
      prompt: "Which quantity decreases each round?",
      rationale: "Answer scored 8/10 (0.80), at or above this exam's viva trigger ratio.",
      reply: "The potential function, bounded below by zero.",
      latencyMs: 14_000,
      verdict: "inconsistent",
      confidence: 0.9,
      reasoning: "The reply names a different quantity from the one in their answer.",
    },
  ],
};

function stubClient(overrides: Record<string, unknown> = {}) {
  return {
    listExams: vi.fn(async () => exams),
    loadExam: vi.fn(async () => ({
      id: "exam-1",
      title: "Algorithms",
      questions: [],
      policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
    })),
    saveExam: vi.fn(async () => undefined),
    listAttempts: vi.fn(async () => [
      { id: "attempt-1", candidateId: "cand-1", entries: 7, state: "graded" as const },
    ]),
    startAttempt: vi.fn(async () => ({ attemptId: "attempt-2", token: "issued-token" })),
    review: vi.fn(async () => review),
    grade: vi.fn(async () => ({ total: 11 })),
    assess: vi.fn(async () => ({})),
    ...overrides,
  } as unknown as ConsoleClient;
}

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe("console", () => {
  it("asks for a staff token first", () => {
    renderApp(<App />);
    expect(screen.getByLabelText("Staff token")).toHaveAttribute("type", "password");
  });

  it("lists exams", async () => {
    renderApp(<App client={stubClient()} />);
    expect(await screen.findByRole("button", { name: "Algorithms" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});

describe("exam editor", () => {
  const openEditor = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));
    return client;
  };

  it("refuses to save an exam it knows is invalid, and says why", async () => {
    const client = await openEditor();

    // A blank title and a blank mcq option: invalid before it ever reaches the server.
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    const problems = await screen.findByRole("list", { name: "Problems with this exam" });
    expect(within(problems).getByText(/needs a title/i)).toBeInTheDocument();
    expect(client.saveExam).not.toHaveBeenCalled();
  });

  it("saves a well-formed exam", async () => {
    const client = await openEditor();

    await userEvent.type(screen.getByLabelText("Title"), "Mechanics");
    await userEvent.type(screen.getByLabelText("Question"), "Which is stable?");
    await userEvent.type(screen.getByLabelText("Option 1"), "quicksort");
    await userEvent.type(screen.getByLabelText("Option 2"), "mergesort");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    await waitFor(() => expect(client.saveExam).toHaveBeenCalled());
    const saved = (client.saveExam as unknown as { mock: { calls: [unknown][] } }).mock.calls[0]![0] as {
      title: string;
      questions: { options: string[] }[];
    };
    expect(saved.title).toBe("Mechanics");
    expect(saved.questions[0]?.options).toEqual(["quicksort", "mergesort"]);
  });

  it("replaces the fields that do not carry across when the type changes", async () => {
    await openEditor();

    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Type"), "numeric");

    expect(screen.queryByLabelText("Option 1")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expected value")).toBeInTheDocument();
    expect(screen.getByLabelText("Tolerance (±)")).toBeInTheDocument();
  });

  it("shows the server's objections when it disagrees with the client", async () => {
    const client = stubClient({
      saveExam: vi.fn(async () => {
        throw new ConsoleError(422, "invalid_exam", [
          { path: "questions.0.maxScore", message: "Marks must be greater than zero." },
        ]);
      }),
    });
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "New exam" }));

    await userEvent.type(screen.getByLabelText("Title"), "Mechanics");
    await userEvent.type(screen.getByLabelText("Question"), "Which?");
    await userEvent.type(screen.getByLabelText("Option 1"), "a");
    await userEvent.type(screen.getByLabelText("Option 2"), "b");
    await userEvent.click(screen.getByRole("button", { name: "Save exam" }));

    expect(await screen.findByText(/Marks must be greater than zero/)).toBeInTheDocument();
  });
});

describe("attempts", () => {
  it("issues an access code when an attempt is started", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));

    await userEvent.type(await screen.findByLabelText(/Start an attempt/), "cand-9");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(await screen.findByLabelText("Access code")).toHaveValue("issued-token");
    expect(client.startAttempt).toHaveBeenCalledWith("exam-1", "cand-9");
  });
});

describe("attempt review", () => {
  const openReview = async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Algorithms" }));
    await userEvent.click(await screen.findByRole("button", { name: "Review" }));
    return client;
  };

  it("shows the grade and the evidence as separate things", async () => {
    await openReview();

    expect(await screen.findByText("11")).toBeInTheDocument();

    const evidence = screen.getByRole("region", { name: "Provenance evidence" });
    expect(evidence).toHaveTextContent(/not part of the grade and has not changed it/i);
    expect(evidence).toHaveTextContent("Which quantity decreases each round?");
    expect(evidence).toHaveTextContent("14s");
    expect(evidence).toHaveTextContent(/Contradicts or misreads their own answer/);
    expect(evidence).toHaveTextContent(/names a different quantity/);
  });

  it("offers no control that turns a verdict into a mark", async () => {
    await openReview();
    const evidence = await screen.findByRole("region", { name: "Provenance evidence" });

    // SPEC §6.1: adjusting a grade is a decision a person makes and owns, not a
    // button that launders a model's reading into a number. The worst verdict in
    // the fixture must produce no such affordance.
    for (const control of within(evidence).queryAllByRole("button")) {
      expect(control.textContent ?? "").not.toMatch(/mark|score|grade|deduct|penal|adjust|fail|void/i);
    }
    expect(evidence).not.toHaveTextContent(/deduct|penalt/i);
  });

  it("shows the staff-side rationale, which the candidate never sees", async () => {
    await openReview();
    const evidence = await screen.findByRole("region", { name: "Provenance evidence" });

    expect(evidence).toHaveTextContent(/Answer scored 8\/10/);
  });
});
