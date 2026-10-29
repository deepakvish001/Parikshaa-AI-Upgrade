import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysBetween, failing, greeting, istDay, longDay, nextContest, taskScreen } from "./Aaj.tsx";
import { CONTESTS, fakeApi, HOME, renderLearn, SESSION, SITE, TODAY, WRONG, type FakeApi } from "./fake-api.tsx";
import { A } from "./text.ts";

/**
 * Aaj on the learner's own day (tracker row 140, K2-1), against a fake of the
 * practice site's API: each state DESIGN-SYSTEM §9 names (loading, empty,
 * error, offline, signed out) and the day itself, in the three languages,
 * with axe finding nothing (colour-contrast and target-size are left to the
 * browser, e2e learn-aaj.spec.ts, as in LearnApp.test.tsx).
 */

async function violations(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false }, "target-size": { enabled: false } },
    resultTypes: ["violations"],
  });
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

let api: FakeApi;
const hg = (tri: readonly [string, string, string]) => tri[1];
const day = () => screen.findByRole("region", { name: "Pair with target sum" });
const rail = () => screen.getByRole("complementary", { name: "Page ke saath" });

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", `/practice/${SITE}`);
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  // Seven in the evening, the learner's own time: only the greeting reads the clock.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 27, 19, 0));
  localStorage.setItem(SESSION, "pl_good");
  api = fakeApi();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.lang = "";
});

describe("Aaj's arithmetic", () => {
  it("counts days, finds the day in India, greets by the hour", () => {
    expect(daysBetween("2026-09-20", "2026-10-27")).toBe(37);
    expect(daysBetween("2026-12-18", "2026-12-16")).toBe(-2);
    expect(istDay("2026-10-26T19:00:00.000Z")).toBe("2026-10-27");
    expect(istDay("2026-10-26T18:00:00.000Z")).toBe("2026-10-26");
    expect(greeting(9)).toBe(A.morning);
    expect(greeting(14)).toBe(A.afternoon);
    expect(greeting(19)).toBe(A.evening);
    expect(longDay("2026-10-27", "hg")).toBe("Mangalvaar, 27 October");
    expect(longDay("2026-10-27", "en")).toBe("Tuesday, 27 October");
    expect(longDay("2026-10-27", "hi")).toBe("मंगलवार, 27 अक्टूबर");
  });

  it("sends each task to where it is done", () => {
    expect(taskScreen(TODAY[0]!)).toBe("lessons/stack-lifo");
    expect(taskScreen(TODAY[1]!)).toBe("problems/pair-sum");
    expect(taskScreen(TODAY[3]!)).toBe("revision");
    expect(taskScreen(TODAY[4]!)).toBe("plan");
  });

  it("shows only a failing latest submission, and the contest running or next", () => {
    expect(failing([WRONG, { ...WRONG, status: "passed" }])).toBe(WRONG);
    expect(failing([{ ...WRONG, status: "passed" }, WRONG])).toBeNull();
    expect(failing([])).toBeNull();
    expect(nextContest(CONTESTS)?.slug).toBe("weekly-13");
    expect(nextContest([...CONTESTS, { ...CONTESTS[1]!, slug: "live", state: "running" }])?.slug).toBe("live");
    expect(nextContest([CONTESTS[0]!])).toBeNull();
  });
});

describe("Aaj, signed in", () => {
  it("shows the learner's day: the date and plan day, the greeting, what is left, and the pace", async () => {
    renderLearn();
    await day();
    expect(screen.getByText("Mangalvaar, 27 October")).toHaveClass("ln-dated");
    expect(screen.getByText(/din 38\/90/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Shubh sandhya, Aarav. 4 kaam baaki, lagbhag 105 min.");
    expect(screen.getByText("2 din aage")).toBeInTheDocument();
    expect(document.title).toBe("Aaj · Parikshaa Learn");
    expect(api.calls.find((c) => c.path === "/practice/demo/home")?.auth).toBe("Bearer pl_good");
  });

  it("puts the first open task in front, with its wrong answer from the judge and the way to resume or ask why", async () => {
    renderLearn();
    const now = await day();
    expect(within(now).getByText("Abhi · kaam 2 / 5")).toBeInTheDocument();
    expect(within(now).getByText("30 min")).toBeInTheDocument();
    expect(await within(now).findByText("Galat jawab · 30 me se 22 test")).toBeInTheDocument();
    expect(within(now).getByText("Problem · Medium")).toBeInTheDocument();
    expect(within(now).getByRole("link", { name: "Jaari rakho" })).toHaveAttribute("href", "/practice/demo/problems/pair-sum");
    expect(within(now).getByRole("progressbar", { name: "Aaj ke kaam" })).toHaveAttribute("aria-valuetext", "5 me se 1 ho gaye");
    await userEvent.click(within(now).getByRole("button", { name: "Fail kyun? Poochho" }));
    expect(screen.getByRole("complementary", { name: "Sahayak" })).toBeInTheDocument();
  });

  it("says start, with no question to ask, before anything is submitted", async () => {
    api.routes["GET /practice/demo/problems/pair-sum/submissions"] = () => ({ body: { submissions: [] } });
    renderLearn();
    const now = await day();
    expect(await within(now).findByRole("link", { name: "Shuru karo" })).toBeInTheDocument();
    expect(within(now).queryByRole("button", { name: "Fail kyun? Poochho" })).not.toBeInTheDocument();
    expect(within(now).queryByText(/Galat jawab/)).not.toBeInTheDocument();
  });

  it("lists the rest of today: done ones ticked, each open one a link to where it is done", async () => {
    renderLearn();
    await day();
    const then = screen.getByRole("region", { name: "Phir" });
    expect(within(then).getByText("5 me se 1 ho gaye")).toBeInTheDocument();
    const items = within(then).getAllByRole("listitem");
    expect(items.map((li) => li.querySelector("b")?.textContent)).toEqual(["Stack: the LIFO idea", "Valid brackets", "Revise: two pointers", "Update my resume"]);
    expect(within(items[0]!).getByRole("img", { name: "Ho gaya" })).toBeInTheDocument();
    expect(within(then).getByRole("link", { name: "Kholo: Valid brackets" })).toHaveAttribute("href", "/practice/demo/problems/valid-brackets");
    expect(within(then).getByRole("link", { name: "Kholo: Revise: two pointers" })).toHaveAttribute("href", "/practice/demo/revision");
    expect(within(then).getByRole("link", { name: "Kholo: Update my resume" })).toHaveAttribute("href", "/practice/demo/plan");
    expect(within(items[1]!).getByText("26 Oct se khiska")).toBeInTheDocument();
    expect(within(then).getByRole("link", { name: "Halka karo" })).toHaveAttribute("href", "/practice/demo/plan");
  });

  it("has the week and what is coming up beside it, from the targets, the streak, the problem of the day, the sprint and the contests", async () => {
    renderLearn();
    await day();
    const side = rail();
    expect(await within(side).findByRole("progressbar", { name: "Infosys ki taiyari" })).toHaveAttribute("aria-valuenow", "62");
    expect(within(side).getByText("Infosys ke haal ke 50 me se 31 problem solve.")).toBeInTheDocument();
    expect(within(side).getByText("12")).toBeInTheDocument();
    expect(within(side).getByText("1 chhutti baaki")).toBeInTheDocument();
    const ahead = within(side).getByRole("region", { name: "Aage" });
    expect(within(ahead).getByText("Koko eating bananas · Medium")).toBeInTheDocument();
    expect(within(ahead).getByRole("link", { name: "Solve karo: Aaj ka problem" })).toHaveAttribute("href", "/practice/demo/potd");
    expect(within(ahead).getByRole("link", { name: "Revise karo: 6 revision cards baaki" })).toHaveAttribute("href", "/practice/demo/revision");
    expect(within(ahead).getByText("Sprint 2 test")).toBeInTheDocument();
    expect(within(ahead).getByText(/12 me se 3 kaam ho gaye/)).toBeInTheDocument();
    expect(await within(ahead).findByText("Weekly Round 13")).toBeInTheDocument();
    expect(within(ahead).queryByText("Weekly Round 14")).not.toBeInTheDocument();
    expect(within(ahead).queryByText("Weekly Round 12")).not.toBeInTheDocument();
    // What has no backend yet is not shown as if it were real (Kadam 3).
    const page = screen.getByRole("main");
    expect(within(page).queryByText(/Galat AI pakdo/)).not.toBeInTheDocument();
    expect(within(page).queryByText(/Semester/)).not.toBeInTheDocument();
    expect(within(page).queryByRole("note")).not.toBeInTheDocument();
  });

  it("names the learner in the side bar, as a link to their profile", async () => {
    renderLearn();
    const nav = screen.getByRole("navigation", { name: "Learn menu" });
    expect(await within(nav).findByRole("link", { name: /Aarav Sharma/ })).toHaveAttribute("href", "/practice/demo/profile");
  });

  it("asks for a plan when there is none, and still shows the problem of the day", async () => {
    api.routes["GET /practice/demo/home"] = () => ({ body: { ...HOME, plan: null } });
    renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: "Abhi koi plan nahi" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/^Shubh sandhya, Aarav\.$/);
    expect(screen.getByRole("link", { name: "Plan banao" })).toHaveAttribute("href", "/practice/demo/plan");
    expect(screen.queryByRole("region", { name: "Phir" })).not.toBeInTheDocument();
    expect(screen.queryByText("2 din aage")).not.toBeInTheDocument();
    expect(within(rail()).getByText("Koko eating bananas · Medium")).toBeInTheDocument();
    expect(within(rail()).queryByText(/Sprint/)).not.toBeInTheDocument();
  });

  it("says when the day's work is all done, and the pace when it is behind or a day off", async () => {
    const done = TODAY.map((x) => ({ ...x, done: true }));
    api.routes["GET /practice/demo/home"] = () => ({ body: { ...HOME, plan: { ...HOME.plan!, today: done, finishOn: "2026-12-21" } } });
    const first = renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: "Aaj ka kaam poora" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Aaj ka saara kaam ho gaya.");
    expect(screen.getByText("3 din peeche")).toBeInTheDocument();
    first.unmount();

    api.routes["GET /practice/demo/home"] = () => ({ body: { ...HOME, frozenToday: true } });
    renderLearn();
    expect(await screen.findByText("Aaj chhutti")).toBeInTheDocument();
  });

  it("speaks English and Hindi too, with the morning's greeting in the morning", async () => {
    vi.setSystemTime(new Date(2026, 9, 27, 9, 0));
    localStorage.setItem("parikshaa.learn.hinglish", "0");
    const english = renderLearn();
    await screen.findByRole("region", { name: "Pair with target sum" });
    expect(screen.getByText(/day 38 of 90/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good morning, Aarav. 4 things left, about 105 min.");
    expect(screen.getByText("2 days ahead")).toBeInTheDocument();
    english.unmount();
    localStorage.setItem("parikshaa.language", "hi");
    renderLearn();
    await screen.findByRole("region", { name: "Pair with target sum" });
    expect(screen.getByText("मंगलवार, 27 अक्टूबर")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("सुप्रभात, Aarav। 4 काम बाकी, लगभग 105 मिनट।");
  });

  it("finds nothing with axe on the day, wide and on a phone", async () => {
    const { container, unmount } = renderLearn();
    await day();
    await screen.findByText("Galat jawab · 30 me se 22 test");
    await within(rail()).findByText("Weekly Round 13");
    expect(await violations(container)).toEqual([]);
    unmount();
    window.matchMedia = vi.fn((query: string) => ({ matches: query === "(max-width: 860px)" || query === "(max-width: 1180px)", media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
    const phone = renderLearn();
    await day();
    expect(await violations(phone.container)).toEqual([]);
  });
});

describe("Aaj's other states", () => {
  it("loads: the page's heading, and in words that it is on its way", async () => {
    api.routes["GET /practice/demo/home"] = () => new Promise(() => undefined);
    const { container } = renderLearn();
    expect(screen.getByRole("heading", { level: 1, name: "Aaj" })).toBeInTheDocument();
    expect(await screen.findByText(hg(["", "Load ho raha hai… dheema net ho to kuch second.", ""]))).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });

  it("fails with what happened, a reference, and a retry that brings the day", async () => {
    let fail = true;
    api.routes["GET /practice/demo/home"] = () => (fail ? { status: 500, body: { error: "server_error" } } : { body: HOME });
    const { container } = renderLearn();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Ye load nahi hua");
    expect(alert).toHaveTextContent("Aapka kuch nahi gaya.");
    expect(alert).toHaveTextContent("Reference: server_error · 500");
    expect(await violations(container)).toEqual([]);
    fail = false;
    await userEvent.click(within(alert).getByRole("button", { name: "Phir koshish karo" }));
    expect(await day()).toBeInTheDocument();
  });

  it("signed out, asks the learner to sign in, and asks the API for nothing of theirs", async () => {
    localStorage.removeItem(SESSION);
    const { container } = renderLearn();
    expect(screen.getByRole("heading", { level: 1, name: "Aaj" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Apna din dekhne ke liye sign in karo" })).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Sign in karo" })).toHaveAttribute("href", "/practice/demo/signin");
    expect(screen.queryByRole("complementary", { name: "Page ke saath" })).not.toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Learn menu" });
    expect(within(nav).getByRole("link", { name: /Sign in karo/ })).toHaveAttribute("href", "/practice/demo/signin");
    await act(async () => undefined);
    expect(api.calls.filter((c) => c.path !== "/practice/demo/contests")).toEqual([]);
    expect(await violations(container)).toEqual([]);
  });

  it("forgets a session the server no longer knows, and shows the signed-out page", async () => {
    api.routes["GET /practice/demo/home"] = () => ({ status: 401, body: { error: "unauthorized" } });
    api.routes["GET /practice/demo/me"] = () => ({ status: 401, body: { error: "unauthorized" } });
    renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: "Apna din dekhne ke liye sign in karo" })).toBeInTheDocument();
    expect(localStorage.getItem(SESSION)).toBeNull();
  });

  it("offline with nothing loaded, waits for the network; offline with the day loaded, keeps it under a banner", async () => {
    onlineManager.setOnline(false);
    const waiting = renderLearn();
    expect(await screen.findByText("Net aate hi ye dikhega.")).toBeInTheDocument();
    expect(api.calls.filter((c) => c.path === "/practice/demo/home")).toEqual([]);
    expect(await violations(waiting.container)).toEqual([]);
    waiting.unmount();

    onlineManager.setOnline(true);
    renderLearn();
    await day();
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(await screen.findByText("Aap offline ho.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Pair with target sum" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Jo dikh raha hai wo rahega; net aate hi naya ho jayega.")).toBeInTheDocument());
  });
});
