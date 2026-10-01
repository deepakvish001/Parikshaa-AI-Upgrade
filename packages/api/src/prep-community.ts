import type { OrgId } from "@parikshaa/core";
import {
  CommunitySlugTaken,
  practiceLearner,
  practiceStaff,
  type Company,
  type Experience,
  type ExperienceRound,
  type Learner,
  type PracticeProblem,
  type PracticeSite,
  type PracticeStore,
  type PrepCommunityStore,
  type PrepStore,
  type StoreItemDraft,
} from "@parikshaa/store";
import { PracticeError, istDay, scoreboard, slugOf, streaks } from "./practice.js";
import { addDays } from "./prep-plan.js";
import type { PrepPlus } from "./prep-plus.js";

/**
 * Prep, together (ROADMAP §16): which companies ask what, what learners say
 * their interviews were like, a store to spend coins in, and a rating from
 * contests.
 *
 * A company's page is counted from reports — staff's, and each published
 * experience's — so "asked 4 times in 60 days" is a count, not a claim typed
 * in. With Plus on, a learner without it sees a company's five most asked
 * problems; the rest are Plus.
 *
 * Ratings are made lazily: the first read after a contest ends rates it, once,
 * in the order contests ended.
 */

export const START_RATING = 1500;
/** How far one contest moves a rating, at most, against a field of equals. */
const K = 64;
/** A company page's free share when the site sells Plus. */
export const FREE_COMPANY_PROBLEMS = 5;
/** Readiness for a company: of its this many most asked problems (the last 180 days), how many are solved. */
export const READINESS_TOP = 50;
/** Problems from target companies a study plan puts in its last days, at most. */
export const PLAN_COMPANY_PROBLEMS = 10;
export const EXPERIENCE_COINS = 100;
/** How old an account must be before it spends coins: coins farmed by a new account wait. */
export const STORE_MIN_AGE_DAYS = 14;
export const WINDOWS = [30, 60, 180] as const;
export type Window = (typeof WINDOWS)[number] | "all";

/**
 * Elo against every other contestant: each pairing scores 1, ½ or 0 by rank,
 * against what the ratings expected. The changes sum to about nothing.
 */
export function rateContest<T extends { readonly learnerId: string; readonly rank: number; readonly before: number }>(rows: readonly T[]): (T & { readonly after: number })[] {
  if (rows.length < 2) return rows.map((r) => ({ ...r, after: r.before }));
  return rows.map((a) => {
    let expected = 0;
    let actual = 0;
    for (const b of rows) {
      if (b === a) continue;
      expected += 1 / (1 + 10 ** ((b.before - a.before) / 400));
      actual += a.rank < b.rank ? 1 : a.rank === b.rank ? 0.5 : 0;
    }
    return { ...a, after: Math.max(0, a.before + Math.round((K * (actual - expected)) / (rows.length - 1))) };
  });
}

/** A rating's name. */
export function titleOf(rating: number | null): string {
  if (rating === null) return "Unrated";
  if (rating >= 2200) return "Grandmaster";
  if (rating >= 1900) return "Master";
  if (rating >= 1600) return "Expert";
  if (rating >= 1400) return "Coder";
  if (rating >= 1200) return "Learner";
  return "Newbie";
}

export interface Achievement {
  readonly id: string;
  readonly have: number;
  readonly need: number;
  readonly earned: boolean;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Write-ups one learner may have waiting for staff at once. */
const MAX_PENDING = 5;

export class PrepCommunity {
  readonly #practice: PracticeStore;
  readonly #prep: PrepStore;
  readonly #store: PrepCommunityStore;
  readonly #plus: PrepPlus | null;
  readonly #now: () => number;

  constructor(options: { practice: PracticeStore; prep: PrepStore; store: PrepCommunityStore; plus?: PrepPlus | null; now?: () => number }) {
    this.#practice = options.practice;
    this.#prep = options.prep;
    this.#store = options.store;
    this.#plus = options.plus ?? null;
    this.#now = options.now ?? (() => Date.now());
  }

  #today(): string {
    return istDay(this.#now());
  }

  /** Plus, or a Company Pass, opens every company's full list. */
  async #holdsPlus(site: PracticeSite, learner: Learner | null): Promise<boolean> {
    return this.#plus === null ? true : (await this.#plus.companyAccess(site, learner)).active;
  }

  /** A company's published problems, most asked in the last 180 days first. */
  async #ranked(site: PracticeSite, companyId: string): Promise<readonly PracticeProblem[]> {
    const scope = practiceLearner(site.orgId, null);
    const [reports, problems] = await Promise.all([this.#store.reports(scope, companyId), this.#practice.problems(scope)]);
    const byId = new Map(problems.filter((p) => p.published).map((p) => [p.id, p]));
    const since = addDays(this.#today(), -180);
    const asked = new Map<string, { times: number; last: string }>();
    for (const r of reports) {
      if (!byId.has(r.problemId) || r.reportedOn < since) continue;
      const seen = asked.get(r.problemId) ?? { times: 0, last: r.reportedOn };
      asked.set(r.problemId, { times: seen.times + 1, last: seen.last > r.reportedOn ? seen.last : r.reportedOn });
    }
    return [...asked.entries()]
      .sort((a, b) => b[1].times - a[1].times || b[1].last.localeCompare(a[1].last) || byId.get(a[0])!.title.localeCompare(byId.get(b[0])!.title))
      .map(([id]) => byId.get(id)!);
  }

  /** Of a company's most asked problems, how many this learner has solved. */
  async #readiness(site: PracticeSite, companyId: string, solved: ReadonlySet<string>) {
    const top = (await this.#ranked(site, companyId)).slice(0, READINESS_TOP);
    const done = top.filter((p) => solved.has(p.id)).length;
    return { solved: done, of: top.length, percent: top.length === 0 ? 0 : Math.round((done / top.length) * 100) };
  }

  // --- the companies a learner aims for -----------------------------------------------------

  async targets(site: PracticeSite, learner: Learner) {
    const scope = practiceLearner(site.orgId, learner.id);
    const [ids, companies, progress] = await Promise.all([this.#store.targets(scope), this.#store.companies(scope), this.#practice.progress(scope)]);
    const solved = new Set(progress.solved.map((s) => s.problemId));
    const byId = new Map(companies.map((c) => [c.id, c]));
    const out = [];
    for (const id of ids) {
      const c = byId.get(id);
      if (c !== undefined) out.push({ slug: c.slug, name: c.name, readiness: await this.#readiness(site, c.id, solved) });
    }
    return out;
  }

  async setTarget(site: PracticeSite, learner: Learner, slug: string, on: boolean): Promise<void> {
    const company = await this.#company(site, slug);
    const scope = practiceLearner(site.orgId, learner.id);
    if (on && !(await this.#store.targets(scope)).includes(company.id) && (await this.#store.targets(scope)).length >= 10) {
      throw new PracticeError("limit_reached", "Aim for 10 companies at most");
    }
    await this.#store.setTarget({ ...scope, learnerId: learner.id }, company.id, on);
  }

  /**
   * "Start this company's list": aim for the company, and save its most asked
   * problems to a list of its name — all of them with Plus or a Company Pass,
   * the free few without.
   */
  async startList(site: PracticeSite, learner: Learner, slug: string) {
    const company = await this.#company(site, slug);
    await this.setTarget(site, learner, slug, true);
    const ranked = (await this.#ranked(site, company.id)).slice(0, READINESS_TOP);
    const open = await this.#holdsPlus(site, learner);
    const shown = open ? ranked : ranked.slice(0, FREE_COMPANY_PROBLEMS);
    const name = company.name.replace(/[^\p{L}\p{N} _\-'&()]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "Company";
    const scope = practiceLearner(site.orgId, learner.id);
    for (const p of shown) await this.#prep.save(scope, name, p.id);
    return { list: name, added: shown.length, locked: ranked.length - shown.length };
  }

  /** For a new study plan: unsolved problems of the learner's target companies, most asked first. */
  async targetProblems(site: PracticeSite, learner: Learner): Promise<readonly string[]> {
    const scope = practiceLearner(site.orgId, learner.id);
    const [ids, progress, open] = await Promise.all([this.#store.targets(scope), this.#practice.progress(scope), this.#holdsPlus(site, learner)]);
    const solved = new Set(progress.solved.map((s) => s.problemId));
    const picked: string[] = [];
    // Without Plus or a Company Pass, only the share a company page shows free.
    const lists = (await Promise.all(ids.map((id) => this.#ranked(site, id)))).map((l) => (open ? l : l.slice(0, FREE_COMPANY_PROBLEMS)));
    // Take from each company in turn, so every target is in the plan.
    for (let i = 0; picked.length < PLAN_COMPANY_PROBLEMS && lists.some((l) => l.length > i); i++) {
      for (const list of lists) {
        const p = list[i];
        if (p !== undefined && !solved.has(p.id) && !picked.includes(p.id) && picked.length < PLAN_COMPANY_PROBLEMS) picked.push(p.id);
      }
    }
    return picked;
  }

  // --- companies ------------------------------------------------------------------------------

  async companies(site: PracticeSite) {
    const scope = practiceLearner(site.orgId, null);
    const [companies, reports, experiences, problems] = await Promise.all([
      this.#store.companies(scope),
      this.#store.reports(scope),
      this.#store.experiences(scope, { status: "published" }),
      this.#practice.problems(scope),
    ]);
    const published = new Set(problems.filter((p) => p.published).map((p) => p.id));
    const since = addDays(this.#today(), -180);
    return companies.map((c) => ({
      slug: c.slug,
      name: c.name,
      problems: new Set(reports.filter((r) => r.companyId === c.id && r.reportedOn >= since && published.has(r.problemId)).map((r) => r.problemId)).size,
      experiences: experiences.filter((e) => e.companyId === c.id).length,
    }));
  }

  async #company(site: PracticeSite, slug: string): Promise<Company> {
    const found = (await this.#store.companies(practiceLearner(site.orgId, null))).find((c) => c.slug === slug);
    if (found === undefined) throw new PracticeError("not_found", "No such company");
    return found;
  }

  /** A company's questions in a window, most asked first, with the topics and difficulties they cover. */
  async company(site: PracticeSite, slug: string, learner: Learner | null, window: Window) {
    const company = await this.#company(site, slug);
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const [reports, problems, progress, plus, experiences] = await Promise.all([
      this.#store.reports(scope, company.id),
      this.#practice.problems(practiceLearner(site.orgId, null)),
      learner === null ? null : this.#practice.progress(scope),
      this.#holdsPlus(site, learner),
      this.experiences(site, learner, slug),
    ]);
    const byId = new Map(problems.filter((p) => p.published).map((p) => [p.id, p]));
    const today = this.#today();
    const inWindow = (w: Window) => (w === "all" ? () => true : (day: string) => day >= addDays(today, -w));
    const counts = Object.fromEntries(
      [...WINDOWS, "all" as const].map((w) => [String(w), new Set(reports.filter((r) => byId.has(r.problemId) && inWindow(w)(r.reportedOn)).map((r) => r.problemId)).size]),
    );
    const asked = new Map<string, { times: number; last: string }>();
    for (const r of reports) {
      if (!byId.has(r.problemId) || !inWindow(window)(r.reportedOn)) continue;
      const seen = asked.get(r.problemId) ?? { times: 0, last: r.reportedOn };
      asked.set(r.problemId, { times: seen.times + 1, last: seen.last > r.reportedOn ? seen.last : r.reportedOn });
    }
    const solved = new Set(progress?.solved.map((s) => s.problemId) ?? []);
    const rows = [...asked.entries()]
      .map(([id, a]) => ({ problem: byId.get(id)!, ...a }))
      .sort((a, b) => b.times - a.times || b.last.localeCompare(a.last) || a.problem.title.localeCompare(b.problem.title));
    const topics = new Map<string, number>();
    const difficulty = { easy: 0, medium: 0, hard: 0 };
    for (const { problem } of rows) {
      difficulty[problem.difficulty]++;
      for (const tag of problem.tags) topics.set(tag, (topics.get(tag) ?? 0) + 1);
    }
    const shown = plus ? rows : rows.slice(0, FREE_COMPANY_PROBLEMS);
    const target = learner === null ? false : (await this.#store.targets(practiceLearner(site.orgId, learner.id))).includes(company.id);
    return {
      slug: company.slug,
      name: company.name,
      about: company.about,
      readiness: learner === null ? null : await this.#readiness(site, company.id, solved),
      target,
      window: String(window),
      counts,
      problems: shown.map(({ problem, times, last }) => ({
        slug: problem.slug,
        title: problem.title,
        difficulty: problem.difficulty,
        tags: problem.tags,
        times,
        lastAsked: last,
        solved: solved.has(problem.id),
      })),
      locked: rows.length - shown.length,
      topics: [...topics.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, problems]) => ({ tag, problems })),
      difficulty,
      experiences,
    };
  }

  // --- experiences ---------------------------------------------------------------------------------

  async experiences(site: PracticeSite, learner: Learner | null, companySlug?: string) {
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const company = companySlug === undefined ? undefined : await this.#company(site, companySlug);
    const [list, voted, companies, titles] = await Promise.all([
      this.#store.experiences(scope, company === undefined ? {} : { companyId: company.id }),
      this.#store.myVotes(scope),
      this.#store.companies(scope),
      this.#titles(site.orgId),
    ]);
    const names = new Map(companies.map((c) => [c.id, c]));
    // Published ones, and the learner's own whatever their state.
    return list
      .filter((e) => e.status === "published" || (learner !== null && e.learnerId === learner.id))
      .map((e) => this.#view(e, names.get(e.companyId), learner, voted.has(e.id), titles));
  }

  /** Each published problem's title by its address, so a round names its problems in words. */
  async #titles(orgId: OrgId): Promise<ReadonlyMap<string, string>> {
    return new Map((await this.#practice.problems(practiceLearner(orgId, null))).filter((p) => p.published).map((p) => [p.slug, p.title]));
  }

  #view(e: Experience, company: Company | undefined, learner: Learner | null, voted: boolean, titles: ReadonlyMap<string, string>) {
    return {
      id: e.id,
      company: { slug: company?.slug ?? "", name: company?.name ?? "" },
      role: e.role,
      interviewed: e.interviewed,
      verdict: e.verdict,
      rounds: e.rounds.map((r) => ({ ...r, problems: r.problemSlugs.filter((slug) => titles.has(slug)).map((slug) => ({ slug, title: titles.get(slug)! })) })),
      tips: e.tips,
      author: e.authorName,
      status: e.status,
      votes: e.votes,
      voted,
      mine: learner !== null && e.learnerId === learner.id,
      at: e.publishedAt ?? e.createdAt,
    };
  }

  async submitExperience(
    site: PracticeSite,
    learner: Learner,
    input: { company: string; role: string; interviewed: string; verdict: Experience["verdict"]; rounds: readonly ExperienceRound[]; tips: string; anonymous: boolean },
  ) {
    const company = await this.#company(site, input.company);
    const waiting = (await this.#store.experiences(practiceLearner(site.orgId, learner.id), { status: "pending" })).filter((e) => e.learnerId === learner.id);
    if (waiting.length >= MAX_PENDING) throw new PracticeError("too_many_runs", `You have ${MAX_PENDING} write-ups waiting to be read. Send more once those are.`);
    if (!MONTH.test(input.interviewed) || input.interviewed > this.#today().slice(0, 7)) throw new PracticeError("invalid", "When was the interview? A month, not in the future.");
    if (input.rounds.length === 0) throw new PracticeError("invalid", "Say what at least one round was like");
    const published = await this.#titles(site.orgId);
    const unknown = input.rounds.flatMap((r) => r.problemSlugs).filter((s) => !published.has(s));
    if (unknown.length > 0) throw new PracticeError("invalid", `Not a problem on this site: ${unknown.join(", ")}`);
    const saved = await this.#store.addExperience(practiceLearner(site.orgId, learner.id), {
      companyId: company.id,
      role: input.role.trim(),
      interviewed: input.interviewed,
      verdict: input.verdict,
      rounds: input.rounds.map((r) => ({ kind: r.kind.trim(), asked: r.asked.trim(), problemSlugs: [...new Set(r.problemSlugs)] })),
      tips: input.tips.trim(),
      authorName: input.anonymous ? "Anonymous" : learner.name,
    });
    return this.#view(saved, company, learner, false, published);
  }

  async vote(site: PracticeSite, learner: Learner, id: string, on: boolean): Promise<void> {
    const scope = practiceLearner(site.orgId, learner.id);
    const found = (await this.#store.experiences(scope, { status: "published" })).find((e) => e.id === id);
    if (found === undefined) throw new PracticeError("not_found", "No such experience");
    if (found.learnerId === learner.id) throw new PracticeError("invalid", "Your own experience is not yours to vote for");
    await this.#store.vote(scope, id, on);
  }

  // --- the store -------------------------------------------------------------------------------------

  #mayShopFrom(learner: Learner): string {
    return new Date(Date.parse(learner.createdAt) + STORE_MIN_AGE_DAYS * 86_400_000).toISOString();
  }

  async store(site: PracticeSite, learner: Learner | null) {
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const [items, coins, orders] = await Promise.all([this.#store.items(scope), this.#prep.coins(scope, 0), this.#store.storeOrders(scope)]);
    const from = learner === null ? null : this.#mayShopFrom(learner);
    return {
      balance: coins.balance,
      opensAt: from !== null && Date.parse(from) > this.#now() ? from : null,
      items: items.map(({ id, title, description, kind, plusDays, couponPercent, perMonth, priceCoins, stock, perLearner }) => ({
        id,
        title,
        description,
        kind,
        plusDays,
        couponPercent,
        perMonth,
        priceCoins,
        soldOut: stock !== null && stock <= 0,
        left: stock,
        bought: orders.filter((o) => o.itemId === id && o.status !== "cancelled").length,
        perLearner,
      })),
      orders: orders.map(({ id, title, priceCoins, status, note, createdAt, closedAt }) => ({ id, title, priceCoins, status, note, createdAt, closedAt })),
    };
  }

  async redeem(site: PracticeSite, learner: Learner, itemId: string, address: string) {
    const from = this.#mayShopFrom(learner);
    if (Date.parse(from) > this.#now()) throw new PracticeError("too_new", `The store opens to new accounts after ${STORE_MIN_AGE_DAYS} days: from ${from.slice(0, 10)}`);
    const item = (await this.#store.items(practiceLearner(site.orgId, learner.id))).find((i) => i.id === itemId);
    if (item === undefined) throw new PracticeError("not_found", "No such item");
    if (item.kind === "physical" && address.trim().length < 10) throw new PracticeError("invalid", "Where should it go? Give a full postal address.");
    const result = await this.#store.redeem(site.orgId, learner.id, itemId, item.kind === "physical" ? address.trim() : "", new Date(this.#now()));
    if (result === "no_item") throw new PracticeError("not_found", "No such item");
    if (result === "sold_out") throw new PracticeError("sold_out", "That is all gone");
    if (result === "limit") throw new PracticeError("limit_reached", "You have bought as many of these as one learner may");
    if (result === "month_limit") throw new PracticeError("limit_reached", `You may buy ${item.perMonth === 1 ? "one of these" : `${item.perMonth} of these`} a month; try again next month`);
    if (result === "coins") throw new PracticeError("no_coins", "Not enough coins for that yet");
    const { id, title, priceCoins, status, note, createdAt, closedAt } = result;
    return { order: { id, title, priceCoins, status, note, createdAt, closedAt }, balance: (await this.#prep.coins(practiceLearner(site.orgId, learner.id), 0)).balance };
  }

  // --- ratings -------------------------------------------------------------------------------------------

  /** Rate every contest that has ended and is not rated yet, in the order they ended. */
  async #rateEnded(orgId: OrgId): Promise<void> {
    const scope = practiceStaff(orgId);
    const now = this.#now();
    const [contests, ratings] = await Promise.all([this.#practice.contests(scope), this.#store.ratings(scope)]);
    const rated = new Set(ratings.map((r) => r.contestId));
    const pending = contests.filter((c) => Date.parse(c.endsAt) <= now && !rated.has(c.id)).sort((a, b) => a.endsAt.localeCompare(b.endsAt));
    if (pending.length === 0) return;
    const current = new Map<string, number>();
    for (const r of ratings) current.set(r.learnerId, r.after);
    for (const contest of pending) {
      const board = scoreboard(contest, await this.#practice.contestSubmissions(orgId, contest.id));
      if (board.length === 0) continue;
      const changes = rateContest(board.map((row) => ({ learnerId: row.learnerId, rank: row.rank, before: current.get(row.learnerId) ?? START_RATING })));
      if (await this.#store.rate(orgId, contest.id, changes.map(({ learnerId, rank, before, after }) => ({ learnerId, rank, before, after })), new Date(contest.endsAt))) {
        for (const c of changes) current.set(c.learnerId, c.after);
      } else {
        // Someone else rated it at the same time: start again from what they wrote.
        return this.#rateEnded(orgId);
      }
    }
  }

  /** The rating table, and the learner's own rating, history, title and achievements. */
  async rating(site: PracticeSite, learner: Learner | null) {
    await this.#rateEnded(site.orgId);
    const scope = practiceStaff(site.orgId);
    const [ratings, learners, contests] = await Promise.all([this.#store.ratings(scope), this.#practice.learners(site.orgId), this.#practice.contests(scope)]);
    const names = new Map(learners.map((l) => [l.id, l.name]));
    const latest = new Map<string, { rating: number; contests: number }>();
    for (const r of ratings) latest.set(r.learnerId, { rating: r.after, contests: (latest.get(r.learnerId)?.contests ?? 0) + 1 });
    const board = [...latest.entries()]
      .filter(([id]) => names.has(id))
      .sort((a, b) => b[1].rating - a[1].rating || (names.get(a[0]) ?? "").localeCompare(names.get(b[0]) ?? ""))
      .slice(0, 100)
      .map(([id, r], i) => ({ rank: i + 1, name: names.get(id)!, rating: r.rating, title: titleOf(r.rating), contests: r.contests, you: learner !== null && id === learner.id }));
    if (learner === null) return { board, me: null };

    const byContest = new Map(contests.map((c) => [c.id, c]));
    const mine = ratings.filter((r) => r.learnerId === learner.id);
    const rating = mine.at(-1)?.after ?? null;
    const history = mine.map((r) => ({
      contest: byContest.get(r.contestId)?.title ?? "",
      slug: byContest.get(r.contestId)?.slug ?? "",
      rank: r.rank,
      field: ratings.filter((x) => x.contestId === r.contestId).length,
      before: r.before,
      after: r.after,
      at: r.ratedAt,
    }));
    return { board, me: { rating, title: titleOf(rating), contests: mine.length, history, achievements: await this.#achievements(site, learner, history) } };
  }

  /** What a learner has done, as badges: counted each time, never stored. */
  async #achievements(site: PracticeSite, learner: Learner, history: readonly { rank: number; field: number; after: number }[]): Promise<Achievement[]> {
    const scope = practiceLearner(site.orgId, learner.id);
    const [progress, problems, experiences] = await Promise.all([
      this.#practice.progress(scope),
      this.#practice.problems(practiceLearner(site.orgId, null)),
      this.#store.experiences(scope, { status: "published" }),
    ]);
    const solved = progress.solved.length;
    const hard = new Set(problems.filter((p) => p.difficulty === "hard").map((p) => p.id));
    const longest = streaks(progress.days, this.#today()).longest;
    const best = Math.max(0, ...history.map((h) => h.after));
    const podium = history.some((h) => h.rank <= 3 && h.field >= 3) ? 1 : 0;
    const wrote = experiences.filter((e) => e.learnerId === learner.id).length;
    const badge = (id: string, have: number, need: number): Achievement => ({ id, have: Math.min(have, need), need, earned: have >= need });
    return [
      badge("first_solve", solved, 1),
      badge("solved_10", solved, 10),
      badge("solved_50", solved, 50),
      badge("solved_100", solved, 100),
      badge("solved_250", solved, 250),
      badge("first_hard", progress.solved.filter((s) => hard.has(s.problemId)).length, 1),
      badge("streak_7", longest, 7),
      badge("streak_30", longest, 30),
      badge("streak_100", longest, 100),
      badge("first_contest", history.length, 1),
      badge("podium", podium, 1),
      badge("rating_1600", best, 1600),
      badge("storyteller", wrote, 1),
    ];
  }

  // --- staff -----------------------------------------------------------------------------------------------

  async staffCompanies(orgId: OrgId) {
    const scope = practiceStaff(orgId);
    const [companies, reports, problems] = await Promise.all([this.#store.companies(scope), this.#store.reports(scope), this.#practice.problems(scope)]);
    const titles = new Map(problems.map((p) => [p.id, p.title]));
    return companies.map((c) => ({
      ...c,
      reports: reports.filter((r) => r.companyId === c.id).map((r) => ({ ...r, problemTitle: titles.get(r.problemId) ?? "" })),
    }));
  }

  async saveCompany(orgId: OrgId, id: string | null, input: { name: string; about: string; slug?: string | undefined }): Promise<Company> {
    const name = input.name.trim();
    if (name.length === 0) throw new PracticeError("invalid", "A company needs a name");
    try {
      const saved = await this.#store.saveCompany(orgId, id, { slug: input.slug ?? slugOf(name), name, about: input.about });
      if (saved === null) throw new PracticeError("not_found", "No such company");
      return saved;
    } catch (error) {
      if (error instanceof CommunitySlugTaken) throw new PracticeError("slug_taken", error.message);
      throw error;
    }
  }

  async addReports(orgId: OrgId, companyId: string, input: { problemIds: readonly string[]; reportedOn: string }): Promise<number> {
    const scope = practiceStaff(orgId);
    if (!(await this.#store.companies(scope)).some((c) => c.id === companyId)) throw new PracticeError("not_found", "No such company");
    const known = new Set((await this.#practice.problems(scope)).map((p) => p.id));
    if (input.problemIds.some((id) => !known.has(id))) throw new PracticeError("invalid", "Not a problem on this site");
    if (input.reportedOn > this.#today()) throw new PracticeError("invalid", "Reports are of interviews that happened: not a future day");
    for (const problemId of new Set(input.problemIds)) {
      await this.#store.addReport(orgId, { companyId, problemId, reportedOn: input.reportedOn, source: "staff", experienceId: null });
    }
    return new Set(input.problemIds).size;
  }

  async deleteReport(orgId: OrgId, id: string): Promise<void> {
    if (!(await this.#store.deleteReport(orgId, id))) throw new PracticeError("not_found", "No such report");
  }

  async staffExperiences(orgId: OrgId, status?: Experience["status"]) {
    const scope = practiceStaff(orgId);
    const [list, companies, titles] = await Promise.all([this.#store.experiences(scope, status === undefined ? {} : { status }), this.#store.companies(scope), this.#titles(orgId)]);
    const names = new Map(companies.map((c) => [c.id, c]));
    return list.map((e) => ({ ...this.#view(e, names.get(e.companyId), null, false, titles), learnerId: e.learnerId }));
  }

  /**
   * Publish or reject a pending experience. Publishing pays its author, once,
   * and reports each problem its rounds name against the company.
   */
  async decideExperience(orgId: OrgId, id: string, status: "published" | "rejected", by: string) {
    const at = new Date(this.#now());
    const decided = await this.#store.decideExperience(orgId, id, status, by, at);
    if (decided === null) throw new PracticeError("not_found", "No pending experience by that id");
    if (status === "published") {
      await this.#prep.award(orgId, decided.learnerId, { rule: "experience", amount: EXPERIENCE_COINS, key: `exp:${decided.id}` }, at);
      const bySlug = new Map((await this.#practice.problems(practiceStaff(orgId))).map((p) => [p.slug, p.id]));
      const named = new Set(decided.rounds.flatMap((r) => r.problemSlugs).map((s) => bySlug.get(s)).filter((x): x is string => x !== undefined));
      for (const problemId of named) {
        await this.#store.addReport(orgId, { companyId: decided.companyId, problemId, reportedOn: `${decided.interviewed}-01`, source: "experience", experienceId: decided.id });
      }
    }
    return decided;
  }

  async staffItems(orgId: OrgId) {
    return this.#store.items(practiceStaff(orgId));
  }

  async saveItem(orgId: OrgId, id: string | null, draft: StoreItemDraft) {
    if (draft.kind === "plus" && draft.plusDays <= 0) throw new PracticeError("invalid", "A Plus item gives at least a day of Plus");
    if (draft.kind === "coupon" && (draft.couponPercent < 1 || draft.couponPercent > 90)) throw new PracticeError("invalid", "A coupon item takes 1% to 90% off");
    const saved = await this.#store.saveItem(orgId, id, {
      ...draft,
      plusDays: draft.kind === "plus" ? draft.plusDays : 0,
      couponPercent: draft.kind === "coupon" ? draft.couponPercent : 0,
    });
    if (saved === null) throw new PracticeError("not_found", "No such item");
    return saved;
  }

  async storeOrders(orgId: OrgId) {
    const [orders, learners] = await Promise.all([this.#store.storeOrders(practiceStaff(orgId)), this.#practice.learners(orgId)]);
    const who = new Map(learners.map((l) => [l.id, l]));
    return orders.map((o) => ({ ...o, learnerName: who.get(o.learnerId)?.name ?? "", learnerEmail: who.get(o.learnerId)?.email ?? "" }));
  }

  async closeOrder(orgId: OrgId, id: string, status: "fulfilled" | "cancelled", note: string) {
    const closed = await this.#store.closeOrder(orgId, id, status, note, new Date(this.#now()));
    if (closed === null) throw new PracticeError("not_found", "No open order by that id");
    return closed;
  }
}
