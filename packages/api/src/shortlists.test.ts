import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** A shortlist for a hiring manager: marks only, through a link that expires, with their decisions. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-01T04:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let author: string;
let clock = OPENS + 60_000;

const call = (method: "GET" | "POST", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
const open = (method: "GET" | "POST", url: string, payload?: object) => app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });
const codeOf = (link: string) => new URL(link).searchParams.get("shortlist")!;

beforeEach(async () => {
  clock = OPENS + 60_000;
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => clock });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Hiring");
  await addStaff(wiring.identity, org, "hr@acme.test", "owner");
  await addStaff(wiring.identity, org, "author@acme.test", "author");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hr@acme.test");
  author = await signIn(app, "author@acme.test");
  await call("POST", "/exams", owner, {
    id: "java",
    title: "Java test",
    questions: [
      { id: "q1", kind: "mcq", stem: "2 + 2?", maxScore: 1, rubric: [], options: ["3", "4"], correctIndex: 1 },
      { id: "q2", kind: "mcq", stem: "3 + 3?", maxScore: 1, rubric: [], options: ["6", "5"], correctIndex: 0 },
    ],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99, cutoff: { percent: 60 } },
  });
  await call("PUT", "/exams/java/window", owner, { opensAt: new Date(OPENS).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
  await call("POST", "/exams/java/invitations/import", owner, { csv: "ref,name,email\nJ1,Ananya,a@x.test\nJ2,Rohan,r@x.test\nJ3,Meera,m@x.test", dryRun: false, channels: [] });
  const codes = new InviteCodes(TOKEN_SECRET);
  const invitations = (await call("GET", "/exams/java/invitations", owner)).json().invitations as { id: string; candidateRef: string }[];
  const answers: Record<string, [string, string]> = { J1: ["1", "0"], J2: ["1", "1"], J3: ["0", "1"] };
  for (const inv of invitations) {
    const opened = (await open("POST", "/invitations/redeem", { code: codes.issue("org-a", inv.id) })).json();
    const [a1, a2] = answers[inv.candidateRef]!;
    await call("POST", "/attempts/me/answers", opened.token, { questionId: "q1", answer: a1 });
    await call("POST", "/attempts/me/answers", opened.token, { questionId: "q2", answer: a2 });
    await call("POST", "/attempts/me/submit", opened.token);
    await call("POST", `/attempts/${opened.attemptId}/grade`, owner);
  }
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a shortlist link", () => {
  it("takes the qualified by default, shows marks only, and records the manager's decisions", async () => {
    const made = await call("POST", "/exams/java/shortlists", owner, { title: "Java — round 2", days: 3 });
    expect(made.statusCode).toBe(201);
    expect(made.json()).toMatchObject({ title: "Java — round 2", candidates: 1, decided: { shortlist: 0, hold: 0, reject: 0 } });
    const code = codeOf(made.json().link);

    const view = (await open("GET", `/shortlists/view/${encodeURIComponent(code)}`)).json();
    expect(view).toMatchObject({ institution: "Acme Hiring", examTitle: "Java test", title: "Java — round 2" });
    expect(view.candidates).toEqual([expect.objectContaining({ ref: "J1", name: "Ananya", percent: 100, outcome: "qualified", decision: null })]);
    // Never a contact detail or an answer.
    expect(JSON.stringify(view)).not.toMatch(/@x\.test|"answer"/);

    expect((await open("POST", `/shortlists/view/${encodeURIComponent(code)}/decisions`, { ref: "J1", decision: "shortlist", comment: "Strong", by: "Priya (EM)" })).statusCode).toBe(200);
    expect((await open("POST", `/shortlists/view/${encodeURIComponent(code)}/decisions`, { ref: "J3", decision: "reject", by: "Priya" })).statusCode).toBe(404);
    const listed = (await call("GET", "/exams/java/shortlists", owner)).json().shortlists;
    expect(listed[0]).toMatchObject({ decided: { shortlist: 1 }, decisions: [expect.objectContaining({ ref: "J1", decision: "shortlist", comment: "Strong", by: "Priya (EM)" })] });
    expect(JSON.stringify((await call("GET", "/audit", owner)).json())).toContain("shortlist.created");
  });

  it("takes the roll numbers chosen, and refuses one not graded", async () => {
    const made = (await call("POST", "/exams/java/shortlists", owner, { refs: ["J2", "J3"] })).json();
    expect(made.candidates).toBe(2);
    const view = (await open("GET", `/shortlists/view/${encodeURIComponent(codeOf(made.link))}`)).json();
    expect(view.candidates.map((c: { ref: string }) => c.ref)).toEqual(["J2", "J3"]);
    expect((await call("POST", "/exams/java/shortlists", owner, { refs: ["NOPE"] })).statusCode).toBe(404);
    expect((await call("POST", "/exams/java/shortlists", author, {})).statusCode).toBe(403);
  });

  it("stops working when it expires or is withdrawn, and a forged link finds nothing", async () => {
    const made = (await call("POST", "/exams/java/shortlists", owner, { days: 1 })).json();
    const code = encodeURIComponent(codeOf(made.link));
    clock += 25 * HOUR;
    expect((await open("GET", `/shortlists/view/${code}`)).statusCode).toBe(410);
    clock -= 25 * HOUR;
    await call("POST", `/shortlists/${made.id}/withdraw`, owner);
    expect((await open("GET", `/shortlists/view/${code}`)).json().error).toBe("shortlist_withdrawn");
    expect((await open("GET", `/shortlists/view/org-a.${made.id}.forgedforgedforgedforge`)).statusCode).toBe(404);
  });
});
