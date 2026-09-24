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

  it("imports the text of a question with a drawing it cannot take, and says what was left out", () => {
    const result = importDocx(docxOf([{ text: "1. What does the diagram show?", picture: true }, "Answer: a tree"]));
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.preview[0]!.note).toMatch(/equation, a chart or a picture that is not PNG, JPEG, GIF or WebP, which was not imported/);
  });

  it("takes the pictures pasted into a question, with Word's alt text, ready to be stored by their hash", () => {
    const figure = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("figure series")]);
    const result = importDocx(
      docxOf([
        "1. Which figure comes next in the series?",
        { text: "", picture: figure, alt: "Four squares, each with one more dot" },
        "a) Five dots",
        "b) Six dots",
        "Answer: a",
      ]),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    const [image] = result.drafts[0]!.question.images!;
    expect(image!.alt).toBe("Four squares, each with one more dot");
    expect(Buffer.compare(Buffer.from(result.pictures.get(image!.media)!), figure)).toBe(0);
    expect(result.preview[0]).toMatchObject({ pictures: 1, note: null });
  });

  it("reads a passage and gives it to each question after it, until the passage ends", () => {
    const result = importDocx(
      docxOf([
        "Passage 1: The monsoon",
        "The south-west monsoon reaches Kerala in early June and covers the country by mid-July.",
        "It brings most of India's rain.",
        "1. When does the monsoon reach Kerala?",
        "a) Early June",
        "b) Mid-July",
        "Answer: a",
        "2. By when does it cover the country?",
        "Answer: mid-July",
        "End of passage",
        "3. What is 2 + 2?",
        "Answer: 4",
      ]),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    const [first, second, third] = result.drafts.map((d) => d.question);
    expect(first!.passage).toEqual({
      id: "docx-passage-1",
      title: "The monsoon",
      text: "The south-west monsoon reaches Kerala in early June and covers the country by mid-July.\nIt brings most of India's rain.",
    });
    expect(second!.passage).toEqual(first!.passage);
    expect(third!.passage).toBeUndefined();
    expect(result.preview.map((p) => p.passage)).toEqual(["The monsoon", "The monsoon", null]);
  });

  it("reads negative marks, and several right answers written out or marked with *", () => {
    const result = importDocx(
      docxOf([
        "1. Which of these are prime?",
        "a) 2",
        "b) 4",
        "c) 5",
        "Answer: a, c",
        "Negative: 1",
        "Partial: yes",
        "2. Which are even?",
        "*a) 2",
        "*b) 4",
        "c) 5",
        "3. What is 7 × 8?",
        "Answer: 56",
        "Negative marks: 0.25",
      ]),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.drafts[0]!.question).toMatchObject({ correctIndex: 0, correctIndices: [0, 2], partialCredit: true, negativeMarks: 1 });
    expect(result.drafts[1]!.question).toMatchObject({ correctIndices: [0, 1] });
    expect(result.drafts[2]!.question).toMatchObject({ kind: "numeric", negativeMarks: 0.25 });
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
