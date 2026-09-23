import { fileURLToPath } from "node:url";
import { assemble, hashPassword } from "@parikshaa/api";
import { fakeModel } from "@parikshaa/api/testing";
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
 */
const port = Number.parseInt(process.env["PORT"] ?? "4173", 10);
if (process.env["E2E_RESET"] !== "0") await resetDatabase(hashPassword);

const sql = connect(appUrl, { max: Number.parseInt(process.env["DATABASE_POOL_MAX"] ?? "20", 10) });
const { app } = assemble({
  sql,
  client: fakeModel({ latencyMs: Number.parseInt(process.env["E2E_MODEL_LATENCY_MS"] ?? "300", 10) }).client,
  secret: SECRET,
  dataKey: DATA_KEY,
  publicUrl: process.env["PUBLIC_URL"] ?? `http://localhost:${port}`,
  server: {
    clients: {
      web: fileURLToPath(new URL("../../web/dist", import.meta.url)),
      console: fileURLToPath(new URL("../../console/dist", import.meta.url)),
    },
    ...(process.env["LOG_LEVEL"] === undefined ? {} : { log: { level: process.env["LOG_LEVEL"] } }),
    ...(process.env["RATE_LIMITS"] === "off" ? { rateLimits: false as const } : {}),
  },
});
await app.listen({ port, host: "127.0.0.1" });
process.stdout.write(`e2e server on http://localhost:${port}\n`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void app.close().then(() => sql.end()).then(() => process.exit(0)));
}
