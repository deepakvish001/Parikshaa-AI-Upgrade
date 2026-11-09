import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedLearnDay, type LearnDay } from "./learn-day.js";

/**
 * Sahayak's panel on the real API (tracker row 140, K2-6), flag `learn_v2`
 * on. The e2e stack answers with its fake model (`api/src/fake-model.ts`):
 * no real AI provider is called. On a laptop: a wrong submission, "Fail kyun?
 * Poochho" in the workspace, a review of it and a doubt, the credits going
 * down by each ask's cost, the conversation kept after a reload. On a phone,
 * on paper: Aaj's "Fail kyun? Poochho" and a lesson's "ask Sahayak" open its
 * sheet; a lesson's conversation is kept too. Axe finds nothing serious or
 * critical.
 */

const unique = () => Math.random().toString(36).slice(2, 8);

async function seriousOrCritical(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function seeded(page: Page, request: Parameters<typeof seedLearnDay>[0], theme: "dark" | "light", code: boolean): Promise<{ site: string; day: LearnDay }> {
  const site = `learn-${unique()}`;
  const day = await seedLearnDay(request, { org: `e2e-learn-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` }, code });
  await page.addInitScript(([key, token, t]) => {
    localStorage.setItem(key!, token!);
    localStorage.setItem("parikshaa.learn.theme", t!);
  }, [`parikshaa.practice.${site}.session`, day.token, theme]);
  return { site, day };
}

async function ask(page: Page, where: ReturnType<Page["getByRole"]>, question: string) {
  await where.getByRole("textbox", { name: "Sahayak se poochho" }).fill(question);
  await where.getByRole("button", { name: "Poochho · 15 credits" }).click();
  await expect(where.getByRole("log", { name: "Sahayak se baatcheet" }).getByText(question)).toBeVisible();
}

test("on a laptop: Fail kyun in the workspace, a review and a doubt, credits going down, kept after a reload", async ({ page, request }) => {
  const { site, day } = await seeded(page, request, "dark", true);
  const slug = day.code!.slug;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/practice/${site}/problems/${slug}?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: day.code!.title })).toBeVisible();
  await expect(page.locator(".cm-content")).toBeVisible();
  await page.getByRole("textbox", { name: "Aapka code" }).fill("print(-1)");
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const result = page.getByRole("tabpanel", { name: "Nateeja" });
  await expect(result.getByText("Galat jawab", { exact: true })).toBeVisible({ timeout: 30_000 });

  // "Fail kyun? Poochho": Sahayak on the last verdict, with the month's free credits.
  await result.getByRole("button", { name: "Fail kyun? Poochho" }).click();
  await expect(page.getByRole("heading", { name: "Fail kyun hua?" })).toBeVisible();
  await expect(page.getByText("Aapka aakhri submit: Galat jawab · 4 me se 1 test")).toBeVisible();
  await expect(page.getByText(`Problem · ${day.code!.title}`)).toBeVisible();
  await expect(page.getByText("100 credits baaki")).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);

  // A review of that submission (40 credits): the server reads it; the fake model's findings, drawn as Markdown.
  await page.getByRole("button", { name: "Aakhri submission ka review · 40 credits" }).first().click();
  const talk = page.getByRole("log", { name: "Sahayak se baatcheet" });
  await expect(talk.getByRole("article", { name: "Aakhri submission ka review" })).toContainText("Prints -1 before checking any pair.");
  await expect(page.getByText("60 credits baaki")).toBeVisible();

  // A doubt (15 credits): the answer's code as text.
  await ask(page, page.locator(".lw-panes"), "Why does test 1 fail?");
  await expect(talk.getByRole("article", { name: "Jawab" })).toContainText("Which type");
  await expect(talk.locator(".ln-md pre").last()).toContainText("print(a + b)");
  await expect(page.getByText("45 credits baaki")).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);

  // Kept by the API: after a reload, Ctrl+J opens the same conversation.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: day.code!.title })).toBeVisible();
  await page.keyboard.press("Control+j");
  await expect(page.getByRole("log", { name: "Sahayak se baatcheet" }).getByText("Why does test 1 fail?")).toBeVisible();
  await expect(page.getByRole("log", { name: "Sahayak se baatcheet" }).getByRole("article", { name: "Aakhri submission ka review" })).toBeVisible();
});

test("on a phone, on paper: Aaj's Fail kyun and a lesson open Sahayak's sheet, and a lesson's conversation is kept", async ({ page, request }) => {
  const { site, day } = await seeded(page, request, "light", false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/practice/${site}?learn_v2=1`);
  await page.getByRole("button", { name: "Fail kyun? Poochho" }).click();
  const sheet = page.getByRole("dialog", { name: "Sahayak" });
  await expect(sheet.getByRole("heading", { name: "Fail kyun hua?" })).toBeVisible();
  await expect(sheet.getByText(`Problem · ${day.now.title}`)).toBeVisible();
  await ask(page, sheet, "Which option did I miss?");
  await expect(sheet.getByRole("article", { name: "Jawab" })).toContainText("Which type");
  await expect(sheet.getByText("85 credits baaki")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);
  await sheet.getByRole("button", { name: "Band karo" }).click();

  // A lesson: Sahayak reads it with the question; the API keeps what was asked.
  const lesson = day.lessons[0]!;
  await page.goto(`/practice/${site}/lessons/${lesson.slug}?learn_v2=1`);
  await page.getByRole("button", { name: "Is lesson par Sahayak se poochho" }).click();
  await expect(sheet.getByText(`Lesson · ${lesson.title}`)).toBeVisible();
  await ask(page, sheet, "Why does this matter?");
  await expect(sheet.getByText("70 credits baaki")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Is lesson par Sahayak se poochho" }).click();
  await expect(sheet.getByRole("log", { name: "Sahayak se baatcheet" }).getByText("Why does this matter?")).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
});
