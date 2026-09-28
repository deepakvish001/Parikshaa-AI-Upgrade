import { expect, test, type Page } from "@playwright/test";
import { beginSitting, local, MCQ, PRIVATE_OWNER, seedSitting, setPrivacyNotice, SHORT } from "../tests/support.js";

/**
 * Every page a candidate meets, from the access code to the receipt, held to
 * its committed image on a laptop (1440) and a phone (390), in light and
 * dark, in English, Hindi and Tamil — the redesign plan's bar for the
 * candidate's side (Phase B, C16). What changes from run to run is masked:
 * the clocks, the dates, the hashes, the measured connection.
 */

const SIZES = [
  ["1440", { width: 1440, height: 900 }],
  ["390", { width: 390, height: 844 }],
] as const;
const THEMES = ["light", "dark"] as const;
const LANGUAGES = ["en", "hi", "ta"] as const;

const TITLE = "Visual check — Algorithms";
const NAMES = ["Ananya Iyer"];

/** Fonts in — every script's — and nothing moving. */
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(150);
}

for (const [size, viewport] of SIZES) {
  for (const colorScheme of THEMES) {
    for (const language of LANGUAGES) {
      const name = (page: string) => `candidate-${page}-${size}-${colorScheme}-${language}.png`;

      test.describe(`${size} · ${colorScheme} · ${language}`, () => {
        test.use({ viewport, colorScheme });
        test.beforeEach(async ({ page }) => {
          await page.addInitScript((lang) => {
            localStorage.setItem("parikshaa.language", lang);
            // Said once on a touch screen; not part of any page's look.
            localStorage.setItem("parikshaa.swipeHint", "1");
          }, language);
        });

        test("before the clock: the access code, the notice, not open yet, the instructions", async ({ page, request }) => {
          await page.goto("/");
          await expect(page.locator("#access-code")).toBeVisible();
          await settle(page);
          await expect(page).toHaveScreenshot(name("access"));

          const notice = await seedSitting(request, { owner: PRIVATE_OWNER, questions: [MCQ], title: TITLE, names: NAMES });
          await setPrivacyNotice(request, notice.token);
          await page.goto(local(notice.links["CS001"]!));
          await expect(page.locator(".notice-card")).toBeVisible();
          await settle(page);
          await expect(page).toHaveScreenshot(name("notice"));

          const early = await seedSitting(request, { questions: [MCQ], title: TITLE, names: NAMES, opensAt: new Date(Date.now() + 5 * 3_600_000) });
          await page.goto(local(early.links["CS001"]!));
          await expect(page.locator(".early")).toBeVisible();
          // The date's length changes with the day; its masked box should not.
          await page.locator(".when").evaluate((el) => {
            el.style.width = "min(24rem, 100%)";
            el.style.whiteSpace = "nowrap";
            el.style.overflow = "hidden";
          });
          await settle(page);
          await expect(page).toHaveScreenshot(name("not-open-yet"), { mask: [page.locator(".when"), page.locator(".early-count")] });

          const sitting = await seedSitting(request, { questions: [MCQ, SHORT], title: TITLE, names: NAMES, vivaTriggerRatio: 0.99 });
          await page.goto(local(sitting.links["CS001"]!));
          await expect(page.locator(".declare")).toBeVisible();
          await expect(page.locator(".check.checking")).toHaveCount(0);
          await settle(page);
          await expect(page).toHaveScreenshot(name("instructions"), { mask: [page.locator(".check-detail")] });
        });

        test("the test: a question, the submit summary, and the record", async ({ page, request }) => {
          const sitting = await seedSitting(request, { questions: [MCQ, SHORT], title: TITLE, names: NAMES, vivaTriggerRatio: 0.99 });
          await beginSitting(page, sitting.links["CS001"]!);
          await expect(page.locator("section.qview")).toBeVisible();
          await settle(page);
          await expect(page).toHaveScreenshot(name("exam"), { mask: [page.getByRole("timer")] });

          await page.locator("section.qview label.option").nth(1).click();
          await page.locator(".qfoot .save-next").click();
          await expect(page.locator(".save-status.saved")).toBeVisible();
          await page.locator(".exambar-action").click();
          await expect(page.locator(".submit-dialog")).toBeVisible();
          await settle(page);
          await expect(page).toHaveScreenshot(name("submit"), { mask: [page.getByRole("timer")] });

          await page.locator(".submit-confirm").click();
          await expect(page.locator(".receipt")).toBeVisible();
          await settle(page);
          await expect(page).toHaveScreenshot(name("receipt"), {
            fullPage: true,
            mask: [page.locator(".receipt .hash"), page.locator(".finished-lead strong")],
          });
        });
      });
    }
  }
}
