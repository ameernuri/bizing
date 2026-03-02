---
tags:
  - bizing
  - api
  - docs
---

# API Reference (Canonical)

This is the codebase-level API map used by humans and agents.

It complements implementation docs that live near code and the saga contract docs.

## API Base

- Local API: `http://localhost:6129`
- Versioned prefix: `/api/v1`

## Core Surfaces

## Terminology Guardrails

- `intake form` refers to structured pre-service data collection.
- `check-in` refers to operational arrival/attendance state.
- API and saga docs should avoid `check-in form` phrasing to prevent domain ambiguity.

### Authentication

- Better Auth session endpoints: `/api/auth/*`
- API/machine auth routes: `/api/v1/auth/*`
- Session context endpoint: `/api/v1/auth/me`
- Auth context includes auth source/scopes/credential id in `/api/v1/auth/me`.
- Machine-first endpoints:
  - `GET /api/v1/auth/api-keys`
  - `POST /api/v1/auth/api-keys` (supports optional bootstrap access token issuance)
  - `POST /api/v1/auth/api-keys/:apiCredentialId/rotate`
  - `POST /api/v1/auth/api-keys/:apiCredentialId/revoke`
  - `GET /api/v1/auth/events` (auth decision/lifecycle ledger)
  - `GET /api/v1/auth/principals` (normalized principal inventory)
  - `GET /api/v1/auth/tokens`
  - `POST /api/v1/auth/tokens/exchange`
  - `POST /api/v1/auth/tokens/:tokenId/revoke`

Machine auth inputs accepted by protected API routes:
- `Authorization: Bearer <short-lived-access-token>`
- `x-api-key: <raw-api-key>` or `Authorization: ApiKey <raw-api-key>`
- `Authorization: Bearer <raw-api-key>` is also interpreted as API key for UX compatibility.

### Agents API (tool execution surface)

- `GET /api/v1/agents/manifest`
- `GET /api/v1/agents/tools`
- `GET /api/v1/agents/search`
- `POST /api/v1/agents/execute`
- `bizing.api.raw` tool is available for authenticated, safe `/api/v1/*` passthrough
  when a dedicated named tool has not been added yet.

Implementation:
- `/Users/ameer/bizing/code/apps/api/src/routes/core-api.ts`
- `/Users/ameer/bizing/code/apps/api/src/routes/mcp.ts`
- `/Users/ameer/bizing/code/apps/api/src/code-mode/README.md`

### Canonical Action API

This is the new write backbone for important business operations.

ELI5:
- instead of only calling table-shaped mutation routes
- callers can say "preview" or "execute" one named business action
- the platform records:
  - the request
  - the execution phase
  - any failure/debug evidence
  - idempotency/retry context

Routes:
- `GET /api/v1/bizes/:bizId/actions`
- `GET /api/v1/bizes/:bizId/actions/:actionRequestId`
- `POST /api/v1/bizes/:bizId/actions/preview`
- `POST /api/v1/bizes/:bizId/actions/execute`

Current first-class action adapters:
- `booking.create`
- `booking.cancel`
- `offer.create`
- `offer.update`
- `offer.archive`
- `offer.publish`
- `resource.create`
- `resource.update`
- `resource.delete`
- `service_group.create`
- `service_group.update`
- `service_group.archive`
- `service.create`
- `service.update`
- `service.archive`
- `service_product.create`
- `service_product.update`
- `service_product.archive`
- `service_product.publish`
- `calendar.create`
- `calendar.update`
- `calendar.archive`
- `member.offboard`
- `calendar.block`

Canonical success side effects:
- successful action execution now emits one canonical `domain_event`
- successful action execution now writes one `action_activity` projection document
- action failures continue to write shared `debug_snapshots`

Current first-class projection/debug reads:
- `GET /api/v1/bizes/:bizId/projections`
- `GET /api/v1/bizes/:bizId/projections/:projectionId/documents`
- `GET /api/v1/bizes/:bizId/projection-documents/:documentId`
- `GET /api/v1/bizes/:bizId/debug-snapshots`
- `GET /api/v1/bizes/:bizId/events`
- `GET /api/v1/bizes/:bizId/events/:domainEventId`

Public-safe action surface:
- `POST /api/v1/public/bizes/:bizId/actions/preview`
- `POST /api/v1/public/bizes/:bizId/actions/execute`

ELI5:
- internal staff/admin surfaces use `/api/v1/bizes/:bizId/actions/*`
- customer/public surfaces can use `/api/v1/public/bizes/:bizId/actions/*`
- the public surface is allowlisted and currently only exposes `booking.create`
- this lets customer/session flows use the same action backbone without forcing
  them to be biz members

Security model:
- route-level ACL protects the action/projection surface itself
- action-specific ACL is evaluated again inside the action runtime
- idempotency collisions with mismatched payloads return conflict instead of replaying unsafe writes
- public actions do not bypass the backbone; they only use a narrower action allowlist

Implementation:
- `/Users/ameer/projects/bizing/apps/api/src/routes/actions.ts`
- `/Users/ameer/projects/bizing/apps/api/src/services/action-runtime.ts`
- `/Users/ameer/projects/bizing/apps/api/src/services/booking-lifecycle-messages.ts`
- `/Users/ameer/projects/bizing/apps/api/src/code-mode/tools.ts`

### Direct CRUD Writes That Now Flow Through Canonical Actions

ELI5:
- some routes still look like ordinary CRUD because that is convenient for app
  developers and admin UIs
- but the write itself now goes through the same action runtime as the explicit
  `/actions/execute` API
- that means one shared path for idempotency, execution records, events, and
  debugging

Current delegated write route families:
- resources
- calendars
- offers
- service groups
- services
- service products

### Saga Lifecycle API

- Specs: `/api/v1/sagas/specs/*`
- Spec contract: `testing/sagas/SAGA_SPEC.md` now canonical on `saga.v1`
  with first-class `simulation.clock` + `simulation.scheduler`.
- Runs: `/api/v1/sagas/runs*`
- Execute a created run: `POST /api/v1/sagas/runs/:runId/execute`
- Run simulation clock:
  - `GET /api/v1/sagas/runs/:runId/clock`
  - `POST /api/v1/sagas/runs/:runId/clock/advance`
- Run scheduler jobs:
  - `GET /api/v1/sagas/runs/:runId/scheduler/jobs`
  - `POST /api/v1/sagas/runs/:runId/scheduler/jobs`
  - `PATCH /api/v1/sagas/runs/:runId/scheduler/jobs/:jobId`
- Step reporting: `/api/v1/sagas/runs/:runId/steps/:stepKey/result`
- Artifacts: snapshots/traces/report endpoints under `/api/v1/sagas/runs/:runId/*`
- Test-mode helpers: `/api/v1/sagas/test-mode/*`
- Bulk validation workflow:
  - `bun run --cwd /Users/ameer/projects/bizing/apps/api sagas:rerun`
  - `bun run --cwd /Users/ameer/projects/bizing/apps/api sagas:rerun:fast`
  - `bun run --cwd /Users/ameer/projects/bizing/apps/api sagas:collect`
  - Runner defaults are tuned for stability under large batches:
    - `SAGA_CONCURRENCY=4`
    - `SAGA_HTTP_TIMEOUT_MS=45000`
    - `SAGA_HTTP_RETRY_COUNT=2`
    - `SAGA_HTTP_RETRY_DELAY_MS=250`
  - Fast mode (`SAGA_FAST_MODE=1`) is for quick validation loops:
    - keeps API trace artifact writes on by default (required for pass-state integrity checks)
    - skips snapshot artifact writes by default
    - skips coverage persistence on final run refresh by default
    - keeps `pending -> in_progress -> terminal` step lifecycle transitions on by default
    - keeps deterministic step pass/fail execution through the same API calls
  - Fast-mode defaults are overrideable with explicit flags:
    - `SAGA_ATTACH_API_TRACES=1|0`
    - `SAGA_ATTACH_SNAPSHOTS=1|0`
    - `SAGA_STEP_TRANSITION_IN_PROGRESS=1|0`
    - `SAGA_PERSIST_COVERAGE=1|0`
    - `SAGA_RECOMPUTE_INTEGRITY=1|0`
  - You can still override these with env vars per run.
  - `sagas:collect` keeps running after failures, groups blockers by domain/endpoint, and writes the latest report to:
    - `/Users/ameer/projects/bizing/apps/api/.tmp/saga-reports/blockers-latest.json`
    - `/Users/ameer/projects/bizing/apps/api/.tmp/saga-reports/blockers-latest.md`
  - Use `sagas:collect` to find cluster-level API gaps first, then use targeted reruns to validate the fixes.
- Library entities:
  - Use cases: `/api/v1/sagas/use-cases*` and `/api/v1/sagas/use-cases/:ucKey/versions`
  - Personas: `/api/v1/sagas/personas*` and `/api/v1/sagas/personas/:personaKey/versions`
- Coverage (DB-first):
  - Run assessments: `/api/v1/sagas/run-assessments/reports*`
  - Schema baseline read: `/api/v1/sagas/schema-coverage/reports*`
  - Schema baseline write: `POST /api/v1/sagas/schema-coverage/reports`
  - Markdown import bridge: `POST /api/v1/sagas/schema-coverage/import`

Notes:
- Schema coverage is now canonical in DB and powers dashboard reads directly.
- Import endpoint is a convenience bridge from markdown into DB; it no longer requires platform-admin role.
- Deterministic validation now prefers concrete API proofs over vague exploratory verdicts for covered flows.
  Current first-class proof surfaces include:
  - public offer availability
  - outbound lifecycle messages
  - channel integration sync state
  - payment intent detail + processor account routing

Run lifecycle note (important):
- `POST /api/v1/sagas/runs` creates a run in `pending` state.
- Execution begins when `/api/v1/sagas/runs/:runId/execute` is called.
- Dashboard run-start flows now call both endpoints (`create` then `execute`) so new runs do not stay pending by accident.
- Delay/wait behavior now runs through scheduler jobs and simulation clock
  advancement, so test flows can model time passage deterministically without
  wall-clock sleeping.
- Runner reporting now tolerates stale `passed -> in_progress` race windows on
  step status updates, so completed steps are not falsely marked failed during
  transient retries.
- Deterministic message demo step keys are now available in saga runner:
  - `demo-send-email-message`
  - `demo-send-sms-message`
  - `demo-verify-comms-messages`
  These are useful for proving actor-message UI/API plumbing end-to-end.

Implementation:
- `/Users/ameer/bizing/code/apps/api/src/routes/sagas.ts`
- `/Users/ameer/bizing/code/testing/sagas/README.md`
- `/Users/ameer/bizing/code/testing/sagas/docs/API_CONTRACT.md`

### OODA Loop API

The saga explorer is now also the OODA dashboard backbone:
- Observe -> Orient -> Decide -> Act loops are first-class API objects.
- Loops link to use cases/personas/definitions/runs so debugging and planning
  are one connected flow.

Routes:
- `GET /api/v1/ooda/overview`
- `GET /api/v1/ooda/loops`
- `POST /api/v1/ooda/loops`
- `GET /api/v1/ooda/loops/:loopId`
- `PATCH /api/v1/ooda/loops/:loopId`
- `DELETE /api/v1/ooda/loops/:loopId` (soft archive)
- `GET /api/v1/ooda/loops/:loopId/links`
- `POST /api/v1/ooda/loops/:loopId/links`
- `DELETE /api/v1/ooda/loops/:loopId/links/:linkId`
- `GET /api/v1/ooda/loops/:loopId/entries`
- `POST /api/v1/ooda/loops/:loopId/entries`
- `PATCH /api/v1/ooda/loops/:loopId/entries/:entryId`
- `GET /api/v1/ooda/loops/:loopId/actions`
- `POST /api/v1/ooda/loops/:loopId/actions`
- `PATCH /api/v1/ooda/loops/:loopId/actions/:actionId`
- `POST /api/v1/ooda/loops/:loopId/saga-runs`
- `POST /api/v1/ooda/generate/draft` (LLM-assisted draft payloads)

Loop-run creation behavior (`POST /api/v1/ooda/loops/:loopId/saga-runs`):
- always creates a canonical `ooda_loop_links` output link for the new run id
- writes an OODA action row with the linked run id (no payload-only linkage)
- supports `autoExecute` (default `true`)
  - when session cookie is present, the run is executed immediately server-side
  - when cookie is missing, the run is created but action is marked failed with an explicit reason
- returns refreshed run state after execution attempt so the dashboard does not stay on stale `pending` payloads

Legacy data self-heal:
- `GET /api/v1/ooda/loops/:loopId` now runs lightweight linkage reconciliation:
  - backfills missing `linkedSagaRunId` from `resultPayload.runId` when valid
  - backfills missing `saga_run` output links
  - marks impossible stale action rows as failed (for example: run id was pruned during reset)

Realtime behavior:
- OODA mutations publish dashboard-refresh events through the existing
  `/api/v1/ws/sagas` websocket channel (shared transport, OODA payload marker).
- This keeps loop list/detail pages live-updating without introducing a second
  websocket protocol.

ELI5:
- `loops` are your high-level improvement missions.
- `entries` are timeline observations/decisions/results.
- `actions` are what you actually executed.
- `links` connect each loop to the exact UC/persona/saga/run evidence.

Contract tightenings (workflow alignment):
- Loop gates are now explicit API fields on loop create/update and are persisted
  under `metadata.workflowContract`:
  - `designGateStatus`: `pending | passed | failed`
  - `behaviorGateStatus`: `pending | passed | failed`
- Gap entries must include both:
  - `gapType` (canonical taxonomy)
  - `owningLayer` (one primary owner, persisted in entry `evidence.owningLayer`)
- Meaningful entries (`signal`, `result`, `postmortem`) require at least one
  evidence anchor in `evidence`:
  - `apiTraceRef(s)`, `snapshotRef(s)`, `eventRef(s)`, `auditRef(s)`, or `reportNote`
- `result` entries marked `resolved` must include API trace evidence
  (`apiTraceRef` or `apiTraceRefs`) so closure is proof-backed.

Implementation:
- `/Users/ameer/bizing/code/apps/api/src/routes/ooda.ts`

Admin explorer UI:
- `/sagas` now acts as a route-based explorer shell instead of one large dashboard component.
- Primary views are:
  - `/sagas` for current health and recent failures
  - `/sagas/loops` and `/sagas/loops/:loopId`
  - `/sagas/use-cases` and `/sagas/use-cases/:ucKey`
  - `/sagas/personas` and `/sagas/personas/:personaKey`
  - `/sagas/definitions` and `/sagas/definitions/:sagaKey`
  - `/sagas/runs` and `/sagas/runs/:runId`
- The intent is simple: every loop object gets its own detail page, and links between use cases, personas, definitions, and runs stay clickable instead of being buried in one stateful screen.
- Use-case/persona/definition detail pages now expose full CRUD operations:
  - edit core definition fields
  - create new version rows
  - archive/delete definition rows
  - for saga definitions specifically: inspect/edit full spec JSON and create explicit revisions from the dashboard
- `/ooda` and `/ooda/*` are aliases that redirect to the route-based explorer.
- Loop pages are now presented as **missions** in UI copy:
  - `/sagas/loops` -> mission list
  - `/sagas/loops/:loopId` -> mission control page
  (route names and API contract remain unchanged for compatibility).
- Loop detail UI now hides explicit `observe/orient/decide/act` controls and
  phase-board terminology in favor of operator-native lanes:
  - `Signals & Gaps`
  - `Decisions & Plans`
  - `Execution Outcomes`
- New loop-entry writes still preserve canonical backend phase values, but the
  UI maps them automatically from entry type so operators do not need to reason
  about phase taxonomy during normal use.
- The explorer shell now keeps a trigger in the main content rail too, so the sidebar can always be reopened after being hidden.
- Saga run cards, recent-run rows, and attention-queue cards now include a low-opacity segmented step-progress backdrop again, so pass/fail/pending state is visible at a glance before opening a run.
- Saga run detail step cards now use the same low-noise status backdrop treatment, so the timeline carries visual pass/fail/running cues without needing to read every badge first.
- Phase accordion rows in the step timeline now also show aggregated segmented progress, so collapsed phases still communicate their health at a glance.
- The shared sidebar primitive now reserves desktop layout width with an explicit gap rail, so inset sidebars no longer render on top of page content.
- Run detail pages defensively treat schema coverage as optional data, because some older or partial runs do not have a full coverage payload attached yet.
- Saga validation hardening now includes concrete proof handlers for: quiet-hour enforcement, annual waiver reuse, SMS confirmation/reminder examples, rich onboarding/preparation email examples, postal reminder/legal-notice examples, and membership freeze/proration/retry phrasing variants.
- Recent ergonomics fixes for the saga-heavy API surfaces:
  - policy templates can now be created without forcing the caller to precompute a slug
  - communication consent writes now behave like upserts on the canonical subject/channel/purpose tuple
  - membership plans default `entitlementType` to `custom` so simple plans do not need fake entitlement values
  - instrument-run creation auto-registers missing assignee subjects instead of failing on subject-graph FKs

### Workflow + Review Read API

These routes expose the long-running process layer that sits above actions and
events.

ELI5:
- actions answer "what was requested?"
- events answer "what fact happened?"
- workflows answer "what process is now running because of that?"
- review queues answer "what is waiting for a human/operator?"

Routes:
- `GET /api/v1/bizes/:bizId/review-queues`
- `GET /api/v1/bizes/:bizId/review-queue-items`
- `GET /api/v1/bizes/:bizId/review-queue-items/:reviewQueueItemId`
- `GET /api/v1/bizes/:bizId/workflows`
- `GET /api/v1/bizes/:bizId/workflows/:workflowInstanceId`
- `GET /api/v1/bizes/:bizId/workflows/:workflowInstanceId/steps`
- `GET /api/v1/bizes/:bizId/workflows/:workflowInstanceId/decisions`
- `GET /api/v1/bizes/:bizId/async-deliverables`
- `GET /api/v1/bizes/:bizId/async-deliverables/:asyncDeliverableId`

The agent surface now exposes matching tools for:
- review queue list/detail
- workflow list/detail/steps/decisions
- async deliverable list/detail

### Domain APIs (current v0 core)

- Bizes: `apps/api/src/routes/bizes.ts`
- Locations: `apps/api/src/routes/locations.ts`
- Resources: `apps/api/src/routes/resources.ts`
- Services + service groups: `apps/api/src/routes/services.ts`
- Service products + service bindings: `apps/api/src/routes/service-products.ts`
- Calendars + bindings + availability rules: `apps/api/src/routes/calendars.ts`
- Offers + versions: `apps/api/src/routes/offers.ts`
- Bookings/orders: `apps/api/src/routes/bookings.ts`
- Payments: `apps/api/src/routes/payments.ts`
- Entitlements + memberships: `apps/api/src/routes/entitlements.ts`
- Queues: `apps/api/src/routes/queues.ts`
- Channels/integrations: `apps/api/src/routes/channels.ts`
- Communications: `apps/api/src/routes/communications.ts`
- Demand pricing: `apps/api/src/routes/demand-pricing.ts`
- Compliance: `apps/api/src/routes/compliance.ts`
- Dispatch: `apps/api/src/routes/dispatch.ts`

Design note:
- these domain routes still exist and remain useful
- but the redesign direction is:
  - important writes move toward the canonical actions API
  - fast/readable consumer views move toward projection documents
  - failures become inspectable through debug snapshots instead of ad-hoc route-local logging
- the saga runner has started moving to this direction now:
  - offer publishing uses `offer.publish`
  - customer booking uses public `booking.create`
  - member offboarding validation uses `member.offboard`

### Saga library + migration baseline

- Saga library can be regenerated/reseeded from canonical markdown sources with:
  - `bun run --cwd /Users/ameer/bizing/code/apps/api sagas:generate -- --sync=true`
- Saga spec generation is now higher-fidelity by default:
  - adds deterministic UC-keyword-driven extension steps (demand pricing, call-fee,
    waitlist/queue, advanced payments, external integrations, compliance checks,
    dispatch/route review, analytics verification)
  - adds communication-proof steps for comms-heavy UCs:
    - `demo-send-email-message`
    - `demo-send-sms-message`
    - `demo-verify-comms-messages`
  - adds realistic virtual-time delays/waits on core lifecycle transitions so run
    timelines simulate real passage-of-time without wall-clock sleeps
- The canonical loop library is also reseedable through the authenticated API:
  - `POST /api/v1/sagas/library/reset-reseed`
  - `POST /api/v1/sagas/library/sync-docs`
- Reset/reseed now truncates OODA loop tables too (`ooda_loops`, links, entries, actions)
  so stale loop journals do not survive saga run hard resets.
- The DB migration stack has been hard-cut to one fresh v0 baseline:
  - `/Users/ameer/bizing/code/packages/db/migrations/0000_luxuriant_goblin_queen.sql`

ELI5:
- saga definitions now come from the docs + generated spec files again
- the database migration story is now "one clean canonical baseline", not "keep dragging legacy rename history forever"

### Lifecycle Evidence Surfaces

- Booking creation/cancellation persists simulated outbound lifecycle messages so API-only tests can prove
  confirmations and cancellations without direct mail provider access.
- Outbound messages now expose delivery event writes at
  `POST /api/v1/bizes/:bizId/outbound-messages/:messageId/events`, so reminder failures and retry
  telemetry can be proven without touching provider internals.
- Public availability reads include both booking conflicts and manually blocked windows stored in biz
  availability metadata, which lets operators hide one-off emergency slots without inventing a second model.
- Payment intent detail returns the resolved processor account, so saga/payment verification can prove
  whether a checkout flowed through the expected platform-managed processor.
- Memberships now have a canonical single-record read surface at
  `GET /api/v1/bizes/:bizId/memberships/:membershipId`, which makes pause/cancel/freeze lifecycle
  validation deterministic even when a biz has many memberships on the same plan.
- Snapshots attached to saga runs now fall back to a legacy-safe payload when a richer pseudoshot view
  shape drifts, so saga runs do not fail on presentation-only evidence formatting.

### Membership/entitlement routes worth relying on

- `GET /api/v1/bizes/:bizId/memberships`
- `POST /api/v1/bizes/:bizId/memberships`
- `GET /api/v1/bizes/:bizId/memberships/:membershipId`
- `PATCH /api/v1/bizes/:bizId/memberships/:membershipId`
- `POST /api/v1/bizes/:bizId/entitlement-grants`
- `POST /api/v1/bizes/:bizId/entitlement-transfers`
- `POST /api/v1/bizes/:bizId/rollover-runs`

These are the backbone routes the saga runner now uses to prove:
- trial subscriptions
- pause/freeze with retained credits
- cancel-at-period-end access semantics
- package/session transfers
- rollover and expiration behavior

### Security posture updates

- Legacy helper routes in `apps/api/src/server.ts` are now auth-gated.
- Mind/knowledge filesystem surfaces require platform-admin auth.
- `/api/v1/stats` is now tenant-scoped for non-platform users.
- `/api/v1/test/*` intentionally failing endpoints are disabled by default and
  only mounted when `ENABLE_TEST_FAILURE_ROUTES=true`.
- `POST /api/v1/agents/execute` now enforces biz-level agent governance without assuming the auth
  observability tables are present. Kill-switch policies still hard-stop agent traffic, and request
  throttling has an in-memory fallback so local/fresh-reset environments do not degrade into 500s.

### Additional v0 proof/ops routes

- Policies:
  - `GET /api/v1/bizes/:bizId/policies/templates`
  - `POST /api/v1/bizes/:bizId/policies/templates`
  - `PATCH /api/v1/bizes/:bizId/policies/templates/:policyTemplateId`
  - `GET /api/v1/bizes/:bizId/policies/templates/:policyTemplateId/rules`
  - `POST /api/v1/bizes/:bizId/policies/templates/:policyTemplateId/rules`
  - `GET /api/v1/bizes/:bizId/policies/bindings`
  - `POST /api/v1/bizes/:bizId/policies/bindings`
- Booking participants:
  - `GET /api/v1/bizes/:bizId/booking-orders/:bookingOrderId/participants`
  - `POST /api/v1/bizes/:bizId/booking-orders/:bookingOrderId/participants`
  - `PATCH /api/v1/bizes/:bizId/booking-orders/:bookingOrderId/participants/:participantId`
  - `POST /api/v1/bizes/:bizId/booking-orders/:bookingOrderId/participants/:participantId/events`
- Operations:
  - `GET /api/v1/bizes/:bizId/operations/location-overview`
  - `GET /api/v1/bizes/:bizId/analytics/overview`
- Calendar timeline read model:
  - `GET /api/v1/bizes/:bizId/calendars/:calendarId/timeline`
- Public location discovery:
  - `GET /api/v1/public/bizes/:bizId/locations`
- Authz admin surfaces exposed to agents:
  - `GET /api/v1/bizes/:bizId/members`
  - `POST /api/v1/bizes/:bizId/members`
  - `PATCH /api/v1/bizes/:bizId/members/:memberId`
  - `DELETE /api/v1/bizes/:bizId/members/:memberId`
  - `POST /api/v1/bizes/:bizId/members/:memberId/offboard`
  - `GET /api/v1/bizes/:bizId/invitations`
  - `POST /api/v1/bizes/:bizId/invitations`
  - `DELETE /api/v1/bizes/:bizId/invitations/:invitationId`

These exist primarily so saga validation can prove multi-location operations, participant-level group
flows, governance controls, owner revenue sanity, and calendar-review behavior through API-only
evidence instead of exploratory guesses.

### Why The New Read Models Exist

`GET /api/v1/bizes/:bizId/analytics/overview`
- ELI5:
  this is the "owner dashboard sanity payload".
- It answers the common questions a saga or admin UI keeps asking:
  - how many bookings exist
  - how much revenue is represented
  - which statuses dominate
  - which locations/offers/service-products are doing the most work
- It is a read model, not a second source of truth.

`GET /api/v1/bizes/:bizId/calendars/:calendarId/timeline`
- ELI5:
  this is the "tell me the full story of this calendar" payload.
- It returns the calendar plus:
  - bindings
  - active or historical rules in a window
  - holds in that window
  - bookings that match the bound owners/subjects
- This keeps saga calendar review and future operator UIs from having to
  manually fan out across bindings/rules/holds/bookings and guess how they fit
  together.

## Non-Negotiable Rule

### 2026-03-01 Saga Hardening Additions

- Added and mounted new API route surfaces used by saga lifecycle coverage:
  - gift delivery:
    - `GET /api/v1/bizes/:bizId/gift-instruments`
    - `POST /api/v1/bizes/:bizId/gift-instruments`
    - `GET /api/v1/bizes/:bizId/gift-delivery-schedules`
    - `POST /api/v1/bizes/:bizId/gift-delivery-schedules`
    - `PATCH /api/v1/bizes/:bizId/gift-delivery-schedules/:scheduleId`
    - `GET /api/v1/bizes/:bizId/gift-delivery-schedules/:scheduleId/attempts`
    - `POST /api/v1/bizes/:bizId/gift-delivery-schedules/:scheduleId/attempts`
  - marketing performance:
    - `GET /api/v1/bizes/:bizId/marketing/audience-segments`
    - `POST /api/v1/bizes/:bizId/marketing/audience-segments`
    - `GET /api/v1/bizes/:bizId/marketing/audience-segments/:segmentId/memberships`
    - `POST /api/v1/bizes/:bizId/marketing/audience-segments/:segmentId/memberships`
    - `GET /api/v1/bizes/:bizId/marketing/audience-sync-runs`
    - `POST /api/v1/bizes/:bizId/marketing/audience-sync-runs`
    - `GET /api/v1/bizes/:bizId/ad-spend-daily-facts`
    - `POST /api/v1/bizes/:bizId/ad-spend-daily-facts`
    - `GET /api/v1/bizes/:bizId/offline-conversion-pushes`
    - `POST /api/v1/bizes/:bizId/offline-conversion-pushes`
    - `GET /api/v1/bizes/:bizId/marketing/overview`
  - supply/AR extensions:
    - `GET /api/v1/bizes/:bizId/production-batches`
    - `POST /api/v1/bizes/:bizId/production-batches`
    - `PATCH /api/v1/bizes/:bizId/production-batches/:batchId`
    - `GET /api/v1/bizes/:bizId/production-batches/:batchId/reservations`
    - `POST /api/v1/bizes/:bizId/production-batches/:batchId/reservations`
    - `PATCH /api/v1/bizes/:bizId/production-batches/:batchId/reservations/:reservationId`
    - `GET /api/v1/bizes/:bizId/billing-account-autopay-rules`
    - `POST /api/v1/bizes/:bizId/billing-account-autopay-rules`
    - `GET /api/v1/bizes/:bizId/autocollection-attempts`
    - `POST /api/v1/bizes/:bizId/autocollection-attempts`
- Expanded CRM surfaces used by lifecycle sagas:
  - `GET /api/v1/bizes/:bizId/crm/pipelines`
  - `POST /api/v1/bizes/:bizId/crm/pipelines`
  - `GET /api/v1/bizes/:bizId/crm/pipelines/:pipelineId/stages`
  - `POST /api/v1/bizes/:bizId/crm/pipelines/:pipelineId/stages`
  - `PATCH /api/v1/bizes/:bizId/crm/leads/:leadId`
  - `POST /api/v1/bizes/:bizId/crm/lead-intake`
  - `GET /api/v1/bizes/:bizId/crm/contacts/:contactId/summary`
- Saga validator behavior now favors deterministic API contract probes over exploratory-only LLM verdicts for UC ranges with known route surfaces.

External actors (humans, third-party apps, testing agents) must use API contracts only.
No direct database access is part of public behavior validation.

## How This Doc Stays Current

When adding/changing/removing endpoints:
1. Update this file.
2. Update route-level comments/JSDoc near the code.
3. Add a concise note in `docs/CHANGE_NOTES.md`.
4. Update mind memory with impact summary.

## Mind Bridge

- [Mind API Mirror](/Users/ameer/bizing/mind/workspace/body/API.md)
- [Mind Doc Sync Mirror](/Users/ameer/bizing/mind/workspace/body/DOC_SYNC.md)
