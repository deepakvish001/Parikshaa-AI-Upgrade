import type { Exam, Question } from "./domain.js";
import { allQuestions } from "./paper.js";

/**
 * Exam validation.
 *
 * An exam is written once and then sat by everyone, so a misconfiguration is
 * not a bug that affects one request — it affects a whole cohort, and usually
 * only becomes visible at grading, by which time the sitting is over. These
 * checks run before an exam is stored.
 */

export interface ExamProblem {
  /** Dotted path to the offending field, e.g. `questions.2.correctIndex`. */
  readonly path: string;
  readonly message: string;
}

export type ExamValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly problems: readonly ExamProblem[] };

/** Problems with one question, reported under `at` (e.g. `questions.2`). */
export function validateQuestion(question: Question, at: string): ExamProblem[] {
  const problems: ExamProblem[] = [];

  if (question.stem.trim() === "") {
    problems.push({ path: `${at}.stem`, message: "A question needs a stem." });
  }
  if (!Number.isFinite(question.maxScore) || question.maxScore <= 0) {
    problems.push({
      path: `${at}.maxScore`,
      message: "Marks must be greater than zero; a question worth nothing is never probed and never scored.",
    });
  }

  const weights = question.rubric.map((c) => c.weight);
  if (weights.some((w) => !Number.isFinite(w) || w <= 0)) {
    problems.push({ path: `${at}.rubric`, message: "Every rubric criterion needs a weight greater than zero." });
  }
  const criterionIds = new Set(question.rubric.map((c) => c.id));
  if (criterionIds.size !== question.rubric.length) {
    problems.push({ path: `${at}.rubric`, message: "Rubric criterion ids must be unique." });
  }

  switch (question.kind) {
    case "mcq": {
      if (question.options.length < 2) {
        problems.push({ path: `${at}.options`, message: "An mcq needs at least two options." });
      }
      if (
        !Number.isInteger(question.correctIndex) ||
        question.correctIndex < 0 ||
        question.correctIndex >= question.options.length
      ) {
        problems.push({
          path: `${at}.correctIndex`,
          message: "The correct answer must be one of the options.",
        });
      }
      break;
    }
    case "numeric": {
      if (!Number.isFinite(question.expected)) {
        problems.push({ path: `${at}.expected`, message: "A numeric question needs an expected value." });
      }
      if (!Number.isFinite(question.tolerance) || question.tolerance < 0) {
        problems.push({ path: `${at}.tolerance`, message: "Tolerance must be zero or greater." });
      }
      break;
    }
    case "short": {
      // Rubric-graded, so a rubric is what the grader has to work from.
      if (question.rubric.length === 0) {
        problems.push({
          path: `${at}.rubric`,
          message: "A short answer is graded against its rubric, so it needs at least one criterion.",
        });
      }
      break;
    }
    case "code": {
      if (question.language.trim() === "") {
        problems.push({ path: `${at}.language`, message: "A code question needs a language." });
      }
      if (question.rubric.length === 0) {
        problems.push({
          path: `${at}.rubric`,
          message: "A code answer is graded against its rubric, so it needs at least one criterion.",
        });
      }
      break;
    }
  }

  return problems;
}

export function validateExam(exam: Exam): ExamValidation {
  const problems: ExamProblem[] = [];

  if (exam.title.trim() === "") {
    problems.push({ path: "title", message: "An exam needs a title." });
  }
  const sections = exam.sections ?? [];
  if (exam.questions.length === 0 && sections.length === 0) {
    problems.push({ path: "questions", message: "An exam needs at least one question." });
  }

  const everything = allQuestions(exam);
  const ids = new Set(everything.map((q) => q.id));
  if (ids.size !== everything.length) {
    problems.push({
      path: "questions",
      message: "Question ids must be unique within an exam, across its fixed questions and every section's pool.",
    });
  }

  const sectionIds = new Set(sections.map((s) => s.id));
  if (sectionIds.size !== sections.length) {
    problems.push({ path: "sections", message: "Section ids must be unique within an exam." });
  }
  sections.forEach((section, index) => {
    const at = `sections.${index}`;
    if (section.title.trim() === "") problems.push({ path: `${at}.title`, message: "A section needs a title." });
    if (section.pool.length === 0) {
      problems.push({ path: `${at}.pool`, message: "A section needs at least one question to draw from." });
    } else if (!Number.isInteger(section.pick) || section.pick < 1 || section.pick > section.pool.length) {
      problems.push({
        path: `${at}.pick`,
        message: `Each candidate draws between 1 and ${section.pool.length} questions from this pool.`,
      });
    }
    // Candidates draw different questions, so a pool whose questions carry
    // different marks would give neighbours papers worth different totals.
    if (new Set(section.pool.map((q) => q.maxScore)).size > 1) {
      problems.push({
        path: `${at}.pool`,
        message: "Every question in a pool must carry the same marks, so every candidate's paper is worth the same.",
      });
    }
    section.pool.forEach((question, j) => problems.push(...validateQuestion(question, `${at}.pool.${j}`)));
  });

  const { durationMs, vivaTriggerRatio } = exam.policy;
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    problems.push({ path: "policy.durationMs", message: "Duration must be greater than zero." });
  }
  if (!Number.isFinite(vivaTriggerRatio) || vivaTriggerRatio < 0 || vivaTriggerRatio > 1) {
    problems.push({
      path: "policy.vivaTriggerRatio",
      message: "The viva trigger ratio is a fraction of a question's marks, so it must be between 0 and 1.",
    });
  }

  exam.questions.forEach((question, index) => {
    problems.push(...validateQuestion(question, `questions.${index}`));
  });

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
