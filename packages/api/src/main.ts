import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { HttpCodeRunner } from "@parikshaa/runner";
import { connect } from "@parikshaa/store";
import { assemble } from "./assemble.js";
import { Msg91Sender, SmtpMailer } from "./delivery.js";
import { supplierFromEnv } from "./gst.js";
import { RazorpayGateway } from "./razorpay.js";

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
  // would bypass it. One pool per instance: size it so instances ×
  // DATABASE_POOL_MAX stays under the server's max_connections, with room for
  // migrations and a psql session.
  // A connection the database drops is replaced on the next query; it is
  // logged, by type only, and never takes the process down.
  let connectionLost: (error: Error) => void = () => undefined;
  const sql = connect(required("DATABASE_URL"), {
    max: Number.parseInt(process.env["DATABASE_POOL_MAX"] ?? "20", 10),
    idleTimeoutMs: 60_000,
    connectTimeoutMs: 10_000,
    onError: (error) => connectionLost(error),
  });

  // Code questions need the runner service; without it they can be answered
  // but not run, and grading them waits until it is configured.
  const runnerUrl = process.env["RUNNER_URL"];
  const runner =
    runnerUrl === undefined || runnerUrl === "" ? undefined : new HttpCodeRunner(runnerUrl, required("RUNNER_TOKEN"));

  // Built client bundles, when they are present beside the server. In
  // development the Vite dev servers proxy to this process instead.
  const web = process.env["WEB_ROOT"] ?? fileURLToPath(new URL("../../web/dist", import.meta.url));
  const consoleRoot =
    process.env["CONSOLE_ROOT"] ?? fileURLToPath(new URL("../../console/dist", import.meta.url));
  const clients = existsSync(web) && existsSync(consoleRoot) ? { web, console: consoleRoot } : undefined;

  // Delivery: email over SMTP and SMS through MSG91, each optional. Without
  // one, messages for that channel are recorded as skipped, with the reason,
  // and links can still be exported and handed out.
  const smtpUrl = process.env["SMTP_URL"];
  const msg91Key = process.env["MSG91_AUTH_KEY"];

  // Billing (ROADMAP §12): Razorpay to sell prepaid credits, and the supplier
  // Parikshaa's tax invoices are issued by. Both optional: without them,
  // credits can be granted (billing-cli) but not bought.
  const razorpayKey = process.env["RAZORPAY_KEY_ID"];
  const gateway =
    razorpayKey === undefined || razorpayKey === ""
      ? null
      : new RazorpayGateway({
          keyId: razorpayKey,
          keySecret: required("RAZORPAY_KEY_SECRET"),
          webhookSecret: required("RAZORPAY_WEBHOOK_SECRET"),
        });

  // Institutions signing themselves up (pilot readiness): off unless asked
  // for. Every organisation made this way starts prepaid, with a few trial
  // credits, at the price per attempt given here.
  const signup =
    process.env["SELF_SIGNUP"] === "on"
      ? {
          pricePaise: Math.round(Number(required("SIGNUP_PRICE_RUPEES")) * 100),
          trialCredits: Number.parseInt(process.env["SIGNUP_TRIAL_CREDITS"] ?? "25", 10),
        }
      : null;
  if (signup !== null && !(signup.pricePaise > 0 && Number.isInteger(signup.trialCredits) && signup.trialCredits >= 0)) {
    throw new Error("SIGNUP_PRICE_RUPEES must be a positive amount and SIGNUP_TRIAL_CREDITS a whole number");
  }

  const { app, worker, privacy, billing, identity } = assemble({
    signup,
    sql,
    ...(runner === undefined ? {} : { runner }),
    // Resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login`
    // profile from the environment.
    client: new Anthropic(),
    // Attempt tokens, invitation codes, webhook secrets and Greenhouse keys all
    // derive from this, so rotating it rotates every one of them.
    secret: required("ATTEMPT_TOKEN_SECRET"),
    // Where candidates open their links. Required: a link to the wrong host
    // reaches nobody, and one to localhost reaches everybody's own machine.
    publicUrl: required("PUBLIC_URL"),
    // Wraps every attempt's data key (ROADMAP §11). Keep it outside the
    // database and its backups, and never lose it: `openssl rand -base64 32`.
    dataKey: required("PARIKSHAA_DATA_KEY"),
    gateway,
    // The practice tutor's model (ROADMAP §16); Claude Opus 5.5 when unset.
    ...(process.env["TUTOR_MODEL"] === undefined || process.env["TUTOR_MODEL"] === "" ? {} : { tutorModel: process.env["TUTOR_MODEL"] }),
    supplier: supplierFromEnv(process.env),
    mailer: smtpUrl === undefined || smtpUrl === "" ? null : new SmtpMailer(smtpUrl, required("EMAIL_FROM")),
    sms: msg91Key === undefined || msg91Key === "" ? null : new Msg91Sender(msg91Key, required("MSG91_TEMPLATE_ID")),
    server: {
      trustProxy: process.env["TRUST_PROXY"] === "true",
      // JSON lines on stdout, one per request; LOG_LEVEL=silent turns them off.
      log: { level: process.env["LOG_LEVEL"] ?? "info" },
      ...(clients === undefined ? {} : { clients }),
    },
  });

  connectionLost = (error) =>
    app.log.warn({ err: { type: error.name, code: (error as { code?: unknown }).code } }, "database connection lost");

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
        // By type only: a failed claim's message can quote a row.
        .catch((error: unknown) => app.log.error({ err: { type: error instanceof Error ? error.name : typeof error } }, "delivery tick failed"))
        .finally(() => (busy = false));
    }, 5_000);
  }

  // Retention (ROADMAP §11): hourly, erase closed attempts past their
  // organisation's retention period. Idempotent across instances.
  let retaining: ReturnType<typeof setInterval> | undefined;
  if (process.env["RETENTION_WORKER"] !== "off") {
    const sweep = () =>
      privacy
        .sweep()
        .then((erased) => (erased > 0 ? app.log.info({ erased }, "retention sweep") : undefined))
        .catch((error: unknown) => app.log.error({ err: { type: error instanceof Error ? error.name : typeof error } }, "retention sweep failed"));
    retaining = setInterval(sweep, 60 * 60 * 1000);
    setTimeout(sweep, 60_000).unref();
  }

  // Invoicing (ROADMAP §12): early each month, last month's usage invoice to
  // every invoiced organisation. Checked every six hours; issuing is
  // idempotent, so several instances and restarts issue each invoice once.
  let invoicing: ReturnType<typeof setInterval> | undefined;
  if (process.env["INVOICE_WORKER"] !== "off") {
    const run = () =>
      identity
        .organisationIds()
        .then((orgs) => billing.invoiceLastMonth(orgs))
        .then((issued) => (issued > 0 ? app.log.info({ issued }, "monthly invoices") : undefined))
        .catch((error: unknown) => app.log.error({ err: { type: error instanceof Error ? error.name : typeof error } }, "monthly invoicing failed"));
    invoicing = setInterval(run, 6 * 60 * 60 * 1000);
    setTimeout(run, 120_000).unref();
  }

  const port = Number.parseInt(process.env["PORT"] ?? "3000", 10);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info({ port }, "listening");

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      clearInterval(delivering);
      clearInterval(retaining);
      clearInterval(invoicing);
      void app.close().then(() => sql.end()).then(() => process.exit(0));
    });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
