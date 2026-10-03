import { createHash } from "node:crypto";
import { questionId, type Question } from "@parikshaa/core";
import type { LibraryDraft } from "@parikshaa/store";
import { CS_FUNDAMENTALS } from "./content/cs-fundamentals.js";
import { DSA_STARTER } from "./content/dsa-starter.js";
import { DSA_BETTER, DSA_TEXT } from "./content/dsa-starter-text.js";
import { PLACEMENT_QUIZ } from "./content/placement-quiz.js";
import { SQL_STARTER } from "./content/sql-starter.js";
import { dsaEditorial, dsaQuestion, sqlQuestion } from "./starter-packs.js";

/**
 * What Parikshaa itself puts in the library (docs/F1-GO-LIVE-PLAN.md §4.2):
 * the content written for Parikshaa that is already in the repository, each
 * question with a stable id so filing it again changes only what changed.
 *
 * All of it is `open`: the same questions are in the practice sites' starter
 * packs, so learners may have seen them. Questions for hiring only (`hire`)
 * are written by the content team and filed by an operator.
 */

/** A short, stable id from a question's subject and words: the same question keeps it. */
const stableId = (prefix: string, ...parts: string[]) => `${prefix}-${createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 10)}`;

function csQuestions(): LibraryDraft[] {
  // The pack asks a few questions twice in one topic, worded a little
  // differently; the library keeps the first.
  const seen = new Set<string>();
  return CS_FUNDAMENTALS.subjects.flatMap((subject) =>
    subject.topics.flatMap((topic) =>
      topic.questions.flatMap((q): LibraryDraft[] => {
        const id = stableId("cs", subject.id, topic.id, q.title);
        if (seen.has(id)) return [];
        seen.add(id);
        return [{
          id,
          section: "cs",
          topic: subject.name,
          difficulty: q.difficulty,
          tags: ["computer science", topic.name.toLowerCase()],
          question: { id: questionId(id), kind: "mcq", stem: q.title, maxScore: 1, rubric: [], options: [...q.options], correctIndex: q.correct } as Question,
          explanation: q.answer,
          tier: "open",
          source: "parikshaa:cs-fundamentals",
        }];
      }),
    ),
  );
}

function conceptQuestions(): LibraryDraft[] {
  return PLACEMENT_QUIZ.map((q): LibraryDraft => {
    const id = `concepts-${q.id}`;
    return {
      id,
      section: "programming",
      topic: q.topic,
      difficulty: q.level,
      tags: ["concepts", q.topic.toLowerCase()],
      question: { id: questionId(id), kind: "mcq", stem: q.text, maxScore: 1, rubric: [], options: [...q.options], correctIndex: q.correct } as Question,
      explanation: q.why,
      tier: "open",
      source: "parikshaa:placement-quiz",
    };
  });
}

function dsaQuestions(): LibraryDraft[] {
  return DSA_STARTER.problems.map((p): LibraryDraft => {
    const id = `dsa-${p.slug}`;
    const text = DSA_TEXT[p.slug];
    return {
      id,
      section: "dsa",
      topic: p.tags[0] === undefined ? "DSA" : p.tags[0].replace(/\b\w/g, (c) => c.toUpperCase()),
      difficulty: p.difficulty,
      tags: ["coding", ...p.tags],
      question: { ...dsaQuestion(p), id: questionId(id) },
      explanation: dsaEditorial(p, text?.brute ?? "", DSA_BETTER[p.slug]),
      tier: "open",
      source: "parikshaa:dsa-starter",
    };
  });
}

function sqlQuestions(): LibraryDraft[] {
  return SQL_STARTER.problems.map((p): LibraryDraft => {
    const id = `sql-${p.slug}`;
    return {
      id,
      section: "sql",
      topic: "SQL",
      difficulty: p.difficulty,
      tags: ["sql", ...p.tags],
      question: { ...sqlQuestion(p), id: questionId(id) },
      explanation: p.editorial,
      tier: "open",
      source: "parikshaa:sql-starter",
    };
  });
}

/** Every built-in library question: CS fundamentals, programming concepts, DSA and SQL. */
export function builtInLibrary(): readonly LibraryDraft[] {
  return [...csQuestions(), ...conceptQuestions(), ...dsaQuestions(), ...sqlQuestions()];
}
