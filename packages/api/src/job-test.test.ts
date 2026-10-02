import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { fakeModel } from "./fake-model.js";
import { FAMILIES, MINUTES, ROLES } from "./roles.js";
import { addOrganisation, addStaff, bearer, freshDatabase, signIn, wire } from "./testing/harness.js";

/** A test from a job: a role from the library, or a job description read by the model, built from the bank. */

let db: PGlite;
let app: FastifyInstance;
let owner: string;
let invigilator: string;
let model: ReturnType<typeof fakeModel>;

const call = (method: "GET" | "POST", url: string, token: string, payload?: object) =>
  app.inject({ method, url, headers: bearer(token), ...(payload === undefined ? {} : { payload }) });

const mcq = (stem: string, topic: string, difficulty: "easy" | "medium" | "hard", tags: string[] = [], maxScore = 1) => ({
  question: { kind: "mcq", stem, maxScore, rubric: [], options: ["A", "B", "C", "D"], correctIndex: 0 },
  topic,
  difficulty,
  tags,
});

beforeEach(async () => {
  db = await freshDatabase();
  model = fakeModel({ latencyMs: 0 });
  const wiring = await wire(pgliteExecutor(db), { client: model.client });
  app = wiring.app;
  const org = await addOrganisation(wiring.identity, "org-a", "Acme Hiring");
  await addStaff(wiring.identity, org, "hr@acme.test", "owner");
  await addStaff(wiring.identity, org, "watch@acme.test", "invigilator");
  await db.exec(`SET ROLE parikshaa_app`);
  owner = await signIn(app, "hr@acme.test");
  invigilator = await signIn(app, "watch@acme.test");

  const drafts = [
    ...Array.from({ length: 30 }, (_, i) => mcq(`Percentages ${i}`, "Quantitative aptitude", i % 3 === 0 ? "easy" : "medium")),
    ...Array.from({ length: 5 }, (_, i) => mcq(`Series ${i}`, "Puzzles", "medium", ["logical reasoning"])),
    ...Array.from({ length: 20 }, (_, i) => mcq(`Collections ${i}`, "Java", i < 10 ? "hard" : "easy")),
    mcq("Heavy Java question", "Java", "hard", [], 5),
    ...Array.from({ length: 8 }, (_, i) => mcq(`Kafka topics ${i}`, "Messaging", "medium", ["kafka"])),
    // "cost" must not feed the OS section: keywords match whole words.
    mcq("Cost of living", "Cost accounting", "easy"),
  ];
  for (const draft of drafts) expect((await call("POST", "/bank", owner, draft)).statusCode).toBe(201);
});

afterEach(async () => {
  await app.close();
  await db.close();
});

describe("the role library", () => {
  it("lists every role with its sections, time and qualifying mark", async () => {
    const roles = (await call("GET", "/job-tests/roles", owner)).json().roles;
    expect(roles.map((r: { id: string }) => r.id)).toEqual(ROLES.map((r) => r.id));
    expect(roles).toHaveLength(60);
    expect(roles.find((r: { id: string }) => r.id === "fresher-aptitude")).toMatchObject({ minutes: 75, cutoffPercent: 60 });
    expect((await call("GET", "/job-tests/roles", invigilator)).statusCode).toBe(403);
  });

  it("holds sixty tech roles, each family filled, every role a sound paper", () => {
    expect(new Set(ROLES.map((r) => r.id)).size).toBe(60);
    for (const family of FAMILIES) expect(ROLES.filter((r) => r.family === family).length, family).toBeGreaterThanOrEqual(5);
    // Tech only (docs/LAUNCH-PLAN.md §1): the non-tech support test is gone.
    expect(ROLES.find((r) => r.id === "support-bpo")).toBeUndefined();
    for (const r of ROLES) {
      expect(r.id, r.id).toMatch(/^[a-z0-9-]+$/);
      expect(new Set(r.sections.map((s) => s.id)).size, r.id).toBe(r.sections.length);
      expect(r.cutoffPercent, r.id).toBeGreaterThanOrEqual(50);
      for (const s of r.sections) {
        expect(s.count, `${r.id}/${s.id}`).toBeGreaterThan(0);
        expect(s.keywords.length, `${r.id}/${s.id}`).toBeGreaterThan(0);
        for (const k of s.keywords) expect(k, `${r.id}/${s.id}`).toBe(k.trim().toLowerCase());
      }
      const minutes = r.sections.reduce((sum, s) => sum + s.count * Math.min(...s.kinds.map((k) => MINUTES[k])), 0);
      expect(minutes, r.id).toBeGreaterThanOrEqual(20);
      expect(minutes, r.id).toBeLessThanOrEqual(120);
    }
  });

  it("drafts every role without a model", async () => {
    for (const r of ROLES) {
      const res = await call("POST", "/job-tests/draft", owner, { roleId: r.id });
      expect(res.statusCode, r.id).toBe(200);
      expect(res.json()).toMatchObject({ roleId: r.id, source: "role", title: `${r.title} — online test` });
    }
  });
});

describe("a draft from a role", () => {
  it("fills each section from the bank, says where it is short, and asks no model", async () => {
    const draft = (await call("POST", "/job-tests/draft", owner, { roleId: "fresher-aptitude" })).json();
    expect(draft).toMatchObject({ roleId: "fresher-aptitude", source: "role", seniority: "fresher", cutoffPercent: 60, title: "Fresher aptitude (mass hiring) — online test" });
    const [aptitude, reasoning, verbal] = draft.sections;
    expect(aptitude).toMatchObject({ id: "aptitude", wanted: 20, pick: 20 });
    expect(aptitude.pool).toHaveLength(30);
    // Freshers get medium questions first.
    expect(aptitude.pool[0].difficulty).toBe("medium");
    expect(reasoning).toMatchObject({ wanted: 15, pick: 5 });
    expect(verbal).toMatchObject({ wanted: 15, pick: 0, pool: [] });
    expect(draft.notes.join(" ")).toMatch(/Logical reasoning: 5 of the 15/);
    expect(draft.notes.join(" ")).toMatch(/Verbal ability: the bank has no objective questions/);
  });

  it("keeps a pool to one mark value, and keeps words whole", async () => {
    const draft = (await call("POST", "/job-tests/draft", owner, { roleId: "java-developer", seniority: "senior" })).json();
    const java = draft.sections.find((s: { id: string }) => s.id === "java");
    expect(java.pool).toHaveLength(20);
    expect(java.pool.every((q: { maxScore: number }) => q.maxScore === 1)).toBe(true);
    expect(java.pool[0].difficulty).toBe("hard");
    const campus = (await call("POST", "/job-tests/draft", owner, { roleId: "campus-software" })).json();
    expect(campus.sections.find((s: { id: string }) => s.id === "cs").pool).toEqual([]);
  });

  it("refuses without a role or a description", async () => {
    expect((await call("POST", "/job-tests/draft", owner, {})).statusCode).toBe(404);
    expect((await call("POST", "/job-tests/draft", owner, { roleId: "astronaut" })).statusCode).toBe(404);
  });
});

describe("a draft from a job description", () => {
  it("reads the role, seniority and extra skills, and adds a section for them", async () => {
    const draft = (await call("POST", "/job-tests/draft", owner, { description: "We are hiring Java developers with 2 years of Kafka and event streaming." })).json();
    expect(draft).toMatchObject({ source: "model", roleId: "java-developer", seniority: "junior", title: "Java Developer — online test", skills: ["Apache Kafka", "Core Java"] });
    const extra = draft.sections.find((s: { id: string }) => s.id === "job");
    expect(extra).toMatchObject({ title: "Skills from the job", wanted: 6, pick: 6 });
    expect(extra.keywords).toEqual(["kafka", "event streaming"]);
    expect(extra.pool).toHaveLength(8);
    // Core Java is already the role's own section, so no second one.
    expect(draft.sections.filter((s: { id: string }) => s.id === "job")).toHaveLength(1);
    const usage = (await call("GET", "/usage", owner)).json();
    expect(JSON.stringify(usage)).toContain("author");
  });

  it("lets the recruiter override the role and seniority the model chose", async () => {
    const draft = (await call("POST", "/job-tests/draft", owner, { description: "Freshers for our service desk.", roleId: "fresher-aptitude", seniority: "fresher" })).json();
    expect(draft).toMatchObject({ roleId: "fresher-aptitude", seniority: "fresher", source: "model" });
  });
});

describe("saving a draft", () => {
  it("makes an ordinary exam, each section a pool", async () => {
    const draft = (await call("POST", "/job-tests/draft", owner, { roleId: "fresher-aptitude" })).json();
    const saved = await call("POST", "/job-tests", owner, {
      title: draft.title,
      durationMinutes: draft.durationMinutes,
      cutoffPercent: draft.cutoffPercent,
      sections: draft.sections.map((s: { title: string; pool: { id: string }[]; pick: number }) => ({ title: s.title, questionIds: s.pool.map((q) => q.id), pick: Math.max(1, s.pick) })),
    });
    expect(saved.statusCode).toBe(201);
    const { examId, questions } = saved.json();
    expect(examId).toMatch(/^fresher-aptitude-mass-hiring-online-test-/);
    expect(questions).toBe(25);
    const exam = (await call("GET", `/exams/${examId}`, owner)).json();
    expect(exam.sections.map((s: { title: string; pick: number; pool: unknown[] }) => [s.title, s.pick, s.pool.length])).toEqual([
      ["Quantitative aptitude", 20, 30],
      ["Logical reasoning", 5, 5],
    ]);
    expect(exam.policy).toMatchObject({ durationMs: draft.durationMinutes * 60_000, cutoff: { percent: 60 } });
  });

  it("refuses questions that are not in the bank, and a question twice", async () => {
    const draft = (await call("POST", "/job-tests/draft", owner, { roleId: "fresher-aptitude" })).json();
    const id = draft.sections[0].pool[0].id;
    expect((await call("POST", "/job-tests", owner, { title: "T", durationMinutes: 30, sections: [{ title: "A", questionIds: ["nope"], pick: 1 }] })).statusCode).toBe(404);
    expect((await call("POST", "/job-tests", owner, { title: "T", durationMinutes: 30, sections: [{ title: "A", questionIds: [id], pick: 1 }, { title: "B", questionIds: [id], pick: 1 }] })).statusCode).toBe(409);
    expect((await call("POST", "/job-tests", owner, { title: "T", durationMinutes: 30, sections: [{ title: "A", questionIds: [], pick: 1 }] })).statusCode).toBe(409);
  });
});
