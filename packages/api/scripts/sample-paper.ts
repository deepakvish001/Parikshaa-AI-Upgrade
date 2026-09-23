import { writeFileSync } from "node:fs";
import { docxOf } from "../src/testing/docx.js";

/**
 * Writes docs/samples/question-paper.docx: a question paper in the format the
 * Word import reads, for institutions to copy. `docx-import.test.ts` imports
 * the committed file, so it cannot drift from what the importer accepts.
 *
 *   npx vite-node packages/api/scripts/sample-paper.ts
 */
const paper = [
  { text: "Campus Drive — Aptitude and Programming (sample paper for Parikshaa)", bold: true },
  "How to write a paper Parikshaa can import: number each question, letter its options, and put the answer on its own line. Lines before the first question, like these, are skipped.",
  "",
  "Section A",
  "1. Which sorting algorithm is stable?",
  "a) Heap sort",
  "b) Merge sort",
  "c) Quick sort",
  "d) Selection sort",
  "Answer: b",
  "Marks: 2",
  "Topic: Sorting",
  "Difficulty: easy",
  "Tags: algorithms, campus",
  "",
  "2. A train covers 120 km in 2 hours. What is its speed in km/h?",
  "Answer: 60",
  "Marks: 2",
  "Topic: Quant",
  "",
  "3. Which data structure gives constant-time lookup by key, on average?",
  "a) Linked list",
  "*b) Hash table",
  "c) Binary heap",
  "Marks: 2",
  "Topic: Data structures",
  "",
  "Section B",
  "1. Explain why binary search always terminates.",
  "Answer: the search interval halves each step | it eventually becomes empty",
  "Marks: 5",
  "Topic: Searching",
  "Difficulty: medium",
  "",
  "2. What is 17 × 3?",
  "Answer: 51",
  "Marks: 1",
  "Topic: Quant",
];

writeFileSync(new URL("../../../docs/samples/question-paper.docx", import.meta.url), docxOf(paper));
