---
tags:
  - bizing
  - domain
  - generated
  - operations
---

# Operations Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/operations.ts`
- Schema file: `packages/db/src/schema/operations_backbone.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Operations read-model routes.

ELI5:
Core tables store precise facts. Operators also need one summary payload that
says "how are my locations doing right now?" This route gives that overview
without forcing every client to manually join half the schema.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/operational-demands`
- `POST` `/api/v1/bizes/:bizId/operational-demands`
- `GET` `/api/v1/bizes/:bizId/operational-assignments`
- `POST` `/api/v1/bizes/:bizId/operational-assignments`
- `GET` `/api/v1/bizes/:bizId/operations/location-overview`
- `GET` `/api/v1/bizes/:bizId/analytics/overview`
- `GET` `/api/v1/bizes/:bizId/operations/daily-facts`

## Tables

- `operational_demands`
- `operational_assignments`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
