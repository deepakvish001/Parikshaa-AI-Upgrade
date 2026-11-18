## Problem

**For every chai stall, find its longest run of consecutive calendar days with at least 50 cups sold, with the run's first and last day.**

In the first sample, Gupta Chai's best run is 4 to 6 November (3 days); its run on 1–2 November is shorter, and 8 November stands alone because the stall was closed on the 7th. Kulhad Corner has two 3-day runs, so the earlier one (30 October to 1 November) is reported. Tapri 9 never reached 50 cups, so it shows 0 and two NULLs.

## Understand The Problem

This is a "gaps and islands" problem: we have rows on a timeline and want the unbroken stretches. Let's pin down what breaks a stretch.

> **Note:** For any streak question, ask: consecutive *what*? Consecutive rows and consecutive days are different things whenever a day can be missing.

**Key parts:**

- A **good day** is a row with `cups >= 50`. Exactly 50 counts.
- **Consecutive calendar days**: 4, 5 and 6 November are consecutive; 6 and 8 are not, even if there is no row for the 7th between them. A **closed day** (no row) breaks a streak.
- A **lost tally sheet** (`cups` NULL) is not a good day, so it breaks a streak too.
- **Several runs of the same longest length** → report the one that starts earliest.
- **A stall with no good day** still appears, with `streak_days` 0 and NULL dates.
- **Output:** `stall`, `streak_days`, `streak_start`, `streak_end`; sorted by `streak_days` high to low, then `stall`.

Questions about the data:

- One row per stall per day? **Yes**, `(stall, sold_on)` is the key, so counting rows in a run counts days.
- Can runs cross a month or a year? **Yes.** 31 October → 1 November is consecutive. Our date arithmetic must know the calendar.
- Can a stall have no sales rows at all? Yes: same as no good day.

## Coming Up With The Solution

Let's collect examples.

1. Five good days in a row, nothing else. **Why this example?** The simplest island: one run, length 5.
2. Gupta Chai: good, good, bad, good, good, good, *closed*, good. **Why this example?** It has a bad day *and* a missing day; both must split runs.
3. Kulhad Corner: two runs of 3, one crossing the month end. **Why this example?** It checks the tie rule and calendar arithmetic.
4. Tapri 9: no good day. **Why this example?** It must still print a row.

**Observation 1:** if we keep only the good days of one stall and number them in date order (1, 2, 3, ...), then inside an island both the date and the number go up by exactly 1 each step. So **`date − row_number` is the same for every day of one island**, and it jumps whenever there is a gap.

Let's check it on Gupta Chai (good days only). To keep the numbers small, call 1 November day 1, 2 November day 2, and so on:

| sold_on | day number | row_number | day − row_number |
|---|---|---|---|
| 11-01 | 1 | 1 | 0 |
| 11-02 | 2 | 2 | 0 |
| 11-04 | 4 | 3 | 1 |
| 11-05 | 5 | 4 | 1 |
| 11-06 | 6 | 5 | 1 |
| 11-08 | 8 | 6 | 2 |

The difference takes three values, 0, 1 and 2: three islands, of sizes 2, 3 and 1. The bad day (3 November) and the closed day (7 November) each push the difference up by one, because the date moves on while the row number does not.

**Observation 2:** "day number" must be a real calendar count, so we use `julianday(sold_on)`, which knows that 31 October is followed by 1 November.

**Observation 3:** once each good day has its island key `grp`, an island is just `GROUP BY stall, grp`: `COUNT(*)` is its length, `MIN`/`MAX` of `sold_on` are its ends.

**Observation 4:** picking the best island per stall, with "longest, then earliest", is a top-1-per-group problem: `ROW_NUMBER() OVER (PARTITION BY stall ORDER BY streak_days DESC, streak_start)`, keep `1`.

**Observation 5:** stalls with no good day have no islands, so we start from `stalls` and `LEFT JOIN` the winners.

### Brute force: islands by their edges

Without the trick, think in edges. A good day **starts** an island if the day before is not a good day of that stall; it **ends** one if the day after is not. For each start, the island's end is the first end on or after it. This is correct and easy to explain: `date(day, '-1 day')` and `date(day, '+1 day')` do the calendar work. But each start looks for its end with a correlated subquery, so in the worst case it is `O(G^2)` per stall for `G` good days.

### The wrong turn: consecutive rows

A popular shortcut numbers *all* rows of a stall, and *all* good rows, and subtracts the two numbers. That finds runs of consecutive **rows**. **But a closed day has no row**, so the shortcut glues 6 and 8 November together and reports Gupta Chai's run as 4 days. Lesson: **when the timeline can have holes, subtract from the date, not from another row number.**

> **Note:** If the stall had a row for every day (closed days stored as 0 cups), both tricks would agree. Check whether missing days are stored before choosing a method.

### Optimal: date minus row number

Pseudocode:

1. Keep good days; `grp = julianday(sold_on) − ROW_NUMBER() OVER (PARTITION BY stall ORDER BY sold_on)`.
2. `GROUP BY stall, grp` → length, start, end.
3. Number each stall's islands by length desc, start asc; keep number 1.
4. `LEFT JOIN` from `stalls`; `COALESCE(length, 0)`.
5. Sort by length desc, stall asc.

## Writing The Solution

Three CTEs, one per idea: `good` (island keys), `runs` (islands), `best` (the winner). Sanity checks: `>= 50`, not `> 50`; NULL cups fall out of `WHERE` by themselves; the tie-break `streak_start` in `best`; `pick = 1` in `ON`, not `WHERE`; `COALESCE` for stalls with nothing; the final sort has two keys. The second tab is the edge-based method.

[[code-tabs]]

## Testing / Reflection

Dry run on the first sample. `good` for Kulhad Corner keeps 10-30, 10-31, 11-01, 11-03, 11-04, 11-05 (11-02 is NULL). Row numbers 1–6; `julianday − rn` is the same for the first three and the same (one larger, by 1) for the last three, because of the one-day hole. `runs`: (3, 10-30, 11-01) and (3, 11-03, 11-05). `best` picks the earlier start. Gupta Chai's winner is (3, 11-04, 11-06). Tapri 9 has no `good` rows, so the `LEFT JOIN` gives NULLs and `COALESCE` makes 0. Sorted: Gupta Chai, Kulhad Corner (both 3, by name), Tapri 9.

**Time complexity:** the window sorts each stall's good days, `O(N log N)`; grouping and the second window are `O(N log N)` at most; the join is linear. The edge method is `O(N log N)` to find starts and ends with an index, but up to `O(G^2)` per stall to pair them. Space: `O(N)`.

Observations:

- Inside an island, two sequences rise in step; their difference is the island's name.
- Subtract from a calendar (`julianday`), not a row number, when days can be missing.
- After islands are groups, everything else is ordinary `GROUP BY` and top-1-per-group.

**Common mistakes:** consecutive rows instead of days; `> 50`; an inner join that drops stalls with no good day; no tie rule, so the "earliest" run is left to chance.

**Interview follow-ups:**

- *Longest run of bad days?* Flip the condition in `good`.
- *Current streak as of the last row?* Keep the island whose `streak_end` is the stall's latest `sold_on`.
- *Allow one closed day inside a streak?* The simple trick no longer works; compare each good day with the previous good day (`LAG`) and start a new island when the gap is more than 2 days, then count islands with a running `SUM` of "new island" flags.

**Gaps and islands is one idea: give every row of an island the same name, then GROUP BY the name.**
