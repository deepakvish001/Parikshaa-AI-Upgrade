import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execute, type CodeRunner } from "@parikshaa/runner";
import { pgliteExecutor } from "@parikshaa/store";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * A staff member's editorial is checked before it is saved (Prep plan row
 * 48): each program in it runs on every test of its problem, on the real
 * runner, and one that fails keeps the editorial out.
 */

const isRoot = process.getuid?.() === 0;
let workRoot: string;
const runner: CodeRunner = { run: (request) => execute(request, { workRoot, slot: isRoot ? { uid: 61081, gid: 61081 } : null }) };

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let bankId: string;

const fence = (lang: string, code: string) => `\`\`\`${lang}\n${code}\n\`\`\``;
const RIGHT = "a, b = map(int, input().split())\nprint(a + b)";
const WRONG = "a, b = map(int, input().split())\nprint(a - b)";

beforeAll(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "parikshaa-editorial-"));
});

beforeEach(async () => {
  db = await freshDatabase();
  let identity;
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, runner }));
  const org = await addOrganisation(identity, "org-a", "NIT Trichy");
  await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@nit.test");
  const site = await app.inject({ method: "PUT", url: "/practice-admin/site", headers: bearer(owner), payload: { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true } });
  expect(site.statusCode, site.payload).toBe(200);
  const q = await app.inject({
    method: "POST",
    url: "/bank",
    headers: bearer(owner),
    payload: {
      question: {
        kind: "code",
        stem: "Sum of two\n\nPrint the sum of two integers.",
        maxScore: 1,
        rubric: [],
        language: "python",
        tests: [
          { id: "sample", input: "2 3\n", expected: "5\n", hidden: false, weight: 1 },
          { id: "negative", input: "-4 1\n", expected: "-3\n", hidden: true, weight: 1 },
        ],
      },
      difficulty: "easy",
    },
  });
  expect(q.statusCode, q.payload).toBe(201);
  bankId = q.json().id;
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const publish = (editorial: string) => app.inject({ method: "POST", url: "/practice-admin/problems", headers: bearer(owner), payload: { bankQuestionId: bankId, editorial } });

describe("an editorial's code", () => {
  it("is run on every test before the editorial is saved, and kept out when it fails", async () => {
    const wrong = await publish(`## Optimal\n${fence("python", WRONG)}`);
    expect(wrong.statusCode).toBe(422);
    expect(wrong.json().message).toContain(`code block 1 (python) fails test "sample"`);
    // A fragment marked no-check is not run; prose has nothing to run.
    const ok = await publish(`## Brute force\nLoop.\n${fence("python no-check", "lo, hi = 0, n - 1")}\n## Optimal\n${fence("py", RIGHT)}`);
    expect(ok.statusCode, ok.payload).toBe(201);
    const id = ok.json().id as string;

    const patch = (editorial: string) => app.inject({ method: "PATCH", url: `/practice-admin/problems/${id}`, headers: bearer(owner), payload: { editorial } });
    const broken = await patch(fence("python", "print(int(input().split()[0]) + 1"));
    expect(broken.statusCode).toBe(422);
    // Python is not compiled: a syntax error fails the first test as it runs.
    expect(broken.json().message).toMatch(/fails test "sample" \(runtime error\)/);
    // Only the sample passing is not enough: the hidden tests run too.
    const sampleOnly = await patch(fence("python", "input()\nprint(5)"));
    expect(sampleOnly.statusCode).toBe(422);
    expect(sampleOnly.json().message).toContain(`fails test "negative"`);
    // Other changes to the problem do not run it again.
    const renamed = await app.inject({ method: "PATCH", url: `/practice-admin/problems/${id}`, headers: bearer(owner), payload: { title: "Adding two numbers" } });
    expect(renamed.statusCode, renamed.payload).toBe(200);
  });
});
