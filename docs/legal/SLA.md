# Service Level Agreement — template

> **Status: a template for the owner and a lawyer.** The targets in square
> brackets are business decisions, not measurements: nothing has measured
> Parikshaa's uptime in production yet. What the service can actually do to
> meet them — the architecture, backups and restore drill — is described from
> [OPERATIONS.md](../OPERATIONS.md) and [SECURITY.md](../SECURITY.md).

This Agreement forms part of the [order form / master agreement] between
[Customer] and [Parikshaa operating entity] and applies to the hosted
Parikshaa service on the [Enterprise] plan.

## 1. Availability

1.1 **Target: [99.9]% Monthly Availability** of the candidate exam service and
the staff console, measured each calendar month in India Standard Time.

1.2 **Monthly Availability** = (minutes in the month − minutes of Downtime) ÷
minutes in the month. **Downtime** is a period of at least [5] consecutive
minutes in which [more than 5]% of requests to the exam service fail with a
server error or do not answer within [30] seconds, as measured by
Parikshaa's external monitoring [owner to choose the monitoring service].

1.3 **Exam windows.** During a sitting the Customer has scheduled in the
console at least [72] hours ahead, Parikshaa will not do planned maintenance,
and treats any Downtime as Severity 1.

1.4 **Not counted as Downtime:** planned maintenance announced [48] hours
ahead and outside scheduled sittings (at most [4] hours a month); the
Customer's own network, devices or identity provider; a candidate's
connection (answers are saved as they are typed and the attempt resumes on
the same link); suspension under the Main Agreement; events beyond reasonable
control.

## 2. What protects a sitting even when something fails

Stated so the Customer knows what it is relying on (from OPERATIONS.md):

- Stateless API instances behind a load balancer, so one failing instance
  does not stop a sitting; a 1,000-candidate load run on one 4-core machine
  finished with every record intact.
- An answer is kept on the server as it is typed; a candidate who loses their
  connection reopens the same link and continues where they were.
- Each attempt is a hash chain, so after any incident it can be shown that no
  answer was changed or lost.
- Managed Postgres with point-in-time recovery for at least 14 days; a
  monthly restore drill that verifies every chain in the restored copy.

**Recovery objectives:** Recovery Point Objective [5 minutes] (point-in-time
recovery); Recovery Time Objective [4 hours] for a full restore. [Owner: set
these from the last restore drill's measured time on production data.]

## 3. Support

| Severity | Meaning | First response | Updates |
|---|---|---|---|
| 1 | A sitting cannot start or continue for many candidates; data at risk | [30 minutes], 24×7 during scheduled sittings | Every [30] minutes until resolved |
| 2 | A major function is broken with no workaround (grading, results, invitations) | [4 business hours] | Daily |
| 3 | A function is impaired with a workaround, or a question | [1 business day] | As agreed |

Business hours: [9:00–18:00 IST, Monday to Saturday, except national
holidays]. Channels: [email, phone for Severity 1, WhatsApp]. [Owner: name
the on-call arrangement; until there is one, do not offer 24×7.]

## 4. Service credits

| Monthly Availability | Credit, as a share of that month's fee |
|---|---|
| Below [99.9]% | [10]% |
| Below [99.0]% | [25]% |
| Below [95.0]% | [50]% |

Credits are claimed in writing within [30] days of the month's end, are the
Customer's sole remedy for missing the target, and are given as attempt
credits or against the next invoice, never as cash, up to [50]% of the
month's fee. A sitting lost to Severity 1 Downtime is re-run without charge.

## 5. Reporting

Parikshaa publishes a monthly availability figure to the Customer and, after
any Severity 1 incident, a written account within [5] working days: what
happened, the effect on candidates, and what changes.

## 6. Data

Data protection is governed by the [Data Processing Agreement](DPA.md).
