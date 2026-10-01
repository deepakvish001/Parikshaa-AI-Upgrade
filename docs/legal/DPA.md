# Data Processing Agreement — template

> **Status: a template for legal review, not a signed agreement.** Every
> statement about what the software does is taken from the code and
> [SECURITY.md](../SECURITY.md), and the places that say so are linked.
> The commercial and legal terms in square brackets — the parties, the
> governing law clause, liability — need a lawyer and the owner's decision
> before this is offered to anyone. Nothing here has been reviewed by one yet.

Between **[Customer legal name]**, [address] ("the Customer", the Data
Fiduciary), and **[Parikshaa operating entity]**, [address] ("Parikshaa", the
Data Processor), together "the Parties". This Agreement forms part of the
[order form / master agreement] dated [date] ("the Main Agreement").

## 1. Definitions

Terms used here have the meaning given in the Digital Personal Data
Protection Act, 2023 ("the DPDP Act") and the rules made under it. "Personal
Data" means personal data that Parikshaa processes for the Customer under the
Main Agreement. "Data Principal" means a candidate, student, learner or staff
member whose Personal Data that is.

## 2. Roles and instructions

2.1 The Customer decides why and how Personal Data is processed; Parikshaa
processes it only on the Customer's documented instructions, which are the
Main Agreement, this Agreement, and the settings the Customer chooses in the
Parikshaa console (for example, turning on camera proctoring, setting a
retention period, or connecting an applicant-tracking system).

2.2 Parikshaa tells the Customer without delay if it believes an instruction
breaks the DPDP Act.

## 3. What is processed (Annex A)

The categories of Data Principals, Personal Data and purposes are in
**Annex A**. Parikshaa does not use Personal Data to train any AI model, sell
it, or use it for any purpose of its own.

## 4. Notice and consent

4.1 The Customer writes the privacy notice its candidates see. Parikshaa shows
it before the exam clock starts and records the candidate's consent, with the
notice's version and hash, in the attempt's tamper-evident record
([ROADMAP §11](../ROADMAP.md); `packages/api/src/privacy.ts`).

4.2 A candidate cannot begin an exam whose organisation requires a notice
without consenting to it.

## 5. Security

Parikshaa keeps the measures in **Annex B** in place for as long as it holds
Personal Data, and may improve them without notice, but not weaken them.

## 6. Personnel

People at Parikshaa who can reach production data are bound by
confidentiality, are as few as the service needs, and lose access when their
role ends. [Owner to confirm the current list and process.]

## 7. Sub-processors

7.1 The Customer authorises the sub-processors in **Annex C**. Parikshaa will
tell the Customer at least [30] days before adding or replacing one, and the
Customer may object on reasonable data-protection grounds; if the Parties
cannot resolve it, the Customer may end the affected service [with a pro-rata
refund of prepaid fees].

7.2 Parikshaa imposes data-protection terms on each sub-processor no less
protective than these, and remains responsible for their performance.

## 8. Data Principals' rights

8.1 The console lets the Customer answer requests itself: a candidate's
download of everything held about them, and erasure, which destroys the
attempt's encryption key in the live database so its answers can no longer be
read there by anyone ([OPERATIONS.md, "The data key and retention"](../OPERATIONS.md)).
Backups taken before the erasure still hold the wrapped key and age out with
the backup retention period (10.2).

8.2 Where a request reaches Parikshaa directly, Parikshaa passes it to the
Customer within [5] working days and does not answer it itself unless the
Customer asks.

## 9. Personal data breach

9.1 Parikshaa notifies the Customer without undue delay, and in any case
within **[24] hours** of becoming aware of a personal data breach affecting
the Customer's Personal Data, with what is known: what happened, what data
and how many Data Principals, the likely consequences, and what is being done.

9.2 Parikshaa helps the Customer meet its own duty to inform the Data
Protection Board of India and affected Data Principals.

## 10. Retention, return and deletion

10.1 During the Main Agreement, Personal Data is kept for the retention
period the Customer sets; an hourly sweep erases attempts older than it.

10.2 When the Main Agreement ends, the Customer may export its results and
records for [30] days; Parikshaa then deletes the Customer's Personal Data
within [60] days, and from backups as they age out of the backup retention
period ([35] days; never less than the 14 days of point-in-time recovery), unless the law requires it to keep some.

## 11. Audit

Parikshaa makes available the information needed to show it meets this
Agreement: [SECURITY.md](../SECURITY.md) (the security evidence pack), the
audit log of staff actions in the Customer's own console, and answers to a
reasonable written questionnaire once a year. An on-site audit is by
agreement, at the Customer's cost, on [30] days' notice. [Independent
certification (ISO 27001 / SOC 2) and a penetration test have **not** been
done yet; see SECURITY.md, "Not done".]

## 12. Where data is processed

The database and its backups are hosted in India ([region, e.g. AWS Mumbai
ap-south-1]). Model calls go to Anthropic (Annex C); whether they can be kept
in an Indian region must be confirmed with Anthropic before the Customer is
promised that. Model calls never carry a candidate's name, roll number or
contact details.

## 13. Liability and term

[Liability as in the Main Agreement / a separate cap — owner and lawyer to
decide.] This Agreement lasts as long as Parikshaa processes Personal Data
for the Customer. Governing law and jurisdiction: [India; courts at ___].

---

## Annex A — Processing

| Data Principals | Personal Data | Purpose | When |
|---|---|---|---|
| Candidates | Name, email, phone, roll number; answers, follow-up questions and replies; scores; consent record | Running, grading and reporting an assessment | Every exam |
| Candidates | Selfie, photo ID, webcam photos; browser events (tab hidden, full screen left, copy, paste); a keyed hash of the network address and a hash of the browser description | Identity check and proctoring, including spotting a proxy | Only when the exam turns proctoring on |
| Candidates (paper exams) | Scanned handwritten answer pages; marks and examiners' comments | Checking and moderating a paper exam | Only when the Customer uploads copies |
| Students | Roll number, name, email, phone, branch, year of passing, CGPA, backlogs, college; placement stage, offer and joining date | Running placement drives | Only when the Customer keeps a student list or runs drives |
| Interview candidates | Name, email, code written in the interview, interviewer's notes and scorecard | Interviews | Only when the Customer uses the interview room |
| Staff | Name, email, role, password hash, two-step secret (sealed), actions in the audit log | Access to the console | Always |

## Annex B — Security measures

From [SECURITY.md](../SECURITY.md), where each is shown in the code:

- **Isolation between customers:** every table carries the organisation, and
  row-level security binds every query; the application's database role does
  not own the tables.
- **Encryption of answers and photos:** AES-256-GCM under a per-attempt key,
  wrapped by a key held outside the database; erasure destroys the key.
- **Tamper evidence:** each attempt is a SHA-256 hash chain, append-only in
  the database, which a candidate can verify offline.
- **Access:** argon2id passwords, two-step sign-in for owners, single sign-on
  with the Customer's identity provider; sessions and API keys stored only as
  hashes; roles limit what each staff member can do; an append-only audit log.
- **Logs** never carry an answer, credential or contact detail (tested).
- **Outbound requests** to addresses the Customer types (webhooks, ATS) refuse
  private networks and do not follow redirects.
- **Backups:** managed Postgres with point-in-time recovery for at least 14
  days, and a monthly restore drill that verifies every chain.
- **Development:** every change runs the full test suite, secret scanning,
  dependency audit and static analysis.

Known gaps, stated so the Customer can weigh them: scanned handwritten pages,
the student list and interview notes are protected by row-level security and
the database's own encryption at rest, but are **not** sealed under per-record
keys as answers and photos are; the automatic retention sweep covers exam
attempts, not yet these. [Owner: decide whether to close these before the
first enterprise signature.]

## Annex C — Sub-processors

| Sub-processor | What for | Data | Where |
|---|---|---|---|
| [Cloud host, e.g. Amazon Web Services] | Hosting, database, backups | All | India [region] |
| Anthropic | Follow-up questions, rubric grading, reading job descriptions, reading handwritten copies, comparing identity photos | Questions, rubrics, answers (no names or contact details); scanned pages and identity photos when those features are used | [To be confirmed] |
| [SMTP provider] | Email to candidates and staff | Name, email, message | [ ] |
| MSG91 (optional) | SMS | Phone, message | India |
| Meta WhatsApp Cloud API (optional) | WhatsApp messages | Phone, message | [ ] |
| Razorpay (optional) | Card and UPI payments | Billing contact; card data goes to Razorpay directly, never to Parikshaa | India |
| Jitsi Meet, meet.jit.si (optional) | Video for an interview when the Customer gives no call link of its own | Whatever the call carries; Parikshaa sends nothing to it but the room name | [8x8; check region] |

Systems the Customer itself connects (its ATS, webhook endpoints, its own
video provider) receive what the Customer configures and are the Customer's
own processors, not Parikshaa's.
