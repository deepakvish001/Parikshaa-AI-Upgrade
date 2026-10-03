import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateQuestion } from "@parikshaa/core";
import { pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { builtInLibrary } from "./library-content.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** The Parikshaa Library (docs/F1-GO-LIVE-PLAN.md §4, G2): browse, take, pick, refresh; filed by operators. As `parikshaa_app`. */

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let ops: string;
let author: string;
let viewer: string;
let other: string;
let owner: string;

const call = (token: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });
async function ok(token: string, method: "GET" | "POST" | "PUT", url: string, payload?: object) {
  const res = await call(token, method, url, payload);
  expect(res.statusCode, res.payload).toBe(200);
  return res.json();
}

beforeEach(async () => {
  db = await freshDatabase();
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic, operators: ["ops@parikshaa.test"] }));
  const opsId = await addStaff(identity, await addOrganisation(identity, "parikshaa", "Parikshaa"), "ops@parikshaa.test", "owner", "Ops");
  const acme = await addOrganisation(identity, "acme", "Acme");
  await addStaff(identity, acme, "author@acme.test", "author", "Meena");
  await addStaff(identity, acme, "owner@acme.test", "owner", "Asha");
  await addStaff(identity, acme, "viewer@acme.test", "viewer", "Vik");
  await addStaff(identity, await addOrganisation(identity, "zeta", "Zeta"), "author@zeta.test", "author", "Kiran");
  await db.exec(`SET ROLE parikshaa_app`);
  ops = await signIn(app, "ops@parikshaa.test");
  author = await signIn(app, "author@acme.test");
  viewer = await signIn(app, "viewer@acme.test");
  other = await signIn(app, "author@zeta.test");
  owner = await signIn(app, "owner@acme.test");
  await identity.setPendingTotp(opsId, "sealed");
  await identity.enableTotp(opsId, 0, []);
  await ok(ops, "POST", "/operator/library/seed");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("the built-in questions", () => {
  it("each pass an exam's checks, with a unique id, a section and an explanation", () => {
    const all = builtInLibrary();
    expect(all.length).toBeGreaterThanOrEqual(160);
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
    for (const q of all) {
      expect(validateQuestion(q.question, q.id), q.id).toEqual([]);
      expect(q.question.id).toBe(q.id);
      expect(q.explanation.trim(), q.id).not.toBe("");
    }
    // Filed again, nothing changes: the ids are stable.
    expect(builtInLibrary().map((q) => q.id)).toEqual(all.map((q) => q.id));
  });
});

describe("the library", () => {
  it("is browsed by section, topic and words, by staff who may see answer keys", async () => {
    const all = await ok(author, "GET", "/library");
    expect(all.total).toBe(builtInLibrary().length);
    expect(all.items).toHaveLength(50);
    expect(all.facets.sections.map((s: { section: string; count: number }) => [s.section, s.count > 0])).toEqual([
      ["aptitude", false],
      ["cs", true],
      ["programming", true],
      ["dsa", true],
      ["sql", true],
      ["frontend", false],
    ]);
    const dsa = await ok(author, "GET", "/library?section=dsa&limit=200");
    expect(dsa.items.every((e: { question: { kind: string } }) => e.question.kind === "code")).toBe(true);
    // How widely a question is used is for Parikshaa to know.
    expect(dsa.items[0].exposure).toBeNull();
    const os = await ok(author, "GET", "/library?section=cs&topic=Operating%20Systems&q=process");
    expect(os.total).toBeGreaterThan(0);
    expect((await call(viewer, "GET", "/library")).statusCode).toBe(403);
  });

  it("copies chosen questions into the bank once each, as the organisation's own", async () => {
    const ids = (await ok(author, "GET", "/library?section=sql")).items.slice(0, 2).map((e: { id: string }) => e.id);
    expect(await ok(author, "POST", "/library/take", { ids })).toMatchObject({ added: 2, already: 0 });
    expect(await ok(author, "POST", "/library/take", { ids })).toMatchObject({ added: 0, already: 2 });
    const bank = (await ok(author, "GET", "/bank")).questions as { tags: string[] }[];
    expect(bank.filter((q) => q.tags.some((t) => t.startsWith("library:")))).toHaveLength(2);
    expect((await ok(other, "GET", "/bank")).questions).toEqual([]);

    const sql = await ok(author, "GET", "/library?section=sql");
    expect(sql.items.filter((e: { adopted: unknown }) => e.adopted !== null)).toHaveLength(2);
    expect((await ok(author, "GET", "/library?section=sql&notTaken=true")).total).toBe(sql.total - 2);
    expect(JSON.stringify((await ok(owner, "GET", "/audit")).entries)).toContain("library.taken");
    expect((await call(viewer, "POST", "/library/take", { ids })).statusCode).toBe(403);
  });

  it("picks a few at random from what the organisation has not taken", async () => {
    const picked = await ok(author, "POST", "/library/pick", { section: "dsa", difficulty: "easy", count: 3 });
    expect(picked.added).toBe(3);
    const again = await ok(author, "POST", "/library/pick", { section: "dsa", difficulty: "easy", count: 50 });
    const easy = (await ok(author, "GET", "/library?section=dsa&difficulty=easy")).total;
    expect(again.added).toBe(easy - 3);
    expect((await ok(author, "POST", "/library/pick", { section: "dsa", difficulty: "easy", count: 5 })).added).toBe(0);
  });

  it("tells an organisation of a newer version, and brings its copy up to it when asked", async () => {
    const q = (await ok(author, "GET", "/library?section=programming")).items[0];
    const { bankQuestionIds } = await ok(author, "POST", "/library/take", { ids: [q.id] });
    const changed = { ...q.question, stem: `${q.question.stem} (corrected)` };
    delete changed.id;
    const filed = await ok(ops, "PUT", `/operator/library/${q.id}`, { section: q.section, topic: q.topic, difficulty: q.difficulty, tags: q.tags, question: changed, explanation: q.explanation, tier: q.tier });
    expect(filed).toMatchObject({ version: 2, exposure: 1 });

    expect(await ok(author, "GET", `/library/${q.id}`)).toMatchObject({ newerVersion: true, adopted: { bankQuestionId: bankQuestionIds[0], version: 1 } });
    expect(await ok(author, "POST", `/library/${q.id}/refresh`)).toEqual({ bankQuestionId: bankQuestionIds[0], version: 2 });
    const copy = (await ok(author, "GET", "/bank")).questions.find((b: { id: string }) => b.id === bankQuestionIds[0]);
    expect(copy.question.stem).toContain("(corrected)");
    expect((await ok(author, "GET", `/library/${q.id}`)).newerVersion).toBe(false);
    expect((await call(other, "POST", `/library/${q.id}/refresh`)).statusCode).toBe(404);
  });
});

describe("filing the library", () => {
  it("is for operators: a new hire-only question, checked like an exam's, and retiring one", async () => {
    const draft = {
      section: "aptitude",
      topic: "Percentages",
      difficulty: "easy",
      question: { kind: "mcq", stem: "15% of 200 is", maxScore: 1, rubric: [], options: ["20", "30"], correctIndex: 1 },
      explanation: "0.15 × 200 = 30.",
    };
    expect((await call(author, "PUT", "/operator/library/apt-pct-1", draft)).statusCode).toBe(404);
    const bad = await call(ops, "PUT", "/operator/library/apt-pct-1", { ...draft, question: { ...draft.question, options: ["only one"], correctIndex: 3 } });
    expect(bad.statusCode).toBe(422);
    expect(bad.json().problems.length).toBeGreaterThan(0);
    expect((await call(ops, "PUT", "/operator/library/Bad Id", draft)).statusCode).toBe(422);

    expect(await ok(ops, "PUT", "/operator/library/apt-pct-1", draft)).toMatchObject({ id: "apt-pct-1", version: 1, tier: "hire", section: "aptitude", exposure: 0 });
    expect((await ok(author, "GET", "/library?section=aptitude")).items.map((e: { id: string }) => e.id)).toEqual(["apt-pct-1"]);

    expect((await call(author, "POST", "/operator/library/apt-pct-1/retire")).statusCode).toBe(404);
    await ok(ops, "POST", "/operator/library/apt-pct-1/retire");
    expect((await ok(author, "GET", "/library?section=aptitude")).total).toBe(0);
    expect((await call(author, "GET", "/library/apt-pct-1")).statusCode).toBe(404);
    expect(await ok(author, "POST", "/library/take", { ids: ["apt-pct-1"] })).toMatchObject({ added: 0, already: 0 });
    expect(JSON.stringify((await ok(ops, "GET", "/audit")).entries)).toContain("operator.library_retired");
  });

  it("files the built-in questions again without changing them", async () => {
    expect(await ok(ops, "POST", "/operator/library/seed")).toEqual({ added: 0, updated: 0, unchanged: builtInLibrary().length });
  });
});
