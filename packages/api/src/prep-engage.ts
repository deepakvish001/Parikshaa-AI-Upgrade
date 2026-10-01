import { createHmac, timingSafeEqual } from "node:crypto";
import type { OrgId } from "@parikshaa/core";
import { practiceLearner, practiceStaff, type Learner, type OutboxItem, type PracticeSite, type PracticeStore, type PrepEngageStore, type PushSubscriptionRecord, type ReminderPrefs } from "@parikshaa/store";
import type { Mailer } from "./delivery.js";
import { isPushEndpoint, type PushSender } from "./push.js";
import { PracticeError, istDay, type PracticeService } from "./practice.js";
import type { PrepService } from "./prep.js";

/**
 * Bringing learners back (Prep blueprint F2), and the numbers that show
 * whether it works (§17).
 *
 * A learner with a study plan may turn on a daily email, at an hour they
 * choose. It goes only on a day with something left to do — the day's tasks,
 * or cards due — and once a day at most; every email has a link that turns it
 * off without signing in. A learner who allows it gets the same reminder as a
 * notification on each browser they allowed it in (`push.ts`).
 */

/** Browsers a learner may take notifications in. */
export const PUSH_DEVICES = 10;

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
  readonly #push: PushSender | null;
  readonly #secret: string;
  readonly #publicUrl: string;
  readonly #now: () => number;

  constructor(options: {
    store: PrepEngageStore;
    practiceStore: PracticeStore;
    practice: PracticeService;
    prep: PrepService;
    mailer: Mailer | null;
    push?: PushSender | null;
    secret: string;
    publicUrl: string;
    now?: () => number;
  }) {
    this.#store = options.store;
    this.#practiceStore = options.practiceStore;
    this.#practice = options.practice;
    this.#prep = options.prep;
    this.#mailer = options.mailer;
    this.#push = options.push ?? null;
    this.#secret = options.secret;
    this.#publicUrl = options.publicUrl.replace(/\/$/, "");
    this.#now = options.now ?? (() => Date.now());
  }

  // --- a learner's reminder ------------------------------------------------------------------

  async reminder(site: PracticeSite, learner: Learner): Promise<ReminderPrefs & { readonly email: boolean; readonly push: boolean; readonly devices: number }> {
    const scope = practiceLearner(site.orgId, learner.id);
    const [prefs, devices] = await Promise.all([this.#store.reminder(scope, learner.id), this.#push === null ? [] : this.#store.pushes(scope, learner.id)]);
    return { ...prefs, email: this.#mailer !== null, push: this.#push !== null, devices: devices.length };
  }

  // --- push notifications ------------------------------------------------------------------

  /** The key a browser subscribes with; null when this server sends no notifications. */
  pushKey(): string | null {
    return this.#push?.publicKey ?? null;
  }

  /** Take the reminder on this browser too. */
  async subscribe(site: PracticeSite, learner: Learner, sub: PushSubscriptionRecord): Promise<void> {
    if (this.#push === null) throw new PracticeError("unavailable", "This site does not send notifications");
    if (!isPushEndpoint(sub.endpoint) || sub.endpoint.length > 1000) throw new PracticeError("invalid", "That is not a browser's push address");
    if (!/^[A-Za-z0-9_-]{20,200}={0,2}$/.test(sub.p256dh) || !/^[A-Za-z0-9_-]{8,100}={0,2}$/.test(sub.auth)) throw new PracticeError("invalid", "Those are not a browser's push keys");
    const mine = await this.#store.pushes(practiceLearner(site.orgId, learner.id), learner.id);
    if (!mine.some((m) => m.endpoint === sub.endpoint) && mine.length >= PUSH_DEVICES) throw new PracticeError("invalid", `Notifications go to ${PUSH_DEVICES} browsers at most: turn one off first`);
    // Staff scope: the same browser may have been another learner's, whose subscription ends here.
    await this.#store.addPush(practiceStaff(site.orgId), learner.id, sub);
  }

  async unsubscribe(site: PracticeSite, learner: Learner, endpoint: string): Promise<void> {
    await this.#store.removePush(practiceLearner(site.orgId, learner.id), learner.id, endpoint);
  }

  /** Send to each of a learner's browsers; one the push service has forgotten is forgotten here too. */
  async #notify(learner: Learner, message: Parameters<PushSender["send"]>[1]): Promise<number> {
    if (this.#push === null) return 0;
    let sent = 0;
    for (const sub of await this.#store.pushes(practiceStaff(learner.orgId), learner.id)) {
      if ((await this.#push.send(sub, message)) === "gone") await this.#store.removePush(practiceStaff(learner.orgId), learner.id, sub.endpoint);
      else sent++;
    }
    return sent;
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
    if (this.#mailer === null && this.#push === null) return 0;
    const now = this.#now();
    const day = istDay(now);
    let queued = 0;
    for (const org of orgIds) queued += (await this.#store.takeDue(org as OrgId, day, istHour(now))).length;
    return queued;
  }

  /** The outbox's handler for a reminder: the learner's day, in a few lines. */
  readonly reminderMail = async (item: OutboxItem): Promise<"sent" | { skip: string }> => {
    if (this.#mailer === null && this.#push === null) return { skip: "Email is not configured" };
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
    const subject = day.tasks.length > 0 ? `${day.tasks.length} task${day.tasks.length === 1 ? "" : "s"} left today on ${site.title}` : `Time to revise on ${site.title}`;
    const pushed = await this.#notify(learner, {
      title: subject,
      body: [...lines.slice(0, 3).map((l) => l.replace(/^• /, "")), streak].join("\n"),
      url: `/practice/${site.slug}/home`,
      tag: `reminder:${site.slug}`,
    });
    if (this.#mailer === null) return pushed > 0 ? "sent" : { skip: "No browser to notify" };
    await this.#mailer.send({
      to: learner.email,
      subject,
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

  /** Queue the email that says a plan now ends after its deadline. Only for a learner who asked for email. */
  async queueLate(site: PracticeSite, learner: Learner, plan: { finishOn: string; deadline: string }): Promise<void> {
    if (this.#mailer === null) return;
    const prefs = await this.#store.reminder(practiceStaff(site.orgId), learner.id);
    if (!prefs.enabled) return;
    await this.#store.queueLate(site.orgId, learner.id, plan.finishOn, plan.deadline, istDay(this.#now()));
  }

  /** The outbox's handler for that email: when the plan now ends, and how to change it. */
  readonly lateMail = async (item: OutboxItem): Promise<"sent" | { skip: string }> => {
    if (this.#mailer === null) return { skip: "Email is not configured" };
    const learner = await this.#practiceStore.learnerById(item.orgId as OrgId, String(item.subject["learnerId"] ?? ""));
    if (learner === null) return { skip: "The account is gone" };
    if (!(await this.#store.reminder(practiceStaff(learner.orgId), learner.id)).enabled) return { skip: "Turned off" };
    const site = await this.#practice.siteFor(learner.orgId);
    if (site === null) return { skip: "The site is gone" };
    const finishOn = String(item.subject["finishOn"] ?? "");
    const deadline = String(item.subject["deadline"] ?? "");
    const plan = `${this.#publicUrl}/practice/${site.slug}/plan`;
    const off = `${this.#publicUrl}/practice/${site.slug}/reminders?off=${encodeURIComponent(this.offToken(learner.orgId, learner.id))}`;
    const hello = learner.name.trim() === "" ? "Hello," : `Hello ${learner.name},`;
    const said = `Your study plan now finishes on ${finishOn}, after your deadline of ${deadline}: days with work left undone moved it.`;
    const choices = "You can study a little more each day, move the deadline, or plan only what fits. All three are on your plan page.";
    await this.#mailer.send({
      to: learner.email,
      subject: `Your plan on ${site.title} now ends after your deadline`,
      text: [hello, "", said, "", choices, "", `Change your plan: ${plan}`, "", `Stop these emails: ${off}`].join("\n"),
      html: [
        `<p>${escape(hello)}</p>`,
        `<p>${escape(said)}</p>`,
        `<p>${escape(choices)}</p>`,
        `<p><a href="${escape(plan)}">Change your plan</a></p>`,
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
