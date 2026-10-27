import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { ContestSummary, Home, PlanTask, Submission } from "../practice/client.ts";
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
