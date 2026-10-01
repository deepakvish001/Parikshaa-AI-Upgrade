import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests against the real service on a real Postgres (ROADMAP §13).
 *
 * `npm run e2e -w @parikshaa/e2e` needs Postgres with the roles in
 * `src/database.ts` and the clients built (`npm run build:clients`). CI runs
 * Chrome, Firefox and Safari's engine; locally, pass `--project=chromium` if
 * only Chromium is installed.
 */
const port = Number.parseInt(process.env["E2E_PORT"] ?? "4173", 10);

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: process.env["CI"] !== undefined,
  retries: 0,
  workers: process.env["CI"] === undefined ? 4 : 2,
  reporter: process.env["CI"] === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // India, as candidates are: times on screen are IST whatever the machine says.
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node dist/server.js",
    url: `http://localhost:${port}/api/health`,
    // Code runs in-process (see E2E_RUNNER in src/server.ts), as for the screenshots: the
    // Prep flows run and submit code, and only this suite's own code ever runs.
    env: { PORT: String(port), E2E_RUNNER: "local" },
    reuseExistingServer: process.env["CI"] === undefined,
    timeout: 60_000,
    stdout: "pipe",
  },
});
