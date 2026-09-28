import { chromium, expect, test } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

/**
 * Lighthouse, as a phone on a slow connection sees Parikshaa: its default
 * mobile run, simulating a mid-range phone (4× slower CPU) on slow 4G. A
 * candidate in a small town opens the link on exactly that.
 *
 * The pages a candidate and a recruiter open first, before signing in. Each
 * category must hold its floor; a change that drops one fails the build.
 */

const port = Number.parseInt(process.env["E2E_PORT"] ?? "4173", 10);
const FLOORS = { performance: 0.85, accessibility: 1, "best-practices": 0.95 } as const;

const PAGES = [
  ["the candidate's access page", "/"],
  ["the console's sign-in", "/console/"],
] as const;

test.describe.configure({ mode: "serial" });

for (const [name, path] of PAGES) {
  test(`${name} scores its floors on a slow phone`, async () => {
    const chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    });
    try {
      const run = await lighthouse(`http://localhost:${port}${path}`, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: Object.keys(FLOORS),
      });
      expect(run, "Lighthouse returned nothing").toBeTruthy();
      const { categories, audits } = run!.lhr;
      const scores = Object.fromEntries(Object.keys(FLOORS).map((id) => [id, categories[id]?.score ?? 0]));
      console.log(
        `${name}: ${Object.entries(scores)
          .map(([id, s]) => `${id} ${Math.round(s * 100)}`)
          .join(", ")} · LCP ${audits["largest-contentful-paint"]?.displayValue} · TBT ${audits["total-blocking-time"]?.displayValue} · ${audits["total-byte-weight"]?.displayValue}`,
      );
      for (const [id, floor] of Object.entries(FLOORS)) {
        const failing = Object.values(audits)
          .filter((a) => a.score !== null && a.score < 1 && categories[id]?.auditRefs.some((r) => r.id === a.id && r.weight > 0))
          .map((a) => a.title);
        expect(scores[id], `${name}: ${id} below ${floor * 100}. Weighing on it: ${failing.join("; ")}`).toBeGreaterThanOrEqual(floor);
      }
    } finally {
      chrome.kill();
    }
  });
}
