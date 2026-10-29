import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackView } from "../practice/client.ts";
import { DSA, fakeApi, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { SH } from "./LearnSheet.tsx";

/**
 * Learn's DSA sheet (tracker row 140, K2-4) against a fake of the practice
 * site's API: the plan's track module by module with the learner's standing
 * (words, not colour alone), levels, the next item, folding modules, search
 * and the to-do filter, another track by its address, signed out without
 * standing, and the states; axe finding nothing.
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

const SQL: TrackView = { slug: "sql", title: "SQL in 30 days", description: "", items: 1, done: 0, modules: [{ title: "Select", done: 0, items: [{ kind: "problem", slug: "select-all", title: "Select every row", difficulty: "easy", estMinutes: 10, status: null, locked: false }] }] };

let api: FakeApi;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  localStorage.setItem(SESSION, "pl_good");
  api = fakeApi();
  api.routes["GET /practice/demo/tracks"] = () => ({
    body: { tracks: [{ slug: "sql", title: SQL.title, description: "", modules: 1, items: 1, done: 0 }, { slug: "dsa", title: DSA.title, description: "", modules: 3, items: 5, done: 2 }] },
  });
  api.routes["GET /practice/demo/plan"] = () => ({ body: { plan: { track: { slug: "dsa", title: DSA.title } } } });
  api.routes["GET /practice/demo/tracks/dsa"] = () => ({ body: DSA });
  api.routes["GET /practice/demo/tracks/sql"] = () => ({ body: SQL });
});
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

describe("the DSA sheet", () => {
  it("opens the plan's track: progress, levels, the next item, the first unfinished module open, standing in words", async () => {
    at("/sheet");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: DSA.title })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: hg(SH.sheetProgress) })).toHaveAttribute("aria-valuetext", "5 me se 2 ho gaye");
    // The description is Markdown, drawn as elements.
    expect(screen.getByText("graphs", { selector: "strong" })).toBeInTheDocument();
    const levels = screen.getByRole("region", { name: hg(SH.byLevel) });
    expect(within(levels).getByRole("progressbar", { name: "Aasaan: 1 me se 1" })).toBeInTheDocument();
    expect(within(levels).getByRole("progressbar", { name: "Mushkil: 1 me se 0" })).toBeInTheDocument();
    // Up next: the first item not done and not locked, a lesson, opened in Learn with its sheet.
    const next = screen.getByRole("region", { name: hg(SH.next) });
    expect(within(next).getByText("Searching a sorted array")).toBeInTheDocument();
    expect(within(next).getByRole("link", { name: /Lesson padho/ })).toHaveAttribute("href", `/practice/${SITE}/lessons/binary-search?track=dsa`);
    // Module 2 is open (Sorting is done); module 1 folded.
    expect(screen.getByRole("button", { name: /Searching/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Sorting/ })).toHaveAttribute("aria-expanded", "false");
    const pair = screen.getByRole("link", { name: "Pair with target sum" });
    expect(pair).toHaveAttribute("href", `/practice/${SITE}/problems/pair-sum`);
    expect(pair.closest("li")).toHaveTextContent(hg(SH.stTried));
    // The other tracks, the chosen one marked.
    const sheets = screen.getByRole("navigation", { name: hg(SH.sheets) });
    expect(within(sheets).getByRole("link", { name: DSA.title })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByText(hg(SH.signedOut))).not.toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: /Graphs/ }));
    expect(screen.getByRole("link", { name: "Shortest paths" }).closest("li")).toHaveTextContent(hg(SH.stLocked));
  });

  it("searches and filters every module, and opens another track at its address", async () => {
    at("/sheet");
    renderLearn();
    const search = await screen.findByRole("searchbox", { name: hg(SH.search) });
    await userEvent.type(search, "sort");
    // Matches open their modules; the rest go.
    expect(screen.getByRole("link", { name: "Sort colours" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Searching a sorted array" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pair with target sum" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3 mile");
    await userEvent.clear(search);
    await userEvent.click(screen.getByRole("radio", { name: /Ho gaye/ }));
    expect(screen.getByRole("link", { name: "Stable sorting" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Pair with target sum" })).not.toBeInTheDocument();
    await userEvent.type(search, "zzz");
    expect(screen.getByText(hg(SH.noMatch))).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole("navigation", { name: hg(SH.sheets) })).getByRole("link", { name: SQL.title }));
    expect(await screen.findByRole("heading", { level: 1, name: SQL.title })).toBeInTheDocument();
    expect(window.location.pathname).toBe(`/practice/${SITE}/sheet/sql`);
    // The side bar still marks the sheet.
    expect(screen.getByRole("navigation", { name: "Learn menu" }).querySelector('[aria-current="page"]')).toHaveTextContent("DSA sheet");
  });

  it("signed out: the first track without standing, and a way to sign in that comes back here", async () => {
    localStorage.removeItem(SESSION);
    at("/sheet");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: SQL.title })).toBeInTheDocument();
    expect(screen.getByText(hg(SH.signedOut))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(SH.signIn) })).toHaveAttribute("href", `/practice/${SITE}/signin?next=sheet%2Fsql`);
    expect(api.calls.some((c) => c.path.endsWith("/plan"))).toBe(false);
    expect(api.calls.every((c) => c.auth === null)).toBe(true);
    expect(await violations(container)).toEqual([]);
  });

  it("says when the site has no sheet, when a read fails, and while offline", async () => {
    api.routes["GET /practice/demo/tracks"] = () => ({ body: { tracks: [] } });
    api.routes["GET /practice/demo/plan"] = () => ({ body: { plan: null } });
    at("/sheet");
    const first = renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(SH.noneTitle) })).toBeInTheDocument();
    expect(await violations(first.container)).toEqual([]);
    first.unmount();

    api.routes["GET /practice/demo/tracks/dsa"] = () => ({ status: 500, body: { error: "internal", message: "boom" } });
    at("/sheet/dsa");
    const second = renderLearn();
    expect(await screen.findByRole("button", { name: /Phir koshish/ })).toBeInTheDocument();
    expect(await violations(second.container)).toEqual([]);
    second.unmount();

    act(() => onlineManager.setOnline(false));
    at("/sheet/dsa");
    renderLearn();
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "DSA sheet" })).toBeInTheDocument());
    expect(await screen.findByText(/net/i)).toBeInTheDocument();
  });
});
