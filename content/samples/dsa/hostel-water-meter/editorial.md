## Problem

**Given the litres of water a hostel used on each of `n` days, answer `q` questions of the form "how many litres from day `l` to day `r`, both included?"**

```text
Input                          Output
6 3                            200
120 80 0 200 150 90            430
1 3                            200
2 5
4 4
```

Days 1 to 3 used `120 + 80 + 0 = 200` litres. Days 2 to 5 used `80 + 0 + 200 + 150 = 430`. Day 4 alone used `200`.

## Understand The Problem

Let's not jump to code. A system for understanding the problem first means fewer surprises later.

> **Note:** In an interview, ask your questions before you write anything. The answers decide the data types and the algorithm, and asking shows you think about the input, not only the happy path.

Let's break the statement into its **key parts**:

- We get a list of **daily readings**, one per day, in day order.
- We get **many questions**, each a pair `(l, r)`.
- For each question we print **the sum of the readings from day `l` to day `r`, both ends included**.
- Days are numbered **from 1**, not from 0. This is important: our arrays will start at 0.

Before any algorithm, let's write the shape of the function we will fill in:

```python
def range_totals(litres, queries):
    # litres[i] is day i + 1; each query is (l, r), 1-indexed, inclusive
    return [...]  # one total per query, in order
```

We don't know the solution yet, but we know the input, the output, and roughly what the code must do.

### Questions about the readings

- Can the list be empty? **No**, `n ≥ 1`.
- How long can it be? **Up to 50,000 days.**
- Can a reading be zero? **Yes**: the hostel was empty on a holiday. Zero is a normal value.
- Can a reading be negative? **No**, `0 ≤ a_i ≤ 10^6`. A meter does not run backwards.

### Questions about the questions

- How many? **Up to 30,000.** This number matters more than any other, as we will see.
- Can `l` equal `r`? **Yes**: a single day.
- Can `l` be greater than `r`? **No**, `1 ≤ l ≤ r ≤ n`.
- Can the same question repeat? Yes, and it must get the same answer each time.

> **Note:** The questions feel small, but each answer can change the solution. "Can `l > r`?" decides whether we must swap; "can values be negative?" decides whether some shortcuts still work.

### Questions about the output

- One line per question, in the order asked.
- **How big can an answer be?** The biggest is every day at the maximum: `50,000 × 10^6 = 5 · 10^10`. A 32-bit signed integer stops at about `2.1 · 10^9`. **So the totals need 64-bit integers** (`long long` in C and C++, `long` in Java). Python's integers grow as needed, and JavaScript's `Number` is exact up to `2^53 ≈ 9 · 10^15`, so both are safe.

Now we understand the input and the output. Let's find the solution.

## Coming Up With The Solution

Let's collect a few examples first, each for a reason.

**Example 1:** readings `[5]`, question `(1, 1)`. **Why this example?** It is the smallest input that exists. The answer is `5`. If our code fails here, nothing else matters.

**Example 2:** readings `[3, 0, 4, 1]`, questions `(2, 3)` and `(1, 4)`. **Why this example?** A small random case with a zero inside. Answers: `0 + 4 = 4` and `3 + 0 + 4 + 1 = 8`.

**Example 3:** readings `[0, 0, 0]`, question `(1, 3)`. **Why this example?** An edge case where the answer is `0`. Code that prints nothing for a zero total, or treats `0` as "no data", fails here.

**Example 4:** 50,000 readings of `10^6`, and 30,000 questions all `(1, 50000)`. **Why this example?** The largest input: it tests the speed of our method and the size of our numbers at once.

We will work with the first sample from the statement: `[120, 80, 0, 200, 150, 90]` with questions `(1, 3)`, `(2, 5)`, `(4, 4)`. It has a zero, a single-day question, overlapping questions, and it is small enough to keep in our heads.

### Start from index 0

Let's answer the first question by hand, the way a person would. Days 1 to 3 are indexes 0 to 2 of our array:

```text
total = 0
total = 0 + litres[0] = 0 + 120 = 120
total = 120 + litres[1] = 120 + 80 = 200
total = 200 + litres[2] = 200 + 0 = 200   -> answer 200
```

The second question, days 2 to 5, is indexes 1 to 4:

```text
total = 0 + 80 = 80
total = 80 + 0 = 80
total = 80 + 200 = 280
total = 280 + 150 = 430   -> answer 430
```

The third, day 4 alone, is index 3: `200`.

**Observation 1:** day `d` lives at index `d − 1`. Every question `(l, r)` covers indexes `l − 1` to `r − 1`.

**Observation 2:** we added `80` and `0` twice: once for the first question and once for the second. The questions overlap, and we recompute the overlap every time.

### Brute force

What we did by hand is the brute force: for each question, walk from `l` to `r` and add.

```text
for each question (l, r):
    total = 0
    for i from l - 1 to r - 1:
        total += litres[i]
    print total
```

It is correct. How fast is it? One question can cover all `n` days, so one question costs up to `n` additions, and `q` questions cost up to `n × q`. With the limits, that is `50,000 × 30,000 = 1.5 · 10^9` additions.

A judge does about `10^8` simple steps per second in C++ and far fewer in Python. **`1.5 · 10^9` is too slow**: this brute force gets Time Limit Exceeded on the big tests, even though every answer it prints is right.

> **Note:** Always multiply your loops by the limits before you write code. `n × q` here is `1.5 · 10^9`, and that one multiplication tells you the brute force will not pass.

### Which complexity can we hope for?

Let's think about what is possible, from the slowest useful box to the fastest:

- **`O(n × q)`**: the brute force. Too slow.
- **`O(q log n)` after some preparation**: each question answered with a binary search or a tree. Possible, if we can find the structure.
- **`O(n + q)`**: read every reading once, then answer each question in **constant time**. We cannot do better, because we must at least read the input.

So the real question is: **can we prepare something once, in `O(n)`, so that every question takes `O(1)`?**

> **Note:** Don't worry yet about which observation will lead to the answer. Write all of them down; one of them usually does.

### Better: block totals

Before the full trick, there is a middle step worth knowing, because it is the first idea many people find. Cut the days into **blocks** of equal size, say `b` days each, and store each block's total once:

```text
litres:  120  80 | 0  200 | 150  90      (b = 2)
blocks:    200   |  200   |   240
```

Now a question adds **whole blocks** where it can and single days only at its two ragged ends. For `(2, 5)`: day 2 alone (`80`), then the whole middle block (`200`), then day 5 alone (`150`), giving `430`. Three additions instead of four.

How big should `b` be? A question touches at most `n / b` whole blocks and fewer than `2b` loose days. Both are about `√n` when `b ≈ √n`, which is about `224` for `n = 50,000`. So each question costs about `450` steps, and all questions about `30,000 × 450 ≈ 1.4 · 10^7`. That would pass in C++ and probably in Java, and it is a real improvement over `1.5 · 10^9`.

**But it is still not `O(1)` per question**, and it is fiddly: the loose days at both ends, a question inside a single block, the last block being shorter. The block idea is worth remembering for later problems where readings *change* (updating one block total is cheap). For fixed readings, we can do better, and simpler.

### Looking for the trick

Observation 2 said the questions overlap. Let's look at *how* they overlap. Take the totals from day 1 up to each day, the **running totals**:

| day | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| litres | 120 | 80 | 0 | 200 | 150 | 90 |
| total of days 1..day | 120 | 200 | 200 | 400 | 550 | 640 |

Now look at question `(2, 5)`. The total of days 1 to 5 is `550`. That includes day 1, which we do not want. The total of day 1 alone is `120`. So:

```text
days 2..5 = (days 1..5) − (days 1..1) = 550 − 120 = 430
```

That is the right answer, with one subtraction!

**Observation 3:** any range `l..r` equals "everything up to `r`" minus "everything up to `l − 1`". Written as an equation:

```text
sum(l..r) = running(r) − running(l − 1)
```

Let's check it on question `(1, 3)`: `running(3) − running(0)`. But what is `running(0)`? The total of *no* days, which is `0`. So the answer is `200 − 0 = 200`. Correct.

And `(4, 4)`: `running(4) − running(3) = 400 − 200 = 200`. Correct.

### The remaining problems

We found the core idea. Let's list what can still go wrong:

1. **`running(0)` must exist.** If our array of running totals starts at day 1, question `(1, r)` would read before the start.
2. **Indexes are off by one.** Days start at 1, arrays at 0.
3. **The totals overflow 32 bits.**

Problem 1 has a neat fix: make the running-total array **one longer** than the readings, and put `0` at index 0. Call it `prefix`:

```text
prefix[0] = 0
prefix[i] = prefix[i − 1] + litres[i − 1]     for i = 1..n
```

Now `prefix[i]` is exactly "the total of days 1 to `i`", with the day number as the index. That also fixes problem 2: a question `(l, r)` is simply `prefix[r] − prefix[l − 1]`, using the day numbers as they come, with no extra shifting.

Problem 3: store `prefix` as 64-bit integers.

> **Note:** The extra `0` at the front is a common trick for any "prefix" structure. It removes the special case for ranges that start at the beginning, and special cases are where bugs live.

### A wrong turn worth seeing

A tempting version subtracts `prefix[l]` instead of `prefix[l − 1]`:

```text
answer = prefix[r] − prefix[l]
```

On `(2, 5)` it gives `550 − 200 = 350`. **But the right answer is 430!** It removed day 2, which we wanted to keep. `prefix[l]` includes day `l` itself; we must subtract only the days *before* `l`. Lesson for the toolbox: **the subtracted prefix ends one day before the range starts.**

### Optimal: prefix sums

Recap of what we found:

1. Overlapping range questions recompute the same additions.
2. A running total turns any range into one subtraction.
3. A leading `0` and 64-bit numbers remove the edge cases.

Pseudocode:

```text
prefix = array of n + 1 zeros (64-bit)
for i from 1 to n:
    prefix[i] = prefix[i − 1] + litres[i − 1]
for each question (l, r):
    print prefix[r] − prefix[l − 1]
```

Building `prefix` is one pass, `O(n)`. Each question is one subtraction, `O(1)`. In all, `O(n + q)`: about `80,000` steps for the largest input instead of `1.5 · 10^9`.

## Writing The Solution

If you followed the example and the pseudocode, this part is short. A few sanity checks first:

- Is `prefix` one longer than `litres`, with `prefix[0] = 0`?
- Does the loop go up to `n` *inclusive* when filling `prefix`?
- Is the subtraction `prefix[r] − prefix[l − 1]`, not `prefix[l]`?
- Are the totals 64-bit in C, C++ and Java?
- Is input read fast? With up to about 110,000 numbers, slow input (Java's `Scanner`, C++ `cin` without `sync_with_stdio(false)`) can cost more than the algorithm.
- Is output built once and printed once, rather than flushed 30,000 times?

All five languages below follow the same plan: read everything, build `prefix`, answer every question with one subtraction, print once.

[[code-tabs]]

> **Note:** See how short the code is. The real work was in the thinking: once the equation `prefix[r] − prefix[l − 1]` was clear, the code wrote itself.

## Testing / Reflection

Let's run the code by hand on the first sample. The visual below steps through it:

[[visual:prefix-dry-run]]

Building `prefix` from `[120, 80, 0, 200, 150, 90]`:

| i | litres[i − 1] | prefix[i] |
|---|---|---|
| 0 | | 0 |
| 1 | 120 | 120 |
| 2 | 80 | 200 |
| 3 | 0 | 200 |
| 4 | 200 | 400 |
| 5 | 150 | 550 |
| 6 | 90 | 640 |

Answering:

- `(1, 3)`: `prefix[3] − prefix[0] = 200 − 0 = 200`
- `(2, 5)`: `prefix[5] − prefix[1] = 550 − 120 = 430`
- `(4, 4)`: `prefix[4] − prefix[3] = 400 − 200 = 200`

The output `200, 430, 200` matches.

### What is the time complexity?

`O(n + q)`. One pass of `n` steps builds `prefix`; each of the `q` questions is one subtraction. Reading the input is also `O(n + q)`, so we cannot do better.

### What is the space complexity?

`O(n)` for the `prefix` array (plus the input itself). We could even build `prefix` in place over the readings if memory were tight, since we never need a single day's reading again.

### Interesting observations

- **The brute force did repeated work.** Every question re-added days another question had already added. Prefix sums do that work once and share it.
- **We traded memory for time.** `n + 1` extra numbers turned an `O(n)` question into an `O(1)` question. This trade appears again and again: hash maps, caches, DP tables.
- **A sentinel value removed a special case.** `prefix[0] = 0` means "a range starting at day 1" needs no `if`.
- **Subtraction works because addition can be undone.** The trick needs an operation with an inverse. It works for sums and for XOR. It does **not** work for "maximum from `l` to `r`": knowing the maximum up to `r` and up to `l − 1` does not give the maximum between them. That question needs other tools (a sparse table or a segment tree).
- **If the readings changed between questions**, every later prefix would shift, and rebuilding would cost `O(n)` per change. A Fenwick tree handles changes and questions in `O(log n)` each.

### Common mistakes

- Subtracting `prefix[l]` instead of `prefix[l − 1]` (day `l` goes missing).
- 32-bit totals in C, C++ or Java: correct on small tests, wrong as soon as a range passes about 2.1 billion litres.
- Mixing 0-indexed arrays with 1-indexed days without deciding which is which.
- Slow input or output in Java and Python, which can time out even with the right algorithm.

### Keep the brute force around

The slow solution is not wasted work. It is so simple that it is hard to get wrong, which makes it a perfect **checker**. Write a tiny random generator (a few days, a few questions, small readings), run both solutions on a few hundred random inputs, and compare the outputs line by line. The first input where they differ is a small, readable test case that shows your bug. That is exactly how this problem's hidden tests were checked: the brute force had to agree with the prefix-sum solution on every small test before any of them were accepted. In an interview, saying "I'd test the fast version against the brute force on random small inputs" is a strong signal that you think about correctness, not only speed.

### Edge cases our tests check

The hidden tests are built around the questions we asked at the start:

- **One day, one question** (`n = 1`): `prefix` has two entries, and `(1, 1)` is `prefix[1] − prefix[0]`.
- **All readings zero**: every answer is `0`, and it must still be printed.
- **Questions touching both ends**: `(1, r)` uses `prefix[0]`; `(l, n)` uses the last entry.
- **The same question many times**: each gets the same answer; nothing is consumed.
- **The largest input with every reading at `10^6`** and every question `(1, n)`: answers of `5 · 10^10`, which break 32-bit code, and `1.5 · 10^9` steps for the brute force, which breaks the time limit.

### Interview follow-ups

- *"What if the hostel wants the average per day of a range?"* The same total divided by `r − l + 1`; decide on rounding first.
- *"What if a reading can be corrected later?"* Use a Fenwick tree (`O(log n)` update and query) instead of a static prefix array.
- *"What if the readings are a grid, rooms by days?"* Use a 2D prefix sum: a rectangle's total takes four lookups.

### Related problems

From our bank: `sql-cab-running-fare` (the same running-total idea, written as a SQL window) and `sql-monthly-growth-with-gaps` (period totals and comparing one period with the one before). More DSA range-sum problems will join this list as the bank grows.

**Reflection connects new learning to old ideas: a prefix sum is just a running total you remember, and many "range" questions become one subtraction once you see it.**
