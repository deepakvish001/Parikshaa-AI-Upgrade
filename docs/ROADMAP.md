# Roadmap to a sellable product

The engine works. What follows is everything between "the engine works" and
"an institution pays for this", in the order it has to be built.

**Target buyer, first:** companies and campus hiring. Universities,
certification bodies and test-prep follow; §7 and §9 are where the paths
diverge, and the rest is common to all of them.

**Decision taken:** build to completion, then sell. The alternative — a design
partner shaping the last 30% — was considered and declined.

## What is honestly not in here

Three things on this list are not software and cannot be finished by writing
code: a penetration test, an ISO 27001 or SOC 2 certification, and a signed
DPA. They need an auditor, money and calendar time. §11 builds what those
audits will ask for; it does not produce the certificates.

One more is an open question rather than a task: whether an India inference
region exists for the model calls (STACK.md §5). It has to be confirmed with
Anthropic before a data-residency promise is made to an Indian institution.

---

## 0. Measure what an attempt costs — before anything else

Everything below depends on a number nobody has: the real per-attempt model
spend. Rough token arithmetic puts the current design near **₹20-25 per
candidate**, which would sit at or above the whole price of a university seat
and eat most of the margin on a hiring seat.

- Log `usage` on every model call — input, output, cache read, cache write.
- Run 50 realistic attempts; record the distribution, not the average.
- Publish a cost-per-attempt figure that pricing is built on.

Then the levers, in the order they pay:

| Lever | Why it works here |
|---|---|
| Batch API for verdicts and rubric grading | Neither is latency-sensitive; both run after submission. |
| Sample which answers get probed | Probing every qualifying answer is both expensive and, per SPEC §4, closer to interrogation than the design wants. |
| Tune effort per route | Probe generation is a short, well-specified task; grading is not. |
| Prompt caching with a cohort-length TTL | Already designed for; verify `cache_read_input_tokens` is non-zero in production. |

**Exit criterion:** a measured cost per attempt, and a per-organisation spend
cap that cannot be exceeded.

**Status — instrumentation built, measurement not yet run.** Every model call
now reports its tokens (input, output, cache read, cache write by TTL), speed
and inference region, priced in integer micro-dollars and stored against its
attempt. `GET /usage` reports spend by route, per-attempt p50/p90/max and
inference region; the console shows it under *Spend*. A per-organisation
monthly cap stops probes quietly and refuses grading with 402 once reached. It
is a soft ceiling — calls already in flight complete — which is the honest
version of "cannot be exceeded" without serialising every call.

What remains is the 50-attempt run itself. It spends real API budget, so it is
run deliberately by the account holder, not by CI; the levers above follow
from what it shows.

## 1. Multi-tenancy and identity

The system today holds **one** staff token for the whole deployment and has no
tenant column anywhere. That is not a missing feature; it means one server per
customer, which is a consulting business rather than a product. This is the
largest single piece of work on the list and everything else depends on it.

- `organisations`, and an `org_id` on every table, enforced by row-level
  security the way the ledger already is.
- Staff accounts: password (argon2id) and OIDC for institutions that have an
  IdP. Sessions, password reset, 2FA for owners.
- Roles: owner, author, invigilator, reviewer, read-only.
- Per-organisation API keys, scoped, revocable.
- **An audit log of who did what.** This is also what finally lets the ledger
  record *who* set an attempt aside — SPEC §9 refuses to write that today
  precisely because a shared token makes any name an unverified claim.
- A migration from the single-token deployment, since one exists.

**Status — built:** organisations with `org_id` on every tenant table and
row-level security behind every query; password accounts (argon2id), 12-hour
sessions, a login throttle; the five roles, with an invigilator unable to see
answer keys or evidence; revocable API keys that can never be owners or set an
attempt aside; an append-only audit log; `decidedBy` on every void. Existing
data migrates into a `default` organisation, and `npm run admin -w
@parikshaa/api` creates an organisation's first owner. Candidate tokens now
carry their organisation; tokens issued before this change stop working, which
at a three-hour lifetime means at most one sitting in progress during the
upgrade.

**Still to do in §1:** OIDC, password reset (needs outbound email), and 2FA for
owners.

## 2. Nothing a candidate does is ever lost

Answers save only when the candidate presses a button. A browser crash, a lost
connection or a closed laptop costs them everything since their last click.
One such incident loses the account.

- Autosave on change, debounced, with an offline draft in the browser.
- Resume: reopening the exam restores every answer and any open probe.
- Server-side heartbeat, so an invigilator can see who is actually live.
- Graceful degradation when the connection drops mid-probe.
- Invigilator time extension for a technical failure or an accommodation —
  appended to the ledger like everything else, with a reason.

**Status — built.** Drafts autosave about a second after typing pauses, to the
server and to the device; while offline they stay on the device and are sent
when the connection returns. Reopening the exam — after a reload, a crash or on
another machine — restores unsent drafts and any open probe. Drafts live
outside the ledger; the server commits them when the attempt is submitted or
runs out of time, keeping only what was saved before the deadline (SPEC §3).
Pages check in every 30 seconds and the console shows who is here. An
invigilator can grant up to four hours at a time, with a reason; it is a
`time_extended` ledger entry naming them, shown on the candidate's receipt.
A failed probe stream no longer leaves a half-written probe on screen.

Two bugs fixed on the way: an answer arriving as the attempt closed could land
behind the submission and make the attempt unreadable, and two simultaneous
submissions could close it twice with the same effect. Both appends are now
re-checked under the attempt's lock.

Not in it, deliberately: an exam that forbids revision still commits an answer
only when the candidate says so, because committing there is final.

## 3. Question banks and authoring at scale

An exam is a one-off JSON document today. Institutions reuse questions across
sections, sittings and years.

- A question bank per organisation, tagged by topic and difficulty.
- An exam as a *selection rule* over the bank: fixed, or N-of-M randomised per
  section, so no two candidates see the same paper.
- Sections with their own timing.
- Import from CSV, Excel and Word.
- Versioning: an exam that has been sat is frozen. It can be cloned, not
  edited — otherwise the ledger records answers to a question that no longer
  exists.

## 4. Coding assessment

This is the campus-hiring wedge, and the place where the micro-viva is at its
strongest: a candidate who pasted a working solution cannot say why they chose
that data structure.

- Editor with language selection and syntax highlighting.
- **Sandboxed execution of untrusted candidate code.** This is the one
  genuinely hard piece of infrastructure on the list. Candidate code is hostile
  by assumption: it will try to read the filesystem, open sockets, fork bombs,
  and mine. Isolation must be at the kernel boundary (gVisor or Firecracker),
  not a language sandbox, with hard CPU, memory, wall-clock, process and
  network limits.
- Visible and hidden test cases, per-test scoring, output diffing.
- Probes generated from the candidate's *own code*.

## 5. Bulk operations and delivery

Nobody clicks "Start" two thousand times.

- Candidate import from CSV and Excel, validated, with a dry run.
- Bulk access-code generation.
- Delivery by email and SMS through Indian providers, with per-candidate exam
  windows and reminders.
- Scheduling: an exam window, and a per-candidate window inside it.

## 6. Results, reports and export

- A results table that filters, sorts and exports to CSV and Excel.
- A per-candidate PDF report, with the provenance evidence in its own section,
  visually separated from the grade the way the console already separates them.
- Cohort analytics: score distribution, per-question difficulty and
  discrimination, time spent.
- A cohort integrity summary — how many answers were probed, and the verdict
  distribution — framed as evidence, never as a list of accusations.

## 7. Integrations

**Hiring first:** outbound webhooks and ATS connectors (Greenhouse, Lever,
Zoho, Darwinbox). `docs/openapi.json` already gives an integrator the contract.

**Universities later:** Moodle via LTI 1.3, and CSV exchange for SIS and ERP
systems that have no API worth using.

## 8. Live invigilation

- A dashboard showing who has started, where they are, who has submitted.
- A flag when a candidate has not interacted for some minutes.
- Announcements to a whole sitting.
- Manual interventions — extend, reset a stuck attempt — each appended to the
  ledger with a reason, because an invigilator's action is exactly the kind of
  thing an appeal asks about.

## 9. Language, accessibility, low bandwidth

- Interface translation, Hindi first, then the regional languages the buyer
  needs. Question *content* also needs per-question translations, which is a
  data-model change, not a string table.
- A low-bandwidth mode: no streaming, smaller payloads, tolerant of 2G.
- Keyboard navigation, screen-reader labels, contrast — an exam a candidate
  cannot operate is an exam they failed for the wrong reason.

## 10. Scale and operations

- Load test at a thousand concurrent candidates. Exam traffic is bursty by
  nature: everyone starts at 10:00.
- Connection pooling, read replicas, per-organisation rate limits.
- Logging and tracing **with redaction**: an answer, a probe and a reply must
  never reach a log. The pseudonymization boundary that protects the model call
  has to hold for observability too.
- Backups, point-in-time recovery, and a restore drill that has actually been
  run.

## 11. Compliance and trust

- DPDP: consent capture, a stated retention policy, erasure that is honest
  about what an append-only ledger can and cannot delete — the right answer is
  crypto-shredding of personal fields, keeping the chain intact.
- Data residency: deploy in an India region; resolve the inference-region
  question above.
- Dependency and secret scanning in CI.
- The evidence pack an enterprise security review asks for.

*Requires people and money, not code:* a penetration test, an ISO 27001 or SOC
2 audit, and legal review of the DPA.

## 12. Billing

- Per-organisation metering of attempts and model spend.
- Plans and invoicing through an Indian payment provider.
- A hard per-organisation cost ceiling, so one customer's traffic cannot run up
  an unbounded model bill.

## 13. Real-browser testing and hardening

- Playwright across both clients, on Chrome, Firefox and Safari, including a
  full attempt end to end.
- Chaos: kill the network mid-probe, kill the server mid-append, and prove the
  ledger still verifies afterwards.

---

## Sequencing

§0 and §1 come first and are not negotiable: the cost number decides pricing,
and multi-tenancy is the foundation everything else sits on. §2 comes next
because it is the cheapest way to avoid losing the first customer.

After that, §3-§6 make the product usable by an institution, §4 is what makes
it competitive for campus hiring specifically, and §7-§13 are what make it
buyable by a company with a procurement process.

This is months of work, not days. The list is honest about that.
