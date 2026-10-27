import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedLearnDay, type LearnDay } from "./learn-day.js";

/**
 * Learn's Aaj on the real API (tracker row 140, K2-1), flag `learn_v2` on: a
 * learner's own day from `GET /practice/<site>/home` and the reads beside it,
 * the session the practice site keeps, and axe finding nothing serious or
 * critical at a laptop's width and a phone's, dark and on paper. Signed out,
 * Aaj sends the learner to sign in instead.
 */

const unique = () => Math.random().toString(36).slice(2, 8);

async function seriousOrCritical(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function signedIn(page: Page, site: string, day: LearnDay) {
  await page.addInitScript(([key, token]) => localStorage.setItem(key!, token!), [`parikshaa.practice.${site}.session`, day.token]);
}

for (const [name, viewport] of [
  ["a laptop (1440 px)", { width: 1440, height: 900 }],
  ["a phone (390 px)", { width: 390, height: 844 }],
] as const) {
  test(`Aaj shows the learner's own day from the API on ${name}, and axe finds nothing serious`, async ({ page, request }) => {
    const site = `learn-${unique()}`;
    const day = await seedLearnDay(request, { org: `e2e-learn-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` } });
    await signedIn(page, site, day);
    await page.setViewportSize(viewport);
    const home = page.waitForResponse((r) => r.url().endsWith(`/api/practice/${site}/home`) && r.status() === 200);
    await page.goto(`/practice/${site}?learn_v2=1`);
    await home;

    // The heading: the learner's name and what is left of today's plan.
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText("Asha.");
    await expect(h1).toContainText("kaam baaki");
    await expect(page.locator(".ln-eyebrow").first()).toContainText("din 1/31");

    // The task at hand: the problem after the done lesson, with its wrong answer from the judge.
    const now = page.getByRole("region", { name: day.now.title });
    await expect(now).toBeVisible();
    await expect(now).toContainText("Galat jawab · 1 me se 0 test");
    await expect(now.getByRole("progressbar", { name: "Aaj ke kaam" })).toHaveAttribute("aria-valuenow", "1");
    await expect(now.getByRole("button", { name: "Fail kyun? Poochho" })).toBeVisible();

    // Beside it (below it on a phone): the target company, the streak, and what is coming up.
    await expect(page.getByRole("progressbar", { name: "Infosys ki taiyari" })).toHaveAttribute("aria-valuenow", "33");
    const ahead = page.getByRole("region", { name: "Aage" });
    await expect(ahead).toContainText(day.potd.title);
    await expect(ahead).toContainText("Sprint 1 test");
    await expect(ahead).toContainText(day.contest);

    expect(await seriousOrCritical(page)).toEqual([]);
    await page.getByRole("button", { name: "Aur vikalp" }).click();
    await page.getByRole("menuitem", { name: "Kaagaz (light)" }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset["theme"])).toBe("light");
    expect(await seriousOrCritical(page)).toEqual([]);

    // The task's own address: its screen comes later in Kadam 2, and until then the current site has it.
    await now.getByRole("link", { name: "Jaari rakho" }).click();
    await expect(page).toHaveURL(new RegExp(`/practice/${site}/problems/${day.now.slug}$`));
    await expect(page.getByRole("link", { name: "Abhi wali site par kholo" })).toHaveAttribute("href", `/practice/${site}/problems/${day.now.slug}?learn_v2=0`);
  });
}

test("signed out, Aaj asks the learner to sign in on the current site, and asks the API for nothing of theirs", async ({ page }) => {
  const site = `learn-${unique()}`;
  const asked: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) asked.push(new URL(r.url()).pathname);
  });
  await page.goto(`/practice/${site}?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Aaj" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Apna din dekhne ke liye sign in karo" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Sign in karo" })).toHaveAttribute("href", `/practice/${site}/signin?learn_v2=0`);
  expect(asked.filter((path) => /\/(home|me|companies\/targets)$/.test(path))).toEqual([]);
  expect(await seriousOrCritical(page)).toEqual([]);
});
