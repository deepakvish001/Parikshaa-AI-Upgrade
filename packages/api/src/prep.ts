import { randomBytes } from "node:crypto";
import { candidateQuestion, scoreDeterministic, type OrgId } from "@parikshaa/core";
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
  type TaskDraft,
  type Track,
} from "@parikshaa/store";
import { PracticeError, istDay, slugOf, streaks, type People } from "./practice.js";
import { addDays, countStudyDays, daysBetween, generatePlan, reschedule, review, studyDays, type PlanItem } from "./prep-plan.js";
import type { PrepPlus } from "./prep-plus.js";

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
  /** A sprint's quiz passed. */
  quiz: 20,
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
/** Days off a learner may take in a calendar month without breaking their streak. */
export const FREEZES_PER_MONTH = 2;
/** A sprint's quiz is passed at this share right, in percent; below it, what was missed comes back as revision. */
export const QUIZ_PASS_PERCENT = 70;
/** Questions in a sprint's quiz at most. */
export const QUIZ_QUESTIONS = 10;
// Paid outside the daily cap: milestones, a published interview experience, a contest rank, and coins a cancelled order gives back.
const MILESTONES = ["module", "track", "streak", "experience", "store_refund", "grant", "contest_rank"];
/** Questions a lesson's quiz asks at most. */
export const LESSON_QUIZ_MAX = 10;
/** Solutions one learner may share in a day. */
export const SHARES_PER_DAY = 20;
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
  /** A lesson that needs Plus, for a learner who does not hold it. */
  readonly locked: boolean;
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
  /** Days taken off on purpose. */
  readonly frozen: ReadonlySet<string>;
}

/** What a plan is made from: and, to plan only part of the track, how many of its remaining items. */
type PlanRequest = { track: string; level: string; deadline: string; dailyMinutes: number; weekendMinutes?: number | null | undefined; offDays: readonly number[]; upTo?: number | undefined };

const levels: readonly PlanLevel[] = ["beginner", "intermediate", "advanced"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class PrepService {
  readonly #practice: PracticeStore;
  readonly #store: PrepStore;
  readonly #now: () => number;
  #people: People = async () => new Map();
  readonly #plus: PrepPlus | null;
  readonly #companyProblems: (site: PracticeSite, learner: Learner) => Promise<readonly string[]>;
  readonly #planLate: (site: PracticeSite, learner: Learner, plan: { finishOn: string; deadline: string }) => Promise<void>;

  constructor(options: {
    practice: PracticeStore;
    store: PrepStore;
    plus?: PrepPlus | null;
    /** The learner's target companies' unsolved problems, most asked first: a plan puts them in its last days. */
    companyProblems?: (site: PracticeSite, learner: Learner) => Promise<readonly string[]>;
    /** Told when a plan's finish date has just slipped past its deadline (once a week at most): an email goes out. */
    planLate?: (site: PracticeSite, learner: Learner, plan: { finishOn: string; deadline: string }) => Promise<void>;
    now?: () => number;
  }) {
    this.#practice = options.practice;
    this.#store = options.store;
    this.#plus = options.plus ?? null;
    this.#companyProblems = options.companyProblems ?? (async () => []);
    this.#planLate = options.planLate ?? (async () => undefined);
    this.#now = options.now ?? (() => Date.now());
  }

  /**
   * Lessons that need Plus, for this learner: with Plus on and not held, those
   * found only past each track's free modules. Empty otherwise.
   */
  async #locked(site: PracticeSite, learner: Learner | null, tracks: readonly Track[]): Promise<ReadonlySet<string>> {
    if (this.#plus === null) return new Set();
    const status = await this.#plus.learnAccess(site, learner);
    if (status.active) return new Set();
    const { freeModules } = await this.#plus.settings(site.orgId);
    const free = new Set<string>();
    const paid = new Set<string>();
    for (const t of tracks) {
      t.modules.forEach((m, i) => {
        for (const item of m.items) if (item.lessonId !== null) (i < freeModules ? free : paid).add(item.lessonId);
      });
    }
    return new Set([...paid].filter((id) => !free.has(id)));
  }

  /** A study plan needs Plus when the site sells it. */
  async #planAllowed(site: PracticeSite, learner: Learner): Promise<void> {
    if (this.#plus === null) return;
    if (!(await this.#plus.learnAccess(site, learner)).active) throw new PracticeError("plus_required", "A study plan comes with Plus");
  }

  #today(): string {
    return istDay(this.#now());
  }

  // --- what a learner has done -----------------------------------------------------------

  async #state(site: PracticeSite, learner: Learner | null): Promise<State> {
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const [problems, lessons, tracks, progress, done, frozen] = await Promise.all([
      this.#practice.problems(scope),
      this.#store.lessons(scope),
      this.#store.tracks(scope),
      this.#practice.progress(scope),
      this.#store.lessonsDone(scope),
      this.#store.freezes(scope),
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
      frozen: new Set(frozen),
    };
  }

  #items(track: Track, state: State, locked: ReadonlySet<string> = new Set()) {
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
              locked: false,
            },
          ];
        }
        const l = item.lessonId === null ? undefined : state.lessons.get(item.lessonId);
        if (l === undefined) return [];
        return [
          { id: l.id, kind: "lesson", slug: l.slug, title: l.title, difficulty: null, estMinutes: l.estMinutes, status: state.lessonsDone.has(l.id) ? "done" : null, locked: locked.has(l.id) },
        ];
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
    const locked = await this.#locked(site, learner, state.tracks);
    const modules = this.#items(track, state, locked).map((m) => ({ title: m.title, items: m.items.map(({ id: _, ...item }) => item) }));
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
    const locked = (await this.#locked(site, learner, await this.#store.tracks(scope))).has(lesson.id);
    const quiz = locked ? [] : await this.#quiz(site, lesson.id);
    return {
      slug: lesson.slug,
      title: lesson.title,
      // A locked lesson is named, and its length given, so a learner knows what Plus would open.
      body: locked ? "" : lesson.body,
      videoUrl: locked || lesson.videoUrl === "" ? null : lesson.videoUrl,
      estMinutes: lesson.estMinutes,
      done,
      locked,
      // Asked as candidates see questions: no answer in them.
      quiz: quiz.map((p) => ({ slug: p.slug, title: p.title, question: candidateQuestion(p.question) })),
    };
  }

  /** A lesson's quiz: its problems that can still be checked at once. */
  async #quiz(site: PracticeSite, lessonId: string): Promise<readonly PracticeProblem[]> {
    const ids = await this.#store.lessonQuiz(practiceStaff(site.orgId), lessonId);
    if (ids.length === 0) return [];
    const byId = new Map((await this.#practice.problems(practiceStaff(site.orgId))).map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is PracticeProblem => p !== undefined && (p.question.kind === "mcq" || p.question.kind === "numeric"));
  }

  /**
   * Hand in a lesson's quiz: each answer checked, the right one shown for a
   * wrong one, and each question got wrong due for revision today.
   */
  async takeLessonQuiz(site: PracticeSite, learner: Learner, slug: string, answers: Readonly<Record<string, string>>) {
    const scope = practiceLearner(site.orgId, learner.id);
    const lesson = await this.#store.lessonBySlug(scope, slug);
    if (lesson === null) throw new PracticeError("not_found", "No such lesson");
    if ((await this.#locked(site, learner, await this.#store.tracks(scope))).has(lesson.id)) throw new PracticeError("plus_required", "This lesson comes with Plus");
    const quiz = await this.#quiz(site, lesson.id);
    if (quiz.length === 0) throw new PracticeError("invalid", "This lesson has no quiz");
    const today = this.#today();
    const cards = new Map((await this.#store.cards(scope)).map((c) => [c.problemId, c]));
    const results = [];
    let revise = 0;
    for (const p of quiz) {
      const score = scoreDeterministic(p.question, answers[p.slug] ?? "");
      const right = score !== null && score.score >= p.question.maxScore;
      if (!right) {
        const card = cards.get(p.id);
        if (card === undefined) await this.#store.addCard(scope, p.id, today);
        else if (card.dueOn > today) await this.#store.saveCard(scope, { ...card, dueOn: today });
        revise++;
      }
      const q = p.question;
      results.push({
        slug: p.slug,
        right,
        // Shown once answered, so a wrong answer teaches something.
        answer: q.kind === "mcq" ? (q.correctIndices ?? [q.correctIndex]).map((i) => q.options[i] ?? "").join(", ") : q.kind === "numeric" ? String(q.expected) : "",
        explanation: p.editorial,
      });
    }
    return { score: results.filter((r) => r.right).length, total: results.length, results, revise };
  }

  async completeLesson(site: PracticeSite, learner: Learner, slug: string): Promise<Reward> {
    const scope = practiceLearner(site.orgId, learner.id);
    const lesson = await this.#store.lessonBySlug(scope, slug);
    if (lesson === null) throw new PracticeError("not_found", "No such lesson");
    if ((await this.#locked(site, learner, await this.#store.tracks(scope))).has(lesson.id)) throw new PracticeError("plus_required", "This lesson comes with Plus");
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
    return streaks(days, this.#today(), state.frozen);
  }

  /**
   * After a submission is judged: a first solve pays coins (and the day's
   * problem a bonus), completes its plan task and becomes a revision card.
   * A solve that came after the tutor's worked solution pays half.
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
    // Solved after the tutor gave the worked solution: half the coins.
    const shown = this.#plus !== null && (await this.#plus.store.tutorHistory(scope, { problemId: problem.id })).some((e) => e.mode === "hint" && (e.hintLevel ?? 0) >= 4);
    const solve = shown ? Math.floor(COINS.solve[problem.difficulty] / 2) : COINS.solve[problem.difficulty];
    const rewards = [await this.#pay(site, learner, shown ? "solve_after_solution" : "solve", solve, `solve:${problem.id}`)];
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
      frozenToday: state.frozen.has(today),
      freezesLeft: Math.max(0, FREEZES_PER_MONTH - [...state.frozen].filter((d) => d.slice(0, 7) === today.slice(0, 7)).length),
    };
  }

  /**
   * What a reminder says: the day's tasks still open, the cards due, the
   * streak. Read without paying the day's check-in: opening the email is not
   * opening the dashboard.
   */
  async digest(site: PracticeSite, learner: Learner) {
    const today = this.#today();
    const [state, cards, plan] = await Promise.all([this.#state(site, learner), this.#store.cards(practiceLearner(site.orgId, learner.id)), this.plan(site, learner)]);
    return {
      today,
      tasks: (plan?.today ?? []).filter((t) => !t.done).map((t) => ({ title: t.title, estMinutes: t.estMinutes })),
      dueCards: Math.min(REVISE_PER_DAY, cards.filter((c) => c.dueOn <= today).length),
      streak: this.#streak(state).current,
    };
  }

  // --- a day off ----------------------------------------------------------------------------------

  /**
   * Take today off: the streak neither grows nor breaks, no reminder goes,
   * and the day's open tasks move on to the days ahead.
   */
  async freeze(site: PracticeSite, learner: Learner) {
    const scope = practiceLearner(site.orgId, learner.id);
    const today = this.#today();
    const taken = await this.#store.freezes(scope);
    const thisMonth = taken.filter((d) => d.slice(0, 7) === today.slice(0, 7));
    if (!taken.includes(today)) {
      if (thisMonth.length >= FREEZES_PER_MONTH) throw new PracticeError("limit_reached", `A month has ${FREEZES_PER_MONTH} days off; this month's are taken`);
      await this.#store.freeze(scope, today);
    }
    let moved = 0;
    const plan = await this.#store.activePlan(scope);
    if (plan !== null) {
      // As if today were already over.
      const { moves } = reschedule(await this.#store.tasks(scope, plan.id), addDays(today, 1), plan.dailyMinutes, plan.offDays, plan.weekendMinutes);
      await this.#store.moveTasks(scope, moves);
      moved = moves.length;
    }
    const used = thisMonth.length + (taken.includes(today) ? 0 : 1);
    return { day: today, freezesLeft: Math.max(0, FREEZES_PER_MONTH - used), moved };
  }

  // --- the end of a sprint ----------------------------------------------------------------------

  async #sprint(site: PracticeSite, learner: Learner, sprint: number) {
    const scope = practiceLearner(site.orgId, learner.id);
    const plan = await this.#store.activePlan(scope);
    if (plan === null) throw new PracticeError("not_found", "No study plan");
    const tasks = (await this.#store.tasks(scope, plan.id)).filter((t) => t.sprint === sprint);
    if (tasks.length === 0) throw new PracticeError("not_found", "No such sprint");
    const today = this.#today();
    // The sprint's days as planned: work missed is moved on, but the sprint still ends when it
    // was meant to; and the revision a quiz sent back does not keep it open.
    const lastDay = tasks
      .filter((t) => !(t.kind === "revise" && t.itemId !== null))
      .map((t) => t.rescheduledFrom ?? t.day)
      .sort()
      .at(-1)!;
    // Open once its work is done, or its days are over.
    const open = tasks.every((t) => t.doneAt !== null) || today > lastDay;
    const problems = new Map((await this.#practice.problems(practiceStaff(site.orgId))).map((p) => [p.id, p]));
    const asked = [...new Set(tasks.filter((t) => t.kind === "practice" && t.itemId !== null).map((t) => t.itemId!))]
      .map((id) => problems.get(id))
      .filter((p): p is PracticeProblem => p !== undefined && (p.question.kind === "mcq" || p.question.kind === "numeric"))
      .slice(0, QUIZ_QUESTIONS);
    return { scope, plan, tasks, today, open, asked };
  }

  /** A sprint's quiz: the sprint's questions that can be checked at once, when the sprint is done. */
  async sprintQuiz(site: PracticeSite, learner: Learner, sprint: number) {
    const { scope, plan, open, asked } = await this.#sprint(site, learner, sprint);
    const sittings = (await this.#store.sprintQuizzes(scope, plan.id)).filter((q) => q.sprint === sprint);
    return {
      sprint,
      open,
      passPercent: QUIZ_PASS_PERCENT,
      questions: open ? asked.map((p) => ({ slug: p.slug, title: p.title, question: candidateQuestion(p.question) })) : [],
      count: asked.length,
      sittings: sittings.map((q) => ({ score: q.score, total: q.total, passed: q.score * 100 >= QUIZ_PASS_PERCENT * q.total, takenAt: q.takenAt })),
    };
  }

  /**
   * Hand in a sprint's quiz. Passed, it pays once; below the pass mark, each
   * question got wrong is due for revision today and comes back as a task on
   * the next study day.
   */
  async takeSprintQuiz(site: PracticeSite, learner: Learner, sprint: number, answers: Readonly<Record<string, string>>) {
    const { scope, plan, tasks, today, open, asked } = await this.#sprint(site, learner, sprint);
    if (!open) throw new PracticeError("invalid", "The quiz opens when the sprint's work is done, or its days are over");
    if (asked.length === 0) throw new PracticeError("invalid", "This sprint has no questions that can be checked at once");
    const results: Record<string, boolean> = {};
    for (const p of asked) {
      const score = scoreDeterministic(p.question, answers[p.slug] ?? "");
      results[p.id] = score !== null && score.score >= p.question.maxScore;
    }
    const score = Object.values(results).filter(Boolean).length;
    const passed = score * 100 >= QUIZ_PASS_PERCENT * asked.length;
    await this.#store.addSprintQuiz(scope, plan.id, { sprint, score, total: asked.length, results }, new Date(this.#now()));
    const wrong = asked.filter((p) => !results[p.id]);
    let revise = 0;
    if (!passed && wrong.length > 0) {
      const cards = new Map((await this.#store.cards(scope)).map((c) => [c.problemId, c]));
      const next = studyDays(addDays(today, 1), plan.offDays).next().value as string;
      const all = await this.#store.tasks(scope, plan.id);
      let position = Math.max(-1, ...all.filter((t) => t.day === next).map((t) => t.position));
      const onDay = all.find((t) => t.day === next)?.sprint ?? sprint;
      for (const p of wrong) {
        const card = cards.get(p.id);
        if (card === undefined) await this.#store.addCard(scope, p.id, today);
        else if (card.dueOn > today) await this.#store.saveCard(scope, { ...card, dueOn: today });
        await this.#store.addTask(scope, plan.id, { day: next, sprint: onDay, position: ++position, kind: "revise", itemId: p.id, title: `Revise: ${p.title}`, estMinutes: 15 });
        revise++;
      }
    }
    const reward = passed ? await this.#pay(site, learner, "quiz", COINS.quiz, `quiz:${plan.id}:${sprint}`) : NONE;
    return { score, total: asked.length, passed, wrong: wrong.map((p) => p.slug), revise, reward };
  }

  /** A sprint's revision notes: the learner's own notes on its lessons and problems, in the order they came. */
  async sprintNotes(site: PracticeSite, learner: Learner, sprint: number) {
    const { scope, tasks } = await this.#sprint(site, learner, sprint);
    const staff = practiceStaff(site.orgId);
    const [problems, lessons, notes] = await Promise.all([this.#practice.problems(staff), this.#store.lessons(staff), this.#store.notes(scope)]);
    const problemOf = new Map(problems.map((p) => [p.id, p]));
    const lessonOf = new Map(lessons.map((l) => [l.id, l]));
    const noteOf = new Map(notes.map((n) => [`${n.refKind}:${n.refId}`, n]));
    const seen = new Set<string>();
    const items = [];
    for (const t of [...tasks].sort((a, b) => a.day.localeCompare(b.day) || a.position - b.position)) {
      if (t.itemId === null || seen.has(t.itemId)) continue;
      seen.add(t.itemId);
      const p = problemOf.get(t.itemId);
      const l = lessonOf.get(t.itemId);
      if (p !== undefined) items.push({ kind: "problem" as const, slug: p.slug, title: p.title, note: noteOf.get(`problem:${p.id}`)?.body ?? null });
      else if (l !== undefined) items.push({ kind: "lesson" as const, slug: l.slug, title: l.title, note: noteOf.get(`lesson:${l.id}`)?.body ?? null });
    }
    return { sprint, items };
  }

  // --- the plan ------------------------------------------------------------------------------------

  #settings(input: { deadline: string; dailyMinutes: number; weekendMinutes?: number | null | undefined; offDays: readonly number[] }) {
    const today = this.#today();
    if (!DAY.test(input.deadline) || input.deadline < addDays(today, 6)) throw new PracticeError("invalid", "A deadline is a date at least a week away");
    if (input.deadline > addDays(today, 3 * 365)) throw new PracticeError("invalid", "A deadline is within three years");
    const minutes = (m: number) => Number.isInteger(m) && m >= 15 && m <= 720;
    if (!minutes(input.dailyMinutes)) throw new PracticeError("invalid", "Study 15 minutes to 12 hours a day");
    const weekendMinutes = input.weekendMinutes ?? null;
    if (weekendMinutes !== null && !minutes(weekendMinutes)) throw new PracticeError("invalid", "Study 15 minutes to 12 hours on a weekend day");
    const offDays = [...new Set(input.offDays)].sort();
    if (offDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) throw new PracticeError("invalid", "Days off are 0 (Sunday) to 6 (Saturday)");
    if (offDays.length >= 7) throw new PracticeError("invalid", "Leave at least one day a week to study");
    return { today, deadline: input.deadline, dailyMinutes: input.dailyMinutes, weekendMinutes, offDays };
  }

  #planInput(input: { track: string; level: string; deadline: string; dailyMinutes: number; weekendMinutes?: number | null | undefined; offDays: readonly number[] }) {
    if (!levels.includes(input.level as PlanLevel)) throw new PracticeError("invalid", "A level is beginner, intermediate or advanced");
    return { ...this.#settings(input), level: input.level as PlanLevel };
  }

  /** The track's items not yet done, in order. */
  #remaining(track: Track, state: State): PlanItem[] {
    return this.#items(track, state)
      .flatMap((m) => m.items)
      .filter((i) => i.status !== "done")
      .map((i) => ({ itemId: i.id, kind: i.kind === "lesson" ? "learn" : "practice", title: i.title, minutes: i.kind === "lesson" ? i.estMinutes : null, difficulty: i.difficulty }));
  }

  async #planFor(site: PracticeSite, learner: Learner, input: PlanRequest) {
    const { today, level, offDays, weekendMinutes } = this.#planInput(input);
    const state = await this.#state(site, learner);
    const track = state.tracks.find((t) => t.slug === input.track);
    if (track === undefined) throw new PracticeError("not_found", "No such track");
    const all = this.#remaining(track, state);
    if (input.upTo !== undefined && (!Number.isInteger(input.upTo) || input.upTo < 1)) throw new PracticeError("invalid", "Plan at least one item");
    const items = input.upTo === undefined ? all : all.slice(0, input.upTo);
    const outcome = generatePlan({ items, level, start: today, deadline: input.deadline, dailyMinutes: input.dailyMinutes, weekendMinutes, offDays });
    return { track, level, offDays, weekendMinutes, outcome, of: all.length };
  }

  /** What a plan would be, before it is started. */
  async previewPlan(site: PracticeSite, learner: Learner, input: PlanRequest) {
    await this.#planAllowed(site, learner);
    const { track, outcome, of } = await this.#planFor(site, learner, input);
    const work = outcome.tasks.filter((t) => t.kind !== "revise");
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
      // The third way when it does not fit: plan only the items that fit by the deadline, in the track's order.
      itemsThatFit: outcome.fits ? null : { items: work.filter((t) => t.day <= input.deadline).length, of },
    };
  }

  async startPlan(site: PracticeSite, learner: Learner, input: PlanRequest & { goal?: string | undefined }) {
    await this.#planAllowed(site, learner);
    const { track, level, offDays, weekendMinutes, outcome } = await this.#planFor(site, learner, input);
    const goal = (input.goal ?? "").trim().slice(0, 200);
    const tasks = await this.#withCompanies(site, learner, outcome.tasks);
    await this.#store.startPlan(
      practiceLearner(site.orgId, learner.id),
      { trackId: track.id, level, deadline: input.deadline, dailyMinutes: input.dailyMinutes, weekendMinutes, offDays, goal },
      tasks,
    );
    return (await this.plan(site, learner))!;
  }

  /**
   * The target companies' problems, in the plan's last 30% of study days: one
   * a day, in turn, after the day's own work. Problems the track already has
   * are left where they are.
   */
  async #withCompanies(site: PracticeSite, learner: Learner, tasks: readonly TaskDraft[]): Promise<readonly TaskDraft[]> {
    const ids = (await this.#companyProblems(site, learner)).filter((id) => !tasks.some((t) => t.itemId === id));
    if (ids.length === 0 || tasks.length === 0) return tasks;
    const problems = new Map((await this.#practice.problems(practiceStaff(site.orgId))).map((p) => [p.id, p]));
    const days = [...new Set(tasks.map((t) => t.day))].sort();
    const tail = days.slice(Math.floor(days.length * 0.7));
    const out = [...tasks];
    ids.forEach((id, i) => {
      const p = problems.get(id);
      if (p === undefined) return;
      const day = tail[i % tail.length]!;
      const onDay = out.filter((t) => t.day === day);
      out.push({
        day,
        sprint: onDay[0]?.sprint ?? Math.max(...tasks.map((t) => t.sprint)),
        position: Math.max(-1, ...onDay.map((t) => t.position)) + 1,
        kind: "practice",
        itemId: p.id,
        title: p.title,
        estMinutes: { easy: 20, medium: 40, hard: 60 }[p.difficulty],
      });
    });
    return out;
  }

  /**
   * Change a running plan's deadline, minutes or days off. What is done stays
   * done; the track's remaining items are laid out again from today, in new
   * sprints after the ones begun, so a sprint's quiz keeps its questions.
   */
  async changePlan(site: PracticeSite, learner: Learner, change: { deadline?: string; dailyMinutes?: number; weekendMinutes?: number | null; offDays?: readonly number[] }) {
    const scope = practiceLearner(site.orgId, learner.id);
    const plan = await this.#store.activePlan(scope);
    if (plan === null) throw new PracticeError("not_found", "There is no plan to change");
    const settings = this.#settings({
      deadline: change.deadline ?? plan.deadline,
      dailyMinutes: change.dailyMinutes ?? plan.dailyMinutes,
      weekendMinutes: change.weekendMinutes === undefined ? plan.weekendMinutes : change.weekendMinutes,
      offDays: change.offDays ?? plan.offDays,
    });
    const state = await this.#state(site, learner);
    const track = state.tracks.find((t) => t.id === plan.trackId);
    if (track === undefined) throw new PracticeError("not_found", "The plan's track is gone");
    const tasks = await this.#store.tasks(scope, plan.id);
    const kept = tasks.filter((t) => t.doneAt !== null || t.kind === "custom" || (t.kind === "revise" && t.itemId !== null));
    const begun = Math.max(0, ...tasks.filter((t) => t.doneAt !== null || t.day < settings.today).map((t) => t.sprint));
    const outcome = generatePlan({ ...settings, items: this.#remaining(track, state), level: plan.level, start: settings.today });
    const laid = (await this.#withCompanies(site, learner, outcome.tasks)).map((t) => ({ ...t, sprint: t.sprint + begun, title: t.kind === "revise" && t.itemId === null ? `Sprint ${t.sprint + begun} revision` : t.title }));
    // A task kept for today goes first; new ones follow it on the same day.
    const after = new Map<string, number>();
    for (const t of kept.filter((k) => k.doneAt === null)) after.set(t.day, Math.max(after.get(t.day) ?? -1, t.position));
    await this.#store.replan(
      scope,
      plan.id,
      { deadline: settings.deadline, dailyMinutes: settings.dailyMinutes, weekendMinutes: settings.weekendMinutes, offDays: settings.offDays },
      laid.map((t) => ({ ...t, position: t.position + (after.get(t.day) ?? -1) + 1 })),
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
    const { moves } = reschedule(tasks, today, plan.dailyMinutes, plan.offDays, plan.weekendMinutes);
    if (moves.length > 0) {
      await this.#store.moveTasks(scope, moves);
      tasks = await this.#store.tasks(scope, plan.id);
    }
    const lastDay = tasks.length === 0 ? today : [...tasks].sort((a, b) => b.day.localeCompare(a.day))[0]!.day;
    // Running past the deadline: the learner hears it, once a week at most.
    if (moves.length > 0 && lastDay > plan.deadline && (await this.#store.noteLate(scope, plan.id, today))) {
      await this.#planLate(site, learner, { finishOn: lastDay, deadline: plan.deadline });
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
      weekendMinutes: plan.weekendMinutes,
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

  /**
   * A track's notes in the track's order, module by module, to print as one
   * document; and the learner's topic notes after them. Only what has a note.
   */
  async noteBook(site: PracticeSite, learner: Learner, trackSlug: string) {
    const state = await this.#state(site, learner);
    const track = state.tracks.find((t) => t.slug === trackSlug);
    if (track === undefined) throw new PracticeError("not_found", "No such track");
    const notes = await this.#store.notes(practiceLearner(site.orgId, learner.id));
    const noteOf = new Map(notes.map((n) => [`${n.refKind}:${n.refId}`, n]));
    const modules = this.#items(track, state)
      .map((m) => ({
        title: m.title,
        notes: m.items.flatMap((i) => {
          const note = noteOf.get(`${i.kind}:${i.id}`);
          return note === undefined || note.body.trim() === "" ? [] : [{ kind: i.kind, slug: i.slug, title: i.title, body: note.body }];
        }),
      }))
      .filter((m) => m.notes.length > 0);
    const topics = notes.filter((n) => n.refKind === "topic" && n.body.trim() !== "").map((n) => ({ title: n.title, body: n.body }));
    return { track: { slug: track.slug, title: track.title }, modules, topics };
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
    // A note on a problem is something to come back to: it gets a revision card, if it has none.
    if (r.kind === "problem") await this.#store.addCard(scope, r.id, addDays(this.#today(), 1));
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

  /** Where titles and usernames come from (Prep's ratings and profiles), once that service exists. */
  usePeople(people: People): void {
    this.#people = people;
  }

  async coinLeaders(site: PracticeSite, learner: Learner | null) {
    const rows = await this.#store.coinLeaders(site.orgId, 100);
    const people = await this.#people(site.orgId, rows.map((r) => r.learnerId));
    return rows.map((r, i) => ({ rank: i + 1, name: r.name, title: people.get(r.learnerId)?.title ?? null, username: people.get(r.learnerId)?.username ?? null, coins: r.coins, you: learner !== null && r.learnerId === learner.id }));
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

  // --- shared solutions ----------------------------------------------------------------------------

  /**
   * Share a solution read-only: the code, at a link. Never during a contest
   * that includes the problem, and never a test: only what the learner wrote.
   */
  async shareCode(site: PracticeSite, learner: Learner, slug: string, input: { language: string; source: string }) {
    const problem = await this.#problem(site, learner, slug);
    if (problem.question.kind !== "code") throw new PracticeError("invalid", "Only code is shared");
    const source = input.source;
    if (source.trim() === "" || source.length > 65_536) throw new PracticeError("invalid", "Share 1 to 65,536 characters of code");
    const now = this.#now();
    const running = (await this.#practice.contests(practiceStaff(site.orgId))).some((c) => c.problemIds.includes(problem.id) && Date.parse(c.startsAt) <= now && now < Date.parse(c.endsAt));
    if (running) throw new PracticeError("invalid", "Code for this problem cannot be shared while a contest that includes it runs");
    if ((await this.#store.sharesSince(site.orgId, learner.id, new Date(now - 86_400_000))) >= SHARES_PER_DAY) throw new PracticeError("too_many_runs", `Share up to ${SHARES_PER_DAY} solutions a day`);
    const id = randomBytes(9).toString("base64url");
    await this.#store.addShare(site.orgId, { id, learnerId: learner.id, problemId: problem.id, language: input.language.slice(0, 40), source }, new Date(now));
    return { id, path: `/shares/${id}` };
  }

  /** A shared solution, as anyone with its link reads it. */
  async sharedCode(site: PracticeSite, id: string) {
    const share = /^[A-Za-z0-9_-]{10,24}$/.test(id) ? await this.#store.share(site.orgId, id) : null;
    if (share === null) throw new PracticeError("not_found", "No such shared solution");
    const [problem, author] = await Promise.all([
      (await this.#practice.problems(practiceStaff(site.orgId))).find((p) => p.id === share.problemId),
      this.#practice.learnerById(site.orgId, share.learnerId),
    ]);
    return {
      problem: problem === undefined || !problem.published ? null : { slug: problem.slug, title: problem.title },
      author: author?.name ?? "A learner",
      language: share.language,
      source: share.source,
      createdAt: share.createdAt,
    };
  }

  // --- staff: lesson quizzes ------------------------------------------------------------------------

  async staffLessonQuiz(orgId: OrgId, lessonId: string): Promise<readonly string[]> {
    return this.#store.lessonQuiz(practiceStaff(orgId), lessonId);
  }

  /** Set a lesson's quiz: up to ten of the site's problems that can be checked at once (multiple choice, a number). */
  async setLessonQuiz(orgId: OrgId, lessonId: string, problemIds: readonly string[]): Promise<readonly string[]> {
    if (!(await this.#store.lessons(practiceStaff(orgId))).some((l) => l.id === lessonId)) throw new PracticeError("not_found", "No such lesson");
    const ids = [...new Set(problemIds)];
    if (ids.length > LESSON_QUIZ_MAX) throw new PracticeError("invalid", `A quiz asks ${LESSON_QUIZ_MAX} questions at most`);
    const byId = new Map((await this.#practice.problems(practiceStaff(orgId))).map((p) => [p.id, p]));
    for (const id of ids) {
      const p = byId.get(id);
      if (p === undefined) throw new PracticeError("not_found", "No such problem");
      if (p.question.kind !== "mcq" && p.question.kind !== "numeric") throw new PracticeError("invalid", `${p.title} cannot be checked at once: a quiz asks multiple choice and number questions`);
    }
    await this.#store.setLessonQuiz(orgId, lessonId, ids);
    return ids;
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
