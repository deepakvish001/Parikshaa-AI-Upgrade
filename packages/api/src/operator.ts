import { randomBytes } from "node:crypto";
import type { OrgId } from "@parikshaa/core";
import { staffScope, type BillingStore, type IdentityStore, type Organisation, type OrganisationFacts, type OrganisationKind, type ReportStore } from "@parikshaa/store";
import { organisationId } from "./onboarding.js";
import type { ExamService } from "./service.js";
import { hashPassword, type Actor } from "./staff-auth.js";

/**
 * Parikshaa's operator (docs/F1-GO-LIVE-PLAN.md §3, G1): the people who run
 * Parikshaa itself, seeing every company and college and making new ones.
 *
 * An operator is a member of staff (in Parikshaa's own organisation, usually)
 * whose address is in `PARIKSHAA_OPERATORS`, and who signs in with a second
 * factor: this reaches every organisation, so a password alone is not enough.
 * Everything an operator does is written in the audit log twice, in the
 * organisation it touched (named as Parikshaa) and in the operator's own.
 */

/** Who the operators are: addresses from the environment, compared without case. */
export class Operators {
  readonly #emails: ReadonlySet<string>;

  constructor(emails: readonly string[]) {
    this.#emails = new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => e !== ""));
  }

  static fromEnv(value: string | undefined): Operators {
    return new Operators((value ?? "").split(","));
  }

  is(actor: Actor): boolean {
    return actor.kind === "user" && this.#emails.has(actor.email.trim().toLowerCase());
  }
}

export class OperatorRefused extends Error {
  constructor(
    readonly code: "not_found" | "operator_needs_2fa" | "email_taken" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "OperatorRefused";
  }
}

export interface Company {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly kind: OrganisationKind;
  readonly createdAt: string;
  readonly suspended: { readonly at: string; readonly reason: string } | null;
  readonly owner: { readonly name: string; readonly email: string; readonly verified: boolean } | null;
  readonly staff: number;
  readonly exams: number;
  readonly invited: number;
  readonly started: number;
  /** Credits left on a prepaid plan; null when invoiced or not billed. */
  readonly credits: number | null;
  readonly lastActivity: string | null;
}

export interface NewCompany {
  readonly name: string;
  readonly kind: OrganisationKind;
  readonly ownerName: string;
  readonly ownerEmail: string;
  /** What each attempt costs, before GST; the plan is prepaid unless `invoiced`. */
  readonly pricePerAttemptRupees: number;
  readonly invoiced: boolean;
  /** Credits to start with, without payment (a trial, or what was paid offline). */
  readonly credits: number;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** How long an owner's invitation to set a password lasts: long enough for a week away. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface OperatorDeps {
  readonly identity: IdentityStore;
  readonly billing: BillingStore;
  readonly reports: ReportStore;
  readonly exams: ExamService;
  readonly operators: Operators;
  readonly now: () => number;
}

export class OperatorService {
  readonly #o: OperatorDeps;

  constructor(o: OperatorDeps) {
    this.#o = o;
  }

  get operators(): Operators {
    return this.#o.operators;
  }

  /**
   * Refuses anyone but an operator signed in with a second factor. To anyone
   * else the operator's pages do not exist: `not_found`, never `forbidden`.
   */
  async check(actor: Actor): Promise<void> {
    if (!this.#o.operators.is(actor)) throw new OperatorRefused("not_found", "Not found");
    if ((await this.#o.identity.totpState(actor.id)).secret === null) {
      throw new OperatorRefused("operator_needs_2fa", "Set up a second factor on your account first: the operator's pages reach every organisation");
    }
  }

  async companies(actor: Actor): Promise<readonly Company[]> {
    await this.check(actor);
    const facts = new Map((await this.#o.reports.organisations(new Date(this.#o.now()))).map((f) => [f.id as string, f]));
    return (await this.#o.identity.listOrganisations()).map((org) => companyOf(org, org.createdAt, facts.get(org.id)));
  }

  async company(actor: Actor, publicId: string): Promise<Company> {
    await this.check(actor);
    return this.#company(await this.#find(publicId));
  }

  async #find(publicId: string): Promise<Organisation> {
    const org = await this.#o.identity.organisationByPublicId(publicId);
    if (org === null) throw new OperatorRefused("not_found", "No organisation has that ID");
    return org;
  }

  async #company(org: Organisation): Promise<Company> {
    const facts = await this.#o.reports.organisation(org.id, new Date(this.#o.now()));
    return companyOf(org, facts?.createdAt ?? new Date(this.#o.now()).toISOString(), facts ?? undefined);
  }

  /**
   * Make a company (or a college) with its first owner. The owner's password
   * is one nobody knows; they get an email to set their own, which also shows
   * the address is theirs.
   */
  async create(actor: Actor, input: NewCompany): Promise<Company> {
    await this.check(actor);
    const name = input.name.trim();
    const ownerName = input.ownerName.trim();
    const ownerEmail = input.ownerEmail.trim();
    if (name.length < 2 || name.length > 120) throw new OperatorRefused("invalid", "Give the organisation's name");
    if (ownerName.length < 1 || ownerName.length > 120) throw new OperatorRefused("invalid", "Give the owner's name");
    if (!EMAIL.test(ownerEmail) || ownerEmail.length > 320) throw new OperatorRefused("invalid", "Give the owner's work email address");
    if (!(input.pricePerAttemptRupees > 0) || input.pricePerAttemptRupees > 100_000) throw new OperatorRefused("invalid", "Give a price per attempt in rupees");
    if (!Number.isInteger(input.credits) || input.credits < 0 || input.credits > 100_000) throw new OperatorRefused("invalid", "Credits are a whole number, up to 100,000");
    if ((await this.#o.identity.findUserByEmail(ownerEmail)) !== null) {
      throw new OperatorRefused("email_taken", "An account already uses that address: one address, one organisation");
    }

    const id = organisationId(name);
    const org = await this.#o.identity.createOrganisation(id, name, input.kind);
    const scope = staffScope(id);
    await this.#o.billing.setPlan(scope, input.invoiced ? "invoiced" : "prepaid", Math.round(input.pricePerAttemptRupees * 100));
    if (input.credits > 0) await this.#o.billing.grant(scope, input.credits, "Given by Parikshaa on opening the account");
    const owner = await this.#o.identity.createUser({
      orgId: id,
      email: ownerEmail,
      name: ownerName,
      role: "owner",
      passwordHash: await hashPassword(randomBytes(24).toString("base64url")),
      // Signing in at all needs the link sent to this address, so using it shows the address is theirs.
      emailVerified: true,
    });
    await this.#invite(owner);
    await this.#audit(actor, org, ["org.created", "operator.company_created"], { name, kind: input.kind, owner: ownerEmail, credits: input.credits, invoiced: input.invoiced });
    return this.#company(org);
  }

  async suspend(actor: Actor, publicId: string, reason: string): Promise<Company> {
    await this.check(actor);
    const why = reason.trim();
    if (why.length < 3 || why.length > 500) throw new OperatorRefused("invalid", "Say why, in a few words: the owner is told");
    const org = await this.#find(publicId);
    await this.#o.identity.setSuspended(org.id, why, new Date(this.#o.now()));
    await this.#audit(actor, org, ["org.suspended", "operator.company_suspended"], { reason: why });
    return this.#company((await this.#o.identity.getOrganisation(org.id))!);
  }

  async resume(actor: Actor, publicId: string): Promise<Company> {
    await this.check(actor);
    const org = await this.#find(publicId);
    await this.#o.identity.setSuspended(org.id, null, new Date(this.#o.now()));
    await this.#audit(actor, org, ["org.resumed", "operator.company_resumed"], {});
    return this.#company((await this.#o.identity.getOrganisation(org.id))!);
  }

  async grant(actor: Actor, publicId: string, credits: number, note: string): Promise<Company> {
    await this.check(actor);
    if (!Number.isInteger(credits) || credits < 1 || credits > 100_000) throw new OperatorRefused("invalid", "Credits are a whole number from 1 to 100,000");
    if (note.trim().length < 3) throw new OperatorRefused("invalid", "Say what the credits are for: the note is on the account");
    const org = await this.#find(publicId);
    await this.#o.billing.grant(staffScope(org.id), credits, note.trim());
    await this.#audit(actor, org, ["org.credits_granted", "operator.company_credits_granted"], { credits, note: note.trim() });
    return this.#company(org);
  }

  /** Send the first owner a new link to set their password: the first went to spam, or ran out. */
  async reinvite(actor: Actor, publicId: string): Promise<void> {
    await this.check(actor);
    const org = await this.#find(publicId);
    const owner = (await this.#o.identity.listUsers(org.id)).find((u) => u.role === "owner" && !u.disabled);
    if (owner === undefined) throw new OperatorRefused("not_found", "This organisation has no owner to invite");
    await this.#invite(owner);
    await this.#audit(actor, org, ["org.owner_invited", "operator.company_owner_invited"], { owner: owner.email });
  }

  #invite(user: { readonly id: string; readonly orgId: OrgId }) {
    const now = this.#o.now();
    return this.#o.identity.requestPasswordReset(user, new Date(now), new Date(now + INVITE_TTL_MS), "staff_invite");
  }

  /** In the organisation touched, as Parikshaa; and in the operator's own. */
  async #audit(actor: Actor, org: Organisation, [here, mine]: readonly [string, string], detail: Record<string, unknown>): Promise<void> {
    if (actor.kind !== "user") return;
    // The operator is no member of this organisation's staff: the entry says who it was.
    await this.#o.exams.recordAudit({ ...actor, orgId: org.id, role: "owner" }, here, org.id, { ...detail, by: `${actor.name} (Parikshaa)` });
    await this.#o.exams.recordAudit(actor, mine, org.publicId, { ...detail, organisation: org.name });
  }
}

function companyOf(org: Organisation, createdAt: string, facts: OrganisationFacts | undefined): Company {
  return {
    id: org.id,
    publicId: org.publicId,
    name: org.name,
    kind: org.kind,
    createdAt,
    suspended: org.suspended,
    owner: facts?.owner ?? null,
    staff: facts?.staff ?? 0,
    exams: facts?.exams ?? 0,
    invited: facts?.invited ?? 0,
    started: facts?.started ?? 0,
    credits: facts?.credits ?? null,
    lastActivity: facts?.lastActivity ?? null,
  };
}
