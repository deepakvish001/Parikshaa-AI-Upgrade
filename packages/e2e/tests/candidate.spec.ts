import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { parseReceipt, verifyReceipt } from "@parikshaa/verify";
import { local, SHORT, seedSitting } from "./support.js";

/**
 * ROADMAP §13: a candidate's whole attempt, in a real browser, against the
 * real service on a real Postgres.
 */

/** A question's card, by its number on the page. */
const question = (page: Page, n: number) => page.locator("section.card").filter({ has: page.getByRole("heading", { name: new RegExp(`^${n}\\. `) }) });

test("a candidate sits the exam from their link, answers a follow-up, and leaves with a record that checks", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();

  // A right answer to the multiple-choice question earns a follow-up about it.
  await question(page, 1).getByRole("radio", { name: "Merge sort" }).check();
  await question(page, 1).getByRole("button", { name: "Save answer" }).click();
  await expect(question(page, 1)).toContainText("Saved");

  const probe = page.getByRole("region", { name: "Follow-up question" });
  await expect(probe).toContainText("Walk me through why your answer holds");
  await probe.getByLabel("Your reply to the follow-up").fill("Merging never swaps equal elements, so their order is kept.");
  await probe.getByRole("button", { name: "Send reply" }).click();
  await expect(probe).toBeHidden();

  await question(page, 2).getByRole("textbox", { name: SHORT.stem }).fill("The interval halves every step, so it must become empty.");
  await question(page, 2).getByRole("button", { name: "Save answer" }).click();
  await expect(question(page, 2)).toContainText("Saved");

  await page.getByRole("button", { name: "Submit attempt" }).click();
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
  await page.goto(local(sitting.links["CS001"]!));
  const box = question(page, 2).getByRole("textbox", { name: SHORT.stem });
  await expect(box).toBeVisible();

  await context.setOffline(true);
  await box.fill("Written on a train with no signal: the interval halves.");
  await expect(page.getByText("You are offline")).toBeVisible();
  await expect(question(page, 2)).toContainText("Kept on this device");

  await context.setOffline(false);
  await expect(question(page, 2)).toContainText("Draft saved", { timeout: 15_000 });

  await page.reload();
  await expect(question(page, 2).getByRole("textbox", { name: SHORT.stem })).toHaveValue("Written on a train with no signal: the interval halves.");
});

test("a connection that drops while a follow-up is being written leaves nothing stuck on screen", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  await page.goto(local(sitting.links["CS001"]!));

  // The first request for a follow-up dies on the way.
  let dropped = 0;
  await page.route("**/attempts/me/probe", async (route) => {
    if (dropped++ === 0) return route.abort("connectionreset");
    return route.continue();
  });

  await question(page, 1).getByRole("radio", { name: "Merge sort" }).check();
  await question(page, 1).getByRole("button", { name: "Save answer" }).click();
  await expect(question(page, 1)).toContainText("Saved");
  await expect.poll(() => dropped).toBeGreaterThan(0);

  // No placeholder left "writing" forever: the panel is gone, and the page still works.
  await expect(page.getByRole("region", { name: "Follow-up question" })).toBeHidden();
  await question(page, 2).getByRole("textbox", { name: SHORT.stem }).fill("The interval halves.");
  await question(page, 2).getByRole("button", { name: "Save answer" }).click();
  await expect(question(page, 2)).toContainText("Saved");

  // Committing the next answer asks again, and this time the follow-up arrives.
  await expect(page.getByRole("region", { name: "Follow-up question" })).toContainText("Walk me through", { timeout: 15_000 });
});

test("a candidate who reopens their link on another device carries on where they were", async ({ browser, request }) => {
  const sitting = await seedSitting(request);
  const link = local(sitting.links["CS001"]!);

  const laptop = await browser.newContext();
  const first = await laptop.newPage();
  await first.goto(link);
  await question(first, 2).getByRole("textbox", { name: SHORT.stem }).fill("Started on the laptop.");
  await question(first, 2).getByRole("button", { name: "Save answer" }).click();
  await expect(question(first, 2)).toContainText("Saved");
  await laptop.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const second = await phone.newPage();
  await second.goto(link);
  await expect(question(second, 2).getByRole("textbox", { name: SHORT.stem })).toHaveValue("Started on the laptop.");
  await phone.close();
});
