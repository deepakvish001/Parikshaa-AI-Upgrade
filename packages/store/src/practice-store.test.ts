import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId, questionId, type Question } from "@parikshaa/core";
import { migrate } from "./migrate.js";
import { EmailTaken, practiceLearner, practiceStaff, PracticeStore, SlugTaken, type ProblemDraft } from "./practice-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Practice sites, learners and what they do (migration 0013). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");

let db: PGlite;
let sql: SqlExecutor;
let store: PracticeStore;

const question: Question = {
  id: questionId("q"),
  kind: "mcq",
  stem: "Which sort is stable?",
  maxScore: 1,
  rubric: [],
  options: ["quicksort", "mergesort"],
  correctIndex: 1,
};

const draft = (slug: string, patch: Partial<ProblemDraft> = {}): ProblemDraft => ({
  slug,
  title: slug.replace(/-/g, " "),
  question,
  difficulty: "easy",
  tags: ["sorting"],
  editorial: "Merge sort keeps equal keys in order.",
  fromBank: null,
  position: 0,
  published: true,
  ...patch,
});

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await db.exec(`SET ROLE parikshaa_app`);
  store = new PracticeStore(sql);
});

afterEach(async () => {
  await db.close();
});

async function learner(org = A, email = "asha@example.com", name = "Asha") {
  return store.createLearner({ orgId: org, email, name, passwordHash: "hash" });
}

describe("a practice site", () => {
  it("is found by its address, and its address is the organisation's alone", async () => {
    await store.saveSite({ orgId: A, slug: "nit-practice", title: "NIT Practice", welcome: "", open: true });
    expect(await store.siteBySlug("nit-practice")).toMatchObject({ orgId: A, title: "NIT Practice", open: true });
    await expect(store.saveSite({ orgId: B, slug: "nit-practice", title: "Taken", welcome: "", open: true })).rejects.toBeInstanceOf(SlugTaken);
    // Saving again updates in place.
    await store.saveSite({ orgId: A, slug: "nit-practice", title: "NIT Practice Arena", welcome: "Hi", open: false });
    expect(await store.siteOf(A)).toMatchObject({ title: "NIT Practice Arena", open: false });
  });
});

describe("learners", () => {
  it("have one account per email per site, and may use the same email on another site", async () => {
    await learner();
    await expect(learner(A, "ASHA@example.com")).rejects.toBeInstanceOf(EmailTaken);
    await expect(learner(B)).resolves.toMatchObject({ orgId: B });
    expect(await store.learnerByEmail(A, " Asha@Example.com ")).toMatchObject({ name: "Asha", passwordHash: "hash" });
  });

  it("sign in with sessions that expire and can be ended", async () => {
    const asha = await learner();
    await store.createSession(asha.id, "h1", new Date(Date.now() + 60_000));
    expect(await store.learnerForSession("h1", new Date())).toMatchObject({ id: asha.id });
    expect(await store.learnerForSession("h1", new Date(Date.now() + 120_000))).toBeNull();
    await store.revokeSession("h1");
    expect(await store.learnerForSession("h1", new Date())).toBeNull();
  });

  it("can delete their account: name and email go, sessions end, submissions stay", async () => {
    const asha = await learner();
    const problem = await store.addProblem(A, draft("stable-sort"));
    await store.addSubmission(practiceLearner(A, asha.id), sub(problem.id, "passed"));
    await store.createSession(asha.id, "h1", new Date(Date.now() + 60_000));

    await store.eraseLearner(A, asha.id);
    expect(await store.learnerForSession("h1", new Date())).toBeNull();
    expect(await store.learnerByEmail(A, "asha@example.com")).toBeNull();
    const rows = await sql.query<{ name: string; email: string }>(`SELECT name, email FROM learners WHERE id = $1`, [asha.id]);
    expect(rows[0]!.name).toBe("Deleted account");
    expect(rows[0]!.email).not.toContain("asha");
    expect(await store.problemStats(A)).toEqual([{ problemId: problem.id, submissions: 1, accepted: 1, solvedBy: 1 }]);
    // The leaderboard leaves them out.
    expect(await store.leaderboard(A)).toEqual([]);
  });

  it("lets the app wipe the study only of an account already erased", async () => {
    const asha = await learner();
    await expect(sql.query(`SELECT prep_erase_study($1, $2)`, [A, asha.id])).rejects.toThrow(/not an erased learner/);
    await store.eraseLearner(A, asha.id);
    await sql.query(`SELECT prep_erase_study($1, $2)`, [A, asha.id]);
  });
});

const sub = (problemId: string, status: string, contestId: string | null = null) => ({
  problemId,
  contestId,
  language: null,
  answer: "1",
  status,
  passed: status === "passed" ? 1 : 0,
  total: 1,
  timeMs: null,
  memoryKb: null,
});

describe("problems", () => {
  it("are published under addresses of their own, and a learner sees only the published ones", async () => {
    const shown = await store.addProblem(A, draft("stable-sort"));
    await store.addProblem(A, draft("draft-problem", { published: false }));
    await expect(store.addProblem(A, draft("stable-sort"))).rejects.toBeInstanceOf(SlugTaken);
    expect(shown.question.id).toBe(shown.id);

    expect((await store.problems(practiceStaff(A))).map((p) => p.slug)).toEqual(["stable-sort", "draft-problem"]);
    expect((await store.problems(practiceLearner(A, null))).map((p) => p.slug)).toEqual(["stable-sort"]);
    expect(await store.problemBySlug(practiceLearner(A, null), "draft-problem")).toBeNull();
    expect(await store.problems(practiceStaff(B))).toEqual([]);
  });
});

describe("submissions", () => {
  it("are stamped with when they came in, when that is given", async () => {
    const asha = await learner();
    const p1 = await store.addProblem(A, draft("stable-sort"));
    const at = new Date("2026-10-05T10:29:59.500Z");
    expect((await store.addSubmission(practiceLearner(A, asha.id), sub(p1.id, "passed"), at)).createdAt).toBe(at.toISOString());
    const now = Date.parse((await store.addSubmission(practiceLearner(A, asha.id), sub(p1.id, "passed"))).createdAt);
    expect(Math.abs(now - Date.now())).toBeLessThan(60_000);
  });

  it("are a learner's own: their list, their progress, and nobody else's, even by raw SQL", async () => {
    const [asha, ravi] = [await learner(), await learner(A, "ravi@example.com", "Ravi")];
    const p1 = await store.addProblem(A, draft("stable-sort"));
    const p2 = await store.addProblem(A, draft("two-sum", { difficulty: "medium" }));
    await store.addSubmission(practiceLearner(A, asha.id), sub(p1.id, "wrong_answer"));
    await store.addSubmission(practiceLearner(A, asha.id), sub(p1.id, "passed"));
    await store.addSubmission(practiceLearner(A, ravi.id), sub(p2.id, "passed"));

    expect((await store.submissions(practiceLearner(A, asha.id))).map((s) => s.status)).toEqual(["passed", "wrong_answer"]);
    // Asking about Ravi as Asha still returns Asha's.
    expect((await store.submissions(practiceLearner(A, asha.id), { learnerId: ravi.id })).every((s) => s.learnerId === asha.id)).toBe(true);
    expect(await store.submissions(practiceLearner(A, null))).toEqual([]);
    expect((await store.submissions(practiceStaff(A), { learnerId: ravi.id })).map((s) => s.problemId)).toEqual([p2.id]);

    const progress = await store.progress(practiceLearner(A, asha.id));
    expect(progress.solved.map((s) => s.problemId)).toEqual([p1.id]);
    expect(progress.attempted).toEqual([p1.id]);
    expect(progress.days).toHaveLength(1);
    expect(progress.days[0]).toMatchObject({ accepted: 1, submitted: 2 });

    // Row-level security, beneath the store: a learner's transaction sees only their rows.
    const raw = await sql.transaction((tx) => tx.query<{ n: string }>(`SELECT count(*) AS n FROM practice_submissions`), {
      "parikshaa.org_id": A,
      "parikshaa.actor": "learner",
      "parikshaa.learner_id": asha.id,
    });
    expect(Number(raw[0]!.n)).toBe(2);
  });

  it("cannot be written in another learner's name", async () => {
    const [asha, ravi] = [await learner(), await learner(A, "ravi@example.com", "Ravi")];
    const p1 = await store.addProblem(A, draft("stable-sort"));
    const forged = sql.transaction(
      (tx) =>
        tx.query(`INSERT INTO practice_submissions (org_id, id, learner_id, problem_id, answer, status) VALUES ($1, 'x', $2, $3, '1', 'passed')`, [
          A,
          ravi.id,
          p1.id,
        ]),
      { "parikshaa.org_id": A, "parikshaa.actor": "learner", "parikshaa.learner_id": asha.id },
    );
    await expect(forged).rejects.toThrow(/row-level security/);
  });

  it("add up to a leaderboard and per-problem counts, by names only", async () => {
    const [asha, ravi] = [await learner(), await learner(A, "ravi@example.com", "Ravi")];
    const p1 = await store.addProblem(A, draft("stable-sort"));
    const p2 = await store.addProblem(A, draft("two-sum"));
    await store.addSubmission(practiceLearner(A, asha.id), sub(p1.id, "passed"));
    await store.addSubmission(practiceLearner(A, ravi.id), sub(p1.id, "wrong_answer"));
    await store.addSubmission(practiceLearner(A, ravi.id), sub(p1.id, "passed"));
    await store.addSubmission(practiceLearner(A, ravi.id), sub(p2.id, "passed"));

    expect((await store.leaderboard(A)).map((r) => [r.name, r.solved])).toEqual([
      ["Ravi", 2],
      ["Asha", 1],
    ]);
    const stats = Object.fromEntries((await store.problemStats(A)).map((s) => [s.problemId, s]));
    expect(stats[p1.id]).toMatchObject({ submissions: 3, accepted: 2, solvedBy: 2 });
    expect(await store.leaderboard(B)).toEqual([]);
  });
});

describe("contests", () => {
  it("are listed for learners, and gather the submissions made in them", async () => {
    const asha = await learner();
    const p1 = await store.addProblem(A, draft("stable-sort"));
    const contest = await store.saveContest(A, null, {
      slug: "weekly-1",
      title: "Weekly 1",
      description: "",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      problemIds: [p1.id],
    });
    expect((await store.contests(practiceLearner(A, null))).map((c) => c.slug)).toEqual(["weekly-1"]);
    await store.addSubmission(practiceLearner(A, asha.id), sub(p1.id, "passed", contest!.id));
    await store.addSubmission(practiceLearner(A, asha.id), sub(p1.id, "passed"));
    expect((await store.contestSubmissions(A, contest!.id)).map((s) => s.name)).toEqual(["Asha"]);
  });
});

describe("discussion", () => {
  it("shows learners what is not hidden, and lets them write only as themselves", async () => {
    const asha = await learner();
    const p1 = await store.addProblem(A, draft("stable-sort"));
    const mine = await store.addComment(practiceLearner(A, asha.id), { problemId: p1.id, authorName: "Asha", body: "Why is quicksort not stable?" });
    await store.addComment(practiceStaff(A), { problemId: p1.id, authorName: "Ravi Kumar", body: "Think about equal keys.", staffUserId: await staffUser() });
    await store.setCommentHidden(A, mine.id, true);

    expect((await store.comments(practiceLearner(A, null), p1.id)).map((c) => [c.authorName, c.fromStaff])).toEqual([["Ravi Kumar", true]]);
    expect((await store.comments(practiceStaff(A), p1.id)).map((c) => c.hidden)).toEqual([true, false]);
    await expect(store.addComment(practiceLearner(A, null), { problemId: p1.id, authorName: "Nobody", body: "hi" })).rejects.toThrow();
  });
});

async function staffUser(): Promise<string> {
  await db.exec(`RESET ROLE`);
  await sql.query(`INSERT INTO staff_users (id, org_id, email, name, role, password_hash) VALUES ('s1', $1, 'ravi@a.test', 'Ravi Kumar', 'owner', 'x')`, [A]);
  await db.exec(`SET ROLE parikshaa_app`);
  return "s1";
}
