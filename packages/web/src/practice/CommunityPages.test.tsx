import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMUNITY_TABLES, communityText } from "./community-text.ts";
import { parseRoute, PracticeApp } from "./PracticeApp.tsx";

/**
 * Companies, interview experiences, the coin store and ratings (ROADMAP §16)
 * in the browser, against a fake of the API that records every request.
 */

type Handler = (init: RequestInit, url: URL) => { status?: number; body: unknown };
let routes: Record<string, Handler>;
let calls: { method: string; path: string; search: string; body: unknown }[];

const experience = {
  id: "e1",
  company: { slug: "acme", name: "Acme" },
  role: "SDE 1",
  interviewed: "2026-08",
  verdict: "offer",
  rounds: [{ kind: "DSA", asked: "Two sum, then three sum.", problemSlugs: ["two-sum"] }],
  tips: "Say the brute force first.",
  author: "Anonymous",
  status: "published",
  votes: 4,
  voted: false,
  mine: false,
  at: "2026-09-01T00:00:00Z",
};

beforeEach(() => {
  window.scrollTo = () => undefined;
  calls = [];
  localStorage.clear();
  localStorage.setItem("parikshaa.practice.nit-practice.session", "pl_good");
  routes = {
    "GET /practice/nit-practice": () => ({ body: { slug: "nit-practice", title: "NIT Practice", welcome: "" } }),
    "GET /practice/nit-practice/me": () => ({ body: { id: "l1", name: "Asha Rao", email: "asha@example.com", emailVerified: true } }),
    "GET /practice/nit-practice/companies": () => ({ body: { companies: [{ slug: "acme", name: "Acme", problems: 12, experiences: 3 }] } }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, "http://localhost");
      const path = decodeURIComponent(url.pathname.replace(/^\/api/, ""));
      const method = init.method ?? "GET";
      calls.push({ method, path, search: url.search, body: init.body === undefined ? undefined : JSON.parse(String(init.body)) });
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
  it("name the community pages", () => {
    expect(parseRoute("/practice/nit-practice/companies", "")).toEqual({ page: "companies" });
    expect(parseRoute("/practice/nit-practice/companies/acme", "")).toEqual({ page: "company", slug: "acme" });
    expect(parseRoute("/practice/nit-practice/experiences", "?company=acme")).toEqual({ page: "experiences", company: "acme" });
    expect(parseRoute("/practice/nit-practice/store", "")).toEqual({ page: "store" });
    expect(parseRoute("/practice/nit-practice/rating", "")).toEqual({ page: "rating" });
  });
});

describe("a company", () => {
  it("shows what it asks in a window, the topics, and what Plus would show", async () => {
    routes["GET /practice/nit-practice/companies/acme"] = (_init, url) => ({
      body: {
        slug: "acme",
        name: "Acme",
        about: "",
        window: url.searchParams.get("window"),
        counts: { "30": 2, "60": 5, "180": 7, all: 9 },
        problems: [
          { slug: "two-sum", title: "Two sum", difficulty: "easy", tags: ["arrays"], times: 4, lastAsked: "2026-09-20", solved: true },
          { slug: "lru", title: "LRU cache", difficulty: "medium", tags: ["design"], times: 2, lastAsked: "2026-09-01", solved: false },
        ],
        locked: 3,
        topics: [
          { tag: "arrays", problems: 1 },
          { tag: "design", problems: 1 },
        ],
        difficulty: { easy: 1, medium: 1, hard: 0 },
        experiences: [experience],
      },
    });
    const user = userEvent.setup();
    open("/practice/nit-practice/companies");
    await user.click(await screen.findByRole("link", { name: /Acme/ }));
    expect(await screen.findByRole("heading", { name: "Acme", level: 1 })).toBeTruthy();
    expect(screen.getByText("Asked 4×")).toBeTruthy();
    expect(screen.getByText("3 more with Plus")).toBeTruthy();
    expect(calls.find((c) => c.path === "/practice/nit-practice/companies/acme")!.search).toBe("?window=60");
    await user.click(screen.getByRole("radio", { name: /30 days/ }));
    await waitFor(() => expect(calls.some((c) => c.search === "?window=30")).toBe(true));
    expect(screen.getByRole("article", { name: "Acme, SDE 1" })).toBeTruthy();
  });
});

describe("interview experiences", () => {
  it("are voted helpful, and written up for staff to read", async () => {
    routes["GET /practice/nit-practice/experiences"] = () => ({ body: { experiences: [experience] } });
    routes["PUT /practice/nit-practice/experiences/e1/vote"] = () => ({ body: {} });
    routes["POST /practice/nit-practice/experiences"] = (init) => ({ status: 201, body: { ...experience, ...JSON.parse(String(init.body)), id: "e2", status: "pending", mine: true } });
    const user = userEvent.setup();
    open("/practice/nit-practice/experiences");
    await user.click(await screen.findByRole("button", { name: "Helpful · 4" }));
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && c.path.endsWith("/e1/vote"))).toBe(true));

    await user.click(screen.getByRole("button", { name: /Share an interview/ }));
    const form = await screen.findByRole("form", { name: "Share an interview" });
    await user.type(within(form).getByLabelText("Role"), "SDE Intern");
    await user.type(within(form).getByLabelText("Round"), "Online test");
    await user.type(within(form).getByLabelText("What was asked"), "Two DSA questions.");
    await user.type(within(form).getByLabelText(/Problems on this site/), "two-sum, lru");
    await user.click(within(form).getByLabelText("Publish without my name"));
    await user.click(within(form).getByRole("button", { name: "Send for review" }));
    expect(await screen.findByText(/Staff will read it/)).toBeTruthy();
    const sent = calls.find((c) => c.method === "POST" && c.path === "/practice/nit-practice/experiences")!.body as Record<string, unknown>;
    expect(sent).toMatchObject({ company: "acme", role: "SDE Intern", verdict: "offer", anonymous: true, rounds: [{ kind: "Online test", asked: "Two DSA questions.", problemSlugs: ["two-sum", "lru"] }] });
  });
});

describe("the coin store", () => {
  it("spends coins on an item, asking where to send a posted one", async () => {
    let balance = 500;
    routes["GET /practice/nit-practice/store"] = () => ({
      body: {
        balance,
        opensAt: null,
        items: [
          { id: "i1", title: "Plus, a week", description: "", kind: "plus", plusDays: 7, priceCoins: 300, soldOut: false, left: null, bought: 0, perLearner: 3 },
          { id: "i2", title: "T-shirt", description: "Cotton.", kind: "physical", plusDays: 0, priceCoins: 400, soldOut: false, left: 4, bought: 0, perLearner: 1 },
          { id: "i3", title: "Laptop stickers", description: "", kind: "digital", plusDays: 0, priceCoins: 900, soldOut: false, left: null, bought: 0, perLearner: 1 },
        ],
        orders: [],
      },
    });
    routes["POST /practice/nit-practice/store/i2/redeem"] = () => {
      balance = 100;
      return { status: 201, body: { order: { id: "o1", title: "T-shirt", priceCoins: 400, status: "placed", note: "", createdAt: "2026-10-01T00:00:00Z", closedAt: null }, balance } };
    };
    const user = userEvent.setup();
    open("/practice/nit-practice/store");
    const tee = await screen.findByRole("article", { name: "T-shirt" });
    expect(within(screen.getByRole("article", { name: "Laptop stickers" })).getByRole("button", { name: /Buy/ })).toHaveProperty("disabled", true);
    await user.click(within(tee).getByRole("button", { name: /Buy · 400/ }));
    await user.type(within(tee).getByLabelText("Postal address"), "12 MG Road, Pune 411001");
    await user.click(within(tee).getByRole("button", { name: "Spend 400 coins" }));
    expect(await screen.findByText("Done. 100 coins left.")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({ address: "12 MG Road, Pune 411001" });
  });

  it("says when a new account may spend", async () => {
    routes["GET /practice/nit-practice/store"] = () => ({ body: { balance: 40, opensAt: "2026-10-20T00:00:00Z", items: [], orders: [] } });
    open("/practice/nit-practice/store");
    expect(await screen.findByText(/opens to new accounts after 14 days/)).toBeTruthy();
  });
});

describe("rating", () => {
  it("shows the learner's rating, history and achievements beside the table", async () => {
    routes["GET /practice/nit-practice/rating"] = () => ({
      body: {
        board: [
          { rank: 1, name: "Asha Rao", rating: 1564, title: "Coder", contests: 2, you: true },
          { rank: 2, name: "Ravi", rating: 1480, title: "Learner", contests: 2, you: false },
        ],
        me: {
          rating: 1564,
          title: "Coder",
          contests: 2,
          history: [
            { contest: "Weekly 1", slug: "weekly-1", rank: 2, field: 5, before: 1500, after: 1520, at: "2026-09-01T00:00:00Z" },
            { contest: "Weekly 2", slug: "weekly-2", rank: 1, field: 6, before: 1520, after: 1564, at: "2026-09-08T00:00:00Z" },
          ],
          achievements: [
            { id: "first_contest", have: 1, need: 1, earned: true },
            { id: "solved_50", have: 12, need: 50, earned: false },
          ],
        },
      },
    });
    open("/practice/nit-practice/rating");
    const badge = await screen.findByLabelText("Your rating");
    expect(badge.textContent).toContain("1564");
    expect(screen.getByText("1564 (+44)")).toBeTruthy();
    expect(screen.getByText("12/50")).toBeTruthy();
    expect(screen.getByText("First contest").closest("li")!.className).toBe("earned");
  });
});

describe("the words", () => {
  it("are all in Hindi too, with the same placeholders", () => {
    for (const k of Object.keys(COMMUNITY_TABLES.en) as (keyof typeof COMMUNITY_TABLES.en)[]) {
      const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(names(COMMUNITY_TABLES.hi[k]), k).toEqual(names(COMMUNITY_TABLES.en[k]));
    }
    expect(communityText("hi", "company.times", { n: 3 })).toBe("3 बार पूछा गया");
  });
});
