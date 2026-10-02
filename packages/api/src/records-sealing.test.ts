import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import type { PrivacyService } from "./privacy.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** T1: records outside the ledger are kept sealed, read back plain, and swept with the retention period. */

const DAY = 86_400_000;
let db: PGlite;
let app: FastifyInstance;
let owner: string;
let privacy: PrivacyService;
let clock = Date.parse("2026-10-05T05:00:00Z");

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("the candidate's own handwriting")]);
const call = (method: "GET" | "POST" | "PUT", url: string, payload?: object) => app.inject({ method, url, headers: bearer(owner), ...(payload === undefined ? {} : { payload }) });

/** What the table holds, read past row-level security as the database's owner would. */
async function raw<T>(sql: string): Promise<T[]> {
  await db.exec("RESET ROLE");
  const rows = (await db.query<T>(sql)).rows;
  await db.exec("SET ROLE parikshaa_app");
  return rows;
}

beforeEach(async () => {
  clock = Date.parse("2026-10-05T05:00:00Z");
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => clock });
  app = wiring.app;
  privacy = wiring.privacy;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme College");
  await addStaff(wiring.identity, org, "hod@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hod@acme.test");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("sealed records", () => {
  it("keeps a student's email and phone sealed in the table and plain through the console", async () => {
    await call("POST", "/students/import", { csv: "roll_number,name,email,phone\nCS001,Ananya,ananya@college.test,9812345678", dryRun: false });
    const [row] = await raw<{ email: string; phone: string }>("SELECT email, phone FROM students");
    expect(row!.email).toMatch(/^enc:v1:/);
    expect(row!.phone).toMatch(/^enc:v1:/);
    expect(JSON.stringify(row)).not.toContain("ananya@");
    expect((await call("GET", "/students")).json().students[0]).toMatchObject({ email: "ananya@college.test", phone: "919812345678" });
  });

  it("keeps an interview's code, notes and email sealed", async () => {
    const i = (await call("POST", "/interviews", { title: "Round 1", candidateName: "Rohan", candidateEmail: "rohan@x.test", scheduledAt: "2026-10-06T10:00:00+05:30" })).json();
    await call("PUT", `/interviews/${i.id}`, { notes: "Strong on graphs" });
    const [row] = await raw<{ code: string; notes: string; candidate_email: string }>("SELECT code, notes, candidate_email FROM interviews");
    expect(row!.notes).toMatch(/^enc:v1:/);
    expect(row!.candidate_email).toMatch(/^enc:v1:/);
    expect((await call("GET", `/interviews/${i.id}`)).json()).toMatchObject({ notes: "Strong on graphs", candidateEmail: "rohan@x.test" });
  });

  it("keeps scanned pages sealed, serves them as they were, and sweeps old copies and interviews", async () => {
    await call("POST", "/exams", {
      id: "bio",
      title: "Biology",
      questions: [{ id: "q1", kind: "short", stem: "Explain osmosis.", maxScore: 5, rubric: [{ id: "c1", description: "Membrane", weight: 1 }], expectedPoints: ["membrane"] }],
      policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
    });
    const script = (await call("POST", "/exams/bio/scripts/pages", { ref: "R1", image: PNG.toString("base64") })).json().script;
    const [page] = await raw<{ bytes: Uint8Array; sealed: boolean }>("SELECT bytes, sealed FROM answer_script_pages");
    expect(page!.sealed).toBe(true);
    expect(Buffer.from(page!.bytes).includes(Buffer.from("handwriting"))).toBe(false);
    expect((await call("GET", `/scripts/${script.id}/pages/1`)).rawPayload.equals(PNG)).toBe(true);
    await call("POST", `/scripts/${script.id}/suggest`);
    const [copy] = await raw<{ suggestion: unknown }>("SELECT suggestion FROM answer_scripts");
    expect(JSON.stringify(copy!.suggestion)).not.toContain("Photosynthesis");
    expect((await call("GET", `/scripts/${script.id}`)).json().suggestion.questions[0].transcript).toContain("Photosynthesis");

    const done = (await call("POST", "/interviews", { title: "Old", candidateName: "A", scheduledAt: "2026-10-05T04:00:00Z" })).json();
    await call("PUT", `/interviews/${done.id}`, { cancel: true });
    const upcoming = (await call("POST", "/interviews", { title: "Later", candidateName: "B", scheduledAt: "2027-02-01T04:00:00Z" })).json();

    // Nothing is swept for an organisation without a retention period.
    clock += 40 * DAY;
    await privacy.sweep();
    expect((await call("GET", `/scripts/${script.id}`)).statusCode).toBe(200);
    await call("PUT", "/privacy", { controllerName: "Acme College", grievanceName: "Registrar", grievanceEmail: "registrar@acme.test", purpose: "Internal exams.", retentionDays: 30 });
    expect(await privacy.sweep()).toBe(2);
    expect((await call("GET", `/scripts/${script.id}`)).statusCode).toBe(404);
    expect((await call("GET", `/interviews/${done.id}`)).statusCode).toBe(404);
    expect((await call("GET", `/interviews/${upcoming.id}`)).statusCode).toBe(200);
    expect(JSON.stringify((await call("GET", "/audit")).json())).toContain("records.erased");
  });
});
