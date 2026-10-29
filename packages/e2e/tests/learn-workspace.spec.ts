import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PAIR_SOLUTION, seedLearnDay, type LearnDay } from "./learn-day.js";

/**
 * Learn's problem workspace on the real API and the e2e stack's judge
 * (tracker row 140, K2-5), flag `learn_v2` on: Aaj's task opens the
 * workspace; a code problem is run on its examples and submitted wrong (the
 * first failing visible test shown) and then right (accepted, the editorial
 * open with its approaches); the author's first hint opens free; the
 * submissions list both; a choice problem is answered in the same panes; axe
 * finding nothing serious or critical at a laptop's width (dark) and a
 * phone's (on paper).
 */

const unique = () => Math.random().toString(36).slice(2, 8);

async function seriousOrCritical(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function seeded(page: Page, request: Parameters<typeof seedLearnDay>[0], theme: "dark" | "light"): Promise<{ site: string; day: LearnDay & { code: NonNullable<LearnDay["code"]> } }> {
  const site = `learn-${unique()}`;
  const day = await seedLearnDay(request, { org: `e2e-learn-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` }, code: true });
  await page.addInitScript(([key, token, t]) => {
    localStorage.setItem(key!, token!);
    localStorage.setItem("parikshaa.learn.theme", t!);
  }, [`parikshaa.practice.${site}.session`, day.token, theme]);
  return { site, day: day as LearnDay & { code: NonNullable<LearnDay["code"]> } };
}

/** The editor's own text box: filled in one go (keys typed faster than a frame can be lost in Firefox). */
async function write(page: Page, source: string) {
  await expect(page.locator(".cm-content")).toBeVisible();
  const editor = page.getByRole("textbox", { name: "Aapka code" });
  await editor.fill(source);
  await expect(editor).toContainText(source.split("\n")[0]!);
}

test("a code problem on a laptop: run, a wrong answer, a hint, the right answer, the editorial and the submissions", async ({ page, request }) => {
  const { site, day } = await seeded(page, request, "dark");
  await page.setViewportSize({ width: 1440, height: 900 });

  // Aaj's task at hand opens the workspace, not "not in Learn yet".
  await page.goto(`/practice/${site}?learn_v2=1`);
  await page.getByRole("link", { name: "Jaari rakho" }).click();
  await expect(page.getByRole("heading", { level: 1, name: day.now.title })).toBeVisible();
  await expect(page.getByRole("radio").first()).toBeVisible();

  await page.goto(`/practice/${site}/problems/${day.code.slug}?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: day.code.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Example 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Hint 1 kholo · free/ })).toBeVisible();
  await write(page, "print(-1)");
  expect(await seriousOrCritical(page)).toEqual([]);

  // Run: the examples only, recorded nowhere.
  await page.getByRole("button", { name: "Chalao" }).click();
  const result = page.getByRole("tabpanel", { name: "Nateeja" });
  await expect(result.getByText("2 me se 1 examples pass")).toBeVisible({ timeout: 30_000 });

  // Submit wrong: the judge's verdict, the first failing test (visible, so its input and the expected output).
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(result.getByText("Galat jawab", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(result.getByText("4 me se 1 test pass")).toBeVisible();
  const failing = result.getByRole("region", { name: "Pehla fail test: test 1" });
  await expect(failing.getByLabel("Sahi")).toHaveText("2 3");
  await expect(failing.getByLabel("Aapka")).toHaveText("-1");
  expect(await seriousOrCritical(page)).toEqual([]);

  // The editorial is still shut; the author's first hint opens free.
  await page.getByRole("tab", { name: "Editorial" }).click();
  await expect(page.getByText("Editorial solve karne par khulta hai, ya 3 galat submit ke baad.")).toBeVisible();
  await page.getByRole("tab", { name: "Problem", exact: true }).click();
  await page.getByRole("button", { name: /Hint 1 kholo/ }).click();
  await expect(page.getByText("The array is sorted. What does a sum that is too small tell you?")).toBeVisible();

  // "Fail kyun? Poochho" opens Sahayak's pane.
  await result.getByRole("button", { name: "Fail kyun? Poochho" }).click();
  await expect(page.getByRole("heading", { name: "Sahayak", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Band karo" }).click();

  // Submit right: accepted, and the editorial opens with its approaches.
  await write(page, PAIR_SOLUTION);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(result.getByText("Accepted", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(result.getByText("4 me se 4 test pass")).toBeVisible();
  await result.getByRole("button", { name: "Editorial padho" }).click();
  await expect(page.getByText("Try every pair: O(n²).")).toBeVisible();
  await page.getByRole("button", { name: "Optimal" }).click();
  await expect(page.locator(".lw-ed pre").first()).toContainText("while l < r:");

  // Both submissions, newest first; the draft survives a reload.
  await page.getByRole("tab", { name: /Submissions/ }).click();
  const list = page.getByRole("tabpanel", { name: /Submissions/ });
  await expect(list.getByRole("button")).toHaveCount(2);
  await expect(list.getByRole("button").first()).toContainText("Accepted");
  await expect(list.getByRole("button").nth(1)).toContainText("Galat jawab");
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.reload();
  await expect(page.locator(".cm-content")).toContainText("while l < r:");
});

test("on a phone, on paper: the panes are tabs, a choice problem is answered, and nothing spills sideways", async ({ page, request }) => {
  const { site, day } = await seeded(page, request, "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/practice/${site}/problems/${day.code.slug}?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: day.code.title })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Workspace ke pane" });
  await expect(tabs.getByRole("tab", { name: "Code" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Chalao" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);
  await tabs.getByRole("tab", { name: "Problem" }).click();
  await expect(page.getByRole("heading", { level: 2, name: day.code.title })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);

  // A choice problem (the plan's task at hand): the same panes, an answer in place of the editor.
  await page.goto(`/practice/${site}/problems/${day.potd.slug}?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: day.potd.title })).toBeVisible();
  await tabs.getByRole("tab", { name: "Jawab" }).click();
  await page.getByRole("radio", { name: "11" }).check();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Sahi/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);
});
