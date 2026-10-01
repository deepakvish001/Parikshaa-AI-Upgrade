import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { InviteCodes } from "./invite-codes.js";
import { importStudents } from "./student-import.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/** The placement cell: students entered once, and a drive from eligibility to offer. */

const HOUR = 3_600_000;
const OPENS = Date.parse("2026-10-05T04:30:00Z");

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let author: string;
let other: string;
let ids = 0;

const call = (method: "GET" | "POST" | "PUT" | "DELETE", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

const SHEET = [
  "Roll No.,Name,Email,Mobile,Branch,Passing Year,CGPA,Active Backlogs",
  "CS001,Ananya Iyer,ananya@college.test,98765 43210,CSE,2027,8.9,0",
  "CS002,Rohan Verma,rohan@college.test,,CSE,2027,6.4,0",
  "EC001,Meera Nair,meera@college.test,,ECE,2027,7.8,1",
  "ME001,Kabir Singh,,+91 91234 56789,MECH,2027,9.1,0",
  "CS101,Isha Rao,isha@college.test,,CSE,2028,9.5,0",
].join("\n");

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel({ latencyMs: 0 }).client, now: () => OPENS - HOUR, newId: () => `id-${++ids}` });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Engineering College");
  await addStaff(wiring.identity, org, "tpo@acme.test", "owner");
  await addStaff(wiring.identity, org, "author@acme.test", "author");
  const org2 = await addOrganisation(wiring.identity, "org-b", "Other College");
  await addStaff(wiring.identity, org2, "tpo@other.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "tpo@acme.test");
  author = await signIn(app, "author@acme.test");
  other = await signIn(app, "tpo@other.test");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("reading a sheet of students", () => {
  it("understands the columns colleges use and normalises what it reads", () => {
    const { students, problems } = importStudents(SHEET);
    expect(problems).toEqual([]);
    expect(students[0]).toEqual({ ref: "CS001", name: "Ananya Iyer", email: "ananya@college.test", phone: "919876543210", branch: "CSE", batch: 2027, cgpa: 8.9, backlogs: 0 });
    expect(students[3]!.phone).toBe("919123456789");
  });

  it("names every row it cannot read, and takes none of them", () => {
    const { students, problems } = importStudents("roll_number,cgpa,batch,backlogs,phone\nA1,11,2027,0,\nA1,8,2027,0,\nA2,8,27,0,\nA3,8,2027,two,\nA4,8,2027,0,12345\n,8,2027,0,");
    expect(students).toEqual([]);
    expect(problems.map((p) => p.row)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(problems[0]!.message).toMatch(/CGPA out of 10/);
    expect(problems[1]!.message).toMatch(/also on row 2/);
    expect(importStudents("name,branch\nAnanya,CSE").problems[0]!.message).toMatch(/roll number column/);
  });
});

describe("students on file", () => {
  it("checks a sheet, brings it in, and updates a student sent again", async () => {
    const dry = (await call("POST", "/students/import", owner, { csv: SHEET, dryRun: true })).json();
    expect(dry).toMatchObject({ dryRun: true, students: 5, added: 5, updated: 0, problems: [] });
    expect((await call("GET", "/students", owner)).json().students).toEqual([]);

    expect((await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false })).json()).toMatchObject({ added: 5, updated: 0 });
    const again = (await call("POST", "/students/import", owner, { csv: "roll_number,name,cgpa\nCS002,Rohan Verma,7.1", dryRun: false })).json();
    expect(again).toMatchObject({ added: 0, updated: 1 });
    const students = (await call("GET", "/students", owner)).json().students;
    expect(students.map((s: { ref: string }) => s.ref)).toEqual(["CS001", "CS002", "CS101", "EC001", "ME001"]);
    expect(students.find((s: { ref: string }) => s.ref === "CS002")).toMatchObject({ cgpa: 7.1, offers: 0, bestOfferLpa: null });

    const bad = await call("POST", "/students/import", owner, { csv: "roll_number,cgpa\nX,12", dryRun: false });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().problems).toHaveLength(1);
    expect(JSON.stringify((await call("GET", "/audit", owner)).json())).toContain("students.imported");
  });

  it("keeps each college's students to itself, and from staff who do not read results", async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
    expect((await call("GET", "/students", other)).json().students).toEqual([]);
    expect((await call("GET", "/students", author)).statusCode).toBe(403);
    expect((await call("POST", "/students/import", author, { csv: SHEET, dryRun: false })).statusCode).toBe(403);
  });

  it("removes a student", async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
    expect((await call("DELETE", "/students/ME001", owner)).statusCode).toBe(200);
    expect((await call("DELETE", "/students/ME001", owner)).statusCode).toBe(404);
    expect((await call("GET", "/students", owner)).json().students).toHaveLength(4);
  });
});

describe("a drive", () => {
  const drive = {
    company: "Infosys",
    role: "Systems Engineer",
    ctcLpa: 3.6,
    location: "Pune",
    description: "Freshers for the Systems Engineer role.",
    eligibility: { minCgpa: 7, maxBacklogs: 0, branches: ["CSE", "ECE", " "], batches: [2027] },
    applyBy: "2026-10-10",
  };

  beforeEach(async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
  });

  it("finds the eligible students, adds them, and follows them to an offer", async () => {
    const made = await call("POST", "/drives", owner, drive);
    expect(made.statusCode).toBe(201);
    const id = made.json().id;
    expect(made.json()).toMatchObject({ company: "Infosys", status: "open", eligibility: { minCgpa: 7, maxBacklogs: 0, branches: ["CSE", "ECE"], batches: [2027] } });

    // CS001 alone: CS002's CGPA is low, EC001 has a backlog, ME001's branch and CS101's batch are outside.
    expect((await call("GET", `/drives/${id}`, owner)).json().eligibleNotAdded).toBe(1);
    expect((await call("POST", `/drives/${id}/students`, owner, { eligible: true })).json()).toEqual({ added: 1 });
    expect((await call("POST", `/drives/${id}/students`, owner, { eligible: true })).json()).toEqual({ added: 0 });
    expect((await call("POST", `/drives/${id}/students`, owner, { refs: ["EC001"] })).json()).toEqual({ added: 1 });
    expect((await call("POST", `/drives/${id}/students`, owner, { refs: ["NOBODY"] })).statusCode).toBe(404);

    expect((await call("POST", `/drives/${id}/stage`, owner, { refs: ["CS001"], stage: "offered", offerLpa: 3.6 })).json()).toEqual({ moved: 1 });
    expect((await call("POST", `/drives/${id}/stage`, owner, { refs: ["EC001"], stage: "rejected", offerLpa: 9 })).json()).toEqual({ moved: 1 });

    const detail = (await call("GET", `/drives/${id}`, owner)).json();
    expect(detail.drive.stages).toMatchObject({ offered: 1, rejected: 1, applied: 0 });
    expect(detail.applications).toEqual([
      expect.objectContaining({ ref: "CS001", stage: "offered", offerLpa: 3.6, test: null }),
      expect.objectContaining({ ref: "EC001", stage: "rejected", offerLpa: null }),
    ]);
    expect((await call("GET", "/students", owner)).json().students.find((s: { ref: string }) => s.ref === "CS001")).toMatchObject({ offers: 1, bestOfferLpa: 3.6 });

    const csv = await call("GET", `/drives/${id}/students.csv`, owner);
    expect(csv.headers["content-disposition"]).toContain("infosys-systems-engineer.csv");
    expect(csv.body).toContain("CS001,Ananya Iyer,ananya@college.test,'+919876543210,CSE,2027,8.9,0,Offered,,3.6");
    const audit = JSON.stringify((await call("GET", "/audit", owner)).json());
    for (const action of ["drive.created", "drive.students_added", "drive.stage_set", "drive.exported"]) expect(audit).toContain(action);
  });

  it("refuses a drive without a company, with an exam that is not there, and students once closed", async () => {
    expect((await call("POST", "/drives", owner, { ...drive, company: " " })).statusCode).toBe(409);
    expect((await call("POST", "/drives", owner, { ...drive, examId: "nope" })).statusCode).toBe(404);
    const id = (await call("POST", "/drives", owner, drive)).json().id;
    expect((await call("PUT", `/drives/${id}`, owner, { ...drive, status: "closed" })).json().status).toBe("closed");
    expect((await call("POST", `/drives/${id}/students`, owner, { eligible: true })).statusCode).toBe(409);
    expect((await call("GET", `/drives/${id}`, other)).statusCode).toBe(404);
    expect((await call("GET", "/drives", other)).json().drives).toEqual([]);
  });

  it("sends the drive's test, and shows each student's result once graded", async () => {
    await call("POST", "/exams", owner, {
      id: "infosys-oa",
      title: "Infosys online test",
      questions: [
        { id: "q1", kind: "mcq", stem: "2 + 2?", maxScore: 1, rubric: [], options: ["3", "4"], correctIndex: 1 },
        { id: "q2", kind: "mcq", stem: "3 × 3?", maxScore: 1, rubric: [], options: ["9", "6"], correctIndex: 0 },
      ],
      policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99, cutoff: { percent: 60 } },
    });
    const id = (await call("POST", "/drives", owner, { ...drive, eligibility: {}, examId: "infosys-oa" })).json().id;
    expect((await call("POST", `/drives/${id}/send-test`, owner, { channels: [] })).statusCode).toBe(409);
    await call("POST", `/drives/${id}/students`, owner, { refs: ["CS001", "CS002"] });

    expect((await call("POST", `/drives/${id}/send-test`, owner, { channels: [] })).json()).toEqual({ invited: 2, skipped: 0 });
    expect((await call("POST", `/drives/${id}/send-test`, owner, { refs: ["CS001"], channels: [] })).json()).toEqual({ invited: 0, skipped: 1 });
    const invitations = (await call("GET", "/exams/infosys-oa/invitations", owner)).json().invitations as { id: string; candidateRef: string; name: string }[];
    expect(invitations.map((i) => [i.candidateRef, i.name]).sort()).toEqual([["CS001", "Ananya Iyer"], ["CS002", "Rohan Verma"]]);
    expect((await call("GET", `/drives/${id}`, owner)).json().drive.stages).toMatchObject({ test: 2, applied: 0 });

    // CS001 sits it and gets both right.
    const codes = new InviteCodes(TOKEN_SECRET);
    const mine = invitations.find((i) => i.candidateRef === "CS001")!;
    const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", mine.id) } })).json();
    await call("POST", "/attempts/me/answers", opened.token, { questionId: "q1", answer: "1" });
    await call("POST", "/attempts/me/answers", opened.token, { questionId: "q2", answer: "0" });
    await call("POST", "/attempts/me/submit", opened.token);
    await call("POST", `/attempts/${opened.attemptId}/grade`, owner);

    const applications = (await call("GET", `/drives/${id}`, owner)).json().applications;
    expect(applications.find((a: { ref: string }) => a.ref === "CS001").test).toEqual({ percent: 100, outcome: "qualified" });
    expect(applications.find((a: { ref: string }) => a.ref === "CS002").test).toBeNull();
  });
});

describe("readiness", () => {
  it("averages each branch in each topic, and names the students who need help", async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
    // Two topics from the bank, one from a section's title.
    const quant = (await call("POST", "/bank", owner, { question: { kind: "mcq", stem: "15% of 200?", maxScore: 1, rubric: [], options: ["30", "20"], correctIndex: 0 }, topic: "Quantitative aptitude", difficulty: "easy", tags: [] })).json();
    const os = (await call("POST", "/bank", owner, { question: { kind: "mcq", stem: "What does a scheduler do?", maxScore: 1, rubric: [], options: ["Picks the next process", "Formats disks"], correctIndex: 0 }, topic: "Operating systems", difficulty: "easy", tags: [] })).json();
    await call("POST", "/exams", owner, {
      id: "mock",
      title: "Mock test",
      questions: [quant.question, os.question],
      sections: [{ id: "s1", title: "Reasoning", pick: 1, pool: [{ id: "r1", kind: "mcq", stem: "Next: 2, 4, 8?", maxScore: 1, rubric: [], options: ["16", "10"], correctIndex: 0 }] }],
      policy: { durationMs: HOUR, allowRevision: true, vivaTriggerRatio: 0.99 },
    });
    await call("PUT", "/exams/mock/window", owner, { opensAt: new Date(OPENS - 2 * HOUR).toISOString(), closesAt: new Date(OPENS + 3 * HOUR).toISOString() });
    await call("POST", "/exams/mock/invitations/import", owner, { csv: "ref,name\nCS001,Ananya Iyer\nCS002,Rohan Verma\nEC001,Meera Nair", dryRun: false, channels: [] });
    const codes = new InviteCodes(TOKEN_SECRET);
    const invitations = (await call("GET", "/exams/mock/invitations", owner)).json().invitations as { id: string; candidateRef: string }[];
    // CS001 gets everything right; CS002 and EC001 only the reasoning question.
    for (const inv of invitations) {
      const opened = (await app.inject({ method: "POST", url: "/invitations/redeem", payload: { code: codes.issue("org-a", inv.id) } })).json();
      const strong = inv.candidateRef === "CS001";
      await call("POST", "/attempts/me/answers", opened.token, { questionId: quant.question.id, answer: strong ? "0" : "1" });
      await call("POST", "/attempts/me/answers", opened.token, { questionId: os.question.id, answer: strong ? "0" : "1" });
      await call("POST", "/attempts/me/answers", opened.token, { questionId: "r1", answer: "0" });
      await call("POST", "/attempts/me/submit", opened.token);
      await call("POST", `/attempts/${opened.attemptId}/grade`, owner);
    }

    const readiness = (await call("GET", "/placement/readiness", owner)).json();
    expect(readiness.exams).toEqual([{ id: "mock", title: "Mock test" }]);
    expect(readiness.topics).toEqual(["Operating systems", "Quantitative aptitude", "Reasoning"]);
    const cse = readiness.branches.find((b: { branch: string }) => b.branch === "CSE");
    expect(cse).toMatchObject({ students: 2, cells: { "Quantitative aptitude": { percent: 50, students: 2 }, Reasoning: { percent: 100 } } });
    expect(readiness.branches.find((b: { branch: string }) => b.branch === "ECE").cells["Operating systems"].percent).toBe(0);
    expect(readiness.atRisk.map((r: { ref: string }) => r.ref).sort()).toEqual(["CS002", "EC001"]);
    expect(readiness.atRisk[0]).toMatchObject({ percent: 33.3, weakest: "Operating systems" });
    expect((await call("GET", "/placement/readiness?batch=2028", owner)).json().branches).toEqual([]);
  });
});

describe("applying from a drive's link", () => {
  const codeOf = (link: string) => new URL(link).searchParams.get("apply")!;
  const apply = (code: string, form: object) => app.inject({ method: "POST", url: `/apply/${encodeURIComponent(code)}`, payload: form });

  beforeEach(async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
  });

  it("lets a student on the list apply as themselves, once, if they meet the criteria", async () => {
    const id = (await call("POST", "/drives", owner, { company: "Wipro", role: "Project Engineer", eligibility: { minCgpa: 7 }, applyBy: "2026-10-30" })).json().id;
    const { link } = (await call("POST", `/drives/${id}/apply-link`, owner, { open: true })).json();
    const code = codeOf(link);
    const shown = (await app.inject({ method: "GET", url: `/apply/${encodeURIComponent(code)}` })).json();
    expect(shown).toMatchObject({ institution: "Acme Engineering College", company: "Wipro", closed: false, openToNew: false, eligibility: { minCgpa: 7 } });

    expect((await apply(code, { ref: "CS001", email: "ANANYA@college.test" })).json()).toMatchObject({ status: "applied" });
    expect((await apply(code, { ref: "CS001", email: "ananya@college.test" })).json()).toMatchObject({ status: "already" });
    // The email must be the one on file; the CGPA on file decides, not what is typed.
    expect((await apply(code, { ref: "CS002", email: "someone@else.test" })).statusCode).toBe(404);
    expect((await apply(code, { ref: "CS002", email: "rohan@college.test", cgpa: 9.9 })).json().message).toMatch(/criteria/);
    expect((await apply(code, { ref: "NEW1", email: "new@x.test", name: "New" })).json().message).toMatch(/not on the college's list/);

    const detail = (await call("GET", `/drives/${id}`, owner)).json();
    expect(detail.applyLink).toBe(link);
    expect(detail.applications.map((a: { ref: string }) => a.ref)).toEqual(["CS001"]);
  });

  it("takes people not on the list for an off-campus drive, and stops when closed or past the date", async () => {
    const id = (await call("POST", "/drives", owner, { company: "TCS", role: "Ninja", eligibility: { minCgpa: 6 }, applyBy: "2026-10-05" })).json().id;
    const code = codeOf((await call("POST", `/drives/${id}/apply-link`, owner, { open: true, openToNew: true })).json().link);
    expect((await apply(code, { ref: "OFF01", email: "off@x.test", name: "Off Campus", branch: "IT", batch: 2026, cgpa: 7.5, phone: "9812345678" })).json()).toMatchObject({ status: "applied" });
    expect((await apply(code, { ref: "OFF02", email: "low@x.test", name: "Low", cgpa: 5 })).statusCode).toBe(409);
    const students = (await call("GET", "/students", owner)).json().students;
    expect(students.find((s: { ref: string }) => s.ref === "OFF01")).toMatchObject({ name: "Off Campus", branch: "IT", cgpa: 7.5, phone: "919812345678" });

    await call("PUT", `/drives/${id}`, owner, { company: "TCS", role: "Ninja", eligibility: { minCgpa: 6 }, applyBy: "2026-10-04" });
    expect((await apply(code, { ref: "CS001", email: "ananya@college.test" })).json().message).toMatch(/closed/);
    expect((await app.inject({ method: "GET", url: `/apply/${encodeURIComponent(code)}` })).json().closed).toBe(true);
    await call("POST", `/drives/${id}/apply-link`, owner, { open: false });
    expect((await apply(code, { ref: "CS001", email: "ananya@college.test" })).statusCode).toBe(404);
  });

  it("runs one drive across colleges, each with its own link, keeping their roll numbers apart", async () => {
    const id = (await call("POST", "/drives", owner, { company: "Zoho", role: "Member Technical Staff", eligibility: { minCgpa: 6 } })).json().id;
    const nitt = (await call("POST", `/drives/${id}/colleges`, owner, { name: "NIT Tiruchirappalli", code: "nitt" })).json();
    const psg = (await call("POST", `/drives/${id}/colleges`, owner, { name: "PSG Tech", code: "PSG" })).json();
    expect(nitt).toMatchObject({ code: "NITT", applied: 0 });
    expect((await call("POST", `/drives/${id}/colleges`, owner, { name: "Again", code: "NITT" })).statusCode).toBe(409);
    expect((await call("POST", `/drives/${id}/colleges`, owner, { name: "Bad", code: "a b" })).statusCode).toBe(409);

    const shown = (await app.inject({ method: "GET", url: `/apply/${encodeURIComponent(codeOf(nitt.link))}` })).json();
    expect(shown).toMatchObject({ company: "Zoho", college: "NIT Tiruchirappalli", openToNew: true });
    const form = { email: "a@nitt.test", name: "Arun", branch: "CSE", batch: 2027, cgpa: 8 };
    // The same roll number at two colleges is two students.
    expect((await apply(codeOf(nitt.link), { ref: "21CS001", ...form })).json()).toMatchObject({ status: "applied" });
    expect((await apply(codeOf(psg.link), { ref: "21CS001", ...form, email: "b@psg.test", name: "Bala" })).json()).toMatchObject({ status: "applied" });
    expect((await apply(codeOf(nitt.link), { ref: "21CS001", ...form })).json()).toMatchObject({ status: "already" });

    const detail = (await call("GET", `/drives/${id}`, owner)).json();
    expect(detail.applications.map((a: { ref: string; college: string }) => [a.ref, a.college])).toEqual([
      ["NITT-21CS001", "NIT Tiruchirappalli"],
      ["PSG-21CS001", "PSG Tech"],
    ]);
    expect(detail.colleges.map((c: { code: string; applied: number }) => [c.code, c.applied])).toEqual([
      ["NITT", 1],
      ["PSG", 1],
    ]);
    expect((await call("GET", `/drives/${id}/students.csv`, owner)).body).toContain("NITT-21CS001,Arun,NIT Tiruchirappalli");

    await call("DELETE", `/drives/${id}/colleges/${psg.id}`, owner);
    expect((await apply(codeOf(psg.link), { ref: "21CS002", ...form })).statusCode).toBe(404);
  });
});

describe("offers", () => {
  const offerCode = (link: string) => encodeURIComponent(new URL(link).searchParams.get("offer")!);
  const open = (method: "GET" | "POST", url: string, payload?: object) => app.inject({ method, url, ...(payload === undefined ? {} : { payload }) });

  it("sends an offer with a link, takes the candidate's answer once, and counts who has not joined", async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
    const id = (await call("POST", "/drives", owner, { company: "Infosys", role: "Systems Engineer", location: "Mysuru" })).json().id;
    await call("POST", `/drives/${id}/students`, owner, { refs: ["CS001", "CS002", "EC001"] });
    expect((await call("POST", `/drives/${id}/offers`, owner, { ref: "ME001", ctcLpa: 3.6 })).statusCode).toBe(404);

    const first = (await call("POST", `/drives/${id}/offers`, owner, { ref: "CS001", ctcLpa: 3.6, joiningDate: "2026-10-01", note: "Report at 9 am" })).json();
    const second = (await call("POST", `/drives/${id}/offers`, owner, { ref: "CS002", ctcLpa: 3.6, joiningDate: "2027-07-01" })).json();
    await call("POST", `/drives/${id}/offers`, owner, { ref: "EC001", ctcLpa: 3.6 });

    const shown = (await open("GET", `/offers/${offerCode(first.link)}`)).json();
    expect(shown).toMatchObject({ company: "Infosys", role: "Systems Engineer", candidateName: "Ananya Iyer", ctcLpa: 3.6, joiningDate: "2026-10-01", note: "Report at 9 am", response: null, open: true });
    expect((await open("POST", `/offers/${offerCode(first.link)}/response`, { response: "accepted" })).json()).toEqual({ response: "accepted" });
    expect((await open("POST", `/offers/${offerCode(first.link)}/response`, { response: "declined" })).statusCode).toBe(409);
    await open("POST", `/offers/${offerCode(second.link)}/response`, { response: "declined" });
    expect((await open("GET", "/offers/org-a.nope")).statusCode).toBe(404);

    const detail = (await call("GET", `/drives/${id}`, owner)).json();
    // CS001 accepted and the joining date (1 Oct) has passed without joining; EC001 has not answered.
    expect(detail.offers).toEqual({ sent: 3, accepted: 1, declined: 1, pending: 1, joined: 0, notJoined: 1 });
    expect(detail.applications.find((a: { ref: string }) => a.ref === "CS001").offer).toMatchObject({ response: "accepted", link: first.link });

    await call("POST", `/drives/${id}/stage`, owner, { refs: ["CS001"], stage: "joined", offerLpa: 3.6 });
    expect((await call("GET", `/drives/${id}`, owner)).json().offers).toMatchObject({ joined: 1, notJoined: 0 });
    expect(JSON.stringify((await call("GET", "/audit", owner)).json())).toContain("drive.offer_sent");
  });
});

describe("following a drive", () => {
  it("counts how many reached each round, by college too, and lets each student follow their own application", async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
    const id = (await call("POST", "/drives", owner, { company: "Infosys", role: "Systems Engineer" })).json().id;
    await call("POST", `/drives/${id}/students`, owner, { refs: ["CS001", "CS002", "EC001", "ME001"] });
    await call("POST", `/drives/${id}/stage`, owner, { refs: ["CS001", "CS002"], stage: "interview" });
    await call("POST", `/drives/${id}/stage`, owner, { refs: ["EC001"], stage: "rejected" });
    await call("POST", `/drives/${id}/offers`, owner, { ref: "CS001", ctcLpa: 4 });

    const detail = (await call("GET", `/drives/${id}`, owner)).json();
    expect(detail.funnel).toEqual({ applied: 4, test: 2, interview: 2, offered: 1, joined: 0, dropped: 1, colleges: [] });
    expect((await call("GET", "/placement/funnel", owner)).json().drives).toEqual([expect.objectContaining({ id, company: "Infosys", funnel: expect.objectContaining({ applied: 4, offered: 1 }) })]);

    const link = detail.applications.find((a: { ref: string }) => a.ref === "CS001").statusLink;
    const code = encodeURIComponent(new URL(link).searchParams.get("status")!);
    const page = (await app.inject({ method: "GET", url: `/status/${code}` })).json();
    expect(page).toMatchObject({ company: "Infosys", name: "Ananya Iyer", stage: "offered", offer: { ctcLpa: 4, response: null, link: expect.stringContaining("?offer=") } });
    expect(JSON.stringify(page)).not.toMatch(/Rohan|CS002/);
    // Changing the roll number in the link breaks its signature.
    const [org, drive, , mac] = decodeURIComponent(code).split(".");
    const forged = `${org}.${drive}.${Buffer.from("CS002").toString("base64url")}.${mac}`;
    expect((await app.inject({ method: "GET", url: `/status/${encodeURIComponent(forged)}` })).statusCode).toBe(404);
  });

  it("gives the student the link to follow their application when they apply", async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
    const id = (await call("POST", "/drives", owner, { company: "Wipro", role: "Project Engineer" })).json().id;
    const code = new URL((await call("POST", `/drives/${id}/apply-link`, owner, { open: true })).json().link).searchParams.get("apply")!;
    const applied = (await app.inject({ method: "POST", url: `/apply/${encodeURIComponent(code)}`, payload: { ref: "CS001", email: "ananya@college.test" } })).json();
    const status = new URL(applied.statusLink).searchParams.get("status")!;
    expect((await app.inject({ method: "GET", url: `/status/${encodeURIComponent(status)}` })).json()).toMatchObject({ company: "Wipro", stage: "applied", offer: null });
  });
});

describe("the placement report", () => {
  it("gives placed, median, highest and average per year of passing and branch", async () => {
    await call("POST", "/students/import", owner, { csv: SHEET, dryRun: false });
    const id = (await call("POST", "/drives", owner, { company: "Infosys", role: "SE" })).json().id;
    const id2 = (await call("POST", "/drives", owner, { company: "Amazon", role: "SDE" })).json().id;
    await call("POST", `/drives/${id}/students`, owner, { refs: ["CS001", "CS002", "EC001"] });
    await call("POST", `/drives/${id2}/students`, owner, { refs: ["CS001"] });
    await call("POST", `/drives/${id}/stage`, owner, { refs: ["CS001", "CS002"], stage: "offered", offerLpa: 3.6 });
    await call("POST", `/drives/${id}/stage`, owner, { refs: ["EC001"], stage: "joined", offerLpa: 4 });
    await call("POST", `/drives/${id2}/stage`, owner, { refs: ["CS001"], stage: "offered", offerLpa: 32 });

    const report = (await call("GET", "/placement/report", owner)).json();
    const y2027 = report.batches.find((b: { batch: number }) => b.batch === 2027);
    // Five students in 2027 less CS101 (2028): CS001 32, CS002 3.6, EC001 4, ME001 none.
    expect(y2027).toMatchObject({ students: 4, placed: 3, percent: 75, medianLpa: 4, highestLpa: 32, averageLpa: 13.2 });
    expect(y2027.branches.find((b: { branch: string }) => b.branch === "CSE")).toMatchObject({ students: 2, placed: 2, medianLpa: 17.8 });
    const csv = await call("GET", "/placement/report.csv", owner);
    expect(csv.body).toContain("2027,All,4,3,75,4,32,13.2");
  });
});
