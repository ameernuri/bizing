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

### Saga Lifecycle API

- Specs: `/api/v1/sagas/specs/*`
- Runs: `/api/v1/sagas/runs*`
- Step reporting: `/api/v1/sagas/runs/:runId/steps/:stepKey/result`
- Artifacts: snapshots/traces/report endpoints under `/api/v1/sagas/runs/:runId/*`
- Test-mode helpers: `/api/v1/sagas/test-mode/*`
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

Implementation:
- `/Users/ameer/bizing/code/apps/api/src/routes/sagas.ts`
- `/Users/ameer/bizing/code/testing/sagas/README.md`
- `/Users/ameer/bizing/code/testing/sagas/docs/API_CONTRACT.md`

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
- Public location discovery:
  - `GET /api/v1/public/bizes/:bizId/locations`

These exist primarily so saga validation can prove multi-location operations, participant-level group
flows, and governance controls through API-only evidence instead of exploratory guesses.

## Non-Negotiable Rule

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
