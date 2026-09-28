import { expect, test } from "@playwright/test";
import { actions, local, onScreen, openQuestion, OWNER, ownerToken, seedSitting, submitAttempt } from "./support.js";
import { FIGURE_SERIES, uploadPicture } from "./pictures.js";

/**
 * An aptitude paper in a real browser: a figure to read, several right options
 * with negative marking, a passage shared by two questions, and the question
 * palette with a question marked for review.
 */
test("a candidate answers an aptitude paper from the palette, and negative marking is applied", async ({ page, browser, request }) => {
  const token = await ownerToken(request, OWNER);
  const figure = await uploadPicture(browser, request, token, FIGURE_SERIES);
  const passage = { id: "monsoon", title: "The monsoon", text: "The south-west monsoon reaches Kerala in early June.\nIt covers the whole country by mid-July." };
  const sitting = await seedSitting(request, {
    vivaTriggerRatio: 0.99,
    questions: [
      {
        id: "series",
        kind: "mcq",
        stem: "How many dots will the next square have?",
        maxScore: 2,
        rubric: [],
        options: ["4", "5", "6"],
        correctIndex: 1,
        negativeMarks: 0.5,
        images: [{ media: figure, alt: "Four squares with one, two, three and four dots" }],
      },
      {
        id: "primes",
        kind: "mcq",
        stem: "Which of these are prime?",
        maxScore: 4,
        rubric: [],
        options: ["2", "4", "5", "9"],
        correctIndex: 0,
        correctIndices: [0, 2],
        negativeMarks: 1,
      },
      { id: "arrive", kind: "mcq", stem: "When does the monsoon reach Kerala?", maxScore: 1, rubric: [], options: ["Early June", "Mid-July"], correctIndex: 0, passage },
      { id: "cover", kind: "mcq", stem: "By when does it cover the country?", maxScore: 1, rubric: [], options: ["Early June", "Mid-July"], correctIndex: 1, passage },
    ],
  });
  await page.goto(local(sitting.links["CS001"]!));

  const figureImage = page.getByRole("img", { name: "Four squares with one, two, three and four dots" });
  await expect(figureImage).toBeVisible();
  expect(await figureImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Wrong on the series (−0.5), both primes (+4), the passage right (+2).
  const question = onScreen(page);
  const save = actions(page).getByRole("button", { name: /^Save (& next|answer)$/ });
  await question.getByRole("radio", { name: "6" }).check();
  await save.click();
  await question.getByRole("checkbox", { name: "2" }).check();
  await question.getByRole("checkbox", { name: "5" }).check();
  await save.click();

  // The passage sits beside each question about it.
  await expect(page.getByRole("region", { name: "The monsoon", exact: true })).toContainText("Passage · Questions 3–4");
  await expect(page.getByText("It covers the whole country by mid-July.")).toHaveCount(1);

  const palette = page.getByRole("navigation", { name: "Questions" });
  await openQuestion(page, 4);
  await question.getByRole("button", { name: "Mark for review" }).click();
  await expect(palette.getByRole("button", { name: "Question 4: Not answered, Marked for review" })).toBeVisible();
  await expect(palette.getByRole("button", { name: "Question 3: Not answered" })).toBeVisible();
  await openQuestion(page, 3);
  await question.getByRole("radio", { name: "Early June" }).check();
  await save.click();
  await question.getByRole("radio", { name: "Mid-July" }).check();
  await save.click();
  await expect(palette.getByRole("button", { name: "Question 2: Answered" })).toBeVisible();
  await expect(palette.getByRole("button", { name: "Question 4: Answered, Marked for review" })).toBeVisible();

  await submitAttempt(page);
  await expect(page.getByRole("region", { name: "Your record" })).toBeVisible();

  const attempts = await (await request.get(`/api/exams/${sitting.examId}/attempts`, { headers: { authorization: `Bearer ${sitting.token}` } })).json();
  const attemptId = (attempts.attempts ?? attempts)[0].id as string;
  expect((await request.post(`/api/attempts/${attemptId}/grade`, { headers: { authorization: `Bearer ${sitting.token}` } })).status()).toBe(200);
  const results = await (await request.get(`/api/exams/${sitting.examId}/results`, { headers: { authorization: `Bearer ${sitting.token}` } })).json();
  expect(results.rows[0].total).toBe(5.5);
});
