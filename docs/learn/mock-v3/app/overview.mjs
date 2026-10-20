// Builds ../screens/overview.jpg from ../screens/desktop/*-1440-light.jpg: node overview.mjs
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
const routes = (process.env.ROUTES ? readFileSync(process.env.ROUTES, "utf8") : [...readFileSync("src/screens/registry.ts", "utf8").matchAll(/s\(\{ id: "([a-z0-9-]+)"/g)].map((m) => m[1]).join(","))
  .trim()
  .split(",");
const dir = resolve("../screens/desktop");
const groups = [["Learner", routes.filter((r) => !r.startsWith("adm") && r !== "admin" && r !== "admin-login")], ["Admin", routes.filter((r) => r.startsWith("adm") || r === "admin" || r === "admin-login")]];
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#F4F2EC;font:14px/1.4 system-ui,sans-serif;color:#1b1c20;padding:28px}
h1{font:600 26px/1.2 Georgia,serif;margin:0 0 4px} p{margin:0 0 20px;color:#555}
h2{font:600 15px system-ui;margin:22px 0 10px;letter-spacing:.04em;text-transform:uppercase;color:#2346E8}
.g{display:grid;grid-template-columns:repeat(8,1fr);gap:12px}
figure{margin:0;background:#fff;border:1px solid #e3dfd6;border-radius:8px;overflow:hidden}
img{display:block;width:100%;aspect-ratio:1440/900;object-fit:cover;object-position:top}
figcaption{padding:5px 8px;font:12px ui-monospace,monospace;color:#555}
</style><h1>Parikshaa Learn · mock v3 “Kaagaz aur Blackboard”</h1><p>${routes.length} screens · 1440 px · light theme · sample data</p>
${groups.map(([g, rs]) => `<h2>${g} · ${rs.length}</h2><div class="g">${rs.map((r) => `<figure><img src="file://${dir}/${r}-1440-light.jpg"><figcaption>#${r}</figcaption></figure>`).join("")}</div>`).join("")}`;
const tmp = join(tmpdir(), "pk3-overview.html");
writeFileSync(tmp, html);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 2000, height: 1000 } });
await p.goto(`file://${tmp}`); await p.waitForTimeout(1500);
await p.screenshot({ path: resolve("../screens/overview.jpg"), fullPage: true, type: "jpeg", quality: 72 });
await b.close();
