import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { encodeCodeAnswer } from "@parikshaa/core";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** ROADMAP §4: code answers alike enough to be worth a look. Runs as `parikshaa_app`. */

const ORIGINAL = `def longest_run(values):
    best = 1
    current = 1
    for i in range(1, len(values)):
        if values[i] == values[i - 1]:
            current += 1
            best = max(best, current)
        else:
            current = 1
    return best
print(longest_run(list(map(int, input().split()))))
`;
const COPY = ORIGINAL.replace(/longest_run/g, "f").replace(/values/g, "a").replace(/best/g, "r").replace(/current/g, "c");
const OWN = `import sys
nums = list(map(int, sys.stdin.read().split()))
runs, start = [], 0
while start < len(nums):
    end = start
    while end + 1 < len(nums) and nums[end + 1] == nums[start]:
        end += 1
    runs.append(end - start + 1)
    start = end + 1
print(max(runs) if runs else 0)
`;

let db: PGlite;
let app: FastifyInstance;
let owner: string;

beforeEach(async () => {
  db = await freshDatabase();
  const wiring = await wire(pgliteExecutor(db), { client: fakeModel().client });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme");
  await addStaff(wiring.identity, org, "owner@acme.test", "owner");
  await addStaff(wiring.identity, org, "inv@acme.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
  const saved = await app.inject({
    method: "POST",
    url: "/exams",
    headers: bearer(owner),
    payload: {
      id: "coding",
      title: "Coding round",
      questions: [
        {
          id: "run",
          kind: "code",
          stem: "Print the length of the longest run of equal neighbours.",
          maxScore: 10,
          rubric: [{ id: "c", description: "Correct", weight: 1 }],
          language: "python",
        },
      ],
      policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
    },
  });
  expect(saved.statusCode, saved.payload).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

async function answer(candidate: string, source: string) {
  const started = await app.inject({ method: "POST", url: "/exams/coding/attempts", headers: bearer(owner), payload: { candidateId: candidate } });
  const token = started.json().token;
  const res = await app.inject({
    method: "POST",
    url: "/attempts/me/answers",
    headers: bearer(token),
    payload: { questionId: "run", answer: encodeCodeAnswer({ language: "python", source }) },
  });
  expect(res.statusCode, res.payload).toBe(202);
}

describe("code similarity", () => {
  it("names the pair whose code is a disguised copy, with both answers to read side by side", async () => {
    await answer("aarav", ORIGINAL);
    await answer("diya", COPY);
    await answer("ishaan", OWN);

    const res = await app.inject({ method: "GET", url: "/exams/coding/similarity", headers: bearer(owner) });
    expect(res.statusCode, res.payload).toBe(200);
    const [question] = res.json().questions;
    expect(question).toMatchObject({ id: "run", answered: 3 });
    expect(question.pairs).toHaveLength(1);
    const [pair] = question.pairs;
    expect([pair.a.ref, pair.b.ref].sort()).toEqual(["aarav", "diya"]);
    expect(pair.similarity).toBeGreaterThanOrEqual(0.9);
    expect([pair.a.source, pair.b.source].sort()).toEqual([COPY, ORIGINAL].sort());
  });

  it("is for those who review attempts", async () => {
    const invigilator = await signIn(app, "inv@acme.test");
    expect((await app.inject({ method: "GET", url: "/exams/coding/similarity", headers: bearer(invigilator) })).statusCode).toBe(403);
  });
});
