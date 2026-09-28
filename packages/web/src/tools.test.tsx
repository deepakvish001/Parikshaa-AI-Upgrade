import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import type { ParikshaaClient } from "./api.ts";

/** ROADMAP UI Phase 1: the tools of a computer-based test hall, beside the paper. */

const exam = {
  id: "exam-1",
  title: "Algorithms",
  durationMs: 3_600_000,
  allowRevision: true,
  calculator: true,
  questions: [
    { id: "q-mcq", kind: "mcq", stem: "Which sort is stable?", maxScore: 4, options: ["quicksort", "mergesort"], negativeMarks: 1 },
    { id: "q-short", kind: "short", stem: "Why does it terminate?", maxScore: 10 },
  ],
};

function stubClient(patch: Record<string, unknown> = {}) {
  let state = {
    attemptId: "attempt-t",
    exam,
    state: "in_progress" as string,
    startedAt: 1,
    expiresAt: Date.now() + 45 * 60_000,
    voidReason: null,
    answers: [] as { questionId: string; answer: string; submittedAt: number }[],
    openProbe: null,
    answeredProbeCount: 0,
    drafts: [],
    ...patch,
  };
  const client = {
    state: vi.fn(async () => state),
    ledger: vi.fn(async () => ({ head: "f".repeat(64), length: 3, sealed: true, entries: [] })),
    saveAnswer: vi.fn(async (questionId: string, answer: string) => {
      state = { ...state, answers: [...state.answers, { questionId, answer, submittedAt: 1 }] };
    }),
    submit: vi.fn(async () => undefined),
    streamProbe: vi.fn(async (handlers: { onNone?: () => void }) => handlers.onNone?.()),
    saveDraft: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => ({ state: state.state, expiresAt: state.expiresAt, announcements: 0 })),
    announcements: vi.fn(async () => []),
  };
  return client as unknown as ParikshaaClient & typeof client;
}

function renderApp(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>);
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.fontSize = "";
});

const loaded = () => screen.findByRole("heading", { name: /^1\. Which sort is stable\?/ });

describe("keyboard shortcuts", () => {
  it("choose, save and move on, mark, and list themselves with ?", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await loaded();

    await userEvent.keyboard("b");
    expect(screen.getByRole("radio", { name: "mergesort" })).toBeChecked();
    await userEvent.keyboard("s");
    await waitFor(() => expect(client.saveAnswer).toHaveBeenCalledWith("q-mcq", "1"));
    expect(await screen.findByRole("heading", { name: /^2\. / })).toBeInTheDocument();

    await userEvent.keyboard("m");
    expect(screen.getByRole("button", { name: "Marked for review" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("p");
    expect(screen.getByRole("heading", { name: /^1\. / })).toBeInTheDocument();

    await userEvent.keyboard("?");
    const panel = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(panel).getByText("Save & next")).toBeInTheDocument();
  });

  it("stay out of the way while the candidate types", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();
    await userEvent.keyboard("n");
    const box = await screen.findByLabelText("Why does it terminate?");
    await userEvent.type(box, "pn");
    expect(box).toHaveValue("pn");
    expect(screen.getByRole("heading", { name: /^2\. / })).toBeInTheDocument();
  });
});

describe("on a phone", () => {
  it("keeps the tools in one sheet, the Display settings among them, and gives them back with Escape", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();
    const opener = screen.getByRole("button", { name: "Tools" });
    await userEvent.click(opener);
    const sheet = screen.getByRole("dialog", { name: "Tools" });
    expect(within(sheet).getAllByRole("button").map((b) => b.textContent)).toEqual(
      expect.arrayContaining(["Question paper", "Instructions", "Calculator", "Rough work", "Keyboard shortcuts", "Display"]),
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Display" }));
    const display = screen.getByRole("dialog", { name: "Display" });
    expect(within(display).getByLabelText("Language")).toBeInTheDocument();
    await userEvent.click(within(display).getByRole("button", { name: "Back" }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Tools" })).getByRole("button", { name: "Calculator" }));
    // A tool chosen closes the sheet and opens the tool.
    expect(screen.queryByRole("dialog", { name: "Tools" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Calculator" })).toBeInTheDocument();
  });

  it("opens the palette from the strip, and puts Clear response under More actions", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();
    await userEvent.click(screen.getByRole("button", { name: /^Questions 0\/\d+$/ }));
    expect(screen.getByRole("navigation", { name: "Questions" })).toHaveClass("open");
    // Focus goes to the question on screen, and Escape closes the sheet.
    expect(screen.getByRole("button", { name: /^Question 1:/ })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("navigation", { name: "Questions" })).not.toHaveClass("open");

    await userEvent.click(screen.getByLabelText("mergesort"));
    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Clear response" }));
    expect(screen.getByLabelText("mergesort")).not.toBeChecked();
  });
});

describe("the palette's key", () => {
  it("shows \"Typed, not saved\" only while something is, and folds to a line of shapes on request", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();
    const palette = screen.getByRole("navigation", { name: "Questions" });
    expect(within(palette).queryByText("Typed, not saved")).not.toBeInTheDocument();
    expect(within(palette).getByText("Not visited")).toBeInTheDocument();

    const toggle = within(palette).getByRole("button", { name: "Hide the key" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(toggle);
    expect(within(palette).getByRole("button", { name: "Show the key" })).toHaveAttribute("aria-expanded", "false");
    // Folded, the words are still there for a screen reader.
    expect(within(palette).getByText("Not visited")).toHaveClass("legend-label");
  });
});

describe("the tools beside the paper", () => {
  it("offer a calculator where the exam allows one, and it works", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: "Calculator" }));
    const calc = screen.getByRole("dialog", { name: "Calculator" });
    for (const key of ["2", "+", "3", "×", "4", "="]) await userEvent.click(within(calc).getByRole("button", { name: key }));
    expect(within(calc).getByText("14")).toBeInTheDocument();
  });

  it("offer no calculator where the exam does not", async () => {
    renderApp(<App client={stubClient({ exam: { ...exam, calculator: false } })} />);
    await loaded();
    expect(screen.queryByRole("button", { name: "Calculator" })).not.toBeInTheDocument();
  });

  it("keep rough work on this device only", async () => {
    const client = stubClient();
    renderApp(<App client={client} />);
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: "Rough work" }));
    await userEvent.type(within(screen.getByRole("dialog", { name: "Rough work" })).getByRole("textbox"), "180/2.5");
    expect(localStorage.getItem("parikshaa.rough.attempt-t")).toBe("180/2.5");
    expect(client.saveDraft).not.toHaveBeenCalled();
  });

  it("show the instructions again, from the paper itself", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: "Instructions" }));
    const panel = screen.getByRole("dialog", { name: "Instructions" });
    expect(panel).toHaveTextContent("A wrong answer can cost up to 1 mark.");
    expect(panel).toHaveTextContent("Not visited");
  });

  it("say that everything is saved, once it is", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();
    await userEvent.click(screen.getByLabelText("mergesort"));
    await userEvent.click(screen.getByRole("button", { name: "Save & next" }));
    expect(await screen.findByText("All answers saved")).toBeInTheDocument();
  });

  it("make the text larger and the page dark, and remember both", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();
    // How the page reads is one menu on the bar, not buttons in the way of the tools.
    const display = screen.getByRole("button", { name: "Display" });
    expect(display).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(display);
    const menu = screen.getByRole("group", { name: "Display" });
    await userEvent.click(within(menu).getByRole("button", { name: "Larger text" }));
    expect(document.documentElement.style.fontSize).toBe("112%");
    expect(menu).toHaveTextContent("112%");
    await userEvent.click(within(menu).getByRole("button", { name: "Dark theme" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(within(menu).getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("parikshaa.textSize")).toBe("112");
    // Escape closes it, and focus goes back to its button.
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Display" })).not.toBeInTheDocument();
    expect(display).toHaveFocus();
  });
});

describe("the question paper", () => {
  it("lists every question as the candidate left it, and goes to one", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();

    await userEvent.click(screen.getByRole("button", { name: "Question paper" }));
    const paper = screen.getByRole("dialog", { name: "Question paper" });
    const rows = within(paper).getAllByRole("button", { name: /Which sort is stable\?|Why does it terminate\?/ });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("aria-current", "step");
    expect(rows[1]).toHaveTextContent("Written answer");
    await userEvent.click(rows[1]!);
    expect(screen.queryByRole("dialog", { name: "Question paper" })).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /^2\. / })).toBeInTheDocument();
  });
});

describe("a coding question on a wide screen", () => {
  it("opens full screen, with the paper's numbers down the side", async () => {
    const width = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
    const coding = {
      ...exam,
      questions: [
        exam.questions[0],
        {
          id: "q-code",
          kind: "code",
          stem: "Add two numbers",
          maxScore: 5,
          language: "python",
          languages: ["python"],
          starter: null,
          starters: {},
          function: null,
          inputFormat: null,
          outputFormat: null,
          constraints: null,
          samples: [],
          translations: {},
        },
      ],
    };
    try {
      renderApp(<App client={stubClient({ exam: coding })} />);
      await loaded();
      await userEvent.keyboard("n");
      const workspace = await screen.findByRole("dialog", { name: /Add two numbers/ });
      const rail = within(workspace).getByRole("group", { name: "Questions" });
      await userEvent.click(within(rail).getByRole("button", { name: /^Question 1:/ }));
      expect(await screen.findByRole("heading", { name: /^1\. Which sort is stable\?/ })).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: /Add two numbers/ })).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    }
  });
});

describe("the clock", () => {
  it("warns quietly as the time runs down", async () => {
    renderApp(<App client={stubClient({ expiresAt: Date.now() + 15 * 60_000 + 1200 })} />);
    await loaded();
    expect(await screen.findByText("15 minutes left.", undefined, { timeout: 4000 })).toBeInTheDocument();
  });

  it("says plainly when time is up, and reads the attempt again", async () => {
    const client = stubClient({ expiresAt: Date.now() + 1500 });
    renderApp(<App client={client} />);
    await loaded();
    const loads = client.state.mock.calls.length;
    expect(await screen.findByRole("alertdialog", { name: "Time is up" }, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(client.state.mock.calls.length).toBeGreaterThan(loads));
  });
});

describe("on a touch screen", () => {
  it("moves to the next and previous question with a swipe", async () => {
    renderApp(<App client={stubClient()} />);
    await loaded();
    const main = document.querySelector(".cbt-main")!;
    const swipe = (from: number, to: number) => {
      fireEvent.touchStart(main, { touches: [{ clientX: from, clientY: 300 }] });
      fireEvent.touchEnd(main, { changedTouches: [{ clientX: to, clientY: 305 }] });
    };
    swipe(300, 100);
    expect(await screen.findByRole("heading", { name: /^2\. / })).toBeInTheDocument();
    swipe(100, 300);
    expect(await screen.findByRole("heading", { name: /^1\. / })).toBeInTheDocument();
  });
});
