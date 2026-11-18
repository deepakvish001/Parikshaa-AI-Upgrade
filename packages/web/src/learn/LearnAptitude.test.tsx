import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Problem, ProblemSummary, Submission } from "../practice/client.ts";
import { CHOICE } from "./choice.tsx";
import { fakeApi, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { aptitudeOf, AP, tagWords } from "./LearnAptitude.tsx";

/**
 * Aptitude in Learn (tracker row 140, K2-8) against a fake of the practice
 * site's API: the hub by section and topic, a topic's set (palette, a
 * question, Check, the explanation only by the API's rules, earlier answers),
 * the misses, signed out, the states, and axe finding nothing.
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
const summary = (slug: string, title: string, tags: string[], extra: Partial<ProblemSummary> = {}): ProblemSummary => ({
  slug,
  title,
  difficulty: "easy",
  tags,
  patterns: [],
  companies: [],
  kind: "mcq",
  acceptance: 0.5,
  solvedBy: 4,
  status: null,
  ...extra,
});
const PROBLEMS: readonly ProblemSummary[] = [
  summary("chai-price", "A price that rises, then falls", ["aptitude-quant", "percentages"], { status: "attempted" }),
  summary("discount", "Two discounts", ["aptitude-quant", "percentages"], { status: "solved" }),
  summary("interest", "Simple and compound interest", ["aptitude-quant", "interest"], { kind: "numeric", difficulty: "medium" }),
  summary("rc-mess", "Reading: the mess committee", ["aptitude-verbal", "reading-comprehension"], { difficulty: "medium" }),
  summary("process", "What is a process?", ["Operating Systems", "Process Management"]),
  summary("pair-sum", "Pair with target sum", ["arrays"], { kind: "code" }),
];
const chai = (over: Partial<Problem> = {}): Problem => ({
  slug: "chai-price",
  title: "A price that rises, then falls",
  difficulty: "easy",
  tags: ["aptitude-quant", "percentages"],
  question: {
    id: "q1",
    kind: "mcq",
    stem: "A tea stall raises the price of a chai by **20%**, then cuts it by 20%. The change?",
    maxScore: 1,
    translations: {},
    images: [],
    passage: null,
    options: ["4% decrease", "No change", "4% increase", "5% decrease"],
    multiple: false,
    negativeMarks: 0,
  } as unknown as Problem["question"],
  editorial: null,
  editorialLocked: true,
  acceptance: 0.5,
  solvedBy: 4,
  status: "attempted",
  contest: null,
  ...over,
});
const WRONG_B: Submission = { id: "s1", language: null, answer: "1", status: "wrong_answer", passed: 0, total: 1, timeMs: null, memoryKb: null, createdAt: "2026-11-17T10:00:00Z", inContest: false };
const EXPLAINED = "### Understand\nThe second change is on the new price.\n\n> **Shortcut:** 20 − 20 − 4 = −4.";

let api: FakeApi;
let problem: Problem;
let submissions: Submission[];
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  localStorage.setItem(SESSION, "pl_good");
  problem = chai();
  submissions = [WRONG_B];
  api = fakeApi();
  api.routes["GET /practice/demo/problems"] = () => ({ body: { problems: PROBLEMS } });
  api.routes["GET /practice/demo/problems/chai-price"] = () => ({ body: problem });
  api.routes["GET /practice/demo/problems/chai-price/submissions"] = () => ({ body: { submissions } });
  api.routes["GET /practice/demo/problems/discount"] = () => ({ body: chai({ slug: "discount", title: "Two discounts", status: "solved", editorial: EXPLAINED, editorialLocked: false }) });
  api.routes["GET /practice/demo/problems/discount/submissions"] = () => ({ body: { submissions: [] } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

describe("aptitude's sections and topics", () => {
  it("are the choice and number problems by their first two tags, aptitude's sections first", () => {
    const sections = aptitudeOf(PROBLEMS);
    expect(sections.map((s) => [s.id, s.topics.map((t) => [t.slug, t.name, t.problems.length])])).toEqual([
      ["aptitude-quant", [["aptitude-quant-percentages", "Percentages", 2], ["aptitude-quant-interest", "Interest", 1]]],
      ["aptitude-verbal", [["aptitude-verbal-reading-comprehension", "Reading comprehension", 1]]],
      ["Operating Systems", [["operating-systems-process-management", "Process Management", 1]]],
    ]);
    expect(tagWords("time-and-work")).toBe("Time and work");
    expect(tagWords("Process Management")).toBe("Process Management");
  });
});

describe("the aptitude hub", () => {
  it("shows each section's topics with how many are right, the totals, and the misses", async () => {
    at("/aptitude");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(AP.title) })).toBeInTheDocument();
    expect(screen.getByText("5 me se 1 sahi · 1 abhi galat")).toBeInTheDocument();
    const quant = screen.getByRole("region", { name: "Quantitative aptitude" });
    expect(within(quant).getByRole("link", { name: /Percentages/ })).toHaveAttribute("href", `/practice/${SITE}/aptitude/aptitude-quant-percentages`);
    expect(within(quant).getByRole("progressbar", { name: "Percentages: 2 me se 1 sahi" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Verbal ability" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Operating Systems" })).toBeInTheDocument();
    // A code problem is not aptitude.
    expect(screen.queryByText("Pair with target sum")).toBeNull();
    expect(screen.getByRole("link", { name: "Galtiyan dobara karo (1)" })).toHaveAttribute("href", `/practice/${SITE}/aptitude/misses`);
    expect(await violations(container)).toEqual([]);
  });

  it("signed out: the topics without standing, and a way to sign in", async () => {
    localStorage.removeItem(SESSION);
    at("/aptitude");
    renderLearn();
    expect(await screen.findByText(hg(AP.signedOut))).toBeInTheDocument();
    expect(screen.queryByText(/abhi galat/)).toBeNull();
    expect(screen.getByRole("link", { name: hg(AP.signIn) })).toHaveAttribute("href", `/practice/${SITE}/signin?next=aptitude`);
  });

  it("with no choice questions: says so, and points to Abhyas", async () => {
    api.routes["GET /practice/demo/problems"] = () => ({ body: { problems: [PROBLEMS[5]] } });
    at("/aptitude");
    renderLearn();
    expect(await screen.findByRole("heading", { name: hg(AP.noneTitle) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(AP.toPractice) })).toHaveAttribute("href", `/practice/${SITE}/practice`);
  });

  it("loading, failed with a retry, and offline", async () => {
    let fail = true;
    api.routes["GET /practice/demo/problems"] = () => (fail ? { status: 500, body: { error: "internal" } } : { body: { problems: PROBLEMS } });
    at("/aptitude");
    const first = renderLearn();
    expect(screen.getAllByText(/load ho raha hai/i).length).toBeGreaterThan(0);
    const retry = await screen.findByRole("button", { name: /Phir koshish/i });
    fail = false;
    await userEvent.click(retry);
    expect(await screen.findByRole("heading", { level: 1, name: hg(AP.title) })).toBeInTheDocument();
    first.unmount();
    act(() => onlineManager.setOnline(false));
    renderLearn();
    await waitFor(() => expect(screen.getByText("Net aate hi ye dikhega.")).toBeInTheDocument());
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1 })).toHaveTextContent("Aptitude");
  });
});

describe("a topic's set", () => {
  it("answers wrong: marks only the chosen option, keeps the explanation shut with the tries, and never names the right one", async () => {
    api.routes["POST /practice/demo/problems/chai-price/submit"] = () => {
      submissions = [{ ...WRONG_B, id: "s2", answer: "2" }, ...submissions];
      return { body: { status: "wrong_answer", passed: 0, total: 1, compileOutput: null, timeMs: null, memoryKb: null, cases: [], submissionId: "s2", firstSolve: false } };
    };
    at("/aptitude/aptitude-quant-percentages");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: "Percentages" })).toBeInTheDocument();
    const palette = screen.getByRole("navigation", { name: hg(AP.palette) });
    expect(within(palette).getByRole("button", { name: "Sawaal 1: try kiya, abhi sahi nahi, abhi yahi" })).toHaveAttribute("aria-current", "step");
    expect(within(palette).getByRole("button", { name: "Sawaal 2: sahi" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "A price that rises, then falls" })).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(await screen.findByText("Samjhaav sahi karne par khulta hai, ya 3 galat koshish ke baad (1/3).")).toBeInTheDocument();
    // The earlier answer, by its letter.
    const earlier = screen.getByRole("region", { name: hg(AP.earlier) });
    expect(earlier).toHaveTextContent("B");
    expect(earlier).toHaveTextContent(hg(AP.wrong));

    const check = screen.getByRole("button", { name: hg(AP.check) });
    expect(check).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "4% increase" }));
    await userEvent.click(check);
    await waitFor(() => expect(container.querySelector(".la-v-title")).toHaveTextContent(hg(AP.wrong)));
    expect(api.calls.find((c) => c.path.endsWith("/submit"))?.body).toEqual({ answer: "2" });
    expect(screen.getByRole("radio", { name: "4% increase" })).toHaveAccessibleDescription(hg(CHOICE.wrong));
    // The right option is not marked.
    expect(screen.getByRole("radio", { name: "4% decrease" })).not.toHaveAccessibleDescription(hg(CHOICE.right));
    expect(container.querySelectorAll(".ln-right")).toHaveLength(0);
    expect(await screen.findByText("Samjhaav sahi karne par khulta hai, ya 3 galat koshish ke baad (2/3).")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: hg(AP.askWhy) })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("answers right: the option marked right, the explanation and its shortcut open, coins shown", async () => {
    api.routes["POST /practice/demo/problems/chai-price/submit"] = () => {
      problem = chai({ status: "solved", editorial: EXPLAINED, editorialLocked: false });
      return { body: { status: "passed", passed: 1, total: 1, compileOutput: null, timeMs: null, memoryKb: null, cases: [], submissionId: "s3", firstSolve: true, reward: { coins: 5, reasons: ["solve"] } } };
    };
    at("/aptitude/aptitude-quant-percentages");
    const { container } = renderLearn();
    await userEvent.click(await screen.findByRole("radio", { name: "4% decrease" }));
    await userEvent.click(screen.getByRole("button", { name: hg(AP.check) }));
    await waitFor(() => expect(api.calls.some((c) => c.path.endsWith("/submit"))).toBe(true));
    expect(await screen.findByText("+5 coins")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "4% decrease" })).toHaveAccessibleDescription(hg(CHOICE.right));
    const explanation = await screen.findByRole("region", { name: hg(AP.explanation) });
    expect(explanation).toHaveTextContent("The second change is on the new price.");
    expect(explanation).toHaveTextContent("Shortcut: 20 − 20 − 4 = −4.");
    expect(await violations(container)).toEqual([]);
  });

  it("keeps the explanation shut while a contest with the question runs", async () => {
    problem = chai({ contest: { slug: "weekly", title: "Weekly round", endsAt: "2026-11-18T20:00:00Z" } });
    at("/aptitude/aptitude-quant-percentages");
    renderLearn();
    expect(await screen.findByText(hg(AP.lockedContest))).toBeInTheDocument();
    expect(screen.queryByText(/3 galat koshish/)).toBeNull();
  });

  it("moves through the palette and with Next, the question's heading taking the focus", async () => {
    at("/aptitude/aptitude-quant-percentages");
    renderLearn();
    await screen.findByRole("heading", { level: 2, name: "A price that rises, then falls" });
    await userEvent.click(screen.getByRole("button", { name: hg(AP.next) }));
    const second = await screen.findByRole("heading", { level: 2, name: "Two discounts" });
    await waitFor(() => expect(second).toHaveFocus());
    expect(await screen.findByRole("region", { name: hg(AP.explanation) })).toHaveTextContent("The second change");
    expect(screen.getByRole("link", { name: hg(AP.done) })).toHaveAttribute("href", `/practice/${SITE}/aptitude`);
    await userEvent.click(screen.getByRole("button", { name: /^Sawaal 1:/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "A price that rises, then falls" })).toBeInTheDocument();
  });

  it("signed out: reads the question, and Check asks to sign in and come back", async () => {
    localStorage.removeItem(SESSION);
    at("/aptitude/aptitude-quant-percentages");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: "A price that rises, then falls" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(AP.signInToCheck) })).toHaveAttribute("href", `/practice/${SITE}/signin?next=${encodeURIComponent("aptitude/aptitude-quant-percentages")}`);
    expect(screen.queryByRole("button", { name: hg(AP.check) })).toBeNull();
  });

  it("a topic that is not there says so", async () => {
    at("/aptitude/aptitude-quant-geometry");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(AP.missingTitle) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(AP.done) })).toHaveAttribute("href", `/practice/${SITE}/aptitude`);
  });
});

describe("the misses", () => {
  it("are every question tried and not right yet", async () => {
    at("/aptitude/misses");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(AP.missesTitle) })).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: hg(AP.palette) })).getAllByRole("button")).toHaveLength(1);
    expect(await screen.findByRole("heading", { level: 2, name: "A price that rises, then falls" })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("none left: says so", async () => {
    api.routes["GET /practice/demo/problems"] = () => ({ body: { problems: PROBLEMS.map((p) => ({ ...p, status: p.status === "attempted" ? "solved" : p.status })) } });
    at("/aptitude/misses");
    renderLearn();
    expect(await screen.findByRole("heading", { name: hg(AP.missesNone) })).toBeInTheDocument();
  });
});
