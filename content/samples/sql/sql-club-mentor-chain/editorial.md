## Problem

**For every member of the coding club, find how far they are from a founder (their depth) and how many members are under them in the mentoring tree, directly or through others (their juniors).**

In the first sample, Anvi founded the club, so her depth is 0. Bharat and Chhavi are her mentees (depth 1), Dinesh and Eela are Bharat's (depth 2), and Faraz is Dinesh's (depth 3). Everyone from Bharat down is under Anvi, so she has 5 juniors. Gargi founded the robotics wing with one mentee, Hiten.

## Understand The Problem

Trees stored as "each row points to its parent" are everywhere: org charts, comment threads, category menus, folder trees. Let's be exact about what we count.

> **Note:** For any hierarchy question, draw the sample as a tree on paper before writing SQL. Five boxes and a few lines answer most of your questions for you.

**Key parts:**

- **`mentor_id` points one level up.** NULL means a founder, the top of a tree.
- **There can be several founders**, so the data is a *forest*, not one tree.
- **Depth** = the number of mentor links from the member up to their founder. A founder has depth 0.
- **Juniors** = every member in the subtree below, at any distance, **not counting the member themself**.
- **Output:** `member_id`, `name`, `depth`, `juniors`; sorted by `depth`, then `member_id`.

Questions about the data:

- Can there be a cycle (A mentors B, B mentors A)? **No**, the club's form never allows it. We will still come back to what a cycle would do.
- Can names repeat? Yes. We always work with `member_id`.
- Are ids in joining order? **No.** A mentor's id can be larger than a mentee's. So we cannot use "smaller id = higher up".
- How deep can a chain get? Hundreds of levels in the big test. That rules out "join the table to itself three times".
- Empty table? No rows.

## Coming Up With The Solution

Let's look at examples, each for a reason.

1. A founder with no mentees. **Why this example?** The smallest tree: depth 0, juniors 0. It checks that founders are not lost.
2. A straight chain A → B → C → D. **Why this example?** Depth must grow by one per level, and A's juniors must count C and D, not only B.
3. Anvi's tree in the first sample. **Why this example?** It branches (Bharat has two mentees) and goes three levels deep, so it tests both counts at once.
4. Two founders side by side. **Why this example?** Counts from one tree must not leak into the other.

We will work the first sample. Drawn as a tree:

```text
Anvi (1)                    Gargi (7)
├── Bharat (2)              └── Hiten (8)
│   ├── Dinesh (4)
│   │   └── Faraz (6)
│   └── Eela (5)
└── Chhavi (3)
```

By hand: depths 0 (Anvi, Gargi), 1 (Bharat, Chhavi, Hiten), 2 (Dinesh, Eela), 3 (Faraz). Juniors: Anvi 5, Bharat 3, Dinesh 1, Gargi 1, everyone else 0.

**Observation 1:** depth is a walk **down from the founders**: founders are 0, and anyone whose mentor has depth `d` has depth `d + 1`. We do not know how many levels there are, so we need a loop. In SQL, a loop over rows is a **recursive CTE**.

**Observation 2:** a recursive CTE has two parts joined by `UNION ALL`. The **anchor** gives the starting rows (founders, depth 0). The **recursive part** joins the rows found so far to `members` to find the next level. SQLite repeats the recursive part on the newest rows until a round adds nothing.

**Observation 3:** juniors is a walk **down from every member**, not just the founders. If we start one walk at each member and collect everyone we reach, the size of that walk minus one (the start) is their junior count. So the anchor is "every member, paired with themself": `(top_id, member_id) = (m, m)`, and each round adds the mentees of the members we have reached, keeping the same `top_id`.

**Observation 4:** the rows produced by that walk are all `(ancestor-or-self, descendant)` pairs: the *closure* of the tree. Its size is the sum over members of (their depth + 1). For a bushy tree that is small; for one long chain of `n` members it is about `n^2 / 2`. Worth knowing when you pick an approach.

### Brute force: fixed self-joins

The first idea many people have is to join `members` to itself: `m` to its mentees, those to their mentees, and so on, three or four times. **But this only works up to the number of joins you wrote.** Faraz is three levels below Anvi; a two-join query misses him, and the big test has chains hundreds of levels long. A query whose correctness depends on the data's depth is not a solution. **Lesson: when the depth is not bounded, you need recursion.**

### Better: count only direct mentees

`SELECT COUNT(*) FROM members WHERE mentor_id = m.member_id` is quick and correct for "how many mentees do I have", but the task says *directly or through others*. Anvi would get 2 instead of 5. This is the most common wrong answer, because it looks right on a small, shallow sample.

> **Note:** Read "directly or indirectly" (or "all levels", "the whole subtree") as a signal for recursion, or for a closure table if the database keeps one.

### Optimal: two recursive walks

Pseudocode:

1. `depth_of`: anchor = founders with 0; step = members whose mentor is in `depth_of`, with `depth + 1`.
2. `below`: anchor = every member paired with themself; step = members whose mentor is the latest reached member, with the same `top_id`.
3. `team_size`: `COUNT(*) - 1` per `top_id`.
4. Join `members` with both and sort by depth, id.

There is a second shape that walks **up** instead: for each member, follow `mentor_id` links upward, producing `(member, ancestor, steps)` rows. Then a member's depth is their largest `steps` (0 if they have no row), and a member's juniors are the number of rows where they are the ancestor. It builds the same closure, just from the other end.

> **Note:** If the data *could* contain a cycle, both walks would run forever. The usual guard is to carry a path string (`',' || id || ','`) and stop when the next id is already in it, or to stop at a depth larger than the table size.

## Writing The Solution

Sanity checks before we run it:

- The `depth_of` anchor uses `mentor_id IS NULL` (founders), not `IS NOT NULL`.
- The recursive join direction is `m.mentor_id = d.member_id` (the mentee's mentor is a member we already know).
- `below` starts from **every** member, not only founders, so each member gets their own walk.
- `COUNT(*) - 1` removes the member themself.
- The sort is `depth, member_id`.

The first tab walks down twice; the second walks up once and reads both numbers from the same `(member, ancestor, steps)` rows.

[[code-tabs]]

## Testing / Reflection

Dry run of `depth_of` on the first sample:

| round | new rows (member, depth) |
|---|---|
| anchor | (1, 0), (7, 0) |
| 1 | (2, 1), (3, 1), (8, 1) |
| 2 | (4, 2), (5, 2) |
| 3 | (6, 3) |
| 4 | none, so it stops |

And `below` for `top_id = 2` (Bharat): anchor (2, 2); round 1 adds (2, 4) and (2, 5); round 2 adds (2, 6); then nothing. Four rows, so juniors = 3. For Anvi the walk reaches 1, 2, 3, 4, 5, 6: six rows, juniors 5.

**Time complexity:** `depth_of` touches each member once per level, and with an index on `mentor_id` each round is `O(k log n)` for the `k` newest rows, so the whole walk is about `O(n log n)`. `below` produces the closure, `C` rows, where `C` = the sum of (depth + 1) over members; that is `O(n log n)`-ish for a bushy random tree and up to `O(n^2)` for a single chain. The `GROUP BY` over the closure is `O(C log C)`. Space is `O(C)`. If a club ever grew to millions of members, we would store the closure (or the depth and a subtree size) and update it when a member joins, instead of recomputing it.

Observations:

- Parent-pointer tables need recursion as soon as the depth is unbounded.
- An anchor decides *where walks start*: founders for depth, every member for subtree sizes.
- The closure (ancestor, descendant) pairs answer many questions at once: depth, subtree size, "is X under Y?".
- Walking up and walking down build the same closure.

**Common mistakes:** counting only direct mentees; forgetting `- 1` (a member counted as their own junior); starting the depth walk from members who *have* a mentor, which loses the founders and shifts every depth; fixed self-joins that stop at three levels.

**Interview follow-ups:**

- *Print each member's chain up to the founder ("Faraz < Dinesh < Bharat < Anvi")?* Walk up while carrying a string: `path || ' < ' || m.name`, and keep the row that reaches a founder.
- *Who is the deepest member in each tree?* Carry the founder's id through `depth_of` as a third column, then take the top depth per founder with `ROW_NUMBER`.
- *Is member X under member Y?* Look for `(Y, X)` in `below`; an `EXISTS` on the closure answers it.

**A recursive CTE is a loop you write as data: an anchor where you start, a step that finds the next rows, and SQL keeps going until nothing new appears.**
