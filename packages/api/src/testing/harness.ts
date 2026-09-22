import type Anthropic from "@anthropic-ai/sdk";
import { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { orgId, type OrgId, type Timestamp } from "@parikshaa/core";
import {
  IdentityStore,
  InvitationStore,
  LedgerStore,
  QuestionBank,
  migrate,
  pgliteExecutor,
  type SqlExecutor,
  type StaffRole,
} from "@parikshaa/store";
import type { CodeRunner } from "@parikshaa/runner";
import { AttemptTokens } from "../auth.js";
import { InviteCodes } from "../invite-codes.js";
import { InvitationService } from "../invitation-service.js";
import { ResultsService } from "../results.js";
import { buildServer, type ServerOptions } from "../server.js";
import { ExamService } from "../service.js";
import { StaffAuth, hashPassword } from "../staff-auth.js";

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
  readonly store: LedgerStore;
  readonly identity: IdentityStore;
  readonly service: ExamService;
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
  },
): Promise<Wiring> {
  const store = new LedgerStore(sql, options.now === undefined ? {} : { clock: options.now });
  const identity = new IdentityStore(sql);
  const service = new ExamService({
    store,
    identity,
    client: options.client,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.newId === undefined ? {} : { newId: options.newId }),
    ...(options.runner === undefined ? {} : { runner: options.runner }),
  });
  const tokens = new AttemptTokens(TOKEN_SECRET);
  const invitationStore = new InvitationStore(sql);
  const invitations = new InvitationService({
    exams: service,
    store,
    invitations: invitationStore,
    codes: new InviteCodes(TOKEN_SECRET),
    tokens,
    publicUrl: PUBLIC_URL,
    ...(options.now === undefined ? {} : { now: options.now }),
  });
  const app = buildServer({
    service,
    invitations,
    results: new ResultsService({ store, invitations: invitationStore, exams: service }),
    tokens,
    auth: new StaffAuth(identity),
    identity,
    bank: new QuestionBank(sql),
    ...options.server,
  });
  await app.ready();
  return { store, identity, service, app };
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
