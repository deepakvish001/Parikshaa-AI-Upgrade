import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { HireStore, PublicCodeTaken, type JobFields, type RoundFields } from "./hire-store.js";
import { migrate } from "./migrate.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** A company's jobs and their rounds (docs/HIRE-V2.md §1; H2a). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
const T0 = new Date("2026-10-12T10:00:00Z");

let db: PGlite;
let sql: SqlExecutor;
let store: HireStore;
let ids = 0;

const FIELDS: JobFields = {
  title: "Backend engineer",
  roleId: null,
  department: "Platform",
  location: "Pune",
  workMode: "hybrid",
  employment: "full_time",
  expMin: 2,
  expMax: 5,
  ctcMinLpa: 12,
  ctcMaxLpa: 20.5,
  showCtc: true,
  openings: 2,
  skillsMust: ["Go", "SQL"],
  skillsNice: ["Kubernetes"],
  description: "Build the payments API.",
  questions: [{ id: "q1", text: "Can you join within 30 days?", kind: "yes_no", required: true, knockout: { equals: "yes" } }],
  noteToCandidates: "",
  contactEmail: null,
  applyBy: "2026-11-30",
  autoScreen: false,
  screenThreshold: 60,
  screenDailyMax: 200,
  maxApplicants: null,
  reapplyAfterDays: 90,
  reviewSlaDays: 2,
  managers: [],
};

const ROUNDS: readonly RoundFields[] = [
  { kind: "screen", title: "Screening", config: {} },
  { kind: "assessment", title: "Online test", config: { daysToComplete: 3 } },
  { kind: "interview", title: "Technical interview", config: { minutes: 45 } },
  { kind: "offer", title: "Offer", config: {} },
];

const make = (org = A, id = "job-1") => store.createJob(org, { id, fields: FIELDS, rounds: ROUNDS, createdBy: "u-owner", now: T0 });

/** An application, written as the service will in H2b, for the counts. */
async function apply(org: string, jobId: string, n: number, status: string, roundId: string | null, at = T0) {
  await sql.transaction(
    (tx) =>
      tx.query(
        `INSERT INTO hire_applications (org_id, id, job_id, ref, name, email, email_hash, email_canonical_hash, source, status, round_id, created_at)
         VALUES ($1, $2, $3, $4, 'X', 'sealed', $5, $5, 'link', $6, $7, $8)`,
        [org, `app-${n}`, jobId, `A${n}`, `h${n}`, status, roundId, at],
      ),
    { "parikshaa.org_id": org, "parikshaa.actor": "staff" },
  );
}

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await db.exec(`SET ROLE parikshaa_app`);
  ids = 0;
  store = new HireStore(sql, { newId: () => `r-${++ids}` });
});

afterEach(async () => {
  await db.close();
});

describe("jobs", () => {
  it("keep what the company wrote, and their rounds in order", async () => {
    const job = await make();
    expect(job).toMatchObject({ ...FIELDS, id: "job-1", status: "draft", publicCode: null, createdBy: "u-owner", createdAt: T0.toISOString() });
    expect(job.rounds.map((r) => [r.position, r.kind, r.title])).toEqual([
      [0, "screen", "Screening"],
      [1, "assessment", "Online test"],
      [2, "interview", "Technical interview"],
      [3, "offer", "Offer"],
    ]);
    expect(job.rounds[1]!.config).toEqual({ daysToComplete: 3 });
  });

  it("belong to their organisation alone", async () => {
    await make(A, "job-a");
    await make(B, "job-b");
    expect(await store.job(B, "job-a")).toBeNull();
    expect((await store.jobs(A, T0)).map((j) => j.id)).toEqual(["job-a"]);
    expect(await store.updateJob(B, "job-a", { ...FIELDS, title: "Taken over" }, ROUNDS, T0)).toBeNull();
    expect(await store.setStatus(B, "job-a", { status: "closed", now: T0 })).toBeNull();
    expect((await store.job(A, "job-a"))?.title).toBe("Backend engineer");
    // The database refuses it even if the query forgets the organisation.
    expect(await sql.transaction((tx) => tx.query(`SELECT id FROM hire_jobs`), { "parikshaa.org_id": B, "parikshaa.actor": "staff" })).toEqual([
      { id: "job-b" },
    ]);
  });

  it("change, keeping the rounds given by id and reordering them", async () => {
    const job = await make();
    const [screen, test, interview, offer] = job.rounds;
    const changed = await store.updateJob(
      A,
      job.id,
      { ...FIELDS, title: "Senior backend engineer", openings: 1 },
      [screen!, interview!, { ...test!, title: "Coding test" }, { kind: "review", title: "Hiring manager review", config: {} }, offer!],
      new Date(T0.getTime() + 60_000),
    );
    expect(changed?.title).toBe("Senior backend engineer");
    expect(changed?.rounds.map((r) => [r.id, r.title])).toEqual([
      [screen!.id, "Screening"],
      [interview!.id, "Technical interview"],
      [test!.id, "Coding test"],
      ["r-5", "Hiring manager review"],
      [offer!.id, "Offer"],
    ]);
    expect(changed?.updatedAt).not.toBe(changed?.createdAt);
  });

  it("are published once with an address they keep, paused, and closed", async () => {
    await make();
    const open = await store.setStatus(A, "job-1", { status: "open", now: T0, publicCode: "BE7Q2K" });
    expect(open).toMatchObject({ status: "open", publicCode: "BE7Q2K", publishedAt: T0.toISOString(), closedAt: null });
    const later = new Date(T0.getTime() + 3_600_000);
    expect(await store.setStatus(A, "job-1", { status: "paused", now: later, publicCode: "OTHER1" })).toMatchObject({ status: "paused", publicCode: "BE7Q2K" });
    expect(await store.setStatus(A, "job-1", { status: "open", now: later })).toMatchObject({ publishedAt: T0.toISOString() });
    expect(await store.setStatus(A, "job-1", { status: "closed", now: later })).toMatchObject({ status: "closed", closedAt: later.toISOString() });
    expect(await store.openJobs(A)).toBe(0);
  });

  it("never share an address within a company", async () => {
    await make(A, "job-1");
    await make(A, "job-2");
    await make(B, "job-3");
    await store.setStatus(A, "job-1", { status: "open", now: T0, publicCode: "SAME01" });
    await expect(store.setStatus(A, "job-2", { status: "open", now: T0, publicCode: "SAME01" })).rejects.toThrow(PublicCodeTaken);
    // Another company may use the same code: the address carries the company's own.
    expect((await store.setStatus(B, "job-3", { status: "open", now: T0, publicCode: "SAME01" }))?.publicCode).toBe("SAME01");
    expect(await store.openJobs(A)).toBe(1);
  });

  it("are held, with the reason, for Parikshaa to look at (S18)", async () => {
    await make();
    expect(await store.setStatus(A, "job-1", { status: "held", now: T0, heldReason: "Asks applicants to pay a deposit" })).toMatchObject({
      status: "held",
      heldReason: "Asks applicants to pay a deposit",
      publicCode: null,
    });
  });

  it("are listed with where their applicants stand", async () => {
    const job = await make();
    const [screen, test] = job.rounds;
    await apply(A, job.id, 1, "active", screen!.id);
    await apply(A, job.id, 2, "active", test!.id);
    await apply(A, job.id, 3, "active", test!.id, new Date(T0.getTime() - 2 * 86_400_000));
    await apply(A, job.id, 4, "rejected", screen!.id);
    await apply(A, job.id, 5, "hired", null);
    await apply(A, job.id, 6, "invited", null);
    const [row] = await store.jobs(A, T0);
    expect(row).toMatchObject({ id: job.id, applicants: 5, active: 3, hired: 1, newToday: 4, byRound: { [screen!.id]: 1, [test!.id]: 2 } });
    expect(await store.roundsInUse(A, job.id)).toEqual(new Set([screen!.id, test!.id]));
  });

  it("are deleted only as drafts nobody applied to", async () => {
    await make(A, "job-1");
    await make(A, "job-2");
    await apply(A, "job-2", 1, "active", null);
    expect(await store.deleteDraft(A, "job-2")).toBe(false);
    expect(await store.deleteDraft(B, "job-1")).toBe(false);
    expect(await store.deleteDraft(A, "job-1")).toBe(true);
    expect(await store.job(A, "job-1")).toBeNull();
  });
});

describe("the database itself", () => {
  it("refuses a round of a kind it does not know, and a job without a title", async () => {
    await expect(store.createJob(A, { id: "x", fields: FIELDS, rounds: [{ kind: "lottery" as "screen", title: "?", config: {} }], createdBy: null, now: T0 })).rejects.toThrow();
    await expect(store.createJob(A, { id: "y", fields: { ...FIELDS, title: "" }, rounds: [], createdBy: null, now: T0 })).rejects.toThrow();
  });

  it("keeps a candidate's view to their own applications and the events meant for them (S4)", async () => {
    await sql.exec(`RESET ROLE`);
    await sql.query(`INSERT INTO candidate_accounts (id, email) VALUES ('c1', 'asha@example.com'), ('c2', 'ravi@example.com')`);
    await sql.exec(`SET ROLE parikshaa_app`);
    const job = await make();
    await sql.transaction(
      async (tx) => {
        await tx.query(
          `INSERT INTO hire_applications (org_id, id, job_id, candidate_id, ref, name, email, email_hash, email_canonical_hash, source, status)
           VALUES ($1, 'a1', $2, 'c1', 'A1', 'Asha', 's', 'h1', 'h1', 'link', 'active'), ($1, 'a2', $2, 'c2', 'A2', 'Ravi', 's', 'h2', 'h2', 'link', 'active')`,
          [A, job.id],
        );
        await tx.query(
          `INSERT INTO hire_events (org_id, id, application_id, candidate_id, kind, by, candidate_visible)
           VALUES ($1, 'e1', 'a1', 'c1', 'applied', 'Asha', true), ($1, 'e2', 'a1', 'c1', 'note', 'Recruiter', false), ($1, 'e3', 'a2', 'c2', 'applied', 'Ravi', true)`,
          [A],
        );
      },
      { "parikshaa.org_id": A, "parikshaa.actor": "staff" },
    );
    // A note is never shown to the candidate.
    await expect(
      sql.transaction(
        (tx) => tx.query(`INSERT INTO hire_events (org_id, id, application_id, kind, by, candidate_visible) VALUES ($1, 'e4', 'a1', 'note', 'X', true)`, [A]),
        { "parikshaa.org_id": A, "parikshaa.actor": "staff" },
      ),
    ).rejects.toThrow("hire_events_private_kinds");
    const as = (candidate: string) => ({ "parikshaa.org_id": A, "parikshaa.actor": "applicant", "parikshaa.candidate_id": candidate });
    expect(await sql.transaction((tx) => tx.query(`SELECT id FROM hire_applications`), as("c1"))).toEqual([{ id: "a1" }]);
    expect(await sql.transaction((tx) => tx.query(`SELECT id FROM hire_events`), as("c1"))).toEqual([{ id: "e1" }]);
    for (const table of ["hire_jobs", "hire_rounds", "hire_round_results", "hire_screenings", "hire_integrity"]) {
      expect(await sql.transaction((tx) => tx.query(`SELECT * FROM ${table}`), as("c1")), table).toEqual([]);
    }
    await expect(sql.transaction((tx) => tx.query(`UPDATE hire_applications SET status = 'hired' WHERE id = 'a1' RETURNING id`), as("c1"))).resolves.toEqual([]);
    // The timeline cannot be rewritten, even by staff.
    await expect(
      sql.transaction((tx) => tx.query(`UPDATE hire_events SET detail = '{}' WHERE id = 'e1'`), { "parikshaa.org_id": A, "parikshaa.actor": "staff" }),
    ).rejects.toThrow();
  });
});
