import type Anthropic from "@anthropic-ai/sdk";
import type { FastifyInstance } from "fastify";
import type { CodeRunner } from "@parikshaa/runner";
import { DataKeys, IdentityStore, InvigilationStore, InvitationStore, LedgerStore, OutboxStore, PrivacyStore, QuestionBank, type SqlExecutor } from "@parikshaa/store";
import { AttemptTokens } from "./auth.js";
import { DeliveryWorker, type Mailer, type SmsSender } from "./delivery.js";
import { buildIntegrations } from "./integrations.js";
import { InvigilationService } from "./invigilation.js";
import { InviteCodes } from "./invite-codes.js";
import { InvitationService } from "./invitation-service.js";
import { PrivacyService } from "./privacy.js";
import { ResultsService } from "./results.js";
import { buildServer, type ServerOptions } from "./server.js";
import { ExamService } from "./service.js";
import { StaffAuth } from "./staff-auth.js";

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
  readonly mailer?: Mailer | null;
  readonly sms?: SmsSender | null;
  readonly server?: Pick<ServerOptions, "clients" | "log" | "trustProxy" | "rateLimits" | "loginThrottle" | "attemptTtlSeconds">;
}

export function assemble(o: AssembleOptions): { app: FastifyInstance; worker: DeliveryWorker; privacy: PrivacyService } {
  const store = new LedgerStore(o.sql, { keys: new DataKeys(o.dataKey) });
  const identity = new IdentityStore(o.sql);
  const service = new ExamService({ store, identity, client: o.client, ...(o.runner === undefined ? {} : { runner: o.runner }) });
  const tokens = new AttemptTokens(o.secret);
  const invitationStore = new InvitationStore(o.sql);
  const privacy = new PrivacyService({ store, privacy: new PrivacyStore(o.sql), invitations: invitationStore, identity, exams: service });
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

  const app = buildServer({
    service,
    invitations,
    results: new ResultsService({ store, invitations: invitationStore, exams: service }),
    webhooks: integrations.webhooks,
    greenhouse: integrations.greenhouse,
    invigilation: new InvigilationService({ store, invitations: invitationStore, invigilation: new InvigilationStore(o.sql), exams: service }),
    privacy,
    tokens,
    auth: new StaffAuth(identity),
    identity,
    bank: new QuestionBank(o.sql),
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
    handlers: integrations.handlers,
  });

  return { app, worker, privacy };
}
