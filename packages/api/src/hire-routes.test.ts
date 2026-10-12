import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, pgliteExecutor, type StaffRole } from "@parikshaa/store";
import { asksForMoney, questionProblems, roundProblems } from "./hire.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * A company's jobs (docs/HIRE-V2.md §1, §3, §10 S7, S18, S23, P1, P3, P20,
 * F3, F6, F7; H2a), over HTTP, as `parikshaa_app`.
 */

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let clock: number;
const tokens: Partial<Record<string, string>> = {};

const call = (token: string | null, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });

const JOB = {
  title: "Backend engineer",
  location: "Pune",
  workMode: "hybrid",
  expMin: 2,
  expMax: 5,
  skillsMust: ["Go", "SQL"],
  description: "Build the payments API.",
  questions: [{ id: "q1", text: "Can you join within 30 days?", kind: "yes_no", required: true, knockout: { equals: "yes" } }],
};

const as = (role: StaffRole | "acmeOwner" | "betaOwner") => tokens[role]!;

async function verify(org: string) {
  await db.exec(`RESET ROLE`);
  await db.query(`UPDATE organisations SET verified_at = now(), verified_by = 'ops' WHERE id = $1`, [org]);
  await db.exec(`SET ROLE parikshaa_app`);
}

beforeEach(async () => {
  clock = Date.parse("2026-10-12T06:00:00Z");
  db = await freshDatabase();
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => clock }));
  const acme = await addOrganisation(identity, "acme", "Acme");
  const beta = await addOrganisation(identity, "beta", "Beta");
  await addStaff(identity, acme, "owner@acme.test", "owner");
  await addStaff(identity, beta, "owner@beta.test", "owner");
  for (const role of ["author", "reviewer", "viewer", "invigilator", "recruiter", "hiring_manager"] as const) {
    await addStaff(identity, acme, `${role}@acme.test`, role);
  }
  await db.exec(`SET ROLE parikshaa_app`);
  tokens["acmeOwner"] = await signIn(app, "owner@acme.test");
  tokens["betaOwner"] = await signIn(app, "owner@beta.test");
  for (const role of ["author", "reviewer", "viewer", "invigilator", "recruiter", "hiring_manager"] as const) {
    tokens[role] = await signIn(app, `${role}@acme.test`);
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("writing a job", () => {
  it("makes a draft with the usual six rounds, and changes it", async () => {
    const made = await call(as("recruiter"), "POST", "/hire/jobs", JOB);
    expect(made.statusCode, made.payload).toBe(201);
    const job = made.json();
    expect(job).toMatchObject({ title: "Backend engineer", status: "draft", publicCode: null, workMode: "hybrid", employment: "full_time", openings: 1 });
    expect(job.rounds.map((r: { kind: string }) => r.kind)).toEqual(["screen", "assessment", "ai_interview", "interview", "review", "offer"]);

    const [screen, , , interview, , offer] = job.rounds;
    const changed = await call(as("recruiter"), "PUT", `/hire/jobs/${job.id}`, { ...JOB, title: "Senior backend engineer", rounds: [screen, interview, offer] });
    expect(changed.statusCode, changed.payload).toBe(200);
    expect(changed.json().rounds.map((r: { id: string }) => r.id)).toEqual([screen.id, interview.id, offer.id]);
    expect((await call(as("viewer"), "GET", `/hire/jobs/${job.id}`)).json().title).toBe("Senior backend engineer");
  });

  it("refuses rounds out of order, and says what is wrong", async () => {
    const res = await call(as("acmeOwner"), "POST", "/hire/jobs", {
      ...JOB,
      rounds: [
        { kind: "assessment", title: "Test", config: { daysToComplete: 30 } },
        { kind: "screen", title: "Screen" },
      ],
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().problems).toEqual([
      "The screening round comes first.",
      "The offer is the last round, and there is one.",
      "Round 1: daysToComplete must be between 1 and 14.",
    ]);
  });

  it("will not let a question turn people away for who they are (S23)", async () => {
    for (const text of ["What is your age?", "Are you married?", "What is your religion?", "Do you have a disability?", "Which caste do you belong to?"]) {
      const res = await call(as("acmeOwner"), "POST", "/hire/jobs", { ...JOB, questions: [{ id: "q", text, kind: "yes_no", required: true, knockout: { equals: "no" } }] });
      expect(res.statusCode, text).toBe(422);
      expect(res.json().problems[0]).toContain("cannot turn applicants away");
    }
    // Asked without a knockout, and a knockout on the work itself, are fine.
    const ok = await call(as("acmeOwner"), "POST", "/hire/jobs", {
      ...JOB,
      questions: [
        { id: "q1", text: "Years of Go experience", kind: "number", required: true, knockout: { min: 2 } },
        { id: "q2", text: "Preferred location", kind: "choice", options: ["Pune", "Remote"], required: false, knockout: { oneOf: ["Pune", "Remote"] } },
      ],
    });
    expect(ok.statusCode, ok.payload).toBe(201);
  });

  it("takes as hiring managers only staff of the company", async () => {
    const res = await call(as("acmeOwner"), "POST", "/hire/jobs", { ...JOB, managers: ["someone-else"] });
    expect(res.statusCode).toBe(422);
    expect(res.json().problems).toEqual(["A hiring manager is not a member of staff here."]);
  });
});

describe("publishing", () => {
  it("gives a job its address once, then pauses, closes and copies it", async () => {
    await verify("acme");
    const job = (await call(as("acmeOwner"), "POST", "/hire/jobs", JOB)).json();
    const open = (await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/publish`)).json();
    expect(open).toMatchObject({ status: "open", publicCode: expect.stringMatching(/^[A-HJ-NP-Z2-9]{6}$/) });
    expect((await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/pause`)).json().status).toBe("paused");
    expect((await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/publish`)).json().publicCode).toBe(open.publicCode);
    expect((await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/close`)).json().status).toBe("closed");
    expect((await call(as("acmeOwner"), "PUT", `/hire/jobs/${job.id}`, JOB)).statusCode).toBe(409);
    const copy = await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/duplicate`);
    expect(copy.statusCode).toBe(201);
    expect(copy.json()).toMatchObject({ title: "Backend engineer (copy)", status: "draft", publicCode: null });
    expect(copy.json().rounds).toHaveLength(6);
    const list = (await call(as("viewer"), "GET", "/hire/jobs")).json().jobs;
    expect(list.map((j: { title: string; status: string }) => [j.title, j.status])).toEqual(
      expect.arrayContaining([
        ["Backend engineer", "closed"],
        ["Backend engineer (copy)", "draft"],
      ]),
    );
  });

  it("refuses a job whose last day to apply has passed", async () => {
    const job = (await call(as("acmeOwner"), "POST", "/hire/jobs", { ...JOB, applyBy: "2026-10-11" })).json();
    expect((await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/publish`)).statusCode).toBe(422);
  });

  it("deletes a draft, but not a published job", async () => {
    const draft = (await call(as("acmeOwner"), "POST", "/hire/jobs", JOB)).json();
    const published = (await call(as("acmeOwner"), "POST", "/hire/jobs", JOB)).json();
    await call(as("acmeOwner"), "POST", `/hire/jobs/${published.id}/publish`);
    expect((await call(as("acmeOwner"), "DELETE", `/hire/jobs/${published.id}`)).statusCode).toBe(409);
    expect((await call(as("acmeOwner"), "DELETE", `/hire/jobs/${draft.id}`)).statusCode).toBe(200);
    expect((await call(as("acmeOwner"), "GET", `/hire/jobs/${draft.id}`)).statusCode).toBe(404);
  });
});

describe("a company Parikshaa has not verified yet (S18, P1, F3)", () => {
  it("has no AI screening, at most a hundred applications a job, and two open jobs", async () => {
    const job = (await call(as("acmeOwner"), "POST", "/hire/jobs", { ...JOB, autoScreen: true, maxApplicants: 500 })).json();
    expect(job).toMatchObject({ autoScreen: false, maxApplicants: 100 });
    for (let n = 0; n < 2; n++) {
      const other = (await call(as("acmeOwner"), "POST", "/hire/jobs", JOB)).json();
      expect((await call(as("acmeOwner"), "POST", `/hire/jobs/${other.id}/publish`)).statusCode).toBe(200);
    }
    const third = await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/publish`);
    expect(third.statusCode).toBe(409);
    expect(third.json().error).toBe("limit");

    await verify("acme");
    expect((await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/publish`)).statusCode).toBe(200);
    const unlimited = (await call(as("acmeOwner"), "PUT", `/hire/jobs/${job.id}`, { ...JOB, autoScreen: true, maxApplicants: 500 })).json();
    expect(unlimited).toMatchObject({ autoScreen: true, maxApplicants: 500 });
  });

  it("is held for Parikshaa when the job asks applicants for money", async () => {
    const job = (await call(as("acmeOwner"), "POST", "/hire/jobs", { ...JOB, description: "Selected candidates pay a refundable security deposit of ₹5,000." })).json();
    const held = await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/publish`);
    expect(held.json()).toMatchObject({ status: "held", publicCode: null, heldReason: expect.stringContaining("asks applicants for money") });
    expect((await call(as("acmeOwner"), "POST", `/hire/jobs/${job.id}/publish`)).statusCode).toBe(409);
  });
});

describe("who may (S7, P3, F6)", () => {
  it("lets each role do what it holds", async () => {
    expect((await call(as("viewer"), "POST", "/hire/jobs", JOB)).statusCode).toBe(403);
    expect((await call(as("reviewer"), "POST", "/hire/jobs", JOB)).statusCode).toBe(403);
    expect((await call(as("hiring_manager"), "POST", "/hire/jobs", JOB)).statusCode).toBe(403);
    expect((await call(as("invigilator"), "GET", "/hire/jobs")).statusCode).toBe(403);
    expect((await call(as("author"), "POST", "/hire/jobs", JOB)).statusCode).toBe(201);
    expect((await call(null, "GET", "/hire/jobs")).statusCode).toBe(401);
  });

  it("shows a hiring manager only the jobs they manage", async () => {
    const managerId = (await call(as("hiring_manager"), "GET", "/auth/me")).json().id as string;
    const theirs = (await call(as("acmeOwner"), "POST", "/hire/jobs", { ...JOB, title: "Theirs", managers: [managerId] })).json();
    const other = (await call(as("acmeOwner"), "POST", "/hire/jobs", { ...JOB, title: "Not theirs" })).json();
    expect((await call(as("hiring_manager"), "GET", "/hire/jobs")).json().jobs.map((j: { id: string }) => j.id)).toEqual([theirs.id]);
    expect((await call(as("hiring_manager"), "GET", `/hire/jobs/${other.id}`)).statusCode).toBe(404);
    expect((await call(as("hiring_manager"), "GET", `/hire/jobs/${theirs.id}`)).statusCode).toBe(200);
    // And nothing of the company's exams.
    expect((await call(as("hiring_manager"), "GET", "/exams")).statusCode).toBe(403);
  });

  it("keeps one company's jobs from another", async () => {
    const job = (await call(as("acmeOwner"), "POST", "/hire/jobs", JOB)).json();
    expect((await call(as("betaOwner"), "GET", `/hire/jobs/${job.id}`)).statusCode).toBe(404);
    expect((await call(as("betaOwner"), "POST", `/hire/jobs/${job.id}/publish`)).statusCode).toBe(404);
    expect((await call(as("betaOwner"), "GET", "/hire/jobs")).json().jobs).toEqual([]);
  });

  it("lets an integration read and write jobs, never decide on people (S7)", async () => {
    const key = (await call(as("acmeOwner"), "POST", "/api-keys", { name: "ATS", role: "recruiter" })).json().secret as string;
    expect((await call(key, "POST", "/hire/jobs", JOB)).statusCode).toBe(201);
    expect((await call(key, "GET", "/hire/jobs")).statusCode).toBe(200);
    expect((await call(as("acmeOwner"), "POST", "/api-keys", { name: "Manager", role: "hiring_manager" })).statusCode).toBe(400);
  });
});

describe("the rules, on their own", () => {
  it("spot wording that asks for money", () => {
    const job = (description: string) => ({ title: "Sales", description, noteToCandidates: "" });
    expect(asksForMoney(job("Pay a registration fee of ₹999 to confirm your slot."))).toBe(true);
    expect(asksForMoney(job("A refundable training fee applies."))).toBe(true);
    expect(asksForMoney(job("We pay a joining bonus, and cover relocation fees for you."))).toBe(false);
  });

  it("check knockouts fit their questions", () => {
    expect(questionProblems([{ id: "a", text: "Notice period in days", kind: "number", required: true, knockout: { equals: "yes" } }])).toEqual([
      "Question 1's knockout does not fit its kind of answer.",
    ]);
    expect(questionProblems([{ id: "a", text: "Why us?", kind: "text", required: true, knockout: { equals: "yes" } }])).toContain(
      "Question 1 is answered in words, which cannot turn anyone away.",
    );
    expect(roundProblems([{ kind: "offer", config: {} }])).toEqual([]);
  });
});
