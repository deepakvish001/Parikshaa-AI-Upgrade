import { createHmac, timingSafeEqual } from "node:crypto";
import type { OrgId } from "@parikshaa/core";
import { practiceLearner, practiceStaff, type Learner, type OutboxItem, type PracticeSite, type PracticeStore, type PrepEngageStore, type ReminderPrefs } from "@parikshaa/store";
import type { Mailer } from "./delivery.js";
import { PracticeError, istDay, type PracticeService } from "./practice.js";
import type { PrepService } from "./prep.js";

/**
 * Bringing learners back (Prep blueprint F2), and the numbers that show
 * whether it works (§17).
 *
 * A learner with a study plan may turn on a daily email, at an hour they
 * choose. It goes only on a day with something left to do — the day's tasks,
 * or cards due — and once a day at most; every email has a link that turns it
 * off without signing in.
 */

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const istHour = (ms: number) => new Date(ms + 330 * 60_000).getUTCHours();
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Days the console's analytics look back, today included. */
export const ANALYTICS_DAYS = 30;

export class PrepEngage {
  readonly #store: PrepEngageStore;
  readonly #practiceStore: PracticeStore;
  readonly #practice: PracticeService;
  readonly #prep: PrepService;
  readonly #mailer: Mailer | null;
  readonly #secret: string;
  readonly #publicUrl: string;
  readonly #now: () => number;

  constructor(options: {
    store: PrepEngageStore;
    practiceStore: PracticeStore;
    practice: PracticeService;
    prep: PrepService;
    mailer: Mailer | null;
    secret: string;
    publicUrl: string;
    now?: () => number;
  }) {
    this.#store = options.store;
    this.#practiceStore = options.practiceStore;
    this.#practice = options.practice;
    this.#prep = options.prep;
    this.#mailer = options.mailer;
    this.#secret = options.secret;
    this.#publicUrl = options.publicUrl.replace(/\/$/, "");
    this.#now = options.now ?? (() => Date.now());
  }

  // --- a learner's reminder ------------------------------------------------------------------

  async reminder(site: PracticeSite, learner: Learner): Promise<ReminderPrefs & { readonly email: boolean }> {
    return { ...(await this.#store.reminder(practiceLearner(site.orgId, learner.id), learner.id)), email: this.#mailer !== null };
  }

  async saveReminder(site: PracticeSite, learner: Learner, prefs: ReminderPrefs): Promise<ReminderPrefs> {
    if (!Number.isInteger(prefs.hour) || prefs.hour < 0 || prefs.hour > 23) throw new PracticeError("invalid", "An hour is 0 to 23");
    await this.#store.saveReminder(practiceLearner(site.orgId, learner.id), learner.id, prefs);
    return prefs;
  }

  /** The token in an email's "turn this off" link: names the learner, and only this server can make it. */
  offToken(orgId: OrgId, learnerId: string): string {
    return `${learnerId}.${createHmac("sha256", this.#secret).update(`reminders-off:${orgId}:${learnerId}`).digest("base64url").slice(0, 32)}`;
  }

  /** Turn a reminder off from an email's link, without signing in. */
  async turnOff(site: PracticeSite, token: string): Promise<void> {
    const dot = token.lastIndexOf(".");
    const learnerId = dot < 1 ? "" : token.slice(0, dot);
    const given = Buffer.from(token);
    const expected = Buffer.from(this.offToken(site.orgId, learnerId));
    if (learnerId === "" || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new PracticeError("invalid", "That link is not valid");
    const current = await this.#store.reminder(practiceStaff(site.orgId), learnerId);
    await this.#store.saveReminder(practiceStaff(site.orgId), learnerId, { ...current, enabled: false });
  }

  // --- sending ---------------------------------------------------------------------------------

  /**
   * Queue this hour's reminders, for every organisation given: run it every
   * few minutes. Each learner is taken once a day, so running it often, or
   * on several instances, sends nothing twice.
   */
  async queueDue(orgIds: readonly string[]): Promise<number> {
    if (this.#mailer === null) return 0;
    const now = this.#now();
    const day = istDay(now);
    let queued = 0;
    for (const org of orgIds) queued += (await this.#store.takeDue(org as OrgId, day, istHour(now))).length;
    return queued;
  }

  /** The outbox's handler for a reminder: the learner's day, in a few lines. */
  readonly reminderMail = async (item: OutboxItem): Promise<"sent" | { skip: string }> => {
    if (this.#mailer === null) return { skip: "Email is not configured" };
    const learner = await this.#practiceStore.learnerById(item.orgId as OrgId, String(item.subject["learnerId"] ?? ""));
    if (learner === null) return { skip: "The account is gone" };
    // A reminder held up past its day says nothing true any more.
    if (String(item.subject["day"] ?? "") !== istDay(this.#now())) return { skip: "The day has passed" };
    const prefs = await this.#store.reminder(practiceStaff(learner.orgId), learner.id);
    if (!prefs.enabled) return { skip: "Turned off" };
    const site = await this.#practice.siteFor(learner.orgId);
    if (site === null) return { skip: "The site is gone" };
    const day = await this.#prep.digest(site, learner);
    if (day.tasks.length === 0 && day.dueCards === 0) return { skip: "Nothing left today" };
    const home = `${this.#publicUrl}/practice/${site.slug}/home`;
    const off = `${this.#publicUrl}/practice/${site.slug}/reminders?off=${encodeURIComponent(this.offToken(learner.orgId, learner.id))}`;
    const hello = learner.name.trim() === "" ? "Hello," : `Hello ${learner.name},`;
    const lines = [
      ...day.tasks.slice(0, 5).map((t) => `• ${t.title} (${t.estMinutes} min)`),
      ...(day.tasks.length > 5 ? [`• and ${day.tasks.length - 5} more`] : []),
      ...(day.dueCards > 0 ? [`• ${day.dueCards} problem${day.dueCards === 1 ? "" : "s"} to revise`] : []),
    ];
    const streak = day.streak > 0 ? `Your streak is ${day.streak} day${day.streak === 1 ? "" : "s"}: keep it going.` : "Start a streak today.";
    await this.#mailer.send({
      to: learner.email,
      subject: day.tasks.length > 0 ? `${day.tasks.length} task${day.tasks.length === 1 ? "" : "s"} left today on ${site.title}` : `Time to revise on ${site.title}`,
      text: [hello, "", "Left for today:", ...lines, "", streak, "", `Open your plan: ${home}`, "", `Stop these emails: ${off}`].join("\n"),
      html: [
        `<p>${escape(hello)}</p>`,
        `<p>Left for today:</p><ul>${lines.map((l) => `<li>${escape(l.replace(/^• /, ""))}</li>`).join("")}</ul>`,
        `<p>${escape(streak)}</p>`,
        `<p><a href="${escape(home)}">Open your plan</a></p>`,
        `<p style="font-size:small"><a href="${escape(off)}">Stop these emails</a></p>`,
      ].join(""),
    });
    return "sent";
  };

  // --- the numbers -----------------------------------------------------------------------------

  async analytics(orgId: OrgId) {
    const now = this.#now();
    const to = istDay(now);
    return this.#store.analytics(orgId, addDays(to, -(ANALYTICS_DAYS - 1)), to, new Date(now));
  }
}
