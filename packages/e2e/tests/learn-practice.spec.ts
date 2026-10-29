import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { istDay, seedLearnDay, type LearnDay } from "./learn-day.js";

/**
 * Learn's problems bank (Abhyas) and problem of the day on the real API
 * (tracker row 140, K2-4), flag `learn_v2` on: a seeded learner's three
 * problems with their standing, filtered; today's problem and the month's
 * calendar with yesterday's (solved later) and the day before's (missed);
 * axe finding nothing serious or critical at a laptop's width (dark) and a
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

async function seeded(page: Page, request: Parameters<typeof seedLearnDay>[0], theme: "dark" | "light"): Promise<{ site: string; day: LearnDay }> {
  const site = `learn-${unique()}`;
  const day = await seedLearnDay(request, { org: `e2e-learn-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` } });
  await page.addInitScript(([key, token, t]) => {
    localStorage.setItem(key!, token!);
    localStorage.setItem("parikshaa.learn.theme", t!);
  }, [`parikshaa.practice.${site}.session`, day.token, theme]);
  return { site, day };
}

test("the problems bank and the problem of the day on a laptop: the API's problems and calendar", async ({ page, request }) => {
  const { site, day } = await seeded(page, request, "dark");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/practice/${site}/practice?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Har problem, ek jagah." })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("3 me se 3 problems");
  await expect(page.getByRole("row").filter({ hasText: "Shortest paths" })).toContainText("Solve kiya");
  await expect(page.getByRole("row").filter({ hasText: day.now.title })).toContainText("Koshish ki, solve nahi");
  await expect(page.getByRole("row").filter({ hasText: "Shortest paths" })).toContainText("Infosys me poocha gaya");
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByRole("radio", { name: "Medium" }).click();
  await expect(page.getByRole("status")).toHaveText("3 me se 1 problems");
  await expect(page.getByRole("link", { name: day.potd.title })).toBeVisible();
  await page.getByRole("button", { name: /^graphs/ }).click();
  await expect(page.getByText("In filters se koi problem nahi mila.")).toBeVisible();
  await page.getByRole("button", { name: "Filters hatao" }).click();
  await page.getByRole("combobox", { name: "Aapki haalat" }).selectOption("solved");
  await expect(page.getByRole("status")).toHaveText("3 me se 1 problems");

  // The problem of the day: today's, the streak, and the month.
  await page.getByRole("link", { name: "Aaj ka problem" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: day.potd.title })).toBeVisible();
  await expect(page.getByRole("link", { name: /Abhi solve karo/ })).toHaveAttribute("href", new RegExp(`/problems/${day.potd.slug}$`));
  const grid = page.getByRole("table");
  await expect(grid.locator('[aria-current="date"]')).toContainText(day.potd.title);
  // Yesterday and the day before, when this month holds them.
  if (istDay(-2).slice(0, 7) === istDay().slice(0, 7)) {
    await expect(grid.getByRole("link", { name: /Shortest paths, baad me solve/ })).toBeVisible();
    await expect(grid.getByRole("link", { name: new RegExp(`${day.now.title}, chhoot gaya`) })).toBeVisible();
  }
  await expect(page.getByText("Abhi ki streak")).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByRole("button", { name: "Pichhla mahina" }).click();
  await expect(page.getByRole("button", { name: "Agla mahina" })).toBeEnabled();
});

test("on a phone, on paper: the bank and the calendar fit and pass axe", async ({ page, request }) => {
  const { site, day } = await seeded(page, request, "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/practice/${site}/practice?learn_v2=1`);
  await expect(page.getByRole("link", { name: day.potd.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.goto(`/practice/${site}/potd?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: day.potd.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);
});
