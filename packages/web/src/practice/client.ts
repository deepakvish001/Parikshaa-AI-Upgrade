import type { CandidateQuestion } from "@parikshaa/core/browser";
import { ApiError, type RunOutcome, type SubmitOutcome } from "../api.ts";

/**
 * A practice site's API (ROADMAP §15), as a learner uses it: `/practice/<site>`
 * on the server, under `/api` as the candidate app's calls are.
 */

export type Difficulty = "easy" | "medium" | "hard";
export type Standing = "solved" | "attempted" | null;

export interface Site {
  readonly slug: string;
  readonly title: string;
  readonly welcome: string;
}

export interface Learner {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface Session {
  readonly token: string;
  readonly expiresAt: string;
  readonly learner: Learner;
}

export interface ProblemSummary {
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly kind: CandidateQuestion["kind"];
  readonly acceptance: number | null;
  readonly solvedBy: number;
  readonly status: Standing;
}

export interface Problem {
  readonly slug: string;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly tags: readonly string[];
  readonly question: CandidateQuestion;
  readonly editorial: string | null;
  readonly editorialLocked: boolean;
  readonly acceptance: number | null;
  readonly solvedBy: number;
  readonly status: Standing;
  readonly contest: { readonly slug: string; readonly title: string; readonly endsAt: string } | null;
}

export interface Verdict {
  readonly status: string;
  readonly passed: number;
  readonly total: number;
  readonly compileOutput: string | null;
  readonly timeMs: number | null;
  readonly memoryKb: number | null;
  readonly cases: Extract<SubmitOutcome, { compiled: true }>["cases"];
  readonly submissionId: string;
  readonly firstSolve: boolean;
}

export interface Submission {
  readonly id: string;
  readonly language: string | null;
  readonly answer: string;
  readonly status: string;
  readonly passed: number;
  readonly total: number;
  readonly timeMs: number | null;
  readonly memoryKb: number | null;
  readonly createdAt: string;
  readonly inContest: boolean;
}

export interface Comment {
  readonly id: string;
  readonly authorName: string;
  readonly fromStaff: boolean;
  readonly body: string;
  readonly createdAt: string;
}

interface Counts {
  readonly easy: number;
  readonly medium: number;
  readonly hard: number;
  readonly total: number;
}

export interface Progress {
  readonly solved: Counts;
  readonly available: Counts;
  readonly streak: number;
  readonly longestStreak: number;
  readonly activeDays: number;
  readonly days: readonly { readonly day: string; readonly accepted: number; readonly submitted: number }[];
  readonly recent: readonly { readonly slug: string; readonly title: string; readonly at: string }[];
  readonly rank: number | null;
}

export interface Leader {
  readonly rank: number;
  readonly name: string;
  readonly solved: number;
  readonly you: boolean;
}

export type ContestState = "upcoming" | "running" | "ended";

export interface ContestSummary {
  readonly slug: string;
  readonly title: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly problems: number;
  readonly state: ContestState;
}

export interface Contest {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly state: ContestState;
  readonly problems: readonly { readonly label: string; readonly slug: string; readonly title: string; readonly difficulty: Difficulty; readonly status: Standing }[];
  readonly scoreboard: readonly {
    readonly rank: number;
    readonly name: string;
    readonly solved: number;
    readonly penalty: number;
    readonly problems: readonly { readonly minutes: number | null; readonly wrong: number }[];
    readonly you: boolean;
  }[];
}

/** A learner's session on one site, kept on this device: practice is done on one's own machine, over weeks. */
const tokenKey = (site: string) => `parikshaa.practice.${site}.session`;

export function loadToken(site: string): string | null {
  try {
    return localStorage.getItem(tokenKey(site));
  } catch {
    return null;
  }
}

export function saveToken(site: string, token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(tokenKey(site));
    else localStorage.setItem(tokenKey(site), token);
  } catch {
    // A private window: the session lasts this page.
  }
}

export class PracticeClient {
  readonly #base: string;
  readonly #token: string | null;

  constructor(
    readonly slug: string,
    token: string | null,
    baseUrl = "/api",
  ) {
    this.#base = `${baseUrl.replace(/\/$/, "")}/practice/${encodeURIComponent(slug)}`;
    this.#token = token;
  }

  get signedIn(): boolean {
    return this.#token !== null;
  }

  async #request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.#base}${path}`, {
      ...init,
      headers: {
        ...(this.#token === null ? {} : { authorization: `Bearer ${this.#token}` }),
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) throw new ApiError(response.status, typeof body["error"] === "string" ? body["error"] : "request_failed", body);
    return body as T;
  }

  #post<T>(path: string, body?: object): Promise<T> {
    return this.#request<T>(path, { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }

  site(): Promise<Site> {
    return this.#request("");
  }

  signUp(name: string, email: string, password: string): Promise<Session> {
    return this.#post("/signup", { name, email, password });
  }

  signIn(email: string, password: string): Promise<Session> {
    return this.#post("/signin", { email, password });
  }

  async signOut(): Promise<void> {
    await this.#post("/signout");
  }

  /** The signed-in learner; null when the session has ended. */
  async me(): Promise<Learner | null> {
    if (this.#token === null) return null;
    try {
      return await this.#request<Learner>("/me");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  }

  async deleteAccount(): Promise<void> {
    await this.#request("/me", { method: "DELETE" });
  }

  async problems(): Promise<readonly ProblemSummary[]> {
    return (await this.#request<{ problems: ProblemSummary[] }>("/problems")).problems;
  }

  problem(slug: string, contest?: string): Promise<Problem> {
    return this.#request(`/problems/${encodeURIComponent(slug)}${contestQuery(contest)}`);
  }

  run(slug: string, language: string, source: string, input?: string, contest?: string): Promise<RunOutcome> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/run`, {
      language,
      source,
      ...(input === undefined ? {} : { input }),
      ...(contest === undefined ? {} : { contest }),
    });
  }

  submit(slug: string, answer: string, language?: string, contest?: string): Promise<Verdict> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/submit`, {
      answer,
      ...(language === undefined ? {} : { language }),
      ...(contest === undefined ? {} : { contest }),
    });
  }

  async submissions(slug: string, contest?: string): Promise<readonly Submission[]> {
    return (await this.#request<{ submissions: Submission[] }>(`/problems/${encodeURIComponent(slug)}/submissions${contestQuery(contest)}`)).submissions;
  }

  async comments(slug: string): Promise<readonly Comment[]> {
    return (await this.#request<{ comments: Comment[] }>(`/problems/${encodeURIComponent(slug)}/comments`)).comments;
  }

  comment(slug: string, body: string): Promise<Comment> {
    return this.#post(`/problems/${encodeURIComponent(slug)}/comments`, { body });
  }

  progress(): Promise<Progress> {
    return this.#request("/progress");
  }

  async leaderboard(): Promise<readonly Leader[]> {
    return (await this.#request<{ leaders: Leader[] }>("/leaderboard")).leaders;
  }

  async contests(): Promise<readonly ContestSummary[]> {
    return (await this.#request<{ contests: ContestSummary[] }>("/contests")).contests;
  }

  contest(slug: string): Promise<Contest> {
    return this.#request(`/contests/${encodeURIComponent(slug)}`);
  }
}

const contestQuery = (contest: string | undefined) => (contest === undefined ? "" : `?contest=${encodeURIComponent(contest)}`);

/** A practice verdict as the coding workspace shows a submission. */
export function asSubmitOutcome(verdict: Verdict): SubmitOutcome {
  if (verdict.status === "compile_error") return { tested: true, compiled: false, compileOutput: verdict.compileOutput ?? "" };
  return { tested: true, compiled: true, passed: verdict.passed, total: verdict.total, cases: verdict.cases };
}
