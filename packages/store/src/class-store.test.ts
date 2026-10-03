import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { ClassNameTaken, ClassStore } from "./class-store.js";
import { migrate } from "./migrate.js";
import { PrepCampusStore } from "./prep-campus-store.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Classes (migration 0064). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
let db: PGlite;
let sql: SqlExecutor;
let classes: ClassStore;
let cohortA: string;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await db.exec(`SET ROLE parikshaa_app`);
  classes = new ClassStore(sql);
  const campus = new PrepCampusStore(sql);
  cohortA = (await campus.createCohort(A, { name: "CSE A", plusDays: 30, createdBy: "staff-1" })).id;
  await campus.addMembers(A, cohortA, ["a@x.in", "b@x.in"]);
});

afterEach(async () => {
  await db.close();
});

describe("classes", () => {
  it("keep their names unique within an organisation, and their attendance by session", async () => {
    const made = await classes.create(A, { name: "Java A", cohortId: cohortA, trackId: null, createdBy: "Meena" }, new Date("2026-10-05T04:00:00Z"));
    await expect(classes.create(A, { name: "java a", cohortId: cohortA, trackId: null, createdBy: "Meena" }, new Date())).rejects.toBeInstanceOf(ClassNameTaken);
    expect(await classes.list(B)).toEqual([]);
    expect(await classes.get(B, made.id)).toBeNull();

    const session = await classes.addSession(A, made.id, "2026-10-05", "Arrays");
    expect(await classes.mark(A, made.id, session.id, { "A@X.IN": true, "b@x.in": false }, "Meena", new Date())).toBe(true);
    expect(await classes.mark(A, made.id, session.id, { "b@x.in": true }, "Meena", new Date())).toBe(true);
    expect(await classes.mark(A, "other", session.id, { "b@x.in": true }, "Meena", new Date())).toBe(false);
    expect(await classes.sessions(A, made.id)).toEqual([{ id: session.id, heldOn: "2026-10-05", topic: "Arrays", marks: { "a@x.in": true, "b@x.in": true } }]);

    const progress = await classes.progress(A, made);
    expect(progress).toEqual({
      lessons: 0,
      problems: 0,
      students: [
        { email: "a@x.in", learnerId: null, name: null, lessonsDone: 0, problemsSolved: 0, contests: {}, lastActiveAt: null },
        { email: "b@x.in", learnerId: null, name: null, lessonsDone: 0, problemsSolved: 0, contests: {}, lastActiveAt: null },
      ],
    });
  });

  it("are not a learner's to read or write", async () => {
    const made = await classes.create(A, { name: "Java A", cohortId: cohortA, trackId: null, createdBy: "Meena" }, new Date());
    await classes.addSession(A, made.id, "2026-10-05", "");
    const asLearner = { "parikshaa.org_id": A, "parikshaa.actor": "learner", "parikshaa.attempt_id": "", "parikshaa.learner_id": "l1" };
    for (const table of ["classes", "class_tests", "class_contests", "class_sessions", "class_attendance", "class_lab_signoffs"]) {
      expect(await sql.transaction((tx) => tx.query(`SELECT * FROM ${table}`), asLearner), table).toEqual([]);
    }
    await expect(
      sql.transaction((tx) => tx.query(`INSERT INTO classes (org_id, id, name, cohort_id, created_by) VALUES ($1, 'x', 'Mine', $2, 'me')`, [A, cohortA]), asLearner),
    ).rejects.toThrow(/row-level security/);
  });
});
