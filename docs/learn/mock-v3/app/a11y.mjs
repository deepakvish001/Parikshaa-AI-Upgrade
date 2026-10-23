// Accessibility pass over every screen of the built mock: axe-core rules (WCAG 2.2 A/AA) and,
// on phone widths, tap targets under 40 x 40 px or under 24 px on any side. Prints one line per screen with problems and a summary.
// [ROLE=finance] [ROUTES=file] [VAR="aaj=b"] [IMPACT=serious] node a11y.mjs [w=1440] [theme=dark] [lang=en]
import { chromium } from "@playwright/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
const [w = "1440", theme = "dark", lang = "en"] = process.argv.slice(2);
const routes = (process.env.ROUTES ? readFileSync(process.env.ROUTES, "utf8") : [...readFileSync("src/screens/registry.ts", "utf8").matchAll(/s\(\{ id: "([a-z0-9-]+)"/g)].map((m) => m[1]).join(","))
  .trim()
  .split(",");
const levels = ["minor", "moderate", "serious", "critical"];
const floor = levels.indexOf(process.env.IMPACT || "serious");
const axe = readFileSync(resolve("../../../../node_modules/axe-core/axe.min.js"), "utf8");
const file = resolve("dist/preview.html");
const phone = +w < 600;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: +w, height: phone ? 844 : 900 }, colorScheme: theme, hasTouch: phone });
await ctx.addInitScript(([th, lg, rl, vr]) => { localStorage.setItem("pk4-theme", th); localStorage.setItem("pk3-lang", lg); localStorage.setItem("pk-mock-shots", "1"); if (rl) localStorage.setItem("pk3-role", rl); for (const kv of vr.split(",").filter(Boolean)) localStorage.setItem(`pk43-v-${kv.split("=")[0]}`, kv.split("=")[1]); }, [theme, lang, process.env.ROLE || "", process.env.VAR || ""]);
const p = await ctx.newPage();
const total = {};
let small = 0, bad = 0;
for (const r of routes) {
  await p.goto(`file://${file}#${r}`); await p.waitForTimeout(600);
  await p.addScriptTag({ content: axe });
  const res = await p.evaluate(async () => {
    // The mock's own "all screens" button and map chrome are not part of the product.
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] }, exclude: [[".mock-fab"], [".mock-bar"]] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 2).map((x) => x.target.join(" ")) }));
  });
  const hits = res.filter((v) => levels.indexOf(v.impact) >= floor);
  let tiny = [];
  if (phone) {
    tiny = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("button, a[href], [role=button], [role=tab], input, select, textarea, summary")) {
        if (el.closest(".mock-fab, .mock-bar, .cm-editor, .code, pre")) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight * 3) continue;
        const st = getComputedStyle(el);
        if (st.visibility === "hidden" || st.display === "none" || st.position === "fixed" && r.height === 0) continue;
        // Inline text links inside running text are exempt (WCAG 2.5.8).
        if (el.tagName === "A" && st.display === "inline" && el.parentElement && /P|LI|SPAN/.test(el.parentElement.tagName)) continue;
        // Our floor is 40 px on the short side for icon-sized controls, and nothing under 24 px (WCAG 2.5.8).
        const floor = el.matches(".check, .toggle, [role=checkbox], [role=switch]") ? 24 : 40;
        if ((r.height < floor && r.width < floor) || r.height < 24 || r.width < 24) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 20)}"`);
      }
      return out;
    });
    small += tiny.length;
  }
  for (const v of hits) total[v.id] = (total[v.id] || 0) + v.n;
  if (hits.length || tiny.length) {
    bad++;
    console.log(`${r}: ${hits.map((v) => `${v.id}(${v.impact[0]}×${v.n}) ${v.t.join(" , ")}`).join(" | ")}${tiny.length ? ` | small taps ${tiny.length}: ${tiny.slice(0, 4).join("; ")}` : ""}`);
  }
}
console.log(`${w} ${theme} ${lang}: ${routes.length} routes, ${bad} with issues, by rule: ${JSON.stringify(total)}${phone ? `, small taps ${small}` : ""}`);
await b.close();
