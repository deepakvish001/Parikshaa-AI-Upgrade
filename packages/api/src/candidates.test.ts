import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CandidateStore, DataKeys, pgliteExecutor } from "@parikshaa/store";
import { CandidateRefused, Candidates, CODE_LIMITS, ERASE_AFTER_WARNING_MS, UNUSED_AFTER_MS, normaliseEmail } from "./candidates.js";
import type { EmailMessage, Mailer } from "./delivery.js";
import { freshDatabase } from "./testing/harness.js";

/** Candidate accounts (docs/HIRE-V2.md §1, §10 S5, S19, F4, F22; H1a): code sign-in, sessions, profile, export, delete. */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let db: PGlite;
let store: CandidateStore;
let candidates: Candidates;
let clock: number;
let sent: EmailMessage[];
let failing: boolean;
let nextCode: string;

const mailer: Mailer = {
  async send(message) {
    if (failing) throw new Error("SMTP down");
    sent.push(message);
  },
};

const make = (over: Partial<ConstructorParameters<typeof Candidates>[0]> = {}) =>
  new Candidates({ store, keys: new DataKeys(Buffer.alloc(32, 9)), mailer, now: () => new Date(clock), newCode: () => nextCode, ...over });

const signIn = async (email = "asha@example.com", keep = false) => {
  await candidates.requestCode(email, "10.0.0.1");
  return candidates.verify(email, nextCode, keep);
};

const refusal = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (error) {
    if (error instanceof CandidateRefused) return error.code;
    throw error;
  }
  return "none";
};

beforeEach(async () => {
  clock = Date.parse("2026-10-12T10:00:00Z");
  db = await freshDatabase();
  await db.exec(`SET ROLE parikshaa_app`);
  store = new CandidateStore(pgliteExecutor(db), new DataKeys(Buffer.alloc(32, 9)).records("candidates"));
  sent = [];
  failing = false;
  nextCode = "482913";
  candidates = make();
});

afterEach(async () => {
  await db.close();
});

describe("signing in with a mailed code (S5)", () => {
  it("makes the account only when the code is entered, and finds it again after", async () => {
    await candidates.requestCode("  Asha@Example.com ", "10.0.0.1");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "asha@example.com", subject: "482913 is your Parikshaa code" });
    expect(sent[0]!.text).not.toMatch(/https?:/);
    expect(await store.accountByEmail("asha@example.com")).toBeNull();
    const first = await candidates.verify("asha@example.com", "482913", false);
    expect(first.token).toMatch(/^pc_/);
    expect(first.account.email).toBe("asha@example.com");
    expect((await candidates.account(first.token))?.id).toBe(first.account.id);
    nextCode = "000123";
    const again = await signIn("ASHA@example.com");
    expect(again.account.id).toBe(first.account.id);
  });

  it("answers the same for an address with an account and one without", async () => {
    await signIn("asha@example.com");
    sent = [];
    await candidates.requestCode("asha@example.com", "10.0.0.2");
    await candidates.requestCode("nobody@example.com", "10.0.0.2");
    expect(sent.map((m) => m.subject)).toEqual(["482913 is your Parikshaa code", "482913 is your Parikshaa code"]);
    expect(await refusal(candidates.verify("asha@example.com", "111111", false))).toBe("sign_in_failed");
    expect(await refusal(candidates.verify("nobody@example.com", "111111", false))).toBe("sign_in_failed");
  });

  it("takes a code once, for ten minutes, for five tries, and only the newest", async () => {
    await candidates.requestCode("asha@example.com", "10.0.0.1");
    clock += 11 * MIN;
    expect(await refusal(candidates.verify("asha@example.com", "482913", false))).toBe("sign_in_failed");

    await candidates.requestCode("asha@example.com", "10.0.0.1");
    for (let i = 0; i < 5; i++) expect(await refusal(candidates.verify("asha@example.com", "999999", false))).toBe("sign_in_failed");
    expect(await refusal(candidates.verify("asha@example.com", "482913", false))).toBe("sign_in_failed");

    await candidates.requestCode("asha@example.com", "10.0.0.1");
    nextCode = "777777";
    await candidates.requestCode("asha@example.com", "10.0.0.1");
    expect(await refusal(candidates.verify("asha@example.com", "482913", false))).toBe("sign_in_failed");
    await candidates.verify("asha@example.com", "777777", false);
    expect(await refusal(candidates.verify("asha@example.com", "777777", false))).toBe("sign_in_failed");
  });

  it("holds the limits per address, per network address and for everyone", async () => {
    for (let i = 0; i < CODE_LIMITS.perEmailHour; i++) await candidates.requestCode("asha@example.com", `10.0.0.${i}`);
    expect(await refusal(candidates.requestCode("asha@example.com", "10.0.1.1"))).toBe("too_many");
    clock += HOUR + MIN;
    for (let i = 0; i < CODE_LIMITS.perEmailDay - CODE_LIMITS.perEmailHour; i++) await candidates.requestCode("asha@example.com", `10.0.2.${i}`);
    clock += HOUR + MIN;
    expect(await refusal(candidates.requestCode("asha@example.com", "10.0.3.1"))).toBe("too_many");

    const perIp = make({ limits: { ...CODE_LIMITS, perIpHour: 2 } });
    await perIp.requestCode("a@example.com", "10.9.9.9");
    await perIp.requestCode("b@example.com", "10.9.9.9");
    expect(await refusal(perIp.requestCode("c@example.com", "10.9.9.9"))).toBe("too_many");

    const breaker = make({ limits: { ...CODE_LIMITS, allPerHour: 1 } });
    expect(await refusal(breaker.requestCode("d@example.com", "10.8.8.8"))).toBe("too_many");
  });

  it("locks an address for a day after three codes ran out of tries", async () => {
    for (let n = 0; n < 3; n++) {
      await candidates.requestCode("asha@example.com", "10.0.0.1");
      for (let i = 0; i < 5; i++) await refusal(candidates.verify("asha@example.com", "000000", false));
      clock += 21 * MIN;
    }
    expect(await refusal(candidates.requestCode("asha@example.com", "10.0.0.1"))).toBe("too_many");
    clock += DAY;
    await candidates.requestCode("asha@example.com", "10.0.0.1");
  });

  it("is closed without a mailer, and says so when the mail does not go", async () => {
    const closed = make({ mailer: null });
    expect(closed.open).toBe(false);
    expect(await refusal(closed.requestCode("asha@example.com", "10.0.0.1"))).toBe("email_not_configured");
    failing = true;
    expect(await refusal(candidates.requestCode("asha@example.com", "10.0.0.1"))).toBe("mail_failed");
    const hanging = make({ mailer: { send: () => new Promise(() => undefined) }, mailTimeoutMs: 20 });
    expect(await refusal(hanging.requestCode("asha@example.com", "10.0.0.1"))).toBe("mail_failed");
  });

  it("refuses what is not an address or not a code", async () => {
    expect(normaliseEmail(" A@B.co ")).toBe("a@b.co");
    expect(normaliseEmail("no at sign")).toBeNull();
    expect(await refusal(candidates.requestCode("not an email", "10.0.0.1"))).toBe("invalid");
    await candidates.requestCode("asha@example.com", "10.0.0.1");
    expect(await refusal(candidates.verify("asha@example.com", "48291", false))).toBe("sign_in_failed");
    expect(await refusal(candidates.verify("asha@example.com", "abcdef", false))).toBe("sign_in_failed");
    // A malformed code spent no try.
    await candidates.verify("asha@example.com", "482913", false);
  });
});

describe("sessions (S19)", () => {
  it("last a day unless kept, and kept ones run on from each use", async () => {
    const tab = await signIn("asha@example.com", false);
    expect(Date.parse(tab.expiresAt) - clock).toBe(12 * HOUR);
    clock += 13 * HOUR;
    expect(await candidates.account(tab.token)).toBeNull();

    const kept = await signIn("asha@example.com", true);
    expect(kept.kept).toBe(true);
    clock += 10 * DAY;
    expect(await candidates.account(kept.token)).not.toBeNull();
    clock += 10 * DAY;
    expect(await candidates.account(kept.token)).not.toBeNull();
    clock += 15 * DAY;
    expect(await candidates.account(kept.token)).toBeNull();
  });

  it("end on sign out, or everywhere at once", async () => {
    const one = await signIn();
    nextCode = "222222";
    const two = await signIn();
    nextCode = "333333";
    const three = await signIn();
    await candidates.signOut(one.token);
    expect(await candidates.account(one.token)).toBeNull();
    expect(await candidates.signOutEverywhere(two.account)).toBe(2);
    expect(await candidates.account(two.token)).toBeNull();
    expect(await candidates.account(three.token)).toBeNull();
    expect(await candidates.account("pks_staff_token")).toBeNull();
    expect(await candidates.account(undefined)).toBeNull();
  });
});

describe("profile, export and delete", () => {
  it("keeps the profile, and exports everything but the tokens", async () => {
    const s = await signIn();
    const profile = await candidates.saveProfile(s.account, {
      name: " Asha Rao ",
      phone: "+91 98765-43210",
      details: { headline: "Backend engineer", skills: ["Go"], noticeDays: 30 },
    });
    expect(profile).toEqual({ name: "Asha Rao", phone: "+919876543210", details: { headline: "Backend engineer", skills: ["Go"], noticeDays: 30 }, resume: null });
    expect(await refusal(candidates.saveProfile(s.account, { name: null, phone: "call me", details: {} }))).toBe("invalid");
    const data = await candidates.exportData(s.account);
    expect(data.profile.name).toBe("Asha Rao");
    expect(data.sessions).toHaveLength(1);
    expect(data.applications).toEqual([]);
    expect(JSON.stringify(data)).not.toContain(s.token);
  });

  it("deletes the account only with a fresh code mailed to it", async () => {
    const s = await signIn();
    nextCode = "654321";
    expect(await refusal(candidates.deleteAccount(s.account, "654321"))).toBe("sign_in_failed");
    // A sign-in code is not a step-up code.
    await candidates.requestCode("asha@example.com", "10.0.0.1");
    expect(await refusal(candidates.deleteAccount(s.account, "654321"))).toBe("sign_in_failed");
    await candidates.requestStepUp(s.account, "10.0.0.1");
    sent = [];
    await candidates.deleteAccount(s.account, "654321");
    expect(await candidates.account(s.token)).toBeNull();
    expect(await store.accountByEmail("asha@example.com")).toBeNull();
    expect(sent.map((m) => m.subject)).toEqual(["Your Parikshaa account is deleted"]);
  });
});

describe("the hourly sweep (F4, F22)", () => {
  it("warns an account unused for three years, and erases it thirty days later unless used", async () => {
    const old = await signIn("old@example.com");
    nextCode = "121212";
    const back = await signIn("back@example.com");
    clock += UNUSED_AFTER_MS + DAY;
    sent = [];
    expect(await candidates.sweep()).toMatchObject({ warned: 2, erased: 0 });
    expect(sent.map((m) => m.to).sort()).toEqual(["back@example.com", "old@example.com"]);
    expect(await candidates.sweep()).toMatchObject({ warned: 0, erased: 0 });
    clock += 5 * DAY;
    nextCode = "343434";
    await signIn("back@example.com");
    clock += ERASE_AFTER_WARNING_MS;
    expect(await candidates.sweep()).toMatchObject({ warned: 0, erased: 1 });
    expect(await store.account(old.account.id)).toBeNull();
    expect(await store.account(back.account.id)).not.toBeNull();
  });

  it("does not erase anyone it could not tell", async () => {
    await signIn("old@example.com");
    clock += UNUSED_AFTER_MS + DAY;
    failing = true;
    expect(await candidates.sweep()).toMatchObject({ warned: 0, erased: 0 });
    clock += ERASE_AFTER_WARNING_MS + DAY;
    expect(await candidates.sweep()).toMatchObject({ warned: 0, erased: 0 });
    expect(await store.accountByEmail("old@example.com")).not.toBeNull();
  });
});
