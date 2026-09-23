import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { OWNER } from "./support.js";

/** ROADMAP §3: a teacher's question paper, typed in Word, into the bank — seen first, then added. */

const SAMPLE = fileURLToPath(new URL("../../../docs/samples/question-paper.docx", import.meta.url));

test("a teacher uploads a Word question paper, checks what was found, and adds it to the bank", async ({ page }) => {
  await page.goto("/console/");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("navigation", { name: "Account" }).getByRole("button", { name: "Question bank" }).click();

  const word = page.getByRole("region", { name: "Import from Word" });
  await word.getByLabel("Word file (.docx)").setInputFiles(SAMPLE);

  const found = word.getByRole("table", { name: "Questions found" });
  await expect(found.getByRole("row")).toHaveCount(6); // the header and five questions
  await expect(found).toContainText("Which sorting algorithm is stable?");
  await expect(found).toContainText("Explain why binary search always terminates.");

  await word.getByRole("button", { name: "Add 5 questions to the bank" }).click();
  await expect(word.getByRole("status")).toHaveText("Imported 5 questions from the document.");
  await expect(page.getByRole("region", { name: "Question bank" })).toContainText("Which sorting algorithm is stable?");
});
