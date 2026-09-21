import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";
import { LedgerStore, postgresJsExecutor } from "@parikshaa/store";
import { AttemptTokens } from "./auth.js";
import { buildServer } from "./server.js";
import { ExamService } from "./service.js";

/** Read a required environment variable, or fail at boot rather than at 10:00am. */
function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const sql = postgres(required("DATABASE_URL"));
  const store = new LedgerStore(postgresJsExecutor(sql));

  const service = new ExamService({
    store,
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
    staffToken: required("STAFF_TOKEN"),
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
