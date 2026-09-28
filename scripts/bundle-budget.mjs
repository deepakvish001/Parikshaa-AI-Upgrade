#!/usr/bin/env node
// What each built client file weighs, gzipped, against bundle-budget.json.
// A candidate on a slow connection downloads the web client's entry before
// they can read a word, so its weight is a feature, and CI holds it.
//
//   npm run build:clients && npm run budget
//
// Exits 1 if any file is over its budget, or if a budgeted pattern matches no
// file (a renamed chunk would otherwise escape the check).

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const budgets = JSON.parse(readFileSync(new URL("../bundle-budget.json", import.meta.url), "utf8"));
const glob = (pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[a-z]")}$`);

let failed = false;
for (const [dir, patterns] of Object.entries(budgets)) {
  if (dir.startsWith("$")) continue;
  const assets = join(dir, "assets");
  const files = readdirSync(assets).filter((f) => /\.(js|css)$/.test(f));
  const claimed = new Set();
  for (const [pattern, kb] of Object.entries(patterns)) {
    const matching = files.filter((f) => glob(pattern).test(f));
    if (matching.length === 0) {
      console.error(`✗ ${dir}: nothing matches ${pattern}`);
      failed = true;
    }
    for (const file of matching) {
      claimed.add(file);
      const size = gzipSync(readFileSync(join(assets, file)), { level: 9 }).length / 1024;
      const over = size > kb;
      failed ||= over;
      console.log(`${over ? "✗" : "✓"} ${join(dir, file).padEnd(64)} ${size.toFixed(1).padStart(7)} KB of ${kb} KB`);
    }
  }
  for (const file of files.filter((f) => !claimed.has(f))) {
    console.error(`✗ ${join(dir, file)} has no budget; add one to bundle-budget.json`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
