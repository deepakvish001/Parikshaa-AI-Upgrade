# Content format v1: what a bulk upload contains (17 Nov 2026)

Tracker plan row 141, part A. The owner's team writes the Learn launch content with another AI, from the prompts in
[prompts/](prompts/) and the steps in [INSTRUCTIONS.md](INSTRUCTIONS.md), and uploads it through the console's bulk
upload (part B). This file is the contract between the three: what the AI must output, what the validator
(`scripts/content-validate.mjs`) checks, and what the importer stores.

The machine-readable form is [schema/](schema/), one JSON Schema per type. Where this file and a schema differ, the
schema wins and this file is fixed. Every rule here comes from [PROBLEM-STANDARD.md](../learn/PROBLEM-STANDARD.md)
(problems, tests, gates) and [EDITORIAL-STYLE.md](../learn/EDITORIAL-STYLE.md) (how we write). Ten samples of each
type, all passing the validator, are in [content/samples/](../../content/samples/).

Schema keys starting `x-` are notes for the importer: `x-db` says where a value is stored today, `x-needs-platform`
what the platform must add before the value is used. Section 12 lists all of the second kind in one place.

---

## 1. Types

| Type | `schema` value | Schema file | Stored today as | Launch scope (owner, 17 Nov 2026) |
|---|---|---|---|---|
| DSA problem | `parikshaa.content/dsa-problem@1` | [dsa-problem](schema/dsa-problem.schema.json) | `practice_problems` (kind `code`, stdin) | 1,000, public and premium |
| SQL problem | `parikshaa.content/sql-problem@1` | [sql-problem](schema/sql-problem.schema.json) | `practice_problems` (kind `code`, language `sql`) | 300 |
| MCQ / numeric | `parikshaa.content/mcq@1` | [mcq](schema/mcq.schema.json) | `practice_problems` (kind `mcq` or `numeric`) | aptitude 1,000 (quant, logical, verbal); CS and language quizzes |
| Lesson | `parikshaa.content/lesson@1` | [lesson](schema/lesson.schema.json) | `prep_lessons` + quiz (`prep_lesson_quiz`) + hands-on problems | CN, OS, DBMS, LLD, OOD tracks; C, C++, Python, Java, JS courses |
| Project | `parikshaa.content/project@1` | [project](schema/project.schema.json) | needs platform support (section 12) | projects per language, system design projects |
| System design | `parikshaa.content/system-design@1` | [system-design](schema/system-design.schema.json) | needs platform support; estimates and concept checks map to `practice_problems` | HLD + LLD |
| Bundle | `parikshaa.content/bundle@1` | [bundle](schema/bundle.schema.json) | one upload | |

Shared pieces (slug, tier, tags, authoring, variants, tests, files, visuals) are in
[common.schema.json](schema/common.schema.json).

## 2. Rules every item follows

### 2a. Identity and versions

- **`slug`** is the item's stable address: lowercase letters, digits and `-`, 2–80 characters
  (`^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$`, the DB's own check). It never changes after the first upload. Problems
  (DSA, SQL, MCQ, project, system design) share one namespace; lessons have their own. Use a prefix per type so slugs
  never collide: `sql-`, `apt-` (aptitude), `cs-` (CS quiz), `proj-`, `hld-`, `lld-`; DSA and lessons need none.
- **`version`** starts at 1 and goes up by one on every change. On upload (owner's decision, PREP-TRACKER "Faisle"):
  - a new slug is created as a draft;
  - the same slug with a **higher** version becomes the new draft (the published version stays live until the new
    one is published);
  - the same slug, the **same version and the same hash** is skipped;
  - the same slug, the **same version and a different hash**: if that version was **never published**, the draft is
    replaced (a re-upload fixes a draft without a version bump); once that version **is published**, the upload is
    refused with "raise the version";
  - a **lower** version is refused.
  A slug that belongs to a problem or lesson not made by an upload (the starter pack, one made by hand) is refused.
- **Content hash:** the importer hashes the item after `$file` references are resolved (SHA-256 of the canonical
  JSON: keys sorted, no spaces) and keeps it with the version.

### 2b. Tier, tags, text language

- **`tier`**: `public` (free) or `premium` (Plus). Premium items are reviewed in full before publish; public ones are
  sampled (section 11).
- **`difficulty`** is the DB's `easy | medium | hard`. Problems also carry **`level`** L0–L4
  ([PROBLEM-STANDARD.md](../learn/PROBLEM-STANDARD.md) §2): L0/L1 go with easy, L2 with medium, L3/L4 with hard.
- **`tags`**: `topics` (at least one), `patterns`, `extra` (all lowercase labels such as `prefix-sum`,
  `sliding-window`, `time-and-work`), and `companies`. A company is listed only with `verified: true` and a `source`
  we can show (our interview-experience id or a public report). No guessed "asked at" claims.
- **`text_language`**: `en` (English) or `hi-Latn` (Hinglish). Both follow EDITORIAL-STYLE §3.

### 2c. Authoring and originality

`authoring` is on every item: `author` (person or team accountable), `generated_with` (`human | ai | ai+human`),
`originality` (one or two sentences saying the story, statement, tests and editorial are our own) and `review`
(`draft → self-checked → reviewed → approved`, with who and when). The bundle manifest repeats the originality
statement for the whole batch and says what was done to check it.

### 2d. Markdown

Text fields are CommonMark with GitHub tables. Code in fenced blocks with a language (` ```python `). Maths as plain
text or `10^5`, `2·10^5`, `≤` (no LaTeX: the renderer has none). Callouts as `> **Note:**`. Two markers the renderer
replaces:

- `[[code-tabs]]`: the item's reference solutions, one tab per language (DSA, SQL).
- `[[visual:<id>]]`: the visual with that id from the item's `visuals`.

### 2e. `$file` (folder and ZIP bundles only)

Any string value may instead be `{"$file": "relative/path"}`: the file's text (UTF-8), relative to the item's JSON
file. Long editorials, solutions and generators live as their own `.md`, `.py`, `.cpp` files next to the item, which
is easier to write, review and diff. A single-file JSON bundle has everything inline; `content-validate.mjs --pack`
makes one from a folder.

### 2f. Placeholders and variants

`variants` gives per-learner variants (anti-cheat): `params` names the parameters, `sets` lists their values, at
least two sets. Every string in the item may contain `{{name}}`. `sets[0]` is the default: the item as written,
checked and shown in the console. Section 10 has the rules.

### 2g. Placement

`placement` puts the item in a track: `{track, module, position}`. The track (slug, title, description, modules in
order, free modules) is declared once in the bundle manifest's `tracks`.

## 3. Bundle

Two shapes, the same content:

1. **One JSON file**: `{"schema": "parikshaa.content/bundle@1", "manifest": {...}, "items": [...]}`, all inline.
2. **A folder or a ZIP of it**: `manifest.json` at the root holds `{"schema": "parikshaa.content/bundle@1",
   "manifest": {...}}`. Every other `*.json` below it whose top level has a `schema` starting `parikshaa.content/` is
   an item. Items may use `$file`. Images for MCQs sit in the folder and are named by `images[].file`.

The **manifest** ([bundle.schema.json](schema/bundle.schema.json)): `bundle_id` (stable batch name), `version`,
`title`, `author`, `created_on`, `generated_with`, `licence` (`owner`, `terms`), `originality` (`statement`, `checks`),
`tracks`, `notes`.

One bundle should hold one batch of one type (20–50 items): small enough to review in a sitting, large enough to be
worth an upload.

## 4. DSA problem (`dsa-problem@1`)

A whole program reads standard input and writes standard output (the owner's v1 format: a function stub plus an
input/output harness in the starter). PROBLEM-STANDARD package v2 in JSON.

| Field | What | Rule |
|---|---|---|
| `statement` | Our story and the task | No example block: samples come from the `samples` group |
| `input_format`, `output_format`, `constraints` | Markdown | Every variable's bounds; the output for "no answer" and for an empty result |
| `constraints_structured` | `{name, type, min, max}` per variable | The validator's constraint gate; `int64` where a value passes 2^31 |
| `statement_rules` | `case`, `ties`, `no_answer`, `multiple_answers`, `output_when_empty`, `floating` | Each also said in the statement |
| `languages` | `c, cpp, java, python, javascript` | All five |
| `starters` | Per language | Function stub + fast I/O (C++ `ios::sync_with_stdio(false)`, Java `BufferedReader`/`StreamTokenizer`, never `Scanner`), right integer width; must compile and must **not** pass |
| `solutions` | `{role, lang, src, expect?, why?}` | A `reference` in every language; one `brute` (any language, usually Python); at least two `wrong` with `expect` (`WA`, `TLE`, `RE`, `MLE`, `FAIL`) and `why` |
| `generators` | Python 3, reads one line of space-separated args, prints one input | Deterministic (seed from args); no files, no network |
| `validator` | Optional Python 3: input on stdin, exit 0 if valid | Gate 1. Without it, the validator checks `constraints_structured` on the first line of numbers only |
| `test_plan` | Groups (below), each `hidden`, with literal `tests` and/or `gen` + `args` | Literal tests small (≤ 2 KB); big ones from generators |
| `checker` | `exact` (default), `tokens`, `numbers` (tolerance), `unordered`, `custom` (Python) | |
| `limits` | `time_ms` per language, `memory_mb` | Python about 3× C++; Java about 2× |
| `hints` | 3 rungs, no code | `hints[0]` is the static rung 1 |
| `approaches` | `brute`, `better` (if any), `optimal`: `time`, `space`, `summary` | The editorial's tabs |
| `editorial`, `editorial_length` | 4-step editorial (below) | `form` `long` or `standard`, `target_words` |
| `visuals` | `dry-run` frames, arrays, grids | Each with `alt`; at least one `dry-run` |
| `revision_card`, `related` | Card text; 2+ of our own slugs | Never another site's link |

**Test groups** (PROBLEM-STANDARD §4a), each `{"group", "hidden", "tests"?, "gen"?, "args"?}`:

| Group | Must have | Brute held to it |
|---|---|---|
| `samples` (`hidden: false`) | 2–3, with `explanation` | yes |
| `minimal` | 2 | yes |
| `boundary` | 2 per variable (min and max) | no |
| `edge` | 5 (type checklist §4b) | yes |
| `random_small` | 10 (L0: 5), from a generator | yes |
| `random_large` | 3 | no |
| `anti` | 1 per wrong solution whose `expect` is `TLE`, and the overflow case | no |
| `output_edge` | when it applies (0, -1, empty, 64-bit) | yes |

Totals at least L0 15 · L1 20 · L2 30 · L3 40 · L4 50. A group may set `"brute": false` (or true) to change the
default. Expected outputs come from the Python reference (it is required); every other reference, in every language,
must then pass every test on the runner, so the five agree.

**Runner limits** (packages/runner): a test's input and expected output at most **1 MiB each**; a source at most
256 KB; time limit at most 10 s. Pick the maximum constraints so the largest test fits (for example `n ≤ 10^5` with
values up to `10^6`, not `2·10^5` values up to `10^9`).

**Editorial** (EDITORIAL-STYLE §1–§3, §6). Markdown with these `##` headings, in this order:

1. `## Problem` (statement in bold, one example with why)
2. `## Understand The Problem` (Q&A on input and output, signature first)
3. `## Coming Up With The Solution` (3–4 examples each with "Why this example?", the chosen example, observations,
   index-0 walk, complexity boxes, the brute → better → optimal journey with `### Brute force`, `### Better`
   (when there is one) and `### Optimal` sub-headings, wrong turns shown, pseudocode)
4. `## Writing The Solution` (sanity checks, then `[[code-tabs]]`)
5. `## Testing / Reflection` (dry run with `[[visual:...]]`, time and space, 3+ observations, related problems,
   common mistakes, interview follow-ups, last line bold)

In Hinglish (`hi-Latn`) the headings are `## Samasya`, `## Samasya samjho`, `## Hal tak pahuncho`, `## Code likho`,
`## Jaancho aur seekho`. At least three `> **Note:**` callouts. Length: `editorial_length.form` is `long` or
`standard` and `target_words` the owner's target for that tier and difficulty ([INSTRUCTIONS.md](INSTRUCTIONS.md) §4);
the gate fails below 85% of it.

**Stored as** a `practice_problems` row: `question` = `{kind: "code", stem, language: "python", languages, starters,
inputFormat, outputFormat, constraints, tests, checker, limits: {timeMs, memoryMb}}`; tests are materialised from
the test plan (`id` = `<group>-<n>`, weight 1, `explanation` on samples); `editorial` with `[[code-tabs]]` replaced by
the references; `hint` = `hints[0]`; `tags` = topics + patterns + extra; `published: false` until a reviewer
publishes.

## 5. SQL problem (`sql-problem@1`)

SQLite 3 (the runner's). A test is `schema_sql` followed by one dataset's `rows_sql`; the expected output is the
reference query's rows: one row to a line, columns separated by a tab, `NULL` for null.

| Field | Rule |
|---|---|
| `stem` | The task, each table (columns, types, keys), and the exact result columns and order |
| `schema_sql` | `CREATE TABLE` statements, the same for every dataset |
| `datasets` | 6+; `purpose` one of `sample, empty, null, ties, duplicates, fewer-rows, many-rows, edge, random`; must cover `sample`, `empty`, `null` (when a column is nullable), `ties` (when order or ranking matters), `many-rows`; `rows_sql` literal or `gen` (Python printing INSERTs) |
| `order_matters` | `true` only with a full tie-break in the stated order; `false` → checker `unordered` |
| `reference`, `alternatives` | Every one gives the same rows on every dataset |
| `wrong` | 2+ plausible wrong queries with `why`; each fails at least one dataset |
| `starter`, `hints`, `approaches`, `editorial`, `editorial_length` | As DSA, shorter (`standard`) |

No `RIGHT JOIN`/`FULL JOIN` (older SQLite), no vendor functions SQLite lacks (`DATEDIFF`, `IFNULL` is fine, `ISNULL`
is not). Dates as ISO text (`'2026-11-17'`) and SQLite's `date()`/`julianday()`.

## 6. MCQ / numeric (`mcq@1`)

Aptitude (quant, logical, verbal), CS quizzes (CN, OS, DBMS, OOP, LLD), language output-predict, design concepts.

| Field | Rule |
|---|---|
| `kind` | `mcq` (4–5 `options`, `correct` index) or `numeric` (`answer`, `tolerance`, `unit`) |
| `section`, `topic` | e.g. `aptitude-quant` / `time-and-work` |
| `stem`, `passage` | Passage for reading comprehension or data sets several questions share (same `id`) |
| `explanation` | EDITORIAL-STYLE §5 aptitude: `### Understand`, `### Plan`, `### Solve`, `### Check` (why each wrong option is wrong) |
| `distractors` | For each wrong option, the mistake that leads to it |
| `solver` | Python 3: reads a JSON object of parameter values (`{}` without variants), prints `{"answer": ..., "values": {...}}`: `values` are derived numbers that the stem, options or explanation show as `{{name}}` (so a variant's options and worked solution are its own). **Required for quant and for logical items that can be computed** (LEARN-V2 §3a: every quant item has a solver); the gate holds the key to it |
| `time_target_sec` | What a prepared learner needs |
| `images` | `{file, alt}`; alt says what matters in the picture |

The explanation opens after a right answer or three wrong ones (Faisle, K2-8).

## 7. Lesson (`lesson@1`)

CN, OS, DBMS, LLD, OOD tracks and the C, C++, Python, Java, JavaScript courses (CONTENT-CATALOG §3b,
EDITORIAL-STYLE §5: why → concept with a diagram → example → misconception → interview questions → quiz → revision
card).

| Field | Rule |
|---|---|
| `course` | `cn, os, dbms, lld, ood, lang-c, lang-cpp, lang-python, lang-java, lang-javascript, sql, hld` |
| `est_minutes`, `outcomes`, `prerequisites`, `next` | 8–15 minutes, 1,200–2,500 words of body |
| `sections` | In order, `kind` one of `why, concept, example, misconception, interview, summary, note`; must include `why`, `concept`, `misconception`, `interview` (with `qa`), `summary` |
| `sections[].code` | `{lang, src, runnable, stdin?, expected_output?}`; every block with `expected_output` is run on the runner and must print exactly that. Language lessons: every example runs |
| `sections[].visual` | Diagrams (`mermaid`, `table`, `timeline`, ...), with `alt` |
| `quiz` | 3–10 inline MCQs with explanations |
| `hands_on` | "Khud karo": `{lang, task, starter, solution, tests}`; solution passes, starter fails. Required for language lessons |
| `revision_card` | Front and back |

**Stored as** a `prep_lessons` row (`body` = the sections rendered to Markdown: `## heading`, body, fenced code,
visual alt text, Q&A as `**Q:**`/`**A:**`), quiz items as `practice_problems` (kind `mcq`, slug
`<lesson>-q<n>`) linked through `prep_lesson_quiz`, and hands-on tasks as `practice_problems` (kind `code`, slug
`<lesson>-<id>`) placed after the lesson in its module.

## 8. Project (`project@1`)

A small program in one language, built over milestones, graded by hidden tests plus a rubric. Tests drive the program
through standard input: a **driver** file reads commands and calls the learner's classes or functions, and prints
results; each test is a command script and the exact output.

| Field | Rule |
|---|---|
| `files` | The starter tree; `editable: false` for the driver and data |
| `solution_files` | Replacements by path that pass every test (never shown) |
| `bundle_order` | Order the files are joined into the runner's one file; the driver (with `main`) last |
| `tests` | 8+ `io_test`s, `milestone` on each; the starter must fail at least one, the solution pass all |
| `milestones` | 2–8 steps, each with instructions and hints |
| `rubric` | Weights sum to 100; `checked_by` `tests`, `review` or `ai-feedback` (advice only, at most 20) |

**Bundling rules** (the runner runs one file today; the importer and the validator join files like this):

| Language | How files are joined |
|---|---|
| Python | Each non-entry file becomes a module (`sys.modules[name]`, executed in `bundle_order`), so `import cart` and `from cart import Cart` work; the entry runs as `__main__` |
| JavaScript | Each file is wrapped as a CommonJS module; `require("./cart")` resolves to it; the entry runs last |
| Java | No `package` lines. Only `Main` is `public`; other top-level types are package-private. Imports are hoisted and de-duplicated; files are joined in order into `Main.java` |
| C / C++ | Local headers use include guards or `#pragma once`; `#include "x.h"` lines of project files are dropped and files are joined in order (headers first, then sources, then the driver) |

## 9. System design (`system-design@1`)

`mode: "hld"` or `"lld"`. Both: `scenario`, `clarifying_questions` (4+, with answers), `requirements` (functional,
non-functional with targets, out of scope), `rubric` (weights sum to 100), `reference_solution` (the walkthrough,
EDITORIAL-STYLE §5), `concept_checks` (3+ MCQs), `follow_ups`, `revision_card`.

- **HLD** adds `estimates` (numbers with `tolerance_pct`, `unit`, `working`, optional `solver`; auto-checked),
  `expected_components` (`must` or nice-to-have, with why), `api`, `data_model`, `diagram` (Mermaid),
  `deep_dives`, `trade_offs`, `failure_modes`. At least 3 estimates and 6 components.
- **LLD** adds `entities`, `patterns` (with why), `diagram` (class diagram), and a `kata`: an `io_protocol`, the
  same `tests` for every language, and `implementations` in **at least two** languages (each with starter `files`,
  `solution_files`, `bundle_order`), plus a `change_request` (new requirement and tests) with `change_files` per
  language that pass the old tests and the new ones. Joined by the bundling rules of section 8.

## 10. Variants (per-learner)

- Parameters change what makes a copied answer wrong: a constant (a modulus, `k`, a fee), a dataset value, a date,
  numbers in an aptitude stem. Names and stories may change too.
- `sets[0]` is the default. For each set the validator substitutes `{{name}}` everywhere and runs the full gates:
  DSA and SQL recompute every expected output from the reference for that set (literal `expected` values are checked
  for `sets[0]` only); an MCQ's `solver` runs for each set; its `values` fill the remaining `{{name}}` in the stem, options and
  explanation; the options must stay distinct and the keyed one must equal the solver's answer, in every set.
- The editorial is written for `sets[0]` and shown with the learner's own values substituted. In an MCQ, write every
  number that changes as a placeholder (a parameter, or a value the solver prints); in a DSA or SQL editorial, keep
  worked numbers to the example of `sets[0]` and say so.
- **Stored as** (needs platform support): one materialised copy per set; a learner gets set
  `hash(learner id, slug) mod sets.length`; the same learner always gets the same set.

## 11. Gates and the upload flow (for part B)

`node scripts/content-validate.mjs <bundle-or-folder>` runs these; the console's bulk upload runs the same.

| # | Gate | Types |
|---|---|---|
| 1 | Schema (the files in [schema/](schema/)) | all |
| 2 | Semantics: slug unique in the bundle, difficulty matches level, required test groups and totals, references in every language, editorial headings, word count ≥ 85% of target, at least 3 Notes, `[[code-tabs]]` and every `[[visual:id]]` present, no links to other problem sites, rubric weights sum to 100, MCQ options distinct and the key in range | all |
| 3 | Constraints: every test input passes the item's `validator` | DSA |
| 4 | References agree: the Python reference makes the expected outputs; every reference in every language passes every test on the runner | DSA, SQL |
| 5 | Brute agrees on the groups it is held to | DSA |
| 6 | Wrong solutions fail, with their `expect` verdict | DSA, SQL |
| 7 | Starters compile and do not pass | DSA, project, LLD, hands-on |
| 8 | Runnable code prints its `expected_output`; hands-on and project solutions pass | lesson, project, LLD |
| 9 | Solver matches the key (each variant set) | MCQ, HLD estimates |
| 10 | Mutation (optional `--mutate`): the Python reference's small mutants are killed by the tests; ≥ 95% is the goal, equivalent mutants are marked by the reviewer | DSA |
| 11 | Duplicate check: title and statement similarity against the bundle (and, in the console, the bank) | all |

**Upload flow:** file (JSON or ZIP) → gates 1–2 for every item (fast; the report lists every problem) → gates 3–11
on the runner → each item that passes goes in as a **draft** (published false) with its version, hash and report;
items that fail are not stored and the report says why → a reviewer reads and presses **Publish**; then Learn shows
it. Review rule (owner, F6): every **premium** item is read in full before publish; **public** items are sampled
(at least 1 in 10 per bundle, and every item of a new author's first bundle); the A2Z path is read in full.

## 12. Needs platform support (part B)

What the DB and API do not have today, by field. Until it exists the importer keeps the value with the item's
version (suggested: one `content_items` table: `slug`, `type`, `version`, `hash`, `bundle_id`, `item jsonb`,
`review_state`, `report jsonb`) and does what the last column says.

| Need | Fields | Until then |
|---|---|---|
| Item versions, hash, source bundle, review state | `version`, `authoring`, manifest | Keep in `content_items`; `practice_problems`/`prep_lessons` hold the published projection |
| Per-item Plus lock | `tier: premium` | Problems are not locked today (only lessons past a track's free modules): place premium lessons after `free_modules`; premium problems wait for the lock |
| Per-language time limits | `limits.time_ms` | Store the largest as `limits.timeMs` |
| Static hint rungs 2–3 | `hints[1..]` | `hints[0]` goes to `hint`; the rest stay in `content_items` |
| Brute, wrong solutions, generators, validator, test plan, structured constraints | DSA | Kept for the gates; tests materialised into `question.tests` |
| Large tests in object storage | DSA `random_large`, `anti` | Inline in `question.tests` (each ≤ 1 MiB); move to storage with a hash later (PROBLEM-STANDARD §3 `tests_uri`) |
| Code tabs and visuals renderer | `[[code-tabs]]`, `[[visual:id]]` | Replace `[[code-tabs]]` with one fenced block per reference; replace a visual with its alt text (dry-run: a table of frames) |
| Revision card text | `revision_card` | Keep; cards today come from wrong answers |
| Related links | `related` | Resolve to links at publish; missing slugs are a warning |
| Variants | `variants` | Materialise one copy per set; assign per learner (section 10) |
| Company claims | `tags.companies` | `prep_companies` + `prep_company_reports` (source `staff`) for verified ones only |
| Project and LLD kata page, multi-file editor and runner | `project`, `system-design.kata` | Join files by the bundling rules (section 8) into one runner source |
| HLD case page, rubric review | `system-design` (hld) | Estimates as `numeric` problems, concept checks as `mcq` problems |
| Lesson sections as structured blocks | `lesson.sections` | Render to Markdown in `prep_lessons.body` |
| Hands-on tasks after a lesson | `lesson.hands_on` | `practice_problems` placed after the lesson in its module |
| MCQ images in a ZIP | `mcq.images` | Upload to `/api/media` and store the hash in `question.images` |

## 13. Quick reference: limits

| Limit | Value | From |
|---|---|---|
| Slug | `^[a-z0-9][a-z0-9-]{0,78}[a-z0-9]$` | DB check |
| Title | 1–160 characters | DB check |
| Lesson body | ≤ 200,000 characters | DB check |
| Test input, expected output | ≤ 1 MiB each | runner |
| Tests per run request | 100 (the validator batches) | runner |
| Source | ≤ 256 KB | runner |
| Time limit | ≤ 10,000 ms | runner |
| Memory | 32–1,024 MB | runner |
| Lesson quiz | ≤ 10 questions | `prep_lesson_quiz` |
| Languages | `c` (gcc C17), `cpp` (g++ C++17), `java` (class `Main`), `python` (3), `javascript` (Node), `sql` (SQLite 3) | `packages/runner/src/languages.ts` |
