import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PASSWORD, signIn, wire } from "./testing/harness.js";

/**
 * Parikshaa's operator panel (docs/F1-GO-LIVE-PLAN.md §3, G1): Company IDs,
 * opening a company with its owner, pausing and resuming it, credits, and the
 * owner's invitation. As `parikshaa_app`.
 */

const COMPANY_ID = /^PKC-[0-9A-HJKMNP-TV-Z]{6}$/;
const NEW_PASSWORD = "the owner's own long password";

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let mail: OutboxLog;
let worker: DeliveryWorker;
let clock: number;
/** An operator who signs in with a second factor; another without one; a company's owner. */
let ops: string;
let opsNo2fa: string;
let acme: string;

const call = (token: string | null, method: "GET" | "POST", url: string, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });
const emails = () => mail.sent.filter((m): m is EmailMessage => "subject" in m);
const login = (email: string, password: string) => app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });

const NEW = { name: "Zeta Labs", kind: "company", ownerName: "Kiran Shah", ownerEmail: "kiran@zeta.test", pricePerAttemptRupees: 99, credits: 50 };

beforeEach(async () => {
  clock = Date.parse("2026-10-03T06:00:00Z");
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  mail = new OutboxLog();
  let handlers;
  ({ app, identity, handlers } = await wire(sql, {
    client: {} as unknown as Anthropic,
    now: () => clock,
    mailer: mail,
    operators: ["Ops@Parikshaa.test", "ops2@parikshaa.test"],
  }));
  const home = await addOrganisation(identity, "parikshaa", "Parikshaa");
  const opsId = await addStaff(identity, home, "ops@parikshaa.test", "owner", "Ops");
  await addStaff(identity, home, "ops2@parikshaa.test", "author", "Ops Two");
  await addStaff(identity, await addOrganisation(identity, "acme", "Acme Engineering"), "owner@acme.test", "owner", "Asha");
  await db.exec(`SET ROLE parikshaa_app`);
  worker = new DeliveryWorker({
    outbox: new OutboxStore(sql),
    invitations: new InvitationStore(sql),
    store: new LedgerStore(sql),
    identity: new IdentityStore(sql),
    link: () => "",
    mailer: mail,
    sms: null,
    handlers,
    now: () => clock,
  });
  ops = await signIn(app, "ops@parikshaa.test");
  opsNo2fa = await signIn(app, "ops2@parikshaa.test");
  acme = await signIn(app, "owner@acme.test");
  // The operator's second factor, set in the store after signing in: how it is enrolled is security.test.ts's.
  await identity.setPendingTotp(opsId, "sealed");
  await identity.enableTotp(opsId, 0, []);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("Company IDs", () => {
  it("every organisation has one, shown to its staff, and only operators are told they are", async () => {
    const me = (await call(acme, "GET", "/auth/me")).json();
    expect(me.organisation.publicId).toMatch(COMPANY_ID);
    expect(me.operator).toBe(false);
    expect((await call(ops, "GET", "/auth/me")).json().operator).toBe(true);
    const ids = (await identity.listOrganisations()).map((o) => o.publicId);
    expect(new Set(ids).size).toBe(ids.length);
    expect((await identity.organisationByPublicId(` ${me.organisation.publicId.toLowerCase()} `))?.id).toBe("acme");
  });
});

describe("the operator panel", () => {
  it("does not exist for anyone else, and asks an operator for a second factor", async () => {
    expect((await call(acme, "GET", "/operator/companies")).statusCode).toBe(404);
    expect((await call(null, "GET", "/operator/companies")).statusCode).toBe(401);
    const no2fa = await call(opsNo2fa, "GET", "/operator/companies");
    expect(no2fa.statusCode).toBe(403);
    expect(no2fa.json().error).toBe("operator_needs_2fa");
    expect((await call(acme, "POST", "/operator/companies", NEW)).statusCode).toBe(404);
  });

  it("lists every organisation with its ID, owner and credits", async () => {
    const res = await call(ops, "GET", "/operator/companies");
    expect(res.statusCode, res.payload).toBe(200);
    const acmeRow = res.json().companies.find((c: { id: string }) => c.id === "acme");
    expect(acmeRow).toMatchObject({ name: "Acme Engineering", publicId: expect.stringMatching(COMPANY_ID), suspended: null, owner: { email: "owner@acme.test" } });
    expect((await call(ops, "GET", `/operator/companies/${acmeRow.publicId}`)).json().name).toBe("Acme Engineering");
    expect((await call(ops, "GET", "/operator/companies/PKC-000000")).statusCode).toBe(404);
  });

  it("opens a company: its plan and credits, and an owner who sets their own password from the email", async () => {
    const made = await call(ops, "POST", "/operator/companies", NEW);
    expect(made.statusCode, made.payload).toBe(201);
    const company = made.json();
    expect(company).toMatchObject({ name: "Zeta Labs", kind: "company", publicId: expect.stringMatching(COMPANY_ID), credits: 50, owner: { email: "kiran@zeta.test", verified: true } });

    // Nobody knows the owner's first password; the email lets them choose one.
    expect((await login("kiran@zeta.test", PASSWORD)).statusCode).toBe(401);
    await worker.tick();
    const invite = emails().find((m) => m.to === "kiran@zeta.test")!;
    expect(invite.subject).toBe("Your Parikshaa account for Zeta Labs");
    expect(invite.text).toContain(company.publicId);
    expect(invite.text).toContain("within seven days");
    const token = decodeURIComponent(/\?reset=([^\s"&]+)/.exec(invite.text)![1]!);
    // Still good six days on.
    clock += 6 * 24 * 60 * 60 * 1000;
    expect((await app.inject({ method: "POST", url: "/auth/password-reset/confirm", payload: { token, password: NEW_PASSWORD } })).statusCode).toBe(200);
    const kiran = (await login("kiran@zeta.test", NEW_PASSWORD)).json().token as string;
    const me = (await call(kiran, "GET", "/auth/me")).json();
    expect(me).toMatchObject({ role: "owner", emailVerified: true, organisation: { name: "Zeta Labs", kind: "company", publicId: company.publicId } });
    const audit = JSON.stringify((await call(kiran, "GET", "/audit")).json());
    expect(audit).toContain("org.created");
    expect(audit).toContain("Ops (Parikshaa)");
    expect(JSON.stringify((await call(ops, "GET", "/audit")).json())).toContain("operator.company_created");
  });

  it("refuses an address that has an account, and what is not filled in", async () => {
    const before = (await call(ops, "GET", "/operator/companies")).json().companies.length;
    const taken = await call(ops, "POST", "/operator/companies", { ...NEW, ownerEmail: "owner@acme.test" });
    expect(taken.statusCode).toBe(409);
    expect((await call(ops, "POST", "/operator/companies", { ...NEW, ownerEmail: "not an address" })).statusCode).toBe(422);
    expect((await call(ops, "POST", "/operator/companies", { ...NEW, name: " " })).statusCode).toBe(422);
    expect((await call(ops, "GET", "/operator/companies")).json().companies).toHaveLength(before);
  });

  it("pauses a company: its staff are signed out, cannot sign in, and its keys stop; resuming lets them back", async () => {
    const key = (await call(acme, "POST", "/api-keys", { name: "ATS", role: "viewer" })).json().secret as string;
    expect((await call(key, "GET", "/exams")).statusCode).toBe(200);
    const acmeId = (await call(acme, "GET", "/auth/me")).json().organisation.publicId as string;

    expect((await call(ops, "POST", `/operator/companies/${acmeId}/suspend`, { reason: "" })).statusCode).toBe(422);
    const paused = await call(ops, "POST", `/operator/companies/${acmeId}/suspend`, { reason: "Invoice unpaid for 60 days" });
    expect(paused.json().suspended).toEqual({ at: new Date(clock).toISOString(), reason: "Invoice unpaid for 60 days" });
    expect((await call(acme, "GET", "/auth/me")).statusCode).toBe(401);
    expect((await call(key, "GET", "/exams")).statusCode).toBe(401);
    const refused = await login("owner@acme.test", PASSWORD);
    expect(refused.statusCode).toBe(403);
    expect(refused.json().error).toBe("suspended");
    // A wrong password is answered as before: pausing reveals nothing to a guess.
    expect((await login("owner@acme.test", "a wrong password entirely")).statusCode).toBe(401);
    // Other organisations carry on.
    expect((await call(ops, "GET", "/auth/me")).statusCode).toBe(200);

    expect((await call(ops, "POST", `/operator/companies/${acmeId}/resume`)).json().suspended).toBeNull();
    const back = (await login("owner@acme.test", PASSWORD)).json().token as string;
    expect((await call(key, "GET", "/exams")).statusCode).toBe(200);
    const audit = JSON.stringify((await call(back, "GET", "/audit")).json());
    expect(audit).toContain("org.suspended");
    expect(audit).toContain("org.resumed");
  });

  it("gives credits with a note, and sends the owner's invitation again", async () => {
    const company = (await call(ops, "POST", "/operator/companies", NEW)).json();
    expect((await call(ops, "POST", `/operator/companies/${company.publicId}/credits`, { credits: 25, note: "" })).statusCode).toBe(422);
    const topped = await call(ops, "POST", `/operator/companies/${company.publicId}/credits`, { credits: 25, note: "Paid by NEFT, UTR 1234" });
    expect(topped.json().credits).toBe(75);

    await worker.tick();
    expect((await call(ops, "POST", `/operator/companies/${company.publicId}/invite`)).statusCode).toBe(200);
    await worker.tick();
    expect(emails().filter((m) => m.to === "kiran@zeta.test")).toHaveLength(2);
  });
});
