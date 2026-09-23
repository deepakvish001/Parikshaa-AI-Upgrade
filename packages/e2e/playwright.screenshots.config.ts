import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config.js";

/**
 * Screenshots of every page, for docs/screenshots — not a test suite.
 *
 *   npm run build:clients && npm run build -w @parikshaa/e2e
 *   npm run screenshots -w @parikshaa/e2e
 *
 * Each page is seeded with realistic data through the API, the way the e2e
 * tests are, and captured in Chromium at a laptop's size (and a phone's, for
 * the candidate). Chromium's fake camera stands in for a webcam.
 */
export default defineConfig({
  ...base,
  testDir: "./screenshots",
  testMatch: /.*\.shots\.ts$/,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...base.use,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
    permissions: ["camera"],
  },
  projects: [{ name: "screenshots" }],
});
