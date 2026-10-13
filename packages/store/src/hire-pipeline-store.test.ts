import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import { MemoryBlobs } from "./blobs.js";
import { HireApplicationStore, type NewApplication } from "./hire-application-store.js";
import { HirePipelineStore, REJECTION_MAIL_DELAY_MS } from "./hire-pipeline-store.js";
import { HireStore, type Job, type JobFields } from "./hire-store.js";
import { migrate } from "./migrate.js";
import { DataKeys } from "./sealing.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** A job's pipeline: reading it, moving, rejecting, restoring, notes and messages (docs/HIRE-V2.md §5, §10; H2c). Runs as `parikshaa_app`. */

const A = orgId("org-a");
const B = orgId("org-b");
const T0 = new Date("2026-10-12T10:00:00Z");
const T1 = new Date("2026-10-13T10:00:00Z");
const DAY = 86_400_000;
const SEAL = new DataKeys(Buffer.alloc(32, 7)).records("hire");
const RULES = { maxApplicants: null, reapplyAfterDays: 0 };

let db: PGlite;
let sql: SqlExecutor;
let jobs: HireStore;
let applications: HireApplicationStore;
let store: HirePipelineStore;
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
  rejectionLine: "",
  contactEmail: null,
  applyBy: null,
  autoScreen: false,
  screenThreshold: 60,
  screenDailyMax: 200,
  maxApplicants: null,
  reapplyAfterDays: 0,
  reviewSlaDays: 2,
  managers: [],
};

const staff = (org: string = A) => ({ "parikshaa.org_id": org, "parikshaa.actor": "staff" });
const as = (candidate: string) => ({ "parikshaa.org_id": A, "parikshaa.actor": "applicant", "parikshaa.candidate_id": candidate });

async function openJob(org = A, id = "job-1"): Promise<Job> {
  await jobs.createJob(org, {
    id,
    fields: FIELDS,
    rounds: [
      { kind: "screen", title: "Screening", config: {} },
      { kind: "assessment", title: "Online test", config: {} },
      { kind: "interview", title: "Interview", config: { sendOnMove: true } },
      { kind: "offer", title: "Offer", config: {} },
    ],
    createdBy: null,
    now: T0,
  });
  return (await jobs.setStatus(org, id, { status: "open", now: T0, publicCode: `CODE-${id}` }))!;
}

async function apply(candidate: string, over: Partial<NewApplication> = {}, org = A): Promise<string> {
  const id = `app-${++ids}`;
  const made = await applications.apply(
    org,
    {
      id,
      jobId: "job-1",
      candidateId: candidate,
      ref: `A${candidate.toUpperCase()}`,
      snapshot: {
        name: candidate === "c1" ? "Asha Rao" : candidate === "c2" ? "Ravi Kumar" : `Person ${candidate}`,
        email: `${candidate}@example.com`,
        phone: "+919876543210",
        profile: { headline: "Go developer" },
        answers: { q1: "yes" },
        resume: { text: "Go, SQL, Kafka", file: new Uint8Array([37, 80, 68, 70]), name: "asha.pdf", type: "pdf" },
      },
      hashes: { email: `e-${candidate}`, emailCanonical: `ec-${candidate}`, phone: null, resume: null },
      source: "link",
      sourceTag: null,
      referrer: null,
      consent: { version: "hire-1", noticeHash: "n1" },
      aiOptOut: false,
      deviceReady: true,
      knockedOut: [],
      now: T0,
      outbox: [],
      ...over,
    },
    RULES,
  );
  if (made.outcome !== "created") throw new Error(made.outcome);
  return id;
}

const outbox = () => sql.transaction((tx) => tx.query<{ id: string; purpose: string; status: string; send_after: Date; subject: unknown }>(`SELECT id, purpose, status, send_after, subject FROM outbox ORDER BY id`), staff());
const events = (applicationId: string) =>
  sql.transaction((tx) => tx.query<{ kind: string; by: string; candidate_visible: boolean; detail: Record<string, unknown> }>(`SELECT kind, by, candidate_visible, detail FROM hire_events WHERE application_id = $1 ORDER BY at, kind`, [applicationId]), staff());
const results = (applicationId: string) =>
  sql.transaction((tx) => tx.query<{ round_id: string; status: string; decided_by: string | null }>(`SELECT r.round_id, r.status, r.decided_by FROM hire_round_results r JOIN hire_rounds x ON x.org_id = r.org_id AND x.id = r.round_id WHERE r.application_id = $1 ORDER BY x.position`, [applicationId]), staff());

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'A'), ($2, 'B')`, [A, B]);
  await sql.query(`INSERT INTO candidate_accounts (id, email) VALUES ('c1', 'c1@example.com'), ('c2', 'c2@example.com'), ('c3', 'c3@example.com')`);
  await db.exec(`SET ROLE parikshaa_app`);
  ids = 0;
  jobs = new HireStore(sql, { newId: () => `r-${++ids}` });
  applications = new HireApplicationStore(sql, SEAL, { newId: () => `x-${++ids}` });
  store = new HirePipelineStore(sql, SEAL, { newId: () => `e-${++ids}` });
});

afterEach(async () => {
  await db.close();
});

describe("moving", () => {
  it("moves on to the next round, marking the one left passed, and writes an event that says nothing of why or who", async () => {
    const job = await openJob();
    const [screen, test, interview] = job.rounds;
    const asha = await apply("c1");
    const out = await store.move(A, "job-1", [asha], "next", "staff-1", T1);
    expect(out).toEqual({ roundFound: true, results: [{ id: asha, outcome: "moved" }] });
    expect(await results(asha)).toEqual([
      { round_id: screen!.id, status: "passed", decided_by: "staff-1" },
      { round_id: test!.id, status: "pending", decided_by: null },
    ]);
    const moved = (await events(asha)).find((e) => e.kind === "moved");
    expect(moved).toEqual({ kind: "moved", by: "staff-1", candidate_visible: true, detail: { from: screen!.id, to: test!.id } });

    // Jumping over a round marks it skipped; a round set to tell the candidate writes the mail.
    const ravi = await apply("c2");
    expect((await store.move(A, "job-1", [ravi], interview!.id, "staff-1", T1)).results).toEqual([{ id: ravi, outcome: "moved" }]);
    expect((await results(ravi)).map((r) => r.status)).toEqual(["passed", "skipped", "pending"]);
    expect((await outbox()).map((o) => [o.purpose, o.subject])).toEqual([["mail_moved", { applicationId: ravi, roundId: interview!.id }]]);

    const row = (await store.pipeline(A, "job-1", {}, T1)).rows.find((r) => r.id === ravi)!;
    expect(row).toMatchObject({ roundId: interview!.id, roundSince: T1.toISOString(), current: { status: "pending", score: null } });
  });

  it("says why an application did not move: not going, already there, at the last round, or not in this job", async () => {
    const job = await openJob();
    const offer = job.rounds.at(-1)!;
    const [asha, ravi] = [await apply("c1"), await apply("c2")];
    await store.move(A, "job-1", [asha], offer.id, "staff-1", T1);
    await applications.withdraw(A, "c2", ravi, T1, []);
    const out = await store.move(A, "job-1", [asha, ravi, "nope"], "next", "staff-1", T1);
    expect(out.results).toEqual([
      { id: asha, outcome: "last_round" },
      { id: ravi, outcome: "not_active" },
      { id: "nope", outcome: "not_found" },
    ]);
    expect((await store.move(A, "job-1", [asha], offer.id, "staff-1", T1)).results).toEqual([{ id: asha, outcome: "same_round" }]);
    expect(await store.move(A, "job-1", [asha], "no-such-round", "staff-1", T1)).toEqual({ roundFound: false, results: [] });
  });

  it("holds back an application whose integrity is high until a person overrides it, with the reason kept privately", async () => {
    await openJob();
    const asha = await apply("c1");
    await sql.transaction((tx) => tx.query(`INSERT INTO hire_integrity (org_id, application_id, level) VALUES ($1, $2, 'high')`, [A, asha]), staff());
    expect((await store.move(A, "job-1", [asha], "next", "staff-1", T1)).results).toEqual([{ id: asha, outcome: "integrity_high" }]);
    expect((await events(asha)).map((e) => e.kind)).toEqual(["applied"]);

    const out = await store.move(A, "job-1", [asha], "next", "staff-1", T1, { overrideReason: "Spoke to them on video: same person" });
    expect(out.results).toEqual([{ id: asha, outcome: "moved", override: true }]);
    const override = (await events(asha)).find((e) => e.kind === "override")!;
    expect(override).toMatchObject({ by: "staff-1", candidate_visible: false, detail: { level: "high" } });
    expect(JSON.stringify(override)).not.toContain("same person");
    const detail = await store.application(A, asha);
    expect(detail!.events.find((e) => e.kind === "override")).toMatchObject({ text: "Spoke to them on video: same person", candidateVisible: false });

    // Found genuine by a person: no override needed.
    await sql.transaction((tx) => tx.query(`UPDATE hire_integrity SET verdict = 'genuine' WHERE application_id = $1`, [asha]), staff());
    expect((await store.move(A, "job-1", [asha], "next", "staff-1", T1)).results).toEqual([{ id: asha, outcome: "moved" }]);
    expect((await events(asha)).filter((e) => e.kind === "override")).toHaveLength(1);
  });
});

describe("rejecting and restoring", () => {
  it("rejects with a reason the candidate never sees, fails the round, and holds the mail a day", async () => {
    const job = await openJob();
    const [asha, ravi] = [await apply("c1"), await apply("c2")];
    const out = await store.reject(A, "job-1", [asha, ravi, "nope"], "experience", "staff-1", T1, { mail: true });
    expect(out).toEqual([
      { id: asha, outcome: "rejected" },
      { id: ravi, outcome: "rejected" },
      { id: "nope", outcome: "not_found" },
    ]);
    expect(await store.reject(A, "job-1", [asha], "skills", "staff-1", T1, { mail: true })).toEqual([{ id: asha, outcome: "not_active" }]);
    const detail = (await store.application(A, asha))!;
    expect(detail).toMatchObject({ status: "rejected", rejectReason: "experience", decidedAt: T1.toISOString() });
    expect(await results(asha)).toEqual([{ round_id: job.rounds[0]!.id, status: "failed", decided_by: "staff-1" }]);
    expect((await events(asha)).find((e) => e.kind === "rejected")).toEqual({ kind: "rejected", by: "staff-1", candidate_visible: true, detail: {} });
    const mails = await outbox();
    expect(mails.map((m) => [m.purpose, m.status, new Date(m.send_after).getTime(), m.subject])).toEqual([
      ["mail_rejected", "pending", T1.getTime() + REJECTION_MAIL_DELAY_MS, { applicationId: asha, decidedAt: T1.toISOString() }],
      ["mail_rejected", "pending", T1.getTime() + REJECTION_MAIL_DELAY_MS, { applicationId: ravi, decidedAt: T1.toISOString() }],
    ]);
    expect(REJECTION_MAIL_DELAY_MS).toBe(DAY);
  });

  it("restores a rejected application to its round and cancels the rejection mail still waiting", async () => {
    const job = await openJob();
    const [asha, ravi] = [await apply("c1"), await apply("c2")];
    await store.reject(A, "job-1", [asha, ravi], "skills", "staff-1", T1, { mail: true });
    const later = new Date(T1.getTime() + 3_600_000);
    expect(await store.restore(A, asha, "staff-2", later)).toBe("restored");
    expect(await store.application(A, asha)).toMatchObject({ status: "active", rejectReason: null, decidedAt: null, roundId: job.rounds[0]!.id, roundSince: later.toISOString() });
    expect(await results(asha)).toEqual([{ round_id: job.rounds[0]!.id, status: "pending", decided_by: null }]);
    expect((await events(asha)).map((e) => e.kind)).toEqual(["applied", "rejected", "restored"]);
    // Asha's mail will not go; Ravi's still will.
    expect((await outbox()).map((m) => [(m.subject as { applicationId: string }).applicationId, m.status])).toEqual([
      [asha, "skipped"],
      [ravi, "pending"],
    ]);
    expect(await store.restore(A, asha, "staff-2", later)).toBe("not_rejected");
    expect(await store.restore(B, ravi, "staff-2", later)).toBe("not_found");
  });

  it("never restores a withdrawn application, nor one whose person has applied to the job again since (B9)", async () => {
    await openJob();
    const asha = await apply("c1");
    await applications.withdraw(A, "c1", asha, T1, []);
    expect(await store.restore(A, asha, "staff-1", T1)).toBe("not_rejected");

    const ravi = await apply("c2");
    await store.reject(A, "job-1", [ravi], "skills", "staff-1", T1, { mail: false });
    const again = await apply("c2", { now: T1 });
    expect(await store.restore(A, ravi, "staff-1", T1)).toBe("newer_application");
    // Once the newer one ends, the older may come back.
    await applications.withdraw(A, "c2", again, T1, []);
    expect(await store.restore(A, ravi, "staff-1", T1)).toBe("restored");
  });
});

describe("notes and messages", () => {
  it("keeps notes for the company and messages for the candidate too, sealed, with the message mailed", async () => {
    await openJob();
    const asha = await apply("c1");
    const note = await store.note(A, asha, "Strong on Kafka; ask about on-call", "staff-1", T1);
    const message = await store.message(A, asha, "Could you share your notice period?", "staff-1", T1);
    expect(note).toEqual(expect.any(String));
    expect(message).toMatchObject({ outcome: "sent" });
    const eventId = (message as { eventId: string }).eventId;
    expect((await outbox()).map((o) => [o.purpose, o.subject])).toEqual([["mail_message", { applicationId: asha, eventId }]]);

    const raw = await sql.transaction((tx) => tx.query(`SELECT detail FROM hire_events WHERE application_id = $1`, [asha]), staff());
    expect(JSON.stringify(raw)).not.toMatch(/Kafka|notice period/);
    const timeline = (await store.application(A, asha))!.events;
    expect(timeline.map((e) => [e.kind, e.text, e.candidateVisible, e.by])).toEqual([
      ["applied", null, true, "candidate"],
      ["note", "Strong on Kafka; ask about on-call", false, "staff-1"],
      ["message", "Could you share your notice period?", true, "staff-1"],
    ]);
    expect((await applications.mailFacts(A, asha, { messageId: eventId }))?.message).toBe("Could you share your notice period?");
    expect((await applications.mailFacts(A, asha, { messageId: note! }))?.message).toBeNull();
    expect((await applications.mailFacts(B, asha, { messageId: eventId }))?.message).toBeUndefined();
    expect(await store.note(B, asha, "x", "staff-1", T1)).toBeNull();
  });

  it("lets the candidate's own scope read the messages, never a note or an override (S4)", async () => {
    await openJob();
    const asha = await apply("c1");
    await sql.transaction((tx) => tx.query(`INSERT INTO hire_integrity (org_id, application_id, level) VALUES ($1, $2, 'high')`, [A, asha]), staff());
    await store.move(A, "job-1", [asha], "next", "staff-1", T1, { overrideReason: "Checked their ID in person" });
    await store.note(A, asha, "Private note", "staff-1", T1);
    await store.message(A, asha, "Hello Asha", "staff-1", new Date(T1.getTime() + 60_000));

    const seen = await sql.transaction((tx) => tx.query<{ kind: string }>(`SELECT kind FROM hire_events WHERE application_id = $1 ORDER BY kind`, [asha]), as("c1"));
    expect(seen.map((e) => e.kind)).toEqual(["applied", "message", "moved"]);
    // The portal's read, in the candidate's scope: the message opened, nothing private.
    const [portal] = await applications.forCandidate(A, "c1", [asha]);
    expect(portal!.events.map((e) => [e.kind, e.text])).toEqual([
      ["applied", null],
      ["moved", null],
      ["message", "Hello Asha"],
    ]);
    expect(await applications.forCandidate(A, "c2", [asha])).toEqual([]);
  });

  it("does not message someone who withdrew", async () => {
    await openJob();
    const asha = await apply("c1");
    await applications.withdraw(A, "c1", asha, T1, []);
    expect(await store.message(A, asha, "Hello", "staff-1", T1)).toEqual({ outcome: "withdrawn" });
    expect(await store.message(A, "nope", "Hello", "staff-1", T1)).toEqual({ outcome: "not_found" });
  });
});

describe("reading the pipeline", () => {
  it("shows each application's rounds, screening and integrity, filters them, and counts the whole job", async () => {
    const job = await openJob();
    const [screen, test] = job.rounds;
    const [asha, ravi, third] = [await apply("c1"), await apply("c2"), await apply("c3")];
    await store.move(A, "job-1", [asha], "next", "staff-1", T1);
    await store.reject(A, "job-1", [third], "ctc", "staff-1", T1, { mail: false });
    await sql.transaction(async (tx) => {
      await tx.query(`UPDATE hire_round_results SET score = 72.5, status = 'done' WHERE application_id = $1 AND round_id = $2`, [asha, test!.id]);
      await tx.query(`INSERT INTO hire_screenings (org_id, application_id, status, score, recommendation) VALUES ($1, $2, 'done', 81, 'advance'), ($1, $3, 'done', 30, 'low_match')`, [A, asha, ravi]);
      await tx.query(`INSERT INTO hire_integrity (org_id, application_id, level) VALUES ($1, $2, 'review')`, [A, ravi]);
    }, staff());

    const all = await store.pipeline(A, "job-1", {}, T1);
    expect(all.total).toBe(3);
    expect(all.counts).toEqual({ byRound: { [screen!.id]: 1, [test!.id]: 1 }, byStatus: { active: 2, rejected: 1 }, pastSla: 0 });
    expect(all.rows.find((r) => r.id === asha)).toMatchObject({
      name: "Asha Rao",
      ref: "AC1",
      status: "active",
      current: { status: "done", score: 72.5 },
      rounds: { [screen!.id]: { status: "passed", score: null }, [test!.id]: { status: "done", score: 72.5 } },
      screening: { status: "done", score: 81, recommendation: "advance" },
      integrity: { level: "not_checked", verdict: null },
    });
    expect(all.rows.find((r) => r.id === third)).toMatchObject({ status: "rejected", rejectReason: "ctc" });
    // The table has no contact details (S22).
    expect(JSON.stringify(all)).not.toMatch(/example\.com|9876543210/);

    const ids = async (filter: Parameters<HirePipelineStore["pipeline"]>[2], now = T1) => (await store.pipeline(A, "job-1", filter, now)).rows.map((r) => r.id);
    expect(await ids({ roundId: test!.id })).toEqual([asha]);
    expect(await ids({ status: "rejected" })).toEqual([third]);
    expect(await ids({ search: "ravi" })).toEqual([ravi]);
    expect(await ids({ search: "ac1" })).toEqual([asha]);
    expect(await ids({ search: "%" })).toEqual([]);
    expect(await ids({ recommendation: "low_match" })).toEqual([ravi]);
    expect(await ids({ integrity: "review" })).toEqual([ravi]);
    expect(await ids({ integrity: "not_checked" })).toEqual([asha, third]);
    // Ravi has waited in screening since T0; Asha moved at T1. Three days on, only Ravi is past the two-day SLA.
    const later = new Date(T0.getTime() + 3 * DAY);
    expect(await ids({ pastSla: true }, later)).toEqual([ravi]);
    expect((await store.pipeline(A, "job-1", {}, later)).counts.pastSla).toBe(1);
    expect((await store.pipeline(A, "job-1", { limit: 1, offset: 1 }, T1)).rows.map((r) => r.id)).toEqual([ravi]);
  });

  it("keeps each organisation's pipeline to itself", async () => {
    await openJob(A);
    await openJob(B);
    const asha = await apply("c1");
    expect((await store.pipeline(B, "job-1", {}, T1)).rows).toEqual([]);
    expect(await store.application(B, asha)).toBeNull();
    expect(await store.jobOf(B, asha)).toBeNull();
    expect(await store.jobOf(A, asha)).toBe("job-1");
    expect((await store.move(B, "job-1", [asha], "next", "staff-1", T1)).results).toEqual([{ id: asha, outcome: "not_found" }]);
    expect(await store.reject(B, "job-1", [asha], "skills", "staff-1", T1, { mail: true })).toEqual([{ id: asha, outcome: "not_found" }]);
    expect(await store.message(B, asha, "Hello", "staff-1", T1)).toEqual({ outcome: "not_found" });
    expect(await store.resumeFile(B, asha)).toBeNull();
    expect((await store.application(A, asha))!.status).toBe("active");
  });

  it("opens the drawer and the resume file, from the row or object storage", async () => {
    const blobs = new MemoryBlobs();
    applications = new HireApplicationStore(sql, SEAL, { newId: () => `x-${++ids}`, blobs });
    store = new HirePipelineStore(sql, SEAL, { newId: () => `e-${++ids}`, blobs });
    await openJob();
    const asha = await apply("c1");
    expect(await store.application(A, asha)).toMatchObject({
      name: "Asha Rao",
      email: "c1@example.com",
      phone: "+919876543210",
      profile: { headline: "Go developer" },
      answers: { q1: "yes" },
      resume: { name: "asha.pdf", type: "pdf", text: "Go, SQL, Kafka" },
    });
    const file = await store.resumeFile(A, asha);
    expect(file).toMatchObject({ name: "asha.pdf", type: "pdf" });
    expect(Buffer.from(file!.file)).toEqual(Buffer.from([37, 80, 68, 70]));
  });

  it("reads a thousand applications in under a second (P15)", async () => {
    const job = await openJob();
    await sql.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO hire_applications (org_id, id, job_id, ref, name, email, email_hash, email_canonical_hash, source, status, round_id)
         SELECT $1, 'bulk-' || g, 'job-1', 'A' || g, 'Person ' || g, 's', 'e' || g, 'e' || g, 'link', 'active', $2
           FROM generate_series(1, 1000) g`,
        [A, job.rounds[1]!.id],
      );
      for (const round of job.rounds.slice(0, 2)) {
        await tx.query(`INSERT INTO hire_round_results (org_id, application_id, round_id, status, score) SELECT $1, 'bulk-' || g, $2, 'done', g % 100 FROM generate_series(1, 1000) g`, [A, round.id]);
      }
      await tx.query(`INSERT INTO hire_screenings (org_id, application_id, status, score, recommendation) SELECT $1, 'bulk-' || g, 'done', g % 100, 'hold' FROM generate_series(1, 1000) g`, [A]);
      await tx.query(`INSERT INTO hire_integrity (org_id, application_id, level) SELECT $1, 'bulk-' || g, 'clear' FROM generate_series(1, 500) g`, [A]);
    }, staff());
    // The best of three, so a machine busy with other suites does not decide it.
    let took = Infinity;
    let read = await store.pipeline(A, "job-1", {}, T1);
    for (let i = 0; i < 3; i++) {
      const started = performance.now();
      read = await store.pipeline(A, "job-1", {}, T1);
      took = Math.min(took, performance.now() - started);
    }
    expect(read.rows).toHaveLength(1000);
    expect(read.rows[0]!.rounds[job.rounds[0]!.id]).toEqual({ status: "done", score: 1 });
    expect(took).toBeLessThan(1000);
  });
});
