import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import type { CodeRunner } from "@parikshaa/runner";
import { BillingStore, DataKeys, IdentityStore, ProctorStore, InvigilationStore, InvitationStore, LedgerStore, OutboxStore, PracticeStore, PrepCommunityStore, PrepPlusStore, PrepStore, PrivacyStore, QuestionBank, QuestionMedia, ReportStore, type SqlExecutor } from "@parikshaa/store";
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
import { PrepService } from "./prep.js";
import { PrepPlus } from "./prep-plus.js";
import { PrepCommunity } from "./prep-community.js";
import { StarterPacks } from "./starter-packs.js";
import { Sahayak } from "./sahayak.js";
import { PracticeIdentity } from "./practice-identity.js";
import { buildServer, type ServerOptions } from "./server.js";
import { ExamService } from "./service.js";
import { StaffAuth } from "./staff-auth.js";
import { StaffSecrets } from "./staff-secrets.js";
import { StaffSecurity } from "./staff-security.js";
import { Onboarding, type SignupPolicy } from "./onboarding.js";
import { DailyPilotReport } from "./pilot-report.js";

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
  /** The practice tutor's model; Claude Opus 5.5 unless set. */
  readonly tutorModel?: string;
  /** Who Parikshaa's tax invoices are issued by. */
  readonly supplier?: Supplier | null;
  readonly mailer?: Mailer | null;
  readonly sms?: SmsSender | null;
  /** Institutions may sign themselves up, on these terms. Absent: only the admin CLI makes organisations. */
  readonly signup?: SignupPolicy | null;
  /** The operator's address for the pilot report each morning. Absent: no report is sent. */
  readonly pilotReportTo?: string | null;
  readonly server?: Pick<ServerOptions, "clients" | "log" | "trustProxy" | "rateLimits" | "loginThrottle" | "attemptTtlSeconds" | "signupLimit" | "openerPolicy">;
}

export function assemble(o: AssembleOptions): {
  app: FastifyInstance;
  worker: DeliveryWorker;
  privacy: PrivacyService;
  billing: BillingService;
  identity: IdentityStore;
  /** Null unless {@link AssembleOptions.pilotReportTo} is given. */
  dailyReport: DailyPilotReport | null;
} {
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
  const billingStore = new BillingStore(o.sql);
  billing = new BillingService({
    store,
    billing: billingStore,
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
  const onboarding = new Onboarding({
    identity,
    auth,
    billing: billingStore,
    bank,
    exams: service,
    signup: o.signup ?? null,
    secrets,
    mailer: o.mailer ?? null,
    publicUrl: o.publicUrl,
  });
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
  const prepStore = new PrepStore(o.sql);
  const prepPlus = new PrepPlus({ store: new PrepPlusStore(o.sql), practice: practiceStore, gateway: o.gateway ?? null });
  const prepService = new PrepService({ practice: practiceStore, store: prepStore, plus: prepPlus });
  const results = new ResultsService({ store, invitations: invitationStore, exams: service, proctor: proctorStore, identity, mailer: o.mailer ?? null });
  const app = buildServer({
    service,
    invitations,
    results,
    webhooks: integrations.webhooks,
    greenhouse: integrations.greenhouse,
    ats: integrations.ats,
    lti: integrations.lti,
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
    onboarding,
    hsts: o.publicUrl.startsWith("https://"),
    identity,
    bank,
    media: new QuestionMedia(o.sql),
    practice,
    practiceIdentity,
    prep: prepService,
    starterPacks: new StarterPacks({ practice: practiceStore, prep: prepStore, service: prepService }),
    prepCommunity: new PrepCommunity({ practice: practiceStore, prep: prepStore, store: new PrepCommunityStore(o.sql), plus: prepPlus }),
    prepPlus: { plus: prepPlus, tutor: new Sahayak({ client: o.client, ...(o.tutorModel === undefined ? {} : { model: o.tutorModel }), practice: practiceStore, prep: prepStore, plus: prepPlus }) },
    ...o.server,
  });

  const dailyReport =
    o.pilotReportTo === undefined || o.pilotReportTo === null
      ? null
      : new DailyPilotReport({ identity, reports: new ReportStore(o.sql), mailer: o.mailer ?? null, to: o.pilotReportTo });

  const worker = new DeliveryWorker({
    outbox: new OutboxStore(o.sql),
    invitations: invitationStore,
    store,
    identity,
    link: (orgId, invitationId) => invitations.link(orgId, invitationId),
    mailer: o.mailer ?? null,
    sms: o.sms ?? null,
    handlers: { ...integrations.handlers, staff_email: (item) =>
      item.purpose === "password_reset"
        ? security.resetMail(item)
        : item.purpose === "results_file"
          ? results.mail(item)
          : item.purpose === "pilot_report"
            ? (dailyReport?.mail(item) ?? Promise.resolve({ skip: "No pilot report address" }))
            : onboarding.mail(item),
      learner_email: practiceIdentity.verificationMail },
  });

  return { app, worker, privacy, billing, identity, dailyReport };
}
