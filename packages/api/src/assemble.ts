import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import type { CodeRunner } from "@parikshaa/runner";
import { attemptId, examId, orgId, type OrgId } from "@parikshaa/core";
import { BillingStore, DataKeys, IdentityStore, ProctorStore, InvigilationStore, InvitationStore, LedgerStore, OutboxStore, PracticeStore, PrepCampusStore, PrepCommunityStore, PrepEngageStore, PrepPlusStore, PrepStore, PrivacyStore, QuestionBank, QuestionMedia, ReportStore, FeedbackStore, LabStore, RecheckStore, MarkingStore, PlacementStore, SeatStore, ShortlistStore, OutcomeStore, InterviewStore, ScriptStore, ProxyStore, ReviewStore, staffScope, type SqlExecutor } from "@parikshaa/store";
import { LabService } from "./lab.js";
import { RecheckService } from "./rechecks.js";
import { MarkingService } from "./marking.js";
import { PlacementService } from "./placement.js";
import { SeatService } from "./seats.js";
import { ShortlistService } from "./shortlists.js";
import { OutcomeService } from "./outcomes.js";
import { InterviewService } from "./interviews.js";
import { StudentMessages } from "./student-messages.js";
import { HandwritingService } from "./handwriting.js";
import { ProxyService } from "./proxy.js";
import { ExamReviewService } from "./exam-review.js";
import { AttemptTokens } from "./auth.js";
import { DeliveryWorker, type Mailer, type SmsSender, type WhatsAppSender } from "./delivery.js";
import { buildIntegrations } from "./integrations.js";
import type { AtsBaseUrls } from "./ats.js";
import type { SafeHttpOptions } from "./safe-http.js";
import { InvigilationService } from "./invigilation.js";
import { InviteCodes } from "./invite-codes.js";
import { InvitationService } from "./invitation-service.js";
import { PrivacyService } from "./privacy.js";
import { BillingService } from "./billing.js";
import { ProctorService } from "./proctoring.js";
import type { BankDetails, Supplier } from "./gst.js";
import type { PaymentGateway } from "./razorpay.js";
import { ResultsService } from "./results.js";
import { PracticeService } from "./practice.js";
import { PrepService } from "./prep.js";
import { PrepEngage } from "./prep-engage.js";
import { PrepCampus } from "./prep-campus.js";
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
  /** Where bank transfers against a quotation go. */
  readonly bank?: BankDetails | null;
  readonly mailer?: Mailer | null;
  readonly sms?: SmsSender | null;
  readonly whatsapp?: WhatsAppSender | null;
  /** Lever's API root, such as its sandbox https://api.sandbox.lever.co; Lever's own when absent. */
  readonly atsBases?: AtsBaseUrls;
  /** Outbound requests to webhooks and ATSs: only a browser-suite server lets them reach private addresses. */
  readonly http?: SafeHttpOptions;
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
  /** Queues the hour's daily reminders. */
  prepEngage: PrepEngage;
} {
  const keys = new DataKeys(o.dataKey);
  const proctorStore = new ProctorStore(o.sql, keys);
  const store = new LedgerStore(o.sql, { keys });
  const identity = new IdentityStore(o.sql);
  // Metering needs the exam service for its audit, and the exam service meters: bound late.
  let billing: BillingService | undefined;
  const reviewStore = new ReviewStore(o.sql);
  // A paper with its reviewer, or approved, is locked (CL60): bound late, as the review service audits through the exam service.
  let examReviews: ExamReviewService | undefined;
  const service = new ExamService({
    store,
    identity,
    client: o.client,
    locked: (org, exam) => examReviews?.locked(org, exam) ?? Promise.resolve(null),
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
    bank: o.bank ?? null,
  });
  examReviews = new ExamReviewService({ reviews: reviewStore, ledger: store, exams: service });
  const tokens = new AttemptTokens(o.secret);
  const invitationStore = new InvitationStore(o.sql);
  // Records kept sealed outside the ledger (T1), and swept with the retention period.
  const scriptStore = new ScriptStore(o.sql, keys.records("scripts"));
  const interviewStore = new InterviewStore(o.sql, keys.records("interviews"));
  const placementStore = new PlacementStore(o.sql, keys.records("students"));
  const studentMessages = new StudentMessages({
    placement: placementStore,
    identity,
    mailer: o.mailer ?? null,
    whatsapp: o.whatsapp ?? null,
    enqueue: (org, drafts) => invitationStore.enqueue(staffScope(org), drafts),
    offerLink: (org, code) => `${o.publicUrl.replace(/\/$/, "")}/?offer=${encodeURIComponent(`${org}.${code}`)}`,
    applyLink: (org, code) => `${o.publicUrl.replace(/\/$/, "")}/?apply=${encodeURIComponent(`${org}.${code}`)}`,
  });
  const privacy = new PrivacyService({
    store,
    privacy: new PrivacyStore(o.sql),
    invitations: invitationStore,
    identity,
    exams: service,
    proctor: proctorStore,
    records: [
      { kind: "answer_scripts", sweep: (orgId, before) => scriptStore.sweep(orgId, before) },
      { kind: "interviews", sweep: (orgId, before) => interviewStore.sweep(orgId, before) },
    ],
  });
  const labStore = new LabStore(o.sql);
  const lab = new LabService({ lab: labStore, invitations: invitationStore, store, exams: service });
  // Made below, once the results it reads exist; the hook is called only when a candidate starts.
  let proxy: ProxyService | null = null;
  const seatStore = new SeatStore(o.sql);
  const invitations = new InvitationService({
    notice: (orgId) => privacy.noticeFor(orgId),
    seat: async (orgId, examId, ref) => (await seatStore.seats(orgId, examId)).find((s) => s.ref === ref) ?? null,
    origin: async (...args) => proxy?.recordOrigin(...args),
    lab,
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
    ...(o.atsBases === undefined ? {} : { atsBases: o.atsBases }),
    ...(o.http === undefined ? {} : { http: o.http }),
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
  const prepCampus = new PrepCampus({ store: new PrepCampusStore(o.sql), plus: new PrepPlusStore(o.sql) });
  const practiceIdentity = new PracticeIdentity({
    store: practiceStore,
    practice,
    secrets,
    secret: o.secret,
    publicUrl: o.publicUrl,
    mailer: o.mailer ?? null,
    onVerified: (orgId, learner) => prepCampus.claim(orgId, learner),
  });
  const prepStore = new PrepStore(o.sql);
  const prepPlus = new PrepPlus({ store: new PrepPlusStore(o.sql), practice: practiceStore, gateway: o.gateway ?? null, supplier: o.supplier ?? null });
  const prepCommunity = new PrepCommunity({ practice: practiceStore, prep: prepStore, store: new PrepCommunityStore(o.sql), plus: prepPlus });
  const prepService = new PrepService({ practice: practiceStore, store: prepStore, plus: prepPlus, companyProblems: (site, learner) => prepCommunity.targetProblems(site, learner) });
  const prepEngage = new PrepEngage({
    store: new PrepEngageStore(o.sql),
    practiceStore,
    practice,
    prep: prepService,
    mailer: o.mailer ?? null,
    secret: o.secret,
    publicUrl: o.publicUrl,
  });
  const recheckStore = new RecheckStore(o.sql);
  const rechecks = new RecheckService({ store, rechecks: recheckStore, invitations: invitationStore, identity, exams: service, secret: o.secret, publicUrl: o.publicUrl });
  const results = new ResultsService({ store, invitations: invitationStore, exams: service, proctor: proctorStore, identity, mailer: o.mailer ?? null, whatsapp: (o.whatsapp ?? null) !== null, paperCopies: (orgId, examId) => scriptStore.forExam(orgId as OrgId, examId), releases: recheckStore });
  const proctorService = new ProctorService({ store, proctor: proctorStore, exams: service });
  proxy = new ProxyService({
    store: new ProxyStore(o.sql),
    proctor: proctorService,
    results,
    exams: service,
    secret: o.secret,
    labbed: async (orgId, examId) => (await labStore.get(staffScope(orgId), examId)).networks.length > 0,
  });
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
    proctor: proctorService,
    proxy,
    examReviews,
    feedback: new FeedbackStore(o.sql),
    lab,
    rechecks,
    marking: new MarkingService({ store, marking: new MarkingStore(o.sql), exams: service }),
    seats: new SeatService({ seats: seatStore, invitations: invitationStore, store, identity, exams: service, codes: new InviteCodes(o.secret), secret: o.secret }),
    handwriting: new HandwritingService({ scripts: scriptStore, ledger: store, exams: service }),
    interviews: new InterviewService({ store: interviewStore, exams: service, secret: o.secret, publicUrl: o.publicUrl }),
    outcomes: new OutcomeService({ outcomes: new OutcomeStore(o.sql), store, results, exams: service }),
    shortlists: new ShortlistService({ store: new ShortlistStore(o.sql), results, identity, exams: service, secret: o.secret, publicUrl: o.publicUrl }),
    placement: new PlacementService({ placement: placementStore, messages: studentMessages, secret: o.secret, store, exams: service, invitations, results, bank, publicUrl: o.publicUrl, identity }),
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
    prepCommunity,
    prepEngage,
    prepCampus,
    prepPlus: { plus: prepPlus, tutor: new Sahayak({ client: o.client, ...(o.tutorModel === undefined ? {} : { model: o.tutorModel }), practice: practiceStore, prep: prepStore, plus: prepPlus, lessonOpen: async (site, learner, slug) => !(await prepService.lesson(site, slug, learner)).locked }) },
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
    whatsapp: o.whatsapp ?? null,
    recheck: (org, id) => rechecks.note(orgId(org), id),
    result: (org, invitation) => results.candidateResult(orgId(org), attemptId(invitation.attemptId!), examId(invitation.examId)),
    handlers: { ...integrations.handlers, staff_email: (item) =>
      item.purpose === "password_reset"
        ? security.resetMail(item)
        : item.purpose === "results_file"
          ? results.mail(item)
          : item.purpose === "pilot_report"
            ? (dailyReport?.mail(item) ?? Promise.resolve({ skip: "No pilot report address" }))
            : onboarding.mail(item),
      learner_email: (item) => (item.purpose === "reminder" ? prepEngage.reminderMail(item) : practiceIdentity.verificationMail(item)),
      student: (item) => studentMessages.deliver(item) },
  });

  return { app, worker, privacy, billing, identity, dailyReport, prepEngage };
}
