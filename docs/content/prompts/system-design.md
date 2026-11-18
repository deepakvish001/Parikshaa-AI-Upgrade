# Prompt: system design case (schema `system-design@1`), HLD or LLD

Paste: `_shared-rules.md`, this prompt, `common.schema.json`, `system-design.schema.json`, one HLD and one LLD
sample from `content/samples/system-design/`. Then the request.

---

Write ONE case as a `parikshaa.content/system-design@1` JSON object (EDITORIAL-STYLE §5: the owner's book's way:
understand the ask, scope questions, sketch the flow, find sub-systems, layer them, check against a list).

Both modes:
- `scenario`: the ask as an interviewer gives it, Indian context where natural (UPI, IRCTC, food delivery), 45
  minutes (`time_minutes`).
- `clarifying_questions` (5–8) with the answers we assume; `requirements` (functional, non-functional with
  numeric targets: QPS, p99 latency, availability, durability; out of scope).
- `reference_solution` (Markdown, 1,200–2,500 words): the walkthrough in the order a strong candidate would speak,
  with the diagram referenced, the numbers used, and the trade-offs argued.
- `concept_checks`: 3–5 MCQs on the decisions in this case. `rubric`: 5–8 criteria, weights sum to 100.
- `follow_ups`, `trade_offs`, `failure_modes`, `revision_card`.

HLD (`mode: "hld"`):
- `estimates` (3–6): QPS, storage per year, bandwidth, cache size, servers. Each with `answer`, `tolerance_pct`
  (10–25), `unit`, `working` (the arithmetic), and a `solver` (Python printing the number) so the gate checks it.
- `expected_components` (6–12, `must` true/false, why), `api` (3–6 endpoints), `data_model`, `diagram` (Mermaid
  `flowchart` in `data.source`, with `alt`), `deep_dives` (2–4: the hard parts).

LLD (`mode: "lld"`):
- `entities` (3–8), `patterns` (with why), `diagram` (Mermaid `classDiagram`).
- `kata`: `io_protocol` (commands on stdin, exact output lines), `tests` (8–15, the same for every language),
  `implementations` in at least two of Java, Python, C++ (each: starter `files` that build and fail, `solution_files`
  that pass, `bundle_order`, `change_files`), and a `change_request` (a new requirement, 2–5 tests). `change_files`
  pass the old and new tests; the old solution fails at least one new test. Joining rules as in the project prompt.

**Request**
```
slug: <hld|lld>-<name>   mode: <hld|lld>   difficulty: <...>   tier: <...>   focus: <what the case teaches>
languages (LLD): <java, python>   author: <name>   placement: {...}
```
