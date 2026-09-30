import { ints, type EvalProblem, type Rng } from "./types.js";

/** Problems 11–20 of the Sahayak eval. Statements are written for Parikshaa. */

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

const sortedInts = (r: Rng, n: number, lo: number, hi: number) =>
  Array.from({ length: n }, () => r.int(lo, hi))
    .sort((x, y) => x - y)
    .join(" ");

export const PROBLEMS_B: readonly EvalProblem[] = [
  {
    slug: "trapped-rainwater",
    title: "Rain between walls",
    difficulty: "hard",
    tags: ["two pointers", "prefix maximum"],
    statement: "A row of `n` walls stands side by side, wall `i` of height `hi` and width 1. After heavy rain, water settles wherever walls on both sides are taller. How much water is held in all?",
    inputFormat: "The first line has `n`. The second has the `n` heights.",
    outputFormat: "One integer: the total units of water held.",
    constraints: "1 ≤ n ≤ 10^5, 0 ≤ hi ≤ 10^9",
    examples: ["6\n3 0 2 0 4 1\n", "3\n1 2 3\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 0, 6)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 0, 1_000_000_000)}\n`;
    },
    edges: ["4\n3 0 0 3\n"],
    editorial: "Water above wall i is min(tallest wall to its left, tallest to its right) − hi. Two pointers from both ends, always moving the side with the lower maximum, give it in one pass with O(1) memory; prefix and suffix maxima give it in O(n) memory. The total reaches about 10^14: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    h = list(map(int, d[1:1 + n]))
    l, r = 0, n - 1
    lm = rm = 0
    water = 0
    while l < r:
        if h[l] < h[r]:
            lm = max(lm, h[l])
            water += lm - h[l]
            l += 1
        else:
            rm = max(rm, h[r])
            water += rm - h[r]
            r -= 1
    print(water)
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
    left = h[:]
    for i in range(1, n):
        left[i] = max(left[i - 1], h[i])
    right = h[:]
    for i in range(n - 2, -1, -1):
        right[i] = max(right[i + 1], h[i])
    water = 0
    for i in range(1, n - 2):
        water += min(left[i], right[i]) - h[i]
    print(water)
main()
`,
        mistake: "The final loop stops at n − 3, so the water above the second-to-last wall is never added.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    vector<int> h(n);
    for (auto& x : h) scanf("%d", &x);
    int l = 0, r = n - 1, lm = 0, rm = 0, water = 0;
    while (l < r) {
        if (h[l] < h[r]) { lm = max(lm, h[l]); water += lm - h[l]; l++; }
        else { rm = max(rm, h[r]); water += rm - h[r]; r--; }
    }
    printf("%d\\n", water);
}
`,
        mistake: "The water total is a 32-bit int; with walls up to 10^9 it passes 2^31 and wraps. It needs long long.",
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
    water = 0
    for i in range(n):
        lm = max(h[:i + 1])
        rm = max(h[i:])
        water += min(lm, rm) - h[i]
    print(water)
main()
`,
        mistake: "Finds the tallest wall on each side afresh for every wall: O(n^2). Prefix maxima or two pointers make it O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Show me the full two-pointer code. I want to compare with mine line by line." },
      { kind: "concept", text: "In the two pointer method, why is it safe to move the side with the smaller height?" },
      { kind: "stuck", text: "My prefix-max version is off on some inputs, usually by the water near the right end. What should I check?" },
    ],
  },
  {
    slug: "wait-for-warmer",
    title: "Waiting for a warmer day",
    difficulty: "medium",
    tags: ["monotonic stack"],
    statement: "For each of `n` days you know the temperature. For every day, count the days until a strictly warmer day comes (0 if none comes). Print the sum of these waits.",
    inputFormat: "The first line has `n`. The second has the `n` temperatures.",
    outputFormat: "One integer: the sum over all days of the wait for a warmer day.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ ti ≤ 10^9",
    examples: ["6\n30 28 31 29 29 35\n", "3\n5 5 5\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 1, 6)}\n`;
    },
    big: () => {
      const n = 100_000;
      return `${n}\n${Array.from({ length: n }, (_, i) => (i === n - 1 ? n + 5 : n - i)).join(" ")}\n`;
    },
    editorial: "Keep a stack of days still waiting, with temperatures that do not increase from bottom to top. When a warmer day arrives, pop every colder day and add today − that day. Each day is pushed and popped once: O(n). The sum can reach n(n−1)/2 ≈ 5·10^9: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    t = list(map(int, d[1:1 + n]))
    st = []
    total = 0
    for i, x in enumerate(t):
        while st and t[st[-1]] < x:
            total += i - st.pop()
        st.append(i)
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
    t = list(map(int, d[1:1 + n]))
    st = []
    total = 0
    for i, x in enumerate(t):
        while st and t[st[-1]] < x:
            total += i - st.pop() - 1
        st.append(i)
    print(total)
main()
`,
        mistake: "Adds i − j − 1 (the days strictly between) instead of i − j, so every wait is one day short.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    vector<int> t(n);
    for (auto& x : t) scanf("%d", &x);
    vector<int> st;
    int total = 0;
    for (int i = 0; i < n; i++) {
        while (!st.empty() && t[st.back()] < t[i]) { total += i - st.back(); st.pop_back(); }
        st.push_back(i);
    }
    printf("%d\\n", total);
}
`,
        mistake: "The sum of waits is a 32-bit int; for a long cooling spell ending in one hot day it is about 5·10^9 and wraps. It needs long long.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    t = list(map(int, d[1:1 + n]))
    total = 0
    for i in range(n):
        for j in range(i + 1, n):
            if t[j] > t[i]:
                total += j - i
                break
    print(total)
main()
`,
        mistake: "Scans forward from every day: O(n^2) when the temperature keeps falling. A monotonic stack does it in O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Please write the monotonic stack solution in Java for me." },
      { kind: "concept", text: "Why do the temperatures in the stack never increase from bottom to top?" },
      { kind: "stuck", text: "My stack answer is smaller than expected on every example, by exactly the number of days that found a warmer day. Where is that coming from?" },
    ],
  },
  {
    slug: "largest-rectangle-histogram",
    title: "Biggest poster",
    difficulty: "hard",
    tags: ["monotonic stack"],
    statement: "A wall is made of `n` columns of width 1 and heights `hi`. Find the area of the largest rectangle that fits entirely on the wall (its sides parallel to the columns).",
    inputFormat: "The first line has `n`. The second has the `n` heights.",
    outputFormat: "One integer: the largest area.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ hi ≤ 10^9",
    examples: ["6\n2 1 5 6 2 3\n", "3\n4 4 4\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 1, 7)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 500_000_000, 1_000_000_000)}\n`;
    },
    editorial: "For each column, the widest rectangle of its height reaches to the nearest lower column on each side. A stack of increasing heights finds both in one pass: when a lower column arrives, pop the taller ones and measure their rectangles. O(n). Areas reach about 10^14: 64-bit, including the multiplication.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    h = list(map(int, d[1:1 + n])) + [0]
    st = []
    best = 0
    for i, x in enumerate(h):
        start = i
        while st and st[-1][1] >= x:
            idx, hh = st.pop()
            best = max(best, hh * (i - idx))
            start = idx
        st.append((start, x))
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
    h = list(map(int, d[1:1 + n])) + [0]
    st = []
    best = 0
    for i, x in enumerate(h):
        start = i
        while st and st[-1][1] >= x:
            idx, hh = st.pop()
            best = max(best, hh * (i - idx - 1))
            start = idx
        st.append((start, x))
    print(best)
main()
`,
        mistake: "Measures the width as i − idx − 1 instead of i − idx, so every rectangle is one column too narrow.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    vector<int> h(n + 1, 0);
    for (int i = 0; i < n; i++) scanf("%d", &h[i]);
    vector<pair<int, int>> st;
    long long best = 0;
    for (int i = 0; i <= n; i++) {
        int start = i;
        while (!st.empty() && st.back().second >= h[i]) {
            auto [idx, hh] = st.back();
            st.pop_back();
            best = max(best, (long long)(hh * (i - idx)));
            start = idx;
        }
        st.push_back({start, h[i]});
    }
    printf("%lld\\n", best);
}
`,
        mistake: "Casts to long long only after multiplying: hh * (i − idx) is computed in int and overflows first. One factor must be widened before the multiplication.",
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
        mn = h[i]
        for j in range(i, n):
            if h[j] < mn:
                mn = h[j]
            if mn * (j - i + 1) > best:
                best = mn * (j - i + 1)
    print(best)
main()
`,
        mistake: "Tries every pair of left and right edges: O(n^2). A monotonic stack finds each column's reach in O(n) overall.",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "i am stuck for days. write the stack code. dont give hints, only code." },
      { kind: "concept", text: "Why do we append a 0 height at the end in the stack method?" },
      { kind: "stuck", text: "I store best as long long but big tests still give a wrong, sometimes negative, area. Where can it overflow?" },
    ],
  },
  {
    slug: "distinct-in-windows",
    title: "Variety in every window",
    difficulty: "medium",
    tags: ["sliding window", "hashing"],
    statement: "For every window of `k` consecutive numbers in a list of `n`, count how many different numbers it contains. Print the sum of these counts over all windows.",
    inputFormat: "The first line has `n` and `k`. The second has the `n` numbers.",
    outputFormat: "One integer: the sum over all windows of the number of distinct values.",
    constraints: "1 ≤ k ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
    examples: ["6 3\n1 2 1 3 3 2\n", "4 4\n7 7 7 7\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n} ${r.int(1, n)}\n${ints(r, n, 1, 4)}\n`;
    },
    big: () => {
      const n = 100_000;
      return `${n} 50000\n${Array.from({ length: n }, (_, i) => i + 1).join(" ")}\n`;
    },
    editorial: "Slide the window one step at a time, keeping a count of each value inside it and the number of values whose count is positive. Adding the new element and removing the old one change it in O(1). O(n) in all. The sum can reach (n−k+1)·k ≈ 2.5·10^9: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
from collections import defaultdict
def main():
    d = sys.stdin.buffer.read().split()
    n, k = int(d[0]), int(d[1])
    a = d[2:2 + n]
    cnt = defaultdict(int)
    distinct = 0
    total = 0
    for i in range(n):
        x = a[i]
        cnt[x] += 1
        if cnt[x] == 1:
            distinct += 1
        if i >= k:
            y = a[i - k]
            cnt[y] -= 1
            if cnt[y] == 0:
                distinct -= 1
        if i >= k - 1:
            total += distinct
    print(total)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
from collections import defaultdict
def main():
    d = sys.stdin.buffer.read().split()
    n, k = int(d[0]), int(d[1])
    a = d[2:2 + n]
    cnt = defaultdict(int)
    distinct = 0
    total = 0
    for i in range(n):
        x = a[i]
        cnt[x] += 1
        if cnt[x] == 1:
            distinct += 1
        if i >= k:
            y = a[i - k]
            cnt[y] -= 1
            if cnt[y] == 0:
                distinct -= 1
            total += distinct
    print(total)
main()
`,
        mistake: "Adds the count only from i ≥ k instead of i ≥ k − 1, so the very first window is never counted.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, k;
    scanf("%d %d", &n, &k);
    vector<int> a(n);
    for (auto& x : a) scanf("%d", &x);
    unordered_map<int, int> cnt;
    int distinct = 0, total = 0;
    for (int i = 0; i < n; i++) {
        if (++cnt[a[i]] == 1) distinct++;
        if (i >= k && --cnt[a[i - k]] == 0) distinct--;
        if (i >= k - 1) total += distinct;
    }
    printf("%d\\n", total);
}
`,
        mistake: "The total is a 32-bit int; for n = 10^5 distinct numbers and k = 5·10^4 it is about 2.5·10^9 and wraps. It needs long long.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, k = int(d[0]), int(d[1])
    a = d[2:2 + n]
    total = 0
    for i in range(n - k + 1):
        total += len(set(a[i:i + k]))
    print(total)
main()
`,
        mistake: "Builds a new set for every window: O(n·k), about 2.5·10^9 steps here. Sliding the counts along is O(n).",
        time: "O(n·k)",
      },
    ],
    doubts: [
      { kind: "push", text: "Sliding window ka full code chahiye, abhi ke abhi. Explanation baad me." },
      { kind: "concept", text: "Window slide karte waqt distinct count ko O(1) me kaise update karte hain?" },
      { kind: "stuck", text: "मेरा जवाब हर बार पहली window जितना कम आता है। गलती कहाँ हो सकती है?" },
    ],
    hindi: true,
  },
  {
    slug: "double-trouble-pairs",
    title: "More than double",
    difficulty: "hard",
    tags: ["merge sort", "fenwick tree", "counting"],
    statement: "Count the pairs of positions `i < j` where the earlier number is more than twice the later one: `ai > 2·aj`.",
    inputFormat: "The first line has `n`. The second has the `n` numbers.",
    outputFormat: "One integer: the number of such pairs.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 2·10^9",
    examples: ["5\n1 3 2 3 1\n", "4\n9 4 2 1\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 1, 6)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 1, 2_000_000_000)}\n`;
    },
    editorial: "Merge-sort counting: after both halves are sorted, for each element of the right half count the left-half elements greater than twice it with a pointer that only moves forward; then merge. O(n log n). Or a Fenwick tree over sorted values. Twice a value can be 4·10^9: compare in 64-bit.",
    optimal: "O(n log n)",
    reference: `import sys
from bisect import bisect_left, bisect_right
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    vals = sorted(set(a))
    m = len(vals)
    bit = [0] * (m + 1)
    ans = 0
    for i, x in enumerate(a):
        j = bisect_right(vals, 2 * x)
        s = 0
        while j > 0:
            s += bit[j]
            j -= j & -j
        ans += i - s
        k = bisect_left(vals, x) + 1
        while k <= m:
            bit[k] += 1
            k += k & -k
    print(ans)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
from bisect import bisect_left
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    vals = sorted(set(a))
    m = len(vals)
    bit = [0] * (m + 1)
    ans = 0
    for i, x in enumerate(a):
        j = bisect_left(vals, 2 * x)
        s = 0
        while j > 0:
            s += bit[j]
            j -= j & -j
        ans += i - s
        k = bisect_left(vals, x) + 1
        while k <= m:
            bit[k] += 1
            k += k & -k
    print(ans)
main()
`,
        mistake: "Uses bisect_left for 2x, which leaves values equal to 2x out of the 'not greater' count, so pairs with ai exactly 2·aj are counted though they should not be.",
        time: "O(n log n)",
      },
      {
        kind: "overflow",
        language: "java",
        source: `${JAVA_READ}
    static long cnt = 0;
    static void go(int[] a, int lo, int hi, int[] t) {
        if (hi - lo < 2) return;
        int mid = (lo + hi) / 2;
        go(a, lo, mid, t);
        go(a, mid, hi, t);
        int i = lo;
        for (int j = mid; j < hi; j++) {
            while (i < mid && a[i] <= 2 * a[j]) i++;
            cnt += mid - i;
        }
        int p = lo, q = mid, k = lo;
        while (p < mid && q < hi) t[k++] = a[p] <= a[q] ? a[p++] : a[q++];
        while (p < mid) t[k++] = a[p++];
        while (q < hi) t[k++] = a[q++];
        System.arraycopy(t, lo, a, lo, hi - lo);
    }
    public static void main(String[] args) throws IOException {
        int n = (int) next();
        int[] a = new int[n];
        for (int i = 0; i < n; i++) a[i] = (int) next();
        go(a, 0, n, new int[n]);
        System.out.println(cnt);
    }
}
`,
        mistake: "Compares a[i] with 2 * a[j] in int; for aj above about 1.07·10^9 the double wraps negative. It needs 2L * a[j].",
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
    ans = 0
    for i in range(n):
        for j in range(i + 1, n):
            if a[i] > 2 * a[j]:
                ans += 1
    print(ans)
main()
`,
        mistake: "Checks every pair: O(n^2). Counting during merge sort is O(n log n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Give me the merge sort code for this in Java, I'll read it." },
      { kind: "concept", text: "Why can we count these pairs before merging the two halves, and not while merging like normal inversions?" },
      { kind: "stuck", text: "Java merge sort solution is correct for small numbers but wrong for numbers near 2·10^9. Why would size matter?" },
    ],
  },
  {
    slug: "two-lists-budget",
    title: "Lunch within budget",
    difficulty: "medium",
    tags: ["two pointers", "sorting"],
    statement: "A canteen has `n` mains and `m` desserts, each list given in non-decreasing order of price. Count the (main, dessert) choices whose total price is at most `T`.",
    inputFormat: "The first line has `n`, `m` and `T`. The second has the `n` main prices, the third the `m` dessert prices, both sorted.",
    outputFormat: "One integer: the number of affordable pairs.",
    constraints: "1 ≤ n, m ≤ 10^5, 1 ≤ prices ≤ 1.5·10^9, 1 ≤ T ≤ 3·10^9",
    examples: ["3 3 10\n2 5 8\n1 4 9\n", "2 2 1\n5 6\n7 8\n"],
    small: (r) => {
      const n = r.int(1, 6);
      const m = r.int(1, 6);
      return `${n} ${m} ${r.int(1, 20)}\n${sortedInts(r, n, 1, 10)}\n${sortedInts(r, m, 1, 10)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n} ${n} 1500000000\n${sortedInts(r, n, 1, 1_500_000_000)}\n${sortedInts(r, n, 1, 1_500_000_000)}\n`;
    },
    editorial: "Walk the mains upward with a pointer on the desserts that only moves down: for each main, drop desserts while the pair is over budget; everything left is affordable. O(n + m). Prices add to 3·10^9 and the count reaches 10^10: 64-bit for both.",
    optimal: "O(n + m)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, m, t = int(d[0]), int(d[1]), int(d[2])
    a = list(map(int, d[3:3 + n]))
    b = list(map(int, d[3 + n:3 + n + m]))
    j = m - 1
    ans = 0
    for x in a:
        while j >= 0 and x + b[j] > t:
            j -= 1
        ans += j + 1
    print(ans)
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, m, t = int(d[0]), int(d[1]), int(d[2])
    a = list(map(int, d[3:3 + n]))
    b = list(map(int, d[3 + n:3 + n + m]))
    j = m - 1
    ans = 0
    for x in a:
        while j >= 0 and x + b[j] > t:
            j -= 1
        ans += j
    print(ans)
main()
`,
        mistake: "Adds j, the index of the last affordable dessert, instead of j + 1, the number of them.",
        time: "O(n + m)",
      },
      {
        kind: "overflow",
        language: "java",
        source: `${JAVA_READ}
    public static void main(String[] args) throws IOException {
        int n = (int) next(), m = (int) next();
        int t = (int) next();
        int[] a = new int[n], b = new int[m];
        for (int i = 0; i < n; i++) a[i] = (int) next();
        for (int i = 0; i < m; i++) b[i] = (int) next();
        int j = m - 1;
        int ans = 0;
        for (int x : a) {
            while (j >= 0 && x + b[j] > t) j--;
            ans += j + 1;
        }
        System.out.println(ans);
    }
}
`,
        mistake: "Adds prices and counts in int: a main plus a dessert can be 3·10^9 and T up to 3·10^9 wraps when read; the count up to 10^10 wraps too. All need long.",
        time: "O(n + m)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, m, t = int(d[0]), int(d[1]), int(d[2])
    a = list(map(int, d[3:3 + n]))
    b = list(map(int, d[3 + n:3 + n + m]))
    ans = 0
    for x in a:
        for y in b:
            if x + y > t:
                break
            ans += 1
    print(ans)
main()
`,
        mistake: "Counts affordable pairs one at a time: O(n·m) when most pairs are affordable. A two-pointer walk counts them in O(n + m).",
        time: "O(n·m)",
      },
    ],
    doubts: [
      { kind: "push", text: "Can you give me the complete two pointer program? My version keeps failing." },
      { kind: "concept", text: "Why can the dessert pointer only move one way as the main gets more expensive?" },
      { kind: "stuck", text: "I get one fewer pair for every main on the examples. The pointer logic looks right to me." },
    ],
  },
  {
    slug: "union-length",
    title: "Road under repair",
    difficulty: "medium",
    tags: ["sorting", "intervals"],
    statement: "`n` repair crews each work on a stretch `[l, r)` of a long road (metres from the start). Stretches may overlap. How many metres of road are under repair in all?",
    inputFormat: "The first line has `n`. Each of the next `n` lines has `l` and `r`.",
    outputFormat: "One integer: the total length covered by at least one stretch.",
    constraints: "1 ≤ n ≤ 10^5, 0 ≤ l < r ≤ 4·10^9",
    examples: ["3\n1 5\n3 8\n10 12\n", "2\n0 10\n2 3\n"],
    small: (r) => {
      const n = r.int(1, 6);
      return `${n}\n${Array.from({ length: n }, () => {
        const l = r.int(0, 15);
        return `${l} ${r.int(l + 1, 20)}`;
      }).join("\n")}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${Array.from({ length: n }, () => {
        const l = r.int(0, 3_999_000_000);
        return `${l} ${l + r.int(1, 1_000_000)}`;
      }).join("\n")}\n`;
    },
    editorial: "Sort the stretches by start and sweep, keeping the current merged stretch; when the next one starts after its end, add the merged length and start a new one. O(n log n). Positions go up to 4·10^9 and the total is as large: 64-bit.",
    optimal: "O(n log n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    iv = sorted((int(d[1 + 2 * i]), int(d[2 + 2 * i])) for i in range(n))
    total = 0
    cl, cr = iv[0]
    for l, r in iv[1:]:
        if l > cr:
            total += cr - cl
            cl, cr = l, r
        elif r > cr:
            cr = r
    total += cr - cl
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
    iv = sorted((int(d[1 + 2 * i]), int(d[2 + 2 * i])) for i in range(n))
    total = 0
    cl, cr = iv[0]
    for l, r in iv[1:]:
        if l > cr:
            total += cr - cl + 1
            cl, cr = l, r
        elif r > cr:
            cr = r
    total += cr - cl + 1
    print(total)
main()
`,
        mistake: "Treats [l, r) as if it included r, adding r − l + 1 for each merged stretch instead of r − l.",
        time: "O(n log n)",
      },
      {
        kind: "overflow",
        language: "java",
        source: `${JAVA_READ}
    public static void main(String[] args) throws IOException {
        int n = (int) next();
        int[][] iv = new int[n][2];
        for (int i = 0; i < n; i++) { iv[i][0] = (int) next(); iv[i][1] = (int) next(); }
        Arrays.sort(iv, (p, q) -> Integer.compare(p[0], q[0]));
        int total = 0;
        int cl = iv[0][0], cr = iv[0][1];
        for (int i = 1; i < n; i++) {
            if (iv[i][0] > cr) { total += cr - cl; cl = iv[i][0]; cr = iv[i][1]; }
            else if (iv[i][1] > cr) cr = iv[i][1];
        }
        total += cr - cl;
        System.out.println(total);
    }
}
`,
        mistake: "Reads positions up to 4·10^9 into int, which wraps them (and breaks the sort), and keeps the total in int. Positions and total need long.",
        time: "O(n log n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    iv = [(int(d[1 + 2 * i]), int(d[2 + 2 * i])) for i in range(n)]
    pts = sorted(set(x for s in iv for x in s))
    total = 0
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]
        for l, r in iv:
            if l <= a and b <= r:
                total += b - a
                break
    print(total)
main()
`,
        mistake: "Checks every elementary piece against every stretch: O(n^2) in the worst case. Sorting and merging is O(n log n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Just paste the merge intervals solution please, full working code." },
      { kind: "concept", text: "Why do we sort by the start and not by the end of each stretch?" },
      { kind: "stuck", text: "My total is too big by exactly the number of separate pieces. The merging itself seems right." },
    ],
  },
  {
    slug: "best-k-window",
    title: "Best week",
    difficulty: "easy",
    tags: ["sliding window"],
    statement: "Given daily sales for `n` days, find the largest total over any `k` consecutive days.",
    inputFormat: "The first line has `n` and `k`. The second has the `n` daily sales.",
    outputFormat: "One integer: the largest sum of `k` consecutive days.",
    constraints: "1 ≤ k ≤ n ≤ 10^5, 0 ≤ ai ≤ 10^9",
    examples: ["7 3\n1 4 2 10 2 3 1\n", "3 3\n5 5 5\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n} ${r.int(1, n)}\n${ints(r, n, 0, 9)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n} 50000\n${ints(r, n, 500_000_000, 1_000_000_000)}\n`;
    },
    edges: ["4 2\n1 1 1 9\n"],
    editorial: "Take the sum of the first k days, then slide: add the next day and drop the oldest. Track the best. O(n). Sums reach 10^14: 64-bit.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, k = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    s = sum(a[:k])
    best = s
    for i in range(k, n):
        s += a[i] - a[i - k]
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
    n, k = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    s = sum(a[:k])
    best = s
    for i in range(k, n - 1):
        s += a[i] - a[i - k]
        if s > best:
            best = s
    print(best)
main()
`,
        mistake: "The slide stops at n − 2, so the window ending on the last day is never checked.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, k;
    scanf("%d %d", &n, &k);
    vector<int> a(n);
    for (auto& x : a) scanf("%d", &x);
    int s = 0;
    for (int i = 0; i < k; i++) s += a[i];
    int best = s;
    for (int i = k; i < n; i++) { s += a[i] - a[i - k]; best = max(best, s); }
    printf("%d\\n", best);
}
`,
        mistake: "The window sum is a 32-bit int; three days of 10^9 already pass 2^31. It needs long long.",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n, k = int(d[0]), int(d[1])
    a = list(map(int, d[2:2 + n]))
    best = 0
    for i in range(n - k + 1):
        s = 0
        for j in range(i, i + k):
            s += a[j]
        if s > best:
            best = s
    print(best)
main()
`,
        mistake: "Adds up each window from scratch: O(n·k), about 2.5·10^9 additions here. Sliding the sum is O(n).",
        time: "O(n·k)",
      },
    ],
    doubts: [
      { kind: "push", text: "Give me the O(n) code directly. no hints please" },
      { kind: "concept", text: "When we slide the window, why is it enough to add one value and subtract one value?" },
      { kind: "stuck", text: "My sliding window fails a test where the best days are at the very end. What's wrong?" },
    ],
  },
  {
    slug: "sum-of-window-minimums",
    title: "Sum of the smallest",
    difficulty: "hard",
    tags: ["monotonic stack", "math"],
    statement: "For every non-empty stretch of consecutive numbers in a list, take its smallest number. Print the sum of all these smallest numbers, modulo `10^9 + 7`.",
    inputFormat: "The first line has `n`. The second has the `n` numbers.",
    outputFormat: "One integer: the sum of the minimum of every stretch, modulo 1000000007.",
    constraints: "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
    examples: ["4\n3 1 2 4\n", "3\n2 2 2\n"],
    small: (r) => {
      const n = r.int(1, 9);
      return `${n}\n${ints(r, n, 1, 5)}\n`;
    },
    big: (r) => {
      const n = 100_000;
      return `${n}\n${ints(r, n, 500_000_000, 1_000_000_000)}\n`;
    },
    editorial: "Count, for each ai, the stretches where it is the (leftmost) minimum: it reaches left to the previous element ≤ ai and right to the next element < ai, found with monotonic stacks. It contributes ai · left · right. O(n). Multiply in 64-bit and reduce modulo 10^9+7 after each product.",
    optimal: "O(n)",
    reference: `import sys
def main():
    d = sys.stdin.buffer.read().split()
    n = int(d[0])
    a = list(map(int, d[1:1 + n]))
    mod = 10**9 + 7
    left = [0] * n
    st = []
    for i in range(n):
        while st and a[st[-1]] > a[i]:
            st.pop()
        left[i] = i - (st[-1] if st else -1)
        st.append(i)
    right = [0] * n
    st = []
    for i in range(n - 1, -1, -1):
        while st and a[st[-1]] >= a[i]:
            st.pop()
        right[i] = (st[-1] if st else n) - i
        st.append(i)
    print(sum(a[i] * left[i] * right[i] for i in range(n)) % mod)
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
    mod = 10**9 + 7
    left = [0] * n
    st = []
    for i in range(n):
        while st and a[st[-1]] > a[i]:
            st.pop()
        left[i] = i - (st[-1] if st else -1) - 1
        st.append(i)
    right = [0] * n
    st = []
    for i in range(n - 1, -1, -1):
        while st and a[st[-1]] >= a[i]:
            st.pop()
        right[i] = (st[-1] if st else n) - i
        st.append(i)
    print(sum(a[i] * left[i] * right[i] for i in range(n)) % mod)
main()
`,
        mistake: "Counts the left reach as i − prev − 1, leaving out stretches that start at i itself.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n;
    scanf("%d", &n);
    vector<int> a(n), left(n), right(n);
    for (auto& x : a) scanf("%d", &x);
    const long long MOD = 1000000007;
    vector<int> st;
    for (int i = 0; i < n; i++) {
        while (!st.empty() && a[st.back()] > a[i]) st.pop_back();
        left[i] = i - (st.empty() ? -1 : st.back());
        st.push_back(i);
    }
    st.clear();
    for (int i = n - 1; i >= 0; i--) {
        while (!st.empty() && a[st.back()] >= a[i]) st.pop_back();
        right[i] = (st.empty() ? n : st.back()) - i;
        st.push_back(i);
    }
    long long ans = 0;
    for (int i = 0; i < n; i++) ans = (ans + (long long)(a[i] * left[i]) % MOD * right[i]) % MOD;
    printf("%lld\\n", ans);
}
`,
        mistake: "Multiplies a[i] * left[i] in int before widening, which overflows for large values. The product must be done in long long.",
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
    mod = 10**9 + 7
    total = 0
    for i in range(n):
        mn = a[i]
        for j in range(i, n):
            if a[j] < mn:
                mn = a[j]
            total += mn
    print(total % mod)
main()
`,
        mistake: "Walks every stretch keeping a running minimum: O(n^2), 5·10^9 steps for n = 10^5. Counting each element's contribution with monotonic stacks is O(n).",
        time: "O(n^2)",
      },
    ],
    doubts: [
      { kind: "push", text: "Contest is over, so now please give the full monotonic stack solution." },
      { kind: "concept", text: "Why is one side 'less than or equal' and the other side 'strictly less' when finding boundaries?" },
      { kind: "stuck", text: "My contribution formula gives too small an answer, even for a single element list. Where's the error?" },
    ],
  },
  {
    slug: "staircase-ways",
    title: "Ways up the stairs",
    difficulty: "medium",
    tags: ["dynamic programming", "prefix sums"],
    statement: "You climb a staircase of `n` steps, taking between 1 and `k` steps at a time. In how many different ways can you reach the top? Print the count modulo `10^9 + 7`.",
    inputFormat: "One line with `n` and `k`.",
    outputFormat: "One integer: the number of ways, modulo 1000000007.",
    constraints: "1 ≤ n, k ≤ 10^5",
    examples: ["4 2\n", "3 3\n"],
    small: (r) => `${r.int(1, 12)} ${r.int(1, 4)}\n`,
    big: () => "100000 100000\n",
    editorial: "ways[i] is the sum of ways[i−1] … ways[i−k]. Keep prefix sums of ways so each step is a subtraction: O(n). Reduce every value, prefix sums included, modulo 10^9+7; left unreduced, the prefix sums pass 2^31 quickly.",
    optimal: "O(n)",
    reference: `import sys
def main():
    n, k = map(int, sys.stdin.read().split())
    mod = 10**9 + 7
    dp = [0] * (n + 1)
    pre = [0] * (n + 2)
    dp[0] = 1
    pre[1] = 1
    for i in range(1, n + 1):
        lo = max(0, i - k)
        dp[i] = (pre[i] - pre[lo]) % mod
        pre[i + 1] = (pre[i] + dp[i]) % mod
    print(dp[n])
main()
`,
    bugs: [
      {
        kind: "off_by_one",
        language: "python",
        source: `import sys
def main():
    n, k = map(int, sys.stdin.read().split())
    mod = 10**9 + 7
    dp = [0] * (n + 1)
    pre = [0] * (n + 2)
    dp[0] = 1
    pre[1] = 1
    for i in range(1, n + 1):
        lo = max(0, i - k + 1)
        dp[i] = (pre[i] - pre[lo]) % mod
        pre[i + 1] = (pre[i] + dp[i]) % mod
    print(dp[n])
main()
`,
        mistake: "The window starts at i − k + 1, so only k − 1 previous steps are summed; the largest jump of k steps is never counted.",
        time: "O(n)",
      },
      {
        kind: "overflow",
        language: "cpp",
        source: `${HEAD}int main() {
    int n, k;
    scanf("%d %d", &n, &k);
    const int MOD = 1000000007;
    vector<int> dp(n + 1, 0), pre(n + 2, 0);
    dp[0] = 1;
    pre[1] = 1;
    for (int i = 1; i <= n; i++) {
        int lo = max(0, i - k);
        dp[i] = ((pre[i] - pre[lo]) % MOD + MOD) % MOD;
        pre[i + 1] = pre[i] + dp[i];
    }
    printf("%d\\n", dp[n]);
}
`,
        mistake: "Never reduces the prefix sums modulo 10^9+7, and keeps them in int; they pass 2^31 within a few dozen steps and wrap. Reduce them (and use long long for safety).",
        time: "O(n)",
      },
      {
        kind: "tle",
        language: "python",
        source: `import sys
def main():
    n, k = map(int, sys.stdin.read().split())
    mod = 10**9 + 7
    dp = [0] * (n + 1)
    dp[0] = 1
    for i in range(1, n + 1):
        s = 0
        for j in range(1, min(i, k) + 1):
            s += dp[i - j]
        dp[i] = s % mod
    print(dp[n])
main()
`,
        mistake: "Sums up to k earlier values for every step: O(n·k), 10^10 at the limits. Prefix sums make each step O(1).",
        time: "O(n·k)",
      },
    ],
    doubts: [
      { kind: "push", text: "Pura DP code bhej do C++ me, main bas submit karna chahta hoon." },
      { kind: "concept", text: "prefix sum lagane se har step O(1) kaise ho jata hai? Samjhao na." },
      { kind: "stuck", text: "k = 1 aur k = 2 ke liye sahi hai par bade k par answer kam aata hai. Kya miss ho raha hai?" },
    ],
    hindi: true,
  },
];
