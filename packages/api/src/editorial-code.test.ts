import { describe, expect, it } from "vitest";
import { editorialPrograms } from "./editorial-code.js";

describe("an editorial's programs", () => {
  it("are its fenced blocks in the problem's languages, unless marked no-check", () => {
    const md = [
      "## Brute force",
      "```py",
      "print(1)",
      "```",
      "A fragment:",
      "```python no-check",
      "lo, hi = 0, n - 1",
      "```",
      "```text",
      "not code",
      "```",
      "```c++",
      "int main() {}",
      "```",
      "```java",
      "class Main {}",
      "```",
    ].join("\n");
    expect(editorialPrograms(md, ["python", "cpp"])).toEqual([
      { block: 1, language: "python", source: "print(1)\n" },
      { block: 4, language: "cpp", source: "int main() {}\n" },
    ]);
    expect(editorialPrograms("No code here.", ["python"])).toEqual([]);
  });
});
