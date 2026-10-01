import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
// The password hash alone: the whole API would load Fastify into the test runner.
import { hashPassword } from "@parikshaa/api/passwords";
import { ripenLearner, seedPrepOrganisation } from "../src/database.js";

/**
 * The Prep blueprint's flows a learner walks most (§9), in a real browser on
 * a real Postgres: F1 sign up and make a first plan, F3 run and submit code,
 * F12 buy Plus, F13 spend coins in the store. Each test has an organisation
 * and a practice site of its own, so one turning Plus on locks nothing in
 * another running beside it.
 */

const PASSWORD = "a long enough password";
const unique = () => Math.random().toString(36).slice(2, 8);

interface Site {
  readonly slug: string;
  readonly org: string;
  readonly staff: { authorization: string };
}

async function openSite(request: APIRequestContext): Promise<Site> {
  const owner = await seedPrepOrganisation(hashPassword);
  const login = await request.post("/api/auth/login", { data: { email: owner.email, password: owner.password } });
  expect(login.status(), await login.text()).toBe(200);
  const staff = { authorization: `Bearer ${(await login.json()).token as string}` };
  const slug = `prep-${unique()}`;
  const site = await request.put("/api/practice-admin/site", { headers: staff, data: { slug, title: "Prep College", welcome: "", open: true } });
  expect(site.status(), await site.text()).toBe(200);
  return { slug, org: owner.id, staff };
}

async function post(request: APIRequestContext, site: Site, path: string, data: object): Promise<{ id: string; slug: string }> {
  const res = await request.post(`/api/${path}`, { headers: site.staff, data });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

/** A learner signed up by the API, and the page signed in as them. */
async function learnerOn(page: Page, request: APIRequestContext, site: Site, name: string): Promise<{ email: string; token: string }> {
  const email = `${name.toLowerCase()}.${unique()}@learners.e2e.test`;
  const res = await request.post(`/api/practice/${site.slug}/signup`, { data: { name, email, password: PASSWORD } });
  expect(res.status(), await res.text()).toBe(201);
  const token = (await res.json()).token as string;
  await page.addInitScript(([key, value]) => localStorage.setItem(key!, value!), [`parikshaa.practice.${site.slug}.session`, token]);
  return { email, token };
}

test("F1: a learner signs up, plans a track, and finds today's work on the dashboard", async ({ page, request }) => {
  const site = await openSite(request);
  const lessons = [];
  for (const title of ["What an array is", "Two pointers", "Sliding window"]) {
    lessons.push(await post(request, site, "practice-admin/lessons", { title, body: `# ${title}\n\nRead this first.`, estMinutes: 20, published: true }));
  }
  const track = await post(request, site, "practice-admin/tracks", {
    title: "Arrays",
    description: "Start here.",
    published: true,
    modules: [{ title: "Basics", items: lessons.map((l) => ({ lessonId: l.id })) }],
  });

  await page.goto(`/practice/${site.slug}/signup`);
  await page.getByLabel("Name").fill("Asha Verma");
  await page.getByLabel("Email").fill(`asha.${unique()}@learners.e2e.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("link", { name: /Asha Verma/ })).toBeVisible();

  await page.goto(`/practice/${site.slug}/plan?track=${track.slug}`);
  await expect(page.getByRole("heading", { name: "Plan a track" })).toBeVisible();
  await page.getByLabel("Minutes a day").fill("60");
  await page.getByRole("button", { name: "Show the plan" }).click();
  await expect(page.getByText(/It fits: finished by/)).toBeVisible();
  await page.getByRole("button", { name: "Start this plan" }).click();

  await page.goto(`/practice/${site.slug}/home`);
  await expect(page.getByRole("heading", { name: "Namaste, Asha" })).toBeVisible();
  const today = page.getByRole("region", { name: "Today's plan" });
  await expect(today.getByRole("link", { name: "What an array is" })).toBeVisible();
  await today.getByRole("link", { name: "What an array is" }).click();
  await expect(page.getByRole("heading", { name: "What an array is", level: 1 })).toBeVisible();
});

test("F3: a learner runs code on the examples, then submits it against every test", async ({ page, request }) => {
  const site = await openSite(request);
  const title = `Sum of two ${unique()}`;
  const filed = await request.post("/api/bank", {
    headers: site.staff,
    data: {
      question: {
        kind: "code",
        stem: `${title}\n\nRead two integers on a line and print their sum.`,
        maxScore: 1,
        rubric: [],
        language: "python",
        languages: ["python"],
        starter: "",
        samples: [],
        tests: [
          { id: "example", input: "2 3\n", expected: "5\n", weight: 1, hidden: false },
          { id: "big", input: "4000000000 4000000000\n", expected: "8000000000\n", weight: 1, hidden: true },
        ],
      },
      difficulty: "easy",
      tags: ["math"],
    },
  });
  expect(filed.status(), await filed.text()).toBe(201);
  const problem = await post(request, site, "practice-admin/problems", { bankQuestionId: (await filed.json()).id });
  await learnerOn(page, request, site, "Ravi");

  await page.goto(`/practice/${site.slug}/problems/${problem.slug}`);
  const editor = page.locator(".cm-content");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText("a, b = map(int, input().split())\nprint(a + b)\n");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByRole("region", { name: "Run results" })).toContainText("1/1 examples pass", { timeout: 30_000 });
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("region", { name: "Submission results" })).toContainText("2/2 tests passed", { timeout: 30_000 });
  await expect(page.getByText("Solved! The editorial is open now.")).toBeVisible();
});

test("F12: a learner buys Plus through Checkout, holds it, and opens the tax invoice", async ({ page, request }) => {
  const site = await openSite(request);
  const on = await request.put("/api/practice-admin/plus", { headers: site.staff, data: { plusEnabled: true } });
  expect(on.status(), await on.text()).toBe(200);
  await post(request, site, "practice-admin/plus/products", { title: "Plus, 3 months", kind: "plus", days: 90, credits: 500, pricePaise: 99_900 });
  await learnerOn(page, request, site, "Kiran");

  // Checkout is Razorpay's page: stood in for by what it does on success, signed with the fake's key secret.
  await page.addInitScript(() => {
    (window as unknown as { Razorpay: unknown }).Razorpay = class {
      constructor(readonly options: { order_id: string; handler: (r: object) => void }) {}
      on() {}
      async open() {
        const paymentId = `pay_${Date.now()}`;
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("fake-key-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
        const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${this.options.order_id}|${paymentId}`));
        const signature = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
        this.options.handler({ razorpay_order_id: this.options.order_id, razorpay_payment_id: paymentId, razorpay_signature: signature });
      }
    };
  });
  await page.goto(`/practice/${site.slug}/plus`);
  const plan = page.getByRole("region", { name: "Plus, 3 months" });
  await expect(plan).toContainText("₹999");
  await plan.getByRole("button", { name: /Buy for/ }).click();
  await expect(page.getByText("Paid. Thank you!")).toBeVisible();
  await expect(page.getByText(/You have Plus until/)).toBeVisible();

  const invoice = page.getByRole("link", { name: /Invoice PKP\// });
  await expect(invoice).toBeVisible();
  await invoice.click();
  await expect(page.getByText("Invoice number")).toBeVisible();
  await expect(page.getByText(/PKP\/\d{4}\/000001/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Print or save as PDF/ })).toBeVisible();
});

test("F13: a learner spends coins on an item from the store, giving an address for a posted one", async ({ page, request }) => {
  const site = await openSite(request);
  await post(request, site, "practice-admin/store/items", {
    title: "Sticker pack",
    description: "Six laptop stickers.",
    kind: "physical",
    plusDays: 0,
    priceCoins: 300,
    stock: 5,
    perLearner: 1,
    active: true,
  });
  const { email } = await learnerOn(page, request, site, "Meera");

  // A new account waits fourteen days; then it may spend.
  await page.goto(`/practice/${site.slug}/store`);
  await expect(page.getByText(/The store opens to new accounts after 14 days/)).toBeVisible();
  await ripenLearner(site.org, email, 500);
  await page.reload();

  const item = page.getByRole("article", { name: "Sticker pack" });
  await item.getByRole("button", { name: "Buy · 300" }).click();
  await item.getByLabel("Postal address").fill("12 Residency Road, Bengaluru 560025");
  await item.getByRole("button", { name: "Spend 300 coins" }).click();
  await expect(page.getByText("Done. 200 coins left.")).toBeVisible();
  const orders = page.getByRole("heading", { name: "Your orders" }).locator("..");
  await expect(orders).toContainText("Sticker pack");
  await expect(orders).toContainText("Placed");
});
