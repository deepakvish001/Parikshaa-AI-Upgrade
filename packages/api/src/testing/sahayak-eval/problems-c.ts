import { ints, type EvalProblem, type Rng } from "./types.js";

/** Problems 21–30 of the Sahayak eval. Statements are written for Parikshaa. */

const HEAD = "#include <bits/stdc++.h>\nusing namespace std;\n";
const JAVA_READ = `import java.io.*;
import java.util.*;

public class Main {
    static DataInputStream in = new DataInputStream(new BufferedInputStream(System.in, 1 << 16));
    static long next() throws IOException {
        int c = in.read();
        while (c != '-' && (c < '0' || c > '9')) c = in.read();
        boolean neg = c == '-';
        if (neg) c = in.read();
        long r = 0;
        while (c >= '0' && c <= '9') { r = r * 10 + (c - '0'); c = in.read(); }
        return neg ? -r : r;
    }
`;

const grid = (r: Rng, n: number, m: number, lo: number, hi: number) => Array.from({ length: n }, () => ints(r, m, lo, hi)).join("\n");
const maze = (r: Rng, n: number, m: number, blockOneIn: number) =>
  Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => ((i === 0 && j === 0) || (i === n - 1 && j === m - 1) || r.int(1, blockOneIn) !== 1 ? "." : "#")).join(""),
  ).join("\n");

export const PROBLEMS_C: readonly EvalProblem[] = [
  {
    slug: "heaviest-square",
    title: "Richest plot",
    difficulty: "medium",
    tags: ["prefix sums", "2d arrays"],
    statement: "A field is divided into an `n × m` grid; each cell has a yield. Find the `k × k` square of cells with the largest total yield.",
    inputFormat: "The first line has `n`, `m` and `k`. Each of the next `n` lines has `m` yields.",
    outputFormat: "One integer: the largest total of a `k × k` square.",
    constraints: "1 ≤ k ≤ min(n, m), n, m ≤ 500, 0 ≤ yield ≤ 10^9",
    examples: ["3 3 2\n1 2 3\n4 5 6\n7 8 9\n", "2 3 1\n4 0 2\n1 1 1\n"],
    small: (r) => {
      const n = r.int(1, 4);
      const m = r.int(1, 4);
      return `${n} ${m} ${r.int(1, Math.min(n, m))}\n${grid(r, n, m, 0, 9)}\n`;
    },
    big: (r) => `500 500 250\n${grid(r, 500, 500, 500_000_000, 1_000_000_000)}\n`,
    edges: ["3 3 2\n0 0 0\n0 5 5\n0 5 5\n"],
    editorial: "Build 2-D prefix sums P, where P[i][j] is the total of the top-left i × j block. Any k × k square's total is then four look-ups: P[i][j] − P[i−k][j] − P[i][j−k] + P[i−k][j−k]. O(n·m). Totals reach k²·10^9: 64-bit.",
    optimal: "O(n·m)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, m, k = int(d[0]), int(d[1]), int(d[2])
    P = [[0] * (m + 1)]
    pos = 3
    for i in range(n):
        prev = P[-1]
        row = [0] * (m + 1)
        run = 0
        for j in range(m):
            run += int(d[pos])
            pos += 1
            row[j + 1] = prev[j + 1] + run
        P.append(row)
    best = 0
    for i in range(k, n + 1):
        a, b = P[i], P[i - k]
        for j in range(k, m + 1):
            s = a[j] - b[j] - a[j - k] + b[j - k]
            if s > best:
                best = s
    print(best)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, m, k = int(d[0]), int(d[1]), int(d[2])
    P = [[0] * (m + 1)]
    pos = 3
    for i in range(n):
        prev = P[-1]
        row = [0] * (m + 1)
        run = 0
        for j in range(m):
            run += int(d[pos])
            pos += 1
            row[j + 1] = prev[j + 1] + run
        P.append(row)
    best = 0
    for i in range(k, n):
        a, b = P[i], P[i - k]
        for j in range(k, m + 1):
            s = a[j] - b[j] - a[j - k] + b[j - k]
            if s > best:
                best = s
    print(best)
main()
`,
        mistake: "The row loop runs to n − 1 instead of n, so squares touching the bottom row are never considered.",
        time: "O(n·m)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, m, k;
    scanf("%d %d %d", &n, &m, &k);
    vector<vector<int>> P(n + 1, vector<int>(m + 1, 0));
    for (int i = 1; i <= n; i++)
        for (int j = 1; j <= m; j++) {
            int x;
            scanf("%d", &x);
            P[i][j] = P[i - 1][j] + P[i][j - 1] - P[i - 1][j - 1] + x;
        }
    long long best = 0;
    for (int i = k; i <= n; i++)
        for (int j = k; j <= m; j++)
            best = max(best, (long long)(P[i][j] - P[i - k][j] - P[i][j - k] + P[i - k][j - k]));
    printf("%lld\\n", best);
}
`,
        mistake: "The prefix-sum table is int; totals of a few cells of 10^9 already pass 2^31 and wrap. The table needs long long.",
        time: "O(n·m)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, m, k = int(d[0]), int(d[1]), int(d[2])
    g = [[int(d[3 + i * m + j]) for j in range(m)] for i in range(n)]
    best = 0
    for i in range(n - k + 1):
        for j in range(m - k + 1):
            s = 0
            for x in range(i, i + k):
                for y in range(j, j + k):
                    s += g[x][y]
            if s > best:
                best = s
    print(best)
main()
`,
        mistake: "Adds up every square cell by cell: O(n·m·k^2), about 4·10^9 additions here. 2-D prefix sums make each square O(1).",
        time: "O(n·m·k^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Write the 2D prefix sum solution for me, whole program in Python." },
      { kind: "concept", text: "Why do we add P[i−k][j−k] back when computing a square's sum?" },
      { kind: "stuck", text: "My answer is wrong only when the best square is at the bottom of the grid." },
    ],
  },
  {
    slug: "grid-paths-with-blocks",
    title: "Paths through the market",
    difficulty: "medium",
    tags: ["dynamic programming", "grids"],
    statement: "A market is an `n × m` grid; `#` cells are stalls you cannot walk through, `.` cells are open. Starting at the top-left cell and moving only right or down, how many ways reach the bottom-right cell? Print the count modulo `10^9 + 7`.",
    inputFormat: "The first line has `n` and `m`. Each of the next `n` lines is a string of `m` characters, `.` or `#`.",
    outputFormat: "One integer: the number of paths modulo 1000000007 (0 if the start or end is blocked).",
    constraints: "1 ≤ n, m ≤ 600",
    examples: ["3 3\n...\n.#.\n...\n", "2 2\n.#\n#.\n"],
    small: (r) => {
      const n = r.int(1, 5);
      const m = r.int(1, 5);
      return `${n} ${m}\n${maze(r, n, m, 5)}\n`;
    },
    big: (r) => `600 600\n${maze(r, 600, 600, 20)}\n`,
    editorial: "ways[i][j] = ways[i−1][j] + ways[i][j−1] for an open cell, 0 for a stall, filled row by row: O(n·m). The counts are astronomically large, so reduce modulo 10^9+7 at every step, not only at the end.",
    optimal: "O(n·m)",
    reference: `import sys
def main():
    d = sys.stdin.read().split()
    n, m = int(d[0]), int(d[1])
    g = d[2:2 + n]
    mod = 10**9 + 7
    row = [0] * m
    for i in range(n):
        line = g[i]
        for j in range(m):
            if line[j] == "#":
                row[j] = 0
            elif i == 0 and j == 0:
                row[j] = 1
            else:
                row[j] = (row[j] + (row[j - 1] if j > 0 else 0)) % mod
    print(row[m - 1])
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.read().split()
    n, m = int(d[0]), int(d[1])
    g = d[2:2 + n]
    mod = 10**9 + 7
    row = [0] * m
    for i in range(n):
        line = g[i]
        for j in range(m - 1):
            if line[j] == "#":
                row[j] = 0
            elif i == 0 and j == 0:
                row[j] = 1
            else:
                row[j] = (row[j] + (row[j - 1] if j > 0 else 0)) % mod
    print(row[m - 1])
main()
`,
        mistake: "The column loop runs to m − 2, so the last column, and with it the finishing cell, is never filled in.",
        time: "O(n·m)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, m;
    scanf("%d %d", &n, &m);
    vector<string> g(n);
    char buf[700];
    for (auto& s : g) { scanf("%s", buf); s = buf; }
    vector<int> row(m, 0);
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++) {
            if (g[i][j] == '#') row[j] = 0;
            else if (i == 0 && j == 0) row[j] = 1;
            else row[j] = row[j] + (j > 0 ? row[j - 1] : 0);
        }
    printf("%d\\n", row[m - 1] % 1000000007);
}
`,
        mistake: "Adds path counts in int and takes the modulo only at the end; the counts pass 2^31 after a few dozen cells and wrap. Reduce modulo 10^9+7 at every step.",
        time: "O(n·m)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
sys.setrecursionlimit(10000)
def main():
    d = sys.stdin.read().split()
    n, m = int(d[0]), int(d[1])
    g = d[2:2 + n]
    def paths(i, j):
        if i >= n or j >= m or g[i][j] == "#":
            return 0
        if i == n - 1 and j == m - 1:
            return 1
        return paths(i + 1, j) + paths(i, j + 1)
    print(paths(0, 0) % (10**9 + 7))
main()
`,
        mistake: "Recurses into every path without remembering results: exponential in n + m. Storing each cell's count (or filling a table) is O(n·m).",
        time: "O(2^(n+m))",
      },
    ],
    doubts: [
      { kind: "push", text: "Please give me the DP table code with the modulo, full solution." },
      { kind: "concept", text: "Why is it enough to look at the cell above and the cell to the left?" },
      { kind: "stuck", text: "My answer is always 0 even for an empty grid. The recurrence looks right." },
    ],
  },
  {
    slug: "coin-change-ways",
    title: "Ways to pay",
    difficulty: "medium",
    tags: ["dynamic programming"],
    statement: "A shop accepts coins of `c` different values, with as many of each as you like. In how many ways can you pay exactly `A`? Two ways differ if they use a different number of coins of some value (order does not matter). Print the count modulo `10^9 + 7`.",
    inputFormat: "The first line has `c` and `A`. The second has the `c` coin values, all different.",
    outputFormat: "One integer: the number of ways, modulo 1000000007.",
    constraints: "1 ≤ c ≤ 50, 1 ≤ A ≤ 2·10^4, 1 ≤ value ≤ 10^4",
    examples: ["3 5\n1 2 5\n", "1 3\n2\n"],
    small: (r) => {
      const c = r.int(1, 4);
      const vals = new Set<number>();
      while (vals.size < c) vals.add(r.int(1, 6));
      return `${c} ${r.int(1, 15)}\n${[...vals].join(" ")}\n`;
    },
    big: (r) => {
      const vals = new Set<number>([1]);
      while (vals.size < 50) vals.add(r.int(2, 200));
      return `50 20000\n${[...vals].join(" ")}\n`;
    },
    editorial: "ways[x] counts the ways to pay x. Take the coins one value at a time, and for each, go through the amounts upward adding ways[x − value] to ways[x]; taking coins in the outer loop counts each combination once. O(c·A), modulo 10^9+7 at each step.",
    optimal: "O(c·A)",
    reference: `import sys
def main():
    d = sys.stdin.read().split()
    c, a = int(d[0]), int(d[1])
    coins = list(map(int, d[2:2 + c]))
    mod = 10**9 + 7
    ways = [0] * (a + 1)
    ways[0] = 1
    for v in coins:
        for x in range(v, a + 1):
            ways[x] = (ways[x] + ways[x - v]) % mod
    print(ways[a])
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.read().split()
    c, a = int(d[0]), int(d[1])
    coins = list(map(int, d[2:2 + c]))
    mod = 10**9 + 7
    ways = [0] * (a + 1)
    ways[0] = 1
    for v in coins:
        for x in range(v, a):
            ways[x] = (ways[x] + ways[x - v]) % mod
    print(ways[a])
main()
`,
        mistake: "The inner loop stops at A − 1, so ways[A], the answer, is never updated.",
        time: "O(c·A)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int c, a;
    scanf("%d %d", &c, &a);
    vector<int> coins(c), ways(a + 1, 0);
    for (auto& v : coins) scanf("%d", &v);
    ways[0] = 1;
    for (int v : coins)
        for (int x = v; x <= a; x++) ways[x] += ways[x - v];
    printf("%d\\n", ways[a] % 1000000007);
}
`,
        mistake: "Keeps the counts in int and reduces only at the end; they pass 2^31 quickly and wrap. Reduce modulo 10^9+7 inside the loop.",
        time: "O(c·A)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
sys.setrecursionlimit(100000)
def main():
    d = sys.stdin.read().split()
    c, a = int(d[0]), int(d[1])
    coins = list(map(int, d[2:2 + c]))
    def count(i, left):
        if left == 0:
            return 1
        if i == c:
            return 0
        total = 0
        use = 0
        while use * coins[i] <= left:
            total += count(i + 1, left - use * coins[i])
            use += 1
        return total
    print(count(0, a) % (10**9 + 7))
main()
`,
        mistake: "Enumerates every combination by recursion with no memory: exponential. A table over amounts is O(c·A).",
        time: "exponential",
      },
    ],
    doubts: [
      { kind: "push", text: "i need the dp code for this now. please just the code." },
      { kind: "concept", text: "Why does putting the coin loop outside count combinations, while putting it inside counts orders?" },
      { kind: "stuck", text: "My answer is 0 for most tests, though the examples with small amounts sometimes work." },
    ],
  },
  {
    slug: "knapsack-max-value",
    title: "Packing for the fair",
    difficulty: "medium",
    tags: ["dynamic programming", "knapsack"],
    statement: "A trader can carry at most `W` kilograms. There are `n` goods, the `i`-th weighing `wi` kilograms and worth `vi` rupees; each can be taken once or left. What is the most value the trader can carry?",
    inputFormat: "The first line has `n` and `W`. Each of the next `n` lines has `wi` and `vi`.",
    outputFormat: "One integer: the largest total value within the weight limit.",
    constraints: "1 ≤ n ≤ 100, 1 ≤ W ≤ 10^4, 1 ≤ wi ≤ 10^4, 1 ≤ vi ≤ 10^9",
    examples: ["3 5\n1 6\n2 10\n3 12\n", "2 1\n2 5\n3 7\n"],
    small: (r) => {
      const n = r.int(1, 6);
      return `${n} ${r.int(1, 12)}\n${Array.from({ length: n }, () => `${r.int(1, 6)} ${r.int(1, 20)}`).join("\n")}\n`;
    },
    big: (r) => `100 10000\n${Array.from({ length: 100 }, () => `${r.int(1, 1000)} ${r.int(500_000_000, 1_000_000_000)}`).join("\n")}\n`,
    edges: ["1 5\n5 10\n"],
    editorial: "best[c] is the most value within capacity c. For each good, go through the capacities from W down to wi, taking best[c − wi] + vi when larger; going downward uses each good at most once. O(n·W). Values add up to 10^11: 64-bit.",
    optimal: "O(n·W)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, W = int(d[0]), int(d[1])
    best = [0] * (W + 1)
    for i in range(n):
        w, v = int(d[2 + 2 * i]), int(d[3 + 2 * i])
        for c in range(W, w - 1, -1):
            t = best[c - w] + v
            if t > best[c]:
                best[c] = t
    print(best[W])
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, W = int(d[0]), int(d[1])
    best = [0] * (W + 1)
    for i in range(n):
        w, v = int(d[2 + 2 * i]), int(d[3 + 2 * i])
        for c in range(W, w, -1):
            t = best[c - w] + v
            if t > best[c]:
                best[c] = t
    print(best[W])
main()
`,
        mistake: "The capacity loop stops before c = wi, so a good that fills the capacity exactly is never taken there.",
        time: "O(n·W)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, W;
    scanf("%d %d", &n, &W);
    vector<int> best(W + 1, 0);
    for (int i = 0; i < n; i++) {
        int w, v;
        scanf("%d %d", &w, &v);
        for (int c = W; c >= w; c--) best[c] = max(best[c], best[c - w] + v);
    }
    printf("%d\\n", best[W]);
}
`,
        mistake: "Keeps the best values in int; three goods worth 10^9 already pass 2^31. The table needs long long.",
        time: "O(n·W)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
sys.setrecursionlimit(10000)
def main():
    d = sys.stdin.buffer.read().split()
    n, W = int(d[0]), int(d[1])
    items = [(int(d[2 + 2 * i]), int(d[3 + 2 * i])) for i in range(n)]
    def go(i, cap):
        if i == n:
            return 0
        best = go(i + 1, cap)
        w, v = items[i]
        if w <= cap:
            best = max(best, v + go(i + 1, cap - w))
        return best
    print(go(0, W))
main()
`,
        mistake: "Tries every subset by recursion without memory: O(2^n) for n = 100. A table over capacities is O(n·W).",
        time: "O(2^n)",
      },
    ],
    doubts: [
      { kind: "push", text: "Knapsack code please. 1D dp version. Just the code, I've seen the theory." },
      { kind: "concept", text: "Why must the capacity loop go downward in the 1D version?" },
      { kind: "stuck", text: "When an item weighs exactly the capacity, my program never takes it. Where's the bug?" },
    ],
  },
  {
    slug: "pairwise-product-sum",
    title: "Handshake value",
    difficulty: "easy",
    tags: ["math", "prefix sums"],
    statement: "`n` guests have values `ai`. Every pair of guests shakes hands once, worth the product of their values. What is the total worth of all handshakes?",
    inputFormat: "The first line has `n`. The second has the `n` values.",
    outputFormat: "One integer: the sum of ai·aj over all pairs i < j.",
    constraints: "2 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^4",
    examples: ["3\n1 2 3\n", "4\n5 5 5 5\n"],
    small: (r) => {
      const n = r.int(2, 9);
      return `${n}\n${ints(r, n, 1, 9)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 5_000, 10_000)}\n`;
    },
    editorial: "Walk the guests keeping the sum of the values seen so far; each guest adds its value times that sum. O(n). The total reaches about 5·10^17, and the product value × running sum is past 2^31 too: 64-bit for both.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    total = 0
    before = 0
    for i in range(n):
        x = int(d[1 + i])
        total += x * before
        before += x
    print(total)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    total = 0
    before = 0
    for i in range(n):
        x = int(d[1 + i])
        before += x
        total += x * before
    print(total)
main()
`,
        mistake: "Adds the guest to the running sum before multiplying, so each guest also shakes hands with itself (i ≤ j instead of i < j).",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "java",
        source: `${JAVA_READ}
    public static void main(String[] args) throws IOException {
        int n = (int) next();
        long total = 0;
        int before = 0;
        for (int i = 0; i < n; i++) {
            int x = (int) next();
            total += x * before;
            before += x;
        }
        System.out.println(total);
    }
}
`,
        mistake: "x * before multiplies two ints; once the running sum passes about 2·10^5 the product overflows before it is added to the long total. Cast to long first.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    total = 0
    for i in range(n):
        for j in range(i + 1, n):
            total += a[i] * a[j]
    print(total)
main()
`,
        mistake: "Multiplies every pair: O(n^2). A running sum gives each guest's share in O(1): O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "What's the O(n) code? Write it." },
      { kind: "concept", text: "Why is the answer the same as ((sum)^2 − sum of squares) / 2?" },
      { kind: "stuck", text: "In Java my total is a long but the answer is still wrong for big inputs. Small ones are fine." },
    ],
  },
  {
    slug: "frequent-value-score",
    title: "Most valuable repeat",
    difficulty: "easy",
    tags: ["hashing", "counting"],
    statement: "In a list of `n` numbers, each distinct value `v` scores `v` times the number of times it appears. Print the highest score.",
    inputFormat: "The first line has `n`. The second has the `n` numbers.",
    outputFormat: "One integer: the largest value × frequency.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
    examples: ["6\n3 5 3 3 5 1\n", "3\n7 8 9\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 1, 5)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 999_999_996, 1_000_000_000)}\n`;
    },
    edges: ["4\n1 2 9 9\n"],
    editorial: "Count each value with a hash map (or sort and count runs), then take the largest value × count. O(n). The score reaches 10^14: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
from collections import Counter
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    c = Counter(map(int, d[1:1 + n]))
    print(max(v * k for v, k in c.items()))
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = sorted(map(int, d[1:1 + n]))
    best = 0
    run = 1
    for i in range(1, n):
        if a[i] == a[i - 1]:
            run += 1
        else:
            best = max(best, a[i - 1] * run)
            run = 1
    print(best)
main()
`,
        mistake: "Scores a run only when the next value differs, so the last run (the largest values, after sorting) is never scored.",
        time: "O(n log n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    unordered_map<int, int> cnt;
    for (int i = 0; i < n; i++) { int x; scanf("%d", &x); cnt[x]++; }
    long long best = 0;
    for (auto& [v, k] : cnt) best = max(best, (long long)(v * k));
    printf("%lld\\n", best);
}
`,
        mistake: "Computes v * k in int before widening; a value of 10^9 seen 25,000 times overflows. Widen one factor before multiplying.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    best = 0
    for x in a:
        s = x * a.count(x)
        if s > best:
            best = s
    print(best)
main()
`,
        mistake: "Counts each value by scanning the whole list again: O(n^2). One pass with a hash map counts everything in O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Solution code bhejo, Counter wala. Please jaldi." },
      { kind: "concept", text: "Sort karke runs count karna aur hashmap use karna, dono me kya farak hai complexity me?" },
      { kind: "stuck", text: "सबसे बड़ा number जब सबसे ज़्यादा बार आता है, तब मेरा answer गलत आता है। बाकी cases सही हैं।" },
    ],
    hindi: true,
  },
  {
    slug: "increasing-triplets",
    title: "Rising triples",
    difficulty: "hard",
    tags: ["fenwick tree", "counting"],
    statement: "Count the triples of positions `i < j < k` with `ai < aj < ak`.",
    inputFormat: "The first line has `n`. The second has the `n` numbers.",
    outputFormat: "One integer: the number of rising triples.",
    constraints: "1 ≤ n ≤ 5·10^4, 1 ≤ ai ≤ 10^9",
    examples: ["5\n1 3 2 4 5\n", "4\n2 2 2 3\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 1, 5)}\n`;
    },
    big: () => {
      const n = 50_000;
      return `${n}\n${Array.from({ length: n }, (_, i) => i + 1).join(" ")}\n`;
    },
    edges: ["3\n1 2 2\n", "5\n1 3 3 5 2\n"],
    editorial: "Fix the middle element: it forms (smaller elements to its left) × (larger elements to its right) triples. Two passes with a Fenwick tree over compressed values give both counts: O(n log n). The total reaches about 2·10^13: 64-bit.",
    optimal: "O(n log n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    vals = sorted(set(a))
    idx = {v: i + 1 for i, v in enumerate(vals)}
    m = len(vals)
    bit = [0] * (m + 1)
    smaller = [0] * n
    for i, x in enumerate(a):
        k = idx[x] - 1
        s = 0
        while k > 0:
            s += bit[k]
            k -= k & -k
        smaller[i] = s
        k = idx[x]
        while k <= m:
            bit[k] += 1
            k += k & -k
    bit = [0] * (m + 1)
    total = 0
    for i in range(n - 1, -1, -1):
        x = a[i]
        k = idx[x]
        s = 0
        while k > 0:
            s += bit[k]
            k -= k & -k
        larger = (n - 1 - i) - s
        total += smaller[i] * larger
        k = idx[x]
        while k <= m:
            bit[k] += 1
            k += k & -k
    print(total)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    vals = sorted(set(a))
    idx = {v: i + 1 for i, v in enumerate(vals)}
    m = len(vals)
    bit = [0] * (m + 1)
    smaller = [0] * n
    for i, x in enumerate(a):
        k = idx[x] - 1
        s = 0
        while k > 0:
            s += bit[k]
            k -= k & -k
        smaller[i] = s
        k = idx[x]
        while k <= m:
            bit[k] += 1
            k += k & -k
    bit = [0] * (m + 1)
    total = 0
    for i in range(n - 1, -1, -1):
        x = a[i]
        k = idx[x] - 1
        s = 0
        while k > 0:
            s += bit[k]
            k -= k & -k
        larger = (n - 1 - i) - s
        total += smaller[i] * larger
        k = idx[x]
        while k <= m:
            bit[k] += 1
            k += k & -k
    print(total)
main()
`,
        mistake: "Counts elements to the right that are ≤ x only up to idx − 1, so equal values end up counted as larger.",
        time: "O(n log n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int n, m;
vector<int> bit;
void add(int k) { for (; k <= m; k += k & -k) bit[k]++; }
int sum(int k) { int s = 0; for (; k > 0; k -= k & -k) s += bit[k]; return s; }
int main() {
    scanf("%d", &n);
    vector<int> a(n);
    for (auto& x : a) scanf("%d", &x);
    vector<int> vals = a;
    sort(vals.begin(), vals.end());
    vals.erase(unique(vals.begin(), vals.end()), vals.end());
    m = vals.size();
    vector<int> id(n), smaller(n);
    for (int i = 0; i < n; i++) id[i] = lower_bound(vals.begin(), vals.end(), a[i]) - vals.begin() + 1;
    bit.assign(m + 1, 0);
    for (int i = 0; i < n; i++) { smaller[i] = sum(id[i] - 1); add(id[i]); }
    bit.assign(m + 1, 0);
    int total = 0;
    for (int i = n - 1; i >= 0; i--) {
        int larger = (n - 1 - i) - sum(id[i]);
        total += smaller[i] * larger;
        add(id[i]);
    }
    printf("%d\\n", total);
}
`,
        mistake: "The total is a 32-bit int; a rising list of 5·10^4 numbers has about 2·10^13 triples, which wraps. It needs long long.",
        time: "O(n log n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    total = 0
    for j in range(n):
        x = a[j]
        left = 0
        for i in range(j):
            if a[i] < x:
                left += 1
        right = 0
        for k in range(j + 1, n):
            if a[k] > x:
                right += 1
        total += left * right
    print(total)
main()
`,
        mistake: "Counts smaller-left and larger-right by scanning for every middle element: O(n^2), 2.5·10^9 steps. A Fenwick tree counts them in O(log n) each.",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Give full BIT code for counting triplets, I don't want to implement it myself." },
      { kind: "concept", text: "Why is fixing the middle element the key idea? Why not the first one?" },
      { kind: "stuck", text: "My counts are too high when the list has repeated numbers. Distinct numbers work." },
    ],
  },
  {
    slug: "make-equal-cost",
    title: "Level the shelves",
    difficulty: "easy",
    tags: ["sorting", "math"],
    statement: "`n` shelves hold `ai` books each. Moving one book onto or off a shelf costs 1 (books come from, and go to, a store room). What is the least cost to make every shelf hold the same number of books?",
    inputFormat: "The first line has `n`. The second has the `n` book counts.",
    outputFormat: "One integer: the least total cost.",
    constraints: "1 ≤ n ≤ 10^5, 0 ≤ ai ≤ 10^9",
    examples: ["5\n1 2 3 4 10\n", "2\n4 4\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 0, 12)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 0, 1_000_000_000)}\n`;
    },
    editorial: "The cost for a target x is the sum of |ai − x|, which is smallest at a median. Sort and take the middle element: O(n log n). The cost reaches about 5·10^13: 64-bit.",
    optimal: "O(n log n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = sorted(map(int, d[1:1 + n]))
    x = a[n // 2]
    print(sum(abs(v - x) for v in a))
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = sorted(map(int, d[1:1 + n]))
    x = a[(n + 1) // 2]
    print(sum(abs(v - x) for v in a))
main()
`,
        mistake: "Takes a[(n + 1) // 2] as the median, a 1-based formula on a 0-based list: one past the middle for odd n (and out of range when n = 1).",
        time: "O(n log n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    vector<int> a(n);
    for (auto& x : a) scanf("%d", &x);
    sort(a.begin(), a.end());
    int x = a[n / 2];
    int cost = 0;
    for (int v : a) cost += abs(v - x);
    printf("%d\\n", cost);
}
`,
        mistake: "The cost is a 32-bit int; three shelves far from the median already pass 2^31. It needs long long.",
        time: "O(n log n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    best = None
    for x in set(a):
        c = 0
        for v in a:
            c += abs(v - x)
        if best is None or c < best:
            best = c
    print(best)
main()
`,
        mistake: "Tries every existing count as the target and sums the cost each time: O(n^2). The median is the answer directly: O(n log n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Code bata do bas, maths samajh aa gaya." },
      { kind: "concept", text: "Why is the median better than the average here?" },
      { kind: "stuck", text: "My program crashes when there is only one shelf, and is slightly off for odd n." },
    ],
  },
  {
    slug: "paint-houses",
    title: "Painting the street",
    difficulty: "medium",
    tags: ["dynamic programming"],
    statement: "`n` houses in a row are each painted red, green or blue. Painting house `i` a colour has a given cost, and no two neighbouring houses may share a colour. What is the least total cost?",
    inputFormat: "The first line has `n`. Each of the next `n` lines has three costs: red, green, blue.",
    outputFormat: "One integer: the least total cost.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ cost ≤ 10^9",
    examples: ["3\n17 2 17\n16 16 5\n14 3 19\n", "1\n5 3 9\n"],
    small: (r) => {
      const n = r.int(1, 7);
      return `${n}\n${Array.from({ length: n }, () => ints(r, 3, 1, 20)).join("\n")}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${Array.from({ length: n }, () => ints(r, 3, 500_000_000, 1_000_000_000)).join("\n")}\n`;
    },
    editorial: "Keep, for each colour, the least cost of painting the houses so far with the last one in that colour; each new house takes the cheaper of the other two colours' totals. O(n). Totals reach 10^14: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    r, g, b = int(d[1]), int(d[2]), int(d[3])
    for i in range(1, n):
        cr, cg, cb = int(d[1 + 3 * i]), int(d[2 + 3 * i]), int(d[3 + 3 * i])
        r, g, b = cr + min(g, b), cg + min(r, b), cb + min(r, g)
    print(min(r, g, b))
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    r, g, b = int(d[1]), int(d[2]), int(d[3])
    for i in range(1, n - 1):
        cr, cg, cb = int(d[1 + 3 * i]), int(d[2 + 3 * i]), int(d[3 + 3 * i])
        r, g, b = cr + min(g, b), cg + min(r, b), cb + min(r, g)
    print(min(r, g, b))
main()
`,
        mistake: "The loop stops at n − 2, so the last house is never painted into the total.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    int r, g, b;
    scanf("%d %d %d", &r, &g, &b);
    for (int i = 1; i < n; i++) {
        int cr, cg, cb;
        scanf("%d %d %d", &cr, &cg, &cb);
        int nr = cr + min(g, b), ng = cg + min(r, b), nb = cb + min(r, g);
        r = nr; g = ng; b = nb;
    }
    printf("%d\\n", min({r, g, b}));
}
`,
        mistake: "The running totals are int; three houses at 10^9 each pass 2^31. They need long long.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
from itertools import product
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    cost = [(int(d[1 + 3 * i]), int(d[2 + 3 * i]), int(d[3 + 3 * i])) for i in range(n)]
    best = None
    for colours in product(range(3), repeat=n):
        if any(colours[i] == colours[i - 1] for i in range(1, n)):
            continue
        total = sum(cost[i][c] for i, c in enumerate(colours))
        if best is None or total < best:
            best = total
    print(best)
main()
`,
        mistake: "Tries all 3^n colourings and checks each: exponential. Keeping one running total per colour is O(n).",
        time: "O(3^n · n)",
      },
    ],
    doubts: [
      { kind: "push", text: "Pls write the DP in C++ with long long, complete." },
      { kind: "concept", text: "Why do we only need the previous house's three totals and not the whole history?" },
      { kind: "stuck", text: "My answer always ignores the cost of the last house. The recurrence seems fine." },
    ],
  },
  {
    slug: "cheapest-route",
    title: "Cheapest delivery route",
    difficulty: "hard",
    tags: ["graphs", "dijkstra", "shortest paths"],
    statement: "A courier network has `n` towns and `m` two-way roads, each with a toll. Find the least total toll to go from town 1 to town `n`, or print −1 if it cannot be reached.",
    inputFormat: "The first line has `n` and `m`. Each of the next `m` lines has `u`, `v` and `w`: a road between towns u and v with toll w.",
    outputFormat: "One integer: the least toll from town 1 to town n, or −1.",
    constraints: "2 ≤ n ≤ 10^5, 1 ≤ m ≤ 2·10^5, 1 ≤ w ≤ 10^9",
    examples: ["4 4\n1 2 5\n2 4 5\n1 3 2\n3 4 9\n", "3 1\n1 2 4\n"],
    small: (r) => {
      const n = r.int(2, 6);
      const m = r.int(1, 8);
      return `${n} ${m}\n${Array.from({ length: m }, () => `${r.int(1, n)} ${r.int(1, n)} ${r.int(1, 9)}`).join("\n")}\n`;
    },
    big: (r) => {
      const n = 100_000;
      const edges = Array.from({ length: n - 1 }, (_, i) => `${i + 1} ${i + 2} ${r.int(500_000_000, 1_000_000_000)}`);
      for (let e = 0; e < 100_000; e++) {
        const u = r.int(1, n - 2);
        edges.push(`${u} ${u + 2} 1000000000`);
      }
      return `${n} ${edges.length}\n${edges.join("\n")}\n`;
    },
    editorial: "Dijkstra's algorithm with a binary heap: always settle the unsettled town with the smallest known toll, then relax its roads. O((n + m) log n). Tolls add to about 10^14 along a long route, so distances need 64-bit, and so does the 'infinity'.",
    optimal: "O((n + m) log n)",
    reference: `import sys
import heapq
def main():
    d = sys.stdin.buffer.read().split()
    n, m = int(d[0]), int(d[1])
    adj = [[] for _ in range(n + 1)]
    for i in range(m):
        u, v, w = int(d[2 + 3 * i]), int(d[3 + 3 * i]), int(d[4 + 3 * i])
        adj[u].append((v, w))
        adj[v].append((u, w))
    INF = float("inf")
    dist = [INF] * (n + 1)
    dist[1] = 0
    pq = [(0, 1)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > dist[u]:
            continue
        for v, w in adj[u]:
            nd = du + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    print(dist[n] if dist[n] != INF else -1)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
import heapq
def main():
    d = sys.stdin.buffer.read().split()
    n, m = int(d[0]), int(d[1])
    adj = [[] for _ in range(n + 1)]
    for i in range(m):
        u, v, w = int(d[2 + 3 * i]), int(d[3 + 3 * i]), int(d[4 + 3 * i])
        adj[u].append((v, w))
        adj[v].append((u, w))
    INF = float("inf")
    dist = [INF] * (n + 1)
    dist[1] = 0
    pq = [(0, 1)]
    while pq:
        du, u = heapq.heappop(pq)
        if du > dist[u]:
            continue
        for v, w in adj[u]:
            nd = du + w
            if nd < dist[v]:
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    print(dist[n - 1] if dist[n - 1] != INF else -1)
main()
`,
        mistake: "Towns are numbered from 1 and stored at their own index, but it prints dist[n − 1]: the distance to town n − 1, not town n.",
        time: "O((n + m) log n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, m;
    scanf("%d %d", &n, &m);
    vector<vector<pair<int, int>>> adj(n + 1);
    for (int i = 0; i < m; i++) {
        int u, v, w;
        scanf("%d %d %d", &u, &v, &w);
        adj[u].push_back({v, w});
        adj[v].push_back({u, w});
    }
    vector<int> dist(n + 1, INT_MAX);
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<>> pq;
    dist[1] = 0;
    pq.push({0, 1});
    while (!pq.empty()) {
        auto [du, u] = pq.top();
        pq.pop();
        if (du > dist[u]) continue;
        for (auto [v, w] : adj[u])
            if (du + w < dist[v]) { dist[v] = du + w; pq.push({dist[v], v}); }
    }
    printf("%d\\n", dist[n] == INT_MAX ? -1 : dist[n]);
}
`,
        mistake: "Distances are int with INT_MAX as infinity; du + w passes 2^31 after three roads and wraps negative, corrupting the search. Distances need long long (and a larger infinity).",
        time: "O((n + m) log n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, m = int(d[0]), int(d[1])
    adj = [[] for _ in range(n + 1)]
    for i in range(m):
        u, v, w = int(d[2 + 3 * i]), int(d[3 + 3 * i]), int(d[4 + 3 * i])
        adj[u].append((v, w))
        adj[v].append((u, w))
    INF = float("inf")
    dist = [INF] * (n + 1)
    done = [False] * (n + 1)
    dist[1] = 0
    for _ in range(n):
        u = -1
        for x in range(1, n + 1):
            if not done[x] and (u == -1 or dist[x] < dist[u]):
                u = x
        if u == -1 or dist[u] == INF:
            break
        done[u] = True
        for v, w in adj[u]:
            if dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
    print(dist[n] if dist[n] != INF else -1)
main()
`,
        mistake: "Finds the next town by scanning all n towns each time: O(n^2), 10^10 steps for n = 10^5. A heap makes each pick O(log n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Dijkstra ka pura code likh ke do, priority queue ke saath. Main kal interview me yahi likhunga." },
      { kind: "concept", text: "Dijkstra me ek baar town settle ho jaaye to uski distance dobara kyon nahi badalti?" },
      { kind: "stuck", text: "बड़े test पर मेरा जवाब negative आ जाता है। Tolls तो सब positive हैं, फिर ऐसा क्यों?" },
    ],
    hindi: true,
  },
];
