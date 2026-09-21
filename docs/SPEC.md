# Parikshaa — Specification

> परीक्षा — *parīkṣā*, "examination"

## 1. Problem

Online assessment has an authorship problem, not a proctoring problem.

Webcam proctoring, lockdown browsers and keystroke analysis all try to answer
"was the candidate alone?" That question has become unanswerable: a second
device is out of frame, and a good answer produced elsewhere is indistinguishable
from a good answer produced in the room.

Parikshaa asks a different question: **can the candidate account for their own
answer?** Understanding is cheap to demonstrate and expensive to fake. Someone
who worked a problem can say why a step was necessary, what would change if a
premise moved, and where their approach would break. Someone who obtained the
answer usually cannot, and the gap shows up in seconds rather than pixels.

## 2. Scope

This repository holds the assessment engine, not a hosted product. In scope:

- a domain model for exams, attempts and responses
- a tamper-evident ledger of everything that happens during an attempt
- the micro-viva engine (§4)
- scoring that keeps grade and provenance separate
- the candidate interface for sitting an exam and answering a probe (§8)
- the institution console for authoring exams and reviewing evidence (§9)

Out of scope for now: authoring UI, identity and enrolment, payments, and any
form of biometric or video surveillance. The last is a design choice, not a
backlog item — see §6.

## 3. Attempt lifecycle

```
created → in_progress → submitted → graded
                      ↘ void
```

An attempt is never mutated in place. Every step appends an `ExamEvent` to the
attempt's ledger, and the attempt's current state is a fold over that stream.
This makes the record replayable: given the ledger, any grade Parikshaa reported
can be recomputed and checked. The fold is `foldAttempt` in
`packages/core/src/attempt.ts`, and it is strict — an answer recorded after
submission or an event from another attempt is reported, not absorbed, because
those are exactly what an audit is looking for.

## 4. The micro-viva engine

A **micro-viva** is a short follow-up exchange about an answer the candidate has
already submitted.

**When it fires.** Not on every answer — that would be an interrogation. The
`vivaTriggerRatio` policy sets a lower bound: an answer well below it is already
clearly wrong, so its provenance does not matter. Above it, the answer is strong
enough that where it came from is worth one question.

**What it asks.** A probe is generated *from the candidate's own answer*, not
from the question. It asks them to defend a specific step, extend the result to
a neighbouring case, or say what would break under a changed premise. A probe
that can be answered from the question alone is a bad probe.

**What comes back.** A `VivaVerdict` — `consistent`, `shallow`, `inconsistent`
or `inconclusive` — with a confidence and written reasoning. Reply latency is
recorded alongside, since an instant fluent reply to a probe designed to require
thought is itself informative.

**What it is not.** A verdict is **evidence about provenance, never a second
grade.** It does not raise or lower a score. It attaches to the attempt so that
a human can act on it, and `inconclusive` is a first-class outcome rather than a
failure to decide.

## 5. Integrity ledger

Every event is appended to a hash chain: each entry commits to the hash of its
predecessor, so editing, reordering or removing any entry invalidates every hash
after it.

This does not prevent tampering — whoever holds the store can rewrite the chain
end to end. What it provides is *detection by a third party*: the candidate, the
invigilating institution and an appeals board can each hold the head hash at the
time of the attempt, and any of them can later prove that the record they are
shown is or is not the one that was written. Assessment disputes turn on exactly
that, and on nothing a webcam recorded.

See `packages/core/src/ledger.ts`.

## 6. Design commitments

1. **A grade and a suspicion are different objects.** Provenance evidence never
   silently moves a score. A human decides, with the reasoning in front of them.
2. **The candidate can see their own ledger.** A record kept against someone
   that they cannot inspect is not evidence. While the attempt is open they get
   the head hash alone, which is what the guarantee actually needs — pin it now,
   verify the chain when the attempt closes. The entries themselves carry probe
   rationales and viva verdicts; releasing those mid-exam would disclose scores
   and turn the assessment into a feedback loop for defeating it.
3. **Inconclusive is a real answer.** The engine is not required to reach a
   verdict, and is not tuned to.
4. **No surveillance.** No webcam, screen capture, keystroke biometrics or
   device fingerprinting. The engine's only input is what the candidate wrote
   and said in response to being asked about it.
5. **Explainable by construction.** Every probe carries the rationale for asking
   it; every verdict carries reasoning. Both survive in the ledger for appeal.

## 8. The candidate interface

The interface is part of the design, not a skin over it, because two of the
commitments in §6 are things a candidate experiences rather than things the
server does.

**A probe must not read as an accusation.** It is presented as a follow-up
question with the same visual weight as any other question: no warning colour,
no countdown, no mention of integrity, verification or provenance. This is not
politeness. A candidate who feels accused answers defensively, and a defensive
answer tells you nothing about whether they did the work — the signal the probe
exists to collect is destroyed by the act of collecting it badly.

**No timer is shown, and none is sent.** Reply latency is measured server-side
between the probe's recorded `askedAt` and the arrival of the reply. The client
has no timing field to report, correctly or otherwise.

**The exam reaches the client stripped.** An `Exam` carries its own answer key —
`correctIndex`, `expected`, `expectedPoints`, and rubric criteria that read as
hints. `candidateView` projects it into types that have nowhere for those to
live, so a field added to `Question` later cannot leak by being forgotten. The
`vivaTriggerRatio` is withheld for the same reason: knowing the threshold tells
a candidate which of their answers scored well.

**The candidate leaves with something.** After submission they get their head
hash and can download the full record. That is the artefact an appeal turns on.

## 9. The review console

The console's one design requirement follows from §6.1: **a grade and a
provenance verdict must not look like the same kind of object.** The grade is a
settled number. The evidence below it is material for a person to weigh, shown
with the probe, the reply, the server-measured latency, the verdict and its
reasoning.

There is deliberately no control on that screen that turns a verdict into a
mark. Adjusting a grade is a decision someone makes and owns; a button for it
would launder a model's reading into a number and make the separation in §6.1
decorative. Whatever a reviewer decides, they decide outside this screen, with
the reasoning in front of them.

Exams are validated before they are stored, and every problem is reported at
once rather than one per round trip. An exam is written once and sat by a whole
cohort; most misconfigurations only surface at grading, by which time the
sitting is over.

## 7. Status

| Component | State |
|---|---|
| Domain model | implemented — `packages/core/src/domain.ts` |
| Integrity ledger | implemented — `packages/core/src/ledger.ts` |
| Attempt fold / replay | implemented — `packages/core/src/attempt.ts` |
| Probe generation | implemented — `packages/viva/src/engine.ts` |
| Verdict assessment | implemented — `packages/viva/src/engine.ts` |
| Scoring | implemented — `packages/core/src/scoring.ts` (deterministic) and `packages/viva` (rubric) |
| Persistence | implemented — `packages/store` |
| HTTP API | implemented — `packages/api` |
| Candidate interface | implemented — `packages/web` |
| Exam authoring and review console | implemented — `packages/console` |
| Deployment | implemented — `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` |
| Identity / enrolment | not started (out of scope, §2) |

Complete end to end and deployable: an institution can author an exam, issue
access codes, and review; a candidate can sit it, answer a probe and leave with
a verifiable receipt. What remains is identity and enrolment integration, which
§2 keeps out of scope.

The stack and the reasoning behind it are recorded in [`STACK.md`](STACK.md).
