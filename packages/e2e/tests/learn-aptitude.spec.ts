import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedLearnAptitude, type LearnAptitude } from "./learn-day.js";

/**
 * Aptitude in Learn on the real API (tracker row 140, K2-8), flag `learn_v2`
 * on, on a site holding the aptitude starter pack's ten questions: the hub
 * by section and topic with what the learner got right, a topic's set where a
 * wrong answer marks only the option chosen and the explanation stays shut
 * (its tries counted), then a right answer opens it with its shortcut; on a
 * phone, on paper, the misses and a reading question's passage, nothing
 * spilling sideways. Axe finds nothing serious or critical.
 */

const unique = () => Math.random().toString(36).slice(2, 8);

async function seriousOrCritical(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function seeded(page: Page, request: Parameters<typeof seedLearnAptitude>[0], theme: "dark" | "light"): Promise<{ site: string; apt: LearnAptitude }> {
  const site = `learn-apt-${unique()}`;
  const apt = await seedLearnAptitude(request, { org: `e2e-learn-apt-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` } });
  await page.addInitScript(([key, token, t]) => {
    localStorage.setItem(key!, token!);
    localStorage.setItem("parikshaa.learn.theme", t!);
  }, [`parikshaa.practice.${site}.session`, apt.token, theme]);
  return { site, apt };
}

test("aptitude on a laptop: the hub, a wrong answer that names only the choice, then right and the explanation", async ({ page, request }) => {
  const { site, apt } = await seeded(page, request, "dark");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/practice/${site}/aptitude?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Tez, aur pehli baar me sahi." })).toBeVisible();
  await expect(page.getByText("10 me se 1 sahi · 1 abhi galat")).toBeVisible();
  for (const section of ["Quantitative aptitude", "Logical reasoning", "Verbal ability"]) await expect(page.getByRole("region", { name: section })).toBeVisible();
  await expect(page.getByRole("link", { name: "Galtiyan dobara karo (1)" })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);

  await page.getByRole("region", { name: "Quantitative aptitude" }).getByRole("link", { name: /Percentages/ }).click();
  await expect(page).toHaveURL(new RegExp(`/practice/${site}/aptitude/${apt.miss.topic}$`));
  await expect(page.getByRole("heading", { level: 2, name: apt.miss.title })).toBeVisible();
  await expect(page.getByText("Samjhaav sahi karne par khulta hai, ya 3 galat koshish ke baad (1/3).")).toBeVisible();
  await expect(page.getByRole("region", { name: "Aapke pichhle jawab" })).toContainText("B");

  // Wrong: only the chosen option is marked; the right one is not; the explanation stays shut, at 2/3.
  await page.getByRole("radio", { name: apt.miss.options[2]! }).check();
  await page.getByRole("button", { name: "Check karo" }).click();
  await expect(page.locator(".la-v-title")).toHaveText(/Sahi nahi/);
  await expect(page.getByRole("radio", { name: apt.miss.options[2]! })).toHaveAccessibleDescription("Aapka chuna jawab: sahi nahi");
  await expect(page.locator(".ln-choice-opt.ln-right")).toHaveCount(0);
  await expect(page.getByText("Samjhaav sahi karne par khulta hai, ya 3 galat koshish ke baad (2/3).")).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);

  // Right: marked right, and the explanation opens with its steps and shortcut.
  await page.getByRole("radio", { name: apt.miss.options[0]! }).check();
  await page.getByRole("button", { name: "Check karo" }).click();
  await expect(page.locator(".la-v-title")).toHaveText(/^Sahi/);
  const explanation = page.getByRole("region", { name: "Samjhaav" });
  await expect(explanation.getByRole("heading", { name: "Understand" })).toBeVisible();
  await expect(explanation).toContainText("Shortcut:");
  await expect(page.getByRole("navigation", { name: "Sawaal" }).getByRole("button", { name: /^Sawaal 1: sahi/ })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
});

test("aptitude on a phone, on paper: the misses, a reading question's passage, nothing spills sideways", async ({ page, request }) => {
  const { site, apt } = await seeded(page, request, "light");
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/practice/${site}/aptitude/misses?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Aapki galtiyan" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Sawaal" }).getByRole("button")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2, name: apt.miss.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);

  await page.goto(`/practice/${site}/aptitude/${apt.reading.topic}?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 2, name: apt.reading.title })).toBeVisible();
  await expect(page.getByRole("region", { name: apt.reading.passage, exact: true })).toContainText("Bhopal");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);
});
