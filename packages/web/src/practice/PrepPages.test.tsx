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
  frozenToday: false,
  freezesLeft: 2,
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

  it("says how ready the learner is for each company they aim for", async () => {
    routes["GET /practice/nit-practice/companies/targets"] = () => ({ body: { targets: [{ slug: "acme", name: "Acme", readiness: { solved: 12, of: 50, percent: 24 } }] } });
    open("/practice/nit-practice/home");
    const card = await screen.findByRole("region", { name: "Your target companies" });
    expect(within(card).getByRole("link", { name: "Acme" }).getAttribute("href")).toBe("/practice/nit-practice/companies/acme");
    expect(within(card).getByText("24% ready (12/50)")).toBeTruthy();
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

  it("suggests a level from the placement quiz, and plans with it", async () => {
    routes["GET /practice/nit-practice/plan"] = () => ({ body: { plan: null } });
    const questions = Array.from({ length: 8 }, (_, i) => ({ id: `q${i}`, level: i < 3 ? "easy" : i < 6 ? "medium" : "hard", topic: "Arrays", text: `Question ${i + 1}?`, options: ["A", "B", "C", "D"] }));
    routes["GET /practice/nit-practice/placement"] = () => ({ body: { questions } });
    routes["POST /practice/nit-practice/placement"] = (init) => {
      const { answers } = JSON.parse(String(init.body)) as { answers: { id: string; choice: number }[] };
      const results = answers.map((a) => ({ id: a.id, choice: a.choice, correct: 1, right: a.choice === 1, why: "Because." }));
      return { body: { score: results.filter((r) => r.right).length, of: 8, level: "intermediate", results } };
    };
    let previewed: { level?: string } = {};
    routes["POST /practice/nit-practice/plan/preview"] = (init) => {
      previewed = JSON.parse(String(init.body)) as { level: string };
      return { body: { track: { slug: "dsa-basics", title: "DSA Basics" }, tasks: 10, totalMinutes: 600, finishOn: "2026-12-20", deadline: "2026-12-31", fits: true, sprints: [], dailyMinutesToFit: null } };
    };
    const user = userEvent.setup();
    open("/practice/nit-practice/plan?track=dsa-basics");
    const take = await screen.findByRole("link", { name: "Not sure? Take an 8-question quiz" });
    expect(take.getAttribute("href")).toBe("/practice/nit-practice/placement?track=dsa-basics");
    await user.click(take);
    await screen.findByRole("heading", { name: "Where should your plan start?" });
    const mark = screen.getByRole("button", { name: "See how I did" });
    for (let i = 0; i < 8; i++) {
      expect((mark as HTMLButtonElement).disabled).toBe(true);
      const group = screen.getByRole("group", { name: new RegExp(`Question ${i + 1}\\?`) });
      await user.click(within(group).getByRole("radio", { name: i < 5 ? "B" : "C" }));
    }
    await user.click(mark);
    const result = await screen.findByRole("status", { name: "Your result" });
    expect(within(result).getByText("5 of 8 right")).toBeTruthy();
    expect(screen.getAllByText(/The answer is “B”\. Because\./)).toHaveLength(3);
    const plan = within(result).getByRole("link", { name: /Plan with this level/ });
    expect(plan.getAttribute("href")).toBe("/practice/nit-practice/plan?level=intermediate&track=dsa-basics");
    await user.click(plan);
    expect(await screen.findByText("The quiz suggests: Intermediate: know the basics")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show the plan" }));
    await waitFor(() => expect(previewed.level).toBe("intermediate"));
    expect(parseRoute("/practice/nit-practice/plan", "?level=advanced")).toEqual({ page: "plan", track: undefined, level: "advanced" });
    expect(parseRoute("/practice/nit-practice/plan", "?level=wizard")).toEqual({ page: "plan", track: undefined });
  });

  it("offers three ways when a plan does not fit, and plans only what fits when that is the one chosen", async () => {
    routes["GET /practice/nit-practice/plan"] = () => ({ body: { plan: null } });
    const sent: Record<string, unknown>[] = [];
    routes["POST /practice/nit-practice/plan/preview"] = (init) => {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      sent.push(body);
      const fits = body["upTo"] === 12;
      return {
        body: {
          track: { slug: "dsa-basics", title: "DSA Basics" },
          tasks: fits ? 12 : 29,
          totalMinutes: 1200,
          finishOn: fits ? "2026-12-20" : "2027-02-01",
          deadline: "2026-12-31",
          fits,
          sprints: [],
          dailyMinutesToFit: fits ? null : 150,
          itemsThatFit: fits ? null : { items: 12, of: 29 },
        },
      };
    };
    routes["POST /practice/nit-practice/plan"] = () => ({ status: 201, body: { plan } });
    const user = userEvent.setup();
    open("/practice/nit-practice/plan?track=dsa-basics");
    await screen.findByRole("heading", { name: "Plan a track" });
    await user.type(screen.getByLabelText("Minutes on Saturday and Sunday"), "240");
    await user.click(screen.getByRole("button", { name: "Show the plan" }));
    expect(await screen.findByText("Three ways to fit it:")).toBeTruthy();
    expect(sent[0]).toMatchObject({ weekendMinutes: 240 });
    expect(screen.getByRole("button", { name: /Study 150 minutes a day/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Finish by .* instead/ })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Plan the first 12 of 29 items" }));
    expect(screen.getByRole("status").textContent).toContain("Only the first 12 items will be planned");
    await user.click(screen.getByRole("button", { name: "Show the plan" }));
    expect(await screen.findByText(/It fits/)).toBeTruthy();
    expect(sent[1]).toMatchObject({ upTo: 12 });
    await user.click(screen.getByRole("button", { name: "Start this plan" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST" && c.path === "/practice/nit-practice/plan")!.body).toMatchObject({ upTo: 12, weekendMinutes: 240 }));
  });

  it("changes a running plan's deadline and minutes", async () => {
    routes["PATCH /practice/nit-practice/plan"] = () => ({ body: { plan: { ...plan, dailyMinutes: 90, weekendMinutes: 180 } } });
    const user = userEvent.setup();
    open("/practice/nit-practice/plan");
    await user.click(await screen.findByText("Change this plan"));
    const daily = screen.getByLabelText("Minutes a day");
    await user.clear(daily);
    await user.type(daily, "90");
    await user.type(screen.getByLabelText("Minutes on Saturday and Sunday"), "180");
    await user.click(screen.getByRole("button", { name: "Save the change" }));
    expect(await screen.findByText("Changed. Your plan is laid out again.")).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")!.body).toMatchObject({ dailyMinutes: 90, weekendMinutes: 180 });
  });

  it("lets the learner pick target companies while planning", async () => {
    routes["GET /practice/nit-practice/plan"] = () => ({ body: { plan: null } });
    routes["GET /practice/nit-practice/companies"] = () => ({ body: { companies: [{ slug: "acme", name: "Acme", problems: 9, experiences: 0 }, { slug: "zeta", name: "Zeta", problems: 4, experiences: 1 }] } });
    let aimed: { slug: string; name: string; readiness: object }[] = [{ slug: "zeta", name: "Zeta", readiness: { solved: 0, of: 4, percent: 0 } }];
    routes["GET /practice/nit-practice/companies/targets"] = () => ({ body: { targets: aimed } });
    routes["PUT /practice/nit-practice/companies/acme/target"] = () => {
      aimed = [...aimed, { slug: "acme", name: "Acme", readiness: { solved: 0, of: 9, percent: 0 } }];
      return { body: { ok: true } };
    };
    const user = userEvent.setup();
    open("/practice/nit-practice/plan");
    const zeta = await screen.findByRole("checkbox", { name: "Zeta" });
    expect((zeta as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "Acme" }));
    await waitFor(() => expect((screen.getByRole("checkbox", { name: "Acme" }) as HTMLInputElement).checked).toBe(true));
    expect(calls.find((c) => c.method === "PUT")).toMatchObject({ path: "/practice/nit-practice/companies/acme/target", body: { on: true } });
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

describe("the end of a sprint, and a day off", () => {
  it("takes today off from the dashboard, after asking", async () => {
    let frozen = false;
    routes["GET /practice/nit-practice/home"] = () => ({ body: { ...home, frozenToday: frozen, freezesLeft: frozen ? 1 : 2 } });
    routes["POST /practice/nit-practice/streak/freeze"] = () => {
      frozen = true;
      return { body: { day: "2026-10-05", freezesLeft: 1, moved: 2 } };
    };
    const user = userEvent.setup();
    open("/practice/nit-practice/home");
    await user.click(await screen.findByRole("button", { name: /Take today off: your streak stays, 2 days off left/ }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(await screen.findByText("Today off")).toBeTruthy();
  });

  it("hands in a sprint's quiz and says what comes back to revise", async () => {
    routes["GET /practice/nit-practice/plan/sprints/1/quiz"] = () => ({
      body: {
        sprint: 1,
        open: true,
        passPercent: 70,
        count: 2,
        sittings: [],
        questions: [
          { slug: "stable", title: "Stable sort", question: { kind: "mcq", stem: "Which sort is **stable**?", options: ["quick", "merge"] } },
          { slug: "bits", title: "Bits", question: { kind: "numeric", stem: "Bits in a byte?" } },
        ],
      },
    });
    routes["POST /practice/nit-practice/plan/sprints/1/quiz"] = () => ({ body: { score: 1, total: 2, passed: false, wrong: ["bits"], revise: 1, reward: { coins: 0, reasons: [] } } });
    const user = userEvent.setup();
    open("/practice/nit-practice/sprints/1/quiz");
    await user.click(await screen.findByRole("radio", { name: "merge" }));
    await user.type(screen.getByRole("textbox", { name: "Bits" }), "7");
    await user.click(screen.getByRole("button", { name: "Hand in" }));
    expect(await screen.findByText("1 of 2. 1 questions are back for revision, starting today.")).toBeTruthy();
    expect(calls.find((c) => c.method === "POST" && c.path.endsWith("/quiz"))!.body).toEqual({ answers: { stable: "1", bits: "7" } });
  });

  it("gathers a sprint's notes on one page", async () => {
    routes["GET /practice/nit-practice/plan/sprints/2/notes"] = () => ({
      body: { sprint: 2, items: [{ kind: "lesson", slug: "heaps", title: "Heaps", note: "Smallest on **top**." }, { kind: "problem", slug: "kth", title: "Kth largest", note: null }] },
    });
    open("/practice/nit-practice/sprints/2/notes");
    const page = await screen.findByRole("article", { name: "Sprint 2 notes" });
    expect(page.textContent).toContain("Smallest on top.");
    expect(page.textContent).toContain("No note yet.");
  });
});

describe("notes", () => {
  it("drafts a note on a lesson with Sahayak, into the box, and saves it only when asked", async () => {
    routes["GET /practice/nit-practice/lessons/heaps"] = () => ({ body: { slug: "heaps", title: "Heaps", body: "A heap.", videoUrl: null, estMinutes: 20, done: false, locked: false, quiz: [] } });
    routes["GET /practice/nit-practice/notes/lesson/heaps"] = () => ({ body: { kind: "lesson", ref: "heaps", title: "Heaps", body: "Mine first.", updatedAt: "2026-10-01T00:00:00Z" } });
    routes["POST /practice/nit-practice/tutor/notes"] = () => ({ body: { id: "t1", mode: "notes", hintLevel: null, answer: "## Key ideas\nSmallest at the root.", credits: 15, createdAt: "2026-10-05T04:00:00Z" } });
    routes["PUT /practice/nit-practice/notes/lesson/heaps"] = (init) => ({ body: { kind: "lesson", ref: "heaps", title: "Heaps", body: (JSON.parse(String(init.body)) as { body: string }).body, updatedAt: "2026-10-05T04:00:00Z" } });
    const user = userEvent.setup();
    open("/practice/nit-practice/lessons/heaps");
    await user.click(await screen.findByRole("button", { name: /Draft with Sahayak/ }));
    expect(await screen.findByText("Sahayak's draft is in the box. Change it, then save.")).toBeTruthy();
    expect(calls.find((c) => c.path === "/practice/nit-practice/tutor/notes")!.body).toEqual({ lesson: "heaps", replyIn: "en" });
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
    const box = screen.getByRole("textbox", { name: /My notes/ }) as HTMLTextAreaElement;
    expect(box.value).toBe("Mine first.\n\n## Key ideas\nSmallest at the root.");
    await user.click(screen.getByRole("button", { name: "Save note" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ body: "Mine first.\n\n## Key ideas\nSmallest at the root." }));
  });

  it("prints a track's notes, module by module", async () => {
    routes["GET /practice/nit-practice/notes"] = () => ({ body: { notes: [] } });
    routes["GET /practice/nit-practice/notes/book"] = (_init, url) => ({
      body: {
        track: { slug: url.searchParams.get("track"), title: "DSA Basics" },
        modules: [{ title: "Arrays", notes: [{ kind: "problem", slug: "two-sum", title: "Two sum", body: "Use a map." }] }],
        topics: [{ title: "Two pointers", body: "Ends move in." }],
      },
    });
    const print = vi.fn();
    window.print = print;
    const user = userEvent.setup();
    open("/practice/nit-practice/notes");
    const go = await screen.findByRole("link", { name: /Open to print/ });
    expect(go.getAttribute("href")).toBe("/practice/nit-practice/notes/print?track=dsa-basics");
    await user.click(go);
    expect(await screen.findByRole("heading", { name: "DSA Basics", level: 1 })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Arrays", level: 2 })).toBeTruthy();
    expect(screen.getByText("Use a map.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Topic notes", level: 2 })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Print or save as PDF/ }));
    expect(print).toHaveBeenCalled();
    expect(parseRoute("/practice/nit-practice/notes/print", "?track=dsa-basics")).toEqual({ page: "notebook", track: "dsa-basics" });
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

  it("comes as a notification on this phone when the learner allows it, and stops when they turn it off", async () => {
    routes["GET /practice/nit-practice/reminders"] = () => ({ body: { enabled: true, hour: 19, email: false, push: true, devices: 0 } });
    routes["GET /practice/nit-practice/push/key"] = () => ({ body: { key: "BAAB" } });
    routes["POST /practice/nit-practice/push"] = () => ({ status: 201, body: { devices: 1 } });
    routes["DELETE /practice/nit-practice/push"] = () => ({ body: { devices: 0 } });
    let subscription: { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> } | null = null;
    const subscribe = vi.fn(async () => {
      subscription = {
        endpoint: "https://fcm.googleapis.com/fcm/send/phone",
        toJSON: () => ({ endpoint: "https://fcm.googleapis.com/fcm/send/phone", keys: { p256dh: "BKey", auth: "secret" } }),
        unsubscribe: vi.fn(async () => {
          subscription = null;
          return true;
        }),
      };
      return subscription;
    });
    const registration = { pushManager: { getSubscription: async () => subscription, subscribe } };
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn(async () => "granted") });
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => registration, ready: Promise.resolve(registration) } });
    try {
      const user = userEvent.setup();
      open("/practice/nit-practice/plan");
      expect(await screen.findByText(/One notification a day at most/)).toBeTruthy();
      const toggle = await screen.findByRole("checkbox", { name: "Also as a notification on this phone or computer" });
      expect(toggle).not.toBeChecked();
      await user.click(toggle);
      await waitFor(() => expect(toggle).toBeChecked());
      expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: Uint8Array.from([4, 0, 1]) });
      expect(calls.find((c) => c.method === "POST" && c.path.endsWith("/push"))!.body).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/phone", keys: { p256dh: "BKey", auth: "secret" } });
      await user.click(toggle);
      await waitFor(() => expect(toggle).not.toBeChecked());
      expect(calls.find((c) => c.method === "DELETE")!.body).toEqual({ endpoint: "https://fcm.googleapis.com/fcm/send/phone" });
      expect(subscription).toBeNull();
    } finally {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
  });

  it("says so when the browser blocks notifications", async () => {
    routes["GET /practice/nit-practice/reminders"] = () => ({ body: { enabled: true, hour: 19, email: true, push: true, devices: 0 } });
    routes["GET /practice/nit-practice/push/key"] = () => ({ body: { key: "BAAB" } });
    const registration = { pushManager: { getSubscription: async () => null, subscribe: vi.fn() } };
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn(async () => "denied") });
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => registration, ready: Promise.resolve(registration) } });
    try {
      const user = userEvent.setup();
      open("/practice/nit-practice/plan");
      await user.click(await screen.findByRole("checkbox", { name: "Also as a notification on this phone or computer" }));
      expect(await screen.findByText(/Notifications are blocked for this site/)).toBeTruthy();
      expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
      expect(calls.some((c) => c.method === "POST" && c.path.endsWith("/push"))).toBe(false);
    } finally {
      delete (navigator as { serviceWorker?: unknown }).serviceWorker;
    }
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

  it("asks the interview follow-ups and sends an answer to one", async () => {
    routes["GET /practice/nit-practice/problems/stable-sort"] = () => ({ body: mcq });
    routes["GET /practice/nit-practice/problems/stable-sort/comments"] = () => ({ body: { comments: [] } });
    routes["GET /practice/nit-practice/lists"] = () => ({ body: { lists: [{ name: "Bookmarks", solved: 0, problems: [] }] } });
    let entries: object[] = [];
    routes["GET /practice/nit-practice/problems/stable-sort/tutor"] = () => ({
      body: { entries, nextHint: null, failures: 0, costs: { hint1: 10, hint: 20, review: 40, doubt: 15, followup: 15, followupReply: 10 } },
    });
    routes["GET /practice/nit-practice/credits"] = () => ({ body: { balance: 100, history: [] } });
    const asked = { id: "f1", mode: "followup", hintLevel: null, answer: "1. Why is merge sort stable?\n2. Can heapsort be made stable?", credits: 15, createdAt: "2026-10-05T04:00:00Z", question: "", data: { questions: ["Why is merge sort stable?", "Can heapsort be made stable?"] } };
    routes["POST /practice/nit-practice/problems/stable-sort/tutor/followups"] = () => {
      entries = [asked];
      return { body: asked };
    };
    routes["POST /practice/nit-practice/problems/stable-sort/tutor/followups/f1/reply"] = () => {
      const replied = { id: "r1", mode: "followup_reply", hintLevel: null, answer: "**Strong.** You named the tie rule.", credits: 10, createdAt: "2026-10-05T04:01:00Z", question: "It takes from the left on a tie", data: { verdict: "strong" } };
      entries = [asked, replied];
      return { body: replied };
    };
    const user = userEvent.setup();
    open("/practice/nit-practice/problems/stable-sort");
    await user.click(await screen.findByRole("tab", { name: "Sahayak" }));
    await user.click(await screen.findByRole("button", { name: "Interview follow-ups · 15 credits" }));
    expect(await screen.findByText("Why is merge sort stable?")).toBeTruthy();
    await user.type(screen.getByLabelText("Your answer to question 1"), "It takes from the left on a tie");
    await user.click(screen.getByRole("button", { name: "Answer question 1" }));
    expect(await screen.findByText("You named the tie rule.")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/followups/f1/reply"))!.body).toEqual({ question: 0, answer: "It takes from the left on a tie", replyIn: "en" });
    expect(screen.getByText("What Sahayak says is deleted after 180 days.")).toBeTruthy();
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

  it("starts a free trial once, and shows a refunded order with its credit note", async () => {
    let trialDays = 14;
    routes["GET /practice/nit-practice/plus"] = () => ({
      body: { enabled: true, active: trialDays === 0, until: trialDays === 0 ? "2026-10-19T04:00:00Z" : null, dsaUntil: null, trialDays, freeModules: 1, monthlyCredits: 0, tutor: true, checkout: true, invoices: true, products: [] },
    });
    routes["GET /practice/nit-practice/credits"] = () => ({ body: { balance: 0, history: [{ delta: -1000, reason: "order_refund", at: "2026-10-06T04:00:00Z" }] } });
    routes["GET /practice/nit-practice/orders"] = () => ({
      body: {
        orders: [
          { id: "o1", title: "Plus, 3 months", days: 90, credits: 1000, listPaise: 99_900, coupon: null, discountPaise: 0, amountPaise: 99_900, taxPaise: 15_239, status: "refunded", createdAt: "2026-10-05T04:00:00Z", paidAt: "2026-10-05T04:01:00Z", refundedAt: "2026-10-06T04:00:00Z", invoice: "PKP/2627/000001", creditNote: "PKC/2627/000001" },
        ],
      },
    });
    let started = 0;
    routes["POST /practice/nit-practice/plus/trial"] = () => {
      started += 1;
      trialDays = 0;
      return { status: 201, body: { active: true, until: "2026-10-19T04:00:00Z" } };
    };
    const user = userEvent.setup();
    open("/practice/nit-practice/plus");
    expect(await screen.findByRole("heading", { name: "Try Plus free for 14 days" })).toBeTruthy();
    expect(await screen.findByText("Taken back with a refund")).toBeTruthy();
    expect(screen.getByText(/^Refunded /)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Credit note PKC\/2627\/000001/ }).getAttribute("href")).toBe("/practice/nit-practice/invoices/PKC%2F2627%2F000001");
    await user.click(screen.getByRole("button", { name: "Start my 14-day trial" }));
    expect(await screen.findByText("Your free trial has started.")).toBeTruthy();
    expect(started).toBe(1);
    expect(await screen.findByText(/You have Plus until/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Start my/ })).toBeNull();
  });

  it("asks a lesson's quiz, shows the right answers, and says what went to revision", async () => {
    routes["GET /practice/nit-practice/lessons/sorting"] = () => ({
      body: {
        slug: "sorting",
        title: "Sorting",
        body: "Stable sorts.",
        videoUrl: null,
        estMinutes: 10,
        done: false,
        locked: false,
        quiz: [
          { slug: "stable", title: "Stable sort", question: { id: "q1", kind: "mcq", stem: "Which sort is **stable**?", maxScore: 1, options: ["quick", "merge"] } },
          { slug: "bits", title: "Bits", question: { id: "q2", kind: "numeric", stem: "Bits in a byte?", maxScore: 1 } },
        ],
      },
    });
    routes["GET /practice/nit-practice/notes/lesson/sorting"] = () => ({ body: { kind: "lesson", ref: "sorting", title: "Sorting", body: "", updatedAt: null } });
    routes["POST /practice/nit-practice/lessons/sorting/quiz"] = () => ({
      body: {
        score: 1,
        total: 2,
        results: [
          { slug: "stable", right: false, answer: "merge", explanation: "Merge sort keeps equal keys in order." },
          { slug: "bits", right: true, answer: "8", explanation: "" },
        ],
        revise: 1,
      },
    });
    const user = userEvent.setup();
    open("/practice/nit-practice/lessons/sorting");
    const quiz = await screen.findByRole("region", { name: "Check yourself" });
    expect(within(quiz).getByText("2 quick questions. What you get wrong comes back for revision today.")).toBeTruthy();
    await user.click(within(quiz).getByRole("radio", { name: /quick/ }));
    await user.type(within(quiz).getByRole("textbox"), "8");
    await user.click(within(quiz).getByRole("button", { name: "Check my answers" }));
    expect(await within(quiz).findByText("1 of 2 right")).toBeTruthy();
    expect(within(quiz).getByText("Not quite — the answer is merge")).toBeTruthy();
    expect(within(quiz).getByText("Merge sort keeps equal keys in order.")).toBeTruthy();
    expect(within(quiz).getByText("1 sent to revision")).toBeTruthy();
    expect(calls.find((c) => c.path.endsWith("/quiz"))!.body).toEqual({ answers: { stable: "0", bits: "8" } });
    await user.click(within(quiz).getByRole("button", { name: "Try again" }));
    expect(within(quiz).getByRole("button", { name: "Check my answers" })).toBeTruthy();
  });

  it("shows a shared solution read-only, with the way to the problem", async () => {
    routes["GET /practice/nit-practice/shares/AbCdEfGhIjKl"] = () => ({
      body: { problem: { slug: "sum-of-two", title: "Sum of two" }, author: "Ravi", language: "python", source: "print(1 + 2)", createdAt: "2026-10-05T04:00:00Z" },
    });
    open("/practice/nit-practice/shares/AbCdEfGhIjKl");
    expect(await screen.findByRole("heading", { name: "Sum of two: a shared solution" })).toBeTruthy();
    expect(screen.getByText("Shared by Ravi · python")).toBeTruthy();
    expect(screen.getByText("print(1 + 2)")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Solve it yourself" }).getAttribute("href")).toBe("/practice/nit-practice/problems/sum-of-two");
  });

  it("shows a locked lesson by name, with the way to Plus", async () => {
    routes["GET /practice/nit-practice/lessons/heaps"] = () => ({ body: { slug: "heaps", title: "Heaps", body: "", videoUrl: null, estMinutes: 20, done: false, locked: true, quiz: [] } });
    open("/practice/nit-practice/lessons/heaps");
    expect(await screen.findByText("This lesson comes with Plus.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /See Plus/ }).getAttribute("href")).toBe("/practice/nit-practice/plus");
    expect(screen.queryByRole("button", { name: "Mark as done" })).toBeNull();
  });
});
