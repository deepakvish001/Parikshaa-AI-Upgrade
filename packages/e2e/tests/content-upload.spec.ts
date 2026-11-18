import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
// The password hash alone: the whole API would load Fastify into the test runner.
import { hashPassword } from "@parikshaa/api/passwords";
import { seedPrepOrganisation } from "../src/database.js";
// The API's own content fixtures: items that pass the format's schemas and rules, with real programs.
import { bundleJson, dsaItem, lessonItem, MANIFEST, mcqItem, ORDERS, sqlItem, SUM } from "../../api/src/testing/content-fixtures.js";

/**
 * The console's bulk content upload (tracker plan row 141, part B), end to
 * end on a real Postgres: a bundle with one DSA problem, one SQL problem, one
 * MCQ and one lesson goes up in the console; every item's programs run on the
 * code runner (in-process here, E2E_RUNNER=local: C, C++, Java, JavaScript,
 * Python and SQLite); the report shows four drafts that learners cannot see; a
 * reviewer publishes them; the practice API serves the problems and judges a
 * learner's answers against the tests the gates made, and Learn shows the
 * lesson in its track.
 *
 * The gates are the server's and run alike whatever the browser, and the DSA
 * item alone runs five languages over 25 tests: once, in Chromium, is enough
 * on CI's two cores.
 */

test.skip(({ browserName }) => browserName !== "chromium", "The gates run on the server, alike for every browser; once is enough.");

const unique = () => Math.random().toString(36).slice(2, 8);

async function seriousOrCritical(page: Page): Promise<string[]> {
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]).analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** An organisation of this test's own, its owner, and its practice site open. */
async function openSite(request: APIRequestContext): Promise<{ slug: string; email: string; password: string }> {
  const owner = await seedPrepOrganisation(hashPassword);
  const login = await request.post("/api/auth/login", { data: { email: owner.email, password: owner.password } });
  expect(login.status(), await login.text()).toBe(200);
  const staff = { authorization: `Bearer ${(await login.json()).token as string}` };
  const slug = `content-${unique()}`;
  const site = await request.put("/api/practice-admin/site", { headers: staff, data: { slug, title: "Content College", welcome: "", open: true } });
  expect(site.status(), await site.text()).toBe(200);
  return { slug, email: owner.email, password: owner.password };
}

test("a bundle uploaded in the console is checked on the runner, published by a reviewer, and reaches Learn", async ({ page, request }) => {
  // Five languages' compilers and 25 tests each, on the in-process runner.
  test.setTimeout(300_000);
  const site = await openSite(request);
  const api = (path: string) => `/api/practice/${site.slug}${path}`;

  await page.goto("/console/");
  await page.getByLabel("Email").fill(site.email);
  await page.getByLabel("Password", { exact: true }).fill(site.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("tab", { name: "Bulk upload", exact: true }).click();
  await expect(page.getByRole("region", { name: "Uploads" })).toContainText("No bundles uploaded yet");

  // Choose, then upload: the schema and rules pass at once, and the runner's gates start.
  const bundle = bundleJson([dsaItem(), sqlItem(), mcqItem(), lessonItem()]);
  await page.getByLabel("Content bundle (JSON or ZIP)").setInputFiles({ name: "launch-batch.json", mimeType: "application/json", buffer: Buffer.from(bundle) });
  await expect(page.getByText(/launch-batch\.json \(0\.\d\d MB\)/)).toBeVisible();
  await page.getByRole("button", { name: "Upload and check" }).click();
  const report = page.getByRole("region", { name: `Report: ${MANIFEST.title}` });
  await expect(report.getByRole("progressbar", { name: "Checked on the code runner" })).toBeVisible();
  await expect(report).toContainText("of 4 items done");

  // The report, once the runner is through: four drafts, nothing failed.
  await expect(report).toContainText("Checked: 4 passed, 0 failed.", { timeout: 240_000 });
  await expect(report.getByRole("progressbar")).toHaveCount(0);
  const items = report.getByRole("list", { name: "Items" }).locator(".content-item");
  await expect(items).toHaveCount(4);
  for (const title of ["Total of a list", "What each customer spent", "Two piles of mangoes", "What a process is"]) {
    const row = items.filter({ hasText: title });
    await expect(row.locator(".pill")).toHaveText("Draft");
    await expect(row).toContainText("Learn shows it once it is published");
  }
  // What the gates did not check yet is said, for the reviewer.
  await items.filter({ hasText: "Total of a list" }).getByText(/notes? for the reviewer/).click();
  await expect(items.filter({ hasText: "Total of a list" })).toContainText("not checked yet: mutation (gate 10)");
  await report.getByRole("button", { name: "Failed 0" }).click();
  await expect(report).toContainText("No item failed.");
  await report.getByRole("button", { name: "All 4" }).click();
  expect(await seriousOrCritical(page)).toEqual([]);

  // A draft is not on the site.
  expect((await request.get(api("/problems/list-total"))).status()).toBe(404);
  expect((await request.get(api("/lessons/os-what-a-process-is"))).status()).toBe(404);

  // The reviewer publishes everything that passed.
  await report.getByRole("button", { name: "Publish all passed (4)" }).click();
  await expect(report.getByText("Published 4 items.")).toBeVisible();
  for (const title of ["Total of a list", "What each customer spent", "Two piles of mangoes", "What a process is"]) {
    await expect(items.filter({ hasText: title }).locator(".pill")).toHaveText("Published");
  }
  await expect(report.getByRole("button", { name: /Publish/ })).toHaveCount(0);
  const history = page.getByRole("region", { name: "Uploads" });
  await expect(history.getByRole("row").filter({ hasText: MANIFEST.title })).toContainText("4 passed, 0 failed");
  await expect(history.getByRole("row").filter({ hasText: MANIFEST.title }).locator("td").last()).toHaveText("4");
  expect(await seriousOrCritical(page)).toEqual([]);

  // The practice API: the three problems, and the lesson's quiz and hands-on task as problems of their own.
  const dsa = await request.get(api("/problems/list-total"));
  expect(dsa.status(), await dsa.text()).toBe(200);
  expect(await dsa.json()).toMatchObject({ title: "Total of a list", difficulty: "easy" });
  expect((await request.get(api("/problems/sql-customer-totals"))).status()).toBe(200);
  const mcq = await request.get(api("/problems/apt-quant-two-numbers"));
  expect(mcq.status()).toBe(200);
  expect(JSON.stringify(await mcq.json())).toContain("12 mangoes");
  expect((await request.get(api("/problems/os-what-a-process-is-q1"))).status()).toBe(200);
  expect((await request.get(api("/problems/os-what-a-process-is-add-two"))).status()).toBe(200);

  // A learner's answers are judged against what the gates made: every test the reference passed.
  const signup = await request.post(api("/signup"), { data: { name: "Asha Verma", email: `asha.${unique()}@learners.e2e.test`, password: "a long enough password" } });
  expect(signup.status(), await signup.text()).toBe(201);
  const learner = { authorization: `Bearer ${(await signup.json()).token as string}` };
  const solved = await request.post(api("/problems/list-total/submit"), { headers: learner, data: { answer: SUM.python, language: "python" } });
  expect(solved.status(), await solved.text()).toBe(200);
  expect(await solved.json()).toMatchObject({ status: "passed", passed: 25, total: 25 });
  const wrong = await request.post(api("/problems/list-total/submit"), { headers: learner, data: { answer: SUM.wrongLast, language: "python" } });
  expect((await wrong.json()).status).toBe("wrong_answer");
  const query = await request.post(api("/problems/sql-customer-totals/submit"), { headers: learner, data: { answer: ORDERS.reference, language: "sql" } });
  expect(query.status(), await query.text()).toBe(200);
  expect((await query.json()).status).toBe("passed");
  const choice = await request.post(api("/problems/apt-quant-two-numbers/submit"), { headers: learner, data: { answer: "0" } });
  expect(choice.status(), await choice.text()).toBe(200);
  expect((await choice.json()).status).toBe("passed");

  // Learn's API: the lesson, and its track with the lesson in its module.
  const lesson = await request.get(api("/lessons/os-what-a-process-is"));
  expect(lesson.status(), await lesson.text()).toBe(200);
  expect(JSON.stringify(await lesson.json())).toContain("Why it matters");
  const track = await request.get(api("/tracks/os-basics"));
  expect(track.status(), await track.text()).toBe(200);
  const { title, modules } = (await track.json()) as { title: string; modules: { title: string; items: unknown[] }[] };
  expect(title).toBe("Operating systems, the basics");
  expect(modules.map((m) => [m.title, m.items.length])).toEqual([
    ["Processes", 2],
    ["Memory", 0],
  ]);

  // And Learn itself, signed out: the lesson reads.
  await page.goto(`/practice/${site.slug}/lessons/os-what-a-process-is?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1, name: "What a process is" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why it matters" })).toBeVisible();
});
