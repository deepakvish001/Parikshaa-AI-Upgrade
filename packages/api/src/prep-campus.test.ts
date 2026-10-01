import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdentityStore, InvitationStore, LedgerStore, OutboxStore, pgliteExecutor } from "@parikshaa/store";
import { DeliveryWorker, OutboxLog, type EmailMessage } from "./delivery.js";
import { cohortEmails } from "./prep-campus.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * Campus licences (Prep blueprint F16) through the HTTP API, as
 * `parikshaa_app`: a cohort, its CSV with a dry run, Plus for verified
 * accounts at once and for the rest when they verify, and the dashboard.
 */

const S = "/practice/nit-practice";
let clock = Date.parse("2026-10-05T04:00:00Z");
let db: PGlite;
let app: FastifyInstance;
let owner: string;
let viewer: string;
let author: string;
let mail: OutboxLog;
let worker: DeliveryWorker;

function call(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) {
  const headers = token === null ? {} : bearer(token);
  return payload === undefined ? app.inject({ method, url, headers }) : app.inject({ method, url, headers, payload });
}
async function ok(method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object, status = method === "POST" ? 201 : 200) {
  const res = await call(method, token, url, payload);
  expect(res.statusCode, res.payload).toBe(status);
  return res.json();
}

beforeEach(async () => {
  clock = Date.parse("2026-10-05T04:00:00Z");
  db = await freshDatabase();
  const sql = pgliteExecutor(db);
  mail = new OutboxLog();
  let identity, handlers;
  ({ app, identity, handlers } = await wire(sql, { client: {} as unknown as Anthropic, mailer: mail, now: () => clock }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await addStaff(identity, org, "viewer@nit.test", "viewer");
  await addStaff(identity, org, "author@nit.test", "author");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@nit.test");
  viewer = await signIn(app, "viewer@nit.test");
  author = await signIn(app, "author@nit.test");
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
  await ok("PUT", owner, "/practice-admin/site", { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true }, 200);
  await ok("PUT", owner, "/practice-admin/plus", { plusEnabled: true }, 200);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const signUp = async (email: string, name: string) => (await ok("POST", null, `${S}/signup`, { name, email, password: "a long enough password" })).token as string;
/** Follow the verification link last emailed to an address. */
async function verify(email: string) {
  await worker.tick();
  const message = mail.sent.filter((m): m is EmailMessage => "subject" in m && m.to === email).at(-1)!;
  const token = decodeURIComponent(/\?verify=([^\s"&]+)/.exec(message.text)![1]!);
  await ok("POST", null, `${S}/verify`, { token }, 200);
}

describe("reading a CSV of addresses", () => {
  it("takes the email column or the first, with or without a header, and says what is wrong", () => {
    expect(cohortEmails("name,Email\nAsha,ASHA@x.in\nRavi,ravi@x.in\n\nKiran,not-an-email\nAsha again,asha@x.in\n")).toEqual({
      emails: ["asha@x.in", "ravi@x.in"],
      invalid: [{ line: 5, value: "not-an-email" }],
      duplicates: 1,
      rows: 4,
    });
    expect(cohortEmails("﻿a@x.in\r\n\"b@x.in\"\r\n").emails).toEqual(["a@x.in", "b@x.in"]);
  });
});

describe("a campus cohort", () => {
  it("gives Plus to verified accounts at once and to the rest when they verify, once each, and shows how they are doing", async () => {
    // Asha has a verified account before the import; Ravi has one not yet verified; Kiran has none.
    const asha = await signUp("asha@college.edu", "Asha");
    await verify("asha@college.edu");
    const ravi = await signUp("ravi@college.edu", "Ravi");
    expect((await ok("GET", asha, `${S}/plus`)).active).toBe(false);

    expect((await call("POST", viewer, "/practice-admin/cohorts", { name: "NIT 2027", plusDays: 180 })).statusCode).toBe(403);
    expect((await call("POST", owner, "/practice-admin/cohorts", { name: "NIT 2027", plusDays: 0 })).statusCode).toBe(422);
    const cohort = await ok("POST", owner, "/practice-admin/cohorts", { name: "NIT 2027", plusDays: 180 });
    expect((await call("POST", owner, "/practice-admin/cohorts", { name: "nit 2027", plusDays: 30 })).statusCode).toBe(409);

    const csv = "email\nasha@college.edu\nRAVI@college.edu\nkiran@college.edu\nbroken\nasha@college.edu\n";
    const url = `/practice-admin/cohorts/${cohort.id}/members`;
    expect((await call("POST", author, url, { csv, dryRun: true })).statusCode).toBe(403);
    const dry = await ok("POST", owner, url, { csv, dryRun: true }, 200);
    expect(dry).toEqual({ rows: 5, added: 3, invalid: [{ line: 5, value: "broken" }], duplicates: 1, already: 0, givenNow: 1, onSignup: 2, dryRun: true });
    // A dry run changes nothing.
    expect((await ok("GET", asha, `${S}/plus`)).active).toBe(false);
    expect((await ok("GET", owner, `/practice-admin/cohorts/${cohort.id}`)).students).toEqual([]);

    expect(await ok("POST", owner, url, { csv }, 200)).toMatchObject({ added: 3, givenNow: 1, onSignup: 2, dryRun: false });
    const ashaPlus = await ok("GET", asha, `${S}/plus`);
    expect(ashaPlus).toMatchObject({ active: true, until: "2027-04-03T04:00:00.000Z" });
    expect((await ok("GET", ravi, `${S}/plus`)).active).toBe(false);

    // Importing again adds nobody and gives nothing twice.
    expect(await ok("POST", owner, url, { csv: "asha@college.edu\nravi@college.edu\n" }, 200)).toMatchObject({ added: 0, already: 2, givenNow: 0 });
    expect((await ok("GET", asha, `${S}/plus`)).until).toBe(ashaPlus.until);

    // Ravi verifies: Plus. Kiran signs up and verifies: Plus. A stranger's address gets nothing.
    await verify("ravi@college.edu");
    expect((await ok("GET", ravi, `${S}/plus`)).active).toBe(true);
    const kiran = await signUp("Kiran@College.edu", "Kiran");
    expect((await ok("GET", kiran, `${S}/plus`)).active).toBe(false);
    await verify("Kiran@College.edu");
    expect((await ok("GET", kiran, `${S}/plus`)).active).toBe(true);
    const stranger = await signUp("someone@else.in", "Someone");
    await verify("someone@else.in");
    expect((await ok("GET", stranger, `${S}/plus`)).active).toBe(false);
    // Verifying twice gives nothing more.
    await verify("ravi@college.edu");
    expect((await ok("GET", ravi, `${S}/plus`)).until).toBe("2027-04-03T04:00:00.000Z");

    const { cohorts } = await ok("GET", viewer, "/practice-admin/cohorts");
    expect(cohorts).toEqual([expect.objectContaining({ name: "NIT 2027", plusDays: 180, members: 3, joined: 3, given: 3, active7: 0, solved: 0 })]);
    const report = await ok("GET", viewer, `/practice-admin/cohorts/${cohort.id}`);
    expect(report.students.map((s: { email: string; name: string; verified: boolean; plusUntil: string | null }) => [s.email, s.name, s.verified, s.plusUntil !== null])).toEqual([
      // One import's addresses come in alphabetical order.
      ["asha@college.edu", "Asha", true, true],
      ["kiran@college.edu", "Kiran", true, true],
      ["ravi@college.edu", "Ravi", true, true],
    ]);
    expect((await call("GET", owner, "/practice-admin/cohorts/nope")).statusCode).toBe(404);
    expect((await call("POST", owner, url, { csv: "\n\n" })).statusCode).toBe(422);
  });

  it("is staff's alone, and each organisation's own", async () => {
    const asha = await signUp("asha@college.edu", "Asha");
    expect((await call("GET", asha, "/practice-admin/cohorts")).statusCode).toBe(401);
    await ok("POST", owner, "/practice-admin/cohorts", { name: "Batch A", plusDays: 30 });
    expect((await ok("GET", owner, "/practice-admin/cohorts")).cohorts).toHaveLength(1);
  });
});
