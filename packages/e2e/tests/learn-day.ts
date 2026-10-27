import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";
// The password hash alone: the whole API would load Fastify into the test runner.
import { hashPassword } from "@parikshaa/api/passwords";
import { seedOrganisation } from "../src/database.js";

/**
 * A learner's day on a practice site of its own, for Learn's Aaj (tracker row
 * 140, K2-1) against the real API: a track of two lessons and three
 * multiple-choice problems (nothing needs the code runner), a plan made today
 * with no rest days (so its first day is today whatever the weekday), the
 * first lesson done, a wrong answer on the next problem, a problem of the day,
 * a company the learner aims for (one of its problems solved), and a contest
 * three days on. Everything the date changes is in `.ln-dated` on the page.
 */

export interface LearnDay {
  /** The learner's session, for `parikshaa.practice.<site>.session`. */
  readonly token: string;
  /** The problem the plan has the learner on now, answered wrong once. */
  readonly now: { readonly slug: string; readonly title: string };
  readonly potd: { readonly slug: string; readonly title: string };
  readonly company: string;
  readonly contest: string;
}

export const istDay = (offsetDays = 0): string => new Date(Date.now() + 5.5 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

async function ok(res: Promise<APIResponse>, status = 200): Promise<Record<string, unknown>> {
  const r = await res;
  expect(r.status(), await r.text()).toBe(status);
  return (await r.json()) as Record<string, unknown>;
}

export async function seedLearnDay(request: APIRequestContext, { org, site, learner }: { readonly org: string; readonly site: string; readonly learner: { readonly name: string; readonly email: string } }): Promise<LearnDay> {
  const owner = await seedOrganisation(hashPassword, org, "Nalanda Institute of Technology");
  const signedIn = await ok(request.post("/api/auth/login", { data: { email: owner.email, password: owner.password } }));
  const staff = { authorization: `Bearer ${signedIn["token"] as string}` };
  await ok(request.put("/api/practice-admin/site", { headers: staff, data: { slug: site, title: "Nalanda Practice", welcome: "", open: true } }));

  const problem = async (title: string, stem: string, options: string[], correctIndex: number, difficulty: "easy" | "medium" | "hard", tags: string[]) => {
    const filed = await ok(request.post("/api/bank", { headers: staff, data: { question: { kind: "mcq", stem: `${title}\n\n${stem}`, maxScore: 1, rubric: [], options, correctIndex }, difficulty, tags } }), 201);
    const made = (await ok(request.post("/api/practice-admin/problems", { headers: staff, data: { bankQuestionId: filed["id"] } }), 201)) as { id: string; slug: string };
    return { ...made, title };
  };
  const stable = await problem("Stable sorting", "Which of these sorts is **stable**?", ["Heap sort", "Merge sort"], 1, "easy", ["sorting"]);
  const search = await problem("Binary search", "How many comparisons does binary search make on 1,024 items, at most?", ["10", "11", "512"], 1, "medium", ["searching"]);
  const graph = await problem("Shortest paths", "Which algorithm finds shortest paths with negative edges?", ["Dijkstra", "Bellman–Ford"], 1, "hard", ["graphs"]);

  const lesson = async (title: string, body: string, estMinutes: number) =>
    (await ok(request.post("/api/practice-admin/lessons", { headers: staff, data: { title, body, estMinutes, published: true } }), 201)) as { id: string; slug: string };
  const sorting = await lesson("Stable sorting", "A sort is **stable** when equal keys keep their order.", 15);
  const searching = await lesson("Searching a sorted array", "Halve the range at every step.", 20);
  const track = await ok(
    request.post("/api/practice-admin/tracks", {
      headers: staff,
      data: {
        title: "DSA for placements",
        description: "Sorting, searching and graphs.",
        published: true,
        modules: [
          { title: "Sorting", items: [{ lessonId: sorting.id }, { problemId: stable.id }] },
          { title: "Searching", items: [{ lessonId: searching.id }, { problemId: search.id }] },
          { title: "Graphs", items: [{ problemId: graph.id }] },
        ],
      },
    }),
    201,
  );
  const today = istDay();
  await ok(request.put(`/api/practice-admin/potd/${today}`, { headers: staff, data: { problemId: search.id } }));
  const company = await ok(request.post("/api/practice-admin/companies", { headers: staff, data: { name: "Infosys", about: "Online test, then two technical rounds and HR." } }), 201);
  await ok(request.post(`/api/practice-admin/companies/${company["id"] as string}/reports`, { headers: staff, data: { problemIds: [stable.id, search.id, graph.id], reportedOn: today } }), 201);
  // Three days on at 8 pm in India, for ninety minutes.
  const startsAt = `${istDay(3)}T14:30:00.000Z`;
  await ok(
    request.post("/api/practice-admin/contests", {
      headers: staff,
      data: { title: "Weekly Round 13", description: "Three problems, ninety minutes.", startsAt, endsAt: new Date(Date.parse(startsAt) + 90 * 60_000).toISOString(), problemIds: [graph.id] },
    }),
    201,
  );

  const signedUp = await ok(request.post(`/api/practice/${site}/signup`, { data: { name: learner.name, email: learner.email, password: "practice every single day" } }), 201);
  const token = signedUp["token"] as string;
  const auth = { authorization: `Bearer ${token}` };
  // Solved before the plan, so the plan leaves it out; it counts for Infosys and today's streak.
  await ok(request.post(`/api/practice/${site}/problems/${graph.slug}/submit`, { headers: auth, data: { answer: "1" } }));
  await ok(request.put(`/api/practice/${site}/companies/${company["slug"] as string}/target`, { headers: auth, data: { on: true } }));
  await ok(
    request.post(`/api/practice/${site}/plan`, {
      headers: auth,
      data: { track: track["slug"], level: "intermediate", deadline: istDay(30), dailyMinutes: 60, offDays: [], goal: "Infosys, SDE" },
    }),
    201,
  );
  await ok(request.post(`/api/practice/${site}/lessons/${sorting.slug}/done`, { headers: auth }));
  await ok(request.post(`/api/practice/${site}/problems/${stable.slug}/submit`, { headers: auth, data: { answer: "0" } }));
  return { token, now: { slug: stable.slug, title: stable.title }, potd: { slug: search.slug, title: search.title }, company: "Infosys", contest: "Weekly Round 13" };
}
