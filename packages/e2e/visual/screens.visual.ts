import { expect, test, type Page } from "@playwright/test";
import { OWNER } from "../tests/support.js";

/**
 * The console's screens that set the look — sign-in, the editor, and the
 * design system in both themes — held to their committed images. The
 * candidate's pages are in candidate.visual.ts.
 */

async function signIn(page: Page) {
  await page.goto("/console/");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
}

/** Fonts in, nothing moving. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

test("the console's sign-in", async ({ page }) => {
  await page.goto("/console/");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("console-sign-in.png");
});

test("a new exam in the editor", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "New exam" }).click();
  await expect(page.getByRole("heading", { name: "New exam" })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("console-new-exam.png");
});

for (const scheme of ["light", "dark"] as const) {
  test(`the design system, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await signIn(page);
    await page.goto("/console/?gallery");
    await expect(page.getByRole("heading", { name: "Design system" })).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`design-system-${scheme}.png`, { fullPage: true });
  });
}
