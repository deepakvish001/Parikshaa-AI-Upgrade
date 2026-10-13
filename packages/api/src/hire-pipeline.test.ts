import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OrgId } from "@parikshaa/core";
import {
  CandidateStore,
  DataKeys,
  HireApplicationStore,
  HirePipelineStore,
  HireStore,
  IdentityStore,
  pgliteExecutor,
  PrivacyStore,
  type JobFields,
  type SqlExecutor,
  type StaffRole,
} from "@parikshaa/store";
import { HireRefused } from "./hire.js";
import { HireApplications } from "./hire-apply.js";
import { HirePipeline, MAX_BULK, resumeFilename } from "./hire-pipeline.js";
import { Forbidden } from "./service.js";
import type { Actor } from "./staff-auth.js";
import { addOrganisation, addStaff, freshDatabase } from "./testing/harness.js";

/** A job's pipeline for the company (docs/HIRE-V2.md §5, §10 S3, S4, S7, S15, S18, S21, S22, P14, P20, F6, B9; H2c). */

const T0 = Date.parse("2026-10-12T10:00:00Z");
const KEYS = new DataKeys(Buffer.alloc(32, 9));

let db: PGlite;
let sql: SqlExecutor;
let clock: number;
let A: OrgId;
let B: OrgId;
let identity: IdentityStore;
let jobs: HireStore;
let applications: HireApplicationStore;
let pipelines: HirePipelineStore;
let service: HirePipeline;
let audit: { action: string; target: string; detail: Record<string, unknown> }[];
let staff: Record<string, Actor>;
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
  noteToCandidates: "We reply within a week.",
  rejectionLine: "",
  contactEmail: "jobs@acme.test",
  applyBy: null,
  autoScreen: false,
  screenThreshold: 60,
  screenDailyMax: 200,
  maxApplicants: null,
  reapplyAfterDays: 0,
  reviewSlaDays: 2,
  managers: [],
};

async function asOwner(statement: string, params: unknown[] = []) {
  await db.exec(`RESET ROLE`);
  await sql.query(statement, params);
  await db.exec(`SET ROLE parikshaa_app`);
}

async function job(id: string, managers: readonly string[] = [], org = A) {
  await jobs.createJob(org, {
    id,
    fields: { ...FIELDS, managers },
    rounds: [
      { kind: "screen", title: "Screening", config: {} },
      { kind: "interview", title: "Interview", config: {} },
      { kind: "offer", title: "Offer", config: {} },
    ],
    createdBy: null,
    now: new Date(T0),
  });
  return (await jobs.setStatus(org, id, { status: "open", now: new Date(T0), publicCode: `C${id.replace(/\W/g, "").toUpperCase()}` }))!;
}

async function apply(person: string, jobId = "job-1", org = A): Promise<string> {
  const id = `app-${++ids}`;
  const made = await applications.apply(
    org,
    {
      id,
      jobId,
      candidateId: null as unknown as string,
      ref: `A${person.toUpperCase()}`,
      snapshot: {
        name: person,
        email: `${person.toLowerCase()}@example.com`,
        phone: "+919876543210",
        profile: { headline: "Go developer" },
        answers: {},
        resume: { text: "Go, SQL", file: new Uint8Array([37, 80, 68, 70, 45, 49]), name: "C:\\cv\\Asha \"Rao\".PDF", type: "pdf" },
      },
      hashes: { email: `e-${person}`, emailCanonical: `ec-${person}`, phone: null, resume: null },
      source: "link",
      sourceTag: null,
      referrer: null,
      consent: { version: "hire-1", noticeHash: "n1" },
      aiOptOut: false,
      deviceReady: null,
      knockedOut: [],
      now: new Date(clock),
      outbox: [],
    },
    { maxApplicants: null, reapplyAfterDays: 0 },
  );
  if (made.outcome !== "created") throw new Error(made.outcome);
  return id;
}

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (error) {
    if (error instanceof HireRefused) return [error.code, ...error.problems].join(":");
    if (error instanceof Forbidden) return `forbidden:${error.permission}`;
    throw error;
  }
  return "none";
};

beforeEach(async () => {
  clock = T0;
  ids = 0;
  db = await freshDatabase();
  sql = pgliteExecutor(db);
  identity = new IdentityStore(sql);
  A = await addOrganisation(identity, "org-a", "Acme Fintech");
  B = await addOrganisation(identity, "org-b", "Other Co");
  staff = {};
  for (const role of ["owner", "recruiter", "reviewer", "viewer", "hiring_manager", "invigilator"] as const satisfies readonly StaffRole[]) {
    const id = await addStaff(identity, A, `${role}@acme.test`, role, `${role} person`);
    staff[role] = { kind: "user", id, orgId: A, role, name: `${role} person`, email: `${role}@acme.test` };
  }
  const other = await addStaff(identity, B, "owner@other.test", "owner", "Other owner");
  staff["otherOwner"] = { kind: "user", id: other, orgId: B, role: "owner", name: "Other owner", email: "owner@other.test" };
  staff["integration"] = { kind: "api_key", id: "k-1", orgId: A, role: "recruiter", name: "ATS" };
  await db.exec(`SET ROLE parikshaa_app`);
  jobs = new HireStore(sql);
  applications = new HireApplicationStore(sql, KEYS.records("hire"));
  pipelines = new HirePipelineStore(sql, KEYS.records("hire"));
  audit = [];
  service = new HirePipeline({
    jobs,
    pipeline: pipelines,
    identity,
    recordAudit: async (_actor, action, target, detail) => void audit.push({ action, target, detail: detail ?? {} }),
    now: () => clock,
  });
  await job("job-1", [staff["hiring_manager"]!.id]);
  await job("job-2");
});

afterEach(async () => {
  await db.close();
});

describe("reading the pipeline", () => {
  it("is for those who review, and a hiring manager sees only the jobs they manage (F6)", async () => {
    const asha = await apply("Asha");
    await apply("Ravi", "job-2");
    const view = await service.pipeline(staff["viewer"]!, "job-1", {});
    expect(view.job).toMatchObject({ id: "job-1", title: "Backend engineer", reviewSlaDays: 2 });
    expect(view.job.rounds.map((r) => r.kind)).toEqual(["screen", "interview", "offer"]);
    expect(view.rows.map((r) => r.id)).toEqual([asha]);
    expect((await service.pipeline(staff["hiring_manager"]!, "job-1", {})).total).toBe(1);
    expect(await refusal(service.pipeline(staff["hiring_manager"]!, "job-2", {}))).toBe("not_found");
    expect(await refusal(service.pipeline(staff["invigilator"]!, "job-1", {}))).toBe("forbidden:hire:review");
    expect(await refusal(service.pipeline(staff["otherOwner"]!, "job-1", {}))).toBe("not_found");
  });

  it("gives contact details only to those who may decide (S22)", async () => {
    const asha = await apply("Asha");
    const ravi = await apply("Ravi", "job-2");
    clock += 60_000;
    await service.note(staff["recruiter"]!, asha, "Call her on Monday");

    const full = await service.application(staff["recruiter"]!, asha);
    expect(full.contact).toMatchObject({ email: "asha@example.com", phone: "+919876543210", profile: { headline: "Go developer" }, resume: { type: "pdf", text: "Go, SQL" }, resumeDownload: false });
    expect(full.timeline.map((e) => [e.kind, e.by, e.text])).toEqual([
      ["applied", "candidate", null],
      ["note", "recruiter person", "Call her on Monday"],
    ]);

    const viewer = await service.application(staff["viewer"]!, asha);
    expect(viewer).toMatchObject({ name: "Asha", ref: "AASHA", status: "active", contact: null });
    expect(viewer.timeline.map((e) => e.text)).toEqual([null, null]);
    expect(JSON.stringify(viewer)).not.toMatch(/example\.com|9876543210|Go, SQL|Monday/);

    expect((await service.application(staff["hiring_manager"]!, asha)).contact?.email).toBe("asha@example.com");
    expect(await refusal(service.application(staff["hiring_manager"]!, ravi))).toBe("not_found");
    expect(await refusal(service.application(staff["otherOwner"]!, asha))).toBe("not_found");
  });
});

describe("deciding", () => {
  it("is for people who may decide: never a viewer or an integration (S7), nor a manager on another job", async () => {
    const asha = await apply("Asha");
    const ravi = await apply("Ravi", "job-2");
    expect(await refusal(service.move(staff["viewer"]!, "job-1", { ids: [asha], to: "next" }))).toBe("forbidden:hire:decide");
    expect(await refusal(service.move(staff["integration"]!, "job-1", { ids: [asha], to: "next" }))).toBe("forbidden:hire:decide");
    expect(await refusal(service.reject(staff["integration"]!, "job-1", { ids: [asha], rejectReason: "skills", mail: false }))).toBe("forbidden:hire:decide");
    expect(await refusal(service.move(staff["hiring_manager"]!, "job-2", { ids: [ravi], to: "next" }))).toBe("not_found");
    expect(await refusal(service.note(staff["hiring_manager"]!, ravi, "Looks good"))).toBe("not_found");
    expect((await service.move(staff["hiring_manager"]!, "job-1", { ids: [asha], to: "next" })).done).toEqual([asha]);
  });

  it("moves in bulk with what was done and why the rest were not, and overrides a high integrity level only with a reason", async () => {
    const [asha, ravi, meena] = [await apply("Asha"), await apply("Ravi"), await apply("Meena")];
    await sql.transaction((tx) => tx.query(`INSERT INTO hire_integrity (org_id, application_id, level) VALUES ($1, $2, 'high')`, [A, meena]), {
      "parikshaa.org_id": A,
      "parikshaa.actor": "staff",
    });
    expect(await service.move(staff["recruiter"]!, "job-1", { ids: [asha, ravi, meena, asha, "nope"], to: "next" })).toEqual({
      done: [asha, ravi],
      refused: [
        { id: meena, reason: "override_needs_reason" },
        { id: "nope", reason: "not_found" },
      ],
    });
    expect(audit).toEqual([{ action: "hire.moved", target: "job-1", detail: { count: 2, to: "next", applications: [asha, ravi] } }]);

    expect(await refusal(service.move(staff["recruiter"]!, "job-1", { ids: [meena], to: "next", overrideReason: "ok fine" }))).toBe("invalid:override_needs_reason");
    expect(await refusal(service.move(staff["recruiter"]!, "job-1", { ids: [meena], to: "no-such-round" }))).toBe("invalid:no_such_round");
    expect(await service.move(staff["recruiter"]!, "job-1", { ids: [meena], to: "next", overrideReason: "  Saw their ID on the call  " })).toEqual({ done: [meena], refused: [] });
    expect(audit.slice(1)).toEqual([
      { action: "hire.moved", target: "job-1", detail: { count: 1, to: "next", applications: [meena] } },
      { action: "hire.override", target: "job-1", detail: { count: 1, applications: [meena] } },
    ]);
    const override = (await service.application(staff["owner"]!, meena)).timeline.find((e) => e.kind === "override");
    expect(override).toMatchObject({ by: "recruiter person", text: "Saw their ID on the call", candidateVisible: false });
    // The audit says who and how many, never what was written (S3).
    expect(JSON.stringify(audit)).not.toContain("Saw their ID");

    const many = Array.from({ length: MAX_BULK + 1 }, (_, i) => `id-${i}`);
    expect(await refusal(service.move(staff["recruiter"]!, "job-1", { ids: many, to: "next" }))).toBe("invalid:too_many");
    expect(await refusal(service.move(staff["recruiter"]!, "job-1", { ids: [], to: "next" }))).toBe("invalid:no_applications");
  });

  it("rejects with a reason and the mail a day later; on the AI's reading only with a typed reason, kept as a note (S15)", async () => {
    const [asha, ravi] = [await apply("Asha"), await apply("Ravi")];
    expect(await service.reject(staff["reviewer"]!, "job-1", { ids: [asha], rejectReason: "experience", mail: true })).toEqual({ done: [asha], refused: [] });
    expect(audit.at(-1)).toEqual({ action: "hire.rejected", target: "job-1", detail: { count: 1, rejectReason: "experience", mail: true, applications: [asha] } });

    const onAi = { ids: [ravi, asha], rejectReason: "skills" as const, mail: false, filter: { recommendation: "low_match" as const } };
    expect(await refusal(service.reject(staff["reviewer"]!, "job-1", onAi))).toBe("invalid:reason_needed");
    expect(await refusal(service.reject(staff["reviewer"]!, "job-1", { ...onAi, reason: "too short" }))).toBe("invalid:reason_needed");
    expect(await service.reject(staff["reviewer"]!, "job-1", { ...onAi, reason: "Checked each resume: no Go at all" })).toEqual({
      done: [ravi],
      refused: [{ id: asha, reason: "not_active" }],
    });
    expect(audit.at(-1)).toEqual({
      action: "hire.rejected",
      target: "job-1",
      detail: { count: 1, rejectReason: "skills", mail: false, filter: { recommendation: "low_match" }, applications: [ravi] },
    });
    const note = (await service.application(staff["reviewer"]!, ravi)).timeline.find((e) => e.kind === "note");
    expect(note?.text).toBe("Rejected with others chosen by the AI's reading (low_match): Checked each resume: no Go at all");
    expect(await refusal(service.reject(staff["reviewer"]!, "job-1", { ids: [ravi], rejectReason: "rude" as never, mail: false }))).toBe("invalid:reject_reason");
  });

  it("restores a rejected application, never a withdrawn one nor one whose person applied again (B9)", async () => {
    const asha = await apply("Asha");
    expect(await refusal(service.restore(staff["recruiter"]!, asha))).toBe("conflict:not_rejected");
    clock += 60_000;
    await service.reject(staff["recruiter"]!, "job-1", { ids: [asha], rejectReason: "notice", mail: true });
    clock += 60_000;
    const again = await apply("Asha");
    expect(await refusal(service.restore(staff["recruiter"]!, asha))).toBe("conflict:newer_application");
    await service.reject(staff["recruiter"]!, "job-1", { ids: [again], rejectReason: "notice", mail: false });
    clock += 60_000;
    const back = await service.restore(staff["recruiter"]!, asha);
    expect(back).toMatchObject({ status: "active", rejectReason: null });
    expect(back.timeline.map((e) => e.kind)).toEqual(["applied", "rejected", "restored"]);
    expect(audit.at(-1)).toEqual({ action: "hire.restored", target: asha, detail: {} });
    const mail = await sql.transaction((tx) => tx.query<{ status: string }>(`SELECT status FROM outbox WHERE purpose = 'mail_rejected' AND subject->>'applicationId' = $1`, [asha]), {
      "parikshaa.org_id": A,
      "parikshaa.actor": "staff",
    });
    expect(mail).toEqual([{ status: "skipped" }]);
  });
});

describe("notes and messages", () => {
  it("keeps notes with the team and puts messages, and the job's note, in the candidate's portal (S4, P14)", async () => {
    const accounts = new CandidateStore(sql, KEYS.records("candidates"));
    const portal = new HireApplications({ jobs, applications, accounts, identity, privacy: new PrivacyStore(sql), keys: KEYS, grievance: { name: "G", email: "g@parikshaa.test" }, now: () => clock });
    const asha = await accounts.signIn("asha@example.com", new Date(clock));
    await accounts.saveProfile(asha.id, { name: "Asha Rao", phone: null, details: {} });
    await accounts.saveResume(asha.id, { text: "Go", file: new Uint8Array([37, 80, 68, 70, 45]), name: "cv.pdf", type: "pdf", sha256: "s", at: new Date(clock) });
    const company = (await identity.getOrganisation(A))!.publicId;
    const page = await portal.publicJob(company, "CJOB1");
    const made = await portal.apply(asha, { company, code: "CJOB1", answers: {}, noticeHash: page.notice.hash, adult: true, aiOptOut: false, deviceReady: null, source: "link", sourceTag: null, referrer: null });

    clock += 60_000;
    await service.note(staff["recruiter"]!, made.id, "Internal: salary expectation high");
    clock += 60_000;
    const after = await service.message(staff["recruiter"]!, made.id, "Could you share your notice period?");
    expect(after.timeline.map((e) => [e.kind, e.candidateVisible])).toEqual([
      ["applied", true],
      ["note", false],
      ["message", true],
    ]);
    expect(audit.map((a) => a.action)).toEqual(["hire.note_added", "hire.messaged"]);

    const mine = await portal.one(asha, made.id);
    expect(mine.messages).toEqual([{ at: new Date(clock).toISOString(), text: "Could you share your notice period?" }]);
    expect(mine.noteToCandidates).toBe("We reply within a week.");
    expect(JSON.stringify(mine)).not.toMatch(/salary expectation|"note"/);

    await portal.withdraw(asha, made.id);
    expect(await refusal(service.message(staff["recruiter"]!, made.id, "Hello again"))).toBe("conflict:withdrawn");
    expect(await refusal(service.message(staff["recruiter"]!, made.id, "   "))).toBe("invalid:empty");
    expect(await refusal(service.note(staff["recruiter"]!, made.id, "x".repeat(2001)))).toBe("invalid:too_long");
  });
});

describe("the resume", () => {
  it("is downloaded as an attachment by those who decide, once Parikshaa verifies the company, and audited (S18, S21, S22)", async () => {
    const asha = await apply("Asha");
    expect(await refusal(service.resume(staff["recruiter"]!, asha))).toBe("limit:unverified");
    expect(await refusal(service.resume(staff["viewer"]!, asha))).toBe("forbidden:hire:decide");
    await asOwner(`UPDATE organisations SET verified_at = now(), verified_by = 'ops' WHERE id = $1`, [A]);
    expect((await service.application(staff["recruiter"]!, asha)).contact?.resumeDownload).toBe(true);
    const file = await service.resume(staff["recruiter"]!, asha);
    expect(file).toMatchObject({ filename: "Asha _Rao.pdf", contentType: "application/pdf" });
    expect(Buffer.from(file.file)).toEqual(Buffer.from([37, 80, 68, 70, 45, 49]));
    expect(audit).toEqual([{ action: "hire.resume_downloaded", target: asha, detail: {} }]);
  });

  it("gets a safe file name", () => {
    expect(resumeFilename("../../etc/passwd", "pdf")).toBe("passwd.pdf");
    expect(resumeFilename("Résumé (2026).docx", "docx")).toBe("R_sum_ (2026).docx");
    expect(resumeFilename("cv.exe", "pdf")).toBe("cv.pdf");
    expect(resumeFilename("\r\n\"", "pdf")).toBe("resume.pdf");
    expect(resumeFilename(".pdf", "pdf")).toBe("resume.pdf");
  });
});

describe("a job's rejection line", () => {
  it("is kept with the job (P14)", async () => {
    const saved = await jobs.updateJob(A, "job-1", { ...FIELDS, rejectionLine: "We will keep your profile for future roles." }, (await jobs.job(A, "job-1"))!.rounds, new Date(clock));
    expect(saved?.rejectionLine).toBe("We will keep your profile for future roles.");
  });
});
