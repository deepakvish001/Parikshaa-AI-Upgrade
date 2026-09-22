import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { examId, questionId, verifyChain, type Exam } from "@parikshaa/core";
import { LedgerStore, pgliteExecutor } from "@parikshaa/store";
import { parseReceipt, verifyReceipt, type Receipt } from "@parikshaa/verify";
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
/** How long the fake takes to "generate" a probe, so races can be staged. */
let probeDelayMs = 0;

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
            if (probeDelayMs > 0) await new Promise((r) => setTimeout(r, probeDelayMs));
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
  probeDelayMs = 0;

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

  it("releases only the head hash while the attempt is open", async () => {
    await answer(Q_MCQ, "1");

    const res = await app.inject({ method: "GET", url: "/attempts/me/ledger", headers: asCandidate() });
    const body = res.json();

    // Enough to pin the record now and verify it later, with nothing in it that
    // would tell the candidate how they scored.
    expect(body.sealed).toBe(false);
    expect(body.entries).toBeNull();
    expect(body.length).toBe(2);
    expect(body.head).toMatch(/^[0-9a-f]{64}$/);
  });

  it("releases the whole chain once the attempt is closed, and the head is unchanged", async () => {
    await answer(Q_MCQ, "1");
    const duringExam = (
      await app.inject({ method: "GET", url: "/attempts/me/ledger", headers: asCandidate() })
    ).json();

    await app.inject({ method: "POST", url: "/attempts/me/submit", headers: asCandidate() });
    const after = (
      await app.inject({ method: "GET", url: "/attempts/me/ledger", headers: asCandidate() })
    ).json();

    expect(after.sealed).toBe(true);
    expect(after.entries.map((e: { type: string }) => e.type)).toEqual([
      "attempt_started",
      "answer_submitted",
      "attempt_submitted",
    ]);
    // The head the candidate pinned mid-exam is the head of a prefix of what
    // they are now shown — that is what makes pinning it worth anything.
    expect(after.entries[duringExam.length - 1].hash).toBe(duringExam.head);
  });

  it("never shows a probe rationale or a verdict while the attempt is open", async () => {
    await answer(Q_MCQ, "1");
    const probeRes = await app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() });
    const probeId = JSON.parse(
      probeRes.payload.split("event: probe\ndata: ")[1]?.split("\n")[0] ?? "{}",
    ).id as string;
    await app.inject({
      method: "POST",
      url: `/attempts/me/probes/${probeId}/reply`,
      headers: asCandidate(),
      payload: { reply: "Because it is stable." },
    });
    await app.inject({ method: "POST", url: `/attempts/${attemptId}/assess/${probeId}`, headers: asStaff() });

    const ledger = await app.inject({ method: "GET", url: "/attempts/me/ledger", headers: asCandidate() });
    const state = await app.inject({ method: "GET", url: "/attempts/me", headers: asCandidate() });

    // The rationale records the score that triggered the probe; the verdict is
    // provenance evidence for a human. Neither belongs in front of a candidate
    // who is still sitting the paper.
    for (const body of [ledger.payload, state.payload]) {
      expect(body).not.toContain("viva trigger ratio");
      expect(body).not.toContain("rationale");
      expect(body).not.toContain("consistent");
    }
  });

  describe("GET /attempts/me", () => {
    it("sends the exam with no answer key in it", async () => {
      const res = await app.inject({ method: "GET", url: "/attempts/me", headers: asCandidate() });

      expect(res.json().exam.title).toBe("Algorithms");
      expect(res.json().exam.questions).toHaveLength(2);
      for (const leak of ["correctIndex", "expectedPoints", "rubric", "vivaTriggerRatio", "the measure decreases"]) {
        expect(res.payload).not.toContain(leak);
      }
    });

    it("reports the candidate's own answers and any open probe", async () => {
      await answer(Q_MCQ, "1");
      await app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() });

      const body = (await app.inject({ method: "GET", url: "/attempts/me", headers: asCandidate() })).json();

      expect(body.state).toBe("in_progress");
      expect(body.answers).toEqual([
        expect.objectContaining({ questionId: Q_MCQ, answer: "1" }),
      ]);
      expect(body.openProbe.prompt).toBe("Which quantity decreases each round?");
      expect(Object.keys(body.openProbe)).toEqual(["id", "prompt"]);
    });
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

describe("the exam window", () => {
  const probe = () =>
    app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() });

  it("reports when the attempt closes", async () => {
    const body = (await app.inject({ method: "GET", url: "/attempts/me", headers: asCandidate() })).json();

    expect(body.expiresAt).toBe(body.startedAt + exam.policy.durationMs);
  });

  it("refuses an answer once the window has passed, and closes the attempt", async () => {
    clock += exam.policy.durationMs + 1;

    const late = await answer(Q_MCQ, "1");

    expect(late.statusCode).toBe(410);
    expect(late.json().error).toBe("expired");

    // Closed rather than left open forever, so the receipt can seal.
    const state = (await app.inject({ method: "GET", url: "/attempts/me", headers: asCandidate() })).json();
    expect(state.state).toBe("submitted");
  });

  it("refuses a probe and a reply after the window too", async () => {
    await answer(Q_MCQ, "1");
    const raised = await probe();
    const probeId = JSON.parse(
      raised.payload.split("event: probe\ndata: ")[1]?.split("\n")[0] ?? "{}",
    ).id as string;

    clock += exam.policy.durationMs + 1;

    const reply = await app.inject({
      method: "POST",
      url: `/attempts/me/probes/${probeId}/reply`,
      headers: asCandidate(),
      payload: { reply: "too late" },
    });
    expect(reply.statusCode).toBe(410);
  });

  it("does not end an attempt merely because someone looked at it", async () => {
    clock += exam.policy.durationMs + 1;

    await app.inject({ method: "GET", url: "/attempts/me", headers: asCandidate() });
    await app.inject({ method: "GET", url: "/attempts/me/ledger", headers: asCandidate() });

    const state = (await app.inject({ method: "GET", url: "/attempts/me", headers: asCandidate() })).json();
    expect(state.state).toBe("in_progress");
  });
});

describe("concurrent probe requests", () => {
  it("raises one probe, not two, when two requests arrive together", async () => {
    await answer(Q_MCQ, "1");
    // A real generation takes a second or two; both requests select the same
    // target before either has appended.
    probeDelayMs = 50;

    const [first, second] = await Promise.all([
      app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() }),
      app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() }),
    ]);

    const raised = [first, second].filter((r) => r.payload.includes("event: probe"));
    const declined = [first, second].filter((r) => r.payload.includes("event: none"));
    expect(raised).toHaveLength(1);
    expect(declined).toHaveLength(1);

    await app.inject({ method: "POST", url: "/attempts/me/submit", headers: asCandidate() });
    const review = await app.inject({ method: "GET", url: `/attempts/${attemptId}/review`, headers: asStaff() });
    // One answer, one follow-up. Two would be the interrogation SPEC §4 rules out.
    expect(review.json().vivas).toHaveLength(1);
  });
});

describe("the receipt a candidate takes away", () => {
  /**
   * The contract between the server and the offline verifier. If these ever
   * drift, a candidate's own record would fail to verify in front of the people
   * deciding their appeal — which is the exact failure the ledger exists to
   * prevent.
   */
  const finish = async () => {
    await answer(Q_MCQ, "1");
    await answer(Q_SHORT, "It terminates because the measure decreases.");
    const probeRes = await app.inject({ method: "GET", url: "/attempts/me/probe", headers: asCandidate() });
    const probeId = JSON.parse(
      probeRes.payload.split("event: probe\ndata: ")[1]?.split("\n")[0] ?? "{}",
    ).id as string;
    await app.inject({
      method: "POST",
      url: `/attempts/me/probes/${probeId}/reply`,
      headers: asCandidate(),
      payload: { reply: "The potential function." },
    });
    await app.inject({ method: "POST", url: `/attempts/${attemptId}/assess/${probeId}`, headers: asStaff() });
    await app.inject({ method: "POST", url: "/attempts/me/submit", headers: asCandidate() });
    await app.inject({ method: "POST", url: `/attempts/${attemptId}/grade`, headers: asStaff() });

    const res = await app.inject({ method: "GET", url: "/attempts/me/ledger", headers: asCandidate() });
    // Through JSON, exactly as a downloaded file would be.
    const parsed = parseReceipt(JSON.parse(res.payload));
    if ("error" in parsed) throw new Error(`not a receipt: ${parsed.error}`);
    return parsed as Receipt;
  };

  it("verifies offline with @parikshaa/verify", async () => {
    const report = verifyReceipt(await finish());

    expect(report.ok).toBe(true);
    if (report.ok) {
      expect(report.timeline.map((t) => t.what)).toEqual([
        "Attempt started",
        "Answered q-mcq",
        "Answered q-short",
        "Follow-up asked about q-mcq",
        // The exact latency is whatever the test clock advanced by; that it is
        // reported at all is the contract.
        expect.stringMatching(/^Replied to the follow-up after \d+s$/),
        'Follow-up read as "consistent"',
        "Attempt submitted",
        "Scored q-mcq: 4",
        "Scored q-short: 7",
        "Graded: 11",
      ]);
    }
  });

  it("still verifies against a head the candidate pinned mid-exam", async () => {
    await answer(Q_MCQ, "1");
    const pinned = (
      await app.inject({ method: "GET", url: "/attempts/me/ledger", headers: asCandidate() })
    ).json().head as string;

    const receipt = await finish();

    expect(verifyReceipt(receipt, pinned).ok).toBe(true);
  });

  it("fails verification if a single byte of the record is changed", async () => {
    const receipt = await finish();
    const entries = [...receipt.entries!];
    entries[1] = { ...entries[1]!, timestamp: entries[1]!.timestamp + 1 } as (typeof entries)[number];

    const report = verifyReceipt({ ...receipt, entries });

    expect(report.ok).toBe(false);
    if (!report.ok) expect(report.problem).toMatchObject({ kind: "chain", seq: 1 });
  });
});

describe("exam authoring", () => {
  it("rejects a misconfigured exam with every problem at once", async () => {
    const broken = {
      ...exam,
      id: "exam-broken",
      title: "",
      questions: [{ ...exam.questions[0], maxScore: 0, correctIndex: 9 }],
    };

    const res = await app.inject({ method: "POST", url: "/exams", headers: asStaff(), payload: broken });

    expect(res.statusCode).toBe(422);
    expect(res.json().error).toBe("invalid_exam");
    const paths = res.json().problems.map((p: { path: string }) => p.path);
    expect(paths).toEqual(
      expect.arrayContaining(["title", "questions.0.maxScore", "questions.0.correctIndex"]),
    );
  });

  it("does not store an exam it rejected", async () => {
    await app.inject({
      method: "POST",
      url: "/exams",
      headers: asStaff(),
      payload: { ...exam, id: "exam-broken", questions: [] },
    });

    const listed = await app.inject({ method: "GET", url: "/exams", headers: asStaff() });
    expect(listed.json().exams.map((e: { id: string }) => e.id)).toEqual([E]);
  });

  it("lists exams with their question counts", async () => {
    const res = await app.inject({ method: "GET", url: "/exams", headers: asStaff() });

    expect(res.json().exams).toEqual([{ id: E, title: "Algorithms", questionCount: 2 }]);
  });

  it("serves the full exam, answer key included, to staff only", async () => {
    const staff = await app.inject({ method: "GET", url: `/exams/${E}`, headers: asStaff() });
    expect(staff.json().questions[0].correctIndex).toBe(1);

    const candidate = await app.inject({ method: "GET", url: `/exams/${E}`, headers: asCandidate() });
    expect(candidate.statusCode).toBe(401);
  });

  it("lists attempts at an exam with their state", async () => {
    const before = await app.inject({ method: "GET", url: `/exams/${E}/attempts`, headers: asStaff() });
    expect(before.json().attempts).toEqual([
      expect.objectContaining({ id: attemptId, candidateId: "cand-1", state: "in_progress" }),
    ]);

    await answer(Q_MCQ, "1");
    await app.inject({ method: "POST", url: "/attempts/me/submit", headers: asCandidate() });
    await app.inject({ method: "POST", url: `/attempts/${attemptId}/grade`, headers: asStaff() });

    const after = await app.inject({ method: "GET", url: `/exams/${E}/attempts`, headers: asStaff() });
    expect(after.json().attempts[0]).toMatchObject({ state: "graded" });
  });

  it("returns 404 for an exam that does not exist", async () => {
    const res = await app.inject({ method: "GET", url: "/exams/nope", headers: asStaff() });
    expect(res.statusCode).toBe(404);
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
