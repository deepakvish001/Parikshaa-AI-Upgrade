import { attemptId as toAttemptId, orgId as toOrgId, resultOf } from "@parikshaa/core";
import {
  staffScope,
  type IntegrationStore,
  type InvitationStore,
  type LedgerStore,
  type OutboxItem,
  type OutboxStore,
  type Webhook,
} from "@parikshaa/store";
import { PermanentFailure, type ItemHandler } from "./delivery.js";
import { signWebhook, type IntegrationSecrets } from "./integration-secrets.js";
import { checkUrl, safeRequest, UnsafeUrl, type SafeHttpOptions } from "./safe-http.js";
import { AttemptError, Forbidden, type ExamService } from "./service.js";
import { can, type Actor } from "./staff-auth.js";

/**
 * Outbound webhooks (ROADMAP §7).
 *
 * Each start, submission, grade and voiding is announced by the ledger in the
 * same transaction that records it (see `ANNOUNCED` in the store). The worker
 * fans an announcement out, one outbox item per interested webhook, each with
 * a fixed id so that doing it twice sends nothing twice; then delivers each,
 * signed, with retries. The outbox is the delivery log.
 *
 * Deliveries follow Standard Webhooks (standardwebhooks.com): `webhook-id`,
 * `webhook-timestamp` and `webhook-signature` headers, so a receiver can check
 * one with an off-the-shelf library. The id is the same on every retry of a
 * delivery; receivers should use it to ignore repeats.
 */

export const WEBHOOK_EVENTS = ["attempt.started", "attempt.submitted", "attempt.graded", "attempt.voided"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookPayload {
  readonly type: string;
  readonly timestamp: string;
  readonly data: Record<string, unknown>;
}

/** Something else to do when an event is fanned out: Greenhouse's completion call. */
export type EventListener = (orgId: string, event: string, attemptId: string, eventItemId: string) => Promise<void>;

export interface WebhookServiceOptions {
  readonly integrations: IntegrationStore;
  readonly invitations: InvitationStore;
  readonly store: LedgerStore;
  readonly outbox: OutboxStore;
  readonly exams: ExamService;
  readonly secrets: IntegrationSecrets;
  readonly publicUrl: string;
  readonly http?: SafeHttpOptions;
  readonly listeners?: readonly EventListener[];
  readonly now?: () => number;
}

export class WebhookService {
  readonly #o: WebhookServiceOptions;
  readonly #now: () => number;

  constructor(options: WebhookServiceOptions) {
    this.#o = options;
    this.#now = options.now ?? (() => Date.now());
  }

  #require(actor: Actor) {
    if (!can(actor, "org:manage")) throw new Forbidden("org:manage");
    return staffScope(actor.orgId);
  }

  async #get(actor: Actor, id: string): Promise<Webhook> {
    const hook = await this.#o.integrations.webhook(this.#require(actor), id);
    if (hook === null) throw new AttemptError("not_found", "No such webhook");
    return hook;
  }

  #secret(orgId: string, hook: Webhook): string {
    return this.#o.secrets.webhookSecret(orgId, hook.id, hook.version);
  }

  list(actor: Actor): Promise<readonly Webhook[]> {
    return this.#o.integrations.webhooks(this.#require(actor));
  }

  /** Register a webhook. Its signing secret is returned; it can be shown again, or rotated. */
  async add(
    actor: Actor,
    hook: { readonly url: string; readonly events: readonly WebhookEvent[]; readonly description: string },
  ): Promise<{ webhook: Webhook; secret: string }> {
    const scope = this.#require(actor);
    const url = checkUrl(hook.url, this.#o.http).toString();
    const webhook = await this.#o.integrations.addWebhook(scope, { ...hook, url });
    await this.#o.exams.recordAudit(actor, "webhook.created", webhook.id, { url, events: hook.events });
    return { webhook, secret: this.#secret(actor.orgId, webhook) };
  }

  async secret(actor: Actor, id: string): Promise<string> {
    const hook = await this.#get(actor, id);
    await this.#o.exams.recordAudit(actor, "webhook.secret_shown", id);
    return this.#secret(actor.orgId, hook);
  }

  async rotate(actor: Actor, id: string): Promise<{ webhook: Webhook; secret: string }> {
    const webhook = await this.#o.integrations.rotateWebhook(this.#require(actor), id);
    if (webhook === null) throw new AttemptError("not_found", "No such active webhook");
    await this.#o.exams.recordAudit(actor, "webhook.rotated", id);
    return { webhook, secret: this.#secret(actor.orgId, webhook) };
  }

  async disable(actor: Actor, id: string): Promise<void> {
    if (!(await this.#o.integrations.disableWebhook(this.#require(actor), id))) throw new AttemptError("not_found", "No such webhook");
    await this.#o.exams.recordAudit(actor, "webhook.disabled", id);
  }

  /** Send a `webhook.test` delivery now, to check the receiving end. */
  async test(actor: Actor, id: string): Promise<void> {
    const hook = await this.#get(actor, id);
    if (hook.disabled) throw new AttemptError("invalid_state", "The webhook is disabled");
    await this.#o.integrations.enqueue(staffScope(actor.orgId), [
      { kind: "webhook", purpose: "delivery", subject: { webhookId: id, event: "webhook.test" } },
    ]);
  }

  async deliveries(actor: Actor, id: string) {
    await this.#get(actor, id);
    const rows = await this.#o.outbox.recent(actor.orgId, { key: "webhookId", value: id }, 50);
    return rows.map((r) => ({
      id: r.id,
      event: String(r.subject["event"] ?? ""),
      attemptId: typeof r.subject["attemptId"] === "string" ? r.subject["attemptId"] : null,
      status: r.status,
      attempts: r.attempts,
      error: r.error,
      createdAt: r.createdAt,
      sentAt: r.sentAt,
    }));
  }

  // --- the worker's side ------------------------------------------------------

  /** The outbox handler for kind `webhook`: announcements, and deliveries. */
  readonly handle: ItemHandler = async (item) => {
    if (item.purpose === "event") return this.#fanOut(item);
    if (item.purpose === "delivery") return this.#deliver(item);
    return { skip: `Unknown purpose ${item.purpose}` };
  };

  async #fanOut(item: OutboxItem): Promise<"sent" | { skip: string }> {
    const event = String(item.subject["event"]);
    const attemptId = String(item.subject["attemptId"]);
    const hooks = await this.#o.integrations.subscribers(staffScope(toOrgId(item.orgId)), event);
    await this.#o.integrations.enqueue(
      staffScope(toOrgId(item.orgId)),
      hooks.map((hook) => ({
        // Fixed, so a fan-out that runs twice (a worker died after it) queues each delivery once.
        id: `${item.id}:${hook.id}`,
        kind: "webhook" as const,
        purpose: "delivery",
        subject: { webhookId: hook.id, event, attemptId },
      })),
    );
    for (const listen of this.#o.listeners ?? []) await listen(item.orgId, event, attemptId, item.id);
    return hooks.length === 0 ? { skip: "No webhook wants this event" } : "sent";
  }

  async #deliver(item: OutboxItem): Promise<"sent" | { skip: string }> {
    const scope = staffScope(toOrgId(item.orgId));
    const hook = await this.#o.integrations.webhook(scope, String(item.subject["webhookId"]));
    if (hook === null || hook.disabled) return { skip: "The webhook is disabled" };

    const event = String(item.subject["event"]);
    const payload: WebhookPayload = {
      type: event,
      timestamp: new Date(this.#now()).toISOString(),
      data:
        event === "webhook.test"
          ? { message: "A test delivery from Parikshaa. Nothing happened." }
          : await this.eventData(item.orgId, String(item.subject["attemptId"])),
    };
    const body = JSON.stringify(payload);
    const timestamp = Math.floor(this.#now() / 1000);
    const secret = this.#secret(item.orgId, hook);

    let response;
    try {
      response = await safeRequest(
        hook.url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "webhook-id": item.id,
            "webhook-timestamp": String(timestamp),
            "webhook-signature": signWebhook(secret, item.id, timestamp, body),
          },
          body,
        },
        this.#o.http,
      );
    } catch (error) {
      if (error instanceof UnsafeUrl) throw new PermanentFailure(error.message);
      throw error;
    }
    if (response.status >= 200 && response.status < 300) return "sent";
    // A receiver that is down, or refusing for now, may accept later; the worker backs off and retries.
    throw new Error(`HTTP ${response.status}${response.body === "" ? "" : `: ${response.body.slice(0, 200)}`}`);
  }

  /**
   * What a delivery says about an attempt: as it stands when sent, which after
   * a retry may be further on than the event that caused it.
   */
  async eventData(orgId: string, attemptId: string): Promise<Record<string, unknown>> {
    const scope = staffScope(toOrgId(orgId));
    const entries = await this.#o.store.load(scope, toAttemptId(attemptId));
    const first = entries[0];
    if (first === undefined || first.event.type !== "attempt_started") return { attemptId };
    const [definition, invitation] = await Promise.all([
      this.#o.store.loadExam(scope, first.event.examId),
      this.#o.invitations.byAttempt(scope, attemptId),
    ]);
    const result = definition === null ? null : resultOf(entries, definition);
    return {
      attemptId,
      examId: first.event.examId,
      examTitle: definition?.title ?? null,
      candidate: {
        id: first.event.candidateId,
        ref: invitation?.candidateRef ?? first.event.candidateId,
        name: invitation?.name ?? null,
        email: invitation?.email ?? null,
      },
      state: result?.state ?? null,
      total: result?.total ?? null,
      maxTotal: result?.maxTotal ?? null,
      percent: result?.percent ?? null,
      startedAt: new Date(first.timestamp).toISOString(),
      submittedAt: result?.submittedAt == null ? null : new Date(result.submittedAt).toISOString(),
      voidReason: result?.voidReason ?? null,
      reportUrl: reportUrl(this.#o.publicUrl, attemptId),
    };
  }
}

/** Where a person with access reads one candidate's report. */
export const reportUrl = (publicUrl: string, attemptId: string) => `${publicUrl.replace(/\/$/, "")}/console/?report=${encodeURIComponent(attemptId)}`;
