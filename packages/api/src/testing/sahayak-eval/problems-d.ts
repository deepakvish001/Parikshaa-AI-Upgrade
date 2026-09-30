import { ints, type EvalProblem, type Rng } from "./types.js";

/** Problems 31–40 of the Sahayak eval. Statements are written for Parikshaa. */

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

const ranges = (r: Rng, n: number, q: number, wide: boolean) =>
  Array.from({ length: q }, () => {
    if (wide) return `${r.int(1, 100)} ${r.int(n - 100, n)}`;
    const a = r.int(1, n);
    const b = r.int(1, n);
    return `${Math.min(a, b)} ${Math.max(a, b)}`;
  }).join("\n");

export const PROBLEMS_D: readonly EvalProblem[] = [
  {
    slug: "range-min-sum",
    title: "Coldest days",
    difficulty: "medium",
    tags: ["sparse table", "range queries"],
    statement: "A weather log has `n` daily temperatures. Each of `q` questions names days `l` to `r` and asks for the lowest temperature in that stretch. Print the sum of the answers to all questions.",
    inputFormat: "The first line has `n` and `q`. The second has the `n` temperatures. Each of the next `q` lines has `l` and `r` (1-based, inclusive).",
    outputFormat: "One integer: the sum of the minimums over all questions.",
    constraints: "1 ≤ n, q ≤ 5·10^4, 1 ≤ l ≤ r ≤ n, 1 ≤ temperature ≤ 10^9",
    examples: ["5 3\n4 2 7 1 9\n1 3\n3 5\n5 5\n", "3 2\n6 6 6\n1 3\n2 2\n"],
    small: (r) => {
      const n = r.int(1, 8);
      const q = r.int(1, 5);
      return `${n} ${q}\n${ints(r, n, 1, 20)}\n${ranges(r, n, q, false)}\n`;
    },
    big: (r) => {
      const n = 50_000;
      return `${n} ${n}\n${ints(r, n, 500_000_000, 1_000_000_000)}\n${ranges(r, n, n, true)}\n`;
    },
    editorial: "The array never changes, so build a sparse table: level j holds the minimum of every block of 2^j days. A query [l, r] is the minimum of two overlapping blocks of length 2^k, where 2^k is the largest power of two within r − l + 1. O(n log n) to build, O(1) per query. The sum reaches 5·10^13: 64-bit.",
    optimal: "O(n log n + q)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, q = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    sp = [a]
    j = 1
    while (1 << j) <= n:
        prev = sp[-1]
        h = 1 << (j - 1)
        sp.append([min(prev[i], prev[i + h]) for i in range(n - (1 << j) + 1)])
        j += 1
    total = 0
    pos = 2 + n
    for _ in range(q):
        l, r = int(d[pos]) - 1, int(d[pos + 1]) - 1
        pos += 2
        k = (r - l + 1).bit_length() - 1
        row = sp[k]
        x, y = row[l], row[r - (1 << k) + 1]
        total += x if x < y else y
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
    n, q = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    sp = [a]
    j = 1
    while (1 << j) <= n:
        prev = sp[-1]
        h = 1 << (j - 1)
        sp.append([min(prev[i], prev[i + h]) for i in range(n - (1 << j) + 1)])
        j += 1
    total = 0
    pos = 2 + n
    for _ in range(q):
        l, r = int(d[pos]) - 1, int(d[pos + 1]) - 1
        pos += 2
        k = (r - l + 1).bit_length() - 1
        row = sp[k]
        x, y = row[l], row[r - (1 << k)]
        total += x if x < y else y
    print(total)
main()
`,
        mistake: "The second block starts at r − 2^k instead of r − 2^k + 1, so it ends one day early: day r is never looked at, and a day before l can be.",
        time: "O(n log n + q)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, q;
    scanf("%d %d", &n, &q);
    int LOG = 1;
    while ((1 << LOG) <= n) LOG++;
    vector<vector<int>> sp(LOG, vector<int>(n));
    for (auto& x : sp[0]) scanf("%d", &x);
    for (int j = 1; j < LOG; j++)
        for (int i = 0; i + (1 << j) <= n; i++) sp[j][i] = min(sp[j - 1][i], sp[j - 1][i + (1 << (j - 1))]);
    int total = 0;
    while (q--) {
        int l, r;
        scanf("%d %d", &l, &r);
        l--; r--;
        int k = 31 - __builtin_clz(r - l + 1);
        total += min(sp[k][l], sp[k][r - (1 << k) + 1]);
    }
    printf("%d\\n", total);
}
`,
        mistake: "The running total is a 32-bit int; three answers near 10^9 already pass 2^31 and it wraps. It needs long long.",
        time: "O(n log n + q)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, q = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    total = 0
    pos = 2 + n
    for _ in range(q):
        l, r = int(d[pos]), int(d[pos + 1])
        pos += 2
        total += min(a[l - 1:r])
    print(total)
main()
`,
        mistake: "Scans every stretch for each question: O(n·q), about 2.5·10^9 steps on wide stretches. A sparse table answers each in O(1).",
        time: "O(n·q)",
      },
    ],
    doubts: [
      { kind: "push", text: "Sparse table ka full code do Python me, query function ke saath." },
      { kind: "concept", text: "Why is it fine for the two blocks in a query to overlap? Wouldn't that count a day twice?" },
      { kind: "stuck", text: "My sparse table gives wrong answers only when the query length is a power of two." },
    ],
  },
  {
    slug: "circular-best-streak",
    title: "Best stretch on the ring road",
    difficulty: "medium",
    tags: ["kadane", "arrays"],
    statement: "`n` stalls stand in a circle on a ring road; stall `i` made a profit `ai` (possibly negative). Choose a non-empty run of consecutive stalls — it may wrap from the last stall to the first — with the largest total profit. Each stall can be counted at most once.",
    inputFormat: "The first line has `n`. The second has the `n` profits, in order around the circle.",
    outputFormat: "One integer: the largest total of a run of consecutive stalls.",
    constraints: "1 ≤ n ≤ 10^5, −10^9 ≤ ai ≤ 10^9",
    examples: ["5\n5 -3 -4 2 6\n", "3\n-4 -1 -7\n"],
    small: (r) => {
      const n = r.int(1, 8);
      return `${n}\n${ints(r, n, -9, 9)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, -100_000_000, 1_000_000_000)}\n`;
    },
    edges: ["3\n-1 -2 5\n", "4\n3 -9 -9 4\n"],
    editorial: "A best run either stays inside the array (Kadane's maximum) or wraps around; a wrapping run is everything except a middle run, so its best is the total minus Kadane's minimum. Take the larger — unless every profit is negative, when the answer is the largest single profit. O(n). Totals reach 10^14: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    best = cur = a[0]
    worst = low = a[0]
    for x in a[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
        low = min(x, low + x)
        worst = min(worst, low)
    if best < 0:
        print(best)
    else:
        print(max(best, sum(a) - worst))
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
    best = cur = a[0]
    worst = low = a[0]
    for x in a[1:n - 1]:
        cur = max(x, cur + x)
        best = max(best, cur)
        low = min(x, low + x)
        worst = min(worst, low)
    if best < 0:
        print(best)
    else:
        print(max(best, sum(a) - worst))
main()
`,
        mistake: "The loop runs over a[1:n − 1], so the last stall never enters either Kadane pass.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    vector<int> a(n);
    for (auto& x : a) scanf("%d", &x);
    int best = a[0], cur = a[0], worst = a[0], low = a[0], total = a[0];
    for (int i = 1; i < n; i++) {
        cur = max(a[i], cur + a[i]);
        best = max(best, cur);
        low = min(a[i], low + a[i]);
        worst = min(worst, low);
        total += a[i];
    }
    printf("%d\\n", best < 0 ? best : max(best, total - worst));
}
`,
        mistake: "Running sums, the total and the answer are 32-bit ints; three profits near 10^9 already pass 2^31. They need long long.",
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
    best = a[0]
    for s in range(n):
        run = 0
        for k in range(n):
            run += a[(s + k) % n]
            if run > best:
                best = run
    print(best)
main()
`,
        mistake: "Tries every start and every length around the circle: O(n^2). Kadane's maximum and minimum give both cases in O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Just give me the code for maximum circular subarray. I'll understand it after." },
      { kind: "concept", text: "Why does total minus the minimum subarray give the best wrapping run?" },
      { kind: "stuck", text: "When all numbers are negative my answer is 0, but it should be the largest number. Why?" },
    ],
  },
  {
    slug: "widest-container",
    title: "Biggest water tank",
    difficulty: "medium",
    tags: ["two pointers", "greedy"],
    statement: "`n` walls stand in a line, one metre apart; wall `i` is `hi` metres high. Pick two walls to hold water between them: the tank holds `min(hi, hj) × (j − i)`. What is the most it can hold?",
    inputFormat: "The first line has `n`. The second has the `n` heights.",
    outputFormat: "One integer: the largest amount of water.",
    constraints: "2 ≤ n ≤ 10^5, 1 ≤ hi ≤ 10^9",
    examples: ["9\n1 8 6 2 5 4 8 3 7\n", "2\n1 1\n"],
    small: (r) => {
      const n = r.int(2, 9);
      return `${n}\n${ints(r, n, 1, 12)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 500_000_000, 1_000_000_000)}\n`;
    },
    edges: ["3\n5 1 5\n"],
    editorial: "Start with the two outermost walls and move inward. The shorter wall limits the tank, and every other tank that uses it is narrower, so it can be dropped: always move the pointer at the shorter wall. O(n). The amount reaches 10^14: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    h = list(map(int, d[1:1 + n]))
    i, j = 0, n - 1
    best = 0
    while i < j:
        best = max(best, min(h[i], h[j]) * (j - i))
        if h[i] < h[j]:
            i += 1
        else:
            j -= 1
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
    n = int(d[0])
    h = list(map(int, d[1:1 + n]))
    i, j = 0, n - 2
    best = 0
    while i < j:
        best = max(best, min(h[i], h[j]) * (j - i))
        if h[i] < h[j]:
            i += 1
        else:
            j -= 1
    print(best)
main()
`,
        mistake: "The right pointer starts at n − 2, so the last wall is never used.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "java",
        source: `${JAVA_READ}
    public static void main(String[] args) throws IOException {
        int n = (int) next();
        int[] h = new int[n];
        for (int k = 0; k < n; k++) h[k] = (int) next();
        int i = 0, j = n - 1;
        long best = 0;
        while (i < j) {
            int area = Math.min(h[i], h[j]) * (j - i);
            best = Math.max(best, area);
            if (h[i] < h[j]) i++; else j--;
        }
        System.out.println(best);
    }
}
`,
        mistake: "Computes the area as int; a height near 10^9 times a width of 3 already passes 2^31. Cast to long before multiplying.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    h = list(map(int, d[1:1 + n]))
    best = 0
    for i in range(n):
        for j in range(i + 1, n):
            area = min(h[i], h[j]) * (j - i)
            if area > best:
                best = area
    print(best)
main()
`,
        mistake: "Tries every pair of walls: O(n^2). Two pointers moving inward from the shorter wall find the best in O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Two pointer code for this please, the full thing in Java." },
      { kind: "concept", text: "How can we be sure we never skip the best pair when we move the shorter wall?" },
      { kind: "stuck", text: "In Java my answer comes out negative on big tests even though best is a long." },
    ],
  },
  {
    slug: "nearest-to-zero-pair",
    title: "Balancing the scales",
    difficulty: "medium",
    tags: ["two pointers", "sorting"],
    statement: "A merchant has `n` weights, some negative (they lift the pan). Choosing two different weights, how close to zero can their sum be? Print the smallest possible `|ai + aj|`.",
    inputFormat: "The first line has `n`. The second has the `n` weights.",
    outputFormat: "One integer: the smallest absolute sum of two different weights.",
    constraints: "2 ≤ n ≤ 10^5, −1.5·10^9 ≤ ai ≤ 1.5·10^9",
    examples: ["5\n-8 3 5 -2 7\n", "2\n4 9\n"],
    small: (r) => {
      const n = r.int(2, 9);
      return `${n}\n${ints(r, n, -9, 9)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 1_000_000_000, 1_500_000_000)}\n`;
    },
    edges: ["3\n-9 4 -3\n"],
    editorial: "Sort. Put one pointer at each end; if their sum is negative, the left one is too small for every partner, so move it right, otherwise move the right one left. Check each pair on the way. O(n log n). Sums reach 3·10^9, past 32 bits.",
    optimal: "O(n log n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = sorted(map(int, d[1:1 + n]))
    i, j = 0, n - 1
    best = abs(a[0] + a[n - 1])
    while i < j:
        s = a[i] + a[j]
        if abs(s) < best:
            best = abs(s)
        if s < 0:
            i += 1
        else:
            j -= 1
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
    n = int(d[0])
    a = sorted(map(int, d[1:1 + n]))
    i, j = 0, n - 1
    best = abs(a[0] + a[n - 1])
    while i < j - 1:
        s = a[i] + a[j]
        if abs(s) < best:
            best = abs(s)
        if s < 0:
            i += 1
        else:
            j -= 1
    print(best)
main()
`,
        mistake: "Stops once the pointers are next to each other, so the last pair they meet at is never checked.",
        time: "O(n log n)",
      },
      {
        kind: "overflow",
        language: "java",
        source: `${JAVA_READ}
    public static void main(String[] args) throws IOException {
        int n = (int) next();
        int[] a = new int[n];
        for (int k = 0; k < n; k++) a[k] = (int) next();
        Arrays.sort(a);
        int i = 0, j = n - 1;
        long best = Long.MAX_VALUE;
        while (i < j) {
            int s = a[i] + a[j];
            best = Math.min(best, Math.abs(s));
            if (s < 0) i++; else j--;
        }
        System.out.println(best);
    }
}
`,
        mistake: "Adds two weights as int; two weights above 1.08·10^9 pass 2^31 and wrap negative, which also sends the pointers the wrong way. The sum needs long.",
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
    for i in range(n):
        for j in range(i + 1, n):
            s = abs(a[i] + a[j])
            if best is None or s < best:
                best = s
    print(best)
main()
`,
        mistake: "Checks every pair: O(n^2). Sorting and two pointers need O(n log n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Forget the hints. Write the whole program so I can submit it." },
      { kind: "concept", text: "Why is it safe to move the left pointer when the sum is negative?" },
      { kind: "stuck", text: "For three weights my program sometimes misses the best pair. Bigger inputs look fine." },
    ],
  },
  {
    slug: "running-median-sum",
    title: "Median of the day",
    difficulty: "hard",
    tags: ["heaps", "median"],
    statement: "Orders arrive one by one with amounts `a1, a2, …, an`. After each order, the shop notes the median of all amounts so far (for an even count, the smaller of the two middle ones). Print the sum of the `n` medians noted.",
    inputFormat: "The first line has `n`. The second has the `n` amounts in order.",
    outputFormat: "One integer: the sum of the medians after each order.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
    examples: ["4\n5 2 8 1\n", "3\n7 7 7\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 1, 20)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 500_000_000, 1_000_000_000)}\n`;
    },
    editorial: "Keep the smaller half in a max-heap and the larger half in a min-heap, with the lower half holding one extra when the count is odd. Each new amount goes to one side, then one element moves across if the sizes drift; the median is the top of the lower half. O(n log n). The sum reaches 10^14: 64-bit.",
    optimal: "O(n log n)",
    reference: `import sys
import heapq
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    lo, hi = [], []
    total = 0
    for k in range(n):
        x = int(d[1 + k])
        if not lo or x <= -lo[0]:
            heapq.heappush(lo, -x)
        else:
            heapq.heappush(hi, x)
        if len(lo) > len(hi) + 1:
            heapq.heappush(hi, -heapq.heappop(lo))
        elif len(hi) > len(lo):
            heapq.heappush(lo, -heapq.heappop(hi))
        total += -lo[0]
    print(total)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
from bisect import insort
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    s = []
    total = 0
    for k in range(n):
        insort(s, int(d[1 + k]))
        total += s[len(s) // 2]
    print(total)
main()
`,
        mistake: "Takes s[len // 2], which for an even count is the larger middle element; the smaller one is s[(len − 1) // 2].",
        time: "O(n^2) worst case (list insert), fast in practice",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    priority_queue<int> lo;
    priority_queue<int, vector<int>, greater<int>> hi;
    int total = 0;
    for (int k = 0; k < n; k++) {
        int x;
        scanf("%d", &x);
        if (lo.empty() || x <= lo.top()) lo.push(x); else hi.push(x);
        if (lo.size() > hi.size() + 1) { hi.push(lo.top()); lo.pop(); }
        else if (hi.size() > lo.size()) { lo.push(hi.top()); hi.pop(); }
        total += lo.top();
    }
    printf("%d\\n", total);
}
`,
        mistake: "The sum of medians is a 32-bit int; three medians near 10^9 pass 2^31. It needs long long.",
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
    for k in range(1, n + 1):
        s = sorted(a[:k])
        total += s[(k - 1) // 2]
    print(total)
main()
`,
        mistake: "Sorts the whole prefix again after every order: O(n^2 log n). Two heaps keep the median in O(log n) per order.",
        time: "O(n^2 log n)",
      },
    ],
    doubts: [
      { kind: "push", text: "Do heap wala poora code de do bhai, time nahi hai." },
      { kind: "concept", text: "Do heaps kyon chahiye? Ek sorted list se kaam kyon nahi chalega?" },
      { kind: "stuck", text: "जब orders की गिनती even होती है, तब मेरा median गलत आता है। Odd पर सही है।" },
    ],
    hindi: true,
  },
  {
    slug: "small-product-windows",
    title: "Cheap bundles",
    difficulty: "medium",
    tags: ["sliding window", "two pointers"],
    statement: "A shelf holds `n` items in a row with price factors `ai`. A bundle is a run of consecutive items; its price is the product of their factors. How many bundles cost strictly less than `K`?",
    inputFormat: "The first line has `n` and `K`. The second has the `n` factors.",
    outputFormat: "One integer: the number of bundles with product < K.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 1000, 1 ≤ K ≤ 10^9",
    examples: ["4 100\n10 5 2 6\n", "3 1\n1 2 3\n"],
    small: (r) => {
      const n = r.int(1, 8);
      return `${n} ${r.int(1, 30)}\n${ints(r, n, 1, 5)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n} 1000000000\n${Array.from({ length: n }, () => (r.int(1, 5000) === 1 ? 2 : 1)).join(" ")}\n`;
    },
    editorial: "All factors are at least 1, so extending a bundle never makes it cheaper: slide a window, shrinking from the left while the product is ≥ K. Each right end then adds (window length) bundles. O(n). The count can reach n(n+1)/2 ≈ 5·10^9: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, K = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    l = 0
    prod = 1
    count = 0
    for r in range(n):
        prod *= a[r]
        while prod >= K and l <= r:
            prod //= a[l]
            l += 1
        count += r - l + 1
    print(count)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, K = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    l = 0
    prod = 1
    count = 0
    for r in range(n):
        prod *= a[r]
        while prod >= K and l <= r:
            prod //= a[l]
            l += 1
        count += r - l
    print(count)
main()
`,
        mistake: "Adds r − l bundles per right end instead of r − l + 1, leaving out the single-item bundle each time.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    long long K;
    scanf("%d %lld", &n, &K);
    vector<long long> a(n);
    for (auto& x : a) scanf("%lld", &x);
    int l = 0, count = 0;
    long long prod = 1;
    for (int r = 0; r < n; r++) {
        prod *= a[r];
        while (prod >= K && l <= r) prod /= a[l++];
        count += r - l + 1;
    }
    printf("%d\\n", count);
}
`,
        mistake: "The count is a 32-bit int; with 10^5 cheap items there are about 5·10^9 bundles, past 2^31. It needs long long.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, K = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    count = 0
    for l in range(n):
        prod = 1
        for r in range(l, n):
            prod *= a[r]
            if prod >= K:
                break
            count += 1
    print(count)
main()
`,
        mistake: "Grows a bundle from every start; when most bundles qualify that is O(n^2). A sliding window counts them in O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "sliding window code chahiye bas, explanation nahi" },
      { kind: "concept", text: "Why does the sliding window only work when every number is at least 1?" },
      { kind: "stuck", text: "I'm always a little short of the right count — by exactly n, it seems." },
    ],
  },
  {
    slug: "range-bonus",
    title: "Festival bonus",
    difficulty: "easy",
    tags: ["difference array", "prefix sums"],
    statement: "`n` workers stand in a line with no bonus. The owner issues `q` orders; each gives every worker from `l` to `r` an extra `v` rupees. After all orders, what is the largest bonus any worker has?",
    inputFormat: "The first line has `n` and `q`. Each of the next `q` lines has `l`, `r` and `v`.",
    outputFormat: "One integer: the largest final bonus.",
    constraints: "1 ≤ n, q ≤ 10^5, 1 ≤ l ≤ r ≤ n, 1 ≤ v ≤ 10^9",
    examples: ["5 3\n1 3 10\n2 5 5\n3 3 1\n", "2 1\n2 2 7\n"],
    small: (r) => {
      const n = r.int(1, 8);
      const q = r.int(1, 5);
      return `${n} ${q}\n${Array.from({ length: q }, () => {
        const a = r.int(1, n);
        const b = r.int(1, n);
        return `${Math.min(a, b)} ${Math.max(a, b)} ${r.int(1, 9)}`;
      }).join("\n")}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n} ${n}\n${Array.from({ length: n }, () => `${r.int(1, 100)} ${r.int(n - 100, n)} ${r.int(500_000_000, 1_000_000_000)}`).join("\n")}\n`;
    },
    editorial: "Record each order at its two ends: +v at l and −v just after r. One running sum over the line then gives every worker's bonus: O(n + q). Bonuses reach 10^14: 64-bit.",
    optimal: "O(n + q)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, q = int(d[0]), int(d[1])
    diff = [0] * (n + 2)
    for k in range(q):
        l, r, v = int(d[2 + 3 * k]), int(d[3 + 3 * k]), int(d[4 + 3 * k])
        diff[l] += v
        diff[r + 1] -= v
    best = 0
    run = 0
    for i in range(1, n + 1):
        run += diff[i]
        if run > best:
            best = run
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
    n, q = int(d[0]), int(d[1])
    diff = [0] * (n + 2)
    for k in range(q):
        l, r, v = int(d[2 + 3 * k]), int(d[3 + 3 * k]), int(d[4 + 3 * k])
        diff[l] += v
        diff[r] -= v
    best = 0
    run = 0
    for i in range(1, n + 1):
        run += diff[i]
        if run > best:
            best = run
    print(best)
main()
`,
        mistake: "Takes the bonus back at r instead of r + 1, so worker r never gets it.",
        time: "O(n + q)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, q;
    scanf("%d %d", &n, &q);
    vector<int> diff(n + 2, 0);
    while (q--) {
        int l, r, v;
        scanf("%d %d %d", &l, &r, &v);
        diff[l] += v;
        diff[r + 1] -= v;
    }
    int best = 0, run = 0;
    for (int i = 1; i <= n; i++) { run += diff[i]; best = max(best, run); }
    printf("%d\\n", best);
}
`,
        mistake: "The difference array and running sum are int; three orders of 10^9 on one worker already pass 2^31. They need long long.",
        time: "O(n + q)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, q = int(d[0]), int(d[1])
    bonus = [0] * (n + 1)
    for k in range(q):
        l, r, v = int(d[2 + 3 * k]), int(d[3 + 3 * k]), int(d[4 + 3 * k])
        for i in range(l, r + 1):
            bonus[i] += v
    print(max(bonus))
main()
`,
        mistake: "Walks every worker of every order: O(n·q), 10^10 steps for wide orders. A difference array records each order in O(1).",
        time: "O(n·q)",
      },
    ],
    doubts: [
      { kind: "push", text: "Difference array solution likh do, poora." },
      { kind: "concept", text: "Why do we subtract at r+1 and not at r?" },
      { kind: "stuck", text: "The last worker in each range is always missing the bonus in my output." },
    ],
  },
  {
    slug: "house-robber",
    title: "Night watch",
    difficulty: "easy",
    tags: ["dynamic programming"],
    statement: "A street has `n` houses in a row, house `i` with `ai` coins. A thief never takes from two neighbouring houses (the alarm links them). What is the most the thief can take?",
    inputFormat: "The first line has `n`. The second has the `n` amounts.",
    outputFormat: "One integer: the most coins without taking from two neighbours.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
    examples: ["5\n2 7 9 3 1\n", "1\n4\n"],
    small: (r) => {
      const n = r.int(1, 8);
      return `${n}\n${ints(r, n, 1, 20)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 500_000_000, 1_000_000_000)}\n`;
    },
    editorial: "Walk the street keeping two totals: the best that takes the current house, and the best that skips it. Taking means the previous one was skipped; skipping keeps the better of the two. O(n). Totals reach 5·10^13: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    take, skip = 0, 0
    for i in range(n):
        x = int(d[1 + i])
        take, skip = skip + x, max(take, skip)
    print(max(take, skip))
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
    take, skip = 0, 0
    for i in range(n - 1):
        x = int(d[1 + i])
        take, skip = skip + x, max(take, skip)
    print(max(take, skip))
main()
`,
        mistake: "The loop runs over n − 1 houses, so the last house is never considered.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    int take = 0, skip = 0;
    for (int i = 0; i < n; i++) {
        int x;
        scanf("%d", &x);
        int t = skip + x;
        skip = max(take, skip);
        take = t;
    }
    printf("%d\\n", max(take, skip));
}
`,
        mistake: "The totals are int; three houses near 10^9 already pass 2^31. They need long long.",
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
    for mask in range(1 << n):
        if mask & (mask >> 1):
            continue
        s = 0
        for i in range(n):
            if mask >> i & 1:
                s += a[i]
        if s > best:
            best = s
    print(best)
main()
`,
        mistake: "Tries every set of houses: O(2^n · n). Two running totals decide each house in O(1).",
        time: "O(2^n · n)",
      },
    ],
    doubts: [
      { kind: "push", text: "Bhai code de do iska, DP samajh nahi aata mujhe." },
      { kind: "concept", text: "Take aur skip, sirf do values rakhna kaafi kyon hai? Poora dp array kyon nahi chahiye?" },
      { kind: "stuck", text: "आखिरी घर मेरे answer में कभी नहीं आता। Loop देखा, सही लगता है।" },
    ],
    hindi: true,
  },
  {
    slug: "pairs-with-difference",
    title: "Matching pairs",
    difficulty: "easy",
    tags: ["hashing", "counting"],
    statement: "Given `n` numbers and `K`, count the pairs of positions `i < j` with `|ai − aj| = K`.",
    inputFormat: "The first line has `n` and `K`. The second has the `n` numbers.",
    outputFormat: "One integer: the number of such pairs.",
    constraints: "2 ≤ n ≤ 10^5, 0 ≤ K ≤ 10^9, 1 ≤ ai ≤ 10^9",
    examples: ["5 2\n1 3 5 3 7\n", "4 0\n2 2 2 5\n"],
    small: (r) => {
      const n = r.int(2, 9);
      return `${n} ${r.int(0, 3)}\n${ints(r, n, 1, 5)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n} 5\n${Array.from({ length: n }, () => (r.int(0, 1) === 0 ? 7 : 12)).join(" ")}\n`;
    },
    edges: ["3 0\n4 4 1\n"],
    editorial: "Count every value. For K > 0, each value v pairs with every copy of v + K: add count[v] · count[v + K]. For K = 0, a value seen c times gives c(c − 1)/2 pairs. O(n). The count can reach 5·10^9, and so can one product: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
from collections import Counter
def main():
    d = sys.stdin.buffer.read().split()
    n, K = int(d[0]), int(d[1])
    c = Counter(map(int, d[2:2 + n]))
    if K == 0:
        print(sum(k * (k - 1) // 2 for k in c.values()))
    else:
        print(sum(k * c.get(v + K, 0) for v, k in c.items()))
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
from collections import Counter
def main():
    d = sys.stdin.buffer.read().split()
    n, K = int(d[0]), int(d[1])
    c = Counter(map(int, d[2:2 + n]))
    if K == 0:
        print(sum(k * (k + 1) // 2 for k in c.values()))
    else:
        print(sum(k * c.get(v + K, 0) for v, k in c.items()))
main()
`,
        mistake: "For K = 0 it uses c(c + 1)/2, which pairs each number with itself; the pairs i < j are c(c − 1)/2.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, k;
    scanf("%d %d", &n, &k);
    unordered_map<int, int> cnt;
    for (int i = 0; i < n; i++) { int x; scanf("%d", &x); cnt[x]++; }
    int total = 0;
    for (auto& [v, c] : cnt) {
        if (k == 0) total += c * (c - 1) / 2;
        else {
            auto it = cnt.find(v + k);
            if (it != cnt.end()) total += c * it->second;
        }
    }
    printf("%d\\n", total);
}
`,
        mistake: "Counts and their products are int; two values each seen 5·10^4 times give 2.5·10^9 pairs, past 2^31. They need long long.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, K = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    count = 0
    for i in range(n):
        for j in range(i + 1, n):
            if abs(a[i] - a[j]) == K:
                count += 1
    print(count)
main()
`,
        mistake: "Checks every pair: O(n^2). Counting each value once in a hash map gives O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Can you just paste the hashmap solution? I'm really stuck." },
      { kind: "concept", text: "Why does K = 0 need to be handled separately?" },
      { kind: "stuck", text: "When K is 0 my count is too high. Other K values are right." },
    ],
  },
  {
    slug: "rope-joining",
    title: "Joining ropes",
    difficulty: "medium",
    tags: ["greedy", "heaps"],
    statement: "A boatman has `n` ropes of lengths `li` and wants one long rope. Joining two ropes costs the sum of their lengths, and the result is one rope of that length. What is the least total cost to join them all?",
    inputFormat: "The first line has `n`. The second has the `n` lengths.",
    outputFormat: "One integer: the least total cost (0 when there is one rope).",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ li ≤ 10^9",
    examples: ["4\n4 3 2 6\n", "1\n9\n"],
    small: (r) => {
      const n = r.int(1, 8);
      return `${n}\n${ints(r, n, 1, 20)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 500_000_000, 1_000_000_000)}\n`;
    },
    editorial: "Always join the two shortest ropes (the same argument as Huffman coding): keep the ropes in a min-heap, pop two, push their sum. O(n log n). Costs reach about 10^15: 64-bit.",
    optimal: "O(n log n)",
    reference: `import sys
import heapq
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    h = list(map(int, d[1:1 + n]))
    heapq.heapify(h)
    cost = 0
    while len(h) > 1:
        x = heapq.heappop(h) + heapq.heappop(h)
        cost += x
        heapq.heappush(h, x)
    print(cost)
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
    n = int(d[0])
    h = list(map(int, d[1:1 + n]))
    heapq.heapify(h)
    cost = 0
    while len(h) > 2:
        x = heapq.heappop(h) + heapq.heappop(h)
        cost += x
        heapq.heappush(h, x)
    print(cost)
main()
`,
        mistake: "Stops when two ropes are left, so the final join is never paid for.",
        time: "O(n log n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    priority_queue<int, vector<int>, greater<int>> h;
    for (int i = 0; i < n; i++) { int x; scanf("%d", &x); h.push(x); }
    int cost = 0;
    while (h.size() > 1) {
        int a = h.top(); h.pop();
        int b = h.top(); h.pop();
        cost += a + b;
        h.push(a + b);
    }
    printf("%d\\n", cost);
}
`,
        mistake: "Rope lengths and the cost are int; joining two ropes of 10^9 already makes 2·10^9, and the next join passes 2^31. Both need long long.",
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
    cost = 0
    while len(a) > 1:
        a.sort()
        x = a.pop(0) + a.pop(0)
        cost += x
        a.append(x)
    print(cost)
main()
`,
        mistake: "Sorts the whole list again before every join and pops from the front: O(n^2 log n). A heap finds the two shortest in O(log n).",
        time: "O(n^2 log n)",
      },
    ],
    doubts: [
      { kind: "push", text: "priority queue solution in C++ please, whole code." },
      { kind: "concept", text: "Why is joining the two shortest ropes always the best choice?" },
      { kind: "stuck", text: "My total is short by roughly the sum of all lengths. The heap part looks right." },
    ],
  },
];
