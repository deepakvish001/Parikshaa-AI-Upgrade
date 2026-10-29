import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProblemSummary } from "../practice/client.ts";
import { fakeApi, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { filterProblems, PB } from "./LearnProblems.tsx";

/**
 * Abhyas, Learn's problems bank (tracker row 140, K2-4), against a fake of the
 * practice site's API: the sheets with progress, every problem with the
 * learner's standing in words, search and the filters (topic, level, standing,
 * pattern, company), 50 at a time; signed out without standing; the states;
 * axe finding nothing.
 */

async function violations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
    resultTypes: ["violations"],
  });
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const hg = (tri: readonly [string, string, string]) => tri[1];
const at = (path: string) => window.history.replaceState(null, "", `/practice/${SITE}${path}`);
const problem = (slug: string, title: string, extra: Partial<ProblemSummary> = {}): ProblemSummary => ({
  slug,
  title,
  difficulty: "easy",
  tags: [],
  patterns: [],
  companies: [],
  kind: "code",
  acceptance: 0.5,
  solvedBy: 10,
  status: null,
  ...extra,
});
const PROBLEMS: readonly ProblemSummary[] = [
  problem("pair-sum", "Pair with target sum", { difficulty: "medium", tags: ["arrays"], patterns: ["Two pointers"], companies: [{ slug: "infosys", name: "Infosys" }], status: "attempted", acceptance: 0.42, solvedBy: 120 }),
  problem("valid-brackets", "Valid brackets", { tags: ["stack"], status: "solved", acceptance: 0.71 }),
  problem("bellman", "Shortest paths", { difficulty: "hard", tags: ["graphs"], acceptance: null, solvedBy: 0 }),
  ...Array.from({ length: 60 }, (_, i) => problem(`extra-${i}`, `Practice set ${String(i + 1).padStart(2, "0")}`, { tags: ["arrays"] })),
];

let api: FakeApi;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  localStorage.setItem(SESSION, "pl_good");
  api = fakeApi();
  api.routes["GET /practice/demo/problems"] = () => ({ body: { problems: PROBLEMS } });
  api.routes["GET /practice/demo/tracks"] = () => ({ body: { tracks: [{ slug: "dsa", title: "DSA for placements", description: "", modules: 3, items: 5, done: 2 }] } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

describe("the problems bank", () => {
  it("lists the sheets and the problems with the learner's standing in words, 50 at a time", async () => {
    at("/practice");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(PB.title) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /DSA for placements/ })).toHaveAttribute("href", `/practice/${SITE}/sheet/dsa`);
    expect(screen.getByRole("progressbar", { name: "DSA for placements: 5 me se 2" })).toBeInTheDocument();
    const row = screen.getByRole("link", { name: "Pair with target sum" }).closest("tr")!;
    expect(row).toHaveTextContent(hg(PB.tried));
    expect(row).toHaveTextContent("Infosys me poocha gaya");
    expect(row).toHaveTextContent("42%");
    expect(screen.getByRole("link", { name: "Pair with target sum" })).toHaveAttribute("href", `/practice/${SITE}/problems/pair-sum`);
    expect(screen.getByRole("link", { name: "Shortest paths" }).closest("tr")).toHaveTextContent("—");
    expect(screen.getByRole("status")).toHaveTextContent("63 me se 63 problems");
    expect(screen.getAllByRole("row")).toHaveLength(51);
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: /13 aur dikhao/ }));
    expect(screen.getAllByRole("row")).toHaveLength(64);
    expect(screen.queryByRole("button", { name: /aur dikhao/ })).not.toBeInTheDocument();
  });

  it("searches and filters by topic, level, standing, pattern and company; clears them", async () => {
    at("/practice");
    renderLearn();
    await userEvent.type(await screen.findByRole("searchbox", { name: hg(PB.search) }), "pair");
    expect(screen.getByRole("status")).toHaveTextContent("63 me se 1 problems");
    await userEvent.click(screen.getByRole("button", { name: hg(PB.clear) }));
    await userEvent.click(screen.getByRole("button", { name: /^stack/ }));
    expect(screen.getByRole("button", { name: /^stack/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("link", { name: "Valid brackets" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("63 me se 1 problems");
    await userEvent.click(screen.getByRole("button", { name: /^stack/ }));
    await userEvent.click(screen.getByRole("radio", { name: "Mushkil" }));
    expect(screen.getByRole("status")).toHaveTextContent("63 me se 1 problems");
    await userEvent.click(screen.getByRole("radio", { name: "Sab" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: hg(PB.status) }), "solved");
    expect(screen.getByRole("link", { name: "Valid brackets" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: hg(PB.status) }), "all");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: hg(PB.company) }), "infosys");
    expect(screen.getByRole("status")).toHaveTextContent("63 me se 1 problems");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: hg(PB.pattern) }), "Two pointers");
    await userEvent.type(screen.getByRole("searchbox", { name: hg(PB.search) }), "zzz");
    expect(screen.getByText(hg(PB.noMatch))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: hg(PB.clear) }));
    expect(screen.getByRole("status")).toHaveTextContent("63 me se 63 problems");
  });

  it("filters in the site's order", () => {
    const keep = filterProblems(PROBLEMS, { text: "", level: "all", status: "todo", topic: "arrays", pattern: "", company: "" });
    expect(keep.map((p) => p.slug).slice(0, 2)).toEqual(["extra-0", "extra-1"]);
    expect(filterProblems(PROBLEMS, { text: "  VALID ", level: "easy", status: "solved", topic: null, pattern: "", company: "" }).map((p) => p.slug)).toEqual(["valid-brackets"]);
  });

  it("signed out: no standing filter, a way to sign in; empty, failed and offline", async () => {
    localStorage.removeItem(SESSION);
    at("/practice");
    const first = renderLearn();
    expect(await screen.findByText(hg(PB.signedOut))).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: hg(PB.status) })).not.toBeInTheDocument();
    expect(api.calls.every((c) => c.auth === null)).toBe(true);
    expect(await violations(first.container)).toEqual([]);
    first.unmount();

    localStorage.setItem(SESSION, "pl_good");
    api.routes["GET /practice/demo/problems"] = () => ({ body: { problems: [] } });
    const second = renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(PB.noneTitle) })).toBeInTheDocument();
    second.unmount();

    api.routes["GET /practice/demo/problems"] = () => ({ status: 500, body: { error: "internal", message: "boom" } });
    const third = renderLearn();
    expect(await screen.findByRole("button", { name: /Phir koshish/ })).toBeInTheDocument();
    expect(await violations(third.container)).toEqual([]);
    third.unmount();

    act(() => onlineManager.setOnline(false));
    renderLearn();
    await waitFor(() => expect(screen.getByText("Net aate hi ye dikhega.")).toBeInTheDocument());
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toHaveTextContent("Abhyas");
  });
});
