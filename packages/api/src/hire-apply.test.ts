import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId } from "@parikshaa/core";
import {
  CandidateStore,
  DataKeys,
  HireApplicationStore,
  HireStore,
  IdentityStore,
  pgliteExecutor,
  PrivacyStore,
  type CandidateAccount,
  type JobFields,
  type OutboxItem,
  type SqlExecutor,
} from "@parikshaa/store";
import type { EmailMessage } from "./delivery.js";
import { HireRefused } from "./hire.js";
import { DAILY_APPLICATIONS, HireApplications, canonicalEmail, type ApplyInput } from "./hire-apply.js";
import { HireMessages } from "./hire-messages.js";
import { freshDatabase } from "./testing/harness.js";

/** Applying and the candidate's portal (docs/HIRE-V2.md §2, §10 S2, S4, S8, S17, S18, F2, F5, F7; H2b). */

const A = orgId("org-a");
const B = orgId("org-b");
const T0 = Date.parse("2026-10-12T10:00:00Z");
const DAY = 86_400_000;
const KEYS = new DataKeys(Buffer.alloc(32, 9));
const GRIEVANCE = { name: "Meera Shah", email: "grievance@parikshaa.test" };

let db: PGlite;
let sql: SqlExecutor;
let clock: number;
let jobs: HireStore;
let applications: HireApplicationStore;
let accounts: CandidateStore;
let identity: IdentityStore;
let service: HireApplications;
let company: string;
let sent: EmailMessage[];

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
  ctcMaxLpa: 20,
  showCtc: true,
  openings: 2,
  skillsMust: ["Go"],
  skillsNice: [],
  description: "Build the payments API.",
  questions: [
    { id: "join", text: "Can you join within 30 days?", kind: "yes_no", required: true, knockout: { equals: "yes" } },
    { id: "years", text: "Years with Go", kind: "number", required: false },
  ],
  noteToCandidates: "",
  contactEmail: null,
  applyBy: "2026-10-20",
  autoScreen: false,
  screenThreshold: 60,
  screenDailyMax: 200,
  maxApplicants: null,
  reapplyAfterDays: 90,
  reviewSlaDays: 2,
  managers: [],
};

const make = (over: Partial<ConstructorParameters<typeof HireApplications>[0]> = {}) =>
  new HireApplications({ jobs, applications, accounts, identity, privacy: new PrivacyStore(sql), keys: KEYS, grievance: GRIEVANCE, now: () => clock, ...over });

async function asOwner(statement: string, params: unknown[] = []) {
  await db.exec(`RESET ROLE`);
  await sql.query(statement, params);
  await db.exec(`SET ROLE parikshaa_app`);
}

async function job(id = "job-1", fields: Partial<JobFields> = {}, code = "BE7Q2K", org = A) {
  await jobs.createJob(org, {
    id,
    fields: { ...FIELDS, ...fields },
    rounds: [
      { kind: "screen", title: "Screening", config: {} },
      { kind: "assessment", title: "Online test", config: {} },
      { kind: "offer", title: "Offer", config: {} },
    ],
    createdBy: null,
    now: new Date(T0),
  });
  await jobs.setStatus(org, id, { status: "open", now: new Date(T0), publicCode: code });
}

async function candidate(email: string, name: string | null = "Asha Rao", resume = true): Promise<CandidateAccount> {
  const account = await accounts.signIn(email, new Date(clock));
  await accounts.saveProfile(account.id, { name, phone: "+91 98765 43210", details: { headline: "Go developer" } });
  if (resume) {
    await accounts.saveResume(account.id, { text: "Go, SQL", file: new Uint8Array([37, 80, 68, 70, 45]), name: "cv.pdf", type: "pdf", sha256: `sha-${email}`, at: new Date(clock) });
  }
  return account;
}

async function input(over: Partial<ApplyInput> = {}): Promise<ApplyInput> {
  const page = await service.publicJob(company, "BE7Q2K");
  return {
    company,
    code: "BE7Q2K",
    answers: { join: "yes", years: 3 },
    noticeHash: page.notice.hash,
    adult: true,
    aiOptOut: false,
    deviceReady: true,
    source: "link",
    sourceTag: "linkedin",
    referrer: null,
    ...over,
  };
}

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (error) {
    if (error instanceof HireRefused) return [error.code, ...error.problems].join(":");
    throw error;
  }
  return "none";
};

beforeEach(async () => {
  clock = T0;
  db = await freshDatabase();
  sql = pgliteExecutor(db);
  await sql.query(`INSERT INTO organisations (id, name, kind) VALUES ($1, 'Acme Fintech', 'company'), ($2, 'Other Co', 'company')`, [A, B]);
  company = (await sql.query<{ public_id: string }>(`SELECT public_id FROM organisations WHERE id = $1`, [A]))[0]!.public_id;
  await db.exec(`SET ROLE parikshaa_app`);
  jobs = new HireStore(sql);
  applications = new HireApplicationStore(sql, KEYS.records("hire"));
  accounts = new CandidateStore(sql, KEYS.records("candidates"));
  identity = new IdentityStore(sql);
  service = make();
  sent = [];
  await job();
});

afterEach(async () => {
  await db.close();
});

describe("the job page", () => {
  it("shows a published job, its steps and questions, and the notice to read before applying (S8, S23)", async () => {
    const page = await service.publicJob(company, "be7q2k");
    expect(page).toMatchObject({
      company: { name: "Acme Fintech", publicId: company, verified: false },
      code: "BE7Q2K",
      title: "Backend engineer",
      ctc: { minLpa: 12, maxLpa: 20 },
      steps: [
        { kind: "screen", title: "Screening" },
        { kind: "assessment", title: "Online test" },
        { kind: "offer", title: "Offer" },
      ],
      accepting: true,
      notAccepting: null,
      noindex: true,
    });
    expect(page.questions[0]).toMatchObject({ id: "join", knockout: { equals: "yes" } });
    expect(page.notice).toMatchObject({ version: "hire-1", keepDays: 180, contacts: { company: null, parikshaa: GRIEVANCE } });
    expect(page.notice.en.join(" ")).toMatch(/Anthropic.*leaves India.*not used to train.*A person makes every decision/);
    expect(page.notice.en.join(" ")).toMatch(/never ask you to pay/);
    expect(page.notice.hi).toHaveLength(page.notice.en.length);
  });

  it("names the company's grievance officer and keeps its retention when it has set them", async () => {
    await sql.transaction(
      (tx) =>
        tx.query(
          `INSERT INTO privacy_settings (org_id, controller_name, grievance_name, grievance_email, purpose, retention_days) VALUES ($1, 'Acme Fintech', 'Ravi Iyer', 'privacy@acme.test', 'Hiring', 60)`,
          [A],
        ),
      { "parikshaa.org_id": A, "parikshaa.actor": "staff" },
    );
    const page = await service.publicJob(company, "BE7Q2K");
    expect(page.notice).toMatchObject({ keepDays: 60, contacts: { company: { name: "Ravi Iyer", email: "privacy@acme.test" } } });
    expect(page.notice.en.join(" ")).toMatch(/60 days after a decision/);
  });

  it("is not found for a draft, a held job, another company's code, or a suspended company (F2)", async () => {
    await jobs.createJob(A, { id: "job-2", fields: FIELDS, rounds: [], createdBy: null, now: new Date(T0) });
    await jobs.setStatus(A, "job-2", { status: "held", now: new Date(T0), heldReason: "fee" });
    expect(await refusal(service.publicJob(company, "NOPE22"))).toBe("not_found");
    expect(await refusal(service.publicJob("PKC-000000", "BE7Q2K"))).toBe("not_found");
    expect(await refusal(service.publicJob("../etc", "BE7Q2K"))).toBe("not_found");
    await asOwner(`UPDATE organisations SET suspended_at = now() WHERE id = $1`, [A]);
    expect(await refusal(service.publicJob(company, "BE7Q2K"))).toBe("not_found");
    expect(await refusal(service.careers(company))).toBe("not_found");
  });

  it("says why it takes no applications: paused, closed, or past its last day (23:59 India time)", async () => {
    clock = Date.parse("2026-10-20T18:00:00Z"); // 23:30 IST on the last day
    expect((await service.publicJob(company, "BE7Q2K")).accepting).toBe(true);
    clock = Date.parse("2026-10-20T18:31:00Z"); // 00:01 IST the next day
    expect(await service.publicJob(company, "BE7Q2K")).toMatchObject({ accepting: false, notAccepting: "past_apply_by" });
    clock = T0;
    await jobs.setStatus(A, "job-1", { status: "paused", now: new Date(T0) });
    expect((await service.publicJob(company, "BE7Q2K")).notAccepting).toBe("paused");
    await jobs.setStatus(A, "job-1", { status: "closed", now: new Date(T0) });
    expect((await service.publicJob(company, "BE7Q2K")).notAccepting).toBe("closed");
  });

  it("has a careers page of the company's open jobs", async () => {
    await job("job-3", { title: "Data analyst", applyBy: null }, "DA4XYZ");
    await jobs.createJob(A, { id: "job-4", fields: { ...FIELDS, title: "Draft" }, rounds: [], createdBy: null, now: new Date(T0) });
    const careers = await service.careers(company);
    expect(careers.company.name).toBe("Acme Fintech");
    expect(careers.jobs.map((j) => j.title).sort()).toEqual(["Backend engineer", "Data analyst"]);
  });

  it("is not offered at all when no grievance officer is set up for this server", async () => {
    service = make({ grievance: null });
    expect(await refusal(service.publicJob(company, "BE7Q2K"))).toBe("unavailable");
  });
});

describe("applying", () => {
  it("makes the application with a copy of the profile, a stable ref, and the link to the portal (S2, F5)", async () => {
    const asha = await candidate("asha@example.com");
    const made = await service.apply(asha, await input());
    expect(made.status).toBe("active");

    const copy = await applications.snapshot(A, made.id);
    expect(copy).toMatchObject({ name: "Asha Rao", email: "asha@example.com", phone: "+91 98765 43210", profile: { headline: "Go developer" }, answers: { join: "yes", years: 3 } });
    expect(copy!.ref).toMatch(/^A[A-Z2-7]{8}$/);
    expect(copy!.ref).toBe(service.ref(A, copy!.hashes.emailCanonical));
    expect(Buffer.from(copy!.resume!.file)).toEqual(Buffer.from([37, 80, 68, 70, 45]));

    // The same person's ref is the same for every job of the company.
    await job("job-2", {}, "QA2B3C");
    const second = await service.apply(asha, { ...(await input()), code: "QA2B3C" });
    expect((await applications.snapshot(A, second.id))!.ref).toBe(copy!.ref);

    const mine = await service.mine(asha);
    expect(mine.map((m) => m.job.title)).toEqual(["Backend engineer", "Backend engineer"]);
    expect(mine[0]).toMatchObject({ company: { name: "Acme Fintech", paused: false }, status: "in_progress", canWithdraw: true });
  });

  it("asks for what the company needs, and refuses an old notice, a minor, or a closed job", async () => {
    const asha = await candidate("asha@example.com");
    expect(await refusal(service.apply(asha, await input({ noticeHash: "stale" })))).toBe("conflict:notice_changed");
    expect(await refusal(service.apply(asha, await input({ adult: false })))).toBe("invalid:adult");
    expect(await refusal(service.apply(asha, await input({ answers: { years: 3 } })))).toBe('invalid:"Can you join within 30 days?" needs an answer');
    expect(await refusal(service.apply(asha, await input({ answers: { join: "maybe" } })))).toBe("invalid:Answer \"Can you join within 30 days?\" with yes or no");
    expect(await refusal(service.apply(asha, await input({ answers: { join: "yes", salary: 5 } })))).toBe("invalid:Some answers are to questions this job does not ask");
    const noResume = await candidate("ravi@example.com", "Ravi", false);
    expect(await refusal(service.apply(noResume, await input()))).toBe("invalid:resume");
    const noName = await candidate("anon@example.com", null);
    expect(await refusal(service.apply(noName, await input()))).toBe("invalid:name");

    const ok = await input();
    clock = Date.parse("2026-10-20T18:31:00Z");
    expect(await refusal(service.apply(asha, ok))).toBe("conflict:past_apply_by");
  });

  it("takes one live application per person per job, however the address is written (S17)", async () => {
    const asha = await candidate("a.sha+jobs@gmail.com");
    const twin = await candidate("asha@googlemail.com", "Asha R");
    expect(canonicalEmail("A.Sha+jobs@GMail.com")).toBe("asha@gmail.com");
    await service.apply(asha, await input());
    expect(await refusal(service.apply(asha, await input()))).toBe("conflict:already_applied");
    expect(await refusal(service.apply(twin, await input()))).toBe("conflict:already_applied");
    // The second account was not linked to the first one's application.
    expect(await service.mine(twin)).toEqual([]);
  });

  it("ends an application that misses a knockout, and shows it as not moving forward", async () => {
    const asha = await candidate("asha@example.com");
    const made = await service.apply(asha, await input({ answers: { join: "no" } }));
    expect(made.status).toBe("rejected");
    const [mine] = await service.mine(asha);
    expect(mine).toMatchObject({ status: "not_moving_forward", canWithdraw: false });
    expect(mine!.steps[0]).toMatchObject({ kind: "screen", state: "not_moving_forward" });
    expect(await refusal(service.apply(asha, await input()))).toBe("conflict:reapply_later");
  });

  it("holds a candidate to twenty applications a day (S17)", async () => {
    const asha = await candidate("asha@example.com");
    for (let i = 0; i < DAILY_APPLICATIONS; i++) await accounts.link(asha.id, B, `elsewhere-${i}`, new Date(clock - i * 60_000));
    expect(await refusal(service.apply(asha, await input()))).toBe("limit:daily_limit");
    clock += DAY;
    expect((await service.apply(asha, await input())).status).toBe("active");
  });

  it("stops at the job's limit, and at a hundred until Parikshaa verifies the company (S18)", async () => {
    await sql.transaction(
      async (tx) => {
        for (let i = 0; i < 100; i++) {
          await tx.query(
            `INSERT INTO hire_applications (org_id, id, job_id, ref, name, email, email_hash, email_canonical_hash, source, status)
             VALUES ($1, $2, 'job-1', 'A0', 'X', 's', $2, $2, 'link', 'active')`,
            [A, `seed-${i}`],
          );
        }
      },
      { "parikshaa.org_id": A, "parikshaa.actor": "staff" },
    );
    const asha = await candidate("asha@example.com");
    expect((await service.publicJob(company, "BE7Q2K")).notAccepting).toBe("full");
    expect(await refusal(service.apply(asha, await input()))).toBe("conflict:full");
    await asOwner(`UPDATE organisations SET verified_at = now(), verified_by = 'ops' WHERE id = $1`, [A]);
    expect((await service.apply(asha, await input())).status).toBe("active");
    await jobs.updateJob(A, "job-1", { ...FIELDS, maxApplicants: 101 }, (await jobs.job(A, "job-1"))!.rounds, new Date(T0));
    const ravi = await candidate("ravi@example.com", "Ravi");
    expect(await refusal(service.apply(ravi, await input()))).toBe("conflict:full");
  });

  it("is refused for a suspended company's job (F2)", async () => {
    const asha = await candidate("asha@example.com");
    const ready = await input();
    await asOwner(`UPDATE organisations SET suspended_at = now() WHERE id = $1`, [A]);
    expect(await refusal(service.apply(asha, ready))).toBe("not_found");
  });
});

describe("the portal", () => {
  it("shows where an application stands without a score or a note (S4)", async () => {
    const asha = await candidate("asha@example.com");
    const made = await service.apply(asha, await input());
    let [mine] = await service.mine(asha);
    expect(mine!.steps.map((s) => [s.kind, s.state, s.current])).toEqual([
      ["screen", "waiting", true],
      ["assessment", "waiting", false],
      ["offer", "waiting", false],
    ]);
    // The company moves it on and sends the test; the candidate sees it is their turn, and nothing of the score.
    await sql.transaction(
      async (tx) => {
        const rounds = await tx.query<{ id: string }>(`SELECT id FROM hire_rounds WHERE job_id = 'job-1' ORDER BY position`);
        await tx.query(`UPDATE hire_round_results SET status = 'passed', score = 87.5 WHERE application_id = $1`, [made.id]);
        await tx.query(`INSERT INTO hire_round_results (org_id, application_id, round_id, status) VALUES ($1, $2, $3, 'invited')`, [A, made.id, rounds[1]!.id]);
        await tx.query(`UPDATE hire_applications SET round_id = $2 WHERE id = $1`, [made.id, rounds[1]!.id]);
        await tx.query(
          `INSERT INTO hire_events (org_id, id, application_id, candidate_id, kind, by, detail, candidate_visible) VALUES ($1, 'n1', $2, $3, 'note', 'Recruiter', '{"text":"strong Go"}', false)`,
          [A, made.id, asha.id],
        );
      },
      { "parikshaa.org_id": A, "parikshaa.actor": "staff" },
    );
    [mine] = await service.mine(asha);
    expect(mine!.steps.map((s) => s.state)).toEqual(["done", "your_turn", "waiting"]);
    expect(JSON.stringify(mine)).not.toMatch(/87\.5|strong Go|note/);
    expect(await service.one(asha, made.id)).toEqual(mine);
  });

  it("lets only the candidate see and withdraw their application, once, even while the company is paused", async () => {
    const asha = await candidate("asha@example.com");
    const ravi = await candidate("ravi@example.com", "Ravi");
    const made = await service.apply(asha, await input());
    expect(await refusal(service.one(ravi, made.id))).toBe("not_found");
    expect(await refusal(service.withdraw(ravi, made.id))).toBe("not_found");

    await asOwner(`UPDATE organisations SET suspended_at = now() WHERE id = $1`, [A]);
    expect((await service.one(asha, made.id)).company.paused).toBe(true);
    const done = await service.withdraw(asha, made.id);
    expect(done).toMatchObject({ status: "withdrawn", canWithdraw: false });
    expect(done.timeline.map((t) => t.kind)).toEqual(["applied", "withdrawn"]);
    expect(await refusal(service.withdraw(asha, made.id))).toBe("conflict:not_active");
  });
});

describe("mail", () => {
  const item = (applicationId: string, purpose: string): OutboxItem => ({ id: "o1", orgId: A, kind: "hire", subject: { applicationId }, purpose, attempts: 1 });
  const messages = (mailer: { send(m: EmailMessage): Promise<void> } | null = { send: async (m) => void sent.push(m) }) =>
    new HireMessages({ applications, identity, mailer, publicUrl: "https://parikshaa.test", now: () => clock });

  it("tells the candidate their application reached the company, or why it cannot go ahead", async () => {
    const asha = await candidate("asha@example.com");
    const made = await service.apply(asha, await input());
    expect(await messages().deliver(item(made.id, "mail_applied"))).toBe("sent");
    expect(sent[0]).toMatchObject({ to: "asha@example.com", subject: "Applied: Backend engineer at Acme Fintech" });
    expect(sent[0]!.text).toMatch(/https:\/\/parikshaa\.test\/my/);
    expect(sent[0]!.text).toMatch(/never ask you to pay/);

    const ravi = await candidate("ravi@example.com", "Ravi <b>");
    const knocked = await service.apply(ravi, await input({ answers: { join: "no" } }));
    await messages().deliver(item(knocked.id, "mail_applied"));
    expect(sent[1]!.text).toMatch(/does not meet a requirement/);
    expect(sent[1]!.html).toContain("Ravi &lt;b&gt;");

    await service.withdraw(asha, made.id);
    await messages().deliver(item(made.id, "mail_withdrawn"));
    expect(sent[2]).toMatchObject({ subject: "Withdrawn: Backend engineer at Acme Fintech" });
  });

  it("holds the mail while the company is suspended, and skips it with no mailer (F2)", async () => {
    const asha = await candidate("asha@example.com");
    const made = await service.apply(asha, await input());
    expect(await messages(null).deliver(item(made.id, "mail_applied"))).toEqual({ skip: "This server does not send email" });
    await asOwner(`UPDATE organisations SET suspended_at = now() WHERE id = $1`, [A]);
    expect(await messages().deliver(item(made.id, "mail_applied"))).toEqual({ later: new Date(clock + 3_600_000) });
    expect(sent).toEqual([]);
  });
});
