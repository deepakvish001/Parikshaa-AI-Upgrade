import type { Card, Grade, PlanLevel, Task, TaskDraft, TaskKind } from "@parikshaa/store";

/**
 * The study plan's arithmetic, kept pure so it can be tested exactly: the same
 * input always makes the same plan.
 *
 * Scheduling is done here, not by a model. A plan that overbooks a day, skips
 * a prerequisite or changes every time it is asked for is worse than none; a
 * model may explain a plan, but code decides it.
 */

export const DAY_MS = 86_400_000;
export const SPRINT_DAYS = 7;
/** Of a day's minutes, the share left for revision and for running over. */
export const RESERVED_SHARE = 0.2;

export const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
export const weekday = (day: string): number => new Date(`${day}T00:00:00Z`).getUTCDay();
export const daysBetween = (from: string, to: string): number => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

const LEVEL_FACTOR: Record<PlanLevel, number> = { beginner: 1.25, intermediate: 1, advanced: 0.75 };
const PROBLEM_MINUTES = { easy: 20, medium: 40, hard: 60 } as const;

/** One step of a track still to do, in the track's order. */
export interface PlanItem {
  readonly itemId: string;
  readonly kind: Exclude<TaskKind, "revise" | "custom">;
  readonly title: string;
  /** A lesson's own estimate, or null for a problem, which is estimated by difficulty. */
  readonly minutes: number | null;
  readonly difficulty: "easy" | "medium" | "hard" | null;
}

export interface PlanInput {
  readonly items: readonly PlanItem[];
  readonly level: PlanLevel;
  /** The first day of the plan (IST). */
  readonly start: string;
  readonly deadline: string;
  readonly dailyMinutes: number;
  readonly offDays: readonly number[];
}

export interface PlanOutcome {
  readonly tasks: readonly TaskDraft[];
  /** The last day with a task, or the start when there is nothing left to do. */
  readonly finishOn: string;
  readonly fits: boolean;
  readonly totalMinutes: number;
  /** Minutes a study day can hold once revision is set aside. */
  readonly dayCapacity: number;
  readonly studyDaysToDeadline: number;
  readonly sprints: number;
}

export const itemMinutes = (item: PlanItem, level: PlanLevel): number =>
  Math.max(5, Math.round((item.minutes ?? PROBLEM_MINUTES[item.difficulty ?? "medium"]) * (item.minutes === null ? LEVEL_FACTOR[level] : 1)));

export const dayCapacity = (dailyMinutes: number): number => Math.max(10, Math.floor(dailyMinutes * (1 - RESERVED_SHARE)));

/** Study days from `start`, skipping days off; every day when all seven are off, which the caller refuses. */
export function* studyDays(start: string, offDays: readonly number[]): Generator<string> {
  const off = new Set(offDays.length >= 7 ? [] : offDays);
  for (let day = start; ; day = addDays(day, 1)) if (!off.has(weekday(day))) yield day;
}

export function countStudyDays(start: string, end: string, offDays: readonly number[]): number {
  if (end < start) return 0;
  let n = 0;
  for (const day of studyDays(start, offDays)) {
    if (day > end) break;
    n++;
  }
  return n;
}

/**
 * Lay a track's remaining items over study days in order, a day at a time,
 * never past a day's capacity (an item bigger than a day gets a day to
 * itself). Every seventh study day closes a sprint with a revision task.
 */
export function generatePlan(input: PlanInput): PlanOutcome {
  const capacity = dayCapacity(input.dailyMinutes);
  const tasks: TaskDraft[] = [];
  const days = studyDays(input.start, input.offDays);
  let day = days.next().value as string;
  let index = 0;
  let used = 0;
  let position = 0;
  let total = 0;
  const sprintOf = (i: number) => Math.floor(i / SPRINT_DAYS) + 1;
  const nextDay = () => {
    // The last day of a sprint ends with its revision.
    if ((index + 1) % SPRINT_DAYS === 0) tasks.push({ day, sprint: sprintOf(index), position: position++, kind: "revise", itemId: null, title: `Sprint ${sprintOf(index)} revision`, estMinutes: 30 });
    day = days.next().value as string;
    index++;
    used = 0;
    position = 0;
  };
  for (const item of input.items) {
    const minutes = itemMinutes(item, input.level);
    total += minutes;
    if (used > 0 && used + minutes > capacity) nextDay();
    tasks.push({ day, sprint: sprintOf(index), position: position++, kind: item.kind, itemId: item.itemId, title: item.title, estMinutes: minutes });
    used += minutes;
  }
  const finishOn = tasks.length === 0 ? input.start : tasks[tasks.length - 1]!.day;
  const lastSprint = tasks.length === 0 ? 0 : tasks[tasks.length - 1]!.sprint;
  if (tasks.length > 0 && !tasks.some((t) => t.kind === "revise" && t.sprint === lastSprint)) {
    tasks.push({ day: finishOn, sprint: lastSprint, position: position++, kind: "revise", itemId: null, title: `Sprint ${lastSprint} revision`, estMinutes: 30 });
  }
  return {
    tasks,
    finishOn,
    fits: finishOn <= input.deadline,
    totalMinutes: total,
    dayCapacity: capacity,
    studyDaysToDeadline: countStudyDays(input.start, input.deadline, input.offDays),
    sprints: lastSprint,
  };
}

/**
 * Move every open task left on a day before `today` onto the first study day
 * from today with room for it. Nothing is dropped: when the days ahead are
 * full a task goes after them, and the plan's finish date moves with it.
 */
export function reschedule(
  tasks: readonly Task[],
  today: string,
  dailyMinutes: number,
  offDays: readonly number[],
): { readonly moves: readonly { id: string; day: string; position: number; sprint: number }[]; readonly finishOn: string | null } {
  const capacity = dayCapacity(dailyMinutes);
  const overdue = tasks.filter((t) => t.doneAt === null && t.day < today).sort((a, b) => a.day.localeCompare(b.day) || a.position - b.position);
  const load = new Map<string, number>();
  const count = new Map<string, number>();
  const sprintOn = new Map<string, number>();
  for (const t of tasks) {
    if (t.day < today) continue;
    load.set(t.day, (load.get(t.day) ?? 0) + (t.doneAt === null ? t.estMinutes : 0));
    count.set(t.day, (count.get(t.day) ?? 0) + 1);
    sprintOn.set(t.day, t.sprint);
  }
  const moves: { id: string; day: string; position: number; sprint: number }[] = [];
  let lastSprint = Math.max(1, ...tasks.map((t) => t.sprint));
  for (const task of overdue) {
    let placed: string | null = null;
    for (const day of studyDays(today, offDays)) {
      const used = load.get(day) ?? 0;
      if (used === 0 || used + task.estMinutes <= capacity) {
        placed = day;
        break;
      }
    }
    const day = placed!;
    load.set(day, (load.get(day) ?? 0) + task.estMinutes);
    const position = count.get(day) ?? 0;
    count.set(day, position + 1);
    const sprint = sprintOn.get(day) ?? lastSprint;
    sprintOn.set(day, sprint);
    lastSprint = Math.max(lastSprint, sprint);
    moves.push({ id: task.id, day, position, sprint });
  }
  const days = [...tasks.filter((t) => t.day >= today).map((t) => t.day), ...moves.map((m) => m.day)].sort();
  return { moves, finishOn: days.length === 0 ? null : days[days.length - 1]! };
}

/**
 * Spaced revision, SM-2 in a small form: the gap grows by the card's ease when
 * it is remembered, and starts again when it is not.
 */
export function review(card: Card, grade: Grade, today: string, at: string): Card {
  let ease = card.ease;
  let interval: number;
  switch (grade) {
    case "again":
      interval = 1;
      ease -= 0.2;
      break;
    case "hard":
      interval = Math.max(1, Math.round(card.intervalDays * 1.2));
      ease -= 0.15;
      break;
    case "good":
      interval = card.reps === 0 ? 3 : Math.max(card.intervalDays + 1, Math.round(card.intervalDays * ease));
      break;
    case "easy":
      interval = card.reps === 0 ? 7 : Math.max(card.intervalDays + 2, Math.round(card.intervalDays * ease * 1.3));
      ease += 0.15;
      break;
  }
  ease = Math.round(Math.max(1.3, Math.min(3.5, ease)) * 100) / 100;
  interval = Math.min(interval, 365);
  return { ...card, ease, intervalDays: interval, dueOn: addDays(today, interval), reps: card.reps + 1, lastGrade: grade, reviewedAt: at };
}
