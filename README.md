# Parikshaa

> परीक्षा — *parīkṣā*, "examination"

An assessment engine that checks whether a candidate can **account for their own
answer**, instead of watching them through a webcam.

Proctoring asks "was the candidate alone?" — a question a second device has made
unanswerable. Parikshaa asks whether the candidate can defend a step, extend the
result, or say where their approach breaks. That is cheap for someone who
understood the problem and expensive for someone who obtained the answer.

Two pieces make that work:

- **Micro-viva engine** — a short follow-up exchange generated from the
  candidate's *own answer*. It produces evidence about provenance, never a
  second grade.
- **Integrity ledger** — a hash chain over every event in an attempt, so the
  candidate, the institution and an appeals board can each verify that the
  record they are shown is the one that was written.

No webcam, no screen capture, no keystroke biometrics. See
[`docs/SPEC.md`](docs/SPEC.md) for the full design and its commitments.

## Layout

```
packages/core/     domain model, integrity ledger, attempt fold  (@parikshaa/core)
docs/SPEC.md       specification
docs/STACK.md      tech stack and the reasoning behind it
```

## Development

Requires Node 20+.

```bash
npm install
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # tsc -> packages/*/dist
```

## Status

Early. The domain model, integrity ledger and attempt fold are implemented and
tested; the micro-viva engine is specified but not yet built. `docs/SPEC.md` §7
tracks what exists.
