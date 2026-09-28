import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import type { ParikshaaClient } from "./api.ts";

/** ROADMAP §9: the page in Hindi, questions in the candidate's language, and a mode for 2G. */

const exam = {
  id: "exam-1",
  title: "Algorithms",
  durationMs: 3_600_000,
  allowRevision: true,
  questions: [
    {
      id: "q-mcq",
      kind: "mcq",
      stem: "Which sort is stable?",
      maxScore: 4,
      options: ["quicksort", "mergesort"],
      translations: { hi: { stem: "कौन सा सॉर्ट स्थिर है?", options: ["क्विकसॉर्ट", "मर्जसॉर्ट"] } },
    },
    { id: "q-short", kind: "short", stem: "Why does it terminate?", maxScore: 10, translations: { ta: { stem: "ஏன் நிற்கிறது?" } } },
    { id: "q-code", kind: "code", stem: "Add two numbers", maxScore: 5, language: "python", languages: ["python"], starter: null, samples: [], translations: {} },
  ],
};

function stubClient(overrides: Record<string, unknown> = {}) {
  const state = {
    attemptId: "attempt-1",
    exam,
    state: "in_progress",
    startedAt: 1,
    expiresAt: Date.now() + 45 * 60_000,
    voidReason: null,
    answers: [] as { questionId: string; answer: string; submittedAt: number }[],
    openProbe: null,
    answeredProbeCount: 0,
    drafts: [],
  };
  return {
    state: vi.fn(async () => state),
    ledger: vi.fn(),
    saveAnswer: vi.fn(async (questionId: string, answer: string) => {
      state.answers = [...state.answers, { questionId, answer, submittedAt: 1 }];
    }),
    streamProbe: vi.fn(async (handlers: { onNone?: () => void }) => handlers.onNone?.()),
    probeOnce: vi.fn(async () => ({ id: "p1", prompt: "Why mergesort?" })),
    saveDraft: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => ({ state: "in_progress", expiresAt: state.expiresAt, announcements: 0 })),
    announcements: vi.fn(async () => []),
    ...overrides,
  } as unknown as ParikshaaClient & Record<string, ReturnType<typeof vi.fn>>;
}

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
});

describe("the page in Hindi", () => {
  it("translates the interface and the questions that have been translated, and remembers the choice", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: "Algorithms" });

    await userEvent.selectOptions(screen.getByLabelText("Language"), "hi");

    expect(document.documentElement.lang).toBe("hi");
    expect(localStorage.getItem("parikshaa.language")).toBe("hi");
    expect(screen.getByText("प्रश्न 1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("timer", { name: /^\d+m बाकी$/ })).toHaveTextContent("शेष समय");
    const heading = screen.getByRole("heading", { name: /कौन सा सॉर्ट स्थिर है\?/ });
    expect(heading).toHaveAttribute("lang", "hi");
    expect(screen.getByRole("radio", { name: "मर्जसॉर्ट" })).toBeInTheDocument();
    // Not translated: shown as written, and marked as English for a screen reader.
    await userEvent.click(screen.getByRole("button", { name: /^प्रश्न 2:/ }));
    expect(screen.getByRole("heading", { name: /Why does it terminate\?/ })).toHaveAttribute("lang", "en");
    expect(screen.getAllByRole("button", { name: "प्रयास जमा करें" })).toHaveLength(1);
  });

  it("lets a candidate read the original of a translated question", async () => {
    localStorage.setItem("parikshaa.language", "hi");
    renderApp(<App client={stubClient()} />);
    await userEvent.click(await screen.findByRole("button", { name: "मूल (अंग्रेज़ी) में दिखाएँ" }));
    expect(screen.getByRole("heading", { name: /Which sort is stable\?/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "हिन्दी में दिखाएँ" })).toBeInTheDocument();
  });

  it("records the answer by position, so it means the same whichever language it was read in", async () => {
    localStorage.setItem("parikshaa.language", "hi");
    const client = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: /कौन सा सॉर्ट/ });
    await userEvent.click(screen.getByRole("radio", { name: "मर्जसॉर्ट" }));
    await userEvent.click(screen.getByRole("button", { name: "सहेजें और आगे" }));
    expect(client.saveAnswer).toHaveBeenCalledWith("q-mcq", "1");
  });

  it("offers a language a question is translated into, with the interface in it too", async () => {
    renderApp(<App client={stubClient()} />);
    await screen.findByRole("heading", { name: "Algorithms" });
    await userEvent.selectOptions(screen.getByLabelText("Language"), "ta");
    await userEvent.click(screen.getByRole("button", { name: /^கேள்வி 2:/ }));
    expect(screen.getByRole("heading", { name: /ஏன் நிற்கிறது\?/ })).toHaveAttribute("lang", "ta");
    expect(screen.getByRole("button", { name: "முயற்சியைச் சமர்ப்பி" })).toBeInTheDocument();
  });
});

describe("low-bandwidth mode", () => {
  it("asks for a follow-up in one plain request, not a stream", async () => {
    localStorage.setItem("parikshaa.lite", "1");
    const client = stubClient();
    renderApp(<App client={client} />);
    await screen.findByRole("heading", { name: /Which sort is stable\?/ });
    await userEvent.click(screen.getByRole("radio", { name: "mergesort" }));
    await userEvent.click(screen.getByRole("button", { name: "Save & next" }));

    expect(await screen.findByText("Why mergesort?")).toBeInTheDocument();
    expect(client.probeOnce).toHaveBeenCalled();
    expect(client.streamProbe).not.toHaveBeenCalled();
  });

  it("answers code in a plain text area, never downloading the editor", async () => {
    localStorage.setItem("parikshaa.lite", "1");
    renderApp(<App client={stubClient()} />);
    await userEvent.click(await screen.findByRole("button", { name: /^Question 3:/ }));
    const box = await screen.findByRole("textbox", { name: /^Code for question \d+$/ });
    expect(box.tagName).toBe("TEXTAREA");
    expect(document.querySelector(".cm-editor")).toBeNull();
  });

  it("is switched on and off by the candidate, and remembered", async () => {
    renderApp(<App client={stubClient()} />);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Low-bandwidth mode" }));
    expect(localStorage.getItem("parikshaa.lite")).toBe("1");
  });
});
