import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  FUNCTION_LANGUAGES,
  functionChecker,
  programFor,
  RESULT_MARKER,
  starterFor,
  VALUE_TYPES,
  type Signature,
  type ValueType,
} from "@parikshaa/core";
import { execute, type RunRequest, type RunResult } from "@parikshaa/runner";

/**
 * Function questions, run for real (ROADMAP §4).
 *
 * The program around a candidate's function is generated, in five languages,
 * from a signature. These build and run it with the real compilers, for every
 * type a parameter or a result can have, so a mistake in any generated program
 * shows up here rather than in front of a candidate.
 */

const isRoot = process.getuid?.() === 0;
let workRoot: string;
beforeAll(async () => {
  workRoot = await mkdtemp(join(tmpdir(), "function-mode-"));
});

/** `worker` picks the sandbox uid: runs at once must never share one, or each one's cleanup kills the other's program. */
const run = (signature: Signature, language: string, source: string, tests: RunRequest["tests"], worker = 0): Promise<RunResult> =>
  execute(
    {
      language: language as RunRequest["language"],
      source: programFor(signature, language, source),
      tests,
      checker: functionChecker(signature),
      resultMarker: RESULT_MARKER,
    },
    { workRoot, slot: isRoot ? { uid: 61060 + worker, gid: 61060 + worker } : null },
  );

/** At most `n` at once, each worker with its own sandbox uid: the machine running this has a few cores, and every compile wants one. */
async function limited<T>(n: number, jobs: ((worker: number) => Promise<T>)[]): Promise<T[]> {
  const results: T[] = new Array(jobs.length);
  let next = 0;
  const worker = async (id: number) => {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await jobs[i]!(id);
    }
  };
  await Promise.all(Array.from({ length: n }, (_x, id) => worker(id)));
  return results;
}

const VALUES: Record<ValueType, string> = {
  int: "-2147483648",
  long: "9007199254740991",
  double: "2.5",
  boolean: "false",
  string: '"a \\"q\\" \\\\ é नमस्ते\\n"',
  "int[]": "[1,-2,3]",
  "long[]": "[5000000000,1]",
  "double[]": "[0.5,-1.25]",
  "boolean[]": "[true,false]",
  "string[]": '["x","","y z"]',
  "int[][]": "[[1,2],[],[3]]",
  "string[][]": '[["a"],[],["b","c"]]',
};

/** A function that returns its argument, written into each language's starter. */
function identity(type: ValueType, language: string): string {
  const signature: Signature = { name: "same", params: [{ name: "x", type }], returns: type };
  const starter = starterFor(signature, language);
  const depth = (type.match(/\[\]/g) ?? []).length;
  switch (language) {
    case "python":
      return starter.replace("pass", "return x");
    case "javascript":
      return starter.replace("{\n    \n};", "{\n    return x;\n};");
    case "java":
    case "cpp":
      return starter.replace("{\n        \n    }", "{\n        return x;\n    }");
    case "c": {
      const body =
        depth === 0 ? "return x;" : depth === 1 ? "*returnSize = xSize; return x;" : "*returnSize = xSize; *returnColumnSizes = xColSize; return x;";
      return starter.replace("{\n    \n}", `{\n    ${body}\n}`);
    }
    default:
      throw new Error(language);
  }
}

describe("every type, in every language", () => {
  it("passes each value in and gets it back unchanged", async () => {
    const jobs = VALUE_TYPES.flatMap((type) =>
      FUNCTION_LANGUAGES.map((language) => async (worker: number) => {
        const signature: Signature = { name: "same", params: [{ name: "x", type }], returns: type };
        const result = await run(signature, language, identity(type, language), [{ id: "t", input: `${VALUES[type]}\n`, expected: VALUES[type] }], worker);
        const outcome = result.compiled ? result.tests[0]! : null;
        return { type, language, status: outcome?.status ?? "compile_error", detail: result.compiled ? `${outcome!.result} ${outcome!.stderr}` : result.compileOutput };
      }),
    );
    const results = await limited(4, jobs);
    const failures = results.filter((r) => r.status !== "passed");
    // Named in full on failure, so the broken language and type are obvious.
    expect(failures).toEqual([]);
  }, 300_000);
});

describe("problems as candidates meet them", () => {
  const twoSum: Signature = {
    name: "twoSum",
    params: [
      { name: "nums", type: "int[]" },
      { name: "target", type: "int" },
    ],
    returns: "int[]",
    anyOrder: "top",
  };
  const twoSumSolutions: Record<string, string> = {
    python: [
      "class Solution:",
      "    def twoSum(self, nums: List[int], target: int) -> List[int]:",
      "        seen = {}",
      "        for i, n in enumerate(nums):",
      "            if target - n in seen:",
      "                return [i, seen[target - n]]",
      "            seen[n] = i",
    ].join("\n"),
    javascript: [
      "var twoSum = function(nums, target) {",
      "    const seen = new Map();",
      "    for (let i = 0; i < nums.length; i++) {",
      "        if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];",
      "        seen.set(nums[i], i);",
      "    }",
      "};",
    ].join("\n"),
    java: [
      "public class Solution {",
      "    public int[] twoSum(int[] nums, int target) {",
      "        Map<Integer, Integer> seen = new HashMap<>();",
      "        for (int i = 0; i < nums.length; i++) {",
      "            if (seen.containsKey(target - nums[i])) return new int[] { seen.get(target - nums[i]), i };",
      "            seen.put(nums[i], i);",
      "        }",
      "        return new int[0];",
      "    }",
      "}",
    ].join("\n"),
    cpp: [
      "class Solution {",
      "public:",
      "    vector<int> twoSum(vector<int>& nums, int target) {",
      "        unordered_map<int, int> seen;",
      "        for (int i = 0; i < (int)nums.size(); i++) {",
      "            if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};",
      "            seen[nums[i]] = i;",
      "        }",
      "        return {};",
      "    }",
      "};",
    ].join("\n"),
    c: [
      "int* twoSum(int* nums, int numsSize, int target, int* returnSize) {",
      "    int* r = malloc(2 * sizeof(int)); *returnSize = 2;",
      "    for (int i = 0; i < numsSize; i++) for (int j = i + 1; j < numsSize; j++)",
      "        if (nums[i] + nums[j] == target) { r[0] = i; r[1] = j; return r; }",
      "    *returnSize = 0; return r;",
      "}",
    ].join("\n"),
  };

  it("runs a LeetCode-style solution in every language, in any order when the question allows it", async () => {
    const tests = [
      { id: "1", input: "[2,7,11,15]\n9\n", expected: "[0,1]" },
      { id: "2", input: "[3,2,4]\n6\n", expected: "[1,2]" },
    ];
    const results = await limited(
      4,
      FUNCTION_LANGUAGES.map((language) => async (worker: number) => {
        const result = await run(twoSum, language, twoSumSolutions[language]!, tests, worker);
        return [language, result.compiled ? result.tests.map((t) => t.status) : [result.compileOutput]] as const;
      }),
    );
    expect(Object.fromEntries(results)).toEqual(Object.fromEntries(FUNCTION_LANGUAGES.map((l) => [l, ["passed", "passed"]])));
  }, 120_000);

  it("groups in any order, all the way down, when the question says so", async () => {
    const signature: Signature = { name: "groupAnagrams", params: [{ name: "strs", type: "string[]" }], returns: "string[][]", anyOrder: "deep" };
    const source = [
      "class Solution:",
      "    def groupAnagrams(self, strs):",
      "        groups = defaultdict(list)",
      "        for s in strs: groups[''.join(sorted(s))].append(s)",
      "        return list(groups.values())",
    ].join("\n");
    const result = await run(signature, "python", source, [
      { id: "t", input: '["eat","tea","tan","ate","nat","bat"]\n', expected: '[["bat"],["nat","tan"],["ate","eat","tea"]]' },
    ]);
    expect(result.compiled && result.tests[0]!.status).toBe("passed");
  });

  it("keeps what the candidate printed apart from what the function returned", async () => {
    const signature: Signature = { name: "twice", params: [{ name: "n", type: "int" }], returns: "int" };
    const result = await run(signature, "python", "class Solution:\n    def twice(self, n):\n        print('thinking about', n)\n        return 2 * n\n", [
      { id: "t", input: "21\n", expected: "42" },
    ]);
    expect(result.compiled && result.tests[0]).toMatchObject({ status: "passed", stdout: "thinking about 21\n", result: "42" });
  });

  it("calls a wrong return value wrong, and shows what came back", async () => {
    const signature: Signature = { name: "twice", params: [{ name: "n", type: "int" }], returns: "int" };
    const result = await run(signature, "javascript", "var twice = function(n) { return n + 2; };", [{ id: "t", input: "21\n", expected: "42" }]);
    expect(result.compiled && result.tests[0]).toMatchObject({ status: "wrong_answer", result: "23" });
  });

  it("accepts a bare function in Python and a Solution class in JavaScript", async () => {
    const signature: Signature = { name: "twice", params: [{ name: "n", type: "int" }], returns: "int" };
    const tests = [{ id: "t", input: "4\n", expected: "8" }];
    const bare = await run(signature, "python", "def twice(n):\n    return n * 2\n", tests);
    const klass = await run(signature, "javascript", "class Solution { twice(n) { return n * 2; } }", tests);
    expect([bare, klass].map((r) => r.compiled && r.tests[0]!.status)).toEqual(["passed", "passed"]);
  });

  it("reports compile errors at the candidate's own line numbers", async () => {
    const signature: Signature = { name: "twice", params: [{ name: "n", type: "int" }], returns: "int" };
    const tests = [{ id: "t", input: "4\n", expected: "8" }];
    const broken: Record<string, [string, RegExp]> = {
      cpp: ["class Solution {\npublic:\n    int twice(int n) {\n        return n * 2 +;\n    }\n};", /solution\.cpp:4/],
      c: ["int twice(int n) {\n    int x = ;\n    return n * 2;\n}", /solution\.c:2/],
      java: ["class Solution {\n    public int twice(int n) {\n        return n * 2\n    }\n}", /Main\.java:3/],
    };
    for (const [language, [source, where]] of Object.entries(broken)) {
      const result = await run(signature, language, source, tests);
      expect(result.compiled).toBe(false);
      if (!result.compiled) expect(result.compileOutput).toMatch(where);
    }
    const python = await run(signature, "python", "class Solution:\n    def twice(self, n):\n        return n / 0\n", tests);
    expect(python.compiled && python.tests[0]!.stderr).toMatch(/Solution\.py", line 3/);
  }, 60_000);
});
