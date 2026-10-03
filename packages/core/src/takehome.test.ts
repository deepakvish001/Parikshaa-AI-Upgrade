import { describe, expect, it } from "vitest";
import { questionId, type ShortQuestion } from "./domain.js";
import { candidateView } from "./candidate-view.js";
import { needsRubricGrading, scoreDeterministic } from "./scoring.js";
import { decodeTakeHomeAnswer, encodeTakeHomeAnswer, validTakeHomeLink } from "./takehome.js";

/** Plan row 88: a take-home, answered with a link and notes, marked by a person. */

const takeHome: ShortQuestion = {
  id: questionId("th"),
  kind: "short",
  stem: "Build a URL shortener.",
  maxScore: 20,
  rubric: [{ id: "r1", description: "Works end to end", weight: 1 }],
  expectedPoints: [],
  takeHome: true,
};

describe("a take-home", () => {
  it("is never sent to a model: it scores 0 until a person marks it", () => {
    expect(needsRubricGrading(takeHome)).toBe(false);
    expect(scoreDeterministic(takeHome, encodeTakeHomeAnswer({ link: "https://github.com/a/b", notes: "" }))).toMatchObject({ score: 0, method: "person" });
    // An ordinary short answer still goes to the rubric grader.
    const { takeHome: _, ...short } = takeHome;
    expect(needsRubricGrading(short)).toBe(true);
    expect(scoreDeterministic(short, "text")).toBeNull();
  });

  it("tells the candidate it is a take-home", () => {
    const view = candidateView({ id: "e" as never, title: "t", questions: [takeHome], policy: { durationMs: 60_000, allowRevision: true, vivaTriggerRatio: 1 } });
    expect(view.questions[0]).toMatchObject({ kind: "short", takeHome: true });
  });

  it("takes an https link with a host, and notes", () => {
    expect(validTakeHomeLink("https://github.com/ananya/shortener")).toBe(true);
    for (const bad of ["http://github.com/a", "github.com/a", "https://localhost/x", "javascript:alert(1)", `https://x.com/${"a".repeat(600)}`]) expect(validTakeHomeLink(bad), bad).toBe(false);
    const stored = encodeTakeHomeAnswer({ link: " https://gitlab.com/a/b ", notes: "Run make" });
    expect(decodeTakeHomeAnswer(stored)).toEqual({ link: "https://gitlab.com/a/b", notes: "Run make" });
    expect(decodeTakeHomeAnswer("plain text")).toBeNull();
  });
});
