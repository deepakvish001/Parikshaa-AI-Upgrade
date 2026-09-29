import { expect, test } from "@playwright/test";
import { shoot } from "./shoot.js";

/** A new institution's first day: its account made, the tour, the welcome, and the sample exam tried as a candidate. */

test("a new institution: signing up, the tour, the welcome and the sample exam", async ({ page, browser }) => {
  const email = `meera-${Date.now().toString(36)}@sahyadri.example`;

  await page.goto("/console/");
  await page.getByRole("button", { name: "Make your institution's account" }).click();
  await page.getByLabel("Institution").fill("Sahyadri College of Engineering");
  await page.getByLabel("Your name").fill("Meera Kulkarni");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("our first pilot, carefully");
  await shoot(page, "onboarding-01-sign-up");
  await page.getByRole("button", { name: "Make the account" }).click();

  const tour = page.getByTestId("tour");
  await expect(tour.getByRole("dialog", { name: "Home" })).toBeVisible();
  await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour.getByRole("dialog", { name: "Exams" })).toBeVisible();
  await shoot(page, "onboarding-02-tour", { fullPage: false });
  for (let i = 0; i < 3; i++) await tour.getByRole("button", { name: "Next", exact: true }).click();
  await expect(tour.getByRole("dialog", { name: "Start here" })).toBeVisible();
  await shoot(page, "onboarding-03-tour-last-stop", { fullPage: false });
  await tour.getByRole("button", { name: "Done" }).click();

  const welcome = page.getByRole("region", { name: "Welcome to Parikshaa. Three ways to begin." });
  await expect(welcome).toBeVisible();
  await shoot(page, "onboarding-04-welcome");

  await welcome.getByRole("button", { name: "Load the sample exam" }).click();
  await expect(welcome.getByRole("button", { name: "Try it as a candidate" })).toBeVisible();
  await page.waitForTimeout(4_500); // the toast gone
  await shoot(page, "onboarding-05-sample-loaded");
  await welcome.getByRole("button", { name: "Try it as a candidate" }).click();
  const trying = page.getByRole("dialog", { name: "Try test" });
  await trying.getByRole("radio", { name: /₹680/ }).check();
  await shoot(page, "onboarding-06-sample-as-a-candidate", { fullPage: false });

  // On a phone.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto("/console/");
  await phone.getByRole("button", { name: "Make your institution's account" }).click();
  await expect(phone.getByLabel("Institution")).toBeVisible();
  await shoot(phone, "onboarding-07-phone-sign-up");
  await phone.close();
});
