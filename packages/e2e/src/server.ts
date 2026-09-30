import { fileURLToPath } from "node:url";
import { assemble, hashPassword } from "@parikshaa/api";
import { FakeRazorpay, OutboxLog, fakeModel } from "@parikshaa/api/testing";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { connect } from "@parikshaa/store";
import { appUrl, DATA_KEY, resetDatabase, SECRET } from "./database.js";

/**
 * The service as production runs it — `assemble`, a real Postgres as the
 * runtime role, the built clients — with a scripted model in place of the real
 * one, so a browser run costs nothing and says the same thing every time.
 *
 *   PORT                   default 4173
 *   E2E_RESET=0            keep the database instead of starting from nothing
 *   E2E_MODEL_LATENCY_MS   how long the fake model takes, default 300
 *   DATABASE_POOL_MAX      default 20
 *   E2E_RUNNER=local       run code questions in-process with no isolation —
 *                          for this machine's own tests and screenshots only
 */
const port = Number.parseInt(process.env["PORT"] ?? "4173", 10);
if (process.env["E2E_RESET"] !== "0") await resetDatabase(hashPassword);

// Code runs the way the runner service runs it, minus the kernel boundary:
// never with anyone else's code.
const runner: CodeRunner | undefined =
  process.env["E2E_RUNNER"] === "local"
    ? (() => {
        const workRoot = join(tmpdir(), "parikshaa-e2e-runs");
        mkdirSync(workRoot, { recursive: true });
        return { run: (request) => execute(request, { workRoot, slot: null }) };
      })()
    : undefined;

const sql = connect(appUrl, { max: Number.parseInt(process.env["DATABASE_POOL_MAX"] ?? "20", 10) });
const { app } = assemble({
  sql,
  client: fakeModel({ latencyMs: Number.parseInt(process.env["E2E_MODEL_LATENCY_MS"] ?? "300", 10) }).client,
  secret: SECRET,
  dataKey: DATA_KEY,
  // Razorpay without Razorpay: the browser suite's Checkout signs with the fake's key secret.
  gateway: new FakeRazorpay(),
  ...(runner === undefined ? {} : { runner }),
  supplier: { legalName: "Parikshaa Assessments Pvt Ltd", gstin: "29AAGCP4401A1ZW", address: "12 Residency Road, Bengaluru", sac: "998399" },
  publicUrl: process.env["PUBLIC_URL"] ?? `http://localhost:${port}`,
  // Email and WhatsApp set up, as a pilot's are; nothing leaves the machine
  // (and no worker runs, so messages stay queued, as the Candidates tab shows).
  mailer: new OutboxLog(),
  whatsapp: new OutboxLog(),
  // A stand-in Lever on this machine, for the screenshots: only then may outbound calls reach localhost.
  ...(process.env["E2E_LEVER_URL"] === undefined ? {} : { atsBases: { lever: process.env["E2E_LEVER_URL"] }, http: { allowPrivate: true, timeoutMs: 5_000 } }),
  // Institutions may sign themselves up, as a pilot deployment lets them.
  signup: { trialCredits: 25, pricePaise: 4_900 },
  server: {
    // Every browser's tests sign up from this one address.
    signupLimit: { perSecond: 1, burst: 100 },
    // Firefox under Playwright now and then never finishes a new tab's first
    // navigation to a page sending Cross-Origin-Opener-Policy — each time a
    // different test, always that first goto, never in Chromium or WebKit.
    // The API's own tests hold the header to production.
    openerPolicy: false,
    clients: {
      web: fileURLToPath(new URL("../../web/dist", import.meta.url)),
      console: fileURLToPath(new URL("../../console/dist", import.meta.url)),
    },
    ...(process.env["LOG_LEVEL"] === undefined ? {} : { log: { level: process.env["LOG_LEVEL"] } }),
    ...(process.env["RATE_LIMITS"] === "off" ? { rateLimits: false as const } : {}),
  },
});
// Firefox keeps an idle connection for 115 seconds, and hands one left by an
// earlier test to the next; a server that hangs up first (Fastify's 72)
// can do it just as a page's request arrives, which then never answers.
app.server.keepAliveTimeout = 120_000;
await app.listen({ port, host: "127.0.0.1" });
process.stdout.write(`e2e server on http://localhost:${port}\n`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close().then(() => sql.end()).then(() => process.exit(0)));
}
