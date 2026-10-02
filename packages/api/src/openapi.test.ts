import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { specDocument } from "./openapi.js";
import { freshDatabase, wire } from "./testing/harness.js";

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

    // The only routes open to anyone: liveness, the contract itself, and the
    // two that turn something a person holds into a credential — a staff
    // sign-in, and a candidate opening their invitation link (whose code is
    // itself the proof) — and a question's picture by its SHA-256, which an
    // <img> fetches with no session and only a holder of the picture can name.
    // And the ways back in for someone who cannot sign in: a password reset
    // (whose link is the proof) and their organisation's own sign-in provider.
    // And a scorecard's check, whose code — printed on the scorecard — is the proof;
    // likewise a candidate's admit card, by the code in their invitation link, and a
    // hiring manager's shortlist, by the code in theirs.
    const open = new Set([
      "get /health",
      "get /openapi.json",
      "post /auth/login",
      "get /auth/signup",
      "post /auth/signup",
      "post /auth/verify-email",
      "post /invitations/redeem",
      "post /invitations/briefing",
      "get /invitations/admit-card.pdf",
      "get /shortlists/view/{code}",
      "post /shortlists/view/{code}/decisions",
      "get /apply/{code}",
      "post /apply/{code}",
      "get /offers/{code}",
      "post /offers/{code}/response",
      "get /status/{code}",
      "get /interviews/room/{code}",
      "put /interviews/room/{code}/code",
      "get /media/{sha256}",
      "post /auth/password-reset",
      "post /auth/password-reset/confirm",
      "get /auth/sso/{orgId}/start",
      "get /auth/sso/callback",
      "get /scorecards/{code}",
    ]);

    expect(all.length).toBeGreaterThanOrEqual(30);
    for (const { path, method, operation } of all) {
      expect(operation.summary, `${method} ${path} has no summary`).toBeTruthy();
      expect(operation.tags, `${method} ${path} has no tag`).toBeTruthy();
      if (!open.has(`${method} ${path}`)) {
        expect(operation.security, `${method} ${path} declares no security scheme`).toBeTruthy();
      }
    }
  });

  it("separates the two audiences", () => {
    const tagged = (tag: string) =>
      operations()
        .filter(({ operation }) => operation.tags?.includes(tag) === true)
        .map(({ path }) => path);

    // Everything a candidate does is to their own attempt, addressed as `me` —
    // except reading and opening the invitation that gives them one.
    expect(tagged("Candidate").every((p) => p.startsWith("/attempts/me") || p === "/invitations/redeem" || p === "/invitations/briefing" || p === "/invitations/admit-card.pdf")).toBe(true);
    expect(tagged("Institution").some((p) => p === "/exams")).toBe(true);
    // A practice learner reaches only their site's pages; staff run it from /practice-admin.
    expect(tagged("Practice").length).toBeGreaterThan(10);
    expect(tagged("Practice").every((p) => p.startsWith("/practice/{site}"))).toBe(true);
    expect(tagged("Practice (staff)").every((p) => p.startsWith("/practice-admin/"))).toBe(true);
    // Prep sits beside it, under the same two roots.
    expect(tagged("Prep").length).toBeGreaterThan(10);
    expect(tagged("Prep").every((p) => p.startsWith("/practice/{site}/"))).toBe(true);
    expect(tagged("Prep (staff)").every((p) => p.startsWith("/practice-admin/"))).toBe(true);
  });

  it("puts no answer key anywhere in a candidate-facing or learner-facing response", () => {
    // A practice learner is served the same projection of a question a candidate is.
    const candidate = operations().filter(({ operation }) => operation.tags?.some((t) => t === "Candidate" || t === "Practice" || t === "Prep") === true);
    expect(candidate.length).toBeGreaterThan(0);

    const names = propertyNames(candidate);
    expect(names.size).toBeGreaterThan(0);

    // Property names, not a substring scan: a description that *mentions* a
    // field is harmless, a schema that *declares* one is the leak. The boundary
    // `candidateView` closes in the type system, restated in the published
    // contract — and enforced at runtime, because serialization drops keys the
    // response schema does not name.
    for (const leak of ["correctIndex", "expectedPoints", "tolerance", "expected", "rubric", "vivaTriggerRatio", "rationale", "tests", "hidden", "weight"]) {
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
  let app: FastifyInstance;

  beforeEach(async () => {
    db = await freshDatabase();
    ({ app } = await wire(pgliteExecutor(db), { client: {} as unknown as Anthropic }));
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
