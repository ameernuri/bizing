---
tags:
  - bizing
  - domain
  - generated
  - access-transfers
---

# Access Transfers Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/access-transfers.ts`
- Schema file: `packages/db/src/schema/access_rights.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Access transfer / resale routes.

ELI5:
Some access rights can move from one person to another.
This route family stores the policy ("is transfer allowed?") and the actual
transfer workflow ("requested", "accepted", "completed", etc.).

Why this route exists:
- ticket transfer and resale is a recurring product need,
- the schema already models transfer policy + transfer contracts,
- sagas need to prove ownership handoff and policy enforcement by API.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/access-transfer-policies`
- `POST` `/api/v1/bizes/:bizId/access-transfer-policies`
- `GET` `/api/v1/bizes/:bizId/access-transfers`
- `POST` `/api/v1/bizes/:bizId/access-transfers`
- `PATCH` `/api/v1/bizes/:bizId/access-transfers/:transferId`
- `GET` `/api/v1/bizes/:bizId/access-resale-listings`
- `POST` `/api/v1/bizes/:bizId/access-resale-listings`
- `PATCH` `/api/v1/bizes/:bizId/access-resale-listings/:listingId`

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
