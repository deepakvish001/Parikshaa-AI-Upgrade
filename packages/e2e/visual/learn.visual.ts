import { expect, test, type Page } from "@playwright/test";
import { istDay, seedLearnDay } from "../tests/learn-day.js";

/**
 * Learn v2 with the flag `learn_v2` on, held to its committed images (K1-4;
 * Aaj on real data since K2-1, tracker row 140): Aaj on a seeded learner's
 * day, one placeholder screen, the ⋯ menu open, and on a phone the "Aur"
 * sheet; since K2-4 the DSA sheet (the first learner's plan track), a
 * lesson with its quiz (the second learner's), Abhyas (the problems) and the
 * problem of the day, whose calendar is moved onto one fixed day; since K2-2 also Learn's sign-in (signed out), onboarding's first
 * question and Mera plan; since K2-3 revision (a card's front), Meri lists and
 * Notes, on a second learner seeded with them; since K2-5 a code problem's workspace (the second
 * learner's site), at rest and, last of all, after a wrong submission (its time and memory set to one text, then masked);
 * at 1440 and 390, dark (Learn's default) and light,
 * and the narrow side bar at 1100. Signed in as the seeded learner, except on
 * the sign-in page (the side bar shows their name). What the date changes is in `.ln-dated`: set to one date,
 * then masked. The page's clock is held at 7 pm in India today, so the
 * greeting is the evening's. The theme is Learn's own
 * (`parikshaa.learn.theme`, set before the page loads), not the browser's.
 */

const SITE = "visual-learn";
// Revision, lists and notes (K2-3) on a learner of their own: two cards due, a list, three notes.
const MINE = "visual-learn-mine";
let token = "";
let mineToken = "";
// The searching lesson: the second of the plan's track, with a quiz on the learner seeded with `mine`.
let lesson = "";
// The code problem on the second learner's site (K2-5).
let code = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  ({ token } = await seedLearnDay(request, { org: "e2e-learn-visual", site: SITE, learner: { name: "Asha Verma", email: "asha@students.learn-visual.test" } }));
  const mine = await seedLearnDay(request, { org: "e2e-learn-visual-mine", site: MINE, learner: { name: "Asha Verma", email: "asha@students.learn-mine-visual.test" }, mine: true, code: true });
  mineToken = mine.token;
  lesson = mine.lessons[1]!.slug;
  code = mine.code!.slug;
});

const DATED = ".ln-dated";
// The problem of the day's calendar is drawn on one fixed day, so its month does not change the image (K2-4).
const POTD_DAY = "2026-10-29";
const shiftDay = (day: string, by: number) => new Date(Date.parse(`${day}T00:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);

/** The API's real calendar (the last 30 days, seeded relative to today), every date moved by the same days onto POTD_DAY. */
async function onFixedDay(page: Page, site: string) {
  await page.route(`**/api/practice/${site}/potd**`, async (route) => {
    const real = new URL(route.request().url());
    real.searchParams.delete("month");
    const response = await route.fetch({ url: real.toString() });
    const body = (await response.json()) as { today: { day: string } | null; calendar: { day: string }[]; date: string; daysOff: string[] };
    const by = Math.round((Date.parse(`${POTD_DAY}T00:00:00Z`) - Date.parse(`${body.date}T00:00:00Z`)) / 86_400_000);
    const moved = {
      today: body.today === null ? null : { ...body.today, day: shiftDay(body.today.day, by) },
      calendar: body.calendar.map((d) => ({ ...d, day: shiftDay(d.day, by) })),
      date: POTD_DAY,
      daysOff: body.daysOff.map((d) => shiftDay(d, by)),
    };
    await route.fulfill({ response, json: moved });
  });
}
const masks = (page: Page) => [page.locator(DATED)];

async function open(page: Page, path: string, theme: "light" | "dark", signedIn = true, site = SITE) {
  await page.clock.setFixedTime(new Date(`${path === "/potd" ? POTD_DAY : istDay()}T13:30:00Z`));
  if (path === "/potd") await onFixedDay(page, site);
  await page.addInitScript(([key, value, t]) => {
    if (value !== "") localStorage.setItem(key!, value!);
    localStorage.setItem("parikshaa.learn.theme", t!);
  }, [`parikshaa.practice.${site}.session`, signedIn ? (site === MINE ? mineToken : token) : "", theme]);
  await page.goto(`/practice/${site}${path}?learn_v2=1`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  if (path === "/revision") await expect(page.getByRole("article", { name: "Card 1 / 2" })).toBeVisible();
  if (path === "/lists") await expect(page.getByRole("region", { name: "Bookmarks" })).toContainText("Binary search");
  if (path === "/notes") await expect(page.getByRole("article", { name: "Binary search" }).locator("pre")).toBeVisible();
  if (path === "") {
    // The day, the verdict on the task at hand, and the rail's reads, all in.
    await expect(page.getByText("Galat jawab")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Infosys ki taiyari" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Aage" })).toContainText("Weekly Round 13");
  }
  if (path === "/practice") await expect(page.getByRole("status")).toHaveText("3 me se 3 problems");
  if (path === "/potd") {
    await expect(page.getByRole("table").locator('[aria-current="date"]')).toBeVisible();
    await expect(page.getByText("Abhi ki streak")).toBeVisible();
  }
  if (path === "/sheet") await expect(page.getByRole("region", { name: "Agla kaam" })).toBeVisible();
  if (path.startsWith("/lessons/")) {
    await expect(page.getByText("Module 2 · 2 me se 1").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Mera note" }).getByText("Is lesson par abhi note nahi", { exact: false })).toBeVisible();
  }
  if (path === "/plan") await expect(page.getByRole("region", { name: "Target companies" })).toContainText("Infosys");
  if (path === "/onboarding") await expect(page.getByRole("button", { name: /^DSA for placements/ })).toBeVisible();
  if (path.startsWith("/problems/")) {
    // The editor's own chunk, and the hint (in the problem pane, a hidden tab on a phone).
    await expect(page.locator(".cm-content")).toContainText("n = int(input())");
    await expect(page.locator(".lw-hint-next")).toHaveCount(1);
  }
  await page.waitForLoadState("networkidle");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset["theme"])).toBe(theme);
  await page.evaluate((selector) => {
    for (const el of document.querySelectorAll(selector)) el.textContent = "1 Oct 2026";
  }, DATED);
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Aur vikalp" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.mouse.move(0, 0);
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`learn · 1440 · ${theme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: theme });

    test("aaj", async ({ page }) => {
      await open(page, "", theme);
      await expect(page).toHaveScreenshot(`learn-aaj-1440-${theme}.png`, { fullPage: true, mask: masks(page) });
    });

    test("a placeholder screen", async ({ page }) => {
      await open(page, "/courses", theme);
      await expect(page).toHaveScreenshot(`learn-courses-1440-${theme}.png`, { fullPage: true });
    });

    test("the ⋯ menu", async ({ page }) => {
      await open(page, "", theme);
      await openMenu(page);
      await expect(page).toHaveScreenshot(`learn-menu-1440-${theme}.png`, { mask: masks(page) });
    });

    for (const [name, path, signedIn] of [
      ["signin", "/signin", false],
      ["onboarding", "/onboarding", true],
      ["plan", "/plan", true],
    ] as const) {
      test(`${name} (K2-2)`, async ({ page }) => {
        await open(page, path, theme, signedIn);
        await expect(page).toHaveScreenshot(`learn-${name}-1440-${theme}.png`, { fullPage: true, mask: masks(page) });
      });
    }

    for (const name of ["revision", "lists", "notes"] as const) {
      test(`${name} (K2-3)`, async ({ page }) => {
        await open(page, `/${name}`, theme, true, MINE);
        await expect(page).toHaveScreenshot(`learn-${name}-1440-${theme}.png`, { fullPage: true, mask: masks(page) });
      });
    }

    test("DSA sheet (K2-4)", async ({ page }) => {
      await open(page, "/sheet", theme);
      await expect(page).toHaveScreenshot(`learn-dsa-sheet-1440-${theme}.png`, { fullPage: true, mask: masks(page) });
    });

    test("lesson (K2-4)", async ({ page }) => {
      await open(page, `/lessons/${lesson}`, theme, true, MINE);
      await expect(page).toHaveScreenshot(`learn-lesson-1440-${theme}.png`, { fullPage: true, mask: masks(page) });
    });

    for (const [name, path] of [
      ["problems", "/practice"],
      ["potd", "/potd"],
    ] as const) {
      test(`${name} (K2-4)`, async ({ page }) => {
        await open(page, path, theme);
        await expect(page).toHaveScreenshot(`learn-${name}-1440-${theme}.png`, { fullPage: true, mask: masks(page) });
      });
    }

    test("problem workspace (K2-5)", async ({ page }) => {
      await open(page, `/problems/${code}`, theme, true, MINE);
      await expect(page).toHaveScreenshot(`learn-workspace-1440-${theme}.png`, { mask: masks(page) });
    });
  });

  test.describe(`learn · 390 · ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, colorScheme: theme });

    test("aaj", async ({ page }) => {
      await open(page, "", theme);
      await expect(page).toHaveScreenshot(`learn-aaj-390-${theme}.png`, { fullPage: true, mask: masks(page) });
    });

    test("a placeholder screen", async ({ page }) => {
      await open(page, "/courses", theme);
      await expect(page).toHaveScreenshot(`learn-courses-390-${theme}.png`);
    });

    test("the Aur sheet", async ({ page }) => {
      await open(page, "", theme);
      await page.getByRole("navigation", { name: "Mukhya tabs" }).getByRole("button", { name: "Aur" }).click();
      await expect(page.getByRole("dialog", { name: "Aur" })).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`learn-sheet-390-${theme}.png`, { mask: masks(page) });
    });

    test("the ⋯ menu", async ({ page }) => {
      await open(page, "", theme);
      await openMenu(page);
      await expect(page).toHaveScreenshot(`learn-menu-390-${theme}.png`, { mask: masks(page) });
    });

    for (const [name, path, signedIn] of [
      ["signin", "/signin", false],
      ["onboarding", "/onboarding", true],
      ["plan", "/plan", true],
    ] as const) {
      test(`${name} (K2-2)`, async ({ page }) => {
        await open(page, path, theme, signedIn);
        await expect(page).toHaveScreenshot(`learn-${name}-390-${theme}.png`, { fullPage: true, mask: masks(page) });
      });
    }

    for (const name of ["revision", "lists", "notes"] as const) {
      test(`${name} (K2-3)`, async ({ page }) => {
        await open(page, `/${name}`, theme, true, MINE);
        await expect(page).toHaveScreenshot(`learn-${name}-390-${theme}.png`, { fullPage: true, mask: masks(page) });
      });
    }

    test("DSA sheet (K2-4)", async ({ page }) => {
      await open(page, "/sheet", theme);
      await expect(page).toHaveScreenshot(`learn-dsa-sheet-390-${theme}.png`, { fullPage: true, mask: masks(page) });
    });

    test("lesson (K2-4)", async ({ page }) => {
      await open(page, `/lessons/${lesson}`, theme, true, MINE);
      await expect(page).toHaveScreenshot(`learn-lesson-390-${theme}.png`, { fullPage: true, mask: masks(page) });
    });

    for (const [name, path] of [
      ["problems", "/practice"],
      ["potd", "/potd"],
    ] as const) {
      test(`${name} (K2-4)`, async ({ page }) => {
        await open(page, path, theme);
        await expect(page).toHaveScreenshot(`learn-${name}-390-${theme}.png`, { fullPage: true, mask: masks(page) });
      });
    }

    test("problem workspace (K2-5)", async ({ page }) => {
      await open(page, `/problems/${code}`, theme, true, MINE);
      await expect(page).toHaveScreenshot(`learn-workspace-390-${theme}.png`, { mask: masks(page) });
    });
  });
}

test.describe("learn · 1100 · dark", () => {
  test.use({ viewport: { width: 1100, height: 800 }, colorScheme: "dark" });

  test("the narrow side bar", async ({ page }) => {
    await open(page, "/courses", "dark");
    await expect(page.getByRole("navigation", { name: "Learn menu" })).toHaveClass(/ln-mini/);
    await expect(page).toHaveScreenshot("learn-courses-1100-dark.png");
  });
});

// Last, as it records a submission: the judge's verdict on a wrong answer, its time masked (K2-5).
for (const theme of ["dark", "light"] as const) {
  test.describe(`learn · workspace verdict · ${theme}`, () => {
    test.use({ viewport: { width: 1440, height: 900 }, colorScheme: theme });

    test("a wrong answer (K2-5)", async ({ page }) => {
      await open(page, `/problems/${code}`, theme, true, MINE);
      await page.getByRole("textbox", { name: "Aapka code" }).fill("print(-1)");
      await page.getByRole("button", { name: "Submit", exact: true }).click();
      await expect(page.getByRole("region", { name: "Pehla fail test: test 1" })).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      // The judge's time and memory change run to run: one fixed text (so the mask is one size), then masked.
      await page.evaluate(() => {
        for (const el of document.querySelectorAll(".lw-time")) el.textContent = " · 10 ms · 9.9 MB";
      });
      await page.mouse.move(0, 0);
      await expect(page).toHaveScreenshot(`learn-workspace-wa-1440-${theme}.png`, { mask: [...masks(page), page.locator(".lw-time")] });
    });
  });
}
