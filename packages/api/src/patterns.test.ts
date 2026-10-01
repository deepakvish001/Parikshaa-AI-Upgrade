import { describe, expect, it } from "vitest";
import { patternCounts, patternsOf } from "./patterns.js";

describe("patterns", () => {
  it("read the idea behind an author's tags, however they are written, and leave out the rest", () => {
    expect(patternsOf(["Sliding Window", "two_pointers", "arrays"])).toEqual(["Two pointers", "Sliding window"]);
    expect(patternsOf(["Fenwick tree", "difference array"])).toEqual(["Prefix sums"]);
    expect(patternsOf(["kadane", "DP"])).toEqual(["Dynamic programming"]);
    expect(patternsOf(["priority queue"])).toEqual(["Heaps"]);
    // A word inside another is not the word.
    expect(patternsOf(["windowing", "dpx", "prefix maximum"])).toEqual([]);
  });

  it("are counted across problems, most common first, with what the learner solved", () => {
    const problems = [
      { id: "a", tags: ["dp"] },
      { id: "b", tags: ["dynamic programming", "greedy"] },
      { id: "c", tags: ["greedy"] },
      { id: "d", tags: ["dp"] },
    ];
    expect(patternCounts(problems, new Set(["b", "c"]))).toEqual([
      { pattern: "Dynamic programming", problems: 3, solved: 1 },
      { pattern: "Greedy", problems: 2, solved: 2 },
    ]);
  });
});
