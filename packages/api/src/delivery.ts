import nodemailer, { type Transporter } from "nodemailer";
import { examId, orgId as toOrgId } from "@parikshaa/core";
import {
  staffScope,
  type IdentityStore,
  type Invitation,
  type InvitationStore,
  type LedgerStore,
  type OutboxItem,
  type OutboxStore,
} from "@parikshaa/store";

/**
 * Sending what the outbox holds (ROADMAP §5).
 *
 * The worker claims due items, builds each message at send time — under the
 * organisation's own scope, from the invitation as it now stands — and hands it
 * to a transport. A reminder for a candidate who has already started, or an
 * invitation that was revoked, is skipped rather than sent. A failure that
 * might pass is retried with backoff; one that will not (a bad address, a
 * rejected template) is recorded and left.
 */

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export interface SmsMessage {
  /** 91XXXXXXXXXX */
  readonly to: string;
  /** Values for the DLT template's variables, in order. */
  readonly variables: readonly string[];
}

/** Raised by a transport for a failure retrying will not fix. */
export class PermanentFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentFailure";
  }
}

export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}

export interface SmsSender {
  send(message: SmsMessage): Promise<void>;
}

/**
 * Email over SMTP, which every provider serving India offers — Amazon SES in
 * Mumbai, Zoho, Netcore, Pepipost — so none of them is baked in.
 */
export class SmtpMailer implements Mailer {
  readonly #transport: Transporter;
  readonly #from: string;

  constructor(url: string, from: string) {
    this.#transport = nodemailer.createTransport(url);
    this.#from = from;
  }

  async send(message: EmailMessage): Promise<void> {
    try {
      await this.#transport.sendMail({ from: this.#from, ...message });
    } catch (error) {
      const code = (error as { responseCode?: number }).responseCode;
      // 5xx is the server saying no for good: no such mailbox, policy refusal.
      if (code !== undefined && code >= 500) throw new PermanentFailure(`SMTP ${code}: ${(error as Error).message}`);
      throw error;
    }
  }
}

/**
 * SMS through MSG91's flow API, which carries the DLT-registered template
 * Indian regulation requires for any commercial SMS. The template, registered
 * on DLT and in MSG91 with three variables, should read along the lines of:
 *
 *   Your {#var#} test opens {#var#}. Your personal link: {#var#} - <sender>
 *
 * The request shape follows MSG91's published v5 flow API; check it against
 * your MSG91 account with a test message before the first sitting.
 */
export class Msg91Sender implements SmsSender {
  readonly #authKey: string;
  readonly #templateId: string;
  readonly #url: string;

  constructor(authKey: string, templateId: string, url = "https://control.msg91.com/api/v5/flow") {
    this.#authKey = authKey;
    this.#templateId = templateId;
    this.#url = url;
  }

  async send(message: SmsMessage): Promise<void> {
    const recipient: Record<string, string> = { mobiles: message.to };
    message.variables.forEach((value, i) => (recipient[`var${i + 1}`] = value));
    const response = await fetch(this.#url, {
      method: "POST",
      headers: { authkey: this.#authKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ template_id: this.#templateId, short_url: "0", recipients: [recipient] }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await response.json().catch(() => ({}))) as { type?: string; message?: string };
    if (!response.ok || body.type === "error") {
      const detail = `MSG91 ${response.status}: ${body.message ?? "no message"}`;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) throw new PermanentFailure(detail);
      throw new Error(detail);
    }
  }
}

/** For development and tests: keeps what would have been sent. */
export class OutboxLog implements Mailer, SmsSender {
  readonly sent: (EmailMessage | SmsMessage)[] = [];
  async send(message: EmailMessage | SmsMessage): Promise<void> {
    this.sent.push(message);
  }
}

/** Handles the outbox kinds this module does not: webhooks, integrations (§7). */
export type ItemHandler = (item: OutboxItem) => Promise<"sent" | { readonly skip: string }>;

export interface DeliveryWorkerOptions {
  readonly outbox: OutboxStore;
  readonly invitations: InvitationStore;
  readonly store: LedgerStore;
  readonly identity: IdentityStore;
  readonly link: (orgId: string, invitationId: string) => string;
  readonly mailer: Mailer | null;
  readonly sms: SmsSender | null;
  readonly handlers?: Partial<Record<OutboxItem["kind"], ItemHandler>>;
  readonly now?: () => number;
  /** Attempts before an item is given up on. */
  readonly maxAttempts?: number;
}

/** Times in the candidate's own terms: Indian Standard Time, spelled out. */
export const ist = (iso: string): string =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso)) + " IST";

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export class DeliveryWorker {
  readonly #o: DeliveryWorkerOptions;
  readonly #now: () => number;
  readonly #max: number;

  constructor(options: DeliveryWorkerOptions) {
    this.#o = options;
    this.#now = options.now ?? (() => Date.now());
    this.#max = options.maxAttempts ?? 8;
  }

  /** Send everything due. Returns how many items were handled. */
  async tick(batch = 25): Promise<number> {
    const items = await this.#o.outbox.claimDue(new Date(this.#now()), batch);
    for (const item of items) await this.#handle(item);
    return items.length;
  }

  async #handle(item: OutboxItem): Promise<void> {
    const { outbox } = this.#o;
    try {
      const outcome = await this.#deliver(item);
      if (outcome === "sent") await outbox.sent(item.id, new Date(this.#now()));
      else await outbox.skipped(item.id, outcome.skip);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const giveUp = error instanceof PermanentFailure || item.attempts >= this.#max;
      // 1, 2, 4 … minutes, capped at an hour.
      const backoff = Math.min(2 ** (item.attempts - 1), 60) * 60_000;
      await outbox.failed(item.id, message, giveUp ? null : new Date(this.#now() + backoff));
    }
  }

  async #deliver(item: OutboxItem): Promise<"sent" | { readonly skip: string }> {
    if (item.kind !== "email" && item.kind !== "sms") {
      const handler = this.#o.handlers?.[item.kind];
      return handler === undefined ? { skip: `No handler for ${item.kind}` } : handler(item);
    }

    const invitationId = String(item.subject["invitationId"] ?? "");
    const scope = staffScope(toOrgId(item.orgId));
    const invitation = await this.#o.invitations.get(scope, invitationId);
    if (invitation === null || invitation.revoked) return { skip: "The invitation was revoked" };
    if (Date.parse(invitation.closesAt) <= this.#now() && invitation.attemptId === null) {
      return { skip: "The window has closed" };
    }
    if (item.purpose === "reminder" && invitation.attemptId !== null) return { skip: "Already started" };

    const [exam, org] = await Promise.all([
      this.#o.store.loadExam(scope, examId(invitation.examId)),
      this.#o.identity.getOrganisation(toOrgId(item.orgId)),
    ]);
    const title = exam?.title ?? invitation.examId;
    const institution = org?.name ?? "Your institution";
    const link = this.#o.link(item.orgId, invitation.id);

    if (item.kind === "email") {
      if (this.#o.mailer === null) return { skip: "Email is not configured" };
      if (invitation.email === null) return { skip: "No email address" };
      await this.#o.mailer.send(this.#email(invitation, title, institution, link, item.purpose));
    } else {
      if (this.#o.sms === null) return { skip: "SMS is not configured" };
      if (invitation.phone === null) return { skip: "No phone number" };
      await this.#o.sms.send({ to: invitation.phone, variables: [title.slice(0, 30), ist(invitation.opensAt), link] });
    }
    return "sent";
  }

  /**
   * The invitation email. Plain about what the test does and does not do,
   * because a candidate who expects to be watched arrives anxious, and the
   * follow-up question should not come as a surprise.
   */
  #email(invitation: Invitation, title: string, institution: string, link: string, purpose: string): EmailMessage {
    const greeting = invitation.name.trim() === "" ? "Hello," : `Hello ${invitation.name},`;
    const lead =
      purpose === "reminder"
        ? `A reminder: your ${title} test with ${institution} opens soon.`
        : `${institution} has invited you to take the ${title} test.`;
    const lines = [
      greeting,
      "",
      lead,
      "",
      `Opens:  ${ist(invitation.opensAt)}`,
      `Closes: ${ist(invitation.closesAt)}`,
      "",
      "Your personal link (do not share it — it is yours alone):",
      link,
      "",
      "You can open the link on any device, and reopen it if your connection drops; your answers are kept as you type.",
      "The test uses no webcam, no screen capture and no keystroke monitoring. You may be asked a short follow-up question about one or two of your own answers.",
      "",
      `— ${institution}, via Parikshaa`,
    ];
    const html = `<p>${escape(greeting)}</p><p>${escape(lead)}</p>
<p><strong>Opens:</strong> ${escape(ist(invitation.opensAt))}<br><strong>Closes:</strong> ${escape(ist(invitation.closesAt))}</p>
<p><a href="${escape(link)}">Open your test</a> — this link is yours alone; please do not share it.</p>
<p>You can open the link on any device, and reopen it if your connection drops; your answers are kept as you type.</p>
<p>The test uses no webcam, no screen capture and no keystroke monitoring. You may be asked a short follow-up question about one or two of your own answers.</p>
<p>— ${escape(institution)}, via Parikshaa</p>`;
    return {
      to: invitation.email!,
      subject: purpose === "reminder" ? `Reminder: ${title} opens ${ist(invitation.opensAt)}` : `Your ${title} test — ${institution}`,
      text: lines.join("\n"),
      html,
    };
  }
}
