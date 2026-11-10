import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BIG_COUNTRIES, seedLearnSql, type LearnSql } from "./learn-day.js";

/**
 * SQL in Learn on the real API and the e2e stack's judge (tracker row 140,
 * K2-7), flag `learn_v2` on, on a site that took in the SQL starter pack:
 * the SQL screen lists the pack's problems; one opens in the workspace with
 * its table's columns and the example's rows; a query with a typo is the
 * database's error; a wrong query is judged wrong with the learner's rows
 * beside the expected (the missing row marked); the right one is accepted
 * and the editorial opens. On a phone, from the sheet (the plan's track), the
 * tables read in the Problem tab. Axe finds nothing serious or critical.
 */

const unique = () => Math.random().toString(36).slice(2, 8);

async function seriousOrCritical(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function seeded(page: Page, request: Parameters<typeof seedLearnSql>[0], theme: "dark" | "light"): Promise<{ site: string; sql: LearnSql }> {
  const site = `learn-sql-${unique()}`;
  const sql = await seedLearnSql(request, { org: `e2e-learn-sql-${unique()}`, site, learner: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test` } });
  await page.addInitScript(([key, token, t]) => {
    localStorage.setItem(key!, token!);
    localStorage.setItem("parikshaa.learn.theme", t!);
  }, [`parikshaa.practice.${site}.session`, sql.token, theme]);
  return { site, sql };
}

/** The editor's own text box, filled in one go. */
async function write(page: Page, query: string) {
  await expect(page.locator(".cm-content")).toBeVisible();
  const editor = page.getByRole("textbox", { name: "Aapki query" });
  await editor.fill(query);
  await expect(editor).toContainText(query.slice(0, 20));
}

test("SQL on a laptop: the SQL screen, a problem's tables, a query error, a wrong result beside the expected, then accepted", async ({ page, request }) => {
  const { site, sql } = await seeded(page, request, "dark");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/practice/${site}/sql?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Asli tables par queries." })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("8 me se 8 problems");
  expect(await seriousOrCritical(page)).toEqual([]);

  await page.getByRole("link", { name: sql.problem.title }).click();
  await expect(page.getByRole("heading", { level: 1, name: sql.problem.title })).toBeVisible();
  const columns = page.getByRole("region", { name: "World ke columns" });
  await expect(columns).toContainText("population");
  await expect(columns).toContainText("INTEGER");
  // The example's rows in the statement (the Testcase pane shows the same table as the run's input).
  await expect(page.getByRole("tabpanel", { name: "Problem" }).getByRole("region", { name: "World · 4 rows" }).getByRole("cell", { name: "Bhutan" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wapas" })).toHaveAttribute("href", `/practice/${site}/sql`);
  expect(await seriousOrCritical(page)).toEqual([]);

  // A typo: the database's own words, no empty result.
  await write(page, BIG_COUNTRIES.typo);
  await page.getByRole("button", { name: "Chalao" }).click();
  const result = page.getByRole("tabpanel", { name: "Nateeja" });
  await expect(result.getByLabel("Query me error")).toContainText("no such column: nme", { timeout: 30_000 });

  // Wrong: the judge's verdict, and on the visible test the learner's rows beside the expected, Nepal missing.
  await write(page, BIG_COUNTRIES.wrong);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(result.getByText("Galat jawab", { exact: true })).toBeVisible({ timeout: 30_000 });
  const failing = result.getByRole("region", { name: "Pehla fail test: test 1" });
  await expect(failing.getByRole("group", { name: "Aapka nateeja" }).getByRole("row")).toHaveCount(2);
  await expect(failing.getByRole("group", { name: "Sahi nateeja" }).locator("tr.lq-missing")).toContainText("Nepal");
  await expect(failing.getByText("1 rows kam, 0 rows zyada")).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);

  // Right: accepted on every test, and the editorial opens with its approaches.
  await write(page, BIG_COUNTRIES.right);
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(result.getByText("Accepted", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(result.getByText("3 me se 3 test pass")).toBeVisible();
  await result.getByRole("button", { name: "Editorial padho" }).click();
  await expect(page.getByRole("button", { name: /Optimal/ })).toBeVisible();
});

test("SQL on a phone, on paper, from the sheet: the query first, the tables in the Problem tab, nothing spills sideways", async ({ page, request }) => {
  const { site, sql } = await seeded(page, request, "light");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/practice/${site}/sheet?learn_v2=1`);
  await page.getByRole("link", { name: sql.problem.title }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: sql.problem.title })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Workspace ke pane" });
  await expect(tabs.getByRole("tab", { name: "Query" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "Chalao" })).toBeVisible();
  expect(await seriousOrCritical(page)).toEqual([]);
  await tabs.getByRole("tab", { name: "Problem" }).click();
  await expect(page.getByRole("region", { name: "World ke columns" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await seriousOrCritical(page)).toEqual([]);
});
