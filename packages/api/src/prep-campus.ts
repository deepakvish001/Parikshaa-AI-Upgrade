import type { OrgId } from "@parikshaa/core";
import { CohortNameTaken, practiceStaff, type Cohort, type PrepCampusStore, type PrepPlusStore } from "@parikshaa/store";
import { PracticeError } from "./practice.js";

/**
 * Campus licences (Prep blueprint F16): a college buys Plus for its students.
 * Staff make a cohort and add its students' addresses from a CSV, trying it
 * first as a dry run. An address whose account is verified gets Plus at once;
 * any other gets it when an account with that address is verified, so a
 * stranger who signs up with a student's address gets nothing until the
 * student's inbox has answered. Each address gets a cohort's Plus once.
 */

/** Addresses in one import, at most. */
export const MAX_COHORT_ROWS = 5000;
const EMAIL = /^[^\s@,;"<>]+@[^\s@,;"<>]+\.[^\s@,;"<>]+$/;
const DAY_MS = 86_400_000;

export interface CohortImport {
  /** Lines with something on them, after a header. */
  readonly rows: number;
  /** Addresses new to the cohort. */
  readonly added: number;
  readonly invalid: readonly { readonly line: number; readonly value: string }[];
  /** Addresses given twice in this file. */
  readonly duplicates: number;
  /** Addresses in the cohort before. */
  readonly already: number;
  /** Of those added: verified accounts, given Plus now. */
  readonly givenNow: number;
  /** Of those added: given Plus once an account with the address is verified. */
  readonly onSignup: number;
  readonly dryRun: boolean;
}

/** The addresses in a CSV: the column headed "email", or the first. A header row is optional. */
export function cohortEmails(csv: string): { emails: string[]; invalid: { line: number; value: string }[]; duplicates: number; rows: number } {
  const lines = csv.replace(/^﻿/, "").split(/\r?\n/);
  const cells = (line: string) => line.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1").trim());
  let column = 0;
  let start = 0;
  const head = cells(lines[0] ?? "").map((c) => c.toLowerCase());
  if (!head.some((c) => EMAIL.test(c))) {
    const at = head.findIndex((c) => c === "email" || c === "e-mail" || c === "email address");
    if (at >= 0) column = at;
    start = 1;
  }
  const emails: string[] = [];
  const seen = new Set<string>();
  const invalid: { line: number; value: string }[] = [];
  let duplicates = 0;
  let rows = 0;
  for (let i = start; i < lines.length; i++) {
    if (lines[i]!.trim() === "") continue;
    rows++;
    const value = (cells(lines[i]!)[column] ?? "").toLowerCase();
    if (!EMAIL.test(value) || value.length > 254) {
      invalid.push({ line: i + 1, value: value.slice(0, 80) });
    } else if (seen.has(value)) {
      duplicates++;
    } else {
      seen.add(value);
      emails.push(value);
    }
  }
  return { emails, invalid, duplicates, rows };
}

export class PrepCampus {
  readonly #store: PrepCampusStore;
  readonly #plus: PrepPlusStore;
  readonly #now: () => number;

  constructor(options: { store: PrepCampusStore; plus: PrepPlusStore; now?: () => number }) {
    this.#store = options.store;
    this.#plus = options.plus;
    this.#now = options.now ?? (() => Date.now());
  }

  async createCohort(orgId: OrgId, createdBy: string, draft: { name: string; plusDays: number }): Promise<Cohort> {
    const name = draft.name.trim();
    if (name.length < 1 || name.length > 120) throw new PracticeError("invalid", "A cohort's name is 1 to 120 characters");
    if (!Number.isInteger(draft.plusDays) || draft.plusDays < 1 || draft.plusDays > 1100) throw new PracticeError("invalid", "Plus is given for 1 to 1,100 days");
    try {
      return await this.#store.createCohort(orgId, { name, plusDays: draft.plusDays, createdBy }, new Date(this.#now()));
    } catch (error) {
      if (error instanceof CohortNameTaken) throw new PracticeError("slug_taken", "A cohort has that name already");
      throw error;
    }
  }

  async #cohort(orgId: OrgId, id: string): Promise<Cohort> {
    const cohort = await this.#store.cohort(orgId, id);
    if (cohort === null) throw new PracticeError("not_found", "No such cohort");
    return cohort;
  }

  /** Add a CSV of addresses to a cohort; or, as a dry run, say what adding it would do. */
  async importCsv(orgId: OrgId, cohortId: string, csv: string, dryRun: boolean): Promise<CohortImport> {
    const cohort = await this.#cohort(orgId, cohortId);
    const parsed = cohortEmails(csv);
    if (parsed.rows > MAX_COHORT_ROWS) throw new PracticeError("invalid", `Import at most ${MAX_COHORT_ROWS.toLocaleString("en-IN")} addresses at a time`);
    if (parsed.rows === 0) throw new PracticeError("invalid", "The file has no addresses");
    const inCohort = new Set((await this.#store.members(orgId, cohortId)).map((m) => m.email));
    const fresh = parsed.emails.filter((e) => !inCohort.has(e));
    const verified = new Map((await this.#store.accounts(orgId, fresh)).filter((a) => a.verified).map((a) => [a.email, a.id]));
    const now = fresh.filter((e) => verified.has(e));
    if (!dryRun) {
      await this.#store.addMembers(orgId, cohortId, fresh, new Date(this.#now()));
      for (const email of now) await this.#give(orgId, cohort, verified.get(email)!, email);
    }
    return {
      rows: parsed.rows,
      added: fresh.length,
      invalid: parsed.invalid,
      duplicates: parsed.duplicates,
      already: parsed.emails.length - fresh.length,
      givenNow: now.length,
      onSignup: fresh.length - now.length,
      dryRun,
    };
  }

  /** A learner's address was verified: give them what any cohort holds for it. */
  async claim(orgId: OrgId, learner: { readonly id: string; readonly email: string }): Promise<number> {
    const owed = await this.#store.owed(orgId, learner.email);
    for (const cohort of owed) await this.#give(orgId, cohort, learner.id, learner.email.toLowerCase());
    return owed.length;
  }

  async #give(orgId: OrgId, cohort: Cohort, learnerId: string, email: string): Promise<void> {
    const now = this.#now();
    const spans = (await this.#plus.plus(practiceStaff(orgId), learnerId)).filter((s) => s.pass === "plus");
    const from = Math.max(now, ...spans.map((s) => Date.parse(s.endsAt)));
    const until = new Date(from + cohort.plusDays * DAY_MS);
    // The grant's key is the cohort and the address: the same student is never given it twice.
    await this.#plus.grantPlus(orgId, learnerId, { startsAt: new Date(from), endsAt: until, source: "grant", ref: `cohort:${cohort.id}:${email}` });
    await this.#store.markGranted(orgId, cohort.id, email, learnerId, until, new Date(now));
  }

  /** Every cohort, with how far its students have got. */
  async cohorts(orgId: OrgId) {
    const [cohorts, students] = await Promise.all([this.#store.cohorts(orgId), this.#store.students(orgId)]);
    const weekAgo = this.#now() - 7 * DAY_MS;
    return cohorts.map((c) => {
      const mine = students.filter((m) => m.cohortId === c.id);
      const joined = mine.filter((m) => m.learnerId !== null);
      return {
        ...c,
        members: mine.length,
        joined: joined.length,
        given: mine.filter((m) => m.plusUntil !== null).length,
        active7: joined.filter((m) => m.lastActiveAt !== null && Date.parse(m.lastActiveAt) >= weekAgo).length,
        solved: joined.reduce((sum, m) => sum + m.solved, 0),
      };
    });
  }

  /** One cohort's students, each on a line. */
  async cohortReport(orgId: OrgId, cohortId: string) {
    const cohort = await this.#cohort(orgId, cohortId);
    const students = await this.#store.students(orgId, cohortId);
    return { cohort, students: students.map(({ cohortId: _, learnerId, ...s }) => ({ ...s, joined: learnerId !== null })) };
  }
}
