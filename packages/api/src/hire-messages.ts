import { orgId as toOrgId } from "@parikshaa/core";
import type { HireApplicationStore, IdentityStore, OutboxItem, RoundKind } from "@parikshaa/store";
import type { ItemOutcome, Mailer } from "./delivery.js";
import { HELD_FOR_MS } from "./hire-apply.js";

/**
 * Hire's mail to applicants (docs/HIRE-V2.md §1 outbox kind `hire`, §10 F2,
 * F23, P14, S18; H2b, H2c). Each message is built when it is sent, from the
 * application as it then stands: a mail about a step the application has
 * left since (moved on, rejected, restored) is skipped. While the company is
 * suspended its mail waits, an hour at a time, rather than being dropped
 * (F2). Every message comes from "<Company> via Parikshaa", replies go to the
 * job's contact address, and it says that Parikshaa and real employers never
 * ask for money (S18). Until Parikshaa verifies the company its mails carry
 * no words its staff wrote (S18): not a message, a round's title, the job's
 * note to candidates or its rejection line; the candidate reads a message in
 * the portal. A round is then named by its kind.
 */

const NEVER_PAY = "Parikshaa and real employers never ask you to pay to apply or to be hired. If anyone does, report the job from its page.";

/** What a round is called in an unverified company's mail, in place of the title its staff wrote (S18). */
const ROUND_KIND_NAMES: Readonly<Record<RoundKind, string>> = {
  screen: "Screening",
  assessment: "Online test",
  ai_interview: "AI interview",
  interview: "Interview",
  review: "Review",
  offer: "Offer",
};

const escape = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface HireMessagesOptions {
  readonly applications: HireApplicationStore;
  readonly identity: IdentityStore;
  readonly mailer: Mailer | null;
  /** Where the web app is: the portal is `${publicUrl}/my`. */
  readonly publicUrl: string;
  readonly now?: () => number;
}

export class HireMessages {
  readonly #o: HireMessagesOptions;
  readonly #now: () => number;

  constructor(o: HireMessagesOptions) {
    this.#o = o;
    this.#now = o.now ?? (() => Date.now());
  }

  async deliver(item: OutboxItem): Promise<ItemOutcome> {
    const org = await this.#o.identity.getOrganisation(toOrgId(item.orgId));
    if (org === null) return { skip: "The organisation is gone" };
    if (org.suspended !== null) return { later: new Date(this.#now() + HELD_FOR_MS) };
    if (this.#o.mailer === null) return { skip: "This server does not send email" };
    const messageId = item.purpose === "mail_message" ? String(item.subject["eventId"] ?? "") : undefined;
    const facts = await this.#o.applications.mailFacts(org.id, String(item.subject["applicationId"] ?? ""), { messageId });
    if (facts === null) return { skip: "The application is gone" };
    const portal = `${this.#o.publicUrl}/my`;
    const job = facts.job.title;
    // Words the company's staff wrote go out only once Parikshaa has verified the company (S18).
    const verified = org.verified !== null;
    let subject: string;
    let lines: string[];
    switch (item.purpose) {
      case "mail_applied":
        if (facts.status === "rejected" && facts.statusReason === "knockout") {
          subject = `Your application to ${org.name}: ${job}`;
          lines = [
            `Hello ${facts.name},`,
            "",
            `Thank you for applying to ${org.name} for ${job}. One of your answers does not meet a requirement the company set for this job, so your application cannot go ahead.`,
            `You can see it, and apply to other jobs, at ${portal}.`,
          ];
        } else {
          subject = `Applied: ${job} at ${org.name}`;
          lines = [
            `Hello ${facts.name},`,
            "",
            `Your application to ${org.name} for ${job} has reached them.`,
            `See where it stands, and what comes next, at ${portal}. Sign in there with this email address.`,
          ];
        }
        break;
      case "mail_withdrawn":
        subject = `Withdrawn: ${job} at ${org.name}`;
        lines = [
          `Hello ${facts.name},`,
          "",
          `You withdrew your application to ${org.name} for ${job}. ${org.name} will not take it further, and it will be erased within 30 days.`,
          `If this was not you, sign in at ${portal} and sign out everywhere.`,
        ];
        break;
      case "mail_moved": {
        if (facts.status !== "active") return { skip: "The application is not going any more" };
        if (facts.round === null || facts.round.id !== item.subject["roundId"]) return { skip: "The application has moved on since" };
        const step = verified ? facts.round.title : ROUND_KIND_NAMES[facts.round.kind];
        subject = `Next step: ${step}, ${job} at ${org.name}`;
        lines = [
          `Hello ${facts.name},`,
          "",
          `Your application to ${org.name} for ${job} has moved to the next step: ${step}.`,
          ...(verified && facts.job.noteToCandidates !== "" ? ["", facts.job.noteToCandidates] : []),
          "",
          `See what comes next at ${portal}. Sign in there with this email address.`,
        ];
        break;
      }
      case "mail_rejected":
        // Restored, or rejected again later (which writes its own mail): this one is not sent.
        if (facts.status !== "rejected" || facts.decidedAt !== item.subject["decidedAt"]) return { skip: "The application was restored" };
        subject = `Your application to ${org.name}: ${job}`;
        lines = [
          `Hello ${facts.name},`,
          "",
          `Thank you for applying to ${org.name} for ${job}, and for the time you gave it. They have decided not to take your application further.`,
          ...(verified && facts.job.rejectionLine !== "" ? ["", facts.job.rejectionLine] : []),
          "",
          `Your other applications, and new jobs, are at ${portal}.`,
        ];
        break;
      case "mail_message":
        if (facts.message === null) return { skip: "The message is gone" };
        if (facts.status === "withdrawn") return { skip: "The candidate withdrew" };
        subject = `A message from ${org.name} about ${job}`;
        lines = verified
          ? [
              `Hello ${facts.name},`,
              "",
              `${org.name} wrote to you about your application for ${job}:`,
              "",
              ...facts.message.split(/\r?\n/),
              "",
              // Without the job's contact address a reply would reach no one at the company (P14).
              facts.job.contactEmail === null
                ? `See the conversation at ${portal}. Replies to this mail do not reach ${org.name}.`
                : `Reply to this mail, or see the conversation at ${portal}.`,
            ]
          : [`Hello ${facts.name},`, "", `${org.name} sent you a message about your application for ${job}.`, `Read it at ${portal}. Sign in there with this email address.`];
        break;
      default:
        return { skip: `No message for ${item.purpose}` };
    }
    lines.push("", NEVER_PAY);
    await this.#o.mailer.send({
      to: facts.email,
      subject,
      text: lines.join("\n"),
      html: lines.map((l) => (l === "" ? "" : `<p>${escape(l)}</p>`)).join(""),
      fromName: `${org.name} via Parikshaa`,
      ...(facts.job.contactEmail === null ? {} : { replyTo: facts.job.contactEmail }),
    });
    return "sent";
  }
}
