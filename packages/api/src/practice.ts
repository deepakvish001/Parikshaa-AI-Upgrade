import { randomBytes } from "node:crypto";
import { verify as argon2Verify, hash as argon2Hash } from "@node-rs/argon2";
import {
  candidateQuestion,
  decodeCodeAnswer,
  encodeCodeAnswer,
  languagesOf,
  runnable,
  scoreDeterministic,
  similarPairs,
  type CandidateQuestion,
  type CodeAnswer,
  type CodeQuestion,
  type OrgId,
  type Question,
} from "@parikshaa/core";
import { RunnerUnavailable, type CodeRunner, type RunResult } from "@parikshaa/runner";
import {
  practiceLearner,
  practiceStaff,
  type Contest,
  type Difficulty,
  type Learner,
  type PracticeProblem,
  type PracticeSite,
  type PracticeStore,
  type ProblemDraft,
  type QuestionBank,
  type Submission,
} from "@parikshaa/store";
import { RateLimiter } from "./rate-limit.js";
import { digest, hashPassword } from "./staff-auth.js";

/**
 * Practice (ROADMAP §15): what a learner does on an institution's practice
 * site, and what its staff do to run one.
 *
 * Learners are not candidates. Nothing here is written to the integrity
 * ledger, and nothing a learner does touches an exam. What they share with
 * candidates is the code runner and the rule about tests: a hidden test comes
 * back as its verdict alone, never its input — the same problem may be set in
 * an exam next month.
 */

const SESSION_PREFIX = "pl_";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Failed submissions after which the editorial opens even to someone who has not solved it. */
export const EDITORIAL_AFTER_FAILURES = 3;
/** ICPC's rule: each wrong submission before the accepted one costs this many minutes. */
export const PENALTY_MINUTES = 20;

export class PracticeError extends Error {
  constructor(
    readonly code:
      | "not_found"
      | "closed"
      | "invalid"
      | "email_taken"
      | "sign_in_failed"
      | "slug_taken"
      | "not_practicable"
      | "language_not_offered"
      | "too_many_runs"
      | "contest_not_started"
      | "email_not_verified"
      | "plus_required"
      | "no_credits"
      | "tutor_closed"
      | "unavailable"
      | "payment_invalid"
      | "not_configured"
      | "no_coins"
      | "sold_out"
      | "limit_reached"
      | "too_new"
      | "coupon_invalid",
    message: string,
  ) {
    super(message);
    this.name = "PracticeError";
  }
}

let decoy: Promise<string> | null = null;
const decoyHash = () => (decoy ??= argon2Hash(randomBytes(24).toString("base64url")));

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$/;

/** A title as an address: "Two Sum (easy)" → "two-sum-easy". */
export const slugOf = (title: string): string =>
  title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "") || "problem";

export interface LearnerSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly learner: Learner;
}

export interface ProblemListItem {
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly kind: Question["kind"];
  /** Share of submissions accepted, 0–1; null before anyone submits. */
  readonly acceptance: number | null;
  readonly solvedBy: number;
  /** The signed-in learner's standing on it. */
  readonly status: "solved" | "attempted" | null;
}

export interface ProblemView {
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly question: CandidateQuestion;
  /** Null until the learner has solved it, or tried enough times. */
  readonly editorial: string | null;
  readonly editorialLocked: boolean;
  readonly acceptance: number | null;
  readonly solvedBy: number;
  readonly status: "solved" | "attempted" | null;
  /** The contest this was opened from, while it runs: submissions count on its scoreboard. */
  readonly contest: { readonly slug: string; readonly title: string; readonly endsAt: string } | null;
}

export interface Verdict {
  readonly status: string;
  readonly passed: number;
  readonly total: number;
  readonly compileOutput: string | null;
  readonly timeMs: number | null;
  readonly memoryKb: number | null;
  readonly cases: readonly {
    readonly number: number;
    readonly visible: boolean;
    readonly status: string;
    readonly timeMs: number;
    readonly memoryKb: number | null;
    readonly input: string | null;
    readonly expectedOutput: string | null;
    readonly stdout: string | null;
    readonly result: string | null;
    readonly stderr: string | null;
  }[];
  readonly submissionId: string;
  readonly firstSolve: boolean;
}

export interface ProgressView {
  readonly solved: { readonly easy: number; readonly medium: number; readonly hard: number; readonly total: number };
  readonly available: { readonly easy: number; readonly medium: number; readonly hard: number; readonly total: number };
  readonly streak: number;
  readonly longestStreak: number;
  readonly activeDays: number;
  readonly days: readonly { readonly day: string; readonly accepted: number; readonly submitted: number }[];
  readonly recent: readonly { readonly slug: string; readonly title: string; readonly at: string }[];
  readonly rank: number | null;
}

export interface ScoreboardRow {
  readonly rank: number;
  readonly name: string;
  readonly learnerId: string;
  readonly solved: number;
  readonly penalty: number;
  /** Per problem, in contest order: minutes to accepted and wrong tries before it; null minutes when not solved. */
  readonly problems: readonly { readonly minutes: number | null; readonly wrong: number }[];
}

export type ContestState = "upcoming" | "running" | "ended";

const stateOf = (contest: Contest, now: number): ContestState =>
  now < Date.parse(contest.startsAt) ? "upcoming" : now < Date.parse(contest.endsAt) ? "running" : "ended";

/** Consecutive IST days, ending today or yesterday, with an accepted submission; and the longest such run. */
export function streaks(
  days: readonly { day: string; accepted: number }[],
  today: string,
  /** Days taken off on purpose: they neither count toward a streak nor break it. */
  frozen: ReadonlySet<string> = new Set(),
): { current: number; longest: number } {
  const active = new Set(days.filter((d) => d.accepted > 0).map((d) => d.day));
  const kept = (day: string) => active.has(day) || frozen.has(day);
  const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  let current = 0;
  let cursor = kept(today) ? today : dayBefore(today);
  while (kept(cursor)) {
    if (active.has(cursor)) current++;
    cursor = dayBefore(cursor);
  }
  let longest = 0;
  for (const day of [...active].sort()) {
    let run = 1;
    let back = dayBefore(day);
    while (kept(back)) {
      if (active.has(back)) run++;
      back = dayBefore(back);
    }
    longest = Math.max(longest, run);
  }
  return { current, longest };
}

/** Today, as a date in India Standard Time. */
export const istDay = (ms: number): string => new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** An ICPC scoreboard: problems solved, then least penalty. */
export function scoreboard(contest: Contest, submissions: readonly (Submission & { name: string })[]): ScoreboardRow[] {
  const start = Date.parse(contest.startsAt);
  const end = Date.parse(contest.endsAt);
  const byLearner = new Map<string, { name: string; problems: Map<string, { minutes: number | null; wrong: number }> }>();
  for (const s of submissions) {
    const at = Date.parse(s.createdAt);
    if (at < start || at >= end || !contest.problemIds.includes(s.problemId)) continue;
    const entry = byLearner.get(s.learnerId) ?? { name: s.name, problems: new Map() };
    const cell = entry.problems.get(s.problemId) ?? { minutes: null, wrong: 0 };
    if (cell.minutes === null) {
      if (s.status === "passed") cell.minutes = Math.floor((at - start) / 60_000);
      else if (s.status !== "compile_error") cell.wrong++;
    }
    entry.problems.set(s.problemId, cell);
    byLearner.set(s.learnerId, entry);
  }
  const rows = [...byLearner.entries()].map(([learnerId, { name, problems }]) => {
    const cells = contest.problemIds.map((id) => problems.get(id) ?? { minutes: null, wrong: 0 });
    const solved = cells.filter((c) => c.minutes !== null);
    return {
      learnerId,
      name,
      solved: solved.length,
      penalty: solved.reduce((sum, c) => sum + c.minutes! + PENALTY_MINUTES * c.wrong, 0),
      problems: cells,
    };
  });
  rows.sort((a, b) => b.solved - a.solved || a.penalty - b.penalty || a.name.localeCompare(b.name));
  let rank = 0;
  return rows.map((row, i) => {
    const previous = rows[i - 1];
    if (previous === undefined || previous.solved !== row.solved || previous.penalty !== row.penalty) rank = i + 1;
    return { rank, ...row };
  });
}

export class PracticeService {
  readonly #store: PracticeStore;
  readonly #bank: QuestionBank;
  readonly #runner: CodeRunner | null;
  readonly #now: () => number;
  readonly #runs = new RateLimiter({ perSecond: 0.5, burst: 20 });
  readonly #submits = new RateLimiter({ perSecond: 0.2, burst: 10 });
  readonly #comments = new RateLimiter({ perSecond: 0.05, burst: 5 });

  constructor(options: { store: PracticeStore; bank: QuestionBank; runner?: CodeRunner | null; now?: () => number }) {
    this.#store = options.store;
    this.#bank = options.bank;
    this.#runner = options.runner ?? null;
    this.#now = options.now ?? (() => Date.now());
  }

  // --- the site, as a visitor finds it -------------------------------------------------

  /** An open site by its address. A closed one is not found: its learners are told nothing. */
  async site(slug: string): Promise<PracticeSite> {
    const site = await this.#store.siteBySlug(slug);
    if (site === null || !site.open) throw new PracticeError("not_found", "There is no practice site here");
    return site;
  }

  // --- learner accounts -------------------------------------------------------------------

  async signUp(slug: string, input: { name: string; email: string; password: string }): Promise<LearnerSession> {
    const site = await this.site(slug);
    const name = input.name.trim();
    const email = input.email.trim();
    if (name.length < 1 || name.length > 80) throw new PracticeError("invalid", "A name is 1 to 80 characters");
    if (!EMAIL.test(email) || email.length > 200) throw new PracticeError("invalid", "That is not an email address");
    const passwordHash = await hashPassword(input.password).catch(() => {
      throw new PracticeError("invalid", "A password is at least 12 characters");
    });
    let learner: Learner;
    try {
      learner = await this.#store.createLearner({ orgId: site.orgId, email, name, passwordHash });
    } catch (error) {
      if ((error as Error).name === "EmailTaken") throw new PracticeError("email_taken", "There is already an account with that email here");
      throw error;
    }
    return this.#session(learner);
  }

  /** Null for any failure, saying nothing about which part failed. */
  async signIn(slug: string, email: string, password: string): Promise<LearnerSession | null> {
    const site = await this.site(slug);
    const learner = await this.#store.learnerByEmail(site.orgId, email);
    if (learner === null) {
      await argon2Verify(await decoyHash(), password).catch(() => false);
      return null;
    }
    if (!(await argon2Verify(learner.passwordHash, password).catch(() => false))) return null;
    const { passwordHash: _, ...safe } = learner;
    return this.#session(safe);
  }

  /** A session for a learner already proven to be who they are, by a password or a provider. */
  sessionFor(learner: Learner): Promise<LearnerSession> {
    return this.#session(learner);
  }

  async #session(learner: Learner): Promise<LearnerSession> {
    const token = `${SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(this.#now() + SESSION_TTL_MS);
    await this.#store.createSession(learner.id, digest(token), expiresAt);
    return { token, expiresAt: expiresAt.toISOString(), learner };
  }

  /** The learner behind a bearer value, on this site; null otherwise. */
  async learner(site: PracticeSite, bearer: string | undefined): Promise<Learner | null> {
    if (bearer === undefined || !bearer.startsWith(SESSION_PREFIX)) return null;
    const learner = await this.#store.learnerForSession(digest(bearer), new Date(this.#now()));
    return learner !== null && learner.orgId === site.orgId ? learner : null;
  }

  async signOut(bearer: string): Promise<void> {
    await this.#store.revokeSession(digest(bearer));
  }

  async deleteAccount(learner: Learner): Promise<void> {
    await this.#store.eraseLearner(learner.orgId, learner.id);
  }

  // --- problems -----------------------------------------------------------------------------

  async problems(site: PracticeSite, learner: Learner | null): Promise<readonly ProblemListItem[]> {
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const [problems, stats, progress] = await Promise.all([
      this.#store.problems(scope),
      this.#store.problemStats(site.orgId),
      this.#store.progress(scope),
    ]);
    const statsOf = new Map(stats.map((s) => [s.problemId, s]));
    const solved = new Set(progress.solved.map((s) => s.problemId));
    const attempted = new Set(progress.attempted);
    return problems.map((p) => {
      const s = statsOf.get(p.id);
      return {
        slug: p.slug,
        title: p.title,
        difficulty: p.difficulty,
        tags: p.tags,
        kind: p.question.kind,
        acceptance: s === undefined || s.submissions === 0 ? null : s.accepted / s.submissions,
        solvedBy: s?.solvedBy ?? 0,
        status: solved.has(p.id) ? "solved" : attempted.has(p.id) ? "attempted" : null,
      };
    });
  }

  /**
   * A problem as a learner may see it: published, or in a contest that has
   * started — and opened from that contest.
   */
  async #find(site: PracticeSite, slug: string, contestSlug: string | undefined): Promise<{ problem: PracticeProblem; contest: Contest | null }> {
    const open = await this.#store.problemBySlug(practiceLearner(site.orgId, null), slug);
    let contest: Contest | null = null;
    if (contestSlug !== undefined) {
      contest = await this.#store.contestBySlug(practiceLearner(site.orgId, null), contestSlug);
      if (contest === null) throw new PracticeError("not_found", "No such contest");
      if (stateOf(contest, this.#now()) === "upcoming") throw new PracticeError("contest_not_started", "The contest has not started");
    }
    if (open !== null) {
      return { problem: open, contest: contest !== null && contest.problemIds.includes(open.id) ? contest : null };
    }
    // Unpublished, so only through a contest that includes it. Read in the staff
    // scope because row-level security keeps unpublished problems from learners.
    if (contest === null) throw new PracticeError("not_found", "No such problem");
    const hidden = await this.#store.problemBySlug(practiceStaff(site.orgId), slug);
    if (hidden === null || !contest.problemIds.includes(hidden.id)) throw new PracticeError("not_found", "No such problem");
    return { problem: hidden, contest };
  }

  async problem(site: PracticeSite, slug: string, learner: Learner | null, contestSlug?: string): Promise<ProblemView> {
    const { problem, contest } = await this.#find(site, slug, contestSlug);
    const scope = practiceLearner(site.orgId, learner?.id ?? null);
    const [stats, mine] = await Promise.all([this.#store.problemStats(site.orgId), this.#store.submissions(scope, { problemId: problem.id, limit: 500 })]);
    const s = stats.find((x) => x.problemId === problem.id);
    const solved = mine.some((m) => m.status === "passed");
    const failures = mine.filter((m) => m.status !== "passed").length;
    // While a contest runs, its problems' editorials stay shut for everyone.
    const running = contest !== null && stateOf(contest, this.#now()) === "running";
    const editorialOpen = !running && problem.editorial.trim() !== "" && (solved || failures >= EDITORIAL_AFTER_FAILURES);
    return {
      slug: problem.slug,
      title: problem.title,
      difficulty: problem.difficulty,
      tags: problem.tags,
      question: candidateQuestion(problem.question),
      editorial: editorialOpen ? problem.editorial : null,
      editorialLocked: problem.editorial.trim() !== "" && !editorialOpen,
      acceptance: s === undefined || s.submissions === 0 ? null : s.accepted / s.submissions,
      solvedBy: s?.solvedBy ?? 0,
      status: solved ? "solved" : mine.length > 0 ? "attempted" : null,
      contest: running ? { slug: contest.slug, title: contest.title, endsAt: contest.endsAt } : null,
    };
  }

  #code(problem: PracticeProblem, language: string): CodeQuestion {
    const q = problem.question;
    if (q.kind !== "code") throw new PracticeError("not_practicable", "This problem is not answered in code");
    if (!languagesOf(q).includes(language)) throw new PracticeError("language_not_offered", `This problem is answered in ${languagesOf(q).join(" or ")}`);
    return q;
  }

  #limit(limiter: RateLimiter, key: string): void {
    if (!limiter.take(key).ok) throw new PracticeError("too_many_runs", "Slow down a little and try again in a moment");
  }

  async #run(question: CodeQuestion, answer: CodeAnswer, tests: readonly { id: string; input: string; expected: string }[], ownInput = false): Promise<RunResult> {
    if (this.#runner === null) throw new RunnerUnavailable("No code runner is configured");
    const prepared = runnable(question, answer);
    return this.#runner.run({
      language: answer.language as never,
      source: prepared.source,
      tests,
      checker: ownInput && prepared.checker.kind === "custom" ? { kind: "exact" } : prepared.checker,
      ...(prepared.resultMarker === undefined ? {} : { resultMarker: prepared.resultMarker }),
      ...(question.limits === undefined ? {} : { limits: question.limits }),
    });
  }

  /** Run on the examples, or on the learner's own input. Records nothing. */
  async run(site: PracticeSite, learner: Learner, slug: string, answer: CodeAnswer, input?: string, contestSlug?: string) {
    const { problem } = await this.#find(site, slug, contestSlug);
    const question = this.#code(problem, answer.language);
    this.#limit(this.#runs, learner.id);
    const samples = (question.tests ?? []).filter((t) => !t.hidden);
    const tests =
      input !== undefined ? [{ id: "custom", input, expected: "" }] : samples.map((t, i) => ({ id: `sample-${i + 1}`, input: t.input, expected: t.expected }));
    const result = await this.#run(question, answer, tests, input !== undefined);
    if (!result.compiled) return { compiled: false as const, compileOutput: result.compileOutput };
    return {
      compiled: true as const,
      results: result.tests.map((r, i) => ({
        input: tests[i]!.input,
        expectedOutput: input !== undefined ? null : tests[i]!.expected,
        status: input !== undefined && ["passed", "wrong_answer", "checker_error"].includes(r.status) ? ("ran" as const) : r.status,
        stdout: r.stdout,
        result: r.result ?? null,
        stderr: r.stderr,
        timeMs: r.timeMs,
        memoryKb: r.memoryKb,
        checkerMessage: input !== undefined ? null : (r.checkerMessage ?? null),
      })),
    };
  }

  /**
   * Submit: judged against every test, recorded, and — during a contest that
   * includes the problem — counted on its scoreboard.
   */
  async submit(site: PracticeSite, learner: Learner, slug: string, answer: string, language: string | null, contestSlug?: string): Promise<Verdict> {
    const { problem, contest } = await this.#find(site, slug, contestSlug);
    const running = contest !== null && stateOf(contest, this.#now()) === "running" ? contest : null;
    this.#limit(this.#submits, learner.id);
    const scope = practiceLearner(site.orgId, learner.id);
    const before = await this.#store.submissions(scope, { problemId: problem.id, limit: 500 });
    const solvedBefore = before.some((s) => s.status === "passed");
    const question = problem.question;

    let verdict: Omit<Verdict, "submissionId" | "firstSolve">;
    let stored: string;
    if (question.kind === "code") {
      const code: CodeAnswer = { language: language ?? question.language, source: answer };
      this.#code(problem, code.language);
      stored = encodeCodeAnswer(code);
      const tests = question.tests ?? [];
      if (tests.length === 0) throw new PracticeError("not_practicable", "This problem has no tests to check an answer against");
      const result = await this.#run(question, code, tests);
      verdict = this.#codeVerdict(tests, result);
    } else if (question.kind === "mcq" || question.kind === "numeric") {
      stored = answer;
      const score = scoreDeterministic(question, answer);
      const passed = score !== null && score.score >= question.maxScore;
      verdict = { status: passed ? "passed" : "wrong_answer", passed: passed ? 1 : 0, total: 1, compileOutput: null, timeMs: null, memoryKb: null, cases: [] };
    } else {
      throw new PracticeError("not_practicable", "This problem cannot be checked automatically");
    }

    const saved = await this.#store.addSubmission(scope, {
      problemId: problem.id,
      contestId: running?.id ?? null,
      language: question.kind === "code" ? decodeCodeAnswer(stored, question).language : null,
      answer: question.kind === "code" ? answer : stored,
      status: verdict.status,
      passed: verdict.passed,
      total: verdict.total,
      timeMs: verdict.timeMs,
      memoryKb: verdict.memoryKb,
    });
    return { ...verdict, submissionId: saved.id, firstSolve: !solvedBefore && verdict.status === "passed" };
  }

  #codeVerdict(tests: NonNullable<CodeQuestion["tests"]>, result: RunResult): Omit<Verdict, "submissionId" | "firstSolve"> {
    if (!result.compiled) {
      return { status: "compile_error", passed: 0, total: tests.length, compileOutput: result.compileOutput, timeMs: null, memoryKb: null, cases: [] };
    }
    const byId = new Map(result.tests.map((r) => [r.id, r]));
    const cases = tests.map((test, i) => {
      const outcome = byId.get(test.id);
      return {
        number: i + 1,
        visible: !test.hidden,
        status: outcome?.status ?? "runtime_error",
        timeMs: outcome?.timeMs ?? 0,
        memoryKb: outcome?.memoryKb ?? null,
        // A hidden test's content never leaves: the same problem may be set in an exam.
        input: test.hidden ? null : test.input,
        expectedOutput: test.hidden ? null : test.expected,
        stdout: test.hidden ? null : (outcome?.stdout ?? ""),
        result: test.hidden ? null : (outcome?.result ?? null),
        stderr: test.hidden ? null : (outcome?.stderr ?? ""),
      };
    });
    const failing = cases.find((c) => c.status !== "passed");
    return {
      status: failing?.status ?? "passed",
      passed: cases.filter((c) => c.status === "passed").length,
      total: cases.length,
      compileOutput: null,
      timeMs: Math.max(0, ...cases.map((c) => c.timeMs)),
      memoryKb: cases.some((c) => c.memoryKb !== null) ? Math.max(...cases.map((c) => c.memoryKb ?? 0)) : null,
      cases,
    };
  }

  /** The learner's own submissions of a problem, newest first, with their code. */
  async submissions(site: PracticeSite, learner: Learner, slug: string, contestSlug?: string): Promise<readonly Submission[]> {
    const { problem } = await this.#find(site, slug, contestSlug);
    return this.#store.submissions(practiceLearner(site.orgId, learner.id), { problemId: problem.id, limit: 100 });
  }

  // --- progress and ranking ---------------------------------------------------------------------

  async progress(site: PracticeSite, learner: Learner): Promise<ProgressView> {
    const scope = practiceLearner(site.orgId, learner.id);
    const [problems, progress, board] = await Promise.all([this.#store.problems(scope), this.#store.progress(scope), this.#store.leaderboard(site.orgId, 5000)]);
    const bySlug = new Map(problems.map((p) => [p.id, p]));
    const count = (list: readonly PracticeProblem[]) => ({
      easy: list.filter((p) => p.difficulty === "easy").length,
      medium: list.filter((p) => p.difficulty === "medium").length,
      hard: list.filter((p) => p.difficulty === "hard").length,
      total: list.length,
    });
    const solvedProblems = progress.solved.map((s) => bySlug.get(s.problemId)).filter((p): p is PracticeProblem => p !== undefined);
    const { current, longest } = streaks(progress.days, istDay(this.#now()));
    const rank = board.findIndex((r) => r.learnerId === learner.id);
    return {
      solved: count(solvedProblems),
      available: count(problems),
      streak: current,
      longestStreak: longest,
      activeDays: progress.days.filter((d) => d.submitted > 0).length,
      days: progress.days,
      recent: [...progress.solved]
        .reverse()
        .slice(0, 10)
        .flatMap((s) => {
          const p = bySlug.get(s.problemId);
          return p === undefined ? [] : [{ slug: p.slug, title: p.title, at: s.at }];
        }),
      rank: rank < 0 ? null : rank + 1,
    };
  }

  async leaderboard(site: PracticeSite, learner: Learner | null) {
    const rows = await this.#store.leaderboard(site.orgId, 100);
    return rows.map((r, i) => ({ rank: i + 1, name: r.name, solved: r.solved, you: learner !== null && r.learnerId === learner.id }));
  }

  // --- contests ------------------------------------------------------------------------------------

  async contests(site: PracticeSite) {
    const now = this.#now();
    return (await this.#store.contests(practiceLearner(site.orgId, null))).map((c) => ({
      slug: c.slug,
      title: c.title,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      problems: c.problemIds.length,
      state: stateOf(c, now),
    }));
  }

  async contest(site: PracticeSite, slug: string, learner: Learner | null) {
    const contest = await this.#store.contestBySlug(practiceLearner(site.orgId, null), slug);
    if (contest === null) throw new PracticeError("not_found", "No such contest");
    const state = stateOf(contest, this.#now());
    // Before the start, a contest's problems are not named: that would be a head start.
    const all = state === "upcoming" ? [] : await this.#store.problems(practiceStaff(site.orgId));
    const byId = new Map(all.map((p) => [p.id, p]));
    const board = state === "upcoming" ? [] : scoreboard(contest, await this.#store.contestSubmissions(site.orgId, contest.id));
    const mine = learner === null ? undefined : board.find((r) => r.learnerId === learner.id);
    return {
      slug: contest.slug,
      title: contest.title,
      description: contest.description,
      startsAt: contest.startsAt,
      endsAt: contest.endsAt,
      state,
      problems: contest.problemIds.flatMap((id, i) => {
        const p = byId.get(id);
        if (p === undefined) return [];
        const cell = mine?.problems[i];
        return [
          {
            label: String.fromCharCode(65 + i),
            slug: p.slug,
            title: p.title,
            difficulty: p.difficulty,
            status: cell === undefined ? null : cell.minutes !== null ? ("solved" as const) : cell.wrong > 0 ? ("attempted" as const) : null,
          },
        ];
      }),
      scoreboard: board.map(({ learnerId, ...row }) => ({ ...row, you: learner !== null && learnerId === learner.id })),
    };
  }

  // --- discussion ------------------------------------------------------------------------------------

  async comments(site: PracticeSite, slug: string) {
    const { problem } = await this.#find(site, slug, undefined).catch(() => {
      throw new PracticeError("not_found", "No such problem");
    });
    return (await this.#store.comments(practiceLearner(site.orgId, null), problem.id)).map(({ id, authorName, fromStaff, body, createdAt }) => ({
      id,
      authorName,
      fromStaff,
      body,
      createdAt,
    }));
  }

  async comment(site: PracticeSite, learner: Learner, slug: string, body: string) {
    const text = body.trim();
    if (text.length < 1 || text.length > 4000) throw new PracticeError("invalid", "A comment is 1 to 4000 characters");
    const { problem } = await this.#find(site, slug, undefined);
    this.#limit(this.#comments, learner.id);
    const c = await this.#store.addComment(practiceLearner(site.orgId, learner.id), { problemId: problem.id, authorName: learner.name, body: text });
    return { id: c.id, authorName: c.authorName, fromStaff: false, body: c.body, createdAt: c.createdAt };
  }

  // --- staff -----------------------------------------------------------------------------------------

  /**
   * Learners whose latest code for a problem is alike, once names, comments,
   * layout and literals are set aside and the starter code taken out: the
   * exam's winnowing measure (ROADMAP §4), for a person to look at. A match
   * is never a finding — two short answers to a narrow problem can honestly
   * agree — and it changes nothing a learner sees.
   */
  async similarity(orgId: OrgId, problemId: string) {
    const scope = practiceStaff(orgId);
    const problem = (await this.#store.problems(scope)).find((p) => p.id === problemId);
    if (problem === undefined) throw new PracticeError("not_found", "No such problem");
    if (problem.question.kind !== "code") throw new PracticeError("not_practicable", "Only code is compared");
    const [submissions, learners] = await Promise.all([
      this.#store.submissions(scope, { problemId, limit: 500 }),
      this.#store.learners(orgId),
    ]);
    const nameOf = new Map(learners.map((l) => [l.id, l.name]));
    // Each learner's latest accepted answer, or their latest if none was.
    const latest = new Map<string, Submission>();
    for (const sub of submissions) {
      const held = latest.get(sub.learnerId);
      if (held === undefined || (held.status !== "passed" && sub.status === "passed")) latest.set(sub.learnerId, sub);
    }
    const given = [...latest.values()].filter((sub) => sub.language !== null);
    const byLearner = new Map(given.map((sub) => [sub.learnerId, sub]));
    const side = (learnerId: string) => {
      const sub = byLearner.get(learnerId)!;
      return {
        learnerId,
        name: nameOf.get(learnerId) ?? "Deleted account",
        language: sub.language!,
        source: sub.answer,
        status: sub.status,
        submittedAt: sub.createdAt,
      };
    };
    return {
      problem: { id: problem.id, title: problem.title },
      compared: given.length,
      pairs: similarPairs(
        given.map((sub) => ({ key: sub.learnerId, language: sub.language!, source: sub.answer })),
        problem.question.starter ?? null,
      ).map((p) => ({ a: side(p.a), b: side(p.b), similarity: p.similarity, shared: p.shared })),
    };
  }

  async siteFor(orgId: OrgId): Promise<PracticeSite | null> {
    return this.#store.siteOf(orgId);
  }

  async saveSite(orgId: OrgId, input: { slug: string; title: string; welcome: string; open: boolean }): Promise<PracticeSite> {
    const slug = input.slug.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) throw new PracticeError("invalid", "An address is 3 to 40 lowercase letters, digits and dashes");
    if (input.title.trim() === "" || input.title.length > 120) throw new PracticeError("invalid", "A title is 1 to 120 characters");
    try {
      return await this.#store.saveSite({ orgId, slug, title: input.title.trim(), welcome: input.welcome, open: input.open });
    } catch (error) {
      if ((error as Error).name === "SlugTaken") throw new PracticeError("slug_taken", "Another site uses that address");
      throw error;
    }
  }

  async staffProblems(orgId: OrgId) {
    const [problems, stats] = await Promise.all([this.#store.problems(practiceStaff(orgId)), this.#store.problemStats(orgId)]);
    const statsOf = new Map(stats.map((s) => [s.problemId, s]));
    return problems.map((p) => ({ ...p, submissions: statsOf.get(p.id)?.submissions ?? 0, solvedBy: statsOf.get(p.id)?.solvedBy ?? 0 }));
  }

  /** Can a question be practised: checked by machine, and a code question by tests. */
  static practicable(question: Question): string | null {
    if (question.kind === "short") return "A short answer needs a person or a model to mark it; practice checks answers automatically.";
    if (question.kind === "code" && (question.tests ?? []).length === 0) return "A code question needs tests to be practised.";
    return null;
  }

  async publish(
    orgId: OrgId,
    input: { bankQuestionId: string; title?: string; slug?: string; difficulty?: Difficulty; tags?: readonly string[]; editorial?: string; hint?: string; published?: boolean },
  ): Promise<PracticeProblem> {
    const entry = (await this.#bank.list({ orgId, actor: "staff" }, { includeArchived: false })).find((e) => e.id === input.bankQuestionId);
    if (entry === undefined) throw new PracticeError("not_found", "No such question in the bank");
    const unfit = PracticeService.practicable(entry.question);
    if (unfit !== null) throw new PracticeError("not_practicable", unfit);
    const title = (input.title ?? entry.question.stem.split("\n")[0]!.replace(/[`*_#]/g, "").slice(0, 80)).trim() || "Problem";
    const existing = await this.#store.problems(practiceStaff(orgId));
    let slug = input.slug ?? slugOf(title);
    if (input.slug === undefined) for (let n = 2; existing.some((p) => p.slug === slug); n++) slug = `${slugOf(title).slice(0, 74)}-${n}`;
    if (!SLUG.test(slug)) throw new PracticeError("invalid", "An address is lowercase letters, digits and dashes");
    const draft: ProblemDraft = {
      slug,
      title,
      question: entry.question,
      difficulty: input.difficulty ?? entry.difficulty,
      tags: input.tags ?? entry.tags,
      editorial: input.editorial ?? "",
      hint: input.hint?.trim() ?? "",
      fromBank: entry.id,
      position: existing.length,
      published: input.published ?? true,
    };
    try {
      return await this.#store.addProblem(orgId, draft);
    } catch (error) {
      if ((error as Error).name === "SlugTaken") throw new PracticeError("slug_taken", "Another problem uses that address");
      throw error;
    }
  }

  async updateProblem(
    orgId: OrgId,
    id: string,
    patch: { title?: string; slug?: string; difficulty?: Difficulty; tags?: readonly string[]; editorial?: string; hint?: string; published?: boolean; position?: number },
  ): Promise<PracticeProblem> {
    const current = (await this.#store.problems(practiceStaff(orgId))).find((p) => p.id === id);
    if (current === undefined) throw new PracticeError("not_found", "No such problem");
    const next: ProblemDraft = {
      slug: patch.slug ?? current.slug,
      title: patch.title?.trim() || current.title,
      question: current.question,
      difficulty: patch.difficulty ?? current.difficulty,
      tags: patch.tags ?? current.tags,
      editorial: patch.editorial ?? current.editorial,
      hint: patch.hint?.trim() ?? current.hint,
      fromBank: current.fromBank,
      position: patch.position ?? current.position,
      published: patch.published ?? current.published,
    };
    if (!SLUG.test(next.slug)) throw new PracticeError("invalid", "An address is lowercase letters, digits and dashes");
    try {
      const saved = await this.#store.updateProblem(orgId, id, next);
      if (saved === null) throw new PracticeError("not_found", "No such problem");
      return saved;
    } catch (error) {
      if ((error as Error).name === "SlugTaken") throw new PracticeError("slug_taken", "Another problem uses that address");
      throw error;
    }
  }

  async staffContests(orgId: OrgId) {
    const now = this.#now();
    return (await this.#store.contests(practiceStaff(orgId))).map((c) => ({ ...c, state: stateOf(c, now) }));
  }

  async saveContest(
    orgId: OrgId,
    id: string | null,
    input: { title: string; slug?: string; description: string; startsAt: string; endsAt: string; problemIds: readonly string[] },
  ): Promise<Contest> {
    const problems = await this.#store.problems(practiceStaff(orgId));
    if (input.problemIds.length < 1 || input.problemIds.length > 26) throw new PracticeError("invalid", "A contest has 1 to 26 problems");
    if (input.problemIds.some((pid) => !problems.some((p) => p.id === pid))) throw new PracticeError("invalid", "Every problem must be one of the site's");
    if (!(Date.parse(input.endsAt) > Date.parse(input.startsAt))) throw new PracticeError("invalid", "A contest ends after it starts");
    const slug = input.slug ?? slugOf(input.title);
    if (!SLUG.test(slug)) throw new PracticeError("invalid", "An address is lowercase letters, digits and dashes");
    try {
      const saved = await this.#store.saveContest(orgId, id, {
        slug,
        title: input.title.trim(),
        description: input.description,
        startsAt: new Date(input.startsAt).toISOString(),
        endsAt: new Date(input.endsAt).toISOString(),
        problemIds: input.problemIds,
      });
      if (saved === null) throw new PracticeError("not_found", "No such contest");
      return saved;
    } catch (error) {
      if ((error as Error).name === "SlugTaken") throw new PracticeError("slug_taken", "Another contest uses that address");
      throw error;
    }
  }

  async learners(orgId: OrgId) {
    return (await this.#store.learners(orgId)).map(({ id, name, email, createdAt, solved, submissions, lastActiveAt }) => ({
      id,
      name,
      email,
      joinedAt: createdAt,
      solved,
      submissions,
      lastActiveAt,
    }));
  }

  async staffComments(orgId: OrgId) {
    const [comments, problems] = await Promise.all([this.#store.comments(practiceStaff(orgId), null), this.#store.problems(practiceStaff(orgId))]);
    const titles = new Map(problems.map((p) => [p.id, p]));
    return comments.map((c) => ({ ...c, problemTitle: titles.get(c.problemId)?.title ?? "", problemSlug: titles.get(c.problemId)?.slug ?? "" }));
  }

  async replyAsStaff(orgId: OrgId, staff: { id: string; name: string }, problemSlug: string, body: string) {
    const problem = await this.#store.problemBySlug(practiceStaff(orgId), problemSlug);
    if (problem === null) throw new PracticeError("not_found", "No such problem");
    const text = body.trim();
    if (text.length < 1 || text.length > 4000) throw new PracticeError("invalid", "A comment is 1 to 4000 characters");
    return this.#store.addComment(practiceStaff(orgId), { problemId: problem.id, authorName: staff.name, body: text, staffUserId: staff.id });
  }

  async hideComment(orgId: OrgId, id: string, hidden: boolean): Promise<void> {
    if (!(await this.#store.setCommentHidden(orgId, id, hidden))) throw new PracticeError("not_found", "No such comment");
  }
}
