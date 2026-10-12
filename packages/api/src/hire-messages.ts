import { orgId as toOrgId } from "@parikshaa/core";
import type { HireApplicationStore, IdentityStore, OutboxItem } from "@parikshaa/store";
import type { ItemOutcome, Mailer } from "./delivery.js";
import { HELD_FOR_MS } from "./hire-apply.js";

/**
 * Hire's mail to applicants (docs/HIRE-V2.md §1 outbox kind `hire`, §10 F2,
 * S18; H2b). Each message is built when it is sent, from the application as it
 * then stands. While the company is suspended its mail waits, an hour at a
 * time, rather than being dropped (F2). Every message says that Parikshaa and
 * real employers never ask for money (S18).
 */

const NEVER_PAY = "Parikshaa and real employers never ask you to pay to apply or to be hired. If anyone does, report the job from its page.";

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
    const facts = await this.#o.applications.mailFacts(org.id, String(item.subject["applicationId"] ?? ""));
    if (facts === null) return { skip: "The application is gone" };
    const portal = `${this.#o.publicUrl}/my`;
    const job = facts.job.title;
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
      default:
        return { skip: `No message for ${item.purpose}` };
    }
    lines.push("", NEVER_PAY);
    await this.#o.mailer.send({
      to: facts.email,
      subject,
      text: lines.join("\n"),
      html: lines.map((l) => (l === "" ? "" : `<p>${escape(l)}</p>`)).join(""),
    });
    return "sent";
  }
}
