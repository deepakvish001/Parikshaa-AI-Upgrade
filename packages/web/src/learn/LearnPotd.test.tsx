import { onlineManager } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PotdView } from "../practice/client.ts";
import { fakeApi, renderLearn, SESSION, SITE, type FakeApi } from "./fake-api.tsx";
import { dayKind, istMonth, monthGrid, PD, shiftMonth } from "./LearnPotd.tsx";

/**
 * Learn's problem of the day (tracker row 140, K2-4) against a fake of the
 * practice site's API: today's problem, the streak, the month as a calendar
 * whose days say what they were (solved on the day, later, missed, a day off,
 * today, to come) in words, months back and forward; signed out, none today,
 * failed and offline; axe finding nothing.
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
const day = (d: string, slug: string, title: string, solved: boolean, solvedThatDay: boolean) => ({ day: d, slug, title, difficulty: "medium" as const, solved, solvedThatDay });

const OCTOBER: PotdView = {
  today: day("2026-10-27", "koko", "Koko eating bananas", false, false),
  calendar: [
    day("2026-10-27", "koko", "Koko eating bananas", false, false),
    day("2026-10-26", "pair-sum", "Pair with target sum", true, true),
    day("2026-10-25", "valid-brackets", "Valid brackets", true, false),
    day("2026-10-24", "bellman", "Shortest paths", false, false),
  ],
  date: "2026-10-27",
  daysOff: ["2026-10-23"],
};
const SEPTEMBER: PotdView = { ...OCTOBER, calendar: [day("2026-09-30", "stack", "Min stack", true, true)], daysOff: [] };

let api: FakeApi;
let months: string[];
beforeEach(() => {
  localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.matchMedia = vi.fn((query: string) => ({ matches: false, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-27T06:30:00Z"));
  localStorage.setItem(SESSION, "pl_good");
  months = [];
  api = fakeApi();
  api.routes["GET /practice/demo/potd"] = (url) => {
    const month = url.searchParams.get("month") ?? "";
    months.push(month);
    return { body: month === "2026-09" ? SEPTEMBER : OCTOBER };
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  onlineManager.setOnline(true);
  document.documentElement.removeAttribute("data-theme");
});

describe("the problem of the day", () => {
  it("shows today's problem, the streak and the month, each day in words", async () => {
    at("/potd");
    const { container } = renderLearn();
    expect(await screen.findByRole("heading", { level: 1, name: "Koko eating bananas" })).toBeInTheDocument();
    expect(months[0]).toBe("2026-10");
    expect(screen.getByRole("link", { name: /Abhi solve karo/ })).toHaveAttribute("href", `/practice/${SITE}/problems/koko`);
    expect(await screen.findByText("12 din")).toBeInTheDocument();
    expect(screen.getByText("Is mahine 1 chhutti baaki")).toBeInTheDocument();
    expect(screen.getByText("4 me se 1 usi din solve")).toBeInTheDocument();
    const grid = screen.getByRole("table");
    expect(within(grid).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Som", "Mangal", "Budh", "Guru", "Shukra", "Shani", "Ravi"]);
    // 1 October 2026 is a Thursday: three empty cells first.
    expect(within(grid).getAllByRole("cell")[3]).toHaveTextContent(/^1/);
    expect(within(grid).getByRole("link", { name: /^26Pair with target sum, usi din solve$/ })).toHaveAttribute("href", `/practice/${SITE}/problems/pair-sum`);
    expect(within(grid).getByRole("link", { name: /Valid brackets, baad me solve/ })).toBeInTheDocument();
    expect(within(grid).getByRole("link", { name: /Shortest paths, chhoot gaya/ })).toBeInTheDocument();
    expect(within(grid).getByText("chhutti").closest("td")).toHaveTextContent("23");
    expect(within(grid).getByRole("link", { name: /Koko eating bananas, aaj/ }).closest("td")).toHaveAttribute("aria-current", "date");
    expect(within(grid).getAllByText("abhi aana hai")).toHaveLength(4);
    expect(screen.getByRole("button", { name: hg(PD.nextMonth) })).toBeDisabled();
    expect(await violations(container)).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: hg(PD.prevMonth) }));
    expect(await within(screen.getByRole("table")).findByRole("link", { name: /Min stack, usi din solve/ })).toBeInTheDocument();
    expect(months).toContain("2026-09");
    expect(screen.getByRole("button", { name: hg(PD.nextMonth) })).toBeEnabled();
  });

  it("solved today, none today, signed out, failed and offline", async () => {
    api.routes["GET /practice/demo/potd"] = () => ({ body: { ...OCTOBER, today: { ...OCTOBER.today!, solved: true, solvedThatDay: true } } });
    at("/potd");
    const first = renderLearn();
    expect(await screen.findByText(hg(PD.solvedToday))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Phir kholo/ })).toBeInTheDocument();
    first.unmount();

    api.routes["GET /practice/demo/potd"] = () => ({ body: { ...OCTOBER, today: null } });
    const second = renderLearn();
    expect(await screen.findByRole("heading", { level: 2, name: hg(PD.noneToday) })).toBeInTheDocument();
    expect(await violations(second.container)).toEqual([]);
    second.unmount();

    localStorage.removeItem(SESSION);
    api.calls.length = 0;
    api.routes["GET /practice/demo/potd"] = () => ({ body: { ...OCTOBER, daysOff: [] } });
    const third = renderLearn();
    expect(await screen.findByText(hg(PD.signedOut))).toBeInTheDocument();
    expect(screen.queryByText(hg(PD.streak))).not.toBeInTheDocument();
    expect(api.calls.every((c) => c.auth === null)).toBe(true);
    expect(await violations(third.container)).toEqual([]);
    third.unmount();

    api.routes["GET /practice/demo/potd"] = () => ({ status: 500, body: { error: "internal", message: "boom" } });
    const fourth = renderLearn();
    expect(await screen.findByRole("button", { name: /Phir koshish/ })).toBeInTheDocument();
    fourth.unmount();

    act(() => onlineManager.setOnline(false));
    renderLearn();
    await waitFor(() => expect(screen.getByText("Net aate hi ye dikhega.")).toBeInTheDocument());
  });

  it("draws a month from Monday and names each day", () => {
    expect(istMonth(Date.parse("2026-10-31T19:00:00Z"))).toBe("2026-11");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    const feb = monthGrid("2027-02");
    expect(feb[0]).toEqual(["2027-02-01", "2027-02-02", "2027-02-03", "2027-02-04", "2027-02-05", "2027-02-06", "2027-02-07"]);
    expect(feb).toHaveLength(4);
    const off = new Set(["2026-10-20"]);
    expect(dayKind("2026-10-20", "2026-10-27", undefined, off)).toBe("off");
    expect(dayKind("2026-10-21", "2026-10-27", undefined, off)).toBe("none");
    expect(dayKind("2026-10-28", "2026-10-27", undefined, off)).toBe("future");
    expect(dayKind("2026-10-27", "2026-10-27", OCTOBER.today!, off)).toBe("today");
  });
});
