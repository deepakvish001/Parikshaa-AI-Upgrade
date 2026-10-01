import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseRoute, PracticeApp } from "./PracticeApp.tsx";
import { prepText, PREP_TABLES } from "./prep-text.ts";

/**
 * The prep pages (ROADMAP §16) in the browser, against a fake of the API:
 * every request the page makes is answered here, and recorded.
 */

type Handler = (init: RequestInit, url: URL) => { status?: number; body: unknown };
let routes: Record<string, Handler>;
let calls: { method: string; path: string; body: unknown }[];

const task = (id: string, title: string, kind: string, done = false, extra: object = {}) => ({
  id,
  day: "2026-10-05",
  sprint: 1,
  kind,
  title,
  estMinutes: 20,
  done,
  movedFrom: null,
  link: null,
  difficulty: null,
  ...extra,
});

const plan = {
  track: { slug: "dsa-basics", title: "DSA Basics" },
  level: "intermediate",
  deadline: "2026-12-31",
  dailyMinutes: 90,
  offDays: [0],
  goal: "",
  startedAt: "2026-10-05T04:00:00Z",
  finishOn: "2026-11-20",
  onTrack: true,
  daysLeft: 87,
  studyDaysLeft: 74,
  done: 1,
  total: 30,
  sprint: 1,
  sprints: [{ sprint: 1, from: "2026-10-05", to: "2026-10-11", tasks: 8, done: 1 }],
  moved: 2,
  today: [
    task("t1", "What an array is", "learn", true, { link: { kind: "lesson", slug: "arrays" } }),
    task("t2", "Two sum", "practice", false, { link: { kind: "problem", slug: "two-sum" }, difficulty: "easy", movedFrom: "2026-10-04" }),
    task("t3", "Update my resume", "custom"),
  ],
  upcoming: [],
  completed: [],
};

const home = {
  name: "Asha Rao",
  today: "2026-10-05",
  streak: 12,
  longestStreak: 20,
  coins: 1240,
  checkin: 1,
  dueCards: 3,
  focusMinutesToday: 45,
  potd: { day: "2026-10-05", slug: "koko", title: "Koko eating bananas", difficulty: "medium", solved: false, solvedThatDay: false },
  plan,
  continue: { slug: "dsa-basics", title: "DSA Basics", items: 30, done: 1, next: { kind: "problem", slug: "two-sum", title: "Two sum" } },
  solved: 57,
};

beforeEach(() => {
  window.scrollTo = () => undefined;
  calls = [];
  localStorage.clear();
  localStorage.setItem("parikshaa.practice.nit-practice.session", "pl_good");
  routes = {
    "GET /practice/nit-practice": () => ({ body: { slug: "nit-practice", title: "NIT Practice", welcome: "" } }),
    "GET /practice/nit-practice/me": () => ({ body: { id: "l1", name: "Asha Rao", email: "asha@example.com", emailVerified: true } }),
    "GET /practice/nit-practice/home": () => ({ body: home }),
    "GET /practice/nit-practice/plan": () => ({ body: { plan } }),
    "GET /practice/nit-practice/focus": () => ({ body: { days: [{ day: "2026-10-05", minutes: 45 }] } }),
    "GET /practice/nit-practice/tracks": () => ({ body: { tracks: [{ slug: "dsa-basics", title: "DSA Basics", description: "", modules: 2, items: 30, done: 1 }] } }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, "http://localhost");
      const path = decodeURIComponent(url.pathname.replace(/^\/api/, ""));
      const method = init.method ?? "GET";
      calls.push({ method, path, body: init.body === undefined ? undefined : JSON.parse(String(init.body)) });
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
  it("name the prep pages", () => {
    expect(parseRoute("/practice/nit-practice/home", "")).toEqual({ page: "home" });
    expect(parseRoute("/practice/nit-practice/tracks/dsa", "")).toEqual({ page: "track", slug: "dsa" });
    expect(parseRoute("/practice/nit-practice/lessons/arrays", "")).toEqual({ page: "lesson", slug: "arrays" });
    expect(parseRoute("/practice/nit-practice/plan", "?track=dsa")).toEqual({ page: "plan", track: "dsa" });
    expect(parseRoute("/practice/nit-practice/revise", "")).toEqual({ page: "revise" });
  });
});

describe("the words", () => {
  it("are all in Hindi too, with the same placeholders", () => {
    for (const key of Object.keys(PREP_TABLES.en) as (keyof typeof PREP_TABLES.en)[]) {
      const names = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(names(PREP_TABLES.hi[key]), key).toEqual(names(PREP_TABLES.en[key]));
    }
    expect(prepText("hi", "home.streak", { n: 3 })).toBe("3 दिन की लगातार पढ़ाई");
    expect(prepText("ta", "home.streak", { n: 3 })).toBe("3-day streak");
  });
});

describe("the dashboard", () => {
  it("puts today's plan first, with the streak, coins, the day's problem and revision", async () => {
    open("/practice/nit-practice/home");
    expect(await screen.findByRole("heading", { name: "Namaste, Asha" })).toBeTruthy();
    expect(screen.getByText("12-day streak")).toBeTruthy();
    expect(screen.getByText("1,240 coins")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("+1 coin");
    const today = screen.getByRole("region", { name: "Today's plan" });
    expect(within(today).getByText("1 of 3 done · 60 min")).toBeTruthy();
    expect(within(today).getByText("2 unfinished tasks were moved on to the days ahead.")).toBeTruthy();
    expect(within(today).getByRole("link", { name: "Two sum" }).getAttribute("href")).toBe("/practice/nit-practice/problems/two-sum");
    expect(within(today).getByText(/moved from/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Solve it" }).getAttribute("href")).toBe("/practice/nit-practice/problems/koko");
    expect(screen.getByText("3 problems due for revision")).toBeTruthy();
  });

  it("asks a learner without a plan to make one", async () => {
    routes["GET /practice/nit-practice/home"] = () => ({ body: { ...home, plan: null, checkin: 0 } });
    open("/practice/nit-practice/home");
    expect((await screen.findByRole("link", { name: /Make my plan/ })).getAttribute("href")).toBe("/practice/nit-practice/plan");
  });

  it("is not shown to a visitor", async () => {
    localStorage.clear();
    routes["GET /practice/nit-practice/me"] = () => ({ status: 401, body: { error: "sign_in_required" } });
    open("/practice/nit-practice/home");
    expect(await screen.findByText(/Sign in to see/)).toBeTruthy();
    expect(calls.some((c) => c.path.endsWith("/home"))).toBe(false);
  });
});

describe("the plan", () => {
  it("previews a plan, offers the minutes that would fit, and starts it", async () => {
    routes["GET /practice/nit-practice/plan"] = () => ({ body: { plan: null } });
    let previews = 0;
    routes["POST /practice/nit-practice/plan/preview"] = (init) => {
      previews++;
      const body = JSON.parse(String(init.body)) as { dailyMinutes: number };
      const fits = body.dailyMinutes >= 150;
      return {
        body: {
          track: { slug: "dsa-basics", title: "DSA Basics" },
          tasks: 29,
          totalMinutes: 1200,
          finishOn: fits ? "2026-12-20" : "2027-02-01",
          deadline: "2026-12-31",
          fits,
          sprints: [{ sprint: 1, from: "2026-10-05", to: "2026-10-11", tasks: 8, done: 0 }],
          dailyMinutesToFit: fits ? null : 150,
        },
      };
    };
    routes["POST /practice/nit-practice/plan"] = () => ({ status: 201, body: { plan } });
    const user = userEvent.setup();
    open("/practice/nit-practice/plan?track=dsa-basics");
    await screen.findByRole("heading", { name: "Plan a track" });
    await user.click(screen.getByRole("button", { name: "Show the plan" }));
    expect(await screen.findByText(/after your deadline/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Study 150 minutes a day/ }));
    await user.click(screen.getByRole("button", { name: "Show the plan" }));
    expect(await screen.findByText(/It fits/)).toBeTruthy();
    expect(previews).toBe(2);
    await user.click(screen.getByRole("button", { name: "Start this plan" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.path === "/practice/nit-practice/plan")).toBe(true));
    const started = calls.find((c) => c.method === "POST" && c.path === "/practice/nit-practice/plan")!.body as { track: string; dailyMinutes: number; offDays: number[] };
    expect(started).toMatchObject({ track: "dsa-basics", dailyMinutes: 150, offDays: [0] });
  });

  it("ticks a task of the learner's own; a problem's task is done by solving it", async () => {
    routes["PUT /practice/nit-practice/plan/tasks/t3"] = () => ({ body: { ok: true } });
    const user = userEvent.setup();
    open("/practice/nit-practice/plan");
    await screen.findByRole("heading", { name: "Study plan: DSA Basics" });
    expect(screen.queryByRole("checkbox", { name: "Two sum" })).toBeNull();
    await user.click(screen.getByRole("checkbox", { name: "Update my resume" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ done: true }));
  });
});

describe("the daily reminder", () => {
  it("is turned on from the plan, at the hour chosen", async () => {
    let saved: unknown = null;
    routes["GET /practice/nit-practice/reminders"] = () => ({ body: { enabled: false, hour: 19, email: true } });
    routes["PUT /practice/nit-practice/reminders"] = (init) => {
      saved = JSON.parse(String(init.body));
      return { body: saved };
    };
    const user = userEvent.setup();
    open("/practice/nit-practice/plan");
    await user.click(await screen.findByRole("checkbox", { name: /Email me when today's tasks are not done/ }));
    await waitFor(() => expect(saved).toEqual({ enabled: true, hour: 19 }));
    await user.selectOptions(screen.getByRole("combobox", { name: /At/ }), "7");
    await waitFor(() => expect(saved).toEqual({ enabled: true, hour: 7 }));
  });

  it("is not offered where the server cannot send email", async () => {
    routes["GET /practice/nit-practice/reminders"] = () => ({ body: { enabled: false, hour: 19, email: false } });
    open("/practice/nit-practice/plan");
    await screen.findByRole("heading", { name: "Study plan: DSA Basics" });
    expect(screen.queryByRole("heading", { name: "Daily reminder" })).toBeNull();
  });

  it("is turned off by the link in its email, without signing in", async () => {
    localStorage.clear();
    routes["POST /practice/nit-practice/reminders/off"] = () => ({ body: { off: true } });
    open("/practice/nit-practice/reminders?off=l1.abc");
    expect(await screen.findByText(/Daily reminders are off/)).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/reminders/off"))!.body).toEqual({ token: "l1.abc" });
  });
});

describe("revision", () => {
  it("shows the note on request and sends how it went", async () => {
    routes["GET /practice/nit-practice/revise"] = () => ({
      body: {
        due: [{ slug: "two-sum", title: "Two sum", difficulty: "easy", tags: ["hashing"], dueOn: "2026-10-05", lastReviewedAt: null, reps: 0, note: "Store **index** by value." }],
        later: 0,
        upcoming: 4,
      },
    });
    routes["POST /practice/nit-practice/revise/two-sum"] = () => ({ body: { dueOn: "2026-10-08", intervalDays: 3 } });
    const user = userEvent.setup();
    open("/practice/nit-practice/revise");
    await screen.findByRole("link", { name: "Two sum" });
    await user.click(screen.getByRole("button", { name: "Show my note" }));
    expect(screen.getByText("index")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Good" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ grade: "good" }));
    expect(await screen.findByText("Next in 3 days")).toBeTruthy();
  });
});

describe("tracks", () => {
  it("opens the first unfinished module and links each item", async () => {
    routes["GET /practice/nit-practice/tracks/dsa-basics"] = () => ({
      body: {
        slug: "dsa-basics",
        title: "DSA Basics",
        description: "Start **here**.",
        items: 3,
        done: 1,
        modules: [
          { title: "Arrays", done: 1, items: [{ kind: "lesson", slug: "arrays", title: "What an array is", difficulty: null, estMinutes: 15, status: "done" }] },
          { title: "Searching", done: 0, items: [{ kind: "problem", slug: "binary-search", title: "Binary search", difficulty: "medium", estMinutes: 40, status: null }] },
        ],
      },
    });
    const user = userEvent.setup();
    open("/practice/nit-practice/tracks/dsa-basics");
    const link = await screen.findByRole("link", { name: "Binary search" });
    expect(link.getAttribute("href")).toBe("/practice/nit-practice/problems/binary-search");
    expect(screen.queryByRole("link", { name: "What an array is" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /1\. Arrays/ }));
    expect(screen.getByRole("link", { name: "What an array is" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Plan this track/ }).getAttribute("href")).toBe("/practice/nit-practice/plan?track=dsa-basics");
  });
});

describe("Sahayak on a problem", () => {
  const mcq = {
    slug: "stable-sort",
    title: "Stable sort",
    difficulty: "easy",
    tags: [],
    question: { id: "p1", kind: "mcq", stem: "Which sort is stable?", maxScore: 1, options: ["quick", "merge"] },
    editorial: null,
    editorialLocked: false,
    acceptance: null,
    solvedBy: 0,
    status: null,
    contest: null,
  };

  it("gives the next hint for its credits, and says where to get more when they run out", async () => {
    routes["GET /practice/nit-practice/problems/stable-sort"] = () => ({ body: mcq });
    routes["GET /practice/nit-practice/problems/stable-sort/comments"] = () => ({ body: { comments: [] } });
    routes["GET /practice/nit-practice/lists"] = () => ({ body: { lists: [{ name: "Bookmarks", solved: 0, problems: [] }] } });
    let entries: object[] = [];
    routes["GET /practice/nit-practice/problems/stable-sort/tutor"] = () => ({
      body: { entries, nextHint: { level: entries.length + 1, credits: entries.length === 0 ? 10 : 20, available: true }, failures: 0, costs: { hint1: 10, hint: 20, review: 40, doubt: 15 } },
    });
    routes["GET /practice/nit-practice/credits"] = () => ({ body: { balance: 25, history: [] } });
    routes["POST /practice/nit-practice/problems/stable-sort/tutor/hint"] = () => {
      if (entries.length === 1) return { status: 402, body: { error: "no_credits", message: "Not enough credits for that." } };
      const answer = { id: "a1", mode: "hint", hintLevel: 1, answer: "Think about **equal keys**.", credits: 10, createdAt: "2026-10-05T04:00:00Z", question: "" };
      entries = [answer];
      return { body: answer };
    };
    const user = userEvent.setup();
    open("/practice/nit-practice/problems/stable-sort");
    await user.click(await screen.findByRole("tab", { name: "Sahayak" }));
    await user.click(await screen.findByRole("button", { name: "Hint 1 · 10 credits" }));
    expect(await screen.findByText("equal keys")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/tutor/hint"))!.body).toEqual({ replyIn: "en" });
    await user.click(await screen.findByRole("button", { name: "Hint 2 · 20 credits" }));
    expect(await screen.findByText(/Not enough credits/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Get credits" })).toBeTruthy();
  });

  it("says so when the first hint is free: the problem's author wrote it", async () => {
    routes["GET /practice/nit-practice/problems/stable-sort"] = () => ({ body: mcq });
    routes["GET /practice/nit-practice/problems/stable-sort/comments"] = () => ({ body: { comments: [] } });
    routes["GET /practice/nit-practice/lists"] = () => ({ body: { lists: [{ name: "Bookmarks", solved: 0, problems: [] }] } });
    routes["GET /practice/nit-practice/problems/stable-sort/tutor"] = () => ({
      body: { entries: [], nextHint: { level: 1, credits: 0, available: true }, failures: 0, costs: { hint1: 10, hint: 20, review: 40, doubt: 15 } },
    });
    routes["GET /practice/nit-practice/credits"] = () => ({ body: { balance: 25, history: [] } });
    const user = userEvent.setup();
    open("/practice/nit-practice/problems/stable-sort");
    await user.click(await screen.findByRole("tab", { name: "Sahayak" }));
    expect(await screen.findByRole("button", { name: "Hint 1 · free" })).toBeTruthy();
  });
});

describe("Plus", () => {
  it("buys a plan through Checkout and confirms what Checkout hands back", async () => {
    routes["GET /practice/nit-practice/plus"] = () => ({
      body: {
        enabled: true,
        active: false,
        until: null,
        freeModules: 1,
        monthlyCredits: 100,
        tutor: true,
        checkout: true,
        invoices: true,
        products: [{ id: "pr1", title: "Plus, 3 months", kind: "plus", days: 90, credits: 1000, pricePaise: 99_900, taxPaise: 15_239 }],
      },
    });
    routes["GET /practice/nit-practice/credits"] = () => ({ body: { balance: 100, history: [{ delta: 100, reason: "monthly", at: "2026-10-05T04:00:00Z" }] } });
    routes["GET /practice/nit-practice/orders"] = () => ({ body: { orders: [] } });
    routes["POST /practice/nit-practice/plus/checkout"] = () => ({
      status: 201,
      body: { keyId: "rzp_test", orderId: "order_1", amountPaise: 99_900, title: "Plus, 3 months", learner: { name: "Asha Rao", email: "asha@example.com" } },
    });
    routes["POST /practice/nit-practice/plus/confirm"] = () => ({ body: { order: { status: "paid" }, plus: { active: true, until: "2027-01-03T04:00:00Z" } } });
    let opened: Record<string, unknown> | null = null;
    // Checkout, standing in: it pays at once and hands back what Razorpay would.
    class FakeCheckout {
      constructor(readonly options: Record<string, unknown>) {
        opened = options;
      }
      on() {}
      open() {
        (this.options["handler"] as (r: object) => void)({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig" });
      }
    }
    (window as { Razorpay?: unknown }).Razorpay = FakeCheckout;
    const user = userEvent.setup();
    open("/practice/nit-practice/plus");
    expect(await screen.findByText("₹999")).toBeTruthy();
    expect(screen.getByText("90 days of Plus")).toBeTruthy();
    expect(screen.getByText("₹846.61 + ₹152.39 GST (18%)")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Buy for ₹999" }));
    expect(await screen.findByText("Paid. Thank you!")).toBeTruthy();
    expect(opened).toMatchObject({ key: "rzp_test", order_id: "order_1", amount: 99_900 });
    expect(calls.find((c) => c.path.endsWith("/plus/confirm"))!.body).toEqual({ orderId: "order_1", paymentId: "pay_1", signature: "sig" });
    delete (window as { Razorpay?: unknown }).Razorpay;
  });

  it("takes the coupon an affiliate's link brought, prices every plan with it, and buys with it and the invoice details", async () => {
    routes["GET /practice/nit-practice/plus"] = () => ({
      body: {
        enabled: true,
        active: false,
        until: null,
        freeModules: 1,
        monthlyCredits: 100,
        tutor: true,
        checkout: true,
        invoices: true,
        products: [{ id: "pr1", title: "Plus, 3 months", kind: "plus", days: 90, credits: 1000, pricePaise: 99_900, taxPaise: 15_239 }],
      },
    });
    routes["GET /practice/nit-practice/credits"] = () => ({ body: { balance: 100, history: [] } });
    routes["GET /practice/nit-practice/orders"] = () => ({ body: { orders: [] } });
    routes["POST /practice/nit-practice/plus/quote"] = (init) => {
      const { coupon } = JSON.parse(String(init.body)) as { coupon: string };
      return coupon === "LAUNCH20"
        ? { body: { productId: "pr1", title: "Plus, 3 months", listPaise: 99_900, discountPaise: 19_980, pricePaise: 79_920, taxPaise: 12_191, coupon: "LAUNCH20" } }
        : { status: 422, body: { error: "coupon_invalid", message: "That coupon code is not valid" } };
    };
    routes["POST /practice/nit-practice/plus/checkout"] = () => ({ status: 201, body: { keyId: "rzp_test", orderId: "order_1", amountPaise: 79_920, title: "Plus, 3 months", learner: { name: "Asha Rao", email: "asha@example.com" } } });
    routes["POST /practice/nit-practice/plus/confirm"] = () => ({ body: { order: { status: "paid" }, plus: { active: true, until: "2027-01-03T04:00:00Z" } } });
    class FakeCheckout {
      constructor(readonly options: Record<string, unknown>) {}
      on() {}
      open() {
        (this.options["handler"] as (r: object) => void)({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "sig" });
      }
    }
    (window as { Razorpay?: unknown }).Razorpay = FakeCheckout;
    const user = userEvent.setup();
    open("/practice/nit-practice/plus?ref=launch20");
    expect(await screen.findByText("You save ₹199.80")).toBeTruthy();
    // The link's code is kept for checkout, and taken out of the address.
    expect(window.location.search).toBe("");
    expect(screen.getByRole("textbox", { name: /Have a coupon/ })).toHaveProperty("value", "LAUNCH20");
    await user.selectOptions(screen.getByLabelText("Your state"), "27");
    await user.click(screen.getByRole("button", { name: "Buy for ₹799.20" }));
    expect(await screen.findByText("Paid. Thank you!")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/plus/checkout"))!.body).toEqual({ productId: "pr1", coupon: "LAUNCH20", stateCode: "27" });
    // Used: not offered again.
    expect(localStorage.getItem("parikshaa.ref.nit-practice")).toBeNull();

    // A code no plan takes says why.
    await user.clear(screen.getByRole("textbox", { name: /Have a coupon/ }));
    await user.type(screen.getByRole("textbox", { name: /Have a coupon/ }), "nope1");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("That coupon code is not valid")).toBeTruthy();
    delete (window as { Razorpay?: unknown }).Razorpay;
  });

  it("lists each order with its invoice, and opens the invoice to print", async () => {
    routes["GET /practice/nit-practice/plus"] = () => ({ body: { enabled: true, active: true, until: "2027-01-03T04:00:00Z", freeModules: 1, monthlyCredits: 100, tutor: true, checkout: true, invoices: true, products: [] } });
    routes["GET /practice/nit-practice/credits"] = () => ({ body: { balance: 100, history: [] } });
    routes["GET /practice/nit-practice/orders"] = () => ({
      body: {
        orders: [
          { id: "o1", title: "Plus, 3 months", days: 90, credits: 1000, listPaise: 99_900, coupon: "LAUNCH20", discountPaise: 19_980, amountPaise: 79_920, taxPaise: 12_191, status: "paid", createdAt: "2026-10-05T04:00:00Z", paidAt: "2026-10-05T04:01:00Z", invoice: "PKP/2627/000001" },
        ],
      },
    });
    routes["GET /practice/nit-practice/invoices/PKP/2627/000001"] = () => ({
      body: {
        number: "PKP/2627/000001",
        issuedAt: "2026-10-05T04:01:00Z",
        document: {
          title: "Tax Invoice",
          number: "PKP/2627/000001",
          date: "5 Oct 2026",
          supplier: { legalName: "Parikshaa Assessments Pvt Ltd", gstin: "29AAGCP4401A1ZW", address: "12 Residency Road, Bengaluru 560025", state: "Karnataka", sac: "998399" },
          buyer: { legalName: "Asha Rao", gstin: null, state: "Maharashtra" },
          placeOfSupply: { code: "27", state: "Maharashtra" },
          lines: [{ description: "Plus, 3 months: Plus for 90 days and 1000 AI credits", quantity: 1, sac: "998399", amountPaise: 67_729 }],
          taxablePaise: 67_729,
          taxes: [{ name: "IGST", ratePercent: 18, amountPaise: 12_191 }],
          totalPaise: 79_920,
          totalInWords: "Rupees Seven Hundred Ninety Nine and Twenty Paise Only",
          note: "Coupon LAUNCH20: ₹199.80 off the list price of ₹999.00.",
        },
      },
    });
    const user = userEvent.setup();
    open("/practice/nit-practice/plus");
    expect(await screen.findByText(/coupon LAUNCH20, ₹199.80 off/)).toBeTruthy();
    await user.click(screen.getByRole("link", { name: /Invoice PKP\/2627\/000001/ }));
    const invoice = await screen.findByRole("article", { name: "Tax Invoice PKP/2627/000001" });
    expect(invoice.textContent).toContain("IGST @ 18%");
    expect(invoice.textContent).toContain("₹799.20");
    expect(invoice.textContent).toContain("Rupees Seven Hundred Ninety Nine and Twenty Paise Only");
    expect(screen.getByRole("button", { name: /Print or save as PDF/ })).toBeTruthy();
  });

  it("shows a locked lesson by name, with the way to Plus", async () => {
    routes["GET /practice/nit-practice/lessons/heaps"] = () => ({ body: { slug: "heaps", title: "Heaps", body: "", videoUrl: null, estMinutes: 20, done: false, locked: true } });
    open("/practice/nit-practice/lessons/heaps");
    expect(await screen.findByText("This lesson comes with Plus.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /See Plus/ }).getAttribute("href")).toBe("/practice/nit-practice/plus");
    expect(screen.queryByRole("button", { name: "Mark as done" })).toBeNull();
  });
});
