import { CONTENT_LOCALES, type Exam, type Question } from "./domain.js";
import { CODE_LANGUAGES, languagesOf } from "./code.js";
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

const SHA256 = /^[0-9a-f]{64}$/;
/** At most this many pictures with one stem or passage. */
export const MAX_IMAGES = 6;

function validateImages(images: readonly { readonly media: string; readonly alt: string }[] | undefined, at: string): ExamProblem[] {
  if (images === undefined) return [];
  const problems: ExamProblem[] = [];
  if (images.length > MAX_IMAGES) problems.push({ path: at, message: `At most ${MAX_IMAGES} pictures.` });
  images.forEach((image, i) => {
    if (!SHA256.test(image.media)) problems.push({ path: `${at}.${i}.media`, message: "A picture is named by the SHA-256 it was uploaded under." });
    if (image.alt.trim() === "") {
      problems.push({ path: `${at}.${i}.alt`, message: "Say what the picture shows, for a candidate who cannot see it." });
    }
  });
  return problems;
}

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

  for (const [locale, t] of Object.entries(question.translations ?? {})) {
    const where = `${at}.translations.${locale}`;
    if (!(CONTENT_LOCALES as readonly string[]).includes(locale)) {
      problems.push({ path: where, message: `Not a language questions can be translated into: ${locale}.` });
      continue;
    }
    if (t === undefined) continue;
    if (t.stem.trim() === "") problems.push({ path: `${where}.stem`, message: "A translation needs its stem." });
    if (question.kind === "mcq") {
      if (t.options === undefined || t.options.length !== question.options.length) {
        problems.push({
          path: `${where}.options`,
          message: "A translated mcq needs every option, in the original's order: the answer is recorded by position.",
        });
      } else if (t.options.some((o) => o.trim() === "")) {
        problems.push({ path: `${where}.options`, message: "A translated option cannot be empty." });
      }
    } else if (t.options !== undefined) {
      problems.push({ path: `${where}.options`, message: "Only an mcq has options to translate." });
    }
  }

  problems.push(...validateImages(question.images, `${at}.images`));
  if (question.passage !== undefined) {
    if (question.passage.id.trim() === "") problems.push({ path: `${at}.passage.id`, message: "A passage needs an id, shared by its questions." });
    if (question.passage.text.trim() === "") problems.push({ path: `${at}.passage.text`, message: "A passage needs its text." });
    problems.push(...validateImages(question.passage.images, `${at}.passage.images`));
  }
  if ((question.kind === "mcq" || question.kind === "numeric") && question.negativeMarks !== undefined) {
    if (!Number.isFinite(question.negativeMarks) || question.negativeMarks < 0 || question.negativeMarks > question.maxScore) {
      problems.push({
        path: `${at}.negativeMarks`,
        message: "Negative marks are what a wrong answer loses: zero or more, and no more than the question is worth.",
      });
    }
  }

  switch (question.kind) {
    case "mcq": {
      if (question.options.length < 2) {
        problems.push({ path: `${at}.options`, message: "An mcq needs at least two options." });
      }
      if (question.correctIndices !== undefined && question.correctIndices.length > 0) {
        const all = question.correctIndices;
        if (all.some((i) => !Number.isInteger(i) || i < 0 || i >= question.options.length) || new Set(all).size !== all.length) {
          problems.push({ path: `${at}.correctIndices`, message: "Every right option must be one of the options, named once." });
        } else if (!all.includes(question.correctIndex)) {
          problems.push({ path: `${at}.correctIndex`, message: "With several right options, the correct index must be one of them." });
        }
      } else if (question.partialCredit === true) {
        problems.push({ path: `${at}.partialCredit`, message: "Partial credit needs more than one right option." });
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
      const tests = question.tests ?? [];
      for (const language of languagesOf(question)) {
        if (!(CODE_LANGUAGES as readonly string[]).includes(language)) {
          problems.push({
            path: `${at}.language`,
            message: `"${language}" cannot be run; offer one of ${CODE_LANGUAGES.join(", ")}.`,
          });
        }
      }
      if (question.languages !== undefined && question.languages.length > 0 && !question.languages.includes(question.language)) {
        problems.push({ path: `${at}.languages`, message: "The default language must be one of those offered." });
      }
      // Scored by its tests if it has any; otherwise a grader needs a rubric.
      if (tests.length === 0 && question.rubric.length === 0) {
        problems.push({
          path: `${at}.rubric`,
          message: "A code question is scored by its tests, or by a rubric if it has none; it needs one or the other.",
        });
      }
      if (new Set(tests.map((t) => t.id)).size !== tests.length) {
        problems.push({ path: `${at}.tests`, message: "Test ids must be unique within a question." });
      }
      tests.forEach((test, j) => {
        if (!Number.isFinite(test.weight) || test.weight <= 0) {
          problems.push({ path: `${at}.tests.${j}.weight`, message: "Every test needs a weight greater than zero." });
        }
      });
      if (tests.length > 0 && tests.every((t) => !t.hidden)) {
        problems.push({
          path: `${at}.tests`,
          message: "At least one test must be hidden; a candidate who has seen every test can print the answers.",
        });
      }
      const { timeMs, memoryMb } = question.limits ?? {};
      if (timeMs !== undefined && (!Number.isInteger(timeMs) || timeMs < 100 || timeMs > 10_000)) {
        problems.push({ path: `${at}.limits.timeMs`, message: "A time limit is 100 to 10,000 milliseconds per test." });
      }
      if (memoryMb !== undefined && (!Number.isInteger(memoryMb) || memoryMb < 32 || memoryMb > 1024)) {
        problems.push({ path: `${at}.limits.memoryMb`, message: "A memory limit is 32 to 1024 megabytes." });
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
    if (section.durationMs !== undefined && (!Number.isFinite(section.durationMs) || section.durationMs < 60_000)) {
      problems.push({ path: `${at}.durationMs`, message: "A section's own time must be at least a minute." });
    }
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
  const every = exam.policy.proctoring?.snapshotEverySeconds;
  if (every !== undefined && every !== null && (!Number.isInteger(every) || every < 15 || every > 900)) {
    problems.push({
      path: "policy.proctoring.snapshotEverySeconds",
      message: "Webcam photos are taken between every 15 seconds and every 15 minutes.",
    });
  }

  exam.questions.forEach((question, index) => {
    problems.push(...validateQuestion(question, `questions.${index}`));
  });

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
