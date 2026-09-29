import type Anthropic from "@anthropic-ai/sdk";
import { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { orgId, type OrgId, type Timestamp } from "@parikshaa/core";
import {
  IdentityStore,
  InvigilationStore,
  InvitationStore,
  LedgerStore,
  PrivacyStore,
  BillingStore,
  ProctorStore,
  PracticeStore,
  PrepStore,
  PrepCommunityStore,
  PrepPlusStore,
  QuestionBank,
  QuestionMedia,
  DataKeys,
  migrate,
  pgliteExecutor,
  type SqlExecutor,
  type StaffRole,
} from "@parikshaa/store";
import type { CodeRunner } from "@parikshaa/runner";
import { AttemptTokens } from "../auth.js";
import { InviteCodes } from "../invite-codes.js";
import { InvigilationService } from "../invigilation.js";
import { InvitationService } from "../invitation-service.js";
import { PrivacyService } from "../privacy.js";
import { BillingService } from "../billing.js";
import { ProctorService } from "../proctoring.js";
import type { Supplier } from "../gst.js";
import { FakeRazorpay } from "../razorpay.js";
import { buildIntegrations } from "../integrations.js";
import type { SafeHttpOptions } from "../safe-http.js";
import { ResultsService } from "../results.js";
import { PracticeService } from "../practice.js";
import { PrepService } from "../prep.js";
import { PrepPlus } from "../prep-plus.js";
import { PrepCommunity } from "../prep-community.js";
import { StarterPacks } from "../starter-packs.js";
import { Sahayak } from "../sahayak.js";
import { PracticeIdentity } from "../practice-identity.js";
import { buildServer, type ServerOptions } from "../server.js";
import { ExamService } from "../service.js";
import { StaffAuth, hashPassword } from "../staff-auth.js";
import { StaffSecrets } from "../staff-secrets.js";
import { StaffSecurity } from "../staff-security.js";
import type { ItemHandler, Mailer } from "../delivery.js";
import type { AtsBaseUrls } from "../ats.js";

/**
 * Wiring shared by the API tests: a server over a real (in-process) Postgres,
 * with real staff accounts behind it.
 *
 * Tests sign in through `POST /auth/login` like any client would, so the
 * session and permission paths they exercise are the production ones.
 */

export const PASSWORD = "correct horse battery staple";
export const TOKEN_SECRET = "a".repeat(40);
export const PUBLIC_URL = "https://exam.test";
/** Every API test seals, as production does. */
export const DATA_KEY = Buffer.alloc(32, 9).toString("base64");
/** Parikshaa as the tests' supplier: registered in Karnataka. */
export const SUPPLIER: Supplier = {
  legalName: "Parikshaa Assessments Pvt Ltd",
  gstin: "29AAGCP4401A1ZW",
  address: "12 Residency Road, Bengaluru 560025",
  sac: "998399",
};

/**
 * A migrated, empty database.
 *
 * Starting PGlite and migrating it takes seconds; loading a snapshot of one
 * that already was takes a fraction of that. Migrated once per test file.
 */
let snapshot: Promise<File | Blob> | null = null;
export async function freshDatabase(): Promise<PGlite> {
  snapshot ??= (async () => {
    const template = new PGlite();
    await migrate(pgliteExecutor(template));
    const dump = await template.dumpDataDir("none");
    await template.close();
    return dump;
  })();
  const db = new PGlite({ loadDataDir: await snapshot });
  await db.waitReady;
  return db;
}

/** argon2 is deliberately slow; hash the shared test password once. */
let hashed: Promise<string> | null = null;
const passwordHash = () => (hashed ??= hashPassword(PASSWORD));

export interface Wiring {
  readonly handlers: ReturnType<typeof buildIntegrations>["handlers"] & { readonly staff_email: ItemHandler; readonly learner_email: ItemHandler };
  readonly store: LedgerStore;
  readonly identity: IdentityStore;
  readonly service: ExamService;
  readonly privacy: PrivacyService;
  readonly billing: BillingService;
  readonly razorpay: FakeRazorpay;
  readonly security: StaffSecurity;
  readonly app: FastifyInstance;
}

export async function wire(
  sql: SqlExecutor,
  options: {
    readonly client: Anthropic;
    readonly now?: () => Timestamp;
    readonly newId?: () => string;
    readonly runner?: CodeRunner;
    readonly server?: Partial<ServerOptions>;
    /** For integration tests against a local server. */
    readonly http?: SafeHttpOptions;
    readonly greenhouseHosts?: readonly string[];
    /** Where staff mail (password resets) goes. */
    readonly mailer?: Mailer;
    /**
     * The clock staff sign-in runs on. Off by default, so sessions do not
     * expire when a test moves `now` on by days; a second-factor test needs it.
     */
    readonly staffClock?: boolean;
    /** Lever's and Zoho's API roots, when a test stands in for them. */
    readonly atsBases?: AtsBaseUrls;
    /** Stands in for Google in a test of signing in with it. */
    readonly googleIssuer?: string;
  },
): Promise<Wiring> {
  const store = new LedgerStore(sql, { keys: new DataKeys(DATA_KEY), ...(options.now === undefined ? {} : { clock: options.now }) });
  const identity = new IdentityStore(sql);
  let billing: BillingService | undefined;
  const service = new ExamService({
    store,
    identity,
    meter: { consume: (org, attempt) => billing!.consume(org, attempt), refund: (org, attempt) => billing!.refund(org, attempt) },
    client: options.client,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.newId === undefined ? {} : { newId: options.newId }),
    ...(options.runner === undefined ? {} : { runner: options.runner }),
  });
  const razorpay = new FakeRazorpay();
  billing = new BillingService({
    store,
    billing: new BillingStore(sql),
    identity,
    exams: service,
    gateway: razorpay,
    supplier: SUPPLIER,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const tokens = new AttemptTokens(TOKEN_SECRET);
  const invitationStore = new InvitationStore(sql);
  const privacy = new PrivacyService({
    store,
    proctor: new ProctorStore(sql, new DataKeys(DATA_KEY)),
    privacy: new PrivacyStore(sql),
    invitations: invitationStore,
    identity,
    exams: service,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const invitations = new InvitationService({
    notice: (orgId) => privacy.noticeFor(orgId),
    exams: service,
    store,
    invitations: invitationStore,
    codes: new InviteCodes(TOKEN_SECRET),
    tokens,
    publicUrl: PUBLIC_URL,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const integrations = buildIntegrations({
    sql,
    store,
    invitationStore,
    invitations,
    exams: service,
    secret: TOKEN_SECRET,
    publicUrl: PUBLIC_URL,
    ...(options.http === undefined ? {} : { http: options.http }),
    ...(options.greenhouseHosts === undefined ? {} : { greenhouseHosts: options.greenhouseHosts }),
    ...(options.atsBases === undefined ? {} : { atsBases: options.atsBases }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const secrets = new StaffSecrets(TOKEN_SECRET);
  const auth = new StaffAuth(identity, {
    secrets,
    ...(options.now === undefined || options.staffClock !== true ? {} : { now: options.now }),
  });
  const security = new StaffSecurity({
    identity,
    auth,
    secrets,
    publicUrl: PUBLIC_URL,
    mailer: options.mailer ?? null,
    ...(options.http === undefined ? {} : { http: options.http }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const practice = new PracticeService({
    store: new PracticeStore(sql),
    bank: new QuestionBank(sql),
    ...(options.runner === undefined ? {} : { runner: options.runner }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const prepPlus = new PrepPlus({ store: new PrepPlusStore(sql), practice: new PracticeStore(sql), gateway: razorpay, ...(options.now === undefined ? {} : { now: options.now }) });
  const prepService = new PrepService({ practice: new PracticeStore(sql), store: new PrepStore(sql), plus: prepPlus, ...(options.now === undefined ? {} : { now: options.now }) });
  const practiceIdentity = new PracticeIdentity({
    store: new PracticeStore(sql),
    practice,
    secrets,
    secret: TOKEN_SECRET,
    publicUrl: PUBLIC_URL,
    mailer: options.mailer ?? null,
    ...(options.http === undefined ? {} : { http: options.http }),
    ...(options.googleIssuer === undefined ? {} : { issuer: options.googleIssuer }),
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const app = buildServer({
    service,
    invitations,
    results: new ResultsService({ store, invitations: invitationStore, exams: service, proctor: new ProctorStore(sql, new DataKeys(DATA_KEY)) }),
    webhooks: integrations.webhooks,
    greenhouse: integrations.greenhouse,
    ats: integrations.ats,
    lti: integrations.lti,
    invigilation: new InvigilationService({
      store,
      proctor: new ProctorStore(sql, new DataKeys(DATA_KEY)),
      invitations: invitationStore,
      invigilation: new InvigilationStore(sql),
      exams: service,
      ...(options.now === undefined ? {} : { now: options.now }),
    }),
    privacy,
    billing,
    proctor: new ProctorService({
      store,
      proctor: new ProctorStore(sql, new DataKeys(DATA_KEY)),
      exams: service,
      ...(options.now === undefined ? {} : { now: options.now }),
    }),
    tokens,
    auth,
    security,
    identity,
    bank: new QuestionBank(sql),
    media: new QuestionMedia(sql),
    practice,
    practiceIdentity,
    prep: prepService,
    starterPacks: new StarterPacks({ practice: new PracticeStore(sql), prep: new PrepStore(sql), service: prepService }),
    prepCommunity: new PrepCommunity({ practice: new PracticeStore(sql), prep: new PrepStore(sql), store: new PrepCommunityStore(sql), plus: prepPlus, ...(options.now === undefined ? {} : { now: options.now }) }),
    prepPlus: {
      plus: prepPlus,
      tutor: new Sahayak({ client: options.client, practice: new PracticeStore(sql), prep: new PrepStore(sql), plus: prepPlus, ...(options.now === undefined ? {} : { now: options.now }) }),
    },
    ...options.server,
  });
  await app.ready();
  return {
    store,
    identity,
    service,
    privacy,
    billing,
    razorpay,
    security,
    app,
    handlers: { ...integrations.handlers, staff_email: security.resetMail, learner_email: practiceIdentity.verificationMail },
  };
}

export async function addOrganisation(identity: IdentityStore, id: string, name = id): Promise<OrgId> {
  const org = orgId(id);
  if ((await identity.getOrganisation(org)) === null) await identity.createOrganisation(org, name);
  return org;
}

export async function addStaff(
  identity: IdentityStore,
  org: OrgId,
  email: string,
  role: StaffRole,
  name = email.split("@")[0] ?? email,
): Promise<string> {
  const user = await identity.createUser({ orgId: org, email, name, role, passwordHash: await passwordHash() });
  return user.id;
}

/** Sign in through the API and return the session token. */
export async function signIn(app: FastifyInstance, email: string, password = PASSWORD): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`sign-in failed for ${email}: ${res.statusCode} ${res.payload}`);
  return (res.json() as { token: string }).token;
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
