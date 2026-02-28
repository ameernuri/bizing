---
tags:
  - bizing
  - changelog
  - docs
---

# Engineering Change Notes

Concise, high-signal notes for meaningful architecture or behavior changes.

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
