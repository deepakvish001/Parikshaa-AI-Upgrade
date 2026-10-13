import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { MemoryBlobs } from "./blobs.js";
import { HireApplicationStore, type NewApplication } from "./hire-application-store.js";
import { HireStore, type JobFields } from "./hire-store.js";
import { migrate } from "./migrate.js";
import { DataKeys } from "./sealing.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** Applications to a job (docs/HIRE-V2.md §1, §10 S2–S4, S17; H2b). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
const T0 = new Date("2026-10-12T10:00:00Z");
const DAY = 86_400_000;
const SEAL = new DataKeys(Buffer.alloc(32, 7)).records("hire");

let db: PGlite;
let sql: SqlExecutor;
let jobs: HireStore;
let store: HireApplicationStore;
let ids = 0;

const FIELDS: JobFields = {
  title: "Backend engineer",
  roleId: null,
  department: "",
  location: "Pune",
  workMode: "hybrid",
  employment: "full_time",
  expMin: 2,
  expMax: 5,
  ctcMinLpa: null,
  ctcMaxLpa: null,
  showCtc: false,
  openings: 1,
  skillsMust: ["Go"],
  skillsNice: [],
  description: "Build the payments API.",
  questions: [],
  noteToCandidates: "",
  contactEmail: null,
  applyBy: null,
  autoScreen: false,
  screenThreshold: 60,
  screenDailyMax: 200,
  maxApplicants: null,
  reapplyAfterDays: 90,
  reviewSlaDays: 2,
  managers: [],
};

const RULES = { maxApplicants: null, reapplyAfterDays: 90 };

async function openJob(org = A, id = "job-1") {
  const job = await jobs.createJob(org, {
    id,
    fields: FIELDS,
    rounds: [
      { kind: "screen", title: "Screening", config: {} },
      { kind: "interview", title: "Interview", config: {} },
    ],
    createdBy: null,
    now: T0,
  });
  await jobs.setStatus(org, id, { status: "open", now: T0, publicCode: `CODE-${id}` });
  return job;
}

function application(candidate: string, over: Partial<NewApplication> = {}): NewApplication {
  const id = `app-${++ids}`;
  return {
    id,
    jobId: "job-1",
    candidateId: candidate,
    ref: `A${candidate.toUpperCase()}`,
    snapshot: {
      name: candidate === "c1" ? "Asha Rao" : "Ravi Kumar",
      email: `${candidate}@example.com`,
      phone: "+919876543210",
      profile: { headline: "Go developer", experienceYears: 3 },
      answers: { q1: "yes" },
      resume: { text: "Go, SQL, Kafka", file: new Uint8Array([37, 80, 68, 70]), name: "asha.pdf", type: "pdf" },
    },
    hashes: { email: `e-${candidate}`, emailCanonical: `ec-${candidate}`, phone: `p-${candidate}`, resume: `r-${candidate}` },
    source: "link",
    sourceTag: "linkedin",
    referrer: null,
    consent: { version: "hire-1", noticeHash: "n1" },
    aiOptOut: false,
    deviceReady: true,
    knockedOut: [],
    now: T0,
    outbox: [{ kind: "hire", subject: { applicationId: id }, purpose: "mail_applied", id: `${id}:applied` }],
    ...over,
  };
}

const as = (candidate: string) => ({ "parikshaa.org_id": A, "parikshaa.actor": "applicant", "parikshaa.candidate_id": candidate });
const staff = { "parikshaa.org_id": A, "parikshaa.actor": "staff" };

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await sql.query(`INSERT INTO candidate_accounts (id, email) VALUES ('c1', 'c1@example.com'), ('c2', 'c2@example.com')`);
  await db.exec(`SET ROLE parikshaa_app`);
  ids = 0;
  jobs = new HireStore(sql, { newId: () => `r-${++ids}` });
  store = new HireApplicationStore(sql, SEAL, { newId: () => `x-${++ids}` });
});

afterEach(async () => {
  await db.close();
});

describe("applying", () => {
  it("keeps what the candidate gave, sealed, with the first round waiting and the mail written alongside", async () => {
    const job = await openJob();
    const made = await store.apply(A, application("c1"), RULES);
    expect(made).toMatchObject({ outcome: "created", status: "active" });
    const id = (made as { id: string }).id;

    const snapshot = await store.snapshot(A, id);
    expect(snapshot).toMatchObject({
      name: "Asha Rao",
      email: "c1@example.com",
      phone: "+919876543210",
      profile: { headline: "Go developer", experienceYears: 3 },
      answers: { q1: "yes" },
      ref: "AC1",
      hashes: { email: "e-c1", emailCanonical: "ec-c1", phone: "p-c1", resume: "r-c1" },
    });
    expect(Buffer.from(snapshot!.resume!.file)).toEqual(Buffer.from([37, 80, 68, 70]));
    expect(snapshot!.resume!.text).toBe("Go, SQL, Kafka");

    // A copy of the table reads as nothing: the values are sealed.
    const [raw] = await sql.transaction((tx) => tx.query<Record<string, unknown>>(`SELECT * FROM hire_applications WHERE id = $1`, [id]), staff);
    expect(JSON.stringify(raw)).not.toMatch(/c1@example\.com|9876543210|Go developer|Kafka/);
    expect(raw).toMatchObject({ round_id: job.rounds[0]!.id, consent_version: "hire-1", notice_hash: "n1", source_tag: "linkedin", device_ready: true });
    expect(new Date(raw!["round_since"] as string).toISOString()).toBe(T0.toISOString());

    const results = await sql.transaction((tx) => tx.query(`SELECT round_id, status FROM hire_round_results`), staff);
    expect(results).toEqual([{ round_id: job.rounds[0]!.id, status: "pending" }]);
    const outbox = await sql.transaction((tx) => tx.query(`SELECT id, kind, purpose FROM outbox`), staff);
    expect(outbox).toEqual([{ id: `${id}:applied`, kind: "hire", purpose: "mail_applied" }]);
  });

  it("refuses a second live application by the same person, and any to a job not open or full", async () => {
    await openJob();
    const first = (await store.apply(A, application("c1"), RULES)) as { id: string };
    expect(await store.apply(A, application("c1"), RULES)).toEqual({ outcome: "duplicate", id: first.id, candidateId: "c1" });
    expect(await store.apply(A, application("c2"), { ...RULES, maxApplicants: 1 })).toEqual({ outcome: "full" });
    await jobs.setStatus(A, "job-1", { status: "paused", now: T0 });
    expect(await store.apply(A, application("c2"), RULES)).toEqual({ outcome: "closed" });
    expect(await store.apply(A, application("c2", { jobId: "no-such-job" }), RULES)).toEqual({ outcome: "closed" });
    // Nothing of the refused ones was kept.
    expect(await store.taken(A, "job-1")).toBe(1);
    expect(await sql.transaction((tx) => tx.query(`SELECT count(*)::int AS n FROM outbox`), staff)).toEqual([{ n: 1 }]);
  });

  it("ends an application on a knockout answer, telling the candidate, and makes them wait to apply again", async () => {
    await openJob();
    const made = await store.apply(A, application("c1", { knockedOut: ["q1"] }), RULES);
    expect(made).toMatchObject({ outcome: "created", status: "rejected" });
    const id = (made as { id: string }).id;
    const [row] = await sql.transaction((tx) => tx.query(`SELECT status, status_reason, reject_reason, decided_at FROM hire_applications WHERE id = $1`, [id]), staff);
    expect(row).toMatchObject({ status: "rejected", status_reason: "knockout", reject_reason: "other" });
    expect(await sql.transaction((tx) => tx.query(`SELECT kind, detail FROM hire_events ORDER BY kind`), as("c1"))).toEqual([
      { kind: "applied", detail: {} },
      { kind: "rejected", detail: { reason: "knockout", questions: ["q1"] } },
    ]);

    const later = new Date(T0.getTime() + 10 * DAY);
    expect(await store.apply(A, application("c1", { now: later }), RULES)).toEqual({
      outcome: "too_soon",
      from: new Date(T0.getTime() + 90 * DAY).toISOString(),
    });
    expect(await store.apply(A, application("c1", { now: new Date(T0.getTime() + 91 * DAY) }), RULES)).toMatchObject({ outcome: "created", status: "active" });
  });

  it("lets a person who withdrew apply again at once", async () => {
    await openJob();
    const first = (await store.apply(A, application("c1"), RULES)) as { id: string };
    expect(await store.withdraw(A, "c1", first.id, T0, [])).toBe(true);
    expect(await store.apply(A, application("c1"), RULES)).toMatchObject({ outcome: "created" });
  });

  it("keeps the resume file in object storage when there is one, and drops it when the application is refused", async () => {
    const blobs = new MemoryBlobs();
    store = new HireApplicationStore(sql, SEAL, { newId: () => `x-${++ids}`, blobs });
    await openJob();
    const made = (await store.apply(A, application("c1"), RULES)) as { id: string };
    expect([...blobs.objects.keys()]).toEqual([`hire/${A}/${made.id}/resume`]);
    expect(blobs.objects.get(`hire/${A}/${made.id}/resume`)!.includes(Buffer.from([37, 80, 68, 70]))).toBe(false);
    expect(Buffer.from((await store.snapshot(A, made.id))!.resume!.file)).toEqual(Buffer.from([37, 80, 68, 70]));
    await store.apply(A, application("c1"), RULES);
    expect(blobs.objects.size).toBe(1);
  });
});

describe("the candidate's view", () => {
  it("is their own applications, where they stand in each round, and only the events meant for them (S4)", async () => {
    const job = await openJob();
    const mine = (await store.apply(A, application("c1"), RULES)) as { id: string };
    const theirs = (await store.apply(A, application("c2"), RULES)) as { id: string };
    await sql.transaction(
      (tx) => tx.query(`INSERT INTO hire_events (org_id, id, application_id, candidate_id, kind, by, candidate_visible) VALUES ($1, 'n1', $2, 'c1', 'note', 'Recruiter', false)`, [A, mine.id]),
      staff,
    );

    const view = await store.forCandidate(A, "c1", [mine.id, theirs.id]);
    expect(view).toHaveLength(1);
    expect(view[0]).toMatchObject({
      id: mine.id,
      status: "active",
      roundId: job.rounds[0]!.id,
      job: { title: "Backend engineer", publicCode: "CODE-job-1", status: "open" },
      rounds: [
        { kind: "screen", title: "Screening", status: "pending" },
        { kind: "interview", title: "Interview", status: null },
      ],
    });
    expect(view[0]!.events.map((e) => e.kind)).toEqual(["applied"]);
    expect(await store.forCandidate(B, "c1", [mine.id])).toEqual([]);
  });

  it("withdraws only the candidate's own application, once", async () => {
    await openJob();
    const mine = (await store.apply(A, application("c1"), RULES)) as { id: string };
    expect(await store.withdraw(A, "c2", mine.id, T0, [])).toBe(false);
    expect(await store.withdraw(B, "c1", mine.id, T0, [])).toBe(false);
    expect(await store.withdraw(A, "c1", mine.id, T0, [{ kind: "hire", subject: { applicationId: mine.id }, purpose: "mail_withdrawn" }])).toBe(true);
    expect(await store.withdraw(A, "c1", mine.id, T0, [])).toBe(false);
    expect((await store.forCandidate(A, "c1", [mine.id]))[0]).toMatchObject({ status: "withdrawn", decidedAt: T0.toISOString() });
    expect((await store.forCandidate(A, "c1", [mine.id]))[0]!.events.map((e) => e.kind)).toEqual(["applied", "withdrawn"]);
  });

  it("cannot be changed from the candidate's own scope", async () => {
    await openJob();
    const mine = (await store.apply(A, application("c1"), RULES)) as { id: string };
    expect(await sql.transaction((tx) => tx.query(`UPDATE hire_applications SET status = 'hired' WHERE id = $1 RETURNING id`, [mine.id]), as("c1"))).toEqual([]);
    await expect(
      sql.transaction((tx) => tx.query(`INSERT INTO hire_events (org_id, id, application_id, candidate_id, kind, by, candidate_visible) VALUES ($1, 'e9', $2, 'c1', 'hired', 'c1', true)`, [A, mine.id]), as("c1")),
    ).rejects.toThrow();
  });
});

describe("mail", () => {
  it("reads what a message needs, in the organisation only", async () => {
    await openJob();
    const made = (await store.apply(A, application("c1"), RULES)) as { id: string };
    expect(await store.mailFacts(A, made.id)).toEqual({
      id: made.id,
      name: "Asha Rao",
      email: "c1@example.com",
      status: "active",
      statusReason: null,
      job: { title: "Backend engineer", publicCode: "CODE-job-1", contactEmail: null },
    });
    expect(await store.mailFacts(B, made.id)).toBeNull();
  });
});

describe("public pages", () => {
  it("show a published job by its address, never a draft, and list the open ones", async () => {
    await openJob(A, "job-1");
    await jobs.createJob(A, { id: "job-2", fields: { ...FIELDS, title: "Draft" }, rounds: [], createdBy: null, now: T0 });
    await openJob(A, "job-3");
    await jobs.setStatus(A, "job-3", { status: "closed", now: T0 });
    expect((await jobs.publishedJob(A, "CODE-job-1"))?.id).toBe("job-1");
    expect((await jobs.publishedJob(A, "CODE-job-3"))?.status).toBe("closed");
    expect(await jobs.publishedJob(B, "CODE-job-1")).toBeNull();
    expect((await jobs.openJobList(A)).map((j) => j.id)).toEqual(["job-1"]);
  });
});
