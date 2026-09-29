import { expect, test, type Page } from "@playwright/test";

/**
 * A new institution's first day, held to its committed images: the form that
 * makes its account, the welcome on an empty console, a stop of the tour, and
 * the welcome once the sample exam is in. The organisation is made through
 * the API as a new one would be, and is new to every run.
 */

let token = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  const email = `owner-${Date.now().toString(36)}@onboarding-visual.test`;
  const res = await request.post("/api/auth/signup", {
    data: { organisation: "Sahyadri College of Engineering", name: "Meera Kulkarni", email, password: "our first pilot, carefully" },
  });
  expect(res.status(), await res.text()).toBe(201);
  token = ((await res.json()) as { token: string }).token;
});

/** Signed in as the new owner, on Home, with the clock-bound greeting and the run's own address worded the same every run. */
async function home(page: Page) {
  await page.addInitScript((session) => sessionStorage.setItem("parikshaa.console.session", session), token);
  await page.goto("/console/");
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await expect(page.locator(".welcome, .sample-line").first()).toBeVisible();
  await settle(page);
}

async function settle(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll(".home-greeting").forEach((el) => (el.textContent = "Good morning, Meera."));
    // The address is new to every run; the words around it are what is held.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      node.textContent = node.textContent!.replace(/owner-[a-z0-9]+@onboarding-visual\.test/g, "meera@sahyadri.example");
    }
  });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
}

const masks = (page: Page) => [page.locator(".home-calendar")];

for (const [label, viewport, schemes] of [
  ["1440", { width: 1440, height: 900 }, ["light", "dark"]],
  ["390", { width: 390, height: 844 }, ["light"]],
] as const) {
  for (const scheme of schemes) {
    test.describe(`${label} · ${scheme}`, () => {
      test.use({ viewport, colorScheme: scheme });

      test("sign-up", async ({ page }) => {
        await page.goto("/console/");
        await page.getByRole("button", { name: "Make your institution's account" }).click();
        await expect(page.getByLabel("Institution")).toBeVisible();
        await expect(page.getByText(/The first 25 attempts are free/)).toBeVisible();
        await settle(page);
        await expect(page).toHaveScreenshot(`console-sign-up-${label}-${scheme}.png`);
      });

      test("welcome", async ({ page }) => {
        await home(page);
        await expect(page).toHaveScreenshot(`console-welcome-${label}-${scheme}.png`, { fullPage: true, mask: masks(page) });
      });
    });
  }
}

test.describe("the tour and the sample", () => {
  test.use({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });

  test("a stop of the tour", async ({ page }) => {
    await home(page);
    await page.getByRole("button", { name: "Take the tour" }).click();
    await page.getByTestId("tour").getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Exams" })).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot("console-tour-1440-light.png", { mask: masks(page) });
  });

  test("the sample loaded", async ({ page, request }) => {
    expect((await request.post("/api/onboarding/sample", { headers: { authorization: `Bearer ${token}` } })).status()).toBe(200);
    await home(page);
    await expect(page.getByRole("button", { name: "Try it as a candidate" })).toBeVisible();
    await expect(page).toHaveScreenshot("console-welcome-sample-1440-light.png", { fullPage: true, mask: masks(page) });
  });
});
