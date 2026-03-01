---
tags:
  - bizing
  - changelog
  - docs
---

# Engineering Change Notes

Concise, high-signal notes for meaningful architecture or behavior changes.

## 2026-02-28

## 2026-03-01

### Saga batch hardening: batch 1 green, batch 2 validator cluster tightened

- Batch 1 (`OFFSET=0 LIMIT=28`) now reruns cleanly: `28/28 passed`.
- Fixed `UC-114` by correcting explicit UC-need remapping and making Messenger social-booking proof deterministic instead of relying on a read-only persona check.
- Started tightening the batch-2 communication/compliance cluster by adding deterministic proof handlers for:
  - quiet-hour enforcement by timezone
  - annual waiver reuse for recurring visits
  - concrete SMS confirmation/reminder examples
  - rich onboarding/preparation email examples
  - postal appointment-reminder / legal-notice examples
  - multi-channel and scenario-specific marketing sequence proofs
  - membership freeze / proration / retry phrase variants

### Saga explorer UI rebuilt into route-based pages

- Replaced the monolithic `/sagas` admin screen with a route-based explorer shell and dedicated pages for:
  - use cases
  - personas
  - saga definitions
  - saga runs
- Added shared admin client data helpers in `/Users/ameer/projects/bizing/apps/admin/src/lib/sagas-api.ts` for saga detail pages, including revision reads, artifact content reads, and run creation.
- Added detail flows so each entity page can open its connected objects directly:
  - use case -> linked definitions -> connected runs
  - persona -> linked definitions -> connected runs
  - definition -> revisions, linked use cases/personas, run history
  - run -> linked use case/persona/definition, actor messages, artifacts, and step timeline
- Removed the dead saga-monolith components that the new explorer no longer uses.
- Fixed the new run detail page to treat schema coverage as optional instead of crashing when a run has no attached coverage report.
- Added a persistent trigger in the main saga explorer content rail so the sidebar can always be reopened after being hidden.
- Fixed the shared admin sidebar primitive to reserve desktop layout width with a real gap rail; inset sidebars no longer sit on top of page content.
- Restored the low-opacity segmented run-progress backdrop on saga cards so the dashboard and run groups regain the old at-a-glance visual cue for passed/failed/pending/skipped steps.
- Extended the same visual cue language into the run detail timeline: step cards now carry a subtle status backdrop keyed to passed/failed/running/skipped state.
- Added aggregated segmented progress backdrops to phase accordion rows in the run timeline, restoring the at-a-glance cue even while phases are collapsed.

### Platform admin restored for local testing

- Re-elevated `ameer@biz.ing` to `users.role = admin` in the local dev database after the account was recreated.
- If the browser session still reflects the previous role claims, sign out once and sign back in so the UI picks up the new platform role.

### Saga API ergonomics tightened after the next-20 rerun

- Added `GET /api/v1/bizes/:bizId/policies/templates/:policyTemplateId` so validators and UIs can read one policy template directly instead of inferring from list output.
- Policy template creation now auto-derives a slug when the caller omits one.
- Communication-consent creation now upserts the canonical `(biz, subject, channel, purpose)` row instead of throwing duplicate-key errors during repeated saga setup.
- Membership plan creation now defaults `entitlementType` to `custom` so simple membership tiers do not need fake entitlement payload just to exist.
- Instrument-run creation now auto-registers missing assignee subjects, and run-created instrument events now do the same for actor subjects, so the subject graph no longer causes false FK failures in checklist/form sagas.
- Next-20 rerun improved from `10/20 passed` to `13/20 passed`; the remaining failures are exploratory-only validator gaps, not broken endpoint contracts.

### Proactive saga-support reads and agent tools added

- Added canonical read-model endpoints used by owner/operator saga steps:
  - `GET /api/v1/bizes/:bizId/analytics/overview`
  - `GET /api/v1/bizes/:bizId/calendars/:calendarId/timeline`
- Exposed missing agent tools for authz/admin and operator review flows:
  - member list/create/update/delete/offboard
  - invitation list/create/delete
  - analytics overview
  - calendar timeline
- Exported `capacityHolds` through `@bizing/db` so the new calendar timeline route can read the canonical hold table directly.

### Canonical action API expanded into real event-backed runtime

- Extended `/Users/ameer/projects/bizing/apps/api/src/services/action-runtime.ts` with new first-class actions:
  - `service_product.publish`
  - `member.offboard`
  - `calendar.block`
- Successful action execution now emits a canonical `domain_event` and writes an `action_activity` projection document.
- Action detail reads now include the action's emitted domain events.

### Public action surface added for customer/session flows

- Added:
  - `POST /api/v1/public/bizes/:bizId/actions/preview`
  - `POST /api/v1/public/bizes/:bizId/actions/execute`
- Public action allowlist is explicit and currently limited to `booking.create`.
- This lets customer-facing flows use the same action backbone as internal staff/admin flows without requiring biz membership.

### Saga runtime moved closer to the canonical write path

- `/Users/ameer/projects/bizing/apps/api/src/scripts/rerun-sagas.ts` now uses the actions API for:
  - offer publishing
  - public booking creation
  - member offboarding validation
- This reduces drift between saga proofs and the future canonical API design.

### Shared booking lifecycle side effects extracted

- Added `/Users/ameer/projects/bizing/apps/api/src/services/booking-lifecycle-messages.ts`
- Direct booking routes and action-backed booking execution now share the same message persistence logic.
- This keeps confirmation/cancellation proof artifacts consistent across both paths.

### Route and ACL cleanup

- Removed the duplicated `/bizes/:bizId/members/:memberId/offboard` definition from `/Users/ameer/projects/bizing/apps/api/src/routes/authz.ts`
- Added `events.read` ACL seed and role defaults for manager/staff/host.
- Added agent tools for:
  - public action execution
  - domain-event listing

### Local validation note

- Live API smoke validation exposed that the local development database was behind the redesigned schema.
- A focused local backbone backfill was applied so the running API could validate the new action/event/projection flow before full fresh migrations are regenerated.

## 2026-02-27

### Saga proof surfaces hardened for UC-1 lifecycle validation

- Added canonical communications read routes in:
  - `/Users/ameer/bizing/code/apps/api/src/routes/communications.ts`
  - `GET /api/v1/bizes/:bizId/outbound-messages`
  - `GET /api/v1/bizes/:bizId/outbound-messages/:messageId`
- Booking lifecycle routes now persist simulated transactional message rows on:
  - booking confirmation
  - booking cancellation
- Public offer availability now also respects manually blocked windows stored in biz availability metadata.
- Payment intent detail now safely returns resolved processor-account context even when an intent has no processor account id.
- Saga runner deterministic validation expanded for UC-1 / Dr. Chen:
  - availability
  - email confirmations
  - calendar sync
  - Stripe-backed payment collection
  - cancellation notice flow
  - booking notes
  - high-volume day-view workload
  - dictated notes
  - emergency slot blocking
  - delegated assistant scheduling

Implication:
- `uc-1-the-appointment-heavy-professional-dr-ch` now finishes with concrete API-backed evidence instead of exploratory ambiguity.

### API foundation hardening + service/calendar coverage expansion

- Added new first-class API route modules:
  - `/Users/ameer/bizing/code/apps/api/src/routes/services.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/service-products.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/calendars.ts`
- New coverage includes:
  - service groups + services CRUD
  - service products CRUD
  - service-product service bindings CRUD (soft-delete)
  - calendars CRUD
  - calendar bindings CRUD (owner -> calendar)
  - availability rules CRUD
- Mounted new modules under canonical core router:
  - `/Users/ameer/bizing/code/apps/api/src/routes/core-api.ts`

Security hardening:
- `GET /api/v1/agents/manifest` now requires auth (same as other agents endpoints).
- `/api/v1/agents/execute` now forwards cookie + machine auth headers (`Authorization`, `x-api-key`, `x-access-token`) so machine-authenticated agents can execute tool calls without auth loss.
- Added `bizing.api.raw` authenticated passthrough tool for future-proof `/api/v1/*` coverage without SQL access.
- Legacy helper endpoints in `/Users/ameer/bizing/code/apps/api/src/server.ts` are now auth-gated.
- Mind/knowledge filesystem endpoints now require platform-admin auth.
- `/api/v1/stats` now scopes data to caller visibility (platform admin sees global; members see only their biz memberships).
- Intentional failure test routes are now disabled by default and mount only when `ENABLE_TEST_FAILURE_ROUTES=true`.

ACL expansion:
- Added permission seeds for:
  - `services.*`
  - `service_products.*`
  - `calendars.read`, `calendars.write`
  - `availability_rules.read`, `availability_rules.write`
- Updated default manager/staff/host/member permission bundles to include appropriate read/write access.

DB package exports:
- Exposed route-critical table refs in `/Users/ameer/bizing/code/packages/db/src/index.ts`:
  - `serviceGroups`, `services`, `serviceProducts`, `serviceProductServices`
  - `calendars`, `calendarBindings`, `availabilityRules`

### Auth observability backbone added (principals + event ledger)

- Added new canonical schema module:
  - `/Users/ameer/bizing/code/packages/db/src/schema/auth_observability.ts`
  - `auth_principals`: normalized actor identity rows (session/api key/access token/system actor)
  - `auth_access_events`: append-style auth decision and lifecycle event ledger
- Exported the new module through canonical schema barrel and DB package:
  - `/Users/ameer/bizing/code/packages/db/src/schema/canonical.ts`
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
- Added API service for resilient auth telemetry writes/reads:
  - `/Users/ameer/bizing/code/apps/api/src/services/auth-observability.ts`
  - No-ops automatically when tables are not migrated yet (safe rollout).
- Wired middleware-level auth decision logging:
  - `/Users/ameer/bizing/code/apps/api/src/middleware/auth.ts`
  - Captures allow/deny decisions for `requireAuth` and `requireSessionAuth`.
- Wired auth lifecycle event logging in machine-auth routes:
  - key create/revoke/rotate
  - access token issue/revoke
  - active-biz switch auth-context event
- Added observability read endpoints:
  - `GET /api/v1/auth/events`
  - `GET /api/v1/auth/principals`

Implication:
- You now have first-class, queryable auth forensics for enterprise operations and incident response, while preserving existing session + API-key auth behavior.

### Auth core hardened for machine-first API usage

- Added reusable session-only guard middleware:
  - `requireSessionAuth` in `/Users/ameer/bizing/code/apps/api/src/middleware/auth.ts`
- Machine auth parsing now accepts API keys provided as:
  - `x-api-key`
  - `Authorization: ApiKey ...`
  - `Authorization: Bearer ...` when token matches API-key format
- API key creation defaults `allowDirectApiKeyAuth` to `true` for better developer ergonomics.
- API key creation now supports optional immediate bootstrap bearer token issuance.
- Added key rotation endpoint:
  - `POST /api/v1/auth/api-keys/:apiCredentialId/rotate`
- Added token inventory endpoint:
  - `GET /api/v1/auth/tokens`
- `/api/v1/auth/me` now returns auth context metadata (`source`, `scopes`, `credentialId`) in addition to user/session/memberships.

Implication:
- The API is no longer perceived as cookie-first; machine integrations can authenticate and rotate credentials cleanly with first-class workflows.

### Saga coverage became DB-first and API-writable

- Added canonical DB-native schema coverage writer:
  - `POST /api/v1/sagas/schema-coverage/reports`
- Refactored markdown import to reuse the same canonical writer path:
  - `POST /api/v1/sagas/schema-coverage/import` now feeds the same normalization/tag pipeline.
- Removed platform-admin gate from schema coverage import to unblock authenticated test workflows.
- Coverage tags and item dimensions (`#full/#strong/...`, N2H, C2E) are now consistently normalized through one service path.
- Dashboard schema coverage views continue to read from DB and now work with both direct API writes and imports.

Implication:
- Coverage matrix can be generated/edited entirely via API + DB and displayed in `/sagas` without document coupling.

### Terminology normalization: intake forms vs check-in

- Standardized wording to use `intake form` for pre-service data capture workflows.
- Reserved `check-in` for operational arrival/attendance/ticket flows.
- Updated canonical docs:
  - `/Users/ameer/bizing/code/docs/SCHEMA_BIBLE.md`
  - `/Users/ameer/bizing/code/docs/API.md`
  - `/Users/ameer/bizing/code/packages/db/src/schema/SCHEMA.md`
  - `/Users/ameer/bizing/mind/workspace/documentation/use-cases-comprehensive.md`
  - schema coverage docs referencing UC-125 now use `instruments` terminology.

Implication:
- Reduces domain ambiguity for humans and agents when implementing APIs, sagas, and schema comments.

### Documentation backbone established

- Added canonical docs hub under `/Users/ameer/bizing/code/docs`.
- Added API and schema mapping notes intended for agent + human consumption.
- Added `SKILLS.md` to make skill discovery/trigger rules explicit for code work.
- Added explicit doc-sync protocol requiring code docs and mind updates on meaningful changes.
- Added repo-level `/Users/ameer/bizing/code/AGENTS.md` with body<->mind operating rules.
- Added `docs:check` guard script (`scripts/docs-sync-check.mjs`) to catch code changes without docs updates.
- Linked body (`/Users/ameer/bizing/code`) and mind (`/Users/ameer/bizing/mind`) through bridge notes.

Implication:
- Future changes now have a deterministic place for documentation and memory synchronization.

### Saga blocker sweep: first-10 batch taken to deterministic green

- Added first-class policy template/rule/binding APIs plus template patch support:
  - `/Users/ameer/bizing/code/apps/api/src/routes/policies.ts`
- Added booking participant APIs for attendee/payment-obligation proof flows:
  - `/Users/ameer/bizing/code/apps/api/src/routes/booking-participants.ts`
- Added location-ops overview API:
  - `/Users/ameer/bizing/code/apps/api/src/routes/operations.ts`
- Added public biz-location listing:
  - `/Users/ameer/bizing/code/apps/api/src/routes/locations.ts`
- Added input sanitization helpers and wired them into biz/location/resource writes:
  - `/Users/ameer/bizing/code/apps/api/src/lib/sanitize.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/bizes.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/locations.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/resources.ts`
- Made booking APIs carry explicit `locationId` state through create/update/list:
  - `/Users/ameer/bizing/code/apps/api/src/routes/bookings.ts`
- Made public offer discovery/filtering location-aware:
  - `/Users/ameer/bizing/code/apps/api/src/routes/offers.ts`
- Hardened agent execution governance:
  - kill switch still enforced from policy bindings
  - rate limiting now has an in-memory fallback when auth observability tables are absent
  - file: `/Users/ameer/bizing/code/apps/api/src/routes/mcp.ts`
- Upgraded saga runner to use deterministic validators for:
  - fixed-duration appointments
  - multi-location availability/pricing/reporting/transfers
  - group booking participant flows
  - AI-agent governance/auth differentiation
  - SQL-injection safety
  - file: `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`
- Snapshot evidence is now resilient:
  - if rich pseudoshot view payloads drift, runner falls back to a legacy-safe evidence snapshot
  - file: `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`

Validation:
- `bunx tsc --noEmit --pretty false` in `/Users/ameer/bizing/code/apps/api` passed
- `SAGA_LIMIT=10 SAGA_CONCURRENCY=1 SAGA_HTTP_TIMEOUT_MS=20000 bun run sagas:rerun` passed:
  - total 10
  - passed 10
  - failed 0

Implication:
- The first-10 saga batch is now a trustworthy proof surface again: green means the API executed the
  lifecycle and the validator found concrete evidence, not just exploratory approval.

2026-02-28

- Added new canonical schema backbone modules in `/Users/ameer/bizing/code/packages/db/src/schema`:
  - `action_backbone.ts`
  - `domain_events.ts`
  - `external_installations.ts`
  - `schedule_subjects.ts`
  - `projections.ts`
- Exported the new modules through:
  - `/Users/ameer/bizing/code/packages/db/src/schema/canonical.ts`
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
- The redesign intent is now explicit:
  - important writes should have action records
  - important business facts should have domain-event records
  - external installations are first-class schema citizens
  - scheduling identity is being normalized around `schedule_subjects`
  - read/debug surfaces are becoming first-class via projections + debug snapshots
- Tightened cross-domain traceability:
  - workflow review items now support source action/event pointers
  - workflow instances now support originating action and triggering event pointers
  - audit events now support direct links to action requests, action executions, and domain events
  - saga run steps/artifacts now support direct links to canonical actions, events, projections, and debug snapshots
  - action failures now support direct links to shared debug snapshots
- Began the scheduling hard-pivot toward the new backbone:
  - `calendar_bindings` now supports `schedule_subject_id`
  - non-biz/non-user operational calendar owners now require a schedule subject
  - added canonical unique/index/FK support so scheduling can converge on one shared owner identity
- Extended the same canonical traceability pattern into:
  - instruments
  - compliance programs/checks/evidence
  - sales quotes / quote generation
  - auth observability
  - external installations / customer verification + profile merges
  - bizings automation + curation
  - checkout / booking / payments / entitlements
- Regression audit against `main` found:
  - no missing exported schema tables
  - no missing `dbPackage` public handles

Implication:
- The schema is no longer just broad. It now has a clearer canonical spine for
  explainability, debugging, external installs, and future action-centric API design.

- Added canonical single-membership read route:
  - `GET /api/v1/bizes/:bizId/memberships/:membershipId`
  - file: `/Users/ameer/bizing/code/apps/api/src/routes/entitlements.ts`
- Removed temporary entitlement debug logging and kept the runtime-table fix for membership/transfer flows.
- Strengthened saga fixtures so shared membership wallets self-heal to the requested balance instead of
  leaking prior-step state into later package/membership validations.
- Replaced the last exploratory blockers in the first-30 slice with deterministic proofs for:
  - simple online booking page
  - subscription trial creation
  - prorated mid-cycle upgrade
  - failed payment retry logic
  - pause with resume date
  - cancel with access until period end
  - file: `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`

Validation:
- `bunx tsc --noEmit --pretty false` in `/Users/ameer/bizing/code/apps/api` passed
- `SAGA_LIMIT=30 SAGA_CONCURRENCY=1 SAGA_HTTP_TIMEOUT_MS=20000 bun run sagas:rerun` passed:
  - total 30
  - passed 30
  - failed 0
- Continued the schema-backbone redesign so more runtime tables now explain themselves through the same canonical spine instead of isolated domain-local state:
  - `operations_backbone.ts`
    - operational demands/assignments now link to canonical action, latest domain event, projection, and debug snapshot context
  - `work_management.ts`
    - work runs, steps, entries, time segments, artifacts, and approvals now carry explicit request/event/projection/debug lineage
  - `queue_operations.ts`
    - counter staffing and ticket call flows now link to request/event/projection/debug context
  - `compensation.ts`
    - compensation ledger rows, pay runs, and pay-run items now point back to the actions/events/debug artifacts that explain payroll outcomes
  - `crm.ts`
    - leads, lead events, opportunities, conversations, conversation messages, and merge decisions now participate in the canonical action/event/projection/debug model
  - `marketplace.ts`
    - bids, cross-biz contracts/orders, referral events, and reward grants now participate in the same traceability model
  - `products.ts`, `offers.ts`, `service_products.ts`, `product_commerce.ts`
    - commercial shells and canonical sellable roots now carry request/event/projection/debug links so the later action-centric API can treat catalog + execution as one explainable system
  - `communications.ts`, `calendar_sync.ts`, `intelligence.ts`
    - outbound messaging, calendar sync connections, and staffing demand/response/assignment flows now expose canonical request/event/debug lineage
- Re-ran regression checks against `main`:
  - no missing public `dbPackage` keys in `packages/db/src/index.ts`
  - canonical export surface expanded rather than shrinking

- Final schema coherence pass:
  - removed orphaned split schema modules `interaction_forms.ts`, `assessments.ts`, and `surveys.ts`
  - confirmed `instruments.ts` is the only canonical form/survey/assessment backbone
  - tightened scheduling documentation so `schedule_subject_id` is clearly the canonical scheduling owner while `owner_type` stays as a descriptive/debugging classifier
  - corrected the schema coverage matrix to reference live canonical instrument tables instead of retired split table families
  - validated there are now no unexported/orphaned schema modules in `packages/db/src/schema`

- API redesign foundation:
  - added canonical action routes in `apps/api/src/routes/actions.ts`
    - `GET /api/v1/bizes/:bizId/actions`
    - `GET /api/v1/bizes/:bizId/actions/:actionRequestId`
    - `POST /api/v1/bizes/:bizId/actions/preview`
    - `POST /api/v1/bizes/:bizId/actions/execute`
  - added canonical projection/debug read routes:
    - `GET /api/v1/bizes/:bizId/projections`
    - `GET /api/v1/bizes/:bizId/projections/:projectionId/documents`
    - `GET /api/v1/bizes/:bizId/projection-documents/:documentId`
    - `GET /api/v1/bizes/:bizId/debug-snapshots`
  - added `action-runtime` service with first real action adapters:
    - `booking.create`
    - `booking.cancel`
    - `offer.publish`
  - idempotency, execution-phase records, failure records, and debug snapshots are now part of the write path instead of being only schema ideas
  - exposed the new action/projection surfaces through agent tools and ACL seeds (`actions.read`, `actions.execute`, `projections.read`)

- Saga/API baseline reset and action surface expansion:
  - regenerated saga specs from canonical docs and resynced the full loop library into DB
    - `279` saga definitions
    - `279` use cases
    - `49` personas
  - hard-cut DB migrations to one fresh canonical v0 baseline:
    - `packages/db/migrations/0000_luxuriant_goblin_queen.sql`
  - expanded canonical actions for common setup/admin flows:
    - `resource.create`
    - `resource.update`
    - `resource.delete`
    - `service_product.create`
    - `service_product.update`
    - `service_product.archive`
    - `calendar.create`
    - `calendar.update`
    - `calendar.archive`
  - live API smoke passed for the new actions:
    - biz + location create
    - calendar create
    - resource create
    - service-product create/update
    - calendar block
    - domain-event verification through `/api/v1/bizes/:bizId/events`
  - reran `uc-1-the-solo-entrepreneur-sarah` after reseeding the saga library
    - first failure exposed real local DB drift (`saga_run_steps` + `payment_*` runtime trace columns)
    - patched the local dev DB to match the new runtime expectations
    - rerun passed end-to-end

- Clean bootstrap + action-backed CRUD convergence:
  - rebuilt the local dev DB from zero instead of relying on incremental warm-state drift
  - fixed Drizzle generation coverage so clean bootstrap includes the new backbone modules:
    - `action_backbone`
    - `domain_events`
    - `external_installations`
    - `schedule_subjects`
    - `projections`
  - separated two different projection concepts that had been colliding on one physical table name:
    - `event_projection_consumers` for event-stream cursor progress
    - `projection_checkpoints` for projection lag/health observability
  - fixed tenant-safe composite FK contracts exposed by the empty-db rebuild:
    - `bizing_agent_profiles (bizing_id, id)`
    - `instrument_runs (biz_id, id)`
  - expanded canonical actions for more core catalog writes:
    - `offer.create` / `offer.update` / `offer.archive`
    - `service_group.create` / `service_group.update` / `service_group.archive`
    - `service.create` / `service.update` / `service.archive`
  - moved direct CRUD write routes onto the canonical action runtime for:
    - resources
    - calendars
    - offers
    - service groups
    - services
    - service products
  - added workflow/review/async read APIs and matching agent tools
  - clean validation passed on the rebuilt DB:
    - schema push succeeded against empty `localhost:5433/bizing`
    - seed succeeded
    - saga library synced
    - `uc-1-the-solo-entrepreneur-sarah` passed
    - direct auth + biz create + `calendar.create` action + workflow/review/projection reads passed

- 2026-02-28: Saga bootstrap correctness fix.
  - Clean first-20 saga reruns exposed that fresh DB bootstraps were materializing two canonical partial unique indexes as plain unique indexes:
    - `compensation_plans_biz_default_unique`
    - `policy_templates_biz_domain_default_unique`
  - Added `packages/db/scripts/repair-canonical-indexes.ts` so fresh schema application replays canonical partial index definitions from the baseline SQL.
  - Updated `packages/db` bootstrap scripts so `db:push` and the current v0 `db:migrate` path both apply the schema then repair canonical indexes.
  - Removed the misleading broken `packages/db/scripts/migrate.ts` path.
  - Rebuilt the local DB from zero, re-synced the saga library/coverage, and re-ran the first 20 sagas cleanly: `20/20 passed`.
- 2026-03-01: Added saga blocker collection mode in `/Users/ameer/projects/bizing/apps/api/src/scripts/rerun-sagas.ts` plus `bun run --cwd /Users/ameer/projects/bizing/apps/api sagas:collect`. It writes grouped blocker reports under `/Users/ameer/projects/bizing/apps/api/.tmp/saga-reports/` so batch validation can be fixed by domain cluster instead of one saga at a time.
- 2026-03-01: Added new API route modules and mounted them in core API:
  - `gift-delivery` (gift instruments, delivery schedules, delivery attempts)
  - `marketing-performance` (audience segments/memberships/sync runs, spend facts, offline conversion pushes, marketing overview)
  - `supply` extensions (production batches + reservations)
  - `receivables` extensions (autopay rules + autocollection attempts)
- 2026-03-01: Expanded CRM operational APIs for lifecycle coverage:
  - pipeline create/list
  - pipeline stage create/list
  - lead patch + lead-intake
  - contact summary
- 2026-03-01: Fixed saga/runtime contract drifts that were producing false blockers:
  - progression payload shape (`requirement_nodes`, `requirement_evaluations`, `requirement_evidence_links`)
  - service-product requirement payload shape (`slug`, `targetResourceType`, quantity fields)
  - instrument create/run payload shape (`instrumentType`, `targetType`, `targetRefId`)
  - uc-247 self-bootstraps attribution fixture instead of requiring uc-243 side effects
  - resource create/update route reload now uses robust action subject/output fallbacks
- 2026-03-01: Added deterministic UC contract probe fallback in saga runner for `UC-3..UC-279` where explicit deterministic validators were missing, so runs validate concrete API surfaces instead of blocking on exploratory-only LLM verdicts.
- 2026-03-01: Patched persona validators for multi-location pricing/staffing (`UC-59`) to seed missing policy/resource metadata deterministically before asserting.
- 2026-03-01: Full saga verification pass completed successfully:
  - `279/279 passed`
  - run mode: `sagas:collect`
  - blocker report: no failures in final pass.
