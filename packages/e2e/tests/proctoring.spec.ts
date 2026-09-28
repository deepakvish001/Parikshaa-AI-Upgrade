import { expect, test } from "@playwright/test";
import { local, OWNER, readyToBegin, SHORT, seedSitting } from "./support.js";

/**
 * ROADMAP §14 in a real browser, with Chromium's fake camera: the camera
 * check, the identity photos, webcam photos while answering, and an
 * invigilator comparing the photos and recording a decision.
 */

test.skip(({ browserName }) => browserName !== "chromium", "The fake camera is Chromium's");
test.use({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  permissions: ["camera"],
});

test("a proctored sitting: camera first, identity photos, then an invigilator confirms them", async ({ page, browser, request }) => {
  const sitting = await seedSitting(request, { questions: [SHORT], proctoring: { identity: true, snapshotEverySeconds: 15, browserEvents: true } });

  // The camera is a step before the instructions, whose last button starts the clock.
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: "This test uses your camera" })).toBeVisible();
  await page.getByRole("button", { name: "Allow the camera" }).click();
  await page.getByRole("button", { name: "My camera works" }).click();
  await readyToBegin(page);

  await expect(page.getByRole("heading", { name: "Confirm who you are" })).toBeVisible();
  await page.getByRole("button", { name: "Take my photo" }).click();
  await page.getByRole("button", { name: "Use this photo" }).click();
  await page.getByRole("button", { name: "Take a photo of my ID" }).click();
  await page.getByRole("button", { name: "Send and start answering" }).click();

  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();
  await expect(page.getByText("Camera on")).toBeVisible();
  await page.getByRole("textbox", { name: SHORT.stem }).fill("The interval halves each step.");

  // The invigilator, in the console.
  const staff = await browser.newPage();
  await staff.goto("/console/");
  await staff.getByLabel("Email").fill(OWNER.email);
  await staff.getByLabel("Password").fill(OWNER.password);
  await staff.getByRole("button", { name: "Sign in", exact: true }).click();
  await staff.getByRole("button", { name: sitting.title, exact: true }).click();
  await staff.getByRole("button", { name: "Live sitting" }).click();
  const row = staff.getByRole("row").filter({ hasText: "CS001" });
  await expect(row).toContainText("ID to check");
  await row.getByRole("button", { name: "Review CS001" }).click();

  const panel = staff.getByRole("region", { name: /^Proctoring for/ });
  const selfie = panel.getByRole("img", { name: /^Photo of/ });
  await expect(selfie).toBeVisible();
  expect(await selfie.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(panel.getByRole("img", { name: /^Webcam photo at/ }).first()).toBeVisible();

  await panel.getByLabel(/What you compared/).fill("Face matches the photo on the ID card");
  await panel.getByRole("button", { name: "Confirm identity" }).click();
  await expect(panel).toContainText("Confirmed");
});
