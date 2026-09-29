import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyChain, type LedgerEntry } from "@parikshaa/core";
import { pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import type { PrivacyService } from "./privacy.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** ROADMAP §11: notice and consent, a candidate's own data, erasure and retention. Runs as `parikshaa_app`. */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const OPENS = Date.parse("2026-10-01T04:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let privacy: PrivacyService;
let clock: number;
let owner: string;
let invigilator: string;

const SETTINGS = {
  controllerName: "Acme Technologies Pvt Ltd",
  grievanceName: "Priya Menon, Grievance Officer",
  grievanceEmail: "privacy@acme.test",
  purpose: "To assess candidates for software engineering roles.",
  retentionDays: 30,
};

beforeEach(async () => {
  clock = OPENS;
  db = await freshDatabase();
  ({ app, identity, privacy } = await wire(pgliteExecutor(db), { client: fakeModel().client, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner", "Asha Rao");
  await addStaff(identity, org, "inv@acme.test", "invigilator", "Meera Nair");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  invigilator = await signIn(app, "inv@acme.test");
  const res = await call("POST", owner, "/exams", {
    id: "drive",
    title: "Campus drive",
    questions: [
      { id: "q1", kind: "mcq", stem: "Pick", maxScore: 2, rubric: [], options: ["a", "b"], correctIndex: 0 },
      { id: "q2", kind: "numeric", stem: "2+2", maxScore: 1, rubric: [], expected: 4, tolerance: 0 },
    ],
    policy: { durationMs: 60 * MINUTE, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  expect(res.statusCode, res.payload).toBe(201);
  await call("PUT", owner, "/exams/drive/window", { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * 60 * MINUTE).toISOString() });
  await call("POST", owner, "/exams/drive/invitations/import", {
    csv: "ref,name,email,phone\nROLL-2231,Ananya Iyer,ananya@college.test,9876543210\nROLL-2232,Bala,bala@college.test,",
    dryRun: false,
    channels: [],
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });

async function codeFor(ref: string): Promise<string> {
  const list = (await call("GET", owner, "/exams/drive/invitations")).json().invitations as { id: string; candidateRef: string }[];
  return new InviteCodes(TOKEN_SECRET).issue("org-a", list.find((i) => i.candidateRef === ref)!.id);
}

const redeem = async (ref: string, consent?: { noticeVersion: number }) =>
  call("POST", null, "/invitations/redeem", { code: await codeFor(ref), ...(consent === undefined ? {} : { consent }) });

/** Sit the exam as `ref` and submit it. */
async function sit(ref: string, noticeVersion = 1): Promise<{ token: string; attemptId: string }> {
  const opened = await redeem(ref, { noticeVersion });
  expect(opened.statusCode, opened.payload).toBe(200);
  const { token, attemptId } = opened.json();
  await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "My answer, in my own words" });
  await call("POST", token, "/attempts/me/submit");
  return { token, attemptId };
}

const receipt = async (token: string): Promise<LedgerEntry[]> => (await call("GET", token, "/attempts/me/ledger")).json().entries;

describe("the privacy notice", () => {
  it("is set by an owner, and moves to a new version only when its wording changes", async () => {
    const saved = await call("PUT", owner, "/privacy", SETTINGS);
    expect(saved.statusCode, saved.payload).toBe(200);
    expect(saved.json().notice).toMatchObject({ version: 1, controllerName: SETTINGS.controllerName, retentionDays: 30 });
    expect(saved.json().notice.hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await call("PUT", owner, "/privacy", SETTINGS)).json().notice.version).toBe(1);
    expect((await call("PUT", owner, "/privacy", { ...SETTINGS, retentionDays: 90 })).json().notice.version).toBe(2);
    expect((await call("GET", owner, "/privacy")).json().settings).toMatchObject({ retentionDays: 90, noticeVersion: 2 });

    const actions = (await call("GET", owner, "/audit")).json().entries.map((e: { action: string }) => e.action);
    expect(actions).toContain("privacy.saved");
  });

  it("is refused to anyone but an owner, and without somewhere to complain to", async () => {
    expect((await call("PUT", invigilator, "/privacy", SETTINGS)).statusCode).toBe(403);
    expect((await call("GET", invigilator, "/privacy")).statusCode).toBe(403);
    expect((await call("PUT", owner, "/privacy", { ...SETTINGS, grievanceEmail: "not an address" })).statusCode).toBe(422);
    expect((await call("PUT", owner, "/privacy", { ...SETTINGS, purpose: " " })).statusCode).toBe(422);
    expect((await call("PUT", owner, "/privacy", { ...SETTINGS, retentionDays: 3 })).statusCode).toBe(400);
  });
});

describe("consent", () => {
  it("is not asked for by an organisation without a notice", async () => {
    expect((await redeem("ROLL-2231")).statusCode).toBe(200);
  });

  it("comes before the clock: the first opening gets the notice, and agreeing starts the attempt", async () => {
    await call("PUT", owner, "/privacy", SETTINGS);

    const asked = await redeem("ROLL-2231");
    expect(asked.statusCode).toBe(428);
    const { notice } = asked.json();
    expect(notice).toMatchObject({ version: 1, grievance: { email: "privacy@acme.test" }, purpose: SETTINGS.purpose });
    expect(notice.collected.length).toBeGreaterThan(0);
    expect(notice.rights.length).toBeGreaterThan(0);
    // The briefing shows the same notice first, so the page can ask before opening.
    const brief = await call("POST", null, "/invitations/briefing", { code: await codeFor("ROLL-2231") });
    expect(brief.json().notice).toEqual(notice);
    // Nothing started: the invitation is still unopened.
    const list = (await call("GET", owner, "/exams/drive/invitations")).json().invitations;
    expect(list.find((i: { candidateRef: string }) => i.candidateRef === "ROLL-2231").attemptState).toBe("not_started");

    expect((await redeem("ROLL-2231", { noticeVersion: 0 + 2 })).statusCode).toBe(428); // not the current one
    const opened = await redeem("ROLL-2231", { noticeVersion: 1 });
    expect(opened.statusCode, opened.payload).toBe(200);

    // Resuming does not ask again, even after the wording changes.
    expect((await call("POST", null, "/invitations/briefing", { code: await codeFor("ROLL-2231") })).json().notice).toBeNull();
    await call("PUT", owner, "/privacy", { ...SETTINGS, purpose: "Something else entirely." });
    expect((await redeem("ROLL-2231")).statusCode).toBe(200);

    const { token } = opened.json();
    await call("POST", token, "/attempts/me/submit");
    const entries = await receipt(token);
    expect(verifyChain(entries)).toEqual({ ok: true });
    expect(entries[1]!.event).toEqual({ type: "consent_given", attemptId: opened.json().attemptId, noticeVersion: 1, noticeHash: notice.hash });
  });
});

describe("a candidate's own data", () => {
  it("is theirs to download: who they are, what they agreed to, what they wrote — no scores", async () => {
    await call("PUT", owner, "/privacy", SETTINGS);
    const { token } = await sit("ROLL-2231");

    const data = (await call("GET", token, "/attempts/me/data")).json();
    expect(data).toMatchObject({
      organisation: "Acme",
      exam: { id: "drive", title: "Campus drive" },
      you: { reference: "ROLL-2231", name: "Ananya Iyer", email: "ananya@college.test", phone: "919876543210" },
      consent: { noticeVersion: 1 },
      erased: false,
      answers: [{ questionId: "q1", answer: "My answer, in my own words" }],
    });
    expect(data.timeline.map((t: { event: string }) => t.event)).toEqual(["attempt_started", "consent_given", "answer_submitted", "attempt_submitted"]);
    expect(JSON.stringify(data)).not.toMatch(/score|verdict/i);
  });

  it("is sealed in the ledger itself, and in the receipt", async () => {
    const { token } = await sit("ROLL-2231", 1);
    const raw = JSON.stringify(await receipt(token));
    expect(raw).not.toContain("My answer, in my own words");
    expect(raw).not.toContain("ROLL-2231");
  });
});

describe("erasure", () => {
  beforeEach(async () => {
    await call("PUT", owner, "/privacy", SETTINGS);
  });

  it("waits until the attempt has closed", async () => {
    const opened = (await redeem("ROLL-2231", { noticeVersion: 1 })).json();
    expect((await call("POST", owner, `/attempts/${opened.attemptId}/erase`)).statusCode).toBe(409);
  });

  it("makes the answers and the person unreadable, keeps the scores, and leaves the chain verifying", async () => {
    const { token, attemptId } = await sit("ROLL-2231");
    expect((await call("POST", owner, `/attempts/${attemptId}/grade`)).statusCode).toBe(200);

    const erased = await call("POST", owner, `/attempts/${attemptId}/erase`);
    expect(erased.statusCode, erased.payload).toBe(200);
    expect(erased.json()).toEqual({ erased: true });
    expect((await call("POST", owner, `/attempts/${attemptId}/erase`)).json()).toEqual({ erased: false });

    const data = (await call("GET", token, "/attempts/me/data")).json();
    expect(data).toMatchObject({ erased: true, you: null, answers: [{ questionId: "q1", answer: "[erased]" }] });

    const entries = await receipt(token);
    expect(verifyChain(entries)).toEqual({ ok: true });
    expect(entries.at(-1)!.event).toMatchObject({ type: "data_erased", reason: "request", decidedBy: { name: "Asha Rao" } });

    const results = await call("GET", owner, "/exams/drive/results");
    expect(results.payload).not.toContain("Ananya");
    expect(results.payload).not.toContain("ROLL-2231");
    const invitations = await call("GET", owner, "/exams/drive/invitations");
    expect(invitations.payload).not.toContain("ananya@college.test");

    const audit = (await call("GET", owner, "/audit")).json().entries as { action: string; detail: object }[];
    expect(audit.map((e) => e.action)).toContain("attempt.erased");
    expect(JSON.stringify(audit)).not.toMatch(/ROLL-2231|Ananya|ananya@/);
  });

  it("stops an ungraded attempt being graded: it can only be set aside", async () => {
    const { attemptId } = await sit("ROLL-2231");
    await call("POST", owner, `/attempts/${attemptId}/erase`);
    expect((await call("POST", owner, `/attempts/${attemptId}/grade`)).statusCode).toBe(409);
    expect((await call("POST", owner, `/attempts/${attemptId}/reopen`, { minutes: 10, reason: "Asked to reopen it after all." })).statusCode).toBe(409);
    expect((await call("POST", owner, `/attempts/${attemptId}/void`, { reason: "Erased at the candidate's request before grading." })).statusCode).toBe(200);
  });

  it("is an owner's decision", async () => {
    const { attemptId } = await sit("ROLL-2231");
    expect((await call("POST", invigilator, `/attempts/${attemptId}/erase`)).statusCode).toBe(403);
  });
});

describe("retention", () => {
  it("erases attempts once the organisation's period has run out — one abandoned mid-way too, closed first", async () => {
    await call("PUT", owner, "/privacy", { ...SETTINGS, retentionDays: 7 });
    const done = await sit("ROLL-2231");
    const abandoned = (await redeem("ROLL-2232", { noticeVersion: 1 })).json();
    await call("PUT", abandoned.token, "/attempts/me/drafts/q2", { answer: "4" });

    clock += 6 * DAY;
    expect(await privacy.sweep()).toBe(0);
    clock += 2 * DAY;
    expect(await privacy.sweep()).toBe(2);
    expect(await privacy.sweep()).toBe(0);

    expect((await call("GET", done.token, "/attempts/me/data")).json()).toMatchObject({ erased: true, you: null });
    const left = (await receipt(abandoned.token)).map((e) => e.event.type);
    // Closed as the next write would have closed it — the draft saved in time committed — then erased.
    expect(left.slice(-3)).toEqual(["answer_submitted", "attempt_submitted", "data_erased"]);
    const last = (await receipt(done.token)).at(-1)!.event;
    expect(last).toEqual({ type: "data_erased", attemptId: done.attemptId, reason: "retention" });
  });
});
