import { describe, expect, it } from "vitest";
import { accepts, near, splitResult } from "./judge.js";

describe("checkers", () => {
  it("exact forgives line endings and trailing space, nothing else", () => {
    expect(accepts({ kind: "exact" }, "1 2\n3", "1 2  \r\n3\n\n")).toBe(true);
    expect(accepts({ kind: "exact" }, "1 2\n3", "1  2\n3")).toBe(false);
  });

  it("tokens forgives any spacing", () => {
    expect(accepts({ kind: "tokens" }, "1 2\n3", "1\n2 3")).toBe(true);
    expect(accepts({ kind: "tokens" }, "1 2 3", "1 2")).toBe(false);
  });

  it("numbers compares numbers within tolerance and words exactly", () => {
    const checker = { kind: "numbers", tolerance: 1e-6 } as const;
    expect(accepts(checker, "YES 0.333333", "YES 0.3333334")).toBe(true);
    expect(accepts(checker, "YES 0.333333", "yes 0.333333")).toBe(false);
    expect(accepts(checker, "1000000", "1000000.5")).toBe(true); // relative
    expect(accepts(checker, "1", "1.01")).toBe(false);
  });

  it("unordered compares lines as a multiset", () => {
    expect(accepts({ kind: "unordered" }, "a\nb\nb", "b\na\nb")).toBe(true);
    expect(accepts({ kind: "unordered" }, "a\nb\nb", "a\na\nb")).toBe(false);
  });

  it("json compares values, not formatting", () => {
    const strict = { kind: "json", tolerance: 1e-5, unordered: "none" } as const;
    expect(accepts(strict, "[1,2,3]", "[1, 2, 3]")).toBe(true);
    expect(accepts(strict, "[1,2,3]", "[3,2,1]")).toBe(false);
    expect(accepts(strict, "2.5", "2.500001")).toBe(true);
    expect(accepts(strict, '"abc"', '"abd"')).toBe(false);
    expect(accepts(strict, "true", "1")).toBe(false);
    expect(accepts(strict, "[1]", "not json")).toBe(false);
  });

  it("json in any order: top level only, or all the way down", () => {
    const top = { kind: "json", tolerance: 0, unordered: "top" } as const;
    const deep = { kind: "json", tolerance: 0, unordered: "deep" } as const;
    expect(accepts(top, "[[1,2],[3]]", "[[3],[1,2]]")).toBe(true);
    expect(accepts(top, "[[1,2],[3]]", "[[3],[2,1]]")).toBe(false);
    expect(accepts(deep, "[[1,2],[3]]", "[[3],[2,1]]")).toBe(true);
    expect(accepts(deep, '[["eat","tea"],["bat"]]', '[["bat"],["tea","eat"]]')).toBe(true);
    expect(accepts(deep, "[1,1,2]", "[1,2,2]")).toBe(false);
  });

  it("near is absolute or relative", () => {
    expect(near(0, 1e-7, 1e-6)).toBe(true);
    expect(near(1e9, 1e9 + 100, 1e-6)).toBe(true);
    expect(near(1, 2, 1e-6)).toBe(false);
    expect(near(Number.NaN, Number.NaN, 1)).toBe(false);
  });
});

describe("the result marker", () => {
  it("splits what the program printed from what it returned", () => {
    expect(splitResult("hello\nworld\n\u001eR[1,2]\n", "\u001eR")).toEqual({ printed: "hello\nworld", result: "[1,2]" });
    expect(splitResult("no result here", "\u001eR")).toEqual({ printed: "no result here", result: null });
  });

  it("trusts only the last marker, so a program cannot print a result of its own first", () => {
    expect(splitResult("\u001eR42\n\u001eR[1]\n", "\u001eR").result).toBe("[1]");
  });
});
