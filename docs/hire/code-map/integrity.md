## Exists today

**Tables**
- `proctor_media` (migration `0011_proctoring.sql:7`): `org_id, attempt_id, id, kind ∈ {selfie,id,snapshot}, taken_at, sha256, sealed bytea`. Photos are AES-GCM sealed under the attempt's data key, with AAD `attemptId/media/id`.
- `proctor_events` (`0011:23`, kinds widened in `0059_proctoring_v2.sql`): `kind ∈ {tab_hidden, fullscreen_exit, copy, paste, camera_off, camera_on, screen_share_off, screen_share_on, second_screen, voice}, at` (server time), `seq`.
- RLS on both tables: a restrictive tenant policy, staff can do everything, and a candidate can INSERT only for their own `attempt_id` and can read nothing back (`0011:36-56`).
- `attempt_origins` (`0040_proxy_checks.sql:15`): `attempt_id, exam_id, candidate_ref, network` (HMAC of IP, 16 hex), `device` (sha256 of UA), `first_at, last_at`. Staff-only RLS.
- `identity_checks` (`0040:27`): `attempt_id, exam_id, result jsonb, flagged bool, checked_by, checked_at`. This is the model's photo comparison.
- `shortlists` / `shortlist_decisions` (`0032_shortlists.sql`): `refs text[]`, `decision ∈ {shortlist,hold,reject}`, comment, decided_by.
- Ledger events (`core/src/domain.ts`): `identity_captured` (selfie/id sha256, :532), `identity_reviewed` (verified/rejected + reason + decidedBy, :539), `viva_probed/replied/assessed` (:422-424), `ai_assisted`, `attempt_voided` (:452), `score_revised` (:444), `data_erased` (:565). Sealed personal fields are listed in `store/src/sealing.ts:28-35`.

**Store**
- `ProctorStore` (`store/src/proctor-store.ts`): `addMedia` :80, `countMedia` :94, `media` :105, `open` :118 (unseal), `addEvent` :134, `events` :146, `summary(examId)` :157 (per-attempt snapshot count and event counts, used by the live view).
- `ProxyStore` (`store/src/proxy-store.ts`): `recordOrigin` :33 (upsert), `origins` :43, `reusedPhotos` :55 (same selfie/id sha256 across attempts, **org-wide**), `saveCheck` :67, `checks` :77.
- `LedgerStore` (`ledger-store.ts`): `append(…, {guard})` :431, `load`/`loadBoth`/`loadExamLedgers` :617/643/660, `touch` (heartbeat) :370, `appendAudit` :752. Erasure deletes all four integrity tables at :571-574.

**API routes**

| Route | Auth | Where |
|---|---|---|
| `POST /attempts/me/identity` | candidate token | `proctoring-routes.ts:44` |
| `POST /attempts/me/snapshots` | candidate token; capped at 2×interval+10 | `proctoring.ts:156` |
| `POST /attempts/me/proctor-events` | candidate token; ≤50 per call, **no total cap** | |
| `GET /attempts/:id/proctoring` | staff `attempt:read` | `proctoring-routes.ts:105` |
| `GET /attempts/:id/proctoring/photos/:mediaId` | staff `attempt:read`; hash re-checked | |
| `POST /attempts/:id/identity/review` | staff `attempt:extend`, human user only (`staff-auth.ts:119`) | |
| `GET /exams/:examId/proxy-report` | staff `attempt:read` | `proxy-routes.ts:34` |
| `POST /attempts/:id/identity/compare` | staff; model call, spend-capped (402) | `proxy-routes.ts:63` |
| `POST /exams/:examId/identity/compare` | staff; bulk, limit ≤200 | `proxy-routes.ts:82` |
| `GET /exams/:examId/results` | staff `attempt:review` | `results-routes.ts:212` |
| `GET /exams/:examId/similarity` | staff `attempt:review` | `results-routes.ts:231` |
| `GET results.csv` / `GET results.xlsx` | staff | |
| `POST …/results/email`, `POST …/results/release` | staff | |
| `GET /attempts/:id/report` | staff | `results-routes.ts:336` |
| `GET /attempts/:id/report.pdf`, `POST /attempts/:id/report-link` | staff | `candidate-report-routes.ts:79/98` |
| `GET /reports/:code`, `GET /reports/:code/report.pdf` | public HMAC link, throttled | `candidate-report-routes.ts` |
| Viva: `GET /attempts/me/probe` (SSE) | candidate | `server.ts:1175` |
| Viva: `POST /attempts/:id/assess/:probeId` | staff `attempt:assess` | `server.ts:882` |
| `POST /attempts/:id/void` | staff | `server.ts:902` |
| `GET /attempts/:id/review` (vivas + assists) | staff | `server.ts:947` |
| `GET /exams/:examId/live` (away/idle/overdue/cameraOff flags) | staff | `invigilation.ts:44-49,157-180` |
| `GET/POST /exams/:examId/marking` | `attempt:grade` | `marking.ts` |
| Shortlist links: `/exams/:examId/shortlists`, `/shortlists/view/:code(/decisions)` | staff, or public HMAC link | `shortlist-routes.ts` |

**Services and data flow**
- **Capture.** The candidate starts. `InvitationService` (`invitation-service.ts:424`) calls `ProxyService.recordOrigin` (wired in `assemble.ts:196`), which hashes the IP and UA.
- **Web capture.** On the web side, `CameraCheck` (in `InviteGate.tsx:152,175`) checks devices and takes the identity photos. Then `useProctoring` (`web/src/proctoring.ts`, mounted at `App.tsx:327`) runs:
  - webcam snapshots at the configured interval (a third as often in lite mode);
  - DOM listeners for visibility, fullscreen, copy and paste;
  - `screen.ts` for screen-share end and `extendedDisplay`, which is the second-screen signal;
  - `voice.ts` loudness detector (level 0.06, sustained 2.5 s, 60 s cooldown).
  
  Events are batched every 5 s.
- **Policy.** `ProctoringPolicy` (`domain.ts:286`: `identity`, `snapshotEverySeconds`, `browserEvents`, `screenShare?`, `audio?`) is authored in `ExamEditor.tsx:644-693`.
- **Micro-viva.** `service.raiseProbe` (`service.ts:1162`) uses `selectProbeTargets` (`core/scoring.ts:128`, trigger is `policy.vivaTriggerRatio`) and `@parikshaa/viva` `generateProbe`. Reply latency is measured by the server (`service.ts:1218`). `assessReply` writes a verdict (consistent / shallow / inconsistent / inconclusive) with a confidence. The verdict never touches grading (`service.ts:1494`).
- **Code similarity.** `core/src/similarity.ts` runs MOSS-style winnowing (K=5, W=4, MIN_FINGERPRINTS=8, REPORT_AT=0.7, starter code removed). `ResultsService.similarity` (`results.ts:366`) computes it on demand within one exam, per code question. Nothing is persisted.
- **Proxy.** `ProxyService.report` (`proxy.ts:82`) produces shared origins (suppressed for lab exams), reused photos and model checks. `check` (`proxy.ts:131`) sends the selfie, the ID and 6 spread snapshots to Claude with a zod schema. Flags are "ID ≠ selfie", "someone else in photo n" and "another person in photo n". It is audited as `attempt.identity_compared`.

**Every integrity signal per attempt, and where it is stored**

| Signal | Stored in |
|---|---|
| 1. Identity photos captured (hashes) | ledger `identity_captured` + `proctor_media` |
| 2. Human identity decision | ledger `identity_reviewed` |
| 3. Webcam snapshots | `proctor_media` |
| 4. Browser / screen / voice events (10 kinds) | `proctor_events` |
| 5. Network + device origin | `attempt_origins` |
| 6. Reused identity photo across attempts | derived from `proctor_media` sha256 |
| 7. Model face comparison (`flagged`, `flags[]`, summary) | `identity_checks` |
| 8. Code similarity pairs | computed, not stored |
| 9. Viva probes/replies/latency/verdict/confidence | ledger |
| 10. AI-assistant use per question | ledger `ai_assisted` |
| 11. Answer timing: first/last saved ms, save count, duration | derived from ledger (`results.ts:440-470`) |
| 12. Live heartbeat flags: away/idle/overdue/cameraOff | computed live from `touch` + snapshots, not persisted as events |
| 13. Lab network allowlist | a gate, not a signal (`lab.ts:49`) |
| 14. Void with reason | ledger `attempt_voided` |

The AI interview has its own separate `concerns[]` (`ai-interview.ts:75,412`).

**Aggregates.** There is **no composite trust or integrity score anywhere**: a grep for trust, risk or suspicion found nothing relevant. Closest things:
- cohort-level `analytics.integrity`, which covers viva counts and verdicts only (`core/analytics.ts:181`);
- `CandidateReport.proctoring`, which has the identity state plus snapshot and event counts (`results.ts:514-527`);
- `SharedReport.integrity` (`candidate-report.ts:79-83`, rendered in the PDF at :317);
- the per-attempt `identity_checks.flagged` boolean;
- per-row `probes` counts in `AttemptResult` (`core/analytics.ts:32`).

**Console**
- **`Results.tsx`:**
  - `ResultsPanel` :64, which contains the CandidateTable, the cohort viva `Integrity` card :473, `ProxyCheck` :170, `Shortlists` :180 and `CodeSimilarity` :184/:830;
  - the scorecard :615, whose proctoring block :709 shows counts only.
- **`ProxyCheck.tsx`** lists reused photos, shared origins and flagged checks. Its "Open" button goes to the scorecard, not the photos.
- **`Proctoring.tsx`** `ProctoringReview` shows the photos, the event timeline and the verify/reject decision. It is **only mounted from `Live.tsx:285`**.
- **`AttemptReview.tsx`** (App.tsx:905) shows viva exchanges with "Read this exchange" (assess) :219-255 and "Set aside" (void) :271. It has no proctoring panel.

**How Results filters, sorts and shortlists** (`Results.tsx:305-413`)
- **Search:** text match on ref, name or email.
- **Filter:** one select for state (in_progress / submitted / graded / void) or outcome (qualified / failed).
- **Sort:** ref, name, percent or minutes.
- **By design it cannot sort or filter by integrity.** The comment at :22-23 says: "sorted by what they scored, never by what the follow-ups made of them".
- **Shortlist creation** (`shortlists.ts:93`) takes typed roll numbers, or defaults to every graded candidate with `outcome === "qualified"`. It ignores integrity. Voided attempts drop out only because they are not "graded".
- **The manager's link view** (`shortlists.ts:164`) shows marks and sections only, with no integrity information.

## How it maps to the target flow

- **Step 4 (OA set-up):** policy toggles exist per exam. Missing:
  - a "hiring preset" that turns proctoring on by default for job tests (`job-test.ts` sets none);
  - per-job proctoring strictness.
- **Step 5 (monitoring and detection):**
  - **Works:** identity capture and human review, snapshots, the 10 browser/screen/voice events, origin hashing, reused-photo detection, model face comparison, live flags, viva follow-ups, code similarity and AI-use tracking.
  - **Partial:**
    - face comparison is on demand or bulk, never automatic at submit;
    - similarity is limited to one exam with no cross-exam, web or LLM-generated detection;
    - the photo drawer cannot be reached from Results.
  - **Missing:**
    - live face presence or multiple-face detection per snapshot;
    - keystroke and typing-cadence analysis;
    - device fingerprint beyond the UA;
    - an IP-change or geo-jump signal (rows exist per network/device but are never compared within one attempt);
    - time-anomaly scoring (too-fast correct answers);
    - a cap on event volume.
- **Step 6 (integrity-aware shortlist):**
  - **Missing almost entirely.** There is no per-attempt integrity summary row on `ResultRow`, no integrity column, filter or sort in Results, no composite or level score, and no "needs review" queue.
  - Shortlists ignore integrity, and the manager's link shows none.
  - The only integrity-driven action today is a human void.
  - A builder needs to:
    1. aggregate signals 1-12 into a per-attempt `IntegritySummary` with named flags and severities;
    2. surface it as a column, filter and "review first" sort in Results;
    3. gate "Add to shortlist" behind a human acknowledgement of flags;
    4. show the flags and the human's note on the shortlist link.

  The repo's stance means any score should be advisory ("reasons to look") and must never auto-reject.
- **Step 7 (later rounds):** the ledger `head` and the report link can carry over. AI interview `concerns` are separate and not merged into any integrity view.
- **Step 8 (admin):** nothing org- or platform-level aggregates integrity across exams. `reusedPhotos` is org-wide, but it is only surfaced per exam.

## Extension points and conventions

- **Service + routes:** copy `proxy.ts` + `proxy-routes.ts`. The pattern is:
  - a class taking stores and services, with an injected `now`;
  - permission checks via `can(actor, …)`;
  - `AttemptError` / `Forbidden`;
  - `recordAudit`;
  - zod schemas with an OpenAPI `summary`/`description`, a `refusals` map and `security: [{ staffAuth: [] }]`.
  
  Register the routes in `server.ts:1346` style (`if (options.x !== undefined) register…`). Wire them in `assemble.ts:268-276`, `testing/harness.ts:376-382` **and** `openapi.ts:95-98`.
- **Store + migration:** copy `proxy-store.ts` (`withScope(sql, staffScope(orgId), tx => …)`) with migration `0040_proxy_checks.sql` (restrictive `tenant_isolation`, staff policy, GRANT to `parikshaa_app`). If the table is per attempt, add a DELETE to the erasure sweep at `ledger-store.ts:571`. The next migration number is `0066_*.sql`.
- **Candidate-write telemetry:** copy the candidate INSERT-only RLS in `0011:51-56`, and `proctoring.ts#open`, which refuses closed or expired attempts.
- **Model calls:** copy `proxy.ts:139-160`. That means `exams.authoring(actor, (client, model) => client.messages.parse({… zodOutputFormat …}), {permission, route})`, which spend-caps and records usage. Fakes go in `api/src/fake-model.ts` (`FakeModelScript`); tests are like `proxy.test.ts` (`freshDatabase`, `wire(pgliteExecutor(db), { client: fakeModel(...).client, now })`).
- **Human decisions on the record:** copy `ProctorService.reviewIdentity`, which appends a ledger event with a `guard` plus an audit entry.
- **Results fields:** extend `ResultRow` in `results.ts:39`, the zod `resultsResponse` in `results-routes.ts:94`, and the hand-written types in `console/src/api.ts:798+`.
- **Console:** lazy-load new panels the way `Results.tsx:13-15` does. Event labels already exist in `candidate-report.ts:91` (`EVENT_LABELS`) and `Proctoring.tsx:14`; reuse them rather than adding a third copy. Console Hindi strings go in `console/src/hindi.ts`; web strings go in `web/src/locales`.
- **Outbox email:** see `results.ts:175-185` (`identity.queueStaffEmail`) and `release` → `invitations.enqueue` (:236).
- **Tracker:** `CLAUDE.md` requires updating `docs/PREP-TRACKER.md` in the same PR.

## Risks / gotchas

- **Repo principle:** every integrity artefact is labelled "observations, never findings" (`proctoring.ts:29-31`, `ProctoringPolicy` doc, Results :22). Viva verdicts must never move grades (`service.ts:1494`). A composite score that auto-filters would break this and the tests' wording. Keep it advisory, with a human acknowledgement before shortlisting or rejecting.
- **Sealing:** photos need the attempt data key. `NoDataKey` is thrown after erasure (`proctor-store.ts:48`). The reasoning text of viva assessments is sealed, so aggregate only labels and counts.
- **The ledger is append-only and hash-chained.** Never store derived scores in it; put them in a side table like `identity_checks`. Guards run under a row lock (`ledger-store.ts:431`).
- **Permissions:**
  - results need `attempt:review`;
  - proctoring and proxy need `attempt:read`;
  - identity review needs `attempt:extend` (invigilator), which **API keys are refused** (`staff-auth.ts:119`);
  - the shortlist link reader is a synthetic `viewer` actor (`shortlists.ts:88`).
- **Performance:**
  - `ProxyService.report` loops `proctor.view` per row to count unchecked attempts, an N+1 (`proxy.ts:114-118`);
  - `checkAll` makes model calls one after another;
  - `results()` folds every ledger on each call;
  - similarity is O(n²) per question.
  
  An integrity column over a big job applicant pool will need a materialised side table.
- **Signal gaps:**
  - `reusedPhotos` is org-wide but filtered to the exam's refs;
  - `proctor_events` has no per-attempt cap;
  - live flags (away/idle) are not persisted, so they cannot feed a post-hoc summary;
  - shared-origin detection is suppressed for exams with lab networks.
- **OpenAPI:** any route or schema change requires `npm run openapi`. `openapi.test.ts:54` fails against the committed `docs/openapi.json`. New services must also be constructed in `openapi.ts`.
- **Bundle budget:** `npm run build:clients && npm run budget` (`bundle-budget.json`). Keep new console panels lazy, as `ProxyCheck` and `Shortlists` are.
- **Shortlists are keyed by `candidate_ref` + exam**, not by application or job. A per-job pipeline needs a new link between applicant, attempt and exam; the `invitations` table is the current join from `attemptId` to ref, name and email.