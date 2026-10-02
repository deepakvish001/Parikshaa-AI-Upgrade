/**
 * Patterns (Prep blueprint F14, S5): what a problem is really about, from
 * the free-form tags authors give it. "prefix sums", "Prefix-Sum" and
 * "difference array" are one idea to a learner preparing for a company;
 * so are "heaps" and "priority queue". A tag matching no pattern is left
 * out; a problem may have several patterns.
 */

export const PATTERNS: readonly { readonly name: string; readonly words: readonly string[] }[] = [
  { name: "Two pointers", words: ["two-pointers", "two-pointer"] },
  { name: "Sliding window", words: ["sliding-window", "window"] },
  { name: "Binary search", words: ["binary-search", "binary-search-on-answer"] },
  { name: "Prefix sums", words: ["prefix-sums", "prefix-sum", "prefix", "difference-array", "range-queries", "sparse-table", "fenwick-tree", "segment-tree"] },
  { name: "Hashing and counting", words: ["hashing", "hash", "hash-map", "hashmap", "counting", "frequency"] },
  { name: "Stacks and queues", words: ["stack", "monotonic-stack", "queue", "deque", "monotonic-queue"] },
  { name: "Heaps", words: ["heap", "heaps", "priority-queue", "median"] },
  { name: "Sorting", words: ["sorting", "sort", "merge-sort", "intervals"] },
  { name: "Greedy", words: ["greedy"] },
  { name: "Dynamic programming", words: ["dynamic-programming", "dp", "knapsack", "kadane", "memoization"] },
  { name: "Graphs", words: ["graphs", "graph", "bfs", "dfs", "dijkstra", "shortest-paths", "topological-sort", "union-find", "grids"] },
  { name: "Trees", words: ["trees", "tree", "binary-tree", "bst", "trie"] },
  { name: "Recursion and backtracking", words: ["recursion", "backtracking"] },
  { name: "Linked lists", words: ["linked-list", "linked-lists"] },
  { name: "Math", words: ["math", "number-theory", "gcd", "modular-arithmetic", "combinatorics"] },
  { name: "Bit manipulation", words: ["bit-manipulation", "bits", "bitmask"] },
  { name: "Strings", words: ["strings", "string"] },
];

const slug = (tag: string) =>
  tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The patterns a problem's tags name, in the order of `PATTERNS`. */
export function patternsOf(tags: readonly string[]): readonly string[] {
  const slugs = tags.map(slug);
  return PATTERNS.filter((p) => p.words.some((w) => slugs.includes(w))).map((p) => p.name);
}

/**
 * Across some problems: each pattern, how many of the problems it covers,
 * and how many of those the learner has solved; most common first.
 */
export function patternCounts(problems: readonly { readonly id: string; readonly tags: readonly string[] }[], solved: ReadonlySet<string>) {
  const counts = new Map<string, { problems: number; solved: number }>();
  for (const p of problems) {
    for (const name of patternsOf(p.tags)) {
      const c = counts.get(name) ?? { problems: 0, solved: 0 };
      c.problems += 1;
      if (solved.has(p.id)) c.solved += 1;
      counts.set(name, c);
    }
  }
  const order = new Map(PATTERNS.map((p, i) => [p.name, i]));
  return [...counts.entries()]
    .sort((a, b) => b[1].problems - a[1].problems || order.get(a[0])! - order.get(b[0])!)
    .map(([pattern, c]) => ({ pattern, ...c }));
}
