import { describe, expect, it } from "vitest";
import { importQuestions, parseCsv } from "./bank-import.js";

describe("parseCsv", () => {
  it("handles quotes, embedded commas and newlines, doubled quotes, CRLF and a BOM", () => {
    const text = '﻿kind,question\r\nshort,"Explain ""why"", briefly,\nwith care"\r\nmcq,Plain\r\n\r\n';

    expect(parseCsv(text)).toEqual([
      ["kind", "question"],
      ["short", 'Explain "why", briefly,\nwith care'],
      ["mcq", "Plain"],
    ]);
  });
});

describe("importQuestions", () => {
  const header = "Kind,Question,Options,Answer,Marks,Topic,Difficulty,Tags,Tolerance,Rubric";

  it("reads every kind a spreadsheet can carry", () => {
    const result = importQuestions(
      [
        header,
        "mcq,Which sort is stable?,quicksort | mergesort | heapsort,B,2,sorting,easy,dsa|campus",
        "mcq,Pick heapsort,quicksort | mergesort | heapsort,heapsort,2,sorting,,",
        "numeric,What is 7 * 6?,,42,1,arithmetic,easy,,0.5,",
        "short,Why does merge sort take n log n?,,log n levels | n work per level,5,sorting,hard,,,Names the recursion depth | Names the work per level",
      ].join("\n"),
    );

    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    const [mcq, byText, numeric, short] = result.drafts;
    expect(mcq).toMatchObject({
      question: { kind: "mcq", correctIndex: 1, options: ["quicksort", "mergesort", "heapsort"], maxScore: 2 },
      topic: "sorting",
      difficulty: "easy",
      tags: ["dsa", "campus"],
    });
    expect(byText?.question).toMatchObject({ correctIndex: 2 });
    expect(byText?.difficulty).toBe("medium");
    expect(numeric?.question).toMatchObject({ kind: "numeric", expected: 42, tolerance: 0.5 });
    expect(short?.question).toMatchObject({
      kind: "short",
      expectedPoints: ["log n levels", "n work per level"],
      rubric: [
        { id: "c1", description: "Names the recursion depth", weight: 1 },
        { id: "c2", description: "Names the work per level", weight: 1 },
      ],
    });
  });

  it("reads negative marks, several right options and partial credit", () => {
    const result = importQuestions(
      [
        "kind,question,options,answer,marks,negative,partial",
        'mcq,Which are prime?,2|4|5|9,"A, C",4,1,yes',
        "mcq,Capital of India?,Mumbai|New Delhi,New Delhi,2,-0.5,",
        "numeric,7 × 8?,,56,1,0.25,",
      ].join("\n"),
    );
    if (!result.ok) throw new Error(JSON.stringify(result.problems));
    expect(result.drafts.map((d) => d.question)).toMatchObject([
      { correctIndex: 0, correctIndices: [0, 2], partialCredit: true, negativeMarks: 1 },
      { correctIndex: 1, negativeMarks: 0.5 },
      { kind: "numeric", negativeMarks: 0.25 },
    ]);
    expect(result.drafts[1]!.question).not.toHaveProperty("correctIndices");
  });

  it("uses the expected points as the rubric when none is given", () => {
    const result = importQuestions("kind,question,answer\nshort,Why?,Because A | Because B");
    if (!result.ok) throw new Error("expected ok");
    expect(result.drafts[0]?.question.rubric.map((c) => c.description)).toEqual(["Because A", "Because B"]);
  });

  it("reports every bad row, by the number a spreadsheet shows, and imports nothing", () => {
    const result = importQuestions(
      [
        "kind,question,options,answer,marks,difficulty",
        "mcq,Fine,a | b,A,1,easy",
        "mcq,Bad answer,a | b,C,1,easy",
        "numeric,Bad value,,forty-two,1,easy",
        "essay,Unknown kind,,,1,easy",
        "mcq,,a | b,A,1,easy",
        "mcq,Bad difficulty,a | b,A,1,extreme",
        "code,Write a function,,,5,hard",
      ].join("\n"),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((p) => p.row)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(result.problems[0]?.message).toMatch(/not one of the options/);
    expect(result.problems[3]?.message).toMatch(/stem/);
    expect(result.problems[4]?.message).toMatch(/Difficulty/);
    expect(result.problems[5]?.message).toMatch(/console/);
  });

  it("needs a header naming the kind and the question", () => {
    const result = importQuestions("type,text\nmcq,Which?");
    expect(result).toMatchObject({ ok: false, problems: [{ row: 1 }] });
  });
});
