import { createHash } from "node:crypto";
import { orgId as toOrgId } from "@parikshaa/core";
import {
  staffScope,
  type ApplicationSource,
  type BlindIndex,
  type CandidateAccount,
  type CandidateStore,
  type DataKeys,
  type HireApplicationStore,
  type HireStore,
  type IdentityStore,
  type Job,
  type Organisation,
  type PortalApplication,
  type PrivacyStore,
  type RoundKind,
  type ScreeningQuestion,
} from "@parikshaa/store";
import { HireRefused, UNVERIFIED_LIMITS } from "./hire.js";

/**
 * Applying to a company's job, and the candidate's own view of where their
 * applications stand (docs/HIRE-V2.md §2, §10 S2, S4, S8, S17, S18, F2, F5,
 * F7; H2b).
 *
 * The job and careers pages are public: anyone may read a published job of a
 * company that is not suspended, and nothing else. Applying needs a candidate
 * session, the notice the candidate was shown (its hash: if the wording has
 * changed since, they are shown the new one), and their resume on file. The
 * application keeps a copy of their profile as it was then.
 *
 * The portal is a projection (S4): which step each application is at and
 * whether it is the candidate's turn, never a score, a note, an AI reading or
 * another applicant.
 */

/** Applications one candidate may make in a day, everywhere (S17). */
export const DAILY_APPLICATIONS = 20;
/** The notice's version: moves on whenever its wording does, so a consent says which it was. */
export const NOTICE_VERSION = "hire-1";
/** Applications withdrawn are erased within this many days (S8). */
const ERASE_WITHDRAWN_DAYS = 30;
const DEFAULT_KEEP_DAYS = 180;
const DAY = 86_400_000;
/** The applicant's mail is held this long at a time while their company is suspended (F2). */
export const HELD_FOR_MS = 3_600_000;

export interface HireContact {
  readonly name: string;
  readonly email: string;
}

/** What a candidate is told before applying (S8), in English and Hindi, and the hash their consent records. */
export interface ApplyNotice {
  readonly version: string;
  readonly en: readonly string[];
  readonly hi: readonly string[];
  readonly hash: string;
  readonly keepDays: number;
  readonly contacts: { readonly company: HireContact | null; readonly parikshaa: HireContact };
}

/** A job as its public page shows it. */
export interface PublicJob {
  readonly company: { readonly name: string; readonly publicId: string; readonly verified: boolean };
  readonly code: string;
  readonly title: string;
  readonly department: string;
  readonly location: string;
  readonly workMode: Job["workMode"];
  readonly employment: Job["employment"];
  readonly expMin: number;
  readonly expMax: number | null;
  readonly ctc: { readonly minLpa: number | null; readonly maxLpa: number | null } | null;
  readonly openings: number;
  readonly applyBy: string | null;
  readonly skillsMust: readonly string[];
  readonly skillsNice: readonly string[];
  readonly description: string;
  readonly noteToCandidates: string;
  /** The questions asked on applying, knockouts shown as such (S23: the candidate knows before applying). */
  readonly questions: readonly ScreeningQuestion[];
  readonly steps: readonly { readonly kind: RoundKind; readonly title: string }[];
  /** Whether it takes applications now, and if not why. */
  readonly accepting: boolean;
  readonly notAccepting: "paused" | "closed" | "past_apply_by" | "full" | null;
  /** Search engines are asked not to list an unverified company's jobs (S18). */
  readonly noindex: boolean;
  readonly notice: ApplyNotice;
}

export interface CareersPage {
  readonly company: { readonly name: string; readonly publicId: string; readonly verified: boolean };
  readonly noindex: boolean;
  readonly jobs: readonly {
    readonly code: string;
    readonly title: string;
    readonly location: string;
    readonly workMode: Job["workMode"];
    readonly employment: Job["employment"];
    readonly expMin: number;
    readonly expMax: number | null;
    readonly publishedAt: string | null;
  }[];
}

export interface ApplyInput {
  readonly company: string;
  readonly code: string;
  readonly answers: Readonly<Record<string, string | number>>;
  readonly noticeHash: string;
  /** "I am 18 or older" (S8). */
  readonly adult: boolean;
  /** "Have a person read my application without AI" (S8). */
  readonly aiOptOut: boolean;
  /** "A laptop with a webcam is available for the test" (P12; never a knockout). */
  readonly deviceReady: boolean | null;
  readonly source: Extract<ApplicationSource, "link" | "careers" | "referral">;
  readonly sourceTag: string | null;
  readonly referrer: string | null;
}

export type StepState = "waiting" | "your_turn" | "done" | "not_moving_forward";

/** One application as the candidate's portal shows it (S4). */
export interface MyApplication {
  readonly id: string;
  readonly company: { readonly name: string; readonly publicId: string; readonly paused: boolean };
  readonly job: { readonly title: string; readonly code: string | null; readonly location: string; readonly closed: boolean };
  readonly appliedAt: string;
  readonly status: "in_progress" | "not_moving_forward" | "withdrawn" | "hired" | "joined" | "did_not_join";
  readonly decidedAt: string | null;
  readonly steps: readonly { readonly kind: RoundKind; readonly title: string; readonly state: StepState; readonly current: boolean }[];
  readonly timeline: readonly { readonly at: string; readonly kind: string }[];
  readonly canWithdraw: boolean;
}

export interface HireApplicationsOptions {
  readonly jobs: HireStore;
  readonly applications: HireApplicationStore;
  readonly accounts: CandidateStore;
  readonly identity: IdentityStore;
  readonly privacy: PrivacyStore;
  readonly keys: DataKeys;
  /** Parikshaa's grievance officer, named in every notice (S8). Null: this server takes no applications. */
  readonly grievance: HireContact | null;
  readonly now?: () => number;
  readonly newId?: () => string;
}

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Bytes as RFC 4648 base32, unpadded. */
function base32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + BASE32[(value << (5 - bits)) & 31] : out;
}

/**
 * An address as one person has it (S17): lower case, without a plus-tag, and
 * for Gmail without dots, so `a.sha+jobs@gmail.com` and `asha@gmail.com` are
 * the same applicant.
 */
export function canonicalEmail(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const gmail = domain === "gmail.com" || domain === "googlemail.com";
  const bare = local.split("+")[0]!;
  return `${gmail ? bare.replace(/\./g, "") : bare}@${gmail ? "gmail.com" : domain}`;
}

/** A phone as compared: its last ten digits. */
const phoneKey = (phone: string) => phone.replace(/\D/g, "").slice(-10);

/** When a job's last day to apply ends: 23:59:59 India time (P1). */
export const applyByEnds = (applyBy: string) => Date.parse(`${applyBy}T23:59:59.999+05:30`);

/** Why an answer does not fit its question, or null. */
function answerProblem(q: ScreeningQuestion, answer: string | number | undefined): string | null {
  if (answer === undefined || answer === "") return q.required ? `"${q.text}" needs an answer` : null;
  if (q.kind === "yes_no" && answer !== "yes" && answer !== "no") return `Answer "${q.text}" with yes or no`;
  if (q.kind === "number" && (typeof answer !== "number" || !Number.isFinite(answer))) return `Answer "${q.text}" with a number`;
  if (q.kind === "choice" && !(q.options ?? []).includes(String(answer))) return `Choose one of the options for "${q.text}"`;
  if (q.kind === "text" && String(answer).length > 1000) return `Keep the answer to "${q.text}" under 1,000 characters`;
  return null;
}

/** Whether an answer misses the question's knockout rule. An unanswered optional question never does. */
function knocksOut(q: ScreeningQuestion, answer: string | number | undefined): boolean {
  const k = q.knockout;
  if (k === undefined || answer === undefined || answer === "") return false;
  if (k.equals !== undefined && answer !== k.equals) return true;
  if (typeof answer === "number" && k.min !== undefined && answer < k.min) return true;
  if (typeof answer === "number" && k.max !== undefined && answer > k.max) return true;
  if (k.oneOf !== undefined && !k.oneOf.includes(String(answer))) return true;
  return false;
}

export class HireApplications {
  readonly #o: HireApplicationsOptions;
  readonly #now: () => number;
  readonly #newId: () => string;
  readonly #hashes: BlindIndex;
  readonly #refs: BlindIndex;

  constructor(o: HireApplicationsOptions) {
    this.#o = o;
    this.#now = o.now ?? (() => Date.now());
    this.#newId = o.newId ?? (() => crypto.randomUUID());
    this.#hashes = o.keys.blind("hire");
    this.#refs = o.keys.blind("hire-ref");
  }

  /** A company that may be shown: it exists and is not suspended (F2: a suspended one has no pages). */
  async #company(publicId: string): Promise<Organisation> {
    const org = /^[A-Za-z0-9-]{3,40}$/.test(publicId) ? await this.#o.identity.organisationByPublicId(publicId) : null;
    if (org === null || org.suspended !== null) throw new HireRefused("not_found", "There is no such job");
    return org;
  }

  async #publishedJob(publicId: string, code: string): Promise<{ readonly org: Organisation; readonly job: Job }> {
    const org = await this.#company(publicId);
    const upper = code.trim().toUpperCase();
    const job = /^[A-Z0-9]{4,12}$/.test(upper) ? await this.#o.jobs.publishedJob(org.id, upper) : null;
    if (job === null) throw new HireRefused("not_found", "There is no such job");
    return { org, job };
  }

  /** How many may apply: the job's own limit, and a hundred until Parikshaa verifies the company (S18). */
  #maxApplicants(org: Organisation, job: Job): number | null {
    if (org.verified !== null) return job.maxApplicants;
    return Math.min(job.maxApplicants ?? UNVERIFIED_LIMITS.applicants, UNVERIFIED_LIMITS.applicants);
  }

  async #notAccepting(org: Organisation, job: Job): Promise<PublicJob["notAccepting"]> {
    if (job.status === "paused") return "paused";
    if (job.status !== "open") return "closed";
    if (job.applyBy !== null && this.#now() > applyByEnds(job.applyBy)) return "past_apply_by";
    const max = this.#maxApplicants(org, job);
    if (max !== null && (await this.#o.applications.taken(org.id, job.id)) >= max) return "full";
    return null;
  }

  /** The notice for a job of this company (S8): the same words give the same hash. */
  async notice(org: Organisation): Promise<ApplyNotice> {
    const parikshaa = this.#o.grievance;
    if (parikshaa === null) throw new HireRefused("unavailable", "This server is not set up to take applications yet");
    const privacy = await this.#o.privacy.get(staffScope(org.id));
    const keepDays = privacy?.retentionDays ?? DEFAULT_KEEP_DAYS;
    const company: HireContact | null = privacy === null ? null : { name: privacy.grievanceName, email: privacy.grievanceEmail };
    const name = org.name;
    const who = company === null ? `Parikshaa's grievance officer, ${parikshaa.name} (${parikshaa.email}), who will pass it on` : `${company.name} (${company.email}) for ${name}`;
    const kaun = company === null ? `Parikshaa ke grievance officer, ${parikshaa.name} (${parikshaa.email}), jo ise aage bhejenge` : `${name} ke liye ${company.name} (${company.email})`;
    const en = [
      `${name} is hiring for this job and decides who moves forward. Parikshaa runs these pages, and the tests and interviews, for ${name}.`,
      "What is collected: your name, email address and phone, the profile and resume you add, your answers to the questions here, and later how you do in each step.",
      "An AI model (Claude, made by Anthropic in the United States) may read your resume and answers to help the team sort applications, so your data leaves India for this. It is not used to train the model. A person makes every decision. Tick the box to have a person read your application without AI.",
      `${name} keeps your application for ${keepDays} days after a decision on it; then it is erased. If you withdraw, it is erased within ${ERASE_WITHDRAWN_DAYS} days.`,
      `Questions or complaints: ${who}; for Parikshaa, ${parikshaa.name} (${parikshaa.email}). After that, the Data Protection Board of India.`,
      "Parikshaa and real employers never ask you to pay to apply or to be hired. If anyone does, report this job.",
    ];
    const hi = [
      `${name} is naukri ke liye bharti kar raha hai aur wahi tay karta hai ki kaun aage badhega. Parikshaa ${name} ke liye ye pages, test aur interview chalata hai.`,
      "Kya liya jaata hai: aapka naam, email aur phone, aapki profile aur resume, yahan ke sawaalon ke jawab, aur baad me har kadam me aapka pradarshan.",
      "Ek AI model (Claude, America ki Anthropic ka) team ki madad ke liye aapka resume aur jawab padh sakta hai, isliye aapka data iske liye Bharat se bahar jaata hai. Isse model ko train nahi kiya jaata. Har faisla ek insaan karta hai. Agar aap chahte hain ki bina AI ke ek insaan aapki application padhe, to box par tick karein.",
      `${name} faisle ke baad aapki application ${keepDays} din rakhta hai, phir use mita diya jaata hai. Aap application wapas lete hain to ${ERASE_WITHDRAWN_DAYS} din ke andar mita di jaati hai.`,
      `Sawaal ya shikayat: ${kaun}; Parikshaa ke liye ${parikshaa.name} (${parikshaa.email}). Uske baad Data Protection Board of India.`,
      "Parikshaa aur asli employers kabhi apply karne ya naukri ke liye paise nahi maangte. Koi maange to is job ko report karein.",
    ];
    const hash = createHash("sha256").update(JSON.stringify({ version: NOTICE_VERSION, en, hi })).digest("base64url");
    return { version: NOTICE_VERSION, en, hi, hash, keepDays, contacts: { company, parikshaa } };
  }

  // --- the public pages (F7) ----------------------------------------------------------

  async publicJob(publicId: string, code: string): Promise<PublicJob> {
    const { org, job } = await this.#publishedJob(publicId, code);
    const notAccepting = await this.#notAccepting(org, job);
    return {
      company: { name: org.name, publicId: org.publicId, verified: org.verified !== null },
      code: job.publicCode!,
      title: job.title,
      department: job.department,
      location: job.location,
      workMode: job.workMode,
      employment: job.employment,
      expMin: job.expMin,
      expMax: job.expMax,
      ctc: job.showCtc ? { minLpa: job.ctcMinLpa, maxLpa: job.ctcMaxLpa } : null,
      openings: job.openings,
      applyBy: job.applyBy,
      skillsMust: job.skillsMust,
      skillsNice: job.skillsNice,
      description: job.description,
      noteToCandidates: job.noteToCandidates,
      questions: job.questions,
      steps: job.rounds.map((r) => ({ kind: r.kind, title: r.title })),
      accepting: notAccepting === null,
      notAccepting,
      noindex: org.verified === null,
      notice: await this.notice(org),
    };
  }

  async careers(publicId: string): Promise<CareersPage> {
    const org = await this.#company(publicId);
    const jobs = await this.#o.jobs.openJobList(org.id);
    return {
      company: { name: org.name, publicId: org.publicId, verified: org.verified !== null },
      noindex: org.verified === null,
      jobs: jobs
        .filter((j) => j.applyBy === null || this.#now() <= applyByEnds(j.applyBy))
        .map((j) => ({
          code: j.publicCode!,
          title: j.title,
          location: j.location,
          workMode: j.workMode,
          employment: j.employment,
          expMin: j.expMin,
          expMax: j.expMax,
          publishedAt: j.publishedAt,
        })),
    };
  }

  // --- applying -----------------------------------------------------------------------

  /** The candidate's stable reference in this company (F5): the same for every job, before and after claiming. */
  ref(orgId: string, emailCanonicalHash: string): string {
    return "A" + base32(Buffer.from(this.#refs.of(orgId, emailCanonicalHash), "base64url")).slice(0, 8);
  }

  async apply(account: CandidateAccount, input: ApplyInput): Promise<{ readonly id: string; readonly status: "active" | "rejected" }> {
    const { org, job } = await this.#publishedJob(input.company, input.code);
    const now = new Date(this.#now());
    const why = await this.#notAccepting(org, job);
    if (why !== null) {
      const message = { paused: "This job is not taking applications for now", closed: "This job is closed", past_apply_by: "The last day to apply has passed", full: "This job has all the applications it can take" }[why];
      throw new HireRefused("conflict", message, [why]);
    }
    const notice = await this.notice(org);
    if (input.noticeHash !== notice.hash) throw new HireRefused("conflict", "The notice has changed since you read it: read it again", ["notice_changed"]);
    if (!input.adult) throw new HireRefused("invalid", "You need to be 18 or older to apply", ["adult"]);

    const problems = job.questions.map((q) => answerProblem(q, input.answers[q.id])).filter((p): p is string => p !== null);
    const unknown = Object.keys(input.answers).filter((id) => !job.questions.some((q) => q.id === id));
    if (unknown.length > 0) problems.push("Some answers are to questions this job does not ask");
    if (problems.length > 0) throw new HireRefused("invalid", "Some answers need a look", problems);

    const profile = await this.#o.accounts.profile(account.id);
    if (profile === null) throw new HireRefused("not_found", "Your account is gone");
    const name = (profile.name ?? account.name ?? "").trim();
    if (name === "") throw new HireRefused("invalid", "Add your name to your profile first", ["name"]);
    if (profile.resume === null) throw new HireRefused("invalid", "Add your resume first", ["resume"]);
    const [text, file] = await Promise.all([this.#o.accounts.resumeText(account.id), this.#o.accounts.resumeFile(account.id)]);
    if (file === null) throw new HireRefused("invalid", "Add your resume first", ["resume"]);

    const since = now.getTime() - DAY;
    const today = (await this.#o.accounts.links(account.id)).filter((l) => Date.parse(l.createdAt) > since).length;
    if (today >= DAILY_APPLICATIONS) throw new HireRefused("limit", `You can make ${DAILY_APPLICATIONS} applications a day; try again tomorrow`, ["daily_limit"]);

    const of = (kind: string, value: string) => this.#hashes.of(org.id, `${kind}:${value}`);
    const emailCanonical = of("email~", canonicalEmail(account.email));
    const id = this.#newId();
    const made = await this.#o.applications.apply(
      org.id,
      {
        id,
        jobId: job.id,
        candidateId: account.id,
        ref: this.ref(org.id, emailCanonical),
        snapshot: {
          name,
          email: account.email,
          phone: profile.phone,
          profile: profile.details,
          answers: input.answers,
          resume: { text: text ?? "", file: file.file, name: file.name, type: file.type },
        },
        hashes: {
          email: of("email", account.email),
          emailCanonical,
          phone: profile.phone === null || phoneKey(profile.phone) === "" ? null : of("phone", phoneKey(profile.phone)),
          resume: of("resume", profile.resume.sha256),
        },
        source: input.source,
        sourceTag: input.sourceTag,
        referrer: input.source === "referral" ? input.referrer : null,
        consent: { version: notice.version, noticeHash: notice.hash },
        aiOptOut: input.aiOptOut,
        deviceReady: input.deviceReady,
        knockedOut: job.questions.filter((q) => knocksOut(q, input.answers[q.id])).map((q) => q.id),
        now,
        outbox: [{ kind: "hire", subject: { applicationId: id }, purpose: "mail_applied", id: `hire:${id}:applied`, sendAfter: now }],
      },
      { maxApplicants: this.#maxApplicants(org, job), reapplyAfterDays: job.reapplyAfterDays },
    );
    switch (made.outcome) {
      case "created":
        await this.#o.accounts.link(account.id, org.id, made.id, now);
        return { id: made.id, status: made.status };
      case "duplicate":
        // A link lost after an earlier application was made is put back here.
        if (made.candidateId === account.id) await this.#o.accounts.link(account.id, org.id, made.id, now);
        throw new HireRefused("conflict", "You have applied to this job already", ["already_applied"]);
      case "too_soon":
        throw new HireRefused("conflict", `You can apply to this job again from ${made.from.slice(0, 10)}`, ["reapply_later"]);
      case "full":
        throw new HireRefused("conflict", "This job has all the applications it can take", ["full"]);
      case "closed":
        throw new HireRefused("conflict", "This job is closed", ["closed"]);
    }
  }

  // --- the portal (S4) ----------------------------------------------------------------

  async mine(account: CandidateAccount): Promise<readonly MyApplication[]> {
    const links = await this.#o.accounts.links(account.id);
    const byOrg = new Map<string, string[]>();
    for (const l of links) byOrg.set(l.orgId, [...(byOrg.get(l.orgId) ?? []), l.applicationId]);
    const out: MyApplication[] = [];
    for (const [orgId, ids] of byOrg) {
      const org = await this.#o.identity.getOrganisation(toOrgId(orgId));
      if (org === null) continue;
      for (const a of await this.#o.applications.forCandidate(org.id, account.id, ids)) out.push(this.#project(org, a));
    }
    return out.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
  }

  async one(account: CandidateAccount, applicationId: string): Promise<MyApplication> {
    const found = await this.#own(account, applicationId);
    return this.#project(found.org, found.application);
  }

  async #own(account: CandidateAccount, applicationId: string): Promise<{ readonly org: Organisation; readonly application: PortalApplication }> {
    const link = (await this.#o.accounts.links(account.id)).find((l) => l.applicationId === applicationId);
    const org = link === undefined ? null : await this.#o.identity.getOrganisation(toOrgId(link.orgId));
    const [application] = org === null ? [] : await this.#o.applications.forCandidate(org.id, account.id, [applicationId]);
    if (org === null || application === undefined) throw new HireRefused("not_found", "There is no such application");
    return { org, application };
  }

  /**
   * Withdraw an application of the candidate's that is still going. Allowed
   * while the company is suspended too: taking one's consent back is never
   * paused (§10 B6).
   */
  async withdraw(account: CandidateAccount, applicationId: string): Promise<MyApplication> {
    const { org } = await this.#own(account, applicationId);
    const now = new Date(this.#now());
    const done = await this.#o.applications.withdraw(org.id, account.id, applicationId, now, [
      { kind: "hire", subject: { applicationId }, purpose: "mail_withdrawn", id: `hire:${applicationId}:withdrawn`, sendAfter: now },
    ]);
    if (!done) throw new HireRefused("conflict", "This application is not going any more", ["not_active"]);
    return this.one(account, applicationId);
  }

  #project(org: Organisation, a: PortalApplication): MyApplication {
    const ended = a.status !== "active";
    const currentIndex = a.rounds.findIndex((r) => r.id === a.roundId);
    const steps = a.rounds.map((r, i) => {
      const current = r.id === a.roundId && !ended;
      let state: StepState;
      if (r.status === "failed" || r.status === "expired" || r.status === "abandoned") state = "not_moving_forward";
      else if (r.status === "done" || r.status === "passed" || r.status === "skipped" || (currentIndex >= 0 && i < currentIndex)) state = "done";
      else if (current && (r.status === "invited" || r.status === "in_progress")) state = "your_turn";
      else if (ended && a.status === "rejected" && r.id === a.roundId) state = "not_moving_forward";
      else state = "waiting";
      return { kind: r.kind, title: r.title, state, current };
    });
    const status: MyApplication["status"] = a.status === "active" || a.status === "invited" || a.status === "not_claimed" ? "in_progress" : a.status === "rejected" ? "not_moving_forward" : a.status;
    return {
      id: a.id,
      company: { name: org.name, publicId: org.publicId, paused: org.suspended !== null },
      job: { title: a.job.title, code: a.job.publicCode, location: a.job.location, closed: a.job.status === "closed" },
      appliedAt: a.createdAt,
      status,
      decidedAt: a.decidedAt,
      steps,
      timeline: a.events.map((e) => ({ at: e.at, kind: e.kind })),
      canWithdraw: a.status === "active",
    };
  }
}

