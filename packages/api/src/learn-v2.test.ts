import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * Learn v2 (Prep blueprint F2, F4, F5, S5), through the HTTP API: a quiz
 * inside a lesson whose wrong answers come back for revision, a revision card
 * from a note, a read-only link to a solution, and the problem list's company
 * and pattern filters. Runs as `parikshaa_app`, so row-level security is live.
 */

const DAY = 86_400_000;
const PASSWORD = "a long enough password";
const S = "/practice/nit-practice";
const dayOf = (ms: number) => new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10);

let clock = Date.parse("2026-10-05T04:00:00Z");
let db: PGlite;
let app: FastifyInstance;
let owner: string;
let viewer: string;
const problems: Record<string, { id: string; slug: string }> = {};

function call(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}
async function ok(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200) {
  const res = await call(method, token, url, payload);
  expect(res.statusCode, res.payload).toBe(status);
  return res.json();
}
const signUp = async (email = "asha@example.com", name = "Asha") => (await ok("POST", null, `${S}/signup`, { name, email, password: PASSWORD })).token as string;

async function addProblem(name: string, question: object, tags: string[] = [], editorial = "") {
  const q = await ok("POST", owner, "/bank", { question, difficulty: "easy" });
  problems[name] = await ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id, tags, editorial });
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
  await addProblem("stable", { kind: "mcq", stem: "Which sort is stable", maxScore: 1, rubric: [], options: ["quick", "merge"], correctIndex: 1 }, ["sorting"], "Merge sort keeps equal keys in order.");
  await addProblem("bits", { kind: "numeric", stem: "How many bits in a byte", maxScore: 1, rubric: [], expected: 8, tolerance: 0 }, ["bit-manipulation"], "Eight.");
  await addProblem("window", { kind: "mcq", stem: "A window slides over what", maxScore: 1, rubric: [], options: ["a tree", "an array"], correctIndex: 1 }, ["Sliding Window", "two pointers"]);
  await addProblem(
    "sum",
    {
      kind: "code",
      stem: "Sum of two\n\nPrint the sum of two integers.",
      maxScore: 1,
      rubric: [],
      language: "python",
      tests: [
        { id: "sample", input: "2 3\n", expected: "5\n", hidden: false, weight: 1 },
        { id: "secret", input: "SECRET-INPUT-4000000000\n", expected: "8000000000\n", hidden: true, weight: 1 },
      ],
    },
    ["math"],
  );
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a lesson's quiz", () => {
  it("is set by staff from questions checked at once, and asked without its answers", async () => {
    const lesson = await ok("POST", owner, "/practice-admin/lessons", { title: "Sorting", body: "Stable sorts.", estMinutes: 10, published: true });
    expect(await ok("GET", owner, `/practice-admin/lessons/${lesson.id}/quiz`)).toEqual({ problemIds: [] });
    expect((await call("PUT", viewer, `/practice-admin/lessons/${lesson.id}/quiz`, { problemIds: [problems.stable!.id] })).statusCode).toBe(403);
    // A code problem cannot be marked at once, so it is not a quiz question.
    expect((await call("PUT", owner, `/practice-admin/lessons/${lesson.id}/quiz`, { problemIds: [problems.sum!.id] })).statusCode).toBe(422);
    expect((await call("PUT", owner, `/practice-admin/lessons/${lesson.id}/quiz`, { problemIds: ["nope"] })).statusCode).toBe(404);
    expect((await call("PUT", owner, `/practice-admin/lessons/no-such/quiz`, { problemIds: [] })).statusCode).toBe(404);
    const ids = [problems.stable!.id, problems.bits!.id, problems.stable!.id];
    expect(await ok("PUT", owner, `/practice-admin/lessons/${lesson.id}/quiz`, { problemIds: ids }, 200)).toEqual({ problemIds: [problems.stable!.id, problems.bits!.id] });

    const view = await ok("GET", null, `${S}/lessons/sorting`);
    expect(view.quiz.map((q: { slug: string }) => q.slug)).toEqual([problems.stable!.slug, problems.bits!.slug]);
    expect(view.quiz[0].question.options).toEqual(["quick", "merge"]);
    const asked = JSON.stringify(view.quiz);
    expect(asked).not.toContain("correctIndex");
    expect(asked).not.toContain("expected");
    expect(asked).not.toContain("Merge sort keeps");
  });

  it("checks the answers, shows the right ones, and sends the wrong ones to revision today", async () => {
    const lesson = await ok("POST", owner, "/practice-admin/lessons", { title: "Sorting", body: "Stable sorts.", estMinutes: 10, published: true });
    await ok("PUT", owner, `/practice-admin/lessons/${lesson.id}/quiz`, { problemIds: [problems.stable!.id, problems.bits!.id] }, 200);
    const asha = await signUp();
    expect((await call("POST", null, `${S}/lessons/sorting/quiz`, { answers: {} })).statusCode).toBe(401);

    const result = await ok("POST", asha, `${S}/lessons/sorting/quiz`, { answers: { [problems.stable!.slug]: "0", [problems.bits!.slug]: "8" } }, 200);
    expect(result).toEqual({
      score: 1,
      total: 2,
      results: [
        { slug: problems.stable!.slug, right: false, answer: "merge", explanation: "Merge sort keeps equal keys in order." },
        { slug: problems.bits!.slug, right: true, answer: "8", explanation: "Eight." },
      ],
      revise: 1,
    });
    expect((await ok("GET", asha, `${S}/revise`)).due.map((c: { slug: string }) => c.slug)).toEqual([problems.stable!.slug]);

    // Got wrong again later: the card, pushed out by a good review, is due today once more.
    await ok("POST", asha, `${S}/revise/${problems.stable!.slug}`, { grade: "good" }, 200);
    expect((await ok("GET", asha, `${S}/revise`)).due).toEqual([]);
    await ok("POST", asha, `${S}/lessons/sorting/quiz`, { answers: {} }, 200);
    expect((await ok("GET", asha, `${S}/revise`)).due.map((c: { slug: string }) => c.slug).sort()).toEqual([problems.stable!.slug, problems.bits!.slug].sort());
  });

  it("is refused for a lesson without one", async () => {
    await ok("POST", owner, "/practice-admin/lessons", { title: "Empty", body: "", estMinutes: 5, published: true });
    const asha = await signUp();
    expect((await ok("GET", asha, `${S}/lessons/empty`)).quiz).toEqual([]);
    expect((await call("POST", asha, `${S}/lessons/empty/quiz`, { answers: {} })).statusCode).toBe(422);
    expect((await call("POST", asha, `${S}/lessons/nowhere/quiz`, { answers: {} })).statusCode).toBe(404);
  });
});

describe("a note on a problem", () => {
  it("brings the problem back for revision tomorrow, once", async () => {
    const asha = await signUp();
    await ok("PUT", asha, `${S}/notes/problem/${problems.window!.slug}`, { body: "Grow right, shrink left." }, 200);
    expect((await ok("GET", asha, `${S}/revise`)).due).toEqual([]);
    clock += DAY;
    expect((await ok("GET", asha, `${S}/revise`)).due.map((c: { slug: string }) => c.slug)).toEqual([problems.window!.slug]);
    await ok("PUT", asha, `${S}/notes/problem/${problems.window!.slug}`, { body: "Grow right, shrink left, keep the count." }, 200);
    expect((await ok("GET", asha, `${S}/revise`)).due).toHaveLength(1);
  });
});

describe("a shared solution", () => {
  it("is read by anyone with the link: the code, never a test", async () => {
    const asha = await signUp();
    expect((await call("POST", null, `${S}/problems/${problems.sum!.slug}/share`, { language: "python", source: "print(1)" })).statusCode).toBe(401);
    expect((await call("POST", asha, `${S}/problems/${problems.stable!.slug}/share`, { language: "python", source: "print(1)" })).statusCode).toBe(422);
    expect((await call("POST", asha, `${S}/problems/${problems.sum!.slug}/share`, { language: "python", source: "   " })).statusCode).toBe(422);
    const source = "a, b = map(int, input().split())\nprint(a + b)\n";
    const shared = await ok("POST", asha, `${S}/problems/${problems.sum!.slug}/share`, { language: "python", source });
    expect(shared.path).toBe(`/shares/${shared.id}`);
    expect(shared.id).toMatch(/^[A-Za-z0-9_-]{10,24}$/);

    const read = await ok("GET", null, `${S}/shares/${shared.id}`);
    expect(read).toMatchObject({ problem: { slug: problems.sum!.slug, title: "Sum of two" }, author: "Asha", language: "python", source });
    expect(JSON.stringify(read)).not.toContain("SECRET-INPUT");
    expect((await call("GET", null, `${S}/shares/nope`)).statusCode).toBe(404);
    expect((await call("GET", null, `${S}/shares/AAAAAAAAAAAA`)).statusCode).toBe(404);
  });

  it("is refused while a contest that includes the problem runs", async () => {
    const asha = await signUp();
    await ok("POST", owner, "/practice-admin/contests", {
      title: "Weekly 1",
      description: "",
      startsAt: new Date(clock - 60_000).toISOString(),
      endsAt: new Date(clock + 3_600_000).toISOString(),
      problemIds: [problems.sum!.id],
    });
    expect((await call("POST", asha, `${S}/problems/${problems.sum!.slug}/share`, { language: "python", source: "print(1)" })).statusCode).toBe(422);
    clock += 2 * 3_600_000;
    await ok("POST", asha, `${S}/problems/${problems.sum!.slug}/share`, { language: "python", source: "print(1)" });
  });

  it("is twenty a day at most", async () => {
    const asha = await signUp();
    for (let i = 0; i < 20; i++) await ok("POST", asha, `${S}/problems/${problems.sum!.slug}/share`, { language: "python", source: `print(${i})` });
    expect((await call("POST", asha, `${S}/problems/${problems.sum!.slug}/share`, { language: "python", source: "print(20)" })).statusCode).toBe(429);
    clock += DAY + 1;
    await ok("POST", asha, `${S}/problems/${problems.sum!.slug}/share`, { language: "python", source: "print(21)" });
  });
});

describe("the problem list's filters", () => {
  it("names each problem's patterns and, as far as the learner may see, its companies", async () => {
    const list = async (token: string | null) => new Map(((await ok("GET", token, `${S}/problems`)).problems as { slug: string; patterns: string[]; companies: { slug: string }[] }[]).map((p) => [p.slug, p]));
    let seen = await list(null);
    expect(seen.get(problems.window!.slug)!.patterns).toEqual(["Two pointers", "Sliding window"]);
    expect(seen.get(problems.bits!.slug)!.patterns).toEqual(["Bit manipulation"]);
    expect(seen.get(problems.stable!.slug)!.companies).toEqual([]);

    // Acme asked seven problems; the window problem least often.
    const extra: string[] = [];
    for (let i = 0; i < 4; i++) {
      const q = await ok("POST", owner, "/bank", { question: { kind: "mcq", stem: `Acme question ${i + 1} asks what`, maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }, difficulty: "easy" });
      extra.push((await ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id })).id);
    }
    const acme = await ok("POST", owner, "/practice-admin/companies", { name: "Acme Corp" });
    const often = [problems.stable!.id, problems.bits!.id, problems.sum!.id, ...extra];
    await ok("POST", owner, `/practice-admin/companies/${acme.id}/reports`, { problemIds: often, reportedOn: dayOf(clock - 2 * DAY) });
    await ok("POST", owner, `/practice-admin/companies/${acme.id}/reports`, { problemIds: often.slice(0, 5), reportedOn: dayOf(clock - DAY) });
    await ok("POST", owner, `/practice-admin/companies/${acme.id}/reports`, { problemIds: [problems.window!.id], reportedOn: dayOf(clock - 3 * DAY) });
    // Long ago is not asked lately.
    const beta = await ok("POST", owner, "/practice-admin/companies", { name: "Beta" });
    await ok("POST", owner, `/practice-admin/companies/${beta.id}/reports`, { problemIds: [problems.stable!.id], reportedOn: dayOf(clock - 200 * DAY) });

    seen = await list(null);
    expect(seen.get(problems.stable!.slug)!.companies).toEqual([{ slug: "acme-corp", name: "Acme Corp" }]);
    expect(seen.get(problems.window!.slug)!.companies).toHaveLength(1);

    // With Plus on sale, a learner without it sees a company's five most asked, as on the company page.
    await ok("PUT", owner, "/practice-admin/plus", { plusEnabled: true }, 200);
    const asha = await signUp();
    seen = await list(asha);
    const tagged = [...seen.values()].filter((p) => p.companies.length > 0);
    expect(tagged).toHaveLength(5);
    expect(seen.get(problems.window!.slug)!.companies).toEqual([]);
    const learners = (await ok("GET", owner, "/practice-admin/learners")).learners as { id: string }[];
    await ok("POST", owner, `/practice-admin/learners/${learners[0]!.id}/plus`, { days: 30 }, 200);
    seen = await list(asha);
    expect([...seen.values()].filter((p) => p.companies.length > 0)).toHaveLength(8);
  });
});
