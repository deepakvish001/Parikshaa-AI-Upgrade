import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lesson } from "../practice/client.ts";
import { DSA, fakeApi, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { answerText, LL, safeVideo } from "./LearnLesson.tsx";

/**
 * Learn's lesson reader (tracker row 140, K2-4) against a fake of the practice
 * site's API: the lesson's Markdown as elements (never HTML), a video link
 * only for http(s), done with its coins, the quiz checked with the right
 * answers and explanations, the learner's note written, where it sits in its
 * sheet; locked, signed out, missing, failed and offline; axe finding nothing.
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
const mcq = (stem: string, options: string[], multiple = false) => ({ id: "q", stem, maxScore: 1, translations: {}, images: [], passage: null, kind: "mcq", options, multiple, negativeMarks: 0 }) as unknown as Lesson["quiz"][number]["question"];

const LESSON: Lesson = {
  slug: "binary-search",
  title: "Searching a sorted array",
  body: "Halve the range at **every** step.\n\n```cpp\nint mid = lo + (hi - lo) / 2;\n```\n\n<img src=x onerror=alert(1)>",
  videoUrl: "https://video.example.com/binary-search",
  estMinutes: 20,
  done: false,
  locked: false,
  quiz: [
    { slug: "pair-sum", title: "Pair with target sum", question: mcq("Which pointer moves when the sum is too small?", ["Left", "Right"]) },
    { slug: "count", title: "Comparisons", question: { ...mcq("How many comparisons on 1,024 items, at most?", []), kind: "numeric" } as unknown as Lesson["quiz"][number]["question"] },
  ],
};

let api: FakeApi;
let saved: string;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  localStorage.setItem(SESSION, "pl_good");
  saved = "";
  api = fakeApi();
  api.routes["GET /practice/demo/lessons/binary-search"] = () => ({ body: LESSON });
  api.routes["GET /practice/demo/tracks/dsa"] = () => ({ body: DSA });
  api.routes["GET /practice/demo/tracks"] = () => ({ body: { tracks: [{ slug: "dsa", title: DSA.title, description: "", modules: 3, items: 5, done: 2 }] } });
  api.routes["GET /practice/demo/plan"] = () => ({ body: { plan: null } });
  api.routes["POST /practice/demo/lessons/binary-search/done"] = () => ({ body: { coins: 5, reasons: ["lesson"] } });
  api.routes["POST /practice/demo/lessons/binary-search/quiz"] = () => ({
    body: {
      score: 1,
      total: 2,
      revise: 1,
      results: [
        { slug: "pair-sum", right: false, answer: "1", explanation: "Move the **left** one up." },
        { slug: "count", right: true, answer: "11", explanation: "" },
      ],
    },
  });
  api.routes["GET /practice/demo/notes/lesson/binary-search"] = () => ({ body: { kind: "lesson", ref: "binary-search", title: LESSON.title, body: saved, updatedAt: null } });
  api.routes["PUT /practice/demo/notes/lesson/binary-search"] = () => {
    saved = "Mid without **overflow**.";
    return { body: { kind: "lesson", ref: "binary-search", title: LESSON.title, body: saved, updatedAt: "2026-10-27T10:00:00Z" } };
  };
});
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

describe("the lesson reader", () => {
  it("reads the lesson as elements, in its sheet, with the video outside, and marks it done with its coins", async () => {
    at("/lessons/binary-search?track=dsa");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: LESSON.title })).toBeInTheDocument();
    const article = screen.getByRole("article", { name: LESSON.title });
    expect(within(article).getByText("every", { selector: "strong" })).toBeInTheDocument();
    expect(article.querySelector("pre")).toHaveTextContent("int mid");
    // The tag is text, not an image.
    expect(article.querySelector("img")).toBeNull();
    expect(article).toHaveTextContent("<img src=x onerror=alert(1)>");
    const video = screen.getByRole("link", { name: /Video dekho/ });
    expect(video).toHaveAttribute("href", "https://video.example.com/binary-search");
    expect(video).toHaveAttribute("rel", "noopener noreferrer");
    // Its place: module 2, item 1 of 2; the module beside it; before and after.
    expect(await screen.findByText("Module 2 · 2 me se 1")).toBeInTheDocument();
    const toc = screen.getByRole("navigation", { name: hg(LL.inModule) });
    expect(within(toc).getByRole("link", { current: "page" })).toHaveTextContent(LESSON.title);
    expect(screen.getByRole("link", { name: "Pichhla: Sort colours" })).toHaveAttribute("href", `/practice/${SITE}/problems/sort-colours`);
    expect(screen.getByRole("link", { name: /Agla: Pair with target sum/ })).toHaveAttribute("href", `/practice/${SITE}/problems/pair-sum`);
    expect(screen.getByRole("link", { name: /DSA for placements/ })).toHaveAttribute("href", `/practice/${SITE}/sheet/dsa`);
    // The breadcrumb names it a lesson, under Seekho.
    expect(screen.getByRole("navigation", { name: "Aap yahan ho" })).toHaveTextContent("Lesson");
    expect(await violations(container)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: hg(LL.done) }));
    expect(await screen.findByText("Lesson ho gaya. +5 coins.")).toBeInTheDocument();
    expect(screen.getByText(hg(LL.doneAlready))).toBeInTheDocument();
  });

  it("checks the quiz once every question is answered: right answers in words, explanations as Markdown, the score said", async () => {
    at("/lessons/binary-search");
    const { container } = renderLearn();
    const quiz = await screen.findByRole("region", { name: hg(LL.quiz) });
    const check = within(quiz).getByRole("button", { name: hg(LL.check) });
    expect(check).toBeDisabled();
    await userEvent.click(within(quiz).getByRole("radio", { name: "Left" }));
    await userEvent.type(within(quiz).getByRole("textbox", { name: hg(LL.yourAnswer) }), "11");
    expect(check).toBeEnabled();
    await userEvent.click(check);
    const score = await within(quiz).findByRole("status");
    expect(score).toHaveTextContent("2 me se 1 sahi");
    expect(score).toHaveTextContent("Aaj 1 revise karne hain");
    expect(score).toHaveFocus();
    expect(within(quiz).getByText("Sahi nahi. Jawab: Right")).toBeInTheDocument();
    expect(within(quiz).getByText("left", { selector: "strong" })).toBeInTheDocument();
    expect(within(quiz).getByRole("radio", { name: "Left" })).toBeDisabled();
    expect(vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/quiz"))?.[1]?.body).toBe(JSON.stringify({ answers: { "pair-sum": "0", count: "11" } }));
    expect(await violations(container)).toEqual([]);
    await userEvent.click(within(quiz).getByRole("button", { name: hg(LL.again) }));
    expect(within(quiz).getByRole("radio", { name: "Left" })).not.toBeChecked();
  });

  it("writes the learner's note on the lesson and shows it as Markdown", async () => {
    at("/lessons/binary-search");
    renderLearn();
    const note = await screen.findByRole("region", { name: hg(LL.note) });
    expect(await within(note).findByText(hg(LL.noteNone))).toBeInTheDocument();
    await userEvent.click(within(note).getByRole("button", { name: hg(LL.write) }));
    const box = within(note).getByRole("textbox", { name: hg(LL.noteText) });
    expect(box).toHaveFocus();
    await userEvent.type(box, "Mid without **overflow**.");
    await userEvent.click(within(note).getByRole("button", { name: hg(LL.save) }));
    expect(await within(note).findByText("overflow", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(hg(LL.saved))).toBeInTheDocument();
  });

  it("locked behind Plus: no body, no quiz, a way to Plus; signed out: the lesson, and sign in for the rest", async () => {
    api.routes["GET /practice/demo/lessons/binary-search"] = () => ({ body: { ...LESSON, body: "", locked: true, quiz: [] } });
    at("/lessons/binary-search");
    const first = renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(LL.lockedTitle) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LL.seePlus) })).toHaveAttribute("href", `/practice/${SITE}/plus?learn_v2=0`);
    expect(screen.queryByRole("region", { name: hg(LL.quiz) })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Video dekho/ })).not.toBeInTheDocument();
    expect(await violations(first.container)).toEqual([]);
    first.unmount();

    api.routes["GET /practice/demo/lessons/binary-search"] = () => ({ body: LESSON });
    localStorage.removeItem(SESSION);
    at("/lessons/binary-search");
    const second = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: LESSON.title })).toBeInTheDocument();
    expect(screen.getByText(hg(LL.signIn))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in karo" })).toHaveAttribute("href", `/practice/${SITE}/signin?next=lessons%2Fbinary-search`);
    expect(screen.queryByRole("region", { name: hg(LL.quiz) })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: hg(LL.done) })).not.toBeInTheDocument();
    // The site's only track places it, signed out too.
    expect(await screen.findByText("Module 2 · 2 me se 1")).toBeInTheDocument();
    expect(await violations(second.container)).toEqual([]);
  });

  it("says when there is no such lesson, when it failed, and while offline", async () => {
    at("/lessons/gone");
    const first = renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(LL.notFoundTitle) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LL.toSheet) })).toHaveAttribute("href", `/practice/${SITE}/sheet`);
    first.unmount();

    api.routes["GET /practice/demo/lessons/binary-search"] = () => ({ status: 500, body: { error: "internal", message: "boom" } });
    at("/lessons/binary-search");
    const second = renderLearn();
    expect(await screen.findByRole("button", { name: /Phir koshish/ })).toBeInTheDocument();
    expect(await violations(second.container)).toEqual([]);
    second.unmount();

    act(() => onlineManager.setOnline(false));
    at("/lessons/binary-search");
    renderLearn();
    await waitFor(() => expect(screen.getByText("Net aate hi ye dikhega.")).toBeInTheDocument());
  });

  it("opens only http(s) videos, and names a choice answer by its options", () => {
    expect(safeVideo("javascript:alert(1)")).toBeNull();
    expect(safeVideo("data:text/html,hi")).toBeNull();
    expect(safeVideo("not a url")).toBeNull();
    expect(safeVideo("http://example.com/v")).toBe("http://example.com/v");
    const q = mcq("Pick", ["A", "B", "C"], true);
    expect(answerText(q, "0,2")).toBe("A, C");
    expect(answerText(q, "9")).toBe("9");
  });
});
