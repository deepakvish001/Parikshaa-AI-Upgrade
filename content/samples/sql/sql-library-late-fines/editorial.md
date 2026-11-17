## Problem

**For every library member who owes a fine on 17 November 2026, report how many of their loans are late and the fine at ₹5 per late day.**

In the first sample, Meher's unreturned book is 14 days past due (₹70), Kiran returned one book 5 days late (₹25), and Nikhil has two loans 2 days late each (₹20). Oviya's book is not due yet, so she owes nothing and is left out.

## Understand The Problem

Fines feel simple until you list the cases. Let's do that first.

> **Note:** For any date question, write down "as of when?" before anything else. Here it is a fixed day, 2026-11-17, so the answer never changes with the clock.

**Key parts of the task:**

- **Late days of one loan** = days between `due_on` and the day it came back. If it has **not come back** (`returned_on` is NULL), count to the as-of date, `2026-11-17`.
- **Returned on or before the due date** means 0 late days, never a negative number. An early return does not earn credit against another fine.
- **Fine** = ₹5 × the member's total late days.
- **Output:** `member`, `late_loans` (loans with at least one late day), `fine`; only members with a fine above 0; sorted by `fine` from high to low, then `member` A to Z.

Questions about the inputs:

- Can `returned_on` be NULL? **Yes**, and those are the most overdue books.
- Can a book be returned on its due date? Yes: 0 days, so it is **not** a late loan.
- Can the due date be after the as-of date? Yes: a fresh loan. Negative days again, so 0.
- Are dates stored with times? No, plain `YYYY-MM-DD`, so `julianday` differences are whole days.

## Coming Up With The Solution

Four small loans, each chosen for a reason.

1. Due 15 Oct, returned 20 Oct. **Why this example?** The plain case: 5 days, ₹25.
2. Due 3 Nov, not returned. **Why this example?** We must count to the as-of date: 17 − 3 = 14 days.
3. Due 15 Sep, returned 10 Sep. **Why this example?** A negative difference (−5) that must become 0, not reduce someone's fine.
4. Due 24 Oct, returned 24 Oct. **Why this example?** On time to the day: 0 days, and not a late loan.

The first sample has all four, so we trace it.

| loan | member | due | back (or as-of) | days | late? |
|---|---|---|---|---|---|
| 1 | Kiran | 10-15 | 10-20 | 5 | yes |
| 2 | Kiran | 10-24 | 10-24 | 0 | no |
| 3 | Meher | 11-03 | *11-17* | 14 | yes |
| 4 | Meher | 09-15 | 09-10 | −5 | no |
| 5 | Nikhil | 11-15 | *11-17* | 2 | yes |
| 6 | Nikhil | 10-15 | 10-17 | 2 | yes |
| 7 | Oviya | 11-24 | *11-17* | −7 | no |

Per member: Meher 1 loan, 14 days, ₹70; Kiran 1 loan, ₹25; Nikhil 2 loans, 4 days, ₹20.

**Observation 1:** "the day it came back, or today" is exactly `COALESCE(returned_on, '2026-11-17')`.

**Observation 2:** `julianday(a) - julianday(b)` gives days as a number. For plain dates it is whole, but SQLite returns it as a real (`14.0`). We `CAST` it to `INTEGER` so the output is `70`, not `70.0`.

**Observation 3:** compute days *per loan* first, keep only loans with `days > 0`, and only then group. That one filter does three jobs: it drops early returns, on-time returns and fresh loans; it makes `COUNT(*)` count only late loans; and it removes members whose fine would be 0.

### The wrong turns

A first try often subtracts `returned_on` directly. **But for an unreturned book, `julianday(NULL)` is NULL**, the difference is NULL, and the most overdue loans silently vanish from `SUM`. Another try sums raw differences across a member's loans: Meher's −5 then cancels part of her 14, giving ₹45. A third try keeps `days >= 0`, which counts Kiran's on-time return as a late loan.

> **Note:** `SUM` and `COUNT(column)` skip NULLs without a word. When a total looks too small, look for a NULL that should have been a value.

Pseudocode:

1. For each loan: `days = whole days from due_on to COALESCE(returned_on, as-of)`.
2. Keep loans with `days > 0`.
3. Group by member: `late_loans = COUNT(*)`, `fine = 5 × SUM(days)`.
4. Sort by fine descending, member ascending.

## Writing The Solution

With the table above, the SQL is a direct copy. Sanity checks: NULL handled with `COALESCE`; days cast to integers; `> 0`, not `>= 0`; the sort has a tie-break. The first tab uses a CTE that names `days`; the second does it in one `SELECT` with `CASE` for the count and `MAX(0, …)` (SQLite's two-argument `MAX` is a scalar, not the aggregate) for the clipping, then `HAVING fine > 0`.

[[code-tabs]]

## Testing / Reflection

Dry run of the CTE version on the first sample: the CTE gives days 5, 0, 14, −5, 2, 2, −7. `WHERE days > 0` keeps loans 1, 3, 5, 6. Grouping: Kiran (1, 5), Meher (1, 14), Nikhil (2, 4). Fines 25, 70, 20. Sorted: Meher, Kiran, Nikhil.

**Time complexity:** one scan of `loans` to compute days (`O(N)`), grouping (`O(N log N)` with a sort, or `O(N)` with hashing), and a final sort of `M` members (`O(M log M)`). Space: one group per member.

Observations:

- Turn "or today" into `COALESCE(column, as_of_date)`.
- Clip at zero *before* summing; a negative day is not a credit.
- Filter late loans early, and the count, the sum and the "owes something" rule all follow.

**Common mistakes:** losing unreturned books to NULL; summing negative days; treating the due date itself as late; printing `70.0` because the difference was not cast.

**Follow-ups:** cap each loan's fine at ₹200 (`MIN(days * 5, 200)` per loan, before the sum); show the member's oldest overdue book (a window `ROW_NUMBER` per member ordered by `due_on`).

**Make each row tell the truth first (days per loan), then let GROUP BY add the truths up.**
