## Problem

**Report the campus print shop's revenue for every month from its first job to its last, including months with no jobs, and each month's growth over the month before, in percent.**

In the first sample there were no jobs in March 2026, yet March must appear with revenue 0. February grew 25.0% over January; March fell 100.0%; April has no growth figure, because growth from zero is undefined.

## Understand The Problem

Month-over-month reports look easy and are wrong surprisingly often. Let's list every rule before we touch SQL.

> **Note:** For any report over time, first ask: "which periods must appear?" The answer is almost never "only the periods that have rows".

**Key parts:**

- **Revenue of a job** = `pages × rate`. A month's revenue is the sum over its jobs.
- **Every calendar month** from the month of the first job to the month of the last job appears, **even with no jobs** (revenue 0).
- **Growth** = `(this − previous) / previous × 100`, rounded to **one decimal**.
- **NULL growth** for the first month (no previous month) and for any month whose previous month had revenue 0.
- **Output:** `month` as `'YYYY-MM'`, `revenue`, `growth_pct`; sorted by month.

Questions about the data:

- Can `student` be NULL? Yes (staff jobs). We never use it, so they count like any job.
- Can the data span more than a year? **Yes.** January 2025 and January 2026 are different months.
- Could a month in the middle have no jobs? **Yes, every June** (vacation). Those months must still be printed.
- Empty table? No months, so no rows.
- `pages` and `rate` are integers. **Division of two integers in SQLite is integer division**, so we must think about where the decimal comes from.

## Coming Up With The Solution

Some examples first.

1. Two months, 400 then 500. **Why this example?** The plain case: growth 25.0.
2. 300 then 400. **Why this example?** Growth is 33.333...%, so the rounding and the decimal arithmetic show. Integer division would print 33.0.
3. A month with no jobs between two busy months. **Why this example?** It must appear as 0, the next month's growth must be NULL, and the month after the gap must not be compared with the month *before* the gap.
4. December 2025 and December 2026 both busy. **Why this example?** They must not be merged.

The first sample has the gap case. By hand:

| month | jobs | revenue | previous | growth |
|---|---|---|---|---|
| 2026-01 | 100×2 + 40×5 | 400 | none | NULL |
| 2026-02 | 250×2 | 500 | 400 | 25.0 |
| 2026-03 | none | 0 | 500 | −100.0 |
| 2026-04 | 60×5 | 300 | 0 | NULL |
| 2026-05 | 110×3 | 330 | 300 | 10.0 |

**Observation 1:** `GROUP BY month` gives one row per month **that has jobs**. March has no jobs, so `GROUP BY` can never produce it. Rows that do not exist in the data must come from somewhere else: **a calendar**.

**Observation 2:** SQLite has no calendar table, but a recursive CTE can make one: start at the first month, add one month at a time with `date(m, '+1 month')`, and stop at the last month. The bounds come from `MIN` and `MAX` of `printed_on`, moved to the start of their months with `date(x, 'start of month')`.

**Observation 3:** with a calendar, we `LEFT JOIN` the monthly totals onto it and turn the missing ones into 0 with `COALESCE`. Now every month has exactly one row, in order.

**Observation 4:** "previous month" is now simply "previous row", so `LAG(revenue) OVER (ORDER BY m)` gives it. Without the calendar, `LAG` would compare April with February, which is exactly the bug we must avoid.

**Observation 5:** `100.0 * (...)` makes the arithmetic real (floating point) before the division. `(revenue - prev) * 100 / prev` with integers truncates 33.33 to 33 before `ROUND` ever sees it.

**Observation 6:** the month key must contain the year. `strftime('%m', ...)` alone merges December 2025 with December 2026. We key on `date(printed_on, 'start of month')` (a full date like `2026-03-01`) and print `strftime('%Y-%m', ...)` only at the end.

### Brute force: one subquery per month

Once the calendar exists, the most direct way to fill it is a correlated subquery per month: sum the jobs dated from the month's first day up to (not including) the next month's first day. Then a self-join of the filled months to themselves on `prev.m = date(f.m, '-1 month')` gives the previous month's revenue. It is correct and very readable. Its cost: each calendar month scans `prints` (or an index range) once, so `O(M · log N)` with an index on `printed_on`, `O(M · N)` without.

### The wrong turns

Three versions that look right on a quick test:

- **No calendar.** `GROUP BY` month, then `LAG`. **But the gap month vanishes**, and the month after the gap is compared with the month before it: April shows −40.0% instead of NULL.
- **Integer division.** `ROUND((revenue - prev) * 100 / prev, 1)` prints `33.0` where the truth is `33.3`. Every value looks plausible, which makes this bug hard to spot by eye.
- **Month number without the year.** Grouping by `strftime('%m', ...)` adds December 2025 into December 2026 and doubles it.

> **Note:** A good habit for any report: run it on a dataset with a gap, a non-round ratio, and two years. Those three cases catch most reporting bugs before a manager does.

### Optimal: calendar + one pass

Pseudocode:

1. `bounds`: first and last month (start-of-month dates).
2. `months`: recursive calendar from first to last.
3. `totals`: revenue per start-of-month date.
4. `filled`: calendar `LEFT JOIN` totals, `COALESCE` to 0.
5. `LAG` over `filled` ordered by month; growth with `100.0 *`, `ROUND(…, 1)`, NULL when the previous revenue is NULL or 0.

> **Note:** In SQLite, `x / 0` is NULL rather than an error, so the `CASE` is not strictly needed for the zero case. We still write it: it says the rule out loud, and the same query then works on databases that raise an error on division by zero.

## Writing The Solution

Sanity checks:

- The calendar stops at the last month (`WHERE m < last_m` in the step, so the last month is produced and then the loop ends).
- The anchor is skipped when the table is empty (`first_m IS NOT NULL`), so an empty table gives no rows instead of one NULL month.
- Month keys carry the year.
- `100.0` comes before the division.
- `growth_pct` is NULL for the first month and after a zero month.
- The output month is formatted only at the end, and the sort uses the date key.

The first tab is the calendar + `LAG` version; the second fills the calendar with a correlated sum and gets the previous month with a self-join.

[[code-tabs]]

## Testing / Reflection

Dry run of the reference on the first sample. `bounds` = (`2026-01-01`, `2026-05-01`). `months` produces 01, 02, 03, 04, 05 (five rounds, then `05 < 05` is false and it stops). `totals` has rows for 01 (400), 02 (500), 04 (300), 05 (330). `filled` adds 03 with 0. `LAG` gives NULL, 400, 500, 0, 300. Growth: NULL; 100.0 × 100 / 400 = 25.0; 100.0 × (−500) / 500 = −100.0; previous is 0, so NULL; 100.0 × 30 / 300 = 10.0.

**Time complexity:** the calendar has `M` months (`O(M)` rows). Grouping `N` jobs by month is `O(N log N)` (or `O(N)` with hashing); the join of `M` months to at most `M` totals is `O(M log M)`; the window is one pass, `O(M)`. The correlated version is `O(M · log N)` with an index on `printed_on`. Space: `O(M)`.

Observations:

- Missing periods never come from `GROUP BY`; they come from a calendar you build.
- Once the calendar is filled, "previous period" becomes "previous row", and `LAG` is safe.
- Make arithmetic real before dividing, and keep the year in every month key.

**Common mistakes:** no calendar (gaps vanish, wrong comparisons); integer division; merging the same month of different years; a calendar that emits one NULL month for an empty table.

**Interview follow-ups:**

- *Growth over the same month last year?* `LAG(revenue, 12) OVER (ORDER BY m)`, which only works because the calendar has no holes.
- *A 3-month moving average?* `AVG(revenue) OVER (ORDER BY m ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`, again on the filled calendar.
- *Show weeks instead of months?* Step the calendar by `'+7 days'` from `date(MIN(printed_on), 'weekday 1', '-7 days')` (the Monday of the first week), and key the totals the same way.

**Build the calendar first; every period-over-period number is only as right as the list of periods under it.**
