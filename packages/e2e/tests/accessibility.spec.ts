import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { local, MCQ, OWNER, PRIVATE_OWNER, SHORT, seedSitting, setPrivacyNotice } from "./support.js";

/**
 * ROADMAP §9: an exam a candidate cannot operate is an exam they failed for
 * the wrong reason. Every screen a candidate meets, and the console's busiest,
 * checked against WCAG 2.1 A and AA by axe — and the whole sitting done from
 * the keyboard alone.
 */

async function violations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("every screen a candidate meets passes WCAG 2.1 AA, in English and in Hindi", async ({ page, request }) => {
  const sitting = await seedSitting(request, { vivaTriggerRatio: 0.5 });
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  // A follow-up open on the page.
  await page.getByRole("radio", { name: "Merge sort" }).check();
  await page.getByRole("button", { name: "Save answer" }).first().click();
  await expect(page.getByRole("region", { name: "Follow-up question" })).toContainText("Walk me through");
  expect(await violations(page)).toEqual([]);

  await page.getByLabel("Language").selectOption("hi");
  await expect(page.getByRole("button", { name: "प्रयास जमा करें" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("hi");
  expect(await violations(page)).toEqual([]);

  await page.getByLabel("भाषा").selectOption("en");
  await page.getByRole("button", { name: "Submit attempt" }).click();
  await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("the privacy notice passes WCAG 2.1 AA", async ({ page, request }) => {
  const sitting = await seedSitting(request, { owner: PRIVATE_OWNER, questions: [MCQ] });
  await setPrivacyNotice(request, sitting.token);
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: "Before you start: your data" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test("a candidate can sit the whole exam from the keyboard", async ({ page, request }) => {
  const sitting = await seedSitting(request, { vivaTriggerRatio: 1 });
  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();

  // Tab to the first option, choose it with the space bar, save with Enter.
  const heap = page.getByRole("radio", { name: "Heap sort" });
  for (let i = 0; i < 30 && !(await heap.evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press("Tab");
  await expect(heap).toBeFocused();
  await page.keyboard.press("Space");
  await expect(heap).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Save answer" }).first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("section.card").filter({ hasText: "Which sort is stable?" })).toContainText("Saved");

  await page.keyboard.press("Tab");
  const box = page.getByRole("textbox", { name: SHORT.stem });
  for (let i = 0; i < 10 && !(await box.evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press("Tab");
  await expect(box).toBeFocused();
  await page.keyboard.type("The interval halves each step.");
  for (let i = 0; i < 10 && !(await page.getByRole("button", { name: "Submit attempt" }).evaluate((e) => e === document.activeElement)); i += 1) {
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();
});

test("the console's results and live pages pass WCAG 2.1 AA", async ({ page, request }) => {
  const sitting = await seedSitting(request);
  await page.goto("/console/");
  expect(await violations(page)).toEqual([]);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: sitting.title }).click();
  await expect(page.getByRole("button", { name: "Live sitting" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page.getByRole("button", { name: "Live sitting" }).click();
  await expect(page.getByRole("region", { name: "Candidates now" })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
