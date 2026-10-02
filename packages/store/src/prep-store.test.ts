import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId, questionId, type OrgId, type Question } from "@parikshaa/core";
import { migrate } from "./migrate.js";
import { practiceLearner, practiceStaff, PracticeStore } from "./practice-store.js";
import { PrepSlugTaken, PrepStore } from "./prep-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Prep: tracks, lessons, plans, revision, notes, lists, coins (migration 0019). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");

let db: PGlite;
let sql: SqlExecutor;
let practice: PracticeStore;
let store: PrepStore;

const question: Question = { id: questionId("q"), kind: "mcq", stem: "Which sort is stable?", maxScore: 1, rubric: [], options: ["quick", "merge"], correctIndex: 1 };

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await db.exec(`SET ROLE parikshaa_app`);
  practice = new PracticeStore(sql);
  store = new PrepStore(sql);
});

afterEach(async () => {
  await db.close();
});

async function problem(org: OrgId = A, slug = "stable-sort") {
  return practice.addProblem(org, { slug, title: slug, question, difficulty: "easy", tags: [], editorial: "", fromBank: null, position: 0, published: true });
}
async function learner(org: OrgId = A, email = "asha@example.com") {
  return practice.createLearner({ orgId: org, email, name: email.split("@")[0]!, passwordHash: "h" });
}
const lessonDraft = (slug: string, published = true) => ({ slug, title: slug, body: "# Hi", videoUrl: "", estMinutes: 12, published });

describe("content", () => {
  it("saves a track whole, and saving again replaces its modules and items", async () => {
    const p = await problem();
    const lesson = (await store.saveLesson(A, null, lessonDraft("intro")))!;
    const id = (await store.saveTrack(A, null, {
      slug: "dsa",
      title: "DSA",
      description: "",
      position: 0,
      published: true,
      modules: [{ title: "Basics", items: [{ lessonId: lesson.id }, { problemId: p.id }] }, { title: "Empty", items: [] }],
    }))!;
    let [track] = await store.tracks(practiceStaff(A));
    expect(track!.modules.map((m) => [m.title, m.items.length])).toEqual([
      ["Basics", 2],
      ["Empty", 0],
    ]);
    expect(track!.modules[0]!.items.map((i) => i.lessonId ?? i.problemId)).toEqual([lesson.id, p.id]);

    await store.saveTrack(A, id, { slug: "dsa", title: "DSA", description: "d", position: 0, published: true, modules: [{ title: "Only", items: [{ problemId: p.id }] }] });
    [track] = await store.tracks(practiceStaff(A));
    expect(track!.modules.map((m) => m.title)).toEqual(["Only"]);
    expect(await store.saveTrack(A, "nope", { slug: "x-y", title: "x", description: "", position: 0, published: true, modules: [] })).toBeNull();
    await expect(store.saveTrack(A, null, { slug: "dsa", title: "Again", description: "", position: 1, published: true, modules: [] })).rejects.toBeInstanceOf(PrepSlugTaken);
  });

  it("shows learners only what is published, and nothing of another organisation", async () => {
    await store.saveLesson(A, null, lessonDraft("open"));
    await store.saveLesson(A, null, lessonDraft("draft", false));
    await store.saveTrack(A, null, { slug: "hidden", title: "Hidden", description: "", position: 0, published: false, modules: [] });
    await store.saveLesson(B, null, lessonDraft("theirs"));
    const visitor = practiceLearner(A, null);
    expect((await store.lessons(visitor)).map((l) => l.slug)).toEqual(["open"]);
    expect(await store.tracks(visitor)).toEqual([]);
    expect(await store.lessonBySlug(visitor, "theirs")).toBeNull();
    expect((await store.lessons(practiceStaff(A))).map((l) => l.slug).sort()).toEqual(["draft", "open"]);
  });

  it("keeps one problem of the day per day", async () => {
    const p = await problem();
    const q = await problem(A, "other");
    await store.setPotd(A, "2026-10-01", p.id);
    await store.setPotd(A, "2026-10-01", q.id);
    await store.setPotd(A, "2026-10-02", p.id);
    await store.setPotd(A, "2026-10-02", null);
    expect(await store.potd(practiceLearner(A, null), "2026-09-01", "2026-10-31")).toEqual([{ day: "2026-10-01", problemId: q.id }]);
  });
});

describe("a learner's own rows", () => {
  it("are theirs alone: another learner reads none of them", async () => {
    const p = await problem();
    const asha = await learner();
    const ravi = await learner(A, "ravi@example.com");
    const mine = practiceLearner(A, asha.id);
    const theirs = practiceLearner(A, ravi.id);
    await store.save(mine, "Bookmarks", p.id);
    await store.saveNote(mine, { refKind: "problem", refId: p.id, title: "Stable", body: "merge" });
    await store.addCard(mine, p.id, "2026-10-02");
    const planTrack = (await store.saveTrack(A, null, { slug: "track", title: "T", description: "", position: 0, published: true, modules: [] }))!;
    await store.startPlan(mine, { trackId: planTrack, level: "beginner", deadline: "2027-01-01", dailyMinutes: 60, weekendMinutes: null, offDays: [0], goal: "" }, []);

    expect(await store.saved(theirs)).toEqual([]);
    expect(await store.notes(theirs)).toEqual([]);
    expect(await store.cards(theirs)).toEqual([]);
    expect(await store.activePlan(theirs)).toBeNull();
    // Row-level security, not only the query: reading the table directly in Ravi's scope finds nothing of Asha's.
    const direct = await sql.transaction((tx) => tx.query(`SELECT * FROM prep_notes`), {
      "parikshaa.org_id": A,
      "parikshaa.actor": "learner",
      "parikshaa.attempt_id": "",
      "parikshaa.learner_id": ravi.id,
    });
    expect(direct).toEqual([]);

    expect((await store.saved(mine)).map((s) => s.list)).toEqual(["Bookmarks"]);
    expect((await store.notes(mine))[0]).toMatchObject({ title: "Stable", body: "merge" });
    expect((await store.cards(mine))[0]).toMatchObject({ problemId: p.id, dueOn: "2026-10-02", intervalDays: 1, ease: 2.5 });
  });

  it("marks a lesson done once", async () => {
    const lesson = (await store.saveLesson(A, null, lessonDraft("intro")))!;
    const scope = practiceLearner(A, (await learner()).id);
    expect(await store.markLessonDone(scope, lesson.id)).toBe(true);
    expect(await store.markLessonDone(scope, lesson.id)).toBe(false);
    expect((await store.lessonsDone(scope)).map((d) => d.lessonId)).toEqual([lesson.id]);
  });
});

describe("coins", () => {
  it("pay a reward's key once, and a learner cannot pay themselves", async () => {
    const asha = await learner();
    expect(await store.award(A, asha.id, { rule: "solve", amount: 10, key: "solve:p1" })).toBe(true);
    expect(await store.award(A, asha.id, { rule: "solve", amount: 10, key: "solve:p1" })).toBe(false);
    await store.award(A, asha.id, { rule: "checkin", amount: 1, key: "checkin:2026-10-01" });
    const scope = practiceLearner(A, asha.id);
    expect((await store.coins(scope)).balance).toBe(11);
    expect(await store.earnedSince(A, asha.id, new Date(0), ["checkin"])).toBe(10);
    await expect(
      sql.transaction((tx) => tx.query(`INSERT INTO prep_coins (org_id, id, learner_id, rule, amount, key) VALUES ($1, 'x', $2, 'solve', 999, 'free')`, [A, asha.id]), {
        "parikshaa.org_id": A,
        "parikshaa.actor": "learner",
        "parikshaa.attempt_id": "",
        "parikshaa.learner_id": asha.id,
      }),
    ).rejects.toThrow();
    expect((await store.coinLeaders(A))[0]).toMatchObject({ name: "asha", coins: 11 });
  });
});

describe("the plan", () => {
  it("starts with tasks, archives the one before, moves open tasks and completes an item's", async () => {
    const p = await problem();
    const track = (await store.saveTrack(A, null, { slug: "track", title: "T", description: "", position: 0, published: true, modules: [] }))!;
    const scope = practiceLearner(A, (await learner()).id);
    const draft = { trackId: track, level: "beginner" as const, deadline: "2027-01-01", dailyMinutes: 60, weekendMinutes: null, offDays: [], goal: "SDE-1" };
    const first = await store.startPlan(scope, draft, [{ day: "2026-10-01", sprint: 1, position: 0, kind: "learn", itemId: null, title: "Old", estMinutes: 10 }]);
    const planId = await store.startPlan(scope, draft, [
      { day: "2026-10-01", sprint: 1, position: 0, kind: "practice", itemId: p.id, title: "Stable sort", estMinutes: 20 },
      { day: "2026-10-01", sprint: 1, position: 1, kind: "custom", itemId: null, title: "Resume", estMinutes: 20 },
    ]);
    expect(planId).not.toBe(first);
    expect((await store.activePlan(scope))!.id).toBe(planId);
    expect(await store.tasks(scope, first)).toHaveLength(1);

    const [task, custom] = await store.tasks(scope, planId);
    await store.moveTasks(scope, [{ id: custom!.id, day: "2026-10-03", position: 0, sprint: 1 }]);
    await store.moveTasks(scope, [{ id: custom!.id, day: "2026-10-04", position: 0, sprint: 1 }]);
    expect(await store.completeItem(scope, p.id, new Date("2026-10-02T10:00:00Z"))).toBe(1);
    const after = await store.tasks(scope, planId);
    expect(after.find((t) => t.id === task!.id)!.doneAt).toBe("2026-10-02T10:00:00.000Z");
    expect(after.find((t) => t.id === custom!.id)).toMatchObject({ day: "2026-10-04", rescheduledFrom: "2026-10-01" });
    expect(await store.setTaskDone(scope, custom!.id, new Date())).toBe(true);
    expect(await store.setTaskDone(scope, "nope", new Date())).toBe(false);
  });

  it("changes a running plan: new settings, open tasks laid out again, done and own tasks kept", async () => {
    const track = (await store.saveTrack(A, null, { slug: "track", title: "T", description: "", position: 0, published: true, modules: [] }))!;
    const scope = practiceLearner(A, (await learner()).id);
    const draft = { trackId: track, level: "beginner" as const, deadline: "2027-01-01", dailyMinutes: 60, weekendMinutes: null, offDays: [], goal: "" };
    const planId = await store.startPlan(scope, draft, [
      { day: "2026-10-01", sprint: 1, position: 0, kind: "learn", itemId: null, title: "Done one", estMinutes: 10 },
      { day: "2026-10-02", sprint: 1, position: 0, kind: "learn", itemId: null, title: "Open one", estMinutes: 10 },
      { day: "2026-10-02", sprint: 1, position: 1, kind: "custom", itemId: null, title: "Mine", estMinutes: 10 },
      { day: "2026-10-02", sprint: 1, position: 2, kind: "revise", itemId: "quiz-question", title: "Revise: a quiz question", estMinutes: 10 },
    ]);
    const before = await store.tasks(scope, planId);
    await store.setTaskDone(scope, before[0]!.id, new Date("2026-10-01T10:00:00Z"));
    await store.replan(scope, planId, { deadline: "2027-03-01", dailyMinutes: 90, weekendMinutes: 180, offDays: [0] }, [
      { day: "2026-10-03", sprint: 2, position: 0, kind: "learn", itemId: null, title: "Laid out again", estMinutes: 10 },
    ]);
    expect(await store.activePlan(scope)).toMatchObject({ deadline: "2027-03-01", dailyMinutes: 90, weekendMinutes: 180, offDays: [0] });
    expect((await store.tasks(scope, planId)).map((t) => t.title).sort()).toEqual(["Done one", "Laid out again", "Mine", "Revise: a quiz question"]);

    // Told it runs late once a week at most.
    expect(await store.noteLate(scope, planId, "2026-10-05")).toBe(true);
    expect(await store.noteLate(scope, planId, "2026-10-08")).toBe(false);
    expect(await store.noteLate(scope, planId, "2026-10-12")).toBe(true);
    // Changing the plan starts the count again.
    await store.replan(scope, planId, { deadline: "2027-03-01", dailyMinutes: 90, weekendMinutes: null, offDays: [] }, []);
    expect(await store.noteLate(scope, planId, "2026-10-13")).toBe(true);
  });

  it("times focus, one session at a time", async () => {
    const scope = practiceLearner(A, (await learner()).id);
    const first = await store.startFocus(scope, null, new Date("2026-10-01T04:00:00Z"));
    const second = await store.startFocus(scope, null, new Date("2026-10-01T04:10:00Z"));
    expect(await store.stopFocus(scope, first, new Date("2026-10-01T05:00:00Z"))).toBeNull();
    expect(await store.stopFocus(scope, second, new Date("2026-10-01T04:30:00Z"))).toBe(1200);
    expect(await store.focusByDay(scope, "2026-09-01")).toEqual([{ day: "2026-10-01", seconds: 1800 }]);
  });
});
