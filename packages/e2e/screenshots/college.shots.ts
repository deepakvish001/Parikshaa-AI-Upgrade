import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { MCQ, OWNER, SHORT, seedSitting, type Sitting } from "../tests/support.js";
import { shoot, shootPart } from "./shoot.js";

/**
 * The college and company features of docs/PREP-TRACKER.md V2-12, screen by
 * screen: exam day (seats, admit cards, arrangements), results (copies,
 * outcomes, internal marks, shortlists), the placement cell (readiness,
 * funnel, colleges, offers), the public pages (apply, status, offer,
 * shortlist, candidate report, demo test), interviews with a panel, paper review, staff and
 * departments, and the console in Hindi.
 */

const NUMERIC = { id: "q3", kind: "numeric", stem: "A train covers 180 km in 2.5 hours. What is its average speed in km/h?", maxScore: 2, rubric: [], expected: 72, tolerance: 0 };
const PEOPLE = ["Aarav Sharma", "Diya Patel", "Ishaan Reddy", "Ananya Iyer", "Kabir Singh", "Meera Nair"];
const REFS = PEOPLE.map((_, i) => `CS${String(i + 1).padStart(3, "0")}`);
const MARKS = [["1", "The interval halves until it is empty.", "72"], ["1", "It halves.", "72"], ["1", "Halving until nothing is left.", "70"], ["0", "Stops.", "72"], ["0", "No idea.", "60"], ["1", "The range shrinks.", "72"]] as const;
/** A small grey page, as a phone photo of an answer sheet would arrive. */

async function signIn(page: Page) {
  await page.goto("/console/");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Account" })).toBeVisible();
}

const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Account" }).getByRole("button", { name, exact: true }).click();

async function openExam(page: Page, title: string, tab: string) {
  await nav(page, "Exams");
  await page.getByRole("button", { name: title, exact: true }).first().click();
  await page.getByRole("button", { name: tab, exact: true }).click();
}

const pathOf = (link: string) => {
  const url = new URL(link);
  return `${url.pathname}${url.search}`;
};

async function sitAndGrade(request: APIRequestContext, sitting: Sitting, ref: string, answers: readonly [string, string, string]) {
  const code = decodeURIComponent(new URL(sitting.links[ref]!).searchParams.get("invite")!);
  const opened = await request.post("/api/invitations/redeem", { data: { code } });
  expect(opened.status(), await opened.text()).toBe(200);
  const { token, attemptId } = await opened.json();
  const headers = { authorization: `Bearer ${token}` };
  for (const [i, q] of ["q1", "q2", "q3"].entries()) expect((await request.post("/api/attempts/me/answers", { headers, data: { questionId: q, answer: answers[i] } })).status()).toBe(202);
  expect((await request.post("/api/attempts/me/submit", { headers })).status()).toBe(200);
  expect((await request.post(`/api/attempts/${attemptId}/grade`, { headers: { authorization: `Bearer ${sitting.token}` } })).status()).toBe(200);
}

test("exam day: seats, admit cards and arrangements for a disability", async ({ page, request }) => {
  test.setTimeout(180_000);
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title: "Semester exam — Data structures", refs: REFS, names: PEOPLE });
  const headers = { authorization: `Bearer ${sitting.token}` };
  expect((await request.post(`/api/exams/${sitting.examId}/seats`, { headers, data: { rooms: [{ centre: "Main block", room: "Lab 1", seats: 4 }, { centre: "Main block", room: "Lab 2", seats: 4 }] } })).status()).toBe(200);
  expect((await request.put(`/api/exams/${sitting.examId}/accommodations/CS004`, { headers, data: { extraPercent: 33, scribe: true, largeText: true, note: "Low vision; certificate PwD/2025/114" } })).status()).toBe(200);
  expect((await request.put(`/api/exams/${sitting.examId}/accommodations/CS006`, { headers, data: { extraPercent: 25, note: "Dyslexia" } })).status()).toBe(200);

  await signIn(page);
  await openExam(page, "Semester exam — Data structures", "Candidates");
  await expect(page.getByRole("region", { name: "Arrangements for a disability" })).toContainText("33% extra time");
  await shoot(page, "college-01-seats-and-arrangements", { fullPage: true });

  // The candidate's instructions say what is arranged.
  await page.goto(pathOf(sitting.links["CS004"]!));
  await expect(page.getByRole("region", { name: "Arranged for you" })).toBeVisible();
  await shoot(page, "college-02-candidate-arrangements");
});

test("results and a shortlist", async ({ page, request }) => {
  test.setTimeout(300_000);
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title: "Mid-term 1 — Data structures", refs: REFS, names: PEOPLE, cutoff: { percent: 50 } });
  for (const [i, ref] of REFS.entries()) await sitAndGrade(request, sitting, ref, MARKS[i]!);
  const headers = { authorization: `Bearer ${sitting.token}` };
  expect((await request.post(`/api/exams/${sitting.examId}/shortlists`, { headers, data: { title: "Data structures — for the HoD", refs: REFS.slice(0, 3), days: 7 } })).status()).toBe(201);

  await signIn(page);
  await openExam(page, "Mid-term 1 — Data structures", "Results");
  await expect(page.getByRole("region", { name: "Shortlists for hiring managers" })).toBeVisible();
  await shoot(page, "college-03-results-page", { fullPage: true });
  await shootPart(page.getByRole("region", { name: "Shortlists for hiring managers" }), "college-07-shortlists");

  // The hiring manager's page, from the link.
  const list = (await (await request.get(`/api/exams/${sitting.examId}/shortlists`, { headers })).json()).shortlists[0];
  if (typeof list.link === "string") {
    await page.goto(pathOf(list.link));
    await expect(page.getByRole("region", { name: "Shortlist" })).toBeVisible();
    await shoot(page, "college-08-shortlist-for-the-manager");
  }

  // One candidate's report, from the link a recruiter sends (plan row 90).
  const rows = (await (await request.get(`/api/exams/${sitting.examId}/results`, { headers })).json()).rows as { attemptId: string; ref: string }[];
  const first = rows.find((r) => r.ref === REFS[0])!;
  const shared = await request.post(`/api/attempts/${first.attemptId}/report-link`, { headers, data: { days: 7 } });
  expect(shared.status(), await shared.text()).toBe(201);
  await page.goto(pathOf((await shared.json()).link as string));
  await expect(page.getByRole("article", { name: "Candidate report" })).toBeVisible();
  await shoot(page, "college-09-candidate-report", { fullPage: true });
});

test("the placement cell: readiness, funnel, colleges, offers, and the student's pages", async ({ page, request }) => {
  test.setTimeout(300_000);
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title: "Wipro online test", refs: REFS, names: PEOPLE, cutoff: { percent: 50 } });
  for (const [i, ref] of REFS.entries()) await sitAndGrade(request, sitting, ref, MARKS[i]!);
  const headers = { authorization: `Bearer ${sitting.token}` };
  const csv = ["roll_number,name,email,phone,branch,batch,cgpa,backlogs", ...PEOPLE.map((name, i) => `${REFS[i]},${name},${name.split(" ")[0]!.toLowerCase()}@college.ac.in,98765${43210 + i},${i < 4 ? "CSE" : "ECE"},2027,${[8.9, 7.8, 8.2, 7.1, 6.4, 9.1][i]},0`)].join("\n");
  expect((await request.post("/api/students/import", { headers, data: { csv, dryRun: false } })).status()).toBe(200);
  const made = await request.post("/api/drives", { headers, data: { company: "Wipro", role: "Project Engineer", ctcLpa: 3.5, location: "Bengaluru", eligibility: { minCgpa: 7 }, applyBy: "2026-10-25", examId: sitting.examId } });
  expect(made.status(), await made.text()).toBe(201);
  const id = (await made.json()).id as string;
  await request.post(`/api/drives/${id}/students`, { headers, data: { refs: REFS.slice(0, 4) } });
  await request.post(`/api/drives/${id}/colleges`, { headers, data: { name: "Government Engineering College, Nagpur", code: "GECN" } });
  await request.post(`/api/drives/${id}/stage`, { headers, data: { refs: ["CS002", "CS003"], stage: "interview" } });
  const offer = await request.post(`/api/drives/${id}/offers`, { headers, data: { ref: "CS001", ctcLpa: 3.5, joiningDate: "2027-07-01", note: "Bengaluru, training at Mysuru" } });
  expect(offer.status(), await offer.text()).toBe(201);
  const offerLink = (await offer.json()).link as string;
  const opened = await request.post(`/api/drives/${id}/apply-link`, { headers, data: { open: true, openToNew: true } });
  const applyLink = (await opened.json()).link as string;
  const applied = await request.post(`/api/apply/${encodeURIComponent(new URL(applyLink).searchParams.get("apply")!)}`, { data: { ref: "CS006", email: "meera@college.ac.in" } });
  const statusLink = (await applied.json()).statusLink as string;

  await signIn(page);
  await nav(page, "Placement");
  await page.getByRole("tab", { name: "Readiness" }).click();
  await expect(page.getByRole("region", { name: "Readiness by branch and topic" })).toBeVisible();
  await shoot(page, "college-09-readiness", { fullPage: true });
  await page.getByRole("tab", { name: "Funnel" }).click();
  await expect(page.getByRole("region", { name: "Funnel by drive" })).toContainText("Wipro");
  await shoot(page, "college-10-funnel", { fullPage: true });
  await page.getByRole("tab", { name: "Year-wise report" }).click();
  await shoot(page, "college-11-placement-report", { fullPage: true });
  await page.getByRole("tab", { name: "Drives" }).click();
  await page.getByRole("region", { name: "Drives" }).getByRole("button", { name: "Wipro" }).click();
  await expect(page.getByRole("region", { name: "Offers" })).toBeVisible();
  await shoot(page, "college-12-drive-colleges-offers-funnel", { fullPage: true });

  await page.goto(pathOf(applyLink));
  await expect(page.getByRole("region", { name: "Apply" })).toBeVisible();
  await shoot(page, "college-13-apply-page");
  await page.goto(pathOf(statusLink));
  await page.waitForLoadState("networkidle");
  await shoot(page, "college-14-application-status");
  await page.goto(pathOf(offerLink));
  await page.waitForLoadState("networkidle");
  await shoot(page, "college-15-offer-page");
});

test("an interview with a panel", async ({ page, request }) => {
  test.setTimeout(180_000);
  const token = (await (await request.post("/api/auth/login", { data: OWNER })).json()).token as string;
  const headers = { authorization: `Bearer ${token}` };
  const made = await request.post("/api/interviews", {
    headers,
    data: { title: "Backend round 2", candidateName: "Ananya Iyer", candidateRef: "CS004", scheduledAt: new Date(Date.now() + 3_600_000).toISOString(), minutes: 45, problem: "Merge k sorted lists. Talk through the complexity first." },
  });
  expect(made.status(), await made.text()).toBe(201);
  const interview = await made.json();
  const code = new URL(interview.link).searchParams.get("interview")!;
  await request.put(`/api/interviews/room/${encodeURIComponent(code)}/code`, { data: { code: "import heapq\n\ndef merge(lists):\n    heap = [(l[0], i, 0) for i, l in enumerate(lists) if l]\n    heapq.heapify(heap)\n    out = []\n    while heap:\n        v, i, j = heapq.heappop(heap)\n        out.append(v)\n        if j + 1 < len(lists[i]):\n            heapq.heappush(heap, (lists[i][j + 1], i, j + 1))\n    return out\n", language: "python" } });
  await request.post(`/api/interviews/${interview.id}/scorecard`, { headers, data: { criteria: [{ name: "Problem solving", score: 4 }, { name: "Code quality", score: 4 }, { name: "Communication", score: 5 }], recommendation: "yes", summary: "Heap approach straight away; explained O(n log k) clearly." } });

  await signIn(page);
  await nav(page, "Interviews");
  await page.getByRole("button", { name: "Open the room" }).first().click();
  await expect(page.getByLabel("Candidate's code")).toContainText("heapq");
  await shoot(page, "college-16-interview-room-scored", { fullPage: true });
  await page.getByRole("button", { name: "All interviews" }).click();
  await page.getByRole("button", { name: "Schedule an interview" }).first().click();
  await expect(page.getByRole("dialog", { name: "Schedule an interview" })).toBeVisible();
  await shoot(page, "college-17-schedule-with-panel");
  await page.goto(pathOf(interview.link));
  await expect(page.getByRole("region", { name: "Interview" })).toBeVisible();
  await shoot(page, "college-18-candidate-interview-room");
});

test("paper review, staff from a sheet, departments, and the console in Hindi", async ({ page, request }) => {
  test.setTimeout(180_000);
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title: "End-semester — Operating systems", refs: REFS.slice(0, 2), names: PEOPLE.slice(0, 2) });
  const headers = { authorization: `Bearer ${sitting.token}` };
  expect((await request.post(`/api/exams/${sitting.examId}/review`, { headers, data: { note: "Units 1–5, two sets; please check Q2's rubric" } })).status()).toBe(200);
  await request.put(`/api/exams/${sitting.examId}/department`, { headers, data: { department: "CSE" } });
  await request.post("/api/staff/import", { headers, data: { csv: "email,name,role,department\nhod.cse@college.ac.in,Dr Meena Rao,reviewer,CSE\nhod.ece@college.ac.in,Dr Arun Pillai,reviewer,ECE\nlab.cse@college.ac.in,Suresh Kumar,invigilator,CSE", dryRun: false } });

  await signIn(page);
  await openExam(page, "End-semester — Operating systems", "Overview");
  await expect(page.getByRole("region", { name: "Paper review" })).toContainText("With its reviewer");
  await shoot(page, "college-19-paper-review", { fullPage: true });

  await nav(page, "Staff");
  const sheet = page.getByRole("region", { name: "Add staff from a sheet" });
  await sheet.getByRole("textbox", { name: /Paste the sheet/ }).fill("email,name,role,department\nfaculty1@college.ac.in,Prof Kavita Shah,author,CSE\nfaculty2@college.ac.in,Prof Imran Ali,author,MECH\nbad-email,Someone,author,CSE");
  await sheet.getByRole("button", { name: "Check the sheet" }).click();
  await expect(sheet.getByRole("list", { name: "Rows to fix" })).toBeVisible();
  await shoot(page, "college-20-staff-sheet-and-departments", { fullPage: true });

  await nav(page, "Exams");
  await shoot(page, "college-21-exams-with-department");
  await page.getByRole("button", { name: "कंसोल हिन्दी में दिखाएँ" }).click();
  await shoot(page, "college-22-console-in-hindi");
  await page.getByRole("button", { name: "Show the console in English" }).click();

  await nav(page, "Billing");
  await page.waitForLoadState("networkidle");
  await shoot(page, "college-23-billing-quotation-neft", { fullPage: true });
});

test("the demo test", async ({ page }) => {
  await page.goto("/?demo");
  await expect(page.getByText("Practice test — nothing is recorded").first()).toBeVisible();
  await shoot(page, "college-24-demo-test");
});
