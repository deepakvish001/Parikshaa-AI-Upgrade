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
- Migration numbering (0070+: `main` took 0066–0069 for G0–G4).
- The model_usage route constraint.

Also judge the build order H1 → H2 → H3 → H4 → H5 → H7 → H8 → H9 → H6 → H10. Can each slice be built and tested on
its own in that order? Propose splits if a slice is too big for one session.

Overlap with the F1 go-live work on `main` (PR #47, merged 12 Oct; plan in `docs/F1-GO-LIVE-PLAN.md`, tracker rows
100–109). For each, say what Hire reuses, what it must not build again, and what changes in HIRE-V2.md:
- G1 operator panel (`api/src/operator.ts`, `operator-routes.ts`, console `components/Operator.tsx`, migration 0067):
  staff in `PARIKSHAA_OPERATORS` with 2FA, Company ID, suspend/resume, credits, audit. H7 must extend it (§8 now says
  so); check §10 S11/S12/S10/P18 against how G1 scopes an operator (`staffScope` per organisation?) and suspension.
- G2 Library (`api/src/library.ts`, `library-routes.ts`, `library-content.ts`, migration 0068) and the reference run
  (`ExamService.checkReference`, `POST /questions/code/check`): H6 drafts and job-test drafting.
- G4 coding (submissions history, code playback with `LARGE_PASTE`, `core/src/timeline.ts`, migration 0069): can H5
  use a large paste as an integrity reason?
- G5–G8 (not built yet: strict proctoring with face check, live video, phone camera, Safe Exam Browser): H5's
  reasons (P7 auto face check) and H4's test round settings should leave room for them rather than build a second one.
