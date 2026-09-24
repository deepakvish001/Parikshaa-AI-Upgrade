import type { APIRequestContext, Browser } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * A picture for a question, drawn in the browser from SVG and uploaded as a
 * PNG the way an author's would be: through POST /media, by its bytes.
 */
export async function uploadPicture(browser: Browser, request: APIRequestContext, token: string, svg: string): Promise<string> {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
  const png = await page.locator("svg").screenshot({ type: "png" });
  await page.close();
  const res = await request.post("/api/media", { headers: { authorization: `Bearer ${token}` }, data: { image: png.toString("base64") } });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).media as string;
}

/** Monthly sales of a small shop, as a bar chart: the kind of figure data interpretation asks about. */
export const SALES_CHART = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="300" viewBox="0 0 560 300" font-family="Arial, sans-serif">
  <rect width="560" height="300" fill="#fff"/>
  <text x="280" y="26" text-anchor="middle" font-size="16" font-weight="700" fill="#131a2e">Units sold, January–June</text>
  <g stroke="#e2e6ef">${[0, 1, 2, 3, 4].map((i) => `<line x1="60" x2="530" y1="${250 - i * 50}" y2="${250 - i * 50}"/>`).join("")}</g>
  <g font-size="12" fill="#5f687c" text-anchor="end">${[0, 50, 100, 150, 200].map((v, i) => `<text x="52" y="${254 - i * 50}">${v}</text>`).join("")}</g>
  <g fill="#3346c4">${[120, 90, 150, 180, 110, 160]
    .map((v, i) => `<rect x="${78 + i * 76}" y="${250 - v}" width="44" height="${v}" rx="4"/><text x="${100 + i * 76}" y="${244 - v}" text-anchor="middle" font-size="12" fill="#131a2e">${v}</text>`)
    .join("")}</g>
  <g font-size="13" fill="#373f52" text-anchor="middle">${["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m, i) => `<text x="${100 + i * 76}" y="272">${m}</text>`).join("")}</g>
</svg>`;

/** A figure series: each square has one more dot than the last. */
export const FIGURE_SERIES = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="150" viewBox="0 0 560 150">
  <rect width="560" height="150" fill="#fff"/>
  ${[1, 2, 3, 4]
    .map((n, i) => {
      const x = 20 + i * 130;
      const dots = Array.from({ length: n }, (_, d) => `<circle cx="${x + 25 + (d % 2) * 50}" cy="${45 + Math.floor(d / 2) * 50}" r="11" fill="#131a2e"/>`).join("");
      return `<rect x="${x}" y="20" width="100" height="100" rx="8" fill="none" stroke="#131a2e" stroke-width="3"/>${dots}`;
    })
    .join("")}
  <text x="545" y="80" font-family="Arial" font-size="40" fill="#f28c28" text-anchor="end">?</text>
</svg>`;
