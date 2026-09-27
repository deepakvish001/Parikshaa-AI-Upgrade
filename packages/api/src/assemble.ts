import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import type { CodeRunner } from "@parikshaa/runner";
import { BillingStore, DataKeys, IdentityStore, ProctorStore, InvigilationStore, InvitationStore, LedgerStore, OutboxStore, PracticeStore, PrivacyStore, QuestionBank, QuestionMedia, type SqlExecutor } from "@parikshaa/store";
import { AttemptTokens } from "./auth.js";
import { DeliveryWorker, type Mailer, type SmsSender } from "./delivery.js";
import { buildIntegrations } from "./integrations.js";
import { InvigilationService } from "./invigilation.js";
import { InviteCodes } from "./invite-codes.js";
import { InvitationService } from "./invitation-service.js";
import { PrivacyService } from "./privacy.js";
import { BillingService } from "./billing.js";
import { ProctorService } from "./proctoring.js";
import type { Supplier } from "./gst.js";
import type { PaymentGateway } from "./razorpay.js";
import { ResultsService } from "./results.js";
import { PracticeService } from "./practice.js";
import { PracticeIdentity } from "./practice-identity.js";
import { buildServer, type ServerOptions } from "./server.js";
import { ExamService } from "./service.js";
import { StaffAuth } from "./staff-auth.js";
import { StaffSecrets } from "./staff-secrets.js";
import { StaffSecurity } from "./staff-security.js";

/**
 * The whole service, wired: the server and the delivery worker over one
 * database. `main.ts` fills this in from the environment; the browser, chaos
 * and load harnesses fill it in with a scripted model, so what they exercise
 * is what production runs.
 */
export interface AssembleOptions {
  readonly sql: SqlExecutor;
  readonly client: Anthropic;
  readonly runner?: CodeRunner;
  /** The server's secret: attempt tokens, invitation codes and integration secrets derive from it. */
  readonly secret: string;
  /** Where candidates open their links. */
  readonly publicUrl: string;
  /**
   * The key-encryption key for attempts' data keys (`PARIKSHAA_DATA_KEY`): 32
   * bytes, base64. Candidates' answers and identities are sealed under keys it
   * wraps; lose it and no sealed ledger can be read again.
   */
  readonly dataKey: string;
  /** Razorpay, to sell prepaid credits. Without it credits are still spent; they can only be granted. */
  readonly gateway?: PaymentGateway | null;
  /** Who Parikshaa's tax invoices are issued by. */
  readonly supplier?: Supplier | null;
  readonly mailer?: Mailer | null;
  readonly sms?: SmsSender | null;
  readonly server?: Pick<ServerOptions, "clients" | "log" | "trustProxy" | "rateLimits" | "loginThrottle" | "attemptTtlSeconds">;
}

export function assemble(o: AssembleOptions): { app: FastifyInstance; worker: DeliveryWorker; privacy: PrivacyService; billing: BillingService } {
  const keys = new DataKeys(o.dataKey);
  const proctorStore = new ProctorStore(o.sql, keys);
  const store = new LedgerStore(o.sql, { keys });
  const identity = new IdentityStore(o.sql);
  // Metering needs the exam service for its audit, and the exam service meters: bound late.
  let billing: BillingService | undefined;
  const service = new ExamService({
    store,
    identity,
    client: o.client,
    ...(o.runner === undefined ? {} : { runner: o.runner }),
    meter: { consume: (org, attempt) => billing!.consume(org, attempt), refund: (org, attempt) => billing!.refund(org, attempt) },
  });
  billing = new BillingService({
    store,
    billing: new BillingStore(o.sql),
    identity,
    exams: service,
    gateway: o.gateway ?? null,
    supplier: o.supplier ?? null,
  });
  const tokens = new AttemptTokens(o.secret);
  const invitationStore = new InvitationStore(o.sql);
  const privacy = new PrivacyService({ store, privacy: new PrivacyStore(o.sql), invitations: invitationStore, identity, exams: service, proctor: proctorStore });
  const invitations = new InvitationService({
    notice: (orgId) => privacy.noticeFor(orgId),
    exams: service,
    store,
    invitations: invitationStore,
    codes: new InviteCodes(o.secret),
    tokens,
    publicUrl: o.publicUrl,
  });
  const integrations = buildIntegrations({
    sql: o.sql,
    store,
    invitationStore,
    invitations,
    exams: service,
    secret: o.secret,
    publicUrl: o.publicUrl,
  });

  const secrets = new StaffSecrets(o.secret);
  const auth = new StaffAuth(identity, { secrets });
  const security = new StaffSecurity({ identity, auth, secrets, publicUrl: o.publicUrl, mailer: o.mailer ?? null });

  const bank = new QuestionBank(o.sql);
  const practiceStore = new PracticeStore(o.sql);
  const practice = new PracticeService({ store: practiceStore, bank, ...(o.runner === undefined ? {} : { runner: o.runner }) });
  const practiceIdentity = new PracticeIdentity({
    store: practiceStore,
    practice,
    secrets,
    secret: o.secret,
    publicUrl: o.publicUrl,
    mailer: o.mailer ?? null,
  });
  const app = buildServer({
    service,
    invitations,
    results: new ResultsService({ store, invitations: invitationStore, exams: service, proctor: proctorStore }),
    webhooks: integrations.webhooks,
    greenhouse: integrations.greenhouse,
    invigilation: new InvigilationService({
      store,
      invitations: invitationStore,
      invigilation: new InvigilationStore(o.sql),
      exams: service,
      proctor: proctorStore,
    }),
    privacy,
    billing,
    proctor: new ProctorService({ store, proctor: proctorStore, exams: service }),
    tokens,
    auth,
    security,
    hsts: o.publicUrl.startsWith("https://"),
    identity,
    bank,
    media: new QuestionMedia(o.sql),
    practice,
    practiceIdentity,
    ...o.server,
  });

  const worker = new DeliveryWorker({
    outbox: new OutboxStore(o.sql),
    invitations: invitationStore,
    store,
    identity,
    link: (orgId, invitationId) => invitations.link(orgId, invitationId),
    mailer: o.mailer ?? null,
    sms: o.sms ?? null,
    handlers: { ...integrations.handlers, staff_email: security.resetMail, learner_email: practiceIdentity.verificationMail },
  });

  return { app, worker, privacy, billing };
}
