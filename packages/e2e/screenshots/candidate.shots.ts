import { expect, test } from "@playwright/test";
import { local, MCQ, PRIVATE_OWNER, SHORT, seedSitting, setPrivacyNotice } from "../tests/support.js";
import { FIGURE_SERIES, SALES_CHART, uploadPicture } from "../tests/pictures.js";
import { aptitudePaper, MERGE_INTERVALS, MERGE_SOLUTION, MERGE_UNSORTED, PRACTICE_SET } from "./fixtures.js";
import { shoot } from "./shoot.js";

/** The candidate's side, page by page. */

const NUMERIC = { id: "q3", kind: "numeric", stem: "A train covers 180 km in 2.5 hours. What is its average speed in km/h?", maxScore: 2, rubric: [], expected: 72, tolerance: 0 };
const QUESTIONS = [MCQ, SHORT, NUMERIC];
const TITLE = "Campus Drive 2026 — Aptitude and Reasoning";


test("the access code, when a candidate has no link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Access code")).toBeVisible();
  await shoot(page, "candidate-01-access-code");
});

test("the privacy notice, agreed to before anything starts", async ({ page, request }) => {
  const sitting = await seedSitting(request, { owner: PRIVATE_OWNER, questions: [MCQ], title: TITLE });
  await setPrivacyNotice(request, sitting.token);
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  await shoot(page, "candidate-02-privacy-notice");
});

test("a link opened before the window", async ({ page, request }) => {
  const opensAt = new Date(Date.now() + 26 * 3_600_000);
  opensAt.setUTCMinutes(30, 0, 0);
  const sitting = await seedSitting(request, { questions: [MCQ], title: TITLE, opensAt });
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("region", { name: "Not open yet" })).toBeVisible();
  await shoot(page, "candidate-03-not-open-yet");
});

test("the camera check and the identity photos, for a proctored test", async ({ page, request }) => {
  const sitting = await seedSitting(request, {
    questions: [SHORT],
    title: TITLE,
    proctoring: { identity: true, snapshotEverySeconds: 60, browserEvents: true },
  });
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: "This test uses your camera" })).toBeVisible();
  await shoot(page, "candidate-04-camera-notice");
  await page.getByRole("button", { name: "Allow the camera" }).click();
  await expect(page.getByRole("button", { name: "My camera works — start the test" })).toBeVisible();
  await page.waitForTimeout(600);
  await shoot(page, "candidate-05-camera-check");
  await page.getByRole("button", { name: "My camera works — start the test" }).click();
  await expect(page.getByRole("heading", { name: "Confirm who you are" })).toBeVisible();
  await page.getByRole("button", { name: "Take my photo" }).click();
  await page.waitForTimeout(400);
  await shoot(page, "candidate-06-identity");
});

test("answering: one question at a time, autosave, a follow-up question, and the submit summary", async ({ page, request }) => {
  const sitting = await seedSitting(request, { questions: [...QUESTIONS, ...PRACTICE_SET], title: TITLE, vivaTriggerRatio: 0.5 });
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  const foot = page.locator(".qfoot");

  // A few questions opened and answered first, so the palette reads like a sitting under way.
  await page.getByRole("button", { name: /^Question 4:/ }).click();
  await page.getByRole("radio", { name: "₹1,800" }).check();
  await foot.getByRole("button", { name: "Save & next" }).click();
  await page.getByRole("radio", { name: "12" }).check();
  await foot.getByRole("button", { name: "Mark for review & next" }).click();
  await foot.getByRole("button", { name: "Mark for review & next" }).click();
  await foot.getByRole("button", { name: "Save & next" }).click();
  await page.getByRole("button", { name: /^Question 1:/ }).click();

  await page.getByRole("radio", { name: "Merge sort" }).check();
  await page.waitForTimeout(300);
  await shoot(page, "candidate-07-exam", { fullPage: false });

  await foot.getByRole("button", { name: "Save & next" }).click();
  const probe = page.getByRole("region", { name: "Follow-up question" });
  await expect(probe).toContainText("Walk me through why your answer holds");
  await probe.getByLabel("Your reply to the follow-up").fill("Merge sort only moves an element past another when it is strictly smaller, so equal keys keep their order.");
  await shoot(page, "candidate-08-follow-up", { fullPage: false });

  await page.getByRole("combobox", { name: "Language" }).selectOption("hi");
  const probeHi = page.getByRole("region", { name: "अनुवर्ती प्रश्न" });
  await probeHi.getByRole("button", { name: "उत्तर भेजें" }).click();
  await expect(probeHi).toBeHidden();
  await page.getByRole("textbox").fill("हर तुलना के बाद खोज का अंतराल आधा हो जाता है, इसलिए log₂(n) चरणों में वह खाली हो जाता है।");
  await page.waitForTimeout(1600);
  await shoot(page, "candidate-09-hindi", { fullPage: false });
  await page.getByRole("combobox", { name: "भाषा" }).selectOption("en");

  await foot.getByRole("button", { name: "Save & next" }).click();
  await page.getByRole("textbox").fill("72");
  await foot.getByRole("button", { name: "Save & next" }).click();
  await page.getByRole("button", { name: "Submit attempt" }).click();
  await expect(page.getByRole("dialog", { name: "Submit your attempt?" })).toBeVisible();
  await shoot(page, "candidate-18-submit-summary", { fullPage: false });
  await page.getByRole("button", { name: "Yes, submit" }).click();
  const record = page.getByRole("region", { name: "Your record" });
  await record.getByRole("button", { name: "Check this record" }).click();
  await expect(record.getByRole("status")).toContainText("unbroken");
  await shoot(page, "candidate-12-receipt");
});

test("a test taken section by section", async ({ page, request }) => {
  const sitting = await seedSitting(request, {
    questions: [MCQ],
    sections: [
      { id: "apt", title: "Aptitude", pick: 1, pool: [NUMERIC], durationMs: 20 * 60_000 },
      { id: "verbal", title: "Reasoning", pick: 1, pool: [SHORT], durationMs: 15 * 60_000 },
    ],
    title: TITLE,
    vivaTriggerRatio: 0.99,
  });
  await page.goto(local(sitting.links["CS001"]!));
  await page.getByRole("button", { name: "Finish General and go on" }).click();
  await shoot(page, "candidate-10-section-leave", { fullPage: false });
  await page.getByRole("button", { name: "Leave General" }).click();
  await expect(page.getByRole("timer").first()).toBeVisible();
  await page.getByRole("textbox").fill("72");
  await shoot(page, "candidate-11-section-timer", { fullPage: false });
});

test("on a phone", async ({ browser, request }) => {
  const sitting = await seedSitting(request, { questions: [...QUESTIONS, ...PRACTICE_SET], title: TITLE, vivaTriggerRatio: 0.99 });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto(local(sitting.links["CS001"]!));
  await expect(phone.getByRole("heading", { name: TITLE })).toBeAttached();
  await phone.getByRole("radio", { name: "Merge sort" }).check();
  await shoot(phone, "candidate-13-phone", { fullPage: false });
});

test("an aptitude paper: pictures, a passage, several right options, negative marking and the palette", async ({ page, browser, request }) => {
  const seeded = await seedSitting(request, { questions: [MCQ], title: "Placeholder" });
  const chart = await uploadPicture(browser, request, seeded.token, SALES_CHART);
  const series = await uploadPicture(browser, request, seeded.token, FIGURE_SERIES);
  const sitting = await seedSitting(request, {
    questions: aptitudePaper(chart, series),
    title: "Aptitude Mock Test — Quantitative and Reasoning",
    vivaTriggerRatio: 0.99,
  });
  await page.goto(local(sitting.links["CS001"]!));
  const foot = page.locator(".qfoot");
  await expect(page.getByRole("navigation", { name: "Questions" })).toBeVisible();
  await page.getByRole("textbox").fill("100");
  await foot.getByRole("button", { name: "Save & next" }).click();
  await page.getByRole("radio", { name: "5" }).check();
  await foot.getByRole("button", { name: "Save & next" }).click();
  await page.getByRole("checkbox", { name: "23" }).check();
  await page.getByRole("checkbox", { name: "29" }).check();
  await foot.getByRole("button", { name: "Mark for review & next" }).click();
  await page.getByRole("radio", { name: "First week of June" }).check();
  await page.waitForTimeout(600);
  await shoot(page, "candidate-14-aptitude", { fullPage: false });
  await page.getByRole("button", { name: /^Question 1:/ }).click();
  await page.waitForTimeout(400);
  await shoot(page, "candidate-19-chart", { fullPage: false });
});

test("a coding question, as on LeetCode: the workspace, Run, full screen, and Submit", async ({ page, request }) => {
  const sitting = await seedSitting(request, {
    questions: [MERGE_INTERVALS],
    title: "Coding Round — Campus Drive 2026",
    vivaTriggerRatio: 0.99,
  });
  await page.goto(local(sitting.links["CS001"]!));
  const editor = page.locator(".cm-content");
  await expect(editor).toBeVisible();
  const write = async (source: string) => {
    await editor.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.insertText(source);
  };

  // In the paper: the statement, the editor, and Run on the examples.
  await write(MERGE_SOLUTION);
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toContainText("2/2 examples pass", { timeout: 30_000 });
  await page.waitForTimeout(500);
  await shoot(page, "candidate-15-coding");

  // Full screen: the problem beside the editor, and Submit against every test.
  await page.getByRole("button", { name: "Full screen" }).click();
  const workspace = page.getByRole("dialog");
  await expect(workspace).toBeVisible();
  await workspace.getByRole("button", { name: "Submit" }).click();
  await expect(workspace.getByRole("region", { name: "Submission results" })).toContainText("5/5 tests passed", { timeout: 30_000 });
  await page.waitForTimeout(500);
  await shoot(page, "candidate-16-workspace", { fullPage: false });

  // In the dark editor, a submission that forgot to sort: right on the examples, wrong on a hidden test.
  await workspace.getByRole("button", { name: "Dark editor" }).click();
  await write(MERGE_UNSORTED);
  await workspace.getByRole("button", { name: "Submit" }).click();
  const verdict = workspace.getByRole("region", { name: "Submission results" });
  await expect(verdict).toContainText("Wrong answer", { timeout: 30_000 });
  await verdict.getByRole("button", { name: /Hidden test 3/ }).click();
  await page.waitForTimeout(500);
  await shoot(page, "candidate-17-wrong-answer", { fullPage: false });
});
