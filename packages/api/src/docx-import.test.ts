import { readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { importDocx } from "./docx-import.js";
import { docxOf } from "./testing/docx.js";

/** ROADMAP §3: questions from a Word document, typed the way a paper is. */

const PAPER = [
  { text: "Campus Drive 2026 — Aptitude", bold: true },
  "Instructions: answer all questions.",
  "",
  "1. Which sorting algorithm is stable?",
  "a) Heap sort",
  "b) Merge sort",
  "c) Quick sort",
  "Answer: b",
  "Marks: 2",
  "Topic: Sorting",
  "Difficulty: easy",
  "Tags: algorithms, campus",
  "",
  "Q2. A train covers 120 km in 2 hours.",
  "What is its speed in km/h?",
  "Ans: 60",
  "Tolerance: 0.5",
  "",
  "3) Explain why binary search terminates.",
  "Answer: the interval halves each step; it must become empty",
  "Marks: 5 marks",
  "Difficulty: hard",
];

describe("importing a Word document", () => {
  it("reads numbered questions, lettered options and the fields after them", () => {
    const result = importDocx(docxOf(PAPER));
    if (!result.ok) throw new Error(JSON.stringify(result.problems));

    expect(result.drafts).toEqual([
      {
        question: { kind: "mcq", stem: "Which sorting algorithm is stable?", maxScore: 2, rubric: [], options: ["Heap sort", "Merge sort", "Quick sort"], correctIndex: 1 },
        topic: "Sorting",
        difficulty: "easy",
        tags: ["algorithms", "campus"],
      },
      {
        question: { kind: "numeric", stem: "A train covers 120 km in 2 hours.\nWhat is its speed in km/h?", maxScore: 1, rubric: [], expected: 60, tolerance: 0.5 },
        topic: "",
        difficulty: "medium",
        tags: [],
      },
      {
        question: {
          kind: "short",
          stem: "Explain why binary search terminates.",
          maxScore: 5,
          rubric: [
            { id: "c1", description: "the interval halves each step", weight: 1 },
            { id: "c2", description: "it must become empty", weight: 1 },
          ],
          expectedPoints: ["the interval halves each step", "it must become empty"],
        },
        topic: "",
        difficulty: "hard",
        tags: [],
      },
    ]);
    expect(result.preview.map((p) => [p.question, p.kind, p.marks])).toEqual([
      [1, "mcq", 2],
      [2, "numeric", 1],
      [3, "short", 5],
    ]);
  });

  it("reads Word's own numbered lists, where the numbers are not in the text, and an option marked with *", () => {
    const result = importDocx(
      docxOf([
        { text: "Which of these is a prime?", list: 0 },
        { text: "21", list: 1 },
        { text: "*23", list: 1 },
        { text: "25", list: 1 },
        { text: "What is 2 + 2?", list: 0 },
        "Answer: 4",
        "Type: short",
      ]),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.drafts[0]!.question).toMatchObject({ kind: "mcq", options: ["21", "23", "25"], correctIndex: 1 });
    // "Type:" overrides the guess from a numeric answer.
    expect(result.drafts[1]!.question).toMatchObject({ kind: "short", expectedPoints: ["4"] });
  });

  it("reads a document written by a word processor, with numbering from list styles and runs split mid-sentence", () => {
    const result = importDocx(readFileSync(new URL("./testing/fixtures/word-styled-lists.docx", import.meta.url)));
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.drafts.map((d) => d.question)).toEqual([
      expect.objectContaining({ kind: "mcq", stem: "Which gas do plants take in?", options: ["Oxygen", "Carbon dioxide", "Nitrogen"], correctIndex: 1 }),
      expect.objectContaining({ kind: "numeric", stem: "What is the boiling point of water at sea level, in °C?", expected: 100, maxScore: 2 }),
    ]);
  });

  it("imports the sample paper in docs/samples, which institutions copy", () => {
    const result = importDocx(readFileSync(new URL("../../../docs/samples/question-paper.docx", import.meta.url)));
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.preview.map((p) => p.kind)).toEqual(["mcq", "numeric", "mcq", "short", "numeric"]);
  });

  it("does not mistake a number or a word in the text for a new question or a field", () => {
    const result = importDocx(
      docxOf(["1. Round this value:", "3.14 is close to pi.", "Type-casting is not involved here.", "Answer: 3", "Type: numeric"]),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0]!.question.stem).toBe("Round this value:\n3.14 is close to pi.\nType-casting is not involved here.");
  });

  it("numbers problems from the top of the document, since sections often restart their numbering", () => {
    const result = importDocx(
      docxOf([
        "Section A",
        "1. Pick one.",
        "a) x",
        "b) y",
        "Answer: b",
        "Section B",
        "1. Pick another.",
        "a) x",
        "b) y",
        "Answer: e",
        "2. Explain.",
        "3. Explain again.",
        "Answer: because",
        "a stray line after the fields",
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toEqual([
      // "Section B" between the questions is a heading, not a mistake.
      { question: 2, written: 1, message: expect.stringContaining('The answer "e" is not one of the options') },
      { question: 3, written: 2, message: 'No answer: add an "Answer:" line.' },
      { question: 4, written: 3, message: expect.stringContaining('"a stray line after the fields" comes after the options') },
    ]);
  });

  it("imports the text of a question with a picture, and says the picture was left out", () => {
    const result = importDocx(docxOf([{ text: "1. What does the diagram show?", picture: true }, "Answer: a tree"]));
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.preview[0]!.note).toMatch(/picture or equation, which was not imported/);
  });

  it("explains a file that is not a .docx, or that has no questions in it", () => {
    const notZip = importDocx(strToU8("kind,question\nmcq,hello"));
    expect(notZip).toEqual({ ok: false, problems: [{ question: 0, written: null, message: expect.stringContaining("not a Word (.docx) file") }] });
    const noDocument = importDocx(zipSync({ "hello.txt": strToU8("hi") }));
    expect(noDocument.ok).toBe(false);
    const empty = importDocx(docxOf(["Just a title", "and some instructions"]));
    expect(empty).toEqual({ ok: false, problems: [{ question: 0, written: null, message: expect.stringContaining("No questions found") }] });
  });
});
