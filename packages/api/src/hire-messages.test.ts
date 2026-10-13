import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { OrgId } from "@parikshaa/core";
import {
  DataKeys,
  HireApplicationStore,
  HirePipelineStore,
  HireStore,
  IdentityStore,
  pgliteExecutor,
  type Job,
  type JobFields,
  type OutboxItem,
  type SqlExecutor,
} from "@parikshaa/store";
import type { EmailMessage } from "./delivery.js";
import { HireMessages } from "./hire-messages.js";
import { addOrganisation, freshDatabase } from "./testing/harness.js";

/**
 * Hire's mail as the pipeline writes it (docs/HIRE-V2.md §10 F2, F23, P14,
 * S18; H2c): the sender and reply-to, the move, the delayed rejection that a
 * Restore cancels, and messages, with no staff words until the company is
 * verified.
 */

const T0 = Date.parse("2026-10-12T10:00:00Z");
const KEYS = new DataKeys(Buffer.alloc(32, 9));

let db: PGlite;
let sql: SqlExecutor;
let clock: number;
let A: OrgId;
let identity: IdentityStore;
let jobs: HireStore;
let applications: HireApplicationStore;
let pipeline: HirePipelineStore;
let messages: HireMessages;
let sent: EmailMessage[];
let job: Job;
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
  noteToCandidates: "Bring a laptop to the interview.",
  rejectionLine: "We will keep your profile for future roles.",
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

const staffScope = () => ({ "parikshaa.org_id": A, "parikshaa.actor": "staff" });

async function asOwner(statement: string, params: unknown[] = []) {
  await db.exec(`RESET ROLE`);
  await sql.query(statement, params);
  await db.exec(`SET ROLE parikshaa_app`);
}

async function apply(person: string): Promise<string> {
  const id = `app-${++ids}`;
  const made = await applications.apply(
    A,
    {
      id,
      jobId: job.id,
      candidateId: null as unknown as string,
      ref: `A${person.toUpperCase()}`,
      snapshot: { name: person, email: `${person.toLowerCase()}@example.com`, phone: null, profile: {}, answers: {}, resume: null },
      hashes: { email: `e-${person}`, emailCanonical: `ec-${person}`, phone: null, resume: null },
      source: "link",
      sourceTag: null,
      referrer: null,
      consent: { version: "hire-1", noticeHash: "n1" },
      aiOptOut: false,
      deviceReady: null,
      knockedOut: [],
      now: new Date(clock),
      outbox: [{ kind: "hire", subject: { applicationId: id }, purpose: "mail_applied", id: `hire:${id}:applied` }],
    },
    { maxApplicants: null, reapplyAfterDays: 0 },
  );
  if (made.outcome !== "created") throw new Error(made.outcome);
  return id;
}

/** The outbox items for one purpose, oldest first, as the worker hands them over. */
async function items(purpose: string): Promise<OutboxItem[]> {
  const rows = await sql.transaction(
    (tx) => tx.query<{ id: string; subject: Record<string, unknown> }>(`SELECT id, subject FROM outbox WHERE purpose = $1 ORDER BY created_at, send_after`, [purpose]),
    staffScope(),
  );
  return rows.map((r) => ({ id: r.id, orgId: A, kind: "hire", subject: r.subject, purpose, attempts: 1 }));
}

const deliver = async (purpose: string, n = 0) => messages.deliver((await items(purpose))[n]!);
const verify = () => asOwner(`UPDATE organisations SET verified_at = now(), verified_by = 'ops' WHERE id = $1`, [A]);

beforeEach(async () => {
  clock = T0;
  ids = 0;
  db = await freshDatabase();
  sql = pgliteExecutor(db);
  identity = new IdentityStore(sql);
  A = await addOrganisation(identity, "org-a", "Acme Fintech");
  await db.exec(`SET ROLE parikshaa_app`);
  jobs = new HireStore(sql);
  applications = new HireApplicationStore(sql, KEYS.records("hire"));
  pipeline = new HirePipelineStore(sql, KEYS.records("hire"));
  sent = [];
  messages = new HireMessages({ applications, identity, mailer: { send: async (m) => void sent.push(m) }, publicUrl: "https://parikshaa.test", now: () => clock });
  await jobs.createJob(A, {
    id: "job-1",
    fields: FIELDS,
    rounds: [
      { kind: "screen", title: "Screening", config: {} },
      { kind: "interview", title: "Technical interview", config: { sendOnMove: true } },
      { kind: "review", title: "Manager review", config: { sendOnMove: true } },
      { kind: "offer", title: "Offer", config: {} },
    ],
    createdBy: null,
    now: new Date(T0),
  });
  job = (await jobs.setStatus(A, "job-1", { status: "open", now: new Date(T0), publicCode: "BE7Q2K" }))!;
});

afterEach(async () => {
  await db.close();
});

describe("every Hire mail", () => {
  it("comes from the company via Parikshaa, with replies going to the job's contact address (F23, P14)", async () => {
    const asha = await apply("Asha");
    expect(await deliver("mail_applied")).toBe("sent");
    expect(sent[0]).toMatchObject({ to: "asha@example.com", fromName: "Acme Fintech via Parikshaa", replyTo: "jobs@acme.test" });

    await jobs.updateJob(A, "job-1", { ...FIELDS, contactEmail: null }, job.rounds, new Date(clock));
    expect(asha).toBe("app-1");
    const ravi = await apply("Ravi");
    await messages.deliver({ id: "o", orgId: A, kind: "hire", subject: { applicationId: ravi }, purpose: "mail_applied", attempts: 1 });
    expect(sent[1]!.fromName).toBe("Acme Fintech via Parikshaa");
    expect("replyTo" in sent[1]!).toBe(false);
  });

  it("waits while the company is suspended (F2)", async () => {
    const asha = await apply("Asha");
    await pipeline.reject(A, "job-1", [asha], "skills", "staff-1", new Date(clock), { mail: true });
    await asOwner(`UPDATE organisations SET suspended_at = now() WHERE id = $1`, [A]);
    expect(await deliver("mail_rejected")).toEqual({ later: new Date(clock + 3_600_000) });
    expect(sent).toEqual([]);
  });
});

describe("moving on", () => {
  it("tells the candidate the round they reached, with the job's note once the company is verified", async () => {
    const asha = await apply("Asha");
    await pipeline.move(A, "job-1", [asha], "next", "staff-1", new Date(clock));
    expect(await deliver("mail_moved")).toBe("sent");
    expect(sent[0]!.subject).toBe("Next step: Technical interview, Backend engineer at Acme Fintech");
    expect(sent[0]!.text).toMatch(/moved to the next step: Technical interview/);
    expect(sent[0]!.text).not.toContain("Bring a laptop");

    await verify();
    expect(await deliver("mail_moved")).toBe("sent");
    expect(sent[1]!.text).toContain("Bring a laptop to the interview.");
  });

  it("is not sent for a round the application has left since", async () => {
    const asha = await apply("Asha");
    await pipeline.move(A, "job-1", [asha], "next", "staff-1", new Date(clock));
    clock += 60_000;
    await pipeline.move(A, "job-1", [asha], "next", "staff-1", new Date(clock));
    expect(await deliver("mail_moved", 0)).toEqual({ skip: "The application has moved on since" });
    expect(await deliver("mail_moved", 1)).toBe("sent");
    expect(sent[0]!.subject).toMatch(/^Next step: Manager review/);
  });
});

describe("a rejection", () => {
  it("goes a day later without a reason, with the job's line once verified, and not at all once restored", async () => {
    const asha = await apply("Asha");
    await pipeline.reject(A, "job-1", [asha], "experience", "staff-1", new Date(clock), { mail: true });
    clock += 3_600_000;
    await pipeline.restore(A, asha, "staff-1", new Date(clock));
    // The worker would not pick it up (skipped in the outbox); were it in flight, the mail itself checks again.
    expect(await deliver("mail_rejected", 0)).toEqual({ skip: "The application was restored" });

    clock += 3_600_000;
    await pipeline.reject(A, "job-1", [asha], "experience", "staff-1", new Date(clock), { mail: true });
    expect(await deliver("mail_rejected", 0)).toEqual({ skip: "The application was restored" });
    expect(await deliver("mail_rejected", 1)).toBe("sent");
    expect(sent[0]!.subject).toBe("Your application to Acme Fintech: Backend engineer");
    expect(sent[0]!.text).toMatch(/decided not to take your application further/);
    expect(sent[0]!.text).not.toMatch(/experience|keep your profile/);

    await verify();
    expect(await deliver("mail_rejected", 1)).toBe("sent");
    expect(sent[1]!.text).toContain("We will keep your profile for future roles.");
  });
});

describe("a message", () => {
  it("carries the company's words only once Parikshaa has verified the company (S18)", async () => {
    const asha = await apply("Asha");
    await pipeline.message(A, asha, "Could you share your notice period?\nThanks, Ravi", "staff-1", new Date(clock));
    expect(await deliver("mail_message")).toBe("sent");
    expect(sent[0]!.subject).toBe("A message from Acme Fintech about Backend engineer");
    expect(sent[0]!.text).toMatch(/sent you a message.*\nRead it at https:\/\/parikshaa\.test\/my/);
    expect(sent[0]!.text).not.toContain("notice period");

    await verify();
    expect(await deliver("mail_message")).toBe("sent");
    expect(sent[1]!.text).toContain("Could you share your notice period?\nThanks, Ravi");
    expect(sent[1]!.html).toContain("<p>Could you share your notice period?</p><p>Thanks, Ravi</p>");
    expect(sent[1]!.replyTo).toBe("jobs@acme.test");

    await sql.transaction((tx) => tx.query(`UPDATE hire_applications SET status = 'withdrawn' WHERE id = $1`, [asha]), staffScope());
    expect(await deliver("mail_message")).toEqual({ skip: "The candidate withdrew" });
    expect(await messages.deliver({ id: "o", orgId: A, kind: "hire", subject: { applicationId: asha, eventId: "nope" }, purpose: "mail_message", attempts: 1 })).toEqual({
      skip: "The message is gone",
    });
  });
});
