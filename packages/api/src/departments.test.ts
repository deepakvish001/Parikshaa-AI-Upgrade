import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { OutboxLog } from "./delivery.js";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** CL4 and CL6: staff from a sheet, and departments that scope the exam list. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;

const exam = (id: string) => ({ id, title: id, questions: [{ id: "q1", kind: "mcq", stem: "?", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }], policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 } });
const call = (token: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) => app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => Date.parse("2026-10-05T05:00:00Z"), mailer: new OutboxLog() });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme University");
  await addStaff(wiring.identity, org, "registrar@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "registrar@acme.test");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("staff from a sheet", () => {
  const SHEET = "Email,Name,Role,Department\nhod.cse@acme.test,Dr Rao,author,CSE\nhod.ece@acme.test,Dr Iyer,reviewer,ECE\ninv@acme.test,Mr Das,invigilator,";

  it("checks the sheet, then adds each member with their department and sends them a link to set a password", async () => {
    const preview = (await call(owner, "POST", "/staff/import", { csv: SHEET })).json();
    expect(preview).toMatchObject({ dryRun: true, added: 3, skipped: 0, problems: [] });
    expect((await call(owner, "GET", "/staff")).json().users).toHaveLength(1);

    expect((await call(owner, "POST", "/staff/import", { csv: SHEET, dryRun: false })).json()).toMatchObject({ dryRun: false, added: 3 });
    const users = (await call(owner, "GET", "/staff")).json().users as { id: string; email: string; role: string }[];
    expect(users.map((u) => [u.email, u.role])).toEqual(expect.arrayContaining([["hod.cse@acme.test", "author"], ["inv@acme.test", "invigilator"]]));
    const depts = (await call(owner, "GET", "/departments")).json();
    expect(depts.departments).toEqual(["CSE", "ECE"]);
    // Again: everyone is already there.
    expect((await call(owner, "POST", "/staff/import", { csv: SHEET, dryRun: false })).json()).toMatchObject({ added: 0, skipped: 3 });
    expect(JSON.stringify((await call(owner, "GET", "/audit")).json())).toContain("staff.imported");
  });

  it("names each row it cannot take, and takes none", async () => {
    const bad = (await call(owner, "POST", "/staff/import", { csv: "email,name,role\nnot-an-email,X,author\nok@acme.test,Y,owner\nok2@acme.test,,author", dryRun: false })).json();
    expect(bad.problems.map((p: { row: number }) => p.row)).toEqual([2, 3, 4]);
    expect(bad.dryRun).toBe(true);
    expect((await call(owner, "GET", "/staff")).json().users).toHaveLength(1);
  });
});

describe("departments", () => {
  it("shows a department's staff only their department's exams and those with none, and an owner everything", async () => {
    await call(owner, "POST", "/staff/import", { csv: "email,name,role,department\ncse@acme.test,CSE Author,author,CSE", dryRun: false });
    const cseUser = ((await call(owner, "GET", "/staff")).json().users as { id: string; email: string }[]).find((u) => u.email === "cse@acme.test")!;
    // Their password is theirs to set: here the test sets it as an owner could.
    await db.exec("RESET ROLE");
    const { hashPassword } = await import("./staff-auth.js");
    await db.query(`UPDATE staff_users SET password_hash = $1 WHERE id = $2`, [await hashPassword("a long enough password"), cseUser.id]);
    await db.exec("SET ROLE parikshaa_app");
    const cse = await signIn(app, "cse@acme.test", "a long enough password");

    for (const id of ["dsa", "circuits", "english"]) await call(owner, "POST", "/exams", exam(id));
    await call(owner, "PUT", "/exams/dsa/department", { department: "CSE" });
    await call(owner, "PUT", "/exams/circuits/department", { department: "ECE" });

    const mine = (await call(cse, "GET", "/exams")).json().exams.map((e: { id: string; department: string | null }) => [e.id, e.department]);
    expect(mine.sort()).toEqual([
      ["dsa", "CSE"],
      ["english", null],
    ]);
    expect((await call(owner, "GET", "/exams")).json().exams).toHaveLength(3);
    // They cannot move an exam out of their department, nor reach one outside it.
    expect((await call(cse, "PUT", "/exams/english/department", { department: "ECE" })).json().message).toMatch(/only in CSE/);
    expect((await call(cse, "PUT", "/exams/circuits/department", { department: "CSE" })).statusCode).toBe(404);
    expect((await call(cse, "PUT", "/exams/english/department", { department: "CSE" })).statusCode).toBe(200);
  });
});
