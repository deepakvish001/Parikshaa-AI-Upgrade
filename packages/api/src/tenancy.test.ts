import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId as toAttemptId, candidateId, examId, orgId, type Exam, type OrgId } from "@parikshaa/core";
import { LedgerStore, pgliteExecutor, staffScope, type IdentityStore } from "@parikshaa/store";
import { AttemptTokens } from "./auth.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PASSWORD, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/**
 * Organisations, roles, API keys, sessions and model spend, through HTTP.
 *
 * Everything here runs as `parikshaa_app`, the runtime role, so row-level
 * security is enforced exactly as in production: a test that passes only
 * because the test database's superuser bypasses RLS cannot pass here.
 */

const E = "exam-1";

const examFor = (title: string): Exam => ({
  id: examId(E),
  title,
  questions: [
    {
      id: "q-mcq" as never,
      kind: "mcq",
      stem: "Which sort is stable?",
      maxScore: 4,
      rubric: [],
      options: ["quicksort", "mergesort"],
      correctIndex: 1,
    },
    {
      id: "q-short" as never,
      kind: "short",
      stem: "Why does it terminate?",
      maxScore: 10,
      rubric: [{ id: "c1", description: "Names the decreasing measure", weight: 1 }],
      expectedPoints: ["the measure decreases"],
    },
  ],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
});

/** 1,000 input and 100 output tokens on claude-opus-5: $0.0075, or 7,500 micro-dollars. */
const USAGE = { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const CALL_COST = 7500;

const fakeClient = {
  beta: {
    messages: {
      stream() {
        const text = "Why mergesort rather than quicksort?";
        return {
          on(_event: string, cb: (delta: string) => void) {
            cb(text);
          },
          async finalMessage() {
            return { content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null, usage: USAGE };
          },
        };
      },
    },
  },
  messages: {
    async parse(params: { system?: unknown }) {
      const grading = JSON.stringify(params.system).includes("grade exam answers");
      const parsed = grading
        ? { score: 6, criteriaMet: ["c1"], reasoning: "Names the measure." }
        : { verdict: "consistent", confidence: 0.8, reasoning: "Engaged the specifics." };
      return { stop_reason: "end_turn", stop_details: null, parsed_output: parsed, usage: USAGE };
    },
  },
} as unknown as Anthropic;

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let A: OrgId;
let B: OrgId;
let ownerA: string;
let ownerB: string;

beforeEach(async () => {
  db = await freshDatabase();
  const sql = pgliteExecutor(db);

  // Accounts are set up by the schema owner, as the bootstrap CLI would be...
  const wiring = await wire(sql, { client: fakeClient });
  ({ app, identity } = wiring);
  A = await addOrganisation(identity, "org-a", "Acme");
  B = await addOrganisation(identity, "org-b", "Bharat Labs");
  await addStaff(identity, A, "owner@acme.test", "owner", "Asha");
  await addStaff(identity, B, "owner@bharat.test", "owner", "Bilal");

  // ...and everything after runs as the runtime role.
  await db.exec(`SET ROLE parikshaa_app`);

  ownerA = await signIn(app, "owner@acme.test");
  ownerB = await signIn(app, "owner@bharat.test");
  await post(ownerA, "/exams", examFor("Acme's algorithms paper"));
  await post(ownerB, "/exams", examFor("Bharat's algorithms paper"));
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const get = (token: string, url: string) => app.inject({ method: "GET", url, headers: bearer(token) });
const post = (token: string, url: string, payload?: object) =>
  payload === undefined
    ? app.inject({ method: "POST", url, headers: bearer(token) })
    : app.inject({ method: "POST", url, headers: bearer(token), payload });

async function startAttempt(token: string): Promise<{ attemptId: string; token: string }> {
  const res = await post(token, `/exams/${E}/attempts`, { candidateId: "cand-1" });
  expect(res.statusCode).toBe(201);
  return res.json();
}

/** Answer, get probed, reply, submit: an attempt ready to assess and grade. */
async function sitThrough(candidate: string): Promise<string> {
  await post(candidate, "/attempts/me/answers", { questionId: "q-mcq", answer: "1" });
  const probe = await get(candidate, "/attempts/me/probe");
  const probeId = JSON.parse(probe.payload.split("event: probe\ndata: ")[1]?.split("\n")[0] ?? "{}").id as string;
  await post(candidate, `/attempts/me/probes/${probeId}/reply`, { reply: "It keeps equal keys in order." });
  await post(candidate, "/attempts/me/answers", { questionId: "q-short", answer: "A measure decreases." });
  await post(candidate, "/attempts/me/submit");
  return probeId;
}

describe("between organisations", () => {
  it("keeps exams apart, even under the same id", async () => {
    expect((await get(ownerA, "/exams")).json().exams).toEqual([
      expect.objectContaining({ id: E, title: "Acme's algorithms paper" }),
    ]);
    expect((await get(ownerB, `/exams/${E}`)).json().title).toBe("Bharat's algorithms paper");
  });

  it("does not let one organisation see or act on another's attempt", async () => {
    const { attemptId, token } = await startAttempt(ownerA);
    await sitThrough(token);

    expect((await get(ownerB, `/exams/${E}/attempts`)).json().attempts).toEqual([]);
    for (const res of [
      await get(ownerB, `/attempts/${attemptId}/review`),
      await post(ownerB, `/attempts/${attemptId}/grade`),
      await post(ownerB, `/attempts/${attemptId}/void`, { reason: "Trying from the wrong organisation." }),
    ]) {
      expect(res.statusCode).toBe(404);
    }

    // And nothing it tried reached A's record.
    expect((await get(ownerA, `/attempts/${attemptId}/review`)).json().state).toBe("submitted");
  });

  it("binds a candidate token to its organisation", async () => {
    const { attemptId } = await startAttempt(ownerA);

    // A correctly signed token naming A's attempt under B — the shape a bug in
    // token issuance would produce. The organisation in the token wins.
    const crossed = await new AttemptTokens(TOKEN_SECRET).issue(
      { orgId: B, attemptId: toAttemptId(attemptId), examId: examId(E), candidateId: candidateId("cand-1") },
      60,
    );
    expect((await get(crossed, "/attempts/me")).statusCode).toBe(404);
  });

  it("refuses a candidate token that names no organisation", async () => {
    const { SignJWT } = await import("jose");
    const legacy = await new SignJWT({ attemptId: "a", examId: E, candidateId: "c" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("parikshaa")
      .setAudience("parikshaa-attempt")
      .setExpirationTime("60s")
      .sign(new TextEncoder().encode(TOKEN_SECRET));

    expect((await get(legacy, "/attempts/me")).statusCode).toBe(401);
  });

  it("keeps audit logs and spend apart", async () => {
    const { token } = await startAttempt(ownerA);
    await sitThrough(token);

    expect((await get(ownerB, "/audit")).json().entries.map((e: { action: string }) => e.action)).not.toContain(
      "attempt.started",
    );
    expect((await get(ownerB, "/usage")).json().totalCostMicroUsd).toBe(0);
    expect((await get(ownerA, "/usage")).json().totalCostMicroUsd).toBe(CALL_COST);
  });

  it("does not let an owner manage another organisation's staff", async () => {
    const bStaff = (await get(ownerB, "/staff")).json().users[0].id as string;

    expect((await post(ownerA, `/staff/${bStaff}/disable`)).statusCode).toBe(404);
    expect((await get(ownerA, "/staff")).json().users.map((u: { email: string }) => u.email)).toEqual([
      "owner@acme.test",
    ]);
  });
});

describe("roles", () => {
  const as = async (role: "author" | "invigilator" | "reviewer" | "viewer") => {
    await addStaff(identity, A, `${role}@acme.test`, role);
    return signIn(app, `${role}@acme.test`);
  };

  it("lets an invigilator start attempts but not see the answer key or the evidence", async () => {
    const invigilator = await as("invigilator");
    const { attemptId } = await startAttempt(invigilator);

    expect((await get(invigilator, "/exams")).statusCode).toBe(200);
    expect((await get(invigilator, `/exams/${E}`)).statusCode).toBe(403);
    expect((await get(invigilator, `/attempts/${attemptId}/review`)).statusCode).toBe(403);
    expect((await post(invigilator, "/exams", examFor("Rewritten"))).statusCode).toBe(403);
  });

  it("lets an author write exams but not grade", async () => {
    const author = await as("author");
    const { attemptId, token } = await startAttempt(author);
    await sitThrough(token);

    expect((await post(author, "/exams", { ...examFor("Draft"), id: "exam-2" })).statusCode).toBe(201);
    expect((await post(author, `/attempts/${attemptId}/grade`)).statusCode).toBe(403);
  });

  it("lets a reviewer grade, assess and set aside, but not manage accounts", async () => {
    const reviewer = await as("reviewer");
    const { attemptId, token } = await startAttempt(ownerA);
    const probeId = await sitThrough(token);

    expect((await post(reviewer, `/attempts/${attemptId}/assess/${probeId}`)).statusCode).toBe(200);
    expect((await post(reviewer, `/attempts/${attemptId}/grade`)).json()).toEqual({ total: 10 });
    expect((await get(reviewer, "/staff")).statusCode).toBe(403);
    expect((await get(reviewer, "/usage")).statusCode).toBe(403);
  });

  it("lets a viewer read results and nothing else", async () => {
    const viewer = await as("viewer");
    const { attemptId } = await startAttempt(ownerA);

    expect((await get(viewer, `/attempts/${attemptId}/review`)).statusCode).toBe(200);
    expect((await post(viewer, `/attempts/${attemptId}/grade`)).statusCode).toBe(403);
    expect((await post(viewer, `/exams/${E}/attempts`, { candidateId: "c" })).statusCode).toBe(403);
  });

  it("tells a client what the signed-in account may do", async () => {
    const invigilator = await as("invigilator");
    const me = (await get(invigilator, "/auth/me")).json();

    expect(me).toMatchObject({ kind: "user", role: "invigilator", organisation: { id: "org-a", name: "Acme" } });
    expect(me.permissions).toEqual(["exam:read", "attempt:start", "attempt:read"]);
  });
});

describe("setting an attempt aside, attributed", () => {
  it("records who decided, in the ledger the candidate can verify", async () => {
    const { attemptId, token } = await startAttempt(ownerA);
    await sitThrough(token);

    await post(ownerA, `/attempts/${attemptId}/void`, { reason: "Could not establish provenance on review." });

    const ledger = (await get(token, "/attempts/me/ledger")).json();
    const voided = ledger.entries.at(-1).event;
    expect(voided).toMatchObject({ type: "attempt_voided", decidedBy: { name: "Asha" } });
    expect(voided.decidedBy.userId).toEqual(expect.any(String));
  });

  it("is refused to an API key, whatever its role", async () => {
    const key = (await post(ownerA, "/api-keys", { name: "ATS", role: "reviewer" })).json().secret as string;
    const { attemptId, token } = await startAttempt(ownerA);
    await sitThrough(token);

    // An integration can grade; it cannot decide.
    expect((await post(key, `/attempts/${attemptId}/grade`)).statusCode).toBe(200);
    expect((await post(key, `/attempts/${attemptId}/void`, { reason: "Automated decision to set aside." })).statusCode).toBe(403);
  });
});

describe("API keys", () => {
  it("serves an integration, is shown once, and stops working when revoked", async () => {
    const issued = (await post(ownerA, "/api-keys", { name: "Greenhouse", role: "invigilator" })).json();
    expect(issued.secret).toMatch(/^pkk_/);

    const started = await post(issued.secret, `/exams/${E}/attempts`, { candidateId: "ats-123" });
    expect(started.statusCode).toBe(201);

    const listed = (await get(ownerA, "/api-keys")).json().keys;
    expect(listed).toEqual([expect.objectContaining({ id: issued.id, name: "Greenhouse", revoked: false })]);
    expect(JSON.stringify(listed)).not.toContain(issued.secret);

    await app.inject({ method: "DELETE", url: `/api-keys/${issued.id}`, headers: bearer(ownerA) });
    expect((await get(issued.secret, "/exams")).statusCode).toBe(401);
  });

  it("cannot be made an owner", async () => {
    expect((await post(ownerA, "/api-keys", { name: "root", role: "owner" })).statusCode).toBe(400);
  });
});

describe("sessions", () => {
  it("answers a wrong password and an unknown address the same way", async () => {
    const wrong = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "owner@acme.test", password: "not the password" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nobody@acme.test", password: "not the password" },
    });

    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.payload).toBe(unknown.payload);
  });

  it("ends a session on logout", async () => {
    await post(ownerA, "/auth/logout");
    expect((await get(ownerA, "/exams")).statusCode).toBe(401);
  });

  it("ends every session when the password changes", async () => {
    const other = await signIn(app, "owner@acme.test");
    const next = "a new and longer passphrase";

    expect((await post(ownerA, "/auth/password", { current: PASSWORD, next })).statusCode).toBe(200);
    expect((await get(other, "/exams")).statusCode).toBe(401);
    await expect(signIn(app, "owner@acme.test")).rejects.toThrow();
    expect(await signIn(app, "owner@acme.test", next)).toMatch(/^pks_/);
  });

  it("refuses a short password", async () => {
    const res = await post(ownerA, "/auth/password", { current: PASSWORD, next: "short" });
    expect(res.statusCode).toBe(422);
  });

  it("ends a disabled account's sessions at once", async () => {
    await addStaff(identity, A, "leaver@acme.test", "reviewer");
    const leaver = await signIn(app, "leaver@acme.test");
    const id = (await get(leaver, "/auth/me")).json().id as string;

    await post(ownerA, `/staff/${id}/disable`);

    expect((await get(leaver, "/exams")).statusCode).toBe(401);
    await expect(signIn(app, "leaver@acme.test")).rejects.toThrow();
  });

  it("keeps at least one owner", async () => {
    const me = (await get(ownerA, "/auth/me")).json().id as string;

    const demote = await app.inject({
      method: "PATCH",
      url: `/staff/${me}`,
      headers: bearer(ownerA),
      payload: { role: "viewer" },
    });
    expect(demote.statusCode).toBe(409);
    expect((await post(ownerA, `/staff/${me}/disable`)).statusCode).toBe(409);
  });

  it("stops accepting guesses after repeated failures, even a right one", async () => {
    const attempt = (password: string) =>
      app.inject({ method: "POST", url: "/auth/login", payload: { email: "owner@acme.test", password } });

    for (let i = 0; i < 10; i++) expect((await attempt(`guess ${i}`)).statusCode).toBe(401);

    expect((await attempt(PASSWORD)).statusCode).toBe(429);
  });

  it("adds staff who can then sign in", async () => {
    const created = await post(ownerA, "/staff", {
      email: "new@acme.test",
      name: "Neha",
      role: "author",
      password: "an initial passphrase",
    });
    expect(created.statusCode).toBe(201);
    expect(created.payload).not.toContain("passphrase");

    const token = await signIn(app, "new@acme.test", "an initial passphrase");
    expect((await get(token, "/auth/me")).json().role).toBe("author");

    const duplicate = await post(ownerB, "/staff", {
      email: "NEW@acme.test",
      name: "Someone",
      role: "viewer",
      password: "another passphrase",
    });
    expect(duplicate.statusCode).toBe(409);
  });
});

describe("the audit log", () => {
  it("records what staff did, and who", async () => {
    const { attemptId, token } = await startAttempt(ownerA);
    await sitThrough(token);
    await post(ownerA, `/attempts/${attemptId}/grade`);

    const entries = (await get(ownerA, "/audit")).json().entries as { action: string; actorId: string }[];
    const me = (await get(ownerA, "/auth/me")).json().id as string;

    expect(entries.map((e) => e.action)).toEqual(
      expect.arrayContaining(["auth.login", "exam.saved", "attempt.started", "attempt.graded"]),
    );
    expect(entries.find((e) => e.action === "attempt.graded")?.actorId).toBe(me);
  });
});

describe("model spend (ROADMAP §0)", () => {
  it("records every call against its attempt, by route", async () => {
    const { attemptId, token } = await startAttempt(ownerA);
    const probeId = await sitThrough(token);
    await post(ownerA, `/attempts/${attemptId}/assess/${probeId}`);
    await post(ownerA, `/attempts/${attemptId}/grade`);

    const usage = (await get(ownerA, "/usage")).json();

    expect(usage.routes.map((r: { route: string; calls: number }) => [r.route, r.calls])).toEqual([
      ["assess", 1],
      ["grade", 1],
      ["probe", 1],
    ]);
    expect(usage.totalCostMicroUsd).toBe(3 * CALL_COST);
    expect(usage.perAttempt).toMatchObject({ attempts: 1, p50MicroUsd: 3 * CALL_COST });
    expect(usage.spentThisMonthMicroUsd).toBe(3 * CALL_COST);
    expect(usage.monthlyCapMicroUsd).toBeNull();
  });

  it("stops model work at the cap, quietly for the candidate", async () => {
    const put = await app.inject({
      method: "PUT",
      url: "/org/spend-cap",
      headers: bearer(ownerA),
      payload: { monthlyCapMicroUsd: CALL_COST },
    });
    expect(put.statusCode).toBe(200);

    const first = await startAttempt(ownerA);
    const probeId = await sitThrough(first.token); // one probe: the cap is now reached

    // The next candidate is simply not probed; they are not told about billing.
    const second = await startAttempt(ownerA);
    await post(second.token, "/attempts/me/answers", { questionId: "q-mcq", answer: "1" });
    expect((await get(second.token, "/attempts/me/probe")).payload).toContain("event: none");

    // Staff asking for model work are told.
    const assess = await post(ownerA, `/attempts/${first.attemptId}/assess/${probeId}`);
    expect(assess.statusCode).toBe(402);
    expect(assess.json().error).toBe("spend_cap_reached");
    expect((await post(ownerA, `/attempts/${first.attemptId}/grade`)).statusCode).toBe(402);

    // Grading that needs no model is not held back by a model budget.
    await post(second.token, "/attempts/me/submit");
    expect((await post(ownerA, `/attempts/${second.attemptId}/grade`)).json()).toEqual({ total: 4 });
  });

  it("is restricted to those who manage the organisation", async () => {
    await addStaff(identity, A, "author@acme.test", "author");
    const author = await signIn(app, "author@acme.test");

    const put = await app.inject({
      method: "PUT",
      url: "/org/spend-cap",
      headers: bearer(author),
      payload: { monthlyCapMicroUsd: 0 },
    });
    expect(put.statusCode).toBe(403);
  });
});

describe("grading", () => {
  it("writes nothing if a model call fails part-way", async () => {
    const { attemptId, token } = await startAttempt(ownerA);
    await sitThrough(token);

    const failing = await wire(pgliteExecutor(db), {
      client: {
        messages: {
          async parse() {
            throw new Error("overloaded");
          },
        },
      } as unknown as Anthropic,
    });
    const reviewer = await signIn(failing.app, "owner@acme.test");
    expect((await failing.app.inject({ method: "POST", url: `/attempts/${attemptId}/grade`, headers: bearer(reviewer) })).statusCode).toBe(500);
    await failing.app.close();

    // No partial scores: the mcq was scorable without a model, but it was not
    // written on its own, so the attempt can simply be graded again.
    const entries = await new LedgerStore(pgliteExecutor(db)).load(staffScope(orgId("org-a")), toAttemptId(attemptId));
    expect(entries.map((e) => e.event.type)).not.toContain("question_scored");
    expect((await post(ownerA, `/attempts/${attemptId}/grade`)).json()).toEqual({ total: 10 });
  });
});
