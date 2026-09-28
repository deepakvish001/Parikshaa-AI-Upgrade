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

/** Open question `n` from the palette, as a candidate does. */
async function openQuestion(n: number) {
  const palette = screen.getByRole("navigation", { name: "Questions" });
  await userEvent.click(within(palette).getByRole("button", { name: new RegExp(`^Question ${n}:`) }));
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
    expect(screen.getByText(/If a test uses your camera, it says so before it starts/)).toBeInTheDocument();
  });

  it("shows the paper one question at a time, as a computer-based test does", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);

    expect(await screen.findByRole("heading", { name: "Algorithms" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^1\. Which sort is stable\?/ })).toBeInTheDocument();
    expect(screen.getByText("Question 1 of 2")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /^2\. Why does it terminate\?/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save & next" }));
    expect(await screen.findByRole("heading", { name: /^2\. Why does it terminate\?/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^2\./ })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByRole("heading", { name: /^1\. Which sort is stable\?/ })).toBeInTheDocument();
  });

  it("tells a question never opened from one left unanswered", async () => {
    localStorage.clear();
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    const palette = screen.getByRole("navigation", { name: "Questions" });
    expect(within(palette).getByRole("button", { name: "Question 1: Not answered" })).toHaveAttribute("aria-current", "step");
    expect(within(palette).getByRole("button", { name: "Question 2: Not visited" })).toHaveClass("not-visited");
    await openQuestion(2);
    expect(within(palette).getByRole("button", { name: "Question 2: Not answered" })).toHaveClass("not-answered");
  });

  it("marks a question for review and moves on, and clears a response", async () => {
    localStorage.clear();
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.click(screen.getByLabelText("mergesort"));
    await userEvent.click(screen.getByRole("button", { name: "Mark for review & next" }));
    await waitFor(() => expect(client.saveAnswer).toHaveBeenCalledWith("q-mcq", "1"));
    const palette = screen.getByRole("navigation", { name: "Questions" });
    expect(await within(palette).findByRole("button", { name: "Question 1: Answered, Marked for review" })).toHaveClass("answered-marked");
    expect(screen.getByRole("heading", { name: /^2\./ })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Why does it terminate?"), "It halves");
    await userEvent.click(screen.getByRole("button", { name: "Clear response" }));
    expect(screen.getByLabelText("Why does it terminate?")).toHaveValue("");
  });

  it("saves an answer and then asks whether a probe is due", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.click(screen.getByLabelText("mergesort"));
    await userEvent.click(screen.getByRole("button", { name: "Save & next" }));

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
    await userEvent.click(screen.getByRole("button", { name: "Save & next" }));

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
    expect(screen.getByRole("timer", { name: /4[45]m left/ })).toHaveTextContent(/00:4[45]:\d\d/);
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
  /** Loaded, and on the written question. */
  const onShortAnswer = async () => {
    await screen.findByRole("heading", { name: "Algorithms" });
    await openQuestion(2);
  };

  it("autosaves once typing pauses, not on every keystroke, and says so", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await onShortAnswer();

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
    await onShortAnswer();

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
    await onShortAnswer();

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
    await onShortAnswer();

    expect(await screen.findByDisplayValue("Written while offline")).toBeInTheDocument();
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(client.saveDraft).toHaveBeenCalledWith("q-short", "Written while offline"));
  });

  it("commits an answer when the candidate moves on, and only then asks about a probe", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await onShortAnswer();

    await userEvent.type(shortAnswer(), "Because it halves");
    await userEvent.click(screen.getByRole("button", { name: "Previous" })); // on to another question

    await waitFor(() => expect(client.saveAnswer).toHaveBeenCalledWith("q-short", "Because it halves"));
    await waitFor(() => expect(client.streamProbe).toHaveBeenCalled());
  });

  it("does not commit on moving on when the exam forbids revision", async () => {
    const { client, setState } = stubClient();
    setState({ exam: { ...exam, allowRevision: false } });
    renderApp(<App client={client} />);
    await onShortAnswer();

    expect(screen.getByRole("button", { name: "Save final answer" })).toBeInTheDocument();
    await userEvent.type(shortAnswer(), "Still thinking");
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));

    // Committing is final here, so it waits for the candidate to say so.
    expect(client.saveAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Save final answer & next" })).toBeInTheDocument();
  });

  it("sends what is still waiting to autosave before submitting", async () => {
    const { client } = stubClient();
    renderApp(<App client={client} />);
    await onShortAnswer();

    await userEvent.type(shortAnswer(), "Last words");
    await userEvent.click(screen.getByRole("button", { name: "Submit attempt" }));
    // The last look: what is answered, left and marked, before anything is final.
    const summary = screen.getByRole("dialog", { name: "Submit your attempt?" });
    expect(summary).toHaveTextContent(/questions have no answer yet/);
    expect(client.submit).not.toHaveBeenCalled();
    await userEvent.click(within(summary).getByRole("button", { name: "Yes, submit" }));

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
    await userEvent.click(screen.getByRole("button", { name: "Save & next" }));

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

    expect(await screen.findByRole("timer", { name: /1h 1[45]m left/ })).toBeInTheDocument();
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

describe("a test taken section by section", () => {
  const sectioned = (overrides: object = {}) => {
    const now = Date.now();
    const parts = (current: "fixed" | "apt" | "none", endsAt: number | null = null) => [
      { sectionId: null, title: "General", durationMs: null, questionIds: ["q-mcq"], state: current === "fixed" ? "current" : "done", endsAt: null },
      {
        sectionId: "apt",
        title: "Aptitude",
        durationMs: 600_000,
        questionIds: ["q-short"],
        state: current === "apt" ? "current" : current === "fixed" ? "upcoming" : "done",
        endsAt: current === "apt" ? endsAt : null,
      },
    ];
    const stub = stubClient({
      nextSection: vi.fn(async () => stub.setState({ parts: parts("apt", now + 600_000) })),
      ...overrides,
    });
    stub.setState({ parts: parts("fixed") });
    return { ...stub, parts, now };
  };

  it("shows only the current part, and warns before leaving it for good", async () => {
    const { client } = sectioned();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    const steps = screen.getByRole("navigation", { name: "Sections" });
    expect(within(steps).getByText("General").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/Which sort is stable\?/)).toBeInTheDocument();
    expect(screen.queryByText(/Why does it terminate\?/)).not.toBeInTheDocument();
    // Not the last part: no submitting yet, only moving on.
    expect(screen.queryByRole("button", { name: "Submit attempt" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Finish General and go on" }));
    expect(screen.getByText("You cannot come back to General once you leave it.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(client.nextSection).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Finish General and go on" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave General" }));
    await waitFor(() => expect(client.nextSection).toHaveBeenCalledTimes(1));

    expect(await screen.findByText(/Why does it terminate\?/)).toBeInTheDocument();
    expect(screen.queryByText(/Which sort is stable\?/)).not.toBeInTheDocument();
    expect(screen.getByText(/(9:5\d|10:00) left in this section/)).toHaveAttribute("role", "timer");
    // The last part: now it can be submitted.
    expect(screen.getByRole("button", { name: "Submit attempt" })).toBeInTheDocument();
  });

  it("sends what is still waiting to autosave before leaving a part", async () => {
    const { client } = sectioned();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.click(screen.getByLabelText("mergesort"));
    await userEvent.click(screen.getByRole("button", { name: "Finish General and go on" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave General" }));

    await waitFor(() => expect(client.nextSection).toHaveBeenCalled());
    expect(client.saveDraft).toHaveBeenCalledWith("q-mcq", "1");
    expect(vi.mocked(client.saveDraft).mock.invocationCallOrder[0]!).toBeLessThan(vi.mocked(client.nextSection).mock.invocationCallOrder[0]!);
  });

  it("stops at a section's time, and lets the candidate start the next when ready", async () => {
    const { client, setState, parts, now } = sectioned();
    setState({
      parts: [
        { ...parts("apt", now - 1000)[0], state: "done" },
        { ...parts("apt", now - 1000)[1], state: "current", sectionId: "apt" },
        { sectionId: "code", title: "Coding", durationMs: null, questionIds: [], state: "upcoming", endsAt: null },
      ],
    });
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    expect(screen.getByText("The time for Aptitude is up. What you had saved is kept.")).toBeInTheDocument();
    expect(screen.queryByText(/Why does it terminate\?/)).not.toBeInTheDocument();
    const intro = screen.getByRole("region", { name: "Coding" });
    expect(within(intro).getByText("No time of its own: the test's time applies")).toBeInTheDocument();
    await userEvent.click(within(intro).getByRole("button", { name: "Start Coding" }));
    await waitFor(() => expect(client.nextSection).toHaveBeenCalled());
  });
});

describe("aptitude papers", () => {
  const paper = {
    ...exam,
    questions: [
      {
        id: "q-primes",
        kind: "mcq",
        stem: "Which of these are prime?",
        maxScore: 4,
        options: ["2", "4", "5", "9"],
        multiple: true,
        negativeMarks: 1,
        translations: {},
        images: [{ media: "a".repeat(64), alt: "A number line from 1 to 10" }],
        passage: null,
      },
      {
        id: "q-rain",
        kind: "mcq",
        stem: "When does the monsoon reach Kerala?",
        maxScore: 2,
        options: ["Early June", "Mid-July"],
        multiple: false,
        negativeMarks: 0,
        translations: {},
        images: [],
        passage: { id: "p1", title: "The monsoon", text: "The monsoon reaches Kerala in early June.", images: [] },
      },
      {
        id: "q-cover",
        kind: "short",
        stem: "By when does it cover the country?",
        maxScore: 2,
        translations: {},
        images: [],
        passage: { id: "p1", title: "The monsoon", text: "The monsoon reaches Kerala in early June.", images: [] },
      },
    ],
  };

  it("lets a candidate choose several options, and says what a wrong answer costs", async () => {
    const { client, setState } = stubClient();
    setState({ exam: paper });
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    const primes = screen.getByRole("group", { name: "Which of these are prime?" });
    expect(screen.getByText("Choose every option that is right.")).toBeInTheDocument();
    expect(screen.getByText("−1 if wrong")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "A number line from 1 to 10" })).toHaveAttribute("src", `/api/media/${"a".repeat(64)}`);

    await userEvent.click(within(primes).getByLabelText("5"));
    await userEvent.click(within(primes).getByLabelText("2"));
    await userEvent.click(screen.getByRole("button", { name: "Save & next" }));
    await waitFor(() => expect(client.saveAnswer).toHaveBeenCalledWith("q-primes", "0,2"));
  });

  it("shows a passage beside each question about it", async () => {
    const { client, setState } = stubClient();
    setState({ exam: paper });
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });
    expect(screen.queryByRole("region", { name: "The monsoon" })).not.toBeInTheDocument();
    await openQuestion(2);

    const passage = screen.getByRole("region", { name: "The monsoon" });
    expect(passage).toHaveTextContent("Passage · Questions 2–3");
    expect(screen.getAllByText("The monsoon reaches Kerala in early June.")).toHaveLength(1);
  });

  it("keeps a palette of every question, and remembers what is marked for review", async () => {
    localStorage.clear();
    const { client, setState } = stubClient();
    setState({ exam: paper, answers: [{ questionId: "q-rain", answer: "0", submittedAt: 1 }] });
    const { unmount } = renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    const palette = screen.getByRole("navigation", { name: "Questions" });
    expect(within(palette).getByRole("button", { name: "Question 1: Not answered" })).toBeInTheDocument();
    expect(within(palette).getByRole("button", { name: "Question 2: Answered" })).toHaveClass("answered");

    await openQuestion(3);
    const cover = screen.getByRole("region", { name: /By when does it cover the country\?/ });
    await userEvent.click(within(cover).getByRole("button", { name: "Mark for review" }));
    expect(within(cover).getByRole("button", { name: "Marked for review" })).toHaveAttribute("aria-pressed", "true");
    expect(within(palette).getByRole("button", { name: "Question 3: Not answered, Marked for review" })).toHaveClass("marked");
    expect(within(palette).getByText("Done 1/3 · For review 1", { selector: ".palette-body .palette-summary" })).toBeInTheDocument();

    // Back after a reload: the mark is still there, on this device.
    unmount();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });
    expect(screen.getByRole("button", { name: "Question 3: Not answered, Marked for review" })).toBeInTheDocument();
  });
});

describe("a coding question", () => {
  const codeExam = {
    ...exam,
    codeCompletion: false,
    testFeedback: "all",
    questions: [
      {
        id: "q-sum",
        kind: "code",
        stem: "Return the sum of `a` and `b`.\n\nBoth fit in 32 bits.",
        maxScore: 10,
        language: "python",
        languages: ["python"],
        starter: "class Solution:\n    def add(self, a, b):\n        pass\n",
        starters: { python: "class Solution:\n    def add(self, a, b):\n        pass\n" },
        function: {
          name: "add",
          params: [
            { name: "a", type: "int" },
            { name: "b", type: "int" },
          ],
          returns: "int",
        },
        inputFormat: null,
        outputFormat: null,
        constraints: null,
        samples: [{ input: "2\n3", output: "5", explanation: null }],
        translations: {},
      },
    ],
  };

  it("heads the card with the statement's first paragraph, and submits through the workspace instead of Save", async () => {
    let committed: { questionId: string; answer: string; submittedAt: number }[] = [];
    const { client, setState } = stubClient({
      submitCode: vi.fn(async (questionId: string, language: string, source: string) => {
        committed = [{ questionId, answer: JSON.stringify({ language, source }), submittedAt: 1 }];
        setState({ answers: committed });
        return {
          tested: true,
          compiled: true,
          passed: 2,
          total: 2,
          cases: [
            { number: 1, visible: true, status: "passed", timeMs: 5, memoryKb: 8000, input: "2\n3", expectedOutput: "5", stdout: "", result: "5", stderr: "" },
            { number: 2, visible: false, status: "passed", timeMs: 5, memoryKb: 8000, input: null, expectedOutput: null, stdout: null, result: null, stderr: null },
          ],
        };
      }),
    });
    setState({ exam: codeExam });
    renderApp(<App client={client} />);

    const heading = await screen.findByRole("heading", { name: /Return the sum of a\s*and\s*b/ });
    const card = heading.closest("section")!;
    expect(within(card).getByText("Both fit in 32 bits.")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Save answer" })).toBeNull();

    await userEvent.click(within(card).getByRole("button", { name: "Submit" }));
    expect(client.submitCode).toHaveBeenCalledWith("q-sum", "python", codeExam.questions[0]!.starter);
    expect(await within(card).findByRole("region", { name: "Submission results" })).toHaveTextContent("2/2 tests passed");
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
  });
});
