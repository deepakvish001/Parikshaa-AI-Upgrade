# Prompt: SQL problem (schema `sql-problem@1`)

Paste: `_shared-rules.md`, this prompt, `common.schema.json`, `sql-problem.schema.json`, one sample from
`content/samples/sql/`. Then the request.

---

Write ONE SQL problem as a `parikshaa.content/sql-problem@1` JSON object. It runs on **SQLite 3**.

- `stem`: a short story of ours (a college canteen, a hostel, a cab company), the tables (each column with its type
  and meaning, keys), and the exact result: which columns, in which order, named how, and the row order (or "any
  order"). Say what happens with NULLs and ties.
- `schema_sql`: `CREATE TABLE` statements only. Use `INTEGER`, `TEXT`, `REAL`; dates as ISO text `'2026-11-17'`.
- `datasets` (6–12): `sample` (visible, 1–2, with `explanation`), `empty` (tables empty: `rows_sql: ""`), `null`
  (when a column can be NULL), `ties` (when ranking or ordering matters), `duplicates`, `fewer-rows` (e.g. "top 3"
  with 2 rows), `edge`, and `many-rows` from a `gen` (Python 3 printing INSERT statements; reads args on stdin;
  seeded). All but the samples hidden.
- `order_matters`: true only when the stem fixes a total order (with a tie-break column). Otherwise false.
- `reference`: one query. `alternatives`: other right queries (another approach: a join vs a subquery, a window vs a
  self-join). Every one must return the same rows on every dataset.
- `wrong`: 2–4 plausible wrong queries with `why` (INNER instead of LEFT JOIN, COUNT(*) vs COUNT(col), RANK vs
  DENSE_RANK, missing tie-break, WHERE instead of HAVING). Each must fail at least one dataset: add the dataset
  that catches it.
- SQLite only: no `RIGHT JOIN`/`FULL JOIN`, no `DATEDIFF`, `TOP`, `ISNULL`; use `julianday()`, `strftime()`,
  `COALESCE`, `LIMIT`, window functions, CTEs.
- `starter`: a comment and `SELECT` (it must not pass). `hints`: 3 rungs. `approaches`: 1–3.
- `editorial`: the same five `##` headings as DSA, shorter (`editorial_length.form: "standard"`, the target from
  the request), at least one `> **Note:**` and one "**Why this example?**", `[[code-tabs]]` in Writing The
  Solution, the time complexity (scan, sort, index) in Testing / Reflection.

**Request**
```
slug: sql-<slug>   version: 1   tier: <public|premium>   difficulty: <easy|medium|hard>   level: <L1|L2|L3>
concept: <e.g. LEFT JOIN + IS NULL, DENSE_RANK, gaps and islands>
editorial_length: {"form": "standard", "target_words": <from INSTRUCTIONS §4>}
author: <name>   placement: {...}   variants (optional): e.g. a city or a threshold as {{name}}
```
