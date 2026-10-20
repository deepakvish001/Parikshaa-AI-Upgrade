// Screenshots of the built mock: [ROLE=finance] node shots.mjs <outDir> <route[,route]> [w=1440,390] [theme=dark] [lang=en]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [outDir = "shots", routesArg = "map", widthsArg = "1440,390", theme = "dark", lang = "en", full = "full"] = process.argv.slice(2);
const file = resolve(new URL(".", import.meta.url).pathname, "dist/preview.html");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
for (const w of widthsArg.split(",").map(Number)) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 }, deviceScaleFactor: w < 600 ? 2 : 1, colorScheme: theme });
  await ctx.addInitScript(([th, lg, rl]) => {
    localStorage.setItem("pk4-theme", th);
    localStorage.setItem("pk3-lang", lg);
    localStorage.setItem("pk-mock-shots", "1");
    if (rl) localStorage.setItem("pk3-role", rl);
  }, [theme, lang, process.env.ROLE || ""]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const route of routesArg.split(",")) {
    await page.goto(`file://${file}#${route}`);
    await page.waitForTimeout(1600);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const name = `${outDir}/${route}-${w}-${theme}${lang === "en" ? "" : `-${lang}`}.jpg`;
    await page.screenshot({ path: name, fullPage: full === "full", type: "jpeg", quality: Number(process.env.Q || 82) });
    console.log(`${name}${overflow > 0 ? `  OVERFLOW ${overflow}px` : ""}`);
  }
  if (errors.length) console.log("ERRORS:", errors.join("\n"));
  await ctx.close();
}
await browser.close();
