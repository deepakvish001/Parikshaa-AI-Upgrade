import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { baseHeaders, pagePolicy } from "./page-headers.js";
import { EDGE_HEADER, EDGE_SECRET_ENV, vercelConfig, writeVercelOutput, type VercelRoute } from "./vercel-output.js";

/**
 * The clients on Vercel (docs/F1-GO-LIVE-PLAN.md §8, G0): Vercel's own route
 * matching is not run here, so the routes are walked in its order — header
 * routes that `continue`, then the first route with a destination — with the
 * same regular expressions it uses.
 */

const API = "https://api.staging.parikshaa.example";

/** What Vercel would do with a path, given which files exist. */
function route(routes: readonly VercelRoute[], path: string, files: ReadonlySet<string>) {
  const headers: Record<string, string> = {};
  let filesystem = false;
  for (const r of routes) {
    if (r.handle === "filesystem") {
      filesystem = true;
      if (files.has(path)) return { headers, dest: path };
      continue;
    }
    const m = new RegExp(r.src!).exec(path);
    if (m === null) continue;
    Object.assign(headers, r.headers ?? {});
    if (r.continue === true) continue;
    return { headers, dest: r.dest!.replace("$1", m[1] ?? ""), afterFiles: filesystem };
  }
  return { headers, dest: null };
}

const FILES = new Set(["/index.html", "/assets/app-1a2b.js", "/sw.js", "/console/index.html", "/console/assets/console-9f.js"]);

describe("the Vercel routes", () => {
  const { routes } = vercelConfig(API);

  it("hand everything under /api to the API, before any file or shell", () => {
    expect(route(routes, "/api/invitations/redeem", FILES)).toMatchObject({ dest: `${API}/api/invitations/redeem`, afterFiles: false });
    expect(route(routes, "/api", FILES).dest).toBe(`${API}/api`);
    expect(route(routes, "/.well-known/assetlinks.json", FILES).dest).toBe(`${API}/.well-known/assetlinks.json`);
    // Not a prefix match: /apiary is the app's.
    expect(route(routes, "/apiary", FILES).dest).toBe("/index.html");
  });

  it("mark what they pass on with the edge secret, from Vercel's environment and never the build, and keep none of it cached", () => {
    for (const path of ["/api/", "/.well-known/assetlinks.json"]) {
      const proxy = routes.find((r) => r.dest?.startsWith(API) === true && new RegExp(r.src!).test(path))!;
      expect(proxy.transforms).toEqual([{ type: "request.headers", op: "set", target: { key: EDGE_HEADER }, args: `$${EDGE_SECRET_ENV}`, env: [EDGE_SECRET_ENV] }]);
      expect(proxy.headers).toEqual({ "x-vercel-enable-rewrite-caching": "0" });
    }
    expect(JSON.stringify(vercelConfig(API))).not.toMatch(/[0-9a-f]{64}/);
  });

  it("serve built files, and each client's shell for its deep links", () => {
    expect(route(routes, "/assets/app-1a2b.js", FILES).dest).toBe("/assets/app-1a2b.js");
    expect(route(routes, "/console/assets/console-9f.js", FILES).dest).toBe("/console/assets/console-9f.js");
    expect(route(routes, "/console/", FILES).dest).toBe("/console/index.html");
    expect(route(routes, "/console", FILES).dest).toBe("/console/index.html");
    expect(route(routes, "/console/exams/java-1", FILES).dest).toBe("/console/index.html");
    expect(route(routes, "/practice/nit/problems/sum", FILES).dest).toBe("/index.html");
    expect(route(routes, "/", FILES).dest).toBe("/index.html");
  });

  it("send the API's own security headers, and each page's policy", () => {
    const candidate = route(routes, "/", FILES).headers;
    expect(candidate).toMatchObject(baseHeaders({ hsts: true }));
    expect(candidate["content-security-policy"]).toBe(pagePolicy("/"));
    expect(candidate["content-security-policy"]).not.toContain("razorpay");
    expect(route(routes, "/console/billing", FILES).headers["content-security-policy"]).toBe(pagePolicy("/console/"));
    expect(route(routes, "/practice/nit", FILES).headers["content-security-policy"]).toContain("https://*.razorpay.com");
    expect(route(routes, "/console/assets/console-9f.js", FILES).headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(route(routes, "/index.html", FILES).headers["cache-control"]).toBeUndefined();
  });

  it("take an HTTPS origin only", () => {
    expect(() => vercelConfig("http://api.example.in")).toThrow(/HTTPS/);
    expect(() => vercelConfig(`${API}/api`)).toThrow(/without a path/);
    expect(vercelConfig(`${API}/`).routes.find((r) => r.src === "^/api(/.*)?$")?.dest).toBe(`${API}/api$1`);
  });
});

describe("the Vercel output", () => {
  it("puts the app at the root and the console under /console, with the routes beside them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vercel-"));
    for (const [client, file] of [["web", "index.html"], ["console", "index.html"]] as const) {
      await mkdir(join(dir, client, "assets"), { recursive: true });
      await writeFile(join(dir, client, file), `<title>${client}</title>`);
    }
    const out = join(dir, ".vercel", "output");
    await writeVercelOutput({ web: join(dir, "web"), console: join(dir, "console"), out, apiOrigin: API });
    expect(await readFile(join(out, "static", "index.html"), "utf8")).toBe("<title>web</title>");
    expect(await readFile(join(out, "static", "console", "index.html"), "utf8")).toBe("<title>console</title>");
    expect(JSON.parse(await readFile(join(out, "config.json"), "utf8"))).toEqual(vercelConfig(API));
    await expect(writeVercelOutput({ web: join(dir, "nothing"), console: join(dir, "console"), out, apiOrigin: API })).rejects.toThrow(/build:clients/);
  });
});
