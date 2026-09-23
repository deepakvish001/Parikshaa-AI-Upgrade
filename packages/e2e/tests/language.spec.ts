import { expect, test } from "@playwright/test";
import { local, MCQ, SHORT, seedSitting } from "./support.js";

/** ROADMAP §9, in a real browser: a sitting in Hindi, in low-bandwidth mode. */

const HINDI_MCQ = { ...MCQ, translations: { hi: { stem: "कौन सा सॉर्ट स्थिर है?", options: ["हीप सॉर्ट", "मर्ज सॉर्ट"] } } };

test("a candidate reads the exam in Hindi on a slow connection: compressed, and no stream held open", async ({ page, request }) => {
  const sitting = await seedSitting(request, { questions: [HINDI_MCQ, SHORT] });
  await page.addInitScript(() => {
    localStorage.setItem("parikshaa.language", "hi");
    localStorage.setItem("parikshaa.lite", "1");
  });
  const encodings: string[] = [];
  page.on("response", (r) => {
    // The client bundle is most of what a 2G connection waits for; small API replies are left alone.
    if (/\/assets\/.*\.js$/.test(r.url())) encodings.push(r.headers()["content-encoding"] ?? "none");
  });
  const probes: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/attempts/me/probe")) probes.push(new URL(r.url()).search);
  });

  await page.goto(local(sitting.links["CS001"]!));
  await expect(page.getByRole("heading", { name: /कौन सा सॉर्ट स्थिर है\?/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.lang)).toBe("hi");
  expect(encodings.length).toBeGreaterThan(0);
  for (const e of encodings) expect(e).toMatch(/^(br|gzip)$/);

  await page.getByRole("radio", { name: "मर्ज सॉर्ट" }).check();
  await page.getByRole("button", { name: "उत्तर सहेजें" }).first().click();
  const probe = page.getByRole("region", { name: "अनुवर्ती प्रश्न" });
  await expect(probe).toContainText("Walk me through");
  expect(probes).toEqual(["?stream=0"]);
});
