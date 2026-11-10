import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Problem, ProblemSummary, Verdict } from "../practice/client.ts";
import { fakeApi, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { PB } from "./LearnProblems.tsx";
import { compareRows, COLS, LQ, ROWS } from "./LearnSql.tsx";
import { LW } from "./LearnWorkspace.tsx";

/**
 * SQL in Learn (tracker row 140, K2-7) against a fake of the practice site's
 * API: an SQL problem in the workspace (its tables with their columns and
 * types, each example's rows, the query editor), Run and Submit with the
 * learner's result beside the expected one as tables (rows marked in words,
 * every value text, capped), a query error as the database's words, a hidden
 * test kept to itself, accepted; hints read the query and nothing else; the
 * SQL screen lists only the SQL problems; loading, failed, empty, offline and
 * signed out; axe finding nothing.
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
const DRAFT = `parikshaa.practice.${SITE}.draft.big-countries`;
const SETUP =
  "CREATE TABLE World (name TEXT PRIMARY KEY, continent TEXT, area INTEGER, population INTEGER);\n" +
  "INSERT INTO World (name, continent, area, population) VALUES ('India', 'Asia', 3287263, 1428627663), ('Nepal', 'Asia', 147516, 30896590), ('Canada', 'America', 9984670, 38781291);\n";
const EXPECTED = "India\t1428627663\t3287263\nNepal\t30896590\t147516\nCanada\t38781291\t9984670\n";
const WRONG_ROWS = "India\t1428627663\t3287263\nCanada\t38781291\t9984670\n";
const QUERY = "SELECT name, population, area FROM World WHERE area > 3000000;";

const BIG: Problem = {
  slug: "big-countries",
  title: "Big countries",
  difficulty: "easy",
  tags: ["sql", "filtering"],
  question: {
    id: "q-sql",
    kind: "code",
    stem: "A country is **big** when its area is at least 3,000,000 km² or its population at least 25,000,000.",
    maxScore: 10,
    translations: {},
    images: [],
    passage: null,
    language: "sql",
    languages: ["sql"],
    starter: "-- Write one query. The tables are made for each test.\nSELECT\n",
    starters: { sql: "-- Write one query. The tables are made for each test.\nSELECT\n" },
    function: null,
    inputFormat: null,
    outputFormat: "One row to a line, columns separated by a tab, `NULL` for a null.",
    constraints: null,
    aiAssist: false,
    samples: [{ input: SETUP, output: EXPECTED, explanation: null }],
  } as unknown as Problem["question"],
  editorial: null,
  editorialLocked: true,
  acceptance: null,
  solvedBy: 0,
  status: null,
  contest: null,
};

const sqlCase = (number: number, status: string, visible: boolean, extra: Record<string, unknown> = {}) => ({
  number,
  visible,
  status,
  timeMs: 9,
  memoryKb: 900,
  input: visible ? SETUP : null,
  expectedOutput: visible ? EXPECTED : null,
  stdout: visible ? WRONG_ROWS : null,
  result: null,
  stderr: visible ? "" : null,
  ...extra,
});
const verdict = (status: string, cases: ReturnType<typeof sqlCase>[]): Verdict => ({
  status,
  passed: cases.filter((c) => c.status === "passed").length,
  total: cases.length,
  compileOutput: null,
  timeMs: 9,
  memoryKb: 900,
  cases: cases as unknown as Verdict["cases"],
  submissionId: "s9",
  firstSolve: false,
});

const summary = (slug: string, title: string, languages: string[] | undefined): ProblemSummary => ({
  slug,
  title,
  difficulty: "easy",
  tags: [],
  patterns: [],
  companies: [],
  kind: languages === undefined || languages.length === 0 ? "mcq" : "code",
  ...(languages === undefined ? {} : { languages }),
  acceptance: null,
  solvedBy: 0,
  status: null,
});

let api: FakeApi;
let submitted: Verdict;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  localStorage.setItem(SESSION, "pl_good");
  localStorage.setItem(DRAFT, JSON.stringify({ language: "sql", source: QUERY }));
  at("/problems/big-countries");
  api = fakeApi();
  submitted = verdict("wrong_answer", [sqlCase(1, "wrong_answer", true), sqlCase(2, "passed", false)]);
  api.routes["GET /practice/demo/problems/big-countries"] = () => ({ body: BIG });
  api.routes["GET /practice/demo/problems/big-countries/submissions"] = () => ({ body: { submissions: [] } });
  api.routes["GET /practice/demo/problems/big-countries/tutor"] = () => ({ body: { entries: [], nextHint: { level: 1, credits: 5, available: true }, failures: 0, costs: { hint1: 5, hint: 5, review: 10, doubt: 5 } } });
  api.routes["POST /practice/demo/problems/big-countries/run"] = () => ({
    body: { compiled: true, results: [{ input: SETUP, expectedOutput: EXPECTED, status: "wrong_answer", stdout: WRONG_ROWS, stderr: "", timeMs: 8, memoryKb: 800 }] },
  });
  api.routes["POST /practice/demo/problems/big-countries/submit"] = () => ({ body: submitted });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

const workspace = async () => {
  const view = renderLearn();
  await screen.findByRole("heading", { level: 1, name: BIG.title });
  return view;
};
const result = () => screen.getByRole("tabpanel", { name: hg(LW.result) });

describe("compareRows", () => {
  it("marks rows missing and extra as sets that count repeats, and sees when only the order differs", () => {
    const marks = compareRows(
      [["a"], ["b"], ["b"]],
      [["b"], ["c"], ["a"]],
    );
    expect(marks.yours).toEqual(["ok", "ok", "extra"]);
    expect(marks.expected).toEqual(["ok", "missing", "ok"]);
    expect(marks.sameRows).toBe(false);
    expect(compareRows([["2"], ["1"]], [["1"], ["2"]]).sameRows).toBe(true);
    expect(compareRows([], []).sameRows).toBe(true);
  });
});

describe("an SQL problem in the workspace", () => {
  it("shows its tables, each column's type, the example's rows and result, and the query editor; passes axe", async () => {
    const { container } = await workspace();
    const statement = screen.getByRole("tabpanel", { name: hg(LW.tabStatement) });
    expect(within(statement).getByRole("heading", { name: hg(LW.tables) })).toBeInTheDocument();
    const columns = await within(statement).findByRole("region", { name: "World ke columns" });
    expect(within(columns).getByText("population")).toBeInTheDocument();
    expect(within(columns).getAllByText("INTEGER")).toHaveLength(2);
    // The example: the table with its rows, and the result as rows.
    const example = within(statement).getByRole("region", { name: "World · 3 rows" });
    expect(within(example).getByRole("columnheader", { name: "continent" })).toBeInTheDocument();
    expect(within(example).getByRole("cell", { name: "Nepal" })).toBeInTheDocument();
    expect(within(statement).getByRole("region", { name: `Example 1: ${hg(LW.rowsOut)}` })).toHaveTextContent("Canada");
    expect(within(statement).getByText(hg(LQ.setupSql))).toBeInTheDocument();
    // The query pane and its editor.
    expect(screen.getByRole("button", { name: hg(LW.query), pressed: true })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: hg(LW.queryEditor) })).toHaveTextContent("FROM World"));
    expect(screen.getByText("SQL (SQLite)")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("runs the query on the example: the learner's result beside the expected, the missing row said in words", async () => {
    const { container } = await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.run) }));
    expect(await within(result()).findByText(hg(LW.wrong_answer))).toBeInTheDocument();
    expect(api.calls.find((c) => c.path.endsWith("/run"))?.body).toEqual({ language: "sql", source: QUERY });
    const yours = await within(result()).findByRole("group", { name: hg(LQ.yours) });
    expect(within(yours).getAllByRole("row")).toHaveLength(2);
    const expected = within(result()).getByRole("group", { name: hg(LQ.expected) });
    const missing = within(expected).getAllByRole("row").find((row) => row.textContent?.includes("Nepal"));
    expect(missing).toHaveClass("lq-missing");
    expect(missing).toHaveTextContent(`(${hg(LQ.missing)})`);
    expect(within(result()).getByText("1 rows kam, 0 rows zyada")).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("says a query error in the database's own words, with no empty result beside it", async () => {
    api.routes["POST /practice/demo/problems/big-countries/run"] = () => ({
      body: { compiled: true, results: [{ input: SETUP, expectedOutput: EXPECTED, status: "runtime_error", stdout: "", stderr: "Error: no such column: nme\n", timeMs: 5, memoryKb: 800 }] },
    });
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.run) }));
    expect(await within(result()).findByText(hg(LW.queryError), { selector: "p" })).toBeInTheDocument();
    expect(within(result()).getByRole("generic", { name: hg(LW.queryError) })).toHaveTextContent("Error: no such column: nme");
    expect(within(result()).queryByRole("group", { name: hg(LQ.expected) })).toBeNull();
  });

  it("submits: a wrong answer on a visible test shows both results; a hidden one only its verdict", async () => {
    const { container } = await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await within(result()).findByText(hg(LW.wrong_answer))).toBeInTheDocument();
    expect(api.calls.find((c) => c.path.endsWith("/submit"))?.body).toEqual({ answer: QUERY, language: "sql" });
    const failing = within(result()).getByRole("region", { name: "Pehla fail test: test 1" });
    expect(await within(failing).findByRole("group", { name: hg(LQ.yours) })).toBeInTheDocument();
    expect(within(failing).getByRole("region", { name: "World · 3 rows" })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);

    submitted = verdict("runtime_error", [sqlCase(1, "passed", true), sqlCase(2, "runtime_error", false)]);
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await within(result()).findByText(hg(LW.queryError))).toBeInTheDocument();
    expect(within(result()).getByText(hg(LW.hiddenNote))).toBeInTheDocument();
    expect(within(result()).queryByRole("group", { name: hg(LQ.expected) })).toBeNull();

    submitted = verdict("passed", [sqlCase(1, "passed", true), sqlCase(2, "passed", false)]);
    await userEvent.click(screen.getByRole("button", { name: hg(LW.submit) }));
    expect(await within(result()).findByText(hg(LW.passed))).toBeInTheDocument();
    expect(within(result()).getByText("2 me se 2 test pass")).toBeInTheDocument();
  });

  it("keeps a result's values as text, at most a set of rows and columns, and says the rest", async () => {
    const wide = Array.from({ length: COLS + 4 }, (_, i) => `c${i}`).join("\t");
    const rows = [`<img src=x onerror=alert(1)>\t${"x".repeat(300)}`, ...Array.from({ length: ROWS + 18 }, () => wide)].join("\n");
    api.routes["POST /practice/demo/problems/big-countries/run"] = () => ({
      body: { compiled: true, results: [{ input: SETUP, expectedOutput: null, status: "ran", stdout: `${rows}\n`, stderr: "", timeMs: 5, memoryKb: 800 }] },
    });
    const { container } = await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.run) }));
    const yours = await within(result()).findByRole("group", { name: hg(LQ.yours) });
    expect(container.querySelector("img")).toBeNull();
    expect(within(yours).getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(within(yours).getByText(`${"x".repeat(120)}…`)).toBeInTheDocument();
    expect(within(yours).getAllByRole("row")).toHaveLength(ROWS);
    expect(within(yours).getByText("…aur 19 rows")).toBeInTheDocument();
    expect(within(yours).getByText("4 aur columns nahi dikhaye")).toBeInTheDocument();
  });

  it("says when the rows are right but their order is not", async () => {
    api.routes["POST /practice/demo/problems/big-countries/run"] = () => ({
      body: { compiled: true, results: [{ input: SETUP, expectedOutput: EXPECTED, status: "wrong_answer", stdout: EXPECTED.split("\n").reverse().join("\n").trim() + "\n", stderr: "", timeMs: 5, memoryKb: 800 }] },
    });
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.run) }));
    expect(await within(result()).findByText(hg(LQ.order))).toBeInTheDocument();
  });

  it("runs on the learner's own tables, and a hint reads the query alone (no result goes to Sahayak)", async () => {
    await workspace();
    await userEvent.click(screen.getByRole("button", { name: hg(LW.customTables) }));
    const box = screen.getByRole("textbox", { name: hg(LW.customSql) });
    await userEvent.clear(box);
    await userEvent.type(box, "CREATE TABLE World (name TEXT);");
    await userEvent.click(screen.getByRole("button", { name: hg(LW.run) }));
    await waitFor(() => expect(api.calls.find((c) => c.path.endsWith("/run"))?.body).toEqual({ language: "sql", source: QUERY, input: "CREATE TABLE World (name TEXT);" }));
    api.routes["POST /practice/demo/problems/big-countries/tutor/hint"] = () => ({ body: { id: "h1", mode: "hint", hintLevel: 1, answer: "Think about **OR**.", credits: 5, createdAt: "2026-11-09T10:00:00Z", data: null } });
    await userEvent.click(await screen.findByRole("button", { name: /Hint 1 kholo/ }));
    await waitFor(() => expect(api.calls.find((c) => c.path.endsWith("/tutor/hint"))?.body).toEqual({ replyIn: "en", code: QUERY, language: "sql" }));
  });

  it("offline: the tables stay to read; Run and Submit wait for the network", async () => {
    await workspace();
    act(() => {
      onlineManager.setOnline(false);
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(await screen.findByText(hg(LW.offline))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: hg(LW.run) })).toBeDisabled();
    expect(screen.getByRole("region", { name: "World ke columns" })).toBeInTheDocument();
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  });

  it("signed out: the tables to read, and a way to sign in to run", async () => {
    localStorage.removeItem(SESSION);
    const { container } = await workspace();
    expect(await screen.findByRole("region", { name: "World ke columns" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LW.signInToRun) })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("speaks Hindi", async () => {
    localStorage.setItem("parikshaa.language", "hi");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 3, name: LW.tables[2] })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: LW.query[2], pressed: true })).toBeInTheDocument();
  });
});

describe("the SQL screen", () => {
  beforeEach(() => {
    at("/sql");
    api.routes["GET /practice/demo/tracks"] = () => ({ body: { tracks: [] } });
  });

  it("lists only the SQL problems, and opens one in the workspace", async () => {
    api.routes["GET /practice/demo/problems"] = () => ({
      body: { problems: [summary("big-countries", "Big countries", ["sql"]), summary("pair-sum", "Pair with target sum", ["python"]), summary("stable", "Stable sorting", []), summary("old", "From an older server", undefined)] },
    });
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(PB.sqlTitle) })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 me se 1 problems");
    expect(screen.queryByRole("link", { name: "Pair with target sum" })).toBeNull();
    expect(within(screen.getByRole("main")).queryByRole("link", { name: hg(PB.potd) })).toBeNull();
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("link", { name: "Big countries" }));
    expect(await screen.findByRole("heading", { level: 1, name: BIG.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(LW.back) })).toHaveAttribute("href", `/practice/${SITE}/sql`);
  });

  it("says when the site has no SQL problems, and when the list failed to load", async () => {
    api.routes["GET /practice/demo/problems"] = () => ({ body: { problems: [summary("pair-sum", "Pair with target sum", ["python"])] } });
    const first = renderLearn();
    expect(await screen.findByText(hg(PB.sqlNoneTitle))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(PB.toPractice) })).toHaveAttribute("href", `/practice/${SITE}/practice`);
    expect(await violations(first.container)).toEqual([]);
    first.unmount();
    api.routes["GET /practice/demo/problems"] = () => ({ status: 500, body: { error: "internal" } });
    renderLearn();
    expect(await screen.findByText("internal · 500", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "SQL" })).toBeInTheDocument();
  });

  it("loading, then signed out: the list without the learner's standing, and a sign-in that comes back here", async () => {
    localStorage.removeItem(SESSION);
    api.routes["GET /practice/demo/problems"] = () => ({ body: { problems: [summary("big-countries", "Big countries", ["sql"])] } });
    renderLearn();
    expect(screen.getByText(/Load ho raha hai/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Big countries" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(PB.signIn) })).toHaveAttribute("href", `/practice/${SITE}/signin?next=sql`);
  });
});
