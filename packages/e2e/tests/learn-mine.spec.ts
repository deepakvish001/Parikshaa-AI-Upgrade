import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { seedLearnDay, type LearnDay, type LearnMine } from "./learn-day.js";

/**
 * Learn's revision, Meri lists and Notes on the real API (tracker row 140,
 * K2-3), flag `learn_v2` on: a seeded learner with two cards due today, a
 * bookmark and a list of their own, and three notes. Each screen does what
 * the API allows (grade, take out, make a list, write, delete), and axe finds
 * nothing serious or critical at a laptop's width (dark) and a phone's (on paper).
 */

const unique = () => Math.random().toString(36).slice(2, 8);

async function seriousOrCritical(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function seeded(page: Page, request: Parameters<typeof seedLearnDay>[0], theme: "dark" | "light"): Promise<{ site: string; day: LearnDay; mine: LearnMine }> {
  const site = `learn-${unique()}`;
  const day = await seedLearnDay(request, { org: `e2e-learn-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` }, mine: true });
  await page.addInitScript(([key, token, t]) => {
    localStorage.setItem(key!, token!);
    localStorage.setItem("parikshaa.learn.theme", t!);
  }, [`parikshaa.practice.${site}.session`, day.token, theme]);
  return { site, day, mine: day.mine! };
}

test("revision, lists and notes on a laptop: the learner's own, changed on the API", async ({ page, request }) => {
  const { site, mine } = await seeded(page, request, "dark");
  await page.setViewportSize({ width: 1440, height: 900 });

  // Revision: two cards due today, one at a time; a grade is sent and the next card comes.
  await page.goto(`/practice/${site}/revision?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Bhoolne se pehle 2 cards." })).toBeVisible();
  const first = page.getByRole("article", { name: "Card 1 / 2" });
  await expect(first.getByRole("heading", { level: 2 })).toHaveText(mine.cards[0]!.title);
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByRole("button", { name: /^Jawab dikhao/ }).click();
  await expect(first.getByText("Halve the range at every")).toBeVisible();
  await expect(first.locator("pre code")).toHaveText("int mid = lo + (hi - lo) / 2;");
  const grades = page.getByRole("group", { name: "Kitna yaad tha?" });
  await expect(grades.getByRole("button")).toHaveText(["Phir se1 dinkal phir", "Mushkil1 dinkal phir", "Theek3 din3 din baad phir", "Aasaan7 din7 din baad phir"]);
  expect(await seriousOrCritical(page)).toEqual([]);
  const graded = page.waitForResponse((r) => r.url().endsWith(`/revise/${mine.cards[0]!.slug}`) && r.request().method() === "POST");
  await grades.getByRole("button", { name: /^Theek/ }).click();
  expect((await graded).status()).toBe(200);
  await expect(page.getByRole("status")).toHaveText(`${mine.cards[0]!.title}: 3 din baad phir.`);
  const second = page.getByRole("article", { name: "Card 2 / 2" });
  await expect(second.getByRole("heading", { level: 2 })).toHaveText(mine.cards[1]!.title);
  await page.keyboard.press("Space");
  await expect(second.getByText("Is problem par abhi note nahi.", { exact: false })).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByRole("heading", { level: 2, name: "Aaj ki revision ho gayi." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "Aaj revise karne ko kuch nahi" })).toBeVisible();

  // Lists: bookmarks first; the learner's own list; a problem taken out; a new list from saved problems.
  await page.goto(`/practice/${site}/lists?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Aapki apni sheets." })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bookmarks" }).getByRole("link", { name: mine.bookmarked.title })).toHaveAttribute("href", `/practice/${site}/problems/${mine.bookmarked.slug}`);
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByRole("button", { name: new RegExp(`^${mine.list.name}`) }).click();
  const own = page.getByRole("region", { name: mine.list.name });
  const out = mine.list.problems[1]!;
  await own.getByRole("button", { name: `${out.title} ko ${mine.list.name} se hatao` }).click();
  await expect(page.getByText(`${out.title} ${mine.list.name} se hat gaya.`)).toBeVisible();
  await expect(own.getByRole("link", { name: out.title })).toHaveCount(0);
  await page.getByRole("button", { name: "Nayi list" }).click();
  const dialog = page.getByRole("dialog", { name: "Nayi list" });
  await dialog.getByLabel("Naam").fill("Sunday revision");
  await dialog.getByRole("checkbox", { name: mine.bookmarked.title }).check();
  expect(await seriousOrCritical(page)).toEqual([]);
  await dialog.getByRole("button", { name: "List banao" }).click();
  await expect(page.getByText("List ban gayi: Sunday revision.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Sunday revision" }).getByRole("link", { name: mine.bookmarked.title })).toBeVisible();

  // Notes: the newest opens, drawn from Markdown; written and saved; a topic note made and deleted.
  await page.goto(`/practice/${site}/notes?learn_v2=1`);
  const note = page.getByRole("article", { name: mine.note.title });
  await expect(note.locator("pre code")).toHaveText("int mid = lo + (hi - lo) / 2;");
  await expect(note.getByRole("link", { name: "Problem kholo" })).toHaveAttribute("href", `/practice/${site}/problems/${mine.note.slug}`);
  expect(await seriousOrCritical(page)).toEqual([]);
  await note.getByRole("button", { name: "Badlo" }).click();
  await note.getByLabel("Aapka note").fill("Halve the range: lo + (hi - lo) / 2.");
  await note.getByRole("button", { name: "Save karo" }).click();
  await expect(page.getByText("Note save ho gaya.")).toBeVisible();
  await expect(note).toContainText("Halve the range: lo + (hi - lo) / 2.");
  await page.getByLabel("Kisi topic par naya note").fill("DBMS normal forms");
  await page.getByRole("button", { name: "Likho" }).click();
  const topic = page.getByRole("article", { name: "DBMS normal forms" });
  await topic.getByLabel("Aapka note").fill("1NF: atomic values.");
  await topic.getByRole("button", { name: "Save karo" }).click();
  await expect(page.getByRole("button", { name: /^DBMS normal forms/ })).toBeVisible();
  await page.getByRole("button", { name: /^DBMS normal forms/ }).click();
  await page.getByRole("article", { name: "DBMS normal forms" }).getByRole("button", { name: "Note mitao" }).click();
  await page.getByRole("dialog", { name: "Note mitao" }).getByRole("button", { name: "Note mitao" }).click();
  await expect(page.getByText("Note mit gaya.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^DBMS normal forms/ })).toHaveCount(0);
});

test("on a phone, on paper: Aaj's revision card leads to revision, and the three screens pass axe", async ({ page, request }) => {
  const { site, mine } = await seeded(page, request, "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/practice/${site}?learn_v2=1`);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset["theme"])).toBe("light");
  const ahead = page.getByRole("region", { name: "Aage" });
  await expect(ahead).toContainText("2 revision cards baaki");
  await ahead.getByRole("link", { name: /Revise karo/ }).click();
  await expect(page).toHaveURL(new RegExp(`/practice/${site}/revision$`));
  await expect(page.getByRole("article", { name: "Card 1 / 2" })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
  await page.getByRole("button", { name: /^Jawab dikhao/ }).click();
  await expect(page.getByRole("group", { name: "Kitna yaad tha?" })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);

  await page.goto(`/practice/${site}/lists?learn_v2=1`);
  await expect(page.getByRole("region", { name: "Bookmarks" })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);

  await page.goto(`/practice/${site}/notes?learn_v2=1`);
  await expect(page.getByRole("article", { name: mine.note.title })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
});
