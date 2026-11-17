# Prompt: lesson (schema `lesson@1`): CN, OS, DBMS, LLD, OOD, and C/C++/Python/Java/JS courses

Paste: `_shared-rules.md`, this prompt, `common.schema.json`, `lesson.schema.json`, one CS sample and one language
sample from `content/samples/lessons/` and `content/samples/language-lessons/`. Then the request.

---

Write ONE lesson as a `parikshaa.content/lesson@1` JSON object (CONTENT-CATALOG §3b, EDITORIAL-STYLE §5).

- 8–15 minutes: 1,200–2,500 words across `sections` (the validator fails below 800).
- `sections` in this order: `why` (2–4 sentences: where this shows up in real work or an interview), one to four
  `concept` sections (one idea each, short paragraphs, bold the key line, a `visual` where a picture helps:
  `mermaid` for sequence/state/class diagrams with `data.source`, `table` with `data.headers` and `data.rows`,
  `timeline`; always `alt`), an `example` (worked, with numbers or code), a `misconception` ("Many students think
  X. Actually Y, because Z."), an `interview` section with 3–5 `qa` pairs (answers 2–5 sentences, as a strong
  candidate would say them), a `summary` (5 bullets).
- `code` blocks: `{lang, src, runnable, stdin, expected_output}`. Every block with `expected_output` is run on the
  runner (C gcc C17, C++ g++ C++17, Java class `Main`, Python 3, Node, SQLite) and must print exactly that.
  Language lessons: every example is runnable with `expected_output`; CS lessons: use a small Python or SQL
  simulation where it helps (a page-table lookup, a normal-form split).
- `quiz`: 3–5 MCQs with 4 options and an explanation each, testing understanding, not recall of a sentence.
- `hands_on` (required for language lessons, optional for CS): one task with `starter` (compiles, fails), `solution`,
  and 4+ `tests` (stdin → exact stdout), visible and hidden.
- `revision_card` (front: a question; back: 3 lines), `outcomes` (2–4 "can ..." lines), `prerequisites`, `next`.

**Request**
```
slug: <course>-<topic>   course: <cn|os|dbms|lld|ood|lang-c|lang-cpp|lang-python|lang-java|lang-javascript>
title: <...>   difficulty: <easy|medium|hard>   tier: <public|premium>   text_language: <en|hi-Latn>
must cover: <bullet list from the syllabus>   prerequisites: <slugs>   next: <slugs>
author: <name>   placement: {...}
```
