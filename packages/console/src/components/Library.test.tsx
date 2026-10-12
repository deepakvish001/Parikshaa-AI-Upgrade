import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "@parikshaa/brand/ui";
import { describe, expect, it, vi } from "vitest";
import type { ConsoleClient, LibraryEntry, LibraryFacets } from "../api.ts";
import { LibraryPanel } from "./Library.tsx";

/** The Parikshaa Library (G2): sections and filters, adding chosen questions, picking at random, a newer version, the preview. */

const mcq: LibraryEntry = {
  id: "cs-1",
  version: 1,
  section: "cs",
  topic: "Operating Systems",
  difficulty: "easy",
  tags: ["os"],
  question: { id: "cs-1", kind: "mcq", stem: "What is a process?", maxScore: 1, rubric: [], options: ["A program running", "A file"], correctIndex: 0 } as unknown as LibraryEntry["question"],
  explanation: "A process is a program in execution.",
  tier: "open",
  source: "parikshaa:cs-fundamentals",
  exposure: null,
  updatedAt: "2026-10-03T00:00:00.000Z",
  retired: false,
  adopted: null,
  newerVersion: false,
};
const taken: LibraryEntry = { ...mcq, id: "cs-2", question: { ...mcq.question, id: "cs-2", stem: "What is a thread?" } as unknown as LibraryEntry["question"], version: 2, adopted: { bankQuestionId: "b1", version: 1 }, newerVersion: true };
const facets: LibraryFacets = {
  total: 2,
  sections: [
    { section: "aptitude", count: 0, topics: [] },
    { section: "cs", count: 2, topics: [{ topic: "Operating Systems", count: 2 }] },
    { section: "programming", count: 0, topics: [] },
    { section: "dsa", count: 0, topics: [] },
    { section: "sql", count: 0, topics: [] },
    { section: "frontend", count: 0, topics: [] },
  ],
};

function client(overrides: Partial<ConsoleClient> = {}) {
  return {
    library: vi.fn(async () => ({ items: [mcq, taken], total: 2, facets })),
    takeFromLibrary: vi.fn(async () => ({ added: 1, already: 0, bankQuestionIds: ["b2"] })),
    pickFromLibrary: vi.fn(async () => ({ added: 5, already: 0, bankQuestionIds: [] })),
    refreshFromLibrary: vi.fn(async () => ({ bankQuestionId: "b1", version: 2 })),
    ...overrides,
  } as unknown as ConsoleClient & Record<string, ReturnType<typeof vi.fn>>;
}

const renderPanel = (c: ConsoleClient, canWrite = true) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ToastProvider>
        <LibraryPanel client={c} canWrite={canWrite} />
      </ToastProvider>
    </QueryClientProvider>,
  );

describe("the Parikshaa Library", () => {
  it("shows its sections with counts, and filters by section, topic and words", async () => {
    const c = client();
    renderPanel(c);
    const sections = await screen.findByRole("group", { name: "Section" });
    expect(await within(sections).findByRole("button", { name: "Aptitude 0" })).toBeDisabled();
    await userEvent.click(within(sections).getByRole("button", { name: "CS fundamentals 2" }));
    expect(c.library).toHaveBeenLastCalledWith({ section: "cs", topic: undefined }, 0);
    await userEvent.selectOptions(screen.getByLabelText("Topic"), "Operating Systems");
    await userEvent.type(screen.getByLabelText("Find"), "x");
    await waitFor(() => expect(c.library).toHaveBeenLastCalledWith({ section: "cs", topic: "Operating Systems", q: "x" }, 0));
  });

  it("adds the ticked questions to the bank; one already there cannot be ticked", async () => {
    const c = client();
    renderPanel(c);
    await userEvent.click(await screen.findByRole("checkbox", { name: "Choose: What is a process?" }));
    expect(screen.getByRole("checkbox", { name: "Choose: What is a thread?" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Add 1 question to my bank" }));
    expect(c.takeFromLibrary).toHaveBeenCalledWith(["cs-1"]);
    expect(await screen.findByText("1 question copied into your bank.")).toBeInTheDocument();
  });

  it("picks a few at random with the filters chosen", async () => {
    const c = client();
    renderPanel(c);
    await userEvent.click(await screen.findByRole("button", { name: "CS fundamentals 2" }));
    const pick = screen.getByRole("form", { name: "Pick at random" });
    await userEvent.clear(within(pick).getByLabelText("How many"));
    await userEvent.type(within(pick).getByLabelText("How many"), "10");
    await userEvent.click(within(pick).getByRole("button", { name: "Pick at random" }));
    expect(c.pickFromLibrary).toHaveBeenCalledWith({ section: "cs", topic: undefined }, 10);
    expect(await screen.findByText("5 questions picked at random into your bank.")).toBeInTheDocument();
  });

  it("offers a newer version of a copy, and shows a question with its answer and explanation", async () => {
    const c = client();
    renderPanel(c);
    await userEvent.click(await screen.findByRole("button", { name: "Update my copy of: What is a thread?" }));
    expect(c.refreshFromLibrary).toHaveBeenCalledWith("cs-2");

    await userEvent.click(screen.getByRole("button", { name: "Preview: What is a process?" }));
    const drawer = await screen.findByRole("dialog", { name: "Library question" });
    expect(within(drawer).getByText("A program running").closest("li")).toHaveClass("right");
    expect(within(drawer).getByText("A process is a program in execution.")).toBeInTheDocument();
  });

  it("lets someone who may only read browse, without adding", async () => {
    renderPanel(client(), false);
    expect(await screen.findByText("What is a process?")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /^Choose:/ })).toBeNull();
    expect(screen.queryByRole("form", { name: "Pick at random" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Update my copy/ })).toBeNull();
  });
});
