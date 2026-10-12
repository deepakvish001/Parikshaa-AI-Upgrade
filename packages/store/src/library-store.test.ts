import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orgId, type Question } from "@parikshaa/core";
import { staffScope } from "./ledger-store.js";
import { LibraryStore, type LibraryDraft } from "./library-store.js";
import { migrate } from "./migrate.js";
import { QuestionBank } from "./question-bank.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

/** The Parikshaa Library (migration 0068): versions, taking into a bank, exposure, and tenancy. As `parikshaa_app`. */

const A = staffScope(orgId("org-a"));
const B = staffScope(orgId("org-b"));

const mcq = (stem: string): Question => ({ id: "x", kind: "mcq", stem, maxScore: 1, rubric: [], options: ["one", "two"], correctIndex: 0 }) as unknown as Question;
const draft = (id: string, over: Partial<LibraryDraft> = {}): LibraryDraft => ({
  id,
  section: "cs",
  topic: "Operating Systems",
  difficulty: "easy",
  tags: ["os"],
  question: mcq(`What is ${id}?`),
  explanation: "Because.",
  tier: "open",
  source: "test",
  ...over,
});

let db: PGlite;
let sql: SqlExecutor;
let library: LibraryStore;
let bank: QuestionBank;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ('org-a', 'A'), ('org-b', 'B')`);
  await db.exec(`SET ROLE parikshaa_app`);
  library = new LibraryStore(sql);
  bank = new QuestionBank(sql);
});

afterEach(async () => {
  await db.close();
});

describe("the library", () => {
  it("files questions once, versions a changed one, and leaves an unchanged one alone", async () => {
    expect(await library.upsert([draft("q1"), draft("q2"), draft("q3", { section: "dsa", topic: "Arrays", difficulty: "hard" })])).toEqual({ added: 3, updated: 0, unchanged: 0 });
    expect(await library.upsert([draft("q1"), draft("q2", { explanation: "Better." })])).toEqual({ added: 0, updated: 1, unchanged: 1 });
    const q2 = await library.get(A, "q2");
    expect(q2).toMatchObject({ version: 2, explanation: "Better.", adopted: null, exposure: 0 });
    // Filed under its library id, whatever the draft said.
    expect(q2!.question.id).toBe("q2");
  });

  it("filters by section, topic, difficulty, kind and words, and counts by section and topic", async () => {
    await library.upsert([draft("q1"), draft("q2", { topic: "DBMS", tags: ["sql", "joins"] }), draft("q3", { section: "dsa", topic: "Arrays", difficulty: "hard" })]);
    expect((await library.list(A, { section: "cs" })).total).toBe(2);
    expect((await library.list(A, { search: "JOINS" })).items.map((e) => e.id)).toEqual(["q2"]);
    expect((await library.list(A, { difficulty: "hard", kind: "mcq" })).items.map((e) => e.id)).toEqual(["q3"]);
    const facets = await library.facets(A);
    expect(facets.total).toBe(3);
    expect(facets.sections.find((s) => s.section === "cs")).toEqual({ section: "cs", count: 2, topics: [{ topic: "DBMS", count: 1 }, { topic: "Operating Systems", count: 1 }] });
    expect(facets.sections.find((s) => s.section === "aptitude")?.count).toBe(0);
  });

  it("copies a question into an organisation's bank once, and counts each organisation once", async () => {
    await library.upsert([draft("q1"), draft("q2")]);
    const [first] = await library.adopt(A, ["q1", "q1", "nope"]);
    expect(first).toMatchObject({ libraryId: "q1", added: true });
    const copy = (await bank.list(A)).find((e) => e.id === first!.bankQuestionId)!;
    expect(copy.question).toMatchObject({ id: first!.bankQuestionId, stem: "What is q1?" });
    expect(copy.tags).toContain("library:q1");

    expect(await library.adopt(A, ["q1"])).toEqual([{ libraryId: "q1", bankQuestionId: first!.bankQuestionId, added: false }]);
    await library.adopt(B, ["q1"]);
    expect((await library.get(A, "q1"))?.exposure).toBe(2);
    // Each organisation sees its own copy, and only its own.
    expect((await library.get(A, "q1"))?.adopted?.bankQuestionId).toBe(first!.bankQuestionId);
    expect((await library.get(B, "q1"))?.adopted?.bankQuestionId).not.toBe(first!.bankQuestionId);
    expect((await bank.list(B)).map((e) => e.id)).not.toContain(first!.bankQuestionId);
    expect((await library.list(A, { notAdopted: true })).items.map((e) => e.id)).toEqual(["q2"]);
  });

  it("brings a copy up to the library's newer version when asked, and only then", async () => {
    await library.upsert([draft("q1")]);
    const { bankQuestionId } = (await library.adopt(A, ["q1"]))[0]!;
    await library.upsert([draft("q1", { question: mcq("What is q1, really?") })]);
    expect((await library.get(A, "q1"))?.adopted).toEqual({ bankQuestionId, version: 1 });
    expect((await bank.list(A))[0]!.question.stem).toBe("What is q1?");
    expect(await library.refresh(A, "q1")).toEqual({ bankQuestionId, version: 2 });
    expect((await bank.list(A))[0]!.question).toMatchObject({ id: bankQuestionId, stem: "What is q1, really?" });
    expect(await library.refresh(B, "q1")).toBeNull();
  });

  it("picks at random among what this organisation has not taken; a retired question cannot be taken", async () => {
    await library.upsert([draft("q1"), draft("q2"), draft("q3"), draft("q4", { section: "dsa" })]);
    await library.adopt(A, ["q1"]);
    const picked = await library.pick(A, { section: "cs" }, 10);
    expect([...picked].sort()).toEqual(["q2", "q3"]);
    expect(await library.retire("q2")).toBe(true);
    expect(await library.pick(A, { section: "cs" }, 10)).toEqual(["q3"]);
    expect(await library.adopt(A, ["q2"])).toEqual([]);
    expect((await library.facets(A)).sections.find((s) => s.section === "cs")?.count).toBe(2);
    // Filed again, it comes back.
    expect((await library.upsert([draft("q2")])).updated).toBe(1);
    expect((await library.get(A, "q2"))?.retired).toBe(false);
  });
});
