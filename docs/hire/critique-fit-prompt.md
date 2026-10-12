# Prompt for the "fit" critique (did not finish on 12 Oct; run it again)

Read `docs/HIRE-V2.md` (with §10) and the code maps in `docs/hire/code-map/`. Then check the design against the real
code, so builders do not get stuck. Every issue must say what to change in the design, with file:line evidence.
Write the result to `docs/hire/critique-fit.md` and add the needed changes to HIRE-V2.md §10.

Verify each integration point and report mismatches with the fix:
- InvitationService.inviteMany: window, permission, UNIQUE per exam+ref, re-sending to the same candidate across jobs
  that reuse one exam.
- ResultsService.results rows: which fields exist (percent, sections, outcome, attempt id, probes?).
- ProxyService.report / ProctorStore.summary / ResultsService.similarity: can they be called per exam and joined by
  candidate ref?
- AiInterviewService.create and InterviewService.schedule: signatures and permissions.
- InviteCodes.issue: usable for portal links?
- The outbox: does it need org_id? Can a global candidate email go through it?
- The mailer interface for direct sends.
- withScope with a new scope kind: how sql.ts sets settings, and whether a missing setting breaks existing policies.
- The openapi audience test and security schemes.
- testing/harness.ts wiring.
- bundle-budget.json rules.
- web main.tsx path routing, server.ts serving of /jobs, /careers and /my, and CSP.
- console App.tsx view wiring.
- The docx helpers for resume text.
- Migration numbering (0066+).
- The model_usage route constraint.

Also judge the build order H1 → H2 → H3 → H4 → H5 → H7 → H8 → H9 → H6 → H10. Can each slice be built and tested on
its own in that order? Propose splits if a slice is too big for one session.
