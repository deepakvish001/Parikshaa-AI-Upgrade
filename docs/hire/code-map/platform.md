## Exists today

**Server and route registration**
- `packages/api/src/server.ts` (1396 lines). `ServerOptions` (101-214) holds one optional service per feature. `buildServer` registers Swagger tags and security schemes `staffAuth`, `attemptToken`, `learnerAuth`, `greenhouseKey` and `razorpaySignature` (295-355).
- The real routes live in a child plugin (636) so OpenAPI sees them. Features register at 1316-1366 as `if (options.x !== undefined) registerXRoutes(routes, { x, staff, throttle, candidate: requireAttempt })`.
- `JobTestService` is the exception: it is built inline at 1342 instead of being injected.
- `index.ts` only re-exports. The real wiring is in `assemble.ts` (production server, plus `DeliveryWorker` at 334-355).
- Auth guards in `server.ts`:
  - `staff(request, reply, permission)` (443-471): resolves the bearer, then 401, `two_factor_required`, `email_unverified`, 403 `forbidden`, then the per-org rate limit.
  - `requireAttempt` (473-501): verifies the JWT, applies the per-attempt rate limit and the lab network check.
  - `setErrorHandler` (503-625) maps domain errors to statuses. An unmapped error becomes 500 `internal_error`.

**Staff auth and roles**
- `staff-auth.ts`: `Actor` is a user or an api_key (22-47). `Permission` (58-73) has 15 values such as `exam:write`, `attempt:start`, `attempt:review`, `audit:read`, `org:manage`.
- The `GRANTS` table (93-107) covers 5 roles: owner, author, invigilator, reviewer, viewer. API keys cannot be owner.
- `can()` (117-122): an API key can never void or extend an attempt. `UNTIL_VERIFIED` (129) blocks `attempt:start`, `staff:manage` and `apikey:manage` until the owner's email is confirmed.
- Sessions are `pks_…` (12h) and API keys `pkk_…`; only SHA-256 digests are stored.
- The roles are enforced by CHECK constraints in `migrations/0003_tenancy.sql` (staff_users, api_keys) and by types in `store/src/identity-store.ts:19-23`.
- `auth.ts`: `AttemptTokens` is an HS256 JWT `{orgId, attemptId, examId, candidateId}` (25-70). The file says outright: "Parikshaa does not keep candidate accounts."
- `rate-limit.ts`: in-memory token buckets. `DEFAULT_LIMITS` (55-58) is 100/s with burst 400 per organisation, and 10/s with burst 60 per attempt.
- `LoginThrottle` (staff-auth.ts 311-352) also protects public codes, for example the `guard` in `shortlist-routes.ts:44-55`.

**Tenancy and RLS**
- `organisations` table (`0003_tenancy.sql:9`): `id, name, monthly_spend_cap_micro_usd, created_at`. `0063_organisation_kind.sql` adds `kind text CHECK IN ('institution','company')` with default `institution`.
- Roles come from `0002_roles.sql`: `parikshaa_owner` runs migrations and bypasses RLS; `parikshaa_app` is the runtime role.
- Grants on organisations/staff/sessions/keys are at `0003:192`. `0056` and `0058` strip all privileges from Supabase's `anon`, `authenticated` and `service_role`.
- `store/src/ledger-store.ts:32-54`: `Scope` is staff or candidate+attemptId. `withScope()` opens a transaction that sets `parikshaa.org_id`, `parikshaa.actor` and `parikshaa.attempt_id` (`sql.ts` transaction settings).
- Every table policy, template `0032_shortlists.sql` or `0065_class_lab.sql`:
  - a RESTRICTIVE `tenant_isolation` on `org_id = current_setting('parikshaa.org_id', true)`;
  - a permissive actor policy, e.g. `current_setting('parikshaa.actor', true) = 'staff'`;
  - an explicit `GRANT … TO parikshaa_app`.
- Public links put the org id in the code (`${orgId}.${code}`), parse it, then run under `staffScope(orgId)`. See `placement.ts:582-610` (`?apply=`, `?offer=`).
- `tenancy.test.ts` covers cross-org isolation, roles, API keys, sessions, audit and spend caps. It sets up as owner, then runs `SET ROLE parikshaa_app` (lines 79-96).

**Audit log**
- `audit_log` table (0003) is append-only, enforced by a trigger.
- Write with `ExamService.recordAudit(actor, "noun.verb", target, detail)` (`service.ts:1663`, private `#audit` at 247). Read with `GET /audit` (staff, `audit:read`, `account-routes.ts:393`).
- The words shown for each action live in `console/src/components/Home.tsx:60` (`ACTIONS`).

**Billing (how a company pays)**
- Tables in `0010_billing.sql`: `billing_accounts` (mode `prepaid`/`invoiced`, `price_paise`, `credits`, GST details), `credit_ledger` (one `attempt` row per attempt via a unique index), `payments`, invoices.
- `billing.ts:134` `consume()` / `139` `refund()` run through `ExamService`'s meter when an attempt starts (`service.ts:732`) and on invitation redemption (`service.ts:778`).
- So **one OA attempt costs one credit**. No credits means `OutOfCredits` → 402.
- Model spend is a separate monthly cap: `ExamService.authoring()` (284, needs a staff actor) and `modelCall(orgId, "interview")` (302) throw `SpendCapReached` (402) and record `model_usage`.
- `model_usage.route` has a CHECK constraint; the latest version is in `0062_ai_assist.sql`.
- Plans and grants are set by the operator in `billing-cli.ts`, not in the console.

**Self-serve signup**
- `onboarding.ts:126-160` `signUp`: creates the org with its `kind` (149), sets a prepaid plan (151), grants trial credits (152), creates an unverified owner, audits `org.created`, and queues verification mail.
- It is turned on by `SELF_SIGNUP=on`, `SIGNUP_PRICE_RUPEES` and `SIGNUP_TRIAL_CREDITS` (default 25) in `main.ts:87-102`.
- Routes in `onboarding-routes.ts`: `GET`/`POST /auth/signup` (public), `/auth/verify-email`, `/onboarding/sample`, `/onboarding/starter` (staff).
- `GET /auth/me` returns `organisation.kind` and `permissions` (`account-routes.ts:114-140`).
- The dashboard's `setup.kind`, `finished` and `shortlists` come from `ledger-store.ts:~866-910`.
- Console `Home.tsx:274` shows `HirePath` (716-770) for companies: four steps (role → invite → results → shortlist).

**Console shell**
- `App.tsx`: lazy page imports (57-66), the `View` union (68-95) held in React state (no URL router), `can()` from `me.permissions` (247), and the `tabs` array of `{view, label, permission, group: "assess"|"org", icon}` (430-451) rendered at 525-550.
- `SECTION_OF` (1015), `pageTitle` (~1045), `OTHER_PAGES`/`PAGE_NOTE` (~1110) must each get the new view.
- `api.ts`: `ConsoleClient` (957). Methods call `this.#request<T>(path, init)` (1058), which adds the bearer and maps errors to `ConsoleError` (status, code, problems).

**Admin**
- `Admin.tsx` is **organisation admin only**: `StaffPanel` (42), `ApiKeysPanel` (198), `UsagePanel` (308), `AuditPanel` (445), `AccountPanel` (524), all scoped to the actor's org.
- There is **no platform super-admin API or UI**. The operator works only through CLIs:
  - `admin-cli.ts` creates an org and its first owner;
  - `billing-cli.ts` handles plans, grants and invoices;
  - `pilot-report-cli.ts` reads across orgs by iterating `ReportStore.organisations()` (`report-store.ts:54`) and running `withScope` per org.

**OpenAPI**
- `openapi.ts` `specDocument()` builds the server over an "unusable" SQL executor.
- `generate-openapi.ts` writes `docs/openapi.json`; run it with `npm run openapi`.
- `openapi.test.ts` checks:
  - the committed file has not drifted;
  - every route has a tag, a summary and a security entry;
  - audiences stay separate: the `Candidate` tag is only for `/attempts/me*` and the invitation routes, `Practice` only for `/practice/{site}`.
- `schemas.ts` (958 lines) holds the shared Zod shapes, e.g. `errorResponse`, `examParams`.

**Tests**
- `testing/harness.ts`: `freshDatabase()` migrates PGlite once and snapshots it. `wire(sql, {client, now, mailer…})` builds every service and `buildServer`. Helpers: `addOrganisation`, `addStaff`, `signIn` (goes through `POST /auth/login`), `bearer`.
- `fake-model.ts`: `fakeModel(overrides)` scripts probe, grade, `job` (reading a JD), `identity`, `interview` and `assist`, and records the prompts it received.
- `shortlists.test.ts` is the canonical flow: wire, org, staff, `SET ROLE parikshaa_app`, sign in, create an exam, invite through CSV, redeem codes with `InviteCodes`, answer, grade, then call the feature.

**Outbox email**
- `store/src/outbox-store.ts` `enqueue(tx, orgId, drafts)` writes in the same transaction. Kinds are a TS union plus `outbox_kind_check`, last changed in `0052_interview_panel.sql`.
- Handlers by kind are wired in both `assemble.ts:334-355` and `harness.ts`. Pattern to follow: `ai-interview.ts:231` `#queueMail` / `237` `deliver`.

**i18n**
- `language.ts` `useConsoleLanguage()` returns `[lang, set, t]`. `hindi.ts` is a lazy-loaded `HINDI` map covering only navigation, page titles and page notes.

**Migrations**
- `store/src/migrate.ts`: files sorted lexically, each applied in one transaction, recorded by filename, with no down path.
- **The last migration is `0065_class_lab.sql`; the next is `0066_*`.** Some numbers are already used twice (0024 and 0033-0038) but nothing breaks.

## How it maps to the target flow

1. **Job posting.** Nothing exists: no jobs table, no `job:*` permission, no recruiter or hiring-manager role (only the 5 roles). `organisations.kind='company'` and `HirePath` exist. `roles.ts` has 60 role templates to seed a job's test.
2. **Apply and candidate portal.**
   - The public-link pattern works: the org is in the code, the server uses `staffScope`, and `LoginThrottle` limits guessing (placement drives, `?apply=`).
   - There is no candidate account or session type. Attempt tokens cover one attempt; learner `pl_` tokens cover one practice site, which means one org.
   - A cross-company "my applications" portal needs a new identity kind and a new security scheme.
3. **AI screening.** The metering and spend-cap path exists (`authoring` / `modelCall`). It needs a new `model_usage.route` value, which means a migration plus the `measure()` route type in `@parikshaa/viva`, and a new `fakeModel` script field.
4. **OA link by email.** Invitations, outbox email and `InviteCodes` work. Each attempt uses one prepaid credit. A self-signed-up company starts with 25 trial credits, and an unverified owner cannot invite (`attempt:start` is in `UNTIL_VERIFIED`).
5. **Monitoring.** The plumbing allows the camera (`permissions-policy camera=(self)`, server.ts:382), and the per-attempt rate limit applies. Proctoring itself is another subsystem.
6. **Integrity-aware shortlist.** Shortlist links exist (0032). Combining integrity factors is missing. The "a person decides" rule is enforced in `can()` (`attempt:void`); copy that.
7. **Rounds to offer.** Interviews (0036/0052), AI interviews (0060) and offers (0039, placement) exist with outbox kind `interview`. Nothing links them into one pipeline per job.
8. **Admin.**
   - Org admin works: staff, keys, spend, audit, billing, privacy, sign-in.
   - Platform super-admin is missing entirely: no cross-org API, role or console page; only CLIs.
   - Building it needs a new actor kind, because RLS needs `parikshaa.org_id` per transaction. Cross-org listing has to iterate orgs the way `report-store.ts:54` does.

## Extension points and conventions

- **Migration.** Write `0066_hire_*.sql` by copying `0032_shortlists.sql` or `0064_classes.sql`:
  - composite PK `(org_id, id)`, `org_id REFERENCES organisations(id)`;
  - CHECKs on length;
  - `ENABLE ROW LEVEL SECURITY`, the restrictive `tenant_isolation`, an actor policy, `GRANT … TO parikshaa_app`.
- **Store.** Copy `store/src/shortlist-store.ts`: a class over `SqlExecutor`, every method `withScope(this.#sql, staffScope(orgId), tx => …)` with `org_id` in every WHERE. Export it from `store/src/index.ts`. For PII (resume, phone, email) take a `RecordSeal` (`DataKeys.records("purpose")`, `sealing.ts:79`) as `ai-interview-store.ts` does: `seal.text` / `seal.open` with an aad.
- **Service.**
  - Copy `shortlists.ts`: an options object in the constructor, injectable `now` and `newId`, and a permission check through `can(actor, …)` that throws `Forbidden`.
  - Audit through `exams.recordAudit`, and add the action's words to `ACTIONS` in `Home.tsx`.
  - Model calls go through `exams.authoring()` or `modelCall()`.
- **Routes.** Copy `shortlist-routes.ts`: a `Routes` type, deps `{service, staff, throttle}`, Zod `body`/`params`/`response`, `security: SECURED` or `[]` for public routes, the `refusals` map, and a throttle guard on public codes.
  - Add an optional field to `ServerOptions`, register it in `server.ts` (~1350), and add a Swagger tag at 304-330.
  - Wire it in **all three** places: `assemble.ts`, `testing/harness.ts`, `openapi.ts`.
  - Run `npm run openapi`.
- **Email.** Use `invitationStore.enqueue(staffScope(org), drafts)` with a fixed id for idempotency. A new kind needs a migration on `outbox_kind_check`, the TS union in `outbox-store.ts`, and handlers in `assemble.ts` and `harness.ts`.
- **API test.** Copy `shortlists.test.ts` with `fakeModel({...})`, and add a script field in `fake-model.ts` for screening output.
- **Console.**
  - Add a lazy import with a budget entry, a `View` member, a `tabs` entry with a permission, and `SECTION_OF`, `pageTitle` and `PAGE_NOTE` entries.
  - Add `ConsoleClient` methods through `#request`, a component test like `Shortlists.test.tsx` (mock client plus `QueryClientProvider`), and Hindi labels in `hindi.ts`.
  - Steps for companies go in `HirePath` (`Home.tsx:716`).

## Risks / gotchas

- **RLS.**
  - A table without the permissive actor policy returns zero rows to `parikshaa_app`; tests run as the owner before `SET ROLE`, which can hide this.
  - Grants are explicit; DELETE is not granted by default.
  - Candidate-side tables need an `actor='candidate'` policy keyed on `parikshaa.attempt_id`.
- **Public endpoints.** They have no RateLimiter bucket, only `LoginThrottle` and `signupLimit`, so new apply/job-page routes need their own throttle. Parse the org id from the link code and never trust a body field for it.
- **Identity limits.** `staff_users.email` is unique across all orgs, and candidates are not staff. A candidate portal is a new auth surface (new token prefix and security scheme, plus the OpenAPI audience test).
- **Roles.** Adding recruiter, hiring-manager or platform-admin roles means changing two CHECK constraints, the `StaffRole` type, `GRANTS`, `EVERYTHING`, and the "role" tests in `tenancy.test.ts`. Any new permission that reaches outsiders belongs in `UNTIL_VERIFIED`.
- **Org kind.** It is a CHECK of 2 values; adding a TPO kind later needs a migration plus `OrganisationKind`.
- **Exams freeze once sat** (`ExamFrozen` 409) and exam ids are unique per org. A test generated per job must be a fresh exam or a clone. The ledger and `audit_log` are append-only.
- **Billing.** Every OA attempt uses a prepaid credit (402 `out_of_credits`); screening and interviews spend the model cap (402 `spend_cap_reached`). An API key cannot call `authoring` paths that need a person's decision.
- **Errors.** New error classes must be mapped in `setErrorHandler` or caught in the route, or they surface as 500.
- **Tests that will fail if you skip a step.**
  - `actions.test.ts` fails if any `"x.y"` audit action lacks words in `ACTIONS`.
  - `openapi.test.ts` fails on drift or on a route without tag, summary or security.
  - `bundle-budget.mjs` fails on a new chunk without an entry. The console `index-*.js` is held to 179 KB, so lazy-load new pages.
- **No deep links.** Console navigation is in-memory state, so job and pipeline pages cannot be linked unless boot-time query parsing is added (`App.tsx:150-237`).
- **Rate limits are per process.** One organisation shares a single bucket across all its staff and integrations.
- **Repo rules.** `CLAUDE.md` requires updating `docs/PREP-TRACKER.md` with every change, and running `npm run check`, `build:clients` + `budget`, and `openapi`.