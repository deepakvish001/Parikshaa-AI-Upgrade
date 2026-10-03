import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * A class from its student's side (plan row 96): their classes on the practice
 * site once their address is confirmed, their attendance, and the lab record a
 * teacher signs off, as a page and a PDF. As `parikshaa_app`, with real code runs.
 */

const S = "/practice/nit-practice";
const HOUR = 3_600_000;
const SUM = "a, b = map(int, input().split())\nprint(a + b)\n";
let workRoot: string;
const runner: CodeRunner = { run: (request) => execute(request, { workRoot, slot: null }) };
let clock = Date.parse("2026-10-05T04:00:00Z");
let db: PGlite;
let app: FastifyInstance;
let owner: string;
let author: string;
let mail: OutboxLog;
let worker: DeliveryWorker;
let classId: string;
let sumProblem: { id: string; slug: string };
let maxProblem: { id: string; slug: string };

function call(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}
async function ok(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200) {
  const res = await call(method, token, url, payload);
  expect(res.statusCode, res.payload).toBe(status);
  return res.json();
}
const signUp = async (email: string, name: string) => (await ok("POST", null, `${S}/signup`, { name, email, password: "a long enough password" })).token as string;
async function verify(email: string) {
  await worker.tick();
  const message = mail.sent.filter((m): m is EmailMessage => "subject" in m && m.to === email).at(-1)!;
  const token = decodeURIComponent(/\?verify=([^\s"&]+)/.exec(message.text)![1]!);
  await ok("POST", null, `${S}/verify`, { token }, 200);
}
async function codeProblem(stem: string, tests: { input: string; expected: string }[]) {
  const q = await ok("POST", owner, "/bank", {
    question: { kind: "code", stem, maxScore: 1, rubric: [], language: "python", tests: tests.map((t, i) => ({ id: `t${i}`, input: t.input, expected: t.expected, hidden: i > 0, weight: 1 })) },
    difficulty: "easy",
  });
  return ok("POST", owner, "/practice-admin/problems", { bankQuestionId: q.id });
}

beforeAll(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "class-lab-"));
});

beforeEach(async () => {
  clock = Date.parse("2026-10-05T04:00:00Z");
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  mail = new OutboxLog();
  let identity, handlers;
  ({ app, identity, handlers } = await wire(sql, { client: {} as unknown as Anthropic, mailer: mail, runner, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await addStaff(identity, org, "author@nit.test", "author", "Meena");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@nit.test");
  author = await signIn(app, "author@nit.test");
  worker = new DeliveryWorker({ outbox: new OutboxStore(sql), invitations: new InvitationStore(sql), store: new LedgerStore(sql), identity: new IdentityStore(sql), link: () => "", mailer: mail, sms: null, handlers, now: () => clock });
  await ok("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true }, 200);

  sumProblem = await codeProblem("Sum of two\n\nPrint the sum of two integers.", [
    { input: "2 3\n", expected: "5\n" },
    { input: "40 2\n", expected: "42\n" },
  ]);
  maxProblem = await codeProblem("Larger of two\n\nPrint the larger of two integers.", [
    { input: "2 3\n", expected: "3\n" },
    { input: "9 4\n", expected: "9\n" },
  ]);
  const quiz = await ok("POST", owner, "/bank", { question: { kind: "mcq", stem: "Which is a loop", maxScore: 1, rubric: [], options: ["for", "if"], correctIndex: 0 }, difficulty: "easy" });
  const mcq = await ok("POST", owner, "/practice-admin/problems", { bankQuestionId: quiz.id });
  const track = await ok("POST", owner, "/practice-admin/tracks", {
    title: "Python Lab",
    description: "",
    published: true,
    modules: [
      { title: "Week 1", items: [{ problemId: sumProblem.id }, { problemId: mcq.id }] },
      { title: "Week 2", items: [{ problemId: maxProblem.id }] },
    ],
  });
  const cohort = await ok("POST", owner, "/practice-admin/cohorts", { name: "CSE A", plusDays: 30 });
  await ok("POST", owner, `/practice-admin/cohorts/${cohort.id}/members`, { csv: "email\nasha@college.edu\nravi@college.edu", dryRun: false }, 200);
  const contest = await ok("POST", owner, "/practice-admin/contests", {
    title: "Lab contest",
    description: "",
    startsAt: new Date(clock + HOUR).toISOString(),
    endsAt: new Date(clock + 2 * HOUR).toISOString(),
    problemIds: [maxProblem.id],
  });
  classId = (await ok("POST", author, "/classes", { name: "Python Lab — CSE A", cohortId: cohort.id, trackId: track.id })).id;
  await ok("PUT", author, `/classes/${classId}`, { contestIds: [contest.id] });
  const session = await ok("POST", author, `/classes/${classId}/sessions`, { heldOn: "2026-10-05", topic: "Lab 1" });
  await ok("POST", author, `/classes/${classId}/sessions`, { heldOn: "2026-10-06", topic: "Lab 2" });
  await ok("PUT", author, `/classes/${classId}/sessions/${session.id}/attendance`, { marks: { "asha@college.edu": true, "ravi@college.edu": false } });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("a student's classes", () => {
  it("are shown once their address is confirmed: the course, contests, attendance and lab progress", async () => {
    const asha = await signUp("asha@college.edu", "Asha");
    expect(await ok("GET", asha, `${S}/classes`)).toEqual({ verified: false, classes: [] });
    expect((await call("GET", asha, `${S}/classes/${classId}/lab`)).statusCode).toBe(404);
    await verify("asha@college.edu");

    await ok("POST", asha, `${S}/problems/${sumProblem.slug}/submit`, { answer: SUM, language: "python" }, 200);
    const mine = await ok("GET", asha, `${S}/classes`);
    expect(mine).toEqual({
      verified: true,
      classes: [
        {
          id: classId,
          name: "Python Lab — CSE A",
          course: { slug: "python-lab", title: "Python Lab" },
          tests: [],
          contests: [expect.objectContaining({ title: "Lab contest" })],
          attendance: {
            present: 1,
            of: 2,
            sessions: [
              { heldOn: "2026-10-05", topic: "Lab 1", present: true },
              { heldOn: "2026-10-06", topic: "Lab 2", present: null },
            ],
          },
          lab: { practicals: 2, done: 1, signed: 0 },
        },
      ],
    });
    expect((await call("GET", null, `${S}/classes`)).statusCode).toBe(401);
  });

  it("are nobody else's: a learner outside the cohort sees none", async () => {
    const stranger = await signUp("kiran@else.edu", "Kiran");
    await verify("kiran@else.edu");
    expect(await ok("GET", stranger, `${S}/classes`)).toEqual({ verified: true, classes: [] });
    expect((await call("GET", stranger, `${S}/classes/${classId}/lab`)).statusCode).toBe(404);
  });
});

describe("the lab record", () => {
  it("lists each coding practical with the student's accepted program, and a teacher signs it off", async () => {
    const asha = await signUp("asha@college.edu", "Asha");
    await verify("asha@college.edu");
    await ok("POST", asha, `${S}/problems/${sumProblem.slug}/submit`, { answer: "print(5)", language: "python" }, 200); // fails the hidden test
    await ok("POST", asha, `${S}/problems/${sumProblem.slug}/submit`, { answer: SUM, language: "python" }, 200);

    const record = await ok("GET", author, `/classes/${classId}/lab?email=asha@college.edu`);
    expect(record.class).toEqual({ id: classId, name: "Python Lab — CSE A", course: "Python Lab" });
    expect(record.student).toEqual({ email: "asha@college.edu", name: "Asha" });
    expect(record.practicals).toEqual([
      expect.objectContaining({ problemId: sumProblem.id, title: "Sum of two", module: "Week 1", submission: expect.objectContaining({ language: "python", source: SUM, passed: 2, total: 2 }), signedBy: null }),
      expect.objectContaining({ problemId: maxProblem.id, module: "Week 2", submission: null, signedBy: null }),
    ]);

    const signed = await ok("PUT", author, `/classes/${classId}/lab`, { email: "Asha@College.edu", problemId: sumProblem.id, signed: true });
    expect(signed.practicals[0]).toMatchObject({ signedBy: "Meena" });
    expect((await call("PUT", author, `/classes/${classId}/lab`, { email: "asha@college.edu", problemId: "not-a-practical", signed: true })).statusCode).toBe(404);
    expect((await call("PUT", author, `/classes/${classId}/lab`, { email: "stranger@x.test", problemId: sumProblem.id, signed: true })).statusCode).toBe(404);
    expect(JSON.stringify((await ok("GET", owner, "/audit")).entries)).toContain("class.lab_signed");

    // The student sees the sign-off, and gets the record as a PDF.
    const own = await ok("GET", asha, `${S}/classes/${classId}/lab`);
    expect(own.practicals[0]).toMatchObject({ signedBy: "Meena" });
    const pdf = await call("GET", asha, `${S}/classes/${classId}/lab.pdf`);
    expect(pdf.statusCode).toBe(200);
    expect(pdf.headers["content-type"]).toBe("application/pdf");
    expect(pdf.rawPayload.toString("latin1")).toContain("Lab record");
    expect((await call("GET", author, `/classes/${classId}/lab.pdf?email=asha@college.edu`)).statusCode).toBe(200);

    // Taking it back.
    const unsigned = await ok("PUT", author, `/classes/${classId}/lab`, { email: "asha@college.edu", problemId: sumProblem.id, signed: false });
    expect(unsigned.practicals[0].signedBy).toBeNull();
  });
});
