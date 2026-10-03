import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ORG, verifyLearner } from "../src/database.js";
import { MCQ, OWNER, SHORT, seedSitting, type Sitting } from "../tests/support.js";
import { shoot, shootPart } from "./shoot.js";

/**
 * F1 Hire and F2 Campus, screen by screen (docs/PREP-TRACKER.md plan rows 89,
 * 90, 95, 96): a company signing itself up and its four steps, a test from a
 * role, the candidate report and its link for a hiring manager; a college's
 * class with its attendance and lab record, and the same class from its
 * student's side on the practice site.
 */

const SITE = "nit-practice";
const PASSWORD = "practice every single day";
const NUMERIC = { id: "q3", kind: "numeric", stem: "A train covers 180 km in 2.5 hours. What is its average speed in km/h?", maxScore: 2, rubric: [], expected: 72, tolerance: 0 };
const SUM = "a, b = map(int, input().split())\nprint(a + b)\n";
const MAX = "a, b = map(int, input().split())\nprint(max(a, b))\n";

async function signIn(page: Page) {
  await page.goto("/console/");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Account" })).toBeVisible();
}
const nav = (page: Page, name: string) => page.getByRole("navigation", { name: "Account" }).getByRole("button", { name, exact: true }).click();

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

test("a company hires on its own: sign-up, four steps, a test from a role", async ({ page }) => {
  test.setTimeout(300_000);
  const email = `hr-${Date.now().toString(36)}@kiranshala.e2e.test`;
  await page.goto("/console/");
  await page.getByRole("button", { name: "Make your institution's account" }).click();
  await page.getByRole("radio", { name: "A company, hiring" }).check();
  await page.getByLabel("Company", { exact: true }).fill("Kiranshala Labs");
  await page.getByLabel("Your name").fill("Neha Iyer");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a long startup password");
  await shoot(page, "hire-01-company-sign-up", { fullPage: false });
  await page.getByRole("button", { name: "Make the account" }).click();
  await expect(page.getByTestId("tour").getByRole("dialog", { name: "Home" })).toBeVisible();
  await page.keyboard.press("Escape");

  const path = page.getByRole("region", { name: "Hire in four steps" });
  await expect(path).toBeVisible();
  await shoot(page, "hire-02-four-steps", { fullPage: false });
  await path.getByRole("button", { name: "Add starter questions" }).click();
  await path.getByRole("button", { name: "Choose a role" }).click();
  const drawer = page.getByRole("dialog", { name: "New test from a job" });
  await drawer.getByRole("searchbox", { name: "Find a role" }).fill("intern");
  await drawer.getByRole("radio", { name: /Software engineering intern/ }).check();
  await shoot(page, "hire-03-role-library", { fullPage: false });
  await drawer.getByRole("button", { name: "Draft the test" }).click();
  await expect(drawer.getByRole("button", { name: /Make the test · 10 questions/ })).toBeVisible();
  await shoot(page, "hire-04-test-from-a-role", { fullPage: false });
  await drawer.getByRole("button", { name: /Make the test · 10 questions/ }).click();
  await expect(drawer).toHaveCount(0);
  await nav(page, "Home");
  await expect(path.getByText("1 of 4 done.", { exact: false })).toBeVisible();
  await shoot(page, "hire-05-first-step-done", { fullPage: false });
});

test("the candidate report: its PDF, AI use and a link for a hiring manager", async ({ page, request }) => {
  test.setTimeout(300_000);
  const people = ["Aarav Sharma", "Diya Patel", "Ishaan Reddy"];
  const refs = ["CS001", "CS002", "CS003"];
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title: "Backend intern test", refs, names: people, cutoff: { percent: 50 } });
  const marks = [["1", "The interval halves until it is empty.", "72"], ["1", "It halves.", "70"], ["0", "Stops.", "60"]] as const;
  for (const [i, ref] of refs.entries()) await sitAndGrade(request, sitting, ref, marks[i]!);

  await signIn(page);
  await nav(page, "Exams");
  await page.getByRole("button", { name: "Backend intern test", exact: true }).first().click();
  await page.getByRole("button", { name: "Results", exact: true }).click();
  const table = page.getByRole("region", { name: "Candidates" });
  await table.getByText("CS001").first().locator("xpath=ancestor::tr").getByRole("button", { name: "Scorecard" }).click();
  const share = page.getByRole("region", { name: "Share the report" });
  await share.getByRole("button", { name: "Make a link" }).click();
  await expect(share.getByRole("textbox", { name: "Link to the report" })).toBeVisible();
  await shoot(page, "hire-06-scorecard-share-report", { fullPage: false });
  await shootPart(share, "hire-07-share-card");
});

test("a college class: course, tests, contests, attendance, lab record — and the student's side", async ({ page, request }) => {
  test.setTimeout(600_000);
  const staff = { authorization: `Bearer ${(await (await request.post("/api/auth/login", { data: OWNER })).json()).token}` };
  const ok = async (method: "post" | "put", url: string, data: object, status = method === "post" ? 201 : 200) => {
    const res = await request[method](url, { headers: staff, data });
    expect(res.status(), `${url}: ${await res.text()}`).toBe(status);
    return res.json();
  };
  await ok("put", "/api/practice-admin/site", { slug: SITE, title: "NIT Trichy Practice Arena", welcome: "Practice for your classes and placements.", open: true });

  // The course: two weeks of practicals.
  const problem = async (stem: string, tests: [string, string][]) => {
    const q = await ok("post", "/api/bank", {
      question: { kind: "code", stem, maxScore: 10, rubric: [], language: "python", tests: tests.map(([input, expected], i) => ({ id: `t${i}`, input, expected, hidden: i > 0, weight: 1 })) },
      difficulty: "easy",
      tags: ["lab"],
    });
    return ok("post", "/api/practice-admin/problems", { bankQuestionId: q.id });
  };
  const sum = await problem("Sum of two\n\nRead two integers and print their sum.", [["2 3\n", "5\n"], ["40 2\n", "42\n"]]);
  const max = await problem("Larger of two\n\nRead two integers and print the larger.", [["2 3\n", "3\n"], ["9 4\n", "9\n"]]);
  const rev = await problem("Reverse a word\n\nRead a word and print it backwards.", [["abc\n", "cba\n"], ["level\n", "level\n"]]);
  const lesson = await ok("post", "/api/practice-admin/lessons", { title: "Reading input in Python", body: "Use `input().split()` and `map(int, …)`.", estMinutes: 10, published: true });
  const track = await ok("post", "/api/practice-admin/tracks", {
    title: "Python Programming Lab",
    description: "The first-year lab: one practical a week.",
    published: true,
    modules: [
      { title: "Week 1: input and output", items: [{ lessonId: lesson.id }, { problemId: sum.id }] },
      { title: "Week 2: decisions", items: [{ problemId: max.id }] },
      { title: "Week 3: strings", items: [{ problemId: rev.id }] },
    ],
  });
  const contest = await ok("post", "/api/practice-admin/contests", {
    title: "Lab Contest 1",
    description: "",
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    problemIds: [max.id],
  });

  // The cohort, and three students who have joined.
  const students = [
    ["Ananya Iyer", "ananya.iyer@nit.ac.in"],
    ["Rohan Gupta", "rohan.gupta@nit.ac.in"],
    ["Meera Nair", "meera.nair@nit.ac.in"],
  ] as const;
  const cohort = await ok("post", "/api/practice-admin/cohorts", { name: "CSE 2029 — Section A", plusDays: 180 });
  await ok("post", `/api/practice-admin/cohorts/${cohort.id}/members`, { csv: ["email", ...students.map(([, e]) => e), "kabir.singh@nit.ac.in"].join("\n"), dryRun: false }, 200);
  const tokens: Record<string, string> = {};
  for (const [name, email] of students) {
    const res = await request.post(`/api/practice/${SITE}/signup`, { data: { name, email, password: PASSWORD } });
    expect(res.status(), await res.text()).toBe(201);
    tokens[email] = (await res.json()).token;
    await verifyLearner(ORG, email);
  }
  const submit = async (email: string, slug: string, answer: string, contestSlug?: string) => {
    const res = await request.post(`/api/practice/${SITE}/problems/${slug}/submit`, {
      headers: { authorization: `Bearer ${tokens[email]}` },
      data: { answer, language: "python", ...(contestSlug === undefined ? {} : { contest: contestSlug }) },
    });
    expect(res.status(), await res.text()).toBe(200);
  };
  await request.post(`/api/practice/${SITE}/lessons/${lesson.slug}/done`, { headers: { authorization: `Bearer ${tokens["ananya.iyer@nit.ac.in"]}` } });
  await submit("ananya.iyer@nit.ac.in", sum.slug, SUM);
  await submit("ananya.iyer@nit.ac.in", max.slug, MAX, contest.slug);
  await submit("ananya.iyer@nit.ac.in", max.slug, MAX);
  await submit("rohan.gupta@nit.ac.in", sum.slug, SUM);

  // A test sat by the class.
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title: "Python unit test 1", refs: ["CS101", "CS102"], names: ["Ananya Iyer", "Rohan Gupta"] });
  await sitAndGrade(request, sitting, "CS101", ["1", "The interval halves until it is empty.", "72"]);
  await sitAndGrade(request, sitting, "CS102", ["0", "Stops.", "70"]);

  // The class.
  const made = await ok("post", "/api/classes", { name: "Python Lab — CSE A", cohortId: cohort.id, trackId: track.id });
  await ok("put", `/api/classes/${made.id}`, { contestIds: [contest.id] });
  for (const [day, topic, present] of [
    ["2026-10-01", "Lab 1: input and output", ["ananya.iyer@nit.ac.in", "rohan.gupta@nit.ac.in", "meera.nair@nit.ac.in"]],
    ["2026-10-02", "Lab 2: decisions", ["ananya.iyer@nit.ac.in", "meera.nair@nit.ac.in"]],
    ["2026-10-03", "Lab 3: strings", ["ananya.iyer@nit.ac.in"]],
  ] as const) {
    const session = await ok("post", `/api/classes/${made.id}/sessions`, { heldOn: day, topic });
    const marks = Object.fromEntries([...students.map(([, e]) => e), "kabir.singh@nit.ac.in"].map((e) => [e, (present as readonly string[]).includes(e)]));
    await ok("put", `/api/classes/${made.id}/sessions/${session.id}/attendance`, { marks });
  }
  await ok("put", `/api/classes/${made.id}/lab`, { email: "ananya.iyer@nit.ac.in", problemId: sum.id, signed: true });

  // The console.
  await signIn(page);
  await nav(page, "Classes");
  await expect(page.getByRole("region", { name: "Classes" })).toContainText("Python Lab — CSE A");
  await shoot(page, "campus-01-classes", { fullPage: false });
  await page.getByRole("button", { name: "Python Lab — CSE A" }).click();
  await expect(page.getByRole("region", { name: "Python Lab — CSE A" })).toContainText("Ananya Iyer");
  await shoot(page, "campus-02-class-page");
  await page.getByRole("button", { name: "Lab record of Ananya Iyer" }).click();
  await expect(page.getByRole("dialog", { name: "Lab record" })).toContainText("Signed by");
  await shoot(page, "campus-03-lab-record-console", { fullPage: false });

  // The student's side.
  await page.addInitScript(([key, token]) => localStorage.setItem(key!, token!), [`parikshaa.practice.${SITE}.session`, tokens["ananya.iyer@nit.ac.in"]!]);
  await page.goto(`/practice/${SITE}/home`);
  await expect(page.getByRole("region", { name: "Your classes" })).toBeVisible();
  await page.goto(`/practice/${SITE}/classes`);
  await expect(page.getByRole("region", { name: "Python Lab — CSE A" })).toBeVisible();
  await shoot(page, "campus-04-my-classes");
  await page.getByRole("link", { name: "Open the lab record" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Lab record/ })).toBeVisible();
  await shoot(page, "campus-05-my-lab-record");
});
