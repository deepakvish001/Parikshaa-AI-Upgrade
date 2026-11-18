## Problem

**In every branch, list the students holding the two highest *different* scores of the placement test, with their rank (1 or 2).**

In the first sample, CSE's top score 92 is shared by Aman and Charan, so both are rank 1, and Bela's 88 is rank 2. Ehsan was absent and is never ranked.

## Understand The Problem

Ranking questions hide their rules in single words. Let's find them.

> **Note:** Before any "top N" query, ask the interviewer: top N rows, or top N values? With ties, they give different answers, and a judge will catch the wrong one.

**Key parts:**

- **"two highest different scores"**: top N *values*, not top N *students*. Five students can share rank 1.
- **"in every branch"**: ranks restart in each branch.
- **Absent students** (`score` NULL) are never ranked, even when their branch is small.
- **Output:** `branch`, `roll_no`, `name`, `score`, `rank_in_branch`; sorted by branch, then rank, then roll number.

Questions about the data:

- Can a branch have just one distinct score? **Yes**: then it has only rank 1 rows.
- Can a whole branch be absent? Yes: it shows no rows.
- Can scores repeat? **Yes, often.** This is the heart of the problem.
- Is `roll_no` unique? Yes, it is the key, so the final sort is total.

## Coming Up With The Solution

Some examples.

1. ECE: 81, 79, 70. **Why this example?** No ties, the easy case: 81 is rank 1, 79 rank 2.
2. CSE: 92, 92, 88, 75, absent. **Why this example?** A tie at the top. Rank 2 must be 88, not the second 92.
3. ME: 60, 60, absent. **Why this example?** Only one distinct score; an absent student must not sneak in as rank 2.

Let's compare the three ranking functions on CSE, ordered by score descending:

| roll_no | score | `ROW_NUMBER` | `RANK` | `DENSE_RANK` |
|---|---|---|---|---|
| CS01 | 92 | 1 | 1 | 1 |
| CS03 | 92 | 2 | 1 | 1 |
| CS02 | 88 | 3 | **3** | **2** |
| CS04 | 75 | 4 | 4 | 3 |

**Observation 1:** `ROW_NUMBER` breaks ties arbitrarily, so `<= 2` keeps only two students and drops Bela. Wrong.

**Observation 2:** `RANK` leaves a gap after a tie (1, 1, 3). With `<= 2`, Bela's rank 3 is cut. Wrong.

**Observation 3:** `DENSE_RANK` gives the position of the *value* among distinct values (1, 1, 2). `<= 2` is exactly "the two highest different scores".

**Observation 4:** in SQLite, NULL sorts as the smallest value, so with `ORDER BY score DESC` an absent student comes last. **But last can still be rank 2**: in ME (60, 60, NULL), `DENSE_RANK` gives the NULL row rank 2. We must remove absent students before ranking, with `WHERE score IS NOT NULL` inside the subquery.

> **Note:** A window function cannot appear in `WHERE` of the same `SELECT`, because windows are computed after `WHERE`. Rank in a subquery (or CTE), filter outside.

There is a path without window functions too. A score's dense rank equals **1 + the number of distinct higher scores in the same branch**. So "rank ≤ 2" means "fewer than 2 distinct scores above me". That is a correlated `COUNT(DISTINCT ...)`. Check it on CSE: for Aman (92) the set of distinct higher scores is empty, so rank 1; for Bela (88) it is {92}, one value, so rank 2 and she stays; for Dia (75) it is {92, 88}, two values, so rank 3 and she goes. Charan's 92 also has nothing above it, so the tie needs no special code: `COUNT(DISTINCT ...)` counts the value 92 once, however many students hold it. And absent Ehsan? `t.score > NULL` is never true, so his count would be 0, which is why the outer `WHERE s.score IS NOT NULL` is needed here too. This version is slower (it looks at the branch once per student), but it works on any SQL engine and it explains what `DENSE_RANK` means.

Pseudocode:

1. Drop absent students.
2. In each branch, rank scores high to low with `DENSE_RANK`.
3. Keep ranks 1 and 2.
4. Sort by branch, rank, roll number.

## Writing The Solution

Sanity checks: `PARTITION BY branch`; `ORDER BY score DESC`; the NULL filter is *inside*, before ranking; `rnk <= 2` is *outside*; the final sort has three keys. Tabs: the window version, the correlated count, and a version that ranks the distinct (branch, score) pairs first and joins students back.

[[code-tabs]]

## Testing / Reflection

Dry run on the first sample: the inner query drops CS05 (absent). CSE ranks: CS01 1, CS03 1, CS02 2, CS04 3. ECE ranks: EC01 1, EC02 2, EC03 3. The outer `WHERE` keeps five rows; the sort prints CSE rank 1 (CS01, CS03), CSE rank 2 (CS02), then ECE.

**Time complexity:** the window version sorts each branch once, `O(N log N)` overall, and scans once more to filter. The correlated version is `O(N · B)` where `B` is the largest branch, since each student scans their branch (an index on `(branch, score)` helps). Space: `O(N)` for the sorted rows.

Observations:

- "Top N values" → `DENSE_RANK`; "top N rows, ties included" → `RANK`; "exactly N rows" → `ROW_NUMBER` with a tie-break.
- Filter NULLs before ranking, not after.
- Dense rank = 1 + count of distinct larger values.

**Common mistakes:** `RANK` (a tie at the top hides rank 2); `ROW_NUMBER` (ties cut); ranking absent students; forgetting `PARTITION BY`, which ranks the whole college as one list.

**Follow-ups:** the *second* highest distinct score per branch only, or NULL when a branch has just one (a `LEFT JOIN` from the list of branches to the rank-2 rows); top 3 instead of top 2 (only the constant changes).

**Read "top N" twice: once for rows, once for values. The function you need follows from which one it is.**
