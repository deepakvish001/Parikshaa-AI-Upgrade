import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedLearnDay, type LearnDay } from "./learn-day.js";

/**
 * Learn's DSA sheet and lesson reader on the real API (tracker row 140, K2-4),
 * flag `learn_v2` on: a seeded learner's plan track, module by module with
 * their standing; a lesson read as Markdown, marked done, its quiz checked and
 * a note written; axe finding nothing serious or critical at a laptop's width
 * (dark) and a phone's (on paper).
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
  const day = await seedLearnDay(request, { org: `e2e-learn-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` }, mine: true });
  await page.addInitScript(([key, token, t]) => {
    localStorage.setItem(key!, token!);
    localStorage.setItem("parikshaa.learn.theme", t!);
  }, [`parikshaa.practice.${site}.session`, day.token, theme]);
  return { site, day };
}

test("the sheet and a lesson on a laptop: standing from the API, done, quiz and note sent", async ({ page, request }) => {
  const { site, day } = await seeded(page, request, "dark");
  await page.setViewportSize({ width: 1440, height: 900 });
  const [sorting, searching] = day.lessons;

  // The sheet: the plan's track, its first unfinished module open, the learner's standing in words.
  await page.goto(`/practice/${site}/sheet?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: day.track.title })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Sheet ki pragati" })).toHaveAttribute("aria-valuetext", "5 me se 2 ho gaye");
  await expect(page.getByRole("button", { name: /Sorting/ })).toHaveAttribute("aria-expanded", "true");
  const tried = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: day.now.title, exact: true }) }).filter({ hasText: "Problem" });
  await expect(tried).toContainText("Koshish ki, abhi solve nahi");
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("link", { name: sorting!.title, exact: true }) }).filter({ hasText: "Lesson" })).toContainText("Ho gaya");
  const next = page.getByRole("region", { name: "Agla kaam" });
  await expect(next).toContainText(day.now.title);
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByRole("searchbox", { name: "Is sheet me khojo" }).fill("search");
  await expect(page.getByRole("link", { name: searching!.title })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shortest paths" })).toHaveCount(0);

  // The lesson, from the sheet: Markdown as elements, its place in the track.
  await page.getByRole("link", { name: searching!.title }).click();
  await expect(page).toHaveURL(new RegExp(`/practice/${site}/lessons/${searching!.slug}\\?track=${day.track.slug}$`));
  await expect(page.getByRole("heading", { level: 1, name: searching!.title })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The loop" })).toBeVisible();
  await expect(page.locator(".ll-body pre code")).toContainText("int mid = lo + (hi - lo) / 2;");
  await expect(page.getByText("Module 2 · 2 me se 1")).toBeVisible();
  await expect(page.getByRole("link", { name: /Agla: Binary search/ })).toHaveAttribute("href", /\/problems\//);
  expect(await seriousOrCritical(page)).toEqual([]);

  // Done, with the lesson's coins.
  const done = page.waitForResponse((r) => r.url().endsWith(`/lessons/${searching!.slug}/done`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Ho gaya, mark karo" }).click();
  expect((await done).status()).toBe(200);
  await expect(page.getByText(/^Lesson ho gaya\./)).toBeVisible();

  // The quiz: both right this time.
  const quiz = page.getByRole("region", { name: "Khud jaancho" });
  await quiz.getByRole("radio", { name: "Merge sort" }).check();
  await quiz.getByRole("radio", { name: "11" }).check();
  await quiz.getByRole("button", { name: "Mere jawab jaancho" }).click();
  await expect(quiz.getByRole("status")).toContainText("2 me se 2 sahi");
  expect(await seriousOrCritical(page)).toEqual([]);

  // A note on the lesson, saved and shown as Markdown.
  const note = page.getByRole("region", { name: "Mera note" });
  await note.getByRole("button", { name: "Note likho" }).click();
  await note.getByRole("textbox").fill("Halve, and keep **lo** and **hi** honest.");
  const saved = page.waitForResponse((r) => r.url().endsWith(`/notes/lesson/${searching!.slug}`) && r.request().method() === "PUT");
  await note.getByRole("button", { name: "Save karo" }).click();
  expect((await saved).status()).toBe(200);
  await expect(note.locator("strong", { hasText: "lo" })).toBeVisible();

  // Back on the sheet, the lesson is done.
  await page.getByRole("link", { name: day.track.title }).first().click();
  await expect(page.getByRole("progressbar", { name: "Sheet ki pragati" })).toHaveAttribute("aria-valuetext", "5 me se 3 ho gaye");
});

test("on a phone, on paper: the sheet and a lesson fit and pass axe; signed out the lesson still reads", async ({ page, request }) => {
  const { site, day } = await seeded(page, request, "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/practice/${site}/sheet?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: day.track.title })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.goto(`/practice/${site}/lessons/${day.lessons[1]!.slug}?learn_v2=1`);
  await expect(page.getByRole("region", { name: "Khud jaancho" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);

  await page.evaluate((key) => localStorage.removeItem(key), `parikshaa.practice.${site}.session`);
  await page.addInitScript((key) => localStorage.removeItem(key), `parikshaa.practice.${site}.session`);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: day.lessons[1]!.title })).toBeVisible();
  await expect(page.getByText("Quiz, note aur pragati ke liye sign in karo")).toBeVisible();
  await expect(page.getByRole("region", { name: "Khud jaancho" })).toHaveCount(0);
});
