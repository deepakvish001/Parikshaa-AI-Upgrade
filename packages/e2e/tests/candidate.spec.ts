import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { parseReceipt, verifyReceipt } from "@parikshaa/verify";
import { actions, beginSitting, local, onScreen, openQuestion, SHORT, seedSitting, submitAttempt } from "./support.js";

/**
 * ROADMAP §13: a candidate's whole attempt, in a real browser, against the
 * real service on a real Postgres.
 */

const answered = (page: Page, n: number) => page.getByRole("navigation", { name: "Questions" }).getByRole("button", { name: `Question ${n}: Answered` });

test("a candidate sits the exam from their link, answers a follow-up, and leaves with a record that checks", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  await beginSitting(page, sitting.links["CS001"]!);
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();

  // A right answer to the multiple-choice question earns a follow-up about it.
  await onScreen(page).getByRole("radio", { name: "Merge sort" }).check();
  await actions(page).getByRole("button", { name: "Save & next" }).click();
  await expect(answered(page, 1)).toBeVisible();

  const probe = page.getByRole("region", { name: "Follow-up question" });
  await expect(probe).toContainText("Walk me through why your answer holds");
  await probe.getByLabel("Your reply to the follow-up").fill("Merging never swaps equal elements, so their order is kept.");
  await probe.getByRole("button", { name: "Send reply" }).click();
  await expect(probe).toBeHidden();

  await onScreen(page).getByRole("textbox", { name: SHORT.stem }).fill("The interval halves every step, so it must become empty.");
  await actions(page).getByRole("button", { name: "Save answer" }).click();
  await expect(actions(page)).toContainText("Saved");

  await submitAttempt(page);
  const record = page.getByRole("region", { name: "Your record" });
  await expect(record).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit attempt" })).toBeHidden();

  // Checked in the page…
  await record.getByRole("button", { name: "Check this record" }).click();
  await expect(record.getByRole("status")).toContainText("unbroken");

  // …and the downloaded receipt checks with the standalone verifier.
  const [download] = await Promise.all([page.waitForEvent("download"), record.getByRole("button", { name: "Download receipt" }).click()]);
  const receipt = parseReceipt(JSON.parse(await readFile((await download.path())!, "utf8")));
  if ("error" in receipt) throw new Error(receipt.error);
  const report = verifyReceipt(receipt, (await record.getByTestId("head-hash").textContent())!.trim());
  expect(report.ok, JSON.stringify(report)).toBe(true);
  const types = receipt.entries!.map((e) => e.event.type);
  expect(types).toEqual(expect.arrayContaining(["attempt_started", "answer_submitted", "viva_probed", "viva_replied", "attempt_submitted"]));
});

test("an answer typed while offline is kept, sent when the connection returns, and survives a reload", async ({ page, context, request }) => {
  const sitting = await seedSitting(request);
  await beginSitting(page, sitting.links["CS001"]!);
  await openQuestion(page, 2);
  const box = onScreen(page).getByRole("textbox", { name: SHORT.stem });

  await context.setOffline(true);
  await box.fill("Written on a train with no signal: the interval halves.");
  await expect(page.getByText("You are offline")).toBeVisible();
  await expect(actions(page)).toContainText("Kept on this device");

  await context.setOffline(false);
  await expect(actions(page)).toContainText("Draft saved", { timeout: 15_000 });

  await page.reload();
  await openQuestion(page, 2);
  await expect(onScreen(page).getByRole("textbox", { name: SHORT.stem })).toHaveValue("Written on a train with no signal: the interval halves.");
});

test("a connection that drops while a follow-up is being written leaves nothing stuck on screen", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  await beginSitting(page, sitting.links["CS001"]!);

  // The first request for a follow-up dies on the way.
  let dropped = 0;
  await page.route("**/attempts/me/probe", async (route) => {
    if (dropped++ === 0) return route.abort("connectionreset");
    return route.continue();
  });

  await onScreen(page).getByRole("radio", { name: "Merge sort" }).check();
  await actions(page).getByRole("button", { name: "Save & next" }).click();
  await expect(answered(page, 1)).toBeVisible();
  await expect.poll(() => dropped).toBeGreaterThan(0);

  // No placeholder left "writing" forever: the panel is gone, and the page still works.
  await expect(page.getByRole("region", { name: "Follow-up question" })).toBeHidden();
  await onScreen(page).getByRole("textbox", { name: SHORT.stem }).fill("The interval halves.");
  await actions(page).getByRole("button", { name: "Save answer" }).click();
  await expect(actions(page)).toContainText("Saved");

  // Committing the next answer asks again, and this time the follow-up arrives.
  await expect(page.getByRole("region", { name: "Follow-up question" })).toContainText("Walk me through", { timeout: 15_000 });
});

test("a candidate who reopens their link on another device carries on where they were", async ({ browser, request }) => {
  const sitting = await seedSitting(request);
  const link = local(sitting.links["CS001"]!);

  const laptop = await browser.newContext();
  const first = await laptop.newPage();
  await beginSitting(first, sitting.links["CS001"]!);
  await openQuestion(first, 2);
  await onScreen(first).getByRole("textbox", { name: SHORT.stem }).fill("Started on the laptop.");
  await actions(first).getByRole("button", { name: "Save answer" }).click();
  await expect(actions(first)).toContainText("Saved");
  await laptop.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const second = await phone.newPage();
  await second.goto(link);
  await openQuestion(second, 2);
  await expect(onScreen(second).getByRole("textbox", { name: SHORT.stem })).toHaveValue("Started on the laptop.");
  await phone.close();
});
