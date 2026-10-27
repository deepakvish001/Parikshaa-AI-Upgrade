// Turns dist/index.html (with separate JS/CSS files) into two self-contained pages:
//   dist/preview.html   full document, for opening from disk and for screenshots
//   dist/artifact.html  body content only, for publishing as a claude.ai artifact
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = new URL("./dist/", import.meta.url).pathname;
const html = readFileSync(join(dist, "index.html"), "utf8");
const assets = join(dist, "assets");
const files = readdirSync(assets);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(assets, f), "utf8")).join("\n");
const safeJs = js.replace(/<\/script/gi, "<\\/script");
const safeCss = css.replace(/<\/style/gi, "<\\/style");

// favicon = the final logo (src/ui/kit.tsx LogoMark)
const icon = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 40 40%27%3E%3Crect width=%2740%27 height=%2740%27 rx=%2711%27 fill=%27%232349E6%27/%3E%3Cg fill=%27none%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%273.4%27%3E%3Cpath d=%27M16 30.5V9.5h6.2a6.1 6.1 0 0 1 0 12.2H16%27 stroke=%27%23fff%27/%3E%3Cpath d=%27M10.2 25.2 16 30.5%27 stroke=%27%23FFD84D%27/%3E%3C/g%3E%3C/svg%3E";
const head = `<title>Parikshaa Learn Mock</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="icon" href="${icon}">
<style>${safeCss}</style>`;
const body = `<div id="root"></div>
<script type="module">${safeJs}</script>`;

writeFileSync(join(dist, "artifact.html"), `${head}\n${body}\n`);
writeFileSync(
  join(dist, "preview.html"),
  `<!doctype html>\n<html lang="en-IN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);
const kb = (s) => Math.round(Buffer.byteLength(s) / 1024);
console.log(`artifact.html ${kb(head + body)} KB (css ${kb(css)} KB, js ${kb(js)} KB)`);
void html;
