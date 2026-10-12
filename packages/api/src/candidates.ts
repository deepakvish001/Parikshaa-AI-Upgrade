import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { BlindIndex, CandidateAccount, CandidateProfile, CandidateStore, CodePurpose, DataKeys } from "@parikshaa/store";
import type { Mailer } from "./delivery.js";
import { readResume } from "./resume.js";

/**
 * Candidate accounts for Hire (docs/HIRE-V2.md §1, §10 S5, S19, F4, F22; H1a).
 *
 * One account per person, for every company they apply to. They sign in with
 * a six-digit code mailed to them: no password to reuse or be phished for, and
 * the account is made only once a code sent to the address is entered. The
 * answer to "send me a code" is the same whether or not the address has an
 * account. Mail about the account (not about an application) has no
 * organisation, so it goes to the mailer directly, never through the outbox.
 */

const SESSION_PREFIX = "pc_";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const CODE_TTL_MS = 10 * MINUTE;
/** A session on a shared device ends the same day; the browser keeps it only for the tab (S19). */
const SESSION_TTL_MS = 12 * HOUR;
/** "Keep me signed in on this device": 14 days from the last use. */
const KEPT_TTL_MS = 14 * DAY;
/** Use is written at most this often: a page of requests is one write, not twenty. */
const TOUCH_EVERY_MS = HOUR;
/** Unused this long, an account is told it will be erased; this long after that, it is. */
export const UNUSED_AFTER_MS = 3 * 365 * DAY;
export const ERASE_AFTER_WARNING_MS = 30 * DAY;

/** The limits on codes (S5): per address, per network address, and for everyone (a circuit breaker). */
export interface CodeLimits {
  readonly perEmailHour: number;
  readonly perEmailDay: number;
  /** Codes that ran out of tries in a day, after which the address waits. */
  readonly failedPerDay: number;
  readonly perIpHour: number;
  readonly allPerHour: number;
}

export const CODE_LIMITS: CodeLimits = { perEmailHour: 5, perEmailDay: 10, failedPerDay: 3, perIpHour: 20, allPerHour: 2000 };

export class CandidateRefused extends Error {
  constructor(
    readonly code: "invalid" | "too_many" | "email_not_configured" | "mail_failed" | "sign_in_failed" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "CandidateRefused";
  }
}

export interface CandidateSessionView {
  readonly token: string;
  readonly expiresAt: string;
  /** Whether the browser should keep it beyond the tab. */
  readonly kept: boolean;
  readonly account: CandidateAccount;
}

/** What a candidate says about themselves. Sealed whole; shown to a company only in an application's snapshot (H2). */
export interface ProfileDetails {
  readonly headline?: string | undefined;
  readonly location?: string | undefined;
  readonly experienceYears?: number | undefined;
  readonly currentCompany?: string | undefined;
  readonly currentCtcLpa?: number | undefined;
  readonly expectedCtcLpa?: number | undefined;
  readonly noticeDays?: number | undefined;
  readonly links?: { readonly linkedin?: string | undefined; readonly github?: string | undefined; readonly portfolio?: string | undefined } | undefined;
  readonly skills?: readonly string[] | undefined;
}

export interface CandidatesOptions {
  readonly store: CandidateStore;
  readonly keys: DataKeys;
  /** Null: no mail is configured, and no one can sign in (F22). */
  readonly mailer: Mailer | null;
  readonly now?: () => Date;
  readonly limits?: CodeLimits;
  /** How long one mail may take before it counts as failed (F22). */
  readonly mailTimeoutMs?: number;
  /** Six digits, for tests to know the code. */
  readonly newCode?: () => string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** An address as it is kept: trimmed and in lower case. Null if it is not one. */
export function normaliseEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length <= 200 && EMAIL.test(email) ? email : null;
}

/** A file's name as kept and sent back: no folders, no control characters, ending as its type does. */
export function fileName(given: string, type: "pdf" | "docx"): string {
  const base = given.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  const name = clean === "" || clean.startsWith(".") ? "resume" : clean;
  return name.toLowerCase().endsWith(`.${type}`) ? name : `${name.replace(/\.(pdf|docx?)$/i, "")}.${type}`;
}

export class Candidates {
  readonly #store: CandidateStore;
  readonly #mailer: Mailer | null;
  readonly #now: () => Date;
  readonly #limits: CodeLimits;
  readonly #mailTimeoutMs: number;
  readonly #newCode: () => string;
  readonly #emails: BlindIndex;
  readonly #ips: BlindIndex;
  readonly #codes: BlindIndex;

  constructor(o: CandidatesOptions) {
    this.#store = o.store;
    this.#mailer = o.mailer;
    this.#now = o.now ?? (() => new Date());
    this.#limits = o.limits ?? CODE_LIMITS;
    this.#mailTimeoutMs = o.mailTimeoutMs ?? 10_000;
    this.#newCode = o.newCode ?? (() => String(randomInt(0, 1_000_000)).padStart(6, "0"));
    this.#emails = o.keys.blind("candidate-email");
    this.#ips = o.keys.blind("candidate-ip");
    this.#codes = o.keys.blind("candidate-code");
  }

  /** Whether candidates can sign in at all here: there is a mailer for the codes. */
  get open(): boolean {
    return this.#mailer !== null;
  }

  #emailHash(email: string): string {
    return this.#emails.of("", email);
  }

  // --- codes ------------------------------------------------------------------

  /**
   * Mail a sign-in code. The same answer whether the address has an account or
   * not; the account is made when the code is entered.
   */
  async requestCode(rawEmail: string, ip: string): Promise<void> {
    const email = normaliseEmail(rawEmail);
    if (email === null) throw new CandidateRefused("invalid", "That is not an email address");
    await this.#sendCode(email, "sign_in", ip);
  }

  /** Mail a code to confirm a step that cannot be undone (S19): deleting the account, answering an offer. */
  async requestStepUp(account: CandidateAccount, ip: string): Promise<void> {
    await this.#sendCode(account.email, "step_up", ip);
  }

  async #sendCode(email: string, purpose: CodePurpose, ip: string): Promise<void> {
    const mailer = this.#mailer;
    if (mailer === null) throw new CandidateRefused("email_not_configured", "Email is not set up here, so codes cannot be sent");
    const now = this.#now();
    const emailHash = this.#emailHash(email);
    const ipHash = this.#ips.of("", ip);
    const counts = await this.#store.codeCounts(emailHash, ipHash, now);
    const l = this.#limits;
    if (counts.allHour >= l.allPerHour || counts.ipHour >= l.perIpHour) {
      throw new CandidateRefused("too_many", "Too many codes have been asked for. Try again in an hour");
    }
    if (counts.failedDay >= l.failedPerDay || counts.emailDay >= l.perEmailDay) {
      throw new CandidateRefused("too_many", "Too many codes for this address today. Try again tomorrow");
    }
    if (counts.emailHour >= l.perEmailHour) throw new CandidateRefused("too_many", "Too many codes for this address. Try again in an hour");

    const id = randomBytes(16).toString("base64url");
    const code = this.#newCode();
    await this.#store.issueCode({
      id,
      purpose,
      emailHash,
      codeHash: this.#codes.of(id, code),
      ipHash,
      now,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    });
    const what = purpose === "sign_in" ? "sign in to Parikshaa" : "confirm what you asked to do on Parikshaa";
    const text = [
      `Your code: ${code}`,
      "",
      `Enter it to ${what}. It works for 10 minutes, once.`,
      "",
      "If you did not ask for it, ignore this email: nothing happens without the code. Parikshaa never asks for this code by phone or chat.",
    ].join("\n");
    const html = `<p>Your code: <strong style="font-size:1.4em;letter-spacing:0.2em">${code}</strong></p>
<p>Enter it to ${what}. It works for 10 minutes, once.</p>
<p>If you did not ask for it, ignore this email: nothing happens without the code. Parikshaa never asks for this code by phone or chat.</p>`;
    await this.#mail(mailer, { to: email, subject: `${code} is your Parikshaa code`, text, html });
  }

  /** Send within the time allowed (F22): a mail server that hangs must not hold the request. */
  async #mail(mailer: Mailer, message: Parameters<Mailer["send"]>[0]): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        mailer.send(message),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("The mail server did not answer in time")), this.#mailTimeoutMs);
        }),
      ]);
    } catch {
      throw new CandidateRefused("mail_failed", "The email could not be sent. Try again in a minute");
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Spend a try on the address's code. True only for the right code, once;
   * a wrong one uses up one of its five tries.
   */
  async #check(email: string, purpose: CodePurpose, code: string): Promise<boolean> {
    const now = this.#now();
    const spent = await this.#store.spendAttempt(this.#emailHash(email), purpose, now);
    if (spent === null) return false;
    const given = Buffer.from(this.#codes.of(spent.id, code.trim()));
    const kept = Buffer.from(spent.codeHash);
    if (given.length !== kept.length || !timingSafeEqual(given, kept)) return false;
    return this.#store.useCode(spent.id, now);
  }

  // --- sessions -----------------------------------------------------------------

  /** Enter a sign-in code. The account is made now if the address has none. */
  async verify(rawEmail: string, code: string, keep: boolean): Promise<CandidateSessionView> {
    const email = normaliseEmail(rawEmail);
    if (email === null || !/^\s*\d{6}\s*$/.test(code) || !(await this.#check(email, "sign_in", code))) {
      throw new CandidateRefused("sign_in_failed", "That code is not right, or has expired. Ask for a new one");
    }
    const now = this.#now();
    const account = await this.#store.signIn(email, now);
    const token = `${SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(now.getTime() + (keep ? KEPT_TTL_MS : SESSION_TTL_MS));
    await this.#store.createSession({ tokenHash: sha256(token), candidateId: account.id, kept: keep, now, expiresAt });
    return { token, expiresAt: expiresAt.toISOString(), kept: keep, account };
  }

  /** The account a bearer token signs in, or null. A kept session runs on from each use. */
  async account(bearer: string | null | undefined): Promise<CandidateAccount | null> {
    if (bearer === null || bearer === undefined || !bearer.startsWith(SESSION_PREFIX)) return null;
    const now = this.#now();
    const tokenHash = sha256(bearer);
    const session = await this.#store.session(tokenHash, now);
    if (session === null) return null;
    const renew = session.kept && new Date(session.expiresAt).getTime() - now.getTime() < KEPT_TTL_MS - TOUCH_EVERY_MS;
    if (renew || now.getTime() - new Date(session.account.lastSeenAt).getTime() > TOUCH_EVERY_MS) {
      await this.#store.touch(tokenHash, session.account.id, now, renew ? new Date(now.getTime() + KEPT_TTL_MS) : null);
    }
    return session.account;
  }

  async signOut(bearer: string | null | undefined): Promise<void> {
    if (bearer === null || bearer === undefined || !bearer.startsWith(SESSION_PREFIX)) return;
    await this.#store.revokeSession(sha256(bearer), this.#now());
  }

  /** "Sign out everywhere" (S19): every session of the account ends, this one too. */
  async signOutEverywhere(account: CandidateAccount): Promise<number> {
    return this.#store.revokeAll(account.id, this.#now());
  }

  // --- profile ------------------------------------------------------------------

  async profile(account: CandidateAccount): Promise<CandidateProfile> {
    const profile = await this.#store.profile(account.id);
    if (profile === null) throw new CandidateRefused("not_found", "There is no such account");
    return profile;
  }

  async saveProfile(account: CandidateAccount, input: { readonly name: string | null; readonly phone: string | null; readonly details: ProfileDetails }): Promise<CandidateProfile> {
    const name = input.name?.trim() ?? "";
    const phone = input.phone?.replace(/[\s-]/g, "") ?? "";
    if (phone !== "" && !/^\+?\d{8,15}$/.test(phone)) throw new CandidateRefused("invalid", "That is not a phone number");
    const saved = await this.#store.saveProfile(account.id, { name: name === "" ? null : name, phone: phone === "" ? null : phone, details: input.details });
    if (!saved) throw new CandidateRefused("not_found", "There is no such account");
    return this.profile(account);
  }

  /** Everything kept about the candidate, for them to take away (DPDP Act). Never a session's token. */
  async exportData(account: CandidateAccount): Promise<{
    readonly account: CandidateAccount;
    readonly profile: CandidateProfile;
    readonly sessions: readonly { readonly createdAt: string; readonly expiresAt: string; readonly kept: boolean }[];
    readonly applications: readonly { readonly orgId: string; readonly applicationId: string; readonly createdAt: string }[];
  }> {
    const now = this.#now();
    return {
      account,
      profile: await this.profile(account),
      sessions: await this.#store.sessions(account.id, now),
      applications: await this.#store.links(account.id),
    };
  }

  /**
   * Delete the account, once a fresh code mailed to it is entered (S19). The
   * account goes now; applications to companies go with H2's erasure.
   */
  async deleteAccount(account: CandidateAccount, code: string): Promise<void> {
    if (!/^\s*\d{6}\s*$/.test(code) || !(await this.#check(account.email, "step_up", code))) {
      throw new CandidateRefused("sign_in_failed", "That code is not right, or has expired. Ask for a new one");
    }
    await this.#erase(account, "Your Parikshaa account is deleted", "You asked to delete your Parikshaa account, and it is deleted.");
  }

  async #erase(account: CandidateAccount, subject: string, why: string): Promise<void> {
    const erased = await this.#store.erase(account.id, this.#emailHash(account.email), this.#now());
    if (!erased || this.#mailer === null) return;
    const text = [why, "", "Your profile, your resume and your sessions are gone. If you sign in again with this address, it starts a new, empty account."].join("\n");
    // Told after the fact, and best effort: the account is gone either way.
    await this.#mail(this.#mailer, { to: account.email, subject, text, html: text.split("\n\n").map((p) => `<p>${p}</p>`).join("\n") }).catch(() => undefined);
  }

  // --- the resume (H1b) -----------------------------------------------------------

  /**
   * Keep a resume (PDF or .docx, at most 2 MB) in place of the one before. Its
   * text is read in a worker, and a file that cannot be read is refused with
   * the reason (ResumeRefused).
   */
  async uploadResume(account: CandidateAccount, name: string, file: Uint8Array): Promise<CandidateProfile> {
    const read = await readResume(file);
    const saved = await this.#store.saveResume(account.id, {
      text: read.text,
      file,
      name: fileName(name, read.type),
      type: read.type,
      sha256: createHash("sha256").update(file).digest("hex"),
      at: this.#now(),
    });
    if (!saved) throw new CandidateRefused("not_found", "There is no such account");
    return this.profile(account);
  }

  async resumeFile(account: CandidateAccount): Promise<{ readonly file: Buffer; readonly name: string; readonly type: "pdf" | "docx" }> {
    const found = await this.#store.resumeFile(account.id);
    if (found === null) throw new CandidateRefused("not_found", "There is no resume on your profile");
    return found;
  }

  async deleteResume(account: CandidateAccount): Promise<CandidateProfile> {
    await this.#store.deleteResume(account.id);
    return this.profile(account);
  }

  // --- retention (F4, F22) --------------------------------------------------------

  /**
   * The hourly sweep: spent codes and old sessions go; an account unused for
   * three years is told, and erased thirty days later unless it is used.
   */
  async sweep(batch = 100): Promise<{ readonly codes: number; readonly sessions: number; readonly warned: number; readonly erased: number }> {
    const now = this.#now();
    const swept = await this.#store.sweep(now);
    let warned = 0;
    let erased = 0;
    if (this.#mailer !== null) {
      for (const account of await this.#store.unused(new Date(now.getTime() - UNUSED_AFTER_MS), batch)) {
        const text = [
          "You have not used your Parikshaa account for three years, so in 30 days it will be deleted, with your profile and resume.",
          "",
          "To keep it, sign in once before then. To let it go, do nothing.",
        ].join("\n");
        try {
          await this.#mail(this.#mailer, { to: account.email, subject: "Your Parikshaa account will be deleted in 30 days", text, html: text.split("\n\n").map((p) => `<p>${p}</p>`).join("\n") });
        } catch {
          continue; // Tried again at the next sweep: no one is erased without being told.
        }
        await this.#store.markWarned(account.id, now);
        warned++;
      }
    }
    for (const account of await this.#store.warnedUnused(new Date(now.getTime() - ERASE_AFTER_WARNING_MS), batch)) {
      await this.#erase(account, "Your Parikshaa account is deleted", "Your Parikshaa account was not used for three years, and we told you 30 days ago it would be deleted. It is deleted now.");
      erased++;
    }
    return { ...swept, warned, erased };
  }
}
