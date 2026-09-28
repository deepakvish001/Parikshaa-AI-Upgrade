import { mkdirSync } from "node:fs";
import type { Page } from "@playwright/test";

/** Where the pictures go: docs/screenshots, in the repository, unless SCREENSHOTS_OUT names a folder for a look first. */
export const OUT = process.env["SCREENSHOTS_OUT"] === undefined ? new URL("../../../docs/screenshots/", import.meta.url) : new URL(`file://${process.env["SCREENSHOTS_OUT"].replace(/\/?$/, "/")}`);
mkdirSync(OUT, { recursive: true });

/** Settle the page — fonts loaded, nothing animating, the caret hidden — and capture it. */
export async function shoot(page: Page, name: string, options: { fullPage?: boolean } = {}): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }" });
  await page.mouse.move(0, 0);
  // From the top, so sticky bars sit where they belong in a full-page capture.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: new URL(`${name}.png`, OUT).pathname, fullPage: options.fullPage ?? true });
}

/** Capture one part of the page, such as a card. */
export async function shootPart(locator: import("@playwright/test").Locator, name: string): Promise<void> {
  await locator.page().evaluate(() => document.fonts.ready);
  await locator.page().mouse.move(0, 0);
  await locator.screenshot({ path: new URL(`${name}.png`, OUT).pathname, animations: "disabled", caret: "hide" });
}
