# Prompt: DSA problem (schema `dsa-problem@1`)

Paste: `_shared-rules.md`, this prompt, `docs/content/schema/common.schema.json`,
`docs/content/schema/dsa-problem.schema.json`, and one sample from `content/samples/dsa/` as the model answer. Then
the request block at the bottom, filled in.

---

Write ONE coding problem as a `parikshaa.content/dsa-problem@1` JSON object.

**The problem**
- Idea: the pattern in the request. Story: Indian everyday life (a chai stall, a metro line, a hostel, an exam hall),
  ours, 3–6 sentences, then the task in one bold sentence.
- Input is read from standard input, output written to standard output. Say the exact format in `input_format` and
  `output_format`, including what to print when there is no answer or the result is empty.
- `constraints` and `constraints_structured`: every variable's min and max. Choose maxima so the largest test input
  is under 1 MiB (e.g. n ≤ 10^5 with values ≤ 10^6). If any value or answer can pass 2^31 − 1, say the bound and
  make starters use 64-bit.
- `statement_rules`: case, ties, no-answer, multiple answers, empty output, floating point (prefer integers). Each
  rule also appears in the statement.

**Solutions** (`solutions`)
- `reference` in all five languages: `c`, `cpp`, `java` (class `Main`), `python`, `javascript` (Node, read all of
  stdin with `require("fs").readFileSync(0, "utf8")`). Fast I/O: C++ `ios::sync_with_stdio(false); cin.tie(nullptr);`,
  Java `BufferedReader` + `StreamTokenizer` or manual parsing, never `Scanner`; C `scanf`; Python
  `sys.stdin.buffer.read().split()`. Build output in one string and print once.
- `brute`: the obvious slow solution, in Python, plainly correct.
- At least two `wrong` solutions a learner might really write, each with `expect` and `why`: an O(n^2) one
  (`TLE`, in Python or C++), an `int` overflow (`WA`, in C++ or Java), an off-by-one or a missed edge case (`WA`).

**Starters** (`starters`, all five languages): a function stub with the right parameter and return types (64-bit
where needed) and the full input/output code around it, so the learner only fills the function. The stub returns a
default (0, empty) so it compiles and fails.

**Tests** (`test_plan`, PROBLEM-STANDARD §4): groups `samples` (2–3, visible, each with an `explanation`),
`minimal` (2+), `boundary` (min and max of every variable), `edge` (5+, from the type checklist: all equal, sorted,
reverse sorted, all negative, answer at the start/end, ...), `random_small` (10+ via a generator), `random_large`
(3+ near the maximum), `anti` (inputs that make each wrong solution fail: max n for O(n^2), values that overflow
`int`), `output_edge` (0, -1, empty, largest answer). Totals: L1 ≥ 20, L2 ≥ 30, L3 ≥ 40. Literal tests ≤ 2 KB;
anything larger comes from `generators`.
- `generators`: Python 3 programs. Read ONE line of space-separated arguments from stdin (e.g. `n maxv seed`), seed
  `random.Random(seed)`, print one test input. No files, no network, no time-based randomness.
- `validator`: Python 3, reads one input, exits 1 with a message if any constraint is broken.
- Leave `expected` out of generated tests; give `expected` on literal tests only when you are sure. The platform
  computes expected outputs from your Python reference and holds every other reference to them.

**Limits**: `time_ms` per language (C/C++ ≈ 4× the reference's worst case, at least 1000; Java 2× C++; Python and
JavaScript 3× C++), `memory_mb` 256.

**Hints**: 3 rungs, no code: (1) what to notice, (2) which tool or structure, (3) the key step of the optimal idea.

**Editorial** (`editorial`, Markdown, EDITORIAL-STYLE.md §1–§3). `##` headings exactly: `Problem`,
`Understand The Problem`, `Coming Up With The Solution`, `Writing The Solution`, `Testing / Reflection`.
- Understand: first line "Let's not jump to a solution...", a Note to ask questions, the statement broken into bold
  parts, the function signature, then Q&A headings for the input (empty? sorted? duplicates? negative? range?
  overflow?) and output, each answered in one word or a range.
- Coming Up: 3–4 examples, each followed by "**Why this example?**"; the one chosen and why; observations; the
  "start at index 0" walk line by line; complexity boxes (O(n log n) → sorting/heap, O(n) → one pass with a set or
  map, O(log n) → binary search, DP table...); `### Brute force`, `### Better` (when there is one) and `### Optimal`
  with the journey between them, including at least one tempting wrong turn and why it fails ("**But this gives
  the wrong answer!**"), a recap, pseudocode.
- Writing: one line, sanity-check list (every variable used? bounds `<` or `<=`? empty input? 64-bit?), then the
  line `[[code-tabs]]` (the platform puts the five references there).
- Testing / Reflection: a dry run on the chosen example (`[[visual:<id>]]` pointing to a `dry-run` visual with 5–12
  frames), time and space complexity with how they come, 3–5 interesting observations, common mistakes, related
  problems (our slugs from the request), interview follow-ups, revision card. Last line in bold.
- At least three `> **Note:**` callouts. Length: `editorial_length` from the request (form `long`: about
  7,000–8,000 words; `standard`: as the request says). Long means deeper, not padded: more examples worked in full,
  more wrong turns explained, a proof sketch of why the optimal is right, follow-up variants solved.

**Also**: `approaches` (brute/better/optimal with time, space, a two-line summary), `visuals` (at least one
`dry-run`: `data.frames` = list of `{step, note, vars}`), `revision_card`, `related` (only slugs from the request).

---
**Request**
```
slug: <slug>            version: 1          tier: <public|premium>
difficulty: <easy|medium|hard>   level: <L1|L2|L3>   rating: <800-2400>
pattern: <e.g. sliding-window, monotonic-deque>
topics: <labels>        related slugs: <2-4 of ours>
editorial_length: {"form": "long", "target_words": 7000}
text_language: en       author: <name>
placement: {"track": "<slug>", "module": "<title>", "position": <n>}
variants (optional): params and 2-5 sets, used as {{name}} in statement and every solution
```
