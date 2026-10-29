import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { runnerFromEnv } from "@parikshaa/runner";
import { connect } from "@parikshaa/store";
import { assemble } from "./assemble.js";
import { CloudWhatsApp, Msg91Sender, SmtpMailer } from "./delivery.js";
import { bankFromEnv, supplierFromEnv } from "./gst.js";
import { webPushSender } from "./push.js";
import { androidAppFromEnv } from "./android-app.js";
import { RazorpayGateway } from "./razorpay.js";
import { storageFromEnv } from "./storage.js";

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

  // Code questions need a runner: the in-house one (RUNNER_URL), or Judge0
  // (RUNNER_BACKEND=judge0) with the in-house one behind it. Without either
  // they can be answered but not run, and grading them waits until one is set.
  // A fall back to the in-house runner is logged once the server is up.
  let fellBack: (error: Error) => void = () => undefined;
  const runner = runnerFromEnv(process.env, (error) => fellBack(error));
  // Practice's programs queue for it: so many at once (match the runner's
  // workers), contests first, and a learner told the judge is busy rather
  // than left waiting past JUDGE_WAIT_MS.
  const judgeNumber = (name: string) => (process.env[name] === undefined || process.env[name] === "" ? undefined : Number.parseInt(process.env[name]!, 10));
  const judge = {
    ...(judgeNumber("JUDGE_CONCURRENCY") === undefined ? {} : { concurrency: judgeNumber("JUDGE_CONCURRENCY")! }),
    ...(judgeNumber("JUDGE_QUEUE_MAX") === undefined ? {} : { maxWaiting: judgeNumber("JUDGE_QUEUE_MAX")! }),
    ...(judgeNumber("JUDGE_WAIT_MS") === undefined ? {} : { waitMs: judgeNumber("JUDGE_WAIT_MS")! }),
  };

  // Built client bundles, when they are present beside the server. In
  // development the Vite dev servers proxy to this process instead.
  const web = process.env["WEB_ROOT"] ?? fileURLToPath(new URL("../../web/dist", import.meta.url));
  const consoleRoot =
    process.env["CONSOLE_ROOT"] ?? fileURLToPath(new URL("../../console/dist", import.meta.url));
  const clients = existsSync(web) && existsSync(consoleRoot) ? { web, console: consoleRoot } : undefined;

  // Delivery: email over SMTP, SMS through MSG91 and WhatsApp, each optional. Without
  // one, messages for that channel are recorded as skipped, with the reason,
  // and links can still be exported and handed out.
  const smtpUrl = process.env["SMTP_URL"];
  const msg91Key = process.env["MSG91_AUTH_KEY"];
  // WhatsApp through the Cloud API, with Parikshaa's templates approved in the
  // WhatsApp Business account (docs/PILOT.md); optional in the same way.
  const whatsAppToken = process.env["WHATSAPP_TOKEN"];
  const whatsAppLanguage = process.env["WHATSAPP_LANGUAGE"] || undefined;
  const whatsAppUrl = process.env["WHATSAPP_API_URL"] || undefined;

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
          // docker-compose passes an unset variable as "": the default then, not NaN.
          trialCredits: Number.parseInt(process.env["SIGNUP_TRIAL_CREDITS"] || "25", 10),
          notify: process.env["SIGNUP_NOTIFY_EMAIL"] || null,
        }
      : null;
  // A new owner confirms their address before inviting anyone: without email
  // the link could never arrive.
  if (signup !== null && (smtpUrl === undefined || smtpUrl === "")) {
    throw new Error("SELF_SIGNUP=on needs SMTP_URL: a new owner confirms their email address before inviting anyone");
  }
  if (signup !== null && !(signup.pricePaise > 0 && Number.isInteger(signup.trialCredits) && signup.trialCredits >= 0)) {
    throw new Error("SIGNUP_PRICE_RUPEES must be a positive amount and SIGNUP_TRIAL_CREDITS a whole number");
  }

  // The pilot report each morning goes where new sign-ups are announced; PILOT_REPORT=off keeps it quiet.
  const pilotReportTo = process.env["PILOT_REPORT"] === "off" ? null : process.env["SIGNUP_NOTIFY_EMAIL"] || null;

  // Proctoring photos in Supabase Storage (docs/F1-GO-LIVE-PLAN.md §8.2):
  // SUPABASE_URL and SUPABASE_SECRET_KEY, and MEDIA_BUCKET ("proctor-media"
  // unless set). The bucket is made, private, if it is not there. Without
  // them, photos stay in Postgres as before.
  const blobs = storageFromEnv(process.env);
  if (blobs !== null) await blobs.ensureBucket();

  const { app, worker, privacy, billing, identity, dailyReport, prepEngage, sweepMedia, library, candidates } = assemble({
    blobs,
    // Parikshaa's own operators, by address: they see and open every organisation (docs/STAGING.md).
    operators: (process.env["PARIKSHAA_OPERATORS"] ?? "").split(","),
    // Parikshaa's grievance officer for Hire, named in every apply notice (S8).
    // Without both, job pages and applying answer 503: no notice, no applications.
    hireGrievance:
      (process.env["HIRE_GRIEVANCE_NAME"] ?? "") !== "" && (process.env["HIRE_GRIEVANCE_EMAIL"] ?? "") !== ""
        ? { name: process.env["HIRE_GRIEVANCE_NAME"]!, email: process.env["HIRE_GRIEVANCE_EMAIL"]! }
        : null,
    signup,
    pilotReportTo,
    sql,
    ...(runner === undefined ? {} : { runner }),
    judge,
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
    bank: bankFromEnv(process.env),
    mailer: smtpUrl === undefined || smtpUrl === "" ? null : new SmtpMailer(smtpUrl, required("EMAIL_FROM")),
    // Notifications for the learners' daily reminder (Prep §17). A key pair
    // made once with `npx web-push generate-vapid-keys`; keep the private half
    // secret. VAPID_SUBJECT is how a push service reaches you (mailto: or https:).
    push:
      (process.env["VAPID_PUBLIC_KEY"] ?? "") === ""
        ? null
        : webPushSender({ publicKey: required("VAPID_PUBLIC_KEY"), privateKey: required("VAPID_PRIVATE_KEY"), subject: required("VAPID_SUBJECT") }),
    sms: msg91Key === undefined || msg91Key === "" ? null : new Msg91Sender(msg91Key, required("MSG91_TEMPLATE_ID")),
    whatsapp:
      whatsAppToken === undefined || whatsAppToken === ""
        ? null
        : new CloudWhatsApp(whatsAppToken, required("WHATSAPP_PHONE_NUMBER_ID"), {
            ...(whatsAppLanguage === undefined ? {} : { language: whatsAppLanguage }),
            ...(whatsAppUrl === undefined ? {} : { baseUrl: whatsAppUrl }),
          }),
    // Lever's sandbox, for a pilot: https://api.sandbox.lever.co. Lever's own API otherwise.
    ...(process.env["LEVER_API_URL"] ? { atsBases: { lever: process.env["LEVER_API_URL"] } } : {}),
    server: {
      trustProxy: process.env["TRUST_PROXY"] === "true",
      // JSON lines on stdout, one per request; LOG_LEVEL=silent turns them off.
      log: { level: process.env["LOG_LEVEL"] ?? "info" },
      ...(clients === undefined ? {} : { clients }),
      androidApp: androidAppFromEnv(process.env),
    },
  });

  // The Parikshaa Library (G2): its built-in questions are filed at every
  // start, so a new database has them and an updated release versions them.
  // Several instances doing this at once is safe; LIBRARY_SEED=off skips it.
  if (process.env["LIBRARY_SEED"] !== "off") {
    const filed = await library.seedAtBoot();
    if (filed.added + filed.updated > 0) app.log.info(filed, "library questions filed");
  }

  connectionLost = (error) =>
    app.log.warn({ err: { type: error.name, code: (error as { code?: unknown }).code } }, "database connection lost");
  fellBack = (error) => app.log.warn({ err: { type: error.name, message: error.message } }, "Judge0 unavailable; running code on the in-house runner");

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
        .then(() => privacy.sweepTutor())
        .then((deleted) => (deleted > 0 ? app.log.info({ deleted }, "tutor chats past 180 days deleted") : undefined))
        .then(() => sweepMedia())
        .then((deleted) => (deleted > 0 ? app.log.info({ deleted }, "erased attempts' photos deleted from storage") : undefined))
        .then(() => candidates.sweep())
        .then((swept) => (swept.warned + swept.erased > 0 ? app.log.info({ warned: swept.warned, erased: swept.erased }, "unused candidate accounts") : undefined))
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

  // The pilot report (docs/PILOT.md), mailed to the operator after 8 am IST.
  // Checked every quarter hour; the day's item has a fixed id, so several
  // instances and restarts send it once.
  let reporting: ReturnType<typeof setInterval> | undefined;
  if (dailyReport !== null) {
    const check = () =>
      dailyReport
        .due()
        .catch((error: unknown) => app.log.error({ err: { type: error instanceof Error ? error.name : typeof error } }, "pilot report failed"));
    reporting = setInterval(check, 15 * 60 * 1000);
    setTimeout(check, 90_000).unref();
  }

  // Learners' daily reminders (Prep blueprint F2): checked every quarter hour
  // for the hour's; each learner is taken once a day, so several instances
  // and restarts send each reminder once.
  let reminding: ReturnType<typeof setInterval> | undefined;
  if (process.env["REMINDER_WORKER"] !== "off") {
    const remind = () =>
      identity
        .organisationIds()
        .then((orgs) => prepEngage.queueDue(orgs))
        .then((queued) => (queued > 0 ? app.log.info({ queued }, "learner reminders") : undefined))
        .catch((error: unknown) => app.log.error({ err: { type: error instanceof Error ? error.name : typeof error } }, "learner reminders failed"));
    reminding = setInterval(remind, 15 * 60 * 1000);
    setTimeout(remind, 150_000).unref();
  }

  const port = Number.parseInt(process.env["PORT"] ?? "3000", 10);
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info({ port }, "listening");

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      clearInterval(delivering);
      clearInterval(retaining);
      clearInterval(invoicing);
      clearInterval(reporting);
      clearInterval(reminding);
      void app.close().then(() => sql.end()).then(() => process.exit(0));
    });
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
