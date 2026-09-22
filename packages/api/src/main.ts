import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";
import { IdentityStore, LedgerStore, postgresJsExecutor } from "@parikshaa/store";
import { AttemptTokens } from "./auth.js";
import { buildServer } from "./server.js";
import { ExamService } from "./service.js";
import { StaffAuth } from "./staff-auth.js";

/** Read a required environment variable, or fail at boot rather than at 10:00am. */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  // Connect as the runtime role (parikshaa_app in docker-compose), not the
  // schema owner: row-level security binds the runtime role, and the owner
  // would bypass it.
  const sql = postgres(required("DATABASE_URL"));
  const executor = postgresJsExecutor(sql);
  const store = new LedgerStore(executor);
  const identity = new IdentityStore(executor);

  const service = new ExamService({
    store,
    identity,
    // Resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login`
    // profile from the environment.
    client: new Anthropic(),
  });

  // Built client bundles, when they are present beside the server. In
  // development the Vite dev servers proxy to this process instead.
  const web = process.env["WEB_ROOT"] ?? fileURLToPath(new URL("../../web/dist", import.meta.url));
  const consoleRoot =
    process.env["CONSOLE_ROOT"] ?? fileURLToPath(new URL("../../console/dist", import.meta.url));
  const clients = existsSync(web) && existsSync(consoleRoot) ? { web, console: consoleRoot } : undefined;

  const app = buildServer({
    service,
    tokens: new AttemptTokens(required("ATTEMPT_TOKEN_SECRET")),
    auth: new StaffAuth(identity),
    identity,
    trustProxy: process.env["TRUST_PROXY"] === "true",
    ...(clients === undefined ? {} : { clients }),
  });

  const port = Number.parseInt(process.env["PORT"] ?? "3000", 10);
  await app.listen({ port, host: "0.0.0.0" });
  process.stdout.write(`parikshaa listening on :${port}\n`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void app.close().then(() => sql.end()).then(() => process.exit(0));
    });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
