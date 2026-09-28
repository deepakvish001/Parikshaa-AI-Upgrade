import { IntegrationStore, LtiStore, OutboxStore, type InvitationStore, type LedgerStore, type SqlExecutor } from "@parikshaa/store";
import { LtiService } from "./lti.js";
import { AtsService, type AtsBaseUrls } from "./ats.js";
import type { ItemHandler } from "./delivery.js";
import { StaffSecrets } from "./staff-secrets.js";
import { GreenhouseService } from "./greenhouse.js";
import { IntegrationSecrets } from "./integration-secrets.js";
import type { InvitationService } from "./invitation-service.js";
import type { SafeHttpOptions } from "./safe-http.js";
import type { ExamService } from "./service.js";
import { WebhookService } from "./webhooks.js";

/** Webhooks, Greenhouse and the other ATS connectors, wired together, with the outbox handlers the delivery worker needs. */
export function buildIntegrations(o: {
  readonly sql: SqlExecutor;
  readonly store: LedgerStore;
  readonly invitationStore: InvitationStore;
  readonly invitations: InvitationService;
  readonly exams: ExamService;
  /** The server's secret; integration secrets are derived from it. */
  readonly secret: string;
  readonly publicUrl: string;
  readonly http?: SafeHttpOptions;
  readonly greenhouseHosts?: readonly string[];
  /** Lever's and Zoho's API roots, in a test. */
  readonly atsBases?: AtsBaseUrls;
  readonly now?: () => number;
}): {
  webhooks: WebhookService;
  greenhouse: GreenhouseService;
  ats: AtsService;
  lti: LtiService;
  handlers: { webhook: ItemHandler; greenhouse: ItemHandler; ats: ItemHandler; lti: ItemHandler };
} {
  const integrations = new IntegrationStore(o.sql);
  const secrets = new IntegrationSecrets(o.secret);
  const common = {
    integrations,
    store: o.store,
    exams: o.exams,
    secrets,
    publicUrl: o.publicUrl,
    ...(o.http === undefined ? {} : { http: o.http }),
  };
  const greenhouse = new GreenhouseService({
    ...common,
    invitationService: o.invitations,
    invitations: o.invitationStore,
    ...(o.greenhouseHosts === undefined ? {} : { hosts: o.greenhouseHosts }),
  });
  const ats = new AtsService({
    ...common,
    invitationService: o.invitations,
    invitations: o.invitationStore,
    sealer: new StaffSecrets(o.secret),
    ...(o.atsBases === undefined ? {} : { bases: o.atsBases }),
  });
  const lti = new LtiService({
    lti: new LtiStore(o.sql),
    outbox: integrations,
    invitationService: o.invitations,
    invitations: o.invitationStore,
    store: o.store,
    exams: o.exams,
    secrets: new StaffSecrets(o.secret),
    publicUrl: o.publicUrl,
    ...(o.http === undefined ? {} : { http: o.http }),
    ...(o.now === undefined ? {} : { now: o.now }),
  });
  const webhooks = new WebhookService({
    ...common,
    invitations: o.invitationStore,
    outbox: new OutboxStore(o.sql),
    listeners: [greenhouse.listener, ats.listener, lti.listener],
    ...(o.now === undefined ? {} : { now: o.now }),
  });
  return { webhooks, greenhouse, ats, lti, handlers: { webhook: webhooks.handle, greenhouse: greenhouse.handle, ats: ats.handle, lti: lti.handle } };
}
