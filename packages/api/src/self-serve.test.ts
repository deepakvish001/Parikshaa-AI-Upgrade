import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DSA_STARTER } from "./content/dsa-starter.js";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { STARTER_QUESTIONS, type SignupPolicy } from "./onboarding.js";
import { bearer, freshDatabase, TOKEN_SECRET, wire } from "./testing/harness.js";

/**
 * A startup's own way in (plan row 89): signing up as a company, a test from
 * the role library, candidates sitting it, and a shortlist for the hiring
 * manager, with nobody from Parikshaa in between.
 */

const HOUR = 3_600_000;
const POLICY: SignupPolicy = { trialCredits: 10, pricePaise: 4_900 };

let workRoot: string;
const runner: CodeRunner = { run: (request) => execute(request, { workRoot, slot: null }) };
let db: PGlite | undefined;
let app: FastifyInstance | undefined;

beforeAll(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "self-serve-"));
});

afterEach(async () => {
  await app?.close();
  await db?.close();
  app = undefined;
  db = undefined;
});

describe("a startup hiring on its own", () => {
  it("signs up as a company, builds a test from a role, sends it and shares a shortlist", { timeout: 120_000 }, async () => {
    const began = Date.now();
    let clock = Date.parse("2026-10-03T05:00:00Z");
    const mail = new OutboxLog();
    db = await freshDatabase();
    const sql = pgliteExecutor(db);
    const wiring = await wire(sql, { client: fakeModel({ latencyMs: 0 }).client, signup: POLICY, mailer: mail, runner, now: () => clock });
    await db.exec(`SET ROLE parikshaa_app`);
    app = wiring.app;
    const worker = new DeliveryWorker({
      outbox: new OutboxStore(sql),
      invitations: new InvitationStore(sql),
      store: new LedgerStore(sql),
      identity: new IdentityStore(sql),
      link: () => "",
      mailer: mail,
      sms: null,
      handlers: wiring.handlers,
    });
    const open = (method: "GET" | "POST", url: string, payload?: object) => app!.inject({ method, url, ...(payload === undefined ? {} : { payload }) });

    // 1. Sign up, as a company.
    const signed = await open("POST", "/auth/signup", { organisation: "Kiranshala Labs", name: "Neha Iyer", email: "neha@kiranshala.test", password: "a long startup password", kind: "company" });
    expect(signed.statusCode, signed.payload).toBe(201);
    const token: string = signed.json().token;
    const as = (method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
      app!.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
    const me = (await as("GET", "/auth/me")).json();
    expect(me.organisation.kind).toBe("company");
    const orgId: string = me.organisation.id;

    await worker.tick();
    const verify = mail.sent.find((m): m is EmailMessage => "subject" in m && m.to === "neha@kiranshala.test")!;
    const link = /\?verify=([^\s]+)/.exec(verify.text)![1]!;
    expect((await open("POST", "/auth/verify-email", { token: decodeURIComponent(link) })).statusCode).toBe(200);

    let setup = (await as("GET", "/dashboard")).json().setup;
    expect(setup).toMatchObject({ kind: "company", bankQuestions: 0, starterQuestions: 0, exams: 0, invited: 0, finished: 0, shortlists: 0, prepaidCredits: 10 });

    // 2. An empty bank takes the starter questions in, once.
    const starter = (await as("POST", "/onboarding/starter")).json();
    expect(starter.added).toBe(STARTER_QUESTIONS.length);
    expect((await as("POST", "/onboarding/starter")).json()).toEqual({ added: 0 });

    // 3. Choose a role: the intern test fills both its sections from them.
    const draft = (await as("POST", "/job-tests/draft", { roleId: "sde-intern" })).json();
    const sections = draft.sections as { title: string; pick: number; pool: { id: string }[] }[];
    expect(sections.map((s) => [s.title, s.pick])).toEqual([
      ["CS fundamentals", 8],
      ["Coding", 2],
    ]);
    for (const s of sections) expect(s.pool.length, s.title).toBeGreaterThanOrEqual(s.pick);
    const saved = await as("POST", "/job-tests", {
      title: draft.title,
      durationMinutes: draft.durationMinutes,
      cutoffPercent: draft.cutoffPercent,
      sections: sections.map((s) => ({ title: s.title, questionIds: s.pool.map((q) => q.id), pick: s.pick })),
    });
    expect(saved.statusCode, saved.payload).toBe(201);
    const examId: string = saved.json().examId;

    // 4. Send it to two candidates.
    await as("PUT", `/exams/${examId}/window`, { opensAt: new Date(clock).toISOString(), closesAt: new Date(clock + 3 * HOUR).toISOString() });
    const imported = await as("POST", `/exams/${examId}/invitations/import`, { csv: "ref,name,email\nK1,Arjun,arjun@x.test\nK2,Divya,divya@x.test", dryRun: false, channels: [] });
    expect(imported.json()).toMatchObject({ invited: 2 });
    clock += 60_000;

    // 5. They sit it: Arjun answers everything right, Divya leaves it blank.
    const right = new Map(STARTER_QUESTIONS.flatMap((d) => (d.question.kind === "mcq" ? [[d.question.stem, String(d.question.correctIndex)] as const] : [])));
    const programs = new Map(DSA_STARTER.problems.map((p) => [p.statement, p.reference]));
    const codes = new InviteCodes(TOKEN_SECRET);
    const invitations = (await as("GET", `/exams/${examId}/invitations`)).json().invitations as { id: string; candidateRef: string }[];
    for (const inv of invitations) {
      const opened = (await open("POST", "/invitations/redeem", { code: codes.issue(orgId, inv.id) })).json();
      const candidate = (method: "GET" | "POST", url: string, payload?: object) =>
        app!.inject({ method, url, headers: bearer(opened.token), ...(payload === undefined ? {} : { payload }) });
      if (inv.candidateRef === "K1") {
        const questions = (await candidate("GET", "/attempts/me")).json().exam.questions as { id: string; kind: string; stem: string }[];
        expect(questions).toHaveLength(10);
        for (const q of questions) {
          const answer = q.kind === "code" ? JSON.stringify({ language: "python", source: programs.get(q.stem)! }) : right.get(q.stem)!;
          expect(answer, q.stem).toBeDefined();
          expect((await candidate("POST", "/attempts/me/answers", { questionId: q.id, answer })).statusCode, q.stem).toBeLessThan(300);
        }
      }
      expect((await candidate("POST", "/attempts/me/submit")).statusCode).toBeLessThan(300);
      expect((await as("POST", `/attempts/${opened.attemptId}/grade`)).statusCode).toBe(200);
    }

    // 6. A shortlist for the hiring manager: the qualified, by default.
    const made = await as("POST", `/exams/${examId}/shortlists`, { title: "Interns — round 2", days: 7 });
    expect(made.statusCode, made.payload).toBe(201);
    const code = new URL(made.json().link).searchParams.get("shortlist")!;
    const view = (await open("GET", `/shortlists/view/${encodeURIComponent(code)}`)).json();
    expect(view.institution).toBe("Kiranshala Labs");
    expect(view.candidates).toEqual([expect.objectContaining({ ref: "K1", percent: 100, outcome: "qualified" })]);

    setup = (await as("GET", "/dashboard")).json().setup;
    expect(setup).toMatchObject({ kind: "company", starterQuestions: STARTER_QUESTIONS.length, bankQuestions: 0, exams: 1, invited: 2, finished: 2, shortlists: 1, prepaidCredits: 8 });
    // The blueprint's bar: the whole way, signing up to a shortlist, well inside ten minutes.
    expect(Date.now() - began).toBeLessThan(10 * 60_000);
  });

  it("is an institution unless it says otherwise", async () => {
    db = await freshDatabase();
    const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, signup: POLICY });
    await db.exec(`SET ROLE parikshaa_app`);
    app = wiring.app;
    const signed = await app.inject({ method: "POST", url: "/auth/signup", payload: { organisation: "Nalanda College", name: "Asha", email: "asha@nalanda.test", password: "a long pilot password" } });
    const token: string = signed.json().token;
    expect((await app.inject({ method: "GET", url: "/auth/me", headers: bearer(token) })).json().organisation.kind).toBe("institution");
    expect((await app.inject({ method: "GET", url: "/dashboard", headers: bearer(token) })).json().setup.kind).toBe("institution");
    const odd = await app.inject({ method: "POST", url: "/auth/signup", payload: { organisation: "X Co", name: "X", email: "x@x.test", password: "a long pilot password", kind: "agency" } });
    expect(odd.statusCode).toBe(400);
  });
});
