import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId, questionId, type OrgId, type Question } from "@parikshaa/core";
import { migrate } from "./migrate.js";
import { practiceLearner, practiceStaff, PracticeStore } from "./practice-store.js";
import { CommunitySlugTaken, PrepCommunityStore, type StoreItemDraft } from "./prep-community-store.js";
import { PrepPlusStore } from "./prep-plus-store.js";
import { PrepStore } from "./prep-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Companies, experiences, the coin store and ratings (migration 0021). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");

let db: PGlite;
let sql: SqlExecutor;
let practice: PracticeStore;
let prep: PrepStore;
let store: PrepCommunityStore;

const question: Question = { id: questionId("q"), kind: "mcq", stem: "Which sort is stable?", maxScore: 1, rubric: [], options: ["quick", "merge"], correctIndex: 1 };

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await db.exec(`SET ROLE parikshaa_app`);
  practice = new PracticeStore(sql);
  prep = new PrepStore(sql);
  store = new PrepCommunityStore(sql);
});

afterEach(async () => {
  await db.close();
});

const learner = (org: OrgId = A, email = "asha@example.com") => practice.createLearner({ orgId: org, email, name: email.split("@")[0]!, passwordHash: "h" });
const problem = (slug = "two-sum") =>
  practice.addProblem(A, { slug, title: slug, question, difficulty: "easy", tags: [], editorial: "", fromBank: null, position: 0, published: true });
const company = async (slug = "acme") => (await store.saveCompany(A, null, { slug, name: slug.toUpperCase(), about: "" }))!;
const asLearner = (id: string) => ({ "parikshaa.org_id": A, "parikshaa.actor": "learner", "parikshaa.attempt_id": "", "parikshaa.learner_id": id });
const item = (patch: Partial<StoreItemDraft> = {}): StoreItemDraft => ({
  title: "Sticker pack",
  description: "",
  kind: "physical",
  plusDays: 0,
  priceCoins: 100,
  stock: 2,
  perLearner: 1,
  couponPercent: 0,
  perMonth: null,
  active: true,
  ...patch,
});
const give = (learnerId: string, amount: number, key: string) => prep.award(A, learnerId, { rule: "grant", amount, key }, new Date());

describe("companies and reports", () => {
  it("keeps company addresses unique, and reports stay in their organisation", async () => {
    const acme = await company();
    await expect(store.saveCompany(A, null, { slug: "acme", name: "Again", about: "" })).rejects.toBeInstanceOf(CommunitySlugTaken);
    const p = await problem();
    await store.addReport(A, { companyId: acme.id, problemId: p.id, reportedOn: "2026-09-01", source: "staff", experienceId: null });
    expect(await store.reports(practiceLearner(A, null), acme.id)).toMatchObject([{ problemId: p.id, reportedOn: "2026-09-01" }]);
    expect(await store.reports(practiceStaff(B))).toEqual([]);
    expect(await store.companies(practiceLearner(B, null))).toEqual([]);
  });

  it("keeps the companies a learner aims for theirs alone", async () => {
    const acme = await company();
    const zeta = await company("zeta");
    const beta = await company("beta");
    const asha = await learner();
    const ravi = await learner(A, "ravi@example.com");
    const own = (id: string) => ({ ...practiceLearner(A, id), learnerId: id });
    await store.setTarget(own(asha.id), acme.id, true);
    await store.setTarget(own(asha.id), acme.id, true);
    await store.setTarget(own(asha.id), zeta.id, true);
    expect(await store.targets(practiceLearner(A, asha.id))).toEqual([acme.id, zeta.id]);
    expect(await store.targets(practiceLearner(A, ravi.id))).toEqual([]);
    // Another learner can neither read them nor write in their name.
    expect(await sql.transaction((tx) => tx.query(`SELECT * FROM prep_targets`), asLearner(ravi.id))).toEqual([]);
    await expect(
      sql.transaction((tx) => tx.query(`INSERT INTO prep_targets (org_id, learner_id, company_id) VALUES ($1, $2, $3)`, [A, asha.id, beta.id]), asLearner(ravi.id)),
    ).rejects.toThrow(/row-level security/);
    await store.setTarget(own(asha.id), acme.id, false);
    expect(await store.targets(practiceLearner(A, asha.id))).toEqual([zeta.id]);
  });
});

describe("experiences", () => {
  it("are written pending, read by their author, and published for everyone by staff", async () => {
    const acme = await company();
    const asha = await learner();
    const ravi = await learner(A, "ravi@example.com");
    const draft = { companyId: acme.id, role: "SDE 1", interviewed: "2026-08", verdict: "offer" as const, rounds: [{ kind: "DSA", asked: "Two sum", problemSlugs: ["two-sum"] }], tips: "", authorName: "Asha" };
    const mine = await store.addExperience(practiceLearner(A, asha.id), draft);
    expect(mine.status).toBe("pending");
    expect(await store.experiences(practiceLearner(A, ravi.id))).toEqual([]);
    expect(await store.experiences(practiceLearner(A, asha.id))).toHaveLength(1);

    // A learner cannot publish their own, nor write one in someone else's name.
    const changed = await sql.transaction((tx) => tx.query(`UPDATE prep_experiences SET status = 'published' RETURNING id`), asLearner(asha.id));
    expect(changed).toEqual([]);
    await expect(store.addExperience(practiceLearner(A, asha.id), { ...draft, companyId: "nope" })).rejects.toThrow();
    await expect(
      sql.transaction(
        (tx) =>
          tx.query(`INSERT INTO prep_experiences (org_id, id, learner_id, company_id, role, interviewed, verdict, rounds, author_name) VALUES ('org-a', 'x', $1, $2, 'r', '2026-01', 'offer', '[]', 'R')`, [
            ravi.id,
            acme.id,
          ]),
        asLearner(asha.id),
      ),
    ).rejects.toThrow();

    const published = await store.decideExperience(A, mine.id, "published", "staff-1", new Date("2026-09-02T00:00:00Z"));
    expect(published).toMatchObject({ status: "published", publishedAt: "2026-09-02T00:00:00.000Z" });
    expect(await store.decideExperience(A, mine.id, "rejected", "staff-1", new Date())).toBeNull();
    expect(await store.experiences(practiceLearner(A, ravi.id))).toHaveLength(1);
    expect(await store.experiences(practiceLearner(A, null), { status: "published", companyId: acme.id })).toHaveLength(1);
  });

  it("counts one vote per learner, and a vote can be taken back", async () => {
    const acme = await company();
    const asha = await learner();
    const ravi = await learner(A, "ravi@example.com");
    const e = await store.addExperience(practiceLearner(A, asha.id), { companyId: acme.id, role: "SDE", interviewed: "2026-08", verdict: "reject", rounds: [], tips: "", authorName: "A" });
    await store.decideExperience(A, e.id, "published", "s", new Date());
    await store.vote(practiceLearner(A, ravi.id), e.id, true);
    await store.vote(practiceLearner(A, ravi.id), e.id, true);
    expect((await store.experiences(practiceLearner(A, null)))[0]!.votes).toBe(1);
    expect([...(await store.myVotes(practiceLearner(A, ravi.id)))]).toEqual([e.id]);
    await store.vote(practiceLearner(A, ravi.id), e.id, false);
    expect((await store.experiences(practiceLearner(A, null)))[0]!.votes).toBe(0);
  });
});

describe("the coin store", () => {
  it("takes the coins, the stock and the order together, and refuses what cannot be paid for", async () => {
    const asha = await learner();
    const stickers = (await store.saveItem(A, null, item()))!;
    expect(await store.redeem(A, asha.id, stickers.id, "Pune", new Date())).toBe("coins");
    await give(asha.id, 150, "g1");
    const order = await store.redeem(A, asha.id, stickers.id, "Pune", new Date());
    expect(order).toMatchObject({ status: "placed", priceCoins: 100, address: "Pune" });
    expect((await prep.coins(practiceLearner(A, asha.id))).balance).toBe(50);
    expect((await store.items(practiceStaff(A)))[0]!.stock).toBe(1);
    await give(asha.id, 100, "g2");
    expect(await store.redeem(A, asha.id, stickers.id, "Pune", new Date())).toBe("limit");
    expect(await store.redeem(A, asha.id, "missing", "", new Date())).toBe("no_item");
  });

  it("sells a coupon for its buyer alone, and holds an item to its monthly limit", async () => {
    const asha = await learner();
    await give(asha.id, 1000, "start");
    const coupon = (await store.saveItem(A, null, item({ title: "20% off Plus", kind: "coupon", couponPercent: 20, stock: null, perLearner: 5, perMonth: 1 })))!;
    const order = await store.redeem(A, asha.id, coupon.id, "", new Date("2026-10-05T10:00:00Z"));
    if (typeof order === "string") throw new Error(order);
    expect(order.status).toBe("fulfilled");
    const code = /COIN-[A-Z0-9]{8}/.exec(order.note)![0];
    const made = await sql.transaction((tx) => tx.query<{ value: number; max_uses: number; learner_id: string }>(`SELECT value, max_uses, learner_id FROM prep_coupons WHERE code = $1`, [code]), {
      "parikshaa.org_id": A,
      "parikshaa.actor": "staff",
      "parikshaa.attempt_id": "",
      "parikshaa.learner_id": "",
    });
    expect(made).toEqual([{ value: 20, max_uses: 1, learner_id: asha.id }]);
    // One a month: refused again in October, sold again in November (India's calendar).
    expect(await store.redeem(A, asha.id, coupon.id, "", new Date("2026-10-31T18:00:00Z"))).toBe("month_limit");
    const november = await store.redeem(A, asha.id, coupon.id, "", new Date("2026-10-31T19:00:00Z"));
    expect(typeof november).not.toBe("string");
  });

  it("sells the last one once when two learners ask at the same time", async () => {
    const asha = await learner();
    const ravi = await learner(A, "ravi@example.com");
    const last = (await store.saveItem(A, null, item({ stock: 1 })))!;
    await give(asha.id, 100, "a");
    await give(ravi.id, 100, "r");
    const both = await Promise.all([store.redeem(A, asha.id, last.id, "", new Date()), store.redeem(A, ravi.id, last.id, "", new Date())]);
    expect(both.filter((o) => typeof o === "object")).toHaveLength(1);
    expect(both).toContain("sold_out");
  });

  it("gives Plus at once for a Plus item, and a cancelled order gives the coins and the stock back", async () => {
    const asha = await learner();
    await give(asha.id, 1000, "g");
    const plus = (await store.saveItem(A, null, item({ title: "Plus, a week", kind: "plus", plusDays: 7, stock: null, priceCoins: 500 })))!;
    const at = new Date("2026-10-01T00:00:00Z");
    expect(await store.redeem(A, asha.id, plus.id, "", at)).toMatchObject({ status: "fulfilled" });
    expect(await new PrepPlusStore(sql).plus(practiceLearner(A, asha.id))).toMatchObject([{ source: "coins", endsAt: "2026-10-08T00:00:00.000Z" }]);

    const stickers = (await store.saveItem(A, null, item()))!;
    const order = (await store.redeem(A, asha.id, stickers.id, "", at)) as { id: string };
    expect((await prep.coins(practiceLearner(A, asha.id))).balance).toBe(400);
    expect(await store.closeOrder(A, order.id, "cancelled", "Out of stock", at)).toMatchObject({ status: "cancelled" });
    expect(await store.closeOrder(A, order.id, "fulfilled", "", at)).toBeNull();
    expect((await prep.coins(practiceLearner(A, asha.id))).balance).toBe(500);
    expect((await store.items(practiceStaff(A))).find((i) => i.id === stickers.id)!.stock).toBe(2);
    expect(await store.storeOrders(practiceLearner(A, asha.id))).toHaveLength(2);
  });

  it("lets a learner see only active items and only their own orders, and place none themselves", async () => {
    const asha = await learner();
    const ravi = await learner(A, "ravi@example.com");
    await store.saveItem(A, null, item({ active: false }));
    expect(await store.items(practiceLearner(A, asha.id))).toEqual([]);
    const on = (await store.saveItem(A, null, item({ stock: null })))!;
    await give(ravi.id, 100, "r");
    await store.redeem(A, ravi.id, on.id, "", new Date());
    expect(await store.storeOrders(practiceLearner(A, asha.id))).toEqual([]);
    await expect(
      sql.transaction(
        (tx) => tx.query(`INSERT INTO prep_store_orders (org_id, id, learner_id, item_id, title, price_coins) VALUES ('org-a', 'x', $1, $2, 't', 0)`, [asha.id, on.id]),
        asLearner(asha.id),
      ),
    ).rejects.toThrow();
  });
});

describe("a deleted account", () => {
  it("leaves its write-up under no name, blanks its address, and takes its notes and votes", async () => {
    const acme = await company();
    const asha = await learner();
    const ravi = await learner(A, "ravi@example.com");
    const e = await store.addExperience(practiceLearner(A, asha.id), { companyId: acme.id, role: "SDE", interviewed: "2026-08", verdict: "offer", rounds: [], tips: "", authorName: "Asha" });
    await store.decideExperience(A, e.id, "published", "s", new Date());
    const other = await store.addExperience(practiceLearner(A, ravi.id), { companyId: acme.id, role: "SDE", interviewed: "2026-08", verdict: "offer", rounds: [], tips: "", authorName: "Ravi" });
    await store.decideExperience(A, other.id, "published", "s", new Date());
    await store.vote(practiceLearner(A, asha.id), other.id, true);
    await prep.saveNote(practiceLearner(A, asha.id), { refKind: "topic", refId: "graphs", title: "My weak spot", body: "BFS vs DFS" });
    const tee = (await store.saveItem(A, null, item()))!;
    await give(asha.id, 100, "g");
    await store.redeem(A, asha.id, tee.id, "12 MG Road, Pune", new Date());

    await practice.eraseLearner(A, asha.id);
    const mine = (await store.experiences(practiceStaff(A))).find((x) => x.id === e.id)!;
    expect(mine.authorName).toBe("Anonymous");
    expect((await store.storeOrders(practiceStaff(A)))[0]!.address).toBe("");
    expect((await store.experiences(practiceStaff(A))).find((x) => x.id === other.id)!.votes).toBe(0);
    expect(await prep.notes(practiceLearner(A, asha.id))).toEqual([]);
  });
});

describe("ratings", () => {
  it("rates a contest once", async () => {
    const asha = await learner();
    const p = await problem();
    const contest = (await practice.saveContest(A, null, {
      slug: "weekly-1",
      title: "Weekly 1",
      description: "",
      startsAt: "2026-09-01T10:00:00.000Z",
      endsAt: "2026-09-01T11:30:00.000Z",
      problemIds: [p.id],
    }))!;
    const at = new Date("2026-09-02T00:00:00Z");
    expect(await store.rate(A, contest.id, [{ learnerId: asha.id, rank: 1, before: 1500, after: 1532 }], at)).toBe(true);
    expect(await store.rate(A, contest.id, [{ learnerId: asha.id, rank: 1, before: 1500, after: 1600 }], at)).toBe(false);
    expect(await store.ratings(practiceLearner(A, null), { learnerId: asha.id })).toMatchObject([{ after: 1532, rank: 1 }]);
  });
});
