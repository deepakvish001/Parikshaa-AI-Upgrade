## Problem

**List the metro cards whose successful October 2026 recharges add up to at least ₹{{min_total}}, with how many recharges and the total, biggest total first.**

This editorial works the default version, where the threshold is ₹1,000. Your version may use another threshold; every step is the same.

## Understand The Problem

Let's slow down and pin the task before writing any SQL.

> **Note:** In an interview, say the filters out loud and sort them into two piles: filters on single rows, and filters on groups. That one habit prevents the most common `GROUP BY` bug.

Reading the stem again, the **key parts** are:

- **one row per card**: so we group by `card_no`;
- **successful recharges only**: `status = 'ok'`; a failed payment added no money;
- **in October 2026**: dated `2026-10-01` to `2026-10-31`, both included;
- **total at least the threshold**: "at least" means `>=`, so a card exactly on the line is in;
- **columns** `card_no`, `recharges` (how many successful October recharges), `total`;
- **order**: `total` from high to low; equal totals by `card_no`, A to Z.

Questions about the data:

- Can a card have no October recharge? Yes. It simply has no group, so it never appears. That is what we want.
- Can `station` be NULL? Yes (an app recharge). We never use it, so it cannot hurt us.
- Can two cards tie on total? Yes, which is why the stem gives a second sort key.
- Empty table? No rows.

## Coming Up With The Solution

Some small cases first.

1. A card with four ₹300 recharges in October. **Why this example?** Every single recharge is below ₹1,000, yet the card qualifies on its total. It separates row filters from group filters.
2. A card with ₹1,000 that went through and ₹200 that failed. **Why this example?** It tests the status filter: the true total is ₹1,000, not ₹1,200.
3. Two cards both at exactly ₹1,000. **Why this example?** It checks `>=` and the tie-break at once.
4. A card with ₹1,500 on 30 September and ₹400 on 31 October. **Why this example?** It checks the date range at both ends.

The first sample contains all four, so let's walk it by hand. Successful October totals:

| card_no | October `ok` recharges | total |
|---|---|---|
| DM-7311 | 300 + 300 + 300 + 300 | 1,200 |
| DM-2087 | 1,000 (the 200 failed) | 1,000 |
| DM-4410 | 500 + 500 | 1,000 |
| DM-5150 | 400 (the 1,500 was in September) | 400 |

With ₹1,000 as the line, three cards stay: DM-7311 first, then the two ₹1,000 cards in card order, DM-2087 before DM-4410.

**Observation 1:** status and date are facts about *one recharge*. They belong in `WHERE`, which runs before grouping.

**Observation 2:** the threshold is a fact about *a card's total*. A total exists only after grouping, so it belongs in `HAVING`.

**Observation 3:** `ORDER BY total DESC` alone leaves equal totals in any order. We add `card_no` to make the order total.

A tempting wrong turn is to put the threshold in `WHERE`: `AND amount >= 1000`. **But that drops DM-7311 entirely**, because none of its single recharges reaches ₹1,000. Lesson for the toolbox: **`WHERE` filters rows before `GROUP BY`; `HAVING` filters groups after it.**

> **Note:** SQL runs the clauses in this order: `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY`. When you are unsure where a condition goes, ask which step first knows the value.

Pseudocode:

1. Keep the `ok` rows dated in October.
2. Group by card; count rows and sum amounts.
3. Keep groups whose sum is at least the threshold.
4. Sort by sum descending, then card ascending.

## Writing The Solution

The pseudocode maps line by line, so this part is short. Sanity checks: `status = 'ok'` is in `WHERE`; both ends of October are included; the threshold uses `>=` in `HAVING`; the sort has a tie-break. The second tab computes per-card totals in a derived table and filters with a plain `WHERE` on the outer query, which is the same idea written in two steps.

[[code-tabs]]

## Testing / Reflection

Dry run of the reference on the first sample: `WHERE` keeps recharges 1, 2, 3, 5, 6, 7, 8 and 10 (4 failed; 9 is September). Grouping gives DM-4410 (2, 1,000), DM-2087 (1, 1,000), DM-7311 (4, 1,200), DM-5150 (1, 400). `HAVING` drops DM-5150. The sort gives DM-7311, DM-2087, DM-4410.

**Time complexity:** one scan of `recharges` (`O(N)`), grouping by hashing or sorting the kept rows (`O(N log N)` at worst), and a sort of the cards that pass (`O(C log C)`). With an index on `(recharged_on)`, SQLite reads only October's rows. Space: one group per card.

Observations:

- Row facts → `WHERE`; group facts → `HAVING`.
- A derived table turns a group fact back into a row fact you can filter with `WHERE`.
- "At least" is `>=`; check boundaries with a value exactly on the line.

**Common mistakes:** counting failed recharges; filtering single recharges by the threshold; using `>` for "at least"; a sort without a tie-break, which a judge with a fixed order will catch.

**Follow-ups:** show cards that recharged at least 3 times *and* reached the threshold (two conditions in `HAVING`, joined by `AND`); show each card's share of the month's money (divide by a window `SUM(SUM(amount)) OVER ()`).

**Filter rows before you group and groups after you group; the order of the clauses tells you which is which.**
