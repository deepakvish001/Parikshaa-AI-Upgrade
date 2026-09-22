import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attemptId, orgId } from "@parikshaa/core";
import { candidateScope, staffScope } from "./ledger-store.js";
import { migrate } from "./migrate.js";
import { QuestionBank, type BankDraft } from "./question-bank.js";
import { pgliteExecutor, type SqlExecutor } from "./sql.js";

const ORG = orgId("default");
const OTHER = orgId("other");
const S = staffScope(ORG);

const draft = (stem: string, overrides: Partial<BankDraft> = {}): BankDraft => ({
  question: { kind: "mcq", stem, maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 1 },
  topic: "arrays",
  difficulty: "easy",
  tags: ["campus-2026"],
  ...overrides,
});

let db: PGlite;
let sql: SqlExecutor;
let bank: QuestionBank;

beforeEach(async () => {
  db = new PGlite();
  sql = pgliteExecutor(db);
  await migrate(sql);
  await sql.query(`INSERT INTO organisations (id, name) VALUES ($1, 'Other')`, [OTHER]);
  await db.exec(`SET ROLE parikshaa_app`);
  let n = 0;
  bank = new QuestionBank(sql, { newId: () => `b-${++n}` });
});

afterEach(async () => {
  await db.close();
});

describe("QuestionBank", () => {
  it("files questions, giving each the bank's id", async () => {
    const [entry] = await bank.add(S, [draft("Which sort is stable?")]);

    expect(entry).toMatchObject({ id: "b-1", topic: "arrays", difficulty: "easy", tags: ["campus-2026"] });
    expect(entry?.question).toMatchObject({ id: "b-1", stem: "Which sort is stable?", correctIndex: 1 });
  });

  it("filters by topic, difficulty, tag and text", async () => {
    await bank.add(S, [
      draft("Reverse an array"),
      draft("Detect a cycle in a list", { topic: "linked lists", difficulty: "medium", tags: ["dsa"] }),
      draft("Merge two sorted arrays", { difficulty: "hard" }),
    ]);
    const stems = async (filter: Parameters<QuestionBank["list"]>[1]) =>
      (await bank.list(S, filter)).map((e) => e.question.stem).sort();

    expect(await stems({ topic: "arrays" })).toEqual(["Merge two sorted arrays", "Reverse an array"]);
    expect(await stems({ difficulty: "hard" })).toEqual(["Merge two sorted arrays"]);
    expect(await stems({ tag: "dsa" })).toEqual(["Detect a cycle in a list"]);
    expect(await stems({ search: "SORTED" })).toEqual(["Merge two sorted arrays"]);
    expect(await bank.topics(S)).toEqual(["arrays", "linked lists"]);
  });

  it("edits in place and archives rather than deleting", async () => {
    const [entry] = await bank.add(S, [draft("Old wording")]);
    const updated = await bank.update(S, entry!.id, draft("New wording", { difficulty: "medium" }));
    expect(updated?.question.stem).toBe("New wording");

    expect(await bank.archive(S, entry!.id)).toBe(true);
    expect(await bank.list(S)).toEqual([]);
    expect((await bank.list(S, { includeArchived: true }))[0]?.archived).toBe(true);
  });

  it("files all of a batch or none of it", async () => {
    let n = 0;
    const clashing = new QuestionBank(sql, { newId: () => (++n === 2 ? "b-1" : `x-${n}`) });
    await bank.add(S, [draft("Already here")]);

    await expect(clashing.add(S, [draft("First"), draft("Clashes"), draft("Third")])).rejects.toThrow();
    expect((await bank.list(S)).map((e) => e.question.stem)).toEqual(["Already here"]);
  });

  it("is invisible to another organisation and to any candidate", async () => {
    await bank.add(S, [draft("Ours")]);

    expect(await bank.list(staffScope(OTHER))).toEqual([]);
    expect(await bank.list(candidateScope(ORG, attemptId("a1")))).toEqual([]);
    expect(await bank.update(staffScope(OTHER), "b-1", draft("Theirs now"))).toBeNull();
  });
});
