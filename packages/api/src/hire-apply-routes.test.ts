import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor, type SqlExecutor } from "@parikshaa/store";
import { DeliveryWorker, type EmailMessage, type Mailer } from "./delivery.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn as staffSignIn, wire, type Wiring } from "./testing/harness.js";

/**
 * Applying over HTTP (docs/HIRE-V2.md §2, §10 S4, S8, S17, F2, F7, F25; H2b):
 * the public job and careers pages, applying with a candidate session, the
 * portal and withdrawing. As `parikshaa_app`.
 */

let db: PGlite;
let sql: SqlExecutor;
let app: FastifyInstance;
let wiring: Wiring;
let sent: EmailMessage[];
let clock: number;
let owner: string;
let company: string;
let code: string;
let jobId: string;

const mailer: Mailer = {
  async send(message) {
    sent.push(message);
  },
};

const call = (token: string | null, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });

const WORD = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const resume = Buffer.from(
  zipSync({
    "[Content_Types].xml": strToU8(`<Types><Override PartName="/word/document.xml" ContentType="${WORD}.main+xml"/></Types>`),
    "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>Asha Rao, Go and SQL</w:t></w:r></w:p></w:body></w:document>`),
  }),
).toString("base64");

/** A candidate signed in, with a name and a resume on file. */
async function candidate(email: string, name = "Asha Rao"): Promise<string> {
  expect((await call(null, "POST", "/candidate/code", { email })).statusCode).toBe(200);
  const code = /^(\d{6}) is your Parikshaa code$/.exec(sent.filter((m) => m.to === email).at(-1)?.subject ?? "")?.[1] ?? "";
  const signed = await call(null, "POST", "/candidate/verify", { email, code });
  expect(signed.statusCode, signed.payload).toBe(200);
  const token = signed.json().token as string;
  expect((await call(token, "PUT", "/candidate/profile", { name, phone: "+91 98765 43210", details: { headline: "Go developer" } })).statusCode).toBe(200);
  expect((await call(token, "PUT", "/candidate/resume", { name: "cv.docx", file: resume })).statusCode).toBe(200);
  return token;
}

async function application(over: Record<string, unknown> = {}) {
  const page = (await call(null, "GET", `/hire/public/jobs/${company}/${code}`)).json();
  return { company, code, answers: { q1: "yes" }, noticeHash: page.notice.hash, adult: true, ...over };
}

async function setOrg(column: "suspended_at" | "verified_at", value: string | null) {
  await db.exec(`RESET ROLE`);
  await db.query(`UPDATE organisations SET ${column} = $1 WHERE id = 'acme'`, [value]);
  await db.exec(`SET ROLE parikshaa_app`);
}

beforeEach(async () => {
  clock = Date.parse("2026-10-12T06:00:00Z");
  sent = [];
  db = await freshDatabase();
  sql = pgliteExecutor(db);
  wiring = await wire(sql, { client: {} as unknown as Anthropic, mailer, now: () => clock });
  app = wiring.app;
  const acme = await addOrganisation(wiring.identity, "acme", "Acme Fintech");
  await addStaff(wiring.identity, acme, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await staffSignIn(app, "owner@acme.test");
  company = (await wiring.identity.getOrganisation(acme))!.publicId;
  const made = await call(owner, "POST", "/hire/jobs", {
    title: "Backend engineer",
    location: "Pune",
    applyBy: "2026-10-20",
    questions: [{ id: "q1", text: "Can you join within 30 days?", kind: "yes_no", required: true, knockout: { equals: "yes" } }],
  });
  expect(made.statusCode, made.payload).toBe(201);
  jobId = made.json().id;
  const published = await call(owner, "POST", `/hire/jobs/${jobId}/publish`);
  expect(published.statusCode, published.payload).toBe(200);
  code = published.json().publicCode;
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("the public pages", () => {
  it("show a published job and the company's careers page to anyone", async () => {
    const page = await call(null, "GET", `/hire/public/jobs/${company}/${code}`);
    expect(page.statusCode, page.payload).toBe(200);
    expect(page.json()).toMatchObject({
      company: { name: "Acme Fintech", publicId: company, verified: false },
      title: "Backend engineer",
      accepting: true,
      noindex: true,
      steps: [{ kind: "screen" }, { kind: "assessment" }, { kind: "ai_interview" }, { kind: "interview" }, { kind: "review" }, { kind: "offer" }],
      notice: { version: "hire-1", contacts: { parikshaa: { email: "grievance@parikshaa.test" } } },
    });
    // What only the company sees stays off the page.
    expect(page.json()).not.toHaveProperty("managers");
    expect(page.json()).not.toHaveProperty("screenThreshold");
    const careers = await call(null, "GET", `/hire/public/careers/${company}`);
    expect(careers.json().jobs.map((j: { code: string }) => j.code)).toEqual([code]);
  });

  it("are not found for an unknown job or a suspended company (F2)", async () => {
    expect((await call(null, "GET", `/hire/public/jobs/${company}/ZZZZZZ`)).statusCode).toBe(404);
    await setOrg("suspended_at", "2026-10-12T00:00:00Z");
    expect((await call(null, "GET", `/hire/public/jobs/${company}/${code}`)).statusCode).toBe(404);
    expect((await call(null, "GET", `/hire/public/careers/${company}`)).statusCode).toBe(404);
  });

  it("answer 503 when no grievance officer is set up (S8)", async () => {
    await app.close();
    ({ app } = await wire(sql, { client: {} as unknown as Anthropic, mailer, now: () => clock, hireGrievance: null }));
    expect((await call(null, "GET", `/hire/public/jobs/${company}/${code}`)).statusCode).toBe(503);
  });
});

describe("applying", () => {
  it("takes the application, mails the candidate, and shows it in their portal and the company's list", async () => {
    const asha = await candidate("asha@example.com");
    const made = await call(asha, "POST", "/candidate/applications", await application({ source: "careers", sourceTag: "linkedin" }));
    expect(made.statusCode, made.payload).toBe(201);
    expect(made.json()).toEqual({ id: expect.any(String), status: "active" });

    const worker = new DeliveryWorker({
      outbox: new OutboxStore(sql),
      invitations: new InvitationStore(sql),
      store: new LedgerStore(sql),
      identity: new IdentityStore(sql),
      link: () => "",
      mailer,
      sms: null,
      handlers: wiring.handlers,
      now: () => clock,
    });
    await worker.tick();
    expect(sent.at(-1)).toMatchObject({ to: "asha@example.com", subject: "Applied: Backend engineer at Acme Fintech" });

    const mine = await call(asha, "GET", "/candidate/applications");
    expect(mine.statusCode, mine.payload).toBe(200);
    expect(mine.json().applications).toMatchObject([{ id: made.json().id, company: { name: "Acme Fintech" }, status: "in_progress", canWithdraw: true }]);
    expect((await call(asha, "GET", `/candidate/applications/${made.json().id}`)).json().steps[0]).toMatchObject({ kind: "screen", state: "waiting", current: true });
    expect((await call(owner, "GET", "/hire/jobs")).json().jobs[0]).toMatchObject({ applicants: 1, active: 1 });
  });

  it("is refused without a session, with an old notice, for a minor, twice, or after the last day", async () => {
    const asha = await candidate("asha@example.com");
    expect((await call(null, "POST", "/candidate/applications", await application())).statusCode).toBe(401);
    const stale = await call(asha, "POST", "/candidate/applications", await application({ noticeHash: "old" }));
    expect([stale.statusCode, stale.json().problems]).toEqual([409, ["notice_changed"]]);
    expect((await call(asha, "POST", "/candidate/applications", await application({ adult: false }))).statusCode).toBe(422);
    expect((await call(asha, "POST", "/candidate/applications", await application({ answers: {} }))).statusCode).toBe(422);
    expect((await call(asha, "POST", "/candidate/applications", await application({ sourceTag: "<script>" }))).statusCode).toBe(400);
    expect((await call(asha, "POST", "/candidate/applications", await application())).statusCode).toBe(201);
    const again = await call(asha, "POST", "/candidate/applications", await application());
    expect([again.statusCode, again.json().problems]).toEqual([409, ["already_applied"]]);

    const body = await application();
    clock = Date.parse("2026-10-20T18:31:00Z");
    const ravi = await candidate("ravi@example.com", "Ravi");
    const late = await call(ravi, "POST", "/candidate/applications", body);
    expect([late.statusCode, late.json().problems]).toEqual([409, ["past_apply_by"]]);
  });

  it("is refused once the company is suspended (F2)", async () => {
    const asha = await candidate("asha@example.com");
    const body = await application();
    await setOrg("suspended_at", "2026-10-12T00:00:00Z");
    expect((await call(asha, "POST", "/candidate/applications", body)).statusCode).toBe(404);
  });
});

describe("withdrawing", () => {
  it("is for the candidate's own application, once", async () => {
    const asha = await candidate("asha@example.com");
    const ravi = await candidate("ravi@example.com", "Ravi");
    const id = (await call(asha, "POST", "/candidate/applications", await application())).json().id as string;
    expect((await call(ravi, "GET", `/candidate/applications/${id}`)).statusCode).toBe(404);
    expect((await call(ravi, "POST", `/candidate/applications/${id}/withdraw`)).statusCode).toBe(404);
    const done = await call(asha, "POST", `/candidate/applications/${id}/withdraw`);
    expect(done.statusCode, done.payload).toBe(200);
    expect(done.json()).toMatchObject({ status: "withdrawn", canWithdraw: false });
    expect((await call(asha, "POST", `/candidate/applications/${id}/withdraw`)).statusCode).toBe(409);
  });
});
