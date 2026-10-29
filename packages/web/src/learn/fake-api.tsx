import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { ContestSummary, Home, Note, PlanTask, ProblemList, Revision, Submission, TrackView } from "../practice/client.ts";
import { LearnApp } from "./LearnApp.tsx";

/**
 * For Learn's tests: a fake of the practice site's API that answers and
 * records every request, a learner's day to answer with, and the app rendered
 * as main.tsx renders it (inside the app's query client).
 */

export const SITE = "demo";
export const SESSION = `parikshaa.practice.${SITE}.session`;

export type Handler = (url: URL) => { status?: number; body: unknown } | Promise<{ status?: number; body: unknown }>;
export interface FakeApi {
  readonly routes: Record<string, Handler>;
  readonly calls: { method: string; path: string; auth: string | null }[];
}

export const task = (id: string, title: string, kind: PlanTask["kind"], done = false, extra: Partial<PlanTask> = {}): PlanTask => ({
  id,
  day: "2026-10-27",
  sprint: 2,
  kind,
  title,
  estMinutes: 30,
  done,
  movedFrom: null,
  link: null,
  difficulty: null,
  ...extra,
});

export const TODAY: readonly PlanTask[] = [
  task("t1", "Stack: the LIFO idea", "learn", true, { link: { kind: "lesson", slug: "stack-lifo" }, estMinutes: 25 }),
  task("t2", "Pair with target sum", "practice", false, { link: { kind: "problem", slug: "pair-sum" }, difficulty: "medium" }),
  task("t3", "Valid brackets", "practice", false, { link: { kind: "problem", slug: "valid-brackets" }, difficulty: "easy", estMinutes: 35, movedFrom: "2026-10-26" }),
  task("t4", "Revise: two pointers", "revise", false, { estMinutes: 15 }),
  task("t5", "Update my resume", "custom", false, { estMinutes: 25 }),
];

export const HOME: Home = {
  name: "Aarav Sharma",
  today: "2026-10-27",
  streak: 12,
  longestStreak: 20,
  coins: 340,
  checkin: 1,
  dueCards: 6,
  focusMinutesToday: 25,
  potd: { day: "2026-10-27", slug: "koko", title: "Koko eating bananas", difficulty: "medium", solved: false, solvedThatDay: false },
  plan: {
    track: { slug: "dsa", title: "DSA for placements" },
    startedAt: "2026-09-20T05:00:00.000Z",
    finishOn: "2026-12-16",
    deadline: "2026-12-18",
    sprint: 2,
    sprints: [
      { sprint: 1, from: "2026-09-20", to: "2026-10-25", tasks: 30, done: 30 },
      { sprint: 2, from: "2026-10-26", to: "2026-11-01", tasks: 12, done: 3 },
    ],
    today: TODAY,
    moved: 1,
  },
  continue: null,
  solved: 41,
  frozenToday: false,
  freezesLeft: 1,
};

export const WRONG: Submission = { id: "s1", language: "cpp", answer: "", status: "wrong_answer", passed: 22, total: 30, timeMs: 12, memoryKb: 900, createdAt: "2026-10-27T10:00:00Z", inContest: false };

export const CONTESTS: readonly ContestSummary[] = [
  { slug: "weekly-12", title: "Weekly Round 12", startsAt: "2026-10-25T14:30:00Z", endsAt: "2026-10-25T16:00:00Z", problems: 3, state: "ended" },
  { slug: "weekly-14", title: "Weekly Round 14", startsAt: "2026-11-08T14:30:00Z", endsAt: "2026-11-08T16:00:00Z", problems: 3, state: "upcoming" },
  { slug: "weekly-13", title: "Weekly Round 13", startsAt: "2026-11-01T14:30:00Z", endsAt: "2026-11-01T16:00:00Z", problems: 3, state: "upcoming" },
];

/** Today's revision (K2-3): one card with the learner's note, one without. */
export const REVISION: Revision = {
  due: [
    {
      slug: "pair-sum",
      title: "Pair with target sum",
      difficulty: "medium",
      tags: ["two pointers", "arrays"],
      dueOn: "2026-10-27",
      lastReviewedAt: null,
      reps: 0,
      note: "Sort, then move **two pointers** inward.\n\n```cpp\nlong long sum = (long long)a[L] + a[R];\n```\n\n<img src=x onerror=alert(1)>",
      next: { again: 1, hard: 1, good: 3, easy: 7 },
    },
    { slug: "valid-brackets", title: "Valid brackets", difficulty: "easy", tags: ["stack"], dueOn: "2026-10-27", lastReviewedAt: "2026-10-21T10:00:00Z", reps: 2, note: null, next: { again: 1, hard: 6, good: 13, easy: 16 } },
  ],
  later: 0,
  upcoming: 4,
};

/** The learner's lists (K2-3): bookmarks first, then one of their own. */
export const LISTS: readonly ProblemList[] = [
  { name: "Bookmarks", solved: 1, problems: [{ slug: "koko", title: "Koko eating bananas", difficulty: "medium", solved: true }, { slug: "pair-sum", title: "Pair with target sum", difficulty: "medium", solved: false }] },
  { name: "Before Infosys OA", solved: 0, problems: [{ slug: "valid-brackets", title: "Valid brackets", difficulty: "easy", solved: false }] },
];

/** The learner's notes (K2-3), newest first: on a problem, a topic and a lesson. */
export const NOTES: readonly Note[] = [
  { kind: "problem", ref: "pair-sum", title: "Pair with target sum", body: "1. Sort first.\n2. Cast before adding: `(long long)a + b`.\n\n<script>alert(1)</script>", updatedAt: "2026-10-25T09:00:00Z" },
  { kind: "topic", ref: "overflow-checklist", title: "Overflow checklist", body: "Test with **2^30 + 2^30** before submitting.", updatedAt: "2026-10-20T09:00:00Z" },
  { kind: "lesson", ref: "stack-lifo", title: "Stack: the LIFO idea", body: "Last in, first out.", updatedAt: null },
];

/** A track (K2-4): a module done, one under way (a lesson, a problem tried), one locked behind Plus. */
export const DSA: TrackView = {
  slug: "dsa",
  title: "DSA for placements",
  description: "Sorting, searching and **graphs**.",
  items: 5,
  done: 2,
  modules: [
    {
      title: "Sorting",
      done: 2,
      items: [
        { kind: "lesson", slug: "stable-sorting", title: "Stable sorting", difficulty: null, estMinutes: 15, status: "done", locked: false },
        { kind: "problem", slug: "sort-colours", title: "Sort colours", difficulty: "easy", estMinutes: 20, status: "done", locked: false },
      ],
    },
    {
      title: "Searching",
      done: 0,
      items: [
        { kind: "lesson", slug: "binary-search", title: "Searching a sorted array", difficulty: null, estMinutes: 20, status: null, locked: false },
        { kind: "problem", slug: "pair-sum", title: "Pair with target sum", difficulty: "medium", estMinutes: 30, status: "attempted", locked: false },
      ],
    },
    { title: "Graphs", done: 0, items: [{ kind: "problem", slug: "bellman", title: "Shortest paths", difficulty: "hard", estMinutes: 40, status: null, locked: true }] },
  ],
};

/** A signed-in learner's day, answered by the fake API; each test changes what it needs. */
export function fakeApi(): FakeApi {
  const api: FakeApi = {
    calls: [],
    routes: {
      "GET /practice/demo/me": () => ({ body: { id: "l1", name: "Aarav Sharma", email: "aarav@example.com", emailVerified: true } }),
      "GET /practice/demo/home": () => ({ body: HOME }),
      "GET /practice/demo/companies/targets": () => ({ body: { targets: [{ slug: "infosys", name: "Infosys", readiness: { solved: 31, of: 50, percent: 62 } }] } }),
      "GET /practice/demo/contests": () => ({ body: { contests: CONTESTS } }),
      "GET /practice/demo/problems/pair-sum/submissions": () => ({ body: { submissions: [WRONG] } }),
      "GET /practice/demo/revise": () => ({ body: REVISION }),
      "GET /practice/demo/lists": () => ({ body: { lists: LISTS } }),
      "GET /practice/demo/notes": () => ({ body: { notes: NOTES } }),
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, "http://localhost");
      const path = decodeURIComponent(url.pathname.replace(/^\/api/, ""));
      const method = init.method ?? "GET";
      const headers = (init.headers ?? {}) as Record<string, string>;
      api.calls.push({ method, path, auth: headers["authorization"] ?? null });
      const handler = api.routes[`${method} ${path}`];
      const { status = 200, body } = handler === undefined ? { status: 404, body: { error: "not_found" } } : await handler(url);
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }),
  );
  return api;
}

/** Learn as main.tsx renders it: inside the app's query client (no retries, as there). */
export function renderLearn(site = SITE) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LearnApp site={site} />
    </QueryClientProvider>,
  );
}
