import { describe, expect, it } from "vitest";
import type { RunRequest, RunResult } from "./execute.js";
import { buildRunnerServer } from "./server.js";

const TOKEN = "t".repeat(40);
const request: RunRequest = { language: "python", source: "print(1)", tests: [{ id: "t", input: "", expected: "1" }] };
const ok: RunResult = { compiled: true, tests: [{ id: "t", status: "passed", timeMs: 1, memoryKb: 1024, stdout: "1", stderr: "" }] };

describe("the runner service", () => {
  it("refuses a request without its token", async () => {
    const app = buildRunnerServer({ token: TOKEN, workRoot: "/tmp", slots: [], run: async () => ok });
    const res = await app.inject({ method: "POST", url: "/run", payload: request, headers: { authorization: "Bearer wrong" } });
    expect(res.statusCode).toBe(401);
  });

  it("refuses a language it does not know and limits beyond its ceiling", async () => {
    const app = buildRunnerServer({ token: TOKEN, workRoot: "/tmp", slots: [], run: async () => ok });
    const headers = { authorization: `Bearer ${TOKEN}` };
    expect((await app.inject({ method: "POST", url: "/run", headers, payload: { ...request, language: "cobol" } })).statusCode).toBe(400);
    expect(
      (await app.inject({ method: "POST", url: "/run", headers, payload: { ...request, limits: { timeMs: 60_000 } } })).statusCode,
    ).toBe(400);
  });

  it("takes a checker and a result marker, and refuses a checker it does not know", async () => {
    let seen: RunRequest | undefined;
    const app = buildRunnerServer({ token: TOKEN, workRoot: "/tmp", slots: [], run: async (r) => ((seen = r), ok) });
    const headers = { authorization: `Bearer ${TOKEN}` };
    const payload = { ...request, checker: { kind: "json", tolerance: 1e-6, unordered: "top" }, resultMarker: "\u001eRESULT" };
    expect((await app.inject({ method: "POST", url: "/run", headers, payload })).statusCode).toBe(200);
    expect(seen).toMatchObject({ checker: { kind: "json", unordered: "top" }, resultMarker: "\u001eRESULT" });
    const unknown = { ...request, checker: { kind: "regex", pattern: ".*" } };
    expect((await app.inject({ method: "POST", url: "/run", headers, payload: unknown })).statusCode).toBe(400);
  });

  it("gives each concurrent run its own slot, never two at once", async () => {
    const inUse = new Set<number>();
    let overlap = false;
    const app = buildRunnerServer({
      token: TOKEN,
      workRoot: "/tmp",
      slots: [
        { uid: 1, gid: 1 },
        { uid: 2, gid: 2 },
      ],
      run: async (_request, options) => {
        const uid = options.slot!.uid;
        if (inUse.has(uid)) overlap = true;
        inUse.add(uid);
        await new Promise((r) => setTimeout(r, 20));
        inUse.delete(uid);
        return ok;
      },
    });
    const headers = { authorization: `Bearer ${TOKEN}` };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => app.inject({ method: "POST", url: "/run", headers, payload: request })),
    );
    expect(results.every((r) => r.statusCode === 200)).toBe(true);
    expect(overlap).toBe(false);
  });

  it("answers busy rather than queueing without end", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const app = buildRunnerServer({
      token: TOKEN,
      workRoot: "/tmp",
      slots: [{ uid: 1, gid: 1 }],
      maxQueue: 1,
      run: async () => {
        await gate;
        return ok;
      },
    });
    const headers = { authorization: `Bearer ${TOKEN}` };
    const first = app.inject({ method: "POST", url: "/run", headers, payload: request });
    const second = app.inject({ method: "POST", url: "/run", headers, payload: request });
    await new Promise((r) => setTimeout(r, 20));
    const third = await app.inject({ method: "POST", url: "/run", headers, payload: request });
    expect(third.statusCode).toBe(503);
    release();
    expect((await first).statusCode).toBe(200);
    expect((await second).statusCode).toBe(200);
  });
});
