import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { PLACEMENT_QUIZ, placementLevel } from "./content/placement-quiz.js";
import { drawPlacement, markPlacement } from "./level-quiz.js";
import { addOrganisation, addStaff, freshDatabase, signIn, wire, bearer } from "./testing/harness.js";

/** The placement quiz (Prep blueprint S2, F1): forty questions of our own, eight at a time, marked by the server. */

describe("the questions", () => {
  it("are forty, each with four different options, a right one and why, in every level enough for a draw", () => {
    expect(PLACEMENT_QUIZ).toHaveLength(40);
    expect(new Set(PLACEMENT_QUIZ.map((q) => q.id)).size).toBe(40);
    for (const q of PLACEMENT_QUIZ) {
      expect(new Set(q.options).size, q.id).toBe(4);
      expect(q.correct, q.id).toBeGreaterThanOrEqual(0);
      expect(q.why.length, q.id).toBeGreaterThan(10);
    }
    for (const level of ["easy", "medium", "hard"] as const) expect(PLACEMENT_QUIZ.filter((q) => q.level === level).length).toBeGreaterThanOrEqual(8);
  });

  it("are drawn three easy, three medium, two hard, different each time, never with the answer", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const draw = drawPlacement();
      expect(draw.map((q) => q.level)).toEqual(["easy", "easy", "easy", "medium", "medium", "medium", "hard", "hard"]);
      expect(new Set(draw.map((q) => q.id)).size).toBe(8);
      for (const q of draw) {
        expect(q).not.toHaveProperty("correct");
        expect(q).not.toHaveProperty("why");
        seen.add(q.id);
      }
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it("suggest a level from the score", () => {
    expect([0, 3, 4, 6, 7, 8].map(placementLevel)).toEqual(["beginner", "beginner", "intermediate", "intermediate", "advanced", "advanced"]);
    const draw = drawPlacement();
    const all = markPlacement(draw.map((q) => ({ id: q.id, choice: PLACEMENT_QUIZ.find((x) => x.id === q.id)!.correct })));
    expect(all).toMatchObject({ score: 8, of: 8, level: "advanced" });
    expect(() => markPlacement(draw.slice(0, 7).map((q) => ({ id: q.id, choice: 0 })))).toThrow(/Answer the 8 questions/);
    expect(() => markPlacement([...draw.slice(0, 7), draw[0]!].map((q) => ({ id: q.id, choice: 0 })))).toThrow();
  });
});

describe("through the API", () => {
  let db: PGlite;
  let app: FastifyInstance;
  beforeEach(async () => {
    db = await freshDatabase();
    let identity;
    ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic }));
    const org = await addOrganisation(identity, "org-a", "NIT Trichy");
    await addStaff(identity, org, "owner@nit.test", "owner", "Ravi Kumar");
    await db.exec(`SET ROLE parikshaa_app`);
    const owner = await signIn(app, "owner@nit.test");
    await app.inject({ method: "PUT", url: "/practice-admin/site", headers: bearer(owner), payload: { slug: "nit-practice", title: "NIT Practice", welcome: "", open: true } });
  });
  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it("hands out eight questions without answers, and marks them, with why", async () => {
    const got = await app.inject({ method: "GET", url: "/practice/nit-practice/placement" });
    expect(got.statusCode, got.payload).toBe(200);
    const questions = got.json().questions as { id: string }[];
    expect(questions).toHaveLength(8);
    expect(got.payload).not.toContain('"correct"');
    const answers = questions.map((q, i) => ({ id: q.id, choice: i < 5 ? PLACEMENT_QUIZ.find((x) => x.id === q.id)!.correct : (PLACEMENT_QUIZ.find((x) => x.id === q.id)!.correct + 1) % 4 }));
    const marked = await app.inject({ method: "POST", url: "/practice/nit-practice/placement", payload: { answers } });
    expect(marked.statusCode, marked.payload).toBe(200);
    expect(marked.json()).toMatchObject({ score: 5, of: 8, level: "intermediate" });
    expect(marked.json().results[7]).toMatchObject({ right: false, why: expect.any(String) });
    expect((await app.inject({ method: "POST", url: "/practice/nit-practice/placement", payload: { answers: answers.slice(1) } })).statusCode).toBe(422);
    expect((await app.inject({ method: "GET", url: "/practice/no-such-site/placement" })).statusCode).toBe(404);
  });
});
