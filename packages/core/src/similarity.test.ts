import { describe, expect, it } from "vitest";
import { fingerprintsOf, similarPairs, tokensOf } from "./similarity.js";

/** ROADMAP §4: how alike two candidates' code is, measured the way MOSS does. */

const ORIGINAL = `
def longest_run(values):
    # the longest stretch of equal neighbours
    best = 1
    current = 1
    for i in range(1, len(values)):
        if values[i] == values[i - 1]:
            current += 1
            best = max(best, current)
        else:
            current = 1
    return best

n = int(input())
print(longest_run(list(map(int, input().split()))))
`;

// The same program with every name changed, comments rewritten, and the layout moved about.
const DISGUISED = `
def solve(arr):
    ans=1; cnt=1   # counts
    for k in range(1,len(arr)):
        if arr[k]==arr[k-1]:
            cnt+=1
            ans=max(ans,cnt)
        else:
            cnt=1
    return ans
size = int(input())
print(solve(list(map(int, input().split()))))
`;

const DIFFERENT = `
import sys
data = sys.stdin.read().split()
nums = [int(x) for x in data[1:]]
runs = []
start = 0
while start < len(nums):
    end = start
    while end + 1 < len(nums) and nums[end + 1] == nums[start]:
        end += 1
    runs.append(end - start + 1)
    start = end + 1
print(max(runs) if runs else 0)
`;

describe("code similarity", () => {
  it("reads code the way a copier cannot disguise: names, strings, numbers and comments all even out", () => {
    expect(tokensOf('total = count + 42  # "sum"\nprint("hi")', "python")).toEqual(["v", "=", "v", "+", "n", "print", "(", "s", ")"]);
    expect(tokensOf("int s = 0; // s is the sum\n/* block */ s += 1;", "c")).toEqual(["int", "v", "=", "n", ";", "v", "+=", "n", ";"]);
  });

  it("finds a copy under new names, new comments and new layout", () => {
    const pairs = similarPairs([
      { key: "aarav", language: "python", source: ORIGINAL },
      { key: "diya", language: "python", source: DISGUISED },
      { key: "ishaan", language: "python", source: DIFFERENT },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: "aarav", b: "diya" });
    expect(pairs[0]!.similarity).toBeGreaterThanOrEqual(0.9);
  });

  it("does not count the starter code everyone was given", () => {
    const starter = "import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    n = int(data[0])\n    values = [int(x) for x in data[1:]]\n    # write your answer here\n\nmain()\n";
    const a = starter.replace("# write your answer here", "print(sum(values))");
    const b = starter.replace("# write your answer here", "print(max(values) - min(values))");
    expect(similarPairs([{ key: "a", language: "python", source: a }, { key: "b", language: "python", source: b }])).toHaveLength(1);
    expect(similarPairs([{ key: "a", language: "python", source: a }, { key: "b", language: "python", source: b }], starter)).toEqual([]);
  });

  it("leaves out answers too short to mean anything, and never compares two languages", () => {
    expect(fingerprintsOf("print(1)", "python").size).toBeLessThan(8);
    expect(similarPairs([{ key: "a", language: "python", source: "print(1)" }, { key: "b", language: "python", source: "print(1)" }])).toEqual([]);
    expect(
      similarPairs([
        { key: "a", language: "python", source: ORIGINAL },
        { key: "b", language: "javascript", source: ORIGINAL },
      ]),
    ).toEqual([]);
  });
});
