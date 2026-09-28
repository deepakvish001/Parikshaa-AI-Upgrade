import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

/**
 * Lighthouse on a simulated slow phone (perf/*.perf.ts). Its own run, one
 * page at a time, since Lighthouse wants the machine to itself.
 *
 *   npm run build:clients && npm run build -w @parikshaa/e2e
 *   npm run perf -w @parikshaa/e2e
 */
export default defineConfig({
  ...base,
  testDir: "./perf",
  testMatch: /.*\.perf\.ts$/,
  timeout: 180_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  projects: [{ name: "lighthouse" }],
});
