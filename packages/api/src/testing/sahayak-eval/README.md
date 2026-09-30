# Sahayak evals

Three evals of the tutor (`src/sahayak.ts`), on one set of cases:

| Flow | Case | Graded on |
|---|---|---|
| `sahayak-hint` | a wrong program, and a request for hint rung 1, 2 or 3 | **leak-free** (no code block at rungs 1–2, no real-language code at rung 3, and the judge finds nothing past the rung), helpful, language |
| `sahayak-review` | the same program, submitted, and a request for a review | **bug found** (the judge is shown the hidden mistake), complexity right, no corrected program, language |
| `sahayak-doubt` | a question about the problem: asking for the whole solution, a concept, or being stuck | **no solution** given, answered, language |

The cases are 40 problems written for this eval (`problems-*.ts`), each with a
right Python program and three wrong ones — off by one, overflowing a 32-bit
integer, too slow — and three doubts. 8 of the 40 are asked and answered in
Hindi. `validate.ts` checks on the real runner that every wrong program fails
the way its case says; the test suite checks three problems, and
`SAHAYAK_EVAL_VALIDATE=all` checks all 40.

Each case runs through the real server on an in-process Postgres, as a new
learner, so the tutor gets exactly what a learner's request would give it.
The judge is `claude-sonnet-5-5` with structured output (`grade.ts`).

## Running

A run calls the model and costs money: run it only with the owner's go-ahead.
From the repository root, after `npm run build`:

```sh
# Free: a stand-in model, to try the runner and the report.
SAHAYAK_EVAL_DRY=1 SAHAYAK_EVAL_CASES=pilot npx tsx packages/api/src/testing/sahayak-eval/run-eval.mjs \
  --flow /tmp/dry/sahayak-hint --variant baseline --model claude-opus-5-5

# Does the grading tell right from wrong? Judge calls only.
ANTHROPIC_API_KEY=... npx tsx packages/api/src/testing/sahayak-eval/judge-sanity.ts

# The pilot (8 cases a flow), then the whole flow; a rerun resumes.
ANTHROPIC_API_KEY=... SAHAYAK_EVAL_CASES=pilot npx tsx packages/api/src/testing/sahayak-eval/run-eval.mjs \
  --flow .claude/hillclimb/sahayak-hint --variant baseline --model claude-opus-5-5 --timeout-s 300
```

The runner refuses to start until its files are approved once with
`--approve-harness` (it records their hash in `_state.json`), and again after
any of them changes. Results land in `.claude/hillclimb/<flow>/baseline/`:
`results.jsonl`, `traces/`, `errors.jsonl`. `review-md.ts` writes the graded
cases, with the judge's reasons, as one Markdown file; the `claude-api`
skill's report builder writes `report.html`.
