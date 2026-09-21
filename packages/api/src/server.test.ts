import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { examId, questionId, verifyChain, type Exam } from "@parikshaa/core";
import { LedgerStore, pgliteExecutor } from "@parikshaa/store";
import { AttemptTokens } from "./auth.js";
import { buildServer } from "./server.js";
import { ExamService } from "./service.js";

const E = examId("exam-1");
const Q_MCQ = questionId("q-mcq");
const Q_SHORT = questionId("q-short");

const exam: Exam = {
  id: E,
  title: "Algorithms",
  questions: [
    {
      id: Q_MCQ,
      kind: "mcq",
      stem: "Which sort is stable?",
      maxScore: 4,
      rubric: [],
      options: ["quicksort", "mergesort", "heapsort"],
      correctIndex: 1,
    },
    {
      id: Q_SHORT,
      kind: "short",
      stem: "Why does it terminate?",
      maxScore: 10,
      rubric: [{ id: "c1", description: "Identifies the decreasing measure", weight: 1 }],
      expectedPoints: ["the measure decreases"],
    },
  ],
  policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.5 },
};

const STAFF = "staff-secret";
const SECRET = "a".repeat(40);

/** Verdict the fake assessor returns; tests reassign it. */
let verdict = { verdict: "consistent" as const, confidence: 0.9, reasoning: "Engaged the specifics." };
let rubricScore = 7;

const fakeClient = {
  beta: {
    messages: {
      stream() {
        const text = "Which quantity decreases each round?";
        return {
          on(_event: string, cb: (delta: string) => void) {
            cb(text);
          },
          async finalMessage() {
            return { content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null };
          },
        };
      },
    },
  },
  messages: {
    async parse(params: { system?: unknown }) {
      const sent = JSON.stringify(params.system);
      const parsed = sent.includes("grade exam answers")
        ? { score: rubricScore, criteriaMet: ["c1"], reasoning: "Identifies the measure." }
        : verdict;
      return { stop_reason: "end_turn", stop_details: null, parsed_output: parsed };
    },
  },
} as unknown as Anthropic;

let db: PGlite;
let app: FastifyInstance;
let clock: number;
let token: string;
let attemptId: string;

const migration = (name: string) =>
  readFile(fileURLToPath(new URL(`../../store/migrations/${name}`, import.meta.url)), "utf8");

beforeEach(async () => {
  clock = 1_700_000_000_000;
  verdict = { verdict: "consistent", confidence: 0.9, reasoning: "Engaged the specifics." };
  rubricScore = 7;

  db = new PGlite();
  await db.exec(await migration("0001_init.sql"));

  const now = () => (clock += 1000);
  const store = new LedgerStore(pgliteExecutor(db), { clock: now });
  let counter = 0;
  const service = new ExamService({
    store,
    client: fakeClient,
    now,
    newId: () => `id-${++counter}`,
  });

  app = buildServer({ service, tokens: new AttemptTokens(SECRET), staffToken: STAFF });
  await app.ready();

  const staff = { authorization: `Bearer ${STAFF}` };
  await app.inject({ method: "POST", url: "/exams", headers: staff, payload: exam });
  const started = await app.inject({
    method: "POST",
    url: `/exams/${E}/attempts`,
    headers: staff,
    payload: { candidateId: "cand-1" },
  });
  ({ attemptId, token } = started.json());
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const asCandidate = () => ({ authorization: `Bearer ${token}` });
const asStaff = () => ({ authorization: `Bearer ${STAFF}` });

const answer = (question: string, text: string) =>
  app.inject({
    method: "POST",
    url: "/attempts/me/answers",
    headers: asCandidate(),
    payload: { questionId: question, answer: text },
  });

describe("attempt lifecycle", () => {
  it("runs answer -> probe -> reply -> submit -> grade -> review", async () => {
    expect(attemptId).toBe("id-1");

    expect((await answer(Q_MCQ, "1")).statusCode).toBe(202);
    expect((await answer(Q_SHORT, "The potential decreases.")).statusCode).toBe(202);

    const probeRes = await app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() });
    expect(probeRes.payload).toContain("event: token");
    expect(probeRes.payload).toContain("Which quantity decreases each round?");

    const probeId = JSON.parse(
      probeRes.payload.split("event: probe\ndata: ")[1]?.split("\n")[0] ?? "{}",
    ).id as string;

    const reply = await app.inject({
      method: "POST",
      url: `/attempts/me/probes/${probeId}/reply`,
      headers: asCandidate(),
      payload: { reply: "The potential function, bounded below by zero." },
    });
    expect(reply.statusCode).toBe(200);

    expect((await app.inject({ method: "POST", url: "/attempts/me/submit", headers: asCandidate() })).statusCode).toBe(200);

    const graded = await app.inject({
      method: "POST",
      url: `/attempts/${attemptId}/grade`,
      headers: asStaff(),
    });
    // mcq answered correctly (4) + rubric grade for the short answer (7).
    expect(graded.json()).toEqual({ total: 11 });

    const review = await app.inject({ method: "GET", url: `/attempts/${attemptId}/review`, headers: asStaff() });
    expect(review.json().state).toBe("graded");
  });

  it("measures reply latency on the server and ignores what the client claims", async () => {
    await answer(Q_MCQ, "1");
    const probeRes = await app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() });
    const probeId = JSON.parse(
      probeRes.payload.split("event: probe\ndata: ")[1]?.split("\n")[0] ?? "{}",
    ).id as string;

    clock += 30_000; // the candidate thinks for half a minute

    const reply = await app.inject({
      method: "POST",
      url: `/attempts/me/probes/${probeId}/reply`,
      headers: asCandidate(),
      payload: { reply: "Because it is stable.", latencyMs: 5 },
    });

    // Server clock, not the 5ms the client asserted.
    expect(reply.json().latencyMs).toBeGreaterThanOrEqual(30_000);
  });

  it("does not let a viva verdict change the grade", async () => {
    await answer(Q_MCQ, "1");
    const probeRes = await app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() });
    const probeId = JSON.parse(
      probeRes.payload.split("event: probe\ndata: ")[1]?.split("\n")[0] ?? "{}",
    ).id as string;
    await app.inject({
      method: "POST",
      url: `/attempts/me/probes/${probeId}/reply`,
      headers: asCandidate(),
      payload: { reply: "no idea" },
    });

    // The worst possible verdict.
    verdict = { verdict: "inconsistent" as never, confidence: 1, reasoning: "Contradicts their answer." };
    await app.inject({ method: "POST", url: "/attempts/me/submit", headers: asCandidate() });
    const graded = await app.inject({ method: "POST", url: `/attempts/${attemptId}/grade`, headers: asStaff() });

    // SPEC §6.1: provenance evidence is reported beside the grade, never folded in.
    expect(graded.json().total).toBe(4);
  });

  it("gives the candidate their own ledger with a head hash", async () => {
    await answer(Q_MCQ, "1");

    const res = await app.inject({ method: "GET", url: "/attempts/me/ledger", headers: asCandidate() });
    const body = res.json();

    expect(body.entries.map((e: { type: string }) => e.type)).toEqual([
      "attempt_started",
      "answer_submitted",
    ]);
    expect(body.head).toMatch(/^[0-9a-f]{64}$/);
    expect(body.head).toBe(body.entries.at(-1).hash);
  });

  it("leaves a chain that still verifies after a full lifecycle", async () => {
    await answer(Q_MCQ, "1");
    await answer(Q_SHORT, "It terminates.");
    await app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() });
    await app.inject({ method: "POST", url: "/attempts/me/submit", headers: asCandidate() });
    await app.inject({ method: "POST", url: `/attempts/${attemptId}/grade`, headers: asStaff() });

    const store = new LedgerStore(pgliteExecutor(db));
    const entries = await store.load(attemptId as never);

    expect(verifyChain(entries)).toEqual({ ok: true });
    expect(await store.verifyStored(attemptId as never)).toMatchObject({ ok: true });
  });
});

describe("access control", () => {
  it("refuses candidate routes without a valid attempt token", async () => {
    const none = await app.inject({ method: "GET", url: "/attempts/me/ledger" });
    expect(none.statusCode).toBe(401);

    const bad = await app.inject({
      method: "GET",
      url: "/attempts/me/ledger",
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(bad.statusCode).toBe(401);
  });

  it("refuses institution routes without the staff token", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/attempts/${attemptId}/grade`,
      headers: asCandidate(),
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects an answer to a question that is not on the exam", async () => {
    const res = await answer("q-ghost", "x");
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("unknown_question");
  });

  it("rejects an answer once the attempt is submitted", async () => {
    await app.inject({ method: "POST", url: "/attempts/me/submit", headers: asCandidate() });

    const res = await answer(Q_MCQ, "1");
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("invalid_state");
  });
});
