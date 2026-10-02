import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseRoute, PracticeApp, siteOf } from "./PracticeApp.tsx";

/**
 * A practice site in the browser (ROADMAP §15), against a fake of its API:
 * every request the page makes is answered here, and recorded.
 */

type Handler = (init: RequestInit, url: URL) => { status?: number; body: unknown };
let routes: Record<string, Handler>;
let calls: { method: string; path: string; body: unknown; auth: string | null }[];

const site = { slug: "nit-practice", title: "NIT Practice", welcome: "Solve **one** a day." };
const problems = [
  { slug: "stable-sort", title: "Stable sort", difficulty: "easy", tags: ["sorting"], patterns: ["Sorting"], companies: [{ slug: "acme", name: "Acme" }], kind: "mcq", acceptance: 0.5, solvedBy: 3, status: null },
  { slug: "sum-of-two", title: "Sum of two", difficulty: "medium", tags: ["math"], patterns: ["Math"], companies: [], kind: "code", acceptance: null, solvedBy: 0, status: null },
];
const mcq = {
  slug: "stable-sort",
  title: "Stable sort",
  difficulty: "easy",
  tags: ["sorting"],
  question: { id: "p1", kind: "mcq", stem: "Which sort is **stable**?", maxScore: 1, options: ["quicksort", "mergesort"] },
  editorial: null,
  editorialLocked: true,
  acceptance: 0.5,
  solvedBy: 3,
  status: null,
  contest: null,
};

beforeEach(() => {
  window.scrollTo = () => undefined;
  calls = [];
  localStorage.clear();
  routes = {
    "GET /practice/nit-practice": () => ({ body: site }),
    "GET /practice/nit-practice/problems": () => ({ body: { problems } }),
    "GET /practice/nit-practice/problems/stable-sort": () => ({ body: mcq }),
    "GET /practice/nit-practice/problems/stable-sort/comments": () => ({ body: { comments: [] } }),
    "GET /practice/nit-practice/me": (init) =>
      new Headers(init.headers).get("authorization") === "Bearer pl_good"
        ? { body: { id: "l1", name: "Asha", email: "asha@example.com", emailVerified: true } }
        : { status: 401, body: { error: "sign_in_required" } },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, "http://localhost");
      const path = url.pathname.replace(/^\/api/, "");
      const method = init.method ?? "GET";
      calls.push({ method, path, body: init.body === undefined ? undefined : JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
      const handler = routes[`${method} ${path}`];
      const { status = 200, body } = handler === undefined ? { status: 404, body: { error: "not_found" } } : handler(init, url);
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function open(path: string) {
  window.history.replaceState(null, "", path);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PracticeApp site="nit-practice" />
    </QueryClientProvider>,
  );
}

describe("addresses", () => {
  it("name the site and the page", () => {
    expect(siteOf("/practice/nit-practice/problems/two-sum")).toBe("nit-practice");
    expect(siteOf("/practice")).toBeNull();
    expect(siteOf("/attempts/me")).toBeNull();
    expect(parseRoute("/practice/nit-practice", "")).toEqual({ page: "problems" });
    expect(parseRoute("/practice/nit-practice/problems/two-sum", "?contest=weekly-1")).toEqual({ page: "problem", slug: "two-sum", contest: "weekly-1" });
    expect(parseRoute("/practice/nit-practice/contests/weekly-1/", "")).toEqual({ page: "contest", slug: "weekly-1" });
    expect(parseRoute("/practice/nit-practice/signin", "?next=%2Fprogress")).toEqual({ page: "signin", next: "/progress" });
  });
});

describe("the problem set", () => {
  it("lists the problems with their difficulty, and filters them", async () => {
    open("/practice/nit-practice");
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: "1. Stable sort" })).toHaveAttribute("href", "/practice/nit-practice/problems/stable-sort");
    expect(within(table).getByText("Medium")).toBeInTheDocument();
    expect(within(table).getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText("one")).toHaveProperty("tagName", "STRONG");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Difficulty" }), "medium");
    expect(within(table).queryByText("1. Stable sort")).not.toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "2. Sum of two" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No problem matches these filters.")).toBeInTheDocument();
  });

  it("filters by the pattern behind the tags and by the company that asked", async () => {
    open("/practice/nit-practice");
    const table = await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pattern" }), "Math");
    expect(within(table).queryByText("1. Stable sort")).not.toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "2. Sum of two" })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pattern" }), "");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Company" }), "acme");
    expect(within(table).getByRole("link", { name: "1. Stable sort" })).toBeInTheDocument();
    expect(within(table).queryByText("2. Sum of two")).not.toBeInTheDocument();
  });

  it("says so when the site is not there", async () => {
    routes["GET /practice/nit-practice"] = () => ({ status: 404, body: { error: "not_found" } });
    open("/practice/nit-practice");
    expect(await screen.findByRole("heading", { name: "There is no practice site here" })).toBeInTheDocument();
  });
});

describe("accounts", () => {
  it("sign in, keep the session on this device, and return where the learner was going", async () => {
    routes["POST /practice/nit-practice/signin"] = (init) => {
      const { password } = JSON.parse(String(init.body)) as { password: string };
      return password === "correct horse battery"
        ? { body: { token: "pl_good", expiresAt: "2026-10-24T00:00:00.000Z", learner: { id: "l1", name: "Asha", email: "asha@example.com" } } }
        : { status: 401, body: { error: "sign_in_failed" } };
    };
    open("/practice/nit-practice/signin?next=%2Fproblems%2Fstable-sort");
    await userEvent.type(await screen.findByLabelText("Email"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That email and password do not match an account here.");

    await userEvent.clear(screen.getByLabelText("Password"));
    await userEvent.type(screen.getByLabelText("Password"), "correct horse battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Stable sort" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/practice/nit-practice/problems/stable-sort");
    expect(localStorage.getItem("parikshaa.practice.nit-practice.session")).toBe("pl_good");
    expect(await screen.findByRole("link", { name: /Asha/ })).toHaveAttribute("href", "/practice/nit-practice/progress");
  });

  it("forget a session the server has ended", async () => {
    localStorage.setItem("parikshaa.practice.nit-practice.session", "pl_stale");
    open("/practice/nit-practice");
    await screen.findByRole("table");
    await waitFor(() => expect(localStorage.getItem("parikshaa.practice.nit-practice.session")).toBeNull());
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("a problem", () => {
  it("asks a visitor to sign in before answering", async () => {
    open("/practice/nit-practice/problems/stable-sort");
    expect(await screen.findByRole("heading", { name: "Stable sort" })).toBeInTheDocument();
    expect(screen.getByText("stable").tagName).toBe("STRONG");
    expect(screen.getByText("Sign in to run and submit your code.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
  });

  it("is answered and judged, and the editorial and submissions have tabs of their own", async () => {
    localStorage.setItem("parikshaa.practice.nit-practice.session", "pl_good");
    let solved = false;
    routes["POST /practice/nit-practice/problems/stable-sort/submit"] = (init) => {
      solved = (JSON.parse(String(init.body)) as { answer: string }).answer === "1";
      return {
        body: { status: solved ? "passed" : "wrong_answer", passed: solved ? 1 : 0, total: 1, compileOutput: null, timeMs: null, memoryKb: null, cases: [], submissionId: "s1", firstSolve: solved },
      };
    };
    routes["GET /practice/nit-practice/problems/stable-sort"] = () => ({
      body: solved ? { ...mcq, status: "solved", editorial: "Merge sort keeps **equal** keys in order.", editorialLocked: false } : mcq,
    });
    routes["GET /practice/nit-practice/problems/stable-sort/submissions"] = () => ({
      body: {
        submissions: solved
          ? [{ id: "s1", language: null, answer: "1", status: "passed", passed: 1, total: 1, timeMs: null, memoryKb: null, createdAt: "2026-09-24T10:00:00.000Z", inContest: false }]
          : [],
      },
    });
    open("/practice/nit-practice/problems/stable-sort");

    await userEvent.click(await screen.findByRole("tab", { name: "Editorial" }));
    expect(screen.getByText("The editorial opens once you solve the problem, or after three tries.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Description" }));

    await userEvent.click(await screen.findByRole("radio", { name: /quicksort/ }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Not quite. Try again.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /mergesort/ }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Correct!")).toBeInTheDocument();
    expect(screen.getByText("Solved! The editorial is open now.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST").map((c) => [c.body, c.auth])).toEqual([
      [{ answer: "0" }, "Bearer pl_good"],
      [{ answer: "1" }, "Bearer pl_good"],
    ]);

    await userEvent.click(screen.getByRole("tab", { name: "Editorial" }));
    expect(await screen.findByText("equal")).toHaveProperty("tagName", "STRONG");
    await userEvent.click(screen.getByRole("tab", { name: "Submissions" }));
    expect(await screen.findByText("Accepted")).toBeInTheDocument();
  });

  it("shows a code problem in the workspace, beside its tabs, and keeps the code on this device", async () => {
    localStorage.setItem("parikshaa.practice.nit-practice.session", "pl_good");
    routes["GET /practice/nit-practice/problems/sum-of-two"] = () => ({
      body: {
        ...mcq,
        slug: "sum-of-two",
        title: "Sum of two",
        question: {
          id: "p2",
          kind: "code",
          stem: "Sum of two\n\nRead two integers and print their sum.",
          maxScore: 10,
          language: "python",
          languages: ["python"],
          starter: "",
          samples: [{ input: "2 3\n", output: "5\n" }],
        },
      },
    });
    routes["POST /practice/nit-practice/problems/sum-of-two/submit"] = () => ({
      body: {
        status: "wrong_answer",
        passed: 1,
        total: 2,
        compileOutput: null,
        timeMs: 12,
        memoryKb: 9000,
        cases: [
          { number: 1, visible: true, status: "passed", timeMs: 12, memoryKb: 9000, input: "2 3\n", expectedOutput: "5\n", stdout: "5\n", result: null, stderr: "" },
          { number: 2, visible: false, status: "wrong_answer", timeMs: 11, memoryKb: 9000, input: null, expectedOutput: null, stdout: null, result: null, stderr: null },
        ],
        submissionId: "s2",
        firstSolve: false,
      },
    });
    localStorage.setItem("parikshaa.practice.nit-practice.draft.sum-of-two", JSON.stringify({ language: "python", source: "print(5)" }));
    open("/practice/nit-practice/problems/sum-of-two");

    expect(await screen.findByRole("heading", { name: "Sum of two" })).toBeInTheDocument();
    expect(screen.getByText("Read two integers and print their sum.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Discussion" })).toBeInTheDocument();
    // No full-screen toggle: the page is the workspace.
    expect(screen.queryByRole("button", { name: "Full screen" })).not.toBeInTheDocument();

    // The draft kept on this device is back in the editor. (Typing into the
    // editor is checked in a real browser, in e2e's practice.spec.ts: jsdom
    // cannot drive CodeMirror's contenteditable.)
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Code for question 1" })).toHaveTextContent("print(5)"));

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    const results = await screen.findByRole("region", { name: "Submission results" });
    expect(within(results).getByText("Wrong answer")).toBeInTheDocument();
    expect(within(results).getByText(/1\/2 tests passed/)).toBeInTheDocument();
    const submitted = calls.find((c) => c.method === "POST");
    expect(submitted?.body).toEqual({ answer: expect.stringContaining("print(5)"), language: "python" });

    // What is in the editor is shared read-only, at a link the learner can copy.
    routes["POST /practice/nit-practice/problems/sum-of-two/share"] = () => ({ status: 201, body: { id: "AbCdEfGhIjKl", path: "/shares/AbCdEfGhIjKl" } });
    await userEvent.click(screen.getByRole("button", { name: "Share code" }));
    expect(await screen.findByRole("textbox", { name: "Read-only link" })).toHaveValue("http://localhost:3000/practice/nit-practice/shares/AbCdEfGhIjKl");
    expect(calls.find((c) => c.path.endsWith("/share"))?.body).toEqual({ language: "python", source: "print(5)" });
  });
});

describe("contests", () => {
  it("show a scoreboard, marking the learner's own row", async () => {
    routes["GET /practice/nit-practice/contests/weekly-1"] = () => ({
      body: {
        slug: "weekly-1",
        title: "Weekly 1",
        description: "Two problems.",
        startsAt: new Date(Date.now() - 600_000).toISOString(),
        endsAt: new Date(Date.now() + 3_000_000).toISOString(),
        state: "running",
        problems: [
          { label: "A", slug: "stable-sort", title: "Stable sort", difficulty: "easy", status: "solved" },
          { label: "B", slug: "sum-of-two", title: "Sum of two", difficulty: "medium", status: null },
        ],
        scoreboard: [
          { rank: 1, name: "Ravi", solved: 2, penalty: 31, problems: [{ minutes: 5, wrong: 0 }, { minutes: 6, wrong: 1 }], you: false },
          { rank: 2, name: "Asha", solved: 1, penalty: 10, problems: [{ minutes: 10, wrong: 0 }, { minutes: null, wrong: 2 }], you: true },
        ],
      },
    });
    open("/practice/nit-practice/contests/weekly-1");
    expect(await screen.findByRole("heading", { name: "Weekly 1" })).toBeInTheDocument();
    expect(screen.getByText(/^Ends in 00:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stable sort" })).toHaveAttribute("href", "/practice/nit-practice/problems/stable-sort?contest=weekly-1");

    const rows = within(screen.getByRole("region", { name: "Scoreboard" })).getAllByRole("row");
    expect(rows[2]).toHaveTextContent("Asha");
    expect(rows[2]).toHaveClass("you");
    expect(rows[2]).toHaveTextContent("−2");
    expect(rows[1]).toHaveTextContent("+1");
    // Ravi solved each problem first; Asha solved the first one later, and tried the second.
    expect(within(rows[1]!).getAllByRole("cell")[4]).toHaveClass("cell-first");
    expect(within(rows[1]!).getAllByRole("cell")[4]).toHaveTextContent("First to solve: solved at 5 min, after 0 wrong tries");
    expect(within(rows[2]!).getAllByRole("cell")[4]).toHaveClass("cell-ok");
    expect(within(rows[2]!).getAllByRole("cell")[5]).toHaveTextContent("not solved, 2 wrong tries");
    expect(screen.getByText("Live")).toHaveClass("pill", "live");
  });

  it("do not name their problems before they start", async () => {
    routes["GET /practice/nit-practice/contests/weekly-2"] = () => ({
      body: {
        slug: "weekly-2",
        title: "Weekly 2",
        description: "",
        startsAt: new Date(Date.now() + 90_000_000).toISOString(),
        endsAt: new Date(Date.now() + 93_600_000).toISOString(),
        state: "upcoming",
        problems: [],
        scoreboard: [],
      },
    });
    open("/practice/nit-practice/contests/weekly-2");
    expect(await screen.findByText("The problems appear when the contest starts.")).toBeInTheDocument();
    expect(screen.getByText(/^Starts in 1d /)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scoreboard" })).not.toBeInTheDocument();
  });
});

describe("progress", () => {
  it("shows what is solved, the streak and a year's activity, and deletes the account on request", async () => {
    localStorage.setItem("parikshaa.practice.nit-practice.session", "pl_good");
    const today = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    routes["GET /practice/nit-practice/progress"] = () => ({
      body: {
        solved: { easy: 1, medium: 0, hard: 0, total: 1 },
        available: { easy: 1, medium: 1, hard: 0, total: 2 },
        streak: 1,
        longestStreak: 4,
        activeDays: 6,
        days: [{ day: today, accepted: 1, submitted: 3 }],
        recent: [{ slug: "stable-sort", title: "Stable sort", at: "2026-09-24T10:00:00.000Z" }],
        rank: 2,
      },
    });
    let deleted = false;
    routes["DELETE /practice/nit-practice/me"] = () => {
      deleted = true;
      return { body: { ok: true } };
    };
    routes["POST /practice/nit-practice/signout"] = () => ({ body: { ok: true } });
    open("/practice/nit-practice/progress");

    expect(await screen.findByRole("heading", { name: "Asha" })).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText("4 days")).toBeInTheDocument();
    expect(screen.getByText("1 day")).toBeInTheDocument();
    expect(screen.getByText("1-day streak")).toBeInTheDocument();
    // The squares are a picture; the days with activity are also said in words.
    const said = `${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.parse(`${today}T00:00:00Z`))}: 3 submitted, 1 accepted`;
    expect(screen.getByTitle(said)).toHaveClass("l2");
    expect(screen.getByText("Submissions: 3, on 1 of the last 365 days")).toBeInTheDocument();
    expect(screen.getAllByText(said).some((el) => el.tagName === "LI")).toBe(true);
    expect(screen.getByRole("link", { name: "Stable sort" })).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(localStorage.getItem("parikshaa.practice.nit-practice.session")).toBeNull());
  });
});

describe("who a learner is (ROADMAP §15)", () => {
  it("offers Google on the sign-in page when the site has it", async () => {
    routes["GET /practice/nit-practice/sign-in-options"] = () => ({ body: { google: true, requireVerified: false } });
    open("/practice/nit-practice/signin");
    const google = await screen.findByRole("link", { name: "Continue with Google" });
    expect(google).toHaveAttribute("href", "/api/practice/nit-practice/auth/google");
  });

  it("keeps the session Google sent back, and forgets it from the address", async () => {
    open("/practice/nit-practice#session=pl_good");
    expect(window.location.hash).toBe("");
    expect(await screen.findByText("Asha")).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/practice/nit-practice/me" && c.auth === "Bearer pl_good")).toBe(true);
  });

  it("follows a confirmation link once, and says so", async () => {
    routes["POST /practice/nit-practice/verify"] = () => ({ body: { ok: true } });
    open("/practice/nit-practice?verify=l1.abc");
    expect(await screen.findByRole("status")).toHaveTextContent("Your email address is confirmed.");
    expect(calls.find((c) => c.method === "POST" && c.path === "/practice/nit-practice/verify")?.body).toEqual({ token: "l1.abc" });
    expect(window.location.search).toBe("");
  });

  it("asks an unconfirmed learner to confirm, and sends the link again", async () => {
    localStorage.setItem("parikshaa.practice.nit-practice.session", "pl_new");
    routes["GET /practice/nit-practice/me"] = () => ({ body: { id: "l2", name: "Ravi", email: "ravi@example.com", emailVerified: false } });
    routes["GET /practice/nit-practice/sign-in-options"] = () => ({ body: { google: false, requireVerified: true } });
    routes["POST /practice/nit-practice/verify/resend"] = () => ({ status: 202, body: { ok: true } });
    open("/practice/nit-practice");
    expect(await screen.findByText(/Confirm your email address to submit/)).toHaveTextContent("ravi@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send the link again" }));
    expect(await screen.findByText(/Sent. Check your inbox/)).toBeInTheDocument();
  });
});
