import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { pgliteExecutor } from "@parikshaa/store";
import { scoreboard, streaks } from "./practice.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * Practice sites (ROADMAP §15), through the HTTP API: an institution publishes
 * problems from its bank at /practice/<slug>, learners sign up and solve them,
 * alone or in contests. Code runs in the real runner. Runs as `parikshaa_app`,
 * so row-level security is live.
 */

const isRoot = process.getuid?.() === 0;
let workRoot: string;
const runner: CodeRunner = {
  run: (request) => execute(request, { workRoot, slot: isRoot ? { uid: 61080, gid: 61080 } : null }),
};

const LEARNER_PASSWORD = "a long enough password";

const MCQ = { kind: "mcq", stem: "Which sort is stable?", maxScore: 1, rubric: [], options: ["quicksort", "mergesort", "heapsort"], correctIndex: 1 };
const SUM = {
  kind: "code",
  stem: "Sum of two\n\nRead two integers and print their sum.",
  maxScore: 10,
  rubric: [],
  language: "python",
  languages: ["python"],
  tests: [
    { id: "sample", input: "2 3\n", expected: "5\n", hidden: false, weight: 1 },
    { id: "big", input: "4000000000 4000000000\n", expected: "8000000000\n", hidden: true, weight: 1 },
  ],
  limits: { timeMs: 3000 },
};
const ESSAY = { kind: "short", stem: "Explain recursion.", maxScore: 5, rubric: [{ id: "c1", description: "Names the base case", weight: 1 }], expectedPoints: ["base case"] };

const PYTHON_SUM = "a, b = map(int, input().split())\nprint(a + b)\n";
const HARDCODED = "print(5)\n";

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let author: string;
let viewer: string;
let otherOwner: string;
const bank: Record<string, string> = {};

beforeEach(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "api-practice-"));
  db = await freshDatabase();
  let identity;
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, runner }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  const other = await addOrganisation(identity, "org-b", "Elsewhere");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await addStaff(identity, org, "author@nit.test", "author");
  await addStaff(identity, org, "viewer@nit.test", "viewer");
  await addStaff(identity, other, "owner@else.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  [owner, author, viewer, otherOwner] = (await Promise.all(["owner@nit.test", "author@nit.test", "viewer@nit.test", "owner@else.test"].map((e) => signIn(app, e)))) as [
    string,
    string,
    string,
    string,
  ];
  for (const [name, question, difficulty] of [
    ["mcq", MCQ, "easy"],
    ["sum", SUM, "medium"],
    ["essay", ESSAY, "hard"],
  ] as const) {
    const res = await call("POST", owner, "/bank", { question, difficulty, tags: [name === "sum" ? "math" : "sorting"] });
    expect(res.statusCode, res.payload).toBe(201);
    bank[name] = res.json().id;
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

function call(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}

async function openSite(slug = "nit-practice") {
  const res = await call("PUT", owner, "/practice-admin/site", { slug, title: "NIT Practice", welcome: "Solve **daily**.", open: true });
  expect(res.statusCode, res.payload).toBe(200);
}

async function publish(name: string, extra: object = {}) {
  const res = await call("POST", author, "/practice-admin/problems", { bankQuestionId: bank[name], ...extra });
  expect(res.statusCode, res.payload).toBe(201);
  return res.json() as { id: string; slug: string };
}

async function signUp(email = "asha@example.com", name = "Asha") {
  const res = await call("POST", null, "/practice/nit-practice/signup", { name, email, password: LEARNER_PASSWORD });
  expect(res.statusCode, res.payload).toBe(201);
  return res.json().token as string;
}

const submit = (token: string, slug: string, answer: string, extra: object = {}) =>
  call("POST", token, `/practice/nit-practice/problems/${slug}/submit`, { answer, ...extra });

describe("a practice site", () => {
  it("is found at its address only while open", async () => {
    expect((await call("GET", null, "/practice/nit-practice")).statusCode).toBe(404);
    await call("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: false });
    expect((await call("GET", null, "/practice/nit-practice")).statusCode).toBe(404);
    await openSite();
    expect((await call("GET", null, "/practice/nit-practice")).json()).toEqual({ slug: "nit-practice", title: "NIT Practice", welcome: "Solve **daily**." });
    // Another organisation cannot take the address.
    const taken = await call("PUT", otherOwner, "/practice-admin/site", { slug: "nit-practice", title: "Mine", welcome: "", open: true });
    expect(taken.statusCode).toBe(409);
  });

  it("is run by its owner: an author cannot open it, a viewer cannot publish", async () => {
    expect((await call("PUT", author, "/practice-admin/site", { slug: "nit-practice", title: "x", welcome: "", open: true })).statusCode).toBe(403);
    expect((await call("POST", viewer, "/practice-admin/problems", { bankQuestionId: bank.mcq })).statusCode).toBe(403);
    expect((await call("GET", null, "/practice-admin/problems")).statusCode).toBe(401);
  });
});

describe("publishing", () => {
  beforeEach(() => openSite());

  it("copies a bank question under an address of its own; a short answer cannot be practised", async () => {
    const mcq = await publish("mcq", { editorial: "Merge sort never swaps equal keys." });
    expect(mcq.slug).toBe("which-sort-is-stable");
    const sum = await publish("sum");
    expect(sum.slug).toBe("sum-of-two");

    const essay = await call("POST", author, "/practice-admin/problems", { bankQuestionId: bank.essay });
    expect(essay.statusCode).toBe(422);
    expect(essay.json().error).toBe("not_practicable");

    const list = (await call("GET", author, "/practice-admin/problems")).json().problems;
    expect(list.map((p: { slug: string; difficulty: string }) => [p.slug, p.difficulty])).toEqual([
      ["which-sort-is-stable", "easy"],
      ["sum-of-two", "medium"],
    ]);
    // Staff see the key; another organisation sees nothing.
    expect(list[0].question.correctIndex).toBe(1);
    expect((await call("GET", otherOwner, "/practice-admin/problems")).json().problems).toEqual([]);
  });

  it("can be edited and hidden from learners", async () => {
    const mcq = await publish("mcq");
    const patched = await call("PATCH", author, `/practice-admin/problems/${mcq.id}`, { title: "Stable sorting", slug: "stable-sort", published: false, tags: ["sorting", "basics"] });
    expect(patched.statusCode, patched.payload).toBe(200);
    expect(patched.json()).toMatchObject({ slug: "stable-sort", title: "Stable sorting", published: false });
    expect((await call("GET", null, "/practice/nit-practice/problems")).json().problems).toEqual([]);
    expect((await call("GET", null, "/practice/nit-practice/problems/stable-sort")).statusCode).toBe(404);
  });
});

describe("learner accounts", () => {
  beforeEach(() => openSite());

  it("sign up, sign in, and are told nothing about which part of a sign-in failed", async () => {
    const short = await call("POST", null, "/practice/nit-practice/signup", { name: "Asha", email: "asha@example.com", password: "short" });
    expect(short.statusCode).toBe(422);
    const token = await signUp();
    expect((await call("GET", token, "/practice/nit-practice/me")).json()).toMatchObject({ name: "Asha", email: "asha@example.com" });

    const again = await call("POST", null, "/practice/nit-practice/signup", { name: "Asha 2", email: "ASHA@example.com", password: LEARNER_PASSWORD });
    expect(again.statusCode).toBe(409);

    const wrong = await call("POST", null, "/practice/nit-practice/signin", { email: "asha@example.com", password: "not the password at all" });
    const nobody = await call("POST", null, "/practice/nit-practice/signin", { email: "nobody@example.com", password: LEARNER_PASSWORD });
    expect([wrong.statusCode, nobody.statusCode]).toEqual([401, 401]);
    expect(wrong.json()).toEqual(nobody.json());

    const signedIn = await call("POST", null, "/practice/nit-practice/signin", { email: "asha@example.com", password: LEARNER_PASSWORD });
    expect(signedIn.statusCode).toBe(200);
    const second = signedIn.json().token as string;
    expect(second.startsWith("pl_")).toBe(true);

    await call("POST", second, "/practice/nit-practice/signout");
    expect((await call("GET", second, "/practice/nit-practice/me")).statusCode).toBe(401);
    expect((await call("GET", token, "/practice/nit-practice/me")).statusCode).toBe(200);
  });

  it("are refused sign-in for a while after repeated failures, and sign-up from one address is limited", async () => {
    await signUp();
    const wrong = () => call("POST", null, "/practice/nit-practice/signin", { email: "asha@example.com", password: "not the password at all" });
    for (let i = 0; i < 10; i++) expect((await wrong()).statusCode).toBe(401);
    expect((await wrong()).statusCode).toBe(429);
    // The right password too, from that address, for now.
    expect((await call("POST", null, "/practice/nit-practice/signin", { email: "asha@example.com", password: LEARNER_PASSWORD })).statusCode).toBe(429);

    const codes: number[] = [];
    for (let i = 0; i < 21; i++) {
      codes.push((await call("POST", null, "/practice/nit-practice/signup", { name: "Bot", email: `bot${i}@example.com`, password: "short" })).statusCode);
    }
    expect(codes.slice(0, 19).every((c) => c === 422)).toBe(true);
    expect(codes.at(-1)).toBe(429);
  });

  it("belong to one site: a token from another does not work here, nor does a staff token", async () => {
    await call("PUT", otherOwner, "/practice-admin/site", { slug: "else-practice", title: "Else", welcome: "", open: true });
    const elsewhere = await call("POST", null, "/practice/else-practice/signup", { name: "Asha", email: "asha@example.com", password: LEARNER_PASSWORD });
    expect(elsewhere.statusCode).toBe(201);
    expect((await call("GET", elsewhere.json().token, "/practice/nit-practice/me")).statusCode).toBe(401);
    expect((await call("GET", owner, "/practice/nit-practice/me")).statusCode).toBe(401);
  });

  it("can delete their account: sign-in ends, and they leave the leaderboard", async () => {
    const mcq = await publish("mcq");
    const token = await signUp();
    await submit(token, mcq.slug, "1");
    expect((await call("GET", null, "/practice/nit-practice/leaderboard")).json().leaders).toHaveLength(1);

    expect((await call("DELETE", token, "/practice/nit-practice/me")).statusCode).toBe(200);
    expect((await call("GET", token, "/practice/nit-practice/me")).statusCode).toBe(401);
    expect((await call("POST", null, "/practice/nit-practice/signin", { email: "asha@example.com", password: LEARNER_PASSWORD })).statusCode).toBe(401);
    expect((await call("GET", null, "/practice/nit-practice/leaderboard")).json().leaders).toEqual([]);
    // Their submission still counts toward the problem's numbers.
    expect((await call("GET", null, "/practice/nit-practice/problems")).json().problems[0]).toMatchObject({ solvedBy: 1, acceptance: 1 });
    // The address is free again.
    await signUp();
  });
});

describe("solving", () => {
  let mcq: { slug: string };
  let sum: { slug: string };
  let token: string;

  beforeEach(async () => {
    await openSite();
    mcq = await publish("mcq", { editorial: "Merge sort never swaps equal keys." });
    sum = await publish("sum", { editorial: "Python integers do not overflow." });
    token = await signUp();
  });

  it("serves a problem without its answer key or hidden tests, to anyone", async () => {
    const list = await call("GET", null, "/practice/nit-practice/problems");
    expect(list.json().problems.map((p: { slug: string; status: null }) => [p.slug, p.status])).toEqual([
      [mcq.slug, null],
      [sum.slug, null],
    ]);
    const res = await call("GET", null, `/practice/nit-practice/problems/${sum.slug}`);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ title: "Sum of two", difficulty: "medium", editorial: null, editorialLocked: true, status: null });
    expect(res.json().question.samples).toEqual([expect.objectContaining({ input: "2 3\n", output: "5\n" })]);
    for (const leak of ["4000000000", "8000000000", "hidden", "weight", "Python integers"]) expect(res.payload).not.toContain(leak);
    expect((await call("GET", null, `/practice/nit-practice/problems/${mcq.slug}`)).payload).not.toContain("correctIndex");
  });

  it("needs a signed-in learner to run or submit", async () => {
    expect((await submit(owner, mcq.slug, "1")).statusCode).toBe(401);
    expect((await call("POST", null, `/practice/nit-practice/problems/${sum.slug}/run`, { language: "python", source: PYTHON_SUM })).statusCode).toBe(401);
  });

  it("judges a choice, opens the editorial after three wrong tries, and counts the first solve once", async () => {
    for (let i = 0; i < 2; i++) expect((await submit(token, mcq.slug, "0")).json()).toMatchObject({ status: "wrong_answer", firstSolve: false });
    expect((await call("GET", token, `/practice/nit-practice/problems/${mcq.slug}`)).json()).toMatchObject({ editorial: null, status: "attempted" });
    await submit(token, mcq.slug, "2");
    expect((await call("GET", token, `/practice/nit-practice/problems/${mcq.slug}`)).json().editorial).toBe("Merge sort never swaps equal keys.");

    expect((await submit(token, mcq.slug, "1")).json()).toMatchObject({ status: "passed", firstSolve: true });
    expect((await submit(token, mcq.slug, "1")).json()).toMatchObject({ status: "passed", firstSolve: false });
    const mine = (await call("GET", token, `/practice/nit-practice/problems/${mcq.slug}/submissions`)).json().submissions;
    expect(mine.map((s: { status: string }) => s.status)).toEqual(["passed", "passed", "wrong_answer", "wrong_answer", "wrong_answer"]);
    // Another learner sees none of them.
    const ravi = await signUp("ravi@example.com", "Ravi");
    expect((await call("GET", ravi, `/practice/nit-practice/problems/${mcq.slug}/submissions`)).json().submissions).toEqual([]);
  });

  it("runs code on the examples or the learner's own input, recording nothing", async () => {
    const onSamples = await call("POST", token, `/practice/nit-practice/problems/${sum.slug}/run`, { language: "python", source: PYTHON_SUM });
    expect(onSamples.statusCode, onSamples.payload).toBe(200);
    expect(onSamples.json()).toMatchObject({ compiled: true, results: [{ status: "passed", stdout: "5\n", expectedOutput: "5\n" }] });

    const own = await call("POST", token, `/practice/nit-practice/problems/${sum.slug}/run`, { language: "python", source: PYTHON_SUM, input: "10 20\n" });
    expect(own.json()).toMatchObject({ compiled: true, results: [{ status: "ran", stdout: "30\n", expectedOutput: null }] });

    const cpp = await call("POST", token, `/practice/nit-practice/problems/${sum.slug}/run`, { language: "cpp", source: "int main(){}" });
    expect(cpp.statusCode).toBe(409);
    expect((await call("GET", token, `/practice/nit-practice/problems/${sum.slug}/submissions`)).json().submissions).toEqual([]);
  });

  it("judges code on every test, and tells of a hidden one only its verdict", async () => {
    const wrong = await submit(token, sum.slug, HARDCODED, { language: "python" });
    expect(wrong.statusCode, wrong.payload).toBe(200);
    expect(wrong.json()).toMatchObject({
      status: "wrong_answer",
      passed: 1,
      total: 2,
      cases: [
        { number: 1, visible: true, status: "passed", input: "2 3\n" },
        { number: 2, visible: false, status: "wrong_answer", input: null, expectedOutput: null, stdout: null },
      ],
    });
    expect(wrong.payload).not.toContain("4000000000");

    const right = await submit(token, sum.slug, PYTHON_SUM, { language: "python" });
    expect(right.json()).toMatchObject({ status: "passed", passed: 2, total: 2, firstSolve: true });
    const [latest] = (await call("GET", token, `/practice/nit-practice/problems/${sum.slug}/submissions`)).json().submissions;
    expect(latest).toMatchObject({ language: "python", answer: PYTHON_SUM, status: "passed", inContest: false });
    expect((await call("GET", token, `/practice/nit-practice/problems/${sum.slug}`)).json().editorial).toBe("Python integers do not overflow.");
  });

  it("adds up to progress, a streak and a rank", async () => {
    const ravi = await signUp("ravi@example.com", "Ravi");
    await submit(token, mcq.slug, "1");
    await submit(ravi, mcq.slug, "1");
    await submit(ravi, sum.slug, PYTHON_SUM, { language: "python" });

    const progress = (await call("GET", token, "/practice/nit-practice/progress")).json();
    expect(progress).toMatchObject({
      solved: { easy: 1, medium: 0, hard: 0, total: 1 },
      available: { easy: 1, medium: 1, hard: 0, total: 2 },
      streak: 1,
      activeDays: 1,
      rank: 2,
      recent: [{ slug: mcq.slug }],
    });
    expect((await call("GET", null, "/practice/nit-practice/problems")).json().problems[0]).toMatchObject({ solvedBy: 2, acceptance: 1, status: null });
    expect((await call("GET", token, "/practice/nit-practice/problems")).json().problems.map((p: { status: string }) => p.status)).toEqual(["solved", null]);

    const board = (await call("GET", token, "/practice/nit-practice/leaderboard")).json().leaders;
    expect(board).toEqual([
      { rank: 1, name: "Ravi", solved: 2, you: false },
      { rank: 2, name: "Asha", solved: 1, you: true },
    ]);
    expect(JSON.stringify(board)).not.toContain("@example.com");
  });
});

describe("contests", () => {
  let mcq: { id: string; slug: string };
  let sum: { id: string; slug: string };

  beforeEach(async () => {
    await openSite();
    mcq = await publish("mcq", { editorial: "Merge sort." });
    sum = await publish("sum", { published: false });
  });

  const schedule = async (title: string, startsInMinutes: number, problemIds: string[]) => {
    const res = await call("POST", author, "/practice-admin/contests", {
      title,
      description: "Two problems, one hour.",
      startsAt: new Date(Date.now() + startsInMinutes * 60_000).toISOString(),
      endsAt: new Date(Date.now() + (startsInMinutes + 60) * 60_000).toISOString(),
      problemIds,
    });
    expect(res.statusCode, res.payload).toBe(201);
    return res.json() as { slug: string };
  };

  it("names no problems before the start, and takes no submissions for it", async () => {
    const weekly = await schedule("Weekly 1", 30, [mcq.id, sum.id]);
    const token = await signUp();
    const view = (await call("GET", null, `/practice/nit-practice/contests/${weekly.slug}`)).json();
    expect(view).toMatchObject({ state: "upcoming", problems: [], scoreboard: [] });
    expect(JSON.stringify(view)).not.toContain("sum-of-two");
    expect((await submit(token, mcq.slug, "1", { contest: weekly.slug })).statusCode).toBe(403);
    expect((await call("GET", null, "/practice/nit-practice/contests")).json().contests).toEqual([expect.objectContaining({ slug: "weekly-1", state: "upcoming", problems: 2 })]);
  });

  it("opens its unpublished problems while it runs, shuts editorials, and ranks by ICPC rules", async () => {
    const weekly = await schedule("Weekly 1", -10, [mcq.id, sum.id]);
    const [asha, ravi] = [await signUp(), await signUp("ravi@example.com", "Ravi")];

    // The unpublished problem is reachable only through the contest.
    expect((await call("GET", asha, `/practice/nit-practice/problems/${sum.slug}`)).statusCode).toBe(404);
    const inContest = await call("GET", asha, `/practice/nit-practice/problems/${sum.slug}?contest=${weekly.slug}`);
    expect(inContest.statusCode).toBe(200);
    expect(inContest.json().contest).toMatchObject({ slug: weekly.slug });

    // Asha: A wrong once then right; B right. Ravi: A right only.
    await submit(asha, mcq.slug, "0", { contest: weekly.slug });
    for (let i = 0; i < 3; i++) await submit(asha, mcq.slug, "2", { contest: weekly.slug });
    // Three wrong tries, but the contest is running: the editorial stays shut.
    expect((await call("GET", asha, `/practice/nit-practice/problems/${mcq.slug}?contest=${weekly.slug}`)).json()).toMatchObject({ editorial: null, editorialLocked: true });
    await submit(asha, mcq.slug, "1", { contest: weekly.slug });
    expect((await submit(asha, sum.slug, PYTHON_SUM, { language: "python", contest: weekly.slug })).json().status).toBe("passed");
    await submit(ravi, mcq.slug, "1", { contest: weekly.slug });
    // Outside the contest, it does not count on the board.
    await submit(ravi, mcq.slug, "1");

    const view = (await call("GET", asha, `/practice/nit-practice/contests/${weekly.slug}`)).json();
    expect(view.state).toBe("running");
    expect(view.problems.map((p: { label: string; slug: string; status: string }) => [p.label, p.slug, p.status])).toEqual([
      ["A", mcq.slug, "solved"],
      ["B", sum.slug, "solved"],
    ]);
    expect(view.scoreboard.map((r: { rank: number; name: string; solved: number; you: boolean }) => [r.rank, r.name, r.solved, r.you])).toEqual([
      [1, "Asha", 2, true],
      [2, "Ravi", 1, false],
    ]);
    expect(view.scoreboard[0].problems[0].wrong).toBe(4);
    // 4 wrong tries on A at 20 minutes each, plus about ten minutes to each solve.
    expect(view.scoreboard[0].penalty).toBeGreaterThanOrEqual(80 + 20);
    const mine = (await call("GET", asha, `/practice/nit-practice/problems/${mcq.slug}/submissions?contest=${weekly.slug}`)).json().submissions;
    expect(mine.every((s: { inContest: boolean }) => s.inContest)).toBe(true);
  });

  it("are checked when scheduled", async () => {
    const bad = await call("POST", author, "/practice-admin/contests", {
      title: "Backwards",
      description: "",
      startsAt: new Date(Date.now() + 60_000).toISOString(),
      endsAt: new Date(Date.now()).toISOString(),
      problemIds: [mcq.id],
    });
    expect(bad.statusCode).toBe(422);
    const foreign = await call("POST", author, "/practice-admin/contests", {
      title: "Stranger",
      description: "",
      startsAt: new Date(Date.now()).toISOString(),
      endsAt: new Date(Date.now() + 60_000).toISOString(),
      problemIds: ["not-ours"],
    });
    expect(foreign.statusCode).toBe(422);
  });
});

describe("the judge's queue", () => {
  it("runs a running contest's submissions before practice's, and says when it is full", async () => {
    // The runner holds each program until the test lets it finish.
    const started: string[] = [];
    const release = new Map<string, () => void>();
    const held: CodeRunner = {
      run: (request) =>
        new Promise((resolve) => {
          started.push(request.source.trim());
          release.set(request.source.trim(), () => resolve({ compiled: true, tests: [] }));
        }),
    };
    await app.close();
    ({ app } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, runner: held, judge: { concurrency: 1, maxWaiting: 2 } }));
    await openSite();
    const sum = await publish("sum");
    const res = await call("POST", author, "/practice-admin/contests", {
      title: "Weekly 1",
      description: "",
      startsAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      endsAt: new Date(Date.now() + 50 * 60_000).toISOString(),
      problemIds: [sum.id],
    });
    expect(res.statusCode, res.payload).toBe(201);
    const [asha, ravi, meena, kiran] = [await signUp(), await signUp("ravi@example.com", "Ravi"), await signUp("meena@example.com", "Meena"), await signUp("kiran@example.com", "Kiran")];
    const judge = async () => (await call("GET", viewer, "/practice-admin/judge")).json().judge;
    const until = async (check: (j: { running: number; waiting: { contest: number; practice: number } }) => boolean) => {
      for (let i = 0; i < 200 && !check(await judge()); i++) await new Promise((r) => setTimeout(r, 10));
    };

    const first = submit(asha, sum.slug, "print('practice-1')");
    await until((j) => j.running === 1);
    const second = submit(ravi, sum.slug, "print('practice-2')");
    await until((j) => j.waiting.practice === 1);
    const third = submit(meena, sum.slug, "print('contest-1')", { contest: "weekly-1" });
    await until((j) => j.waiting.contest === 1);
    expect(await judge()).toMatchObject({ concurrency: 1, running: 1, waiting: { contest: 1, practice: 1 } });

    // Full: turned away at once, with when to try again.
    const busy = await submit(kiran, sum.slug, "print('practice-3')");
    expect(busy.statusCode).toBe(503);
    expect(busy.headers["retry-after"]).toBe("30");
    expect(busy.json().error).toBe("judge_busy");

    release.get("print('practice-1')")!();
    await until((j) => j.waiting.contest === 0);
    release.get("print('contest-1')")!();
    await until((j) => j.waiting.practice === 0);
    release.get("print('practice-2')")!();
    for (const r of await Promise.all([first, second, third])) expect(r.statusCode, r.payload).toBe(200);
    expect(started).toEqual(["print('practice-1')", "print('contest-1')", "print('practice-2')"]);
    expect(await judge()).toMatchObject({ running: 0, served: { contest: 1, practice: 2 }, refused: 1 });
    expect((await call("GET", asha, "/practice-admin/judge")).statusCode).toBe(401);
  });
});

describe("discussion", () => {
  let mcq: { slug: string };

  beforeEach(async () => {
    await openSite();
    mcq = await publish("mcq");
  });

  it("is written by signed-in learners, answered by staff, and moderated", async () => {
    const token = await signUp();
    expect((await call("POST", null, `/practice/nit-practice/problems/${mcq.slug}/comments`, { body: "hi" })).statusCode).toBe(401);
    const mine = await call("POST", token, `/practice/nit-practice/problems/${mcq.slug}/comments`, { body: "Why is quicksort not stable?" });
    expect(mine.statusCode, mine.payload).toBe(201);
    expect((await call("POST", token, `/practice/nit-practice/problems/${mcq.slug}/comments`, { body: "   " })).statusCode).toBe(422);

    const reply = await call("POST", owner, "/practice-admin/comments", { problemSlug: mcq.slug, body: "Think about equal keys." });
    expect(reply.statusCode, reply.payload).toBe(201);

    const read = async () => (await call("GET", null, `/practice/nit-practice/problems/${mcq.slug}/comments`)).json().comments;
    expect((await read()).map((c: { authorName: string; fromStaff: boolean }) => [c.authorName, c.fromStaff])).toEqual([
      ["Asha", false],
      ["Ravi Kumar", true],
    ]);

    expect((await call("PUT", viewer, `/practice-admin/comments/${mine.json().id}`, { hidden: true })).statusCode).toBe(403);
    expect((await call("PUT", owner, `/practice-admin/comments/${mine.json().id}`, { hidden: true })).statusCode).toBe(200);
    expect((await read()).map((c: { authorName: string }) => c.authorName)).toEqual(["Ravi Kumar"]);
    const staffView = (await call("GET", owner, "/practice-admin/comments")).json().comments;
    expect(staffView.find((c: { id: string }) => c.id === mine.json().id)).toMatchObject({ hidden: true, problemSlug: mcq.slug });
    // Another organisation sees none of it.
    expect((await call("GET", otherOwner, "/practice-admin/comments")).json().comments).toEqual([]);
  });

  it("lists learners for staff with what each has done", async () => {
    const token = await signUp();
    await submit(token, mcq.slug, "1");
    expect((await call("GET", owner, "/practice-admin/learners")).json().learners).toEqual([
      expect.objectContaining({ name: "Asha", email: "asha@example.com", solved: 1, submissions: 1 }),
    ]);
    expect((await call("GET", otherOwner, "/practice-admin/learners")).json().learners).toEqual([]);
  });
});

describe("streaks and scoreboards, by themselves", () => {
  it("count a streak that ends today or yesterday, in IST days", () => {
    const days = ["2026-09-18", "2026-09-19", "2026-09-21", "2026-09-22", "2026-09-23"].map((day) => ({ day, accepted: 1 }));
    expect(streaks(days, "2026-09-23")).toEqual({ current: 3, longest: 3 });
    expect(streaks(days, "2026-09-24")).toEqual({ current: 3, longest: 3 });
    expect(streaks(days, "2026-09-25")).toEqual({ current: 0, longest: 3 });
    // A day with submissions but nothing accepted breaks it.
    expect(streaks([...days.slice(0, 2), { day: "2026-09-20", accepted: 0 }, ...days.slice(2)], "2026-09-23")).toEqual({ current: 3, longest: 3 });
  });

  it("break ties on penalty, and count wrong tries only before the first solve", () => {
    const contest = {
      id: "c",
      orgId: "org-a",
      slug: "c",
      title: "C",
      description: "",
      startsAt: "2026-09-24T10:00:00.000Z",
      endsAt: "2026-09-24T12:00:00.000Z",
      problemIds: ["p1", "p2"],
      createdAt: "2026-09-24T09:00:00.000Z",
    };
    const at = (minutes: number) => new Date(Date.parse(contest.startsAt) + minutes * 60_000).toISOString();
    const sub = (learnerId: string, problemId: string, status: string, minutes: number) => ({
      id: `${learnerId}-${problemId}-${minutes}`,
      orgId: "org-a",
      learnerId,
      name: learnerId,
      problemId,
      contestId: "c",
      language: null,
      answer: "",
      status,
      passed: 0,
      total: 1,
      timeMs: null,
      memoryKb: null,
      createdAt: at(minutes),
    });
    const board = scoreboard(contest as never, [
      sub("a", "p1", "wrong_answer", 5),
      sub("a", "p1", "passed", 10),
      sub("a", "p1", "wrong_answer", 50),
      sub("b", "p1", "passed", 25),
      sub("c", "p2", "wrong_answer", 1),
    ] as never);
    expect(board.map((r) => [r.rank, r.name, r.solved, r.penalty])).toEqual([
      [1, "b", 1, 25],
      [2, "a", 1, 30],
      [3, "c", 0, 0],
    ]);
    expect(board[1]!.problems).toEqual([
      { minutes: 10, wrong: 1 },
      { minutes: null, wrong: 0 },
    ]);
  });
});
