import { describe, expect, it } from "vitest";
import { approachesOf } from "./editorial.ts";

describe("an editorial's approaches", () => {
  it("splits brute force, better and optimal into their own parts", () => {
    const markdown = [
      "Find two numbers that add up to the target.",
      "",
      "## Brute force — O(n²)",
      "Try every pair.",
      "",
      "## Better: sort and two pointers",
      "Sort, then walk inwards.",
      "## Optimal (hash map)",
      "One pass with a map.",
      "### Complexity",
      "O(n) time.",
    ].join("\n");
    expect(approachesOf(markdown)).toEqual({
      intro: "Find two numbers that add up to the target.",
      approaches: [
        { title: "Brute force — O(n²)", body: "Try every pair." },
        { title: "Better: sort and two pointers", body: "Sort, then walk inwards." },
        { title: "Optimal (hash map)", body: "One pass with a map.\n### Complexity\nO(n) time." },
      ],
    });
  });

  it("leaves an editorial with one approach, or none, as it is", () => {
    expect(approachesOf("## Optimal\nUse a map.")).toBeNull();
    expect(approachesOf("## Idea\nUse a map.\n## Code\n...")).toBeNull();
  });
});
