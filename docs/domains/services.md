---
tags:
  - bizing
  - domain
  - generated
  - services
---

# Services Domain

This file is generated from route/schema source files and the canonical domain manifest to keep docs synchronized with runtime mounts.

## Source

- Route file: `apps/api/src/routes/services.ts`
- Schema file: `packages/db/src/schema/services.ts`
- Mount path: `/`
- Auth class (manifest): `machine_allowed`

## Route Intent (top JSDoc)

Service-group routes (biz-scoped).

Catalog grouping is the only remaining concern in this domain after folding
the old service/service-product split into grouped offers + offer versions.

## Schema Intent (top JSDoc)

_No top JSDoc comment found._

## API Surface

- `GET` `/api/v1/bizes/:bizId/service-groups`
- `POST` `/api/v1/bizes/:bizId/service-groups`
- `GET` `/api/v1/bizes/:bizId/service-groups/:serviceGroupId`
- `PATCH` `/api/v1/bizes/:bizId/service-groups/:serviceGroupId`
- `DELETE` `/api/v1/bizes/:bizId/service-groups/:serviceGroupId`
- `GET` `/api/v1/bizes/:bizId/services`
- `POST` `/api/v1/bizes/:bizId/services`
- `GET` `/api/v1/bizes/:bizId/services/:serviceId`
- `PATCH` `/api/v1/bizes/:bizId/services/:serviceId`
- `DELETE` `/api/v1/bizes/:bizId/services/:serviceId`

## Tables

- `service_groups`
- `services`

## Notes

- Generated docs are high-signal maps, not a replacement for canonical architecture docs in [[API]] and [[SCHEMA_BIBLE]].
- Run `bun run docs:generate:domains` after changing route/schema behavior.
