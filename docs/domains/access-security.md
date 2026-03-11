---
tags:
  - bizing
  - domain
  - generated
  - access-security
---

# Access Security Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/access-security.ts`
- Schema file: `packages/db/src/schema/access_rights.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Access security routes.

ELI5:
This is where the platform records "something suspicious happened" and
"what did we decide to do about it?"

Why this route exists:
- digital delivery/security policy sagas need a concrete API,
- support and compliance need audit-friendly signal/decision rows,
- these are reusable primitives for fraud, abuse throttling, watermark
  violations, unusual geography, and future provider hooks.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/access-security-signals`
- `POST` `/api/v1/bizes/:bizId/access-security-signals`
- `GET` `/api/v1/bizes/:bizId/access-security-decisions`
- `POST` `/api/v1/bizes/:bizId/access-security-decisions`

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
