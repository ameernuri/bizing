---
tags:
  - bizing
  - changelog
  - docs
---

# Engineering Change Notes

Concise, high-signal notes for meaningful architecture or behavior changes.

## 2026-02-28

## 2026-03-02

### Strict proving + CI gate + lifecycle FK canonicalization

- Completed full strict-mode proving run against dedicated strict API instance:
  - mode: `BIZING_RUNTIME_ASSURANCE_MODE=staging_strict`
  - command: `sagas:collect` (fast mode)
  - result: `284/284 passed` after blocker remediation.
- Added core CI workflow:
  - file: `/Users/ameer/bizing/code/.github/workflows/ci-core.yml`
  - gates:
    - API build (`bun run --cwd apps/api build`)
    - docs domain check (`bun run docs:check:domains`)
    - strict saga smoke on ephemeral Postgres:
      - DB push
      - API boot in strict assurance mode
      - generate/sync 1 saga spec
      - rerun 1 deterministic saga in fast mode
- Canonicalized missing auth observability schema registration:
  - added `./src/schema/auth_observability.ts` to Drizzle config:
    - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts`
- Made lifecycle delivery FK correction durable in bootstrap repair:
  - updated `/Users/ameer/bizing/code/packages/db/scripts/repair-canonical-indexes.ts`
  - now auto-detects legacy `lifecycle_events` FK targets on
    `lifecycle_event_deliveries`, deletes orphan rows, and rewires constraints
    to canonical `domain_events`.

### Hard-cut coherence pass: route classes, saga surface, delivery worker, strict assurance

- Route-class matrix now fails closed with no saga-legacy rule:
  - removed `/api/v1/sagas*` class mapping
  - unmatched routes now resolve to `internal_only` via `implicit-internal-fallback`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/middleware/route-class-matrix.ts`
- Removed lifecycle compatibility mirroring to legacy event rows:
  - action runtime no longer mirror-writes canonical `domain_events` into
    legacy lifecycle tables
  - lifecycle test route no longer inserts compatibility lifecycle rows
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts`
    - `/Users/ameer/bizing/code/apps/api/src/routes/lifecycle-hooks.ts`
- OODA saga route/docs hard-cut cleanup:
  - saga docs/help text now references only `/api/v1/ooda/sagas/*` clock/scheduler paths
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/routes/sagas.ts`
- Added real lifecycle delivery worker and control endpoints:
  - worker service:
    - `/Users/ameer/bizing/code/apps/api/src/services/lifecycle-delivery-worker.ts`
  - API endpoints:
    - `GET /api/v1/bizes/:bizId/lifecycle-event-deliveries/worker-health`
    - `POST /api/v1/bizes/:bizId/lifecycle-event-deliveries/process`
    - `POST /api/v1/lifecycle-event-deliveries/process-all`
  - server startup now launches the worker:
    - `/Users/ameer/bizing/code/apps/api/src/server.ts`
- Strict runtime assurance now fail-fast in strict modes:
  - new assurance mode utility:
    - `/Users/ameer/bizing/code/apps/api/src/lib/runtime-assurance.ts`
  - strict startup checks require `auth_access_events`
  - strict agent-governance checks no longer degrade when observability table is missing
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/server.ts`
    - `/Users/ameer/bizing/code/apps/api/src/routes/mcp.ts`
- Deterministic saga gating is now explicit:
  - exploratory UC/persona step evaluation remains advisory evidence only
  - missing deterministic contracts are reported as `blocked` with
    `MISSING_DETERMINISTIC_EXECUTOR_CONTRACT`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`

### Canonical CUD migration batch: queue + access-transfer domains

- Added reusable route-to-action bridge:
  - `/Users/ameer/bizing/code/apps/api/src/services/action-route-bridge.ts`
  - purpose: keep existing route ACL semantics while forcing route C/U/D
    through canonical `crud.*` action execution for traceability/idempotency.
- Migrated queue counter domain writes to canonical action execution:
  - `/Users/ameer/bizing/code/apps/api/src/routes/queue-counters.ts`
  - removed direct `db.insert/update/delete` in this route family.
- Migrated access transfer/resale domain writes to canonical action execution:
  - `/Users/ameer/bizing/code/apps/api/src/routes/access-transfers.ts`
  - transfer side-effects (artifact updates + artifact events) now also flow
    through canonical `crud.*` writes.
- Migrated most seating domain writes to canonical action execution:
  - `/Users/ameer/bizing/code/apps/api/src/routes/seating.ts`
  - single-row seat-map/seat/hold/reservation writes now use the route bridge.
  - intentional direct-write exception kept for bulk hold expiry endpoint
    (`.../holds/expire`) because it is a set-based transition.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api build` passes.

### Route-class matrix + CUD DSL + OODA-native saga surface

- Added a canonical route-class auth matrix:
  - `public`
  - `session_only`
  - `machine_allowed`
  - `internal_only`
- Implemented matrix enforcement in auth middleware so machine/session posture
  is checked centrally by route class instead of route-by-route drift.
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/middleware/route-class-matrix.ts`
    - `/Users/ameer/bizing/code/apps/api/src/middleware/auth.ts`
- Added generic CRUD action adapter DSL in canonical action runtime:
  - action keys starting with `crud.` are now supported
  - payload allows `tableKey` + `operation` + `data/patch/id`
  - emits canonical action/event/debug artifacts like other action adapters
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts`
- Added OODA-native saga API surface by mounting saga routes under:
  - `/api/v1/ooda/sagas/*`
  - file:
    - `/Users/ameer/bizing/code/apps/api/src/routes/core-api.ts`
- Added docs automation scaffold for per-domain source-of-truth maps:
  - generator script: `/Users/ameer/bizing/code/scripts/generate-domain-docs.mjs`
  - commands:
    - `bun run docs:generate:domains`
    - `bun run docs:check:domains`
  - generated output root:
    - `/Users/ameer/bizing/code/docs/domains`
- Strengthened fresh-bootstrap reliability checks:
  - added DB bootstrap verifier script:
    - `/Users/ameer/bizing/code/packages/db/scripts/verify-bootstrap.ts`
  - `db:push` / `db:migrate` now run:
    - schema push
    - canonical index repair
    - bootstrap verification
  - package script updates in:
    - `/Users/ameer/bizing/code/packages/db/package.json`

### Canonical hard-cut consolidation: memberships/events/ACL/actions/saga-spec/auth defaults

- Removed duplicate membership schema module:
  - deleted `/Users/ameer/bizing/code/packages/db/src/schema/memberships.ts`
  - canonical biz membership model is now Better Auth `members` + ACL mappings.
  - updated exports/config references in:
    - `/Users/ameer/bizing/code/packages/db/src/index.ts`
    - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts`
    - `/Users/ameer/bizing/code/packages/db/src/schema/users.ts`
- Unified event storage to one canonical rail:
  - removed duplicate `event_subscriptions` / `event_deliveries` from
    `/Users/ameer/bizing/code/packages/db/src/schema/domain_events.ts`
  - removed duplicate `lifecycle_events` table from
    `/Users/ameer/bizing/code/packages/db/src/schema/extensions.ts`
  - lifecycle subscriptions/deliveries now reference canonical `domain_events`.
  - updated dependent FKs:
    - `/Users/ameer/bizing/code/packages/db/src/schema/communications.ts`
    - `/Users/ameer/bizing/code/packages/db/src/schema/reporting.ts`
- Lifecycle API compatibility preserved while storage changed:
  - `/api/v1/bizes/:bizId/lifecycle-events*` now reads/writes `domain_events`
    and returns legacy response aliases (`eventName`, `entityType`, `entityId`)
    to keep saga contracts stable.
  - write endpoints now require `events.write`.
  - file: `/Users/ameer/bizing/code/apps/api/src/routes/lifecycle-hooks.ts`
- Action runtime now executes under one transaction context end-to-end:
  - added async-local transaction-scoped DB proxy so action adapters and helper
    writes share the same transaction boundary.
  - file: `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts`
- ACL runtime is now strict and cohesive:
  - removed legacy fallback evaluation path.
  - ACL bootstrap errors are now surfaced instead of silently swallowed.
  - file: `/Users/ameer/bizing/code/apps/api/src/services/acl.ts`
- Saga spec contract is now v1-only:
  - removed `saga.v0` parsing/normalization path.
  - OODash default draft definition template now emits `saga.v1`.
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/sagas/spec-schema.ts`
    - `/Users/ameer/bizing/code/apps/admin/src/lib/ooda-api.ts`
- API key auth acceptance widened by default:
  - `requireAuth` and `optionalAuth` now accept direct API keys by default.
  - API credential creation defaults to `allowDirectApiKeyAuth: true`.
  - files:
    - `/Users/ameer/bizing/code/apps/api/src/middleware/auth.ts`
    - `/Users/ameer/bizing/code/apps/api/src/services/machine-auth.ts`
- Validation:
  - `bun run --cwd apps/api build` passes
  - `bun run --cwd apps/admin build` passes
  - `bun run --cwd packages/db build` passes
  - corrected stale module mapping in
    `/Users/ameer/bizing/code/packages/db/SCHEMA_BIBLE.md` so docs reflect
    the canonical post-hard-cut schema file topology.

### Renamed saga explorer route surface to `/ooda` and `OODash` (hard cut)

- Canonical admin explorer route is now `/ooda` (and `/ooda/*`).
- Removed `/sagas/*` UI routes entirely in v0 (no compatibility redirect layer).
- Explorer shell naming updated in UI copy from "OODA Dashboard" to `OODash`.
- Fixed import drift in explorer components after route-surface rename:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/common.tsx`
- Removed legacy route files under:
  - `/Users/ameer/bizing/code/apps/admin/src/app/sagas/*`
- Validation:
  - `bun run --cwd apps/admin build` passes
  - `bun run --cwd apps/api build` passes

### Added internal QA Lab UI for endpoint + UC proving

- Added a new operator-focused page at `/sagas/lab`:
  - route: `/Users/ameer/bizing/code/apps/admin/src/app/sagas/lab/page.tsx`
  - screen component: `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/lab-page.tsx`
- QA Lab capabilities:
  - authenticated endpoint workbench (manual method/path/headers/body + rich response view)
  - deterministic smoke pack for high-signal baseline checks (`auth`, `sagas`, `ooda`, `agents`)
  - UC runner panel that launches saga definitions (`createRun` + `executeRun`) and links directly to run evidence pages
- Wired explorer navigation + dashboard entry points:
  - added `QA Lab` to saga sidebar in `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/sagas-shell.tsx`
  - added dashboard quick action button in `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/dashboard-page.tsx`
- Validation:
  - `bun run --cwd apps/admin build` passes, including type checks and static page generation.

### Added Operations Studio for full lifecycle endpoint simulation

- Added new route-based operator UI:
  - route: `/Users/ameer/bizing/code/apps/admin/src/app/sagas/studio/page.tsx`
  - screen: `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/ops-studio-page.tsx`
  - client API layer: `/Users/ameer/bizing/code/apps/admin/src/lib/studio-api.ts`
- Studio capabilities are lifecycle-focused (not generic endpoint exploration):
  - actor creation + impersonation token switching
  - biz setup (biz, locations, resources)
  - catalog setup (service groups/services/offers/offer versions/products/service products)
  - calendar setup (calendars, bindings, timeline)
  - customer flow (public offer availability, booking, advanced payment)
  - comms + payments visibility (outbound sms/email + payment intent details)
- Added secure platform-admin impersonation helpers in API:
  - `GET /api/v1/auth/impersonation/users`
  - `POST /api/v1/auth/impersonation/users`
  - `POST /api/v1/auth/impersonation/tokens`
  - implemented in `/Users/ameer/bizing/code/apps/api/src/routes/auth-machine.ts`
- Explorer navigation updates:
  - new sidebar item: `Operations Studio`
  - dashboard quick-link to `/sagas/studio`
- Validation:
  - `bun run --cwd apps/api build` passes
  - `bun run --cwd apps/admin build` passes

### Expanded Operations Studio into multi-domain endpoint exerciser

- Extended `/sagas/studio` beyond setup/catalog/booking to include first-class
  operational tabs that execute real API flows:
  - `Queues + Workflows + Dispatch`
  - `Memberships + Entitlements`
  - `CRM`
  - `Channels`
  - `Compliance`
- Added client wrappers in `/Users/ameer/bizing/code/apps/admin/src/lib/studio-api.ts`
  for these route families:
  - queues
  - workflows/review queues
  - dispatch
  - entitlements/memberships
  - CRM
  - channel integrations
  - compliance controls/gates
- Extended `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/ops-studio-page.tsx`
  with create/list/test handlers + payload viewers so operators can validate
  real lifecycle contracts without dropping into raw endpoint workbench mode.
- Validation:
  - `bun run --cwd apps/api build` passes
  - `bun run --cwd apps/admin build` passes

### Added one-click scenario macros in Operations Studio

- Added a new macro runner panel at the top of `/sagas/studio` with:
  - `Run full service lifecycle`
  - `Run ops control tower`
  - `Run revenue + growth stack`
  - `Run full suite`
- Macros execute real endpoint chains and now leave the Studio preloaded with
  refreshed evidence (bookings, payments/messages, queues/workflows, dispatch,
  memberships/entitlements, CRM, channels, compliance).

### Upgraded Operations Studio with sandbox isolation, API tracing, and visual calendar lensing

- Added sandbox-loop workflow to `/sagas/studio`:
  - create new sandbox loop contexts directly in the UI
  - seed users per sandbox
  - keep actor/entity visibility scoped to active sandbox via local registry
  - persist selected biz per sandbox for quick context switching
- Added context navigator panel:
  - list and switch sandbox-scoped bizes, locations, resources, services, and offers
  - one-click selection now updates dependent forms and booking/calendar controls
- Added API request inspector:
  - captures method/path/status/duration for every studio API call
  - renders exact endpoint URL, request JSON, and response JSON
  - implemented through shared trace listener in
    `/Users/ameer/bizing/code/apps/admin/src/lib/studio-api.ts`
- Added visual calendar rendering:
  - timeline lens controls (`all`, `location`, `resource`, `service`, `offer`)
  - rendered booking/hold event stream with status + references
  - retained raw timeline JSON panel for deep inspection
- Form UX improvement:
  - key setup forms now use visible field titles with inline explainer tooltips
    instead of placeholder-only inputs
- Validation:
  - `bun run --cwd apps/admin build` passes
  - `bun run --cwd apps/api build` passes
- Added step-by-step macro execution logs in UI so operators can see exactly
  which lifecycle steps completed and where failures occurred.
- Validation:
  - `bun run --cwd apps/api build` passes
  - `bun run --cwd apps/admin build` passes

## 2026-03-01

### Saga generation upgraded to higher-fidelity lifecycle simulation

- Updated `/Users/ameer/bizing/code/apps/api/src/services/sagas.ts` generator logic
  so generated `saga.v1` specs are more realistic and deterministic:
  - UC-keyword extensions now inject richer explicit lifecycle steps for:
    - call-fee pricing
    - demand/surge pricing
    - queue/waitlist flow
    - advanced payments
    - external integrations
    - compliance checks
    - route/dispatch operations
    - analytics/kpi closeout checks
  - Communication-heavy UCs now include explicit actor-message proof steps:
    - `demo-send-email-message`
    - `demo-send-sms-message`
    - `demo-verify-comms-messages`
  - Core lifecycle steps now include virtual clock/scheduler delays (`fixed` and
    `until_condition`) so timeline behavior better represents real-world pacing.
- Regenerated specs from canonical docs and synced definitions:
  - command: `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate -- --overwrite=true --sync=true`
  - generated: `279`
  - synced definitions: `282`
- Smoke validation after generation:
  - `SAGA_LIMIT=20 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:collect`
  - result: `20/20 passed`

### Deterministic saga message-demo step handlers

- Added explicit runner handlers in `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`:
  - `demo-send-email-message`
  - `demo-send-sms-message`
  - `demo-verify-comms-messages`
- Purpose:
  - let teams create tiny comms-focused saga definitions that always generate
    visible run actor-message evidence (SMS + email) in UI and API.
- Verified with a new demo definition/run:
  - run produced 2 actor messages (`1 email`, `1 sms`) and passed.

### OODA loop detail UX simplified (no explicit phase jargon)

- Refactored `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
  to remove explicit `Observe/Orient/Decide/Act` framing from operator UX.
- Replaced phase-board layout with principle-driven lanes:
  - `Signals & Gaps`
  - `Decisions & Plans`
  - `Execution Outcomes`
- Removed phase controls from loop edit + entry creation dialogs.
- Loop-entry writes now auto-map backend phase from entry type so the schema/API
  remain canonical while the UX stays simple and practical.
- Removed redundant client-side run execution/linking calls from loop detail.
  The loop-run API is now the single source of truth for execute + link behavior.
- Loop-entry UI now auto-fills contract-required evidence fields:
  - adds `evidence.reportNote` from body/title
  - infers `owningLayer` from selected `gapType`
  This keeps add-entry UX simple while satisfying backend quality constraints.
- Mission-first copy pass:
  - loop list/detail/navigation copy now uses "missions" as the primary UX term
  - removed remaining explicit phase jargon from list/detail headlines
  - mission cards now show `last signal` instead of internal `currentPhase`

### OODA loop-run linkage and execution stabilization

- Fixed `/api/v1/ooda/loops/:loopId/saga-runs` so loop-launched runs are always
  linked canonically, not just in JSON payloads:
  - now always upserts `ooda_loop_links` with `targetType='saga_run'`,
    `relationRole='output'`
  - now writes `ooda_loop_actions.linkedSagaRunId` from the created run id
- Added `autoExecute` support on loop-run creation (default `true`):
  - when session cookie exists, run executes immediately server-side
  - when cookie is missing, action is marked failed with an explicit reason
  - route now returns refreshed run detail after execution attempt
- Added OODA loop self-heal on loop-detail reads:
  - backfills missing run links from action payloads when possible
  - marks stale actions as failed when referenced runs no longer exist
    (common after hard reset/reseed cycles)
- Fixed hard-reset drift:
  - `resetSagaLoopData()` now truncates OODA tables too, preventing stale loop
    journals from pointing at deleted saga runs.

### OODA workflow-contract tightening (gate + gap ownership + evidence quality)

- Aligned OODA schema/API to the v3 workflow contract:
  - Added explicit loop-gate API fields in `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`:
    - `designGateStatus` (`pending|passed|failed`)
    - `behaviorGateStatus` (`pending|passed|failed`)
  - Gate statuses are persisted in `ooda_loops.metadata.workflowContract` so no DB hard migration is required for the tighten pass.
  - Gap owner is now required at API level (`owningLayer`) and persisted as `evidence.owningLayer` on OODA entries.
- Tightened API request validation in `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`:
  - gap entries must include `owningLayer`
  - meaningful entries (`signal|result|postmortem`) require evidence anchors
  - resolved `result` entries must include API trace evidence refs
- Updated canonical docs:
  - `/Users/ameer/bizing/code/docs/API.md`
  - `/Users/ameer/bizing/code/docs/SCHEMA_BIBLE.md`

### Saga rerun fast mode added for quick validation loops

- Added first-class fast mode controls to `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`:
  - `SAGA_FAST_MODE=1` now defaults to:
    - keep per-step `pending -> in_progress -> terminal` lifecycle transitions
    - keep API trace artifact persistence (required for step pass-state validation)
    - no snapshot artifact persistence
    - no coverage persistence on final refresh
  - full-mode behavior remains unchanged when `SAGA_FAST_MODE` is not enabled.
- Added granular overrides for mixed runs:
  - `SAGA_ATTACH_API_TRACES`
  - `SAGA_ATTACH_SNAPSHOTS`
  - `SAGA_STEP_TRANSITION_IN_PROGRESS`
  - `SAGA_RECOMPUTE_INTEGRITY`
  - `SAGA_PERSIST_COVERAGE`
- Added script alias in `/Users/ameer/bizing/code/apps/api/package.json`:
  - `sagas:rerun:fast`
- Updated canonical API docs with fast-mode usage and override semantics:
  - `/Users/ameer/bizing/code/docs/API.md`

### Saga runtime hard-cut to `saga.v1` simulation model

- Upgraded canonical saga spec contract to `saga.v1` in:
  - `/Users/ameer/bizing/code/apps/api/src/sagas/spec-schema.ts`
  - `/Users/ameer/bizing/code/testing/sagas/SAGA_SPEC.md`
- Added first-class simulation config to spec:
  - `simulation.clock` (virtual/realtime, timezone, autoAdvance)
  - `simulation.scheduler` (deterministic/realtime, poll/timeout/tick defaults)
- Migrated file-based saga specs to `saga.v1` with simulation defaults:
  - `/Users/ameer/bizing/code/testing/sagas/specs/*.json`
- Added DB-native simulation primitives:
  - `saga_run_simulation_clocks`
  - `saga_run_scheduler_jobs`
  - plus new enums in `/Users/ameer/bizing/code/packages/db/src/schema/enums.ts`
- Saga run creation now seeds normalized simulation context and a run clock row.
- Saga run detail/test-mode responses now include:
  - `simulationClock`
  - `schedulerJobs`
- Added simulation control API endpoints:
  - `GET /api/v1/sagas/runs/:runId/clock`
  - `POST /api/v1/sagas/runs/:runId/clock/advance`
  - `GET /api/v1/sagas/runs/:runId/scheduler/jobs`
  - `POST /api/v1/sagas/runs/:runId/scheduler/jobs`
  - `PATCH /api/v1/sagas/runs/:runId/scheduler/jobs/:jobId`
- Added matching agent/code-mode tools for the new saga simulation APIs in:
  - `/Users/ameer/bizing/code/apps/api/src/code-mode/tools.ts`
- Reworked runner delay semantics in:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts`
  - fixed/condition delays now use virtual clock + scheduler jobs instead of wall-clock sleeps.

### OODA dashboard backbone added (schema + API + admin explorer)

- Added a new canonical schema module:
  - `/Users/ameer/bizing/code/packages/db/src/schema/ooda.ts`
  - `ooda_loops`
  - `ooda_loop_links`
  - `ooda_loop_entries`
  - `ooda_loop_actions`
- Wired OODA schema into DB package exports and drizzle schema config:
  - `/Users/ameer/bizing/code/packages/db/src/index.ts`
  - `/Users/ameer/bizing/code/packages/db/drizzle.config.ts`
- Added OODA API routes:
  - `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`
  - mounted through `/Users/ameer/bizing/code/apps/api/src/routes/core-api.ts`
- OODA mutations now emit live refresh events over the shared
  `/api/v1/ws/sagas` websocket transport, so loop list/detail pages update in
  near realtime across clients.
- Added OODA-aware admin client and realtime helper:
  - `/Users/ameer/bizing/code/apps/admin/src/lib/ooda-api.ts`
  - `/Users/ameer/bizing/code/apps/admin/src/lib/use-saga-realtime.ts`
- Added route-based OODA explorer pages:
  - `/Users/ameer/bizing/code/apps/admin/src/app/sagas/loops/page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/app/sagas/loops/[loopId]/page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loops-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
- Added `/ooda` route alias to the saga explorer shell:
  - `/Users/ameer/bizing/code/apps/admin/src/app/ooda/page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/app/ooda/[...slug]/page.tsx`
- Added create flows to list pages so use-cases/personas/definitions are
  crudable directly from the dashboard surface.
- Visual QA pass captured and reviewed screenshots under:
  - `/Users/ameer/bizing/code/.tmp/ooda-screens/`

### Saga library CRUD completed in detail pages

- Added full dashboard CRUD controls for:
  - use cases (`/sagas/use-cases/:ucKey`): edit definition, create new version, archive/delete
  - personas (`/sagas/personas/:personaKey`): edit definition, create new version, archive/delete
  - saga definitions (`/sagas/definitions/:sagaKey`): inspect JSON spec, edit/save spec, create explicit revision, archive/delete
- Extended admin client API methods in:
  - `/Users/ameer/bizing/code/apps/admin/src/lib/sagas-api.ts`
- Added scrollable editor dialogs for long markdown/json content so editing remains usable on large specs.
- Visual validation screenshots for new CRUD dialogs were captured under:
  - `/Users/ameer/bizing/code/.tmp/ooda-screens/`

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
- Added shared admin client data helpers in `/Users/ameer/bizing/code/apps/admin/src/lib/sagas-api.ts` for saga detail pages, including revision reads, artifact content reads, and run creation.
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

- Extended `/Users/ameer/bizing/code/apps/api/src/services/action-runtime.ts` with new first-class actions:
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

- `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts` now uses the actions API for:
  - offer publishing
  - public booking creation
  - member offboarding validation
- This reduces drift between saga proofs and the future canonical API design.

### Shared booking lifecycle side effects extracted

- Added `/Users/ameer/bizing/code/apps/api/src/services/booking-lifecycle-messages.ts`
- Direct booking routes and action-backed booking execution now share the same message persistence logic.
- This keeps confirmation/cancellation proof artifacts consistent across both paths.

### Route and ACL cleanup

- Removed the duplicated `/bizes/:bizId/members/:memberId/offboard` definition from `/Users/ameer/bizing/code/apps/api/src/routes/authz.ts`
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
- 2026-03-01: Added saga blocker collection mode in `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts` plus `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:collect`. It writes grouped blocker reports under `/Users/ameer/bizing/code/apps/api/.tmp/saga-reports/` so batch validation can be fixed by domain cluster instead of one saga at a time.
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

## Saga run pending-state fix (dashboard execution flow)

- Fixed a real run-start gap where dashboard flows created saga runs but did not consistently execute them, leaving runs indefinitely in `pending` (`started_at = null`, all steps pending).
- Updated run-start UX flows to call execute immediately after create:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/definition-detail-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
- Added explicit execution control + guarded auto-execution fallback on run detail:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/run-detail-page.tsx`
- Updated API docs to clarify saga run lifecycle:
  - create endpoint creates `pending`
  - execute endpoint starts deterministic runner
  - dashboard now does both in sequence

## Saga dashboard realtime UX stabilization

- Fixed visual refresh/flicker while sagas are running by switching websocket-triggered reloads to background refresh mode (no loading skeleton reset).
- Added in-flight guards and debounced realtime reload behavior on explorer pages:
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/dashboard-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/runs-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loops-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`
  - `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/run-detail-page.tsx`
- Result: realtime data still updates, but the UI remains stable while steps/events stream in.

## OODash loop cockpit redesign (intuitive + debuggable)

- Reworked `/sagas/loops/:loopId` into an operator-first cockpit instead of a raw log view.
- New interaction model in `/Users/ameer/bizing/code/apps/admin/src/components/sagas/explorer/loop-detail-page.tsx`:
  - **Current state panel** with phase/priority/health/open+blocked entry counts and linked-run pass rate.
  - **Execution control panel** for starting saga runs directly from loop context.
  - **Scope map** with resolved labels and direct navigation for linked use cases/personas/definitions/runs.
  - **Inline link management**: add and remove links from the same screen.
  - **Action log inspector** with request/result payload JSON inspection for visual debugging.
  - **Phase board** rendered as 4 OODA columns with unresolved filter and inline entry status transitions.
  - **Linked runs panel** with progress backdrops and quick drilldown into run evidence.
  - **Loop edit dialog** (title/objective/status/phase/priority/health/next-review) and expanded entry creation dialog.
- Outcome: OODash now maps more directly to the architecture (loop scope -> signals -> decisions -> actions -> run evidence) and supports full-loop debugging without context switching.

## Saga runner reliability hardening (2026-03-01)

- Hardened `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts` for large-batch stability:
  - default `SAGA_CONCURRENCY` lowered from `8` to `4`
  - default `SAGA_HTTP_TIMEOUT_MS` increased from `15000` to `45000`
  - new retry knobs:
    - `SAGA_HTTP_RETRY_COUNT` (default `2`)
    - `SAGA_HTTP_RETRY_DELAY_MS` (default `250`)
- `requestJson` now retries transient timeout/network/HTTP (`429`, `5xx`) failures with exponential backoff.
- Step status reporting now tolerates stale transition races (`passed -> in_progress`) so already-completed steps do not falsely fail.
- Validation:
  - reran previously failing sagas (`uc-72`, `uc-73`, `uc-74`, `uc-75`, `uc-76`, `uc-77`, `uc-79`) successfully.
  - full suite rerun result: `279/279 passed`.

## New comprehensive saga.v1 specs (2026-03-01)

- Added three new high-coverage saga definitions under `/Users/ameer/bizing/code/code/testing/sagas/specs`:
  - `uc-280-the-omnichannel-comms-orchestrator-lisa.json`
  - `uc-281-the-event-workflow-control-tower-marcus.json`
  - `uc-282-the-substitute-dispatch-automation-jake.json`
- These are comprehensive `saga.v1` specs with:
  - full lifecycle phases (owner setup -> customer flow -> abuse checks -> operations/reporting)
  - explicit workflow/notification-heavy UC requirements
  - virtual-time simulation config (`clock` + `scheduler`)
  - step-level delay coverage (`fixed` + `until_condition`) to exercise scheduler/clock APIs
  - SMS/email/push/in-app focused coverage targets in metadata.
- Validation run results (single-saga reruns):
  - `uc-280`: passed
  - `uc-281`: passed
  - `uc-282`: passed

## Saga library hard cut to new v1 set (2026-03-01)

- Replaced the previous saga spec corpus with the new comprehensive v1 set only:
  - `uc-280-the-omnichannel-comms-orchestrator-lisa`
  - `uc-281-the-event-workflow-control-tower-marcus`
  - `uc-282-the-substitute-dispatch-automation-jake`
- Removed all older JSON specs from `/Users/ameer/bizing/code/code/testing/sagas/specs`.
- Deleted all filesystem run artifacts:
  - `/Users/ameer/bizing/code/code/testing/sagas/runs/*`
  - `/Users/ameer/bizing/code/code/testing/sagas/reports/*`
- Purged DB run-state and run-derived coverage rows; detached OODA FK references to preserve loop journals.
- Pruned DB saga definitions/revisions to match the new 3-key corpus.
- Post-cut validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun`
  - result: `3/3 passed`.

## Saga corpus restoration on v1 standard (2026-03-01)

- Restored the legacy saga definition corpus after the hard-cut reset.
- Ran generator from canonical docs with sync:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate -- --sync=true`
- Outcome:
  - regenerated `279` UC-derived saga specs from docs
  - retained the new comprehensive specs (`uc-280`, `uc-281`, `uc-282`)
  - total spec files: `282`
  - DB definitions synced: `282`
  - all specs verified on `schemaVersion = saga.v1`
- run-state remains clean (`saga_runs = 0`).

## Canonical route-write migration batch (2026-03-02)

- Expanded route-level canonical action delegation (`crud.*` bridge) across additional high-write families:
  - `/Users/ameer/bizing/code/apps/api/src/routes/biz-configs.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/commitments.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/supply.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/receivables.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/crm.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/hipaa.ts`
  - `/Users/ameer/bizing/code/apps/api/src/routes/education.ts`
- Preserved path-level behavior constraints where needed (for example route-scoped parent checks on commitment child patch routes).
- Updated canonical API docs to reflect newly delegated route families.
- Validation:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api build`
  - `bun run docs:check:domains`
- Direct route SQL write inventory moved from `276` to `201` in this batch window.

## Saga batch hardening pass (2026-03-02)

- Completed full 20-batch saga sweep in fast/collect mode and cleared blocker clusters to zero (`284` definitions, final failed count `0`).
- Hardened canonical action runtime for mixed-domain payloads and table shapes:
  - broadened temporal coercion support for non-uniform key suffixes and date-only strings.
  - fixed nullable-biz update/delete predicates to avoid false `CRUD_TARGET_NOT_FOUND` failures on global/shared tables.
- Added compatibility mirroring for legacy lifecycle-event FK drift:
  - lifecycle delivery/subscription paths now mirror `domain_events` into legacy `lifecycle_events` rows when needed, preventing FK breakage in mixed-state local DBs.
- Fixed public checkout recovery actor integrity:
  - public recovery consume now uses a real system actor row, avoiding action request FK failures.
- Hardened deterministic customer library rebuild behavior:
  - replaced soft-delete recreation path with deterministic hard-delete + recreate for owner/projection keys and consistently filtered reads to non-deleted rows.
- Targeted reruns for previously failing keys (`uc-151`, `uc-201`, `uc-202`, `uc-209`, `uc-212`, `uc-216`, `uc-221`, `uc-222`, `uc-236`, `uc-238`, `uc-25`, `uc-281`, `uc-59`) are now green.
- Final fast-mode verification rerun after fixes:
  - `SAGA_FAST_MODE=1 SAGA_COLLECT_MODE=1 SAGA_STRICT_EXIT=0 SAGA_STRICT_EXPLORATORY=0 bun run --cwd /Users/ameer/bizing/code/apps/api sagas:rerun`
  - result: `284/284 passed`, `0 failed`.

## Saga collector/reporting + customer library reliability fix (2026-03-02)

- `sagas:collect` report freshness fix:
  - `/Users/ameer/bizing/code/apps/api/src/scripts/rerun-sagas.ts` now writes blocker reports in collect mode even when failed runs = 0.
  - report payload now always includes run summary totals (`totalDefinitions`, `processed`, `passed`, `failed`, `durationMs`) so downstream dashboards/tools can rely on one canonical shape.
- Fixed customer library query aliasing failure under strict saga reruns:
  - `/Users/ameer/bizing/code/apps/api/src/routes/customer-library.ts`
  - root cause: table-qualified raw SQL reference for `deleted_at` did not survive generated alias contexts in some query plans.
  - fix: use alias-safe unqualified `deleted_at IS NULL` SQL fragment reused across owner/library reads and rebuild verification paths.
- Validation:
  - targeted failed keys rerun green:
    - `uc-201`, `uc-209`, `uc-222`, `uc-275`, `uc-54`, `uc-9`
  - full strict collect rerun:
    - `284/284 passed`, `0 failed`
