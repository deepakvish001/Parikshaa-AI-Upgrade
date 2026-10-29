import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Problem, Verdict } from "../practice/client.ts";
import { fakeApi, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { LW, statementBody, verdictWord } from "./LearnWorkspace.tsx";
import { T } from "./text.ts";

/**
 * Learn's problem workspace (tracker row 140, K2-5) against a fake of the
 * practice site's API: the statement as elements (never HTML), Run on an
 * example and on the learner's own input, Submit and every verdict with the
 * first failing test where it may be shown, the learner's submissions and
 * putting one back in the editor, the draft kept under the old site's key,
 * hints (opened, the next with its cost, refused), the editorial locked,
 * closed for a contest and open with its approaches, a choice problem, the
 * panes and Sahayak's; loading, failed, missing, offline and signed out;
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
const DRAFT = `parikshaa.practice.${SITE}.draft.pair-sum`;

const PAIR: Problem = {
  slug: "pair-sum",
  title: "Pair with target sum",
  difficulty: "medium",
  tags: ["two pointers", "arrays"],
  question: {
    id: "q1",
    kind: "code",
    stem: "Pair with target sum\n\nFind two positions whose values add up to **target**.\n\n<img src=x onerror=alert(1)>",
    maxScore: 1,
    translations: {},
    images: [],
    passage: null,
    language: "python",
    languages: ["python", "cpp"],
    starter: "# read n, then a, then target\n",
    starters: { python: "# read n, then a, then target\n", cpp: "int main() {}\n" },
    function: null,
    inputFormat: "The first line holds `n`.",
    outputFormat: null,
    constraints: "2 ≤ n ≤ 2 · 10⁵",
    aiAssist: false,
    samples: [
      { input: "6\n1 3 4 6 8 11\n10\n", output: "2 3\n", explanation: "4 + 6 = 10" },
      { input: "3\n2 5 9\n4\n", output: "-1\n", explanation: null },
    ],
  } as unknown as Problem["question"],
  editorial: null,
  editorialLocked: true,
  acceptance: 0.61,
  solvedBy: 42,
  status: "attempted",
  contest: null,
};

const testCase = (number: number, status: string, visible: boolean, extra: Record<string, unknown> = {}) => ({
  number,
  visible,
  status,
  timeMs: 12,
  memoryKb: 900,
  input: visible ? "2\n1073741824 1073741824\n2147483648\n" : null,
  expectedOutput: visible ? "0 1\n" : null,
  stdout: visible ? "-1\n" : null,
  result: null,
  stderr: visible ? "" : null,
  ...extra,
});
const verdict = (status: string, cases: ReturnType<typeof testCase>[], extra: Partial<Verdict> = {}): Verdict => ({
  status,
  passed: cases.filter((c) => c.status === "passed").length,
  total: cases.length,
  compileOutput: null,
  timeMs: 12,
  memoryKb: 900,
  cases: cases as unknown as Verdict["cases"],
  submissionId: "s9",
  firstSolve: false,
  ...extra,
});

let api: FakeApi;
let submitted: Verdict;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  localStorage.setItem(SESSION, "pl_good");
  localStorage.setItem(DRAFT, JSON.stringify({ language: "python", source: "print(-1)\n" }));
  at("/problems/pair-sum");
  api = fakeApi();
  submitted = verdict("wrong_answer", [testCase(1, "passed", true), testCase(2, "wrong_answer", true), testCase(3, "passed", false)]);
  api.routes["GET /practice/demo/problems/pair-sum"] = () => ({ body: PAIR });
  api.routes["GET /practice/demo/problems/pair-sum/submissions"] = () => ({
    body: {
      submissions: [
        { id: "s2", language: "python", answer: "print(2, 3)", status: "wrong_answer", passed: 23, total: 24, timeMs: 46, memoryKb: 4100, createdAt: "2026-10-27T10:00:00Z", inContest: false },
        { id: "s1", language: "cpp", answer: "int main() { return 1; }", status: "compile_error", passed: 0, total: 0, timeMs: null, memoryKb: null, createdAt: "2026-10-27T09:00:00Z", inContest: false },
      ],
    },
  });
  api.routes["GET /practice/demo/problems/pair-sum/tutor"] = () => ({
    body: {
      entries: [{ id: "h1", mode: "hint", hintLevel: 1, answer: "The array is **sorted**.", credits: 0, createdAt: "2026-10-27T10:00:00Z", question: "" }],
      nextHint: { level: 2, credits: 5, available: true },
      failures: 1,
      costs: { hint1: 0, hint: 5, review: 10, doubt: 5 },
    },
  });
  api.routes["POST /practice/demo/problems/pair-sum/run"] = () => ({
    body: {
      compiled: true,
      results: [
        { input: "6\n1 3 4 6 8 11\n10\n", expectedOutput: "2 3\n", status: "passed", stdout: "2 3\n", stderr: "", timeMs: 9, memoryKb: 800 },
        { input: "3\n2 5 9\n4\n", expectedOutput: "-1\n", status: "wrong_answer", stdout: "0 1\n", stderr: "", timeMs: 8, memoryKb: 800 },
      ],
    },
  });
  api.routes["POST /practice/demo/problems/pair-sum/submit"] = () => ({ body: submitted });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

const workspace = async () => {
  renderLearn();
  return screen.findByRole("heading", { level: 1, name: PAIR.title });
};
const result = () => screen.getByRole("tabpanel", { name: hg(LW.result) });

describe("helpers", () => {
  it("drops the statement's first paragraph only when it is the title, and names every verdict", () => {
    expect(statementBody("Pair with target sum\n\nFind two.", "Pair with target sum")).toBe("Find two.");
    expect(statementBody("Find two.\n\nThen print them.", "Pair with target sum")).toBe("Find two.\n\nThen print them.");
    expect(verdictWord("time_limit")).toBe(LW.time_limit);
    expect(verdictWord("toString")).toBe(LW.verdictOther);
    expect(verdictWord("something_new")).toBe(LW.verdictOther);
  });
});

describe("the problem workspace", () => {
  it("opens a problem from its address: the focus bar, the statement as elements, and passes axe", async () => {
    const { container } = renderLearn();
    expect(screen.getByText(/Load ho raha hai/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: PAIR.title })).toBeInTheDocument();
    // A focus screen: no side bar, a way back.
    expect(screen.queryByRole("navigation", { name: hg(T.nav) })).toBeNull();
    expect(screen.getByRole("link", { name: hg(LW.back) })).toHaveAttribute("href", `/practice/${SITE}/practice`);
    const statement = screen.getByRole("tabpanel", { name: hg(LW.tabStatement) });
    expect(within(statement).getByText("target").tagName).toBe("STRONG");
    expect(container.querySelector("img")).toBeNull();
    expect(within(statement).getByRole("heading", { name: hg(LW.constraints) })).toBeInTheDocument();
    expect(within(statement).getByRole("heading", { name: "Example 1" })).toBeInTheDocument();
    expect(within(statement).getByText("4 + 6 = 10")).toBeInTheDocument();
    expect(within(statement).getByText("42 ne solve kiya · 61% submissions accepted")).toBeInTheDocument();
    // The hint already opened, and the next with its cost.
    expect((await within(statement).findByText("sorted")).tagName).toBe("STRONG");
    expect(within(statement).getByRole("button", { name: /Hint 2 kholo · 5 credits/ })).toBeEnabled();
    // The draft from the old site's key is in the editor.
    await waitFor(() => expect(screen.getByRole("textbox", { name: hg(LW.editor) })).toHaveTextContent("print(-1)"));
    expect(screen.getByRole("separator", { name: "Problem aur Code ka size badlo" })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("runs the code on an example and on the learner's own input, through the API only", async () => {
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.run) }));
    expect(await within(result()).findByText(hg(LW.wrong_answer))).toBeInTheDocument();
    expect(within(result()).getByText("2 me se 1 examples pass", { exact: false })).toBeInTheDocument();
    const run = api.calls.find((c) => c.method === "POST" && c.path.endsWith("/run"));
    expect(run?.body).toEqual({ language: "python", source: "print(-1)\n" });
    await userEvent.click(within(result()).getByRole("button", { name: /Case 2/ }));
    expect(within(result()).getByRole("generic", { name: hg(LW.yours) })).toHaveTextContent("0 1");

    await userEvent.click(screen.getByRole("tab", { name: hg(LW.testcase) }));
    await userEvent.click(screen.getByRole("button", { name: hg(LW.custom) }));
    const box = screen.getByRole("textbox", { name: hg(LW.customStdin) });
    await userEvent.clear(box);
    await userEvent.type(box, "2{enter}1 1{enter}2");
    await userEvent.click(screen.getByRole("button", { name: hg(LW.run) }));
    await waitFor(() => expect(api.calls.filter((c) => c.path.endsWith("/run"))).toHaveLength(2));
    expect(api.calls.filter((c) => c.path.endsWith("/run"))[1]?.body).toEqual({ language: "python", source: "print(-1)\n", input: "2\n1 1\n2" });
  });

  it("says a compile error on Run, with the compiler's words", async () => {
    api.routes["POST /practice/demo/problems/pair-sum/run"] = () => ({ body: { compiled: false, compileOutput: "line 1: expected ';'" } });
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.run) }));
    expect(await within(result()).findByText(hg(LW.compile_error))).toBeInTheDocument();
    expect(within(result()).getByText("line 1: expected ';'")).toBeInTheDocument();
  });

  it("submits to the judge: wrong answer with the first failing visible test, the bar of tests, and Fail kyun opens Sahayak", async () => {
    const { container } = await workspace().then(() => ({ container: document.body }));
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await within(result()).findByText(hg(LW.wrong_answer))).toBeInTheDocument();
    expect(api.calls.find((c) => c.path.endsWith("/submit"))?.body).toEqual({ answer: "print(-1)\n", language: "python" });
    expect(within(result()).getByText("3 me se 2 test pass")).toBeInTheDocument();
    expect(within(result()).getByRole("list", { name: "3 me se 2 test pass" }).querySelectorAll("li")).toHaveLength(3);
    const failing = within(result()).getByRole("region", { name: "Pehla fail test: test 2" });
    expect(within(failing).getByRole("generic", { name: hg(LW.expected) })).toHaveTextContent("0 1");
    expect(within(failing).getByRole("generic", { name: hg(LW.yours) })).toHaveTextContent("-1");
    expect(await violations(container)).toEqual([]);
    // The submission changes the learner's standing: the problem and the list are read again.
    await waitFor(() => expect(api.calls.filter((c) => c.path === "/practice/demo/problems/pair-sum").length).toBeGreaterThan(1));
    await userEvent.click(within(result()).getByRole("button", { name: hg(LW.askWhy) }));
    expect(await screen.findByRole("heading", { name: hg(T.sahayak) })).toBeInTheDocument();
    expect(screen.getByText(hg(T.sahayakSoon))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sahayak/, pressed: true })).toBeInTheDocument();
  });

  it.each([
    ["time_limit", LW.time_limit],
    ["memory_limit", LW.memory_limit],
    ["runtime_error", LW.runtime_error],
  ] as const)("names %s, and keeps a hidden test's input to itself", async (status, word) => {
    submitted = verdict(status, [testCase(1, "passed", true), testCase(2, status, false)]);
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await within(result()).findByText(hg(word))).toBeInTheDocument();
    expect(within(result()).getByText(hg(LW.hiddenNote))).toBeInTheDocument();
    expect(within(result()).queryByRole("generic", { name: hg(LW.expected) })).toBeNull();
  });

  it("says a compile error on Submit, and an accepted one with its coins and the editorial", async () => {
    submitted = { ...verdict("compile_error", []), compileOutput: "SyntaxError: invalid syntax" };
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await within(result()).findByText("SyntaxError: invalid syntax")).toBeInTheDocument();

    submitted = verdict("passed", [testCase(1, "passed", true), testCase(2, "passed", false)], { firstSolve: true, reward: { coins: 10, reasons: ["solve"] } });
    api.routes["GET /practice/demo/problems/pair-sum"] = () => ({
      body: { ...PAIR, status: "solved", editorialLocked: false, editorial: "Sort first.\n\n## Brute force\n\nTry every pair.\n\n## Optimal\n\nTwo **pointers**." },
    });
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await within(result()).findByText(hg(LW.passed))).toBeInTheDocument();
    expect(within(result()).getByText("+10 coins")).toBeInTheDocument();
    expect(within(result()).getByText(hg(LW.firstSolve))).toBeInTheDocument();
    expect(within(result()).queryByRole("button", { name: hg(LW.askWhy) })).toBeNull();
    await userEvent.click(within(result()).getByRole("button", { name: hg(LW.readEditorial) }));
    const editorial = await screen.findByRole("tabpanel", { name: hg(LW.tabEditorial) });
    expect(await within(editorial).findByText("Try every pair.")).toBeInTheDocument();
    await userEvent.click(within(editorial).getByRole("button", { name: "Optimal" }));
    expect(within(editorial).getByText("pointers").tagName).toBe("STRONG");
  });

  it("says the judge is busy when it is, and that the code is safe", async () => {
    api.routes["POST /practice/demo/problems/pair-sum/submit"] = () => ({ status: 503, body: { error: "judge_busy", message: "Busy" } });
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await within(result()).findByText(hg(LW.busy))).toBeInTheDocument();
  });

  it("keeps the editorial locked until solved or three wrong tries, and shut during a contest", async () => {
    await workspace();
    await userEvent.click(screen.getByRole("tab", { name: hg(LW.tabEditorial) }));
    expect(screen.getByText(/Editorial solve karne par khulta hai, ya 3 galat submit ke baad/)).toBeInTheDocument();
    expect(await screen.findByText("Abhi tak galat submit: 3 me se 2.")).toBeInTheDocument();
  });

  it("during a contest: the editorial and the hints stay shut", async () => {
    api.routes["GET /practice/demo/problems/pair-sum"] = () => ({ body: { ...PAIR, contest: { slug: "weekly-13", title: "Weekly Round 13", endsAt: "2026-11-01T16:00:00Z" } } });
    await workspace();
    expect(screen.queryByRole("heading", { name: hg(LW.hints) })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: hg(LW.tabEditorial) }));
    expect(screen.getByText(hg(LW.editorialContest))).toBeInTheDocument();
    expect(api.calls.some((c) => c.path.endsWith("/tutor"))).toBe(false);
  });

  it("lists the learner's submissions and puts one back in the editor, under the old site's draft key", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await workspace();
    const tab = screen.getByRole("tab", { name: /Submissions/ });
    expect(await within(tab).findByText("2")).toBeInTheDocument();
    await userEvent.click(tab);
    const list = screen.getByRole("tabpanel", { name: /Submissions/ });
    expect(within(list).getByText(/Submission 2 · 23\/24 test · Python 3 · 46 ms · 4.0 MB/)).toBeInTheDocument();
    expect(within(list).getByText(hg(LW.compile_error))).toBeInTheDocument();
    await userEvent.click(within(list).getByRole("button", { name: /Galat jawab/ }));
    await userEvent.click(within(list).getByRole("button", { name: hg(LW.loadCode) }));
    expect(JSON.parse(localStorage.getItem(DRAFT)!)).toEqual({ language: "python", source: "print(2, 3)" });
    expect(screen.getByText(hg(LW.loaded))).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: hg(LW.editor) })).toHaveTextContent("print(2, 3)"));
  });

  it("keeps the learner's own note on the problem, in Markdown, drawn as elements", async () => {
    let saved = "";
    api.routes["GET /practice/demo/notes/problem/pair-sum"] = () => ({ body: { kind: "problem", ref: "pair-sum", title: PAIR.title, body: saved, updatedAt: null } });
    api.routes["PUT /practice/demo/notes/problem/pair-sum"] = () => {
      saved = "Cast **before** adding.";
      return { body: { kind: "problem", ref: "pair-sum", title: PAIR.title, body: saved, updatedAt: "2026-10-27T10:00:00Z" } };
    };
    const { container } = await workspace().then(() => ({ container: document.body }));
    await userEvent.click(screen.getByRole("tab", { name: hg(LW.tabNote) }));
    expect(await screen.findByText(hg(LW.noteNone))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.noteWrite) }));
    await userEvent.type(screen.getByRole("textbox", { name: hg(LW.noteText) }), "Cast **before** adding.");
    await userEvent.click(screen.getByRole("button", { name: hg(LW.noteSave) }));
    expect(await screen.findByText("before")).toHaveProperty("tagName", "STRONG");
    expect(api.calls.find((c) => c.method === "PUT")?.body).toEqual({ body: "Cast **before** adding." });
    expect(screen.getByText(hg(LW.noteSaved))).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("switches the language: untouched starter code follows it, the learner's own stays", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await workspace();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: hg(LW.language) }), "cpp");
    expect(JSON.parse(localStorage.getItem(DRAFT)!)).toEqual({ language: "cpp", source: "print(-1)\n" });
    await userEvent.click(screen.getByRole("button", { name: hg(LW.reset) }));
    expect(JSON.parse(localStorage.getItem(DRAFT)!)).toEqual({ language: "cpp", source: "int main() {}\n" });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: hg(LW.language) }), "python");
    expect(JSON.parse(localStorage.getItem(DRAFT)!)).toEqual({ language: "python", source: "# read n, then a, then target\n" });
  });

  it("opens the next hint and says when credits run short", async () => {
    let asked = 0;
    api.routes["POST /practice/demo/problems/pair-sum/tutor/hint"] = () => {
      asked++;
      return { status: 402, body: { error: "no_credits", message: "Not enough credits" } };
    };
    await workspace();
    await userEvent.click(await screen.findByRole("button", { name: /Hint 2 kholo/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(hg(LW.noCredits));
    expect(screen.getByRole("link", { name: hg(LW.getCredits) })).toHaveAttribute("href", `/practice/${SITE}/plus?learn_v2=0`);
    expect(asked).toBe(1);
    expect(api.calls.find((c) => c.path.endsWith("/tutor/hint"))?.body).toEqual({ replyIn: "en", code: "print(-1)\n", language: "python" });
  });

  it("closes and reopens panes, and opens Sahayak with Ctrl+J", async () => {
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: "Problem", pressed: true }));
    expect(screen.getByRole("button", { name: "Problem dikhao" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Problem dikhao" }));
    expect(screen.getByRole("button", { name: "Problem", pressed: true })).toBeInTheDocument();
    await userEvent.keyboard("{Control>}j{/Control}");
    expect(await screen.findByRole("button", { name: hg(T.close) })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: hg(T.close) }));
    expect(screen.getByRole("button", { name: /^Sahayak/, pressed: false })).toBeInTheDocument();
  });

  it("on a phone, the panes are tabs and the code is shown first", async () => {
    window.matchMedia = vi.fn((query: string) => ({ matches: query.includes("860") || query.includes("1180"), media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    const { container } = renderLearn();
    await screen.findByRole("heading", { level: 1, name: PAIR.title });
    const tabs = screen.getByRole("tablist", { name: hg(LW.panesTabs) });
    expect(within(tabs).getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(within(tabs).getByRole("tab", { name: "Problem" }));
    expect(within(tabs).getByRole("tab", { name: "Problem" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { level: 2, name: PAIR.title })).toBeVisible();
    expect(await violations(container)).toEqual([]);
  });

  it("goes back to the screen the learner came from", async () => {
    at("/practice");
    api.routes["GET /practice/demo/problems"] = () => ({ body: { problems: [{ ...PAIR, patterns: [], companies: [], kind: "code" }] } });
    api.routes["GET /practice/demo/tracks"] = () => ({ body: { tracks: [] } });
    renderLearn();
    await userEvent.click(await screen.findByRole("link", { name: PAIR.title }));
    expect(await screen.findByRole("heading", { level: 1, name: PAIR.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LW.back) })).toHaveAttribute("href", `/practice/${SITE}/practice`);
    await userEvent.click(screen.getByRole("link", { name: hg(LW.back) }));
    expect(await screen.findByRole("navigation", { name: hg(T.nav) })).toBeInTheDocument();
  });

  it("answers a choice problem in the same panes", async () => {
    api.routes["GET /practice/demo/problems/pair-sum"] = () => ({
      body: { ...PAIR, editorialLocked: false, question: { id: "q2", kind: "mcq", stem: "Pair with target sum\n\nWhich pointer moves when the sum is too **small**?", maxScore: 1, translations: {}, images: [], passage: null, options: ["Left", "Right"], multiple: false, negativeMarks: 0 } },
    });
    localStorage.removeItem(DRAFT);
    submitted = verdict("passed", [], { reward: { coins: 5, reasons: ["solve"] } });
    const { container } = renderLearn();
    await screen.findByRole("heading", { level: 1, name: PAIR.title });
    expect(screen.getByRole("button", { name: hg(LW.submit) })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "Left" }));
    expect(localStorage.getItem(DRAFT)).toBe("0");
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await screen.findByText(hg(LW.correct))).toBeInTheDocument();
    expect(api.calls.find((c) => c.path.endsWith("/submit"))?.body).toEqual({ answer: "0" });
    await userEvent.click(screen.getByRole("tab", { name: hg(LW.tabEditorial) }));
    expect(screen.getByText(hg(LW.noEditorial))).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("signed out: reads the problem; Run, Submit, hints and submissions ask to sign in", async () => {
    localStorage.removeItem(SESSION);
    const { container } = await workspace().then(() => ({ container: document.body }));
    const next = `/practice/${SITE}/signin?next=${encodeURIComponent("problems/pair-sum")}`;
    expect(screen.getByRole("link", { name: hg(LW.signInToRun) })).toHaveAttribute("href", next);
    expect(screen.getByRole("link", { name: hg(LW.hintSignIn) })).toHaveAttribute("href", next);
    expect(screen.queryByRole("button", { name: hg(LW.submit) })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: hg(LW.tabSubmissions) }));
    expect(screen.getByRole("link", { name: hg(LW.subsSignIn) })).toHaveAttribute("href", next);
    expect(api.calls.some((c) => c.path.includes("/tutor") || c.path.endsWith("/submissions"))).toBe(false);
    expect(await violations(container)).toEqual([]);
  });

  it("says when there is no problem at the address, and when it failed to load", async () => {
    api.routes["GET /practice/demo/problems/pair-sum"] = () => ({ status: 404, body: { error: "not_found" } });
    const first = renderLearn();
    expect(await screen.findByText(hg(LW.notFoundTitle))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LW.toProblems) })).toHaveAttribute("href", `/practice/${SITE}/practice`);
    first.unmount();
    api.routes["GET /practice/demo/problems/pair-sum"] = () => ({ status: 500, body: { error: "internal" } });
    renderLearn();
    expect(await screen.findByText("internal · 500", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LW.back) })).toBeInTheDocument();
  });

  it("offline: waits for the problem, and keeps Run and Submit for when the network is back", async () => {
    const first = await workspace().then(() => ({ ok: true }));
    expect(first.ok).toBe(true);
    act(() => {
      onlineManager.setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByText(hg(LW.offline))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: hg(LW.submit) })).toBeDisabled();
    expect(screen.getByRole("button", { name: hg(LW.run) })).toBeDisabled();
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  });

  it("speaks Hindi when asked", async () => {
    localStorage.setItem("parikshaa.language", "hi");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: PAIR.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: LW.submit[2] })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: LW.tabEditorial[2] })).toBeInTheDocument();
  });
});
