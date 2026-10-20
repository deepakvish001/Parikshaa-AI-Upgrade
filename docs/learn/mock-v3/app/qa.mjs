// Checks every screen of the built mock for sideways overflow, console errors and empty pages.
// [ROLE=finance] [ROUTES=file] node qa.mjs [w=1440] [theme=light] [lang=en]
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
const [w = "1440", theme = "light", lang = "en"] = process.argv.slice(2);
const routes = (process.env.ROUTES ? readFileSync(process.env.ROUTES, "utf8") : [...readFileSync("src/screens/registry.ts", "utf8").matchAll(/s\(\{ id: "([a-z0-9-]+)"/g)].map((m) => m[1]).join(","))
  .trim()
  .split(",");
const file = resolve("dist/preview.html");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: +w, height: +w < 600 ? 844 : 900 }, colorScheme: theme });
await ctx.addInitScript(([th, lg, rl]) => { localStorage.setItem("pk3-theme", th); localStorage.setItem("pk3-lang", lg); localStorage.setItem("pk-mock-shots", "1"); if (rl) localStorage.setItem("pk3-role", rl); }, [theme, lang, process.env.ROLE || ""]);
const p = await ctx.newPage();
let errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
let bad = 0;
for (const r of routes) {
  errs = [];
  await p.goto(`file://${file}#${r}`); await p.waitForTimeout(700);
  const res = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, soon: !!document.querySelector(".soon-page, [data-soon]"), h: document.body.innerText.length }));
  const ov = res.sw - +w;
  if (ov > 0 || errs.length || res.h < 40) { bad++; console.log(r, ov > 0 ? `OVERFLOW ${ov}` : "", errs.join(" | ").slice(0, 300), res.h < 40 ? "EMPTY" : ""); }
}
console.log(`${w} ${theme} ${lang}: ${routes.length} routes, ${bad} with issues`);
await b.close();
