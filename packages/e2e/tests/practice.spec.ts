import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ownerToken } from "./support.js";

/**
 * ROADMAP §15, in a real browser: an institution opens a practice site and
 * publishes a problem from its bank; a learner signs up at the site's address,
 * solves it, reads the editorial, and finds themself on the leaderboard.
 */

const SITE = "e2e-practice";

async function violations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** The site open, and one multiple-choice problem of this test's own on it. */
async function seedPractice(request: APIRequestContext): Promise<{ title: string; slug: string; token: string }> {
  const token = await ownerToken(request);
  const headers = { authorization: `Bearer ${token}` };
  const site = await request.put("/api/practice-admin/site", {
    headers,
    data: { slug: SITE, title: "E2E Practice", welcome: "Practise **daily**.", open: true },
  });
  expect(site.status(), await site.text()).toBe(200);

  const unique = Math.random().toString(36).slice(2, 8);
  const title = `Stable sorting ${unique}`;
  const filed = await request.post("/api/bank", {
    headers,
    data: {
      question: { kind: "mcq", stem: `${title}\n\nWhich of these sorts is **stable**?`, maxScore: 1, rubric: [], options: ["Heap sort", "Merge sort"], correctIndex: 1 },
      difficulty: "easy",
      tags: ["sorting"],
    },
  });
  expect(filed.status(), await filed.text()).toBe(201);
  const published = await request.post("/api/practice-admin/problems", {
    headers,
    data: { bankQuestionId: (await filed.json()).id, editorial: "Merge sort never swaps **equal** keys." },
  });
  expect(published.status(), await published.text()).toBe(201);
  return { title, slug: (await published.json()).slug, token };
}

test("a learner signs up on a practice site, solves a problem, reads its editorial and reaches the leaderboard", async ({ page, request }) => {
  const { title, slug, token } = await seedPractice(request);
  const name = `Asha ${Math.random().toString(36).slice(2, 6)}`;
  const email = `${name.replace(" ", ".").toLowerCase()}@learners.e2e.test`;

  await page.goto(`/practice/${SITE}`);
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  // A visitor may read, but must sign up to answer.
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("Sign in to run and submit your code.")).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).last().click();
  await page.getByRole("link", { name: "Create account" }).last().click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a long enough password");
  expect(await violations(page)).toEqual([]);
  await page.getByRole("button", { name: "Create account" }).click();

  // Back on the problem, signed in.
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/practice/${SITE}/problems/${slug}$`));
  await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();

  await page.getByRole("radio", { name: "Heap sort" }).check();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Not quite. Try again.")).toBeVisible();
  await page.getByRole("tab", { name: "Editorial" }).click();
  await expect(page.getByText("The editorial opens once you solve the problem, or after three tries.")).toBeVisible();

  await page.getByRole("tab", { name: "Description" }).click();
  await page.getByRole("radio", { name: "Merge sort" }).check();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Correct!")).toBeVisible();
  await expect(page.getByText("Solved! The editorial is open now.")).toBeVisible();
  await page.getByRole("tab", { name: "Editorial" }).click();
  await expect(page.getByText("Merge sort never swaps")).toBeVisible();
  expect(await violations(page)).toEqual([]);

  // A question in the discussion, which staff can hide.
  await page.getByRole("tab", { name: "Discussion" }).click();
  await page.getByPlaceholder("Write a comment").fill("Is insertion sort stable too?");
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText("Is insertion sort stable too?")).toBeVisible();
  const staff = { authorization: `Bearer ${token}` };
  const comments = await (await request.get("/api/practice-admin/comments", { headers: staff })).json();
  const mine = comments.comments.find((c: { body: string }) => c.body === "Is insertion sort stable too?");
  expect((await request.put(`/api/practice-admin/comments/${mine.id}`, { headers: staff, data: { hidden: true } })).status()).toBe(200);
  await page.reload();
  await page.getByRole("tab", { name: "Discussion" }).click();
  await expect(page.getByText("No comments yet.")).toBeVisible();

  // Progress and the leaderboard count the solve.
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("1-day streak")).toBeVisible();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.getByRole("link", { name: "Leaderboard" }).click();
  const me = page.getByRole("row").filter({ hasText: name });
  await expect(me).toContainText("You");
});

test("a reload anywhere on a practice site opens that page, not the API's answer", async ({ page, request }) => {
  const { title, slug } = await seedPractice(request);
  await page.goto(`/practice/${SITE}/problems/${slug}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.goto(`/practice/${SITE}/contests`);
  await expect(page.getByRole("heading", { name: "Contests" })).toBeVisible();
  await page.goto("/practice/no-such-site");
  await expect(page.getByRole("heading", { name: "There is no practice site here" })).toBeVisible();
});

test("code typed in a practice problem's editor is still there after a reload", async ({ page, request }) => {
  const token = await ownerToken(request);
  const headers = { authorization: `Bearer ${token}` };
  await seedPractice(request);
  const title = `Echo ${Math.random().toString(36).slice(2, 8)}`;
  const filed = await request.post("/api/bank", {
    headers,
    data: {
      question: { kind: "code", stem: `${title}\n\nPrint what you read.`, maxScore: 1, rubric: [], language: "python", languages: ["python"], starter: "", samples: [], tests: [{ id: "t1", input: "1\n", expected: "1\n", weight: 1, hidden: true }] },
      difficulty: "easy",
      tags: [],
    },
  });
  expect(filed.status(), await filed.text()).toBe(201);
  const published = await request.post("/api/practice-admin/problems", { headers, data: { bankQuestionId: (await filed.json()).id } });
  expect(published.status(), await published.text()).toBe(201);

  await page.goto(`/practice/${SITE}/problems/${(await published.json()).slug}`);
  const editor = page.getByRole("textbox", { name: "Code for question 1" });
  await editor.click();
  await page.keyboard.type("print(input())");
  await expect(editor).toContainText("print(input())");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Code for question 1" })).toContainText("print(input())");
});

test.describe("in the dark theme", () => {
  test.use({ colorScheme: "dark" });

  test("the problem set, a problem and its discussion pass WCAG 2.1 AA", async ({ page, request }) => {
    const { title } = await seedPractice(request);
    await page.goto(`/practice/${SITE}`);
    await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.getByRole("button", { name: "Display" }).click();
    await expect(page.getByRole("group", { name: "Display" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });
});
