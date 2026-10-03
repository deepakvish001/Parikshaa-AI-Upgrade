import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { InviteCodes } from "./invite-codes.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/**
 * Classes (plan row 95, F2 Campus) through the HTTP API, as `parikshaa_app`:
 * a cohort and its course, a test and a contest set for it, sessions with
 * attendance, and the page that puts each student on a line.
 */

const S = "/practice/nit-practice";
const HOUR = 3_600_000;
let clock = Date.parse("2026-10-05T04:00:00Z");
let db: PGlite;
let app: FastifyInstance;
let owner: string;
let author: string;
let invigilator: string;
const problems: Record<string, { id: string; slug: string }> = {};
let lesson: { id: string; slug: string };
let trackId: string;
let cohortId: string;
let contestId: string;

function call(method: "GET" | "POST" | "PUT" | "DELETE", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}
async function ok(method: "GET" | "POST" | "PUT" | "DELETE", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200) {
  const res = await call(method, token, url, payload);
  expect(res.statusCode, res.payload).toBe(status);
  return res.json();
}
const signUp = async (email: string, name: string) => (await ok("POST", null, `${S}/signup`, { name, email, password: "a long enough password" })).token as string;
const submit = (token: string, slug: string, answer: string, extra: object = {}) => ok("POST", token, `${S}/problems/${slug}/submit`, { answer, ...extra }, 200);

async function addProblem(name: string, stem: string, correct: number) {
  const q = await ok("POST", owner, "/bank", { question: { kind: "mcq", stem, maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: correct }, difficulty: "easy" });
  problems[name] = await ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id });
}

beforeEach(async () => {
  clock = Date.parse("2026-10-05T04:00:00Z");
  db = await freshDatabase();
  let identity;
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await addStaff(identity, org, "author@nit.test", "author", "Meena");
  await addStaff(identity, org, "watch@nit.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@nit.test");
  author = await signIn(app, "author@nit.test");
  invigilator = await signIn(app, "watch@nit.test");
  await ok("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true }, 200);

  // The course: one module of a lesson and two problems.
  await addProblem("arrays", "Index of the first element", 0);
  await addProblem("loops", "A for loop runs how often", 1);
  await addProblem("contest", "Contest question", 1);
  lesson = await ok("POST", owner, "/practice-admin/lessons", { title: "Arrays", body: "Read.", estMinutes: 10, published: true });
  trackId = (
    await ok("POST", owner, "/practice-admin/tracks", {
      title: "Java Programming",
      description: "",
      published: true,
      modules: [{ title: "Basics", items: [{ lessonId: lesson.id }, { problemId: problems.arrays!.id }, { problemId: problems.loops!.id }] }],
    })
  ).id;

  // The cohort: two students, one with an account.
  cohortId = (await ok("POST", owner, "/practice-admin/cohorts", { name: "CSE 2027 A", plusDays: 180 })).id;
  await ok("POST", owner, `/practice-admin/cohorts/${cohortId}/members`, { csv: "email\nasha@college.edu\nravi@college.edu", dryRun: false }, 200);

  contestId = (
    await ok("POST", owner, "/practice-admin/contests", {
      title: "Weekly 1",
      description: "",
      startsAt: new Date(clock - 60_000).toISOString(),
      endsAt: new Date(clock + HOUR).toISOString(),
      problemIds: [problems.contest!.id],
    })
  ).id;

  // A test, sat by Asha.
  await ok("POST", owner, "/exams", {
    id: "java-unit-1",
    title: "Java unit 1",
    questions: [{ id: "q1", kind: "mcq", stem: "2 + 2?", maxScore: 4, rubric: [], options: ["3", "4"], correctIndex: 1 }],
    policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  await ok("PUT", owner, "/exams/java-unit-1/window", { opensAt: new Date(clock - 60_000).toISOString(), closesAt: new Date(clock + 3 * HOUR).toISOString() }, 200);
  await call("POST", owner, "/exams/java-unit-1/invitations/import", { csv: "ref,name,email\nCS01,Asha,Asha@College.edu", dryRun: false, channels: [] });
  const [invitation] = (await ok("GET", owner, "/exams/java-unit-1/invitations")).invitations as { id: string }[];
  const opened = (await call("POST", null, "/invitations/redeem", { code: new InviteCodes(TOKEN_SECRET).issue("org-a", invitation!.id) })).json();
  await call("POST", opened.token, "/attempts/me/answers", { questionId: "q1", answer: "1" });
  await call("POST", opened.token, "/attempts/me/submit");
  await ok("POST", owner, `/attempts/${opened.attemptId}/grade`, undefined, 200);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a class", () => {
  it("is made from a cohort and a course, and refuses what it cannot find", async () => {
    expect((await call("POST", invigilator, "/classes", { name: "Java A", cohortId, trackId })).statusCode).toBe(403);
    expect((await call("POST", author, "/classes", { name: "Java A", cohortId: "nope", trackId })).statusCode).toBe(404);
    expect((await call("POST", author, "/classes", { name: "Java A", cohortId, trackId: "nope" })).statusCode).toBe(404);
    const made = await ok("POST", author, "/classes", { name: "Java A", cohortId, trackId });
    expect(made).toMatchObject({ name: "Java A", cohort: { id: cohortId, name: "CSE 2027 A" }, track: { id: trackId, title: "Java Programming" }, tests: 0, contests: 0 });
    expect((await call("POST", author, "/classes", { name: "java a", cohortId, trackId: null })).statusCode).toBe(409);
    expect((await ok("GET", invigilator, "/classes")).classes.map((c: { name: string }) => c.name)).toEqual(["Java A"]);
    const options = await ok("GET", author, "/classes/options");
    expect(options.cohorts).toEqual([{ id: cohortId, name: "CSE 2027 A" }]);
    expect(options.tracks).toEqual([{ id: trackId, title: "Java Programming" }]);
    expect(options.contests).toEqual([expect.objectContaining({ id: contestId, title: "Weekly 1" })]);
    expect(options.exams).toEqual([{ id: "java-unit-1", title: "Java unit 1" }]);
    expect(JSON.stringify((await ok("GET", owner, "/audit")).entries)).toContain("class.created");
  });

  it("puts each student on a line: course, tests, contests and attendance", async () => {
    const { id } = await ok("POST", author, "/classes", { name: "Java A", cohortId, trackId });
    const updated = await ok("PUT", author, `/classes/${id}`, { examIds: ["java-unit-1"], contestIds: [contestId] });
    expect(updated.class).toMatchObject({ tests: 1, contests: 1 });
    expect((await call("PUT", author, `/classes/${id}`, { examIds: ["no-such-exam"] })).statusCode).toBe(404);
    expect((await call("PUT", author, `/classes/${id}`, { contestIds: ["no-such-contest"] })).statusCode).toBe(404);

    // Asha works through part of the course and the contest; Ravi has no account yet.
    const asha = await signUp("asha@college.edu", "Asha");
    await ok("POST", asha, `${S}/lessons/${lesson.slug}/done`, undefined, 200);
    await submit(asha, problems.arrays!.slug, "0");
    await submit(asha, problems.loops!.slug, "0"); // wrong
    await submit(asha, problems.contest!.slug, "1", { contest: (await ok("GET", owner, "/practice-admin/contests")).contests[0].slug });

    // Two sessions: Asha at both, Ravi at the first.
    const first = await ok("POST", author, `/classes/${id}/sessions`, { heldOn: "2026-10-05", topic: "Arrays" });
    const second = await ok("POST", author, `/classes/${id}/sessions`, { heldOn: "2026-10-06", topic: "Loops" });
    expect((await call("POST", author, `/classes/${id}/sessions`, { heldOn: "05/10/2026", topic: "" })).statusCode).toBe(422);
    await ok("PUT", author, `/classes/${id}/sessions/${first.id}/attendance`, { marks: { "asha@college.edu": true, "ravi@college.edu": true } });
    const marked = await ok("PUT", author, `/classes/${id}/sessions/${second.id}/attendance`, { marks: { "Asha@College.edu": true, "ravi@college.edu": false } });
    expect(marked.marks).toEqual({ "asha@college.edu": true, "ravi@college.edu": false });
    expect((await call("PUT", author, `/classes/${id}/sessions/${second.id}/attendance`, { marks: { "stranger@x.test": true } })).statusCode).toBe(404);
    expect((await call("PUT", invigilator, `/classes/${id}/sessions/${second.id}/attendance`, { marks: { "asha@college.edu": true } })).statusCode).toBe(403);

    const report = await ok("GET", owner, `/classes/${id}`);
    expect(report.course).toEqual({ lessons: 1, problems: 2 });
    expect(report.tests).toEqual([{ examId: "java-unit-1", title: "Java unit 1" }]);
    expect(report.contests).toEqual([expect.objectContaining({ id: contestId, title: "Weekly 1", problems: 1 })]);
    expect(report.sessions).toEqual([
      { id: first.id, heldOn: "2026-10-05", topic: "Arrays", present: 2, marked: 2 },
      { id: second.id, heldOn: "2026-10-06", topic: "Loops", present: 1, marked: 2 },
    ]);
    expect(report.students).toEqual([
      expect.objectContaining({
        email: "asha@college.edu",
        name: "Asha",
        joined: true,
        course: { lessonsDone: 1, problemsSolved: 1, percent: 66.7 },
        tests: { "java-unit-1": 100 },
        contests: { [contestId]: 1 },
        attendance: { present: 2, of: 2, percent: 100 },
      }),
      expect.objectContaining({
        email: "ravi@college.edu",
        joined: false,
        course: { lessonsDone: 0, problemsSolved: 0, percent: 0 },
        tests: { "java-unit-1": null },
        contests: { [contestId]: 0 },
        attendance: { present: 1, of: 2, percent: 50 },
      }),
    ]);

    // Someone who may not review marks sees the rest, without them.
    const watching = await ok("GET", invigilator, `/classes/${id}`);
    expect(watching.students[0].tests).toEqual({ "java-unit-1": null });
    expect(watching.students[0].attendance.present).toBe(2);
  });

  it("drops a session with its attendance, and changes its course", async () => {
    const { id } = await ok("POST", author, "/classes", { name: "Java A", cohortId, trackId: null });
    expect((await ok("GET", owner, `/classes/${id}`)).course).toEqual({ lessons: 0, problems: 0 });
    const changed = await ok("PUT", author, `/classes/${id}`, { trackId });
    expect(changed.class.track).toEqual({ id: trackId, title: "Java Programming" });
    expect(changed.course).toEqual({ lessons: 1, problems: 2 });

    const session = await ok("POST", author, `/classes/${id}/sessions`, { heldOn: "2026-10-05", topic: "" });
    await ok("PUT", author, `/classes/${id}/sessions/${session.id}/attendance`, { marks: { "asha@college.edu": true } });
    await ok("DELETE", author, `/classes/${id}/sessions/${session.id}`);
    expect((await ok("GET", owner, `/classes/${id}/sessions`)).sessions).toEqual([]);
    expect((await call("DELETE", author, `/classes/${id}/sessions/${session.id}`)).statusCode).toBe(404);
    expect((await call("GET", owner, "/classes/nope")).statusCode).toBe(404);
  });
});
