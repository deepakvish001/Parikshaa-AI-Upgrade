import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { migrate } from "./migrate.js";
import { practiceLearner, practiceStaff, PracticeStore } from "./practice-store.js";
import { PrepPlusStore } from "./prep-plus-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Plus, credits and the tutor's record (migration 0020). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");

let db: PGlite;
let sql: SqlExecutor;
let practice: PracticeStore;
let store: PrepPlusStore;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await db.exec(`SET ROLE parikshaa_app`);
  practice = new PracticeStore(sql);
  store = new PrepPlusStore(sql);
});

afterEach(async () => {
  await db.close();
});

const learner = (email = "asha@example.com") => practice.createLearner({ orgId: A, email, name: "Asha", passwordHash: "h" });
const asLearner = (id: string) => ({ "parikshaa.org_id": A, "parikshaa.actor": "learner", "parikshaa.attempt_id": "", "parikshaa.learner_id": id });

describe("money and credits", () => {
  it("are written by the server alone: a learner cannot give themselves credits or Plus", async () => {
    const asha = await learner();
    for (const insert of [
      `INSERT INTO prep_credits (org_id, id, learner_id, delta, reason, key) VALUES ('org-a', 'x', '${asha.id}', 1000, 'grant', 'free')`,
      `INSERT INTO prep_plus (org_id, id, learner_id, starts_at, ends_at, source, ref) VALUES ('org-a', 'x', '${asha.id}', now(), now() + interval '1 year', 'grant', 'me')`,
    ]) {
      await expect(sql.transaction((tx) => tx.query(insert), asLearner(asha.id))).rejects.toThrow();
    }
    // Nor mark their own order paid: the row is not theirs to change, so nothing changes.
    const product = (await store.saveProduct(A, null, { title: "Plus", kind: "plus", days: 30, credits: 0, pricePaise: 49_900, active: true, position: 0 }))!;
    await store.createOrder(A, { learnerId: asha.id, productId: product.id, title: "Plus", days: 30, credits: 0, listPaise: 49_900, couponCode: null, discountPaise: 0, buyerName: "Asha", buyerState: null, buyerGstin: null, amountPaise: 49_900, taxPaise: 7_612, gatewayOrderId: "order_1" });
    const changed = await sql.transaction((tx) => tx.query(`UPDATE prep_orders SET status = 'paid' RETURNING id`), asLearner(asha.id));
    expect(changed).toEqual([]);
    expect((await store.orders(practiceLearner(A, asha.id)))[0]!.status).toBe("created");
  });

  it("issues a paid order's invoice once, numbered in its own series, for its learner's eyes only", async () => {
    const asha = await learner();
    const ravi = await learner("ravi@example.com");
    const product = (await store.saveProduct(A, null, { title: "Plus", kind: "plus", days: 30, credits: 0, pricePaise: 49_900, active: true, position: 0 }))!;
    const base = { productId: product.id, title: "Plus", days: 30, credits: 0, listPaise: 49_900, couponCode: null, discountPaise: 0, buyerName: "Asha", buyerState: null, buyerGstin: null, amountPaise: 49_900, taxPaise: 7_612 };
    await store.createOrder(A, { ...base, learnerId: asha.id, gatewayOrderId: "order_a" });
    await store.createOrder(A, { ...base, learnerId: ravi.id, gatewayOrderId: "order_r" });
    const build = (number: string) => ({ document: { number }, totalPaise: 49_900 });
    const at = new Date("2026-10-05T00:00:00Z");
    await store.markPaid(A, "order_a", "pay_a", at, build);
    await store.markPaid(A, "order_a", "pay_a", at, build);
    await store.markPaid(A, "order_r", "pay_r", at, build);
    expect((await store.invoices(practiceStaff(A))).map((i) => i.number).sort()).toEqual(["PKP/2627/000001", "PKP/2627/000002"]);
    const mine = await store.invoices(practiceLearner(A, asha.id));
    expect(mine.map((i) => [i.number, i.document])).toEqual([["PKP/2627/000001", { number: "PKP/2627/000001" }]]);
    // Row-level security, not the query, keeps Ravi's invoice from Asha.
    const seen = await sql.transaction((tx) => tx.query(`SELECT number FROM prep_invoices`), asLearner(asha.id));
    expect(seen).toEqual([{ number: "PKP/2627/000001" }]);
  });

  it("spends only what is there, once per key, and a second spend cannot take the last credits twice", async () => {
    const asha = await learner();
    expect(await store.credit(A, asha.id, { delta: 30, reason: "monthly", key: "monthly:2026-10" })).toBe(true);
    expect(await store.credit(A, asha.id, { delta: 30, reason: "monthly", key: "monthly:2026-10" })).toBe(false);
    const both = await Promise.all([store.spend(A, asha.id, 20, "a", new Date()), store.spend(A, asha.id, 20, "b", new Date())]);
    expect(both.filter(Boolean)).toHaveLength(1);
    expect((await store.credits(practiceLearner(A, asha.id))).balance).toBe(10);
  });

  it("gives an order's Plus and credits once, however often it is confirmed, and Plus bought on Plus runs on", async () => {
    const asha = await learner();
    const product = (await store.saveProduct(A, null, { title: "Plus", kind: "plus", days: 30, credits: 500, pricePaise: 49_900, active: true, position: 0 }))!;
    const base = { learnerId: asha.id, productId: product.id, title: "Plus", days: 30, credits: 500, listPaise: 49_900, couponCode: null, discountPaise: 0, buyerName: "Asha", buyerState: null, buyerGstin: null, amountPaise: 49_900, taxPaise: 7_612 };
    await store.createOrder(A, { ...base, gatewayOrderId: "order_1" });
    await store.createOrder(A, { ...base, gatewayOrderId: "order_2" });
    const at = new Date("2026-10-05T00:00:00Z");
    expect((await store.markPaid(A, "order_1", "pay_1", at))!.newlyPaid).toBe(true);
    expect((await store.markPaid(A, "order_1", "pay_1", at))!.newlyPaid).toBe(false);
    await store.markPaid(A, "order_2", "pay_2", at);
    expect(await store.markPaid(A, "order_x", "pay_x", at)).toBeNull();
    const spans = await store.plus(practiceLearner(A, asha.id));
    expect(spans.map((s) => [s.startsAt, s.endsAt])).toEqual([
      ["2026-10-05T00:00:00.000Z", "2026-11-04T00:00:00.000Z"],
      ["2026-11-04T00:00:00.000Z", "2026-12-04T00:00:00.000Z"],
    ]);
    expect((await store.credits(practiceLearner(A, asha.id))).balance).toBe(1000);
    // Another organisation sees none of it.
    expect(await store.orders(practiceLearner(B, asha.id))).toEqual([]);
  });
});

describe("the tutor's record", () => {
  it("is the learner's to read and delete, and nobody else's", async () => {
    const asha = await learner();
    const ravi = await learner("ravi@example.com");
    await store.addTutor(A, asha.id, { mode: "doubt", problemId: null, lessonId: null, hintLevel: null, question: "Why?", answer: "Because.", credits: 15, model: "m" }, new Date());
    expect(await store.tutorHistory(practiceLearner(A, ravi.id))).toEqual([]);
    expect(await store.forgetTutor(practiceLearner(A, ravi.id), null)).toBe(0);
    expect((await store.tutorHistory(practiceLearner(A, asha.id)))[0]).toMatchObject({ question: "Why?", answer: "Because." });
    expect(await store.forgetTutor(practiceLearner(A, asha.id), null)).toBe(1);
  });
});
