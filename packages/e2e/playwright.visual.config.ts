import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config.js";

/**
 * Visual regression (visual/*.visual.ts): screens whose content does not
 * change from run to run, compared pixel by pixel with the images committed
 * in visual/__screenshots__. A change to how anything looks fails here until
 * the images are updated on purpose:
 *
 *   npm run visual:update -w @parikshaa/e2e      # then review the diff and commit it
 *
 * Chromium only, at one size, with the fonts the app bundles itself, so the
 * same pixels come out on a laptop and on CI.
 */
export default defineConfig({
  ...base,
  testDir: "./visual",
  testMatch: /.*\.visual\.ts$/,
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env["CI"] === undefined ? "list" : [["list"], ["html", { open: "never", outputFolder: "visual-report" }]],
  expect: {
    ...base.expect,
    toHaveScreenshot: { maxDiffPixelRatio: 0.005, animations: "disabled", caret: "hide", scale: "css" },
  },
  use: {
    ...base.use,
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  },
  projects: [{ name: "visual" }],
});
