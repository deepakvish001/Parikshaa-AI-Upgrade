import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * Prep (ROADMAP §16), through the HTTP API: staff build tracks of lessons and
 * problems; a learner starts a study plan, works through it, and is paid coins,
 * given revision and moved along when a day is missed. Runs as `parikshaa_app`,
 * so row-level security is live. The clock is the test's: days pass on demand.
 */

const DAY = 86_400_000;
// Monday 5 October 2026, 09:30 in India.
let clock = Date.parse("2026-10-05T04:00:00Z");
const PASSWORD = "a long enough password";

const mcq = (stem: string, correct: number) => ({ kind: "mcq", stem, maxScore: 1, rubric: [], options: ["one", "two", "three"], correctIndex: correct });

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let viewer: string;
const problems: Record<string, { id: string; slug: string }> = {};

function call(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}

async function ok(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200) {
  const res = await call(method, token, url, payload);
  expect(res.statusCode, res.payload).toBe(status);
  return res.json();
}

beforeEach(async () => {
  clock = Date.parse("2026-10-05T04:00:00Z");
  db = await freshDatabase();
  let identity;
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await addStaff(identity, org, "viewer@nit.test", "viewer");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@nit.test");
  viewer = await signIn(app, "viewer@nit.test");
  await ok("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true }, 200);
  for (const [name, stem, difficulty] of [
    ["arrays", "Arrays are stored how", "easy"],
    ["search", "Binary search needs what", "medium"],
    ["graphs", "BFS uses which structure", "hard"],
  ] as const) {
    const q = await ok("POST", owner, "/bank", { question: mcq(stem, 1), difficulty });
    problems[name] = await ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id });
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

async function buildTrack() {
  const lesson = await ok("POST", owner, "/practice-admin/lessons", { title: "What an array is", body: "# Arrays\nContiguous memory.", videoUrl: "https://videos.example/arrays", estMinutes: 15, published: true });
  const track = await ok("POST", owner, "/practice-admin/tracks", {
    title: "DSA Basics",
    description: "Start here.",
    published: true,
    modules: [
      { title: "Arrays", items: [{ lessonId: lesson.id }, { problemId: problems.arrays!.id }] },
      { title: "Searching", items: [{ problemId: problems.search!.id }, { problemId: problems.graphs!.id }] },
    ],
  });
  return { lesson, track };
}

async function signUp(email = "asha@example.com", name = "Asha") {
  return (await ok("POST", null, "/practice/nit-practice/signup", { name, email, password: PASSWORD })).token as string;
}

const S = "/practice/nit-practice";

describe("content", () => {
  it("is made by staff with the right to write, and read by anyone", async () => {
    expect((await call("POST", viewer, "/practice-admin/lessons", { title: "x", body: "", estMinutes: 5, published: true })).statusCode).toBe(403);
    expect((await call("POST", owner, "/practice-admin/lessons", { title: "Bad video", body: "", videoUrl: "http://insecure.example/v", estMinutes: 5, published: true })).statusCode).toBe(422);
    expect(
      (await call("POST", owner, "/practice-admin/tracks", { title: "Broken", description: "", published: true, modules: [{ title: "M", items: [{ problemId: "no-such" }] }] })).statusCode,
    ).toBe(422);
    const { track } = await buildTrack();
    expect(track.slug).toBe("dsa-basics");
    expect(track.modules.map((m: { items: unknown[] }) => m.items.length)).toEqual([2, 2]);

    const list = await ok("GET", null, `${S}/tracks`);
    expect(list.tracks).toEqual([{ slug: "dsa-basics", title: "DSA Basics", description: "Start here.", modules: 2, items: 4, done: 0 }]);
    const view = await ok("GET", null, `${S}/tracks/dsa-basics`);
    expect(view.modules[0].items.map((i: { kind: string; slug: string }) => [i.kind, i.slug])).toEqual([
      ["lesson", "what-an-array-is"],
      ["problem", problems.arrays!.slug],
    ]);
    const lesson = await ok("GET", null, `${S}/lessons/what-an-array-is`);
    expect(lesson).toMatchObject({ title: "What an array is", videoUrl: "https://videos.example/arrays", done: false });

    // A track taken off the site is gone for learners, not for staff.
    await ok("PUT", owner, `/practice-admin/tracks/${track.id}`, { title: "DSA Basics", description: "", published: false, modules: [] });
    expect((await ok("GET", null, `${S}/tracks`)).tracks).toEqual([]);
    expect((await call("GET", null, `${S}/tracks/dsa-basics`)).statusCode).toBe(404);
  });
});

describe("a learner's day", () => {
  beforeEach(() => buildTrack());

  it("pays a check-in coin once a day", async () => {
    const asha = await signUp();
    expect((await ok("GET", asha, `${S}/home`)).checkin).toBe(1);
    expect((await ok("GET", asha, `${S}/home`)).checkin).toBe(0);
    clock += DAY;
    const home = await ok("GET", asha, `${S}/home`);
    expect(home).toMatchObject({ checkin: 1, coins: 2, plan: null, continue: { slug: "dsa-basics", done: 0, items: 4, next: { kind: "lesson" } } });
    expect((await call("GET", null, `${S}/home`)).statusCode).toBe(401);
  });

  it("tells the dashboard when the plan began, as the plan does: Learn's Aaj counts the plan's days from it", async () => {
    const asha = await signUp();
    const { plan } = await ok("POST", asha, `${S}/plan`, { track: "dsa-basics", level: "intermediate", deadline: "2026-10-30", dailyMinutes: 75, offDays: [0] });
    expect(Number.isNaN(Date.parse(plan.startedAt))).toBe(false);
    clock += DAY;
    expect((await ok("GET", asha, `${S}/home`)).plan).toMatchObject({ startedAt: plan.startedAt, deadline: "2026-10-30" });
  });

  it("finishes a lesson once, for coins, and counts it on the track", async () => {
    const asha = await signUp();
    expect(await ok("POST", asha, `${S}/lessons/what-an-array-is/done`, undefined, 200)).toEqual({ coins: 5, reasons: ["lesson"] });
    expect(await ok("POST", asha, `${S}/lessons/what-an-array-is/done`, undefined, 200)).toEqual({ coins: 0, reasons: [] });
    expect((await ok("GET", asha, `${S}/tracks/dsa-basics`)).done).toBe(1);
  });

  it("plans the track, marks work done as it happens, and moves on what was missed", async () => {
    const asha = await signUp();
    const input = { track: "dsa-basics", level: "intermediate", deadline: "2026-10-30", dailyMinutes: 75, offDays: [0] };
    const preview = await ok("POST", asha, `${S}/plan/preview`, input, 200);
    expect(preview).toMatchObject({ tasks: 4, totalMinutes: 15 + 20 + 40 + 60, finishOn: "2026-10-07", fits: true, dailyMinutesToFit: null });
    // A deadline that is too near says how much a day it would take.
    const tight = await ok("POST", asha, `${S}/plan/preview`, { ...input, deadline: "2026-10-11", dailyMinutes: 15, offDays: [0, 1, 2, 3, 4, 5] }, 200);
    // Saturdays only: one study day before the deadline, and every item needs one of its own.
    expect(tight).toMatchObject({ fits: false, finishOn: "2026-10-31", dailyMinutesToFit: 170 });
    expect((await call("POST", asha, `${S}/plan/preview`, { ...input, deadline: "2026-10-06" })).statusCode).toBe(422);

    const { plan } = await ok("POST", asha, `${S}/plan`, { ...input, goal: "SDE-1" });
    expect(plan).toMatchObject({ goal: "SDE-1", finishOn: "2026-10-07", onTrack: true, done: 0, sprint: 1 });
    expect(plan.today.map((t: { title: string }) => t.title)).toEqual(["What an array is", "Arrays are stored how"]);

    // Solving the day's problem does its task, pays for it and makes a revision card.
    await ok("PUT", owner, `/practice-admin/potd/2026-10-05`, { problemId: problems.arrays!.id }, 200);
    const verdict = await ok("POST", asha, `${S}/problems/${problems.arrays!.slug}/submit`, { answer: "1" }, 200);
    expect(verdict).toMatchObject({ status: "passed", firstSolve: true, reward: { coins: 15, reasons: ["solve", "potd"] } });
    const again = await ok("POST", asha, `${S}/problems/${problems.arrays!.slug}/submit`, { answer: "1" }, 200);
    expect(again.reward).toEqual({ coins: 0, reasons: [] });
    const wrong = await ok("POST", asha, `${S}/problems/${problems.search!.slug}/submit`, { answer: "0" }, 200);
    expect(wrong.reward).toEqual({ coins: 0, reasons: [] });
    let now = (await ok("GET", asha, `${S}/plan`)).plan;
    expect(now.today.map((t: { done: boolean }) => t.done)).toEqual([false, true]);
    expect((await ok("GET", asha, `${S}/revise`)).due).toEqual([]);

    // Three days pass with nothing done. What was left is moved on, not dropped.
    clock += 3 * DAY; // Thursday the 8th
    now = (await ok("GET", asha, `${S}/plan`)).plan;
    expect(now.moved).toBeGreaterThan(0);
    const today = now.today.map((t: { title: string; movedFrom: string | null }) => [t.title, t.movedFrom]);
    expect(today[0]).toEqual(["What an array is", "2026-10-05"]);
    expect(now.total).toBe(5);

    // The solved problem is due for revision now; remembering it well pushes it out.
    const revise = await ok("GET", asha, `${S}/revise`);
    expect(revise.due.map((d: { slug: string }) => d.slug)).toEqual([problems.arrays!.slug]);
    expect(await ok("POST", asha, `${S}/revise/${problems.arrays!.slug}`, { grade: "good" }, 200)).toEqual({ dueOn: "2026-10-11", intervalDays: 3 });
    expect((await ok("GET", asha, `${S}/revise`)).due).toEqual([]);
    expect((await call("POST", asha, `${S}/revise/${problems.search!.slug}`, { grade: "good" })).statusCode).toBe(404);

    // A task of the learner's own, then done by hand.
    await ok("POST", asha, `${S}/plan/tasks`, { title: "Update my resume", estMinutes: 20 });
    now = (await ok("GET", asha, `${S}/plan`)).plan;
    const mine = now.today.find((t: { kind: string }) => t.kind === "custom");
    await ok("PUT", asha, `${S}/plan/tasks/${mine.id}`, { done: true }, 200);
    expect((await ok("GET", asha, `${S}/plan`)).plan.completed.map((t: { title: string }) => t.title)).toContain("Update my resume");

    // Somebody else has no plan, and cannot touch this one.
    const ravi = await signUp("ravi@example.com", "Ravi");
    expect((await ok("GET", ravi, `${S}/plan`)).plan).toBeNull();
    expect((await call("PUT", ravi, `${S}/plan/tasks/${mine.id}`, { done: false })).statusCode).toBe(404);

    await ok("DELETE", asha, `${S}/plan`, undefined, 200);
    expect((await ok("GET", asha, `${S}/plan`)).plan).toBeNull();
  });

  it("gives the weekend its own minutes, plans only what fits when asked, and changes a running plan without losing what is done", async () => {
    const asha = await signUp();
    // 30 a weekday (24 once revision is set aside), every item on a day of its own; a deadline of Sunday the 11th.
    const input = { track: "dsa-basics", level: "intermediate", deadline: "2026-10-11", dailyMinutes: 30, offDays: [] };
    const tight = await ok("POST", asha, `${S}/plan/preview`, input, 200);
    expect(tight).toMatchObject({ fits: true, finishOn: "2026-10-08" });
    const tighter = await ok("POST", asha, `${S}/plan/preview`, { ...input, offDays: [1, 2, 3, 4, 5] }, 200);
    // Weekends only: the 10th and the 11th before the deadline hold two of the four items.
    expect(tighter).toMatchObject({ fits: false, itemsThatFit: { items: 2, of: 4 } });
    // More minutes on a weekend day fit more of it.
    const weekend = await ok("POST", asha, `${S}/plan/preview`, { ...input, offDays: [1, 2, 3, 4, 5], weekendMinutes: 120 }, 200);
    expect(weekend).toMatchObject({ fits: true, finishOn: "2026-10-11" });
    expect((await call("POST", asha, `${S}/plan/preview`, { ...input, weekendMinutes: 5 })).statusCode).toBe(422);
    // Plan only the two that fit.
    const part = (await ok("POST", asha, `${S}/plan`, { ...input, offDays: [1, 2, 3, 4, 5], upTo: 2 })).plan;
    expect(part).toMatchObject({ onTrack: true, weekendMinutes: null });
    expect([...part.today, ...part.upcoming].filter((t: { kind: string }) => t.kind !== "revise").map((t: { title: string }) => t.title)).toEqual(["What an array is", "Arrays are stored how"]);

    // A full plan instead; a day's work done, a task of the learner's own; then a change.
    let plan = (await ok("POST", asha, `${S}/plan`, input)).plan;
    expect(plan.today.map((t: { title: string }) => t.title)).toEqual(["What an array is"]);
    await ok("POST", asha, `${S}/lessons/what-an-array-is/done`, undefined, 200);
    await ok("POST", asha, `${S}/plan/tasks`, { title: "Mock interview", estMinutes: 30, day: "2026-10-07" });
    clock += DAY; // Tuesday the 6th
    expect((await call("PATCH", asha, `${S}/plan`, { dailyMinutes: 5 })).statusCode).toBe(422);
    plan = (await ok("PATCH", asha, `${S}/plan`, { deadline: "2026-10-31", dailyMinutes: 150, weekendMinutes: 60 }, 200)).plan;
    expect(plan).toMatchObject({ deadline: "2026-10-31", dailyMinutes: 150, weekendMinutes: 60, done: 1 });
    const work = [...plan.today, ...plan.upcoming] as { title: string; day: string; sprint: number; kind: string }[];
    // What was done stays done; the rest starts today, in a new sprint, beside the learner's own task.
    expect(plan.completed.map((t: { title: string }) => t.title)).toEqual(["What an array is"]);
    expect(work.filter((t) => t.kind === "practice").map((t) => [t.title, t.day, t.sprint])).toEqual([
      ["Arrays are stored how", "2026-10-06", 2],
      ["Binary search needs what", "2026-10-06", 2],
      ["BFS uses which structure", "2026-10-06", 2],
    ]);
    expect(work.find((t) => t.kind === "custom")).toMatchObject({ title: "Mock interview", day: "2026-10-07" });
    expect(work.filter((t) => t.title === "What an array is")).toEqual([]);

    const ravi = await signUp("ravi@example.com", "Ravi");
    expect((await call("PATCH", ravi, `${S}/plan`, { dailyMinutes: 60 })).statusCode).toBe(404);
  });

  it("times focus, and pays a module's milestone when it is finished", async () => {
    const asha = await signUp();
    const session = await ok("POST", asha, `${S}/focus`, {});
    clock += 25 * 60_000;
    expect(await ok("POST", asha, `${S}/focus/${session.id}/stop`, undefined, 200)).toEqual({ seconds: 1500 });
    expect((await ok("GET", asha, `${S}/focus`)).days.at(-1)).toEqual({ day: "2026-10-05", minutes: 25 });

    await ok("POST", asha, `${S}/lessons/what-an-array-is/done`, undefined, 200);
    const solved = await ok("POST", asha, `${S}/problems/${problems.arrays!.slug}/submit`, { answer: "1" }, 200);
    expect(solved.reward).toEqual({ coins: 110, reasons: ["solve", "module"] });
    const coins = await ok("GET", asha, `${S}/coins`);
    expect(coins.balance).toBe(115);
    expect(coins.history.map((h: { rule: string }) => h.rule)).toEqual(expect.arrayContaining(["lesson", "solve", "module"]));
    const leaders = await ok("GET", null, `${S}/coins/leaders`);
    expect(leaders.leaders).toEqual([{ rank: 1, name: "Asha", title: null, username: null, coins: 115, you: false }]);
  });
});

describe("lists, notes and the problem of the day", () => {
  it("gathers a track's notes in its order, module by module, with topic notes after", async () => {
    await buildTrack();
    const asha = await signUp();
    await ok("PUT", asha, `${S}/notes/problem/${problems.graphs!.slug}`, { body: "Queue, level by level." }, 200);
    await ok("PUT", asha, `${S}/notes/lesson/what-an-array-is`, { body: "Indexing is O(1)." }, 200);
    await ok("PUT", asha, `${S}/notes/problem/${problems.arrays!.slug}`, { body: "Contiguous." }, 200);
    await ok("PUT", asha, `${S}/notes/topic/Two pointers`, { body: "Sorted input, ends moving in." }, 200);
    const book = await ok("GET", asha, `${S}/notes/book?track=dsa-basics`);
    expect(book).toEqual({
      track: { slug: "dsa-basics", title: "DSA Basics" },
      modules: [
        {
          title: "Arrays",
          notes: [
            { kind: "lesson", slug: "what-an-array-is", title: "What an array is", body: "Indexing is O(1)." },
            { kind: "problem", slug: problems.arrays!.slug, title: "Arrays are stored how", body: "Contiguous." },
          ],
        },
        { title: "Searching", notes: [{ kind: "problem", slug: problems.graphs!.slug, title: "BFS uses which structure", body: "Queue, level by level." }] },
      ],
      topics: [{ title: "Two pointers", body: "Sorted input, ends moving in." }],
    });
    // Another learner's book has none of them.
    const ravi = await signUp("ravi@example.com", "Ravi");
    expect(await ok("GET", ravi, `${S}/notes/book?track=dsa-basics`)).toMatchObject({ modules: [], topics: [] });
    expect((await call("GET", asha, `${S}/notes/book?track=nope`)).statusCode).toBe(404);
    expect((await call("GET", null, `${S}/notes/book?track=dsa-basics`)).statusCode).toBe(401);
  });

  it("keeps a learner's lists and notes, theirs alone", async () => {
    const asha = await signUp();
    const slug = problems.search!.slug;
    await ok("PUT", asha, `${S}/lists/Bookmarks/${slug}`, undefined, 200);
    await ok("PUT", asha, `${S}/lists/Amazon%20prep/${slug}`, undefined, 200);
    await ok("PUT", asha, `${S}/lists/Amazon%20prep/${problems.graphs!.slug}`, undefined, 200);
    let lists = (await ok("GET", asha, `${S}/lists`)).lists;
    expect(lists.map((l: { name: string; problems: unknown[] }) => [l.name, l.problems.length])).toEqual([
      ["Bookmarks", 1],
      ["Amazon prep", 2],
    ]);
    await ok("DELETE", asha, `${S}/lists/Amazon%20prep/${slug}`, undefined, 200);
    lists = (await ok("GET", asha, `${S}/lists`)).lists;
    expect(lists[1].problems.map((p: { slug: string }) => p.slug)).toEqual([problems.graphs!.slug]);
    expect((await call("PUT", asha, `${S}/lists/%3Cscript%3E/${slug}`)).statusCode).toBe(422);
    expect((await call("PUT", asha, `${S}/lists/Bookmarks/no-such-problem`)).statusCode).toBe(404);

    await ok("PUT", asha, `${S}/notes/problem/${slug}`, { body: "lo, hi = 0, n - 1" }, 200);
    await ok("PUT", asha, `${S}/notes/topic/Binary Search on answers`, { body: "Monotonic check." }, 200);
    const notes = (await ok("GET", asha, `${S}/notes`)).notes;
    expect(notes.map((n: { kind: string; ref: string; title: string }) => [n.kind, n.ref, n.title])).toEqual(
      expect.arrayContaining([
        ["problem", slug, "Binary search needs what"],
        ["topic", "binary-search-on-answers", "Binary Search on answers"],
      ]),
    );
    expect((await ok("GET", asha, `${S}/notes/problem/${slug}`)).body).toBe("lo, hi = 0, n - 1");
    await ok("PUT", asha, `${S}/notes/problem/${slug}`, { body: "  " }, 200);
    expect((await ok("GET", asha, `${S}/notes/problem/${slug}`)).updatedAt).toBeNull();

    const ravi = await signUp("ravi@example.com", "Ravi");
    expect((await ok("GET", ravi, `${S}/notes`)).notes).toEqual([]);
    expect((await ok("GET", ravi, `${S}/lists`)).lists).toEqual([{ name: "Bookmarks", problems: [], solved: 0 }]);
  });

  it("schedules a problem a day, and shows the last month's with who solved them", async () => {
    expect((await call("PUT", viewer, `/practice-admin/potd/2026-10-05`, { problemId: problems.arrays!.id })).statusCode).toBe(403);
    await ok("PUT", owner, `/practice-admin/potd/2026-10-04`, { problemId: problems.graphs!.id }, 200);
    await ok("PUT", owner, `/practice-admin/potd/2026-10-05`, { problemId: problems.arrays!.id }, 200);
    await ok("PUT", owner, `/practice-admin/potd/2026-10-06`, { problemId: problems.search!.id }, 200);
    expect((await call("PUT", owner, `/practice-admin/potd/2026-10-07`, { problemId: "nope" })).statusCode).toBe(422);
    const schedule = await ok("GET", owner, "/practice-admin/potd");
    expect(schedule.today).toBe("2026-10-05");
    expect(schedule.days).toHaveLength(3);

    const potd = await ok("GET", null, `${S}/potd`);
    // Tomorrow's is not shown before its day.
    expect(potd.today).toMatchObject({ day: "2026-10-05", slug: problems.arrays!.slug, solved: false });
    expect(potd.calendar.map((d: { day: string }) => d.day)).toEqual(["2026-10-05", "2026-10-04"]);
  });
});

describe("the end of a sprint, and a day off", () => {
  beforeEach(() => buildTrack());
  const input = { track: "dsa-basics", level: "intermediate", deadline: "2026-10-30", dailyMinutes: 75, offDays: [0] };

  it("opens the sprint's quiz when its days are over, sends what was missed back to revise, and pays a pass once", async () => {
    const asha = await signUp();
    await ok("POST", asha, `${S}/plan`, input);
    const closed = await ok("GET", asha, `${S}/plan/sprints/1/quiz`);
    expect(closed).toMatchObject({ sprint: 1, open: false, passPercent: 70, questions: [], count: 3, sittings: [] });
    expect((await call("POST", asha, `${S}/plan/sprints/1/quiz`, { answers: {} })).statusCode).toBe(422);
    expect((await call("GET", asha, `${S}/plan/sprints/9/quiz`)).statusCode).toBe(404);

    // Thursday: the sprint's days are over.
    clock += 3 * DAY;
    const quiz = await ok("GET", asha, `${S}/plan/sprints/1/quiz`);
    expect(quiz.open).toBe(true);
    expect(quiz.questions.map((q: { slug: string }) => q.slug)).toEqual([problems.arrays!.slug, problems.search!.slug, problems.graphs!.slug]);
    // The answer key never leaves.
    expect(JSON.stringify(quiz)).not.toContain("correctIndex");

    const failed = await ok("POST", asha, `${S}/plan/sprints/1/quiz`, { answers: { [problems.arrays!.slug]: "1", [problems.search!.slug]: "0" } }, 200);
    expect(failed).toEqual({ score: 1, total: 3, passed: false, wrong: [problems.search!.slug, problems.graphs!.slug], revise: 2, reward: { coins: 0, reasons: [] } });
    // Due today, and back as tasks on the next study day.
    const due = (await ok("GET", asha, `${S}/revise`)).due.map((c: { slug: string }) => c.slug);
    expect(due).toEqual(expect.arrayContaining([problems.search!.slug, problems.graphs!.slug]));
    const upcoming = (await ok("GET", asha, `${S}/plan`)).plan.upcoming as { title: string; day: string; kind: string }[];
    expect(upcoming.filter((t) => t.title.startsWith("Revise:")).map((t) => [t.day, t.kind, t.title])).toEqual([
      ["2026-10-09", "revise", "Revise: Binary search needs what"],
      ["2026-10-09", "revise", "Revise: BFS uses which structure"],
    ]);

    const all = { [problems.arrays!.slug]: "1", [problems.search!.slug]: "1", [problems.graphs!.slug]: "1" };
    const passed = await ok("POST", asha, `${S}/plan/sprints/1/quiz`, { answers: all }, 200);
    expect(passed).toMatchObject({ score: 3, passed: true, revise: 0, reward: { coins: 20, reasons: ["quiz"] } });
    expect((await ok("POST", asha, `${S}/plan/sprints/1/quiz`, { answers: all }, 200)).reward.coins).toBe(0);
    expect((await ok("GET", asha, `${S}/plan/sprints/1/quiz`)).sittings.map((q: { score: number; passed: boolean }) => [q.score, q.passed])).toEqual([
      [1, false],
      [3, true],
      [3, true],
    ]);
  });

  it("gathers a sprint's revision notes from the learner's own notes", async () => {
    const asha = await signUp();
    await ok("POST", asha, `${S}/plan`, input);
    await ok("PUT", asha, `${S}/notes/lesson/what-an-array-is`, { body: "Contiguous: **O(1)** index." }, 200);
    await ok("PUT", asha, `${S}/notes/problem/${problems.search!.slug}`, { body: "Needs a sorted array." }, 200);
    const notes = await ok("GET", asha, `${S}/plan/sprints/1/notes`);
    expect(notes).toEqual({
      sprint: 1,
      items: [
        { kind: "lesson", slug: "what-an-array-is", title: "What an array is", note: "Contiguous: **O(1)** index." },
        { kind: "problem", slug: problems.arrays!.slug, title: "Arrays are stored how", note: null },
        { kind: "problem", slug: problems.search!.slug, title: "Binary search needs what", note: "Needs a sorted array." },
        { kind: "problem", slug: problems.graphs!.slug, title: "BFS uses which structure", note: null },
      ],
    });
  });

  it("takes a day off twice a month: the streak holds, and the day's tasks move on", async () => {
    // Submissions are dated by the database's clock; put each on the test's day.
    const onTheDay = async () => {
      await db.exec(`RESET ROLE`);
      await db.exec(`UPDATE practice_submissions SET created_at = '${new Date(clock).toISOString()}' WHERE created_at BETWEEN now() - interval '1 minute' AND now() + interval '1 second'`);
      await db.exec(`SET ROLE parikshaa_app`);
    };
    const asha = await signUp();
    await ok("POST", asha, `${S}/plan`, input);
    expect(await ok("GET", asha, `${S}/home`)).toMatchObject({ freezesLeft: 2, frozenToday: false });
    await ok("POST", asha, `${S}/problems/${problems.arrays!.slug}/submit`, { answer: "1" }, 200);
    await onTheDay();
    expect((await ok("GET", asha, `${S}/home`)).streak).toBe(1);

    // Tuesday off: its tasks go to Wednesday.
    clock += DAY;
    const off = await ok("POST", asha, `${S}/streak/freeze`, undefined, 200);
    expect(off).toMatchObject({ day: "2026-10-06", freezesLeft: 1 });
    expect(off.moved).toBeGreaterThan(0);
    expect((await ok("GET", asha, `${S}/plan`)).plan.today).toEqual([]);
    expect(await ok("GET", asha, `${S}/home`)).toMatchObject({ frozenToday: true, freezesLeft: 1, streak: 1 });
    // Again the same day changes nothing.
    expect((await ok("POST", asha, `${S}/streak/freeze`, undefined, 200)).freezesLeft).toBe(1);

    // Wednesday: a solve carries the streak on over the day off.
    clock += DAY;
    await ok("POST", asha, `${S}/problems/${problems.search!.slug}/submit`, { answer: "1" }, 200);
    await onTheDay();
    expect((await ok("GET", asha, `${S}/home`)).streak).toBe(2);

    clock += DAY;
    expect((await ok("POST", asha, `${S}/streak/freeze`, undefined, 200)).freezesLeft).toBe(0);
    clock += DAY;
    const third = await call("POST", asha, `${S}/streak/freeze`);
    expect(third.statusCode).toBe(409);
    expect(third.json().error).toBe("limit_reached");
  });
});

describe("a deleted account (plan row 47)", () => {
  beforeEach(() => buildTrack());

  it("takes the learner's study with it: plan, tasks, cards, lists, focus, coins", async () => {
    const asha = await signUp();
    const ravi = await signUp("ravi@example.com", "Ravi");
    for (const t of [asha, ravi]) {
      await ok("GET", t, `${S}/home`);
      await ok("POST", t, `${S}/plan`, { track: "dsa-basics", level: "beginner", deadline: "2026-10-30", dailyMinutes: 60, offDays: [] });
      await ok("PUT", t, `${S}/notes/problem/${problems.search!.slug}`, { body: "Sorted first." }, 200);
      await ok("PUT", t, `${S}/lists/Bookmarks/${problems.search!.slug}`, undefined, 200);
      await ok("POST", t, `${S}/lessons/what-an-array-is/done`, undefined, 200);
      const session = await ok("POST", t, `${S}/focus`, {});
      clock += 60_000;
      await ok("POST", t, `${S}/focus/${session.id}/stop`, undefined, 200);
      await ok("POST", t, `${S}/streak/freeze`, undefined, 200);
    }
    const me = await ok("GET", asha, `${S}/me`);
    expect((await call("DELETE", asha, `${S}/me`, { password: PASSWORD })).statusCode).toBe(200);

    await db.exec(`RESET ROLE`);
    const tables = ["prep_plans", "prep_tasks", "prep_cards", "prep_saved", "prep_focus", "prep_freezes", "prep_lessons_done", "prep_coins", "prep_notes"];
    for (const table of tables) {
      const count = async (id: string) => Number((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE learner_id = $1`, [id])).rows[0]!.n);
      expect(await count(me.id), table).toBe(0);
    }
    // Ravi's are his still.
    const ravis = (await ok("GET", owner, "/practice-admin/learners")).learners.find((l: { email: string }) => l.email === "ravi@example.com").id as string;
    for (const table of tables) {
      expect(Number((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE learner_id = $1`, [ravis])).rows[0]!.n), table).toBeGreaterThan(0);
    }
    await db.exec(`SET ROLE parikshaa_app`);
  });
});
