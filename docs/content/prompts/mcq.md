# Prompt: aptitude / CS / language MCQ (schema `mcq@1`)

Paste: `_shared-rules.md`, this prompt, `common.schema.json`, `mcq.schema.json`, two samples from
`content/samples/aptitude/`. Then the request.

---

Write the requested number of questions as a JSON array of `parikshaa.content/mcq@1` objects.

- `kind`: `mcq` (exactly 4 options, one right; `correct` is its index) or `numeric` (`answer`, `tolerance`, `unit`).
- Options: same form and length (all numbers in the same unit, all sentences of a similar length), in a natural
  order (ascending numbers). No "all of the above"/"none of the above". Each wrong option is a real mistake:
  write it in `distractors` (`{option, mistake}`), e.g. "added the percentages instead of multiplying".
- `explanation` (EDITORIAL-STYLE §5): `### Understand` (what is asked, what is given), `### Plan` (the concept or
  formula; when a shortcut works), `### Solve` (numbered steps, every number shown), `### Check` (units, a rough
  estimate, and why each wrong option is wrong). Hinglish (`hi-Latn`): `### Samjho`, `### Plan`, `### Hal`,
  `### Jaancho`.
- `shortcut` when one is honest. `time_target_sec`: what a prepared student needs (quant 60–120, verbal 45–90).
- **`solver` is required for quant** and for any logical item that can be computed (series, arrangements,
  calendars, blood relations as a search): a Python 3 program that reads a JSON object of parameter values
  (`{}` when there are no variants) and prints one line `{"answer": "<the right option's exact text>"}` (or a number
  for numeric). It must compute, not print a constant.
- **Variants** (quant, when the request asks): `variants.params` and 3–5 `sets`; the stem uses the parameters as
  `{{name}}`; the options and the worked explanation use `{{name}}` for every number that changes, and the solver
  prints those as `"values": {"name": ...}` next to `"answer"`. The keyed option must equal the answer in every
  set, and the four options must stay different.
- Verbal: a `passage` (120–250 words, ours) shared by its questions (same `passage.id`); grammar and vocabulary
  in Indian-English workplace contexts; no idioms that need a native speaker to judge.
- CS quizzes (`cs-*`), language output-predict (`lang-*`): the code in the stem must compile and print what the
  right option says; state the language version if it matters.

**Request**
```
section: <aptitude-quant|aptitude-logical|aptitude-verbal|cs-os|...>   topic: <label>   count: <n>
difficulty mix: <e.g. 3 easy, 5 medium, 2 hard>   tier: <public|premium>   text_language: <en|hi-Latn>
slug prefix: apt-<topic>-   start number: <n>   author: <name>   variants: <yes for quant|no>
```
