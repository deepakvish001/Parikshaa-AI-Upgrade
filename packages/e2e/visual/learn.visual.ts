import { expect, test, type Page } from "@playwright/test";

/**
 * Learn v2's shell (tracker row 139, K1-4) with the flag `learn_v2` on, held
 * to its committed images: Aaj on its sample day, one placeholder screen, the
 * ⋯ menu open, and on a phone the "Aur" sheet; at 1440 and 390, dark (Learn's
 * default) and light, and the narrow side bar at 1100. The shell calls no API
 * and its sample data has no clock or random part, so no site is seeded and
 * nothing is masked. The theme is Learn's own (`parikshaa.learn.theme`, set
 * before the page loads), not the browser's.
 */

const SITE = "visual-learn";

async function open(page: Page, path: string, theme: "light" | "dark") {
  await page.addInitScript((t) => localStorage.setItem("parikshaa.learn.theme", t), theme);
  await page.goto(`/practice/${SITE}${path}?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset["theme"])).toBe(theme);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Aur vikalp" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.mouse.move(0, 0);
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`learn · 1440 · ${theme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: theme });

    test("aaj", async ({ page }) => {
      await open(page, "", theme);
      await expect(page).toHaveScreenshot(`learn-aaj-1440-${theme}.png`, { fullPage: true });
    });

    test("a placeholder screen", async ({ page }) => {
      await open(page, "/courses", theme);
      await expect(page).toHaveScreenshot(`learn-courses-1440-${theme}.png`, { fullPage: true });
    });

    test("the ⋯ menu", async ({ page }) => {
      await open(page, "", theme);
      await openMenu(page);
      await expect(page).toHaveScreenshot(`learn-menu-1440-${theme}.png`);
    });
  });

  test.describe(`learn · 390 · ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, colorScheme: theme });

    test("aaj", async ({ page }) => {
      await open(page, "", theme);
      await expect(page).toHaveScreenshot(`learn-aaj-390-${theme}.png`, { fullPage: true });
    });

    test("a placeholder screen", async ({ page }) => {
      await open(page, "/courses", theme);
      await expect(page).toHaveScreenshot(`learn-courses-390-${theme}.png`);
    });

    test("the Aur sheet", async ({ page }) => {
      await open(page, "", theme);
      await page.getByRole("navigation", { name: "Mukhya tabs" }).getByRole("button", { name: "Aur" }).click();
      await expect(page.getByRole("dialog", { name: "Aur" })).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`learn-sheet-390-${theme}.png`);
    });

    test("the ⋯ menu", async ({ page }) => {
      await open(page, "", theme);
      await openMenu(page);
      await expect(page).toHaveScreenshot(`learn-menu-390-${theme}.png`);
    });
  });
}

test.describe("learn · 1100 · dark", () => {
  test.use({ viewport: { width: 1100, height: 800 }, colorScheme: "dark" });

  test("the narrow side bar", async ({ page }) => {
    await open(page, "/courses", "dark");
    await expect(page.getByRole("navigation", { name: "Learn menu" })).toHaveClass(/ln-mini/);
    await expect(page).toHaveScreenshot("learn-courses-1100-dark.png");
  });
});
