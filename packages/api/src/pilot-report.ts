import type { OrganisationFacts } from "@parikshaa/store";
import { ist } from "./delivery.js";

/**
 * The pilot report (docs/PILOT.md): every organisation, what it has done, and
 * what the operator should do about it — call an owner whose confirmation
 * email went to spam, top up credits before a sitting, look at messages that
 * failed. Built from {@link OrganisationFacts} alone, so it is the same whether
 * printed for a person or handed on as JSON.
 */

export interface Flag {
  /** "act": something to do today. "watch": worth knowing, nothing to do yet. */
  readonly level: "act" | "watch";
  readonly text: string;
}

const DAY = 24 * 60 * 60 * 1000;
/** The same line the console's Home draws: this few credits left is worth a word. */
const FEW_CREDITS = 5;

const days = (ms: number) => Math.floor(ms / DAY);
/** "opens …", or "is open now, until …" once it has. */
const when = (sitting: { readonly opensAt: string; readonly closesAt: string }, now: number) =>
  Date.parse(sitting.opensAt) <= now ? `is open now, until ${ist(sitting.closesAt)},` : `opens ${ist(sitting.opensAt)}`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function flagsFor(o: OrganisationFacts, now: number): Flag[] {
  const flags: Flag[] = [];
  const age = now - Date.parse(o.createdAt);

  if (o.owner === null) flags.push({ level: "act", text: "No owner account: nobody can sign in to run it" });
  else if (!o.owner.verified) {
    flags.push(
      age >= DAY
        ? { level: "act", text: `The owner has not confirmed their email after ${plural(days(age), "day")}: call them, it may be in spam` }
        : { level: "watch", text: "The owner has not confirmed their email yet" },
    );
  }

  if (o.credits !== null) {
    if (o.credits === 0) flags.push({ level: "act", text: "No attempts left: candidates cannot start a test" });
    else if (o.credits <= FEW_CREDITS) flags.push({ level: "act", text: `Only ${plural(o.credits, "attempt")} left` });
  }
  const next = o.nextSitting;
  if (next !== null && o.credits !== null && next.waiting > o.credits && Date.parse(next.opensAt) - now < 3 * DAY) {
    flags.push({
      level: "act",
      text: `${next.title} ${when(next, now)} with ${plural(next.waiting, "candidate")} yet to begin, and ${plural(o.credits, "credit")} left`,
    });
  }

  if (o.failedMessages > 0) {
    flags.push({ level: "act", text: `${plural(o.failedMessages, "message")} could not be sent: the exam's Candidates tab says why` });
  }
  if (o.overdueMessages > 0) {
    flags.push({ level: "act", text: `${plural(o.overdueMessages, "message")} overdue by more than 15 minutes: is the API running?` });
  }

  if (o.awaitingGrading > 0) flags.push({ level: "watch", text: `${plural(o.awaitingGrading, "attempt")} waiting to be graded` });
  if (o.exams === 0 && age >= 3 * DAY) flags.push({ level: "watch", text: `No exam of its own after ${plural(days(age), "day")}` });
  if (o.lastActivity !== null && now - Date.parse(o.lastActivity) >= 7 * DAY) {
    flags.push({ level: "watch", text: `Nothing done for ${plural(days(now - Date.parse(o.lastActivity)), "day")}` });
  }
  return [...flags.filter((f) => f.level === "act"), ...flags.filter((f) => f.level === "watch")];
}

/** An organisation made by migration and never used: not a pilot, and not worth a line. */
const empty = (o: OrganisationFacts) => o.owner === null && o.staff === 0 && o.exams === 0 && o.invited === 0;

export interface PilotReport {
  readonly generatedAt: string;
  readonly organisations: readonly (OrganisationFacts & { readonly flags: readonly Flag[] })[];
}

/** Most in need first: something to do, then something to watch, then the rest; newest sign-ups first within each. */
export function pilotReport(facts: readonly OrganisationFacts[], now: number): PilotReport {
  const rank = (flags: readonly Flag[]) => (flags.some((f) => f.level === "act") ? 0 : flags.length > 0 ? 1 : 2);
  const organisations = facts
    .filter((o) => !empty(o))
    .map((o) => ({ ...o, flags: flagsFor(o, now) }))
    .sort((a, b) => rank(a.flags) - rank(b.flags) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { generatedAt: new Date(now).toISOString(), organisations };
}

const date = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(new Date(iso));

/** The report as a person reads it in a terminal. */
export function renderReport(report: PilotReport): string {
  const all = report.organisations;
  const calls = all.filter((o) => o.flags.some((f) => f.level === "act")).length;
  const lines = [
    `Pilot report, ${ist(report.generatedAt)}`,
    `${plural(all.length, "organisation")}${all.length === 0 ? "" : `, ${calls === 0 ? "none needs" : `${calls} ${calls === 1 ? "needs" : "need"}`} attention today`}`,
  ];
  for (const o of all) {
    const owner =
      o.owner === null ? "none" : `${o.owner.name} <${o.owner.email}>, ${o.owner.verified ? "email confirmed" : "email NOT confirmed"}`;
    const using = [
      plural(o.exams, "exam"),
      `${o.invited} invited`,
      `${o.started} started`,
      `${o.graded} graded`,
      ...(o.awaitingGrading > 0 ? [`${o.awaitingGrading} to grade`] : []),
    ].join(" · ");
    const credits = o.credits === null ? `not prepaid · ${o.attemptsCharged} charged` : `${o.credits} left · ${o.attemptsCharged} charged`;
    lines.push(
      "",
      `${o.name}  (${o.id})  signed up ${date(o.createdAt)}`,
      `  Owner:    ${owner}${o.staff > 1 ? ` · ${plural(o.staff, "member")} of staff` : ""}`,
      `  Using:    ${using}${o.sampleLoaded ? " · sample loaded" : ""}`,
      `  Credits:  ${credits}`,
      ...(o.nextSitting === null
        ? []
        : [`  Next:     ${o.nextSitting.title}, ${when(o.nextSitting, Date.parse(report.generatedAt)).replace(/,$/, "")} · ${o.nextSitting.waiting} yet to begin`]),
      `  Active:   ${o.lastActivity === null ? "nothing yet" : ist(o.lastActivity)}`,
      ...o.flags.map((f) => `  ${f.level === "act" ? "!" : "·"} ${f.text}`),
    );
  }
  return `${lines.join("\n")}\n`;
}
