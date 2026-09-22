import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LedgerStore, migrate, pgliteExecutor } from "@parikshaa/store";
import { AttemptTokens } from "./auth.js";
import { specDocument } from "./openapi.js";
import { buildServer } from "./server.js";
import { ExamService } from "./service.js";

const COMMITTED = fileURLToPath(new URL("../../../docs/openapi.json", import.meta.url));

interface Operation {
  readonly tags?: readonly string[];
  readonly summary?: string;
  readonly security?: readonly Record<string, unknown>[];
  readonly responses?: Record<string, unknown>;
}

type Spec = {
  readonly openapi: string;
  readonly paths: Record<string, Record<string, Operation>>;
};

let spec: Spec;

beforeEach(async () => {
  spec = (await specDocument()) as unknown as Spec;
});

/** Every property name declared anywhere in a subtree's schemas. */
function propertyNames(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) propertyNames(item, found);
    return found;
  }
  if (typeof value !== "object" || value === null) return found;

  for (const [key, child] of Object.entries(value)) {
    if (key === "properties" && typeof child === "object" && child !== null) {
      for (const name of Object.keys(child)) found.add(name);
    }
    propertyNames(child, found);
  }
  return found;
}

const operations = () =>
  Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({ path, method, operation })),
  );

describe("the OpenAPI document", () => {
  it("matches the artifact committed at docs/openapi.json", async () => {
    const committed = JSON.parse(await readFile(COMMITTED, "utf8")) as unknown;

    // If this fails, a route changed without the contract being regenerated.
    // Run `npm run openapi`. The published contract is what institutions
    // integrate against; letting it drift from the code is how they end up
    // building against an endpoint that no longer behaves that way.
    expect(committed).toEqual(spec);
  });

  it("describes every route, each with a summary and a security scheme", () => {
    const all = operations();

    expect(all.length).toBeGreaterThanOrEqual(17);
    for (const { path, method, operation } of all) {
      expect(operation.summary, `${method} ${path} has no summary`).toBeTruthy();
      expect(operation.tags, `${method} ${path} has no tag`).toBeTruthy();
      if (path !== "/health" && path !== "/openapi.json") {
        expect(operation.security, `${method} ${path} declares no security scheme`).toBeTruthy();
      }
    }
  });

  it("separates the two audiences", () => {
    const tagged = (tag: string) =>
      operations()
        .filter(({ operation }) => operation.tags?.includes(tag) === true)
        .map(({ path }) => path);

    expect(tagged("Candidate").every((p) => p.startsWith("/attempts/me"))).toBe(true);
    expect(tagged("Institution").some((p) => p === "/exams")).toBe(true);
  });

  it("puts no answer key anywhere in a candidate-facing response", () => {
    const candidate = operations().filter(({ operation }) => operation.tags?.includes("Candidate") === true);
    expect(candidate.length).toBeGreaterThan(0);

    const names = propertyNames(candidate);
    expect(names.size).toBeGreaterThan(0);

    // Property names, not a substring scan: a description that *mentions* a
    // field is harmless, a schema that *declares* one is the leak. The boundary
    // `candidateView` closes in the type system, restated in the published
    // contract — and enforced at runtime, because serialization drops keys the
    // response schema does not name.
    for (const leak of ["correctIndex", "expectedPoints", "tolerance", "expected", "rubric", "vivaTriggerRatio", "rationale"]) {
      expect([...names], `candidate contract declares ${leak}`).not.toContain(leak);
    }
  });

  it("does describe the answer key on the staff-only exam route", () => {
    // The same fields must be present there, or the check above would pass
    // simply because nothing describes an exam at all.
    const staffExam = spec.paths["/exams/{examId}"]?.["get"];

    expect(JSON.stringify(staffExam)).toContain("correctIndex");
  });
});

describe("GET /openapi.json", () => {
  let db: PGlite;
  let app: ReturnType<typeof buildServer>;

  beforeEach(async () => {
    db = new PGlite();
    const sql = pgliteExecutor(db);
    await migrate(sql);
    app = buildServer({
      service: new ExamService({ store: new LedgerStore(sql), client: {} as unknown as Anthropic }),
      tokens: new AttemptTokens("x".repeat(40)),
      staffToken: "staff",
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await db.close();
  });

  it("serves the same document the artifact holds", async () => {
    const res = await app.inject({ method: "GET", url: "/openapi.json" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(JSON.parse(await readFile(COMMITTED, "utf8")));
  });
});
