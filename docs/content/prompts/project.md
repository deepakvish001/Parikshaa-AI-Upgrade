# Prompt: project (schema `project@1`)

Paste: `_shared-rules.md`, this prompt, `common.schema.json`, `project.schema.json`, one sample from
`content/samples/projects/` in the same language. Then the request.

---

Write ONE project as a `parikshaa.content/project@1` JSON object.

- A small, real program (2–6 hours) in ONE language, split into 2–4 source files plus a **driver** (the file with
  `main`) that reads commands from standard input, calls the learner's code and prints results. Describe the
  commands and outputs in `io_protocol` so a learner can test by hand.
- `files`: the starter tree. Classes and function signatures in place, bodies left as `TODO` returning defaults, so
  it builds and fails. The driver and data files `editable: false`.
- `solution_files`: the same paths, filled in; passes every test.
- `bundle_order`: files in dependency order, driver last. Joining rules (CONTENT-FORMAT §8): Python and JavaScript
  files flat at the top level, imported as `import cart` / `require("./cart")`; Java with no `package` line and only
  `Main` public; C/C++ headers with include guards, included as `#include "cart.h"`.
- `milestones` (2–5): each a step the learner can finish and test; `tests` carry `milestone`.
- `tests`: 8–20 command scripts with exact output: normal use, every error message, edge cases (empty, duplicate,
  limits). At least 2 visible. Small (≤ 2 KB each).
- `rubric`: weights sum to 100: tests 60–70, review (structure, naming, error handling) 20–30, `ai-feedback` ≤ 20.
- `brief`, `requirements` (3–8), `extensions` (ideas beyond the tests).

**Request**
```
slug: proj-<lang>-<name>   language: <c|cpp|java|python|javascript>   difficulty: <...>   tier: <...>
idea: <one line>   est_hours: <n>   author: <name>   placement: {...}
```
