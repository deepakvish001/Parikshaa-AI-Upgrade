import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId as toAttemptId, orgId } from "@parikshaa/core";
import { LedgerStore, pgliteExecutor, staffScope } from "@parikshaa/store";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** Two questions after submitting, answered once, and read by the institution without names. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;

beforeEach(async () => {
  db = await freshDatabase();
  let identity;
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic }));
  const org = await addOrganisation(identity, "org-a", "Acme Engineering");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await addStaff(identity, org, "invigilator@acme.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  await call("POST", owner, "/exams", {
    id: "drive",
    title: "Campus drive",
    questions: [{ id: "q1", kind: "mcq", stem: "Pick", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 0 }],
    policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST", token: string, url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

async function sit(candidate: string): Promise<{ attemptId: string; token: string }> {
  const started = await call("POST", owner, "/exams/drive/attempts", { candidateId: candidate });
  expect(started.statusCode).toBe(201);
  const { attemptId, token } = started.json();
  await call("POST", token, "/attempts/me/answers", { questionId: "q1", answer: "0" });
  return { attemptId, token };
}

describe("a candidate saying how the test went", () => {
  it("is asked only after submitting, and only once", async () => {
    const { token } = await sit("cand-1");
    const early = await call("POST", token, "/attempts/me/feedback", { rating: 4 });
    expect(early.statusCode).toBe(409);
    expect(early.json().error).toBe("not_submitted");

    await call("POST", token, "/attempts/me/submit");
    expect((await call("GET", token, "/attempts/me/feedback")).json()).toEqual({ given: false });
    const given = await call("POST", token, "/attempts/me/feedback", { rating: 2, comment: "  The page froze twice on my phone.  " });
    expect(given.statusCode, given.payload).toBe(201);
    expect((await call("GET", token, "/attempts/me/feedback")).json()).toEqual({ given: true });

    const again = await call("POST", token, "/attempts/me/feedback", { rating: 5 });
    expect(again.statusCode).toBe(409);
    expect(again.json().error).toBe("already_given");
  });

  it("refuses a rating outside one to five", async () => {
    const { token } = await sit("cand-1");
    await call("POST", token, "/attempts/me/submit");
    expect((await call("POST", token, "/attempts/me/feedback", { rating: 6 })).statusCode).toBe(400);
    expect((await call("POST", token, "/attempts/me/feedback", { rating: 0 })).statusCode).toBe(400);
  });
});

describe("what the institution reads", () => {
  it("is the ratings and comments, without names, out of those who submitted", async () => {
    for (const [who, rating, comment] of [
      ["cand-1", 5, "Smooth."],
      ["cand-2", 2, "The page froze twice on my phone."],
      ["cand-3", 4, "   "],
    ] as const) {
      const { token } = await sit(who);
      await call("POST", token, "/attempts/me/submit");
      await call("POST", token, "/attempts/me/feedback", { rating, comment });
    }
    // One more submitted who said nothing, and one still sitting.
    const quiet = await sit("cand-4");
    await call("POST", quiet.token, "/attempts/me/submit");
    await sit("cand-5");

    const summary = (await call("GET", owner, "/exams/drive/feedback")).json();
    expect(summary).toMatchObject({ responses: 3, submitted: 4, average: 3.7, counts: [0, 1, 0, 1, 1] });
    expect(summary.comments.map((c: { comment: string }) => c.comment).sort()).toEqual(["Smooth.", "The page froze twice on my phone."]);
    expect(JSON.stringify(summary)).not.toMatch(/cand-/);

    // Anyone who can read results can read it.
    const invigilator = await signIn(app, "invigilator@acme.test");
    expect((await call("GET", invigilator, "/exams/drive/feedback")).statusCode).toBe(200);
  });

  it("goes when the attempt's personal data is erased", async () => {
    const { attemptId, token } = await sit("cand-1");
    await call("POST", token, "/attempts/me/submit");
    await call("POST", token, "/attempts/me/feedback", { rating: 1, comment: "My name is Ravi and the camera failed." });

    await new LedgerStore(pgliteExecutor(db)).erase(staffScope(orgId("org-a")), toAttemptId(attemptId), "request");
    expect((await call("GET", owner, "/exams/drive/feedback")).json()).toMatchObject({ responses: 0, comments: [] });
  });
});
