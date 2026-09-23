import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { InviteCodes } from "./invite-codes.js";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, PASSWORD, signIn, TOKEN_SECRET, wire } from "./testing/harness.js";

/**
 * ROADMAP §10: the logs say what happened to each request, and nothing a
 * candidate wrote, nothing the model asked them, no credential and no one's
 * contact details. The pseudonymization that protects the model call has to
 * hold for observability too.
 */

// Distinctive strings, so a leak anywhere in the log is found by searching for them.
const ANSWER = "ZEBRA-ANSWER-because-the-invariant-holds";
const PROBE = "PROBE-QUESTION-why-does-the-invariant-hold";
const REPLY = "REPLY-TEXT-the-loop-variant-decreases";
const EMAIL = "ananya.iyer.secret@college.test";
const NAME = "Ananya Secretname";
const PHONE = "9876543210";

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let lines: string[];
let owner: string;

beforeEach(async () => {
  lines = [];
  db = await freshDatabase();
  ({ app, identity } = await wire(pgliteExecutor(db), {
    client: fakeModel({ probe: PROBE }).client,
    server: { log: { level: "info", stream: { write: (line: string) => void lines.push(line) } } },
  }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string | null, url: string, payload?: object) =>
  app.inject({ method, url, ...(token === null ? {} : { headers: bearer(token) }), ...(payload === undefined ? {} : { payload }) });

describe("request logs", () => {
  it("carry no answer, probe, reply, credential or contact detail through a whole sitting", async () => {
    await call("POST", owner, "/exams", {
      id: "drive",
      title: "Drive",
      questions: [
        {
          id: "q1",
          kind: "short",
          stem: "Why does it terminate?",
          maxScore: 10,
          rubric: [{ id: "c1", description: "Names the measure", weight: 1 }],
          expectedPoints: ["a measure decreases"],
        },
        // Answered right, this is what earns the follow-up: short answers are probed once graded.
        { id: "q2", kind: "mcq", stem: "Pick", maxScore: 2, rubric: [], options: ["a", "b"], correctIndex: 0 },
      ],
      policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.1 },
    });
    const now = Date.now();
    await call("PUT", owner, "/exams/drive/window", {
      opensAt: new Date(now - 60_000).toISOString(),
      closesAt: new Date(now + 3_600_000).toISOString(),
    });
    await call("POST", owner, "/exams/drive/invitations/import", {
      csv: `ref,name,email,phone\nCS001,${NAME},${EMAIL},${PHONE}`,
      dryRun: false,
      channels: [],
    });
    const [invitation] = (await call("GET", owner, "/exams/drive/invitations")).json().invitations;
    const code = new InviteCodes(TOKEN_SECRET).issue("org-a", invitation.id);
    const { token, attemptId } = (await call("POST", null, "/invitations/redeem", { code })).json();

    await call("PUT", token, "/attempts/me/drafts/q1", { answer: ANSWER });
    await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: ANSWER });
    await call("POST", token, "/attempts/me/answers", { questionId: "q2", answer: "0" });
    const probe = await call("GET", token, "/attempts/me/probe");
    expect(probe.payload).toContain(PROBE);
    const probeId = JSON.parse(probe.payload.split("event: probe\ndata: ")[1]!.split("\n")[0]!).id;
    await call("POST", token, `/attempts/me/probes/${probeId}/reply`, { reply: REPLY });
    await call("POST", token, "/attempts/me/submit");
    await call("POST", owner, `/attempts/${attemptId}/grade`);
    await call("GET", owner, `/attempts/${attemptId}/report`);
    await call("GET", owner, "/exams/drive/results.csv");
    // A token in a query string, as a careless client might send one.
    await call("GET", null, `/attempts/me?token=${token}`);

    const log = lines.join("");
    expect(lines.length).toBeGreaterThan(10);
    for (const secret of [ANSWER, PROBE, REPLY, EMAIL, NAME, PHONE, PASSWORD, owner, token, code]) {
      expect(log, `the log contains ${secret.slice(0, 24)}…`).not.toContain(secret);
    }
  });

  it("say which route, how it ended, how long it took, and for which organisation", async () => {
    await call("GET", owner, "/exams");
    const entry = lines.map((l) => JSON.parse(l)).find((l) => l.route === "/exams" && l.method === "GET");
    expect(entry).toMatchObject({ msg: "request", status: 200, org: "org-a", ms: expect.any(Number), reqId: expect.any(String) });
  });

  it("log a server fault by its type and stack, not by a message that could quote a row", async () => {
    // Make the database fail mid-request with a message that quotes the row it tripped on.
    await db.exec(`RESET ROLE`);
    await db.exec(`CREATE FUNCTION explode() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Key (email)=(%) is not allowed', '${EMAIL}'; END $$`);
    await db.exec(`CREATE TRIGGER explode BEFORE INSERT ON exams FOR EACH ROW EXECUTE FUNCTION explode()`);
    await db.exec(`SET ROLE parikshaa_app`);

    const res = await call("POST", owner, "/exams", {
      id: "x",
      title: "X",
      questions: [{ id: "q", kind: "mcq", stem: "S", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
      policy: { durationMs: 60_000, allowRevision: true, vivaTriggerRatio: 0.5 },
    });

    expect(res.statusCode).toBe(500);
    expect(res.payload).not.toContain(EMAIL);
    const fault = lines.map((l) => JSON.parse(l)).find((l) => l.msg === "unhandled error");
    expect(fault).toMatchObject({ level: 50, err: { type: expect.any(String) } });
    expect(lines.join("")).not.toContain(EMAIL);
  });
});

describe("rate limits", () => {
  it("hold one organisation to its rate, without touching another's", async () => {
    await app.close();
    ({ app, identity } = await wire(pgliteExecutor(db), {
      client: fakeModel().client,
      server: { rateLimits: { organisation: { perSecond: 0.001, burst: 3 }, attempt: { perSecond: 0.001, burst: 3 } } },
    }));
    const other = await addOrganisation(identity, "org-b", "Other");
    await addStaff(identity, other, "owner@other.test", "owner");
    owner = await signIn(app, "owner@acme.test");
    const outsider = await signIn(app, "owner@other.test");

    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await call("GET", owner, "/exams")).statusCode);
    expect(statuses).toEqual([200, 200, 200, 429]);
    const refused = await call("GET", owner, "/exams");
    expect(refused.json().error).toBe("rate_limited");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);

    expect((await call("GET", outsider, "/exams")).statusCode).toBe(200);
  });
});
