import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** CL62: a candidate with a disability gets compensatory time, a scribe and larger text, on the record. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");
const NOW = OPENS + 60_000;
let db: PGlite;
let app: FastifyInstance;
let owner: string;
let author: string;
let codes: Record<string, string>;

const call = (method: "GET" | "PUT" | "POST" | "DELETE", url: string, token: string | null, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => NOW });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering College");
  await addStaff(wiring.identity, org, "coe@acme.test", "owner", "Controller of Exams");
  await addStaff(wiring.identity, org, "author@acme.test", "author");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "coe@acme.test");
  author = await signIn(app, "author@acme.test");
  const mcq = { id: "q1", kind: "mcq", stem: "Pick one", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 };
  await call("POST", "/exams", owner, { id: "sem", title: "Semester exam", questions: [mcq], policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 } });
  await call("PUT", "/exams/sem/window", owner, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 4 * HOUR).toISOString() });
  await call("POST", "/exams/sem/invitations/import", owner, { csv: "ref\nPWD1\nREG1", dryRun: false, channels: [] });
  const issue = new InviteCodes(TOKEN_SECRET);
  codes = Object.fromEntries(((await call("GET", "/exams/sem/invitations", owner)).json().invitations as { id: string; candidateRef: string }[]).map((i) => [i.candidateRef, issue.issue("org-a", i.id)]));
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("arrangements for a candidate with a disability", () => {
  it("adds 20 minutes an hour to the attempt as it starts, in its ledger, and tells the candidate", async () => {
    const set = await call("PUT", "/exams/sem/accommodations/PWD1", owner, { extraPercent: 33, scribe: true, largeText: true, note: "Low vision; certificate on file" });
    expect(set.statusCode).toBe(200);
    expect(set.json()).toMatchObject({ candidateRef: "PWD1", extraPercent: 33, setBy: { name: "Controller of Exams" } });

    const brief = (await call("POST", "/invitations/briefing", null, { code: codes.PWD1 })).json();
    expect(brief.arrangements).toEqual({ extraMinutes: 20, scribe: true, largeText: true });
    expect(JSON.stringify(brief)).not.toContain("Low vision");
    expect((await call("POST", "/invitations/briefing", null, { code: codes.REG1 })).json().arrangements).toBeNull();

    const { token, attemptId } = (await call("POST", "/invitations/redeem", null, { code: codes.PWD1 })).json();
    expect((await call("GET", "/attempts/me", token)).json().expiresAt).toBe(NOW + HOUR + 20 * 60_000);
    const regular = (await call("POST", "/invitations/redeem", null, { code: codes.REG1 })).json();
    expect((await call("GET", "/attempts/me", regular.token)).json().expiresAt).toBe(NOW + HOUR);

    // In the attempt's own chain, with who granted it.
    await db.exec("RESET ROLE");
    const ledger = await db.query<{ event_type: string; event: { extraMs?: number; decidedBy?: { name: string } } }>("SELECT event_type, event FROM exam_ledger WHERE attempt_id = $1 ORDER BY seq", [attemptId]);
    expect(ledger.rows.map((r) => r.event_type).slice(0, 2)).toEqual(["attempt_started", "time_extended"]);
    expect(ledger.rows[1]!.event).toMatchObject({ extraMs: 20 * 60_000, decidedBy: { name: "Controller of Exams" } });
  });

  it("keeps the note from the audit log, and is for staff who may give extra time", async () => {
    expect((await call("PUT", "/exams/sem/accommodations/PWD1", author, { extraPercent: 33 })).statusCode).toBe(403);
    await call("PUT", "/exams/sem/accommodations/PWD1", owner, { extraPercent: 0, scribe: true, note: "Cerebral palsy" });
    const audit = JSON.stringify((await call("GET", "/audit", owner)).json());
    expect(audit).toContain("candidate.accommodated");
    expect(audit).not.toContain("Cerebral palsy");
    const listed = (await call("GET", "/exams/sem/accommodations", owner)).json().accommodations;
    expect(listed).toEqual([expect.objectContaining({ candidateRef: "PWD1", scribe: true, note: "Cerebral palsy" })]);
    expect((await call("DELETE", "/exams/sem/accommodations/PWD1", owner)).statusCode).toBe(200);
    expect((await call("GET", "/exams/sem/accommodations", owner)).json().accommodations).toEqual([]);
  });

  it("keeps the note sealed at rest", async () => {
    await call("PUT", "/exams/sem/accommodations/PWD1", owner, { extraPercent: 25, note: "Dyslexia" });
    await db.exec("RESET ROLE");
    const raw = await db.query<{ note: string }>("SELECT note FROM accommodations");
    expect(raw.rows[0]!.note).toMatch(/^enc:v1:/);
  });
});
