import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { local, MCQ, PRIVATE_OWNER, readyToBegin, seedSitting, setPrivacyNotice, submitAttempt } from "./support.js";

/** ROADMAP §11, in a real browser: consent before the clock, and the candidate's own data after. */

test("a candidate agrees to the privacy notice before starting, and can download their data afterwards", async ({ page, request }) => {
  const sitting = await seedSitting(request, { owner: PRIVATE_OWNER, questions: [MCQ] });
  await setPrivacyNotice(request, sitting.token);

  // The notice is the first step, before the instructions; agreeing starts nothing.
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: "Before you start: your data" })).toBeVisible();
  await expect(page.getByText("E2E Private Ltd")).toBeVisible();
  const agree = page.getByRole("button", { name: "Agree and continue" });
  await expect(agree).toBeDisabled();
  await page.getByRole("checkbox", { name: /agree to my data being used/ }).check();
  await agree.click();
  await readyToBegin(page);

  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();
  await page.getByRole("radio", { name: "Merge sort" }).check();
  await page.getByRole("button", { name: "Save answer" }).click();
  await expect(page.getByRole("navigation", { name: "Questions" }).getByRole("button", { name: "Question 1: Answered" })).toBeVisible();
  await submitAttempt(page);
  await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download my data" }).click()]);
  expect(download.suggestedFilename()).toBe("parikshaa-my-data.json");
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(data).toMatchObject({
    organisation: "E2E Private Ltd",
    you: { reference: "CS001", name: "Candidate 1" },
    consent: { noticeVersion: 1 },
    answers: [{ questionId: "q1" }],
  });
});
