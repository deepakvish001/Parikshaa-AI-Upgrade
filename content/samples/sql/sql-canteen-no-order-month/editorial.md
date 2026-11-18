## Problem

**List every student who placed no app order at the canteen in November 2026, by `student_id`.**

In the first sample, Aarav and Bhavna ordered in November. Divya ordered only in October, Chirag and Eshan never ordered, so the answer is Chirag, Divya and Eshan.

## Understand The Problem

Let's not jump to a query. Questions first; each answer can change the query.

> **Note:** In an interview, ask these out loud before you write SQL. It shows you think about data, not only syntax.

- **Which table drives the answer?** `students`. A student who never ordered has no row in `orders` at all, so we cannot start from `orders`.
- **Which orders count?** Only those dated `2026-11-01` to `2026-11-30`, both days included. An October order does not save a student from the coupon list.
- **Can `orders.student_id` be NULL?** Yes: a walk-in counter sale has no student. Such a row belongs to nobody.
- **Can a student have many November orders?** Yes. They must still be left out once, not "left out three times".
- **Output:** two columns, `student_id` and `name`, sorted by `student_id`. If everyone ordered, no rows.

## Coming Up With The Solution

Let's try a few small cases.

1. A student with one November order. **Why this example?** It is the plain "not on the list" case.
2. A student with an October order only. **Why this example?** It tests that the month condition really filters.
3. A student with no orders anywhere. **Why this example?** The join finds nothing; the student must still appear.
4. A walk-in order with `student_id` NULL. **Why this example?** NULLs break some of the queries that look right.

The first sample covers cases 1–3, so we walk through it.

**Observation 1:** we want students for whom a matching November order does *not exist*. This is an **anti-join**.

**Observation 2:** `LEFT JOIN` keeps every student. When nothing matches, the order columns are NULL. So "no match" is `o.order_id IS NULL`, because `order_id` is never NULL in a real row.

**Observation 3:** the November condition decides what a *match* is. It belongs in the `ON` clause. If we put it in `WHERE`, the join first matches Divya's October order, and then `WHERE` sees a real order row and makes a wrong call.

A first attempt many people write:

```sql
WHERE student_id NOT IN (SELECT student_id FROM orders WHERE ...)
```

**But this breaks with walk-ins!** If the subquery returns a NULL, `5 NOT IN (1, 2, NULL)` is not true, it is *unknown*, and every row is dropped. Lesson for the toolbox: **never use `NOT IN` on a column that can be NULL; use `NOT EXISTS` or a `LEFT JOIN`.**

> **Note:** `NOT EXISTS` is the same idea as our `LEFT JOIN`, written as "there is no order such that...". Both are correct here; pick the one you read more easily.

## Writing The Solution

Sanity checks before we write: the date range is in `ON`; we test a column that is never NULL in real rows (`order_id`); the order is `student_id`. The tabs show the `LEFT JOIN` reference, `NOT EXISTS`, and `EXCEPT` (all students minus those who ordered).

[[code-tabs]]

## Testing / Reflection

Dry run on the first sample: Aarav joins orders 101 and 105, both in November, so he is gone. Bhavna joins 103 only (102 is October and fails the `ON`), so she is gone. Chirag and Eshan join nothing, and Divya's October order fails the `ON`, so all three keep NULL order columns and stay.

**Time complexity:** with an index on `orders.student_id`, each student probes once, about `O(S log O)` for `S` students and `O` orders, plus a sort on the primary key that is already in order. Without the index, SQLite builds an automatic one, so it stays near `O((S + O) log O)`. Space is the result itself.

Observations:

- A filter on the *optional* side of a `LEFT JOIN` belongs in `ON`.
- `IS NULL` on the primary key of the joined table is the safe "no match" test.
- `NOT IN` and NULL do not mix.

**Common mistakes:** `NOT IN` with walk-in NULLs (returns no rows); the date filter in `WHERE` (Divya is wrongly kept, or a student shows twice); checking only the month with `strftime('%m', ...)`, which also counts November 2025.

**Follow-ups:** count the coupons per hostel (day scholars have NULL hostel); list students with no order in *any* of the last three months.

**An anti-join asks "where is nothing?", so make the join say what counts as something.**
