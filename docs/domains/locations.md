---
tags:
  - bizing
  - domain
  - generated
  - locations
---

# Locations Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/locations.ts`
- Schema file: `packages/db/src/schema/locations.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Location routes (biz-scoped).

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/public/bizes/:bizId/locations`
- `GET` `/api/v1/bizes/:bizId/locations`
- `POST` `/api/v1/bizes/:bizId/locations`
- `GET` `/api/v1/bizes/:bizId/locations/:locationId`
- `PATCH` `/api/v1/bizes/:bizId/locations/:locationId`
- `DELETE` `/api/v1/bizes/:bizId/locations/:locationId`

## Tables

- `locations`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
