## Problem

**For every completed cab trip, show the driver's earning on that trip and their running total for that day, trip by trip.**

In the first sample, Ravi's day on 16 November reads 180, then 420, then 570. Two of his trips ended at 09:40, so the smaller `trip_id` comes first. His trip on the 17th starts a fresh total.

## Understand The Problem

Running totals look like one line of SQL. The bugs live in the words around them, so let's list those words.

> **Note:** For any window question, say three things before writing: the **partition** (whose total), the **order** (in what sequence), and the **frame** (which rows count so far). Most bugs are one of the three left unsaid.

**Key parts:**

- **Earning** of a trip = `fare + tip`, where a **NULL tip means no tip**. In SQL, `220 + NULL` is NULL, not 220.
- **Only completed trips** (`status = 'done'`) appear and count. A cancelled trip's fee goes to the company.
- **Whose total:** one driver, **one calendar day**. A trip at 23:59 and one at 00:05 belong to different days.
- **Sequence:** by `ended_at`, and when two trips end at the same minute, the smaller `trip_id` first.
- **"So far" includes the current trip** and only the trips before it in that sequence.
- **Output:** `driver`, `trip_id`, `ended_at`, `earning`, `day_total`, sorted by driver, `ended_at`, `trip_id`.

Questions about the data:

- Can two trips of one driver end at the same minute? **Yes** (a shared ride split into two bookings). The tie rule exists for that.
- Is `ended_at` text? Yes, `'YYYY-MM-DD HH:MM'`, so text order is time order, and `date(ended_at)` gives the day.
- Can a driver have only cancelled trips? Yes: then no rows for them.
- Empty table? No rows.

## Coming Up With The Solution

Examples, each with a purpose.

1. Salma, two trips on one day. **Why this example?** The plain running total: 250, then 410.
2. Ravi's two trips both ending at 09:40. **Why this example?** It tests the tie rule and the window frame together.
3. Ravi's trip on the next morning. **Why this example?** The total must restart at midnight.
4. A trip with a NULL tip. **Why this example?** It tests `COALESCE`; without it the earning is NULL.

The first sample has all four. By hand, Ravi on the 16th, in order:

| trip | ended_at | fare | tip | earning | day_total |
|---|---|---|---|---|---|
| 1 | 08:10 | 180 | — | 180 | 180 |
| 3 | 09:40 | 220 | 20 | 240 | 420 |
| 6 | 09:40 | 150 | — | 150 | 570 |
| 4 | 10:30 | (cancelled) | | | not shown |

Then on the 17th, trip 7 earns 330 and the total is 330.

**Observation 1:** "per driver per day" is `PARTITION BY driver, date(ended_at)`. Partitioning by `driver` alone runs one total across all days.

**Observation 2:** the order must be *total*: `ORDER BY ended_at, trip_id`. With `ended_at` alone, trips 3 and 6 are peers, and the database is free to put either first.

**Observation 3: the frame.** With `ORDER BY` in a window and no frame written, SQL uses `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. **`RANGE` counts every peer of the current row**, so trips 3 and 6 (same `ended_at`) would *both* show 570. We want rows, not values: `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.

> **Note:** If your `ORDER BY` inside `OVER` is a total order (it includes a unique column), `RANGE` and `ROWS` give the same answer. Writing `ROWS` anyway makes your intent clear and protects you when someone later shortens the `ORDER BY`.

**Observation 4:** `WHERE status = 'done'` runs before the window, so cancelled trips are neither shown nor summed. Filtering them *after* the window (in an outer query) would hide their rows but leave their fees inside the totals.

### Brute force: a correlated sum

Before window functions, we would write it as a question per row: "add up this driver's completed trips on this day that come at or before me". At or before means `u.ended_at < t.ended_at`, or the same minute with `u.trip_id <= t.trip_id`. This is correct, and it is exactly what the window does, but it rescans the driver's day for every trip: `O(K^2)` for a day with `K` trips.

The same question can be written as a self-join with `GROUP BY`: join each trip `t` to every earlier-or-same trip `u` of that driver and day, then sum `u`'s earnings per `t`. Same cost, same answer.

### Optimal: one window

The window function keeps a running sum as it walks each partition in order, so each row costs `O(1)` after the sort.

Pseudocode:

1. Keep completed trips.
2. `earning = fare + COALESCE(tip, 0)`.
3. Window: partition by driver and day, order by `ended_at, trip_id`, frame `ROWS ... CURRENT ROW`, sum earnings.
4. Sort the output by driver, `ended_at`, `trip_id`.

> **Note:** The final `ORDER BY` is separate from the window's `ORDER BY`. The window decides how the total is built; only the outer `ORDER BY` decides how rows are printed.

## Writing The Solution

Sanity checks: `COALESCE(tip, 0)` in both the earning and the sum; the day in the partition; a tie-break in the window order; an explicit `ROWS` frame; the status filter in `WHERE`; an outer sort. The tabs show the window version, the correlated sum, and the self-join.

[[code-tabs]]

## Testing / Reflection

Dry run of the window on Ravi's 16 November partition, sorted `(08:10, 1)`, `(09:40, 3)`, `(09:40, 6)`: running sums 180, 420, 570. Partition `(Ravi, 17 Nov)`: 330. Salma's partition: 250, 410. The outer sort prints Ravi's four rows, then Salma's two.

Now the bugs on the same data:

- `ORDER BY ended_at` with the default frame: trips 3 and 6 both show 570.
- `PARTITION BY driver` only: trip 7 shows 900 instead of 330.
- `fare + tip`: trip 1's earning prints `NULL`, and the totals skip it.
- Status filtered outside: trip 4's ₹50 fee would leak into every later Ravi total on the 16th. In this sample there is no later completed trip that day, so the bug hides; that is exactly why the hidden tests put a cancelled trip between two completed ones.

**Time complexity:** the window sorts each partition once, `O(N log N)` overall, then one linear pass. The correlated and self-join versions are `O(N · K)`, where `K` is the most trips one driver makes in a day. Space: `O(N)` for the sort.

Observations:

- Partition, order, frame: say all three.
- A window `ORDER BY` without a unique tie-break makes peers; the default `RANGE` frame then lumps them.
- Arithmetic with NULL gives NULL; aggregate functions then skip it quietly.
- `WHERE` runs before windows, so it changes what windows see.

**Common mistakes:** the default frame with tied timestamps; forgetting the day; adding a NULL tip; filtering cancelled trips after the window.

**Interview follow-ups:**

- *Each trip's share of the driver's day?* Divide the earning by `SUM(earning) OVER (PARTITION BY driver, date(ended_at))` (no `ORDER BY`, so the frame is the whole day).
- *A 3-trip moving average?* `AVG(...) OVER (... ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)`.
- *The first trip of the day that pushed the total past ₹500?* Compute the running total in a CTE, then keep the smallest `(ended_at, trip_id)` with `day_total >= 500` per partition.

**A running total is a sum with a direction and a boundary; write the boundary (ROWS) yourself instead of trusting the default.**
