// Made by content-dsa.test.ts from the Sahayak eval's problems (written for Parikshaa); do not edit by hand.
// Each test's expected output is the reference program's, run on the real runner.
import type { DsaPack } from "./packs.js";

export const DSA_STARTER: DsaPack = {
  "problems": [
    {
      "slug": "range-sum-queries",
      "title": "Range sum queries",
      "difficulty": "easy",
      "tags": [
        "prefix sums",
        "arrays"
      ],
      "statement": "A shop records its takings for `n` days in a row. The owner asks `q` questions, each of the form *how much did the shop take from day `l` to day `r`, both included?* Answer every question.",
      "inputFormat": "The first line has `n` and `q`. The second has the `n` takings `a1 … an`. Each of the next `q` lines has `l` and `r`.",
      "outputFormat": "`q` lines: the total takings for each question.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ q ≤ 2·10^4, −10^9 ≤ ai ≤ 10^9, 1 ≤ l ≤ r ≤ n",
      "tests": [
        {
          "id": "e1",
          "input": "5 3\n1 2 3 4 5\n1 3\n2 5\n4 4\n",
          "expected": "6\n14\n4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3 2\n10 -5 7\n1 1\n1 3\n",
          "expected": "10\n12\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "1 5\n-4\n1 1\n1 1\n1 1\n1 1\n1 1\n",
          "expected": "-4\n-4\n-4\n-4\n-4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "2 3\n-1 7\n2 2\n2 2\n2 2\n",
          "expected": "7\n7\n7\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "5 4\n-15 -14 -3 -18 -11\n2 2\n4 4\n5 5\n2 5\n",
          "expected": "-14\n-18\n-11\n-46\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "5 2\n16 -15 3 14 -18\n4 4\n2 4\n",
          "expected": "14\n2\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Build prefix sums p[i] = a1 + … + ai once, in O(n). The answer to (l, r) is p[r] − p[l−1], so each question is O(1). The totals can reach 10^14, so they need 64-bit integers.",
      "optimalTime": "O(n + q)",
      "bruteTime": "O(n·q)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, q = int(d[0]), int(d[1])\n    p = [0] * (n + 1)\n    for i in range(n):\n        p[i + 1] = p[i] + int(d[2 + i])\n    out = []\n    k = 2 + n\n    for _ in range(q):\n        l, r = int(d[k]), int(d[k + 1])\n        k += 2\n        out.append(p[r] - p[l - 1])\n    print(\"\\n\".join(map(str, out)))\nmain()\n"
    },
    {
      "slug": "best-streak-sum",
      "title": "Best streak",
      "difficulty": "medium",
      "tags": [
        "kadane",
        "dynamic programming",
        "arrays"
      ],
      "statement": "A trader wrote down the profit or loss of each day. Find the largest total of any run of one or more consecutive days.",
      "inputFormat": "The first line has `n`. The second has `n` integers, the profit (or, when negative, the loss) of each day.",
      "outputFormat": "One integer: the largest total of a run of consecutive days.",
      "constraints": "1 ≤ n ≤ 10^5, −10^9 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "6\n-2 3 -1 4 -6 2\n",
          "expected": "6\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n-5 -2 -8\n",
          "expected": "-2\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5\n2 -11 10 -10 -8\n",
          "expected": "10\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "7\n-1 11 -2 -10 10 2 2\n",
          "expected": "14\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "8\n0 -3 -7 -5 2 -10 -7 -13\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6\n14 12 8 -2 11 7\n",
          "expected": "50\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "4\n-1 -2 -3 50\n",
          "expected": "50\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Kadane: walk the days keeping the best total of a run ending today, which is today's value plus yesterday's best if that was positive. The answer is the largest of these. Start from the first day, not from 0, so an all-negative input answers its largest value. Totals reach 10^14: use 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = list(map(int, d[1:1 + n]))\n    best = cur = a[0]\n    for x in a[1:]:\n        cur = x if cur < 0 else cur + x\n        if cur > best:\n            best = cur\n    print(best)\nmain()\n"
    },
    {
      "slug": "pairs-with-target-sum",
      "title": "Pairs that make the target",
      "difficulty": "easy",
      "tags": [
        "hashing",
        "counting"
      ],
      "statement": "Given `n` numbers and a target `T`, count the pairs of positions `i < j` whose numbers add up to exactly `T`.",
      "inputFormat": "The first line has `n` and `T`. The second has the `n` numbers.",
      "outputFormat": "One integer: the number of pairs.",
      "constraints": "2 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9, 2 ≤ T ≤ 2·10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5 6\n1 5 3 3 2\n",
          "expected": "2\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4 4\n2 2 2 2\n",
          "expected": "6\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "9 2\n5 2 5 6 2 3 4 2 5\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "9 2\n2 3 5 5 3 5 2 2 2\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "5 7\n1 5 3 5 4\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "8 4\n5 3 6 6 6 4 5 6\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Walk left to right with a count of each value seen so far. For each number x, the pairs it closes are the earlier numbers equal to T − x: add their count, then count x. One pass, O(n). With 10^5 numbers the answer can reach about 5·10^9, beyond a 32-bit int.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\nfrom collections import defaultdict\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, t = int(d[0]), int(d[1])\n    seen = defaultdict(int)\n    ans = 0\n    for i in range(n):\n        x = int(d[2 + i])\n        ans += seen[t - x]\n        seen[x] += 1\n    print(ans)\nmain()\n"
    },
    {
      "slug": "count-inversions",
      "title": "Out-of-order pairs",
      "difficulty": "hard",
      "tags": [
        "merge sort",
        "fenwick tree",
        "counting"
      ],
      "statement": "A list of `n` numbers is to be sorted in increasing order. Count the pairs of positions `i < j` that are out of order, where `ai > aj`.",
      "inputFormat": "The first line has `n`. The second has the `n` numbers.",
      "outputFormat": "One integer: the number of out-of-order pairs.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5\n3 1 2 5 4\n",
          "expected": "3\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4\n2 2 1 1\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "6\n5 5 1 1 1 2\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "4\n4 2 1 3\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "2\n1 3\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6\n5 1 5 1 3 5\n",
          "expected": "5\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Count while merge-sorting: when an element of the right half is taken before the remaining elements of the left half, each of those is out of order with it. Or walk left to right with a Fenwick tree over compressed values, counting earlier elements strictly greater. O(n log n). Up to n(n−1)/2 ≈ 5·10^9 pairs: 64-bit.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = list(map(int, d[1:1 + n]))\n    vals = sorted(set(a))\n    idx = {v: i + 1 for i, v in enumerate(vals)}\n    m = len(vals)\n    bit = [0] * (m + 1)\n    inv = 0\n    for i, x in enumerate(a):\n        k = idx[x]\n        s = 0\n        j = k\n        while j > 0:\n            s += bit[j]\n            j -= j & -j\n        inv += i - s\n        j = k\n        while j <= m:\n            bit[j] += 1\n            j += j & -j\n    print(inv)\nmain()\n"
    },
    {
      "slug": "longest-window-under-budget",
      "title": "Longest trip under budget",
      "difficulty": "medium",
      "tags": [
        "sliding window",
        "two pointers"
      ],
      "statement": "Stops on a highway charge a toll each. A driver may start at any stop and continue through consecutive stops while the total toll stays at most the budget `B`. What is the largest number of stops the driver can pass through?",
      "inputFormat": "The first line has `n` and `B`. The second has the `n` tolls.",
      "outputFormat": "One integer: the most consecutive stops whose tolls total at most `B` (0 if none).",
      "constraints": "1 ≤ n ≤ 10^5, 0 ≤ tolli ≤ 10^9, 0 ≤ B ≤ 10^14",
      "tests": [
        {
          "id": "e1",
          "input": "6 10\n2 3 5 1 1 8\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3 1\n5 6 7\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "1 6\n6\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "9 15\n3 4 8 1 0 6 5 2 0\n",
          "expected": "6\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "3 8\n3 1 2\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "5 7\n4 5 8 1 0\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Tolls are never negative, so a sliding window works: extend the right end, and while the total exceeds B move the left end forward. The window length after each step is a candidate. O(n). The window total can reach 10^14: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, b = int(d[0]), int(d[1])\n    a = list(map(int, d[2:2 + n]))\n    left = 0\n    total = 0\n    best = 0\n    for right in range(n):\n        total += a[right]\n        while total > b:\n            total -= a[left]\n            left += 1\n        if right - left + 1 > best:\n            best = right - left + 1\n    print(best)\nmain()\n"
    },
    {
      "slug": "closest-pair-gap",
      "title": "Closest pair",
      "difficulty": "easy",
      "tags": [
        "sorting"
      ],
      "statement": "Given `n` numbers, find the smallest difference between any two of them (at different positions).",
      "inputFormat": "The first line has `n`. The second has the `n` numbers.",
      "outputFormat": "One integer: the smallest |ai − aj| over i ≠ j.",
      "constraints": "2 ≤ n ≤ 10^5, −2·10^9 ≤ ai ≤ 2·10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5\n8 1 14 6 20\n",
          "expected": "2\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n-4 9 -4\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "9\n27 -2 -9 -7 -2 -29 -13 -27 15\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "2\n-25 -29\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "7\n0 -16 -4 -5 9 -25 -22\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "2\n19 -20\n",
          "expected": "39\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "2\n-2000000000 2000000000\n",
          "expected": "4000000000\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x2",
          "input": "4\n1 10 30 31\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Sort; the closest pair are neighbours in sorted order, so the answer is the smallest difference of adjacent values. O(n log n). A difference can be up to 4·10^9, which does not fit a 32-bit int.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = sorted(map(int, d[1:1 + n]))\n    print(min(a[i + 1] - a[i] for i in range(n - 1)))\nmain()\n"
    },
    {
      "slug": "subarrays-summing-to-k",
      "title": "Stretches that sum to K",
      "difficulty": "medium",
      "tags": [
        "prefix sums",
        "hashing"
      ],
      "statement": "Count the non-empty stretches of consecutive numbers whose sum is exactly `K`.",
      "inputFormat": "The first line has `n` and `K`. The second has the `n` numbers.",
      "outputFormat": "One integer: the number of stretches.",
      "constraints": "1 ≤ n ≤ 10^5, −10^4 ≤ ai ≤ 10^4, −10^9 ≤ K ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5 3\n1 2 1 2 1\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4 0\n1 -1 1 -1\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "3 4\n3 0 3\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "8 4\n1 3 3 -2 3 -1 0 1\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "2 1\n3 -1\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "1 3\n-1\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "3 5\n5 1 1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "A stretch (i, j] sums to K exactly when prefix[j] − prefix[i] = K. Walk left to right counting how often each prefix sum has appeared, starting with prefix 0 seen once; for each new prefix p, add the count of p − K. O(n). The count can reach n(n+1)/2 ≈ 5·10^9: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\nfrom collections import defaultdict\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, k = int(d[0]), int(d[1])\n    seen = defaultdict(int)\n    seen[0] = 1\n    p = 0\n    ans = 0\n    for i in range(n):\n        p += int(d[2 + i])\n        ans += seen[p - k]\n        seen[p] += 1\n    print(ans)\nmain()\n"
    },
    {
      "slug": "largest-pair-product",
      "title": "Largest pair product",
      "difficulty": "easy",
      "tags": [
        "sorting",
        "math"
      ],
      "statement": "Pick two numbers at different positions so that their product is as large as possible. Print that product.",
      "inputFormat": "The first line has `n`. The second has the `n` numbers.",
      "outputFormat": "One integer: the largest product of two of the numbers.",
      "constraints": "2 ≤ n ≤ 10^5, −10^9 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "4\n3 -7 5 -8\n",
          "expected": "56\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n1 2 3\n",
          "expected": "6\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "9\n-7 4 11 -6 -3 1 -5 2 -11\n",
          "expected": "77\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "9\n12 -8 -3 2 -5 -1 1 1 12\n",
          "expected": "144\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "6\n-2 -3 -11 2 -2 8\n",
          "expected": "33\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "8\n-4 3 -11 9 -4 1 -6 0\n",
          "expected": "66\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "3\n9 1 7\n",
          "expected": "63\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "The largest product is either the two largest numbers multiplied or the two smallest (two negatives make a positive). Find them in one pass, or sort. The product can reach 10^18: it needs 64-bit, and the multiplication itself must be done in 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = sorted(map(int, d[1:1 + n]))\n    print(max(a[0] * a[1], a[-1] * a[-2]))\nmain()\n"
    },
    {
      "slug": "total-pairwise-distance",
      "title": "Total distance between houses",
      "difficulty": "medium",
      "tags": [
        "sorting",
        "prefix sums",
        "math"
      ],
      "statement": "`n` houses stand on a straight road, house `i` at position `ai`. Find the sum of the distances between every pair of houses.",
      "inputFormat": "The first line has `n`. The second has the `n` positions.",
      "outputFormat": "One integer: the sum of |ai − aj| over all pairs i < j.",
      "constraints": "2 ≤ n ≤ 10^5, 0 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "3\n1 4 2\n",
          "expected": "6\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4\n5 5 5 5\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "8\n5 0 10 11 6 7 0 19\n",
          "expected": "204\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "7\n12 18 17 20 13 16 16\n",
          "expected": "70\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "6\n19 15 15 20 17 9\n",
          "expected": "69\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "8\n2 10 8 8 17 9 5 18\n",
          "expected": "179\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Sort. The i-th house (0-based) is to the right of i houses, so it adds i·ai minus the sum of the positions before it. Keep a running prefix sum: O(n log n). The total can reach about 1.7·10^18: 64-bit, with the multiplication done in 64-bit.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = sorted(map(int, d[1:1 + n]))\n    total = 0\n    before = 0\n    for i, x in enumerate(a):\n        total += x * i - before\n        before += x\n    print(total)\nmain()\n"
    },
    {
      "slug": "slowest-eating-speed",
      "title": "Slowest steady speed",
      "difficulty": "medium",
      "tags": [
        "binary search"
      ],
      "statement": "A reader has `n` books with `pi` pages and `H` hours. Each hour they read up to `k` pages of a single book (if a book has fewer pages left, the rest of that hour is unused). Find the smallest `k` that lets them finish every book within `H` hours.",
      "inputFormat": "The first line has `n` and `H`. The second has the `n` page counts.",
      "outputFormat": "One integer: the smallest speed `k`.",
      "constraints": "1 ≤ n ≤ 10^5, n ≤ H ≤ 10^14, 1 ≤ pi ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "4 8\n3 6 7 11\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3 3\n5 9 2\n",
          "expected": "9\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5 9\n9 17 17 15 9\n",
          "expected": "9\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "3 4\n16 16 1\n",
          "expected": "16\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "6 11\n19 7 8 12 3 15\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "3 9\n12 14 2\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "2 2\n7 3\n",
          "expected": "7\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x2",
          "input": "3 3000000000\n1000000000 1000000000 1000000000\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "The hours needed, sum of ceil(pi / k), only fall as k grows, so binary search k between 1 and max(pi). Each check is O(n): O(n log max p). H can be up to 10^14 and at k = 1 the hours are the total pages, also up to 10^14: keep both in 64-bit.",
      "optimalTime": "O(n log max p)",
      "bruteTime": "O(n · answer)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, h = int(d[0]), int(d[1])\n    p = list(map(int, d[2:2 + n]))\n    lo, hi = 1, max(p)\n    while lo < hi:\n        k = (lo + hi) // 2\n        hours = 0\n        for x in p:\n            hours += (x + k - 1) // k\n        if hours <= h:\n            hi = k\n        else:\n            lo = k + 1\n    print(lo)\nmain()\n"
    },
    {
      "slug": "trapped-rainwater",
      "title": "Rain between walls",
      "difficulty": "hard",
      "tags": [
        "two pointers",
        "prefix maximum"
      ],
      "statement": "A row of `n` walls stands side by side, wall `i` of height `hi` and width 1. After heavy rain, water settles wherever walls on both sides are taller. How much water is held in all?",
      "inputFormat": "The first line has `n`. The second has the `n` heights.",
      "outputFormat": "One integer: the total units of water held.",
      "constraints": "1 ≤ n ≤ 10^5, 0 ≤ hi ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "6\n3 0 2 0 4 1\n",
          "expected": "7\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n1 2 3\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "8\n5 4 0 6 0 6 0 3\n",
          "expected": "15\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "5\n1 6 0 3 2\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "5\n6 3 4 2 0\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "4\n4 1 2 1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "4\n3 0 0 3\n",
          "expected": "6\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Water above wall i is min(tallest wall to its left, tallest to its right) − hi. Two pointers from both ends, always moving the side with the lower maximum, give it in one pass with O(1) memory; prefix and suffix maxima give it in O(n) memory. The total reaches about 10^14: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    h = list(map(int, d[1:1 + n]))\n    l, r = 0, n - 1\n    lm = rm = 0\n    water = 0\n    while l < r:\n        if h[l] < h[r]:\n            lm = max(lm, h[l])\n            water += lm - h[l]\n            l += 1\n        else:\n            rm = max(rm, h[r])\n            water += rm - h[r]\n            r -= 1\n    print(water)\nmain()\n"
    },
    {
      "slug": "wait-for-warmer",
      "title": "Waiting for a warmer day",
      "difficulty": "medium",
      "tags": [
        "monotonic stack"
      ],
      "statement": "For each of `n` days you know the temperature. For every day, count the days until a strictly warmer day comes (0 if none comes). Print the sum of these waits.",
      "inputFormat": "The first line has `n`. The second has the `n` temperatures.",
      "outputFormat": "One integer: the sum over all days of the wait for a warmer day.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ ti ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "6\n30 28 31 29 29 35\n",
          "expected": "9\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n5 5 5\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "6\n3 2 4 1 5 6\n",
          "expected": "7\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "1\n3\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "9\n3 5 1 1 3 4 4 1 4\n",
          "expected": "6\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "4\n4 6 6 4\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Keep a stack of days still waiting, with temperatures that do not increase from bottom to top. When a warmer day arrives, pop every colder day and add today − that day. Each day is pushed and popped once: O(n). The sum can reach n(n−1)/2 ≈ 5·10^9: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    t = list(map(int, d[1:1 + n]))\n    st = []\n    total = 0\n    for i, x in enumerate(t):\n        while st and t[st[-1]] < x:\n            total += i - st.pop()\n        st.append(i)\n    print(total)\nmain()\n"
    },
    {
      "slug": "largest-rectangle-histogram",
      "title": "Biggest poster",
      "difficulty": "hard",
      "tags": [
        "monotonic stack"
      ],
      "statement": "A wall is made of `n` columns of width 1 and heights `hi`. Find the area of the largest rectangle that fits entirely on the wall (its sides parallel to the columns).",
      "inputFormat": "The first line has `n`. The second has the `n` heights.",
      "outputFormat": "One integer: the largest area.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ hi ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "6\n2 1 5 6 2 3\n",
          "expected": "10\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n4 4 4\n",
          "expected": "12\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "8\n4 6 6 3 7 6 2 7\n",
          "expected": "18\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "9\n2 6 7 2 6 2 2 3 2\n",
          "expected": "18\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "8\n5 1 7 5 6 6 2 7\n",
          "expected": "20\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6\n6 2 6 4 5 2\n",
          "expected": "12\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "For each column, the widest rectangle of its height reaches to the nearest lower column on each side. A stack of increasing heights finds both in one pass: when a lower column arrives, pop the taller ones and measure their rectangles. O(n). Areas reach about 10^14: 64-bit, including the multiplication.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    h = list(map(int, d[1:1 + n])) + [0]\n    st = []\n    best = 0\n    for i, x in enumerate(h):\n        start = i\n        while st and st[-1][1] >= x:\n            idx, hh = st.pop()\n            best = max(best, hh * (i - idx))\n            start = idx\n        st.append((start, x))\n    print(best)\nmain()\n"
    },
    {
      "slug": "distinct-in-windows",
      "title": "Variety in every window",
      "difficulty": "medium",
      "tags": [
        "sliding window",
        "hashing"
      ],
      "statement": "For every window of `k` consecutive numbers in a list of `n`, count how many different numbers it contains. Print the sum of these counts over all windows.",
      "inputFormat": "The first line has `n` and `k`. The second has the `n` numbers.",
      "outputFormat": "One integer: the sum over all windows of the number of distinct values.",
      "constraints": "1 ≤ k ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "6 3\n1 2 1 3 3 2\n",
          "expected": "9\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4 4\n7 7 7 7\n",
          "expected": "1\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "8 7\n1 4 2 4 4 4 1 4\n",
          "expected": "6\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "5 5\n2 2 3 3 4\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "9 2\n4 1 2 2 4 2 2 4 1\n",
          "expected": "14\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "8 3\n1 1 1 2 2 3 4 1\n",
          "expected": "13\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Slide the window one step at a time, keeping a count of each value inside it and the number of values whose count is positive. Adding the new element and removing the old one change it in O(1). O(n) in all. The sum can reach (n−k+1)·k ≈ 2.5·10^9: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n·k)",
      "reference": "import sys\nfrom collections import defaultdict\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, k = int(d[0]), int(d[1])\n    a = d[2:2 + n]\n    cnt = defaultdict(int)\n    distinct = 0\n    total = 0\n    for i in range(n):\n        x = a[i]\n        cnt[x] += 1\n        if cnt[x] == 1:\n            distinct += 1\n        if i >= k:\n            y = a[i - k]\n            cnt[y] -= 1\n            if cnt[y] == 0:\n                distinct -= 1\n        if i >= k - 1:\n            total += distinct\n    print(total)\nmain()\n"
    },
    {
      "slug": "double-trouble-pairs",
      "title": "More than double",
      "difficulty": "hard",
      "tags": [
        "merge sort",
        "fenwick tree",
        "counting"
      ],
      "statement": "Count the pairs of positions `i < j` where the earlier number is more than twice the later one: `ai > 2·aj`.",
      "inputFormat": "The first line has `n`. The second has the `n` numbers.",
      "outputFormat": "One integer: the number of such pairs.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 2·10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5\n1 3 2 3 1\n",
          "expected": "2\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4\n9 4 2 1\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "6\n3 3 4 5 2 3\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "4\n3 6 6 1\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "4\n1 6 1 4\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "9\n6 3 6 6 2 1 5 3 2\n",
          "expected": "11\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Merge-sort counting: after both halves are sorted, for each element of the right half count the left-half elements greater than twice it with a pointer that only moves forward; then merge. O(n log n). Or a Fenwick tree over sorted values. Twice a value can be 4·10^9: compare in 64-bit.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\nfrom bisect import bisect_left, bisect_right\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = list(map(int, d[1:1 + n]))\n    vals = sorted(set(a))\n    m = len(vals)\n    bit = [0] * (m + 1)\n    ans = 0\n    for i, x in enumerate(a):\n        j = bisect_right(vals, 2 * x)\n        s = 0\n        while j > 0:\n            s += bit[j]\n            j -= j & -j\n        ans += i - s\n        k = bisect_left(vals, x) + 1\n        while k <= m:\n            bit[k] += 1\n            k += k & -k\n    print(ans)\nmain()\n"
    },
    {
      "slug": "two-lists-budget",
      "title": "Lunch within budget",
      "difficulty": "medium",
      "tags": [
        "two pointers",
        "sorting"
      ],
      "statement": "A canteen has `n` mains and `m` desserts, each list given in non-decreasing order of price. Count the (main, dessert) choices whose total price is at most `T`.",
      "inputFormat": "The first line has `n`, `m` and `T`. The second has the `n` main prices, the third the `m` dessert prices, both sorted.",
      "outputFormat": "One integer: the number of affordable pairs.",
      "constraints": "1 ≤ n, m ≤ 10^5, 1 ≤ prices ≤ 1.5·10^9, 1 ≤ T ≤ 3·10^9",
      "tests": [
        {
          "id": "e1",
          "input": "3 3 10\n2 5 8\n1 4 9\n",
          "expected": "5\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2 2 1\n5 6\n7 8\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5 2 15\n7 8 8 8 10\n4 10\n",
          "expected": "5\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "1 4 19\n7\n1 3 9 10\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "2 6 2\n5 8\n1 5 5 7 9 9\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "4 2 15\n1 6 7 9\n2 3\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Walk the mains upward with a pointer on the desserts that only moves down: for each main, drop desserts while the pair is over budget; everything left is affordable. O(n + m). Prices add to 3·10^9 and the count reaches 10^10: 64-bit for both.",
      "optimalTime": "O(n + m)",
      "bruteTime": "O(n·m)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, m, t = int(d[0]), int(d[1]), int(d[2])\n    a = list(map(int, d[3:3 + n]))\n    b = list(map(int, d[3 + n:3 + n + m]))\n    j = m - 1\n    ans = 0\n    for x in a:\n        while j >= 0 and x + b[j] > t:\n            j -= 1\n        ans += j + 1\n    print(ans)\nmain()\n"
    },
    {
      "slug": "union-length",
      "title": "Road under repair",
      "difficulty": "medium",
      "tags": [
        "sorting",
        "intervals"
      ],
      "statement": "`n` repair crews each work on a stretch `[l, r)` of a long road (metres from the start). Stretches may overlap. How many metres of road are under repair in all?",
      "inputFormat": "The first line has `n`. Each of the next `n` lines has `l` and `r`.",
      "outputFormat": "One integer: the total length covered by at least one stretch.",
      "constraints": "1 ≤ n ≤ 10^5, 0 ≤ l < r ≤ 4·10^9",
      "tests": [
        {
          "id": "e1",
          "input": "3\n1 5\n3 8\n10 12\n",
          "expected": "9\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2\n0 10\n2 3\n",
          "expected": "10\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "1\n4 7\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "2\n14 18\n0 4\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "2\n0 16\n9 14\n",
          "expected": "16\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "1\n1 3\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Sort the stretches by start and sweep, keeping the current merged stretch; when the next one starts after its end, add the merged length and start a new one. O(n log n). Positions go up to 4·10^9 and the total is as large: 64-bit.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    iv = sorted((int(d[1 + 2 * i]), int(d[2 + 2 * i])) for i in range(n))\n    total = 0\n    cl, cr = iv[0]\n    for l, r in iv[1:]:\n        if l > cr:\n            total += cr - cl\n            cl, cr = l, r\n        elif r > cr:\n            cr = r\n    total += cr - cl\n    print(total)\nmain()\n"
    },
    {
      "slug": "best-k-window",
      "title": "Best week",
      "difficulty": "easy",
      "tags": [
        "sliding window"
      ],
      "statement": "Given daily sales for `n` days, find the largest total over any `k` consecutive days.",
      "inputFormat": "The first line has `n` and `k`. The second has the `n` daily sales.",
      "outputFormat": "One integer: the largest sum of `k` consecutive days.",
      "constraints": "1 ≤ k ≤ n ≤ 10^5, 0 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "7 3\n1 4 2 10 2 3 1\n",
          "expected": "16\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3 3\n5 5 5\n",
          "expected": "15\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "4 2\n7 0 0 8\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "2 2\n8 0\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "5 3\n9 0 2 8 7\n",
          "expected": "17\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "1 1\n2\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "4 2\n1 1 1 9\n",
          "expected": "10\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Take the sum of the first k days, then slide: add the next day and drop the oldest. Track the best. O(n). Sums reach 10^14: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n·k)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, k = int(d[0]), int(d[1])\n    a = list(map(int, d[2:2 + n]))\n    s = sum(a[:k])\n    best = s\n    for i in range(k, n):\n        s += a[i] - a[i - k]\n        if s > best:\n            best = s\n    print(best)\nmain()\n"
    },
    {
      "slug": "sum-of-window-minimums",
      "title": "Sum of the smallest",
      "difficulty": "hard",
      "tags": [
        "monotonic stack",
        "math"
      ],
      "statement": "For every non-empty stretch of consecutive numbers in a list, take its smallest number. Print the sum of all these smallest numbers, modulo `10^9 + 7`.",
      "inputFormat": "The first line has `n`. The second has the `n` numbers.",
      "outputFormat": "One integer: the sum of the minimum of every stretch, modulo 1000000007.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "4\n3 1 2 4\n",
          "expected": "17\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n2 2 2\n",
          "expected": "12\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "8\n3 4 2 3 3 2 4 4\n",
          "expected": "85\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "1\n2\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "6\n4 1 1 3 1 1\n",
          "expected": "26\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "7\n4 3 2 1 4 3 3\n",
          "expected": "51\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Count, for each ai, the stretches where it is the (leftmost) minimum: it reaches left to the previous element ≤ ai and right to the next element < ai, found with monotonic stacks. It contributes ai · left · right. O(n). Multiply in 64-bit and reduce modulo 10^9+7 after each product.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = list(map(int, d[1:1 + n]))\n    mod = 10**9 + 7\n    left = [0] * n\n    st = []\n    for i in range(n):\n        while st and a[st[-1]] > a[i]:\n            st.pop()\n        left[i] = i - (st[-1] if st else -1)\n        st.append(i)\n    right = [0] * n\n    st = []\n    for i in range(n - 1, -1, -1):\n        while st and a[st[-1]] >= a[i]:\n            st.pop()\n        right[i] = (st[-1] if st else n) - i\n        st.append(i)\n    print(sum(a[i] * left[i] * right[i] for i in range(n)) % mod)\nmain()\n"
    },
    {
      "slug": "staircase-ways",
      "title": "Ways up the stairs",
      "difficulty": "medium",
      "tags": [
        "dynamic programming",
        "prefix sums"
      ],
      "statement": "You climb a staircase of `n` steps, taking between 1 and `k` steps at a time. In how many different ways can you reach the top? Print the count modulo `10^9 + 7`.",
      "inputFormat": "One line with `n` and `k`.",
      "outputFormat": "One integer: the number of ways, modulo 1000000007.",
      "constraints": "1 ≤ n, k ≤ 10^5",
      "tests": [
        {
          "id": "e1",
          "input": "4 2\n",
          "expected": "5\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3 3\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5 4\n",
          "expected": "15\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "4 4\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "11 4\n",
          "expected": "773\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6 3\n",
          "expected": "24\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "ways[i] is the sum of ways[i−1] … ways[i−k]. Keep prefix sums of ways so each step is a subtraction: O(n). Reduce every value, prefix sums included, modulo 10^9+7; left unreduced, the prefix sums pass 2^31 quickly.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n·k)",
      "reference": "import sys\ndef main():\n    n, k = map(int, sys.stdin.read().split())\n    mod = 10**9 + 7\n    dp = [0] * (n + 1)\n    pre = [0] * (n + 2)\n    dp[0] = 1\n    pre[1] = 1\n    for i in range(1, n + 1):\n        lo = max(0, i - k)\n        dp[i] = (pre[i] - pre[lo]) % mod\n        pre[i + 1] = (pre[i] + dp[i]) % mod\n    print(dp[n])\nmain()\n"
    },
    {
      "slug": "heaviest-square",
      "title": "Richest plot",
      "difficulty": "medium",
      "tags": [
        "prefix sums",
        "2d arrays"
      ],
      "statement": "A field is divided into an `n × m` grid; each cell has a yield. Find the `k × k` square of cells with the largest total yield.",
      "inputFormat": "The first line has `n`, `m` and `k`. Each of the next `n` lines has `m` yields.",
      "outputFormat": "One integer: the largest total of a `k × k` square.",
      "constraints": "1 ≤ k ≤ min(n, m), n, m ≤ 500, 0 ≤ yield ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "3 3 2\n1 2 3\n4 5 6\n7 8 9\n",
          "expected": "28\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2 3 1\n4 0 2\n1 1 1\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "1 1 1\n1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "3 1 1\n3\n1\n4\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "2 1 1\n0\n0\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "3 3 3\n4 1 4\n8 2 3\n8 1 2\n",
          "expected": "33\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "3 3 2\n0 0 0\n0 5 5\n0 5 5\n",
          "expected": "20\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Build 2-D prefix sums P, where P[i][j] is the total of the top-left i × j block. Any k × k square's total is then four look-ups: P[i][j] − P[i−k][j] − P[i][j−k] + P[i−k][j−k]. O(n·m). Totals reach k²·10^9: 64-bit.",
      "optimalTime": "O(n·m)",
      "bruteTime": "O(n·m·k^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, m, k = int(d[0]), int(d[1]), int(d[2])\n    P = [[0] * (m + 1)]\n    pos = 3\n    for i in range(n):\n        prev = P[-1]\n        row = [0] * (m + 1)\n        run = 0\n        for j in range(m):\n            run += int(d[pos])\n            pos += 1\n            row[j + 1] = prev[j + 1] + run\n        P.append(row)\n    best = 0\n    for i in range(k, n + 1):\n        a, b = P[i], P[i - k]\n        for j in range(k, m + 1):\n            s = a[j] - b[j] - a[j - k] + b[j - k]\n            if s > best:\n                best = s\n    print(best)\nmain()\n"
    },
    {
      "slug": "grid-paths-with-blocks",
      "title": "Paths through the market",
      "difficulty": "medium",
      "tags": [
        "dynamic programming",
        "grids"
      ],
      "statement": "A market is an `n × m` grid; `#` cells are stalls you cannot walk through, `.` cells are open. Starting at the top-left cell and moving only right or down, how many ways reach the bottom-right cell? Print the count modulo `10^9 + 7`.",
      "inputFormat": "The first line has `n` and `m`. Each of the next `n` lines is a string of `m` characters, `.` or `#`.",
      "outputFormat": "One integer: the number of paths modulo 1000000007 (0 if the start or end is blocked).",
      "constraints": "1 ≤ n, m ≤ 600",
      "tests": [
        {
          "id": "e1",
          "input": "3 3\n...\n.#.\n...\n",
          "expected": "2\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2 2\n.#\n#.\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5 2\n..\n..\n.#\n..\n..\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "2 4\n....\n....\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "4 1\n.\n#\n.\n.\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "2 2\n..\n..\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "ways[i][j] = ways[i−1][j] + ways[i][j−1] for an open cell, 0 for a stall, filled row by row: O(n·m). The counts are astronomically large, so reduce modulo 10^9+7 at every step, not only at the end.",
      "optimalTime": "O(n·m)",
      "bruteTime": "O(2^(n+m))",
      "reference": "import sys\ndef main():\n    d = sys.stdin.read().split()\n    n, m = int(d[0]), int(d[1])\n    g = d[2:2 + n]\n    mod = 10**9 + 7\n    row = [0] * m\n    for i in range(n):\n        line = g[i]\n        for j in range(m):\n            if line[j] == \"#\":\n                row[j] = 0\n            elif i == 0 and j == 0:\n                row[j] = 1\n            else:\n                row[j] = (row[j] + (row[j - 1] if j > 0 else 0)) % mod\n    print(row[m - 1])\nmain()\n"
    },
    {
      "slug": "coin-change-ways",
      "title": "Ways to pay",
      "difficulty": "medium",
      "tags": [
        "dynamic programming"
      ],
      "statement": "A shop accepts coins of `c` different values, with as many of each as you like. In how many ways can you pay exactly `A`? Two ways differ if they use a different number of coins of some value (order does not matter). Print the count modulo `10^9 + 7`.",
      "inputFormat": "The first line has `c` and `A`. The second has the `c` coin values, all different.",
      "outputFormat": "One integer: the number of ways, modulo 1000000007.",
      "constraints": "1 ≤ c ≤ 50, 1 ≤ A ≤ 2·10^4, 1 ≤ value ≤ 10^4",
      "tests": [
        {
          "id": "e1",
          "input": "3 5\n1 2 5\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "1 3\n2\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "1 6\n4\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "1 11\n1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "4 9\n2 1 4 3\n",
          "expected": "18\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "2 10\n2 4\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "ways[x] counts the ways to pay x. Take the coins one value at a time, and for each, go through the amounts upward adding ways[x − value] to ways[x]; taking coins in the outer loop counts each combination once. O(c·A), modulo 10^9+7 at each step.",
      "optimalTime": "O(c·A)",
      "bruteTime": "exponential",
      "reference": "import sys\ndef main():\n    d = sys.stdin.read().split()\n    c, a = int(d[0]), int(d[1])\n    coins = list(map(int, d[2:2 + c]))\n    mod = 10**9 + 7\n    ways = [0] * (a + 1)\n    ways[0] = 1\n    for v in coins:\n        for x in range(v, a + 1):\n            ways[x] = (ways[x] + ways[x - v]) % mod\n    print(ways[a])\nmain()\n"
    },
    {
      "slug": "knapsack-max-value",
      "title": "Packing for the fair",
      "difficulty": "medium",
      "tags": [
        "dynamic programming",
        "knapsack"
      ],
      "statement": "A trader can carry at most `W` kilograms. There are `n` goods, the `i`-th weighing `wi` kilograms and worth `vi` rupees; each can be taken once or left. What is the most value the trader can carry?",
      "inputFormat": "The first line has `n` and `W`. Each of the next `n` lines has `wi` and `vi`.",
      "outputFormat": "One integer: the largest total value within the weight limit.",
      "constraints": "1 ≤ n ≤ 100, 1 ≤ W ≤ 10^4, 1 ≤ wi ≤ 10^4, 1 ≤ vi ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "3 5\n1 6\n2 10\n3 12\n",
          "expected": "22\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2 1\n2 5\n3 7\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5 4\n4 14\n3 12\n3 8\n6 11\n3 2\n",
          "expected": "14\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "3 5\n1 14\n6 4\n1 1\n",
          "expected": "15\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "1 3\n2 4\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6 5\n4 3\n6 10\n2 3\n5 5\n1 17\n5 3\n",
          "expected": "20\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "1 5\n5 10\n",
          "expected": "10\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "best[c] is the most value within capacity c. For each good, go through the capacities from W down to wi, taking best[c − wi] + vi when larger; going downward uses each good at most once. O(n·W). Values add up to 10^11: 64-bit.",
      "optimalTime": "O(n·W)",
      "bruteTime": "O(2^n)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, W = int(d[0]), int(d[1])\n    best = [0] * (W + 1)\n    for i in range(n):\n        w, v = int(d[2 + 2 * i]), int(d[3 + 2 * i])\n        for c in range(W, w - 1, -1):\n            t = best[c - w] + v\n            if t > best[c]:\n                best[c] = t\n    print(best[W])\nmain()\n"
    },
    {
      "slug": "pairwise-product-sum",
      "title": "Handshake value",
      "difficulty": "easy",
      "tags": [
        "math",
        "prefix sums"
      ],
      "statement": "`n` guests have values `ai`. Every pair of guests shakes hands once, worth the product of their values. What is the total worth of all handshakes?",
      "inputFormat": "The first line has `n`. The second has the `n` values.",
      "outputFormat": "One integer: the sum of ai·aj over all pairs i < j.",
      "constraints": "2 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^4",
      "tests": [
        {
          "id": "e1",
          "input": "3\n1 2 3\n",
          "expected": "11\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4\n5 5 5 5\n",
          "expected": "150\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "9\n8 9 3 5 8 5 7 8 3\n",
          "expected": "1373\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "3\n9 7 8\n",
          "expected": "191\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "8\n4 9 8 1 9 4 9 8\n",
          "expected": "1150\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "8\n6 8 2 8 6 8 6 1\n",
          "expected": "860\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Walk the guests keeping the sum of the values seen so far; each guest adds its value times that sum. O(n). The total reaches about 5·10^17, and the product value × running sum is past 2^31 too: 64-bit for both.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    total = 0\n    before = 0\n    for i in range(n):\n        x = int(d[1 + i])\n        total += x * before\n        before += x\n    print(total)\nmain()\n"
    },
    {
      "slug": "frequent-value-score",
      "title": "Most valuable repeat",
      "difficulty": "easy",
      "tags": [
        "hashing",
        "counting"
      ],
      "statement": "In a list of `n` numbers, each distinct value `v` scores `v` times the number of times it appears. Print the highest score.",
      "inputFormat": "The first line has `n`. The second has the `n` numbers.",
      "outputFormat": "One integer: the largest value × frequency.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "6\n3 5 3 3 5 1\n",
          "expected": "10\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n7 8 9\n",
          "expected": "9\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "6\n4 5 4 1 1 3\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "1\n3\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "2\n3 1\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "8\n3 4 5 4 2 5 5 2\n",
          "expected": "15\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "4\n1 2 9 9\n",
          "expected": "18\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Count each value with a hash map (or sort and count runs), then take the largest value × count. O(n). The score reaches 10^14: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\nfrom collections import Counter\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    c = Counter(map(int, d[1:1 + n]))\n    print(max(v * k for v, k in c.items()))\nmain()\n"
    },
    {
      "slug": "increasing-triplets",
      "title": "Rising triples",
      "difficulty": "hard",
      "tags": [
        "fenwick tree",
        "counting"
      ],
      "statement": "Count the triples of positions `i < j < k` with `ai < aj < ak`.",
      "inputFormat": "The first line has `n`. The second has the `n` numbers.",
      "outputFormat": "One integer: the number of rising triples.",
      "constraints": "1 ≤ n ≤ 5·10^4, 1 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5\n1 3 2 4 5\n",
          "expected": "7\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4\n2 2 2 3\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "4\n5 2 2 1\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "4\n5 1 5 3\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "1\n5\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "9\n2 2 2 1 2 1 1 1 4\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "3\n1 2 2\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x2",
          "input": "5\n1 3 3 5 2\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Fix the middle element: it forms (smaller elements to its left) × (larger elements to its right) triples. Two passes with a Fenwick tree over compressed values give both counts: O(n log n). The total reaches about 2·10^13: 64-bit.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = list(map(int, d[1:1 + n]))\n    vals = sorted(set(a))\n    idx = {v: i + 1 for i, v in enumerate(vals)}\n    m = len(vals)\n    bit = [0] * (m + 1)\n    smaller = [0] * n\n    for i, x in enumerate(a):\n        k = idx[x] - 1\n        s = 0\n        while k > 0:\n            s += bit[k]\n            k -= k & -k\n        smaller[i] = s\n        k = idx[x]\n        while k <= m:\n            bit[k] += 1\n            k += k & -k\n    bit = [0] * (m + 1)\n    total = 0\n    for i in range(n - 1, -1, -1):\n        x = a[i]\n        k = idx[x]\n        s = 0\n        while k > 0:\n            s += bit[k]\n            k -= k & -k\n        larger = (n - 1 - i) - s\n        total += smaller[i] * larger\n        k = idx[x]\n        while k <= m:\n            bit[k] += 1\n            k += k & -k\n    print(total)\nmain()\n"
    },
    {
      "slug": "make-equal-cost",
      "title": "Level the shelves",
      "difficulty": "easy",
      "tags": [
        "sorting",
        "math"
      ],
      "statement": "`n` shelves hold `ai` books each. Moving one book onto or off a shelf costs 1 (books come from, and go to, a store room). What is the least cost to make every shelf hold the same number of books?",
      "inputFormat": "The first line has `n`. The second has the `n` book counts.",
      "outputFormat": "One integer: the least total cost.",
      "constraints": "1 ≤ n ≤ 10^5, 0 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5\n1 2 3 4 10\n",
          "expected": "11\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2\n4 4\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5\n1 0 11 8 0\n",
          "expected": "19\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "8\n10 8 2 3 1 3 10 12\n",
          "expected": "31\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "1\n9\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6\n5 5 4 2 1 1\n",
          "expected": "10\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "The cost for a target x is the sum of |ai − x|, which is smallest at a median. Sort and take the middle element: O(n log n). The cost reaches about 5·10^13: 64-bit.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = sorted(map(int, d[1:1 + n]))\n    x = a[n // 2]\n    print(sum(abs(v - x) for v in a))\nmain()\n"
    },
    {
      "slug": "paint-houses",
      "title": "Painting the street",
      "difficulty": "medium",
      "tags": [
        "dynamic programming"
      ],
      "statement": "`n` houses in a row are each painted red, green or blue. Painting house `i` a colour has a given cost, and no two neighbouring houses may share a colour. What is the least total cost?",
      "inputFormat": "The first line has `n`. Each of the next `n` lines has three costs: red, green, blue.",
      "outputFormat": "One integer: the least total cost.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ cost ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "3\n17 2 17\n16 16 5\n14 3 19\n",
          "expected": "10\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "1\n5 3 9\n",
          "expected": "3\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "3\n18 7 16\n3 17 12\n13 8 3\n",
          "expected": "13\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "6\n13 2 8\n12 16 20\n3 9 17\n1 10 15\n14 17 4\n19 14 13\n",
          "expected": "42\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "1\n6 3 1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6\n5 9 18\n17 5 8\n19 20 13\n10 13 2\n11 17 13\n1 12 4\n",
          "expected": "46\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Keep, for each colour, the least cost of painting the houses so far with the last one in that colour; each new house takes the cheaper of the other two colours' totals. O(n). Totals reach 10^14: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(3^n · n)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    r, g, b = int(d[1]), int(d[2]), int(d[3])\n    for i in range(1, n):\n        cr, cg, cb = int(d[1 + 3 * i]), int(d[2 + 3 * i]), int(d[3 + 3 * i])\n        r, g, b = cr + min(g, b), cg + min(r, b), cb + min(r, g)\n    print(min(r, g, b))\nmain()\n"
    },
    {
      "slug": "cheapest-route",
      "title": "Cheapest delivery route",
      "difficulty": "hard",
      "tags": [
        "graphs",
        "dijkstra",
        "shortest paths"
      ],
      "statement": "A courier network has `n` towns and `m` two-way roads, each with a toll. Find the least total toll to go from town 1 to town `n`, or print −1 if it cannot be reached.",
      "inputFormat": "The first line has `n` and `m`. Each of the next `m` lines has `u`, `v` and `w`: a road between towns u and v with toll w.",
      "outputFormat": "One integer: the least toll from town 1 to town n, or −1.",
      "constraints": "2 ≤ n ≤ 10^5, 1 ≤ m ≤ 2·10^5, 1 ≤ w ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "4 4\n1 2 5\n2 4 5\n1 3 2\n3 4 9\n",
          "expected": "10\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3 1\n1 2 4\n",
          "expected": "-1\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5 8\n2 2 4\n3 3 6\n3 5 6\n4 1 6\n5 1 7\n3 3 7\n2 4 6\n2 2 2\n",
          "expected": "7\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "4 8\n3 2 4\n4 4 9\n4 1 7\n2 3 3\n3 4 2\n2 4 6\n2 2 9\n4 1 3\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "4 6\n1 4 5\n1 4 6\n2 3 1\n2 3 5\n4 4 6\n3 3 8\n",
          "expected": "5\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "5 5\n5 2 2\n3 2 2\n1 2 6\n2 3 5\n4 4 5\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Dijkstra's algorithm with a binary heap: always settle the unsettled town with the smallest known toll, then relax its roads. O((n + m) log n). Tolls add to about 10^14 along a long route, so distances need 64-bit, and so does the 'infinity'.",
      "optimalTime": "O((n + m) log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\nimport heapq\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, m = int(d[0]), int(d[1])\n    adj = [[] for _ in range(n + 1)]\n    for i in range(m):\n        u, v, w = int(d[2 + 3 * i]), int(d[3 + 3 * i]), int(d[4 + 3 * i])\n        adj[u].append((v, w))\n        adj[v].append((u, w))\n    INF = float(\"inf\")\n    dist = [INF] * (n + 1)\n    dist[1] = 0\n    pq = [(0, 1)]\n    while pq:\n        du, u = heapq.heappop(pq)\n        if du > dist[u]:\n            continue\n        for v, w in adj[u]:\n            nd = du + w\n            if nd < dist[v]:\n                dist[v] = nd\n                heapq.heappush(pq, (nd, v))\n    print(dist[n] if dist[n] != INF else -1)\nmain()\n"
    },
    {
      "slug": "range-min-sum",
      "title": "Coldest days",
      "difficulty": "medium",
      "tags": [
        "sparse table",
        "range queries"
      ],
      "statement": "A weather log has `n` daily temperatures. Each of `q` questions names days `l` to `r` and asks for the lowest temperature in that stretch. Print the sum of the answers to all questions.",
      "inputFormat": "The first line has `n` and `q`. The second has the `n` temperatures. Each of the next `q` lines has `l` and `r` (1-based, inclusive).",
      "outputFormat": "One integer: the sum of the minimums over all questions.",
      "constraints": "1 ≤ n, q ≤ 5·10^4, 1 ≤ l ≤ r ≤ n, 1 ≤ temperature ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5 3\n4 2 7 1 9\n1 3\n3 5\n5 5\n",
          "expected": "12\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3 2\n6 6 6\n1 3\n2 2\n",
          "expected": "12\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "2 1\n1 6\n1 1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "5 2\n18 18 19 8 1\n4 5\n3 4\n",
          "expected": "9\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "4 5\n8 20 9 16\n2 4\n1 4\n3 4\n1 1\n1 1\n",
          "expected": "42\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "8 4\n13 12 7 5 12 9 7 12\n1 5\n2 3\n3 5\n6 8\n",
          "expected": "24\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "The array never changes, so build a sparse table: level j holds the minimum of every block of 2^j days. A query [l, r] is the minimum of two overlapping blocks of length 2^k, where 2^k is the largest power of two within r − l + 1. O(n log n) to build, O(1) per query. The sum reaches 5·10^13: 64-bit.",
      "optimalTime": "O(n log n + q)",
      "bruteTime": "O(n·q)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, q = int(d[0]), int(d[1])\n    a = list(map(int, d[2:2 + n]))\n    sp = [a]\n    j = 1\n    while (1 << j) <= n:\n        prev = sp[-1]\n        h = 1 << (j - 1)\n        sp.append([min(prev[i], prev[i + h]) for i in range(n - (1 << j) + 1)])\n        j += 1\n    total = 0\n    pos = 2 + n\n    for _ in range(q):\n        l, r = int(d[pos]) - 1, int(d[pos + 1]) - 1\n        pos += 2\n        k = (r - l + 1).bit_length() - 1\n        row = sp[k]\n        x, y = row[l], row[r - (1 << k) + 1]\n        total += x if x < y else y\n    print(total)\nmain()\n"
    },
    {
      "slug": "circular-best-streak",
      "title": "Best stretch on the ring road",
      "difficulty": "medium",
      "tags": [
        "kadane",
        "arrays"
      ],
      "statement": "`n` stalls stand in a circle on a ring road; stall `i` made a profit `ai` (possibly negative). Choose a non-empty run of consecutive stalls — it may wrap from the last stall to the first — with the largest total profit. Each stall can be counted at most once.",
      "inputFormat": "The first line has `n`. The second has the `n` profits, in order around the circle.",
      "outputFormat": "One integer: the largest total of a run of consecutive stalls.",
      "constraints": "1 ≤ n ≤ 10^5, −10^9 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5\n5 -3 -4 2 6\n",
          "expected": "13\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n-4 -1 -7\n",
          "expected": "-1\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5\n-3 4 7 -4 -2\n",
          "expected": "11\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "7\n8 9 7 1 -1 4 4\n",
          "expected": "33\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "7\n9 -7 2 -3 -8 -3 -1\n",
          "expected": "9\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "8\n8 -9 -4 9 1 -5 -7 -4\n",
          "expected": "10\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "3\n-1 -2 5\n",
          "expected": "5\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x2",
          "input": "4\n3 -9 -9 4\n",
          "expected": "7\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "A best run either stays inside the array (Kadane's maximum) or wraps around; a wrapping run is everything except a middle run, so its best is the total minus Kadane's minimum. Take the larger — unless every profit is negative, when the answer is the largest single profit. O(n). Totals reach 10^14: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = list(map(int, d[1:1 + n]))\n    best = cur = a[0]\n    worst = low = a[0]\n    for x in a[1:]:\n        cur = max(x, cur + x)\n        best = max(best, cur)\n        low = min(x, low + x)\n        worst = min(worst, low)\n    if best < 0:\n        print(best)\n    else:\n        print(max(best, sum(a) - worst))\nmain()\n"
    },
    {
      "slug": "widest-container",
      "title": "Biggest water tank",
      "difficulty": "medium",
      "tags": [
        "two pointers",
        "greedy"
      ],
      "statement": "`n` walls stand in a line, one metre apart; wall `i` is `hi` metres high. Pick two walls to hold water between them: the tank holds `min(hi, hj) × (j − i)`. What is the most it can hold?",
      "inputFormat": "The first line has `n`. The second has the `n` heights.",
      "outputFormat": "One integer: the largest amount of water.",
      "constraints": "2 ≤ n ≤ 10^5, 1 ≤ hi ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "9\n1 8 6 2 5 4 8 3 7\n",
          "expected": "49\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2\n1 1\n",
          "expected": "1\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "8\n11 1 4 12 5 5 4 6\n",
          "expected": "42\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "9\n5 2 12 1 2 10 4 9 7\n",
          "expected": "45\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "9\n11 4 6 4 3 1 3 5 1\n",
          "expected": "35\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "2\n3 1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "3\n5 1 5\n",
          "expected": "10\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Start with the two outermost walls and move inward. The shorter wall limits the tank, and every other tank that uses it is narrower, so it can be dropped: always move the pointer at the shorter wall. O(n). The amount reaches 10^14: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    h = list(map(int, d[1:1 + n]))\n    i, j = 0, n - 1\n    best = 0\n    while i < j:\n        best = max(best, min(h[i], h[j]) * (j - i))\n        if h[i] < h[j]:\n            i += 1\n        else:\n            j -= 1\n    print(best)\nmain()\n"
    },
    {
      "slug": "nearest-to-zero-pair",
      "title": "Balancing the scales",
      "difficulty": "medium",
      "tags": [
        "two pointers",
        "sorting"
      ],
      "statement": "A merchant has `n` weights, some negative (they lift the pan). Choosing two different weights, how close to zero can their sum be? Print the smallest possible `|ai + aj|`.",
      "inputFormat": "The first line has `n`. The second has the `n` weights.",
      "outputFormat": "One integer: the smallest absolute sum of two different weights.",
      "constraints": "2 ≤ n ≤ 10^5, −1.5·10^9 ≤ ai ≤ 1.5·10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5\n-8 3 5 -2 7\n",
          "expected": "1\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2\n4 9\n",
          "expected": "13\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5\n-4 -9 -4 4 -1\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "9\n-1 6 -3 -4 9 5 -4 -1 -2\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "4\n-9 -2 3 7\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6\n-3 -2 -5 -4 9 7\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "3\n-9 4 -3\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Sort. Put one pointer at each end; if their sum is negative, the left one is too small for every partner, so move it right, otherwise move the right one left. Check each pair on the way. O(n log n). Sums reach 3·10^9, past 32 bits.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    a = sorted(map(int, d[1:1 + n]))\n    i, j = 0, n - 1\n    best = abs(a[0] + a[n - 1])\n    while i < j:\n        s = a[i] + a[j]\n        if abs(s) < best:\n            best = abs(s)\n        if s < 0:\n            i += 1\n        else:\n            j -= 1\n    print(best)\nmain()\n"
    },
    {
      "slug": "running-median-sum",
      "title": "Median of the day",
      "difficulty": "hard",
      "tags": [
        "heaps",
        "median"
      ],
      "statement": "Orders arrive one by one with amounts `a1, a2, …, an`. After each order, the shop notes the median of all amounts so far (for an even count, the smaller of the two middle ones). Print the sum of the `n` medians noted.",
      "inputFormat": "The first line has `n`. The second has the `n` amounts in order.",
      "outputFormat": "One integer: the sum of the medians after each order.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "4\n5 2 8 1\n",
          "expected": "14\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3\n7 7 7\n",
          "expected": "21\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "2\n4 2\n",
          "expected": "6\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "5\n12 4 14 7 18\n",
          "expected": "47\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "6\n20 5 7 9 5 10\n",
          "expected": "53\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "7\n2 5 8 2 13 13 13\n",
          "expected": "29\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Keep the smaller half in a max-heap and the larger half in a min-heap, with the lower half holding one extra when the count is odd. Each new amount goes to one side, then one element moves across if the sizes drift; the median is the top of the lower half. O(n log n). The sum reaches 10^14: 64-bit.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2 log n)",
      "reference": "import sys\nimport heapq\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    lo, hi = [], []\n    total = 0\n    for k in range(n):\n        x = int(d[1 + k])\n        if not lo or x <= -lo[0]:\n            heapq.heappush(lo, -x)\n        else:\n            heapq.heappush(hi, x)\n        if len(lo) > len(hi) + 1:\n            heapq.heappush(hi, -heapq.heappop(lo))\n        elif len(hi) > len(lo):\n            heapq.heappush(lo, -heapq.heappop(hi))\n        total += -lo[0]\n    print(total)\nmain()\n"
    },
    {
      "slug": "small-product-windows",
      "title": "Cheap bundles",
      "difficulty": "medium",
      "tags": [
        "sliding window",
        "two pointers"
      ],
      "statement": "A shelf holds `n` items in a row with price factors `ai`. A bundle is a run of consecutive items; its price is the product of their factors. How many bundles cost strictly less than `K`?",
      "inputFormat": "The first line has `n` and `K`. The second has the `n` factors.",
      "outputFormat": "One integer: the number of bundles with product < K.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 1000, 1 ≤ K ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "4 100\n10 5 2 6\n",
          "expected": "8\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "3 1\n1 2 3\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "2 12\n4 5\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "6 11\n2 4 2 4 1 4\n",
          "expected": "12\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "1 12\n1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "6 4\n4 4 4 4 5 2\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "All factors are at least 1, so extending a bundle never makes it cheaper: slide a window, shrinking from the left while the product is ≥ K. Each right end then adds (window length) bundles. O(n). The count can reach n(n+1)/2 ≈ 5·10^9: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, K = int(d[0]), int(d[1])\n    a = list(map(int, d[2:2 + n]))\n    l = 0\n    prod = 1\n    count = 0\n    for r in range(n):\n        prod *= a[r]\n        while prod >= K and l <= r:\n            prod //= a[l]\n            l += 1\n        count += r - l + 1\n    print(count)\nmain()\n"
    },
    {
      "slug": "range-bonus",
      "title": "Festival bonus",
      "difficulty": "easy",
      "tags": [
        "difference array",
        "prefix sums"
      ],
      "statement": "`n` workers stand in a line with no bonus. The owner issues `q` orders; each gives every worker from `l` to `r` an extra `v` rupees. After all orders, what is the largest bonus any worker has?",
      "inputFormat": "The first line has `n` and `q`. Each of the next `q` lines has `l`, `r` and `v`.",
      "outputFormat": "One integer: the largest final bonus.",
      "constraints": "1 ≤ n, q ≤ 10^5, 1 ≤ l ≤ r ≤ n, 1 ≤ v ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5 3\n1 3 10\n2 5 5\n3 3 1\n",
          "expected": "16\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "2 1\n2 2 7\n",
          "expected": "7\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "6 2\n1 3 1\n2 6 7\n",
          "expected": "8\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "8 1\n4 5 7\n",
          "expected": "7\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "7 1\n5 6 4\n",
          "expected": "4\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "2 2\n2 2 8\n1 1 9\n",
          "expected": "9\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Record each order at its two ends: +v at l and −v just after r. One running sum over the line then gives every worker's bonus: O(n + q). Bonuses reach 10^14: 64-bit.",
      "optimalTime": "O(n + q)",
      "bruteTime": "O(n·q)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, q = int(d[0]), int(d[1])\n    diff = [0] * (n + 2)\n    for k in range(q):\n        l, r, v = int(d[2 + 3 * k]), int(d[3 + 3 * k]), int(d[4 + 3 * k])\n        diff[l] += v\n        diff[r + 1] -= v\n    best = 0\n    run = 0\n    for i in range(1, n + 1):\n        run += diff[i]\n        if run > best:\n            best = run\n    print(best)\nmain()\n"
    },
    {
      "slug": "house-robber",
      "title": "Night watch",
      "difficulty": "easy",
      "tags": [
        "dynamic programming"
      ],
      "statement": "A street has `n` houses in a row, house `i` with `ai` coins. A thief never takes from two neighbouring houses (the alarm links them). What is the most the thief can take?",
      "inputFormat": "The first line has `n`. The second has the `n` amounts.",
      "outputFormat": "One integer: the most coins without taking from two neighbours.",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5\n2 7 9 3 1\n",
          "expected": "12\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "1\n4\n",
          "expected": "4\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "7\n13 9 20 16 2 8 20\n",
          "expected": "55\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "3\n6 8 20\n",
          "expected": "26\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "5\n1 7 11 11 20\n",
          "expected": "32\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "5\n8 17 17 20 13\n",
          "expected": "38\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Walk the street keeping two totals: the best that takes the current house, and the best that skips it. Taking means the previous one was skipped; skipping keeps the better of the two. O(n). Totals reach 5·10^13: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(2^n · n)",
      "reference": "import sys\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    take, skip = 0, 0\n    for i in range(n):\n        x = int(d[1 + i])\n        take, skip = skip + x, max(take, skip)\n    print(max(take, skip))\nmain()\n"
    },
    {
      "slug": "pairs-with-difference",
      "title": "Matching pairs",
      "difficulty": "easy",
      "tags": [
        "hashing",
        "counting"
      ],
      "statement": "Given `n` numbers and `K`, count the pairs of positions `i < j` with `|ai − aj| = K`.",
      "inputFormat": "The first line has `n` and `K`. The second has the `n` numbers.",
      "outputFormat": "One integer: the number of such pairs.",
      "constraints": "2 ≤ n ≤ 10^5, 0 ≤ K ≤ 10^9, 1 ≤ ai ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "5 2\n1 3 5 3 7\n",
          "expected": "5\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "4 0\n2 2 2 5\n",
          "expected": "3\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "5 2\n4 1 2 3 5\n",
          "expected": "3\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "2 3\n4 2\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "3 0\n1 5 3\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "4 3\n1 5 2 4\n",
          "expected": "2\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "x1",
          "input": "3 0\n4 4 1\n",
          "expected": "1\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Count every value. For K > 0, each value v pairs with every copy of v + K: add count[v] · count[v + K]. For K = 0, a value seen c times gives c(c − 1)/2 pairs. O(n). The count can reach 5·10^9, and so can one product: 64-bit.",
      "optimalTime": "O(n)",
      "bruteTime": "O(n^2)",
      "reference": "import sys\nfrom collections import Counter\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n, K = int(d[0]), int(d[1])\n    c = Counter(map(int, d[2:2 + n]))\n    if K == 0:\n        print(sum(k * (k - 1) // 2 for k in c.values()))\n    else:\n        print(sum(k * c.get(v + K, 0) for v, k in c.items()))\nmain()\n"
    },
    {
      "slug": "rope-joining",
      "title": "Joining ropes",
      "difficulty": "medium",
      "tags": [
        "greedy",
        "heaps"
      ],
      "statement": "A boatman has `n` ropes of lengths `li` and wants one long rope. Joining two ropes costs the sum of their lengths, and the result is one rope of that length. What is the least total cost to join them all?",
      "inputFormat": "The first line has `n`. The second has the `n` lengths.",
      "outputFormat": "One integer: the least total cost (0 when there is one rope).",
      "constraints": "1 ≤ n ≤ 10^5, 1 ≤ li ≤ 10^9",
      "tests": [
        {
          "id": "e1",
          "input": "4\n4 3 2 6\n",
          "expected": "29\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "e2",
          "input": "1\n9\n",
          "expected": "0\n",
          "hidden": false,
          "weight": 1
        },
        {
          "id": "s1",
          "input": "1\n14\n",
          "expected": "0\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s2",
          "input": "4\n18 11 19 12\n",
          "expected": "120\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s3",
          "input": "2\n4 19\n",
          "expected": "23\n",
          "hidden": true,
          "weight": 1
        },
        {
          "id": "s4",
          "input": "5\n6 18 15 17 1\n",
          "expected": "121\n",
          "hidden": true,
          "weight": 1
        }
      ],
      "optimal": "Always join the two shortest ropes (the same argument as Huffman coding): keep the ropes in a min-heap, pop two, push their sum. O(n log n). Costs reach about 10^15: 64-bit.",
      "optimalTime": "O(n log n)",
      "bruteTime": "O(n^2 log n)",
      "reference": "import sys\nimport heapq\ndef main():\n    d = sys.stdin.buffer.read().split()\n    n = int(d[0])\n    h = list(map(int, d[1:1 + n]))\n    heapq.heapify(h)\n    cost = 0\n    while len(h) > 1:\n        x = heapq.heappop(h) + heapq.heappop(h)\n        cost += x\n        heapq.heappush(h, x)\n    print(cost)\nmain()\n"
    }
  ]
};
