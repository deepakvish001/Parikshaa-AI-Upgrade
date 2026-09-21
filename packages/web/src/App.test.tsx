import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import type { ParikshaaClient } from "./api.ts";

const exam = {
  id: "exam-1",
  title: "Algorithms",
  durationMs: 3_600_000,
  allowRevision: true,
  questions: [
    { id: "q-mcq", kind: "mcq", stem: "Which sort is stable?", maxScore: 4, options: ["quicksort", "mergesort"] },
    { id: "q-short", kind: "short", stem: "Why does it terminate?", maxScore: 10 },
  ],
};

/** A client stub; tests override the pieces they care about. */
function stubClient(overrides: Partial<Record<keyof ParikshaaClient, unknown>> = {}) {
  let state = {
    attemptId: "attempt-1",
    exam,
    state: "in_progress" as string,
    startedAt: 1,
    answers: [] as { questionId: string; answer: string; submittedAt: number }[],
    openProbe: null as { id: string; prompt: string } | null,
    answeredProbeCount: 0,
  };

  const client = {
    state: vi.fn(async () => state),
    ledger: vi.fn(async () => ({ head: "f".repeat(64), length: 3, sealed: true, entries: [] })),
    saveAnswer: vi.fn(async (questionId: string, answer: string) => {
      state = { ...state, answers: [...state.answers, { questionId, answer, submittedAt: 1 }] };
    }),
    submit: vi.fn(async () => {
      state = { ...state, state: "submitted" };
    }),
    replyToProbe: vi.fn(async () => {
      state = { ...state, openProbe: null };
    }),
    streamProbe: vi.fn(async (handlers: { onNone?: () => void }) => handlers.onNone?.()),
    ...overrides,
  };
  return { client: client as unknown as ParikshaaClient, setState: (patch: object) => (state = { ...state, ...patch }) };
}

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

describe("App", () => {
  it("asks for an access code when the URL carries no token", () => {
    renderApp(<App />);

    expect(screen.getByRole("heading", { name: "Parikshaa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Access code")).toBeInTheDocument();
    // The candidate is told what the exam does and does not do, up front.
    expect(screen.getByText(/no webcam/i)).toBeInTheDocument();
  });

  it("renders the exam and its questions", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);

    expect(await screen.findByRole("heading", { name: "Algorithms" })).toBeInTheDocument();
    expect(screen.getByText(/1\. Which sort is stable\?/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Why does it terminate\?/)).toBeInTheDocument();
    expect(screen.getByText("0 of 2 answered")).toBeInTheDocument();
  });

  it("saves an answer and then asks whether a probe is due", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.click(screen.getByLabelText("mergesort"));
    await userEvent.click(screen.getAllByRole("button", { name: "Save answer" })[0]!);

    await waitFor(() => expect(client.saveAnswer).toHaveBeenCalledWith("q-mcq", "1"));
    await waitFor(() => expect(client.streamProbe).toHaveBeenCalled());
  });

  it("shows a probe and sends the reply to it", async () => {
    const { client } = stubClient({
      streamProbe: vi.fn(async (handlers: { onProbe: (p: { id: string; prompt: string }) => void }) => {
        handlers.onProbe({ id: "p1", prompt: "Which quantity decreases each round?" });
      }),
    });
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.click(screen.getByLabelText("mergesort"));
    await userEvent.click(screen.getAllByRole("button", { name: "Save answer" })[0]!);

    const probe = await screen.findByRole("region", { name: "Follow-up question" });
    expect(probe).toHaveTextContent("Which quantity decreases each round?");

    await userEvent.type(screen.getByLabelText("Your reply to the follow-up"), "The potential.");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => expect(client.replyToProbe).toHaveBeenCalledWith("p1", "The potential."));
  });

  it("presents the probe as a follow-up, never as an accusation", async () => {
    const { client } = stubClient();
    client.state = vi.fn(async () => ({
      attemptId: "attempt-1",
      exam,
      state: "in_progress",
      startedAt: 1,
      answers: [],
      openProbe: { id: "p1", prompt: "What stops it going below zero?" },
      answeredProbeCount: 0,
    })) as never;

    renderApp(<App client={client} />);
    const probe = await screen.findByRole("region", { name: "Follow-up question" });

    // SPEC §4: never imply suspicion, never reveal correctness. A candidate who
    // feels accused answers differently, which corrupts the signal.
    for (const word of [/integrity/i, /suspic/i, /verif/i, /cheat/i, /flag/i, /correct/i, /score/i]) {
      expect(probe).not.toHaveTextContent(word);
    }
    // And no countdown: the server times this, the candidate is not raced.
    expect(probe).toHaveTextContent(/take the time you need/i);
  });

  it("reopens an unanswered probe after a reload", async () => {
    const { client } = stubClient();
    client.state = vi.fn(async () => ({
      attemptId: "attempt-1",
      exam,
      state: "in_progress",
      startedAt: 1,
      answers: [],
      openProbe: { id: "p9", prompt: "Reopened probe." },
      answeredProbeCount: 0,
    })) as never;

    renderApp(<App client={client} />);

    expect(await screen.findByText("Reopened probe.")).toBeInTheDocument();
  });

  it("shows the receipt with its head hash once the attempt is submitted", async () => {
    const { client } = stubClient();
    client.state = vi.fn(async () => ({
      attemptId: "attempt-1",
      exam,
      state: "submitted",
      startedAt: 1,
      answers: [{ questionId: "q-mcq", answer: "1", submittedAt: 1 }],
      openProbe: null,
      answeredProbeCount: 0,
    })) as never;

    renderApp(<App client={client} />);

    expect(await screen.findByTestId("head-hash")).toHaveTextContent("f".repeat(64));
    expect(screen.getByRole("button", { name: "Download receipt" })).toBeInTheDocument();
    // Answers are locked once submitted.
    expect(screen.queryByRole("button", { name: "Save answer" })).not.toBeInTheDocument();
  });

  it("explains itself when the access code is rejected", async () => {
    const { client } = stubClient({
      state: vi.fn(async () => {
        throw new Error("401");
      }),
    });

    renderApp(<App client={client} />);

    expect(await screen.findByText(/access code may have expired/i)).toBeInTheDocument();
  });
});
