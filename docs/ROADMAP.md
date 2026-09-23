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

**Status — built.** Each organisation has a question
bank, filed by topic, difficulty and tags, searchable, and importable from CSV
(what every spreadsheet exports), all or nothing with every bad row reported by
its number. An exam can carry sections, each a pool of questions of which every
candidate draws `pick`. The draw is seeded by the attempt, so it is
reproducible by an auditor, and the resulting paper is recorded in the
attempt's first ledger entry. Pools must carry equal marks so every paper is
worth the same. Questions are *copied* from the bank into an exam, so editing
the bank never changes an exam; a sat exam is frozen and is changed by cloning
it.

**Per-section timing** is built too. A section can carry its own time; the
test is then taken in parts, in order — the fixed questions, then each section.
Entering a section records `section_started` and starts its clock; leaving it
or running out of time records `section_closed`, and it is locked from then
on. Drafts saved before a section's time ran out are kept, as they are for the
exam's own window. The candidate sees only the current part, its clock to the
second, a warning before leaving a part for good, and a card to start the next
section when they are ready.

**Word import** is built as well. A question paper typed in Word the usual way
— numbered questions (typed, or Word's numbered list), lettered options, then
an `Answer:` line, or the right option marked with `*`, and optional `Marks:`,
`Topic:`, `Difficulty:`, `Tags:`, `Type:` lines — is read straight from the
.docx. Options make a question mcq; otherwise a numeric answer makes it numeric
and anything else short answer. A title, instructions and "Section B" headings
are skipped. The console reads the file first and shows every question found,
naming any picture or equation it left out, before anything is added; like the
CSV import it is all or nothing, with each problem named by its question.
`docs/samples/question-paper.docx` is a paper to copy.

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

**Status — built.** Candidates write in Python, JavaScript, C, C++ or Java, in
an editor with highlighting and no completion of any kind, loaded only for
exams that have a code question. They run their code against the visible
examples or on input of their own; runs record nothing. A committed answer is
tested against every test, hidden ones included, and the counts — never the
tests — go into the ledger as `code_tested`. That result is what lets a strong
solution be followed up while the candidate still remembers writing it, and the
probe is generated from their source. Grading uses it, or runs the tests then
if the runner was down when the answer was committed; an answer is never
refused because code cannot be run.

The runner is its own service and image (`packages/runner`,
`Dockerfile.runner`), on a network with no route out, under gVisor. Each run is
also wrapped in fresh network, IPC, UTS and PID namespaces, dropped to a
per-slot unprivileged uid, and held to CPU, memory, process, file-size, output
and wall-clock limits, in a clean environment and a private directory. The
suite attacks it for real — infinite loops, fork bombs, memory exhaustion,
output floods, network access, reading the runner's files — and CI runs those
cases as root so they execute there too.

Two limits worth knowing. Memory is a hard address-space cap for C, C++ and
Python, but Node and the JVM cannot start under one, so for those two it is
their own heap flag, with the container's cgroup limit as the backstop. And
gVisor is a deployment requirement this code checks but cannot supply: the
runner refuses to start unless it finds itself inside gVisor, or is told
explicitly that isolation is off for development.

## 5. Bulk operations and delivery

Nobody clicks "Start" two thousand times.

- Candidate import from CSV and Excel, validated, with a dry run.
- Bulk access-code generation.
- Delivery by email and SMS through Indian providers, with per-candidate exam
  windows and reminders.
- Scheduling: an exam window, and a per-candidate window inside it.

**Status — built.** An exam gets a window, hard-closing by default, so a
candidate who starts late ends with everyone else; the close is written into
the attempt's first ledger entry, so the deadline is on the record. A cohort
comes in from CSV — roll numbers, names, emails, Indian mobiles in any usual
form, optional per-candidate windows read as IST — checked by a dry run that
changes nothing, then imported all or nothing. Each candidate gets a personal
link, by email (SMTP, so any provider) and SMS (MSG91's DLT template flow), and
a reminder an hour before the window opens; reminders to candidates who have
already started are skipped. The link does not start anything: the attempt,
and its clock, start when the candidate opens it inside their window, and the
same link resumes from any device until the window closes.

Links are signed, not stored: the database holds no code, plain or hashed.
Delivery runs through a transactional outbox, claimed with `SKIP LOCKED` so
every API instance can run a worker without sending anything twice, with
retries and backoff for failures that might pass and a recorded reason for
those that will not. The outbox holds ids, never personal data. Links can also
be exported, as an audited CSV, for an institution that hands them out itself.

Not verified here: the MSG91 request shape follows their published v5 flow API,
whose documentation could not be reached from this environment. Send a test
message from your own MSG91 account before the first sitting.

## 6. Results, reports and export

- A results table that filters, sorts and exports to CSV and Excel.
- A per-candidate PDF report, with the provenance evidence in its own section,
  visually separated from the grade the way the console already separates them.
- Cohort analytics: score distribution, per-question difficulty and
  discrimination, time spent.
- A cohort integrity summary — how many answers were probed, and the verdict
  distribution — framed as evidence, never as a list of accusations.

**Status — built.** Every figure is computed from the ledgers by pure functions
in the core (`resultOf`, `cohortAnalytics`), so a number in a spreadsheet can be
recomputed from the chain the way a grade can. The console's results page lists
each candidate under their own roll number, sorts by marks, time, roll number or
name, filters by state or a search, and downloads the table as CSV or as an
Excel workbook. Times are in IST; roll numbers and phone numbers stay text (the
workbook types each cell explicitly, so `007` is not turned into `7`); and a
cell a spreadsheet would run as a formula is defused. Exporting needs
`attempt:review` and is audited, since the file leaves the system.

Cohort analytics: mean, median, a histogram by tenth of the range, median and
90th-percentile time, and for each question how often it was set (with pools,
not every paper has every question), its facility, and its discrimination —
the top 27% of candidates against the bottom 27% — with a plain-words note on a
question that does not separate strong from weak. The follow-up summary counts
what was asked, answered and read, and how the readings fell, attached to no
one; there is no way to sort candidates by it.

The per-candidate report shows the grade, each answer as the candidate gave it
(the option text for a multiple-choice question, the source for code), then —
in its own marked section — the follow-ups, then the ledger's head and length
so the paper copy can be checked against the record. It is laid out for print:
the PDF comes from the browser's "Save as PDF" rather than from a server-side
renderer, which would have meant shipping a headless browser.

## 7. Integrations

**Hiring first:** outbound webhooks and ATS connectors (Greenhouse, Lever,
Zoho, Darwinbox). `docs/openapi.json` already gives an integrator the contract.

**Universities later:** Moodle via LTI 1.3, and CSV exchange for SIS and ERP
systems that have no API worth using.

**Status — webhooks and Greenhouse built; Lever, Zoho Recruit and Darwinbox not
yet.** Every start, submission, grade and voiding is announced by the ledger in
the same transaction that records it, so an integration hears of everything
that happened and nothing that did not. The worker fans each announcement out,
one delivery per interested webhook under a fixed id — a fan-out repeated after
a crash sends nothing twice — and delivers it signed as Standard Webhooks
specifies (`webhook-id`, `webhook-timestamp`, `webhook-signature`), so a
receiver verifies it with an off-the-shelf library. A receiver that is down is
retried with backoff; each webhook's log shows every try. Owners register,
test, rotate and stop webhooks from the console.

Every outbound request — webhooks, and Greenhouse's completion call — goes
through one guard against server-side request forgery: HTTPS only, no
credentials in the URL, every address the name resolves to must be public (the
check runs in the socket's own DNS lookup, so DNS rebinding cannot slip a
private address past it; IPv6 forms that embed an IPv4 address are judged by
it), no redirects followed, and the reply read to 64 KiB at most.

Greenhouse: the four endpoints of its Assessment Partner API — `list_tests`
(the organisation's exams), `send_test` (an invitation, emailed from here;
repeated for the same application, the same invitation), `test_status`
(`complete` once graded or set aside, with the score, marks and a link to the
report) and `response_error` (kept in the audit log, without the candidate's
email) — and the `PATCH` Greenhouse now requires in place of polling, sent when
the attempt is graded, only to a Greenhouse address. Greenhouse acts with an
author's rights: it never sees an answer key, an answer or a follow-up.

Neither webhook secrets nor the Greenhouse key are stored: each is derived from
the server's secret and a version number, which is what rotation moves on. A
copy of the database signs nothing and authenticates as no one.

Not verified here: the connector follows Greenhouse's published partner
documentation, and has not been run against a Greenhouse sandbox, which
Greenhouse's partnerships team provides once the endpoints are registered with
them. Lever, Zoho Recruit and Darwinbox have no connector yet; until they do,
their customers can use webhooks and the API.

## 8. Live invigilation

- A dashboard showing who has started, where they are, who has submitted.
- A flag when a candidate has not interacted for some minutes.
- Announcements to a whole sitting.
- Manual interventions — extend, reset a stuck attempt — each appended to the
  ledger with a reason, because an invigilator's action is exactly the kind of
  thing an appeal asks about.

**Status — built.** The console's *Live sitting* page, refreshed every five
seconds, shows who has not started, who is taking it, how far each candidate
has got, when their page last checked in, and how long they have left — and
never an answer. Two flags are kept apart because they mean different things:
*away* (the page has stopped checking in: closed, or offline) and *idle* (the
page is open but nothing has been typed for a threshold the invigilator sets).
An invigilator can tell the whole room something at once; it reaches every
candidate's open page at their next check-in, is read out by screen readers,
and is audited. A submitted attempt can be **reopened** — a crash, a power cut,
submit pressed by mistake — with minutes and a reason, as an
`attempt_reopened` entry in the ledger with the person's name, shown on the
candidate's receipt; never once graded or set aside. The candidate's page
opens again by itself. Extending time (§2) sits beside it.

## 9. Language, accessibility, low bandwidth

- Interface translation, Hindi first, then the regional languages the buyer
  needs. Question *content* also needs per-question translations, which is a
  data-model change, not a string table.
- A low-bandwidth mode: no streaming, smaller payloads, tolerant of 2G.
- Keyboard navigation, screen-reader labels, contrast — an exam a candidate
  cannot operate is an exam they failed for the wrong reason.

**Status — built.** The candidate's page is in English and Hindi, chosen from
a picker on every screen and remembered on the device; the page's `lang`
follows, so a screen reader pronounces it. The privacy notice's standing text
is in Hindi too, and hashed with the rest. A question can carry translations
into Hindi and nine more scheduled languages (Bengali, Tamil, Telugu, Marathi,
Gujarati, Kannada, Malayalam, Punjabi, Odia), written in the console's editor;
an mcq's translated options must come in the original's order, because the
answer is recorded by position and so means the same in every language. A
candidate reading a translation can switch any question back to the
original. Grading always reads the original; the follow-up is asked, and the
assessor reasons, in the language the candidate answered in — Hindi, English
or the mix of the two many candidates write.

Low-bandwidth mode — on by itself where the browser reports Data Saver or a
2G connection, and a switch for everyone else — fetches a follow-up in one
short request instead of holding a stream open, answers code in a plain text
area without ever downloading the editor, and saves and checks in half as
often (nothing typed is at more risk: it is kept on the device as it is
typed). Every response over 1 KB, the client bundles included, is compressed
with Brotli or gzip.

Every screen a candidate meets — the exam, a follow-up, the receipt, the
privacy notice, in English and in Hindi — and the console's busiest pages are
checked against WCAG 2.1 AA by axe in the browser suite, and one test sits the
whole exam from the keyboard alone. Focus is always visible.

Not in it: the interface in languages other than English and Hindi (the
string table is one file to add to), and translated exam titles.

## 10. Scale and operations

- Load test at a thousand concurrent candidates. Exam traffic is bursty by
  nature: everyone starts at 10:00.
- Connection pooling, read replicas, per-organisation rate limits.
- Logging and tracing **with redaction**: an answer, a probe and a reply must
  never reach a log. The pseudonymization boundary that protects the model call
  has to hold for observability too.
- Backups, point-in-time recovery, and a restore drill that has actually been
  run.

**Status — built, except read replicas, which the load test showed are not
needed at this scale.** A load run of 1,000 candidates on one 4-core machine
(load generator, API and Postgres together) sat a drive with no errors and
every chain intact afterwards; see `docs/OPERATIONS.md` for the figures and
what they mean for sizing. Request logs are one JSON line per request, by
route pattern, and a test runs a whole sitting and fails if an answer, a
follow-up, a reply, a credential or a contact detail reaches them. Per-
organisation and per-attempt rate limits answer 429 with `Retry-After`. The
pool size is configurable. `verify-all` checks every chain in a database, and
`scripts/restore-drill.sh` restores a dump into a scratch database and runs it
— the drill ran here and runs in CI. Backups and point-in-time recovery are
the database's job: the runbook names the managed services in Indian regions
and what to turn on.

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

**Status — DPDP built; the rest is not.** An owner sets the organisation's
privacy notice — who is responsible, why the data is collected, the grievance
officer, and a retention period — on the console's *Privacy* page. From then
on a candidate opening their link reads the notice and agrees to it **before
their clock starts**; the agreement goes into the ledger as `consent_given`
with the notice's version and SHA-256, so what they agreed to stays provable
after the wording changes. Changing the wording issues a new version.

Erasure is crypto-shredding. Each attempt gets its own data key, wrapped by a
key held outside the database (`PARIKSHAA_DATA_KEY`); what a candidate wrote,
their replies to follow-ups, the follow-up questions about their answers and
their reference are stored — in the ledger and in its queryable copy — only
as AES-256-GCM ciphertext under it, bound to the attempt and field. The chain
hashes the ciphertext. Erasing destroys the key: the chain still verifies,
the scores stay, and nobody, including whoever holds a later backup, can read
what was sealed. It also clears the invitation's name, email, phone and
reference, deletes unsent drafts, stops queued messages, and records
`data_erased` in the chain. An owner erases on request (typing the reference
back to confirm); an hourly sweep erases closed attempts once the retention
period has run out. The audit log, which cannot be erased, no longer records
candidates' references. A candidate can download everything held about them —
details, the notice they agreed to, their answers and replies, the timeline,
no scores — from their receipt.

What is deliberately not in it: a candidate cannot erase their own data from
the page (they ask the grievance officer, as the notice says), and the
receipt carries the sealed record, so it verifies but does not show their
answers — "Download my data" does. Answers are sealed from here on. A ledger
written before this change holds its answers in the clear and cannot be
shredded: erasing it clears everything around it — invitation, drafts,
queued messages — and records `data_erased`, but its entries stay readable.
Data residency, CI secret scanning and the evidence pack are still to do.

## 12. Billing

- Per-organisation metering of attempts and model spend.
- Plans and invoicing through an Indian payment provider.
- A hard per-organisation cost ceiling, so one customer's traffic cannot run up
  an unbounded model bill.

**Status — built.** An organisation is either on **prepaid credits** or
**invoiced monthly**, at a price per attempt — the operator's decision, set
with `npm run billing -w @parikshaa/api -- plan <org> prepaid|invoiced
<rupees>` (which also grants trial credits and issues monthly invoices); an
organisation with no plan is not metered. A prepaid attempt starts only
against a credit, taken under the account's row lock in the same transaction
that records why: concurrent starts cannot spend the last credit twice, and an
attempt spends one however often its start is retried or its link reopened. A
candidate whose organisation has run out is told the test cannot start yet —
not why — and loses no time.

The owner buys credits on the console's *Billing* page through Razorpay
Checkout. Nothing is credited on the browser's word: the server checks
Razorpay's signature (HMAC-SHA256 of `order_id|payment_id`), and Razorpay's
webhook (`X-Razorpay-Signature` over the raw body) credits a payment whose tab
was closed before Checkout returned. Either may arrive first; the second
changes nothing. Each payment issues a **GST tax invoice** in the same
transaction: supplier and buyer with GSTINs (checked, check digit included),
place of supply, SAC, taxable value, CGST+SGST within the supplier's state or
IGST outside it, the total in figures and in Indian-system words — numbered in
one consecutive series per financial year (`PKS/2627/000123`, within GST's 16
characters), with no gaps because the serial is taken in the transaction that
stores the invoice. Invoiced organisations get a monthly invoice for the
attempts their ledgers record as started in that IST month. Invoices are
printable from the console.

The model-spend ceiling of §0 still applies on top, per organisation.

Not in it: e-invoicing (IRN from the GST portal, needed above ₹5 crore
turnover), credit notes and refunds of payments, TDS, and automatic monthly
invoicing (the operator runs `invoice-all` — a cron line).

## 13. Real-browser testing and hardening

- Playwright across both clients, on Chrome, Firefox and Safari, including a
  full attempt end to end.
- Chaos: kill the network mid-probe, kill the server mid-append, and prove the
  ledger still verifies afterwards.

**Status — built.** `packages/e2e` runs the real service against a real
Postgres. Playwright drives a whole sitting — a follow-up answered, the
downloaded receipt checked by the standalone verifier — and answers typed
offline, a follow-up whose connection drops mid-stream, resuming on another
device, and a recruiter's results, spreadsheet and report; CI runs it in
Chrome, Firefox and WebKit (only Chromium was available where this was
written). The chaos run SIGKILLs the server mid-write and, separately,
terminates every database connection under a running server; after each,
every chain verifies and every candidate reopens their link and carries on.

Running against a real Postgres for the first time found three faults the
in-process test database could not: every jsonb value stored as a string by
the previous driver (nothing worked end to end), that driver crashing the
process when connections dropped, and a failure mid-start locking a candidate
out. All three are fixed and tested; `docs/OPERATIONS.md` has the detail.

---

## 14. Identity check and camera proctoring

Some buyers — campus drives with thousands of unseen candidates, companies
whose policy demands it — will not buy an assessment that cannot say who sat
it. Parikshaa's answer to "did they write it?" stays the micro-viva; this
section adds "is it them?", for an exam whose author asks.

**Status — built, off by default.** An exam's author can turn on, separately:
an **identity check** (a photo of the candidate and of their photo ID before
the first question), **webcam photos** at an interval (15 s to 15 min), and
**browser events** (leaving the tab or full screen, copy and paste, the
camera stopping). The candidate is told exactly which, in English or Hindi,
before their clock starts, and the attempt starts only once their camera
works. The ledger commits to both identity photos' SHA-256
(`identity_captured`); an invigilator compares them on the live sitting and
records a decision with a reason (`identity_reviewed`, with their name) —
correctable, and only before grading. Webcam photos and browser events are
kept outside the chain (there are too many to chain one by one). The live
sitting flags a camera that has gone quiet and identities still to check;
the report carries the decision and the counts.

What it deliberately is not: automatic. No face matching, no gaze tracking,
no "suspicion score" — a photo or a switched tab is a reason for a person to
look, never a finding, and none of it reaches a probe, a verdict or a grade.
Every photo is personal data: sealed under the attempt's data key (§11),
opened only for staff, never cached, and destroyed with the key on erasure
or at the end of the retention period. The privacy notice says so.

Not in it: a lockdown browser, screen recording, audio, and a second-device
camera. Webcam photos are stored in Postgres; at very large volumes an object
store would be the better home.

## Sequencing

§0 and §1 come first and are not negotiable: the cost number decides pricing,
and multi-tenancy is the foundation everything else sits on. §2 comes next
because it is the cheapest way to avoid losing the first customer.

After that, §3-§6 make the product usable by an institution, §4 is what makes
it competitive for campus hiring specifically, and §7-§13 are what make it
buyable by a company with a procurement process.

This is months of work, not days. The list is honest about that.
