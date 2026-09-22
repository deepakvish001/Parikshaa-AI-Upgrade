import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";
import { HttpCodeRunner } from "@parikshaa/runner";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, QuestionBank, postgresJsExecutor } from "@parikshaa/store";
import { DeliveryWorker, Msg91Sender, SmtpMailer } from "./delivery.js";
import { AttemptTokens } from "./auth.js";
import { InviteCodes } from "./invite-codes.js";
import { InvitationService } from "./invitation-service.js";
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

  // Code questions need the runner service; without it they can be answered
  // but not run, and grading them waits until it is configured.
  const runnerUrl = process.env["RUNNER_URL"];
  const runner =
    runnerUrl === undefined || runnerUrl === "" ? undefined : new HttpCodeRunner(runnerUrl, required("RUNNER_TOKEN"));

  const service = new ExamService({
    store,
    identity,
    ...(runner === undefined ? {} : { runner }),
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

  const tokenSecret = required("ATTEMPT_TOKEN_SECRET");
  const tokens = new AttemptTokens(tokenSecret);
  const invitationStore = new InvitationStore(executor);
  const invitations = new InvitationService({
    exams: service,
    store,
    invitations: invitationStore,
    codes: new InviteCodes(tokenSecret),
    tokens,
    // Where candidates open their links. Required: a link to the wrong host
    // reaches nobody, and one to localhost reaches everybody's own machine.
    publicUrl: required("PUBLIC_URL"),
  });

  const app = buildServer({
    service,
    invitations,
    tokens,
    auth: new StaffAuth(identity),
    identity,
    bank: new QuestionBank(executor),
    trustProxy: process.env["TRUST_PROXY"] === "true",
    ...(clients === undefined ? {} : { clients }),
  });

  // Delivery: email over SMTP and SMS through MSG91, each optional. Without
  // one, messages for that channel are recorded as skipped, with the reason,
  // and links can still be exported and handed out.
  const smtpUrl = process.env["SMTP_URL"];
  const msg91Key = process.env["MSG91_AUTH_KEY"];
  const worker = new DeliveryWorker({
    outbox: new OutboxStore(executor),
    invitations: invitationStore,
    store,
    identity,
    link: (orgId, invitationId) => invitations.link(orgId, invitationId),
    mailer: smtpUrl === undefined || smtpUrl === "" ? null : new SmtpMailer(smtpUrl, required("EMAIL_FROM")),
    sms: msg91Key === undefined || msg91Key === "" ? null : new Msg91Sender(msg91Key, required("MSG91_TEMPLATE_ID")),
  });
  // Every instance runs a worker; the outbox's SKIP LOCKED claims keep them
  // from sending anything twice. Set DELIVERY_WORKER=off to run API-only nodes.
  let delivering: ReturnType<typeof setInterval> | undefined;
  if (process.env["DELIVERY_WORKER"] !== "off") {
    let busy = false;
    delivering = setInterval(() => {
      if (busy) return;
      busy = true;
      worker
        .tick()
        .catch((error: unknown) => process.stderr.write(`delivery: ${error instanceof Error ? error.message : String(error)}\n`))
        .finally(() => (busy = false));
    }, 5_000);
  }

  const port = Number.parseInt(process.env["PORT"] ?? "3000", 10);
  await app.listen({ port, host: "0.0.0.0" });
  process.stdout.write(`parikshaa listening on :${port}\n`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      clearInterval(delivering);
      void app.close().then(() => sql.end()).then(() => process.exit(0));
    });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
