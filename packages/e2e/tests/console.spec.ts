import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { OWNER, seedSitting, type Sitting } from "./support.js";

/** ROADMAP §13: a recruiter's side, in a real browser — sign in, results, the spreadsheet, a report. */

/** Sit and grade one candidate's attempt through the API, as a candidate and an institution would. */
async function sitAndGrade(request: APIRequestContext, sitting: Sitting, ref: string, choice: string) {
  const code = decodeURIComponent(new URL(sitting.links[ref]!).searchParams.get("invite")!);
  const opened = await request.post("/api/invitations/redeem", { data: { code } });
  expect(opened.status()).toBe(200);
  const { token, attemptId } = await opened.json();
  const candidate = { authorization: `Bearer ${token}` };
  expect((await request.post("/api/attempts/me/answers", { headers: candidate, data: { questionId: "q1", answer: choice } })).status()).toBe(202);
  expect((await request.post("/api/attempts/me/submit", { headers: candidate })).status()).toBe(200);
  const graded = await request.post(`/api/attempts/${attemptId}/grade`, { headers: { authorization: `Bearer ${sitting.token}` } });
  expect(graded.status(), await graded.text()).toBe(200);
  return attemptId as string;
}

test("a recruiter signs in, reads the results, downloads them, and opens one candidate's report", async ({ page, request }) => {
  const sitting = await seedSitting(request, { refs: ["CS001", "CS002"] });
  await sitAndGrade(request, sitting, "CS001", "1");
  await sitAndGrade(request, sitting, "CS002", "0");

  await page.goto("/console/");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Exams", exact: true }).click();
  await page.getByRole("button", { name: sitting.title, exact: true }).click();
  await page.getByRole("button", { name: "Results", exact: true }).click();

  const candidates = page.getByRole("region", { name: "Candidates" });
  const rows = candidates.getByRole("row");
  // Best first: CS001 chose the right option.
  await expect(rows.nth(1)).toContainText("CS001");
  await expect(rows.nth(1)).toContainText("4 / 10 (40%)");
  await expect(rows.nth(2)).toContainText("CS002");
  await expect(page.getByRole("region", { name: "Summary" })).toContainText("Graded2");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download CSV" }).click()]);
  expect(download.suggestedFilename()).toBe(`${sitting.examId}-results.csv`);
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain('"CS001","Candidate 1","cs001@college.test","graded",4,10,40');

  await rows.nth(1).getByRole("button", { name: "Scorecard" }).click();
  await expect(page.getByRole("heading", { name: /Candidate 1/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Answers" })).toContainText("Merge sort");
  await expect(page.getByRole("region", { name: "Follow-up evidence" })).toContainText("None were asked.");
  await expect(page.getByText(/Record: \d+ entries, head [0-9a-f]{16}…/)).toBeVisible();
});

test("a report link from a webhook or Greenhouse opens straight on that candidate's report", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  const attemptId = await sitAndGrade(request, sitting, "CS001", "1");

  await page.goto(`/console/?report=${attemptId}`);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: /Candidate 1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
});

test("an exam page: who qualified against the cut-off, the paper tried as a candidate, and a candidate found with Ctrl+K", async ({ page, request }) => {
  const sitting = await seedSitting(request, { refs: ["CS001", "CS002"], names: ["Ananya Iyer", "Rohan Das"], cutoff: { percent: 30 } });
  await sitAndGrade(request, sitting, "CS001", "1");
  await sitAndGrade(request, sitting, "CS002", "0");

  await page.goto("/console/");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Exams", exact: true }).click();
  await page.getByRole("button", { name: sitting.title, exact: true }).click();

  const side = page.getByRole("complementary", { name: "Candidates at a glance" });
  await expect(side.getByRole("listitem").filter({ hasText: /^Qualified/ })).toContainText("1");
  await expect(side.getByRole("listitem").filter({ hasText: "Not qualified" })).toContainText("1");
  await expect(side.getByRole("listitem").filter({ hasText: "Submitted" })).toContainText("2");

  // Tried as a candidate: nothing reaches the server, so the counts stay as they are.
  await page.getByRole("navigation", { name: "Exam" }).getByRole("button", { name: "Questions" }).click();
  await page.getByRole("button", { name: "Try test" }).click();
  const trying = page.getByRole("dialog", { name: "Try test" });
  await trying.getByRole("radio", { name: /Merge sort/ }).check();
  await trying.getByRole("button", { name: "Submit preview" }).click();
  await expect(trying.getByText(/on the 1 question marked automatically/)).toBeVisible();
  await trying.getByRole("button", { name: "Close" }).click();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: "Search exams, candidates and pages" }).fill("Ananya");
  await expect(page.getByRole("option", { name: /Ananya Iyer/ }).first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Scorecard" })).toContainText("Qualified");
  await expect(page.getByRole("region", { name: "Answers" })).toContainText("Merge sort");
});
