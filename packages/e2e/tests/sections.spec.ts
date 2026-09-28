import { expect, test } from "@playwright/test";
import { beginSitting, MCQ, SHORT, seedSitting, submitAttempt } from "./support.js";

/** ROADMAP §3: a test taken section by section, each with its own clock, locked once left. */

test("a candidate takes a sectioned test in order, and a section once left stays shut", async ({ page, request }) => {
  const sitting = await seedSitting(request, {
    questions: [MCQ],
    sections: [{ id: "apt", title: "Aptitude", pick: 1, pool: [SHORT], durationMs: 10 * 60_000 }],
    vivaTriggerRatio: 0.99,
  });
  await beginSitting(page, sitting.links["CS001"]!);
  await expect(page.getByRole("heading", { name: sitting.title })).toBeVisible();

  const steps = page.getByRole("navigation", { name: "Sections" });
  await expect(steps.getByRole("listitem").filter({ hasText: "General" })).toHaveAttribute("aria-current", "step");
  await expect(page.getByText(SHORT.stem)).toBeHidden();
  await expect(page.getByRole("button", { name: "Submit attempt" })).toBeHidden();

  await page.getByRole("radio", { name: "Merge sort" }).check();
  await page.getByRole("button", { name: "Finish General and go on" }).click();
  await expect(page.getByText("You cannot come back to General once you leave it.")).toBeVisible();
  await page.getByRole("button", { name: "Leave General" }).click();

  const box = page.getByRole("textbox", { name: SHORT.stem });
  await expect(box).toBeVisible();
  await expect(page.getByRole("radio", { name: "Merge sort" })).toBeHidden();
  await expect(page.getByText(/\d+:\d\d left in this section/)).toHaveAttribute("role", "timer");

  // The server holds the line too: the left part can no longer be answered.
  const token = await page.evaluate(() => sessionStorage.getItem("parikshaa.attempt-token"));
  const refused = await request.post("/api/attempts/me/answers", {
    headers: { authorization: `Bearer ${token}` },
    data: { questionId: MCQ.id, answer: "0" },
  });
  expect(refused.status()).toBe(409);

  await box.fill("The interval halves every step, so it must become empty.");
  await submitAttempt(page);
  await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();

  const ledger = await request.get("/api/attempts/me/ledger", { headers: { authorization: `Bearer ${token}` } });
  const events = ((await ledger.json()).entries as { event: { type: string; response?: { questionId: string } } }[]).map((e) => e.event);
  const at = (match: (e: (typeof events)[number]) => boolean) => events.findIndex(match);
  const entered = at((e) => e.type === "section_started");
  // General's answer before Aptitude opened, Aptitude's after it, then the submission.
  expect(at((e) => e.type === "answer_submitted" && e.response?.questionId === MCQ.id)).toBeLessThan(entered);
  expect(at((e) => e.type === "answer_submitted" && e.response?.questionId === SHORT.id)).toBeGreaterThan(entered);
  expect(at((e) => e.type === "attempt_submitted")).toBeGreaterThan(entered);
});
