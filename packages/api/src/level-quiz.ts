import { PLACEMENT_QUIZ, PLACEMENT_SHAPE, placementLevel, type PlacementQuestion } from "./content/placement-quiz.js";
import { PracticeError } from "./practice.js";

/**
 * The placement quiz (Prep blueprint S2, F1): eight of the forty questions,
 * in the quiz's shape, without their answers; and the marking of what comes
 * back. Nothing is stored: the level it suggests is the learner's to take or
 * leave when they plan.
 */

export const PLACEMENT_LENGTH = PLACEMENT_SHAPE.easy + PLACEMENT_SHAPE.medium + PLACEMENT_SHAPE.hard;

/** A fresh draw, easy questions first. */
export function drawPlacement(random: () => number = Math.random) {
  const pick = (level: PlacementQuestion["level"], n: number) => {
    const pool = PLACEMENT_QUIZ.filter((q) => q.level === level);
    const out: PlacementQuestion[] = [];
    while (out.length < n) {
      const q = pool.splice(Math.floor(random() * pool.length), 1)[0]!;
      out.push(q);
    }
    return out;
  };
  return [...pick("easy", PLACEMENT_SHAPE.easy), ...pick("medium", PLACEMENT_SHAPE.medium), ...pick("hard", PLACEMENT_SHAPE.hard)].map(({ id, level, topic, text, options }) => ({ id, level, topic, text, options }));
}

/** Mark eight answers, one to each of eight different questions. */
export function markPlacement(answers: readonly { readonly id: string; readonly choice: number }[]) {
  const byId = new Map(PLACEMENT_QUIZ.map((q) => [q.id, q]));
  if (answers.length !== PLACEMENT_LENGTH || new Set(answers.map((a) => a.id)).size !== answers.length || answers.some((a) => !byId.has(a.id))) {
    throw new PracticeError("invalid", `Answer the ${PLACEMENT_LENGTH} questions of one quiz`);
  }
  const results = answers.map((a) => {
    const q = byId.get(a.id)!;
    return { id: q.id, choice: a.choice, correct: q.correct, right: a.choice === q.correct, why: q.why };
  });
  const score = results.filter((r) => r.right).length;
  return { score, of: PLACEMENT_LENGTH, level: placementLevel(score), results };
}
