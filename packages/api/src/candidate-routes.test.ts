import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import type { EmailMessage, Mailer } from "./delivery.js";
import { bearer, freshDatabase, wire } from "./testing/harness.js";

/**
 * A candidate's own account over HTTP (docs/HIRE-V2.md §1, §10 S5, S6, S19,
 * F22, F25; H1a): signing in with a mailed code, the profile, the export and
 * deleting the account. As `parikshaa_app`.
 */

let db: PGlite;
let app: FastifyInstance;
let sent: EmailMessage[];
let clock: number;

const mailer: Mailer = {
  async send(message) {
    sent.push(message);
  },
};

const call = (token: string | null, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: object, headers: Record<string, string> = {}) =>
  app.inject({ method, url, headers: { ...headers, ...(token === null ? {} : bearer(token)) }, ...(payload === undefined ? {} : { payload }) });

/** The code in the last mail to `to`. */
const codeFor = (to: string) => {
  const mail = sent.filter((m) => m.to === to).at(-1);
  return /^(\d{6}) is your Parikshaa code$/.exec(mail?.subject ?? "")?.[1] ?? "";
};

const signIn = async (email = "asha@example.com", keep = false) => {
  expect((await call(null, "POST", "/candidate/code", { email })).statusCode).toBe(200);
  const res = await call(null, "POST", "/candidate/verify", { email, code: codeFor(email.trim().toLowerCase()), keep });
  expect(res.statusCode, res.payload).toBe(200);
  return res.json() as { token: string; expiresAt: string; kept: boolean; account: { id: string; email: string } };
};

beforeEach(async () => {
  clock = Date.parse("2026-10-12T10:00:00Z");
  sent = [];
  db = await freshDatabase();
  ({ app } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, mailer, now: () => clock }));
  await db.exec(`SET ROLE parikshaa_app`);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("signing in", () => {
  it("mails a code, and the code signs in to a new account, then the same one", async () => {
    const first = await signIn("  Asha@Example.com ");
    expect(first.token).toMatch(/^pc_/);
    expect(first.account.email).toBe("asha@example.com");
    expect(first.kept).toBe(false);
    const me = await call(first.token, "GET", "/candidate/me");
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ id: first.account.id, email: "asha@example.com", name: null });
    expect((await signIn("asha@example.com", true)).account.id).toBe(first.account.id);
  });

  it("answers the same for any address, and refuses a wrong code like an unknown one", async () => {
    await signIn("asha@example.com");
    const known = await call(null, "POST", "/candidate/code", { email: "asha@example.com" });
    const unknown = await call(null, "POST", "/candidate/code", { email: "nobody@example.com" });
    expect([known.statusCode, unknown.statusCode]).toEqual([200, 200]);
    expect(known.payload).toBe(unknown.payload);
    const wrong = await call(null, "POST", "/candidate/verify", { email: "asha@example.com", code: "000000" });
    const none = await call(null, "POST", "/candidate/verify", { email: "someone@example.com", code: "000000" });
    expect([wrong.statusCode, none.statusCode]).toEqual([401, 401]);
    expect(wrong.payload).toBe(none.payload);
    expect((await call(null, "POST", "/candidate/code", { email: "not an address" })).statusCode).toBe(422);
  });

  it("is closed, and says why, where no mail is set up (F22)", async () => {
    await app.close();
    ({ app } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic }));
    const res = await call(null, "POST", "/candidate/code", { email: "asha@example.com" });
    expect(res.statusCode).toBe(503);
    expect(res.json().error).toBe("email_not_configured");
  });

  it("does not let a forged X-Forwarded-For change who is asking (S6)", async () => {
    for (const forged of ["1.1.1.1", "2.2.2.2", "3.3.3.3, 4.4.4.4"]) {
      await call(null, "POST", "/candidate/code", { email: `x${forged.length}@example.com` }, { "x-forwarded-for": forged });
    }
    const hashes = await db.query<{ ip_hash: string }>(`SELECT DISTINCT ip_hash FROM candidate_codes`);
    expect(hashes.rows).toHaveLength(1);
  });

  it("needs a session for everything but the code and the sign-in", async () => {
    for (const [method, url] of [
      ["GET", "/candidate/me"],
      ["GET", "/candidate/profile"],
      ["GET", "/candidate/export"],
      ["POST", "/candidate/step-up"],
      ["POST", "/candidate/signout-everywhere"],
    ] as const) {
      expect((await call(null, method, url)).statusCode, url).toBe(401);
      expect((await call("pc_not-a-session", method, url)).statusCode, url).toBe(401);
    }
  });
});

describe("sessions (S19)", () => {
  it("end on sign out, and everywhere at once", async () => {
    const one = await signIn();
    const two = await signIn();
    expect((await call(one.token, "POST", "/candidate/signout")).statusCode).toBe(200);
    expect((await call(one.token, "GET", "/candidate/me")).statusCode).toBe(401);
    const three = await signIn();
    const everywhere = await call(two.token, "POST", "/candidate/signout-everywhere");
    expect(everywhere.json()).toEqual({ ended: 2 });
    expect((await call(three.token, "GET", "/candidate/me")).statusCode).toBe(401);
  });

  it("last twelve hours unless kept on the device", async () => {
    const tab = await signIn("asha@example.com", false);
    const kept = await signIn("asha@example.com", true);
    clock += 13 * 3_600_000;
    expect((await call(tab.token, "GET", "/candidate/me")).statusCode).toBe(401);
    expect((await call(kept.token, "GET", "/candidate/me")).statusCode).toBe(200);
  });
});

describe("profile, export and delete", () => {
  it("keeps the profile and gives it back, with everything in the export", async () => {
    const s = await signIn();
    const put = await call(s.token, "PUT", "/candidate/profile", {
      name: "Asha Rao",
      phone: "+91 98765 43210",
      details: { headline: "Backend engineer", experienceYears: 4, skills: ["Go", "SQL"], links: { github: "https://github.com/asha" } },
    });
    expect(put.statusCode, put.payload).toBe(200);
    expect(put.json()).toEqual({
      name: "Asha Rao",
      phone: "+919876543210",
      details: { headline: "Backend engineer", experienceYears: 4, skills: ["Go", "SQL"], links: { github: "https://github.com/asha" } },
      resume: null,
    });
    expect((await call(s.token, "GET", "/candidate/profile")).json().name).toBe("Asha Rao");
    // Unknown fields and a bad link are refused.
    expect((await call(s.token, "PUT", "/candidate/profile", { name: null, phone: null, details: { salary: 1 } })).statusCode).toBe(400);
    expect((await call(s.token, "PUT", "/candidate/profile", { name: null, phone: null, details: { links: { github: "javascript:alert(1)" } } })).statusCode).toBe(400);
    expect((await call(s.token, "PUT", "/candidate/profile", { name: null, phone: "ring me", details: {} })).statusCode).toBe(422);

    const data = await call(s.token, "GET", "/candidate/export");
    expect(data.statusCode).toBe(200);
    expect(data.headers["content-disposition"]).toContain("parikshaa-account.json");
    expect(data.json()).toMatchObject({ account: { email: "asha@example.com" }, profile: { name: "Asha Rao" }, applications: [] });
    expect(data.payload).not.toContain(s.token);
  });

  it("deletes the account with a fresh code from the email, and not without one", async () => {
    const s = await signIn();
    expect((await call(s.token, "DELETE", "/candidate/me", { code: "123456" })).statusCode).toBe(401);
    expect((await call(s.token, "POST", "/candidate/step-up")).statusCode).toBe(200);
    const code = codeFor("asha@example.com");
    expect((await call(s.token, "DELETE", "/candidate/me", { code })).statusCode).toBe(200);
    expect((await call(s.token, "GET", "/candidate/me")).statusCode).toBe(401);
    expect(sent.at(-1)?.subject).toBe("Your Parikshaa account is deleted");
    // The address may start again, as a new account.
    expect((await signIn()).account.id).not.toBe(s.account.id);
  });
});
