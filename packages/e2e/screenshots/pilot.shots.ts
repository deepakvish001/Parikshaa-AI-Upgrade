import { createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SECRET } from "../src/database.js";
import { local, MCQ, OWNER, readyToBegin, SHORT, seedSitting, type Sitting } from "../tests/support.js";
import { shoot, shootPart } from "./shoot.js";

/** What a pilot college asked for, screen by screen: WhatsApp, the lab, results sent out, and after. */

const NUMERIC = { id: "q3", kind: "numeric", stem: "A train covers 180 km in 2.5 hours. What is its average speed in km/h?", maxScore: 2, rubric: [], expected: 72, tolerance: 0 };
const PEOPLE = ["Aarav Sharma", "Diya Patel", "Ishaan Reddy", "Ananya Iyer", "Kabir Singh", "Meera Nair"];
const REFS = PEOPLE.map((_, i) => `CS${String(i + 1).padStart(3, "0")}`);

async function signIn(page: Page) {
  await page.goto("/console/");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "Account" })).toBeVisible();
}

async function openExam(page: Page, title: string, tab: string) {
  await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Exams", exact: true }).click();
  await page.getByRole("button", { name: title, exact: true }).first().click();
  await page.getByRole("button", { name: tab, exact: true }).click();
}

/** A candidate sits and submits through the API, and is graded. */
async function sitAndGrade(request: APIRequestContext, sitting: Sitting, ref: string, answers: { mcq: string; short: string; numeric: string }) {
  const code = decodeURIComponent(new URL(sitting.links[ref]!).searchParams.get("invite")!);
  const opened = await request.post("/api/invitations/redeem", { data: { code } });
  expect(opened.status(), await opened.text()).toBe(200);
  const { token, attemptId } = await opened.json();
  const headers = { authorization: `Bearer ${token}` };
  for (const [q, a] of [["q1", answers.mcq], ["q2", answers.short], ["q3", answers.numeric]] as const) {
    expect((await request.post("/api/attempts/me/answers", { headers, data: { questionId: q, answer: a } })).status()).toBe(202);
  }
  expect((await request.post("/api/attempts/me/submit", { headers })).status()).toBe(200);
  const graded = await request.post(`/api/attempts/${attemptId}/grade`, { headers: { authorization: `Bearer ${sitting.token}` } });
  expect(graded.status(), await graded.text()).toBe(200);
  return { attemptId: attemptId as string, token: token as string };
}

test("inviting by WhatsApp, and sending results", async ({ page, request }) => {
  test.setTimeout(300_000);
  const title = "Campus Drive 2026 — Aptitude";
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title, refs: REFS.slice(0, 4), names: PEOPLE.slice(0, 4), cutoff: { percent: 50 } });
  for (const [i, ref] of REFS.slice(0, 3).entries()) {
    await sitAndGrade(request, sitting, ref, { mcq: i === 2 ? "0" : "1", short: "The interval halves each step until it is empty.", numeric: i === 1 ? "70" : "72" });
  }

  await signIn(page);
  await openExam(page, title, "Candidates");
  const invite = page.getByRole("region", { name: "Invite candidates" });
  await invite.getByRole("checkbox", { name: "WhatsApp" }).check();
  await page.getByLabel("Candidate list (CSV)").setInputFiles({
    name: "second-batch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(["roll_number,name,email,phone", "CS005,Kabir Singh,kabir.singh@college.edu.in,98765 43210", "CS006,Meera Nair,,91234 56780"].join("\n")),
  });
  await expect(invite.getByRole("group", { name: "Import preview" })).toContainText("2 candidates ready to invite");
  await shootPart(invite, "pilot-01-invite-by-whatsapp");
  await invite.getByRole("button", { name: /^Invite 2/ }).click();
  await expect(invite.getByRole("status")).toContainText("Invited 2");

  await page.getByRole("button", { name: "Results", exact: true }).click();
  await page.getByRole("button", { name: "Send results to candidates…" }).click();
  const dialog = page.getByRole("dialog", { name: "Send results to candidates" });
  await expect(dialog).toContainText("3 candidates to send to");
  await shoot(page, "pilot-02-send-results", { fullPage: false });
  await dialog.getByRole("button", { name: "Send to 3 candidates" }).click();
  await expect(page.getByText("Results on their way to 3 candidates.")).toBeVisible();
});

test("a sitting in the computer lab", async ({ page, browser, request }) => {
  test.setTimeout(300_000);
  const title = "Semester 5 — Lab Test";
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT], title, refs: REFS.slice(0, 3), names: PEOPLE.slice(0, 3) });

  await signIn(page);
  await openExam(page, title, "Live sitting");
  const lab = page.getByRole("region", { name: "Lab mode" });
  await lab.getByRole("button", { name: "Change" }).click();
  await lab.getByRole("button", { name: "Add it" }).click();
  await lab.getByRole("checkbox", { name: "Candidates wait for the invigilator to start" }).check();
  await shootPart(lab, "pilot-03-lab-mode-settings");
  await lab.getByRole("button", { name: "Save" }).click();
  await expect(lab.getByRole("button", { name: "Start the test for everyone" })).toBeVisible();

  // A candidate in the lab opens their link: they wait.
  const candidate = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await candidate.goto(local(sitting.links["CS001"]!));
  await readyToBegin(candidate);
  await expect(candidate.getByRole("region", { name: "Waiting to start" })).toBeVisible();
  await shoot(candidate, "pilot-04-candidate-waiting", { fullPage: false });

  await shoot(page, "pilot-05-lab-start-for-everyone", { fullPage: false });
  await lab.getByRole("button", { name: "Start the test for everyone" }).click();
  // The waiting page lets them in by itself.
  await expect(candidate.getByRole("radio", { name: "Merge sort" })).toBeVisible({ timeout: 15_000 });

  // Opened away from the lab: shown as the server answers it, since this machine is inside its own network.
  const away = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await away.route("**/api/invitations/redeem", (route) => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "outside_network", message: "lab only" }) }));
  await away.goto(local(sitting.links["CS002"]!));
  await readyToBegin(away);
  await expect(away.getByRole("region", { name: "Exam room only" })).toBeVisible();
  await shoot(away, "pilot-06-candidate-exam-room-only", { fullPage: false });
});

/** The code printed on a scorecard, as the server makes it (rechecks.ts, ScorecardCodes). */
const scorecardCode = (orgId: string, attemptId: string) => {
  const key = createHmac("sha256", SECRET).update("parikshaa-scorecards").digest();
  return `${orgId}.${attemptId}.${createHmac("sha256", key).update(`${orgId}.${attemptId}`).digest("base64url").slice(0, 16)}`;
};

test("results on the candidate's page, a recheck, and the scorecard", async ({ page, browser, request }) => {
  test.setTimeout(300_000);
  const title = "Campus Drive 2026 — Reasoning";
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title, refs: REFS.slice(0, 3), names: PEOPLE.slice(0, 3), cutoff: { percent: 50 } });
  const sat: { attemptId: string }[] = [];
  for (const [i, ref] of REFS.slice(0, 3).entries()) {
    sat.push(await sitAndGrade(request, sitting, ref, { mcq: "1", short: "The interval halves each step until it is empty.", numeric: i === 0 ? "70" : "72" }));
  }
  const staff = { authorization: `Bearer ${sitting.token}` };
  expect((await request.post(`/api/exams/${sitting.examId}/results/release`, { headers: staff, data: { outcome: true } })).status()).toBe(202);

  // The candidate opens their link again: their result, and a recheck asked for.
  const candidate = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await candidate.goto(local(sitting.links[REFS[0]!]!));
  const card = candidate.getByRole("region", { name: "Your result" });
  await expect(card).toContainText("out of");
  await card.getByRole("button", { name: "Ask for question 3 to be rechecked" }).click();
  await card.getByLabel("Why should it be looked at again?").fill("180 km in 2.5 hours: I wrote 70 by rounding the time; my working shows 72.");
  await shootPart(card, "pilot-07-candidate-result-and-recheck");
  await card.getByRole("button", { name: "Send the request" }).click();
  await expect(card).toContainText("Recheck asked: waiting for a reply");

  // The institution answers it from the Results tab.
  await signIn(page);
  await openExam(page, title, "Results");
  const rechecks = page.getByRole("region", { name: "Rechecks asked for" });
  await expect(rechecks).toContainText("1 to answer");
  await rechecks.getByRole("spinbutton").fill("2");
  await rechecks.getByRole("textbox", { name: "Reply to the candidate" }).fill("Your working shows 72: full marks for question 3.");
  await shootPart(rechecks, "pilot-08-recheck-in-the-console");
  await rechecks.getByRole("button", { name: "Change the mark and reply" }).click();
  await expect(rechecks).toContainText("All answered");

  await candidate.reload();
  await expect(card).toContainText("Rechecked: changed from 0 to 2");
  await shootPart(card, "pilot-09-candidate-recheck-answered");

  // The scorecard: the PDF (kept as a sample, and pictured from it), and what its code opens.
  const pdf = await request.get(`/api/attempts/${sat[0]!.attemptId}/scorecard.pdf`, { headers: staff });
  expect(pdf.status()).toBe(200);
  writeFileSync(new URL("../../../docs/samples/scorecard.pdf", import.meta.url), await pdf.body());
  const orgId = sitting.links[REFS[0]!]!.match(/invite=([^.]+)/)![1]!;
  const check = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await check.goto(`/?scorecard=${encodeURIComponent(scorecardCode(decodeURIComponent(orgId), sat[0]!.attemptId))}`);
  await expect(check.getByRole("heading", { name: "This scorecard is genuine." })).toBeVisible();
  await shoot(check, "pilot-11-scorecard-check", { fullPage: false });
});

test("marking written answers by hand", async ({ page, request }) => {
  test.setTimeout(300_000);
  const title = "Semester 5 — Algorithms Quiz";
  const sitting = await seedSitting(request, { questions: [MCQ, SHORT, NUMERIC], title, refs: REFS.slice(0, 4), names: PEOPLE.slice(0, 4) });
  const answers = [
    "Each comparison halves the interval that could hold the target; once low passes high the interval is empty, so the loop must end after about log n steps.",
    "Because the range gets smaller every time.",
    "It stops when it finds the number.",
    "The search space halves each step until nothing is left to search.",
  ];
  for (const [i, ref] of REFS.slice(0, 4).entries()) await sitAndGrade(request, sitting, ref, { mcq: "1", short: answers[i]!, numeric: "72" });

  await signIn(page);
  await openExam(page, title, "Results");
  const card = page.getByRole("region", { name: "Written answers" });
  await expect(card).toContainText("0 of 4 read by a person");
  await card.getByRole("button", { name: "Start marking" }).click();
  const drawer = page.getByRole("dialog", { name: "Marking written answers" });
  await drawer.getByRole("button", { name: "Keep the mark" }).click();
  await expect(drawer).toContainText("Answer 2 of 4");
  await drawer.getByRole("spinbutton").fill("3");
  await shoot(page, "pilot-12-marking-by-hand", { fullPage: false });
});
