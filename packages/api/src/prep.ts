import type { OrgId } from "@parikshaa/core";
import {
  practiceLearner,
  practiceStaff,
  type Difficulty,
  type Grade,
  type Learner,
  type Lesson,
  type NoteKind,
  type PlanLevel,
  type PracticeProblem,
  type PracticeSite,
  type PracticeStore,
  type PrepStore,
  type Task,
  type Track,
} from "@parikshaa/store";
import { PracticeError, istDay, slugOf, streaks } from "./practice.js";
import { addDays, countStudyDays, daysBetween, generatePlan, reschedule, review, type PlanItem } from "./prep-plan.js";

/**
 * Prep (ROADMAP §16): the practice site as a place to prepare, not only a
 * problem set. Tracks lead through lessons and problems; a study plan puts
 * them on days and moves what was missed; solved problems come back for
 * revision; coins and a streak reward keeping at it.
 *
 * Everything a learner reads here is theirs or published. Rewards are paid by
 * the server alone, each under a key that makes paying it twice a no-op.
 */

/** What each thing pays. Milestones are outside the daily cap. */
export const COINS = {
  checkin: 1,
  solve: { easy: 10, medium: 15, hard: 20 } as Record<Difficulty, number>,
  potd: 5,
  lesson: 5,
  module: 100,
  track: 1000,
  streak: new Map<number, number>([
    [7, 50],
    [30, 250],
    [100, 1000],
    [365, 5000],
  ]),
} as const;
export const DAILY_COIN_CAP = 300;
const MILESTONES = ["module", "track", "streak"];
/** Cards shown for revision in a day, oldest first; the rest wait. */
export const REVISE_PER_DAY = 15;
const LIST_NAME = /^[\p{L}\p{N} _\-'&()]{1,60}$/u;

export interface ItemView {
  readonly kind: "problem" | "lesson";
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty | null;
  readonly estMinutes: number;
  readonly status: "done" | "attempted" | null;
}

export interface Reward {
  readonly coins: number;
  readonly reasons: readonly string[];
}

const NONE: Reward = { coins: 0, reasons: [] };

interface State {
  readonly problems: ReadonlyMap<string, PracticeProblem>;
  readonly lessons: ReadonlyMap<string, Lesson>;
  readonly tracks: readonly Track[];
  readonly solved: ReadonlySet<string>;
  readonly attempted: ReadonlySet<string>;
  readonly lessonsDone: ReadonlySet<string>;
  readonly progress: { readonly days: readonly { readonly day: string; readonly accepted: number }[] };
  /** IST days on which a lesson was finished. */
  readonly doneDays: readonly string[];
}

const levels: readonly PlanLevel[] = ["beginner", "intermediate", "advanced"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class PrepService {
  readonly #practice: PracticeStore;
  readonly #store: PrepStore;
  readonly #now: () => number;

  constructor(options: { practice: PracticeStore; store: PrepStore; now?: () => number }) {
    this.#practice = options.practice;
    this.#store = options.store;
    this.#now = options.now ?? (() => Date.now());
  }

  #today(): string {
    return istDay(this.#now());
  }

  // --- what a learner has done -----------------------------------------------------------

  async #state(site: PracticeSite, learner: Learner | null): Promise<State> {
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const [problems, lessons, tracks, progress, done] = await Promise.all([
      this.#practice.problems(scope),
      this.#store.lessons(scope),
      this.#store.tracks(scope),
      this.#practice.progress(scope),
      this.#store.lessonsDone(scope),
    ]);
    return {
      problems: new Map(problems.map((p) => [p.id, p])),
      lessons: new Map(lessons.map((l) => [l.id, l])),
      tracks,
      solved: new Set(progress.solved.map((s) => s.problemId)),
      attempted: new Set(progress.attempted),
      lessonsDone: new Set(done.map((d) => d.lessonId)),
      progress,
      doneDays: done.map((d) => istDay(Date.parse(d.at))),
    };
  }

  #items(track: Track, state: State) {
    return track.modules.map((m) => ({
      title: m.title,
      items: m.items.flatMap((item): (ItemView & { id: string })[] => {
        if (item.problemId !== null) {
          const p = state.problems.get(item.problemId);
          if (p === undefined) return [];
          return [
            {
              id: p.id,
              kind: "problem",
              slug: p.slug,
              title: p.title,
              difficulty: p.difficulty,
              estMinutes: { easy: 20, medium: 40, hard: 60 }[p.difficulty],
              status: state.solved.has(p.id) ? "done" : state.attempted.has(p.id) ? "attempted" : null,
            },
          ];
        }
        const l = item.lessonId === null ? undefined : state.lessons.get(item.lessonId);
        if (l === undefined) return [];
        return [{ id: l.id, kind: "lesson", slug: l.slug, title: l.title, difficulty: null, estMinutes: l.estMinutes, status: state.lessonsDone.has(l.id) ? "done" : null }];
      }),
    }));
  }

  // --- tracks and lessons -------------------------------------------------------------------

  async tracks(site: PracticeSite, learner: Learner | null) {
    const state = await this.#state(site, learner);
    return state.tracks.map((t) => {
      const items = this.#items(t, state).flatMap((m) => m.items);
      return { slug: t.slug, title: t.title, description: t.description, modules: t.modules.length, items: items.length, done: items.filter((i) => i.status === "done").length };
    });
  }

  async track(site: PracticeSite, slug: string, learner: Learner | null) {
    const state = await this.#state(site, learner);
    const track = state.tracks.find((t) => t.slug === slug);
    if (track === undefined) throw new PracticeError("not_found", "No such track");
    const modules = this.#items(track, state).map((m) => ({ title: m.title, items: m.items.map(({ id: _, ...item }) => item) }));
    const items = modules.flatMap((m) => m.items);
    return {
      slug: track.slug,
      title: track.title,
      description: track.description,
      items: items.length,
      done: items.filter((i) => i.status === "done").length,
      modules: modules.map((m) => ({ ...m, done: m.items.filter((i) => i.status === "done").length })),
    };
  }

  async lesson(site: PracticeSite, slug: string, learner: Learner | null) {
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const lesson = await this.#store.lessonBySlug(scope, slug);
    if (lesson === null) throw new PracticeError("not_found", "No such lesson");
    const done = learner === null ? false : (await this.#store.lessonsDone(scope)).some((d) => d.lessonId === lesson.id);
    return { slug: lesson.slug, title: lesson.title, body: lesson.body, videoUrl: lesson.videoUrl === "" ? null : lesson.videoUrl, estMinutes: lesson.estMinutes, done };
  }

  async completeLesson(site: PracticeSite, learner: Learner, slug: string): Promise<Reward> {
    const scope = practiceLearner(site.orgId, learner.id);
    const lesson = await this.#store.lessonBySlug(scope, slug);
    if (lesson === null) throw new PracticeError("not_found", "No such lesson");
    const first = await this.#store.markLessonDone(scope, lesson.id, new Date(this.#now()));
    await this.#store.completeItem(scope, lesson.id, new Date(this.#now()));
    if (!first) return NONE;
    const rewards = [await this.#pay(site, learner, "lesson", COINS.lesson, `lesson:${lesson.id}`)];
    rewards.push(...(await this.#milestones(site, learner)));
    return merge(rewards);
  }

  // --- rewards ------------------------------------------------------------------------------------

  async #pay(site: PracticeSite, learner: Learner, rule: string, amount: number, key: string): Promise<Reward> {
    let pay = amount;
    if (!MILESTONES.includes(rule)) {
      const start = Date.parse(`${this.#today()}T00:00:00+05:30`);
      const earned = await this.#store.earnedSince(site.orgId, learner.id, new Date(start), MILESTONES);
      pay = Math.min(amount, Math.max(0, DAILY_COIN_CAP - earned));
      if (pay === 0) return NONE;
    }
    return (await this.#store.award(site.orgId, learner.id, { rule, amount: pay, key }, new Date(this.#now()))) ? { coins: pay, reasons: [rule] } : NONE;
  }

  /** Modules and tracks finished, and streaks reached, each paid once. */
  async #milestones(site: PracticeSite, learner: Learner): Promise<Reward[]> {
    const state = await this.#state(site, learner);
    const rewards: Reward[] = [];
    for (const track of state.tracks) {
      const modules = this.#items(track, state);
      for (const [i, m] of modules.entries()) {
        if (m.items.length > 0 && m.items.every((x) => x.status === "done")) rewards.push(await this.#pay(site, learner, "module", COINS.module, `module:${track.modules[i]!.id}`));
      }
      const all = modules.flatMap((m) => m.items);
      if (all.length > 0 && all.every((x) => x.status === "done")) rewards.push(await this.#pay(site, learner, "track", COINS.track, `track:${track.id}`));
    }
    const { current } = this.#streak(state);
    for (const [days, amount] of COINS.streak) if (current >= days) rewards.push(await this.#pay(site, learner, "streak", amount, `streak:${days}`));
    return rewards;
  }

  #streak(state: State) {
    const days = [...state.progress.days, ...state.doneDays.map((day) => ({ day, accepted: 1 }))];
    return streaks(days, this.#today());
  }

  /**
   * After a submission is judged: a first solve pays coins (and the day's
   * problem a bonus), completes its plan task and becomes a revision card.
   */
  async afterSubmit(site: PracticeSite, learner: Learner, problemSlug: string, verdict: { readonly status: string; readonly firstSolve: boolean }): Promise<Reward> {
    if (verdict.status !== "passed") return NONE;
    const scope = practiceLearner(site.orgId, learner.id);
    const problem = await this.#practice.problemBySlug(practiceStaff(site.orgId), problemSlug);
    if (problem === null) return NONE;
    await this.#store.completeItem(scope, problem.id, new Date(this.#now()));
    if (!verdict.firstSolve) return NONE;
    const today = this.#today();
    await this.#store.addCard(scope, problem.id, addDays(today, 1));
    const rewards = [await this.#pay(site, learner, "solve", COINS.solve[problem.difficulty], `solve:${problem.id}`)];
    const [potd] = await this.#store.potd(scope, today, today);
    if (potd?.problemId === problem.id) rewards.push(await this.#pay(site, learner, "potd", COINS.potd, `potd:${today}`));
    rewards.push(...(await this.#milestones(site, learner)));
    return merge(rewards);
  }

  // --- the dashboard ------------------------------------------------------------------------------

  async home(site: PracticeSite, learner: Learner) {
    const today = this.#today();
    const checkin = await this.#pay(site, learner, "checkin", COINS.checkin, `checkin:${today}`);
    const scope = practiceLearner(site.orgId, learner.id);
    const [state, coins, cards, potd, focus] = await Promise.all([
      this.#state(site, learner),
      this.#store.coins(scope, 0),
      this.#store.cards(scope),
      this.potd(site, learner),
      this.#store.focusByDay(scope, today),
    ]);
    const { current, longest } = this.#streak(state);
    const plan = await this.plan(site, learner);
    const continuing = state.tracks
      .map((t) => {
        const items = this.#items(t, state).flatMap((m) => m.items);
        const next = items.find((i) => i.status !== "done");
        return { slug: t.slug, title: t.title, items: items.length, done: items.filter((i) => i.status === "done").length, next: next === undefined ? null : { kind: next.kind, slug: next.slug, title: next.title } };
      })
      .filter((t) => t.items > 0 && t.done < t.items);
    const active = plan === null ? undefined : continuing.find((t) => t.slug === plan.track.slug);
    return {
      name: learner.name,
      today,
      streak: current,
      longestStreak: longest,
      coins: coins.balance,
      checkin: checkin.coins,
      dueCards: Math.min(REVISE_PER_DAY, cards.filter((c) => c.dueOn <= today).length),
      focusMinutesToday: Math.round((focus[0]?.seconds ?? 0) / 60),
      potd: potd.today,
      plan: plan === null ? null : { track: plan.track, finishOn: plan.finishOn, deadline: plan.deadline, sprint: plan.sprint, sprints: plan.sprints, today: plan.today, moved: plan.moved },
      continue: active ?? continuing[0] ?? null,
      solved: state.solved.size,
    };
  }

  // --- the plan ------------------------------------------------------------------------------------

  #planInput(input: { track: string; level: string; deadline: string; dailyMinutes: number; offDays: readonly number[] }) {
    const today = this.#today();
    if (!levels.includes(input.level as PlanLevel)) throw new PracticeError("invalid", "A level is beginner, intermediate or advanced");
    if (!DAY.test(input.deadline) || input.deadline < addDays(today, 6)) throw new PracticeError("invalid", "A deadline is a date at least a week away");
    if (input.deadline > addDays(today, 3 * 365)) throw new PracticeError("invalid", "A deadline is within three years");
    if (!Number.isInteger(input.dailyMinutes) || input.dailyMinutes < 15 || input.dailyMinutes > 720) throw new PracticeError("invalid", "Study 15 minutes to 12 hours a day");
    const offDays = [...new Set(input.offDays)].sort();
    if (offDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new PracticeError("invalid", "Days off are 0 (Sunday) to 6 (Saturday)");
    if (offDays.length >= 7) throw new PracticeError("invalid", "Leave at least one day a week to study");
    return { today, level: input.level as PlanLevel, offDays };
  }

  async #planFor(site: PracticeSite, learner: Learner, input: { track: string; level: string; deadline: string; dailyMinutes: number; offDays: readonly number[] }) {
    const { today, level, offDays } = this.#planInput(input);
    const state = await this.#state(site, learner);
    const track = state.tracks.find((t) => t.slug === input.track);
    if (track === undefined) throw new PracticeError("not_found", "No such track");
    const items: PlanItem[] = this.#items(track, state)
      .flatMap((m) => m.items)
      .filter((i) => i.status !== "done")
      .map((i) => ({ itemId: i.id, kind: i.kind === "lesson" ? "learn" : "practice", title: i.title, minutes: i.kind === "lesson" ? i.estMinutes : null, difficulty: i.difficulty }));
    const outcome = generatePlan({ items, level, start: today, deadline: input.deadline, dailyMinutes: input.dailyMinutes, offDays });
    return { track, level, offDays, outcome };
  }

  /** What a plan would be, before it is started. */
  async previewPlan(site: PracticeSite, learner: Learner, input: { track: string; level: string; deadline: string; dailyMinutes: number; offDays: readonly number[] }) {
    const { track, outcome } = await this.#planFor(site, learner, input);
    const neededMinutes = outcome.studyDaysToDeadline === 0 ? null : Math.ceil(outcome.totalMinutes / outcome.studyDaysToDeadline / 0.8 / 5) * 5;
    return {
      track: { slug: track.slug, title: track.title },
      tasks: outcome.tasks.filter((t) => t.kind !== "revise").length,
      totalMinutes: outcome.totalMinutes,
      finishOn: outcome.finishOn,
      deadline: input.deadline,
      fits: outcome.fits,
      sprints: sprintSummary(outcome.tasks),
      // When it does not fit: how much a day it would take to finish in time.
      dailyMinutesToFit: outcome.fits || neededMinutes === null ? null : Math.min(720, Math.max(input.dailyMinutes + 5, neededMinutes)),
    };
  }

  async startPlan(site: PracticeSite, learner: Learner, input: { track: string; level: string; deadline: string; dailyMinutes: number; offDays: readonly number[]; goal?: string | undefined }) {
    const { track, level, offDays, outcome } = await this.#planFor(site, learner, input);
    const goal = (input.goal ?? "").trim().slice(0, 200);
    await this.#store.startPlan(
      practiceLearner(site.orgId, learner.id),
      { trackId: track.id, level, deadline: input.deadline, dailyMinutes: input.dailyMinutes, offDays, goal },
      outcome.tasks,
    );
    return (await this.plan(site, learner))!;
  }

  async archivePlan(site: PracticeSite, learner: Learner): Promise<void> {
    await this.#store.archivePlan(practiceLearner(site.orgId, learner.id));
  }

  /** The active plan, after moving on whatever was left undone on days gone by. */
  async plan(site: PracticeSite, learner: Learner) {
    const scope = practiceLearner(site.orgId, learner.id);
    const plan = await this.#store.activePlan(scope);
    if (plan === null) return null;
    const today = this.#today();
    let tasks = await this.#store.tasks(scope, plan.id);
    const { moves } = reschedule(tasks, today, plan.dailyMinutes, plan.offDays);
    if (moves.length > 0) {
      await this.#store.moveTasks(scope, moves);
      tasks = await this.#store.tasks(scope, plan.id);
    }
    const tracks = await this.#store.tracks(scope);
    const track = tracks.find((t) => t.id === plan.trackId);
    const open = tasks.filter((t) => t.doneAt === null);
    const finishOn = tasks.length === 0 ? today : [...tasks].sort((a, b) => b.day.localeCompare(a.day))[0]!.day;
    const todays = tasks.filter((t) => t.day === today);
    const current = todays[0]?.sprint ?? open[0]?.sprint ?? Math.max(0, ...tasks.map((t) => t.sprint));
    return {
      track: { slug: track?.slug ?? "", title: track?.title ?? "Track" },
      level: plan.level,
      deadline: plan.deadline,
      dailyMinutes: plan.dailyMinutes,
      offDays: plan.offDays,
      goal: plan.goal,
      startedAt: plan.createdAt,
      finishOn,
      onTrack: finishOn <= plan.deadline,
      daysLeft: Math.max(0, daysBetween(today, plan.deadline)),
      studyDaysLeft: countStudyDays(today, plan.deadline, plan.offDays),
      done: tasks.filter((t) => t.doneAt !== null).length,
      total: tasks.length,
      sprint: current,
      sprints: sprintSummary(tasks),
      moved: moves.length,
      today: await this.#taskViews(site, todays),
      upcoming: await this.#taskViews(site, tasks.filter((t) => t.day > today).slice(0, 40)),
      completed: await this.#taskViews(site, tasks.filter((t) => t.doneAt !== null).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!)).slice(0, 40)),
    };
  }

  async #taskViews(site: PracticeSite, tasks: readonly Task[]) {
    if (tasks.length === 0) return [];
    const scope = practiceStaff(site.orgId);
    const [problems, lessons] = await Promise.all([this.#practice.problems(scope), this.#store.lessons(scope)]);
    const problemOf = new Map(problems.map((p) => [p.id, p]));
    const lessonOf = new Map(lessons.map((l) => [l.id, l]));
    return tasks.map((t) => {
      const p = t.itemId === null ? undefined : problemOf.get(t.itemId);
      const l = t.itemId === null ? undefined : lessonOf.get(t.itemId);
      return {
        id: t.id,
        day: t.day,
        sprint: t.sprint,
        kind: t.kind,
        title: t.title,
        estMinutes: t.estMinutes,
        done: t.doneAt !== null,
        movedFrom: t.rescheduledFrom,
        link: p !== undefined ? { kind: "problem" as const, slug: p.slug } : l !== undefined ? { kind: "lesson" as const, slug: l.slug } : null,
        difficulty: p?.difficulty ?? null,
      };
    });
  }

  async addTask(site: PracticeSite, learner: Learner, input: { title: string; estMinutes: number; day?: string }) {
    const scope = practiceLearner(site.orgId, learner.id);
    const plan = await this.#store.activePlan(scope);
    if (plan === null) throw new PracticeError("not_found", "Start a plan first");
    const title = input.title.trim();
    if (title.length < 1 || title.length > 200) throw new PracticeError("invalid", "A task is 1 to 200 characters");
    if (!Number.isInteger(input.estMinutes) || input.estMinutes < 1 || input.estMinutes > 600) throw new PracticeError("invalid", "A task takes 1 to 600 minutes");
    const today = this.#today();
    const day = input.day ?? today;
    if (!DAY.test(day) || day < today) throw new PracticeError("invalid", "A task is for today or a day to come");
    const tasks = await this.#store.tasks(scope, plan.id);
    const sameDay = tasks.filter((t) => t.day === day);
    const sprint = sameDay[0]?.sprint ?? tasks.filter((t) => t.day <= day).at(-1)?.sprint ?? 1;
    await this.#store.addTask(scope, plan.id, { day, sprint, position: sameDay.length, kind: "custom", itemId: null, title, estMinutes: input.estMinutes });
  }

  async setTaskDone(site: PracticeSite, learner: Learner, id: string, done: boolean): Promise<void> {
    if (!(await this.#store.setTaskDone(practiceLearner(site.orgId, learner.id), id, done ? new Date(this.#now()) : null))) throw new PracticeError("not_found", "No such task");
  }

  async startFocus(site: PracticeSite, learner: Learner, taskId: string | null) {
    const id = await this.#store.startFocus(practiceLearner(site.orgId, learner.id), taskId, new Date(this.#now()));
    return { id, startedAt: new Date(this.#now()).toISOString() };
  }

  async stopFocus(site: PracticeSite, learner: Learner, id: string) {
    const seconds = await this.#store.stopFocus(practiceLearner(site.orgId, learner.id), id, new Date(this.#now()));
    if (seconds === null) throw new PracticeError("not_found", "No such focus session");
    return { seconds };
  }

  async focusWeek(site: PracticeSite, learner: Learner) {
    const today = this.#today();
    const days = await this.#store.focusByDay(practiceLearner(site.orgId, learner.id), addDays(today, -6));
    return { days: Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((day) => ({ day, minutes: Math.round((days.find((d) => d.day === day)?.seconds ?? 0) / 60) })) };
  }

  // --- revision ------------------------------------------------------------------------------------

  async revision(site: PracticeSite, learner: Learner) {
    const scope = practiceLearner(site.orgId, learner.id);
    const today = this.#today();
    const [cards, problems, notes] = await Promise.all([this.#store.cards(scope), this.#practice.problems(scope), this.#store.notes(scope)]);
    const problemOf = new Map(problems.map((p) => [p.id, p]));
    const noteOf = new Map(notes.filter((n) => n.refKind === "problem").map((n) => [n.refId, n.body]));
    const due = cards.filter((c) => c.dueOn <= today && problemOf.has(c.problemId));
    return {
      due: due.slice(0, REVISE_PER_DAY).map((c) => {
        const p = problemOf.get(c.problemId)!;
        return { slug: p.slug, title: p.title, difficulty: p.difficulty, tags: p.tags, dueOn: c.dueOn, lastReviewedAt: c.reviewedAt, reps: c.reps, note: noteOf.get(p.id) ?? null };
      }),
      later: Math.max(0, due.length - REVISE_PER_DAY),
      upcoming: cards.filter((c) => c.dueOn > today).length,
    };
  }

  async grade(site: PracticeSite, learner: Learner, problemSlug: string, grade: string) {
    if (!["again", "hard", "good", "easy"].includes(grade)) throw new PracticeError("invalid", "A grade is again, hard, good or easy");
    const scope = practiceLearner(site.orgId, learner.id);
    const problem = await this.#practice.problemBySlug(scope, problemSlug);
    const card = problem === null ? undefined : (await this.#store.cards(scope)).find((c) => c.problemId === problem.id);
    if (card === undefined) throw new PracticeError("not_found", "Nothing to revise for that problem");
    const next = review(card, grade as Grade, this.#today(), new Date(this.#now()).toISOString());
    await this.#store.saveCard(scope, next);
    return { dueOn: next.dueOn, intervalDays: next.intervalDays };
  }

  // --- saved lists -------------------------------------------------------------------------------------

  async lists(site: PracticeSite, learner: Learner) {
    const scope = practiceLearner(site.orgId, learner.id);
    const [saved, state] = await Promise.all([this.#store.saved(scope), this.#state(site, learner)]);
    const names = [...new Set(["Bookmarks", ...saved.map((s) => s.list)])];
    return names.map((name) => {
      const problems = saved
        .filter((s) => s.list === name)
        .flatMap((s) => {
          const p = state.problems.get(s.problemId);
          return p === undefined ? [] : [{ slug: p.slug, title: p.title, difficulty: p.difficulty, solved: state.solved.has(p.id) }];
        });
      return { name, problems, solved: problems.filter((p) => p.solved).length };
    });
  }

  async #problem(site: PracticeSite, learner: Learner, slug: string): Promise<PracticeProblem> {
    const problem = await this.#practice.problemBySlug(practiceLearner(site.orgId, learner.id), slug);
    if (problem === null) throw new PracticeError("not_found", "No such problem");
    return problem;
  }

  async save(site: PracticeSite, learner: Learner, list: string, slug: string): Promise<void> {
    const name = list.trim();
    if (!LIST_NAME.test(name)) throw new PracticeError("invalid", "A list's name is 1 to 60 letters, digits and spaces");
    const scope = practiceLearner(site.orgId, learner.id);
    const saved = await this.#store.saved(scope);
    if (!saved.some((s) => s.list === name) && new Set(saved.map((s) => s.list)).size >= 30) throw new PracticeError("invalid", "Keep 30 lists at most");
    if (saved.filter((s) => s.list === name).length >= 500) throw new PracticeError("invalid", "A list holds 500 problems at most");
    await this.#store.save(scope, name, (await this.#problem(site, learner, slug)).id);
  }

  async unsave(site: PracticeSite, learner: Learner, list: string, slug: string): Promise<void> {
    await this.#store.unsave(practiceLearner(site.orgId, learner.id), list.trim(), (await this.#problem(site, learner, slug)).id);
  }

  // --- notes -----------------------------------------------------------------------------------------

  async notes(site: PracticeSite, learner: Learner) {
    const scope = practiceLearner(site.orgId, learner.id);
    const [notes, problems, lessons] = await Promise.all([this.#store.notes(scope), this.#practice.problems(scope), this.#store.lessons(scope)]);
    const problemOf = new Map(problems.map((p) => [p.id, p]));
    const lessonOf = new Map(lessons.map((l) => [l.id, l]));
    return notes.map((n) => ({
      kind: n.refKind,
      ref: n.refKind === "problem" ? (problemOf.get(n.refId)?.slug ?? n.refId) : n.refKind === "lesson" ? (lessonOf.get(n.refId)?.slug ?? n.refId) : n.refId,
      title: n.title,
      body: n.body,
      updatedAt: n.updatedAt,
    }));
  }

  /** The stored reference: a problem's or a lesson's id, or a topic's own name. */
  async #ref(site: PracticeSite, learner: Learner, kind: string, ref: string): Promise<{ kind: NoteKind; id: string; title: string }> {
    const scope = practiceLearner(site.orgId, learner.id);
    if (kind === "problem") {
      const p = await this.#problem(site, learner, ref);
      return { kind, id: p.id, title: p.title };
    }
    if (kind === "lesson") {
      const l = await this.#store.lessonBySlug(scope, ref);
      if (l === null) throw new PracticeError("not_found", "No such lesson");
      return { kind, id: l.id, title: l.title };
    }
    if (kind === "topic") {
      const topic = slugOf(ref);
      if (topic.length < 1 || topic.length > 80) throw new PracticeError("invalid", "A topic is named in 1 to 80 characters");
      return { kind, id: topic, title: ref.trim().slice(0, 160) || topic };
    }
    throw new PracticeError("invalid", "A note is on a problem, a lesson or a topic");
  }

  async note(site: PracticeSite, learner: Learner, kind: string, ref: string) {
    const r = await this.#ref(site, learner, kind, ref);
    const note = (await this.#store.notes(practiceLearner(site.orgId, learner.id))).find((n) => n.refKind === r.kind && n.refId === r.id);
    return { kind: r.kind, ref, title: note?.title ?? r.title, body: note?.body ?? "", updatedAt: note?.updatedAt ?? null };
  }

  async saveNote(site: PracticeSite, learner: Learner, kind: string, ref: string, input: { title?: string; body: string }) {
    const r = await this.#ref(site, learner, kind, ref);
    if (input.body.length > 50_000) throw new PracticeError("invalid", "A note is 50,000 characters at most");
    const title = (input.title ?? r.title).trim().slice(0, 160) || r.title;
    const scope = practiceLearner(site.orgId, learner.id);
    if (input.body.trim() === "") {
      await this.#store.deleteNote(scope, r.kind, r.id);
      return { kind: r.kind, ref, title, body: "", updatedAt: null };
    }
    const existing = await this.#store.notes(scope);
    if (!existing.some((n) => n.refKind === r.kind && n.refId === r.id) && existing.length >= 2000) throw new PracticeError("invalid", "Keep 2,000 notes at most");
    const saved = await this.#store.saveNote(scope, { refKind: r.kind, refId: r.id, title, body: input.body });
    return { kind: r.kind, ref, title: saved.title, body: saved.body, updatedAt: saved.updatedAt };
  }

  // --- the problem of the day ---------------------------------------------------------------------------

  async potd(site: PracticeSite, learner: Learner | null) {
    const today = this.#today();
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const [days, problems, progress] = await Promise.all([
      this.#store.potd(scope, addDays(today, -29), today),
      this.#practice.problems(scope),
      this.#practice.progress(scope),
    ]);
    const problemOf = new Map(problems.map((p) => [p.id, p]));
    const solvedOn = new Map(progress.solved.map((s) => [s.problemId, istDay(Date.parse(s.at))]));
    const view = (d: { day: string; problemId: string }) => {
      const p = problemOf.get(d.problemId);
      if (p === undefined) return null;
      const solved = solvedOn.get(p.id);
      return { day: d.day, slug: p.slug, title: p.title, difficulty: p.difficulty, solved: solved !== undefined, solvedThatDay: solved === d.day };
    };
    const calendar = days.map(view).filter((d): d is NonNullable<typeof d> => d !== null);
    return { today: calendar.find((d) => d.day === today) ?? null, calendar: calendar.reverse() };
  }

  // --- coins -----------------------------------------------------------------------------------------------

  async coins(site: PracticeSite, learner: Learner) {
    const { balance, history } = await this.#store.coins(practiceLearner(site.orgId, learner.id), 100);
    return { balance, dailyCap: DAILY_COIN_CAP, history: history.map(({ rule, amount, createdAt }) => ({ rule, amount, at: createdAt })) };
  }

  async coinLeaders(site: PracticeSite, learner: Learner | null) {
    return (await this.#store.coinLeaders(site.orgId, 100)).map((r, i) => ({ rank: i + 1, name: r.name, coins: r.coins, you: learner !== null && r.learnerId === learner.id }));
  }

  // --- staff: content ---------------------------------------------------------------------------------------

  async staffTracks(orgId: OrgId) {
    return this.#store.tracks(practiceStaff(orgId));
  }

  async saveTrack(
    orgId: OrgId,
    id: string | null,
    input: {
      title: string;
      slug?: string | undefined;
      description: string;
      position?: number | undefined;
      published: boolean;
      modules: readonly { title: string; items: readonly { problemId?: string | undefined; lessonId?: string | undefined }[] }[];
    },
  ) {
    const title = input.title.trim();
    if (title.length < 1 || title.length > 160) throw new PracticeError("invalid", "A title is 1 to 160 characters");
    const slug = input.slug ?? slugOf(title);
    if (!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug)) throw new PracticeError("invalid", "An address is lowercase letters, digits and dashes");
    if (input.modules.length > 60) throw new PracticeError("invalid", "A track has 60 modules at most");
    const scope = practiceStaff(orgId);
    const [problems, lessons] = await Promise.all([this.#practice.problems(scope), this.#store.lessons(scope)]);
    const problemIds = new Set(problems.map((p) => p.id));
    const lessonIds = new Set(lessons.map((l) => l.id));
    const modules = input.modules.map((m) => {
      const moduleTitle = m.title.trim();
      if (moduleTitle.length < 1 || moduleTitle.length > 160) throw new PracticeError("invalid", "A module's title is 1 to 160 characters");
      if (m.items.length > 200) throw new PracticeError("invalid", "A module has 200 items at most");
      return {
        title: moduleTitle,
        items: m.items.map((item) => {
          if (item.problemId !== undefined && item.lessonId === undefined) {
            if (!problemIds.has(item.problemId)) throw new PracticeError("invalid", "Every problem must be one of the site's");
            return { problemId: item.problemId };
          }
          if (item.lessonId !== undefined && item.problemId === undefined) {
            if (!lessonIds.has(item.lessonId)) throw new PracticeError("invalid", "Every lesson must be one of the site's");
            return { lessonId: item.lessonId };
          }
          throw new PracticeError("invalid", "An item is a problem or a lesson");
        }),
      };
    });
    const existing = await this.#store.tracks(scope);
    try {
      const saved = await this.#store.saveTrack(orgId, id, {
        slug,
        title,
        description: input.description,
        position: input.position ?? (id === null ? existing.length : (existing.find((t) => t.id === id)?.position ?? 0)),
        published: input.published,
        modules,
      });
      if (saved === null) throw new PracticeError("not_found", "No such track");
      return (await this.#store.tracks(scope)).find((t) => t.id === saved)!;
    } catch (error) {
      if ((error as Error).name === "PrepSlugTaken") throw new PracticeError("slug_taken", "Another track uses that address");
      throw error;
    }
  }

  async staffLessons(orgId: OrgId): Promise<readonly Lesson[]> {
    return this.#store.lessons(practiceStaff(orgId));
  }

  async saveLesson(orgId: OrgId, id: string | null, input: { title: string; slug?: string; body: string; videoUrl: string; estMinutes: number; published: boolean }): Promise<Lesson> {
    const title = input.title.trim();
    if (title.length < 1 || title.length > 160) throw new PracticeError("invalid", "A title is 1 to 160 characters");
    const slug = input.slug ?? slugOf(title);
    if (!/^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/.test(slug)) throw new PracticeError("invalid", "An address is lowercase letters, digits and dashes");
    const videoUrl = input.videoUrl.trim();
    if (videoUrl !== "") {
      let url: URL;
      try {
        url = new URL(videoUrl);
      } catch {
        throw new PracticeError("invalid", "A video is a link starting https://");
      }
      if (url.protocol !== "https:") throw new PracticeError("invalid", "A video is a link starting https://");
    }
    if (!Number.isInteger(input.estMinutes) || input.estMinutes < 1 || input.estMinutes > 600) throw new PracticeError("invalid", "A lesson takes 1 to 600 minutes");
    try {
      const saved = await this.#store.saveLesson(orgId, id, { slug, title, body: input.body, videoUrl, estMinutes: input.estMinutes, published: input.published });
      if (saved === null) throw new PracticeError("not_found", "No such lesson");
      return saved;
    } catch (error) {
      if ((error as Error).name === "PrepSlugTaken") throw new PracticeError("slug_taken", "Another lesson uses that address");
      throw error;
    }
  }

  async potdSchedule(orgId: OrgId) {
    const today = this.#today();
    return { today, days: await this.#store.potd(practiceStaff(orgId), addDays(today, -30), addDays(today, 60)) };
  }

  async setPotd(orgId: OrgId, day: string, problemId: string | null): Promise<void> {
    if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) throw new PracticeError("invalid", "A day is written YYYY-MM-DD");
    if (problemId !== null) {
      const problems = await this.#practice.problems(practiceStaff(orgId));
      const p = problems.find((x) => x.id === problemId);
      if (p === undefined) throw new PracticeError("invalid", "The problem must be one of the site's");
      if (!p.published) throw new PracticeError("invalid", "The problem of the day must be published");
    }
    await this.#store.setPotd(orgId, day, problemId);
  }
}

function merge(rewards: readonly Reward[]): Reward {
  return { coins: rewards.reduce((sum, r) => sum + r.coins, 0), reasons: rewards.flatMap((r) => r.reasons) };
}

function sprintSummary(tasks: readonly { day: string; sprint: number; kind: string; doneAt?: string | null }[]) {
  const bySprint = new Map<number, { sprint: number; from: string; to: string; tasks: number; done: number }>();
  for (const t of tasks) {
    const s = bySprint.get(t.sprint) ?? { sprint: t.sprint, from: t.day, to: t.day, tasks: 0, done: 0 };
    if (t.day < s.from) s.from = t.day;
    if (t.day > s.to) s.to = t.day;
    s.tasks++;
    if (t.doneAt !== undefined && t.doneAt !== null) s.done++;
    bySprint.set(t.sprint, s);
  }
  return [...bySprint.values()].sort((a, b) => a.sprint - b.sprint);
}
