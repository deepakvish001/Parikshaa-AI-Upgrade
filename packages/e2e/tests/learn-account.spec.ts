import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedLearnDay } from "./learn-day.js";

/**
 * Learn's own sign-in, onboarding and Mera plan on the real API (tracker row
 * 140, K2-2), flag `learn_v2` on: a learner signs up in Learn, answers the
 * questions, starts a plan the API lays out, changes it, signs out and in
 * again; Google's way back (`#session=`) lands on Aaj with the session out of
 * the address; and axe finds nothing serious or critical, at a laptop's width
 * and a phone's, dark and on paper.
 */

const unique = () => Math.random().toString(36).slice(2, 8);

async function seriousOrCritical(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function paper(page: Page) {
  await page.getByRole("button", { name: "Aur vikalp" }).click();
  await page.getByRole("menuitem", { name: "Kaagaz (light)" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset["theme"])).toBe("light");
}

test("a learner signs up in Learn, makes a plan on the API, changes it, and signs out and in again", async ({ page, request }) => {
  const site = `learn-${unique()}`;
  await seedLearnDay(request, { org: `e2e-learn-${unique()}`, site, learner: { name: "Ravi Kumar", email: `ravi.${unique()}@learners.e2e.test` } });
  const email = `asha.${unique()}@learners.e2e.test`;
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/practice/${site}/signup?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Apna account banao." })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByLabel("Aapka naam").fill("Asha Verma");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("practice every single day");
  await page.getByRole("button", { name: "Account banao" }).click();

  // Onboarding, each answer from the site's own tracks and companies.
  await expect(page).toHaveURL(new RegExp(`/practice/${site}/onboarding$`));
  await expect(page.getByText(`${email} par link bheja hai`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Kya taiyari karni hai?" })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
  const next = () => page.getByRole("button", { name: "Aage", exact: true }).click();
  await page.getByRole("button", { name: /^DSA for placements/ }).click();
  await next();
  await page.getByRole("button", { name: "Software engineer (SDE)" }).click();
  await next();
  const target = page.waitForResponse((r) => r.url().endsWith(`/api/practice/${site}/companies/infosys/target`) && r.status() === 200);
  await page.getByRole("button", { name: /^Infosys/ }).click();
  await target;
  await next();
  await page.getByRole("button", { name: "Lagbhag 3 mahine me" }).click();
  await next();
  await page.getByRole("button", { name: "Lagbhag 1 ghanta" }).click();
  await next();
  await page.getByRole("button", { name: /^Basics aate hain/ }).click();
  await expect(page.getByRole("complementary", { name: "Asha ka plan" })).toContainText("Infosys");
  await page.getByRole("button", { name: "Mera plan likho" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Taiyaar/ })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
  const started = page.waitForResponse((r) => r.url().endsWith(`/api/practice/${site}/plan`) && r.request().method() === "POST");
  await page.getByRole("button", { name: "Plan shuru karo" }).click();
  expect((await started).status()).toBe(201);
  await page.getByRole("link", { name: "Poora plan dekho" }).click();

  // Mera plan, as the API laid it out.
  await expect(page).toHaveURL(new RegExp(`/practice/${site}/plan$`));
  await expect(page.getByRole("heading", { level: 1, name: /DSA for placements, taiyaar/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Target companies" })).toContainText("Infosys");
  await expect(page.getByRole("region", { name: /Saat din/ }).getByRole("link", { name: "Stable sorting" }).first()).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByRole("button", { name: "Plan settings" }).click();
  const dialog = page.getByRole("dialog", { name: "Plan settings" });
  await dialog.getByLabel("Weekday par minute").fill("90");
  const changed = page.waitForResponse((r) => r.url().endsWith(`/api/practice/${site}/plan`) && r.request().method() === "PATCH");
  await dialog.getByRole("button", { name: "Save karo" }).click();
  expect((await changed).status()).toBe(200);
  await expect(page.getByText(/Save ho gaya. Plan ab .* ko khatam./)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("DSA for placements");
  await paper(page);
  expect(await seriousOrCritical(page)).toEqual([]);

  // Out, and in again with the password: back on Aaj, the plan's first day.
  await page.getByRole("button", { name: "Aur vikalp" }).click();
  await page.getByRole("menuitem", { name: "Sign out karo" }).click();
  await expect(page).toHaveURL(new RegExp(`/practice/${site}/signin$`));
  expect(await page.evaluate((key) => localStorage.getItem(key), `parikshaa.practice.${site}.session`)).toBeNull();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("practice every single day");
  await page.getByRole("button", { name: "Sign in karo" }).click();
  await expect(page).toHaveURL(new RegExp(`/practice/${site}/aaj$`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Asha.");
  await expect(page.locator(".ln-eyebrow").first()).toContainText("din 1/");
});

test("on a phone, signing in and the seeded learner's plan read well, dark and on paper", async ({ page, request }) => {
  const site = `learn-${unique()}`;
  const day = await seedLearnDay(request, { org: `e2e-learn-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` } });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/practice/${site}/signin?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Aapka plan intezaar me hai." })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
  await paper(page);
  expect(await seriousOrCritical(page)).toEqual([]);

  // Google's way back: the session in the fragment, kept and taken out of the address.
  await page.goto(`/practice/${site}?learn_v2=1#session=${day.token}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Asha.");
  expect(new URL(page.url()).hash).toBe("");
  await page.goto(`/practice/${site}/plan`);
  await expect(page.getByRole("heading", { level: 1, name: /DSA for placements, taiyaar/ })).toBeVisible();
  await expect(page.getByRole("region", { name: /Saat din/ })).toContainText(day.now.title);
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByRole("button", { name: "Aaj halka karo" }).click();
  await expect(page.getByRole("dialog", { name: "Aaj halka karo" })).toContainText("Is mahine 2 chhutti baaki");
  expect(await seriousOrCritical(page)).toEqual([]);
});
