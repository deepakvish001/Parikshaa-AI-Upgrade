import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyChain } from "@parikshaa/core";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** ROADMAP §3: sections with their own time, taken in order and locked once left. Runs as `parikshaa_app`. */

const MINUTE = 60_000;
const short = (id: string) => ({ id, kind: "short", stem: `Explain ${id}.`, maxScore: 1, rubric: [{ id: "c", description: "x", weight: 1 }], expectedPoints: ["x"] });

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let clock: number;

beforeEach(async () => {
  clock = Date.parse("2026-10-01T04:30:00Z");
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel().client, now: () => clock });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  const saved = await call("POST", owner, "/exams", {
    id: "drive",
    title: "Drive",
    questions: [short("f1")],
    sections: [
      { id: "apt", title: "Aptitude", pick: 1, pool: [short("a1")], durationMs: 10 * MINUTE },
      { id: "code", title: "Coding", pick: 1, pool: [short("c1")] },
    ],
    policy: { durationMs: 60 * MINUTE, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  expect(saved.statusCode, saved.payload).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT", token: string, url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

async function start(): Promise<string> {
  const res = await call("POST", owner, "/exams/drive/attempts", { candidateId: "c1" });
  expect(res.statusCode, res.payload).toBe(201);
  return res.json().token;
}

const parts = async (token: string) =>
  ((await call("GET", token, "/attempts/me")).json().parts as { sectionId: string | null; state: string; endsAt: number | null }[]).map((p) => [
    p.sectionId,
    p.state,
    p.endsAt,
  ]);

describe("sections with their own time", () => {
  it("are taken in order: the fixed questions, then each section, each locked once left", async () => {
    const token = await start();
    expect(await parts(token)).toEqual([
      [null, "current", null],
      ["apt", "upcoming", null],
      ["code", "upcoming", null],
    ]);
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "a1", answer: "early" })).statusCode).toBe(409);
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "f1", answer: "fixed" })).statusCode).toBe(202);

    expect((await call("POST", token, "/attempts/me/sections/next")).statusCode).toBe(200);
    expect(await parts(token)).toEqual([
      [null, "done", null],
      ["apt", "current", clock + 10 * MINUTE],
      ["code", "upcoming", null],
    ]);
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "f1", answer: "back again" })).statusCode).toBe(409);
    expect((await call("PUT", token, "/attempts/me/drafts/f1", { answer: "back again" })).statusCode).toBe(409);
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "a1", answer: "in time" })).statusCode).toBe(202);
  });

  it("close a section when its time is up, keeping what was saved in time, and move on", async () => {
    const token = await start();
    await call("POST", token, "/attempts/me/sections/next");
    clock += 5 * MINUTE;
    await call("PUT", token, "/attempts/me/drafts/a1", { answer: "typed at five minutes" });
    clock += 6 * MINUTE;

    const late = await call("POST", token, "/attempts/me/answers", { questionId: "a1", answer: "after the bell" });
    expect(late.statusCode).toBe(409);
    expect(late.json().error).toBe("section_closed");
    expect(await parts(token)).toEqual([
      [null, "done", null],
      ["apt", "done", null],
      ["code", "upcoming", null],
    ]);

    expect((await call("POST", token, "/attempts/me/sections/next")).statusCode).toBe(200);
    expect((await call("POST", token, "/attempts/me/answers", { questionId: "c1", answer: "code" })).statusCode).toBe(202);
    expect((await call("POST", token, "/attempts/me/sections/next")).statusCode).toBe(409); // the last: submit instead
    await call("POST", token, "/attempts/me/submit");

    const receipt = (await call("GET", token, "/attempts/me/ledger")).json().entries;
    expect(verifyChain(receipt)).toEqual({ ok: true });
    expect(receipt.map((e: { event: { type: string; reason?: string } }) => e.event.type + (e.event.reason === undefined ? "" : `:${e.event.reason}`))).toEqual([
      "attempt_started",
      "section_started",
      "answer_submitted",
      "section_closed:time_up",
      "section_started",
      "answer_submitted",
      "attempt_submitted",
    ]);
  });

  it("move on when the candidate runs out of time without writing, the same way", async () => {
    const token = await start();
    await call("POST", token, "/attempts/me/sections/next");
    clock += 11 * MINUTE;
    expect((await call("POST", token, "/attempts/me/sections/next")).statusCode).toBe(200);
    expect(await parts(token)).toEqual([
      [null, "done", null],
      ["apt", "done", null],
      ["code", "current", null],
    ]);
  });

  it("leave an exam without timed sections open all at once", async () => {
    await call("POST", owner, "/exams", {
      id: "flat",
      title: "Flat",
      questions: [short("f1")],
      sections: [{ id: "s", title: "S", pick: 1, pool: [short("s1")] }],
      policy: { durationMs: 60 * MINUTE, allowRevision: true, vivaTriggerRatio: 0.99 },
    });
    const res = await call("POST", owner, "/exams/flat/attempts", { candidateId: "c2" });
    const token = res.json().token;
    expect((await call("GET", token, "/attempts/me")).json().parts).toBeNull();
    expect((await call("POST", token, "/attempts/me/sections/next")).statusCode).toBe(409);
  });
});
