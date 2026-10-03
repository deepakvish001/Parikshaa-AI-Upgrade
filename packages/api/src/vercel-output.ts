import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { baseHeaders, pagePolicy } from "./page-headers.js";

/**
 * The two clients as a Vercel deployment (docs/F1-GO-LIVE-PLAN.md §8, G0), in
 * Vercel's Build Output API v3 form, ready for `vercel deploy --prebuilt`.
 *
 * One site, laid out as the API lays it out when it serves them itself: the
 * candidate's and learner's app at `/`, the console at `/console/`, and
 * everything under `/api` handed to the API on its own machine. So the
 * browser sees one origin: the pages' `connect-src 'self'` holds, no CORS is
 * needed, and links already sent (`PUBLIC_URL/...`) keep working. Vercel's CDN
 * waits two minutes for the API's first byte and then streams, which covers a
 * code run and the live view's stream.
 */

export interface VercelTransform {
  readonly type: "request.headers";
  readonly op: "set";
  readonly target: { readonly key: string };
  readonly args: string;
  readonly env: readonly string[];
}

export interface VercelRoute {
  readonly src?: string;
  readonly dest?: string;
  readonly headers?: Record<string, string>;
  readonly transforms?: readonly VercelTransform[];
  readonly continue?: boolean;
  readonly handle?: "filesystem";
}

/**
 * Set on every request passed to the API, from the Vercel project's
 * environment variable of the same name (never written into the build): the
 * API's machine answers only requests that carry it (scripts/setup-server.sh),
 * so the client address Vercel forwards can be believed. A client's own
 * header of that name is overwritten.
 */
export const EDGE_HEADER = "x-parikshaa-edge";
export const EDGE_SECRET_ENV = "PARIKSHAA_EDGE_SECRET";
const edge: readonly VercelTransform[] = [
  { type: "request.headers", op: "set", target: { key: EDGE_HEADER }, args: `$${EDGE_SECRET_ENV}`, env: [EDGE_SECRET_ENV] },
];
/** The API's answers are never kept by the CDN. */
const uncached = { "x-vercel-enable-rewrite-caching": "0" };

export interface VercelConfig {
  readonly version: 3;
  readonly routes: readonly VercelRoute[];
}

/** The routing: the API proxied, the headers set, then files, then each client's shell. */
export function vercelConfig(apiOrigin: string): VercelConfig {
  const api = new URL(apiOrigin);
  if (api.protocol !== "https:" && api.hostname !== "localhost" && api.hostname !== "127.0.0.1") {
    throw new Error(`The API must be reached over HTTPS: ${apiOrigin}`);
  }
  if (api.pathname !== "/" || api.search !== "" || api.hash !== "") throw new Error(`Give the API's origin only, without a path: ${apiOrigin}`);
  const origin = api.origin;
  return {
    version: 3,
    routes: [
      // Every response gets the headers the API itself sends (page-headers.ts).
      { src: "^/(.*)$", headers: baseHeaders({ hsts: true }), continue: true },
      { src: "^/console(?:/.*)?$", headers: { "content-security-policy": pagePolicy("/console/") }, continue: true },
      { src: "^/practice/.*$", headers: { "content-security-policy": pagePolicy("/practice/") }, continue: true },
      { src: "^/(?!console(?:/|$)|practice/|api(?:/|$)).*$", headers: { "content-security-policy": pagePolicy("/") }, continue: true },
      // Built files carry a hash in their name: they never change.
      { src: "^/(?:console/)?assets/.*$", headers: { "cache-control": "public, max-age=31536000, immutable" }, continue: true },
      // The API: JSON, PDFs, photos, the live stream, LTI and sign-in callbacks.
      { src: "^/api(/.*)?$", dest: `${origin}/api$1`, transforms: edge, headers: uncached },
      // The Android app's link to this site (docs/PLAY-STORE.md) is the API's to answer.
      { src: "^/\\.well-known/assetlinks\\.json$", dest: `${origin}/.well-known/assetlinks.json`, transforms: edge, headers: uncached },
      { handle: "filesystem" },
      // A deep link or a reload gets its client's shell, as from the API.
      { src: "^/console(?:/.*)?$", dest: "/console/index.html" },
      { src: "^/.*$", dest: "/index.html" },
    ],
  };
}

const isDirectory = async (path: string) => (await stat(path).catch(() => null))?.isDirectory() === true;

/** Lay out `out` (a `.vercel/output`) from the two built clients. */
export async function writeVercelOutput(options: { readonly web: string; readonly console: string; readonly out: string; readonly apiOrigin: string }): Promise<void> {
  for (const [name, dir] of [["web", options.web], ["console", options.console]] as const) {
    if (!(await isDirectory(dir))) throw new Error(`No ${name} build at ${dir}: run npm run build:clients first`);
  }
  const config = vercelConfig(options.apiOrigin);
  await rm(options.out, { recursive: true, force: true });
  const files = join(options.out, "static");
  await mkdir(files, { recursive: true });
  await cp(options.web, files, { recursive: true });
  await cp(options.console, join(files, "console"), { recursive: true });
  await writeFile(join(options.out, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
}
