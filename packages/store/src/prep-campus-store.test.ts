import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { migrate } from "./migrate.js";
import { PracticeStore } from "./practice-store.js";
import { CohortNameTaken, PrepCampusStore } from "./prep-campus-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Campus cohorts (migration 0038). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
let db: PGlite;
let sql: SqlExecutor;
let store: PrepCampusStore;
let practice: PracticeStore;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await db.exec(`SET ROLE parikshaa_app`);
  store = new PrepCampusStore(sql);
  practice = new PracticeStore(sql);
});

afterEach(async () => {
  await db.close();
});

describe("cohorts", () => {
  it("keep their names unique, their addresses once, and stay in their organisation", async () => {
    const cohort = await store.createCohort(A, { name: "NIT 2027", plusDays: 180, createdBy: "staff-1" });
    await expect(store.createCohort(A, { name: "nit 2027", plusDays: 30, createdBy: "staff-1" })).rejects.toBeInstanceOf(CohortNameTaken);
    expect(await store.createCohort(B, { name: "NIT 2027", plusDays: 30, createdBy: "staff-2" })).toMatchObject({ name: "NIT 2027" });
    expect(await store.addMembers(A, cohort.id, ["a@x.in", "b@x.in"])).toEqual(["a@x.in", "b@x.in"]);
    expect(await store.addMembers(A, cohort.id, ["b@x.in", "c@x.in"])).toEqual(["c@x.in"]);
    await expect(store.addMembers(A, cohort.id, ["Upper@x.in"])).rejects.toThrow();
    expect((await store.owed(A, "B@X.IN")).map((c) => c.id)).toEqual([cohort.id]);
    expect(await store.cohorts(B)).toHaveLength(1);
    expect(await store.members(B)).toEqual([]);

    const learner = await practice.createLearner({ orgId: A, email: "b@x.in", name: "B", passwordHash: "h" });
    await store.markGranted(A, cohort.id, "b@x.in", learner.id, new Date("2027-01-01T00:00:00Z"));
    expect(await store.owed(A, "b@x.in")).toEqual([]);
    const students = await store.students(A, cohort.id);
    expect(students.find((s) => s.email === "b@x.in")).toMatchObject({ learnerId: learner.id, name: "B", verified: false, plusUntil: "2027-01-01T00:00:00.000Z", solved: 0 });
    expect(students.find((s) => s.email === "a@x.in")).toMatchObject({ learnerId: null, name: null });
    expect(await store.accounts(A, ["b@x.in", "a@x.in"])).toEqual([{ id: learner.id, email: "b@x.in", verified: false }]);
  });

  it("are not a learner's to read or write", async () => {
    const cohort = await store.createCohort(A, { name: "Batch", plusDays: 30, createdBy: "staff-1" });
    await store.addMembers(A, cohort.id, ["a@x.in"]);
    const asLearner = { "parikshaa.org_id": A, "parikshaa.actor": "learner", "parikshaa.attempt_id": "", "parikshaa.learner_id": "l1" };
    expect(await sql.transaction((tx) => tx.query(`SELECT * FROM prep_cohort_members`), asLearner)).toEqual([]);
    expect(await sql.transaction((tx) => tx.query(`SELECT * FROM prep_cohorts`), asLearner)).toEqual([]);
    await expect(
      sql.transaction((tx) => tx.query(`INSERT INTO prep_cohort_members (org_id, cohort_id, email) VALUES ($1, $2, 'me@x.in')`, [A, cohort.id]), asLearner),
    ).rejects.toThrow(/row-level security/);
  });
});
