import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor, type IdentityStore } from "@parikshaa/store";
import { docxOf } from "./testing/docx.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/**
 * ROADMAP §3: a question bank, exams that draw a different paper per
 * candidate, and exams that are frozen once sat but can be cloned.
 * Runs as `parikshaa_app`, so row-level security is live.
 */

const CSV = [
  "kind,question,options,answer,marks,topic,difficulty,tags",
  ...Array.from({ length: 6 }, (_, i) => `mcq,Quant question ${i + 1},a | b | c,A,2,quant,easy,campus`),
  "numeric,What is 6 * 7?,,42,2,quant,medium,campus",
  "short,Explain recursion,,Calls itself | Has a base case,5,theory,hard,",
].join("\n");

let db: PGlite;
let app: FastifyInstance;
let identity: IdentityStore;
let owner: string;

beforeEach(async () => {
  db = await freshDatabase();
  ({ app, identity } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic }));
  const org = await addOrganisation(identity, "org-a", "Acme");
  await addOrganisation(identity, "org-b", "Bharat");
  await addStaff(identity, org, "owner@acme.test", "owner");
  await addStaff(identity, org, "inv@acme.test", "invigilator");
  await addStaff(identity, "org-b" as never, "owner@bharat.test", "owner");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "owner@acme.test");
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const call = (method: "GET" | "POST" | "PUT" | "DELETE", token: string, url: string, payload?: object) =>
  payload === undefined
    ? app.inject({ method, url, headers: bearer(token) })
    : app.inject({ method, url, headers: bearer(token), payload });

interface Entry {
  id: string;
  question: { id: string; stem: string; maxScore: number };
}

async function importBank(): Promise<Entry[]> {
  const res = await call("POST", owner, "/bank/import", { csv: CSV });
  expect(res.statusCode, res.payload).toBe(201);
  expect(res.json()).toEqual({ imported: 8 });
  return (await call("GET", owner, "/bank?topic=quant&difficulty=easy")).json().questions;
}

/** An exam built from the bank: every candidate gets 3 of the 6 easy quant questions. */
async function examFromBank(): Promise<void> {
  const pool = (await importBank()).map((e) => e.question);
  const res = await call("POST", owner, "/exams", {
    id: "aptitude",
    title: "Aptitude round",
    questions: [],
    sections: [{ id: "quant", title: "Quantitative", pick: 3, pool }],
    policy: { durationMs: 3_600_000, allowRevision: true, vivaTriggerRatio: 0.99 },
  });
  expect(res.statusCode, res.payload).toBe(201);
}

async function start(candidate: string) {
  const res = await call("POST", owner, "/exams/aptitude/attempts", { candidateId: candidate });
  expect(res.statusCode).toBe(201);
  return res.json() as { attemptId: string; token: string };
}

describe("the question bank", () => {
  it("imports a spreadsheet and files it by topic and difficulty", async () => {
    await importBank();

    const all = (await call("GET", owner, "/bank")).json();
    expect(all.questions).toHaveLength(8);
    expect(all.topics).toEqual(["quant", "theory"]);
    expect((await call("GET", owner, "/bank?q=recursion")).json().questions).toHaveLength(1);
  });

  it("imports nothing from a file with a bad row, and says which row", async () => {
    const res = await call("POST", owner, "/bank/import", {
      csv: "kind,question,options,answer\nmcq,Fine,a | b,A\nmcq,Broken,a | b,Z",
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().problems).toEqual([{ row: 3, message: expect.stringMatching(/not one of the options/) }]);
    expect((await call("GET", owner, "/bank")).json().questions).toEqual([]);
  });

  it("files, edits and archives a single question, checking it like an exam would", async () => {
    const question = { kind: "mcq", stem: "Stable sort?", maxScore: 1, rubric: [], options: ["a", "b"], correctIndex: 1 };
    const created = await call("POST", owner, "/bank", { question, topic: "sorting" });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;

    const edited = await call("PUT", owner, `/bank/${id}`, { question: { ...question, stem: "Which sort is stable?" } });
    expect(edited.json().question.stem).toBe("Which sort is stable?");

    const invalid = await call("POST", owner, "/bank", { question: { ...question, correctIndex: 7 } });
    expect(invalid.statusCode).toBe(422);

    expect((await call("DELETE", owner, `/bank/${id}`)).statusCode).toBe(200);
    expect((await call("GET", owner, "/bank")).json().questions).toEqual([]);
  });

  it("is kept from anyone who may not see answer keys, and from other organisations", async () => {
    await importBank();
    const invigilator = await signIn(app, "inv@acme.test");
    const otherOwner = await signIn(app, "owner@bharat.test");

    expect((await call("GET", invigilator, "/bank")).statusCode).toBe(403);
    expect((await call("GET", otherOwner, "/bank")).json().questions).toEqual([]);
  });
});

describe("a paper per candidate", () => {
  it("draws a different paper for each candidate and records it in their ledger", async () => {
    await examFromBank();
    const papers = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const { token } = await start(`cand-${i}`);
      const state = (await call("GET", token, "/attempts/me")).json();
      expect(state.exam.questions).toHaveLength(3);
      papers.add(state.exam.questions.map((q: { id: string }) => q.id).join(","));
    }
    expect(papers.size).toBeGreaterThan(1);
  });

  it("accepts answers only to the questions this candidate drew", async () => {
    await examFromBank();
    const pool = ((await call("GET", owner, "/bank?topic=quant&difficulty=easy")).json().questions as Entry[]).map(
      (e) => e.id,
    );
    const { token } = await start("cand-1");
    const mine = ((await call("GET", token, "/attempts/me")).json().exam.questions as { id: string }[]).map((q) => q.id);
    const notMine = pool.find((id) => !mine.includes(id))!;

    const answer = (questionId: string) =>
      call("POST", token, "/attempts/me/answers", { questionId, answer: "0" });
    expect((await answer(mine[0]!)).statusCode).toBe(202);
    expect((await answer(notMine)).statusCode).toBe(409);
  });

  it("grades each paper on its own questions", async () => {
    await examFromBank();
    const { attemptId, token } = await start("cand-1");
    const mine = ((await call("GET", token, "/attempts/me")).json().exam.questions as { id: string }[]).map((q) => q.id);
    for (const id of mine) await call("POST", token, "/attempts/me/answers", { questionId: id, answer: "0" });
    await call("POST", token, "/attempts/me/submit");

    // Three drawn questions, each worth 2, each answered "A".
    expect((await call("POST", owner, `/attempts/${attemptId}/grade`)).json()).toEqual({ total: 6 });

    const ledger = (await call("GET", token, "/attempts/me/ledger")).json();
    expect(ledger.entries[0].event.questionIds).toEqual(mine);
  });

  it("counts questions per paper, not per pool", async () => {
    await examFromBank();
    expect((await call("GET", owner, "/exams")).json().exams).toEqual([
      expect.objectContaining({ id: "aptitude", questionCount: 3 }),
    ]);
  });
});

describe("versioning", () => {
  it("freezes an exam once sat, and lets it be cloned to change it", async () => {
    await examFromBank();
    await start("cand-1");
    const definition = (await call("GET", owner, "/exams/aptitude")).json();

    const edit = await call("POST", owner, "/exams", { ...definition, title: "Changed after the sitting" });
    expect(edit.statusCode).toBe(409);
    expect(edit.json().error).toBe("exam_frozen");

    const clone = await call("POST", owner, "/exams/aptitude/clone", { id: "aptitude-2027" });
    expect(clone.statusCode).toBe(201);
    const copy = (await call("GET", owner, "/exams/aptitude-2027")).json();
    expect(copy.title).toBe("Aptitude round (copy)");
    expect(copy.sections).toEqual(definition.sections);

    const editCopy = await call("POST", owner, "/exams", { ...copy, title: "Aptitude round 2027" });
    expect(editCopy.statusCode).toBe(201);
  });

  it("refuses to clone onto an id already in use", async () => {
    await examFromBank();
    expect((await call("POST", owner, "/exams/aptitude/clone", { id: "aptitude" })).statusCode).toBe(409);
  });

  it("changes no exam when the bank question it came from is edited", async () => {
    await examFromBank();
    const [first] = (await call("GET", owner, "/bank?topic=quant&difficulty=easy")).json().questions as Entry[];
    await call("PUT", owner, `/bank/${first!.id}`, {
      question: { kind: "mcq", stem: "Rewritten", maxScore: 2, rubric: [], options: ["x", "y"], correctIndex: 0 },
    });

    const pool = (await call("GET", owner, "/exams/aptitude")).json().sections[0].pool as { id: string; stem: string }[];
    expect(pool.find((q) => q.id === first!.id)?.stem).toBe(first!.question.stem);
  });
});

describe("importing a Word document into the bank", () => {
  const paper = Buffer.from(
    docxOf(["Aptitude paper", "1. Which is stable?", "a) Heap sort", "b) Merge sort", "Answer: b", "Topic: sorting", "2. What is 6 * 7?", "Answer: 42"]),
  ).toString("base64");

  it("previews on a dry run without adding anything, then imports", async () => {
    const dry = await call("POST", owner, "/bank/import/docx", { file: paper, dryRun: true });
    expect(dry.statusCode, dry.payload).toBe(200);
    expect(dry.json()).toEqual({
      imported: 0,
      preview: [
        { question: 1, kind: "mcq", stem: "Which is stable?", marks: 1, pictures: 0, passage: null, note: null },
        { question: 2, kind: "numeric", stem: "What is 6 * 7?", marks: 1, pictures: 0, passage: null, note: null },
      ],
    });
    expect((await call("GET", owner, "/bank")).json().questions).toHaveLength(0);

    const res = await call("POST", owner, "/bank/import/docx", { file: paper });
    expect(res.statusCode, res.payload).toBe(201);
    expect(res.json().imported).toBe(2);
    const questions = (await call("GET", owner, "/bank?topic=sorting")).json().questions;
    expect(questions.map((q: { question: { stem: string } }) => q.question.stem)).toEqual(["Which is stable?"]);
  });

  it("imports nothing when any question has a problem, and says which", async () => {
    const bad = Buffer.from(docxOf(["1. Which is stable?", "a) Heap sort", "Answer: c", "2. Fine?", "Answer: yes"])).toString("base64");
    const res = await call("POST", owner, "/bank/import/docx", { file: bad });
    expect(res.statusCode).toBe(422);
    expect(res.json().problems).toEqual([{ question: 1, written: 1, message: expect.stringContaining('The answer "c"') }]);
    expect((await call("GET", owner, "/bank")).json().questions).toHaveLength(0);
  });

  it("is for those who write exams", async () => {
    const invigilator = await signIn(app, "inv@acme.test");
    expect((await call("POST", invigilator, "/bank/import/docx", { file: paper })).statusCode).toBe(403);
  });
});

describe("pictures in questions", () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("a bar chart")]);

  it("are uploaded by an author and served by their hash to anyone, cached for good", async () => {
    const res = await call("POST", owner, "/media", { image: PNG.toString("base64") });
    expect(res.statusCode, res.payload).toBe(201);
    const { media, url } = res.json();
    expect(url).toBe(`/api/media/${media}`);

    const served = await app.inject({ method: "GET", url: `/media/${media}` });
    expect(served.statusCode).toBe(200);
    expect(served.headers["content-type"]).toBe("image/png");
    expect(served.headers["cache-control"]).toContain("immutable");
    expect(Buffer.compare(served.rawPayload, PNG)).toBe(0);
    expect((await app.inject({ method: "GET", url: `/media/${"0".repeat(64)}` })).statusCode).toBe(404);
  });

  it("refuse what is not a picture, and anyone who cannot write exams", async () => {
    const svg = await call("POST", owner, "/media", { image: Buffer.from("<svg onload=alert(1)/>").toString("base64") });
    expect(svg.statusCode).toBe(422);
    expect(svg.json().error).toBe("not_an_image");
    const invigilator = await signIn(app, "inv@acme.test");
    expect((await call("POST", invigilator, "/media", { image: PNG.toString("base64") })).statusCode).toBe(403);
  });

  it("pasted into a Word paper are stored with the questions that show them", async () => {
    const paper = Buffer.from(
      docxOf(["1. What does the chart show?", { text: "", picture: PNG, alt: "Sales by month" }, "Answer: growth"]),
    ).toString("base64");
    const res = await call("POST", owner, "/bank/import/docx", { file: paper });
    expect(res.statusCode, res.payload).toBe(201);
    const [entry] = (await call("GET", owner, "/bank")).json().questions;
    const [image] = entry.question.images;
    expect(image.alt).toBe("Sales by month");
    expect((await app.inject({ method: "GET", url: `/media/${image.media}` })).statusCode).toBe(200);
  });
});
