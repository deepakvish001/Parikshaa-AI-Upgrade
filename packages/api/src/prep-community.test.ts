import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { achievementCard } from "./achievement-card.js";
import { prizeOrder, rateContest, titleOf } from "./prep-community.js";
import type { FakeRazorpay } from "./razorpay.js";
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
let razorpay: FakeRazorpay;
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
  ({ app, identity, razorpay } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => clock }));
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

    expect((await ok("GET", null, `${S}/companies`)).companies).toEqual([{ slug: "acme-corp", name: "Acme Corp", problems: 6, experiences: 0, logo: null }]);
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

  /** Acme asked problem 0 three times, 1 twice, and 2 to 6 once, all within six months. */
  async function acme() {
    const company = await ok("POST", owner, "/practice-admin/companies", { name: "Acme Corp" });
    const report = (ids: string[], daysAgo: number) => ok("POST", owner, `/practice-admin/companies/${company.id}/reports`, { problemIds: ids, reportedOn: dayOf(clock - daysAgo * DAY) });
    await report(problems.map((p) => p.id), 30);
    await report([problems[0]!.id, problems[1]!.id], 20);
    await report([problems[0]!.id], 10);
    return company;
  }

  it("tells a learner how ready they are, keeps the companies they aim for, and starts a company's list", async () => {
    await acme();
    expect((await ok("GET", null, `${S}/companies/acme-corp`)).readiness).toBeNull();
    const asha = await signUp("asha@example.com", "Asha");
    let page = await ok("GET", asha, `${S}/companies/acme-corp`);
    expect(page).toMatchObject({ readiness: { solved: 0, of: 7, percent: 0 }, target: false });
    await ok("POST", asha, `${S}/problems/${problems[0]!.slug}/submit`, { answer: "1" }, 200);
    await ok("POST", asha, `${S}/problems/${problems[1]!.slug}/submit`, { answer: "0" }, 200);
    page = await ok("GET", asha, `${S}/companies/acme-corp`);
    expect(page.readiness).toEqual({ solved: 1, of: 7, percent: 14 });

    await ok("PUT", asha, `${S}/companies/acme-corp/target`, { on: true }, 200);
    expect((await ok("GET", asha, `${S}/companies/acme-corp`)).target).toBe(true);
    expect((await ok("GET", asha, `${S}/companies/targets`)).targets).toEqual([{ slug: "acme-corp", name: "Acme Corp", readiness: { solved: 1, of: 7, percent: 14 } }]);
    await ok("PUT", asha, `${S}/companies/acme-corp/target`, { on: false }, 200);
    expect((await ok("GET", asha, `${S}/companies/targets`)).targets).toEqual([]);
    expect((await call("PUT", asha, `${S}/companies/nobody/target`, { on: true })).statusCode).toBe(404);
    expect((await call("PUT", null, `${S}/companies/acme-corp/target`, { on: true })).statusCode).toBe(401);

    // Without Plus on sale, the whole list, most asked first; starting it aims for the company too.
    const started = await ok("POST", asha, `${S}/companies/acme-corp/start`, undefined, 200);
    expect(started).toEqual({ list: "Acme Corp", added: 7, locked: 0 });
    const list = ((await ok("GET", asha, `${S}/lists`)).lists as { name: string; problems: { slug: string }[] }[]).find((l) => l.name === "Acme Corp")!;
    expect(list.problems.map((p) => p.slug).sort()).toEqual(problems.map((p) => p.slug).sort());
    expect((await ok("GET", asha, `${S}/companies/targets`)).targets).toHaveLength(1);
    // Starting it again adds nothing twice.
    await ok("POST", asha, `${S}/companies/acme-corp/start`, undefined, 200);
    const again = ((await ok("GET", asha, `${S}/lists`)).lists as { name: string; problems: unknown[] }[]).find((l) => l.name === "Acme Corp")!;
    expect(again.problems).toHaveLength(7);
  });

  it("opens every company's full list with a Company Pass, and nothing that needs Plus", async () => {
    await acme();
    await ok("PUT", owner, "/practice-admin/plus", { plusEnabled: true, checkout: true });
    const pass = await ok("POST", owner, "/practice-admin/plus/products", { title: "Company Pass, a month", kind: "company", days: 30, pricePaise: 29_900 });
    expect((await call("POST", owner, "/practice-admin/plus/products", { title: "Bad pass", kind: "company", days: 0, pricePaise: 100 })).statusCode).toBe(422);
    const ravi = await signUp("ravi@example.com", "Ravi");
    expect(await ok("POST", ravi, `${S}/companies/acme-corp/start`, undefined, 200)).toEqual({ list: "Acme Corp", added: 5, locked: 2 });
    expect((await ok("GET", ravi, `${S}/companies/acme-corp?window=all`)).locked).toBe(2);

    const checkout = await ok("POST", ravi, `${S}/plus/checkout`, { productId: pass.id });
    const paymentId = `pay_${checkout.orderId}`;
    const confirmed = await ok("POST", ravi, `${S}/plus/confirm`, { orderId: checkout.orderId, paymentId, signature: razorpay.sign(checkout.orderId, paymentId) }, 200);
    // The pass is not Plus: Plus stays off, the company lists open.
    expect(confirmed.plus.active).toBe(false);
    expect((await ok("GET", ravi, `${S}/plus`)).active).toBe(false);
    expect((await ok("GET", ravi, `${S}/companies/acme-corp?window=all`)).locked).toBe(0);
    expect(await ok("POST", ravi, `${S}/companies/acme-corp/start`, undefined, 200)).toMatchObject({ added: 7, locked: 0 });
    const planInput = { track: "dsa", level: "beginner", deadline: dayOf(clock + 60 * DAY), dailyMinutes: 60, offDays: [] };
    expect((await call("POST", ravi, `${S}/plan/preview`, planInput)).statusCode).toBe(402);
    // Its invoice names what was bought.
    const invoice = await ok("GET", ravi, `${S}/invoices/${encodeURIComponent(confirmed.order.invoice)}`);
    expect(JSON.stringify(invoice.document)).toMatch(/Company Pass for 30 days/);
  });

  it("puts the target companies' unsolved problems in a new plan's last days", async () => {
    await acme();
    const lessons = [];
    for (let i = 0; i < 10; i++) lessons.push(await ok("POST", owner, "/practice-admin/lessons", { title: `Lesson ${i + 1}`, body: "Read this.", estMinutes: 45, published: true }));
    await ok("POST", owner, "/practice-admin/tracks", { title: "DSA", description: "", published: true, modules: [{ title: "All", items: lessons.map((l) => ({ lessonId: l.id })) }] });
    const asha = await signUp("asha@example.com", "Asha");
    await ok("POST", asha, `${S}/problems/${problems[0]!.slug}/submit`, { answer: "1" }, 200);
    await ok("PUT", asha, `${S}/companies/acme-corp/target`, { on: true }, 200);

    const { plan } = await ok("POST", asha, `${S}/plan`, { track: "dsa", level: "beginner", deadline: dayOf(clock + 60 * DAY), dailyMinutes: 60, offDays: [] });
    type Task = { day: string; kind: string; link: { kind: string; slug: string } | null };
    const tasks = [...plan.today, ...plan.upcoming] as Task[];
    const fromCompany = tasks.filter((t) => t.link?.kind === "problem");
    // The six unsolved, never the one already solved.
    expect(fromCompany.map((t) => t.link!.slug).sort()).toEqual(problems.slice(1).map((p) => p.slug).sort());
    const days = [...new Set(tasks.filter((t) => t.kind === "learn").map((t) => t.day))].sort();
    const tail = days.slice(Math.floor(days.length * 0.7));
    for (const t of fromCompany) expect(tail).toContain(t.day);
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
    // A round names its problems by title as well as by address.
    expect(mine.rounds[0].problems).toHaveLength(1);
    expect(mine.rounds[0].problems[0]).toMatchObject({ slug: problems[3]!.slug, title: expect.stringMatching(/\S/) });
    expect(mine.rounds[0].problems[0].title).not.toBe(problems[3]!.slug);
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

  it("sells a coupon for its buyer alone, and holds an item to its monthly limit", async () => {
    await ok("PUT", owner, "/practice-admin/plus", { plusEnabled: true });
    const plan = await ok("POST", owner, "/practice-admin/plus/products", { title: "Plus, 3 months", kind: "plus", days: 90, credits: 0, pricePaise: 99_900 });
    expect((await call("POST", owner, "/practice-admin/store/items", { title: "Coupon", kind: "coupon", couponPercent: 95, priceCoins: 20 })).statusCode).toBe(400);
    expect((await call("POST", owner, "/practice-admin/store/items", { title: "Coupon", kind: "coupon", priceCoins: 20 })).statusCode).toBe(422);
    const item = await ok("POST", owner, "/practice-admin/store/items", { title: "25% off Plus", kind: "coupon", couponPercent: 25, priceCoins: 20, perLearner: 5, perMonth: 1 });
    expect(item).toMatchObject({ kind: "coupon", couponPercent: 25, perMonth: 1, plusDays: 0 });
    const asha = await signUp("asha@example.com", "Asha");
    const ravi = await signUp("ravi@example.com", "Ravi");
    await earn(asha);
    clock += 15 * DAY;
    expect((await ok("GET", asha, `${S}/store`)).items[0]).toMatchObject({ kind: "coupon", couponPercent: 25, perMonth: 1 });

    const bought = await ok("POST", asha, `${S}/store/${item.id}/redeem`, {});
    expect(bought.order.status).toBe("fulfilled");
    const code = /Your coupon: (COIN-[A-Z0-9]{8})/.exec(bought.order.note)![1]!;
    expect((await ok("POST", asha, `${S}/plus/quote`, { productId: plan.id, coupon: code }, 200)).discountPaise).toBe(24_975);
    // Another learner cannot use it.
    expect((await call("POST", ravi, `${S}/plus/quote`, { productId: plan.id, coupon: code })).json().message).toBe("That coupon code is not valid");
    expect((await call("POST", null, `${S}/plus/quote`, { productId: plan.id, coupon: code })).json().message).toBe("That coupon code is not valid");

    // One a month.
    const again = await call("POST", asha, `${S}/store/${item.id}/redeem`, {});
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: "limit_reached", message: "You may buy one of these a month; try again next month" });
    // The next month in India; signed in afresh, since a session lasts thirty days.
    const ist = new Date(clock + 330 * 60_000);
    clock = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1, 6, 0) - 330 * 60_000;
    const again2 = (await ok("POST", null, `${S}/signin`, { email: "asha@example.com", password: PASSWORD }, 200)).token as string;
    expect((await ok("POST", again2, `${S}/store/${item.id}/redeem`, {})).balance).toBe(60);
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

    // The top ten who solved something get coins for their rank, once.
    const rankCoins = async (token: string) =>
      ((await ok("GET", token, `${S}/coins`)).history as { rule: string; amount: number }[]).filter((h) => h.rule === "contest_rank").map((h) => h.amount);
    expect(await rankCoins(asha)).toEqual([100]);
    expect(await rankCoins(ravi)).toEqual([75]);
    expect(await rankCoins(meena)).toEqual([]);
    await ok("GET", ravi, `${S}/rating`);
    expect(await rankCoins(asha)).toEqual([100]);

    // The title goes with the name: on the scoreboard, the leaderboard, the coin board and in discussion.
    const titleOfAsha = rated.board[0].title as string;
    expect(titleOfAsha).not.toBe("Unrated");
    const board = (await ok("GET", null, `${S}/contests/${contest.slug}`)).scoreboard as { name: string; title: string | null; username: string | null }[];
    expect(board.find((r) => r.name === "Asha")).toMatchObject({ title: titleOfAsha, username: null });
    expect(((await ok("GET", null, `${S}/leaderboard`)).leaders as { name: string; title: string | null }[]).find((r) => r.name === "Asha")!.title).toBe(titleOfAsha);
    expect(((await ok("GET", null, `${S}/coins/leaders`)).leaders as { name: string; title: string | null }[]).find((r) => r.name === "Asha")!.title).toBe(titleOfAsha);
    await ok("PUT", asha, `${S}/profile`, { username: "asha", public: true }, 200);
    const posted = await ok("POST", asha, `${S}/problems/${problems[0]!.slug}/comments`, { body: "Merge sort keeps ties in order." });
    expect(posted).toMatchObject({ title: titleOfAsha, username: "asha" });
    expect((await ok("GET", null, `${S}/problems/${problems[0]!.slug}/comments`)).comments[0]).toMatchObject({ authorName: "Asha", title: titleOfAsha, username: "asha" });
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

describe("profiles and cards", () => {
  it("keeps a profile private until the learner makes it public, and never shows the email", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    const ravi = await signUp("ravi@example.com", "Ravi");
    expect(await ok("GET", asha, `${S}/profile`)).toEqual({ username: null, public: false, bio: "" });
    expect((await call("PUT", asha, `${S}/profile`, { username: "A", public: true })).statusCode).toBe(422);
    expect(await ok("PUT", asha, `${S}/profile`, { username: "Asha_R", public: false, bio: "Final year, NIT Trichy" }, 200)).toEqual({ username: "asha_r", public: false, bio: "Final year, NIT Trichy" });
    expect((await call("GET", null, `${S}/u/asha_r`)).statusCode).toBe(404);
    expect((await call("PUT", ravi, `${S}/profile`, { username: "asha_r", public: true })).statusCode).toBe(409);

    await ok("POST", asha, `${S}/problems/${problems[0]!.slug}/submit`, { answer: "1" }, 200);
    await ok("PUT", asha, `${S}/profile`, { username: "asha_r", public: true, bio: "Final year, NIT Trichy" }, 200);
    const shown = await call("GET", null, `${S}/u/ASHA_R`);
    expect(shown.statusCode).toBe(200);
    expect(shown.json()).toMatchObject({
      username: "asha_r",
      name: "Asha",
      bio: "Final year, NIT Trichy",
      title: "Unrated",
      rating: null,
      contests: [],
      streak: { current: 1 },
      achievements: ["first_solve"],
      url: "https://exam.test/practice/nit-practice/u/asha_r",
    });
    expect(shown.payload).not.toContain("asha@example.com");
    // Private again: gone.
    await ok("PUT", asha, `${S}/profile`, { username: "asha_r", public: false }, 200);
    expect((await call("GET", null, `${S}/u/asha_r`)).statusCode).toBe(404);
  });

  it("draws a card only for an achievement earned, in English or Hindi, as a story or a square", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    expect((await call("GET", asha, `${S}/achievements/first_solve/card`)).statusCode).toBe(404);
    await ok("POST", asha, `${S}/problems/${problems[0]!.slug}/submit`, { answer: "1" }, 200);
    const card = await call("GET", asha, `${S}/achievements/first_solve/card`);
    expect(card.statusCode).toBe(200);
    expect(card.headers["content-type"]).toBe("image/svg+xml; charset=utf-8");
    expect(card.payload).toMatch(/^<svg [^>]*width="1080" height="1920"/);
    expect(card.payload).toContain(">First solve<");
    expect(card.payload).toContain(">Asha<");
    expect(card.payload).toContain("NIT Practice");
    expect(card.payload).not.toContain("/u/");
    await ok("PUT", asha, `${S}/profile`, { username: "asha", public: true }, 200);
    const hindi = await call("GET", asha, `${S}/achievements/first_solve/card?format=square&lang=hi`);
    expect(hindi.payload).toMatch(/^<svg [^>]*height="1080"/);
    expect(hindi.payload).toContain(">पहला हल<");
    expect(hindi.payload).toContain("exam.test/practice/nit-practice/u/asha");
    expect((await call("GET", asha, `${S}/achievements/no_such/card`)).statusCode).toBe(404);
    expect((await call("GET", null, `${S}/achievements/first_solve/card`)).statusCode).toBe(401);
  });

  it("escapes what a learner wrote", () => {
    const svg = achievementCard({ format: "square", lang: "en", achievement: "first_solve", name: "<script>alert(1)</script>", site: "A & B", title: "Unrated", rating: null, profileUrl: null });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("A &amp; B");
  });
});

describe("community v2", () => {
  async function published(token: string, company = "acme") {
    await call("POST", owner, "/practice-admin/companies", { name: company[0]!.toUpperCase() + company.slice(1) });
    const e = await ok("POST", token, `${S}/experiences`, { company, role: "SDE", interviewed: dayOf(clock).slice(0, 7), verdict: "offer", rounds: [{ kind: "DSA", asked: "Two sum." }] });
    await ok("POST", owner, `/practice-admin/experiences/${e.id}/decision`, { status: "published" }, 200);
    return e.id as string;
  }

  it("holds an experience three learners flag, once each, until staff keep it", async () => {
    const author = await signUp("author@example.com", "Author");
    const id = await published(author);
    expect((await call("POST", author, `${S}/experiences/${id}/flag`, { reason: "fake" })).statusCode).toBe(404);
    const [a, b, c, d] = await Promise.all(["a@x.com", "b@x.com", "c@x.com", "d@x.com"].map((m) => signUp(m, m[0]!.toUpperCase())));
    expect(await ok("POST", a!, `${S}/experiences/${id}/flag`, { reason: "fake", note: "This company never came to campus." }, 200)).toEqual({ flagged: true, held: false });
    const again = await call("POST", a!, `${S}/experiences/${id}/flag`, { reason: "offensive" });
    expect(again.statusCode).toBe(409);
    expect(again.json().message).toBe("You have flagged this already");
    expect((await ok("GET", a!, `${S}/experiences`)).experiences[0]).toMatchObject({ id, flagged: true });
    await ok("POST", b!, `${S}/experiences/${id}/flag`, { reason: "wrong_company" }, 200);
    expect(await ok("POST", c!, `${S}/experiences/${id}/flag`, { reason: "other" }, 200)).toEqual({ flagged: true, held: true });
    expect((await ok("GET", d!, `${S}/experiences`)).experiences).toEqual([]);
    expect((await ok("GET", author, `${S}/experiences`)).experiences[0]).toMatchObject({ id, status: "held", mine: true });

    expect((await call("GET", a!, "/practice-admin/experiences/flags")).statusCode).toBe(401);
    const queue = (await ok("GET", viewer, "/practice-admin/experiences/flags")).flagged;
    expect(queue).toHaveLength(1);
    expect(queue[0].experience).toMatchObject({ id, status: "held", learnerId: expect.any(String) });
    expect(queue[0].flags.map((f: { reason: string }) => f.reason).sort()).toEqual(["fake", "other", "wrong_company"]);
    expect((await call("POST", viewer, `/practice-admin/experiences/${id}/flags`, { keep: true })).statusCode).toBe(403);
    expect((await call("POST", owner, `/practice-admin/experiences/${id}/flags`, { keep: true })).statusCode).toBe(204);
    expect((await ok("GET", d!, `${S}/experiences`)).experiences.map((e: { id: string }) => e.id)).toEqual([id]);
    expect((await call("POST", owner, `/practice-admin/experiences/${id}/flags`, { keep: true })).statusCode).toBe(404);
  });

  it("publishes a success story staff approve, two waiting at most", async () => {
    const asha = await signUp("asha@example.com", "Asha");
    const ravi = await signUp("ravi@example.com", "Ravi");
    const text = "Six months of the plan, a hundred and twenty problems, two contests a month, and mock interviews with friends.";
    expect((await call("POST", asha, `${S}/stories`, { company: "Acme", role: "SDE 1", story: "Short." })).statusCode).toBe(422);
    const mine = await ok("POST", asha, `${S}/stories`, { company: "Acme", role: "SDE 1", story: text });
    expect(mine).toMatchObject({ status: "pending", author: "Asha", mine: true });
    await ok("POST", asha, `${S}/stories`, { company: "Beta", role: "Analyst", story: text, anonymous: true });
    expect((await call("POST", asha, `${S}/stories`, { company: "Gamma", role: "SDE", story: text })).statusCode).toBe(429);
    expect((await ok("GET", ravi, `${S}/stories`)).stories).toEqual([]);
    expect((await ok("GET", asha, `${S}/stories`)).stories).toHaveLength(2);

    const pending = (await ok("GET", viewer, "/practice-admin/stories?status=pending")).stories;
    expect(pending).toHaveLength(2);
    await ok("POST", owner, `/practice-admin/stories/${mine.id}/decision`, { status: "published" }, 200);
    expect((await call("POST", owner, `/practice-admin/stories/${mine.id}/decision`, { status: "rejected" })).statusCode).toBe(404);
    expect((await ok("GET", null, `${S}/stories`)).stories).toEqual([expect.objectContaining({ id: mine.id, company: "Acme", author: "Asha", mine: false })]);
  });

  it("keeps a company's logo, checked by its bytes and its size", async () => {
    const acme = await ok("POST", owner, "/practice-admin/companies", { name: "Acme" });
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const put = (logo: object | null, token = owner) => call("PUT", token, `/practice-admin/companies/${acme.id}/logo`, { logo });
    expect((await put({ mime: "image/png", data: png.toString("base64") }, viewer)).statusCode).toBe(403);
    // Says PNG, is not.
    expect((await put({ mime: "image/png", data: Buffer.from("GIF89a....").toString("base64") })).statusCode).toBe(422);
    expect((await put({ mime: "image/jpeg", data: png.toString("base64") })).statusCode).toBe(422);
    expect((await put({ mime: "image/png", data: Buffer.concat([png, Buffer.alloc(101 * 1024)]).toString("base64") })).statusCode).toBe(422);
    expect((await put({ mime: "image/svg+xml", data: png.toString("base64") })).statusCode).toBe(400);
    expect((await put({ mime: "image/png", data: png.toString("base64") })).statusCode).toBe(204);

    const card = (await ok("GET", null, `${S}/companies`)).companies[0];
    expect(card.logo).toMatch(/^\/api\/practice\/nit-practice\/companies\/acme\/logo\?v=\d+$/);
    expect((await ok("GET", null, `${S}/companies/acme`)).logo).toBe(card.logo);
    const image = await call("GET", null, card.logo.replace(/^\/api/, ""));
    expect(image.statusCode).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["cache-control"]).toContain("immutable");
    expect(image.rawPayload.equals(png)).toBe(true);

    expect((await put(null)).statusCode).toBe(204);
    expect((await ok("GET", null, `${S}/companies`)).companies[0].logo).toBeNull();
    expect((await call("GET", null, `${S}/companies/acme/logo`)).statusCode).toBe(404);
  });

  it("names the patterns a company asks, and how many of each the learner has solved", async () => {
    const tagged = async (stem: string, tags: string[]) => {
      const q = await ok("POST", owner, "/bank", { question: mcq(stem), difficulty: "medium", tags });
      return ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id });
    };
    const window = await tagged("Longest window under a budget asks what", ["Sliding Window", "two pointers"]);
    const pairs = await tagged("Pairs with a target sum asks what", ["hashing", "Two-Pointers"]);
    const ranges = await tagged("Range sums asks what", ["prefix sums", "arrays"]);
    const acme = await ok("POST", owner, "/practice-admin/companies", { name: "Acme" });
    await ok("POST", owner, `/practice-admin/companies/${acme.id}/reports`, { problemIds: [window.id, pairs.id, ranges.id], reportedOn: dayOf(clock - 3 * DAY) });
    const asha = await signUp("asha@example.com", "Asha");
    await ok("POST", asha, `${S}/problems/${pairs.slug}/submit`, { answer: "1" }, 200);
    const page = await ok("GET", asha, `${S}/companies/acme?window=30`);
    expect(page.patterns).toEqual([
      { pattern: "Two pointers", problems: 2, solved: 1 },
      { pattern: "Sliding window", problems: 1, solved: 0 },
      { pattern: "Prefix sums", problems: 1, solved: 0 },
      { pattern: "Hashing and counting", problems: 1, solved: 1 },
    ]);
  });
});

describe("prize order", () => {
  it("breaks a tie on the board by the sooner last solve, and leaves out those who solved nothing", () => {
    const contest = { startsAt: "2026-10-05T10:00:00.000Z", endsAt: "2026-10-05T10:30:00.000Z", problemIds: ["p1", "p2"] };
    const row = (learnerId: string, rank: number, solved: number) => ({ learnerId, name: learnerId, rank, solved });
    const board = [row("asha", 1, 2), row("ravi", 1, 2), row("meena", 3, 1), row("kiran", 4, 0)];
    const at = (minute: number, second: number) => new Date(Date.parse(contest.startsAt) + minute * 60_000 + second * 1000).toISOString();
    const sub = (learnerId: string, problemId: string, status: string, createdAt: string) => ({ learnerId, problemId, status, createdAt });
    const submissions = [
      sub("asha", "p1", "passed", at(1, 10)),
      sub("asha", "p2", "passed", at(2, 50)),
      sub("ravi", "p1", "passed", at(1, 40)),
      sub("ravi", "p2", "passed", at(2, 5)),
      // A later pass does not move the first one.
      sub("ravi", "p2", "passed", at(9, 0)),
      sub("meena", "p1", "passed", at(0, 30)),
      sub("kiran", "p1", "wrong_answer", at(0, 20)),
    ];
    expect(prizeOrder(contest, board, submissions).map((r) => r.learnerId)).toEqual(["ravi", "asha", "meena"]);
  });
});
