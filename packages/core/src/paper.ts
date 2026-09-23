import type { AttemptId, Exam, Question, QuestionId } from "./domain.js";

/**
 * Each candidate's paper.
 *
 * An exam's fixed questions go to everyone; each section contributes `pick`
 * questions drawn from its pool. The draw is seeded by the attempt id, so it is
 * deterministic: the same attempt always gets the same paper, and anyone with
 * the exam and the attempt id — an auditor, an appeals panel — can recompute
 * it. The draw is not meant to be unpredictable to staff, who can read the
 * exam anyway; it is meant to differ between neighbours in the hall.
 *
 * The result is also recorded in the attempt's first ledger entry, so the
 * record does not depend on this function never changing.
 */

/** Every question the exam could put on a paper. */
export function allQuestions(exam: Exam): readonly Question[] {
  return [...exam.questions, ...(exam.sections ?? []).flatMap((s) => s.pool)];
}

/** The question ids on this attempt's paper, in the order they are presented. */
export function resolvePaper(exam: Exam, attempt: AttemptId): readonly QuestionId[] {
  const drawn = (exam.sections ?? []).flatMap((section) => {
    const random = mulberry32(seed(`${attempt}\u0000${section.id}`));
    const pool = section.pool.map((q) => q.id);
    // A partial Fisher-Yates shuffle: the first `pick` slots end up a uniform
    // random selection, in random order.
    const take = Math.min(section.pick, pool.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(random() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool.slice(0, take);
  });
  return [...exam.questions.map((q) => q.id), ...drawn];
}

/**
 * The exam as one attempt sits it: its own questions and nothing else.
 *
 * Everything downstream of an attempt — what the candidate is shown, which
 * answers are accepted, scoring, probing — works from this, so a question in a
 * pool the candidate did not draw simply does not exist for them. Without a
 * recorded paper (a ledger from before sections existed) the exam's fixed
 * questions are the paper.
 */
export function paperOf(exam: Exam, questionIds: readonly QuestionId[] | undefined): Exam {
  const { sections: _, ...rest } = exam;
  if (questionIds === undefined) return rest;
  const byId = new Map(allQuestions(exam).map((q) => [q.id, q]));
  const questions = questionIds.flatMap((id) => {
    const question = byId.get(id);
    return question === undefined ? [] : [question];
  });
  return { ...rest, questions };
}

/** A 32-bit hash of a string (FNV-1a), to seed the draw. */
function seed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** A small, fast, seedable PRNG. Uniform enough for drawing questions; not for secrets. */
function mulberry32(state: number): () => number {
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One part of a sectioned exam as this attempt sits it: its questions, in order, and its own time. */
export interface PaperPart {
  /** null: the exam's fixed questions, which come before any section. */
  readonly sectionId: string | null;
  readonly title: string;
  readonly durationMs: number | null;
  readonly questionIds: readonly QuestionId[];
}

/**
 * Whether the exam is taken section by section (ROADMAP §3): when any
 * section has its own clock.
 */
export const isSequential = (exam: Exam): boolean => (exam.sections ?? []).some((s) => s.durationMs !== undefined);

/**
 * The parts of this attempt's paper, in the order they are taken: the fixed
 * questions (if any), then each section with the questions this attempt drew
 * from it. Null for an exam that is not sectioned by time.
 */
export function partsOf(exam: Exam, questionIds: readonly QuestionId[]): readonly PaperPart[] | null {
  if (!isSequential(exam)) return null;
  const onPaper = new Set(questionIds);
  const parts: PaperPart[] = [];
  const fixed = exam.questions.map((q) => q.id).filter((id) => onPaper.has(id));
  if (fixed.length > 0) parts.push({ sectionId: null, title: "General", durationMs: null, questionIds: fixed });
  for (const section of exam.sections ?? []) {
    const drawn = new Set(section.pool.map((q) => q.id));
    parts.push({
      sectionId: section.id,
      title: section.title,
      durationMs: section.durationMs ?? null,
      questionIds: questionIds.filter((id) => drawn.has(id)),
    });
  }
  return parts;
}
