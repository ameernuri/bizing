---
tags:
  - bizing
  - domain
  - generated
  - access
---

# Access Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/access.ts`
- Schema file: `packages/db/src/schema/access_rights.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Access / ticket routes.

ELI5:
A booking can turn into a "ticket" that a person carries on their phone.
The ticket is not just text in booking metadata. It becomes a real access
artifact with:
- a stable artifact row,
- a QR-capable verification token,
- immutable timeline events,
- an optional attendance obligation for "did this person actually arrive?".

Why this module exists:
- QR check-in/ticketing flows are a recurring product need,
- the schema already has canonical access-right tables,
- sagas need first-class APIs to prove issuance, delivery, scanning,
  check-in, no-show, reissue, and offline sync behavior through the API.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/access-artifacts`
- `POST` `/api/v1/bizes/:bizId/access-artifacts`
- `GET` `/api/v1/bizes/:bizId/access-artifacts/:artifactId`
- `POST` `/api/v1/bizes/:bizId/access-artifact-links`
- `POST` `/api/v1/bizes/:bizId/access-links`
- `POST` `/api/v1/public/access/resolve`
- `POST` `/api/v1/public/access/consume`
- `POST` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/tickets`
- `GET` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/tickets`
- `POST` `/api/v1/bizes/:bizId/tickets/:accessArtifactId/reissue`
- `POST` `/api/v1/public/bizes/:bizId/tickets/resolve`
- `POST` `/api/v1/public/bizes/:bizId/tickets/scan`
- `POST` `/api/v1/bizes/:bizId/booking-orders/:bookingOrderId/no-show`

## Tables

- `access_artifacts`
- `access_artifact_links`
- `access_artifact_events`
- `access_activity_logs`
- `access_usage_windows`
- `access_delivery_links`
- `access_action_tokens`
- `access_action_token_events`
- `access_transfer_policies`
- `access_transfers`
- `access_resale_listings`
- `access_security_signals`
- `access_security_decisions`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
