import { fileURLToPath } from "node:url";
import { writeVercelOutput } from "./vercel-output.js";

/**
 * Lay out the built clients for Vercel (docs/STAGING.md):
 *
 *   npm run build:clients && npm run build
 *   API_ORIGIN=https://api.staging.example.in npm run vercel-output -w @parikshaa/api
 *   npx vercel deploy --prebuilt
 *
 * Writes `.vercel/output` at the repository's root, where the Vercel CLI looks.
 */

const apiOrigin = process.env["API_ORIGIN"];
if (apiOrigin === undefined || apiOrigin === "") {
  process.stderr.write("usage: API_ORIGIN=https://api.… vercel-output\n");
  process.exit(2);
}

const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
try {
  const out = root(".vercel/output");
  await writeVercelOutput({ web: root("packages/web/dist"), console: root("packages/console/dist"), out, apiOrigin });
  process.stdout.write(`Written ${out}, with /api going to ${new URL(apiOrigin).origin}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
