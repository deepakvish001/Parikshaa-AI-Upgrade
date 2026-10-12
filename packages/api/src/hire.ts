import { randomInt } from "node:crypto";
import type { OrgId } from "@parikshaa/core";
import { PublicCodeTaken, type HireStore, type IdentityStore, type Job, type JobFields, type JobSummary, type RoundFields, type RoundKind, type ScreeningQuestion } from "@parikshaa/store";
import { Forbidden } from "./service.js";
import { can, type Actor, type Permission } from "./staff-auth.js";

/**
 * A company's jobs for Hire (docs/HIRE-V2.md §1, §3, §10; H2a): writing a job,
 * its screening questions and its rounds, and publishing, pausing and closing
 * it. Who may: `hire:manage` to change, `hire:review` to read; a hiring
 * manager reads only the jobs they manage (F6).
 *
 * A company Parikshaa has not verified yet may hire, within limits (S18): two
 * open jobs, a hundred applications a job, no AI screening, and a job whose
 * wording asks applicants for money is held for Parikshaa to read first.
 */

export class HireRefused extends Error {
  constructor(
    /** unavailable: this server is not set up for it (no grievance officer to name, H2b). */
    readonly code: "not_found" | "invalid" | "limit" | "conflict" | "unavailable",
    message: string,
    readonly problems: readonly string[] = [],
  ) {
    super(message);
    this.name = "HireRefused";
  }
}

/** What a company sends for a job: the fields, and the rounds in order (a round sent with its id keeps it). */
export interface JobInput extends JobFields {
  readonly rounds?: readonly (RoundFields & { readonly id?: string | undefined })[] | undefined;
}

export const DEFAULT_ROUNDS: readonly RoundFields[] = [
  { kind: "screen", title: "Screening", config: {} },
  { kind: "assessment", title: "Online test", config: { daysToComplete: 3 } },
  { kind: "ai_interview", title: "AI interview", config: { questions: 4, minutes: 20, passRating: 3 } },
  { kind: "interview", title: "Interview", config: { minutes: 45, panel: [], passRating: 3 } },
  { kind: "review", title: "Hiring manager review", config: {} },
  { kind: "offer", title: "Offer", config: {} },
];

/** Until verified (S18): open jobs, applications per job. */
export const UNVERIFIED_LIMITS = { openJobs: 2, applicants: 100 } as const;
const MAX_QUESTIONS = 10;
const MAX_ROUNDS = 10;

/**
 * Knockouts that would turn people away for who they are (S23). A job may
 * not end an application on any of these, however the question is worded.
 */
const PROTECTED =
  /\b(age|aged|how old|years old|date of birth|dob|born in|birth ?year|gender|sex|male|female|married|marital|marriage|spouse|husband|wife|pregnan\w*|children|kids|family planning|religio\w*|caste|hindu|muslim|christian|sikh|jain|buddhist|parsi|dalit|sc\/st|obc|disab\w*|handicap\w*|differently.abled)\b/i;

/** Wording that asks applicants for money, which real employers never do (S18). */
const ASKS_FOR_MONEY =
  /\b(registration (fee|charge|amount)|security (deposit|amount|money)|refundable|processing fee|training fee|deposit (of|amount)|pay (rs\.?|₹|inr)|fee of (rs\.?|₹|inr)|₹\s?\d[\d,]*\s?(as )?(deposit|fee))/i;

/** A job's address within the company's: six characters that read aloud without confusion. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newPublicCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

export interface HireOptions {
  readonly store: HireStore;
  readonly identity: IdentityStore;
  readonly recordAudit: (actor: Actor, action: string, target: string, detail?: Record<string, unknown>) => Promise<void>;
  readonly now?: () => number;
  readonly newId?: () => string;
}

export class HireService {
  readonly #store: HireStore;
  readonly #identity: IdentityStore;
  readonly #audit: HireOptions["recordAudit"];
  readonly #now: () => number;
  readonly #newId: () => string;

  constructor(o: HireOptions) {
    this.#store = o.store;
    this.#identity = o.identity;
    this.#audit = o.recordAudit;
    this.#now = o.now ?? (() => Date.now());
    this.#newId = o.newId ?? (() => crypto.randomUUID());
  }

  #require(actor: Actor, permission: Permission): void {
    if (!can(actor, permission)) throw new Forbidden(permission);
  }

  /** Whether this actor sees this job: a hiring manager only the jobs they manage. */
  #sees(actor: Actor, job: Pick<Job, "managers">): boolean {
    return !(actor.kind === "user" && actor.role === "hiring_manager") || job.managers.includes(actor.id);
  }

  async #verified(orgId: OrgId): Promise<boolean> {
    return (await this.#identity.getOrganisation(orgId))?.verified != null;
  }

  async #find(actor: Actor, id: string): Promise<Job> {
    const job = await this.#store.job(actor.orgId, id);
    if (job === null || !this.#sees(actor, job)) throw new HireRefused("not_found", "There is no such job");
    return job;
  }

  // --- reading ------------------------------------------------------------------

  async jobs(actor: Actor): Promise<readonly JobSummary[]> {
    this.#require(actor, "hire:review");
    const all = await this.#store.jobs(actor.orgId, new Date(this.#now()));
    if (!(actor.kind === "user" && actor.role === "hiring_manager")) return all;
    const mine = new Set<string>();
    for (const row of all) {
      const job = await this.#store.job(actor.orgId, row.id);
      if (job !== null && this.#sees(actor, job)) mine.add(row.id);
    }
    return all.filter((row) => mine.has(row.id));
  }

  async job(actor: Actor, id: string): Promise<Job> {
    this.#require(actor, "hire:review");
    return this.#find(actor, id);
  }

  // --- writing ------------------------------------------------------------------

  /** Check a job's fields and rounds; the problems, in words, if any. */
  async #check(orgId: OrgId, input: JobInput, rounds: readonly RoundFields[], verified: boolean): Promise<JobFields> {
    const problems: string[] = [];
    if (input.expMax !== null && input.expMax < input.expMin) problems.push("The most experience is less than the least.");
    if (input.ctcMinLpa !== null && input.ctcMaxLpa !== null && input.ctcMaxLpa < input.ctcMinLpa) problems.push("The highest CTC is less than the lowest.");
    if (input.questions.length > MAX_QUESTIONS) problems.push(`At most ${MAX_QUESTIONS} screening questions.`);
    problems.push(...questionProblems(input.questions));
    problems.push(...roundProblems(rounds));
    const staff = new Map((await this.#identity.listUsers(orgId)).map((u) => [u.id, u]));
    for (const id of input.managers) {
      const person = staff.get(id);
      if (person === undefined || person.disabled) problems.push("A hiring manager is not a member of staff here.");
      else if (person.role === "invigilator") problems.push(`${person.name} cannot review applicants: give them another role first.`);
    }
    if (problems.length > 0) throw new HireRefused("invalid", "The job cannot be saved as it is", problems);
    // Until Parikshaa verifies the company: no AI screening, and at most a hundred applications (S18, P1).
    if (verified) return input;
    return {
      ...input,
      autoScreen: false,
      maxApplicants: Math.min(input.maxApplicants ?? UNVERIFIED_LIMITS.applicants, UNVERIFIED_LIMITS.applicants),
    };
  }

  async create(actor: Actor, input: JobInput): Promise<Job> {
    this.#require(actor, "hire:manage");
    const rounds = input.rounds ?? DEFAULT_ROUNDS;
    const fields = await this.#check(actor.orgId, input, rounds, await this.#verified(actor.orgId));
    const job = await this.#store.createJob(actor.orgId, {
      id: this.#newId(),
      fields,
      rounds,
      createdBy: actor.kind === "user" ? actor.id : null,
      now: new Date(this.#now()),
    });
    await this.#audit(actor, "hire.job_created", job.id, { rounds: job.rounds.length });
    return job;
  }

  async update(actor: Actor, id: string, input: JobInput): Promise<Job> {
    this.#require(actor, "hire:manage");
    const job = await this.#find(actor, id);
    if (job.status === "closed") throw new HireRefused("conflict", "This job is closed. Open it again, or make a copy");
    const rounds = input.rounds ?? job.rounds;
    const inUse = await this.#store.roundsInUse(actor.orgId, id);
    const kept = new Set(rounds.map((r) => ("id" in r ? r.id : undefined)).filter((r): r is string => r !== undefined));
    const known = new Set(job.rounds.map((r) => r.id));
    if ([...kept].some((r) => !known.has(r))) throw new HireRefused("invalid", "A round is not one of this job's");
    const dropped = [...inUse].filter((r) => !kept.has(r));
    if (dropped.length > 0) throw new HireRefused("conflict", "A round that applicants have reached cannot be removed");
    const fields = await this.#check(actor.orgId, input, rounds, await this.#verified(actor.orgId));
    const saved = await this.#store.updateJob(actor.orgId, id, fields, rounds, new Date(this.#now()));
    if (saved === null) throw new HireRefused("not_found", "There is no such job");
    // Changed wording on a published job is read again for asking money (S18).
    if (saved.status === "open" && !(await this.#verified(actor.orgId)) && asksForMoney(saved)) {
      return this.#hold(actor, saved);
    }
    await this.#audit(actor, "hire.job_saved", id, { rounds: saved.rounds.length });
    return saved;
  }

  async #hold(actor: Actor, job: Job): Promise<Job> {
    const held = await this.#store.setStatus(actor.orgId, job.id, {
      status: "held",
      now: new Date(this.#now()),
      heldReason: "The job's wording asks applicants for money. Parikshaa reads such jobs before they open.",
    });
    await this.#audit(actor, "hire.job_held", job.id, {});
    return held!;
  }

  /**
   * Open the job to applicants. Its address is made the first time and kept.
   * An unverified company's job that asks for money is held instead (S18).
   */
  async publish(actor: Actor, id: string): Promise<Job> {
    this.#require(actor, "hire:manage");
    const job = await this.#find(actor, id);
    if (job.status === "open") return job;
    if (job.status === "held") throw new HireRefused("conflict", "This job is waiting for Parikshaa to read it");
    const today = new Date(this.#now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
    if (job.applyBy !== null && job.applyBy < today) throw new HireRefused("invalid", "The last day to apply has passed. Change it first");
    const verified = await this.#verified(actor.orgId);
    if (!verified) {
      if (asksForMoney(job)) return this.#hold(actor, job);
      if ((await this.#store.openJobs(actor.orgId)) >= UNVERIFIED_LIMITS.openJobs) {
        throw new HireRefused("limit", `Until Parikshaa verifies your company, ${UNVERIFIED_LIMITS.openJobs} jobs can be open at a time`);
      }
    }
    for (let tries = 0; ; tries++) {
      try {
        const open = await this.#store.setStatus(actor.orgId, id, { status: "open", now: new Date(this.#now()), publicCode: newPublicCode() });
        await this.#audit(actor, "hire.job_published", id, {});
        return open!;
      } catch (error) {
        if (!(error instanceof PublicCodeTaken) || tries >= 5) throw error;
      }
    }
  }

  async pause(actor: Actor, id: string): Promise<Job> {
    this.#require(actor, "hire:manage");
    const job = await this.#find(actor, id);
    if (job.status !== "open") throw new HireRefused("conflict", "Only an open job can be paused");
    const paused = await this.#store.setStatus(actor.orgId, id, { status: "paused", now: new Date(this.#now()) });
    await this.#audit(actor, "hire.job_paused", id, {});
    return paused!;
  }

  async close(actor: Actor, id: string): Promise<Job> {
    this.#require(actor, "hire:manage");
    const job = await this.#find(actor, id);
    if (job.status === "closed") return job;
    const closed = await this.#store.setStatus(actor.orgId, id, { status: "closed", now: new Date(this.#now()) });
    await this.#audit(actor, "hire.job_closed", id, {});
    return closed!;
  }

  /** A new draft with everything the job says and its rounds (P20). */
  async duplicate(actor: Actor, id: string): Promise<Job> {
    this.#require(actor, "hire:manage");
    const job = await this.#find(actor, id);
    const copy = await this.create(actor, {
      ...job,
      title: `${job.title} (copy)`.slice(0, 200),
      applyBy: null,
      rounds: job.rounds.map(({ kind, title, config }) => ({ kind, title, config })),
    });
    await this.#audit(actor, "hire.job_duplicated", copy.id, { from: id });
    return copy;
  }

  /** Delete a draft nobody has applied to. */
  async remove(actor: Actor, id: string): Promise<void> {
    this.#require(actor, "hire:manage");
    await this.#find(actor, id);
    if (!(await this.#store.deleteDraft(actor.orgId, id))) throw new HireRefused("conflict", "Only a draft nobody applied to can be deleted. Close it instead");
    await this.#audit(actor, "hire.job_deleted", id, {});
  }
}

/** Whether a job's own words ask applicants for money (S18). */
export const asksForMoney = (job: Pick<JobFields, "title" | "description" | "noteToCandidates">): boolean =>
  ASKS_FOR_MONEY.test(`${job.title}\n${job.description}\n${job.noteToCandidates}`);

/** What is wrong with a job's screening questions, in words. */
export function questionProblems(questions: readonly ScreeningQuestion[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const [n, q] of questions.entries()) {
    const which = `Question ${n + 1}`;
    if (ids.has(q.id)) problems.push(`${which} has the same id as another.`);
    ids.add(q.id);
    if (q.kind === "choice" && (q.options === undefined || q.options.length < 2)) problems.push(`${which} needs at least two choices.`);
    if (q.kind !== "choice" && q.options !== undefined && q.options.length > 0) problems.push(`${which} has choices but is not a choice question.`);
    const k = q.knockout;
    if (k === undefined) continue;
    if (PROTECTED.test(q.text) || (q.options ?? []).some((o) => PROTECTED.test(o))) {
      problems.push(`${which} cannot turn applicants away: it is about age, gender, marriage, family, religion, caste or disability.`);
    }
    const ok =
      (q.kind === "yes_no" && k.equals !== undefined && k.min === undefined && k.max === undefined && k.oneOf === undefined) ||
      (q.kind === "number" && (k.min !== undefined || k.max !== undefined) && k.equals === undefined && k.oneOf === undefined) ||
      (q.kind === "choice" && k.oneOf !== undefined && k.oneOf.length > 0 && k.oneOf.every((o) => q.options?.includes(o) === true) && k.equals === undefined);
    if (!ok) problems.push(`${which}'s knockout does not fit its kind of answer.`);
    if (q.kind === "text") problems.push(`${which} is answered in words, which cannot turn anyone away.`);
  }
  return problems;
}

/** What is wrong with a job's rounds, in words: at most one screen and it comes first; one offer, last. */
export function roundProblems(rounds: readonly { readonly kind: RoundKind; readonly config: Readonly<Record<string, unknown>> }[]): string[] {
  const problems: string[] = [];
  if (rounds.length === 0) return ["A job needs at least its offer round."];
  if (rounds.length > MAX_ROUNDS) problems.push(`At most ${MAX_ROUNDS} rounds.`);
  const screens = rounds.filter((r) => r.kind === "screen").length;
  if (screens > 1) problems.push("At most one screening round.");
  if (screens === 1 && rounds[0]!.kind !== "screen") problems.push("The screening round comes first.");
  if (rounds.filter((r) => r.kind === "offer").length !== 1 || rounds.at(-1)!.kind !== "offer") problems.push("The offer is the last round, and there is one.");
  for (const [n, r] of rounds.entries()) {
    const c = r.config;
    const number = (key: string, min: number, max: number) => {
      const v = c[key];
      if (v !== undefined && (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)) problems.push(`Round ${n + 1}: ${key} must be between ${min} and ${max}.`);
    };
    if (r.kind === "assessment") {
      number("daysToComplete", 1, 14);
      number("passPercent", 0, 100);
    }
    if (r.kind === "ai_interview") {
      number("questions", 2, 8);
      number("minutes", 10, 90);
      number("passRating", 1, 5);
    }
    if (r.kind === "interview") {
      number("minutes", 15, 240);
      number("passRating", 1, 5);
    }
  }
  return problems;
}
