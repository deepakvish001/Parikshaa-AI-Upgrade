import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { pgliteExecutor, type SqlExecutor } from "@parikshaa/store";
import type { EmailMessage, Mailer } from "./delivery.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn as staffSignIn, wire, type Wiring } from "./testing/harness.js";

/**
 * A job's pipeline over HTTP (docs/HIRE-V2.md §5, §10 S7, S18, S21, S22, P14,
 * P20, F7; H2c): the table, the drawer, the resume, moving, rejecting,
 * restoring, notes and messages. As `parikshaa_app`.
 */

let db: PGlite;
let sql: SqlExecutor;
let app: FastifyInstance;
let wiring: Wiring;
let sent: EmailMessage[];
let clock: number;
const staff: Record<string, string> = {};
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
const resumeBytes = Buffer.from(
  zipSync({
    "[Content_Types].xml": strToU8(`<Types><Override PartName="/word/document.xml" ContentType="${WORD}.main+xml"/></Types>`),
    "word/document.xml": strToU8(`<w:document><w:body><w:p><w:r><w:t>Asha Rao, Go and SQL</w:t></w:r></w:p></w:body></w:document>`),
  }),
);

/** A candidate signed in, with a profile and a resume, who applies to the job. Their session token and application id. */
async function applicant(email: string, name: string): Promise<{ token: string; id: string }> {
  expect((await call(null, "POST", "/candidate/code", { email })).statusCode).toBe(200);
  const sixDigits = /^(\d{6}) is your Parikshaa code$/.exec(sent.filter((m) => m.to === email).at(-1)?.subject ?? "")?.[1] ?? "";
  const token = (await call(null, "POST", "/candidate/verify", { email, code: sixDigits })).json().token as string;
  expect((await call(token, "PUT", "/candidate/profile", { name, phone: "+91 98765 43210", details: { headline: "Go developer" } })).statusCode).toBe(200);
  expect((await call(token, "PUT", "/candidate/resume", { name: "Asha's CV.docx", file: resumeBytes.toString("base64") })).statusCode).toBe(200);
  const page = (await call(null, "GET", `/hire/public/jobs/${company}/${code}`)).json();
  const made = await call(token, "POST", "/candidate/applications", { company, code, answers: {}, noticeHash: page.notice.hash, adult: true });
  expect(made.statusCode, made.payload).toBe(201);
  clock += 60_000;
  return { token, id: made.json().id as string };
}

async function asOwner(statement: string, params: unknown[] = []) {
  await db.exec(`RESET ROLE`);
  await db.query(statement, params);
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
  const beta = await addOrganisation(wiring.identity, "beta", "Beta");
  for (const role of ["owner", "recruiter", "viewer"] as const) await addStaff(wiring.identity, acme, `${role}@acme.test`, role);
  await addStaff(wiring.identity, beta, "owner@beta.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  for (const role of ["owner", "recruiter", "viewer"]) staff[role] = await staffSignIn(app, `${role}@acme.test`);
  staff["beta"] = await staffSignIn(app, "owner@beta.test");
  company = (await wiring.identity.getOrganisation(acme))!.publicId;
  const made = await call(staff["owner"]!, "POST", "/hire/jobs", { title: "Backend engineer", location: "Pune", noteToCandidates: "We reply within a week." });
  expect(made.statusCode, made.payload).toBe(201);
  jobId = made.json().id;
  const published = await call(staff["owner"]!, "POST", `/hire/jobs/${jobId}/publish`);
  code = published.json().publicCode;
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("the pipeline", () => {
  it("lists the job's applications and opens one; a viewer sees no contact details (S22)", async () => {
    const asha = await applicant("asha@example.com", "Asha Rao");
    await applicant("ravi@example.com", "Ravi Kumar");

    const table = await call(staff["viewer"]!, "GET", `/hire/jobs/${jobId}/applications`);
    expect(table.statusCode, table.payload).toBe(200);
    expect(table.json()).toMatchObject({ job: { id: jobId, title: "Backend engineer" }, total: 2, counts: { byStatus: { active: 2 } } });
    expect(table.json().rows.map((r: { name: string }) => r.name)).toEqual(["Asha Rao", "Ravi Kumar"]);
    expect(table.payload).not.toMatch(/example\.com|98765/);
    expect((await call(staff["viewer"]!, "GET", `/hire/jobs/${jobId}/applications?search=ravi&pastSla=false`)).json().total).toBe(1);

    const seen = await call(staff["viewer"]!, "GET", `/hire/applications/${asha.id}`);
    expect(seen.statusCode, seen.payload).toBe(200);
    expect(seen.json()).toMatchObject({ name: "Asha Rao", status: "active", contact: null });
    expect(seen.payload).not.toMatch(/example\.com|98765|Go and SQL/);

    const full = (await call(staff["recruiter"]!, "GET", `/hire/applications/${asha.id}`)).json();
    expect(full.contact).toMatchObject({ email: "asha@example.com", phone: "+919876543210", resume: { type: "docx", text: "Asha Rao, Go and SQL" }, resumeDownload: false });
  });

  it("is not found by another organisation's staff", async () => {
    const asha = await applicant("asha@example.com", "Asha Rao");
    expect((await call(staff["beta"]!, "GET", `/hire/jobs/${jobId}/applications`)).statusCode).toBe(404);
    expect((await call(staff["beta"]!, "GET", `/hire/applications/${asha.id}`)).statusCode).toBe(404);
    expect((await call(staff["beta"]!, "POST", `/hire/jobs/${jobId}/applications/move`, { ids: [asha.id], to: "next" })).statusCode).toBe(404);
    expect((await call(staff["beta"]!, "POST", `/hire/applications/${asha.id}/notes`, { text: "Hello" })).statusCode).toBe(404);
  });
});

describe("deciding", () => {
  it("moves and rejects in bulk with what was done, and an override needs a real reason", async () => {
    const asha = await applicant("asha@example.com", "Asha Rao");
    const ravi = await applicant("ravi@example.com", "Ravi Kumar");
    await asOwner(`INSERT INTO hire_integrity (org_id, application_id, level) VALUES ('acme', $1, 'high')`, [ravi.id]);

    const moved = await call(staff["recruiter"]!, "POST", `/hire/jobs/${jobId}/applications/move`, { ids: [asha.id, ravi.id], to: "next" });
    expect(moved.statusCode, moved.payload).toBe(200);
    expect(moved.json()).toEqual({ done: [asha.id], refused: [{ id: ravi.id, reason: "override_needs_reason" }] });
    const short = await call(staff["recruiter"]!, "POST", `/hire/jobs/${jobId}/applications/move`, { ids: [ravi.id], to: "next", overrideReason: "ok" });
    expect([short.statusCode, short.json().problems]).toEqual([422, ["override_needs_reason"]]);
    const overridden = await call(staff["recruiter"]!, "POST", `/hire/jobs/${jobId}/applications/move`, { ids: [ravi.id], to: "next", overrideReason: "Saw their ID on the video call" });
    expect(overridden.json()).toEqual({ done: [ravi.id], refused: [] });

    const rejected = await call(staff["recruiter"]!, "POST", `/hire/jobs/${jobId}/applications/reject`, { ids: [asha.id, "nope"], rejectReason: "experience" });
    expect(rejected.json()).toEqual({ done: [asha.id], refused: [{ id: "nope", reason: "not_found" }] });
    expect((await call(staff["recruiter"]!, "POST", `/hire/jobs/${jobId}/applications/reject`, { ids: [ravi.id], rejectReason: "rude" })).statusCode).toBe(400);
    const onAi = await call(staff["recruiter"]!, "POST", `/hire/jobs/${jobId}/applications/reject`, { ids: [ravi.id], rejectReason: "skills", filter: { recommendation: "low_match" } });
    expect([onAi.statusCode, onAi.json().problems]).toEqual([422, ["reason_needed"]]);

    const table = (await call(staff["viewer"]!, "GET", `/hire/jobs/${jobId}/applications`)).json();
    expect(table.counts.byStatus).toEqual({ active: 1, rejected: 1 });
  });

  it("is refused to a viewer and to an integration (S7)", async () => {
    const asha = await applicant("asha@example.com", "Asha Rao");
    expect((await call(staff["viewer"]!, "POST", `/hire/jobs/${jobId}/applications/move`, { ids: [asha.id], to: "next" })).statusCode).toBe(403);
    expect((await call(staff["viewer"]!, "POST", `/hire/applications/${asha.id}/notes`, { text: "Hello" })).statusCode).toBe(403);
    const key = (await call(staff["owner"]!, "POST", "/api-keys", { name: "ATS", role: "recruiter" })).json().secret as string;
    expect((await call(key, "GET", `/hire/jobs/${jobId}/applications`)).statusCode).toBe(200);
    expect((await call(key, "POST", `/hire/jobs/${jobId}/applications/reject`, { ids: [asha.id], rejectReason: "skills" })).statusCode).toBe(403);
    expect((await call(key, "GET", `/hire/applications/${asha.id}/resume`)).statusCode).toBe(403);
  });

  it("restores a rejection before its mail goes; notes stay with the team, messages reach the portal (P14)", async () => {
    const asha = await applicant("asha@example.com", "Asha Rao");
    await call(staff["recruiter"]!, "POST", `/hire/jobs/${jobId}/applications/reject`, { ids: [asha.id], rejectReason: "notice" });
    clock += 60_000;
    const back = await call(staff["recruiter"]!, "POST", `/hire/applications/${asha.id}/restore`);
    expect(back.statusCode, back.payload).toBe(200);
    expect(back.json()).toMatchObject({ status: "active", rejectReason: null });
    expect((await call(staff["recruiter"]!, "POST", `/hire/applications/${asha.id}/restore`)).statusCode).toBe(409);
    const mails = await sql.transaction((tx) => tx.query<{ purpose: string; status: string }>(`SELECT purpose, status FROM outbox WHERE purpose = 'mail_rejected'`), {
      "parikshaa.org_id": "acme",
      "parikshaa.actor": "staff",
    });
    expect(mails).toEqual([{ purpose: "mail_rejected", status: "skipped" }]);

    clock += 60_000;
    const noted = await call(staff["recruiter"]!, "POST", `/hire/applications/${asha.id}/notes`, { text: "Salary ask is high" });
    expect(noted.statusCode, noted.payload).toBe(201);
    clock += 60_000;
    const messaged = await call(staff["recruiter"]!, "POST", `/hire/applications/${asha.id}/messages`, { text: "Could you share your notice period?" });
    expect(messaged.statusCode, messaged.payload).toBe(201);
    expect(messaged.json().timeline.map((e: { kind: string }) => e.kind)).toEqual(["applied", "rejected", "restored", "note", "message"]);
    expect((await call(staff["recruiter"]!, "POST", `/hire/applications/${asha.id}/messages`, { text: "" })).statusCode).toBe(422);

    const portal = await call(asha.token, "GET", `/candidate/applications/${asha.id}`);
    expect(portal.statusCode, portal.payload).toBe(200);
    expect(portal.json()).toMatchObject({ noteToCandidates: "We reply within a week.", messages: [{ text: "Could you share your notice period?" }] });
    expect(portal.payload).not.toMatch(/Salary ask|notice"|experience/);
  });
});

describe("the resume", () => {
  it("downloads as an attachment named for its type, once Parikshaa verifies the company (S18, S21)", async () => {
    const asha = await applicant("asha@example.com", "Asha Rao");
    const early = await call(staff["recruiter"]!, "GET", `/hire/applications/${asha.id}/resume`);
    expect([early.statusCode, early.json().problems]).toEqual([409, ["unverified"]]);
    expect((await call(staff["viewer"]!, "GET", `/hire/applications/${asha.id}/resume`)).statusCode).toBe(403);

    await asOwner(`UPDATE organisations SET verified_at = now(), verified_by = 'ops' WHERE id = 'acme'`);
    const file = await call(staff["recruiter"]!, "GET", `/hire/applications/${asha.id}/resume`);
    expect(file.statusCode, file.payload).toBe(200);
    expect(file.headers["content-type"]).toBe(WORD);
    expect(file.headers["content-disposition"]).toBe('attachment; filename="Asha_s CV.docx"');
    expect(file.headers["x-content-type-options"]).toBe("nosniff");
    expect(file.headers["cache-control"]).toBe("private, no-store");
    expect(file.rawPayload.equals(resumeBytes)).toBe(true);
    const audit = (await call(staff["owner"]!, "GET", "/audit")).json();
    expect(JSON.stringify(audit)).toContain("hire.resume_downloaded");
  });
});
