import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { PGlite } from "@electric-sql/pglite";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pgliteExecutor } from "@parikshaa/store";
import { freshDatabase, wire } from "./testing/harness.js";

/**
 * Serving both client bundles from the API process.
 *
 * Hermetic: the roots are stand-in directories rather than the real builds, so
 * this tests the wiring and the fallback rules rather than whichever bundle
 * happens to be on disk.
 */

let db: PGlite;
let app: FastifyInstance;

beforeEach(async () => {
  db = await freshDatabase();
  const sql = pgliteExecutor(db);

  const root = await mkdtemp(join(tmpdir(), "parikshaa-clients-"));
  const web = join(root, "web");
  const consoleRoot = join(root, "console");
  await mkdir(web);
  await mkdir(consoleRoot);
  await writeFile(join(web, "index.html"), "<!doctype html><title>candidate</title>");
  await writeFile(join(consoleRoot, "index.html"), "<!doctype html><title>console</title>");
  await mkdir(join(web, "assets"));
  await writeFile(join(web, "assets", "app.js"), "export const x = 1;\n");

  ({ app } = await wire(sql, { client: {} as unknown as Anthropic, server: { clients: { web, console: consoleRoot } } }));
});

afterEach(async () => {
  await app.close();
  await db.close();
});

const html = { accept: "text/html" };

describe("serving the clients", () => {
  it("serves the candidate app at the root", async () => {
    const res = await app.inject({ method: "GET", url: "/", headers: html });

    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain("candidate");
  });

  it("serves the console under /console", async () => {
    const res = await app.inject({ method: "GET", url: "/console/", headers: html });

    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain("console");
  });

  it("serves static assets", async () => {
    const res = await app.inject({ method: "GET", url: "/assets/app.js" });

    expect(res.statusCode).toBe(200);
    expect(res.payload).toContain("export const x");
  });

  it("returns each app's shell for a deep link into it", async () => {
    // Both clients hold their own view state, so a reload on any path must get
    // the shell back rather than a 404.
    const candidate = await app.inject({ method: "GET", url: "/some/deep/path", headers: html });
    expect(candidate.payload).toContain("candidate");

    const staff = await app.inject({ method: "GET", url: "/console/exams/exam-1", headers: html });
    expect(staff.payload).toContain("console");
  });

  it("still answers API routes rather than the shell", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.json()).toEqual({ ok: true });

    // An unauthenticated API call must fail as an API call, not silently
    // return HTML that a client would try to parse as JSON.
    const unauthorized = await app.inject({ method: "GET", url: "/attempts/me" });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json().error).toBe("attempt_token_required");
  });

  it("returns JSON, not the shell, for an unknown non-HTML request", async () => {
    const res = await app.inject({ method: "GET", url: "/nope", headers: { accept: "application/json" } });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not_found" });

    const posted = await app.inject({ method: "POST", url: "/nope", headers: html });
    expect(posted.statusCode).toBe(404);
  });

  it("answers the clients' /api-prefixed requests, as the dev proxy does", async () => {
    // The bundles call `/api/...`; in development Vite strips the prefix, and
    // served from here nothing else would.
    const res = await app.inject({ method: "GET", url: "/api/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect((await app.inject({ method: "GET", url: "/api/usage?since=2026-09-01T00:00:00Z" })).statusCode).toBe(401);
    // Only the prefix is stripped; a route that merely starts with "api" is untouched.
    expect((await app.inject({ method: "GET", url: "/api-keys" })).statusCode).toBe(401);
  });

  it("reports a malformed request as the client's error, not a server fault", async () => {
    const empty = await app.inject({
      method: "POST",
      url: "/api/attempts/me/submit",
      headers: { "content-type": "application/json", authorization: "Bearer x" },
    });
    expect(empty.statusCode).toBe(400);

    const garbled = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(garbled.statusCode).toBe(400);
  });
});
