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

- organisations, each isolated from the others, with individual staff accounts,
  roles, API keys and an audit log of what staff did

Out of scope for now: candidate accounts and enrolment. Candidates have no
accounts: an institution already knows who its candidates are, and issues each
one an access code for one attempt.

Camera proctoring — an identity check, webcam photos and browser events — is
available per exam for buyers who require it (ROADMAP §14). It is off unless an
exam's author turns it on, it is disclosed to the candidate before their clock
starts, and it never reaches the engine: see §6.4.

## 3. Attempt lifecycle

```
created → in_progress → submitted → graded
                      ↘ void
```

`in_progress` ends either when the candidate submits or when the window runs
out — the exam's `durationMs` plus any `time_extended` a person granted, with a
reason, recorded in the ledger. An expired attempt is closed by the next write
that touches it, which refuses that write; reads never close one, so looking at
an attempt cannot end it.

**Each candidate's paper.** An exam's fixed questions go to everyone; each
section contributes `pick` questions drawn from its pool, seeded by the attempt
id (`resolvePaper` in `packages/core/src/paper.ts`). The paper is recorded in
`attempt_started` and from then on *is* the exam for that attempt: the
candidate is shown only those questions, answers to any other are refused, and
scoring and probing see nothing else. An exam that has been sat is frozen; it
is changed by cloning it.

**Code.** A code question is scored by running the candidate's code against its
tests: visible ones, shown as examples, and hidden ones, which decide the score
and never reach the candidate's client. When a code answer is committed it is
tested in full and a `code_tested` entry records how many tests passed — the
counts, not the tests, since the chain is shown to the candidate afterwards.
That result stands in for a score until grading, so a strong solution can be
followed up with a probe about the candidate's own code while it is fresh.

**Drafts are not answers.** What a candidate types is autosaved every few
seconds to a separate, mutable draft store, outside the ledger. A chain of
every keystroke pause would bury the record, and on an exam that forbids
revision it would lock the first half-typed answer. The ledger records answers
the candidate committed. When the attempt closes — by submission or by time —
the server commits any draft that says something the ledger does not and was
saved before the deadline, stamped with the time it was saved. A crash, a dead
battery or a lost connection therefore costs nothing written in time; what was
typed after the window is not committed. On an exam that forbids revision, a
committed answer is never replaced by a later draft.

Appends that depend on the attempt being open (answers, extensions, closing)
are re-checked under the attempt's row lock, so a request that read the attempt
as open cannot land behind a submission that won the race.

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

A record that cannot be checked is not evidence, so checking it must not
require the institution's cooperation. `@parikshaa/verify` verifies a downloaded
receipt with no server, no database and no network, and the candidate's own
browser does the same with WebCrypto. Both walk one implementation of the chain,
parameterized by the digest, because two copies would eventually disagree — and
a disagreement would look exactly like the tampering this is meant to detect. A
conformance test pins the two digests to identical output.

**A receipt that verifies on its own proves less than it appears to.** Any
internally consistent chain verifies, including one written from scratch. What
makes substitution detectable is the head hash the candidate pinned *during* the
attempt: a commitment made before anything could be reconsidered. Finding it at
its own position proves the record now being shown grew from the one they saw
then. The verifier takes it with `--head`.

See `packages/core/src/chain.ts`, `packages/core/src/ledger.ts` and
`packages/verify`.

## 6. Design commitments

1. **A grade and a suspicion are different objects.** Provenance evidence never
   silently moves a score. A human decides, with the reasoning in front of them —
   and the deciding is a real act with a real path (§9), not a sentiment. What
   they may do is set the attempt aside, and the ledger records *their* reason,
   never a model's. No verdict, confidence or combination of them reaches that
   outcome on its own.
2. **The candidate can see their own ledger.** A record kept against someone
   that they cannot inspect is not evidence. While the attempt is open they get
   the head hash alone, which is what the guarantee actually needs — pin it now,
   verify the chain when the attempt closes. The entries themselves carry probe
   rationales and viva verdicts; releasing those mid-exam would disclose scores
   and turn the assessment into a feedback loop for defeating it.
3. **Inconclusive is a real answer.** The engine is not required to reach a
   verdict, and is not tuned to.
4. **The camera never grades.** By default there is no webcam, screen capture,
   keystroke biometrics or device fingerprinting. An exam may turn on camera
   proctoring (ROADMAP §14), and then the candidate is told exactly what is
   taken before their clock starts. Even so, the engine's only input is what
   the candidate wrote and said in response to being asked about it: photos
   and browser events go to a person, as observations to weigh, and never
   into a probe, a verdict or a score. They are sealed and erased like the
   rest of the attempt's personal data.
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
hash and can download the full record, and can check it in the browser. That is
the artefact an appeal turns on.

**A candidate who is set aside is told why.** The reason a reviewer recorded is
shown to them as written — not summarized, not softened — alongside the note
that their record is unchanged and still checks out. Being set aside without
being told why is the situation §6.2 objects to.

## 9. The review console

The console's one design requirement follows from §6.1: **a grade and a
provenance verdict must not look like the same kind of object.** The grade is a
settled number. The evidence below it is material for a person to weigh, shown
with the probe, the reply, the server-measured latency, the verdict and its
reasoning.

There is deliberately no control on that screen that turns a verdict into a
mark. Adjusting a grade is a decision someone makes and owns; a button for it
would launder a model's reading into a number and make the separation in §6.1
decorative.

**Setting an attempt aside** is the act §6.1 reserves for a person, and it has
its own section on the screen — not in the grade card, which would make it look
like a grading action, and not in the evidence card, which would make it look
like the verdict's consequence. It takes two steps and a written reason, and
that friction is the point: the reason is written into a tamper-evident record,
shown to the candidate, and is what an appeal will be argued against. A
one-click button would not produce one worth having.

An attempt may be set aside after it was graded — usually that is exactly when,
because someone has just read the evidence. Voiding does not erase the grade or
anything else already recorded; it appends. Nothing follows a void.

Who decided **is** recorded, in the ledger entry itself (`decidedBy`: the
staff account's id and name). While staff shared one institution token this was
deliberately left out — any name would have been an unverified claim, and
unverified claims in a record whose value is that it can be trusted undermine
it. With individual accounts the name is the authenticated user's, and an
appeal needs to know whose decision it is contesting.

For the same reason only a signed-in person can do this. An API key, whatever
its role, can grade and fetch evidence for an integration; it cannot set an
attempt aside, because an integration is not a person.

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
| HTTP API | implemented — `packages/api`, contract at `docs/openapi.json` |
| Candidate interface | implemented — `packages/web` |
| Exam authoring and review console | implemented — `packages/console` |
| Setting an attempt aside | implemented — `POST /attempts/:id/void`, console decision section |
| Offline verification | implemented — `packages/verify` (CLI) and in-browser via WebCrypto |
| Deployment | implemented — `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` |
| Organisations and isolation | implemented — `org_id` on every tenant table, enforced by row-level security as well as by every query |
| Staff accounts, roles, API keys | implemented — `packages/api/src/staff-auth.ts`; password sign-in (argon2id). OIDC and 2FA not yet |
| Audit log | implemented — append-only `audit_log`, `GET /audit` |
| Model spend metering and cap | implemented — every model call recorded with its cost; per-organisation monthly cap; `GET /usage` |
| Autosave, offline drafts, resume | implemented — `PUT /attempts/me/drafts/:questionId`; drafts committed at close (§3) |
| Question bank, sections, per-candidate papers | implemented — `packages/store/src/question-bank.ts`, `packages/core/src/paper.ts`; CSV import; exam cloning |
| Coding questions and sandboxed execution | implemented — `packages/runner`; `POST /attempts/me/run`; tested on commit, graded by tests |
| Presence and extra time | implemented — `POST /attempts/me/heartbeat`; `POST /attempts/:id/extend`, recorded as `time_extended` |
| Live invigilation | implemented — `GET /exams/:id/live`, announcements, `POST /attempts/:id/reopen` recorded as `attempt_reopened` |
| Hindi, translated questions, low bandwidth, accessibility | implemented — `translations` on a question; the candidate page in English and Hindi; `GET /attempts/me/probe?stream=0`; compression; axe in the browser suite |
| Billing | implemented — prepaid credits spent atomically per attempt; `POST /billing/orders`, `/billing/payments/verify`, the Razorpay webhook; GST tax invoices; `billing-cli` |
| Consent, retention, erasure (DPDP) | implemented — notice agreed before the clock as `consent_given`; personal fields sealed per attempt, erased by destroying the key (`data_erased`); `GET /attempts/me/data` |
| Identity check and camera proctoring | implemented, per exam and off by default — photo + photo ID reviewed by a person (`identity_reviewed` in the ledger), webcam photos, browser events |
| Candidate accounts / enrolment | out of scope (§2) |

Complete end to end and deployable, for more than one institution at once: an
institution's staff sign in with their own accounts and roles, author an exam,
issue access codes and review; a candidate can sit it, answer a probe and leave
with a verifiable receipt. What remains before this is sold is in
[`ROADMAP.md`](ROADMAP.md).

The stack and the reasoning behind it are recorded in [`STACK.md`](STACK.md).
