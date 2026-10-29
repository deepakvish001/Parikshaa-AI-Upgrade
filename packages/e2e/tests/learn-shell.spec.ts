import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Learn v2's shell (tracker row 139, K1-3) behind the flag `learn_v2`: off, a
 * practice site is today's; on (`?learn_v2=1`), the shell loads at a laptop's
 * width and a phone's, and axe finds nothing serious or critical in it, dark
 * or on paper, in Hinglish or in Hindi. Signed out (no session on this
 * device) the shell reads nothing of the learner's, so any site's address
 * shows it, with Aaj asking to sign in and no rail beside it; Aaj on a
 * learner's own day is learn-aaj.spec.ts. Its images are learn.visual.ts.
 */
const SITE = "learn-shell";

async function seriousOrCritical(page: Page): Promise<string[]> {
  // Colours are scored at rest, not mid-fade.
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

test("with the flag off, a practice site is today's, without Learn's shell", async ({ page }) => {
  await page.goto(`/practice/${SITE}`);
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.getByRole("navigation", { name: "Learn menu" })).toHaveCount(0);
  await expect(page.locator(".ln-app")).toHaveCount(0);
});

for (const [name, viewport] of [
  ["a laptop (1440 px)", { width: 1440, height: 900 }],
  ["a phone (390 px)", { width: 390, height: 844 }],
] as const) {
  test(`with the flag on, the shell loads on ${name}, and axe finds nothing serious`, async ({ page }) => {
    const phone = viewport.width <= 860;
    await page.setViewportSize(viewport);
    await page.goto(`/practice/${SITE}?learn_v2=1`);
    await expect(page.getByRole("heading", { level: 1, name: "Aaj" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Apna din dekhne ke liye sign in karo" })).toBeVisible();
    const theme = () => page.evaluate(() => document.documentElement.dataset["theme"]);
    await expect.poll(theme).toBe("dark");
    if (phone) {
      const tabs = page.getByRole("navigation", { name: "Mukhya tabs" });
      await expect(tabs).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Learn menu" })).toHaveCount(0);
      // Every tab is a 40 px target or more (DESIGN-SYSTEM §9).
      for (const tab of await tabs.locator("a, button").all()) {
        const box = await tab.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(40);
      }
    } else {
      await expect(page.getByRole("navigation", { name: "Learn menu" })).toBeVisible();
      // Signed out, the side bar offers the way to sign in, and Aaj has no rail (it is the learner's own week).
      await expect(page.getByRole("navigation", { name: "Learn menu" }).getByRole("link", { name: /Sign in karo/ })).toHaveAttribute("href", `/practice/${SITE}/signin`);
      await expect(page.getByRole("complementary", { name: "Page ke saath" })).toHaveCount(0);
    }
    expect(await seriousOrCritical(page)).toEqual([]);

    // A placeholder screen, reached as a learner would.
    if (phone) await page.getByRole("navigation", { name: "Mukhya tabs" }).getByRole("link", { name: "Seekho" }).click();
    else await page.getByRole("navigation", { name: "Learn menu" }).getByRole("link", { name: "Courses" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Courses" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/practice/${SITE}/courses$`));
    expect(await seriousOrCritical(page)).toEqual([]);

    // On paper, then in Hindi, from the ⋯ menu.
    await page.getByRole("button", { name: "Aur vikalp" }).click();
    await page.getByRole("menuitem", { name: "Kaagaz (light)" }).click();
    await expect.poll(theme).toBe("light");
    expect(await seriousOrCritical(page)).toEqual([]);
    await page.getByRole("button", { name: "Aur vikalp" }).click();
    await page.getByRole("menuitemradio", { name: "हिंदी" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "कोर्स" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("hi");
    expect(await seriousOrCritical(page)).toEqual([]);

    // The search, from its button.
    await page.getByRole("button", { name: "खोजें" }).first().click();
    const search = page.getByRole("dialog", { name: "खोजें और जाएँ" });
    await expect(search).toBeVisible();
    await search.getByRole("combobox").fill("SQL");
    await expect(search.getByRole("option")).toHaveCount(1);
    expect(await seriousOrCritical(page)).toEqual([]);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "SQL" })).toBeVisible();
  });
}

test("the flag stays on through a reload, and the ⋯ menu turns it off", async ({ page }) => {
  await page.goto(`/practice/${SITE}/sql?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "SQL" })).toBeVisible();
  await page.goto(`/practice/${SITE}/potd`);
  await expect(page.getByRole("heading", { level: 1, name: "Aaj ka problem" })).toBeVisible();
  await page.getByRole("button", { name: "Aur vikalp" }).click();
  await page.getByRole("menuitem", { name: "Abhi wali practice site" }).click();
  await expect(page).toHaveURL(new RegExp(`/practice/${SITE}\\?learn_v2=0$`));
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator(".ln-app")).toHaveCount(0);
  await page.goto(`/practice/${SITE}`);
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator(".ln-app")).toHaveCount(0);
});
