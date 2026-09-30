import nodemailer, { type Transporter } from "nodemailer";
import { examId, orgId as toOrgId, type Exam, type ProctoringPolicy } from "@parikshaa/core";
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
  /** Files sent with it: the results workbook a member of staff asked for. */
  readonly attachments?: readonly { readonly filename: string; readonly content: Uint8Array; readonly contentType: string }[];
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
      const { attachments, ...rest } = message;
      await this.#transport.sendMail({
        from: this.#from,
        ...rest,
        ...(attachments === undefined ? {} : { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType })) }),
      });
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
    const reminder = item.purpose === "reminder" || item.purpose === "reminder_day";
    if (reminder && invitation.attemptId !== null) return { skip: "Already started" };
    // Held up past its moment (the worker was down), the day's reminder gives way to the hour's.
    if (item.purpose === "reminder_day" && Date.parse(invitation.opensAt) - this.#now() < 2 * 3_600_000) {
      return { skip: "The later reminder covers it" };
    }

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
      await this.#o.mailer.send(this.#email(invitation, { title, institution, link, purpose: item.purpose, exam }));
    } else {
      if (this.#o.sms === null) return { skip: "SMS is not configured" };
      if (invitation.phone === null) return { skip: "No phone number" };
      await this.#o.sms.send({ to: invitation.phone, variables: [title.slice(0, 30), ist(invitation.opensAt), link] });
    }
    return "sent";
  }

  /**
   * The invitation email, and the reminders. Plain about what the test does
   * and does not do, because a candidate who expects to be watched arrives
   * anxious, and the follow-up question should not come as a surprise. What
   * it says about the camera is what this exam does: a proctored exam's
   * candidates are told, before the day, to have their camera and ID ready.
   */
  #email(
    invitation: Invitation,
    about: { readonly title: string; readonly institution: string; readonly link: string; readonly purpose: string; readonly exam: Exam | null },
  ): EmailMessage {
    const { title, institution, link, purpose, exam } = about;
    const greeting = invitation.name.trim() === "" ? "Hello," : `Hello ${invitation.name},`;
    const opens = ist(invitation.opensAt);
    const untilOpen = Date.parse(invitation.opensAt) - this.#now();
    const reminder = purpose === "reminder" || purpose === "reminder_day";
    const lead = !reminder
      ? `${institution} has invited you to take the ${title} test.`
      : untilOpen <= 0
        ? `A reminder: your ${title} test with ${institution} is open now.`
        : untilOpen <= 90 * 60_000
          ? `A reminder: your ${title} test with ${institution} opens in ${Math.max(1, Math.round(untilOpen / 60_000))} minutes.`
          : `A reminder: your ${title} test with ${institution} opens ${opens}.`;

    const proctoring = exam?.policy.proctoring;
    const camera = proctoring !== undefined && (proctoring.identity || proctoring.snapshotEverySeconds !== null);
    const minutes = exam === null ? null : Math.round(exam.policy.durationMs / 60_000);
    const what = [
      ...(minutes === null ? [] : [`Once you begin, you have ${minutes} minutes.`]),
      "You can open the link on any device, and reopen it if your connection drops; your answers are kept as you type.",
      camera ? cameraWords(proctoring!) : "The test uses no webcam, no screen capture and no keystroke monitoring.",
      ...(proctoring?.browserEvents === true ? ["It notes if you leave the test's tab or full screen, or copy or paste, for your institution to see."] : []),
      "You may be asked a short follow-up question about one or two of your own answers.",
    ];
    const ready = reminder
      ? [
          `Before it opens: charge your phone or laptop, find a quiet place with a steady connection${camera && proctoring!.identity ? ", keep your photo ID to hand" : ""}, and keep this email where you can find it.`,
        ]
      : [];

    const lines = [
      greeting,
      "",
      lead,
      "",
      `Opens:  ${opens}`,
      `Closes: ${ist(invitation.closesAt)}`,
      "",
      "Your personal link (do not share it — it is yours alone):",
      link,
      "",
      ...ready,
      ...(ready.length > 0 ? [""] : []),
      ...what,
      "",
      `— ${institution}, via Parikshaa`,
    ];
    const html = `<p>${escape(greeting)}</p><p>${escape(lead)}</p>
<p><strong>Opens:</strong> ${escape(opens)}<br><strong>Closes:</strong> ${escape(ist(invitation.closesAt))}</p>
<p><a href="${escape(link)}">Open your test</a> — this link is yours alone; please do not share it.</p>
${ready.map((line) => `<p>${escape(line)}</p>`).join("\n")}
${what.map((line) => `<p>${escape(line)}</p>`).join("\n")}
<p>— ${escape(institution)}, via Parikshaa</p>`;
    return {
      to: invitation.email!,
      subject: !reminder
        ? `Your ${title} test — ${institution}`
        : untilOpen <= 0
          ? `Reminder: ${title} is open now`
          : `Reminder: ${title} opens ${opens}`,
      text: lines.join("\n"),
      html,
    };
  }
}

/** What a proctored exam's camera does, in a candidate's terms. */
function cameraWords(policy: ProctoringPolicy): string {
  const uses = [
    ...(policy.identity ? ["a photo of you and of your photo ID before you begin"] : []),
    ...(policy.snapshotEverySeconds !== null ? [`a photo from your camera every ${everyWords(policy.snapshotEverySeconds)} while you work`] : []),
  ];
  return `This test uses your camera: ${uses.join(", and ")}. Allow the camera when your browser asks. It uses no screen capture and no keystroke monitoring.`;
}

const everyWords = (seconds: number) =>
  seconds % 60 === 0 ? (seconds === 60 ? "minute" : `${seconds / 60} minutes`) : `${seconds} seconds`;
