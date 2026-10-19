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

const head = `<title>Parikshaa Learn Mock</title>
<meta name="claude:viewport-fit-sides" content="cover">
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
