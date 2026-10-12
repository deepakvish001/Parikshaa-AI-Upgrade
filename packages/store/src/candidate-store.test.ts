import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { examId, orgId } from "@parikshaa/core";
import { CandidateStore, MAX_CODE_ATTEMPTS, hireApplicant, hireScoped } from "./candidate-store.js";
import { LedgerStore, staffScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { DataKeys } from "./sealing.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Candidate accounts for Hire (docs/HIRE-V2.md §1, §10 S2, S5, S19; H1a). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
const T0 = new Date("2026-10-12T10:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(T0.getTime() + ms);

let db: PGlite;
let sql: SqlExecutor;
let store: CandidateStore;
let ids = 0;

const code = (over: Partial<Parameters<CandidateStore["issueCode"]>[0]> = {}) => ({
  id: `code-${++ids}`,
  purpose: "sign_in" as const,
  emailHash: "e1",
  codeHash: "h",
  ipHash: "ip1",
  now: T0,
  expiresAt: at(10 * MIN),
  ...over,
});

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await new LedgerStore(sql).createExam(staffScope(A), {
    id: examId("a-exam"),
    title: "A's",
    questions: [],
    policy: { durationMs: 1, allowRevision: true, vivaTriggerRatio: 0.5 },
  });
  await db.exec(`SET ROLE parikshaa_app`);
  ids = 0;
  store = new CandidateStore(sql, new DataKeys(Buffer.alloc(32, 7)).records("candidates"), { newId: () => `c-${++ids}` });
});

afterEach(async () => {
  await db.close();
});

describe("sign-in codes (S5)", () => {
  it("allow five tries, then none, and a matching code is used once", async () => {
    await store.issueCode(code({ id: "k1", codeHash: "secret" }));
    for (let i = 1; i <= MAX_CODE_ATTEMPTS; i++) {
      expect(await store.spendAttempt("e1", "sign_in", at(MIN))).toEqual({ id: "k1", codeHash: "secret", attempts: i });
    }
    expect(await store.spendAttempt("e1", "sign_in", at(MIN))).toBeNull();
    expect(await store.useCode("k1", at(MIN))).toBe(true);
    expect(await store.useCode("k1", at(MIN))).toBe(false);
  });

  it("never let tries asked for at the same time past the limit", async () => {
    await store.issueCode(code({ id: "k1" }));
    const spent = await Promise.all(Array.from({ length: 9 }, () => store.spendAttempt("e1", "sign_in", at(MIN))));
    expect(spent.filter((s) => s !== null)).toHaveLength(MAX_CODE_ATTEMPTS);
  });

  it("stop working when used, when they expire, or when a newer one is sent", async () => {
    await store.issueCode(code({ id: "k1" }));
    expect(await store.spendAttempt("e1", "sign_in", at(11 * MIN))).toBeNull();
    await store.issueCode(code({ id: "k2", now: at(MIN), expiresAt: at(11 * MIN) }));
    expect((await store.spendAttempt("e1", "sign_in", at(2 * MIN)))?.id).toBe("k2");
    await store.useCode("k2", at(2 * MIN));
    expect(await store.spendAttempt("e1", "sign_in", at(3 * MIN))).toBeNull();
    // A step-up code is its own: it neither ends nor is ended by a sign-in code.
    await store.issueCode(code({ id: "k3", now: at(3 * MIN), expiresAt: at(13 * MIN) }));
    await store.issueCode(code({ id: "k4", purpose: "step_up", now: at(3 * MIN), expiresAt: at(13 * MIN) }));
    expect((await store.spendAttempt("e1", "sign_in", at(4 * MIN)))?.id).toBe("k3");
    expect((await store.spendAttempt("e1", "step_up", at(4 * MIN)))?.id).toBe("k4");
  });

  it("are counted per address, per network address and in all, for the limits", async () => {
    await store.issueCode(code({ now: at(-2 * DAY) }));
    await store.issueCode(code({ now: at(-5 * HOUR) }));
    await store.issueCode(code({ now: at(-30 * MIN), ipHash: "ip2" }));
    await store.issueCode(code({ now: at(-10 * MIN) }));
    await store.issueCode(code({ emailHash: "e2", now: at(-5 * MIN) }));
    // One that ran out of tries unused.
    const burnt = code({ id: "burnt", emailHash: "e1", now: at(-4 * MIN), expiresAt: at(6 * MIN) });
    await store.issueCode(burnt);
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) await store.spendAttempt("e1", "sign_in", at(-3 * MIN));
    expect(await store.codeCounts("e1", "ip1", T0)).toEqual({ emailHour: 3, emailDay: 4, failedDay: 1, ipHour: 3, allHour: 4 });
  });
});

describe("accounts", () => {
  it("are made when a code is first entered, and found again after", async () => {
    const made = await store.signIn("asha@example.com", T0);
    expect(made).toMatchObject({ id: "c-1", email: "asha@example.com", name: null });
    expect((await store.signIn("asha@example.com", at(DAY))).id).toBe("c-1");
    expect((await store.accountByEmail("asha@example.com"))?.lastSeenAt).toBe(at(DAY).toISOString());
  });

  it("hold addresses only trimmed and in lower case", async () => {
    await expect(store.signIn("Asha@Example.com", T0)).rejects.toThrow();
    await expect(store.signIn(" asha@example.com", T0)).rejects.toThrow();
  });

  it("keep the profile sealed, bound to the account", async () => {
    const { id } = await store.signIn("asha@example.com", T0);
    const details = { headline: "Backend engineer", skills: ["Go", "SQL"], noticeDays: 30 };
    expect(await store.saveProfile(id, { name: "Asha Rao", phone: "+919876543210", details })).toBe(true);
    expect(await store.profile(id)).toEqual({ name: "Asha Rao", phone: "+919876543210", details, resume: null });
    const raw = (await sql.query<{ phone: string; profile: string }>(`SELECT phone, profile FROM candidate_accounts WHERE id = $1`, [id]))[0]!;
    expect(raw.phone).not.toContain("9876543210");
    expect(raw.profile).not.toContain("Backend");
    // Moved to another account, a sealed value does not open.
    const other = await store.signIn("ravi@example.com", T0);
    await sql.query(`UPDATE candidate_accounts SET phone = $1 WHERE id = $2`, [raw.phone, other.id]);
    await expect(store.profile(other.id)).rejects.toThrow();
  });

  it("when erased keep only their id, end every session, and free the address", async () => {
    const { id } = await store.signIn("asha@example.com", T0);
    await store.saveProfile(id, { name: "Asha Rao", phone: "+919876543210", details: { headline: "x" } });
    await store.createSession({ tokenHash: "t1", candidateId: id, kept: true, now: T0, expiresAt: at(14 * DAY) });
    await store.issueCode(code({ emailHash: "asha-hash" }));
    expect(await store.erase(id, "asha-hash", at(HOUR))).toBe(true);
    expect(await store.erase(id, "asha-hash", at(HOUR))).toBe(false);
    expect(await store.session("t1", at(2 * HOUR))).toBeNull();
    expect(await store.account(id)).toBeNull();
    expect(await store.profile(id)).toBeNull();
    const row = (await sql.query<Record<string, unknown>>(`SELECT email, name, phone, profile, erased_at FROM candidate_accounts WHERE id = $1`, [id]))[0]!;
    expect(row).toMatchObject({ email: "", name: null, phone: null, profile: null });
    expect(await store.spendAttempt("asha-hash", "sign_in", at(2 * MIN))).toBeNull();
    // The address may make a new account.
    expect((await store.signIn("asha@example.com", at(DAY))).id).not.toBe(id);
  });
});

describe("sessions (S19)", () => {
  it("end when they expire, when signed out, or everywhere at once", async () => {
    const { id } = await store.signIn("asha@example.com", T0);
    await store.createSession({ tokenHash: "t1", candidateId: id, kept: false, now: T0, expiresAt: at(12 * HOUR) });
    await store.createSession({ tokenHash: "t2", candidateId: id, kept: true, now: T0, expiresAt: at(14 * DAY) });
    await store.createSession({ tokenHash: "t3", candidateId: id, kept: true, now: T0, expiresAt: at(14 * DAY) });
    expect((await store.session("t1", at(HOUR)))?.account.id).toBe(id);
    expect(await store.session("t1", at(13 * HOUR))).toBeNull();
    await store.revokeSession("t2", at(HOUR));
    expect(await store.session("t2", at(2 * HOUR))).toBeNull();
    expect(await store.sessions(id, at(2 * HOUR))).toHaveLength(2);
    expect(await store.revokeAll(id, at(2 * HOUR))).toBe(2);
    expect(await store.session("t3", at(3 * HOUR))).toBeNull();
  });

  it("kept ones run on as they are used, and use clears a warning about disuse", async () => {
    const { id } = await store.signIn("asha@example.com", T0);
    await store.createSession({ tokenHash: "t1", candidateId: id, kept: true, now: T0, expiresAt: at(14 * DAY) });
    await store.createSession({ tokenHash: "t2", candidateId: id, kept: false, now: T0, expiresAt: at(12 * HOUR) });
    await store.markWarned(id, at(DAY));
    await store.touch("t1", id, at(10 * DAY), at(24 * DAY));
    await store.touch("t2", id, at(10 * DAY), at(24 * DAY));
    expect((await store.session("t1", at(20 * DAY)))?.expiresAt).toBe(at(24 * DAY).toISOString());
    expect(await store.session("t2", at(HOUR + 12 * HOUR))).toBeNull();
    expect(await store.warnedUnused(at(400 * DAY), 10)).toEqual([]);
  });
});

describe("links across organisations (S2)", () => {
  it("are read and added only by their own candidate", async () => {
    const asha = await store.signIn("asha@example.com", T0);
    const ravi = await store.signIn("ravi@example.com", T0);
    await store.link(asha.id, A, "app-1", T0);
    await store.link(asha.id, B, "app-2", at(MIN));
    await store.link(ravi.id, A, "app-3", T0);
    expect((await store.links(asha.id)).map((l) => l.applicationId)).toEqual(["app-2", "app-1"]);
    await expect(
      hireScoped(sql, hireApplicant(ravi.id), (tx) =>
        tx.query(`INSERT INTO candidate_links (candidate_id, org_id, application_id) VALUES ($1, $2, 'app-9')`, [asha.id, A]),
      ),
    ).rejects.toThrow();
    expect(await hireScoped(sql, hireApplicant(ravi.id), (tx) => tx.query(`SELECT * FROM candidate_links WHERE candidate_id = $1`, [asha.id]))).toEqual([]);
  });

  it("are not read by staff, who may only remove their own organisation's", async () => {
    const asha = await store.signIn("asha@example.com", T0);
    await store.link(asha.id, A, "app-1", T0);
    await store.link(asha.id, B, "app-2", T0);
    expect(await sql.transaction((tx) => tx.query(`SELECT * FROM candidate_links`), { "parikshaa.org_id": A, "parikshaa.actor": "staff" })).toEqual([]);
    expect(await store.unlink(A, "app-2")).toBe(0);
    expect(await store.unlink(A, "app-1")).toBe(1);
    expect((await store.links(asha.id)).map((l) => l.applicationId)).toEqual(["app-2"]);
    await expect(
      sql.transaction((tx) => tx.query(`SELECT candidate_unlink($1, 'app-2')`, [B]), { "parikshaa.org_id": A, "parikshaa.actor": "staff" }),
    ).rejects.toThrow("only staff of");
  });

  it("an applicant's scope reads nothing of an organisation's own tables, and writes none", async () => {
    const asha = await store.signIn("asha@example.com", T0);
    // Something in each of the tables whose policies let any actor in.
    await sql.transaction(
      async (tx) => {
        await tx.query(`INSERT INTO audit_log (id, org_id, actor_kind, action) VALUES ('l1', $1, 'system', 'test')`, [A]);
      },
      { "parikshaa.org_id": A, "parikshaa.actor": "staff" },
    );
    const tables = ["attempts", "audit_log", "exam_lab", "exam_ledger", "exam_windows", "exams", "model_usage", "recheck_requests", "result_releases"];
    const staffSees = await sql.transaction((tx) => tx.query<{ n: number }>(`SELECT (SELECT count(*) FROM exams)::int + (SELECT count(*) FROM audit_log)::int AS n`), {
      "parikshaa.org_id": A,
      "parikshaa.actor": "staff",
    });
    expect(staffSees[0]!.n).toBe(2);
    for (const scope of [hireApplicant(asha.id), hireApplicant(asha.id, A)]) {
      for (const table of tables) expect(await hireScoped(sql, scope, (tx) => tx.query(`SELECT * FROM ${table}`)), table).toEqual([]);
    }
    await expect(
      hireScoped(sql, hireApplicant(asha.id, A), (tx) =>
        tx.query(`INSERT INTO audit_log (id, org_id, actor_kind, action) VALUES ('l2', $1, 'system', 'forged')`, [A]),
      ),
    ).rejects.toThrow();
  });
});

describe("retention (F4, F22)", () => {
  it("deletes codes after a day and sessions a week after they end", async () => {
    const { id } = await store.signIn("asha@example.com", T0);
    await store.issueCode(code({ now: at(-25 * HOUR) }));
    await store.issueCode(code({ now: at(-HOUR) }));
    await store.createSession({ tokenHash: "old", candidateId: id, kept: false, now: at(-9 * DAY), expiresAt: at(-8 * DAY) });
    await store.createSession({ tokenHash: "recent", candidateId: id, kept: false, now: at(-2 * DAY), expiresAt: at(-DAY) });
    expect(await store.sweep(T0)).toEqual({ codes: 1, sessions: 1 });
    expect((await store.codeCounts("e1", "ip1", T0)).emailDay).toBe(1);
  });

  it("finds unused accounts to warn, and warned ones still unused to erase", async () => {
    const old = await store.signIn("old@example.com", at(-1200 * DAY));
    const back = await store.signIn("back@example.com", at(-1200 * DAY));
    await store.signIn("new@example.com", at(-DAY));
    expect((await store.unused(at(-1095 * DAY), 10)).map((a) => a.email)).toEqual(["old@example.com", "back@example.com"]);
    await store.markWarned(old.id, at(-40 * DAY));
    await store.markWarned(back.id, at(-40 * DAY));
    await store.signIn("back@example.com", at(-20 * DAY));
    expect((await store.unused(at(-1095 * DAY), 10)).map((a) => a.email)).toEqual([]);
    expect((await store.warnedUnused(at(-30 * DAY), 10)).map((a) => a.id)).toEqual([old.id]);
  });
});
