import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel, type FakeModelScript } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** Plan row 87: an AI-fluency question, where the candidate may ask an AI assistant, and every ask is on the record. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let script: FakeModelScript;

const call = (method: "GET" | "POST" | "PUT", token: string, url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

const exam = {
  id: "ai-round",
  title: "AI-fluency round",
  questions: [
    { id: "dup", kind: "code", stem: "Find a duplicate in an array.", maxScore: 10, rubric: [{ id: "r1", description: "Finds a duplicate", weight: 1 }], language: "python", aiAssist: true },
    { id: "plain", kind: "code", stem: "Reverse a string.", maxScore: 10, rubric: [{ id: "r1", description: "Reverses it", weight: 1 }], language: "python" },
  ],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 1 },
};

beforeEach(async () => {
  db = await freshDatabase();
  const model = fakeModel({ latencyMs: 0 });
  script = model.script;
  const wiring = await wire(pgliteExecutor(db), { client: model.client });
  const org = await addOrganisation(wiring.identity, "org-a", "Acme");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  app = wiring.app;
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  const saved = await call("POST", owner, "/exams", exam);
  expect(saved.statusCode, saved.payload).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

async function start() {
  return (await call("POST", owner, "/exams/ai-round/attempts", { candidateId: "cand-1" })).json() as { attemptId: string; token: string };
}

describe("the AI assistant on an AI-fluency question", () => {
  it("is offered only where the author allows it", async () => {
    const { token } = await start();
    const questions = (await call("GET", token, "/attempts/me")).json().exam.questions;
    expect(questions.map((q: { id: string; aiAssist: boolean }) => [q.id, q.aiAssist])).toEqual([["dup", true], ["plain", false]]);
    expect((await call("POST", token, "/attempts/me/assist", { questionId: "plain", prompt: "help" })).statusCode).toBe(409);
    expect((await call("POST", token, "/attempts/me/assist", { questionId: "nope", prompt: "help" })).statusCode).toBe(409);
  });

  it("answers with the problem and the candidate's code in view, and puts every ask in the ledger", async () => {
    const { token, attemptId } = await start();
    const asked = await call("POST", token, "/attempts/me/assist", { questionId: "dup", prompt: "What's the fastest way?", code: "def dup(a):\n  pass" });
    expect(asked.statusCode, asked.payload).toBe(200);
    expect(asked.json()).toMatchObject({ questionId: "dup", prompt: "What's the fastest way?", reply: "Use a hash set: one pass, O(n).", left: 19 });
    expect(script.assistPrompts[0]).toContain("<problem>\nFind a duplicate in an array.\n</problem>");
    expect(script.assistPrompts[0]).toContain('<code language="python">\ndef dup(a):\n  pass\n</code>');

    // The second ask carries the first exchange with it.
    await call("POST", token, "/attempts/me/assist", { questionId: "dup", prompt: "And with no extra memory?" });
    expect(script.assistPrompts[1]).toContain("What's the fastest way?");
    expect(script.assistPrompts[1]).toContain("Use a hash set");

    // The candidate's page gets the conversation back on reload.
    expect((await call("GET", token, "/attempts/me")).json().assists).toEqual([
      expect.objectContaining({ questionId: "dup", prompt: "What's the fastest way?" }),
      expect.objectContaining({ questionId: "dup", prompt: "And with no extra memory?" }),
    ]);

    // The reviewer sees everything, the code as it was.
    const review = (await call("GET", owner, `/attempts/${attemptId}/review`)).json();
    expect(review.assists).toEqual([
      expect.objectContaining({ prompt: "What's the fastest way?", reply: "Use a hash set: one pass, O(n).", code: "def dup(a):\n  pass" }),
      expect.objectContaining({ prompt: "And with no extra memory?", code: null }),
    ]);

    // In the ledger, sealed like answers, and counted against the organisation's spend.
    await db.exec("RESET ROLE");
    const raw = await db.query<{ event: string }>(`SELECT event::text AS event FROM exam_ledger WHERE event->>'type' = 'ai_assisted'`);
    expect(raw.rows).toHaveLength(2);
    expect(raw.rows[0]!.event).not.toContain("fastest way");
    expect(raw.rows[0]!.event).toContain("enc:v1:");
    const usage = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM model_usage WHERE route = 'assist'`);
    expect(usage.rows[0]!.n).toBe(2);
    await db.exec("SET ROLE parikshaa_app");
  });

  it("stops at twenty asks a question, and once the attempt is submitted", async () => {
    const { token } = await start();
    for (let i = 0; i < 20; i++) expect((await call("POST", token, "/attempts/me/assist", { questionId: "dup", prompt: `ask ${i}` })).statusCode).toBe(200);
    const over = await call("POST", token, "/attempts/me/assist", { questionId: "dup", prompt: "one more" });
    expect(over.statusCode).toBe(429);
    await call("POST", token, "/attempts/me/submit");
    expect((await call("POST", token, "/attempts/me/assist", { questionId: "dup", prompt: "after" })).statusCode).toBe(409);
  });

  it("is turned away, not blocked, when the spend cap is reached", async () => {
    await call("PUT", owner, "/org/spend-cap", { monthlyCapMicroUsd: 1 });
    const { token } = await start();
    await call("POST", token, "/attempts/me/assist", { questionId: "dup", prompt: "first" });
    const capped = await call("POST", token, "/attempts/me/assist", { questionId: "dup", prompt: "second" });
    expect(capped.statusCode).toBe(503);
    expect(capped.json().message).toContain("carry on without it");
  });
});
