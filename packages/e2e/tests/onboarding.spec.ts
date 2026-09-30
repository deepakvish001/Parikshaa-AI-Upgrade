import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
// The link's MAC alone: the whole API would load Fastify into the test runner.
import { StaffSecrets } from "@parikshaa/api/secrets";
import { SECRET } from "../src/database.js";

/**
 * A new institution's first day, in a real browser: it makes its own account,
 * is taken round the console, loads the sample exam, sits it as a candidate
 * would, and puts it away again.
 */

async function violations(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

const PASSWORD = "our first pilot, carefully";

test("an institution signs itself up, takes the tour, and tries the sample exam as a candidate", async ({ page }) => {
  test.slow();
  const email = `owner-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@pilot.e2e.test`;

  await page.goto("/console/");
  await page.getByRole("button", { name: "Make your institution's account" }).click();
  await expect(page.getByRole("heading", { name: "Make your institution's account" })).toBeVisible();
  await expect(page.getByText(/The first 25 attempts are free/)).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await page.getByLabel("Institution").fill("Sahyadri College of Engineering");
  await page.getByLabel("Your name").fill("Meera Kulkarni");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Make the account" }).click();

  // Straight in, and straight into the tour.
  const tour = page.getByTestId("tour");
  await expect(tour.getByRole("dialog", { name: "Home" })).toBeVisible();
  await expect(page.locator(".org-name")).toHaveText("Sahyadri College of Engineering");
  expect(await violations(page)).toEqual([]);
  const titles: string[] = [];
  for (;;) {
    titles.push((await tour.getByRole("heading", { level: 2 }).textContent()) ?? "");
    const next = tour.getByRole("button", { name: "Next" });
    if ((await next.count()) === 0) break;
    await next.click();
  }
  // Staff waits for the owner's address to be confirmed, and so does its stop.
  expect(titles).toEqual(["Home", "Exams", "Question bank", "Find anyone", "Start here"]);
  // The last stop points at the welcome.
  await expect(page.locator(".tour-spot")).toBeVisible();
  await tour.getByRole("button", { name: "Done" }).click();
  await expect(tour).toHaveCount(0);

  const welcome = page.getByRole("region", { name: "Welcome to Parikshaa. Three ways to begin." });
  await expect(welcome).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await page.emulateMedia({ colorScheme: "dark" });
  // Colours fade into the dark theme: measure them once they have arrived, not halfway.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  expect(await violations(page)).toEqual([]);
  await page.emulateMedia({ colorScheme: "light" });

  // The sample: loaded, sat as a candidate would, and nothing recorded.
  await welcome.getByRole("button", { name: "Load the sample exam" }).click();
  await welcome.getByRole("button", { name: "Try it as a candidate" }).click();
  const trying = page.getByRole("dialog", { name: "Try test" });
  await expect(trying.getByText("A shopkeeper marks a shirt at ₹800")).toBeVisible();
  await trying.getByRole("radio", { name: /₹680/ }).check();
  await trying.getByRole("button", { name: "Submit preview" }).click();
  await expect(trying.getByText(/marked automatically/)).toBeVisible();
  await trying.getByRole("button", { name: "Close" }).click();

  // The address is not confirmed yet: said at the top, and inviting waits for it.
  const confirm = page.locator(".confirm-email");
  await expect(confirm).toContainText("Confirm your email address");
  await expect(confirm).toContainText(email);
  const session = await page.evaluate(() => sessionStorage.getItem("parikshaa.console.session"));
  const me = await (await page.request.get("/api/auth/me", { headers: { authorization: `Bearer ${session}` } })).json();
  expect(me.permissions).not.toContain("attempt:start");
  await confirm.getByRole("button", { name: "Send the link again" }).click();
  await expect(confirm.getByText("Sent. Check your inbox and spam folder.")).toBeVisible();

  // The link, as the email carries it.
  await page.goto(`/console/?verify=${encodeURIComponent(new StaffSecrets(SECRET).emailToken(me.id, email))}`);
  await expect(page.getByText("Your email address is confirmed.")).toBeVisible();
  // The server's word first, then the page's: a failure then says which is behind.
  const after = await (await page.request.get("/api/auth/me", { headers: { authorization: `Bearer ${session}` } })).json();
  expect(after.emailVerified).toBe(true);
  expect(after.permissions).toContain("attempt:start");
  await expect(page.locator(".confirm-email")).toHaveCount(0);
  await expect(page).toHaveURL(/\/console\/$/);
  await expect(page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Staff", exact: true })).toBeVisible();

  // It is among the exams, and the first steps still wait for the institution's own.
  await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Exams" }).click();
  await expect(page.getByText("Sample: campus aptitude round").first()).toBeVisible();
  await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Home" }).click();
  await expect(welcome.getByRole("button", { name: "Try it as a candidate" })).toBeVisible();

  // Signing in again is an ordinary sign-in: no tour.
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(welcome).toBeVisible();
  await expect(page.getByTestId("tour")).toHaveCount(0);

  // The tour again, by keyboard: Escape ends it and focus comes back.
  const again = welcome.getByRole("button", { name: "Take the tour" });
  await again.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Home" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "Exams" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("tour")).toHaveCount(0);
  await expect(again).toBeFocused();
});

test("an address that already has an account is told so, and offered sign-in", async ({ page }) => {
  await page.goto("/console/");
  await page.getByRole("button", { name: "Make your institution's account" }).click();
  await page.getByLabel("Institution").fill("Anywhere");
  await page.getByLabel("Your name").fill("Someone");
  await page.getByLabel("Work email").fill("owner@e2e.test");
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Make the account" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("An account already uses this email address.");
  await alert.getByRole("button", { name: "Sign in instead" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to the console" })).toBeVisible();
});
