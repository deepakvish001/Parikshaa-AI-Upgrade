## Problem

**List every hostel complaint that is still open, with its current status and the time of its latest update.**

In the first sample, complaint 1 was resolved, so it is not listed. Complaint 3 was marked resolved and then reopened in the same minute; the later entry (the larger `update_id`) wins, so it is open. Complaint 4 has no update yet, so its status is `new`.

## Understand The Problem

"Latest row per group" is one of the most asked SQL patterns. Let's fix its rules first.

> **Note:** Whenever a task says "latest", ask two questions: latest by *what* (a time, an id?), and what if two rows tie on it? Write the answers into your query, not into your hopes.

**Key parts:**

- **Current status** = the status of the complaint's **latest** update: the largest `updated_at`; for equal times, the larger `update_id`.
- **No update yet** → status `'new'`, and `last_update` is NULL. These complaints are open.
- **Open** = current status is anything but `'resolved'`. A `'reopened'` complaint is open.
- **Output:** `complaint_id`, `room_no`, `current_status`, `last_update`, sorted by `complaint_id`.

Questions about the data:

- Is `update_id` in time order? **No.** The warden sometimes enters yesterday's visit today, so a larger id can have an *earlier* `updated_at`. The time decides; the id only breaks ties.
- Can a complaint have many updates? Yes, and several can share a minute.
- Can the `updates` table be empty? Yes: then every complaint is `new` and open.

## Coming Up With The Solution

Examples, each for a reason.

1. Complaint 1: assigned, then resolved. **Why this example?** The simple closed case: not listed.
2. Complaint 3: resolved and reopened at the same minute. **Why this example?** It tests the tie rule.
3. Complaint 4: no updates. **Why this example?** It tests that an outer join keeps it, and that `'new'` is filled in.
4. A late-entered update: id 32 at 08:00 on the 14th, after id 31 at 09:00 on the 15th. **Why this example?** It tests that time, not id, decides "latest".

The first sample covers the first three. Hand trace:

| complaint | updates, latest first | current | open? |
|---|---|---|---|
| 1 | 11 resolved (11-11 16:30), 10 assigned | resolved | no |
| 2 | 13 in-progress (11-12 12:00), 12 assigned | in-progress | yes |
| 3 | 15 reopened (11-13 18:00), 14 resolved (11-13 18:00) | reopened | yes |
| 4 | none | new | yes |

**Observation 1:** we need exactly **one** row per complaint from `updates`: the top row when sorted by `updated_at DESC, update_id DESC`. `ROW_NUMBER()` over that order, with `rn = 1`, gives exactly one, even with ties, because the order is total.

**Observation 2:** complaints without updates must survive, so we `LEFT JOIN` the ranked updates, and the condition `rn = 1` goes in the `ON` clause (in `WHERE`, `r.rn = 1` would be NULL for complaint 4 and drop it).

**Observation 3:** for complaint 4, `r.status` is NULL. `NULL <> 'resolved'` is not true, it is unknown, so `WHERE r.status <> 'resolved'` would drop it. We compare `COALESCE(r.status, 'new')` instead, which is also what we print.

### The wrong turns

A classic first attempt: find `MAX(updated_at)` per complaint, then join back to `updates` on that time. **But with two updates at the same latest minute, the join returns both rows.** If they are `in-progress` and `resolved`, the `resolved` row is filtered and the `in-progress` one survives, so a closed complaint shows as open. Lesson: **a join on a maximum value is only safe when the value is unique.**

Another: take the largest `update_id` as the latest. **It breaks on late-entered updates**, where id order and time order disagree.

> **Note:** SQLite has a quirk: in `SELECT status, MAX(updated_at) ... GROUP BY complaint_id`, it fills `status` from the row holding the maximum. Do not rely on it in an interview: it is SQLite-only and still picks arbitrarily among ties.

Pseudocode:

1. Number each complaint's updates by `updated_at DESC, update_id DESC`.
2. `LEFT JOIN` complaints to their number-1 update.
3. Current status = that update's status, or `'new'`.
4. Keep rows whose current status is not `'resolved'`; sort by id.

## Writing The Solution

Sanity checks: the window order has a tie-break; `rn = 1` is in `ON`; `COALESCE` is used both in the filter and in the output; `last_update` stays NULL for new complaints. Tabs: the window version; a correlated `LIMIT 1` that picks the latest `update_id` per complaint; and a `NOT EXISTS` version ("there is no later update than this one").

[[code-tabs]]

## Testing / Reflection

Dry run of the reference on the first sample: `ranked` numbers complaint 1's updates (11 → 1, 10 → 2), complaint 2's (13 → 1, 12 → 2) and complaint 3's (15 → 1, 14 → 2, since both are at 18:00 and 15 > 14). The `LEFT JOIN` gives complaint 1 resolved, 2 in-progress, 3 reopened, 4 NULL. The filter drops complaint 1. Output: 2, 3, 4.

**Time complexity:** the window sorts `updates` by complaint and time, `O(U log U)`; the join and filter are linear with an index on the complaint. The correlated `LIMIT 1` version is `O(C · log U)` with an index on `(complaint_id, updated_at, update_id)`, otherwise `O(C · U)`. Space: `O(U)`.

Observations:

- Latest per group = `ROW_NUMBER()` with a **total** order, then `rn = 1`.
- An outer join plus a filter on the right side needs `COALESCE` or the condition in `ON`.
- Ids are not clocks.

**Common mistakes:** joining on `MAX(time)` (ties duplicate rows); an inner join (new complaints vanish); `r.status <> 'resolved'` without `COALESCE` (same); latest by id.

**Follow-ups:** how long each open complaint has been open (`julianday('2026-11-17') - julianday(raised_on)`); the latest *two* updates per complaint (`rn <= 2`).

**"Latest" is only a rule once you say how ties break; ROW_NUMBER with a total order turns that rule into exactly one row.**
