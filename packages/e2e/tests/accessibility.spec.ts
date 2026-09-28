import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { beginSitting, local, MCQ, OWNER, PRIVATE_OWNER, SHORT, seedSitting, setPrivacyNotice } from "./support.js";

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


/*
 * Every check runs in the light theme and again in the dark one: a colour that
 * passes on white can fail on the dark surface (the palette once did).
 */
for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`in the ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("every screen a candidate meets passes WCAG 2.1 AA, in English and in Hindi", async ({ page, request }) => {
      const sitting = await seedSitting(request, { vivaTriggerRatio: 0.5 });
      await beginSitting(page, sitting.links["CS001"]!);
      await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();
      expect(await violations(page)).toEqual([]);

      // A follow-up open on the page.
      await page.getByRole("radio", { name: "Merge sort" }).check();
      await page.getByRole("button", { name: "Save & next" }).click();
      await expect(page.getByRole("region", { name: "Follow-up question" })).toContainText("Walk me through");
      expect(await violations(page)).toEqual([]);

      await page.getByLabel("Language").selectOption("hi");
      await expect(page.getByRole("button", { name: "प्रयास जमा करें" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.lang)).toBe("hi");
      expect(await violations(page)).toEqual([]);

      await page.getByLabel("भाषा").selectOption("en");
      // The summary before submitting, over the paper.
      await page.getByRole("button", { name: "Submit attempt" }).click();
      const summary = page.getByRole("dialog", { name: "Submit your attempt?" });
      await expect(summary).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await summary.getByRole("button", { name: "Yes, submit" }).click();
      await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the instructions and system check, before the clock, pass WCAG 2.1 AA", async ({ page, request }) => {
      const sitting = await seedSitting(request, { vivaTriggerRatio: 0.5 });
      const link = local(sitting.links["CS001"]!);
      await page.goto(link);
      await expect(page.getByRole("heading", { name: "System check" })).toBeVisible();
      await expect(page.getByText(/^Good \(\d+ ms\)$/)).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the privacy notice passes WCAG 2.1 AA", async ({ page, request }) => {
      const sitting = await seedSitting(request, { owner: PRIVATE_OWNER, questions: [MCQ] });
      await setPrivacyNotice(request, sitting.token);
      await page.goto(local(sitting.links["CS001"]!));
      await expect(page.getByRole("heading", { name: "Before you start: your data" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });

    test("the console's exam page — overview, live, questions, try test, editor — and search pass WCAG 2.1 AA", async ({ page, request }) => {
      const sitting = await seedSitting(request);
      await page.goto("/console/");
      expect(await violations(page)).toEqual([]);
      await page.getByLabel("Email").fill(OWNER.email);
      await page.getByLabel("Password").fill(OWNER.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page.getByRole("region", { name: "Sittings" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.getByRole("button", { name: sitting.title }).click();
      await expect(page.getByRole("button", { name: "Live sitting" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.getByRole("button", { name: "Live sitting" }).click();
      await expect(page.getByRole("region", { name: "Candidates now" })).toBeVisible();
      expect(await violations(page)).toEqual([]);

      // The questions, one previewed; the test tried; the editor's list and settings; Ctrl+K.
      await page.getByRole("navigation", { name: "Exam" }).getByRole("button", { name: "Questions" }).click();
      await page.getByRole("button", { name: "Preview question 1" }).click();
      expect(await violations(page)).toEqual([]);
      await page.getByRole("button", { name: "Try test" }).click();
      await expect(page.getByRole("dialog", { name: "Try test" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.getByRole("button", { name: "End preview" }).click();
      await page.getByRole("button", { name: "Copy to change" }).or(page.getByRole("button", { name: "Edit questions" })).click();
      await expect(page.getByRole("heading", { name: /exam/ })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.getByRole("tab", { name: "Settings" }).click();
      expect(await violations(page)).toEqual([]);
      await page.keyboard.press("Control+k");
      await page.getByRole("combobox", { name: "Search exams, candidates and pages" }).fill("cs0");
      await expect(page.getByRole("option").first()).toBeVisible();
      expect(await violations(page)).toEqual([]);

      // The design system, with a dialog open and a toast showing.
      await page.keyboard.press("Escape");
      await page.goto("/console/?gallery");
      await expect(page.getByRole("heading", { name: "Design system" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
      await page.getByRole("button", { name: "Show a toast" }).click();
      await page.getByRole("button", { name: "Open a dialog" }).click();
      await expect(page.getByRole("dialog", { name: "Submit your attempt?" })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  });
}

test("a candidate can sit the whole exam from the keyboard", async ({ page, request }) => {
  const sitting = await seedSitting(request, { vivaTriggerRatio: 1 });
  await beginSitting(page, sitting.links["CS001"]!);
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();

  const focused = (name: string) => page.getByRole("button", { name, exact: true }).evaluate((e) => e === document.activeElement);

  // Tab to the first option, choose it with the space bar, then on to Save & next.
  const heap = page.getByRole("radio", { name: "Heap sort" });
  for (let i = 0; i < 30 && !(await heap.evaluate((e) => e === document.activeElement)); i += 1) await page.keyboard.press("Tab");
  await expect(heap).toBeFocused();
  await page.keyboard.press("Space");
  await expect(heap).toBeChecked();
  for (let i = 0; i < 6 && !(await focused("Save & next")); i += 1) await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");

  // The next question's heading takes focus, so the answer box is the next stop.
  await expect(page.getByRole("heading", { name: /^2\. / })).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Questions" }).getByRole("button", { name: "Question 1: Answered" })).toBeVisible();
  await page.keyboard.press("Tab");
  const box = page.getByRole("textbox", { name: SHORT.stem });
  await expect(box).toBeFocused();
  await page.keyboard.type("The interval halves each step.");

  // Back up to Submit in the bar, and through the summary with Tab and Enter.
  for (let i = 0; i < 10 && !(await focused("Submit attempt")); i += 1) await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Keep working" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Yes, submit" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();
});
