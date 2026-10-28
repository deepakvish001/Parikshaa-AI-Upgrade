import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi, LISTS, NOTES, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { findNotes, LIST_NAME, M, noteKey, savedProblems } from "./LearnMine.tsx";

/**
 * Meri lists and Notes (tracker row 140, K2-3) against a fake of the practice
 * site's API: the lists and their problems, a problem taken out, a new list
 * from saved problems; notes read as Markdown drawn as elements (never HTML),
 * searched, written, deleted, a topic note made here, a track's notebook to
 * print; the five states; axe finding nothing in each.
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
const sent = (method: string, path: string) =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([url, init]) => decodeURIComponent(new URL(url as string, "http://x").pathname) === `/api${path}` && (init?.method ?? "GET") === method)
    .map(([, init]) => JSON.parse(String(init?.body ?? "null")) as unknown);

let api: FakeApi;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T06:30:00Z"));
  localStorage.setItem(SESSION, "pl_good");
  api = fakeApi();
  api.routes["GET /practice/demo/tracks"] = () => ({ body: { tracks: [{ slug: "dsa", title: "DSA for placements", description: "", modules: 6, items: 60, done: 0 }] } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

describe("what the pages work out", () => {
  it("names lists as the API does, gathers saved problems once, keys and finds notes", () => {
    expect(LIST_NAME.test("Before Infosys OA")).toBe(true);
    expect(LIST_NAME.test("DP (hard) & graphs")).toBe(true);
    expect(LIST_NAME.test("a/b")).toBe(false);
    expect(LIST_NAME.test("x".repeat(61))).toBe(false);
    expect(savedProblems(LISTS).map((p) => p.slug)).toEqual(["koko", "pair-sum", "valid-brackets"]);
    expect(noteKey({ kind: "topic", ref: "overflow-checklist", title: " Overflow Checklist " })).toBe("topic:overflow checklist");
    expect(noteKey({ kind: "problem", ref: "pair-sum", title: "Pair" })).toBe("problem:pair-sum");
    expect(findNotes(NOTES, "  cast  SORT ").map((n) => n.ref)).toEqual(["pair-sum"]);
    expect(findNotes(NOTES, "")).toHaveLength(3);
  });
});

describe("Meri lists", () => {
  it("shows each list with how much is solved, and a list's problems; a problem taken out is taken out on the API", async () => {
    api.routes["DELETE /practice/demo/lists/Before Infosys OA/valid-brackets"] = () => ({ body: { ok: true } });
    at("/lists");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(M.listsTitle) })).toBeInTheDocument();
    const lists = screen.getByRole("list", { name: hg(M.yourLists) });
    const [bookmarks, own] = within(lists).getAllByRole("button");
    expect(bookmarks).toHaveAttribute("aria-pressed", "true");
    expect(bookmarks).toHaveTextContent("Bookmarks2 problems2 me se 1 solve1/2");
    expect(own).toHaveTextContent("Before Infosys OA1 problem");
    const shown = screen.getByRole("region", { name: "Bookmarks" });
    expect(within(shown).getByRole("link", { name: "Koko eating bananas" })).toHaveAttribute("href", `/practice/${SITE}/problems/koko`);
    expect(within(shown).getByText(hg(M.solved))).toBeInTheDocument();
    expect(within(shown).getByText(hg(M.notSolved))).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    await userEvent.click(own!);
    expect(own).toHaveAttribute("aria-pressed", "true");
    const list = screen.getByRole("region", { name: "Before Infosys OA" });
    expect(within(list).getByText("Aasaan")).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: "Valid brackets ko Before Infosys OA se hatao" }));
    await waitFor(() => expect(api.calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["/practice/demo/lists/Before Infosys OA/valid-brackets"]));
    expect(await screen.findByText("Valid brackets Before Infosys OA se hat gaya.")).toBeInTheDocument();
  });

  it("makes a new list from saved problems, and says when a name is taken", async () => {
    api.routes["PUT /practice/demo/lists/Sunday revision/koko"] = () => ({ body: { ok: true } });
    api.routes["PUT /practice/demo/lists/Sunday revision/valid-brackets"] = () => ({ body: { ok: true } });
    at("/lists");
    const { container } = renderLearn();
    await userEvent.click(await screen.findByRole("button", { name: hg(M.newList) }));
    const dialog = screen.getByRole("dialog", { name: hg(M.newList) });
    const name = within(dialog).getByLabelText(hg(M.name));
    const make = within(dialog).getByRole("button", { name: hg(M.create) });
    await userEvent.type(name, "bookmarks");
    expect(within(dialog).getByText(hg(M.taken))).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    await userEvent.clear(name);
    await userEvent.type(name, "Sunday revision");
    // A list starts with a problem: until one is picked, nothing is made.
    expect(make).toBeDisabled();
    const picks = within(dialog).getByRole("group", { name: hg(M.pick) });
    expect(within(picks).getAllByRole("checkbox")).toHaveLength(3);
    expect(await violations(container)).toEqual([]);
    await userEvent.click(within(picks).getByRole("checkbox", { name: "Koko eating bananas" }));
    await userEvent.click(within(picks).getByRole("checkbox", { name: "Valid brackets" }));
    await userEvent.click(make);
    await waitFor(() =>
      expect(api.calls.filter((c) => c.method === "PUT").map((c) => c.path)).toEqual(["/practice/demo/lists/Sunday revision/koko", "/practice/demo/lists/Sunday revision/valid-brackets"]),
    );
    expect(await screen.findByText("List ban gayi: Sunday revision.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says how a list starts when nothing is saved, and has the other states", async () => {
    let answer: () => { status?: number; body: unknown } = () => ({ status: 500, body: { error: "server_error" } });
    api.routes["GET /practice/demo/lists"] = () => answer();
    at("/lists");
    const { container, unmount } = renderLearn();
    expect(await screen.findByRole("status")).toHaveTextContent("Load ho raha hai");
    const failed = await screen.findByRole("alert");
    expect(failed).toHaveTextContent("server_error · 500");
    answer = () => ({ body: { lists: [{ name: "Bookmarks", solved: 0, problems: [] }] } });
    await userEvent.click(within(failed).getByRole("button", { name: "Phir koshish karo" }));
    expect(await screen.findByRole("heading", { level: 3, name: hg(M.emptyList) })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: hg(M.newList) }));
    expect(within(screen.getByRole("dialog")).getByText(hg(M.noSaved))).toBeInTheDocument();
    unmount();

    act(() => onlineManager.setOnline(false));
    renderLearn();
    expect(await screen.findByText("Net aate hi ye dikhega.")).toBeInTheDocument();
    act(() => onlineManager.setOnline(true));

    localStorage.removeItem(SESSION);
    renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(M.listsSignIn) })).toBeInTheDocument();
    expect((await screen.findAllByRole("link", { name: "Sign in karo" })).at(-1)).toHaveAttribute("href", `/practice/${SITE}/signin?next=lists`);
  });
});

describe("Notes", () => {
  it("reads the newest note as Markdown drawn as elements, with where it belongs; finds notes by their words", async () => {
    at("/notes");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(M.notesTitle) })).toBeInTheDocument();
    const note = screen.getByRole("article", { name: "Pair with target sum" });
    expect(note.querySelector("ol > li")).toHaveTextContent("Sort first.");
    expect(within(note).getByText("(long long)a + b").tagName).toBe("CODE");
    // A tag in a note stays text: nothing in a note ever runs.
    expect(note.querySelector("script")).toBeNull();
    expect(note).toHaveTextContent("<script>alert(1)</script>");
    expect(within(note).getByRole("link", { name: hg(M.openProblem) })).toHaveAttribute("href", `/practice/${SITE}/problems/pair-sum`);
    expect(within(note).getByRole("link", { name: hg(M.revisionCard) })).toHaveAttribute("href", `/practice/${SITE}/revision`);
    expect(screen.getByRole("button", { name: /^Pair with target sum/ })).toHaveAttribute("aria-current", "true");
    expect(await violations(container)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: /^Stack: the LIFO idea/ }));
    const lesson = screen.getByRole("article", { name: "Stack: the LIFO idea" });
    expect(within(lesson).getByRole("heading", { level: 2 })).toHaveFocus();
    expect(within(lesson).getByRole("link", { name: hg(M.openLesson) })).toHaveAttribute("href", `/practice/${SITE}/lessons/stack-lifo`);

    await userEvent.type(screen.getByRole("searchbox", { name: hg(M.search) }), "2^30");
    expect(screen.getAllByRole("button", { name: /Overflow checklist|Pair with target sum|Stack/ })).toHaveLength(1);
    expect(screen.getByRole("article", { name: "Overflow checklist" }).querySelector("sup")).toHaveTextContent("30");
    await userEvent.clear(screen.getByRole("searchbox", { name: hg(M.search) }));
    await userEvent.type(screen.getByRole("searchbox", { name: hg(M.search) }), "zzz");
    expect(screen.getByText(hg(M.noMatch))).toBeInTheDocument();
  });

  it("writes a note and saves it on the API, and deletes one when asked twice", async () => {
    api.routes["PUT /practice/demo/notes/problem/pair-sum"] = () => ({ body: { ...NOTES[0], body: "Sort first.", updatedAt: "2026-10-27T06:30:00Z" } });
    at("/notes");
    const { container } = renderLearn();
    await userEvent.click(await screen.findByRole("button", { name: hg(M.edit) }));
    const box = screen.getByLabelText(hg(M.body));
    expect(box).toHaveFocus();
    await userEvent.clear(box);
    expect(screen.getByRole("button", { name: hg(M.save) })).toBeDisabled();
    await userEvent.type(box, "Sort first.");
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: hg(M.save) }));
    await waitFor(() => expect(sent("PUT", "/practice/demo/notes/problem/pair-sum")).toEqual([{ body: "Sort first." }]));
    expect(await screen.findByText(hg(M.saved))).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: hg(M.del) }));
    const ask = screen.getByRole("dialog", { name: hg(M.del) });
    expect(ask).toHaveTextContent("“Pair with target sum” mitayen?");
    expect(await violations(container)).toEqual([]);
    await userEvent.click(within(ask).getByRole("button", { name: hg(M.del) }));
    await waitFor(() => expect(sent("PUT", "/practice/demo/notes/problem/pair-sum").at(-1)).toEqual({ body: "" }));
    expect(await screen.findByText(hg(M.deleted))).toBeInTheDocument();
  });

  it("makes a topic note here, under the topic's name", async () => {
    api.routes["PUT /practice/demo/notes/topic/DBMS normal forms"] = () => ({ body: { kind: "topic", ref: "DBMS normal forms", title: "DBMS normal forms", body: "1NF: atomic.", updatedAt: "2026-10-27T06:30:00Z" } });
    at("/notes");
    renderLearn();
    await userEvent.type(await screen.findByLabelText(hg(M.newNote)), "DBMS normal forms");
    await userEvent.click(screen.getByRole("button", { name: hg(M.write) }));
    const draft = screen.getByRole("article", { name: "DBMS normal forms" });
    await userEvent.type(within(draft).getByLabelText(hg(M.body)), "1NF: atomic.");
    await userEvent.click(within(draft).getByRole("button", { name: hg(M.save) }));
    await waitFor(() => expect(sent("PUT", "/practice/demo/notes/topic/DBMS normal forms")).toEqual([{ body: "1NF: atomic.", title: "DBMS normal forms" }]));

    // An existing topic opens for writing instead of starting again.
    await userEvent.type(screen.getByLabelText(hg(M.newNote)), "overflow checklist");
    await userEvent.click(screen.getByRole("button", { name: hg(M.write) }));
    expect(within(screen.getByRole("article", { name: "Overflow checklist" })).getByLabelText(hg(M.body))).toHaveValue("Test with **2^30 + 2^30** before submitting.");
  });

  it("opens a track's notes on one page, to print", async () => {
    api.routes["GET /practice/demo/notes/book"] = () => ({
      body: {
        track: { slug: "dsa", title: "DSA for placements" },
        modules: [{ title: "Two pointers", notes: [{ kind: "problem", slug: "pair-sum", title: "Pair with target sum", body: "Sort first." }] }],
        topics: [{ title: "Overflow checklist", body: "Cast first." }],
      },
    });
    const print = vi.fn();
    window.print = print;
    at("/notes");
    const { container } = renderLearn();
    await userEvent.click(await screen.findByRole("button", { name: hg(M.bookGo) }));
    expect(await screen.findByRole("heading", { level: 1, name: "DSA for placements" })).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === "/practice/demo/notes/book")).toBe(true);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/notes/book?track=dsa"))).toBe(true);
    expect(screen.getByRole("region", { name: "Two pointers" })).toHaveTextContent("Pair with target sum");
    expect(screen.getByRole("region", { name: hg(M.topicNotes) })).toHaveTextContent("Cast first.");
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: hg(M.print) }));
    expect(print).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: hg(M.bookBack) }));
    expect(screen.getByRole("heading", { level: 1, name: hg(M.notesTitle) })).toBeInTheDocument();
  });

  it("has the states: loading, error, offline, signed out, and no notes yet", async () => {
    let answer: () => { status?: number; body: unknown } = () => ({ status: 500, body: { error: "server_error" } });
    api.routes["GET /practice/demo/notes"] = () => answer();
    at("/notes");
    const { container, unmount } = renderLearn();
    expect(await screen.findByRole("status")).toHaveTextContent("Load ho raha hai");
    const failed = await screen.findByRole("alert");
    expect(failed).toHaveTextContent("server_error · 500");
    answer = () => ({ body: { notes: [] } });
    await userEvent.click(within(failed).getByRole("button", { name: "Phir koshish karo" }));
    expect(await screen.findByRole("heading", { level: 2, name: hg(M.noNotes) })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
    unmount();

    act(() => onlineManager.setOnline(false));
    renderLearn();
    expect(await screen.findByText("Net aate hi ye dikhega.")).toBeInTheDocument();
    act(() => onlineManager.setOnline(true));

    localStorage.removeItem(SESSION);
    renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(M.notesSignIn) })).toBeInTheDocument();
    expect((await screen.findAllByRole("link", { name: "Sign in karo" })).at(-1)).toHaveAttribute("href", `/practice/${SITE}/signin?next=notes`);
  });

  it("speaks Hindi when the learner chooses it", async () => {
    localStorage.setItem("parikshaa.language", "hi");
    at("/notes");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: M.notesTitle[2] })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: M.edit[2] })).toBeInTheDocument();
  });
});
