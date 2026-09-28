import { expect, test, type Page } from "@playwright/test";
import { MCQ, OWNER, beginSitting, seedSitting, SHORT } from "../tests/support.js";

/**
 * The screens that set the look — sign-in, the candidate's first page and
 * the exam itself, the editor, and the design system in both themes — held
 * to their committed images. Anything that changes from run to run (the
 * clock) is masked.
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

test("the candidate's access page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button").first()).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("candidate-access.png");
});

test("a question in the exam, with the palette", async ({ page, request }) => {
  const sitting = await seedSitting(request, { title: "Visual check — Algorithms", questions: [MCQ, SHORT], names: ["Ananya Iyer"] });
  await beginSitting(page, sitting.links["CS001"]!);
  await expect(page.getByRole("heading", { name: "Which sort is stable?" })).toBeVisible();
  await settle(page);
  await expect(page).toHaveScreenshot("candidate-exam.png", { mask: [page.getByRole("timer")] });
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
