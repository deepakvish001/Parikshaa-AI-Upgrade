import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { rateContest, titleOf } from "./prep-community.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * Companies, interview experiences, the coin store and contest ratings
 * (ROADMAP §16), through the HTTP API, as `parikshaa_app`. The clock starts at
 * the real now, since accounts are stamped by the database: the store's
 * fourteen days are counted from there.
 */

const DAY = 86_400_000;
let clock = Date.now();
const PASSWORD = "a long enough password";
const S = "/practice/nit-practice";
const mcq = (stem: string) => ({ kind: "mcq", stem, maxScore: 1, rubric: [], options: ["one", "two", "three"], correctIndex: 1 });
const dayOf = (ms: number) => new Date(ms + 5.5 * 3_600_000).toISOString().slice(0, 10);

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let viewer: string;
const problems: { id: string; slug: string }[] = [];

function call(method: "GET" | "POST" | "PUT" | "DELETE", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}
async function ok(method: "GET" | "POST" | "PUT" | "DELETE", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200) {
  const res = await call(method, token, url, payload);
  expect(res.statusCode, res.payload).toBe(status);
  return res.statusCode === 204 ? null : res.json();
}
const signUp = async (email: string, name: string) => (await ok("POST", null, `${S}/signup`, { name, email, password: PASSWORD })).token as string;

beforeEach(async () => {
  clock = Date.now();
  problems.length = 0;
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
  for (let i = 0; i < 7; i++) {
    const q = await ok("POST", owner, "/bank", { question: mcq(`Question number ${i + 1} asks what`), difficulty: i % 2 === 0 ? "easy" : "medium" });
    problems.push(await ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id }));
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("companies", () => {
  it("counts what a company asked by window, and keeps all but the five most asked for Plus", async () => {
    expect((await call("POST", viewer, "/practice-admin/companies", { name: "Acme" })).statusCode).toBe(403);
    const acme = await ok("POST", owner, "/practice-admin/companies", { name: "Acme Corp", about: "Product company." });
    expect(acme.slug).toBe("acme-corp");
    const report = (ids: string[], daysAgo: number) => ok("POST", owner, `/practice-admin/companies/${acme.id}/reports`, { problemIds: ids, reportedOn: dayOf(clock - daysAgo * DAY) });
    await report([problems[0]!.id, problems[1]!.id], 5);
    await report([problems[0]!.id], 20);
    await report([problems[2]!.id], 45);
    await report([problems[3]!.id, problems[4]!.id, problems[5]!.id], 100);
    await report([problems[6]!.id], 400);
    expect((await call("POST", owner, `/practice-admin/companies/${acme.id}/reports`, { problemIds: ["nope"], reportedOn: dayOf(clock) })).statusCode).toBe(422);

    expect((await ok("GET", null, `${S}/companies`)).companies).toEqual([{ slug: "acme-corp", name: "Acme Corp", problems: 6, experiences: 0 }]);
    const month = await ok("GET", null, `${S}/companies/acme-corp?window=30`);
    expect(month.counts).toEqual({ "30": 2, "60": 3, "180": 6, all: 7 });
    expect(month.problems.map((p: { slug: string; times: number }) => [p.slug, p.times])).toEqual([
      [problems[0]!.slug, 2],
      [problems[1]!.slug, 1],
    ]);
    expect(month.difficulty).toEqual({ easy: 1, medium: 1, hard: 0 });
    const all = await ok("GET", null, `${S}/companies/acme-corp?window=all`);
    expect(all.problems).toHaveLength(7);
    expect(all.locked).toBe(0);

    // With Plus on sale, a learner without it sees the five most asked.
    await ok("PUT", owner, "/practice-admin/plus", { plusEnabled: true });
    const asha = await signUp("asha@example.com", "Asha");
    const locked = await ok("GET", asha, `${S}/companies/acme-corp?window=all`);
    expect(locked.problems).toHaveLength(5);
    expect(locked.locked).toBe(2);
    expect(locked.problems[0].slug).toBe(problems[0]!.slug);
    const learners = (await ok("GET", owner, "/practice-admin/learners")).learners as { id: string }[];
    await ok("POST", owner, `/practice-admin/learners/${learners[0]!.id}/plus`, { days: 30 }, 200);
    expect((await ok("GET", asha, `${S}/companies/acme-corp?window=all`)).locked).toBe(0);
    expect((await call("GET", null, `${S}/companies/nobody`)).statusCode).toBe(404);
  });
});

describe("interview experiences", () => {
  it("wait for staff, pay their author once published, count on the company's page, and take votes from others", async () => {
    const acme = await ok("POST", owner, "/practice-admin/companies", { name: "Acme" });
    const asha = await signUp("asha@example.com", "Asha");
    const ravi = await signUp("ravi@example.com", "Ravi");
    const month = dayOf(clock).slice(0, 7);
    const draft = {
      company: "acme",
      role: "SDE 1",
      interviewed: month,
      verdict: "offer",
      rounds: [{ kind: "DSA", asked: "Arrays, then a follow-up.", problemSlugs: [problems[3]!.slug] }],
      tips: "Talk through the brute force first.",
    };
    expect((await call("POST", asha, `${S}/experiences`, { ...draft, rounds: [{ kind: "DSA", asked: "", problemSlugs: ["not-here"] }] })).statusCode).toBe(422);
    expect((await call("POST", asha, `${S}/experiences`, { ...draft, interviewed: "2999-01" })).statusCode).toBe(422);
    expect((await call("POST", null, `${S}/experiences`, draft)).statusCode).toBe(401);
    const mine = await ok("POST", asha, `${S}/experiences`, { ...draft, anonymous: true });
    expect(mine).toMatchObject({ status: "pending", author: "Anonymous", mine: true });
    expect((await ok("GET", ravi, `${S}/experiences`)).experiences).toEqual([]);
    expect((await ok("GET", asha, `${S}/experiences`)).experiences).toHaveLength(1);

    const pending = (await ok("GET", owner, "/practice-admin/experiences?status=pending")).experiences;
    expect(pending.map((e: { id: string }) => e.id)).toEqual([mine.id]);
    expect((await call("POST", viewer, `/practice-admin/experiences/${mine.id}/decision`, { status: "published" })).statusCode).toBe(403);
    await ok("POST", owner, `/practice-admin/experiences/${mine.id}/decision`, { status: "published" }, 200);
    expect((await call("POST", owner, `/practice-admin/experiences/${mine.id}/decision`, { status: "published" })).statusCode).toBe(404);

    const coins = await ok("GET", asha, `${S}/coins`);
    expect(coins.history.filter((h: { rule: string }) => h.rule === "experience")).toEqual([expect.objectContaining({ amount: 100 })]);
    const page = await ok("GET", null, `${S}/companies/acme?window=all`);
    expect(page.problems.map((p: { slug: string }) => p.slug)).toEqual([problems[3]!.slug]);
    expect(page.experiences).toHaveLength(1);
    expect((await ok("GET", owner, "/practice-admin/companies")).companies[0].reports).toMatchObject([{ source: "experience", experienceId: mine.id }]);

    expect((await call("PUT", asha, `${S}/experiences/${mine.id}/vote`)).statusCode).toBe(422);
    await ok("PUT", ravi, `${S}/experiences/${mine.id}/vote`, undefined, 204);
    expect((await ok("GET", ravi, `${S}/experiences?company=acme`)).experiences[0]).toMatchObject({ votes: 1, voted: true, mine: false });
    expect((await ok("GET", null, `${S}/experiences`)).experiences[0]).toMatchObject({ votes: 1, voted: false });
    await ok("DELETE", ravi, `${S}/experiences/${mine.id}/vote`, undefined, 204);
    expect((await ok("GET", null, `${S}/experiences`)).experiences[0].votes).toBe(0);
    expect(acme.id).toBeTruthy();
  });

  it("waits on staff for at most five from one learner at a time", async () => {
    await ok("POST", owner, "/practice-admin/companies", { name: "Acme" });
    const asha = await signUp("asha@example.com", "Asha");
    const draft = { company: "acme", role: "SDE", interviewed: dayOf(clock).slice(0, 7), verdict: "waiting", rounds: [{ kind: "HR", asked: "Why us?" }] };
    for (let i = 0; i < 5; i++) await ok("POST", asha, `${S}/experiences`, draft);
    expect((await call("POST", asha, `${S}/experiences`, draft)).statusCode).toBe(429);
  });
});

describe("the coin store", () => {
  async function earn(token: string) {
    // A published experience pays 100.
    await call("POST", owner, "/practice-admin/companies", { name: "Acme" }); // 409 the second time: it is there
    const e = await ok("POST", token, `${S}/experiences`, { company: "acme", role: "SDE", interviewed: dayOf(clock).slice(0, 7), verdict: "waiting", rounds: [{ kind: "HR", asked: "Why us?" }] });
    await ok("POST", owner, `/practice-admin/experiences/${e.id}/decision`, { status: "published" }, 200);
  }

  it("opens to accounts fourteen days old, sells Plus at once, and gives coins back for a cancelled order", async () => {
    expect((await call("POST", viewer, "/practice-admin/store/items", { title: "Plus", kind: "plus", plusDays: 7, priceCoins: 60 })).statusCode).toBe(403);
    expect((await call("POST", owner, "/practice-admin/store/items", { title: "Plus", kind: "plus", plusDays: 0, priceCoins: 60 })).statusCode).toBe(422);
    const plus = await ok("POST", owner, "/practice-admin/store/items", { title: "Plus, a week", kind: "plus", plusDays: 7, priceCoins: 60, perLearner: 3 });
    const tee = await ok("POST", owner, "/practice-admin/store/items", { title: "T-shirt", kind: "physical", priceCoins: 30, stock: 1 });
    await ok("PUT", owner, "/practice-admin/plus", { plusEnabled: true });
    const asha = await signUp("asha@example.com", "Asha");
    await earn(asha);

    const shop = await ok("GET", asha, `${S}/store`);
    expect(shop.balance).toBe(100);
    expect(shop.opensAt).not.toBeNull();
    expect((await call("POST", asha, `${S}/store/${plus.id}/redeem`, {})).statusCode).toBe(403);

    clock += 15 * DAY;
    expect((await ok("GET", asha, `${S}/store`)).opensAt).toBeNull();
    const bought = await ok("POST", asha, `${S}/store/${plus.id}/redeem`, {});
    expect(bought).toMatchObject({ order: { status: "fulfilled", priceCoins: 60 }, balance: 40 });
    expect((await ok("GET", asha, `${S}/plus`)).active).toBe(true);

    expect((await call("POST", asha, `${S}/store/${tee.id}/redeem`, { address: "Pune" })).statusCode).toBe(422);
    const shirt = await ok("POST", asha, `${S}/store/${tee.id}/redeem`, { address: "12 MG Road, Pune 411001" });
    expect(shirt.order.status).toBe("placed");
    expect((await call("POST", asha, `${S}/store/${plus.id}/redeem`, {})).statusCode).toBe(402);

    const orders = (await ok("GET", owner, "/practice-admin/store/orders")).orders;
    expect(orders.find((o: { id: string }) => o.id === shirt.order.id)).toMatchObject({ learnerName: "Asha", address: "12 MG Road, Pune 411001" });
    await ok("POST", owner, `/practice-admin/store/orders/${shirt.order.id}/close`, { status: "cancelled", note: "Size ran out" }, 200);
    expect((await call("POST", owner, `/practice-admin/store/orders/${shirt.order.id}/close`, { status: "fulfilled" })).statusCode).toBe(404);
    const after = await ok("GET", asha, `${S}/store`);
    expect(after.balance).toBe(40);
    expect(after.items.find((i: { id: string }) => i.id === tee.id)).toMatchObject({ soldOut: false, left: 1, bought: 0 });
    expect(after.orders.map((o: { status: string }) => o.status).sort()).toEqual(["cancelled", "fulfilled"]);
  });

  it("sells what is in stock, and no more than each learner may have", async () => {
    const one = await ok("POST", owner, "/practice-admin/store/items", { title: "Sticker", kind: "digital", priceCoins: 10, stock: 1 });
    const asha = await signUp("asha@example.com", "Asha");
    const ravi = await signUp("ravi@example.com", "Ravi");
    await earn(asha);
    await earn(ravi);
    clock += 15 * DAY;
    await ok("POST", asha, `${S}/store/${one.id}/redeem`, {});
    expect((await call("POST", asha, `${S}/store/${one.id}/redeem`, {})).statusCode).toBe(409);
    const gone = await call("POST", ravi, `${S}/store/${one.id}/redeem`, {});
    expect(gone.statusCode).toBe(409);
    expect(gone.json().error).toBe("sold_out");
  });
});

describe("ratings", () => {
  it("rate a contest once it has ended, give titles and achievements, and do not rate it twice", async () => {
    // Submissions are stamped by the database, at the real now: the contest runs around it.
    const start = clock - 5 * 60_000;
    const contest = await ok("POST", owner, "/practice-admin/contests", {
      title: "Weekly 1",
      description: "",
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(start + 90 * 60_000).toISOString(),
      problemIds: [problems[0]!.id, problems[1]!.id],
    });
    const asha = await signUp("asha@example.com", "Asha");
    const ravi = await signUp("ravi@example.com", "Ravi");
    const meena = await signUp("meena@example.com", "Meena");
    for (const p of [problems[0]!, problems[1]!]) await ok("POST", asha, `${S}/problems/${p.slug}/submit`, { answer: "1", contest: contest.slug }, 200);
    await ok("POST", ravi, `${S}/problems/${problems[0]!.slug}/submit`, { answer: "1", contest: contest.slug }, 200);
    await ok("POST", meena, `${S}/problems/${problems[0]!.slug}/submit`, { answer: "0", contest: contest.slug }, 200);

    // Not rated while it runs.
    expect((await ok("GET", asha, `${S}/rating`)).board).toEqual([]);
    clock = start + 2 * 3_600_000;
    const rated = await ok("GET", asha, `${S}/rating`);
    expect(rated.board.map((r: { name: string }) => r.name)).toEqual(["Asha", "Ravi", "Meena"]);
    expect(rated.board[0].rating).toBeGreaterThan(1500);
    expect(rated.board[2].rating).toBeLessThan(1500);
    expect(rated.me).toMatchObject({ contests: 1, history: [{ contest: "Weekly 1", rank: 1, field: 3, before: 1500 }] });
    const earned = rated.me.achievements.filter((a: { earned: boolean }) => a.earned).map((a: { id: string }) => a.id);
    expect(earned).toEqual(expect.arrayContaining(["first_solve", "first_contest", "podium"]));
    expect(earned).not.toContain("solved_10");

    const again = await ok("GET", null, `${S}/rating`);
    expect(again.board).toEqual(rated.board.map((r: object) => ({ ...r, you: false })));
    expect(again.me).toBeNull();
  });

  it("moves ratings by rank against expectation, summing to about nothing", () => {
    const even = rateContest([
      { learnerId: "a", rank: 1, before: 1500 },
      { learnerId: "b", rank: 2, before: 1500 },
    ]);
    expect(even.map((r) => r.after)).toEqual([1532, 1468]);
    const upset = rateContest([
      { learnerId: "low", rank: 1, before: 1200 },
      { learnerId: "high", rank: 2, before: 1800 },
    ]);
    expect(upset[0]!.after - 1200).toBeGreaterThan(60);
    expect(rateContest([{ learnerId: "solo", rank: 1, before: 1500 }])[0]!.after).toBe(1500);
    expect([titleOf(null), titleOf(1100), titleOf(1650), titleOf(2300)]).toEqual(["Unrated", "Newbie", "Expert", "Grandmaster"]);
  });
});
