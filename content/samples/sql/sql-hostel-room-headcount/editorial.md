## Problem

**For every hostel room, show how many students stay in it now and how many beds are free, sorted by block and room.**

In the first sample, room 101 has Aditi and Charu (Bina has left), so 2 staying and 1 free bed. Room 102's only student has checked out, and room 202 never had anyone: both still appear, with 0 staying.

## Understand The Problem

Questions first, then SQL.

> **Note:** Most wrong answers to "count per group" questions come from one forgotten group: the one with zero rows. Always ask "can a group be empty?"

- **Which rooms appear?** Every room in `rooms`, even an empty one. So `rooms` drives the query.
- **Who counts as staying?** An allotment with `checked_out_on IS NULL`. A student who checked out in July does not take a bed.
- **Output:** `room_no`, `block`, `staying`, `free_beds`, sorted by `block`, then `room_no`.
- **Can `free_beds` go negative?** No: the hostel never puts more students in a room than its capacity.

## Coming Up With The Solution

Three small cases.

1. A room with two current students. **Why this example?** The normal case: count 2.
2. A room whose only student has left. **Why this example?** It has allotment rows, but none of them count.
3. A room with no allotment row at all. **Why this example?** The join finds nothing; it must still show 0.

The first sample has all three, so we use it.

**Observation 1:** "every room, even with nothing to count" means `LEFT JOIN` from `rooms`.

**Observation 2:** after a `LEFT JOIN`, an empty room still gives one row, with the allotment columns NULL. `COUNT(*)` counts that row and says 1. `COUNT(a.allot_id)` counts only non-NULL ids and says 0. **Count a column of the right table, never `*`.**

**Observation 3:** "currently staying" decides which allotments *match*, so it goes into `ON`. Put it in `WHERE` instead and room 102 disappears: its one row (Deepa, checked out) is joined, then thrown away by `WHERE`, and nothing is left to group.

> **Note:** A quick test for any `LEFT JOIN`: does the `WHERE` clause mention the right-hand table? If it does, you have probably turned it back into an inner join.

## Writing The Solution

Sanity checks: `LEFT JOIN` from `rooms`; the checkout condition in `ON`; `COUNT(a.allot_id)`; `free_beds` from the same count; the sort is `block, room_no`. The second tab counts with a correlated subquery instead, which never has the `COUNT(*)` problem because `COUNT(*)` over zero rows is 0.

[[code-tabs]]

## Testing / Reflection

Dry run on the first sample: room 101 joins Aditi and Charu (Bina fails the `ON`), count 2, free 3 − 2 = 1. Room 102 joins nothing, count 0, free 2. Room 201 joins three, free 0. Room 202 joins nothing, free 1. Sorted by block then room: 101, 102, 201, 202.

**Time complexity:** one pass over `allotments` to join (with an index on `allotments.room_no`, each room probes in `O(log A)`), then grouping by room, so about `O((R + A) log A)` for `R` rooms and `A` allotments. Space: one group per room.

Observations:

- Empty groups need an outer join *and* a count of a right-table column.
- A condition on the optional table goes in `ON`.
- A subquery count is a clean way around both traps.

**Common mistakes:** `COUNT(*)` (empty rooms show 1); an inner join (empty rooms vanish); the checkout test in `WHERE` (rooms whose students all left vanish).

**Follow-ups:** list only rooms with a free bed (add `HAVING r.capacity - COUNT(a.allot_id) > 0`; it filters groups, so it goes after `GROUP BY`, not in `WHERE`); show free beds per block (group the result above by `block` and sum `free_beds`, or join and group by `block` directly, still counting `a.allot_id`).

**Every group, including the empty ones: that is what LEFT JOIN plus COUNT(column) gives you.**
