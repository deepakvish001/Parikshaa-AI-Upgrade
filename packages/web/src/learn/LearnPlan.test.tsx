import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "../practice/client.ts";
import { fakeApi, HOME, renderLearn, SESSION, SITE, task, TODAY, type FakeApi } from "./fake-api.tsx";
import { addDays, deadlineOf, P, planInputOf, sevenDays } from "./LearnPlan.tsx";

/**
 * Onboarding and Mera plan (tracker row 140, K2-2) against a fake of the
 * practice site's API: what each step asks the API for, the preview and its
 * three ways, the 8-question check, the plan's five states and the changes
 * the API allows; axe finding nothing in each.
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
const bodyOf = (method: string, path: string) => {
  const calls = vi.mocked(fetch).mock.calls.filter(([url, init]) => new URL(url as string, "http://x").pathname === `/api${path}` && (init?.method ?? "GET") === method);
  return calls.map(([, init]) => JSON.parse(String(init?.body ?? "null")) as unknown);
};

export const PLAN: Plan = {
  track: { slug: "dsa", title: "DSA for placements" },
  level: "intermediate",
  deadline: "2026-12-18",
  dailyMinutes: 120,
  weekendMinutes: 180,
  offDays: [0],
  goal: "",
  role: "sde",
  startedAt: "2026-10-20T05:00:00.000Z",
  finishOn: "2026-12-16",
  onTrack: true,
  daysLeft: 52,
  studyDaysLeft: 44,
  done: 8,
  total: 60,
  sprint: 2,
  sprints: [
    { sprint: 1, from: "2026-10-20", to: "2026-10-26", tasks: 8, done: 8 },
    { sprint: 2, from: "2026-10-27", to: "2026-11-03", tasks: 12, done: 1 },
    { sprint: 3, from: "2026-11-04", to: "2026-11-11", tasks: 12, done: 0 },
  ],
  moved: 1,
  today: TODAY,
  upcoming: [task("u1", "Next greater element", "practice", false, { day: "2026-10-28", link: { kind: "problem", slug: "nge" }, difficulty: "medium" })],
  completed: [task("c1", "Arrays: the idea", "learn", true, { day: "2026-10-26" })],
};

let api: FakeApi;
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  // Noon in India on 27 October.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T06:30:00Z"));
  localStorage.setItem(SESSION, "pl_good");
  api = fakeApi();
  api.routes["GET /practice/demo/plan"] = () => ({ body: { plan: PLAN } });
  api.routes["GET /practice/demo/tracks"] = () => ({
    body: {
      tracks: [
        { slug: "dsa", title: "DSA for placements", description: "", modules: 6, items: 60, done: 0 },
        { slug: "sql", title: "SQL in 30 days", description: "", modules: 4, items: 30, done: 0 },
      ],
    },
  });
  api.routes["GET /practice/demo/companies"] = () => ({ body: { companies: [{ slug: "infosys", name: "Infosys", problems: 12, experiences: 3 }] } });
  api.routes["PUT /practice/demo/companies/infosys/target"] = () => ({ body: { ok: true } });
  api.routes["POST /practice/demo/plan/preview"] = () => ({
    body: { track: { slug: "dsa", title: "DSA for placements" }, tasks: 60, totalMinutes: 5400, finishOn: "2027-01-20", deadline: "2027-01-25", fits: true, sprints: [{ sprint: 1, from: "2026-10-27", to: "2026-11-02", tasks: 9, done: 0 }], dailyMinutesToFit: null, itemsThatFit: null },
  });
  api.routes["POST /practice/demo/plan"] = () => ({ status: 201, body: { plan: { ...PLAN, finishOn: "2027-01-20" } } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});
const at = (path: string) => window.history.replaceState(null, "", `/practice/${SITE}${path}`);
const next = () => userEvent.click(screen.getByRole("button", { name: hg(P.nextStep) }));

describe("the plan's arithmetic", () => {
  it("turns answers into what the API is asked, and lays out seven days", () => {
    expect(addDays("2026-10-27", 90)).toBe("2027-01-25");
    expect(deadlineOf({ when: "d60", date: "2027-03-01" }, "2026-10-27")).toBe("2026-12-26");
    expect(deadlineOf({ when: "date", date: "2027-03-01" }, "2026-10-27")).toBe("2027-03-01");
    expect(planInputOf({ track: "dsa", role: null, when: "d90", date: "", minutes: 60, weekend: "more", level: "beginner" }, "2026-10-27")).toEqual({
      track: "dsa",
      level: "beginner",
      deadline: "2027-01-25",
      dailyMinutes: 60,
      weekendMinutes: 120,
      offDays: [],
      role: null,
    });
    expect(planInputOf({ track: "dsa", role: "sde", when: "d90", date: "", minutes: 120, weekend: "sunday", level: null, upTo: 20 }, "2026-10-27")).toMatchObject({ offDays: [0], weekendMinutes: null, upTo: 20, level: "intermediate" });
    const days = sevenDays(PLAN, "2026-10-27");
    expect(days.map((d) => d.day)).toEqual(["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(days[0]!.tasks).toHaveLength(5);
    expect(days[1]!.tasks.map((x) => x.id)).toEqual(["u1"]);
    expect(days[5]!.off).toBe(true);
    expect(days[2]!.off).toBe(false);
  });
});

describe("onboarding", () => {
  it("asks what the plan needs, previews it on the API and starts it", async () => {
    api.routes["GET /practice/demo/plan"] = () => ({ body: { plan: null } });
    api.routes["GET /practice/demo/companies/targets"] = () => ({ body: { targets: [] } });
    at("/onboarding");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: hg(P.qTrack) })).toBeInTheDocument();
    expect(await screen.findByText("1 / 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: hg(P.nextStep) })).toBeDisabled();
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: /^DSA for placements/ }));
    expect(screen.getByRole("button", { name: /^DSA for placements/ })).toHaveAttribute("aria-pressed", "true");
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.sde) }));
    await next();
    expect(screen.getByRole("heading", { level: 1, name: hg(P.qCompanies) })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /^Infosys/ }));
    await waitFor(() => expect(bodyOf("PUT", "/practice/demo/companies/infosys/target")).toEqual([{ on: true }]));
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.in90) }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.h2) }));
    await userEvent.click(screen.getByRole("radio", { name: hg(P.more) }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: /^Basics aate hain/ }));
    // The paper beside the questions holds every answer.
    const paper = screen.getByRole("complementary", { name: "Aarav ka plan" });
    expect(paper).toHaveTextContent("DSA for placements");
    expect(paper).toHaveTextContent("120 min roz");
    await userEvent.click(screen.getByRole("button", { name: hg(P.write) }));
    expect(await screen.findByRole("heading", { level: 1, name: /Taiyaar/ })).toHaveTextContent("20 Jan");
    expect(bodyOf("POST", "/practice/demo/plan/preview")).toEqual([
      { track: "dsa", level: "intermediate", deadline: "2027-01-25", dailyMinutes: 120, weekendMinutes: 180, offDays: [], role: "sde" },
    ]);
    expect(await violations(container)).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: hg(P.start) }));
    expect(await screen.findByRole("heading", { level: 1, name: hg(P.readyTitle) })).toBeInTheDocument();
    expect(bodyOf("POST", "/practice/demo/plan")).toHaveLength(1);
    expect(screen.getByRole("link", { name: hg(P.toToday) })).toHaveAttribute("href", `/practice/${SITE}/aaj`);
    expect(screen.getByRole("link", { name: hg(P.toPlan) })).toHaveAttribute("href", `/practice/${SITE}/plan`);
  });

  it("chooses the level from the 8-question check", async () => {
    api.routes["GET /practice/demo/companies"] = () => ({ body: { companies: [] } });
    api.routes["GET /practice/demo/placement"] = () => ({
      body: { questions: [{ id: "q1", level: "easy", topic: "arrays", text: "Index of the first item?", options: ["0", "1"] }] },
    });
    api.routes["POST /practice/demo/placement"] = () => ({ body: { score: 1, of: 1, level: "advanced", results: [] } });
    at("/onboarding");
    renderLearn();
    await userEvent.click(await screen.findByRole("button", { name: /^DSA for placements/ }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.roleNone) + hg(P.roleNoneSub) }));
    await next();
    // No companies on this site: that question is left out.
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: hg(P.in60) }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.h1) }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.takeCheck) }));
    await userEvent.click(await screen.findByRole("radio", { name: "0" }));
    await userEvent.click(screen.getByRole("button", { name: hg(P.checkMark) }));
    expect(await screen.findByText(/1 me se 1 sahi/)).toBeInTheDocument();
    expect(bodyOf("POST", "/practice/demo/placement")).toEqual([{ answers: [{ id: "q1", choice: 0 }] }]);
    await userEvent.click(screen.getByRole("button", { name: hg(P.checkClose) }));
    expect(screen.getByRole("button", { name: /^Strong/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers the three ways when the plan runs past the deadline, and says when Plus is needed", async () => {
    let fits = false;
    api.routes["POST /practice/demo/plan/preview"] = () => ({
      body: { track: { slug: "dsa", title: "DSA" }, tasks: 60, totalMinutes: 5400, finishOn: "2027-02-10", deadline: "2027-01-25", fits, sprints: [], dailyMinutesToFit: 150, itemsThatFit: { items: 40, of: 60 } },
    });
    api.routes["GET /practice/demo/companies"] = () => ({ body: { companies: [] } });
    at("/onboarding");
    renderLearn();
    // An existing plan is set aside by a new one, and the page says so.
    expect(await screen.findByText(/Aapka plan chal raha hai \(DSA for placements\)/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /^DSA for placements/ }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.data) }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.in90) }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: hg(P.h1) }));
    await next();
    await userEvent.click(screen.getByRole("button", { name: /^Bilkul naya/ }));
    await userEvent.click(screen.getByRole("button", { name: hg(P.write) }));
    expect(await screen.findByText(/60 min roz par ye deadline ke baad/)).toBeInTheDocument();
    fits = true;
    await userEvent.click(screen.getByRole("button", { name: "150 min roz" }));
    await waitFor(() => expect(bodyOf("POST", "/practice/demo/plan/preview").at(-1)).toMatchObject({ dailyMinutes: 150 }));
    expect(await screen.findByRole("heading", { level: 1, name: /Taiyaar/ })).toBeInTheDocument();

    api.routes["POST /practice/demo/plan/preview"] = () => ({ status: 402, body: { error: "plus_required" } });
    await userEvent.click(screen.getByRole("button", { name: hg(P.change) }));
    await userEvent.click(screen.getByRole("button", { name: hg(P.write) }));
    expect(await screen.findByRole("link", { name: hg(P.getPlus) })).toHaveAttribute("href", `/practice/${SITE}/plus?learn_v2=0`);
  });

  it("asks a signed-out learner to sign in first", async () => {
    localStorage.removeItem(SESSION);
    at("/onboarding");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(P.signInFirst) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in karo" })).toHaveAttribute("href", `/practice/${SITE}/signin?next=onboarding`);
  });
});

describe("Mera plan", () => {
  it("shows the running plan: its finish, sprints, the next seven days and what decides it", async () => {
    at("/plan");
    const { container } = renderLearn();
    const h1 = await screen.findByRole("heading", { level: 1, name: /DSA for placements/ });
    expect(h1).toHaveTextContent("16 Dec");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("8 / 60")).toBeInTheDocument();
    expect(screen.getByText("Deadline se 2 din pehle")).toBeInTheDocument();
    expect(screen.getByText("Sprint 2: 12 me se 1")).toBeInTheDocument();
    const week = screen.getByRole("region", { name: /Saat din/ });
    expect(within(week).getAllByRole("listitem").length).toBeGreaterThan(7);
    expect(within(week).getByText("Next greater element")).toBeInTheDocument();
    expect(within(week).getByText(hg(P.rest))).toBeInTheDocument();
    expect(within(week).getByRole("link", { name: "Pair with target sum" })).toHaveAttribute("href", `/practice/${SITE}/problems/pair-sum`);
    expect(screen.getByText(/Chhoote dino se 1 kaam aage khiske/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: hg(P.rules) })).toHaveTextContent(hg(P.rule2));
    expect(await violations(container)).toEqual([]);
    // The next seven days, and back.
    await userEvent.click(screen.getByRole("button", { name: hg(P.nextWeek) }));
    expect(within(week).queryByText("Next greater element")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: hg(P.prevWeek) }));
    expect(within(week).getByText("Next greater element")).toBeInTheDocument();
  });

  it("ticks a task, adds the learner's own, and saves the settings, on the API", async () => {
    api.routes["PUT /practice/demo/plan/tasks/t5"] = () => ({ body: { ok: true } });
    api.routes["POST /practice/demo/plan/tasks"] = () => ({ status: 201, body: { ok: true } });
    api.routes["PATCH /practice/demo/plan"] = () => ({ body: { plan: { ...PLAN, finishOn: "2026-12-10" } } });
    at("/plan");
    renderLearn();
    await userEvent.click(await screen.findByRole("button", { name: "Ho gaya: Update my resume" }));
    await waitFor(() => expect(bodyOf("PUT", "/practice/demo/plan/tasks/t5")).toEqual([{ done: true }]));

    await userEvent.type(screen.getByLabelText(hg(P.ownTitle)), "Mock HR round");
    await userEvent.click(screen.getByRole("button", { name: hg(P.add) }));
    await waitFor(() => expect(bodyOf("POST", "/practice/demo/plan/tasks")).toEqual([{ title: "Mock HR round", estMinutes: 30, day: "2026-10-27" }]));
    expect(await screen.findByText(hg(P.added))).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: hg(P.settings) }));
    const dialog = await screen.findByRole("dialog", { name: hg(P.settings) });
    const weekday = within(dialog).getByLabelText(hg(P.weekday));
    await userEvent.clear(weekday);
    await userEvent.type(weekday, "150");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Sat" }));
    await userEvent.click(within(dialog).getByRole("button", { name: hg(P.save) }));
    await waitFor(() => expect(bodyOf("PATCH", "/practice/demo/plan")).toEqual([{ deadline: "2026-12-18", dailyMinutes: 150, weekendMinutes: 180, offDays: [0, 6] }]));
    expect(await screen.findByText("Save ho gaya. Plan ab 10 Dec ko khatam.")).toBeInTheDocument();
  });

  it("makes today lighter with a day off, and stops the plan when asked twice", async () => {
    api.routes["POST /practice/demo/streak/freeze"] = () => ({ body: { day: "2026-10-27", freezesLeft: 0, moved: 4 } });
    api.routes["DELETE /practice/demo/plan"] = () => ({ body: { ok: true } });
    at("/plan");
    const { container } = renderLearn();
    await userEvent.click(await screen.findByRole("button", { name: hg(P.lighter) }));
    const dialog = await screen.findByRole("dialog", { name: hg(P.lighter) });
    expect(await within(dialog).findByText(/Is mahine 1 chhutti baaki/)).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
    await userEvent.click(within(dialog).getByRole("button", { name: hg(P.update) }));
    expect(await screen.findByText("Aaj chhutti. Streak bachi; 4 kaam aage khiske.")).toBeInTheDocument();
    expect(api.calls.filter((c) => c.path === "/practice/demo/streak/freeze")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: hg(P.stop) }));
    const ask = await screen.findByRole("dialog", { name: hg(P.stop) });
    api.routes["GET /practice/demo/plan"] = () => ({ body: { plan: null } });
    await userEvent.click(within(ask).getByRole("button", { name: hg(P.stop) }));
    expect(await screen.findByRole("heading", { level: 2, name: hg(P.noPlanTitle) })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: hg(P.makePlan) })).toHaveAttribute("href", `/practice/${SITE}/onboarding`);
    expect(api.calls.filter((c) => c.method === "DELETE" && c.path === "/practice/demo/plan")).toHaveLength(1);
  });

  it("has the five states: loading, error, offline, signed out, and no plan yet", async () => {
    let answer: () => { status?: number; body: unknown } = () => ({ status: 500, body: { error: "server_error" } });
    api.routes["GET /practice/demo/plan"] = () => answer();
    at("/plan");
    const { container, unmount } = renderLearn();
    expect(await screen.findByRole("status")).toHaveTextContent("Load ho raha hai");
    const failed = await screen.findByRole("alert");
    expect(failed).toHaveTextContent("server_error · 500");
    expect(await violations(container)).toEqual([]);
    answer = () => ({ body: { plan: null } });
    await userEvent.click(within(failed).getByRole("button", { name: "Phir koshish karo" }));
    expect(await screen.findByRole("heading", { level: 2, name: hg(P.noPlanTitle) })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
    unmount();

    act(() => onlineManager.setOnline(false));
    renderLearn();
    expect(await screen.findByText("Net aate hi ye dikhega.")).toBeInTheDocument();
    act(() => onlineManager.setOnline(true));

    localStorage.removeItem(SESSION);
    renderLearn();
    expect((await screen.findAllByRole("link", { name: "Sign in karo" })).at(-1)).toHaveAttribute("href", `/practice/${SITE}/signin?next=plan`);
  });

  it("speaks Hindi when the learner chooses it", async () => {
    localStorage.setItem("parikshaa.language", "hi");
    at("/plan");
    renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: /DSA for placements, तैयार/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: P.settings[2] })).toBeInTheDocument();
    expect(HOME.name).toBe("Aarav Sharma");
  });
});
