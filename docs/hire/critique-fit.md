# Hire v2 — fit critique (does the design match the code?)

Workflow W3 (`docs/hire/workflows/w3-fit-critique.js`), prompt `docs/hire/critique-fit-prompt.md`. Run 12 Oct 2026 on
the Hire v2 branch with `main` (F1 go-live G0–G4a, PR #47) merged in, so the code read is current: the last migration
is `0069_code_timeline.sql`.

Every point below was checked in the code, with file:line evidence. Code maps in `docs/hire/code-map/` were used only
to find things; where they disagree with the code, the code wins. Each issue says what the design says, what the code
does, and the exact change to the design, with the slice it belongs to.

Severity: **blocker** (the slice cannot be built as written), **important** (it can be built, but it would be wrong,
slow or leak), **minor** (a detail a builder needs; easy).

## Issues

### F1 — The operator scope in S10/S11 does not fit the G1 operator (blocker, H7)

- **Design.** §8 and §10 S11: an own `actor='operator'` scope whose policies allow only organisations, jobs, job reports
  and SECURITY DEFINER count functions; `operatorAuth`; `totp_last_step`; sign-in throttle; `OPERATOR_ALLOW_CIDRS`;
  token in sessionStorage; an append-only `operator_audit` table that also records reads. §8: console
  `/console/?operator` → operator sign-in. S10: `hire_job_reports` has no staff policy (operator only).
- **Code (G1).** An operator is an ordinary staff actor whose address is in `PARIKSHAA_OPERATORS` and who has a TOTP
  secret (`api/src/operator.ts:20-34`, `check` at `:103-108`). Routes use the `staffAuth` scheme and answer 404 to
  anyone else (`operator-routes.ts:26`, `:55-67`). Reads go through each organisation's **staff scope**:
  `ReportStore.organisations` runs `withScope(staffScope(id))` per org (`store/src/report-store.ts:54-71`), grants run
  under `staffScope(org.id)` (`operator.ts:154`, `:193`). Audit goes to `audit_log` twice, in the touched org and the
  operator's own (`operator.ts:214-219`); `audit_log` is already append-only. Staff TOTP already has replay protection
  (`totp_last_step`, `migrations/0014_staff_security.sql:15`, `identity-store.ts:438-439`) and staff sign-in is already
  throttled. The console keeps the staff token in sessionStorage (`console/src/App.tsx:134-142`), and the operator's
  page is the view `companies` inside the normal console (`App.tsx:64`, `:552`, `:992`), not a separate sign-in.
- **Why it blocks.** "H7 extends G1" (§8) and "own operator scope" (S11) cannot both hold: an operator scope means
  rewriting every G1 read and the G1 tests. S10's "no staff policy" table cannot be read at all by G1's staff-scoped
  operator.
- **Change (H7).**
  1. Drop the operator scope, `operatorAuth`, the `operator_audit` table and the `?operator` sign-in from §8/S11. Keep
     G1's model: staff actor + `Operators.is` + second factor, `staffAuth`, audit in `audit_log` (org + operator's own).
  2. S11 keeps only what G1 lacks: `OPERATOR_ALLOW_CIDRS` checked in `OperatorService.check` (one more refusal, still
     404); an audit entry for each candidate lookup (`operator.candidate_viewed`, ids and counts only), since that is
     the one read of personal data.
  3. Hire figures in the companies list (open jobs, applications in 30 days) are counts added to the per-org query in
     `ReportStore.#organisation` (same staff scope as G1). No applicant rows reach the operator's pages.
  4. `hire_job_reports` is the one exception, built like `library_questions` (`migrations/0068_library.sql:9-35`): no
     `tenant_isolation`, one policy for `parikshaa.actor = 'operator'`, read through a small `operatorScope()` used
     only by the H7 report store. The public "Report this job" inserts through a SECURITY DEFINER function
     `hire_file_job_report(...)` (with `SET search_path = ''`, see F29). The company sees only the outcome, kept on
     `hire_jobs` (`taken_down_at`, `taken_down_reason`).
  5. Operator console: add "Reports" and "Candidates" sections to `OperatorPanel` (`components/Operator.tsx`), lazy (see
     F30).
