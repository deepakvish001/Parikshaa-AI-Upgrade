import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App, AUTOSAVE_DELAY_MS } from "./App.tsx";
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
    expiresAt: Date.now() + 45 * 60_000,
    voidReason: null as string | null,
    answers: [] as { questionId: string; answer: string; submittedAt: number }[],
    openProbe: null as { id: string; prompt: string } | null,
    answeredProbeCount: 0,
    drafts: [] as { questionId: string; answer: string; savedAt: number }[],
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
    saveDraft: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => ({ state: state.state, expiresAt: state.expiresAt, announcements: 0 })),
    announcements: vi.fn(async () => []),
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
    expect(screen.getByText(/0 of 2 answered/)).toBeInTheDocument();
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
      expiresAt: Date.now() + 45 * 60_000,
    voidReason: null as string | null,
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
      expiresAt: Date.now() + 45 * 60_000,
    voidReason: null as string | null,
      answers: [],
      openProbe: { id: "p9", prompt: "Reopened probe." },
      answeredProbeCount: 0,
    })) as never;

    renderApp(<App client={client} />);

    expect(await screen.findByText("Reopened probe.")).toBeInTheDocument();
  });

  it("shows the exam window, which is the candidate's to see", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    // Exam time, not a probe timer — SPEC §8 forbids the latter and the probe
    // panel shows none.
    expect(screen.getByText(/4[45]m left/)).toBeInTheDocument();
  });

  it("shows the receipt with its head hash once the attempt is submitted", async () => {
    const { client } = stubClient();
    client.state = vi.fn(async () => ({
      attemptId: "attempt-1",
      exam,
      state: "submitted",
      startedAt: 1,
      expiresAt: Date.now() + 45 * 60_000,
    voidReason: null as string | null,
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

  it("tells a candidate why their attempt was set aside, not only that it was", async () => {
    const { client } = stubClient();
    client.state = vi.fn(async () => ({
      attemptId: "attempt-1",
      exam,
      state: "void",
      startedAt: 1,
      expiresAt: Date.now() + 45 * 60_000,
      voidReason: "Could not establish that this work was your own.",
      answers: [{ questionId: "q-mcq", answer: "1", submittedAt: 1 }],
      openProbe: null,
      answeredProbeCount: 0,
    })) as never;

    renderApp(<App client={client} />);

    const notice = await screen.findByRole("region", { name: "This attempt was set aside" });
    expect(notice).toHaveTextContent("Could not establish that this work was your own.");
    // And their record is still theirs to check.
    expect(notice).toHaveTextContent(/still checks out/i);
    expect(await screen.findByTestId("head-hash")).toBeInTheDocument();
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

describe("nothing a candidate types is lost", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const shortAnswer = () => screen.getByLabelText("Why does it terminate?");

  it("autosaves once typing pauses, not on every keystroke, and says so", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.type(shortAnswer(), "The measure decreases");

    await waitFor(() => expect(client.saveDraft).toHaveBeenCalledWith("q-short", "The measure decreases"), {
      timeout: AUTOSAVE_DELAY_MS + 1000,
    });
    expect(client.saveDraft).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
    // Autosave is not an answer: nothing was committed, and no probe was asked for.
    expect(client.saveAnswer).not.toHaveBeenCalled();
    expect(client.streamProbe).not.toHaveBeenCalled();
  });

  it("keeps the text on this device when the connection is down", async () => {
    const { client } = stubClient({
      saveDraft: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.type(shortAnswer(), "Offline words");

    expect(
      await screen.findByText(/Kept on this device/, undefined, { timeout: AUTOSAVE_DELAY_MS + 1000 }),
    ).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem("parikshaa.drafts.attempt-1") ?? "{}");
    expect(stored.drafts["q-short"]).toEqual({ answer: "Offline words", synced: false });
  });

  it("restores the server's drafts when the exam is reopened", async () => {
    const { client, setState } = stubClient();
    setState({ drafts: [{ questionId: "q-short", answer: "Typed on the other laptop", savedAt: 5 }] });
    renderApp(<App client={client} />);

    expect(await screen.findByDisplayValue("Typed on the other laptop")).toBeInTheDocument();
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
  });

  it("prefers this device's unsent text, which the server never saw, and sends it", async () => {
    localStorage.setItem(
      "parikshaa.drafts.attempt-1",
      JSON.stringify({
        expiresAt: Date.now() + 60_000,
        drafts: { "q-short": { answer: "Written while offline", synced: false } },
      }),
    );
    const { client, setState } = stubClient();
    setState({ drafts: [{ questionId: "q-short", answer: "Older", savedAt: 5 }] });
    renderApp(<App client={client} />);

    expect(await screen.findByDisplayValue("Written while offline")).toBeInTheDocument();
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(client.saveDraft).toHaveBeenCalledWith("q-short", "Written while offline"));
  });

  it("commits an answer when the candidate moves on, and only then asks about a probe", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.type(shortAnswer(), "Because it halves");
    await userEvent.click(screen.getByLabelText("mergesort")); // on to the next question

    await waitFor(() => expect(client.saveAnswer).toHaveBeenCalledWith("q-short", "Because it halves"));
    await waitFor(() => expect(client.streamProbe).toHaveBeenCalled());
  });

  it("does not commit on moving on when the exam forbids revision", async () => {
    const { client, setState } = stubClient();
    setState({ exam: { ...exam, allowRevision: false } });
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.type(shortAnswer(), "Still thinking");
    await userEvent.click(screen.getByLabelText("mergesort"));

    // Committing is final here, so it waits for the candidate to say so.
    expect(client.saveAnswer).not.toHaveBeenCalled();
    expect(screen.getAllByRole("button", { name: "Save final answer" })).toHaveLength(2);
  });

  it("sends what is still waiting to autosave before submitting", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.type(shortAnswer(), "Last words");
    await userEvent.click(screen.getByRole("button", { name: "Submit attempt" }));

    await waitFor(() => expect(client.submit).toHaveBeenCalled());
    const draftOrder = (client.saveDraft as unknown as { mock: { invocationCallOrder: number[] } }).mock
      .invocationCallOrder[0]!;
    const submitOrder = (client.submit as unknown as { mock: { invocationCallOrder: number[] } }).mock
      .invocationCallOrder[0]!;
    expect(draftOrder).toBeLessThan(submitOrder);
  });

  it("recovers when the probe stream fails, instead of leaving a half-written probe", async () => {
    const { client } = stubClient({
      streamProbe: vi.fn(async () => {
        throw new TypeError("network lost");
      }),
    });
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });
    const loads = (client.state as unknown as { mock: { calls: unknown[] } }).mock.calls.length;

    await userEvent.click(screen.getByLabelText("mergesort"));
    await userEvent.click(screen.getAllByRole("button", { name: "Save answer" })[0]!);

    await waitFor(() => expect(client.streamProbe).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("region", { name: "Follow-up question" })).not.toBeInTheDocument());
    // Re-read, so a probe the server did record comes back through openProbe.
    expect((client.state as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBeGreaterThan(loads);
  });

  it("learns of extra time from its check-in, without a reload", async () => {
    const extended = Date.now() + 75 * 60_000;
    const { client, setState } = stubClient({
      // An invigilator granted 30 minutes after the page loaded; the check-in
      // is the first to hear of it.
      heartbeat: vi.fn(async () => {
        setState({ expiresAt: extended });
        return { state: "in_progress", expiresAt: extended };
      }),
    });
    renderApp(<App client={client} />);

    expect(await screen.findByText(/1h 1[45]m left/)).toBeInTheDocument();
  });
});

describe("the access code", () => {
  afterEach(() => sessionStorage.clear());

  it("is taken out of the address bar and kept for this tab only", () => {
    window.history.replaceState(null, "", "/?token=secret-code&lang=hi");

    renderApp(<App />);

    expect(window.location.search).toBe("?lang=hi");
    expect(sessionStorage.getItem("parikshaa.attempt-token")).toBe("secret-code");
    window.history.replaceState(null, "", "/");
  });
});

describe("announcements from the invigilators", () => {
  it("are shown as they arrive, announced to screen readers, and can be dismissed", async () => {
    const said = [{ id: "a1", message: "Question 2: assume the list is sorted.", at: "2026-10-01T05:00:00.000Z" }];
    const { client } = stubClient({ announcements: vi.fn(async () => said) });
    renderApp(<App client={client} />);

    const region = await screen.findByRole("region", { name: "Announcements" });
    expect(region).toHaveAttribute("aria-live", "assertive");
    expect(await within(region).findByText("Question 2: assume the list is sorted.")).toBeInTheDocument();

    await userEvent.click(within(region).getByRole("button", { name: "Got it" }));
    expect(within(region).queryByText(/assume the list is sorted/)).toBeNull();
  });

  it("are fetched again when a check-in says there are new ones", async () => {
    // Loaded before the announcement was made; the check-in then reports one.
    const announcements = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: "a1", message: "Ten minutes left.", at: "2026-10-01T05:00:00.000Z" }]);
    const heartbeat = vi.fn(async () => ({ state: "in_progress", expiresAt: Date.now() + 45 * 60_000, announcements: 1 }));
    const { client } = stubClient({ announcements, heartbeat });
    renderApp(<App client={client} />);

    expect(await screen.findByText("Ten minutes left.")).toBeInTheDocument();
    expect(announcements).toHaveBeenCalledTimes(2);
  });
});
