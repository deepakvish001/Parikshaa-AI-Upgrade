import { expect, test } from "@playwright/test";
import { beginSitting, openQuestion, seedSitting, SHORT, submitAttempt } from "./support.js";

/** ROADMAP §8, in a real browser: what an invigilator does reaches the candidate's open page without a reload. */

test("an announcement reaches a candidate's open page, and a reopened attempt opens again by itself", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  const staff = { authorization: `Bearer ${sitting.token}` };
  await page.clock.install();
  await beginSitting(page, sitting.links["CS001"]!);
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();

  // The invigilator tells the room something; the page hears of it at its next check-in.
  const posted = await request.post(`/api/exams/${sitting.examId}/announcements`, { headers: staff, data: { message: "Question 2: explain in one line." } });
  expect(posted.status()).toBe(201);
  await page.clock.fastForward(31_000);
  const announcements = page.getByRole("region", { name: "Announcements" });
  await expect(announcements).toContainText("Question 2: explain in one line.");
  await announcements.getByRole("button", { name: "Got it" }).click();
  await expect(announcements).not.toContainText("explain in one line");

  // Submitted by accident…
  await openQuestion(page, 2);
  await page.getByRole("textbox", { name: SHORT.stem }).fill("The interval halves.");
  await submitAttempt(page);
  await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();

  // …reopened by the invigilator, with a reason on the record.
  const live = await (await request.get(`/api/exams/${sitting.examId}/live`, { headers: staff })).json();
  const attemptId = live.rows.find((r: { ref: string }) => r.ref === "CS001").attemptId;
  const reopened = await request.post(`/api/attempts/${attemptId}/reopen`, {
    headers: staff,
    data: { minutes: 15, reason: "Submitted by mistake, confirmed in the room." },
  });
  expect(reopened.status(), await reopened.text()).toBe(200);

  await page.clock.fastForward(31_000);
  await expect(page.getByRole("button", { name: "Submit attempt" })).toBeVisible();
  await openQuestion(page, 2);
  await expect(page.getByRole("textbox", { name: SHORT.stem })).toHaveValue("The interval halves.");
});
