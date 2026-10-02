import { describe, expect, it } from "vitest";
import type { Card, Task } from "@parikshaa/store";
import { addDays, countStudyDays, dayCapacity, generatePlan, reschedule, review, type PlanItem } from "./prep-plan.js";

/** The study plan's arithmetic: laying items over days, moving what was missed, spacing revision. */

const problem = (n: number, difficulty: "easy" | "medium" | "hard" = "medium"): PlanItem => ({ itemId: `p${n}`, kind: "practice", title: `P${n}`, minutes: null, difficulty });
const lesson = (n: number, minutes: number): PlanItem => ({ itemId: `l${n}`, kind: "learn", title: `L${n}`, minutes, difficulty: null });

// 2026-10-05 is a Monday.
const MONDAY = "2026-10-05";

describe("generatePlan", () => {
  it("fills each study day up to its capacity, in the track's order, and skips days off", () => {
    const outcome = generatePlan({
      items: [lesson(1, 15), problem(1), problem(2), problem(3), problem(4, "easy")],
      level: "intermediate",
      start: MONDAY,
      deadline: "2026-10-30",
      dailyMinutes: 75, // 60 a day once revision is set aside
      offDays: [2], // Tuesdays off
    });
    const work = outcome.tasks.filter((t) => t.kind !== "revise");
    expect(dayCapacity(75)).toBe(60);
    expect(work.map((t) => [t.itemId, t.day])).toEqual([
      ["l1", MONDAY], // 15
      ["p1", MONDAY], // 15 + 40 = 55
      ["p2", "2026-10-07"], // Tuesday is off
      ["p3", "2026-10-08"],
      ["p4", "2026-10-08"], // 40 + 20 = 60
    ]);
    expect(outcome).toMatchObject({ finishOn: "2026-10-08", fits: true, totalMinutes: 155, sprints: 1 });
    // The last sprint ends with its revision.
    expect(outcome.tasks.at(-1)).toMatchObject({ kind: "revise", day: "2026-10-08", sprint: 1 });
  });

  it("gives the weekend its own minutes", () => {
    // Saturday the 10th and Sunday the 11th hold 120 a day (96 once revision is set aside); weekdays 30 (24).
    const outcome = generatePlan({
      items: [problem(1, "easy"), problem(2, "easy"), problem(3, "easy"), problem(4, "easy")],
      level: "intermediate",
      start: "2026-10-09",
      deadline: "2026-10-30",
      dailyMinutes: 30,
      weekendMinutes: 120,
      offDays: [],
    });
    expect(outcome.tasks.filter((t) => t.kind === "practice").map((t) => t.day)).toEqual(["2026-10-09", "2026-10-10", "2026-10-10", "2026-10-10"]);
    // Moving work on fills a weekend day up to its own capacity too.
    const late = reschedule([task("a", "2026-10-08", 40), task("b", "2026-10-08", 40), task("c", "2026-10-08", 40)], "2026-10-10", 30, [], 120);
    expect(late.moves.map((m) => m.day)).toEqual(["2026-10-10", "2026-10-10", "2026-10-11"]);
  });

  it("gives an item bigger than a day a day to itself, and says when it will not finish in time", () => {
    const outcome = generatePlan({ items: [problem(1, "hard"), problem(2, "hard")], level: "beginner", start: MONDAY, deadline: "2026-10-05", dailyMinutes: 30, offDays: [] });
    expect(outcome.tasks.filter((t) => t.kind === "practice").map((t) => [t.estMinutes, t.day])).toEqual([
      [75, MONDAY],
      [75, "2026-10-06"],
    ]);
    expect(outcome.fits).toBe(false);
  });

  it("closes every seventh study day's sprint with a revision and numbers the sprints", () => {
    const items = Array.from({ length: 10 }, (_, i) => problem(i, "hard"));
    const outcome = generatePlan({ items, level: "intermediate", start: MONDAY, deadline: "2026-12-31", dailyMinutes: 75, offDays: [] });
    const revisions = outcome.tasks.filter((t) => t.kind === "revise");
    expect(revisions.map((t) => [t.day, t.sprint])).toEqual([
      ["2026-10-11", 1],
      ["2026-10-14", 2],
    ]);
    expect(outcome.tasks.filter((t) => t.kind === "practice").at(-1)).toMatchObject({ day: "2026-10-14", sprint: 2 });
  });

  it("is the same plan every time for the same input", () => {
    const input = { items: [lesson(1, 30), problem(1), problem(2, "hard")], level: "advanced" as const, start: MONDAY, deadline: "2026-11-01", dailyMinutes: 60, offDays: [0] };
    expect(generatePlan(input)).toEqual(generatePlan(input));
  });
});

const task = (id: string, day: string, est: number, done = false, sprint = 1): Task => ({
  id,
  day,
  sprint,
  position: 0,
  kind: "practice",
  itemId: id,
  title: id,
  estMinutes: est,
  doneAt: done ? `${day}T10:00:00.000Z` : null,
  rescheduledFrom: null,
});

describe("reschedule", () => {
  it("moves what was left undone onto the first day with room, and drops nothing", () => {
    const tasks = [task("a", "2026-10-05", 40, true), task("b", "2026-10-05", 40), task("c", "2026-10-06", 40), task("d", "2026-10-07", 50), task("e", "2026-10-08", 20)];
    // Today is Wednesday the 7th; 60 minutes a day.
    const { moves, finishOn } = reschedule(tasks, "2026-10-07", 75, []);
    expect(moves.map((m) => [m.id, m.day])).toEqual([
      ["b", "2026-10-08"], // the 7th has 50 already; the 8th has 20 + 40 = 60
      ["c", "2026-10-09"],
    ]);
    expect(finishOn).toBe("2026-10-09");
  });

  it("does nothing when nothing is overdue", () => {
    expect(reschedule([task("a", "2026-10-07", 30)], "2026-10-07", 60, []).moves).toEqual([]);
  });

  it("does not move onto a day off", () => {
    const { moves } = reschedule([task("a", "2026-10-05", 30)], "2026-10-11", 60, [0]); // the 11th is a Sunday
    expect(moves[0]!.day).toBe("2026-10-12");
  });
});

describe("review", () => {
  const card: Card = { problemId: "p", dueOn: "2026-10-06", intervalDays: 1, ease: 2.5, reps: 0, lastGrade: null, reviewedAt: null };

  it("spaces a remembered problem further out each time, and starts again when forgotten", () => {
    const first = review(card, "good", "2026-10-06", "t");
    expect(first).toMatchObject({ intervalDays: 3, dueOn: "2026-10-09", reps: 1, ease: 2.5, lastGrade: "good" });
    const second = review(first, "good", "2026-10-09", "t");
    expect(second).toMatchObject({ intervalDays: 8, dueOn: "2026-10-17" });
    const forgot = review(second, "again", "2026-10-17", "t");
    expect(forgot).toMatchObject({ intervalDays: 1, dueOn: "2026-10-18", ease: 2.3 });
  });

  it("keeps ease within bounds and an interval within a year", () => {
    let c = card;
    for (let i = 0; i < 12; i++) c = review(c, "again", "2026-10-06", "t");
    expect(c.ease).toBe(1.3);
    for (let i = 0; i < 20; i++) c = review(c, "easy", "2026-10-06", "t");
    expect(c.ease).toBe(3.5);
    expect(c.intervalDays).toBe(365);
  });
});

describe("dates", () => {
  it("counts study days and adds days across a month's end", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(countStudyDays(MONDAY, "2026-10-11", [0, 6])).toBe(5);
    expect(countStudyDays("2026-10-11", MONDAY, [])).toBe(0);
  });
});
