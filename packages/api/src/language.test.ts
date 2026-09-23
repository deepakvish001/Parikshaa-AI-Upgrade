import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { gunzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** ROADMAP §9: questions in Hindi, and a sitting that works on a 2G connection. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;

const MCQ = {
  id: "q1",
  kind: "mcq",
  stem: "Which sort is stable?",
  maxScore: 4,
  rubric: [],
  options: ["Heap sort", "Merge sort"],
  correctIndex: 1,
  translations: { hi: { stem: "कौन सा सॉर्ट स्थिर है?", options: ["हीप सॉर्ट", "मर्ज सॉर्ट"] } },
};
const SHORT = {
  id: "q2",
  kind: "short",
  stem: "Why does binary search terminate? ".repeat(40),
  maxScore: 6,
  rubric: [{ id: "c1", description: "Names the shrinking interval", weight: 1 }],
  expectedPoints: ["the interval halves"],
  translations: { hi: { stem: "द्विआधारी खोज क्यों रुकती है?" } },
};

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel().client });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const saveExam = (questions: object[], vivaTriggerRatio = 0.99) =>
  app.inject({
    method: "POST",
    url: "/exams",
    headers: bearer(owner),
    payload: { id: "e1", title: "Drive", questions, policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio } },
  });

async function start(): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/exams/e1/attempts", headers: bearer(owner), payload: { candidateId: "c1" } });
  expect(res.statusCode, res.payload).toBe(201);
  return res.json().token;
}

describe("questions in other languages", () => {
  it("reach the candidate with the question, answer key still absent", async () => {
    expect((await saveExam([MCQ, SHORT])).statusCode).toBe(201);
    const state = (await app.inject({ method: "GET", url: "/attempts/me", headers: bearer(await start()) })).json();

    expect(state.exam.questions[0].translations).toEqual({ hi: { stem: "कौन सा सॉर्ट स्थिर है?", options: ["हीप सॉर्ट", "मर्ज सॉर्ट"] } });
    expect(state.exam.questions[1].translations).toEqual({ hi: { stem: "द्विआधारी खोज क्यों रुकती है?" } });
    expect(JSON.stringify(state)).not.toMatch(/correctIndex|expectedPoints|the interval halves/);
  });

  it("are refused with an mcq's options missing or out of step, since answers are recorded by position", async () => {
    const res = await saveExam([{ ...MCQ, translations: { hi: { stem: "कौन?", options: ["मर्ज सॉर्ट"] } } }]);
    expect(res.statusCode).toBe(422);
    expect(res.json().problems).toEqual([expect.objectContaining({ path: "questions.0.translations.hi.options" })]);
  });

  it("accept an answer by position, whichever language it was read in", async () => {
    await saveExam([MCQ]);
    const token = await start();
    expect((await app.inject({ method: "POST", url: "/attempts/me/answers", headers: bearer(token), payload: { questionId: "q1", answer: "1" } })).statusCode).toBe(202);
  });
});

describe("low bandwidth", () => {
  it("compresses what is worth compressing", async () => {
    await saveExam([MCQ, SHORT]);
    const token = await start();
    const res = await app.inject({ method: "GET", url: "/attempts/me", headers: { ...bearer(token), "accept-encoding": "gzip" } });
    expect(res.headers["content-encoding"]).toBe("gzip");
    const body = gunzipSync(res.rawPayload).toString("utf8");
    expect(JSON.parse(body).exam.title).toBe("Drive");
    expect(res.rawPayload.length).toBeLessThan(body.length / 3);
  });

  it("offers the follow-up as one plain reply, without a stream", async () => {
    await saveExam([MCQ], 0.5);
    const token = await start();
    await app.inject({ method: "POST", url: "/attempts/me/answers", headers: bearer(token), payload: { questionId: "q1", answer: "1" } });

    const res = await app.inject({ method: "GET", url: "/attempts/me/probe?stream=0", headers: bearer(token) });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(res.json().probe).toMatchObject({ prompt: "Walk me through why your answer holds in the worst case." });
    // And nothing twice: the open probe is not raised again.
    expect((await app.inject({ method: "GET", url: "/attempts/me/probe?stream=0", headers: bearer(token) })).json()).toEqual({ probe: null });
  });
});
